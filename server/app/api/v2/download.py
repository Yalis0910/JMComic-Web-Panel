import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.v2.common import ok
from app.services.download_service import download_manager

router = APIRouter(prefix="/download", tags=["download"])


class CreateDownloadBody(BaseModel):
    album_id: str
    photo_id: Optional[str] = None
    download_type: str = "folder"


@router.post("/tasks")
async def create_download(body: CreateDownloadBody):
    try:
        task = await download_manager.start_download(
            album_id=body.album_id,
            download_type=body.download_type,
            photo_id=body.photo_id,
        )
        return ok(task, "下载任务已创建")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/tasks")
async def list_tasks():
    return ok(await download_manager.list_tasks())


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = await download_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return ok(task)


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    await download_manager.cancel_task(task_id)
    return ok(None, "任务已取消")


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await download_manager.delete_task(task_id)
    return ok(None, "任务记录已删除")


@router.post("/clear-finished")
async def clear_finished():
    await download_manager.clear_finished()
    return ok(None, "已完成记录已清空")


@router.get("/events")
async def download_events():
    """SSE 实时推送下载任务状态，替代轮询。"""
    queue = download_manager.subscribe()

    async def event_stream():
        try:
            initial = await download_manager.list_tasks()
            yield f"event: snapshot\ndata: {json.dumps(initial, ensure_ascii=False)}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"event: {msg['event']}\ndata: {json.dumps(msg['data'], ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            download_manager.unsubscribe(queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
