import time
from typing import Any, Dict, Optional

from curl_cffi import requests as curl_requests
from fastapi import APIRouter, Body, Depends, HTTPException
from jmcomic import JmCryptoTool, JmModuleConfig
from pydantic import BaseModel

from app.api.v2.common import ok
from app.core.config import APP_VERSION, build_proxy_uri, config_manager
from app.core.executor import run_blocking
from app.core.security import hash_pin, issue_panel_token, require_panel_access, verify_pin
from app.services.image_proxy import image_cache
from app.services.jm_adapter import jm_adapter

router = APIRouter(prefix="/system", tags=["system"])
_protected = [Depends(require_panel_access)]


class PinSetupBody(BaseModel):
    enabled: bool
    pin: Optional[str] = None


class PinUnlockBody(BaseModel):
    pin: str


class ProxyTestBody(BaseModel):
    proxy_url: str = ""
    proxy_username: str = ""
    proxy_password: str = ""


def _probe_proxy_sync(proxy_uri: str) -> Dict[str, Any]:
    proxies = {"http": proxy_uri, "https": proxy_uri}
    try:
        live_domains = list(jm_adapter.get_api_client(prefer_auth=False).get_domain_list())
    except Exception:
        live_domains = []
    candidate_domains = (live_domains or list(JmModuleConfig.DOMAIN_API_LIST))[:2]
    jm_targets = [f"https://{domain}/setting" for domain in candidate_domains]
    fallback_target = "https://www.gstatic.com/generate_204"
    last_error = "无可用响应"

    for idx, target in enumerate(jm_targets + [fallback_target]):
        is_jm = idx < len(jm_targets)
        headers = None
        if is_jm:
            ts = int(time.time())
            token, tokenparam = JmCryptoTool.token_and_tokenparam(ts)
            headers = dict(JmModuleConfig.APP_HEADERS_TEMPLATE)
            headers.update({"token": token, "tokenparam": tokenparam})
        started = time.monotonic()
        try:
            resp = curl_requests.get(
                target,
                proxies=proxies,
                headers=headers,
                impersonate="chrome",
                timeout=8,
            )
            latency_ms = int((time.monotonic() - started) * 1000)
            status = int(resp.status_code)
            if status == 407:
                return {
                    "reachable": False,
                    "jm_reachable": False,
                    "latency_ms": latency_ms,
                    "status_code": status,
                    "target": target,
                    "message": "代理认证失败 (HTTP 407)，请检查代理用户名与密码",
                }
            if 200 <= status < 400:
                if is_jm:
                    return {
                        "reachable": True,
                        "jm_reachable": True,
                        "latency_ms": latency_ms,
                        "status_code": status,
                        "target": target,
                        "message": f"代理连通正常，已成功访问禁漫接口 ({latency_ms}ms · HTTP {status})",
                    }
                return {
                    "reachable": True,
                    "jm_reachable": False,
                    "latency_ms": latency_ms,
                    "status_code": status,
                    "target": target,
                    "message": f"代理已连通 ({latency_ms}ms · HTTP {status})，但禁漫接口暂不可达（{last_error}）",
                }
            last_error = f"HTTP {status}"
        except Exception as exc:
            last_error = str(exc) or exc.__class__.__name__

    return {
        "reachable": False,
        "jm_reachable": False,
        "latency_ms": 0,
        "status_code": None,
        "target": jm_targets[0] if jm_targets else fallback_target,
        "message": f"代理连接失败：{last_error}",
    }


@router.get("/health")
async def health():
    settings = config_manager.get_settings()
    return ok(
        {
            "status": "ok",
            "version": APP_VERSION,
            "pin_enabled": settings.pin_enabled,
        }
    )


@router.post("/unlock")
async def unlock_panel(body: PinUnlockBody):
    settings = config_manager.get_settings()
    if not settings.pin_enabled or not settings.pin_hash:
        return ok({"token": ""})
    if not verify_pin(body.pin, settings.pin_hash):
        raise HTTPException(status_code=401, detail="PIN 码错误")
    return ok({"token": issue_panel_token()})


@router.get("/settings", dependencies=_protected)
async def get_settings():
    settings = config_manager.get_settings().model_dump()
    settings.pop("pin_hash", None)
    return ok(
        {
            "panel": settings,
            "cache": image_cache.stats(),
            "option": config_manager.get_option_dict(),
        }
    )


@router.put("/settings", dependencies=_protected)
async def update_settings(patch: Dict[str, Any] = Body(...)):
    try:
        updated = config_manager.update_settings(patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    image_cache.configure(
        cache_dir=updated.image_cache_dir,
        max_files=updated.image_cache_max_files,
        max_size_mb=updated.image_cache_max_size_mb,
    )
    jm_adapter.reset_clients()
    data = updated.model_dump()
    data.pop("pin_hash", None)
    return ok({"panel": data, "cache": image_cache.stats()}, "设置已保存并立即生效")


@router.get("/option", dependencies=_protected)
async def get_option():
    return ok(config_manager.get_option_dict())


@router.put("/option", dependencies=_protected)
async def update_option(option_patch: Dict[str, Any] = Body(...)):
    try:
        updated = config_manager.update_option_dict(option_patch)
        jm_adapter.reset_clients()
        return ok(updated, "option.yml 已保存")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/pin", dependencies=_protected)
async def configure_pin(body: PinSetupBody):
    settings = config_manager.get_settings()
    if body.enabled:
        if not body.pin or len(body.pin) < 4:
            raise HTTPException(status_code=400, detail="PIN 码至少 4 位")
        settings.pin_enabled = True
        settings.pin_hash = hash_pin(body.pin)
    else:
        settings.pin_enabled = False
        settings.pin_hash = ""
    config_manager.save_settings(settings)
    return ok({"pin_enabled": settings.pin_enabled}, "局域网 PIN 保护已更新")


@router.post("/cache/clear", dependencies=_protected)
async def clear_cache():
    await run_blocking(image_cache.clear)
    return ok(image_cache.stats(), "图片缓存已清空")


@router.get("/domains", dependencies=_protected)
async def get_domains():
    data = await run_blocking(jm_adapter.test_domains)
    return ok(data)


@router.post("/proxy/test", dependencies=_protected)
async def test_proxy(body: ProxyTestBody):
    if not body.proxy_url.strip():
        raise HTTPException(status_code=400, detail="请先填写代理地址与端口后再测试")
    try:
        proxy_uri = build_proxy_uri(body.proxy_url, body.proxy_username, body.proxy_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    result = await run_blocking(_probe_proxy_sync, proxy_uri)
    return ok(result, result["message"])
