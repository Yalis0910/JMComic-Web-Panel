# JMComic Web Panel

基于 [JMComic-Crawler-Python](https://github.com/hect0x7/JMComic-Crawler-Python) 的 Web 面板，在浏览器里完成搜索、浏览、在线阅读、下载和收藏管理。

## 功能

### 搜索

- 关键词搜索，支持按最新 / 观看 / 点赞排序
- 按作者搜索、按标签搜索
- 分页浏览结果
- 搜索框记录最近搜索，支持 ↑ / ↓ 键盘选择、Enter 确认、输入时实时过滤

### 排行榜与分类

- 日榜 / 周榜 / 月榜
- 分类筛选

### 漫画阅读器

- 在线阅读，支持缩放、全屏、宽度自适应
- 缩略图导航（设置页可关闭，关闭后完全禁用）
- 多章节漫画支持上一话 / 下一话切换，缩略图条内可直接下拉选择章节
- 读到最后一页提示一键进入下一话
- 键盘快捷键：方向键翻页，空格按屏滚动，+ / - 缩放，`[` / `]` 切换章节，q / Esc / Backspace 退出，`?` / h 呼出快捷键帮助
- 触摸手势：点击切页、双击缩放、双指捏合
- 阅读进度自动记录，首页「继续阅读」从上次位置继续
- 亮 / 暗主题

### 下载管理

- Web 端创建下载任务，支持图片文件夹、ZIP、PDF、长图格式
- 实时进度、速度与剩余时间
- 取消、失败重试、删除任务
- 下载历史持久化

### 用户与收藏

- 登录 / 登出（网页端、APP 端客户端）
- 密码本地加密存储，Session 持久化；会话失效时自动重建，登录过期自动提示重新登录
- 收藏夹管理：文件夹分组、排序、批量下载

### 图片服务

- 图片代理自动解密条带打乱的图片
- 服务端磁盘缓存解密结果，默认 `jmweb/data/image-cache/`，按文件数或总大小自动淘汰最久未使用的文件
- 缓存目录、文件上限、大小上限可在设置页修改，支持一键清空
- 图片响应带 14 天浏览器缓存

### 历史

- 独立历史页：阅读记录（进度条、已读完标记、单条删除 / 清空）与最近搜索（单条删除 / 清空）

### 配置

- 设置页在线编辑 `option.yml`
- 客户端类型、下载目录、目录规则、并发数直接修改

## 技术说明

- 纯原生 JS 单页应用，无框架
- hash 路由，每个页面有独立 URL（如 `#/search?q=xxx&page=2`），支持前进 / 后退、刷新保持状态、直接分享
- 列表数据内存缓存 10 分钟，返回页面不重复请求
- 共享 JM 客户端池，复用会话与域名缓存
- 移动端底部标签栏，桌面端顶部导航
- 亮 / 暗 / 跟随系统三种主题
- 网格卡片悬停快捷操作（阅读 / 下载），详情页数据胶囊与 ID 复制

## 快速开始

需要 Python 3.9+。

```bash
git clone https://github.com/Yalis0910/JMComic-Web-Panel.git
cd JMComic-Web-Panel
pip install -e .
python -m jmweb.main
```

Windows 也可以直接双击 `start-web.bat`。

浏览器打开 <http://127.0.0.1:8800> 进入面板。

服务默认监听 8800 端口，修改 `jmweb/main.py` 中的 `port` 参数即可。

## 配置文件

| 文件 | 说明 |
| --- | --- |
| `config/option.yml` | JMComic 本体配置，设置页可直接编辑 |
| `config/web-config.json` | 面板自身配置，包含图片缓存目录、文件上限与大小上限，设置页修改后立即生效 |

## 项目结构

```
jmweb/                  # Web 面板模块
├── main.py             # FastAPI 入口
├── api/
│   ├── album.py        # 专辑 / 图片详情、图片代理（解密 + 磁盘缓存）
│   ├── search.py       # 搜索（关键词 / 作者 / 标签）
│   ├── category.py     # 排行榜 / 分类
│   ├── download.py     # 下载任务管理
│   ├── config.py       # 配置读写
│   ├── deps.py         # 共享 JM 客户端池
│   └── user.py         # 登录 / 收藏
├── utils/
│   ├── cache.py        # 图片磁盘缓存（文件数 + 大小上限淘汰）
│   ├── progress.py     # 下载进度管理
│   ├── session.py      # 用户 Session（AES 加密、失效自动重建）
│   └── web_config.py   # 面板配置（图片缓存）
├── static/             # 前端
│   ├── index.html
│   ├── css/            # tokens.css / style.css / reader.css
│   └── js/             # router.js / app.js / components.js / history.js / reader/
└── data/               # 运行时数据（session、图片缓存，不入库）
config/                 # 配置文件（不入库）
start-web.bat           # Windows 一键启动
```

## License

与上游项目相同，见 [LICENSE](./LICENSE)。
