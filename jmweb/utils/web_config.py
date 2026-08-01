import json
import logging
from pathlib import Path

from jmweb.utils.cache import image_cache, _CACHE_DIR, _MAX_FILES, _MAX_SIZE_MB

WEB_CONFIG_FILE = Path(__file__).parent.parent.parent / "config" / "web-config.json"

DEFAULTS = {
    "image_cache_dir": str(_CACHE_DIR),
    "image_cache_max_files": _MAX_FILES,
    "image_cache_max_size_mb": _MAX_SIZE_MB,
}


def _load_raw() -> dict:
    try:
        data = json.loads(WEB_CONFIG_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception as e:
        logging.warning(f"web-config 读取失败: {e}")
    return {}


def get_web_config() -> dict:
    data = dict(DEFAULTS)
    data.update({k: v for k, v in _load_raw().items() if k in DEFAULTS})
    return data


def apply_web_config(data: dict = None):
    """将配置应用到磁盘缓存（目录不存在时自动创建）。"""
    if data is None:
        data = get_web_config()
    image_cache.configure(
        cache_dir=data["image_cache_dir"],
        max_files=data["image_cache_max_files"],
    )


def save_web_config(config_data: dict) -> dict:
    merged = get_web_config()
    merged.update({k: v for k, v in config_data.items() if k in DEFAULTS})
    try:
        merged["image_cache_max_files"] = max(1, int(merged.get("image_cache_max_files") or _MAX_FILES))
    except (TypeError, ValueError):
        merged["image_cache_max_files"] = _MAX_FILES
    try:
        merged["image_cache_max_size_mb"] = max(1, int(merged.get("image_cache_max_size_mb") or _MAX_SIZE_MB))
    except (TypeError, ValueError):
        merged["image_cache_max_size_mb"] = _MAX_SIZE_MB
    if not merged.get("image_cache_dir"):
        merged["image_cache_dir"] = DEFAULTS["image_cache_dir"]

    WEB_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    WEB_CONFIG_FILE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    apply_web_config(merged)
    return merged
