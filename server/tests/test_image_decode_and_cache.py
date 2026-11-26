import math
import time
from io import BytesIO
from pathlib import Path

from PIL import Image

from app.services.image_proxy import ImageDiskCache, decode_scrambled_image, detect_image_mime, fetch_cover_sync


def _scramble_for_test(img: Image.Image, num: int) -> bytes:
    """按禁漫服务端算法反向将正常图切割打乱，用于校验 decode_scrambled_image 还原度。"""
    w, h = img.size
    scrambled = Image.new("RGB", (w, h))
    over = h % num
    for i in range(num):
        move = math.floor(h / num)
        y_src = move * i + (0 if i == 0 else over)
        y_dst = h - (move * (i + 1)) - over
        if i == 0:
            move += over
        scrambled.paste(img.crop((0, y_src, w, y_src + move)), (0, y_dst, w, y_dst + move))
    buf = BytesIO()
    scrambled.save(buf, format="PNG")
    return buf.getvalue()


def test_decode_scrambled_image_restores_strip_order():
    # 构造上红下蓝渐变的垂直测试图，确保条带重排可被精确验证
    w, h = 40, 103  # 刻意使用不能被 6 整除的高度测试 remainder (over) 处理
    orig = Image.new("RGB", (w, h))
    for y in range(h):
        color = (255, 0, 0) if y < h // 2 else (0, 0, 255)
        for x in range(w):
            orig.putpixel((x, y), color)

    scrambled_bytes = _scramble_for_test(orig, num=6)
    restored_bytes = decode_scrambled_image(scrambled_bytes, num=6)
    restored = Image.open(BytesIO(restored_bytes)).convert("RGB")

    assert restored.size == (w, h)
    top_pixel = restored.getpixel((20, 5))
    bottom_pixel = restored.getpixel((20, h - 5))
    assert top_pixel[0] > 200 and top_pixel[2] < 50
    assert bottom_pixel[2] > 200 and bottom_pixel[0] < 50


def test_image_disk_cache_lru_eviction(tmp_path: Path):
    cache = ImageDiskCache(cache_dir=tmp_path, max_files=2, max_size_mb=10)
    cache.put("k1", b"a" * 100)
    time.sleep(0.02)
    cache.put("k2", b"b" * 100)
    time.sleep(0.02)
    # 访问 k1 刷新其 mtime，因此新增 k3 时应淘汰 k2
    assert cache.get("k1") == b"a" * 100
    time.sleep(0.02)
    cache.put("k3", b"c" * 100)

    assert cache.get("k1") == b"a" * 100
    assert cache.get("k2") is None
    assert cache.get("k3") == b"c" * 100


def test_fetch_cover_sync_without_resp_headers_and_detect_mime(tmp_path: Path, monkeypatch):
    from app.services import image_proxy
    from app.services.jm_adapter import jm_adapter

    test_cache = ImageDiskCache(cache_dir=tmp_path / "cache", max_files=10, max_size_mb=10)
    monkeypatch.setattr(image_proxy, "image_cache", test_cache)

    buf = BytesIO()
    Image.new("RGB", (24, 32), color=(180, 40, 80)).save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    class FakeJmImageResp:
        def __init__(self, data: bytes):
            self.content = data
            self.http_code = 200

        def require_success(self):
            return None

    class FakeClient:
        def get_jm_image(self, _url: str):
            return FakeJmImageResp(jpeg_bytes)

    monkeypatch.setattr(jm_adapter, "get_client", lambda *args, **kwargs: FakeClient())

    data, mime = fetch_cover_sync("422866", size="_3x4")
    assert data == jpeg_bytes
    assert mime == "image/jpeg"

    # 命中缓存后仍返回正确 MIME
    cached_data, cached_mime = fetch_cover_sync("422866", size="_3x4")
    assert cached_data == jpeg_bytes
    assert cached_mime == "image/jpeg"
    assert detect_image_mime(b"\x89PNG\r\n\x1a\nxxxx") == "image/png"
