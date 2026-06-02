from fastapi import APIRouter, HTTPException, Query, Body
from jmcomic import JmOption
from jmweb.utils.session import session

router = APIRouter(tags=["user"])


def _is_session_expired(error: Exception) -> bool:
    error_str = str(error)
    return "401" in error_str or "請先登入" in error_str or "未登录" in error_str


def _handle_session_expired():
    if session.refresh_session():
        return session.get_client()
    session.clear_session()
    raise HTTPException(status_code=401, detail="登录已过期，请重新登录")


def _format_favorites(page):
    albums = []
    for aid, info in page.content:
        albums.append({
            "album_id": aid,
            "title": info.get("name", ""),
            "tags": info.get("tags", []),
        })

    folders = [
        {"folder_id": fid, "name": fname}
        for fid, fname in page.iter_folder_id_name()
    ]

    return {
        "albums": albums,
        "folders": folders,
        "total": page.total,
        "page_count": page.page_count,
    }


@router.post("/user/login")
async def login(
    username: str = Body(...),
    password: str = Body(...),
    impl: str = Body("html"),
):
    try:
        session.login(username=username, password=password, impl=impl)
        return {"code": 0, "data": session.get_status(), "message": "登录成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"登录失败: {e}")


@router.post("/user/logout")
async def logout():
    session.logout()
    return {"code": 0, "data": None, "message": "已登出"}


@router.get("/user/status")
async def get_login_status():
    return {"code": 0, "data": session.get_status(), "message": "success"}


@router.get("/user/favorites")
async def get_favorites(
    page: int = Query(1, ge=1),
    folder_id: str = Query("0"),
    username: str = Query(""),
):
    client = session.get_client()
    if client is None:
        raise HTTPException(status_code=401, detail="未登录，请先登录")

    try:
        kw = {"username": username} if username else {}
        if session.username:
            kw.setdefault("username", session.username)

        result = client.favorite_folder(page=page, folder_id=folder_id, **kw)
        return {"code": 0, "data": _format_favorites(result), "message": "success"}
    except HTTPException:
        raise
    except Exception as e:
        if _is_session_expired(e):
            client = _handle_session_expired()
            kw = {"username": username} if username else {}
            if session.username:
                kw.setdefault("username", session.username)
            result = client.favorite_folder(page=page, folder_id=folder_id, **kw)
            return {"code": 0, "data": _format_favorites(result), "message": "success"}
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/favorites/{album_id}")
async def add_favorite(
    album_id: str,
    folder_id: str = Body("0"),
):
    client = session.get_client()
    if client is None:
        raise HTTPException(status_code=401, detail="未登录，请先登录")

    try:
        client.add_favorite_album(album_id=album_id, folder_id=folder_id)
        return {"code": 0, "data": None, "message": "已添加到收藏"}
    except HTTPException:
        raise
    except Exception as e:
        if _is_session_expired(e):
            client = _handle_session_expired()
            client.add_favorite_album(album_id=album_id, folder_id=folder_id)
            return {"code": 0, "data": None, "message": "已添加到收藏"}
        raise HTTPException(status_code=500, detail=str(e))