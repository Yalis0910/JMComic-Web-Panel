import json
import threading
import time
from pathlib import Path
from typing import Dict, Optional
from dataclasses import dataclass, field

_HISTORY_FILE = Path(__file__).parent.parent.parent / "config" / "download_history.json"
_MAX_HISTORY = 200


@dataclass
class DownloadTask:
    task_id: str
    album_id: str
    title: str = ""
    status: str = "pending"
    progress: int = 0
    total_count: int = 0
    completed_count: int = 0
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    thread: Optional[threading.Thread] = None
    download_type: str = "folder"
    current_chapter_index: int = 0
    total_chapters: int = 0
    current_chapter_completed: int = 0
    current_chapter_total: int = 0


class DownloadManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._tasks: Dict[str, DownloadTask] = {}
                cls._instance._task_lock = threading.Lock()
                cls._instance._stop_events: Dict[str, threading.Event] = {}
                cls._instance._load_from_file()
            return cls._instance

    def create_task(self, album_id: str) -> DownloadTask:
        import uuid
        task_id = uuid.uuid4().hex[:12]
        task = DownloadTask(task_id=task_id, album_id=album_id)
        with self._task_lock:
            self._tasks[task_id] = task
            self._stop_events[task_id] = threading.Event()
        self._save_to_file()
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        with self._task_lock:
            return self._tasks.get(task_id)

    def get_all_tasks(self) -> list:
        with self._task_lock:
            return [
                {k: v for k, v in t.__dict__.items() if k != 'thread'}
                for t in self._tasks.values()
            ]

    def update_progress(self, task_id: str, completed: int, total: int,
                        chapter_index: int = 0, total_chapters: int = 0,
                        chapter_completed: int = 0, chapter_total: int = 0):
        task = self.get_task(task_id)
        if task:
            task.completed_count = completed
            task.total_count = total
            task.progress = int(completed / total * 100) if total > 0 else 0
            task.current_chapter_index = chapter_index
            task.total_chapters = total_chapters
            task.current_chapter_completed = chapter_completed
            task.current_chapter_total = chapter_total
            self._save_to_file()

    def complete_task(self, task_id: str, error: Optional[str] = None):
        task = self.get_task(task_id)
        if task:
            task.status = "failed" if error else "completed"
            task.error = error
            task.progress = 100 if not error else task.progress
        self._save_to_file()

    def cancel_task(self, task_id: str):
        task = self.get_task(task_id)
        if task:
            task.status = "cancelled"
            with self._task_lock:
                event = self._stop_events.get(task_id)
                if event:
                    event.set()
        self._save_to_file()

    def get_stop_event(self, task_id: str) -> Optional[threading.Event]:
        with self._task_lock:
            return self._stop_events.get(task_id)

    def cleanup_task(self, task_id: str):
        with self._task_lock:
            self._stop_events.pop(task_id, None)

    def clear_history(self):
        with self._task_lock:
            self._tasks.clear()
            self._stop_events.clear()
        self._save_to_file()

    def _save_to_file(self):
        tasks_data = []
        for t in self._tasks.values():
            d = {k: v for k, v in t.__dict__.items() if k != 'thread'}
            tasks_data.append(d)
        tasks_data.sort(key=lambda x: x['created_at'], reverse=True)
        tasks_data = tasks_data[:_MAX_HISTORY]
        _HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        _HISTORY_FILE.write_text(
            json.dumps({"tasks": tasks_data}, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )

    def _load_from_file(self):
        if not _HISTORY_FILE.exists():
            return
        try:
            data = json.loads(_HISTORY_FILE.read_text(encoding='utf-8'))
            for item in data.get('tasks', []):
                if item['status'] == 'running':
                    item['status'] = 'failed'
                    item['error'] = '服务重启，任务中断'
                task = DownloadTask(**item)
                self._tasks[task.task_id] = task
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            import logging
            logging.warning(f"下载历史文件解析失败，将重新开始: {e}")


manager = DownloadManager()