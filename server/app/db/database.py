from pathlib import Path
from typing import Optional

import aiosqlite

from app.core.config import config_manager

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS reading_history (
    album_id TEXT PRIMARY KEY,
    photo_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    chapter_title TEXT NOT NULL DEFAULT '',
    cover_url TEXT NOT NULL DEFAULT '',
    page_index INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_history_updated ON reading_history(deleted, updated_at DESC);

CREATE TABLE IF NOT EXISTS download_tasks (
    task_id TEXT PRIMARY KEY,
    album_id TEXT NOT NULL,
    photo_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    download_type TEXT NOT NULL DEFAULT 'folder',
    progress INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    current_chapter_index INTEGER NOT NULL DEFAULT 0,
    total_chapters INTEGER NOT NULL DEFAULT 0,
    output_path TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_download_created ON download_tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS local_library (
    album_id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    path TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'folder',
    chapter_count INTEGER NOT NULL DEFAULT 1,
    page_count INTEGER NOT NULL DEFAULT 0,
    cover_path TEXT NOT NULL DEFAULT '',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    scanned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_searches (
    query TEXT PRIMARY KEY,
    updated_at INTEGER NOT NULL
);
"""


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self._custom_db_path = db_path

    @property
    def db_path(self) -> Path:
        return self._custom_db_path or config_manager.db_path

    async def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(SCHEMA_SQL)
            await db.commit()

    def connect(self) -> aiosqlite.Connection:
        return aiosqlite.connect(self.db_path)


db = Database()
