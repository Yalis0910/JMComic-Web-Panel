from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.v2.common import ok
from app.core.executor import run_blocking
from app.services.jm_adapter import jm_adapter

router = APIRouter(prefix="/discovery", tags=["discovery"])


@router.get("/promote")
async def get_promote(page: int = Query(1, ge=1)):
    try:
        data = await run_blocking(jm_adapter.get_promote, page)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/latest")
async def get_latest(page: int = Query(1, ge=1)):
    try:
        data = await run_blocking(jm_adapter.get_latest, page)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/week")
async def get_week_categories():
    try:
        data = await run_blocking(jm_adapter.get_week_categories)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/week/filter")
async def get_week_filter(
    category_id: str = Query(...),
    type_id: str = Query("manga"),
):
    try:
        data = await run_blocking(jm_adapter.get_week_filter, category_id, type_id)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/categories")
async def get_categories_meta():
    try:
        data = await run_blocking(jm_adapter.get_categories_meta)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/ranking/{ranking_type}")
async def get_ranking(
    ranking_type: str,
    page: int = Query(1, ge=1),
    category: str = Query("0"),
):
    if ranking_type not in ("day", "week", "month", "all", "likes", "latest"):
        raise HTTPException(status_code=400, detail=f"不支持的排行类型: {ranking_type}")
    try:
        data = await run_blocking(jm_adapter.get_ranking, ranking_type, page, category)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/forum")
async def get_forum_comments(page: int = Query(1, ge=1)):
    try:
        data = await run_blocking(jm_adapter.get_forum_comments, page)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/filter")
async def filter_categories(
    page: int = Query(1, ge=1),
    time: str = Query("a"),
    order_by: str = Query("mv"),
    category: str = Query("0"),
    sub_category: Optional[str] = Query(default=None),
):
    try:
        data = await run_blocking(
            jm_adapter.get_category_filter, page, time, category, order_by, sub_category
        )
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
