import asyncio
from collections import deque
import json
import logging
from pathlib import Path
import threading
import time
import uuid
from typing import Any, Deque, Dict, List, Optional, Set

from jmcomic import download_album, download_photo
from jmcomic.jm_option import JmModuleConfig
from jmcomic.jm_plugin import JmOptionPlugin

from app.core.config import config_manager
from app.db.repositories import DownloadRepository
from app.services.library_service import library_service

logger = logging.getLogger("jm_panel.download")


class _ProgressPlugin(JmOptionPlugin):
    plugin_key = "_panel_progress"

    def invoke(self, image=None, downloader=None, **kwargs):
        if image is None:
            return
        mgr: DownloadManager = getattr(self.option, "_panel_mgr", None)
        task_id: str = getattr(self.option, "_panel_task_id", "")
        if not mgr or not task_id:
            return

        stop_event = mgr.get_stop_event(task_id)
        if stop_event and stop_event.is_set():
            raise RuntimeError("cancelled")

        photo = image.from_photo
        album = photo.from_album
        with self.option._panel_lock:
            self.option._panel_completed += 1
            mgr._on_worker_progress(
                task_id=task_id,
                completed=self.option._panel_completed,
                total=self.option._panel_total,
                chapter_index=getattr(photo, "index", 1),
                total_chapters=len(album) if album else 1,
            )


class DownloadManager:
    def __init__(self) -> None:
        self.repo = DownloadRepository()
        self._lock = threading.RLock()
        self._cond = threading.Condition(self._lock)
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._queue: Deque[str] = deque()
        self._active_workers: int = 0
        self._dispatcher_started: bool = False
        self._stop_events: Dict[str, threading.Event] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._last_persist_at: Dict[str, float] = {}

    def _ensure_dispatcher(self) -> None:
        with self._lock:
            if self._dispatcher_started:
                return
            self._dispatcher_started = True
            t = threading.Thread(
                target=self._dispatcher_loop,
                daemon=True,
                name="dl-dispatcher",
            )
            t.start()

    def _dispatcher_loop(self) -> None:
        while True:
            task_tuple = None
            with self._cond:
                while True:
                    max_conc = max(1, int(config_manager.get_settings().max_concurrent_downloads))
                    while self._queue and self._active_workers < max_conc:
                        tid = self._queue.popleft()
                        t = self._tasks.get(tid)
                        if not t or t.get("status") != "pending":
                            continue
                        t["status"] = "running"
                        t["updated_at"] = time.time()
                        snap = dict(t)
                        self._active_workers += 1
                        task_tuple = (
                            tid,
                            str(t["album_id"]),
                            str(t["download_type"]),
                            str(t["photo_id"]) if t.get("photo_id") else None,
                            snap,
                        )
                        break
                    if task_tuple is not None:
                        break
                    self._cond.wait(timeout=1.0)

            tid, album_id, dl_type, photo_id, snap = task_tuple
            self._persist_async(snap)
            self._broadcast("task_update", snap)
            worker = threading.Thread(
                target=self._worker_wrapper,
                args=(tid, album_id, dl_type, photo_id),
                daemon=True,
                name=f"dl-{tid}",
            )
            worker.start()

    def _worker_wrapper(self, task_id: str, album_id: str, download_type: str, photo_id: Optional[str]) -> None:
        try:
            self._worker_run(task_id, album_id, download_type, photo_id)
        finally:
            with self._cond:
                self._active_workers = max(0, self._active_workers - 1)
                self._cond.notify_all()

    async def startup(self) -> None:
        self._loop = asyncio.get_running_loop()
        await self.repo.mark_interrupted_on_boot()
        rows = await self.repo.list_tasks()
        with self._lock:
            for r in rows:
                self._tasks[r["task_id"]] = r
        self._ensure_dispatcher()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def _broadcast(self, event_type: str, payload: Any) -> None:
        if not self._loop or not self._subscribers:
            return
        msg = {"event": event_type, "data": payload}

        def _push():
            for q in list(self._subscribers):
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                try:
                    q.put_nowait(msg)
                except asyncio.QueueFull:
                    pass

        self._loop.call_soon_threadsafe(_push)

    def get_stop_event(self, task_id: str) -> Optional[threading.Event]:
        with self._lock:
            return self._stop_events.get(task_id)

    async def list_tasks(self) -> List[Dict[str, Any]]:
        with self._lock:
            tasks = list(self._tasks.values())
        tasks.sort(key=lambda t: t.get("created_at", 0), reverse=True)
        return tasks

    async def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._tasks.get(task_id)

    async def start_download(
        self,
        album_id: str,
        download_type: str = "folder",
        photo_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if download_type not in ("folder", "zip", "pdf", "long_img"):
            raise ValueError("download_type 必须是 folder/zip/pdf/long_img")

        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        self._ensure_dispatcher()

        now = time.time()
        task_id = uuid.uuid4().hex[:12]
        task = {
            "task_id": task_id,
            "album_id": str(album_id),
            "photo_id": str(photo_id) if photo_id else None,
            "title": "",
            "status": "pending",
            "download_type": download_type,
            "progress": 0,
            "completed_count": 0,
            "total_count": 0,
            "current_chapter_index": 0,
            "total_chapters": 0,
            "output_path": "",
            "error": None,
            "created_at": now,
            "updated_at": now,
        }
        with self._cond:
            self._tasks[task_id] = task
            self._stop_events[task_id] = threading.Event()
            self._queue.append(task_id)
            self._cond.notify_all()
        await self.repo.upsert_task(task)
        self._broadcast("task_update", task)
        return task

    async def retry_task(self, task_id: str) -> Dict[str, Any]:
        self._ensure_dispatcher()
        with self._cond:
            task = self._tasks.get(task_id)
            if not task:
                raise KeyError("任务不存在")
            if task["status"] in ("running", "pending"):
                return dict(task)
            task["status"] = "pending"
            task["progress"] = 0
            task["completed_count"] = 0
            task["error"] = None
            task["updated_at"] = time.time()
            self._stop_events[task_id] = threading.Event()
            self._queue.append(task_id)
            snap = dict(task)
            self._cond.notify_all()
        await self.repo.upsert_task(snap)
        self._broadcast("task_update", snap)
        return snap

    async def cancel_task(self, task_id: str) -> None:
        with self._cond:
            ev = self._stop_events.get(task_id)
            if ev:
                ev.set()
            task = self._tasks.get(task_id)
            if task and task["status"] in ("running", "pending"):
                task["status"] = "cancelled"
                task["updated_at"] = time.time()
                snap = dict(task)
            else:
                snap = None
            self._cond.notify_all()
        if snap:
            await self.repo.upsert_task(snap)
            self._broadcast("task_update", snap)

    async def delete_task(self, task_id: str) -> None:
        await self.cancel_task(task_id)
        with self._lock:
            self._tasks.pop(task_id, None)
            self._stop_events.pop(task_id, None)
        await self.repo.delete_task(task_id)
        self._broadcast("task_deleted", {"task_id": task_id})

    async def clear_finished(self) -> None:
        with self._lock:
            to_del = [
                tid for tid, t in self._tasks.items()
                if t["status"] not in ("running", "pending")
            ]
            for tid in to_del:
                self._tasks.pop(tid, None)
        await self.repo.clear_finished()
        self._broadcast("tasks_cleared", {})

    def _build_option(self, download_type: str, is_single_photo: bool):
        option = config_manager.load_jm_option()
        base_dir = option.dir_rule.base_dir
        plugin_hook = "after_photo" if is_single_photo else "after_album"
        name_rule = "Ptitle" if is_single_photo else "Atitle"

        if download_type == "zip":
            option.plugins.src_dict[plugin_hook] = [
                {
                    "plugin": "zip",
                    "kwargs": {
                        "filename_rule": name_rule,
                        "suffix": "zip",
                        "zip_dir": base_dir,
                        "delete_original_file": True,
                    },
                }
            ]
        elif download_type == "pdf":
            option.plugins.src_dict[plugin_hook] = [
                {
                    "plugin": "img2pdf",
                    "kwargs": {
                        "pdf_dir": base_dir,
                        "filename_rule": name_rule,
                        "delete_original_file": True,
                    },
                }
            ]
        elif download_type == "long_img":
            option.plugins.src_dict[plugin_hook] = [
                {
                    "plugin": "long_img",
                    "kwargs": {
                        "img_dir": base_dir,
                        "filename_rule": name_rule,
                        "delete_original_file": True,
                    },
                }
            ]
        return option

    def _persist_async(self, task_snapshot: Dict[str, Any]) -> None:
        if self._loop:
            asyncio.run_coroutine_threadsafe(self.repo.upsert_task(task_snapshot), self._loop)

    def _on_worker_progress(
        self,
        task_id: str,
        completed: int,
        total: int,
        chapter_index: int = 0,
        total_chapters: int = 0,
    ) -> None:
        now = time.time()
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return
            task["completed_count"] = completed
            task["total_count"] = total
            task["progress"] = min(99, int(completed / total * 100)) if total > 0 else 0
            task["current_chapter_index"] = chapter_index
            task["total_chapters"] = total_chapters
            task["updated_at"] = now
            snapshot = dict(task)

        self._broadcast("task_update", snapshot)
        last = self._last_persist_at.get(task_id, 0.0)
        if now - last >= 1.5:
            self._last_persist_at[task_id] = now
            self._persist_async(snapshot)

    def _write_album_metadata(self, target_dir: Path, meta: Dict[str, Any]) -> None:
        try:
            if target_dir.exists() and target_dir.is_dir():
                (target_dir / ".jmlis-meta.json").write_text(
                    json.dumps(meta, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
        except OSError as exc:
            logger.debug("写入 .jmlis-meta.json 失败: %s", exc)

    def _worker_run(self, task_id: str, album_id: str, download_type: str, photo_id: Optional[str]) -> None:
        try:
            stop_ev = self.get_stop_event(task_id)
            if stop_ev and stop_ev.is_set():
                return

            option = self._build_option(download_type, is_single_photo=bool(photo_id))
            client = option.new_jm_client()
            meta_payload: Dict[str, Any] = {"album_id": str(album_id)}
            album_obj = None

            if photo_id:
                photo = client.get_photo_detail(photo_id, fetch_album=True)
                total_pages = len(photo)
                album_obj = getattr(photo, "from_album", None)
                title = album_obj.name if album_obj else photo.name
                meta_payload.update(
                    {
                        "title": title,
                        "author": ", ".join(getattr(album_obj, "authors", []) or []) if album_obj else "",
                        "tags": list(getattr(album_obj, "tags", []) or []) if album_obj else [],
                    }
                )
            else:
                album_obj = client.get_album_detail(album_id)
                total_pages = int(album_obj.page_count or 0)
                if total_pages <= 0:
                    total_pages = sum(
                        len(client.get_photo_detail(ep[0], fetch_album=False))
                        for ep in album_obj.episode_list
                    )
                title = album_obj.name
                meta_payload.update(
                    {
                        "title": title,
                        "author": ", ".join(getattr(album_obj, "authors", []) or []),
                        "tags": list(getattr(album_obj, "tags", []) or []),
                    }
                )

            with self._lock:
                task = self._tasks.get(task_id)
                if task:
                    task["title"] = title
                    task["total_count"] = total_pages
                    task["updated_at"] = time.time()
                    snap = dict(task)
                    self._broadcast("task_update", snap)
                    self._persist_async(snap)

            option._panel_mgr = self
            option._panel_task_id = task_id
            option._panel_total = max(1, total_pages)
            option._panel_completed = 0
            option._panel_lock = threading.Lock()

            JmModuleConfig.REGISTRY_PLUGIN[ProgressPluginKey] = _ProgressPlugin
            option.plugins.src_dict.setdefault("before_image", []).insert(
                0, {"plugin": ProgressPluginKey, "kwargs": {}}
            )

            def _done_cb(*_args):
                if download_type == "folder" and album_obj is not None:
                    try:
                        root_dir = Path(option.dir_rule.decide_album_root_dir(album_obj))
                        self._write_album_metadata(root_dir, meta_payload)
                    except Exception:
                        pass
                with self._lock:
                    t = self._tasks.get(task_id)
                    if t and t["status"] != "cancelled":
                        t["status"] = "completed"
                        t["progress"] = 100
                        t["completed_count"] = max(t["completed_count"], t["total_count"])
                        t["output_path"] = option.dir_rule.base_dir
                        t["updated_at"] = time.time()
                        snap2 = dict(t)
                        self._broadcast("task_update", snap2)
                        self._persist_async(snap2)
                if self._loop:
                    asyncio.run_coroutine_threadsafe(library_service.scan(), self._loop)

            if photo_id:
                download_photo(photo_id, option, callback=_done_cb, check_exception=True)
            else:
                download_album(album_id, option, callback=_done_cb, check_exception=True)

        except Exception as exc:
            with self._lock:
                t = self._tasks.get(task_id)
                if t and t["status"] != "cancelled":
                    t["status"] = "failed"
                    t["error"] = str(exc)
                    t["updated_at"] = time.time()
                    snap3 = dict(t)
                    self._broadcast("task_update", snap3)
                    self._persist_async(snap3)
        finally:
            with self._lock:
                self._stop_events.pop(task_id, None)
                self._last_persist_at.pop(task_id, None)


ProgressPluginKey = _ProgressPlugin.plugin_key
download_manager = DownloadManager()
