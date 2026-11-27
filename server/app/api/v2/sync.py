from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.v2.common import ok
from app.db.repositories import BookmarkRepository, HistoryRepository, ShelfRepository

router = APIRouter(prefix="/sync", tags=["sync"])
history_repo = HistoryRepository()
bookmark_repo = BookmarkRepository()
shelf_repo = ShelfRepository()


class HistoryItemBody(BaseModel):
    album_id: str
    photo_id: str
    source: str = "online"
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


class BookmarkItemBody(BaseModel):
    bookmark_id: Optional[str] = None
    album_id: str
    photo_id: str
    source: str = "online"
    title: str = ""
    chapter_title: str = ""
    cover_url: str = ""
    page_index: int = 0
    note: str = ""
    created_at: Optional[int] = None
    updated_at: Optional[int] = None
    deleted: bool = False


class MergeBookmarksBody(BaseModel):
    items: List[BookmarkItemBody]
    since_ms: int = 0


class ShelfBody(BaseModel):
    shelf_id: Optional[str] = None
    name: str
    description: str = ""


class ShelfItemBody(BaseModel):
    album_id: str
    title: str = ""
    author: str = ""
    cover_url: str = ""
    tags: List[str] = []


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


# ---------- 阅读书签 (Bookmarks) ----------


@router.get("/bookmarks")
async def list_bookmarks(album_id: Optional[str] = Query(default=None), limit: int = Query(200, ge=1, le=500)):
    items = await bookmark_repo.list_bookmarks(album_id=album_id, limit=limit)
    return ok(items)


@router.put("/bookmarks")
async def upsert_bookmark(body: BookmarkItemBody):
    saved = await bookmark_repo.upsert(body.model_dump())
    return ok(saved, "书签已保存")


@router.post("/bookmarks/merge")
async def merge_bookmarks(body: MergeBookmarksBody):
    for item in body.items:
        await bookmark_repo.upsert(item.model_dump())
    server_changes = await bookmark_repo.list_all_including_deleted(since_ms=body.since_ms)
    return ok({"items": server_changes})


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str):
    await bookmark_repo.soft_delete(bookmark_id)
    return ok(None, "已移除书签")


# ---------- 本地书单 / 收藏标签 (Local Shelves) ----------


@router.get("/shelves")
async def list_shelves():
    return ok(await shelf_repo.list_shelves())


@router.post("/shelves")
async def upsert_shelf(body: ShelfBody):
    try:
        saved = await shelf_repo.upsert_shelf(body.shelf_id, body.name, body.description)
        return ok(saved, "本地书单已保存")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/shelves/{shelf_id}")
async def delete_shelf(shelf_id: str):
    await shelf_repo.delete_shelf(shelf_id)
    return ok(None, "本地书单已删除")


@router.get("/shelves/by-album/{album_id}")
async def list_album_shelves(album_id: str):
    return ok(await shelf_repo.list_album_shelf_ids(album_id))


@router.get("/shelves/{shelf_id}/items")
async def list_shelf_items(shelf_id: str):
    return ok(await shelf_repo.list_shelf_items(shelf_id))


@router.post("/shelves/{shelf_id}/items")
async def add_shelf_item(shelf_id: str, body: ShelfItemBody):
    saved = await shelf_repo.add_item(shelf_id, body.model_dump())
    return ok(saved, "已加入本地书单")


@router.delete("/shelves/{shelf_id}/items/{album_id}")
async def remove_shelf_item(shelf_id: str, album_id: str):
    await shelf_repo.remove_item(shelf_id, album_id)
    return ok(None, "已从本地书单移除")
