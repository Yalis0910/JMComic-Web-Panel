from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.v2.common import ok
from app.core.executor import run_blocking
from app.services.jm_adapter import jm_adapter

router = APIRouter(tags=["search"])


@router.get("/search")
async def search_comics(
    q: str = Query(..., min_length=1),
    type: str = Query("all", description="all / author / tag / work / actor"),
    page: int = Query(1, ge=1),
    order_by: str = Query("mr"),
    time: str = Query("a"),
    category: str = Query("0"),
    sub_category: Optional[str] = Query(default=None),
    page_size: int = Query(40, ge=5, le=80),
):
    try:
        data = await run_blocking(
            jm_adapter.search, q, type, page, order_by, time, category, sub_category, page_size
        )
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
