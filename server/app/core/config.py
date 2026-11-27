import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from jmcomic import JmOption
from pydantic import BaseModel, Field

logger = logging.getLogger("jm_panel.config")

_SUPPORTED_PROXY_SCHEMES = {"http", "https", "socks5", "socks5h", "socks4"}


def build_proxy_uri(proxy_url: str, username: str = "", password: str = "") -> str:
    """校验并规范化代理 URI，必要时注入经 URL 转义的账密信息。"""
    raw = (proxy_url or "").strip()
    if not raw:
        return ""
    normalized = raw if "://" in raw else f"http://{raw}"
    parsed = urlsplit(normalized)
    scheme = (parsed.scheme or "").lower()
    if scheme not in _SUPPORTED_PROXY_SCHEMES:
        raise ValueError("仅支持 http / https / socks5 代理协议")
    host = parsed.hostname
    if not host:
        raise ValueError("代理地址缺少主机名或 IP")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("代理端口无效 (需为 1-65535)") from exc
    if port is None or not (1 <= port <= 65535):
        raise ValueError("代理地址缺少有效端口 (1-65535)")

    host_part = f"[{host}]:{port}" if ":" in host else f"{host}:{port}"
    user_clean = (username or "").strip()
    pass_raw = password or ""
    if user_clean or pass_raw:
        netloc = f"{quote(user_clean, safe='')}:{quote(pass_raw, safe='')}@{host_part}"
    elif parsed.username is not None:
        u = quote(unquote(parsed.username), safe="")
        if parsed.password is not None:
            p = quote(unquote(parsed.password), safe="")
            netloc = f"{u}:{p}@{host_part}"
        else:
            netloc = f"{u}@{host_part}"
    else:
        netloc = host_part
    return urlunsplit((scheme, netloc, "", "", ""))

APP_VERSION = "2.1.0"
SERVER_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = SERVER_ROOT.parent


def _resolve_data_dir() -> Path:
    env_dir = os.environ.get("JM_DATA_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()
    return (SERVER_ROOT / "data").resolve()


class ServerSettings(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8800
    client_impl: str = "api"  # "api" (APP端，功能最全) 或 "html" (网页端)
    image_cache_dir: str = ""
    image_cache_max_files: int = 5000
    image_cache_max_size_mb: int = 2048
    download_dir: str = ""
    dir_rule: str = "Bd_Aauthor_Atitle"
    image_thread_count: int = 4
    max_concurrent_downloads: int = 2
    pin_enabled: bool = False
    pin_hash: str = ""
    proxy_enabled: bool = False
    proxy_url: str = ""
    proxy_username: str = ""
    proxy_password: str = ""


class ConfigManager:
    """统一管理 server.json（面板配置）与 option.yml（jmcomic 下载/网络配置）。"""

    def __init__(self, data_dir: Optional[Path] = None):
        self.configure_data_dir(data_dir or _resolve_data_dir())

    def configure_data_dir(self, data_dir: Path) -> None:
        self.data_dir = data_dir.resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.server_config_path = self.data_dir / "server.json"
        self.option_path = self.data_dir / "option.yml"
        self.db_path = self.data_dir / "jm_panel.db"
        self.session_path = self.data_dir / "session.json"
        self.key_path = self.data_dir / ".secret.key"
        self._settings: Optional[ServerSettings] = None

    def _default_settings(self) -> ServerSettings:
        return ServerSettings(
            image_cache_dir=str(self.data_dir / "image-cache"),
            download_dir=str(self.data_dir / "downloads"),
        )

    def get_settings(self) -> ServerSettings:
        if self._settings is not None:
            return self._settings

        defaults = self._default_settings()
        if self.server_config_path.exists():
            try:
                raw = json.loads(self.server_config_path.read_text(encoding="utf-8"))
                merged = defaults.model_dump()
                for k, v in raw.items():
                    if k in merged and v is not None and v != "":
                        merged[k] = v
                self._settings = ServerSettings(**merged)
                return self._settings
            except Exception as exc:
                logger.warning("读取 server.json 失败，使用默认配置: %s", exc)

        self._settings = defaults
        self.save_settings(defaults)
        return self._settings

    def save_settings(self, settings: ServerSettings) -> ServerSettings:
        if not settings.image_cache_dir:
            settings.image_cache_dir = str(self.data_dir / "image-cache")
        if not settings.download_dir:
            settings.download_dir = str(self.data_dir / "downloads")
        settings.image_cache_max_files = max(50, int(settings.image_cache_max_files))
        settings.image_cache_max_size_mb = max(32, int(settings.image_cache_max_size_mb))
        settings.image_thread_count = max(1, min(16, int(settings.image_thread_count)))
        settings.max_concurrent_downloads = max(1, min(5, int(settings.max_concurrent_downloads)))

        Path(settings.image_cache_dir).mkdir(parents=True, exist_ok=True)
        Path(settings.download_dir).mkdir(parents=True, exist_ok=True)

        self.server_config_path.write_text(
            json.dumps(settings.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._settings = settings
        return settings

    def update_settings(self, patch: Dict[str, Any]) -> ServerSettings:
        current = self.get_settings().model_dump()
        for key, value in patch.items():
            if key in current and key != "pin_hash" and value is not None:
                current[key] = value
        next_settings = ServerSettings(**current)
        next_settings.proxy_url = next_settings.proxy_url.strip()
        next_settings.proxy_username = next_settings.proxy_username.strip()
        if next_settings.proxy_url:
            build_proxy_uri(
                next_settings.proxy_url,
                next_settings.proxy_username,
                next_settings.proxy_password,
            )
        elif next_settings.proxy_enabled:
            raise ValueError("请先填写完整代理地址和端口后再开启代理")
        updated = self.save_settings(next_settings)
        self._sync_option_from_settings(updated)
        return updated

    def _effective_proxy_for_option(self, settings: ServerSettings) -> Any:
        if settings.proxy_enabled and settings.proxy_url:
            return build_proxy_uri(
                settings.proxy_url,
                settings.proxy_username,
                settings.proxy_password,
            )
        return {}

    def ensure_option_file(self) -> Path:
        if not self.option_path.exists():
            settings = self.get_settings()
            option = JmOption.default()
            option.client.impl = settings.client_impl
            option.dir_rule.base_dir = settings.download_dir
            option.dir_rule.rule = settings.dir_rule
            option.download.threading.image = settings.image_thread_count
            option.client.postman.meta_data.proxies = self._effective_proxy_for_option(settings)
            option.to_file(str(self.option_path))
        return self.option_path

    def load_jm_option(self) -> JmOption:
        path = self.ensure_option_file()
        return JmOption.from_file(str(path))

    def get_option_dict(self) -> Dict[str, Any]:
        return self.load_jm_option().deconstruct()

    def update_option_dict(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_option_dict()

        def deep_merge(base: dict, upd: dict) -> dict:
            out = dict(base)
            for k, v in upd.items():
                if k in out and isinstance(out[k], dict) and isinstance(v, dict):
                    out[k] = deep_merge(out[k], v)
                else:
                    out[k] = v
            return out

        merged = deep_merge(current, patch)
        option = JmOption.construct(merged, cover_default=False)
        option.to_file(str(self.option_path))
        return option.deconstruct()

    def _sync_option_from_settings(self, settings: ServerSettings) -> None:
        try:
            option = self.load_jm_option()
            option.client.impl = settings.client_impl
            option.dir_rule.base_dir = settings.download_dir
            option.dir_rule.rule = settings.dir_rule
            option.download.threading.image = settings.image_thread_count
            option.client.postman.meta_data.proxies = self._effective_proxy_for_option(settings)
            option.to_file(str(self.option_path))
        except Exception as exc:
            logger.warning("同步 settings 到 option.yml 失败: %s", exc)


config_manager = ConfigManager()
