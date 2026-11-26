import hashlib
import mimetypes
import re
import shutil
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import config_manager
from app.core.executor import run_blocking
from app.db.repositories import LibraryRepository

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
_JM_ID_RE = re.compile(r"(?:^|\D)(\d{5,8})(?:\D|$)")


def _natural_key(s: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", s)]


def _extract_album_id(name: str, full_path: Path) -> str:
    m = _JM_ID_RE.search(name)
    if m:
        return m.group(1)
    digest = hashlib.sha1(str(full_path).encode("utf-8")).hexdigest()[:10]
    return f"local_{digest}"


def _scan_dir_sync(base_dir: Path) -> List[Dict[str, Any]]:
    if not base_dir.exists():
        return []

    now = int(time.time())
    items: List[Dict[str, Any]] = []

    for entry in sorted(base_dir.iterdir(), key=lambda p: p.name.lower()):
        if entry.name.startswith("."):
            continue

        if entry.is_dir():
            chapters = _inspect_folder_chapters(entry)
            if not chapters:
                continue
            total_pages = sum(len(c["files"]) for c in chapters)
            first_img = chapters[0]["files"][0]
            total_size = sum(f.stat().st_size for c in chapters for f in c["files"])
            items.append(
                {
                    "album_id": _extract_album_id(entry.name, entry),
                    "title": entry.name,
                    "author": "",
                    "tags": ["本地目录"],
                    "path": str(entry),
                    "format": "folder",
                    "chapter_count": len(chapters),
                    "page_count": total_pages,
                    "cover_path": str(first_img),
                    "size_bytes": total_size,
                    "scanned_at": now,
                }
            )
        elif entry.is_file() and entry.suffix.lower() == ".zip":
            try:
                with zipfile.ZipFile(entry, "r") as zf:
                    imgs = sorted(
                        [n for n in zf.namelist() if Path(n).suffix.lower() in IMAGE_EXTS and not n.startswith("__MACOSX")],
                        key=_natural_key,
                    )
                if not imgs:
                    continue
                items.append(
                    {
                        "album_id": _extract_album_id(entry.stem, entry),
                        "title": entry.stem,
                        "author": "",
                        "tags": ["本地ZIP"],
                        "path": str(entry),
                        "format": "zip",
                        "chapter_count": 1,
                        "page_count": len(imgs),
                        "cover_path": imgs[0],
                        "size_bytes": entry.stat().st_size,
                        "scanned_at": now,
                    }
                )
            except zipfile.BadZipFile:
                continue

    return items


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
            chapters = [{"chapter_id": "1", "index": 1, "name": item["title"], "page_count": item["page_count"]}]
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
        if item["format"] == "zip":
            def _list_zip():
                with zipfile.ZipFile(path, "r") as zf:
                    return sorted(
                        [n for n in zf.namelist() if Path(n).suffix.lower() in IMAGE_EXTS and not n.startswith("__MACOSX")],
                        key=_natural_key,
                    )

            imgs = await run_blocking(_list_zip)
            return [
                {
                    "index": idx + 1,
                    "filename": Path(name).name,
                    "url": f"/api/v2/library/{album_id}/page/{chapter_id}/{idx}",
                }
                for idx, name in enumerate(imgs)
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
            def _read_zip():
                with zipfile.ZipFile(path, "r") as zf:
                    imgs = sorted(
                        [n for n in zf.namelist() if Path(n).suffix.lower() in IMAGE_EXTS and not n.startswith("__MACOSX")],
                        key=_natural_key,
                    )
                    if page_index < 0 or page_index >= len(imgs):
                        raise IndexError("页码越界")
                    name = imgs[page_index]
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
        path = Path(item["path"])
        if item["format"] == "zip":
            return await self.read_page_bytes(album_id, "1", 0)
        cover_path = Path(item["cover_path"])
        if not cover_path.exists():
            raise FileNotFoundError("本地封面不存在")
        mime = mimetypes.guess_type(cover_path.name)[0] or "image/webp"
        return await run_blocking(cover_path.read_bytes), mime

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
