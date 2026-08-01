import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .api import album, search, download, category, config, user

app = FastAPI(
    title="JMComic Web Panel",
    description="JMComic 漫画管理前端面板后端 API",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="jmweb/static"), name="static")

app.include_router(album.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(download.router, prefix="/api/v1")
app.include_router(category.router, prefix="/api/v1")
app.include_router(config.router, prefix="/api/v1")
app.include_router(user.router, prefix="/api/v1")


@app.middleware("http")
async def static_cache_header(request, call_next):
    """静态资源与图片代理添加浏览器缓存控制头。"""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/static/"):
        if path.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        elif path.endswith(".css") or path.endswith(".js"):
            response.headers["Cache-Control"] = "public, max-age=600"
        else:
            response.headers["Cache-Control"] = "public, max-age=86400"
    elif path.startswith("/api/v1/image/proxy"):
        response.headers["Cache-Control"] = "public, max-age=1209600"
    return response


@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.1.0"}


def start():
    import uvicorn

    # 应用 Web 面板配置（图片缓存目录/上限），预热共享客户端，避免首个请求慢
    from jmweb.utils import web_config
    from jmweb.api.deps import get_client
    try:
        web_config.apply_web_config()
    except Exception:
        pass
    try:
        get_client()
    except Exception:
        pass

    dev = os.environ.get("JM_DEV", "0") == "1"
    uvicorn.run(
        "jmweb.main:app",
        host="0.0.0.0",
        port=8800,
        reload=dev,
    )


if __name__ == "__main__":
    start()
