import importlib
import os
import zipfile
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image


def _make_png_bytes(color=(10, 120, 220)) -> bytes:
    img = Image.new("RGB", (32, 32), color=color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_api_v2_end_to_end(tmp_path: Path, monkeypatch):
    from app.core.config import config_manager
    from app.services.jm_adapter import jm_adapter
    import app.main as main_mod

    config_manager.configure_data_dir(tmp_path / "data")

    # 在下载目录造一本文件夹漫画与一本 ZIP 漫画
    dl_dir = Path(config_manager.get_settings().download_dir)
    folder_comic = dl_dir / "[Test] Demo Comic 123456"
    (folder_comic / "01_第一话").mkdir(parents=True, exist_ok=True)
    (folder_comic / "01_第一话" / "001.png").write_bytes(_make_png_bytes((255, 0, 0)))
    (folder_comic / "01_第一话" / "002.png").write_bytes(_make_png_bytes((0, 255, 0)))

    zip_path = dl_dir / "Archive_654321.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("001.png", _make_png_bytes((0, 0, 255)))

    monkeypatch.setattr(
        jm_adapter,
        "get_promote",
        lambda page=1: {
            "sections": [
                {
                    "id": "1",
                    "title": "本周精选",
                    "slug": "weekly",
                    "type": "album",
                    "albums": [
                        {
                            "album_id": "123456",
                            "title": "Demo Title",
                            "author": "Tester",
                            "tags": ["全彩"],
                            "category": "同人",
                            "cover_url": "/api/v2/media/cover/123456",
                        }
                    ],
                }
            ]
        },
    )
    monkeypatch.setattr(
        jm_adapter,
        "get_comments",
        lambda album_id, page=1: {
            "comments": [
                {
                    "cid": "99",
                    "username": "reader",
                    "level": 3,
                    "level_name": "绅士",
                    "content": "画风很棒",
                    "likes": "12",
                    "addtime": "2026-01-01",
                    "spoiler": False,
                    "replies": [],
                }
            ],
            "total": 1,
            "page": page,
        },
    )

    with TestClient(main_mod.app) as client:
        # 1. 健康检查
        r = client.get("/api/v2/system/health")
        assert r.status_code == 200
        assert r.json()["data"]["status"] == "ok"

        # 2. 发现页与评论接口
        r_promote = client.get("/api/v2/discovery/promote")
        assert r_promote.status_code == 200
        assert r_promote.json()["data"]["sections"][0]["albums"][0]["album_id"] == "123456"

        r_comments = client.get("/api/v2/album/123456/comments")
        assert r_comments.status_code == 200
        assert r_comments.json()["data"]["comments"][0]["content"] == "画风很棒"

        # 3. 本地书库扫描与阅读
        r_lib = client.get("/api/v2/library")
        assert r_lib.status_code == 200
        ids = {item["album_id"] for item in r_lib.json()["data"]}
        assert "123456" in ids and "654321" in ids

        r_detail = client.get("/api/v2/library/123456")
        assert r_detail.status_code == 200
        assert r_detail.json()["data"]["chapters"][0]["page_count"] == 2

        r_page = client.get("/api/v2/library/123456/page/1/0")
        assert r_page.status_code == 200
        assert r_page.headers["content-type"].startswith("image/png")

        r_zip_page = client.get("/api/v2/library/654321/page/1/0")
        assert r_zip_page.status_code == 200

        # 4. 跨端阅读进度同步 (LWW)
        r_sync = client.post(
            "/api/v2/sync/history/merge",
            json={
                "since_ms": 0,
                "items": [
                    {
                        "album_id": "123456",
                        "photo_id": "123456",
                        "title": "Demo",
                        "page_index": 5,
                        "total_pages": 20,
                        "updated_at": 2000,
                    }
                ],
            },
        )
        assert r_sync.status_code == 200
        assert r_sync.json()["data"]["items"][0]["page_index"] == 5

        # 用旧时间戳覆盖应该被忽略，保留较新的 page_index=5
        r_sync_old = client.post(
            "/api/v2/sync/history/merge",
            json={
                "since_ms": 0,
                "items": [
                    {
                        "album_id": "123456",
                        "photo_id": "123456",
                        "title": "Demo",
                        "page_index": 1,
                        "total_pages": 20,
                        "updated_at": 1000,
                    }
                ],
            },
        )
        assert r_sync_old.status_code == 200
        assert r_sync_old.json()["data"]["items"][0]["page_index"] == 5

        # 5. 开启 PIN 锁保护验证
        r_pin = client.post("/api/v2/system/pin", json={"enabled": True, "pin": "1234"})
        assert r_pin.status_code == 200
        assert client.get("/api/v2/library").status_code == 401

        r_unlock = client.post("/api/v2/system/unlock", json={"pin": "1234"})
        assert r_unlock.status_code == 200
        token = r_unlock.json()["data"]["token"]
        assert client.get("/api/v2/library", headers={"X-Panel-Token": token}).status_code == 200


def test_clean_html_text_strips_tags_and_entities():
    from app.services.jm_adapter import clean_html_text

    raw = "<div style='flex-direction:row;flex-wrap:wrap;'>畫風很棒<br/>第二行&nbsp;&amp;&nbsp;&#39;測試&#39;</div>"
    assert clean_html_text(raw) == "畫風很棒\n第二行 & '測試'"
    assert clean_html_text("<p>第一段</p><p>第二段</p>") == "第一段\n第二段"
    assert clean_html_text(None) == ""


def test_week_categories_fallback_labels(monkeypatch):
    from types import SimpleNamespace
    from app.services.jm_adapter import jm_adapter

    fake_resp = SimpleNamespace(
        res_data={
            "categories": [
                {"id": "267", "title": "", "time": "2026第266期11.20 - 11.13"},
                {"id": "56", "title": "精选专题", "time": "2022第55期"},
            ],
            "type": [
                {"id": "manga", "title": "日漫"},
                {"id": "hanman", "title": ""},
            ],
        }
    )
    fake_client = SimpleNamespace(req_api=lambda *a, **kw: fake_resp)
    monkeypatch.setattr(jm_adapter, "get_api_client", lambda prefer_auth=True: fake_client)

    res = jm_adapter.get_week_categories()
    assert res["categories"][0]["title"] == "2026第266期11.20 - 11.13"
    assert res["categories"][1]["title"] == "2022第55期 · 精选专题"
    assert res["types"][1]["title"] == "韩漫"


def test_extended_discovery_and_daily_apis(tmp_path: Path, monkeypatch):
    from types import SimpleNamespace
    from fastapi.testclient import TestClient
    from app.core.config import config_manager
    from app.services.jm_adapter import jm_adapter
    import app.main as main_mod

    config_manager.configure_data_dir(tmp_path / "data")

    calls = []

    class FakePage:
        content = [("555", {"name": "Rank Item", "author": ["A"], "tags": ["全彩"]})]
        total = 1
        page_count = 1
        page_size = 20

    class FakeClient:
        def categories_filter(self, page, time, category, order_by, sub_category=None):
            calls.append(("filter", page, time, category, order_by, sub_category))
            return FakePage()

        def forum_pagination(self, page=1):
            comment = SimpleNamespace(
                comment_id="88",
                album_id="555",
                username="tester",
                nickname="tester",
                content="<div>好看<br/>推荐</div>",
                likes=5,
                created_at="2026-11-20",
                is_spoiler=False,
                replies=[],
                raw_data={"AID": "555", "expinfo": {"level": 2, "level_name": "骑士"}},
            )
            return SimpleNamespace(content=[comment], total=1, page_count=1)

        def get_daily(self):
            return SimpleNamespace(
                res_data={
                    "daily_id": 72,
                    "event_name": "11月签到",
                    "currentProgress": "25%",
                    "three_days_coin": "150",
                    "three_days_exp": "150",
                    "seven_days_coin": "350",
                    "seven_days_exp": "350",
                    "record": [
                        [{"date": "01", "signed": True, "bonus": False}, {"date": "02", "signed": None, "bonus": True}]
                    ],
                }
            )

    fake_api = SimpleNamespace(
        req_api=lambda path, **kw: SimpleNamespace(
            res_data={
                "categories": [
                    {"id": "0", "name": "全部", "slug": ""},
                    {"id": "7", "name": "Cosplay", "slug": "another_cosplay", "type": "search"},
                    {"id": "8", "name": "3D", "slug": "3D", "type": "search"},
                ],
                "blocks": [{"title": "热门", "content": ["全彩", "无修正"]}],
            }
        )
    )
    fake_client = FakeClient()
    html_calls = []

    class FakeHtmlClient(FakeClient):
        def categories_filter(self, page, time, category, order_by, sub_category=None):
            html_calls.append((page, time, category, order_by, sub_category))
            return FakePage()

    monkeypatch.setattr(jm_adapter, "get_client", lambda impl=None, prefer_auth=True: fake_client)
    monkeypatch.setattr(jm_adapter, "get_html_client", lambda prefer_auth=True: FakeHtmlClient())
    monkeypatch.setattr(jm_adapter, "get_api_client", lambda prefer_auth=True: fake_api)
    monkeypatch.setattr(jm_adapter, "_require_auth_client", lambda: fake_client)

    with TestClient(main_mod.app) as client:
        r_all = client.get("/api/v2/discovery/ranking/all?category=english_site")
        assert r_all.status_code == 200
        assert calls[-1] == ("filter", 1, "a", "english_site", "mv", None)

        r_likes = client.get("/api/v2/discovery/ranking/likes")
        assert r_likes.status_code == 200
        assert calls[-1] == ("filter", 1, "a", "0", "tf", None)

        r_tr = client.get("/api/v2/discovery/filter?order_by=tr&category=doujin&sub_category=CG")
        assert r_tr.status_code == 200
        assert html_calls[-1] == (1, "a", "doujin", "tr", "CG")

        r_cats = client.get("/api/v2/discovery/categories")
        assert r_cats.status_code == 200
        cats_data = r_cats.json()["data"]
        assert "doujin" in cats_data["sub_categories"]
        assert all(c.get("type") != "search" for c in cats_data["categories"])

        r_3d = client.get("/api/v2/discovery/ranking/all?category=3D")
        assert r_3d.status_code == 200
        assert html_calls[-1] == (1, "a", "another", "mv", "3d")

        r_forum = client.get("/api/v2/discovery/forum?page=1")
        assert r_forum.status_code == 200
        assert r_forum.json()["data"]["comments"][0]["album_id"] == "555"
        assert r_forum.json()["data"]["comments"][0]["content"] == "好看\n推荐"

        r_daily = client.get("/api/v2/user/daily")
        assert r_daily.status_code == 200
        daily_data = r_daily.json()["data"]
        assert daily_data["event_name"] == "11月签到"
        assert len(daily_data["days"]) == 2
        assert daily_data["days"][0]["signed"] is True
        assert daily_data["days"][1]["bonus"] is True
