from fastapi import APIRouter, Body, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.v2.common import ok
from app.core.executor import run_blocking
from app.services.jm_adapter import jm_adapter

router = APIRouter(prefix="/user", tags=["user"])


class LoginBody(BaseModel):
    username: str
    password: str
    impl: str = "api"


@router.post("/login")
async def login(body: LoginBody):
    try:
        status = await run_blocking(jm_adapter.login, body.username, body.password, body.impl)
        return ok(status, "登录成功")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"登录失败: {exc}")


@router.post("/logout")
async def logout():
    await run_blocking(jm_adapter.logout)
    return ok(None, "已登出")


@router.get("/status")
async def get_status():
    data = await run_blocking(jm_adapter.get_user_status)
    return ok(data)


@router.get("/favorites")
async def get_favorites(
    page: int = Query(1, ge=1),
    folder_id: str = Query("0"),
    order_by: str = Query("mr"),
):
    try:
        data = await run_blocking(jm_adapter.get_favorites, page, folder_id, order_by)
        return ok(data)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/favorites/{album_id}")
async def add_favorite(album_id: str, folder_id: str = Body("0", embed=True)):
    try:
        await run_blocking(jm_adapter.add_favorite, album_id, folder_id)
        return ok(None, "已添加到收藏")
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/favorites/{album_id}")
async def remove_favorite(album_id: str):
    try:
        await run_blocking(jm_adapter.remove_favorite, album_id)
        return ok(None, "已取消收藏")
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/daily")
async def get_daily_info():
    try:
        data = await run_blocking(jm_adapter.get_daily_info)
        return ok(data)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/checkin")
async def daily_checkin():
    try:
        data = await run_blocking(jm_adapter.daily_checkin)
        return ok(data, data.get("msg") or "签到完成")
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/favorites/export")
async def export_favorites():
    try:
        csv_text = await run_blocking(jm_adapter.export_favorites_csv)
        return StreamingResponse(
            iter([csv_text]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=jm_favorites.csv"},
        )
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
