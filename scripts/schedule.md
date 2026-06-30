# 定时任务调度说明

本项目爬虫支持两套调度方式：

- **本地**：Windows 计划任务（schtasks）
- **云端（PaaS）**：Render Cron Job（文件系统不持久、无本地 SQLite，已通过 HTTP API 上传/操作数据）

爬虫依赖环境变量：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_URL` | 后端服务地址 | `http://localhost:3000` |
| `DEV_PASSWORD` | 开发者密码（用于登录 `/api/dev/login` 拿 token） | `HU123456789` |
| `DEV_TOKEN` | 直接提供 dev token（可选，bilibili.py 专用，设置后跳过登录） | 无 |

---

## 1. B 站数据爬虫（每小时运行）

每小时抓取一次《凡人修仙传》动画 B 站真实数据，优先 POST 上传到后端 `/api/bilibili`，同时写本地 `data/bilibili.json` 作为备份。

### 本地：Windows 计划任务

```bat
schtasks /create /tn "FanrenBilibili" /tr "python C:\Users\mr hu\OneDrive\Desktop\凡人修仙传\crawler\bilibili.py" /sc hourly /st 00:00 /f
```

查询 / 删除：

```bat
schtasks /query /tn "FanrenBilibili"
schtasks /delete /tn "FanrenBilibili" /f
```

### 云端：Render Cron Job

在 Render 控制台新建 Cron Job：

- **Name**：`fanren-bilibili`
- **Command**：`python crawler/bilibili.py`
- **Schedule**：`0 * * * *`（每小时整点运行）
- **环境变量**：
  - `APP_URL` = `https://fanrenxiuxianzhuan.onrender.com`
  - `DEV_PASSWORD` = `HU123456789`（或自定义）
  - （可选）`DEV_TOKEN` = 直接注入令牌，跳过登录

`render.yaml` 配置示例：

```yaml
services:
  - type: cron
    name: fanren-bilibili
    schedule: "0 * * * *"
    runtime: python
    buildCommand: pip install -r crawler/requirements.txt
    startCommand: python crawler/bilibili.py
    envVars:
      - key: APP_URL
        value: https://fanrenxiuxianzhuan.onrender.com
      - key: DEV_PASSWORD
        value: HU123456789
```

---

## 2. 垃圾评论屏蔽（每日运行）

每日 03:00 通过后端 API 拉取全部评论，识别垃圾评论并调用 `POST /api/comments/:id/spam` 屏蔽。

> 依赖后端接口 `POST /api/comments/:id/spam`（由后端改造 agent 提供）。

### 本地：Windows 计划任务

```bat
schtasks /create /tn "FanrenSpamFilter" /tr "python C:\Users\mr hu\OneDrive\Desktop\凡人修仙传\crawler\spam_filter.py" /sc daily /st 03:00 /f
```

查询 / 删除：

```bat
schtasks /query /tn "FanrenSpamFilter"
schtasks /delete /tn "FanrenSpamFilter" /f
```

### 云端：Render Cron Job

- **Name**：`fanren-spam-filter`
- **Command**：`python crawler/spam_filter.py`
- **Schedule**：`0 19 * * *`（UTC 19:00 = 北京时间次日 03:00）
- **环境变量**：
  - `APP_URL` = `https://fanrenxiuxianzhuan.onrender.com`
  - `DEV_PASSWORD` = `HU123456789`

> 注意：Render Cron Job 使用 **UTC 时区**。北京时间 03:00 对应 UTC 19:00（前一天），故 schedule 写 `0 19 * * *`。

`render.yaml` 配置示例：

```yaml
services:
  - type: cron
    name: fanren-spam-filter
    schedule: "0 19 * * *"
    runtime: python
    buildCommand: pip install -r crawler/requirements.txt
    startCommand: python crawler/spam_filter.py
    envVars:
      - key: APP_URL
        value: https://fanrenxiuxianzhuan.onrender.com
      - key: DEV_PASSWORD
        value: HU123456789
```

---

## 3. 手动运行

### 本地

```bat
cd C:\Users\mr hu\OneDrive\Desktop\凡人修仙传
pip install -r crawler\requirements.txt
python crawler\bilibili.py
python crawler\spam_filter.py
```

### 云端（Render Shell）

在 Render 的 Web Service（后端）Shell 中也可手动触发爬虫调试：

```bash
pip install -r crawler/requirements.txt
APP_URL=https://fanrenxiuxianzhuan.onrender.com DEV_PASSWORD=HU123456789 python crawler/bilibili.py
```

---

## 4. 依赖

```bat
pip install -r crawler\requirements.txt
```

`crawler/requirements.txt` 内容：

```
requests>=2.31.0
```

---

## 5. 容错说明

- 爬虫上传失败 / API 失败均不会中断脚本，仅打印日志；
- bilibili.py 上传失败时仍会写本地 `data/bilibili.json` 备份；
- 抓取失败时保留上一次 `data/bilibili.json` 不覆盖；
- spam_filter.py 单条屏蔽失败不影响后续评论处理。
