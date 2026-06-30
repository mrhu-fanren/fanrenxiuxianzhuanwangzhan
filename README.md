# 凡人修仙传粉丝网站

> 粉丝自发整理的多页面站点：人物百科、法宝图鉴、灵兽妖兽、场景情节、音乐配音、问答、B站数据等。
> 技术栈：Node.js + Express + better-sqlite3（SQLite 持久化）+ 原生多页 HTML/CSS/JS（无构建工具）。

## 目录结构

```
凡人修仙传/
  server/
    app.js              # Express 入口，挂载所有路由
    db.js               # SQLite 初始化与连接
    routes/             # auth / comments / stats / feedback / bilibili / dev
    middleware/auth.js  # requireUser / requireDev
  pages/                # 前端 HTML（首页 + 核心功能页）
  assets/
    css/style.css       # 修仙古典风统一样式
    js/                 # common / auth / dev / comments
    img/                # 图片目录
  data/                 # 内容 JSON + SQLite 数据库(app.db)
  crawler/              # bilibili.py / spam_filter.py（占位）
  scripts/schedule.md   # 定时任务说明
  package.json
  README.md
```

## 快速开始

```bash
npm install
npm start
# 访问 http://localhost:3000/
```

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/register | 注册（手机号/昵称/密码必填，邮箱可选） |
| POST | /api/login | 登录（手机号/ID/邮箱 + 密码） |
| GET  | /api/me | 当前登录用户 |
| POST | /api/stats/view | 浏览埋点 |
| GET  | /api/stats/bilibili | 最新 B 站快照 |
| POST | /api/comments | 发表短评/长评 |
| GET  | /api/comments?board= | 获取非垃圾评论 |
| GET  | /api/comments/all | 全部评论（开发者） |
| POST | /api/feedback | 提交反馈 |
| GET  | /api/feedback | 全部反馈（开发者） |
| GET  | /api/bilibili | B 站数据 |
| POST | /api/dev/login | 开发者登录（密码 HU123456789） |
| GET  | /api/dev/stats | 综合统计（开发者） |
| GET  | /api/dev/users | 用户列表（开发者） |
| GET  | /api/dev/views/:board | 板块浏览详情（开发者） |

## 开发者入口

- 顶层导航「开发者模式」→ `dev-login.html` → 密码 `HU123456789` → `dev-panel.html`
- 面板展示：注册用户、总浏览量、各板块明细、评论统计、反馈、B站快照，每项可点入查看详情，底部含用户登录数据。

## 数据存储

- 内容数据：`data/*.json`（characters / treasures / beasts / qa / bilibili）
- 用户/评论/统计/反馈/会话/B站快照：`data/app.db`（SQLite，自动创建）

## 备注

- 本仓库为项目骨架与后端，海量内容数据（数百人物、数千法宝等）由后续 agent 填充。
- 免责声明：数据量过大，整理可能有误。
