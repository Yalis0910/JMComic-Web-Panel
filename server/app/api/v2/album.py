from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from app.api.v2.common import ok
from app.core.executor import run_blocking
from app.services.jm_adapter import jm_adapter

router = APIRouter(tags=["album"])


class CommentBody(BaseModel):
    comment: str
    comment_id: Optional[str] = None
    spoiler: bool = False


@router.get("/album/{album_id}")
async def get_album(album_id: str):
    try:
        data = await run_blocking(jm_adapter.get_album_detail, album_id)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/photo/{photo_id}")
async def get_photo(photo_id: str):
    try:
        data = await run_blocking(jm_adapter.get_photo_detail, photo_id)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/album/{album_id}/comments")
async def list_comments(album_id: str, page: int = Query(1, ge=1)):
    try:
        data = await run_blocking(jm_adapter.get_comments, album_id, page)
        return ok(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/album/{album_id}/comments")
async def create_comment(album_id: str, body: CommentBody):
    try:
        data = await run_blocking(
            jm_adapter.post_comment,
            album_id,
            body.comment,
            body.comment_id,
            body.spoiler,
        )
        return ok(data, "评论已提交")
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
