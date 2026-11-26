from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.v2.common import ok
from app.db.repositories import HistoryRepository

router = APIRouter(prefix="/sync", tags=["sync"])
history_repo = HistoryRepository()


class HistoryItemBody(BaseModel):
    album_id: str
    photo_id: str
    title: str = ""
    chapter_title: str = ""
    cover_url: str = ""
    page_index: int = 0
    total_pages: int = 0
    updated_at: Optional[int] = None
    deleted: bool = False


class MergeHistoryBody(BaseModel):
    items: List[HistoryItemBody]
    since_ms: int = 0


@router.get("/history")
async def list_history(limit: int = Query(100, ge=1, le=500)):
    items = await history_repo.list_history(limit=limit)
    return ok(items)


@router.put("/history")
async def upsert_history(body: HistoryItemBody):
    saved = await history_repo.upsert(body.model_dump())
    return ok(saved)


@router.post("/history/merge")
async def merge_history(body: MergeHistoryBody):
    """App 外出直连阅读后回连局域网，按 updated_at LWW 双向同步进度。"""
    for item in body.items:
        await history_repo.upsert(item.model_dump())
    server_changes = await history_repo.list_all_including_deleted(since_ms=body.since_ms)
    return ok({"items": server_changes})


@router.delete("/history/{album_id}")
async def delete_history_item(album_id: str):
    await history_repo.soft_delete(album_id)
    return ok(None, "已删除阅读记录")


@router.delete("/history")
async def clear_history():
    await history_repo.clear_all()
    return ok(None, "阅读历史已清空")
