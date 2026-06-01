import threading
from fastapi import APIRouter, HTTPException, Body
from jmcomic import download_album, JmOption
from jmweb.utils.progress import manager

router = APIRouter(tags=["download"])


def _build_option(option_path: str = None, download_type: str = "folder"):
    if option_path:
        return JmOption.from_file(option_path)

    option = JmOption.default()

    if download_type == "zip":
        option.plugins["after_album"] = [
            {
                "plugin": "zip",
                "kwargs": {
                    "suffix": "zip",
                    "delete_original_file": True,
                },
            }
        ]

    return option


def _do_download(task_id: str, album_id: str, option_path: str = None, download_type: str = "folder"):
    try:
        option = _build_option(option_path, download_type)

        def callback(album, dler):
            manager.complete_task(task_id)

        download_album(album_id, option, callback=callback, check_exception=False)
    except Exception as e:
        manager.complete_task(task_id, error=str(e))


@router.post("/download/album")
async def download_album_endpoint(
    album_id: str = Body(...),
    option_path: str = Body(None),
    download_type: str = Body("folder"),
):
    if download_type not in ("folder", "zip"):
        raise HTTPException(status_code=400, detail="download_type 必须是 folder 或 zip")

    task = manager.create_task(album_id)
    task.status = "running"
    task.download_type = download_type

    t = threading.Thread(
        target=_do_download,
        args=(task.task_id, album_id, option_path, download_type),
        daemon=True,
    )
    task.thread = t
    t.start()

    return {
        "code": 0,
        "data": {"task_id": task.task_id, "album_id": album_id, "download_type": download_type},
        "message": f"下载任务已创建（{'压缩包' if download_type == 'zip' else '文件夹'}）",
    }


@router.get("/download/status/{task_id}")
async def get_download_status(task_id: str):
    task = manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "code": 0,
        "data": {
            "task_id": task.task_id,
            "album_id": task.album_id,
            "status": task.status,
            "progress": task.progress,
            "completed_count": task.completed_count,
            "total_count": task.total_count,
            "error": task.error,
            "download_type": task.download_type,
        },
        "message": "success",
    }


@router.post("/download/cancel/{task_id}")
async def cancel_download(task_id: str):
    manager.cancel_task(task_id)
    return {"code": 0, "data": None, "message": "已取消下载任务"}


@router.get("/download/tasks")
async def list_download_tasks():
    return {"code": 0, "data": manager.get_all_tasks(), "message": "success"}