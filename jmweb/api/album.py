from fastapi import APIRouter, HTTPException
from jmcomic import JmOption

router = APIRouter(tags=["album"])


def _get_client():
    option = JmOption.default()
    return option.new_jm_client()


@router.get("/album/{album_id}")
async def get_album_detail(album_id: str):
    try:
        client = _get_client()
        album = client.get_album_detail(album_id)

        episodes = []
        for pid, pindex, pname in album.episode_list:
            episodes.append({
                "photo_id": pid,
                "index": int(pindex),
                "name": pname.strip(),
            })

        from jmcomic import JmcomicText
        cover_url = JmcomicText.get_album_cover_url(album.album_id)

        return {
            "code": 0,
            "data": {
                "album_id": album.album_id,
                "title": album.name,
                "authors": album.authors,
                "tags": album.tags,
                "actors": album.actors,
                "works": album.works,
                "description": album.description,
                "page_count": album.page_count,
                "views": album.views,
                "likes": album.likes,
                "comment_count": album.comment_count,
                "pub_date": album.pub_date,
                "update_date": album.update_date,
                "episodes": episodes,
                "cover_url": cover_url,
            },
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/photo/{photo_id}")
async def get_photo_detail(photo_id: str):
    try:
        client = _get_client()
        photo = client.get_photo_detail(photo_id, fetch_album=False)

        images = []
        for i in range(len(photo)):
            img = photo.getindex(i)
            images.append({
                "index": img.index,
                "url": img.download_url,
                "filename": img.filename,
            })

        return {
            "code": 0,
            "data": {
                "photo_id": photo.photo_id,
                "name": photo.name,
                "sort": photo.sort,
                "image_count": len(photo),
                "images": images,
            },
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))