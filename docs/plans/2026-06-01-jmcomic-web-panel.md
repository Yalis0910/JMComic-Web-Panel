# JMComic Web 前端面板 — 实现方案

> **For agentic workers:** 本文档为完整实现方案，描述了将 JMComic-Crawler-Python 命令行工具升级为 Web 可视化面板的全部步骤。

**目标：** 为 JMComic-Crawler-Python 开发一个本地 Web 前端面板，用户可以通过浏览器直观地搜索、查看、下载和管理漫画

**架构：** 后端使用 FastAPI 封装 jmcomic 的全部公开 API 为 REST 接口；前端使用纯 HTML/CSS/JS（无框架依赖，轻量启动）或 React（功能丰富），提供搜索、详情查看、下载管理、配置等界面

**Tech Stack：** Python 3.9+ / FastAPI / uvicorn / jmcomic / HTML5 + CSS3 + Vanilla JS (或 React)

---

## 目录结构规划

```
e:\Yang\JM\JMComic-Crawler-Python\
├── jmweb/                          # Web 面板根目录
│   ├── __init__.py
│   ├── main.py                     # FastAPI 应用入口 + 启动脚本
│   ├── api/
│   │   ├── __init__.py
│   │   ├── album.py                # 本子相关 API
│   │   ├── search.py               # 搜索相关 API
│   │   ├── download.py             # 下载相关 API
│   │   ├── category.py             # 分类/排行 API
│   │   ├── config.py               # 配置管理 API
│   │   └── user.py                 # 用户/收藏 API
│   ├── static/                     # 前端静态文件
│   │   ├── index.html              # 主页面
│   │   ├── css/
│   │   │   └── style.css           # 全局样式
│   │   └── js/
│   │       ├── app.js              # 主应用逻辑
│   │       ├── api.js              # API 请求封装
│   │       └── components.js       # UI 组件
│   └── utils/
│       ├── __init__.py
│       └── progress.py             # 下载进度管理
└── docs/
    └── plans/
        └── 2026-06-01-jmcomic-web-panel.md  # 本文档
```

---

## 功能模块概览

| 模块 | 核心功能 | 对应 jmcomic API |
|------|---------|-----------------|
| **搜索** | 关键词搜索、按作者/标签/作品过滤 | `client.search()`, `client.search_site()`, `client.search_author()`, `client.search_tag()` |
| **排行** | 日/周/月排行榜、分类浏览 | `client.day_ranking()`, `client.week_ranking()`, `client.month_ranking()`, `client.categories_filter()` |
| **本子详情** | 展示封面、标题、作者、标签、章节列表 | `client.get_album_detail()` |
| **下载管理** | 一键下载、批量下载、进度展示 | `download_album()`, `download_photo()`, `Feature.export_pdf/zip` |
| **配置管理** | option.yml 可视化编辑、客户端切换 | `JmOption.from_file()`, `JmOption.default()` |
| **收藏管理** | 登录、查看收藏、添加收藏 | `client.login()`, `client.favorite_folder()`, `client.add_favorite_album()` |
| **本地浏览** | 查看已下载的漫画 | 本地文件系统扫描 |

---

## 后端 API 设计

### 通用约定

- 所有接口前缀: `/api/v1`
- 响应格式: `{"code": 0, "data": {...}, "message": "success"}`
- 错误格式: `{"code": -1, "data": null, "message": "错误描述"}`

### API 端点列表

```
GET    /api/v1/album/{album_id}                  # 获取本子详情
GET    /api/v1/search?q={query}&page={page}      # 搜索本子
GET    /api/v1/search/author?q={query}&page={p}  # 按作者搜索
GET    /api/v1/search/tag?q={query}&page={p}     # 按标签搜索
GET    /api/v1/ranking/{type}?page={page}        # 排行 (day/week/month)
GET    /api/v1/category?time=&category=&page=    # 分类筛选
GET    /api/v1/photo/{photo_id}                  # 获取章节详情

POST   /api/v1/download/album                    # 下载本子
POST   /api/v1/download/photo                    # 下载章节
POST   /api/v1/download/batch                    # 批量下载
GET    /api/v1/download/status/{task_id}         # 查询下载进度
POST   /api/v1/download/cancel/{task_id}         # 取消下载

GET    /api/v1/config                            # 获取当前配置
PUT    /api/v1/config                            # 更新配置
POST   /api/v1/config/load                       # 加载配置文件

POST   /api/v1/user/login                        # 登录
GET    /api/v1/user/favorites?page={page}&folder=  # 获取收藏
POST   /api/v1/user/favorites/{album_id}         # 添加收藏

GET    /api/v1/local/albums                      # 获取已下载的本子列表
GET    /api/v1/local/album/{album_id}            # 获取已下载本子的章节
GET    /api/v1/local/photo/{photo_id}/{page}     # 获取已下载的图片
```

---

## 前端页面布局

```
┌──────────────────────────────────────────────┐
│  [Logo] JMComic 管理面板    [搜索框 🔍]     │ ← 顶栏
├──────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────────────────────┐  │
│  │ 📊 仪表盘 │  │                          │  │
│  │ 🔍 搜索   │  │    主内容区域             │  │
│  │ 🏆 排行   │  │    (根据导航切换)         │  │
│  │ 📥 下载管理│  │                          │  │
│  │ 📁 本地库  │  │                          │  │
│  │ ⚙️ 设置   │  │                          │  │
│  └──────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 分步实现计划

---

### Task 1: 项目结构搭建 & FastAPI 后端骨架

**Files:**
- Create: `jmweb/__init__.py`
- Create: `jmweb/main.py`
- Create: `jmweb/api/__init__.py`
- Create: `jmweb/utils/__init__.py`
- Modify: `pyproject.toml` (添加 fastapi/uvicorn 依赖)

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p jmweb/api jmweb/utils jmweb/static/css jmweb/static/js
```

- [ ] **Step 2: 创建 FastAPI 入口文件**

```python
# jmweb/__init__.py
```

```python
# jmweb/main.py
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
```

```python
# jmweb/api/__init__.py
from fastapi import APIRouter

router = APIRouter()
```

```python
# jmweb/utils/__init__.py
```

- [ ] **Step 3: 添加 pyproject.toml 启动脚本**

```
[project.scripts]
jmcomic = "jmcomic.cl:main"
jmv = "jmcomic.cl:view_main"
jmweb = "jmweb.main:start"        # 新增：启动 Web 面板
```

- [ ] **Step 4: 验证服务能启动**

```bash
cd e:\Yang\JM\JMComic-Crawler-Python
pip install fastapi uvicorn
python -c "from jmweb.main import app; print('FastAPI app loaded successfully')"
```

---

### Task 2: 本子详情 API

**Files:**
- Create: `jmweb/api/album.py`

- [ ] **Step 1: 实现 get_album_detail 端点**

```python
# jmweb/api/album.py
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
                "cover_url": f"https://cdn-msp2.18comic.vip/media/albums/{album_id}_0.jpg",
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
```

- [ ] **Step 2: 验证 API**

启动服务后访问 `http://127.0.0.1:8800/api/v1/album/350234` 测试

---

### Task 3: 搜索 API

**Files:**
- Create: `jmweb/api/search.py`

- [ ] **Step 1: 实现搜索端点**

```python
# jmweb/api/search.py
from fastapi import APIRouter, HTTPException, Query
from jmcomic import JmOption

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
    order_by: str = Query("latest", description="排序: latest/view/like"),
):
    try:
        client = _get_client()
        result = client.search_site(search_query=q, page=page, order_by=order_by)
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
):
    try:
        client = _get_client()
        result = client.search_author(search_query=q, page=page)
        return {"code": 0, "data": _format_search_result(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/tag")
async def search_tag(
    q: str = Query(...),
    page: int = Query(1, ge=1),
):
    try:
        client = _get_client()
        result = client.search_tag(search_query=q, page=page)
        return {"code": 0, "data": _format_search_result(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Task 4: 分类/排行 API

**Files:**
- Create: `jmweb/api/category.py`

- [ ] **Step 1: 实现排行和分类端点**

```python
# jmweb/api/category.py
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
```

---

### Task 5: 下载功能 API

**Files:**
- Create: `jmweb/api/download.py`
- Create: `jmweb/utils/progress.py`

- [ ] **Step 1: 下载进度管理器**

```python
# jmweb/utils/progress.py
import threading
import time
from typing import Dict, Optional
from dataclasses import dataclass, field


@dataclass
class DownloadTask:
    task_id: str
    album_id: str
    title: str = ""
    status: str = "pending"  # pending / running / completed / failed / cancelled
    progress: int = 0  # 0-100
    total_count: int = 0
    completed_count: int = 0
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    thread: Optional[threading.Thread] = None


class DownloadManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._tasks: Dict[str, DownloadTask] = {}
                cls._instance._task_lock = threading.Lock()
            return cls._instance

    def create_task(self, album_id: str) -> DownloadTask:
        import uuid
        task_id = uuid.uuid4().hex[:12]
        task = DownloadTask(task_id=task_id, album_id=album_id)
        with self._task_lock:
            self._tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        with self._task_lock:
            return self._tasks.get(task_id)

    def get_all_tasks(self) -> list:
        with self._task_lock:
            return [vars(t) for t in self._tasks.values()]

    def update_progress(self, task_id: str, completed: int, total: int):
        task = self.get_task(task_id)
        if task:
            task.completed_count = completed
            task.total_count = total
            task.progress = int(completed / total * 100) if total > 0 else 0

    def complete_task(self, task_id: str, error: Optional[str] = None):
        task = self.get_task(task_id)
        if task:
            task.status = "failed" if error else "completed"
            task.error = error
            task.progress = 100 if not error else task.progress

    def cancel_task(self, task_id: str):
        task = self.get_task(task_id)
        if task:
            task.status = "cancelled"


manager = DownloadManager()
```

- [ ] **Step 2: 实现下载端点**

```python
# jmweb/api/download.py
import threading
from fastapi import APIRouter, HTTPException, Body
from jmcomic import download_album, download_photo, JmOption
from jmweb.utils.progress import manager

router = APIRouter(tags=["download"])


def _do_download(task_id: str, album_id: str, option_path: str = None):
    try:
        option = JmOption.from_file(option_path) if option_path else JmOption.default()

        def callback(album, dler):
            manager.complete_task(task_id)

        download_album(album_id, option, callback=callback, check_exception=False)
    except Exception as e:
        manager.complete_task(task_id, error=str(e))


@router.post("/download/album")
async def download_album_endpoint(
    album_id: str = Body(...),
    option_path: str = Body(None),
):
    task = manager.create_task(album_id)
    task.status = "running"

    t = threading.Thread(
        target=_do_download,
        args=(task.task_id, album_id, option_path),
        daemon=True,
    )
    task.thread = t
    t.start()

    return {
        "code": 0,
        "data": {"task_id": task.task_id, "album_id": album_id},
        "message": "下载任务已创建",
    }


@router.get("/download/status/{task_id}")
async def get_download_status(task_id: str):
    task = manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "code": 0,
        "data": {
            "task_id": task.task_id,
            "album_id": task.album_id,
            "status": task.status,
            "progress": task.progress,
            "completed_count": task.completed_count,
            "total_count": task.total_count,
            "error": task.error,
        },
        "message": "success",
    }


@router.post("/download/cancel/{task_id}")
async def cancel_download(task_id: str):
    manager.cancel_task(task_id)
    return {"code": 0, "data": None, "message": "已取消下载任务"}


@router.get("/download/tasks")
async def list_download_tasks():
    return {"code": 0, "data": manager.get_all_tasks(), "message": "success"}
```

---

### Task 6: 配置管理 API

**Files:**
- Create: `jmweb/api/config.py`

- [ ] **Step 1: 实现配置管理端点**

```python
# jmweb/api/config.py
import os
import yaml
from fastapi import APIRouter, HTTPException, Body
from jmcomic import JmOption

router = APIRouter(tags=["config"])

DEFAULT_CONFIG_PATH = os.environ.get("JM_OPTION_PATH", "")


@router.get("/config")
async def get_config():
    try:
        if DEFAULT_CONFIG_PATH and os.path.exists(DEFAULT_CONFIG_PATH):
            option = JmOption.from_file(DEFAULT_CONFIG_PATH)
        else:
            option = JmOption.default()

        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config")
async def update_config(config_data: dict = Body(...)):
    try:
        option = JmOption.construct(config_data)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "配置已更新",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/load")
async def load_config(filepath: str = Body(...)):
    try:
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="配置文件不存在")

        option = JmOption.from_file(filepath)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "配置文件已加载",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/save")
async def save_config(
    filepath: str = Body(...),
    config_data: dict = Body(...),
):
    try:
        option = JmOption.construct(config_data, cover_default=False)
        option.to_file(filepath)
        return {"code": 0, "data": None, "message": f"配置已保存到 {filepath}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Task 7: 用户/收藏 API

**Files:**
- Create: `jmweb/api/user.py`

- [ ] **Step 1: 实现用户和收藏端点**

```python
# jmweb/api/user.py
from fastapi import APIRouter, HTTPException, Query, Body
from jmcomic import JmOption

router = APIRouter(tags=["user"])


def _get_client():
    return JmOption.default().new_jm_client()


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
):
    try:
        client = _get_client()
        client.login(username=username, password=password)
        return {"code": 0, "data": None, "message": "登录成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/favorites")
async def get_favorites(
    page: int = Query(1, ge=1),
    folder_id: str = Query("0"),
    username: str = Query(""),
):
    try:
        client = _get_client()
        result = client.favorite_folder(page=page, folder_id=folder_id, username=username)
        return {"code": 0, "data": _format_favorites(result), "message": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/favorites/{album_id}")
async def add_favorite(
    album_id: str,
    folder_id: str = Body("0"),
):
    try:
        client = _get_client()
        client.add_favorite_album(album_id=album_id, folder_id=folder_id)
        return {"code": 0, "data": None, "message": "已添加到收藏"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

### Task 8: 前端主页面 HTML

**Files:**
- Create: `jmweb/static/index.html`
- Create: `jmweb/static/css/style.css`
- Create: `jmweb/static/js/api.js`
- Create: `jmweb/static/js/app.js`
- Create: `jmweb/static/js/components.js`

- [ ] **Step 1: 创建主 HTML 页面**

```html
<!-- jmweb/static/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JMComic 管理面板</title>
  <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
  <div id="app">
    <!-- 顶栏 -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="logo">📚 JMComic 管理面板</h1>
      </div>
      <div class="header-center">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="搜索本子、作者、标签..." />
          <button id="searchBtn">🔍 搜索</button>
        </div>
      </div>
      <div class="header-right">
        <span id="statusBadge" class="status-badge">● 已连接</span>
      </div>
    </header>

    <div class="app-body">
      <!-- 侧边导航 -->
      <nav class="sidebar">
        <ul>
          <li class="active" data-page="dashboard">📊 仪表盘</li>
          <li data-page="ranking">🏆 排行榜</li>
          <li data-page="search">🔍 搜索</li>
          <li data-page="downloads">📥 下载管理</li>
          <li data-page="favorites">❤️ 收藏</li>
          <li data-page="local">📁 本地库</li>
          <li data-page="settings">⚙️ 设置</li>
        </ul>
      </nav>

      <!-- 主内容 -->
      <main class="content" id="mainContent">
        <div id="page-dashboard" class="page active">
          <h2>仪表盘</h2>
          <div class="dashboard-grid">
            <div class="card" onclick="navigateTo('ranking', 'day')">
              <h3>🔥 日排行</h3>
              <p>今日热门本子</p>
            </div>
            <div class="card" onclick="navigateTo('ranking', 'week')">
              <h3>📈 周排行</h3>
              <p>本周热门本子</p>
            </div>
            <div class="card" onclick="navigateTo('ranking', 'month')">
              <h3>📅 月排行</h3>
              <p>本月热门本子</p>
            </div>
            <div class="card" onclick="navigateTo('downloads')">
              <h3>📥 下载管理</h3>
              <p>查看下载任务</p>
            </div>
          </div>
          <h3>快速搜索</h3>
          <div class="quick-tags" id="quickTags"></div>
        </div>

        <div id="page-ranking" class="page">
          <h2>🏆 排行榜</h2>
          <div class="tab-bar">
            <button class="tab-btn active" data-type="day">日排行</button>
            <button class="tab-btn" data-type="week">周排行</button>
            <button class="tab-btn" data-type="month">月排行</button>
          </div>
          <div class="album-grid" id="rankingGrid"></div>
          <div class="pagination" id="rankingPagination"></div>
        </div>

        <div id="page-search" class="page">
          <h2>🔍 搜索结果</h2>
          <div class="search-filters">
            <select id="searchType">
              <option value="all">全部</option>
              <option value="author">作者</option>
              <option value="tag">标签</option>
            </select>
          </div>
          <div class="album-grid" id="searchGrid"></div>
          <div class="pagination" id="searchPagination"></div>
        </div>

        <div id="page-detail" class="page">
          <button class="back-btn" onclick="goBack()">← 返回</button>
          <div id="albumDetail"></div>
        </div>

        <div id="page-downloads" class="page">
          <h2>📥 下载管理</h2>
          <div id="downloadList"></div>
          <div class="download-input-area">
            <input type="text" id="downloadAlbumId" placeholder="输入本子 ID..." />
            <button id="startDownloadBtn">开始下载</button>
          </div>
        </div>

        <div id="page-favorites" class="page">
          <h2>❤️ 收藏夹</h2>
          <div class="album-grid" id="favoriteGrid"></div>
          <div class="pagination" id="favoritePagination"></div>
        </div>

        <div id="page-local" class="page">
          <h2>📁 本地已下载</h2>
          <div id="localList">暂无已下载的漫画</div>
        </div>

        <div id="page-settings" class="page">
          <h2>⚙️ 设置</h2>
          <div class="settings-form">
            <h3>客户端配置</h3>
            <label>客户端类型：
              <select id="settingClientImpl">
                <option value="html">网页端 (html)</option>
                <option value="api">APP端 (api)</option>
              </select>
            </label>
            <label>下载目录：
              <input type="text" id="settingBaseDir" placeholder="D:/jmcomic/download" />
            </label>
            <label>目录规则：
              <input type="text" id="settingDirRule" value="Bd_Aauthor_Atitle" />
            </label>
            <label>图片并发数：
              <input type="number" id="settingImageThread" value="3" min="1" max="20" />
            </label>
            <h3>配置文件</h3>
            <div class="config-file-area">
              <textarea id="configEditor" rows="15" style="width:100%;font-family:monospace;"></textarea>
              <button id="saveConfigBtn">保存配置</button>
              <button id="loadConfigBtn">从文件加载</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>

  <script src="/static/js/api.js"></script>
  <script src="/static/js/components.js"></script>
  <script src="/static/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 CSS 样式**

```css
/* jmweb/static/css/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #0f0f1a; color: #e0e0e0; min-height: 100vh; }

/* Header */
.app-header {
  display: flex; align-items: center; padding: 12px 24px;
  background: #1a1a2e; border-bottom: 1px solid #2a2a4a;
  position: sticky; top: 0; z-index: 100;
}
.header-left { flex: 0 0 200px; }
.logo { font-size: 18px; color: #7c5cfc; }
.header-center { flex: 1; display: flex; justify-content: center; }
.search-box { display: flex; width: 100%; max-width: 500px; }
.search-box input {
  flex: 1; padding: 8px 16px; border: 1px solid #3a3a5a; border-radius: 6px 0 0 6px;
  background: #16213e; color: #e0e0e0; font-size: 14px;
}
.search-box input:focus { outline: none; border-color: #7c5cfc; }
.search-box button {
  padding: 8px 16px; background: #7c5cfc; color: white; border: none;
  border-radius: 0 6px 6px 0; cursor: pointer; font-size: 14px;
}
.search-box button:hover { background: #6b4ce8; }
.header-right { flex: 0 0 150px; text-align: right; }
.status-badge { font-size: 12px; color: #4ade80; }

/* Body */
.app-body { display: flex; min-height: calc(100vh - 56px); }

/* Sidebar */
.sidebar { flex: 0 0 200px; background: #1a1a2e; border-right: 1px solid #2a2a4a; padding: 16px 0; }
.sidebar ul { list-style: none; }
.sidebar li {
  padding: 12px 24px; cursor: pointer; transition: all 0.2s;
  font-size: 14px; color: #a0a0b0;
}
.sidebar li:hover { background: #2a2a4a; color: #e0e0e0; }
.sidebar li.active { background: #7c5cfc22; color: #7c5cfc; border-right: 3px solid #7c5cfc; }

/* Content */
.content { flex: 1; padding: 24px; overflow-y: auto; }
.page { display: none; }
.page.active { display: block; }

/* Cards */
.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
.card {
  background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 8px;
  padding: 24px; cursor: pointer; transition: all 0.2s;
}
.card:hover { border-color: #7c5cfc; transform: translateY(-2px); }
.card h3 { margin-bottom: 8px; color: #7c5cfc; }
.card p { color: #808090; font-size: 13px; }

/* Album Grid */
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin: 16px 0; }
.album-item {
  background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 8px;
  overflow: hidden; cursor: pointer; transition: all 0.2s;
}
.album-item:hover { border-color: #7c5cfc; transform: translateY(-2px); }
.album-item .cover {
  width: 100%; aspect-ratio: 3/4; object-fit: cover;
  background: #2a2a4a; display: flex; align-items: center; justify-content: center;
  color: #505060;
}
.album-item .info { padding: 8px 12px; }
.album-item .info .title {
  font-size: 13px; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; margin-bottom: 4px;
}
.album-item .info .meta { font-size: 11px; color: #808090; }

/* Tab Bar */
.tab-bar { display: flex; gap: 8px; margin: 16px 0; }
.tab-btn {
  padding: 8px 20px; background: #1a1a2e; border: 1px solid #2a2a4a;
  border-radius: 6px; color: #a0a0b0; cursor: pointer; font-size: 14px;
}
.tab-btn:hover { border-color: #7c5cfc; color: #e0e0e0; }
.tab-btn.active { background: #7c5cfc; color: white; border-color: #7c5cfc; }

/* Pagination */
.pagination { display: flex; justify-content: center; gap: 8px; margin: 24px 0; }
.pagination button {
  padding: 6px 14px; background: #1a1a2e; border: 1px solid #2a2a4a;
  border-radius: 4px; color: #a0a0b0; cursor: pointer;
}
.pagination button:hover { border-color: #7c5cfc; }
.pagination button.active { background: #7c5cfc; color: white; border-color: #7c5cfc; }

/* Detail */
.back-btn { padding: 6px 16px; background: transparent; border: 1px solid #3a3a5a; border-radius: 6px; color: #a0a0b0; cursor: pointer; margin-bottom: 16px; }
.back-btn:hover { border-color: #7c5cfc; color: #e0e0e0; }
.album-detail { display: flex; gap: 24px; }
.album-detail .cover { width: 300px; border-radius: 8px; flex-shrink: 0; }
.album-detail .info { flex: 1; }
.album-detail .info h2 { font-size: 22px; margin-bottom: 12px; }
.album-detail .info .field { margin: 8px 0; font-size: 14px; }
.album-detail .info .field .label { color: #808090; }
.album-detail .info .tag { display: inline-block; padding: 2px 8px; background: #2a2a4a; border-radius: 4px; font-size: 12px; margin: 2px; }
.episode-list { margin-top: 16px; }
.episode-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #1a1a2e; border: 1px solid #2a2a4a;
  border-radius: 4px; margin: 4px 0;
}
.episode-item:hover { border-color: #7c5cfc; }
.episode-item .ep-name { font-size: 14px; }
.episode-item .ep-action button {
  padding: 4px 12px; background: #7c5cfc; color: white; border: none;
  border-radius: 4px; cursor: pointer; font-size: 12px;
}

/* Downloads */
.download-input-area { display: flex; gap: 8px; margin: 16px 0; }
.download-input-area input {
  flex: 1; padding: 8px 16px; border: 1px solid #3a3a5a; border-radius: 6px;
  background: #16213e; color: #e0e0e0;
}
.download-input-area button {
  padding: 8px 20px; background: #7c5cfc; color: white; border: none;
  border-radius: 6px; cursor: pointer;
}
.download-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #1a1a2e; border: 1px solid #2a2a4a;
  border-radius: 8px; margin: 8px 0;
}
.progress-bar { flex: 1; height: 8px; background: #2a2a4a; border-radius: 4px; margin: 0 16px; overflow: hidden; }
.progress-bar .fill { height: 100%; background: #7c5cfc; border-radius: 4px; transition: width 0.3s; }
.download-status { font-size: 12px; color: #808090; }

/* Settings */
.settings-form label { display: block; margin: 12px 0; font-size: 14px; }
.settings-form input, .settings-form select {
  padding: 6px 12px; border: 1px solid #3a3a5a; border-radius: 4px;
  background: #16213e; color: #e0e0e0; margin-left: 8px; min-width: 200px;
}
.settings-form textarea { background: #16213e; color: #e0e0e0; border: 1px solid #3a3a5a; border-radius: 4px; padding: 12px; margin: 8px 0; }
.settings-form button {
  padding: 8px 20px; background: #7c5cfc; color: white; border: none;
  border-radius: 6px; cursor: pointer; margin: 4px;
}

/* Quick Tags */
.quick-tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.quick-tag {
  padding: 6px 14px; background: #1a1a2e; border: 1px solid #2a2a4a;
  border-radius: 16px; font-size: 13px; cursor: pointer; color: #a0a0b0;
}
.quick-tag:hover { border-color: #7c5cfc; color: #7c5cfc; }
```

- [ ] **Step 3: 创建 API 请求封装**

```javascript
// jmweb/static/js/api.js
const API = {
  baseURL: '/api/v1',

  async request(url, options = {}) {
    try {
      const resp = await fetch(`${this.baseURL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await resp.json();
      if (data.code !== 0) throw new Error(data.message || '请求失败');
      return data.data;
    } catch (err) {
      throw err;
    }
  },

  // Album
  getAlbum(id) { return this.request(`/album/${id}`); },
  getPhoto(id) { return this.request(`/photo/${id}`); },

  // Search
  search(q, page = 1, orderBy = 'latest') {
    return this.request(`/search?q=${encodeURIComponent(q)}&page=${page}&order_by=${orderBy}`);
  },
  searchByAuthor(q, page = 1) { return this.request(`/search/author?q=${encodeURIComponent(q)}&page=${page}`); },
  searchByTag(q, page = 1) { return this.request(`/search/tag?q=${encodeURIComponent(q)}&page=${page}`); },

  // Ranking
  getRanking(type, page = 1, category = 'ALL') {
    return this.request(`/ranking/${type}?page=${page}&category=${category}`);
  },

  // Category
  getCategory(page = 1, time = 'ALL', orderBy = 'view', category = 'ALL') {
    return this.request(`/category?page=${page}&time=${time}&order_by=${orderBy}&category=${category}`);
  },

  // Download
  startDownload(albumId, optionPath = null) {
    return this.request('/download/album', {
      method: 'POST',
      body: JSON.stringify({ album_id: albumId, option_path: optionPath }),
    });
  },
  getDownloadStatus(taskId) { return this.request(`/download/status/${taskId}`); },
  cancelDownload(taskId) {
    return this.request(`/download/cancel/${taskId}`, { method: 'POST' });
  },
  getDownloadTasks() { return this.request('/download/tasks'); },

  // Config
  getConfig() { return this.request('/config'); },
  updateConfig(data) {
    return this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Favorites
  getFavorites(page = 1, folderId = '0') {
    return this.request(`/user/favorites?page=${page}&folder_id=${folderId}`);
  },
  addFavorite(albumId) {
    return this.request(`/user/favorites/${albumId}`, { method: 'POST' });
  },
};
```

- [ ] **Step 4: 创建 UI 组件库**

```javascript
// jmweb/static/js/components.js
const Components = {
  renderAlbumGrid(albums, containerId) {
    const container = document.getElementById(containerId);
    if (!albums || albums.length === 0) {
      container.innerHTML = '<p style="color:#808090;text-align:center;padding:40px;">暂无数据</p>';
      return;
    }
    container.innerHTML = albums.map(a => `
      <div class="album-item" onclick="showAlbumDetail('${a.album_id}')">
        <div class="cover" style="background:#2a2a4a;display:flex;align-items:center;justify-content:center;color:#606080;font-size:40px;">📖</div>
        <div class="info">
          <div class="title" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</div>
          <div class="meta">JM${a.album_id}</div>
        </div>
      </div>
    `).join('');
  },

  renderPagination(total, pageCount, currentPage, containerId, callback) {
    const container = document.getElementById(containerId);
    if (pageCount <= 1) { container.innerHTML = ''; return; }

    let html = '';
    const showPages = 5;
    const start = Math.max(1, currentPage - Math.floor(showPages / 2));
    const end = Math.min(pageCount, start + showPages - 1);

    if (currentPage > 1) html += `<button onclick="${callback}(${currentPage - 1})">←</button>`;
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${callback}(${i})">${i}</button>`;
    }
    if (currentPage < pageCount) html += `<button onclick="${callback}(${currentPage + 1})">→</button>`;
    container.innerHTML = html;
  },

  renderAlbumDetail(album) {
    const container = document.getElementById('albumDetail');
    const tags = (album.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const episodes = (album.episodes || []).map(ep => `
      <div class="episode-item" onclick="downloadPhoto('${ep.photo_id}')">
        <span class="ep-name">第${ep.index}話 ${escapeHtml(ep.name)}</span>
        <span class="ep-action"><button>下载</button></span>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="album-detail">
        <div class="cover" style="width:300px;aspect-ratio:3/4;background:#2a2a4a;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#606080;font-size:60px;">📖</div>
        <div class="info">
          <h2>${escapeHtml(album.title)}</h2>
          <div class="field"><span class="label">ID：</span>JM${album.album_id}</div>
          <div class="field"><span class="label">作者：</span>${(album.authors || []).join('、') || '未知'}</div>
          <div class="field"><span class="label">总页数：</span>${album.page_count}</div>
          <div class="field"><span class="label">观看：</span>${album.views}</div>
          <div class="field"><span class="label">点赞：</span>${album.likes}</div>
          <div class="field"><span class="label">发布日期：</span>${album.pub_date}</div>
          <div class="field"><span class="label">更新日期：</span>${album.update_date}</div>
          ${album.description ? `<div class="field"><span class="label">简介：</span>${escapeHtml(album.description)}</div>` : ''}
          ${tags ? `<div class="field"><span class="label">标签：</span>${tags}</div>` : ''}
          <button class="download-btn" onclick="downloadAlbum('${album.album_id}')" style="margin-top:12px;padding:10px 24px;background:#7c5cfc;color:white;border:none;border-radius:6px;cursor:pointer;font-size:15px;">⬇ 下载本子</button>
        </div>
      </div>
      ${episodes ? `<div class="episode-list"><h3>📑 章节列表 (${album.episodes.length})</h3>${episodes}</div>` : ''}
    `;
  },

  renderDownloadTasks(tasks) {
    const container = document.getElementById('downloadList');
    if (!tasks || tasks.length === 0) {
      container.innerHTML = '<p style="color:#808090;text-align:center;padding:20px;">暂无下载任务</p>';
      return;
    }
    container.innerHTML = tasks.reverse().map(t => {
      const statusText = { pending: '等待中', running: '下载中', completed: '已完成', failed: '失败', cancelled: '已取消' }[t.status] || t.status;
      const statusColor = { pending: '#f0c040', running: '#4a9eff', completed: '#4ade80', failed: '#f04040', cancelled: '#808090' }[t.status] || '#808090';
      return `
        <div class="download-item">
          <span>JM${t.album_id}</span>
          <div class="progress-bar"><div class="fill" style="width:${t.progress || 0}%;background:${statusColor};"></div></div>
          <span class="download-status" style="color:${statusColor};">${statusText} ${t.progress || 0}%</span>
          ${t.status === 'running' ? `<button onclick="cancelDownload('${t.task_id}')" style="padding:4px 12px;background:#f04040;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">取消</button>` : ''}
        </div>
      `;
    }).join('');
  },
};

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

- [ ] **Step 5: 创建主应用逻辑**

```javascript
// jmweb/static/js/app.js
let currentPage = 'dashboard';
let state = {};

// 导航
function navigateTo(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));

  currentPage = page;
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const sidebarItem = document.querySelector(`.sidebar li[data-page="${page}"]`);
  if (sidebarItem) sidebarItem.classList.add('active');

  if (page === 'ranking') loadRanking('day');
  if (page === 'downloads') loadDownloadTasks();
  if (page === 'favorites') loadFavorites(1);
  if (page === 'settings') loadConfig();
  if (page === 'dashboard') loadDashboard();
}

document.querySelectorAll('.sidebar li').forEach(li => {
  li.addEventListener('click', () => navigateTo(li.dataset.page));
});

// 搜索
document.getElementById('searchBtn').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  navigateTo('search');
  doSearch(query, 1);
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

function doSearch(query, page) {
  state.searchQuery = query;
  state.searchPage = page;
  const type = document.getElementById('searchType')?.value || 'all';

  let promise;
  if (type === 'author') promise = API.searchByAuthor(query, page);
  else if (type === 'tag') promise = API.searchByTag(query, page);
  else promise = API.search(query, page);

  promise.then(data => {
    Components.renderAlbumGrid(data.albums, 'searchGrid');
    Components.renderPagination(data.total, data.page_count, page, 'searchPagination',
      `doSearch('${query}',`);
  }).catch(err => {
    document.getElementById('searchGrid').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">搜索失败：${err.message}</p>`;
  });
}

// 搜索类型切换
document.addEventListener('change', (e) => {
  if (e.target.id === 'searchType' && state.searchQuery) {
    doSearch(state.searchQuery, 1);
  }
});

// 排行
function loadRanking(type, page = 1) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-type="${type}"]`)?.classList.add('active');

  API.getRanking(type, page).then(data => {
    Components.renderAlbumGrid(data.albums, 'rankingGrid');
    Components.renderPagination(data.total, data.page_count, page, 'rankingPagination',
      `loadRanking('${type}',`);
  }).catch(err => {
    document.getElementById('rankingGrid').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">加载失败：${err.message}</p>`;
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => loadRanking(btn.dataset.type));
});

// 本子详情
function showAlbumDetail(albumId) {
  navigateTo('detail');
  document.getElementById('albumDetail').innerHTML = '<p style="text-align:center;padding:40px;color:#808090;">加载中...</p>';

  API.getAlbum(albumId).then(data => {
    Components.renderAlbumDetail(data);
  }).catch(err => {
    document.getElementById('albumDetail').innerHTML = `<p style="color:#f04040;text-align:center;padding:40px;">加载失败：${err.message}</p>`;
  });
}

// 下载
function downloadAlbum(albumId) {
  API.startDownload(albumId).then(data => {
    alert(`下载任务已创建！任务ID: ${data.task_id}`);
    loadDownloadTasks();
  }).catch(err => alert(`创建下载任务失败：${err.message}`));
}

function downloadPhoto(photoId) {
  alert(`章节下载功能：${photoId}（将在后续迭代中完善）`);
}

function cancelDownload(taskId) {
  API.cancelDownload(taskId).then(() => loadDownloadTasks());
}

document.getElementById('startDownloadBtn')?.addEventListener('click', () => {
  const albumId = document.getElementById('downloadAlbumId').value.trim();
  if (!albumId) { alert('请输入本子 ID'); return; }
  downloadAlbum(albumId);
});

function loadDownloadTasks() {
  API.getDownloadTasks().then(tasks => {
    Components.renderDownloadTasks(tasks);
  });
}

// 定时刷新下载任务状态
setInterval(() => {
  if (currentPage === 'downloads') loadDownloadTasks();
}, 2000);

// 收藏
function loadFavorites(page) {
  API.getFavorites(page).then(data => {
    Components.renderAlbumGrid(data.albums, 'favoriteGrid');
    Components.renderPagination(data.total, data.page_count, page, 'favoritePagination',
      'loadFavorites(');
  });
}

// 配置
function loadConfig() {
  API.getConfig().then(config => {
    document.getElementById('settingClientImpl').value = config.client?.impl || 'html';
    document.getElementById('settingBaseDir').value = config.dir_rule?.base_dir || '';
    document.getElementById('settingDirRule').value = config.dir_rule?.rule || 'Bd_Aauthor_Atitle';
    document.getElementById('settingImageThread').value = config.download?.threading?.image || 3;
    document.getElementById('configEditor').value = JSON.stringify(config, null, 2);
  });
}

document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
  try {
    const config = JSON.parse(document.getElementById('configEditor').value);
    API.updateConfig(config).then(() => alert('配置已保存'));
  } catch (e) {
    alert('配置格式错误：' + e.message);
  }
});

// 仪表盘
function loadDashboard() {
  const tags = ['全彩', '無修正', '中文', '同人', '單行本'];
  document.getElementById('quickTags').innerHTML = tags.map(t =>
    `<span class="quick-tag" onclick="document.getElementById('searchInput').value='${t}';document.getElementById('searchBtn').click();">${t}</span>`
  ).join('');
}

// 返回
function goBack() {
  history.back();
  if (currentPage === 'detail') navigateTo('dashboard');
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadDownloadTasks();
});
```

---

### Task 9: 侧边栏搜索直接跳转 & 顶部搜索联动

**Files:**
- Modify: `jmweb/static/js/app.js` (已经包含在 Task 8)

- [ ] **Step 1: 全局搜索框联动侧边栏**

当用户在顶栏搜索框中输入并回车时：
1. 自动切换到侧边栏的"搜索"页面
2. 调用搜索 API 并展示结果
3. 支持搜索类型切换（全部/作者/标签）

这部分代码已经在 `app.js` 的搜索逻辑中实现。

---

### Task 10: 启动脚本 & 快捷入口

**Files:**
- Create: `jmweb/__main__.py` (支持 `python -m jmweb`)
- Modify: `jmweb/main.py`

- [ ] **Step 1: 创建 main entry 模块**

```python
# jmweb/__main__.py
from .main import start

if __name__ == "__main__":
    start()
```

- [ ] **Step 2: 提供多种启动方式**

用户可以通过以下任一方式启动 Web 面板：

```bash
# 方式 1: 模块启动
python -m jmweb

# 方式 2: 命令启动 (需先 pip install -e .)
jmweb

# 方式 3: Python 脚本启动
python -c "from jmweb.main import start; start()"
```

启动后在浏览器访问: `http://127.0.0.1:8800`

---

## 实现顺序建议

建议按照以下顺序逐步实现：

1. **Task 1** → 后端骨架，能启动即可
2. **Task 2** → 本子详情 API，可验证数据正常
3. **Task 3** → 搜索 API
4. **Task 4** → 排行 API
5. **Task 8** → 前端页面（HTML+CSS+JS），先实现界面和详情展示
6. **Task 5** → 下载 API + 前端下载管理
7. **Task 6** → 配置 API + 前端设置页
8. **Task 7** → 收藏 API + 前端收藏页
9. **Task 9** → 搜索联动优化
10. **Task 10** → 启动脚本完善

## 后续可扩展功能

- **图片懒加载 & 缩略图缓存** - 提升浏览体验
- **在线预览** - 在面板中直接阅读漫画
- **多语言支持** - 国际化
- **Docker 部署** - 容器化一键启动
- **WebSocket 实时推送下载进度** - 替代轮询
- **自定义插件管理** - 在 UI 中开关/配置插件
- **批量导入 ID 列表** - 从文件导入下载列表