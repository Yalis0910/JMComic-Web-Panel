# JMlis — 跨平台漫画阅读与管理系统

面向**本地 / 局域网自托管 + 手机外出直连**的双端漫画阅读与管理系统，采用 **Liquid Glass（液态玻璃）** 视觉语言与分层材质规范统一设计（暖纸实体阅读面 + 悬浮清透/着色玻璃操作层）。

## 工程结构

```text
├── server/          # FastAPI + SQLite 异步本地服务端 (API v2 + SSE + 本地书库)
├── web/             # React 19 + TypeScript + Vite + Tailwind CSS (Liquid Glass 悬浮胶囊面板)
├── mobile/          # Flutter Liquid Glass + Cupertino 混合双模式 App (局域网连服务端 / 外出直连禁漫)
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
- **Liquid Glass 视觉与光学体系**：采用暖纸白 `#F3F2ED` / 深海夜读 `#0E1619` 自适应主题，遵循「操作层使用玻璃，正文留在实体面」原则；桌面端配备**顶部居中悬浮胶囊 Dock**（带弹簧滑动指示器与 `Ctrl K` 着色玻璃快捷搜索弹窗），移动端配备**顶部/底部悬浮双胶囊栏**；在 Chromium 内核浏览器中启用基于解析圆角法线的 SVG `<feDisplacementMap>` 实时边缘折光与 `1px` 定向高光，其余浏览器平滑降级为一致磨砂质感。
- **全新多模式阅读器**：配备脱离边缘的双悬浮 Liquid Glass 胶囊 HUD，支持纵向条漫、单页左→右、单页日漫右→左、双页跨页四种模式，支持并发预加载、单页失败重试、缩略图抽屉与快捷键。

### 3. 混合模式 App (`mobile/`)
- **Liquid Glass 移动端体验**：采用定制 `LiquidGlassSurface`（`BackdropFilter` + `1px` 定向高光描边）、`SpringSimulation` 按压/拖拽伸展/420ms 回弹手感，以及支持横向滑动切换的底部悬浮液态玻璃胶囊底栏 `LiquidCapsuleNavBar`，配合 Deep Sea 氛围头图与舒适 2 列实体阅读卡片。
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
flutter create . --platforms=android --project-name jmlis --org com.jmlis.app
flutter pub get
dart run flutter_launcher_icons
flutter analyze
flutter test
flutter build apk --release
```

若本机未安装 Flutter SDK，推送代码到 GitHub 后可通过 `.github/workflows/build-app.yml` 自动执行测试并下载构建好的 `JMlis-v<version>.apk` 安装包产物。
