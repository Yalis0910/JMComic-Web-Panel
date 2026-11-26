import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v2.router import api_v2_router
from app.core.config import REPO_ROOT, config_manager
from app.db.database import db
from app.services.download_service import download_manager
from app.services.library_service import library_service

WEB_DIST_DIR = REPO_ROOT / "web" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config_manager.get_settings()
    config_manager.ensure_option_file()
    await db.init()
    await download_manager.startup()
    await library_service.scan()
    yield


app = FastAPI(
    title="JMlis Server",
    description="JMlis 本地/局域网统一服务端 API v2",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v2_router)


@app.get("/health")
async def legacy_health():
    return {"status": "ok", "version": "2.0.0"}


if WEB_DIST_DIR.exists() and (WEB_DIST_DIR / "index.html").exists():
    assets_dir = WEB_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="web-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (WEB_DIST_DIR / full_path).resolve()
        if full_path and candidate.is_file() and WEB_DIST_DIR in candidate.parents:
            return FileResponse(str(candidate))
        return FileResponse(str(WEB_DIST_DIR / "index.html"))
else:
    @app.get("/")
    async def root_info():
        return {
            "service": "JMlis Server",
            "version": "2.0.0",
            "docs": "/docs",
            "note": "Web 前端尚未构建，请运行 `cd web && npm run build` 或使用 Vite 开发服务器。",
        }


def start():
    import uvicorn

    settings = config_manager.get_settings()
    dev = os.environ.get("JM_DEV", "0") == "1"
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=dev,
    )


if __name__ == "__main__":
    start()
