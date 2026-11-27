from fastapi import APIRouter, Depends

from app.api.v2 import album, discovery, download, library, media, search, sync, system, user
from app.core.security import require_panel_access

api_v2_router = APIRouter(prefix="/api/v2")

# 仅系统健康检查与 PIN 解锁保持公开，其余业务与媒体代理接口统一接入可选 PIN 保护
api_v2_router.include_router(system.router)

protected_deps = [Depends(require_panel_access)]
api_v2_router.include_router(media.router, dependencies=protected_deps)
api_v2_router.include_router(discovery.router, dependencies=protected_deps)
api_v2_router.include_router(search.router, dependencies=protected_deps)
api_v2_router.include_router(album.router, dependencies=protected_deps)
api_v2_router.include_router(user.router, dependencies=protected_deps)
api_v2_router.include_router(download.router, dependencies=protected_deps)
api_v2_router.include_router(library.router, dependencies=protected_deps)
api_v2_router.include_router(sync.router, dependencies=protected_deps)
