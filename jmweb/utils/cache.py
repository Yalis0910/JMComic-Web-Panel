import hashlib
import logging
import os
import threading
import time
from pathlib import Path

_CACHE_DIR = Path(__file__).parent.parent / "data" / "image-cache"
_MAX_FILES = 3000
_MAX_SIZE_MB = 1024


class ImageDiskCache:
    def __init__(self, cache_dir: Path = _CACHE_DIR, max_files: int = _MAX_FILES,
                 max_size_mb: int = _MAX_SIZE_MB):
        self.cache_dir = Path(cache_dir)
        self.max_files = max_files
        self.max_size_mb = max_size_mb
        self._lock = threading.Lock()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def configure(self, cache_dir: Path = None, max_files: int = None, max_size_mb: int = None):
        """运行时调整缓存目录、文件上限与大小上限（保持同一实例，引用不受影响）。"""
        with self._lock:
            if cache_dir is not None:
                self.cache_dir = Path(cache_dir)
            if max_files is not None:
                self.max_files = int(max_files)
            if max_size_mb is not None:
                self.max_size_mb = int(max_size_mb)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _key_path(self, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return self.cache_dir / f"{digest}.img"

    def get(self, key: str):
        path = self._key_path(key)
        if not path.exists():
            return None
        try:
            # 命中时刷新 mtime，配合最久未使用淘汰
            with self._lock:
                os.utime(path, None)
            return path.read_bytes()
        except OSError as e:
            logging.warning(f"图片缓存读取失败: {e}")
            return None

    def put(self, key: str, content: bytes):
        path = self._key_path(key)
        try:
            with self._lock:
                path.write_bytes(content)
                self._evict_if_needed()
        except OSError as e:
            logging.warning(f"图片缓存写入失败: {e}")

    def _evict_if_needed(self):
        files = [p for p in self.cache_dir.iterdir() if p.is_file()]
        if not files:
            return
        files.sort(key=lambda p: p.stat().st_mtime)
        total = sum(p.stat().st_size for p in files)
        size_limit = self.max_size_mb * 1024 * 1024
        while files and (len(files) > self.max_files or total > size_limit):
            old = files.pop(0)
            try:
                size = old.stat().st_size
                old.unlink()
                total -= size
            except OSError:
                pass

    def clear(self):
        with self._lock:
            for p in self.cache_dir.iterdir():
                if p.is_file():
                    try:
                        p.unlink()
                    except OSError:
                        pass

    def size_mb(self) -> float:
        total = 0
        try:
            for p in self.cache_dir.iterdir():
                if p.is_file():
                    total += p.stat().st_size
        except OSError:
            pass
        return round(total / 1024 / 1024, 1)

    def count(self) -> int:
        try:
            return len([p for p in self.cache_dir.iterdir() if p.is_file()])
        except OSError:
            return 0


image_cache = ImageDiskCache()
