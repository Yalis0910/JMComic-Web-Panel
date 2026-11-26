from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.api.v2.common import ok
from app.services.library_service import library_service

router = APIRouter(prefix="/library", tags=["library"])


@router.get("")
async def list_library():
    items = await library_service.list_items()
    return ok(items)


@router.post("/scan")
async def scan_library():
    items = await library_service.scan()
    return ok({"count": len(items), "items": items}, f"扫描完成，共发现 {len(items)} 本本地漫画")


@router.get("/{album_id}")
async def get_library_detail(album_id: str):
    detail = await library_service.get_detail(album_id)
    if not detail:
        raise HTTPException(status_code=404, detail="本地漫画不存在")
    return ok(detail)


@router.get("/{album_id}/cover")
async def get_library_cover(album_id: str):
    try:
        content, mime = await library_service.read_cover_bytes(album_id)
        return Response(content=content, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{album_id}/chapters/{chapter_id}")
async def get_library_chapter_pages(album_id: str, chapter_id: str):
    try:
        pages = await library_service.get_chapter_pages(album_id, chapter_id)
        return ok({"album_id": album_id, "chapter_id": chapter_id, "pages": pages})
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/{album_id}/page/{chapter_id}/{page_index}")
async def get_library_page_image(album_id: str, chapter_id: str, page_index: int):
    try:
        content, mime = await library_service.read_page_bytes(album_id, chapter_id, page_index)
        return Response(content=content, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
    except (FileNotFoundError, IndexError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/{album_id}")
async def delete_library_item(album_id: str, remove_files: bool = Query(False)):
    await library_service.delete_item(album_id, remove_files=remove_files)
    return ok(None, "已从本地书库移除")
