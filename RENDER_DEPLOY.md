# Render PaaS 部署说明

本文档说明如何将「凡人修仙传粉丝网站」部署到 [Render](https://render.com)。
项目通过根目录 `render.yaml`（Render Blueprint）声明式定义全部服务，部署流程简单。

---

## 架构概览

| 服务 | 类型 | 作用 | 调度 |
| --- | --- | --- | --- |
| `fanrenxiuxianzhuan` | Web Service | 主站（Node.js + Express，端口 3000） | 常驻 |
| `fanren-db` | PostgreSQL | 用户/评论/浏览/反馈/会话/B站快照存储 | 常驻 |
| `fanren-bilibili-cron` | Cron Job | B站数据爬虫 `crawler/bilibili.py` | 每小时 `0 * * * *` |
| `fanren-spam-cron` | Cron Job | 垃圾评论屏蔽 `crawler/spam_filter.py` | 每日 03:00 `0 3 * * *` |

Web Service 与两个 Cron Job 通过 `DATABASE_URL` / `APP_URL` 环境变量引用数据库与主站连接信息，无需手动填写。

---

## 部署步骤

### 1. 准备 GitHub 仓库

将项目推送到 GitHub。**必须包含以下内容**（内容数据不能漏）：

```
data/*.json          # 网站内容数据（characters/treasures/beasts/qa/bilibili 等，必须提交）
pages/               # 前端 HTML
assets/              # 静态资源 css/js/img
server/              # Express 后端 + 路由
crawler/             # Python 爬虫脚本
scripts/migrate-to-postgres.js   # 数据迁移脚本
render.yaml          # Render Blueprint 声明
package.json
app.json
```

注意：`data/app.db`（SQLite 本地库）已在 `.gitignore` 中忽略，**不要**提交。`data/*.json` 内容数据文件**要**提交。

```bash
git init
git add .
git commit -m "feat: 凡人修仙传粉丝网站初始化"
git branch -M main
git remote add origin https://github.com/<你的用户名>/fanrenxiuxianzhuan.git
git push -u origin main
```

### 2. 注册 Render 账号并连接 GitHub

- 访问 https://render.com 注册账号（可用 GitHub 账号直接登录）。
- 进入 Dashboard，授权 Render 访问你的 GitHub 仓库（可只授权指定仓库）。

### 3. New → Blueprint 创建服务

- 在 Render Dashboard 点击右上角 **New +** → **Blueprint**。
- 选择刚推送的 `fanrenxiuxianzhuan` 仓库。
- Render 会自动识别根目录的 `render.yaml`，列出即将创建的 4 个服务：
  - `fanrenxiuxianzhuan`（web）
  - `fanren-db`（postgres）
  - `fanren-bilibili-cron`（cron）
  - `fanren-spam-cron`（cron）
- 确认服务名、计划（均为 free）后点击 **Apply** 开始创建。

### 4. 等待部署完成

- **PostgreSQL** (`fanren-db`)：约 1-2 分钟创建完成，状态变为 `Available`。
- **Web Service** (`fanrenxiuxianzhuan`)：构建（`npm install`）+ 启动（`node server/app.js`），约 2-4 分钟。日志出现 `[凡人修仙传] 服务已启动` 即成功。
- 两个 **Cron Job**：创建后处于 idle 状态，到点自动触发。

> 如果 Web Service 构建时缺少原生模块（better-sqlite3），Render 的 Linux 环境会自动编译，通常无需额外配置。

### 5. 数据迁移（可选）

如果是从本地 SQLite 迁移已有数据到 Render PostgreSQL，在**本地终端**执行：

```bash
# 在 Render Dashboard → fanren-db → Info 页面复制「Internal Database URL」
# 形如 postgres://fanren_db_xxx:password@xxx.db.ondigitalocean.com:5432/fanren_db
DATABASE_URL=<粘贴内部连接串> node scripts/migrate-to-postgres.js
```

脚本会从本地 `data/app.db` 读取 users / views / comments / feedbacks / dev_sessions / bilibili_stats 全部数据，幂等写入 Render PostgreSQL，并打印各表迁移条数。

> 若是全新站点无历史数据，可跳过本步，PostgreSQL 表会在首次写入时自动创建。

### 6. 验证部署

- 浏览器访问：**https://fanrenxiuxianzhuan.onrender.com**
- 测试健康检查：**https://fanrenxiuxianzhuan.onrender.com/api/health** → 返回 `{"ok":true,"ts":"..."}`
- 进入开发者面板（导航 → 开发者模式，密码 `HU123456789`）确认统计数据写入正常。

### 7. Cron Job 自动运行

- `fanren-bilibili-cron`：每小时整点抓取 B 站数据，写入 PostgreSQL 并更新 `data/bilibili.json`（注：Render Cron 容器无持久化磁盘，B站快照数据应通过主站 API 写入数据库）。
- `fanren-spam-cron`：每日 03:00 扫描评论并标记垃圾内容。
- 在 Render Dashboard → 对应 Cron Job → **Events** 可查看每次执行日志。

---

## 免费层限制说明

| 资源 | 限制 | 影响 |
| --- | --- | --- |
| Web Service | **15 分钟无访问自动休眠**，下次访问时冷启动约 30-60 秒 | 低频访问时首次打开较慢 |
| PostgreSQL | **免费层有效期 90 天**，到期后需升级或迁移数据 | 90 天后数据库将暂停 |
| Cron Job | 免费层单次执行最长 30 分钟 | 爬虫需控制抓取时长 |
| 带宽/构建分钟 | 每月有限额 | 超出需升级计划 |

> 建议：长期运营请升级 Web Service 与 PostgreSQL 至 Starter 计划（不休眠、无 90 天限制）。

---

## 域名

- 免费子域名：**https://fanrenxiuxianzhuan.onrender.com**
- 在 Render Dashboard → `fanrenxiuxianzhuan` Web Service → **Settings** 中确认服务名为 `fanrenxiuxianzhuan`，子域名即由此生成。
- 如需自定义域名：Settings → Custom Domains 添加自有域名并配置 DNS CNAME。

---

## 常见问题

**Q: Web Service 启动报 `DATABASE_URL` 未定义？**
A: 检查 `fanren-db` PostgreSQL 是否已创建成功（状态 Available），`render.yaml` 中 `fromDatabase.name` 必须与数据库名 `fanren-db` 完全一致。

**Q: Cron Job 报 `python: command not found`？**
A: Render Python 运行时默认提供 `python3`，可尝试将 `command` 改为 `python3 crawler/bilibili.py`，或在 `buildCommand` 中创建软链。

**Q: 数据迁移脚本报 `Cannot find module 'pg'`？**
A: 本地执行 `npm install pg` 后再运行迁移脚本（项目依赖中已声明）。

**Q: 部署后页面 404？**
A: 确认 `pages/` 目录与 `assets/` 目录已提交到仓库，`render.yaml` 的 `rootDir` 为 `.`。
