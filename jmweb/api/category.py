from fastapi import APIRouter, HTTPException, Query
from jmcomic import JmOption

router = APIRouter(tags=["category"])


def _get_client():
    return JmOption.default().new_jm_client()


def _format_page(page):
    albums = []
    for aid, info in page.content:
        albums.append({
            "album_id": aid,
            "title": info.get("name", ""),
            "tags": info.get("tags", []),
        })
    return {
        "albums": albums,
        "total": page.total,
        "page_count": page.page_count,
        "page_size": page.page_size,
    }


@router.get("/ranking/{ranking_type}")
async def get_ranking(
    ranking_type: str,
    page: int = Query(1, ge=1),
    category: str = Query("ALL", description="分类"),
):
    try:
        client = _get_client()

        if ranking_type == "day":
            result = client.day_ranking(page=page, category=category)
        elif ranking_type == "week":
            result = client.week_ranking(page=page, category=category)
        elif ranking_type == "month":
            result = client.month_ranking(page=page, category=category)
        else:
            raise HTTPException(status_code=400, detail=f"不支持的排行类型: {ranking_type}")

        return {"code": 0, "data": _format_page(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category")
async def get_category(
    page: int = Query(1, ge=1),
    time: str = Query("ALL"),
    order_by: str = Query("view"),
    category: str = Query("ALL"),
):
    try:
        client = _get_client()
        result = client.categories_filter(
            page=page, time=time, category=category, order_by=order_by
        )
        return {"code": 0, "data": _format_page(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))