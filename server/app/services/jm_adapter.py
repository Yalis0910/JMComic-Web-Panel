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
                    "coin": data.get("coin", 0),
                    "level": data.get("level", 1),
                    "level_name": data.get("level_name", ""),
                    "exp": data.get("exp", "0"),
                    "exp_percent": data.get("expPercent", 0),
                    "album_favorites": data.get("album_favorites", 0),
                    "album_favorites_max": data.get("album_favorites_max", 0),
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
        return {
            "categories": data.get("categories", []),
            "types": data.get("type", []),
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
        return {
            "categories": data.get("categories", []),
            "blocks": data.get("blocks", []),
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
        # 副分类筛选仅网页端支持，若传入 sub_category 自动使用 HTML 客户端
        client = self.get_html_client() if sub_category else self.get_client()
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
        # 分类/副分类过滤仅 HTML 客户端支持，否则优先用当前默认客户端
        use_html = (category not in ("0", "ALL", "")) or bool(sub_category)
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
        client.add_favorite_album(album_id=album_id, folder_id=folder_id)

    def remove_favorite(self, album_id: str) -> None:
        client = self._require_auth_client()
        if hasattr(client, "delete_favorite_album"):
            client.delete_favorite_album(album_id=album_id)
        else:
            client.remove_favorite_album(album_id=album_id)

    def daily_checkin(self) -> Dict[str, Any]:
        client = self._require_auth_client()
        if not hasattr(client, "daily_checkin"):
            raise RuntimeError("当前协议通道不支持每日签到，请切换至 APP 端通道")
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
