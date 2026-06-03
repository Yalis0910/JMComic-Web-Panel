from fastapi import APIRouter, HTTPException, Query
from jmcomic import JmOption, JmcomicText

router = APIRouter(tags=["search"])


def _get_client():
    return JmOption.default().new_jm_client()


def _format_search_result(page):
    albums = []
    for aid, info in page.content:
        albums.append({
            "album_id": aid,
            "title": info.get("name", ""),
            "tags": info.get("tags", []),
            "cover_url": JmcomicText.get_album_cover_url(aid),
        })
    return {
        "albums": albums,
        "total": page.total,
        "page_count": page.page_count,
        "page_size": page.page_size,
    }


@router.get("/search")
async def search_album(
    q: str = Query(..., description="搜索关键词"),
    page: int = Query(1, ge=1),
    order_by: str = Query("mr", description="排序: mr/mv/mp/tf"),
    time: str = Query("a", description="时间: a/t/w/m"),
    category: str = Query("0", description="分类: 0/doujin/single/..."),
):
    try:
        client = _get_client()
        result = client.search_site(search_query=q, page=page, order_by=order_by, time=time, category=category)
        return {
            "code": 0,
            "data": _format_search_result(result),
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/author")
async def search_author(
    q: str = Query(...),
    page: int = Query(1, ge=1),
    order_by: str = Query("mr", description="排序: mr/mv/mp/tf"),
    time: str = Query("a", description="时间: a/t/w/m"),
    category: str = Query("0", description="分类: 0/doujin/single/..."),
):
    try:
        client = _get_client()
        result = client.search_author(search_query=q, page=page, order_by=order_by, time=time, category=category)
        return {"code": 0, "data": _format_search_result(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/tag")
async def search_tag(
    q: str = Query(...),
    page: int = Query(1, ge=1),
    order_by: str = Query("mr", description="排序: mr/mv/mp/tf"),
    time: str = Query("a", description="时间: a/t/w/m"),
    category: str = Query("0", description="分类: 0/doujin/single/..."),
):
    try:
        client = _get_client()
        result = client.search_tag(search_query=q, page=page, order_by=order_by, time=time, category=category)
        return {"code": 0, "data": _format_search_result(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))