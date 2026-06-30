# Vercel + Neon 部署说明

本文档说明如何将「凡人修仙传粉丝网站」部署到 [Vercel](https://vercel.com)（Serverless Functions 托管）+ [Neon](https://neon.tech)（Serverless PostgreSQL）。
两个服务均提供免费层且**无需绑定信用卡**，适合个人粉丝站点长期运行。

项目已改造为 Serverless 兼容：
- `api/index.js` 导出 Express app，由 Vercel 作为 Serverless Function 运行
- 会话存储到数据库（不依赖内存/文件 session）
- `better-sqlite3` 为 optional 依赖，生产环境使用 PostgreSQL（`pg`）
- 静态文件（`pages/` HTML、`assets/` CSS/JS、`data/` JSON 内容数据）由 Vercel 直接托管

---

## 架构概览

| 组件 | 平台 | 作用 | 备注 |
| --- | --- | --- | --- |
| Serverless Function | Vercel | `api/index.js` 承载 Express 全部路由 | 10 秒超时 |
| 静态资源 | Vercel CDN | `pages/` `assets/` `data/` 直接托管 | 走 `routes` 规则 |
| PostgreSQL | Neon | 用户/评论/浏览/反馈/会话/B站快照 | 0.5GB 免费 |
| Cron bilibili | Vercel Cron | 每日 0 点（UTC）= 北京 08:00 抓取 B 站 | 免费层每日 1 次 |
| Cron spam | Vercel Cron | 每日 19 点（UTC）= 北京 03:00 清理垃圾评论 | 免费层每日 1 次 |

> ⚠️ Vercel Hobby（免费）Cron **只支持每天执行一次**，不支持每小时。若需每小时抓取 B 站，请见下文「B站数据每小时更新（免费方案）」使用外部调度。

---

## 部署步骤

### 1. 创建 Neon PostgreSQL（免费不绑卡）

1. 访问 https://neon.tech 注册账号（可用 GitHub 登录）。
2. 创建新项目：Dashboard → **Create Project** → 选择 **Free** 计划（0.5GB 存储，不绑卡）。
3. 区域建议选 `AWS Asia Pacific (Singapore)` 以降低国内访问延迟。
4. 创建完成后，在项目 **Dashboard** 或 **Connection Details** 页面复制 **Connection string**，形如：
   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
5. 将该连接串**妥善保存**，下一步配置 Vercel 时需要用到。

> Neon 免费层：0.5GB 存储，计算时间有上限，**不绑卡**。项目 5 分钟无活动会自动挂起，下次请求自动唤醒（冷启动约 1-3 秒）。

---

### 2. 部署到 Vercel（免费不绑卡）

1. 访问 https://vercel.com 注册账号（可用 GitHub 登录）。
2. 先将项目推送到 GitHub 仓库（如 `mrhu-fanren/fanrenxiuxianzhuanwangzhan`）：
   ```bash
   git init
   git add .
   git commit -m "feat: 凡人修仙传粉丝网站初始化"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/fanrenxiuxianzhuanwangzhan.git
   git push -u origin main
   ```
3. 在 Vercel Dashboard 点击 **Add New** → **Project** → 导入 GitHub 仓库 `mrhu-fanren/fanrenxiuxianzhuanwangzhan`。
4. Vercel 会自动识别根目录的 `vercel.json`，识别出 3 个 Serverless Function（`api/index.js`、`api/cron/bilibili.js`、`api/cron/spam.js`）。
5. 在 **Environment Variables** 中配置：
   | 变量名 | 值 | 说明 |
   | --- | --- | --- |
   | `DATABASE_URL` | Neon 的 connection string | 数据库连接串 |
   | `DEV_PASSWORD` | `HU123456789` | 开发者面板密码 |
6. 点击 **Deploy**，等待构建完成（通常 1-2 分钟）。
7. 部署成功后获得公网地址，形如：
   ```
   https://fanrenxiuxianzhuanwangzhan.vercel.app
   ```
   （或在 Vercel 项目 Settings → Domains 中自定义项目名/域名）

---

### 3. 数据库初始化

- **首次部署后**：`api/index.js` 在 Serverless Function 冷启动时会调用 `initDb()` 自动建表（users / comments / views / feedbacks / dev_sessions / bilibili_stats 等）。无需手动操作。
- **若需迁移本地 SQLite 历史数据**：在**本地终端**执行：
  ```bash
  DATABASE_URL=<Neon连接串> node scripts/migrate-to-postgres.js
  ```
  脚本会从本地 `data/app.db` 读取全部数据，幂等写入 Neon PostgreSQL，并打印各表迁移条数。
- 若是全新站点无历史数据，可跳过迁移步骤，表会在首次写入时自动创建。

---

### 4. B站数据每小时更新（免费方案）

Vercel 免费层 cron 只支持**每天一次**（`vercel.json` 中配置的 `0 0 * * *` = 北京 08:00 每日跑一次）。
若需要**每小时**抓取 B 站数据，使用外部免费调度服务触发 `/api/cron/bilibili` 接口：

#### 方案 A：cron-job.org（推荐，免费不绑卡）

1. 访问 https://cron-job.org 注册账号（免费）。
2. Dashboard → **CREATE CRONJOB**。
3. 配置：
   - **Title**：`fanren-bilibili-hourly`
   - **URL**：`https://你的vercel域名/api/cron/bilibili`
   - **Execution Schedule**：选 `Every hour`（或自定义 `0 * * * *`）
   - **Request Method**：`GET`（接口无鉴权，直接 GET 即可）
4. 保存即可。cron-job.org 会每小时整点请求该接口，触发 B 站数据抓取。

#### 方案 B：UptimeRobot（免费）

1. 访问 https://uptimerobot.com 注册（免费计划支持 50 个监控）。
2. Add New Monitor → Monitor Type 选 `HTTP(s)`。
3. URL 填 `https://你的vercel域名/api/cron/bilibili`。
4. Monitoring Interval 选 `Every hour`（或 30 分钟）。
5. 保存即可。UptimeRobot 会定时 ping 该接口。

> 两种方案均免费、无需绑卡，且不占用 Vercel Cron 配额（`vercel.json` 中的 bilibili cron 可保留作为兜底每日跑一次）。

---

### 5. 访问验证

部署完成后，按以下步骤验证：

1. 浏览器打开 Vercel 域名（如 `https://fanrenxiuxianzhuanwangzhan.vercel.app`），首页应正常加载。
2. 测试核心功能：
   - **注册/登录**：访问 `login.html` / `register.html`，注册账号并登录。
   - **评论**：在任意内容页（如 `characters.html`）提交评论，刷新后应能看到。
   - **开发者面板**：导航 → 开发者模式，输入密码 `HU123456789` 进入 `dev-panel.html`，确认统计数据写入正常。
3. 测试 API 健康检查：访问 `https://你的域名/api/health` → 应返回 `{"ok":true,"ts":"..."}`。
4. 测试 B站数据接口：访问 `https://你的域名/api/cron/bilibili` → 应触发抓取并返回成功。

---

### 6. 免费层限制说明

| 平台 | 资源 | 限制 | 影响 |
| --- | --- | --- | --- |
| Vercel Hobby | 带宽 | 每月 100GB | 超出需升级 Pro |
| Vercel Hobby | Serverless 函数超时 | 10 秒 | 长耗时爬虫需拆分或外部触发 |
| Vercel Hobby | Cron Job | 每天最多 2 个，每个最少每天 1 次 | 不支持每小时，需外部调度 |
| Vercel Hobby | 函数执行次数 | 每月 100,000 次 | 高频访问可能触顶 |
| Neon Free | 存储 | 0.5GB | 个人站点足够 |
| Neon Free | 计算时间 | 每月约 1919 小时 | 通常足够 |
| Neon Free | 自动挂起 | 5 分钟无活动挂起 | 下次请求冷启动 1-3 秒 |

- 两个平台均**无需绑定信用卡**。
- 域名：`xxx.vercel.app` 免费子域名，可在 Vercel Settings → Domains 绑定自有域名。
- 长期运营若流量增长，建议升级 Vercel Pro（$20/月）解锁每小时 cron 与更长超时。

---

## 常见问题

**Q: 部署后访问页面 404？**
A: 检查 `pages/`、`assets/`、`data/` 目录是否已提交到 GitHub 仓库，`vercel.json` 的 `routes` 规则依赖这些静态文件存在。

**Q: API 返回 500 / 数据库连接失败？**
A: 检查 Vercel 项目 Settings → Environment Variables 中 `DATABASE_URL` 是否为 Neon 连接串（必须包含 `?sslmode=require`），且 Neon 项目处于 Active 状态。

**Q: Neon 数据库冷启动慢？**
A: Neon 免费层 5 分钟无活动会挂起，首次请求需 1-3 秒唤醒。可在 cron-job.org 配置一个每 5 分钟 ping `/api/health` 的任务保持唤醒（但会消耗计算时间额度）。

**Q: B站数据每小时没更新？**
A: Vercel 免费层 cron 不支持每小时，需按上文「B站数据每小时更新（免费方案）」配置 cron-job.org 或 UptimeRobot 外部触发。

**Q: 数据迁移脚本报 `Cannot find module 'pg'`？**
A: 本地执行 `npm install pg` 后再运行迁移脚本（项目依赖中已声明 `pg`）。

**Q: 想修改 cron 执行时间？**
A: 编辑 `vercel.json` 的 `crons[].schedule` 字段（5 字段 Unix cron：分 时 日 月 周，**UTC 时区**）。北京时区 = UTC + 8。例如北京 03:00 = UTC 19:00 前一天，写成 `0 19 * * *`。

---

## 时区速查

| 北京时间 | UTC（vercel.json 写法） |
| --- | --- |
| 00:00 | `0 16 * * *`（前一天） |
| 03:00 | `0 19 * * *`（前一天） |
| 08:00 | `0 0 * * *` |
| 12:00 | `0 4 * * *` |
