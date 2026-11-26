from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.core.executor import run_blocking
from app.services.image_proxy import fetch_and_decode_image_sync, fetch_cover_sync

router = APIRouter(prefix="/media", tags=["media"])

_CACHE_HEADERS = {"Cache-Control": "public, max-age=1209600"}


@router.get("/image")
async def proxy_image(
    url: str = Query(...),
    scramble_id: Optional[str] = Query(default=None),
):
    try:
        content, media_type = await run_blocking(fetch_and_decode_image_sync, url, scramble_id)
        return Response(content=content, media_type=media_type, headers=_CACHE_HEADERS)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"图片加载失败: {exc}")


@router.get("/cover/{album_id}")
async def proxy_cover(album_id: str, size: str = Query("")):
    try:
        content, media_type = await run_blocking(fetch_cover_sync, album_id, size)
        return Response(content=content, media_type=media_type, headers=_CACHE_HEADERS)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"封面加载失败: {exc}")
