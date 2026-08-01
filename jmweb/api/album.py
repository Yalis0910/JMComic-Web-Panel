import math
import re
from io import BytesIO

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from jmcomic import JmcomicClient, JmcomicText
from jmcomic.jm_toolkit import JmImageTool
from PIL import Image

from jmweb.api.deps import get_client
from jmweb.utils.cache import image_cache

router = APIRouter(tags=["album"])


def _parse_photo_id_from_url(url: str) -> str:
    m = re.search(r'/media/photos/(\d+)/', url)
    return m.group(1) if m else None


_cache_headers = {"Cache-Control": "public, max-age=1209600"}


def _decode_image(content: bytes, num: int) -> bytes:
    """将打乱的条带重新拼回正确顺序，返回 WEBP 字节。"""
    img = Image.open(BytesIO(content))
    w, h = img.size

    img_decode = Image.new("RGB", (w, h))
    over = h % num
    for i in range(num):
        move = math.floor(h / num)
        y_src = h - (move * (i + 1)) - over
        y_dst = move * i
        if i == 0:
            move += over
        else:
            y_dst += over
        img_decode.paste(
            img.crop((0, y_src, w, y_src + move)),
            (0, y_dst, w, y_dst + move),
        )

    buf = BytesIO()
    img_decode.save(buf, format="WEBP")
    return buf.getvalue()


@router.get("/image/proxy")
async def proxy_image(url: str = Query(...)):
    try:
        photo_id = _parse_photo_id_from_url(url)
        if not photo_id:
            raise HTTPException(status_code=400, detail="无法从URL中解析photo_id")

        client = get_client()

        # 获取该photo的scramble_id（内部有缓存，不会重复请求）
        scramble_id = client.get_scramble_id(photo_id)

        # 缓存 key 必须包含 scramble_id：图片打乱方式变化时缓存自动失效
        cache_key = f"{url}|{scramble_id}"
        cached = image_cache.get(cache_key)
        if cached is not None:
            return Response(content=cached, media_type="image/webp", headers=_cache_headers)

        # 请求原始图片（使用jmcomic的client，自动处理headers和防盗链）
        resp = client.get_jm_image(url)
        resp.require_success()

        # 计算图片分割数
        num = JmImageTool.get_num_by_url(scramble_id, url)

        # 无需解密的情况（num==0 或 .gif 图片）
        if num == 0 or JmcomicClient.img_is_not_need_to_decode(url, resp):
            content_type = resp.headers.get("content-type", "image/webp")
            image_cache.put(cache_key, resp.content)
            return Response(content=resp.content, media_type=content_type, headers=_cache_headers)

        # 解密图片并缓存
        decoded = _decode_image(resp.content, num)
        image_cache.put(cache_key, decoded)
        return Response(content=decoded, media_type="image/webp", headers=_cache_headers)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片加载失败: {str(e)}")


@router.get("/album/{album_id}")
async def get_album_detail(album_id: str):
    try:
        client = get_client()
        album = client.get_album_detail(album_id)

        episodes = []
        for pid, pindex, pname in album.episode_list:
            episodes.append({
                "photo_id": pid,
                "index": int(pindex),
                "name": pname.strip(),
            })

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
                "is_favorite": getattr(album, 'is_favorite', False),
            },
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/photo/{photo_id}")
async def get_photo_detail(photo_id: str):
    try:
        client = get_client()
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
