from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import album, search, download, category, config, user

app = FastAPI(
    title="JMComic Web Panel",
    description="JMComic 漫画管理前端面板后端 API",
    version="1.0.0",
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


@app.get("/")
async def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/static/index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


def start():
    import uvicorn
    uvicorn.run("jmweb.main:app", host="127.0.0.1", port=8800, reload=True)


if __name__ == "__main__":
    start()