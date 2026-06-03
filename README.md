<div align="center">
  <h1 style="margin-top: 0" align="center">JMComic Web Panel</h1>
  <p align="center">
    <strong>基于 <a href="https://github.com/hect0x7/JMComic-Crawler-Python">hect0x7/JMComic-Crawler-Python</a> 二次开发的 Web 管理面板</strong>
  </p>
  <p align="center">
    为 JMComic 提供直观的浏览器界面，涵盖搜索、浏览、下载、阅读等功能
  </p>
</div>

***

## 项目说明

本项目是基于 [hect0x7/JMComic-Crawler-Python](https://github.com/hect0x7/JMComic-Crawler-Python) 二次开发的 **Web 图形化面板**。原项目提供了强大的 Python API 和命令行工具，而本项目在此基础上增加了完整的 Web 前端界面，让操作更直观便捷。

### 与原项目的关系

- **基础功能（下载 API、命令行、配置系统、GitHub Actions 等）** 完全继承自上游项目，请前往 [原项目仓库](https://github.com/hect0x7/JMComic-Crawler-Python) 查看相关文档
- **本仓库新增内容**：以下介绍的 Web 面板、漫画阅读器、可视化下载管理等功能

***

## 新增功能（Web 面板）

### 📋 仪表盘

- 快速入口：热门排行、下载管理、我的收藏
- 标签云快速导航

### 🔍 搜索

- 关键词搜索（支持排序：最新/观看/点赞）
- 按作者搜索
- 按标签搜索
- 分页浏览结果

### 🏆 排行榜

- 日榜 / 周榜 / 月榜
- 分类筛选
- 分页浏览

### 📖 漫画阅读器

- 在线漫画阅读，支持缩放、全屏
- 缩略图导航
- 键盘快捷键（方向键翻页）
- 触摸手势支持
- 亮/暗主题切换

### ⬇️ 下载管理

- Web 端创建下载任务（输入漫画 ID）
- 支持下载为**图片文件夹**或 **ZIP 压缩包**
- 实时进度追踪
- 任务取消功能
- 下载历史持久化（重启不丢失）

### 👤 用户系统

- 登录/登出（支持网页端、APP 端两种客户端）
- 密码本地加密存储，Session 持久化
- 查看收藏夹（支持文件夹分组）
- 添加收藏
- 批量下载收藏漫画

### ⚙️ 配置管理

- Web 界面在线编辑 `option.yml`
- 可视化修改：客户端类型、下载目录、目录规则、并发数
- 实时读取/保存配置

***

## 快速开始

### 前置要求

- Python **3.9+**
- pip

### 安装 & 启动

```bash
# 1. 克隆本项目
git clone https://github.com/Yalis0910/JMComic-Crawler-Python
cd JMComic-Crawler-Python

# 2. 安装依赖
pip install -e .

# 3. 启动 Web 服务
python -m jmweb.main
```

或者直接双击 `start-web.bat`（Windows）。

启动后浏览器访问 **<http://127.0.0.1:8800>** 即可进入面板。

### 默认端口

服务默认运行在 `8800` 端口，如需修改请编辑 `jmweb/main.py` 中的 `port` 参数。

***

## 项目结构（新增部分）

```
jmweb/                  # Web 面板模块
├── main.py             # FastAPI 应用入口
├── api/                # RESTful API 路由
│   ├── album.py        # 专辑/图片详情、图片代理（解密）
│   ├── search.py       # 搜索（关键词/作者/标签）
│   ├── download.py     # 下载任务管理
│   ├── category.py     # 排行榜/分类筛选
│   ├── config.py       # 配置读写
│   └── user.py         # 登录/收藏
├── utils/
│   ├── progress.py     # 下载进度管理（线程安全、持久化）
│   └── session.py      # 用户 Session 管理（AES 加密存储）
├── static/             # 前端静态文件
│   ├── index.html      # 主页面（SPA）
│   ├── css/            # 样式文件
│   └── js/             # 前端逻辑
│       ├── api.js
│       ├── app.js
│       ├── components.js
│       └── reader/     # 漫画阅读器
└── data/               # 运行时数据（session、密钥）
config/                 # 配置文件目录
start-web.bat           # Windows 一键启动脚本
```

***

## License

本项目基于原项目相同的开源协议，详见 [LICENSE](./LICENSE)。
