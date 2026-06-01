import threading
import time
from typing import Dict, Optional
from dataclasses import dataclass, field


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


class DownloadManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._tasks: Dict[str, DownloadTask] = {}
                cls._instance._task_lock = threading.Lock()
            return cls._instance

    def create_task(self, album_id: str) -> DownloadTask:
        import uuid
        task_id = uuid.uuid4().hex[:12]
        task = DownloadTask(task_id=task_id, album_id=album_id)
        with self._task_lock:
            self._tasks[task_id] = task
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

    def update_progress(self, task_id: str, completed: int, total: int):
        task = self.get_task(task_id)
        if task:
            task.completed_count = completed
            task.total_count = total
            task.progress = int(completed / total * 100) if total > 0 else 0

    def complete_task(self, task_id: str, error: Optional[str] = None):
        task = self.get_task(task_id)
        if task:
            task.status = "failed" if error else "completed"
            task.error = error
            task.progress = 100 if not error else task.progress

    def cancel_task(self, task_id: str):
        task = self.get_task(task_id)
        if task:
            task.status = "cancelled"


manager = DownloadManager()