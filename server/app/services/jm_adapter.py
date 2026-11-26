import csv
import html
import io
import json
import logging
import re
import threading
import time
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

from jmcomic import JmMagicConstants, JmOption, JmcomicText

from app.core.config import config_manager
from app.core.security import decrypt_secret, encrypt_secret

logger = logging.getLogger("jm_panel.adapter")


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or isinstance(value, bool):
            return default
        if isinstance(value, (int, float)):
            return int(value)
        text = str(value).strip()
        return int(float(text)) if text else default
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or isinstance(value, bool):
            return default
        text = str(value).strip()
        return float(text) if text else default
    except (TypeError, ValueError):
        return default


class _PlainTextHTMLParser(HTMLParser):
    """将禁漫接口返回的 HTML 片段安全清洗为纯文本。"""

    _BLOCK_END_TAGS = {"div", "p", "li", "blockquote", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: List[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        t = tag.lower()
        if t in ("script", "style"):
            self._skip_depth += 1
        elif t == "br" and self._skip_depth == 0:
            self._chunks.append("\n")
        elif t == "img" and self._skip_depth == 0:
            alt = dict(attrs).get("alt") or ""
            if alt.strip():
                self._chunks.append(alt.strip())

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in ("script", "style"):
            if self._skip_depth > 0:
                self._skip_depth -= 1
        elif t in self._BLOCK_END_TAGS and self._skip_depth == 0:
            if self._chunks and not self._chunks[-1].endswith("\n"):
                self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data:
            self._chunks.append(data)

    def get_text(self) -> str:
        raw = "".join(self._chunks).replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " ")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw.split("\n")]
        cleaned = "\n".join(lines)
        return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def clean_html_text(raw: Any) -> str:
    """剥离 HTML 标签并解码字符实体，保留正常换行与文本内容。"""
    if raw is None:
        return ""
    text = str(raw)
    if not text:
        return ""
    if "<" not in text and "&" not in text:
        return text.strip()
    parser = _PlainTextHTMLParser()
    parser.feed(text)
    parser.close()
    result = parser.get_text()
    # 处理双重转义实体（如 &amp;nbsp; -> &nbsp;）
    if "&" in result:
        result = html.unescape(result).replace("\xa0", " ").strip()
    return result


def _cover_proxy_url(album_id: str) -> str:
    return f"/api/v2/media/cover/{album_id}"


def _format_page_albums(page_obj) -> Dict[str, Any]:
    albums = []
    for aid, info in page_obj.content:
        aid_str = str(aid)
        item = {
            "album_id": aid_str,
            "title": info.get("name", ""),
            "author": info.get("author", "") if isinstance(info.get("author"), str) else ", ".join(info.get("author") or []),
            "tags": info.get("tags", []) or [],
            "cover_url": _cover_proxy_url(aid_str),
        }
        if isinstance(info.get("category"), dict):
            item["category"] = info["category"].get("title", "")
        for key in ("update_date", "views", "likes", "page_count"):
            if info.get(key) not in (None, ""):
                item[key] = info[key]
        albums.append(item)

    return {
        "albums": albums,
        "total": int(getattr(page_obj, "total", len(albums)) or 0),
        "page_count": int(getattr(page_obj, "page_count", 1) or 1),
        "page_size": int(getattr(page_obj, "page_size", len(albums) or 20) or 20),
    }


def _normalize_raw_album_list(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        aid = str(it.get("id") or it.get("album_id") or "")
        if not aid:
            continue
        author_val = it.get("author", "")
        if isinstance(author_val, list):
            author_val = ", ".join(str(x) for x in author_val)
        cat = it.get("category")
        cat_title = cat.get("title", "") if isinstance(cat, dict) else str(cat or "")
        out.append(
            {
                "album_id": aid,
                "title": str(it.get("name") or it.get("title") or "").strip(),
                "author": str(author_val or ""),
                "tags": it.get("tags") if isinstance(it.get("tags"), list) else [],
                "category": cat_title,
                "cover_url": _cover_proxy_url(aid),
            }
        )
    return out


class JMProtocolAdapter:
    """封装 jmcomic 客户端池、会话持久化和扩展 APP 接口。"""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._anon_clients: Dict[str, Any] = {}
        self._user_client: Any = None
        self._user_impl: str = "api"
        self._username: str = ""
        self._password_enc: str = ""
        self._login_time: float = 0.0
        self._profile: Dict[str, Any] = {}
        self._restore_session()

    def _build_option(self, impl: Optional[str] = None, cookies: Optional[Dict[str, str]] = None) -> JmOption:
        option = config_manager.load_jm_option()
        settings = config_manager.get_settings()
        option.client.impl = impl or settings.client_impl or "api"
        if cookies:
            option.update_cookies(cookies)
        return option

    def reset_clients(self) -> None:
        with self._lock:
            self._anon_clients.clear()

    def get_client(self, impl: Optional[str] = None, prefer_auth: bool = True):
        with self._lock:
            settings = config_manager.get_settings()
            target_impl = impl or settings.client_impl or "api"

            if prefer_auth and self._user_client is not None and (impl is None or impl == self._user_impl):
                return self._user_client

            if prefer_auth and self._user_client is None and self._username and self._password_enc:
                if self.refresh_session():
                    if impl is None or impl == self._user_impl:
                        return self._user_client

            if target_impl not in self._anon_clients:
                opt = self._build_option(impl=target_impl)
                self._anon_clients[target_impl] = opt.new_jm_client()
            return self._anon_clients[target_impl]

    def get_api_client(self, prefer_auth: bool = True):
        return self.get_client(impl="api", prefer_auth=prefer_auth)

    def get_html_client(self, prefer_auth: bool = True):
        return self.get_client(impl="html", prefer_auth=prefer_auth)

    # ---------- 会话与认证 ----------

    def login(self, username: str, password: str, impl: str = "api") -> Dict[str, Any]:
        with self._lock:
            opt = self._build_option(impl=impl)
            client = opt.new_jm_client()
            resp = client.login(username=username, password=password)

            profile: Dict[str, Any] = {"username": username}
            if impl == "api" and hasattr(resp, "res_data") and isinstance(resp.res_data, dict):
                data = resp.res_data
                profile = {
                    "uid": str(data.get("uid", "")),
                    "username": data.get("username", username),
                    "email": data.get("email", ""),
                    "photo": data.get("photo", ""),
                    "coin": _safe_int(data.get("coin"), 0),
                    "level": _safe_int(data.get("level"), 1),
                    "level_name": str(data.get("level_name", "") or ""),
                    "exp": str(data.get("exp", "0") or "0"),
                    "exp_percent": _safe_float(data.get("expPercent", data.get("exp_percent")), 0.0),
                    "album_favorites": _safe_int(data.get("album_favorites"), 0),
                    "album_favorites_max": _safe_int(data.get("album_favorites_max"), 0),
                }

            self._user_client = client
            self._user_impl = impl
            self._username = profile.get("username") or username
            self._password_enc = encrypt_secret(password)
            self._login_time = time.time()
            self._profile = profile
            self._save_session()
            return self.get_user_status()

    def logout(self) -> None:
        with self._lock:
            self._user_client = None
            self._username = ""
            self._password_enc = ""
            self._login_time = 0.0
            self._profile = {}
            if config_manager.session_path.exists():
                config_manager.session_path.unlink(missing_ok=True)

    def refresh_session(self) -> bool:
        with self._lock:
            if not self._username or not self._password_enc:
                return False
            try:
                password = decrypt_secret(self._password_enc)
                opt = self._build_option(impl=self._user_impl)
                client = opt.new_jm_client()
                client.login(username=self._username, password=password)
                self._user_client = client
                self._login_time = time.time()
                self._save_session()
                return True
            except Exception as exc:
                logger.warning("自动刷新 JM 登录会话失败: %s", exc)
                return False

    def get_user_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "is_logged_in": self._user_client is not None or bool(self._username and self._password_enc),
                "username": self._username,
                "impl": self._user_impl,
                "login_time": self._login_time,
                "profile": self._profile,
            }

    def _save_session(self) -> None:
        if self._user_client is None:
            return
        try:
            cookies = dict(self._user_client["cookies"])
            payload = {
                "username": self._username,
                "impl": self._user_impl,
                "cookies": cookies,
                "password_enc": self._password_enc,
                "login_time": self._login_time,
                "profile": self._profile,
            }
            config_manager.session_path.parent.mkdir(parents=True, exist_ok=True)
            config_manager.session_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("保存 session.json 失败: %s", exc)

    def _restore_session(self) -> None:
        path = config_manager.session_path
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            cookies = data.get("cookies") or {}
            if not cookies:
                return
            impl = data.get("impl", "api")
            opt = self._build_option(impl=impl, cookies=cookies)
            self._user_client = opt.new_jm_client()
            self._user_impl = impl
            self._username = data.get("username", "")
            self._password_enc = data.get("password_enc", "")
            self._login_time = float(data.get("login_time", 0.0))
            self._profile = data.get("profile", {})
        except Exception as exc:
            logger.warning("恢复 session.json 失败: %s", exc)
            path.unlink(missing_ok=True)

    # ---------- 发现 / 首页 / 每周必看 / 排行 / 分类 ----------

    def get_promote(self, page: int = 1) -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api("/promote", params={"page": page})
        raw = resp.res_data
        sections = []
        if isinstance(raw, list):
            for sec in raw:
                if not isinstance(sec, dict):
                    continue
                sections.append(
                    {
                        "id": str(sec.get("id", "")),
                        "title": str(sec.get("title", "")),
                        "slug": str(sec.get("slug", "")),
                        "type": str(sec.get("type", "")),
                        "albums": _normalize_raw_album_list(sec.get("content")),
                    }
                )
        return {"sections": sections}

    def get_latest(self, page: int = 1) -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api("/latest", params={"page": page})
        albums = _normalize_raw_album_list(resp.res_data)
        return {"albums": albums, "page": page}

    def get_week_categories(self) -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api("/week")
        data = resp.res_data if isinstance(resp.res_data, dict) else {}

        raw_cats = data.get("categories", []) or []
        categories = []
        for c in raw_cats:
            if not isinstance(c, dict):
                continue
            cid = str(c.get("id", "")).strip()
            title = str(c.get("title") or "").strip()
            time_str = str(c.get("time") or "").strip()
            label = f"{time_str} · {title}" if (time_str and title) else (title or time_str or f"第{cid}期")
            categories.append({**c, "id": cid, "title": label, "time": time_str})

        type_fallbacks = {"manga": "日漫", "hanman": "韩漫", "another": "其他"}
        raw_types = data.get("type", []) or []
        types = []
        for t in raw_types:
            if not isinstance(t, dict):
                continue
            tid = str(t.get("id", "")).strip()
            title = str(t.get("title") or "").strip() or type_fallbacks.get(tid, tid)
            types.append({**t, "id": tid, "title": title})

        return {
            "categories": categories,
            "types": types,
        }

    def get_week_filter(self, category_id: str, type_id: str = "manga") -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api("/week/filter", params={"id": category_id, "type": type_id})
        data = resp.res_data if isinstance(resp.res_data, dict) else {}
        return {
            "albums": _normalize_raw_album_list(data.get("list")),
            "total": int(data.get("total") or 0),
        }

    def get_categories_meta(self) -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api("/categories")
        data = resp.res_data if isinstance(resp.res_data, dict) else {}
        sub_categories = {
            "doujin": [
                {"slug": JmMagicConstants.SUB_DOUJIN_CHINESE, "name": "汉化"},
                {"slug": JmMagicConstants.SUB_DOUJIN_JAPANESE, "name": "日语"},
                {"slug": JmMagicConstants.SUB_DOUJIN_CG, "name": "CG"},
            ],
            "single": [
                {"slug": JmMagicConstants.SUB_SINGLE_CHINESE, "name": "汉化"},
                {"slug": JmMagicConstants.SUB_SINGLE_JAPANESE, "name": "日语"},
                {"slug": JmMagicConstants.SUB_SINGLE_YOUTH, "name": "青年"},
            ],
            "short": [
                {"slug": JmMagicConstants.SUB_SHORT_CHINESE, "name": "汉化"},
                {"slug": JmMagicConstants.SUB_SHORT_JAPANESE, "name": "日语"},
            ],
            "another": [
                {"slug": JmMagicConstants.SUB_ANOTHER_OTHER, "name": "其他"},
                {"slug": JmMagicConstants.SUB_ANOTHER_3D, "name": "3D"},
                {"slug": JmMagicConstants.SUB_ANOTHER_COSPLAY, "name": "Cosplay"},
            ],
        }
        return {
            "categories": data.get("categories", []),
            "blocks": data.get("blocks", []),
            "sub_categories": sub_categories,
        }

    def get_ranking(self, ranking_type: str, page: int = 1, category: str = "0") -> Dict[str, Any]:
        client = self.get_client()
        cat = "0" if category == "ALL" else category
        if ranking_type == "day":
            res = client.day_ranking(page=page, category=cat)
        elif ranking_type == "week":
            res = client.week_ranking(page=page, category=cat)
        elif ranking_type == "month":
            res = client.month_ranking(page=page, category=cat)
        elif ranking_type == "all":
            res = client.categories_filter(
                page=page,
                time=JmMagicConstants.TIME_ALL,
                category=cat,
                order_by=JmMagicConstants.ORDER_BY_VIEW,
            )
        elif ranking_type == "likes":
            res = client.categories_filter(
                page=page,
                time=JmMagicConstants.TIME_ALL,
                category=cat,
                order_by=JmMagicConstants.ORDER_BY_LIKE,
            )
        elif ranking_type == "latest":
            res = client.categories_filter(
                page=page,
                time=JmMagicConstants.TIME_ALL,
                category=cat,
                order_by=JmMagicConstants.ORDER_BY_LATEST,
            )
        else:
            raise ValueError(f"不支持的排行类型: {ranking_type}")
        return _format_page_albums(res)

    def get_category_filter(
        self,
        page: int = 1,
        time_range: str = "a",
        category: str = "0",
        order_by: str = "mv",
        sub_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        # 副分类、评分(tr)与评论数(md)排序仅网页端支持，自动切换 HTML 客户端
        use_html = bool(sub_category) or order_by in (
            JmMagicConstants.ORDER_BY_SCORE,
            JmMagicConstants.ORDER_BY_COMMENT,
        )
        client = self.get_html_client() if use_html else self.get_client()
        cat = "0" if category == "ALL" else category
        t = JmMagicConstants.TIME_ALL if time_range in ("ALL", "", "a") else time_range
        res = client.categories_filter(
            page=page,
            time=t,
            category=cat,
            order_by=order_by,
            sub_category=sub_category,
        )
        return _format_page_albums(res)

    # ---------- 搜索 ----------

    def search(
        self,
        query: str,
        search_type: str = "all",
        page: int = 1,
        order_by: str = "mr",
        time_range: str = "a",
        category: str = "0",
        sub_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        # 分类/副分类及评分/评论排序仅 HTML 客户端支持，否则优先用当前默认客户端
        use_html = (
            (category not in ("0", "ALL", ""))
            or bool(sub_category)
            or order_by in (JmMagicConstants.ORDER_BY_SCORE, JmMagicConstants.ORDER_BY_COMMENT)
        )
        client = self.get_html_client() if use_html else self.get_client()
        cat = "0" if category == "ALL" else category

        method_map = {
            "all": client.search_site,
            "work": client.search_work,
            "author": client.search_author,
            "tag": client.search_tag,
            "actor": client.search_actor,
        }
        fn = method_map.get(search_type, client.search_site)
        res = fn(
            search_query=query,
            page=page,
            order_by=order_by,
            time=time_range,
            category=cat,
            sub_category=sub_category,
        )
        return _format_page_albums(res)

    # ---------- 漫画详情 / 章节 / 评论 ----------

    def get_album_detail(self, album_id: str) -> Dict[str, Any]:
        client = self.get_client()
        album = client.get_album_detail(album_id)
        episodes = [
            {
                "photo_id": str(pid),
                "index": int(pindex),
                "name": str(pname).strip(),
            }
            for pid, pindex, pname in album.episode_list
        ]
        related = _normalize_raw_album_list(getattr(album, "related_list", None))
        return {
            "album_id": str(album.album_id),
            "title": album.name,
            "authors": album.authors,
            "tags": album.tags,
            "actors": album.actors,
            "works": album.works,
            "description": clean_html_text(album.description),
            "page_count": album.page_count,
            "views": album.views,
            "likes": album.likes,
            "comment_count": album.comment_count,
            "pub_date": album.pub_date,
            "update_date": album.update_date,
            "episodes": episodes,
            "related": related,
            "cover_url": _cover_proxy_url(str(album.album_id)),
            "is_favorite": bool(getattr(album, "is_favorite", False)),
            "liked": bool(getattr(album, "liked", False)),
        }

    def get_photo_detail(self, photo_id: str) -> Dict[str, Any]:
        client = self.get_client()
        photo = client.get_photo_detail(photo_id, fetch_album=False, fetch_scramble_id=True)
        scramble_id = getattr(photo, "scramble_id", None) or ""
        from urllib.parse import quote

        images = []
        for i in range(len(photo)):
            img = photo.getindex(i)
            raw_url = img.download_url
            sid_q = f"&scramble_id={quote(str(scramble_id))}" if scramble_id else ""
            images.append(
                {
                    "index": img.index,
                    "filename": img.filename,
                    "raw_url": raw_url,
                    "proxy_url": f"/api/v2/media/image?url={quote(raw_url, safe='')}{sid_q}",
                    "scramble_id": str(scramble_id),
                }
            )

        return {
            "photo_id": str(photo.photo_id),
            "album_id": str(photo.album_id),
            "name": photo.name,
            "sort": photo.sort,
            "scramble_id": str(scramble_id),
            "image_count": len(photo),
            "images": images,
        }

    def get_comments(self, album_id: str, page: int = 1) -> Dict[str, Any]:
        client = self.get_api_client()
        resp = client.req_api(
            "/forum",
            params={"mode": "manhua", "aid": str(album_id), "page": page},
        )
        data = resp.res_data if isinstance(resp.res_data, dict) else {}
        raw_list = data.get("list", []) or []
        comments = []
        for c in raw_list:
            if not isinstance(c, dict):
                continue
            replies = []
            for rep in c.get("replys") or []:
                if not isinstance(rep, dict):
                    continue
                replies.append(
                    {
                        "cid": str(rep.get("CID", "")),
                        "username": str(rep.get("username") or rep.get("nickname") or ""),
                        "content": clean_html_text(rep.get("content", "")),
                        "addtime": str(rep.get("addtime", "")),
                        "photo": str(rep.get("photo", "")),
                    }
                )
            comments.append(
                {
                    "cid": str(c.get("CID", "")),
                    "username": str(c.get("username") or c.get("nickname") or ""),
                    "level": c.get("expinfo", {}).get("level") if isinstance(c.get("expinfo"), dict) else None,
                    "level_name": c.get("expinfo", {}).get("level_name") if isinstance(c.get("expinfo"), dict) else "",
                    "content": clean_html_text(c.get("content", "")),
                    "likes": str(c.get("likes", "0")),
                    "addtime": str(c.get("addtime", "")),
                    "spoiler": str(c.get("spoiler", "0")) == "1",
                    "replies": replies,
                }
            )
        return {
            "comments": comments,
            "total": int(data.get("total") or len(comments)),
            "page": page,
        }

    def get_forum_comments(self, page: int = 1) -> Dict[str, Any]:
        client = self.get_client()
        res = client.forum_pagination(page=page)
        comments = []
        for c in getattr(res, "content", []) or []:
            raw = getattr(c, "raw_data", {}) or {}
            expinfo = raw.get("expinfo") if isinstance(raw, dict) else None
            replies = []
            for rep in getattr(c, "replies", []) or []:
                rep_raw = getattr(rep, "raw_data", {}) or {}
                replies.append(
                    {
                        "cid": str(getattr(rep, "comment_id", "") or ""),
                        "username": str(getattr(rep, "username", None) or getattr(rep, "nickname", None) or ""),
                        "content": clean_html_text(getattr(rep, "content", "")),
                        "addtime": str(getattr(rep, "created_at", "") or ""),
                        "photo": str(rep_raw.get("photo", "") if isinstance(rep_raw, dict) else ""),
                    }
                )
            album_id = str(getattr(c, "album_id", None) or (raw.get("AID") if isinstance(raw, dict) else "") or "")
            likes_val = getattr(c, "likes", None)
            comments.append(
                {
                    "cid": str(getattr(c, "comment_id", "") or ""),
                    "album_id": album_id,
                    "username": str(getattr(c, "username", None) or getattr(c, "nickname", None) or ""),
                    "level": expinfo.get("level") if isinstance(expinfo, dict) else None,
                    "level_name": expinfo.get("level_name") if isinstance(expinfo, dict) else "",
                    "content": clean_html_text(getattr(c, "content", "")),
                    "likes": str(likes_val if likes_val is not None else "0"),
                    "addtime": str(getattr(c, "created_at", "") or ""),
                    "spoiler": bool(getattr(c, "is_spoiler", False)),
                    "replies": replies,
                }
            )
        total = getattr(res, "total", None)
        page_count = getattr(res, "page_count", None)
        return {
            "comments": comments,
            "total": int(total if total is not None else len(comments)),
            "page": page,
            "page_count": int(page_count or 1),
        }

    def post_comment(self, album_id: str, comment: str, comment_id: Optional[str] = None, spoiler: bool = False) -> Dict[str, Any]:
        if not self._username:
            raise PermissionError("请先登录账号后再发表评论")
        html_client = self.get_html_client(prefer_auth=False)
        if self._user_impl == "html" and self._user_client is not None:
            html_client = self._user_client
        elif self._password_enc:
            opt = self._build_option(impl="html")
            html_client = opt.new_jm_client()
            html_client.login(self._username, decrypt_secret(self._password_enc))

        resp = html_client.album_comment(
            video_id=album_id,
            comment=comment,
            status="true" if spoiler else "false",
            comment_id=comment_id,
        )
        return resp.json()

    # ---------- 收藏管理 ----------

    def _require_auth_client(self):
        with self._lock:
            if self._user_client is None and self._username and self._password_enc:
                self.refresh_session()
            if self._user_client is None:
                raise PermissionError("未登录，请先登录 JM 账号")
            return self._user_client

    def get_favorites(self, page: int = 1, folder_id: str = "0", order_by: str = "mr") -> Dict[str, Any]:
        client = self._require_auth_client()
        try:
            res = client.favorite_folder(page=page, folder_id=folder_id, order_by=order_by, username=self._username)
        except Exception as exc:
            if ("401" in str(exc) or "登入" in str(exc)) and self.refresh_session():
                client = self._require_auth_client()
                res = client.favorite_folder(page=page, folder_id=folder_id, order_by=order_by, username=self._username)
            else:
                raise
        formatted = _format_page_albums(res)
        formatted["folders"] = [
            {"folder_id": str(fid), "name": str(fname)}
            for fid, fname in res.iter_folder_id_name()
        ]
        return formatted

    def add_favorite(self, album_id: str, folder_id: str = "0") -> None:
        client = self._require_auth_client()
        if folder_id not in ("0", "") and self._user_impl == "api" and self._username and self._password_enc:
            opt = self._build_option(impl="html")
            html_client = opt.new_jm_client()
            html_client.login(self._username, decrypt_secret(self._password_enc))
            html_client.add_favorite_album(album_id=album_id, folder_id=folder_id)
            return
        client.add_favorite_album(album_id=album_id, folder_id=folder_id)

    def remove_favorite(self, album_id: str) -> None:
        client = self._require_auth_client()
        if hasattr(client, "delete_favorite_album"):
            client.delete_favorite_album(album_id=album_id)
        else:
            client.remove_favorite_album(album_id=album_id)

    def get_daily_info(self) -> Dict[str, Any]:
        client = self._require_auth_client()
        if not hasattr(client, "get_daily"):
            raise RuntimeError("当前客户端不支持查询每日签到日历")
        resp = client.get_daily()
        raw = resp.res_data if isinstance(getattr(resp, "res_data", None), dict) else None
        if raw is None and hasattr(resp, "json"):
            try:
                parsed = resp.json()
                raw = parsed if isinstance(parsed, dict) else {}
            except Exception:
                raw = {}
        raw = raw or {}

        days: List[Dict[str, Any]] = []
        if isinstance(raw.get("record"), list):
            for week in raw["record"]:
                if not isinstance(week, list):
                    continue
                for cell in week:
                    if not isinstance(cell, dict):
                        continue
                    label = str(cell.get("date") or "").strip()
                    if not label:
                        continue
                    days.append(
                        {
                            "day": _safe_int(label, 0),
                            "label": label,
                            "signed": cell.get("signed"),
                            "bonus": bool(cell.get("bonus")),
                        }
                    )
            signed_count = sum(1 for d in days if d["signed"] is True)
            return {
                "daily_id": str(raw.get("daily_id") or ""),
                "event_name": str(raw.get("event_name") or "每日签到"),
                "progress_text": str(raw.get("currentProgress") or ""),
                "streak_days": signed_count,
                "checked_in_today": False,
                "rewards": {
                    "three_days_coin": str(raw.get("three_days_coin") or ""),
                    "three_days_exp": str(raw.get("three_days_exp") or ""),
                    "seven_days_coin": str(raw.get("seven_days_coin") or ""),
                    "seven_days_exp": str(raw.get("seven_days_exp") or ""),
                },
                "days": days,
            }

        signed_set = {_safe_int(x, 0) for x in (raw.get("dateArray") or []) if _safe_int(x, 0) > 0}
        miss_set = {_safe_int(x, 0) for x in (raw.get("dateMiss") or []) if _safe_int(x, 0) > 0}
        event_set = set()
        for dt_str in raw.get("dateEvent") or []:
            text = str(dt_str or "").strip()
            if len(text) >= 10 and text[8:10].isdigit():
                event_set.add(_safe_int(text[8:10], 0))
        all_nums = sorted(signed_set | miss_set | event_set)
        for num in all_nums:
            signed_val: Optional[bool] = True if num in signed_set else (False if num in miss_set else None)
            days.append(
                {
                    "day": num,
                    "label": f"{num:02d}",
                    "signed": signed_val,
                    "bonus": num in event_set,
                }
            )
        return {
            "daily_id": "",
            "event_name": "本月签到活动",
            "progress_text": "",
            "streak_days": _safe_int(raw.get("oldStep"), len(signed_set)),
            "checked_in_today": raw.get("error") == "finished",
            "rewards": {
                "three_days_coin": "",
                "three_days_exp": "",
                "seven_days_coin": "",
                "seven_days_exp": "",
            },
            "days": days,
        }

    def daily_checkin(self) -> Dict[str, Any]:
        client = self._require_auth_client()
        if not hasattr(client, "daily_checkin"):
            raise RuntimeError("当前协议通道不支持每日签到")
        res = client.daily_checkin()
        return {
            "code": int(getattr(res, "code", 0)),
            "msg": str(getattr(res, "msg", "")),
            "already_checked_in": int(getattr(res, "code", 0)) == 1,
        }

    def export_favorites_csv(self) -> str:
        client = self._require_auth_client()
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["folder_id", "folder_name", "album_id", "title", "author"])
        root = client.favorite_folder(page=1, username=self._username)
        folders = [("0", "全部")] + [(str(fid), str(fname)) for fid, fname in root.iter_folder_id_name()]
        for fid, fname in folders:
            for page_data in client.favorite_folder_gen(folder_id=fid, username=self._username):
                for aid, info in page_data.content:
                    writer.writerow([fid, fname, aid, info.get("name", ""), info.get("author", "")])
        return out.getvalue()

    def test_domains(self) -> Dict[str, Any]:
        api_client = self.get_api_client(prefer_auth=False)
        html_client = self.get_html_client(prefer_auth=False)
        return {
            "api_domains": list(api_client.get_domain_list()),
            "html_domains": list(html_client.get_domain_list()),
        }


jm_adapter = JMProtocolAdapter()
