from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

from app.api.v2.common import ok
from app.core.config import config_manager
from app.core.executor import run_blocking
from app.core.security import hash_pin, issue_panel_token, verify_pin
from app.services.image_proxy import image_cache
from app.services.jm_adapter import jm_adapter

router = APIRouter(prefix="/system", tags=["system"])


class PinSetupBody(BaseModel):
    enabled: bool
    pin: Optional[str] = None


class PinUnlockBody(BaseModel):
    pin: str


@router.get("/health")
async def health():
    settings = config_manager.get_settings()
    return ok(
        {
            "status": "ok",
            "version": "2.0.0",
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


@router.get("/settings")
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


@router.put("/settings")
async def update_settings(patch: Dict[str, Any] = Body(...)):
    updated = config_manager.update_settings(patch)
    image_cache.configure(
        cache_dir=updated.image_cache_dir,
        max_files=updated.image_cache_max_files,
        max_size_mb=updated.image_cache_max_size_mb,
    )
    jm_adapter.reset_clients()
    data = updated.model_dump()
    data.pop("pin_hash", None)
    return ok({"panel": data, "cache": image_cache.stats()}, "设置已保存并立即生效")


@router.put("/option")
async def update_option(option_patch: Dict[str, Any] = Body(...)):
    try:
        updated = config_manager.update_option_dict(option_patch)
        jm_adapter.reset_clients()
        return ok(updated, "option.yml 已保存")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/pin")
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


@router.post("/cache/clear")
async def clear_cache():
    await run_blocking(image_cache.clear)
    return ok(image_cache.stats(), "图片缓存已清空")


@router.get("/domains")
async def get_domains():
    data = await run_blocking(jm_adapter.test_domains)
    return ok(data)
