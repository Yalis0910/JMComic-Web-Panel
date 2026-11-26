import hashlib
import logging
import math
import os
import re
import threading
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple

from jmcomic import JmcomicClient, JmcomicText
from jmcomic.jm_option import JmModuleConfig
from jmcomic.jm_toolkit import JmImageTool
from PIL import Image

from app.core.config import config_manager
from app.services.jm_adapter import jm_adapter

logger = logging.getLogger("jm_panel.image")

_PHOTO_URL_RE = re.compile(r"/media/photos/(\d+)/")


class ImageDiskCache:
    """线程安全的 LRU 图片磁盘缓存（同时受文件数与总容量上限约束）。"""

    def __init__(self, cache_dir: Path, max_files: int = 5000, max_size_mb: int = 2048):
        self.cache_dir = Path(cache_dir)
        self.max_files = max_files
        self.max_size_mb = max_size_mb
        self._lock = threading.Lock()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def configure(self, cache_dir: str, max_files: int, max_size_mb: int) -> None:
        with self._lock:
            self.cache_dir = Path(cache_dir)
            self.max_files = max(50, int(max_files))
            self.max_size_mb = max(32, int(max_size_mb))
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self._evict_if_needed()

    def _path_for(self, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{digest}.img"

    def get(self, key: str) -> Optional[bytes]:
        path = self._path_for(key)
        if not path.exists():
            return None
        try:
            with self._lock:
                os.utime(path, None)
            return path.read_bytes()
        except OSError as exc:
            logger.warning("读取图片缓存失败: %s", exc)
            return None

    def put(self, key: str, content: bytes) -> None:
        path = self._path_for(key)
        try:
            with self._lock:
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
                self._evict_if_needed()
        except OSError as exc:
            logger.warning("写入图片缓存失败: %s", exc)

    def _evict_if_needed(self) -> None:
        files = [p for p in self.cache_dir.iterdir() if p.is_file()]
        if not files:
            return
        files.sort(key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in files)
        limit_bytes = self.max_size_mb * 1024 * 1024
        while files and (len(files) > self.max_files or total > limit_bytes):
            oldest = files.pop(0)
            try:
                sz = oldest.stat().st_size
                oldest.unlink()
                total -= sz
            except OSError:
                pass

    def clear(self) -> None:
        with self._lock:
            if not self.cache_dir.exists():
                return
            for p in self.cache_dir.iterdir():
                if p.is_file():
                    p.unlink(missing_ok=True)

    def stats(self) -> dict:
        files = [p for p in self.cache_dir.iterdir() if p.is_file()] if self.cache_dir.exists() else []
        total_bytes = sum(p.stat().st_size for p in files)
        return {
            "cache_dir": str(self.cache_dir),
            "file_count": len(files),
            "size_mb": round(total_bytes / 1024 / 1024, 2),
            "max_files": self.max_files,
            "max_size_mb": self.max_size_mb,
        }


def _create_default_cache() -> ImageDiskCache:
    s = config_manager.get_settings()
    return ImageDiskCache(
        cache_dir=Path(s.image_cache_dir),
        max_files=s.image_cache_max_files,
        max_size_mb=s.image_cache_max_size_mb,
    )


image_cache = _create_default_cache()


def decode_scrambled_image(content: bytes, num: int) -> bytes:
    """将禁漫条带打乱的图片重排还原，输出 WEBP 字节流。"""
    if num <= 0:
        return content

    img = Image.open(BytesIO(content))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    w, h = img.size

    decoded = Image.new(img.mode, (w, h))
    over = h % num
    for i in range(num):
        move = math.floor(h / num)
        y_src = h - (move * (i + 1)) - over
        y_dst = move * i
        if i == 0:
            move += over
        else:
            y_dst += over
        decoded.paste(
            img.crop((0, y_src, w, y_src + move)),
            (0, y_dst, w, y_dst + move),
        )

    buf = BytesIO()
    decoded.save(buf, format="WEBP", quality=92)
    return buf.getvalue()


def detect_image_mime(data: bytes, fallback: str = "image/jpeg") -> str:
    """根据图片魔数推断真实 MIME 类型，避免依赖底层响应对象的 headers 属性。"""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF8"):
        return "image/gif"
    if len(data) >= 12 and data[4:12] in (b"ftypavif", b"ftypavis"):
        return "image/avif"
    return fallback


def parse_photo_id_from_url(url: str) -> Optional[str]:
    m = _PHOTO_URL_RE.search(url)
    return m.group(1) if m else None


def fetch_and_decode_image_sync(url: str, scramble_id: Optional[str] = None) -> Tuple[bytes, str]:
    """同步执行图片拉取与反混淆（供线程池调用）。"""
    photo_id = parse_photo_id_from_url(url)
    if not photo_id:
        raise ValueError("无法从图片 URL 中解析 photo_id")

    client = jm_adapter.get_client()
    sid = scramble_id
    if not sid:
        if hasattr(client, "get_scramble_id"):
            sid = str(client.get_scramble_id(photo_id))
        else:
            sid = str(jm_adapter.get_api_client().get_scramble_id(photo_id))

    cache_key = f"page|{url}|{sid}"
    cached = image_cache.get(cache_key)
    if cached is not None:
        return cached, detect_image_mime(cached, fallback="image/webp")

    resp = client.get_jm_image(url)
    resp.require_success()

    num = JmImageTool.get_num_by_url(sid, url)
    if num == 0 or JmcomicClient.img_is_not_need_to_decode(url, resp):
        content_type = detect_image_mime(resp.content, fallback="image/webp")
        image_cache.put(cache_key, resp.content)
        return resp.content, content_type

    decoded = decode_scrambled_image(resp.content, num)
    image_cache.put(cache_key, decoded)
    return decoded, "image/webp"


def fetch_cover_sync(album_id: str, size: str = "") -> Tuple[bytes, str]:
    """同步拉取漫画封面并走磁盘缓存（多 CDN 域名回退，避免直连 CDN 被屏蔽或单节点超时）。"""
    cache_key = f"cover|{album_id}|{size}"
    cached = image_cache.get(cache_key)
    if cached is not None:
        return cached, detect_image_mime(cached, fallback="image/jpeg")

    client = jm_adapter.get_client()
    domains = list(dict.fromkeys(JmModuleConfig.DOMAIN_IMAGE_LIST or []))
    candidate_domains = domains[:3] if domains else [None]
    candidate_sizes = [size] if size in ("", "_3x4") else [size, ""]
    if size == "_3x4":
        candidate_sizes.append("")

    last_exc: Optional[Exception] = None
    for sz in candidate_sizes:
        for dom in candidate_domains:
            try:
                cover_url = JmcomicText.get_album_cover_url(album_id, image_domain=dom, size=sz)
                resp = client.get_jm_image(cover_url)
                resp.require_success()
                if not resp.content:
                    raise ValueError("封面响应数据为空")
                content_type = detect_image_mime(resp.content, fallback="image/jpeg")
                image_cache.put(cache_key, resp.content)
                return resp.content, content_type
            except Exception as exc:
                last_exc = exc

    raise last_exc or RuntimeError(f"封面拉取失败: album_id={album_id}")
