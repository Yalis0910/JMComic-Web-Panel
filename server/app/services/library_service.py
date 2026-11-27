import hashlib
import json
import mimetypes
import os
import re
import shutil
import tempfile
import time
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import config_manager
from app.core.executor import run_blocking
from app.db.repositories import LibraryRepository

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
ARCHIVE_EXTS = {".zip", ".cbz"}
_JM_ID_RE = re.compile(r"(?:^|\D)(\d{5,8})(?:\D|$)")


def _natural_key(s: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", s)]


def _extract_album_id(name: str, full_path: Path) -> str:
    m = _JM_ID_RE.search(name)
    if m:
        return m.group(1)
    digest = hashlib.sha1(str(full_path).encode("utf-8")).hexdigest()[:10]
    return f"local_{digest}"


def _read_folder_meta(entry: Path) -> Dict[str, Any]:
    meta_path = entry / ".jmlis-meta.json"
    if not meta_path.is_file():
        return {}
    try:
        raw = json.loads(meta_path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def _inspect_folder_chapters(album_dir: Path) -> List[Dict[str, Any]]:
    direct_imgs = sorted(
        [p for p in album_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS],
        key=lambda p: _natural_key(p.name),
    )
    sub_dirs = sorted(
        [d for d in album_dir.iterdir() if d.is_dir() and not d.name.startswith(".")],
        key=lambda d: _natural_key(d.name),
    )

    chapters: List[Dict[str, Any]] = []
    if direct_imgs and not sub_dirs:
        chapters.append({"chapter_id": "1", "name": album_dir.name, "files": direct_imgs})
        return chapters

    for idx, sub in enumerate(sub_dirs, start=1):
        imgs = sorted(
            [p for p in sub.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS],
            key=lambda p: _natural_key(str(p.relative_to(sub))),
        )
        if imgs:
            chapters.append({"chapter_id": str(idx), "name": sub.name, "files": imgs})

    if not chapters and direct_imgs:
        chapters.append({"chapter_id": "1", "name": album_dir.name, "files": direct_imgs})

    return chapters


def _inspect_zip_chapters(zip_path: Path) -> List[Dict[str, Any]]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        img_names = sorted(
            [
                n for n in zf.namelist()
                if not n.endswith("/")
                and Path(n).suffix.lower() in IMAGE_EXTS
                and not n.startswith("__MACOSX")
                and not Path(n).name.startswith(".")
            ],
            key=_natural_key,
        )
    if not img_names:
        return []

    # 若图片按一级子目录分组（且存在 >=1 个带子目录的路径），拆分为多章节
    groups: Dict[str, List[str]] = {}
    has_subdirs = any(len(PurePosixPath(n).parts) >= 2 for n in img_names)
    if has_subdirs:
        for n in img_names:
            parts = PurePosixPath(n).parts
            key = parts[0] if len(parts) >= 2 else zip_path.stem
            groups.setdefault(key, []).append(n)
    else:
        groups[zip_path.stem] = img_names

    chapters: List[Dict[str, Any]] = []
    for idx, (chap_name, files) in enumerate(sorted(groups.items(), key=lambda kv: _natural_key(kv[0])), start=1):
        chapters.append({"chapter_id": str(idx), "name": chap_name, "files": files})
    return chapters


def _is_comic_folder(entry: Path) -> bool:
    """判断目录是否为单本漫画（直接含图片，或其子目录为仅含图片/单层图片的章节目录）。"""
    direct_imgs = any(p.is_file() and p.suffix.lower() in IMAGE_EXTS for p in entry.iterdir())
    if direct_imgs:
        return True
    if (entry / ".jmlis-meta.json").is_file():
        return True
    sub_dirs = [d for d in entry.iterdir() if d.is_dir() and not d.name.startswith(".")]
    if not sub_dirs:
        return False
    # 若任一子目录还包含更深层的“漫画目录”或“归档文件”，则当前目录大概率是作者/分类归档父目录
    for sub in sub_dirs:
        sub_has_direct_imgs = any(p.is_file() and p.suffix.lower() in IMAGE_EXTS for p in sub.iterdir())
        if sub_has_direct_imgs:
            continue
        sub_has_nested = any(
            (c.is_dir() and not c.name.startswith("."))
            or (c.is_file() and (c.suffix.lower() in ARCHIVE_EXTS or c.suffix.lower() == ".pdf"))
            for c in sub.iterdir()
        )
        if sub_has_nested:
            return False
    return any(
        any(p.is_file() and p.suffix.lower() in IMAGE_EXTS for p in sub.iterdir())
        for sub in sub_dirs
    )


def _scan_dir_sync(base_dir: Path, max_depth: int = 3) -> List[Dict[str, Any]]:
    if not base_dir.exists():
        return []

    now = int(time.time())
    items: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    def _unique_album_id(candidate: str, full_path: Path) -> str:
        if candidate not in seen_ids:
            seen_ids.add(candidate)
            return candidate
        digest = hashlib.sha1(str(full_path).encode("utf-8")).hexdigest()[:8]
        alt = f"{candidate}_{digest}"
        seen_ids.add(alt)
        return alt

    def _walk(cur_dir: Path, depth: int, parent_author: str = "") -> None:
        for entry in sorted(cur_dir.iterdir(), key=lambda p: p.name.lower()):
            if entry.name.startswith("."):
                continue

            if entry.is_dir():
                if _is_comic_folder(entry) or depth >= max_depth:
                    chapters = _inspect_folder_chapters(entry)
                    if not chapters:
                        continue
                    meta = _read_folder_meta(entry)
                    total_pages = sum(len(c["files"]) for c in chapters)
                    first_img = chapters[0]["files"][0]
                    total_size = sum(f.stat().st_size for c in chapters for f in c["files"])
                    aid = _unique_album_id(str(meta.get("album_id") or _extract_album_id(entry.name, entry)), entry)
                    author = str(meta.get("author") or parent_author or "")
                    tags = meta.get("tags") if isinstance(meta.get("tags"), list) and meta.get("tags") else ["本地目录"]
                    items.append(
                        {
                            "album_id": aid,
                            "title": str(meta.get("title") or entry.name),
                            "author": author,
                            "tags": [str(t) for t in tags],
                            "path": str(entry),
                            "format": "folder",
                            "chapter_count": len(chapters),
                            "page_count": total_pages,
                            "cover_path": str(first_img),
                            "size_bytes": total_size,
                            "scanned_at": now,
                        }
                    )
                else:
                    next_author = parent_author or (entry.name if depth == 1 else "")
                    _walk(entry, depth + 1, parent_author=next_author)

            elif entry.is_file() and entry.suffix.lower() in ARCHIVE_EXTS:
                try:
                    chapters = _inspect_zip_chapters(entry)
                    if not chapters:
                        continue
                    total_pages = sum(len(c["files"]) for c in chapters)
                    ext_label = "本地CBZ" if entry.suffix.lower() == ".cbz" else "本地ZIP"
                    items.append(
                        {
                            "album_id": _unique_album_id(_extract_album_id(entry.stem, entry), entry),
                            "title": entry.stem,
                            "author": parent_author,
                            "tags": [ext_label],
                            "path": str(entry),
                            "format": "zip",
                            "chapter_count": len(chapters),
                            "page_count": total_pages,
                            "cover_path": chapters[0]["files"][0],
                            "size_bytes": entry.stat().st_size,
                            "scanned_at": now,
                        }
                    )
                except zipfile.BadZipFile:
                    continue

            elif entry.is_file() and entry.suffix.lower() == ".pdf":
                items.append(
                    {
                        "album_id": _unique_album_id(_extract_album_id(entry.stem, entry), entry),
                        "title": entry.stem,
                        "author": parent_author,
                        "tags": ["本地PDF"],
                        "path": str(entry),
                        "format": "pdf",
                        "chapter_count": 1,
                        "page_count": 0,
                        "cover_path": "",
                        "size_bytes": entry.stat().st_size,
                        "scanned_at": now,
                    }
                )

    _walk(base_dir, 1)
    return items


class LocalLibraryService:
    def __init__(self) -> None:
        self.repo = LibraryRepository()

    async def scan(self) -> List[Dict[str, Any]]:
        base_dir = Path(config_manager.get_settings().download_dir)
        items = await run_blocking(_scan_dir_sync, base_dir)
        await self.repo.replace_all(items)
        return items

    async def list_items(self) -> List[Dict[str, Any]]:
        return await self.repo.list_items()

    async def get_detail(self, album_id: str) -> Optional[Dict[str, Any]]:
        item = await self.repo.get_item(album_id)
        if not item:
            return None
        path = Path(item["path"])
        if item["format"] == "zip":
            raw_chapters = await run_blocking(_inspect_zip_chapters, path)
            chapters = [
                {
                    "chapter_id": c["chapter_id"],
                    "index": idx,
                    "name": c["name"],
                    "page_count": len(c["files"]),
                }
                for idx, c in enumerate(raw_chapters, start=1)
            ]
        elif item["format"] == "pdf":
            chapters = [{"chapter_id": "1", "index": 1, "name": item["title"], "page_count": 0}]
        else:
            raw_chapters = await run_blocking(_inspect_folder_chapters, path)
            chapters = [
                {
                    "chapter_id": c["chapter_id"],
                    "index": idx,
                    "name": c["name"],
                    "page_count": len(c["files"]),
                }
                for idx, c in enumerate(raw_chapters, start=1)
            ]
        return {**item, "chapters": chapters}

    async def get_chapter_pages(self, album_id: str, chapter_id: str = "1") -> List[Dict[str, Any]]:
        item = await self.repo.get_item(album_id)
        if not item:
            raise FileNotFoundError("本地漫画不存在")
        path = Path(item["path"])
        if item["format"] == "pdf":
            return []
        if item["format"] == "zip":
            chapters = await run_blocking(_inspect_zip_chapters, path)
            target = next((c for c in chapters if c["chapter_id"] == str(chapter_id)), None)
            if not target:
                raise FileNotFoundError("本地章节不存在")
            return [
                {
                    "index": idx + 1,
                    "filename": Path(name).name,
                    "url": f"/api/v2/library/{album_id}/page/{chapter_id}/{idx}",
                }
                for idx, name in enumerate(target["files"])
            ]

        chapters = await run_blocking(_inspect_folder_chapters, path)
        target = next((c for c in chapters if c["chapter_id"] == str(chapter_id)), None)
        if not target:
            raise FileNotFoundError("本地章节不存在")
        return [
            {
                "index": idx + 1,
                "filename": f.name,
                "url": f"/api/v2/library/{album_id}/page/{chapter_id}/{idx}",
            }
            for idx, f in enumerate(target["files"])
        ]

    async def read_page_bytes(self, album_id: str, chapter_id: str, page_index: int) -> Tuple[bytes, str]:
        item = await self.repo.get_item(album_id)
        if not item:
            raise FileNotFoundError("本地漫画不存在")
        path = Path(item["path"])

        if item["format"] == "zip":
            chapters = await run_blocking(_inspect_zip_chapters, path)
            target = next((c for c in chapters if c["chapter_id"] == str(chapter_id)), None)
            if not target or page_index < 0 or page_index >= len(target["files"]):
                raise IndexError("页码越界")
            name = target["files"][page_index]

            def _read_zip():
                with zipfile.ZipFile(path, "r") as zf:
                    mime = mimetypes.guess_type(name)[0] or "image/webp"
                    return zf.read(name), mime

            return await run_blocking(_read_zip)

        chapters = await run_blocking(_inspect_folder_chapters, path)
        target = next((c for c in chapters if c["chapter_id"] == str(chapter_id)), None)
        if not target or page_index < 0 or page_index >= len(target["files"]):
            raise FileNotFoundError("本地页面不存在")
        img_path = target["files"][page_index]
        mime = mimetypes.guess_type(img_path.name)[0] or "image/webp"
        return await run_blocking(img_path.read_bytes), mime

    async def read_cover_bytes(self, album_id: str) -> Tuple[bytes, str]:
        item = await self.repo.get_item(album_id)
        if not item:
            raise FileNotFoundError("本地漫画不存在")
        if item["format"] == "pdf":
            raise FileNotFoundError("PDF 暂无封面缩略图")
        if item["format"] == "zip":
            return await self.read_page_bytes(album_id, "1", 0)
        cover_path = Path(item["cover_path"])
        if not cover_path.exists():
            raise FileNotFoundError("本地封面不存在")
        mime = mimetypes.guess_type(cover_path.name)[0] or "image/webp"
        return await run_blocking(cover_path.read_bytes), mime

    async def prepare_export(self, album_id: str) -> Tuple[Path, str, str, bool]:
        """准备导出文件，返回 (file_path, filename, media_type, is_temp)。"""
        item = await self.repo.get_item(album_id)
        if not item:
            raise FileNotFoundError("本地漫画不存在")
        path = Path(item["path"])
        if not path.exists():
            raise FileNotFoundError("源文件已不存在")

        if item["format"] in ("zip", "pdf"):
            media_type = "application/pdf" if item["format"] == "pdf" else "application/zip"
            return path, path.name, media_type, False

        def _make_temp_zip() -> Path:
            fd, tmp_name = tempfile.mkstemp(prefix=f"jmlis_{album_id}_", suffix=".zip")
            os.close(fd)
            tmp_path = Path(tmp_name)
            with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_STORED) as zf:
                for p in sorted(path.rglob("*"), key=lambda x: _natural_key(str(x))):
                    if p.is_file() and not p.name.startswith("."):
                        zf.write(p, arcname=str(p.relative_to(path)))
            return tmp_path

        tmp_zip = await run_blocking(_make_temp_zip)
        safe_title = re.sub(r'[\\/:*?"<>|]+', "_", item["title"] or f"JM{album_id}").strip() or f"JM{album_id}"
        return tmp_zip, f"{safe_title}.zip", "application/zip", True

    async def delete_item(self, album_id: str, remove_files: bool = False) -> None:
        item = await self.repo.get_item(album_id)
        if item and remove_files:
            path = Path(item["path"])
            if path.is_dir():
                await run_blocking(shutil.rmtree, path, True)
            elif path.is_file():
                path.unlink(missing_ok=True)
        await self.repo.delete_item(album_id)


library_service = LocalLibraryService()
