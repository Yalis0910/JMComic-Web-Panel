# JMComic Panel & Hybrid App

面向**本地 / 局域网自托管 + 手机外出直连**的双端漫画阅读与管理系统，采用 **iOS 系统界面风格（Apple HIG / Cupertino）** 统一设计。

## 工程结构

```text
├── server/          # FastAPI + SQLite 异步本地服务端 (API v2 + SSE + 本地书库)
├── web/             # React 19 + TypeScript + Vite + Tailwind CSS (iOS 风格响应式面板)
├── mobile/          # Flutter 原生 Cupertino 混合双模式 App (局域网连服务端 / 外出直连禁漫)
├── .github/         # GitHub Actions 云端自动构建 Android APK 与全端测试
└── start-panel.bat  # Windows 一键启动脚本
```

## 核心特性

### 1. 本地 / 局域网服务端 (`server/`)
- **协议封装与扩展**：基于标准 `jmcomic` 库并扩展 APP 端接口，支持首页精选推荐 (`/promote`)、最新更新 (`/latest`)、每周必看 (`/week`)、排行榜、分类/副分类筛选、站内/作者/标签/作品/角色搜索、详情与相关推荐、评论列表与发表。
- **非阻塞图片与封面代理**：图片反混淆与封面拉取均运行在线程池中并支持双上限 LRU 磁盘缓存（文件数 + 总体积），彻底避免阻塞事件循环与浏览器直连 CDN 被屏蔽问题。
- **本地已下载书库**：自动扫描下载目录（文件夹与 `.zip` 归档），Web 与 App 可直接在局域网高速阅读本地漫画。
- **SQLite + SSE**：下载任务队列与阅读历史持久化到 SQLite，支持 SSE 实时进度推送及多端 LWW（Last-Write-Wins）增量进度同步；支持可选局域网 PIN 码锁保护。

### 2. Web 端 (`web/`)
- 遵循 **Apple HIG** 视觉规范：Light / Dark 自适应、`0.5px` 分割线、毛玻璃侧边栏与移动端底栏、Inset Grouped 分组列表、Segmented Control、Bottom Sheet。
- **全新多模式阅读器**：支持纵向条漫、单页左→右、单页日漫右→左、双页跨页四种模式，支持并发预加载、单页失败重试、缩略图抽屉与快捷键。

### 3. 混合模式 App (`mobile/`)
- **局域网模式（LAN Server）**：连接本地 `server/`，享受磁盘缓存加速、本地已下载书库直读、服务端下载控制及进度双向合并。
- **外出直连模式（Direct JM）**：离开局域网自动切换为手机直连禁漫，内置 Dart 版 `JmCrypto`（Token 签名 + AES-ECB 解密）与 `JmImageDecoder`（Isolate 后台条带还原），支持章节离线缓存，回连局域网后自动同步阅读进度。

## 快速开始

### 1. 启动后端与 Web 面板

需要 Python 3.10+ 与 Node.js 20+：

```bash
# 安装服务端依赖
pip install -e "./server[dev]"

# 构建 Web 前端（仅首次或前端更新时需要）
cd web
npm install
npm run build
cd ..

# 启动服务（默认监听 http://0.0.0.0:8800）
set PYTHONPATH=server
python -m app.main
```

Windows 用户也可以直接双击 `start-panel.bat`。启动后访问 <http://127.0.0.1:8800> 即可使用（局域网设备可通过主机内网 IP 访问）。

### 2. 运行自动化测试

```bash
# 后端单元测试
python -m pytest server/tests -v

# Web 前端类型检查与构建
cd web && npm run build
```

### 3. 构建 Flutter App

若本机已安装 Flutter SDK：

```bash
cd mobile
flutter create . --platforms=android,ios
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

若本机未安装 Flutter SDK，推送代码到 GitHub 后可通过 `.github/workflows/build-app.yml` 自动执行测试并下载构建好的 Android APK 产物。
