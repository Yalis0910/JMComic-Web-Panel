import json
import time
import uuid
from typing import Any, Dict, List, Optional

import aiosqlite

from app.db.database import Database, db as default_db


class HistoryRepository:
    def __init__(self, database: Database = default_db):
        self.db = database

    async def list_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                """
                SELECT album_id, photo_id, source, title, chapter_title, cover_url,
                       page_index, total_pages, updated_at, deleted
                FROM reading_history
                WHERE deleted = 0
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def list_all_including_deleted(self, since_ms: int = 0) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cursor = await conn.execute(
                """
                SELECT album_id, photo_id, source, title, chapter_title, cover_url,
                       page_index, total_pages, updated_at, deleted
                FROM reading_history
                WHERE updated_at > ?
                ORDER BY updated_at DESC
                """,
                (since_ms,),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def upsert(self, item: Dict[str, Any]) -> Dict[str, Any]:
        now_ms = int(item.get("updated_at") or time.time() * 1000)
        album_id = str(item["album_id"])
        source = str(item.get("source") or "online")
        if source not in ("online", "local"):
            source = "online"
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT updated_at FROM reading_history WHERE album_id = ?",
                (album_id,),
            )
            existing = await cur.fetchone()
            if existing and existing["updated_at"] > now_ms:
                # LWW: 本地已有更新的记录，保留较新版本
                cur2 = await conn.execute(
                    "SELECT * FROM reading_history WHERE album_id = ?",
                    (album_id,),
                )
                row = await cur2.fetchone()
                return dict(row)

            await conn.execute(
                """
                INSERT INTO reading_history (
                    album_id, photo_id, source, title, chapter_title, cover_url,
                    page_index, total_pages, updated_at, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(album_id) DO UPDATE SET
                    photo_id = excluded.photo_id,
                    source = excluded.source,
                    title = CASE WHEN excluded.title != '' THEN excluded.title ELSE reading_history.title END,
                    chapter_title = CASE WHEN excluded.chapter_title != '' THEN excluded.chapter_title ELSE reading_history.chapter_title END,
                    cover_url = CASE WHEN excluded.cover_url != '' THEN excluded.cover_url ELSE reading_history.cover_url END,
                    page_index = excluded.page_index,
                    total_pages = CASE WHEN excluded.total_pages > 0 THEN excluded.total_pages ELSE reading_history.total_pages END,
                    updated_at = excluded.updated_at,
                    deleted = excluded.deleted
                """,
                (
                    album_id,
                    str(item.get("photo_id") or album_id),
                    source,
                    item.get("title") or "",
                    item.get("chapter_title") or "",
                    item.get("cover_url") or "",
                    int(item.get("page_index") or 0),
                    int(item.get("total_pages") or 0),
                    now_ms,
                    1 if item.get("deleted") else 0,
                ),
            )
            await conn.commit()
            cur2 = await conn.execute(
                "SELECT * FROM reading_history WHERE album_id = ?",
                (album_id,),
            )
            row = await cur2.fetchone()
            return dict(row)

    async def soft_delete(self, album_id: str) -> None:
        now_ms = int(time.time() * 1000)
        async with self.db.connect() as conn:
            await conn.execute(
                """
                UPDATE reading_history
                SET deleted = 1, updated_at = ?
                WHERE album_id = ?
                """,
                (now_ms, str(album_id)),
            )
            await conn.commit()

    async def clear_all(self) -> None:
        now_ms = int(time.time() * 1000)
        async with self.db.connect() as conn:
            await conn.execute(
                "UPDATE reading_history SET deleted = 1, updated_at = ?",
                (now_ms,),
            )
            await conn.commit()


class DownloadRepository:
    def __init__(self, database: Database = default_db):
        self.db = database

    async def mark_interrupted_on_boot(self) -> None:
        now = time.time()
        async with self.db.connect() as conn:
            await conn.execute(
                """
                UPDATE download_tasks
                SET status = 'failed', error = '服务重启，任务中断', updated_at = ?
                WHERE status IN ('running', 'pending')
                """,
                (now,),
            )
            await conn.commit()

    async def upsert_task(self, task: Dict[str, Any]) -> None:
        async with self.db.connect() as conn:
            await conn.execute(
                """
                INSERT INTO download_tasks (
                    task_id, album_id, photo_id, title, status, download_type,
                    progress, completed_count, total_count,
                    current_chapter_index, total_chapters, output_path,
                    error, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                    title = excluded.title,
                    status = excluded.status,
                    progress = excluded.progress,
                    completed_count = excluded.completed_count,
                    total_count = excluded.total_count,
                    current_chapter_index = excluded.current_chapter_index,
                    total_chapters = excluded.total_chapters,
                    output_path = excluded.output_path,
                    error = excluded.error,
                    updated_at = excluded.updated_at
                """,
                (
                    task["task_id"],
                    str(task["album_id"]),
                    task.get("photo_id"),
                    task.get("title", ""),
                    task.get("status", "pending"),
                    task.get("download_type", "folder"),
                    int(task.get("progress", 0)),
                    int(task.get("completed_count", 0)),
                    int(task.get("total_count", 0)),
                    int(task.get("current_chapter_index", 0)),
                    int(task.get("total_chapters", 0)),
                    task.get("output_path", ""),
                    task.get("error"),
                    float(task.get("created_at", time.time())),
                    float(task.get("updated_at", time.time())),
                ),
            )
            await conn.commit()

    async def list_tasks(self, limit: int = 200) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT * FROM download_tasks ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
            return [dict(r) for r in await cur.fetchall()]

    async def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT * FROM download_tasks WHERE task_id = ?",
                (task_id,),
            )
            row = await cur.fetchone()
            return dict(row) if row else None

    async def delete_task(self, task_id: str) -> None:
        async with self.db.connect() as conn:
            await conn.execute("DELETE FROM download_tasks WHERE task_id = ?", (task_id,))
            await conn.commit()

    async def clear_finished(self) -> None:
        async with self.db.connect() as conn:
            await conn.execute("DELETE FROM download_tasks WHERE status NOT IN ('running', 'pending')")
            await conn.commit()


class LibraryRepository:
    def __init__(self, database: Database = default_db):
        self.db = database

    async def replace_all(self, items: List[Dict[str, Any]]) -> None:
        async with self.db.connect() as conn:
            await conn.execute("DELETE FROM local_library")
            for item in items:
                await conn.execute(
                    """
                    INSERT INTO local_library (
                        album_id, title, author, tags_json, path, format,
                        chapter_count, page_count, cover_path, size_bytes, scanned_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(item["album_id"]),
                        item.get("title", ""),
                        item.get("author", ""),
                        json.dumps(item.get("tags", []), ensure_ascii=False),
                        item["path"],
                        item.get("format", "folder"),
                        int(item.get("chapter_count", 1)),
                        int(item.get("page_count", 0)),
                        item.get("cover_path", ""),
                        int(item.get("size_bytes", 0)),
                        int(item.get("scanned_at", time.time())),
                    ),
                )
            await conn.commit()

    async def list_items(self) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute("SELECT * FROM local_library ORDER BY scanned_at DESC, title ASC")
            out = []
            for r in await cur.fetchall():
                d = dict(r)
                d["tags"] = json.loads(d.pop("tags_json", "[]"))
                out.append(d)
            return out

    async def get_item(self, album_id: str) -> Optional[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute("SELECT * FROM local_library WHERE album_id = ?", (str(album_id),))
            row = await cur.fetchone()
            if not row:
                return None
            d = dict(row)
            d["tags"] = json.loads(d.pop("tags_json", "[]"))
            return d

    async def delete_item(self, album_id: str) -> None:
        async with self.db.connect() as conn:
            await conn.execute("DELETE FROM local_library WHERE album_id = ?", (str(album_id),))
            await conn.commit()


class BookmarkRepository:
    def __init__(self, database: Database = default_db):
        self.db = database

    async def list_bookmarks(self, album_id: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            if album_id:
                cur = await conn.execute(
                    """
                    SELECT * FROM bookmarks
                    WHERE deleted = 0 AND album_id = ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (str(album_id), limit),
                )
            else:
                cur = await conn.execute(
                    """
                    SELECT * FROM bookmarks
                    WHERE deleted = 0
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
            return [dict(r) for r in await cur.fetchall()]

    async def list_all_including_deleted(self, since_ms: int = 0) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT * FROM bookmarks WHERE updated_at > ? ORDER BY updated_at DESC",
                (since_ms,),
            )
            return [dict(r) for r in await cur.fetchall()]

    async def upsert(self, item: Dict[str, Any]) -> Dict[str, Any]:
        now_ms = int(item.get("updated_at") or time.time() * 1000)
        album_id = str(item["album_id"])
        photo_id = str(item["photo_id"])
        page_index = int(item.get("page_index") or 0)
        source = str(item.get("source") or "online")
        if source not in ("online", "local"):
            source = "online"
        bookmark_id = str(item.get("bookmark_id") or f"{source}:{album_id}:{photo_id}:{page_index}")
        created_at = int(item.get("created_at") or now_ms)

        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT updated_at FROM bookmarks WHERE bookmark_id = ?",
                (bookmark_id,),
            )
            existing = await cur.fetchone()
            if existing and existing["updated_at"] > now_ms:
                cur2 = await conn.execute(
                    "SELECT * FROM bookmarks WHERE bookmark_id = ?",
                    (bookmark_id,),
                )
                return dict(await cur2.fetchone())

            await conn.execute(
                """
                INSERT INTO bookmarks (
                    bookmark_id, album_id, photo_id, source, title, chapter_title,
                    cover_url, page_index, note, created_at, updated_at, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(bookmark_id) DO UPDATE SET
                    title = CASE WHEN excluded.title != '' THEN excluded.title ELSE bookmarks.title END,
                    chapter_title = CASE WHEN excluded.chapter_title != '' THEN excluded.chapter_title ELSE bookmarks.chapter_title END,
                    cover_url = CASE WHEN excluded.cover_url != '' THEN excluded.cover_url ELSE bookmarks.cover_url END,
                    note = excluded.note,
                    updated_at = excluded.updated_at,
                    deleted = excluded.deleted
                """,
                (
                    bookmark_id,
                    album_id,
                    photo_id,
                    source,
                    item.get("title") or "",
                    item.get("chapter_title") or "",
                    item.get("cover_url") or "",
                    page_index,
                    item.get("note") or "",
                    created_at,
                    now_ms,
                    1 if item.get("deleted") else 0,
                ),
            )
            await conn.commit()
            cur2 = await conn.execute(
                "SELECT * FROM bookmarks WHERE bookmark_id = ?",
                (bookmark_id,),
            )
            return dict(await cur2.fetchone())

    async def soft_delete(self, bookmark_id: str) -> None:
        now_ms = int(time.time() * 1000)
        async with self.db.connect() as conn:
            await conn.execute(
                "UPDATE bookmarks SET deleted = 1, updated_at = ? WHERE bookmark_id = ?",
                (now_ms, bookmark_id),
            )
            await conn.commit()


class ShelfRepository:
    def __init__(self, database: Database = default_db):
        self.db = database

    async def list_shelves(self) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                """
                SELECT s.shelf_id, s.name, s.description, s.created_at, s.updated_at,
                       COUNT(i.album_id) AS item_count
                FROM local_shelves s
                LEFT JOIN local_shelf_items i
                    ON s.shelf_id = i.shelf_id AND i.deleted = 0
                WHERE s.deleted = 0
                GROUP BY s.shelf_id
                ORDER BY s.updated_at DESC, s.name ASC
                """
            )
            return [dict(r) for r in await cur.fetchall()]

    async def upsert_shelf(self, shelf_id: Optional[str], name: str, description: str = "") -> Dict[str, Any]:
        now_ms = int(time.time() * 1000)
        sid = shelf_id or f"shelf_{uuid.uuid4().hex[:10]}"
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("书单名称不能为空")
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            await conn.execute(
                """
                INSERT INTO local_shelves (shelf_id, name, description, created_at, updated_at, deleted)
                VALUES (?, ?, ?, ?, ?, 0)
                ON CONFLICT(shelf_id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    updated_at = excluded.updated_at,
                    deleted = 0
                """,
                (sid, clean_name, description.strip(), now_ms, now_ms),
            )
            await conn.commit()
            cur = await conn.execute("SELECT * FROM local_shelves WHERE shelf_id = ?", (sid,))
            row = dict(await cur.fetchone())
            cur_cnt = await conn.execute(
                "SELECT COUNT(*) FROM local_shelf_items WHERE shelf_id = ? AND deleted = 0",
                (sid,),
            )
            row["item_count"] = (await cur_cnt.fetchone())[0]
            return row

    async def delete_shelf(self, shelf_id: str) -> None:
        now_ms = int(time.time() * 1000)
        async with self.db.connect() as conn:
            await conn.execute(
                "UPDATE local_shelves SET deleted = 1, updated_at = ? WHERE shelf_id = ?",
                (now_ms, shelf_id),
            )
            await conn.execute(
                "UPDATE local_shelf_items SET deleted = 1, updated_at = ? WHERE shelf_id = ?",
                (now_ms, shelf_id),
            )
            await conn.commit()

    async def list_shelf_items(self, shelf_id: str) -> List[Dict[str, Any]]:
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                """
                SELECT shelf_id, album_id, title, author, cover_url, tags_json, added_at, updated_at
                FROM local_shelf_items
                WHERE shelf_id = ? AND deleted = 0
                ORDER BY added_at DESC
                """,
                (shelf_id,),
            )
            out = []
            for r in await cur.fetchall():
                d = dict(r)
                d["tags"] = json.loads(d.pop("tags_json", "[]"))
                out.append(d)
            return out

    async def add_item(self, shelf_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
        now_ms = int(time.time() * 1000)
        album_id = str(item["album_id"])
        async with self.db.connect() as conn:
            conn.row_factory = aiosqlite.Row
            await conn.execute(
                """
                INSERT INTO local_shelf_items (
                    shelf_id, album_id, title, author, cover_url, tags_json, added_at, updated_at, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(shelf_id, album_id) DO UPDATE SET
                    title = CASE WHEN excluded.title != '' THEN excluded.title ELSE local_shelf_items.title END,
                    author = CASE WHEN excluded.author != '' THEN excluded.author ELSE local_shelf_items.author END,
                    cover_url = CASE WHEN excluded.cover_url != '' THEN excluded.cover_url ELSE local_shelf_items.cover_url END,
                    tags_json = CASE WHEN excluded.tags_json != '[]' THEN excluded.tags_json ELSE local_shelf_items.tags_json END,
                    updated_at = excluded.updated_at,
                    deleted = 0
                """,
                (
                    shelf_id,
                    album_id,
                    item.get("title") or "",
                    item.get("author") or "",
                    item.get("cover_url") or f"/api/v2/media/cover/{album_id}",
                    json.dumps(item.get("tags") or [], ensure_ascii=False),
                    now_ms,
                    now_ms,
                ),
            )
            await conn.execute(
                "UPDATE local_shelves SET updated_at = ? WHERE shelf_id = ?",
                (now_ms, shelf_id),
            )
            await conn.commit()
            cur = await conn.execute(
                "SELECT * FROM local_shelf_items WHERE shelf_id = ? AND album_id = ?",
                (shelf_id, album_id),
            )
            d = dict(await cur.fetchone())
            d["tags"] = json.loads(d.pop("tags_json", "[]"))
            return d

    async def remove_item(self, shelf_id: str, album_id: str) -> None:
        now_ms = int(time.time() * 1000)
        async with self.db.connect() as conn:
            await conn.execute(
                "UPDATE local_shelf_items SET deleted = 1, updated_at = ? WHERE shelf_id = ? AND album_id = ?",
                (now_ms, shelf_id, str(album_id)),
            )
            await conn.commit()

    async def list_album_shelf_ids(self, album_id: str) -> List[str]:
        async with self.db.connect() as conn:
            cur = await conn.execute(
                """
                SELECT i.shelf_id
                FROM local_shelf_items i
                INNER JOIN local_shelves s ON i.shelf_id = s.shelf_id AND s.deleted = 0
                WHERE i.album_id = ? AND i.deleted = 0
                """,
                (str(album_id),),
            )
            return [row[0] for row in await cur.fetchall()]
