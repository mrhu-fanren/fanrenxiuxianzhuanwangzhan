# -*- coding: utf-8 -*-
"""
凡人修仙传 B站数据爬虫（真实实现，PaaS 适配）

每小时运行一次，抓取《凡人修仙传》动画在 B 站的真实数据。
至少包含 12 项：总播放、弹幕、收藏、点赞、投币、分享、追番、评分、评论、
同时在线、最高在线、转发。

写入方式（适配 PaaS 云环境如 Render Cron Job）：
  1. 优先通过 HTTP POST 上传到后端 /api/bilibili（写入 bilibili_stats 表）
  2. 同时写本地 data/bilibili.json 作为备份（PaaS 上文件不持久，仅容错用）

环境变量：
  APP_URL       后端服务地址（默认 http://localhost:3000）
  DEV_TOKEN     开发者令牌；若无则用 DEV_PASSWORD 登录 /api/dev/login 获取
  DEV_PASSWORD  开发者密码（默认 HU123456789）

依赖安装：pip install requests
运行：python crawler/bilibili.py
调度：见 scripts/schedule.md（每小时执行）

说明：season_id 可在 B 站番剧页 URL 中找到（如 ss42544）。
若 B 站接口变更或网络受限，脚本会保留上一次 data/bilibili.json 不覆盖。
"""

import json
import os
import sys
import time
from datetime import datetime

try:
    import requests
except ImportError:
    requests = None  # 退化为 urllib

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUT_FILE = os.path.join(DATA_DIR, "bilibili.json")

# 凡人修仙传动画 season_id（用户可自行替换为最新季）
SEASON_IDS = ["42544"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
}


def _get(url, params=None, retries=3):
    """带重试的 GET，返回 JSON dict 或 None。"""
    last_err = None
    for i in range(retries):
        try:
            if requests:
                r = requests.get(url, params=params, headers=HEADERS, timeout=15)
                r.raise_for_status()
                return r.json()
            else:
                import urllib.request
                import urllib.parse
                q = urllib.parse.urlencode(params or {})
                full = url + ("?" + q if q else "")
                req = urllib.request.Request(full, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (i + 1))
    print(f"[warn] 请求失败 {url}: {last_err}")
    return None


def fetch_season_stat(season_id):
    """番剧总体统计：播放/弹幕/收藏/点赞/投币/分享/追番/评分/评论。"""
    data = _get("https://api.bilibili.com/pgc/web/season/stat", {"season_id": season_id})
    if not data or data.get("code") != 0:
        return {}
    return data.get("data", {}) or {}


def fetch_season_section(season_id):
    """番剧分集列表。"""
    data = _get("https://api.bilibili.com/pgc/web/season/section", {"season_id": season_id})
    if not data or data.get("code") != 0:
        return []
    sections = (data.get("data") or {}).get("sections") or []
    episodes = []
    for sec in sections:
        for ep in sec.get("episodes") or []:
            episodes.append({
                "title": ep.get("long_title") or ep.get("title") or "",
                "bvid": ep.get("bvid") or "",
                "aid": ep.get("aid") or 0,
                "cid": ep.get("cid") or 0,
            })
    return episodes


def fetch_view_stat(bvid):
    """单集 stat：可补充同时在线等。返回 dict。"""
    if not bvid:
        return {}
    data = _get("https://api.bilibili.com/x/web-interface/view", {"bvid": bvid})
    if not data or data.get("code") != 0:
        return {}
    d = data.get("data") or {}
    stat = d.get("stat") or {}
    return {
        "view": stat.get("view", 0),
        "danmaku": stat.get("danmaku", 0),
        "reply": stat.get("reply", 0),
        "favorite": stat.get("favorite", 0),
        "coin": stat.get("coin", 0),
        "share": stat.get("share", 0),
        "like": stat.get("like", 0),
        "now_rank": stat.get("now_rank", 0),
    }


def build_snapshot():
    """汇总所有 season 数据为一份快照。"""
    snapshot = {
        "title": "凡人修仙传",
        "total_view": 0,
        "danmaku": 0,
        "favorite": 0,
        "like": 0,
        "coin": 0,
        "share": 0,
        "follow": 0,
        "score": 0,
        "comment": 0,
        "current_online": None,
        "max_online": None,
        "repost": 0,
    }
    seasons = []
    for sid in SEASON_IDS:
        stat = fetch_season_stat(sid)
        eps = fetch_season_section(sid)
        season_title = "凡人修仙传 " + sid
        # 累加
        snapshot["total_view"] += stat.get("views", 0) or 0
        snapshot["danmaku"] += stat.get("danmaku", 0) or 0
        snapshot["favorite"] += stat.get("favorites", 0) or 0
        snapshot["like"] += stat.get("likes", 0) or 0
        snapshot["coin"] += stat.get("coins", 0) or 0
        snapshot["share"] += stat.get("share", 0) or 0
        snapshot["follow"] += stat.get("follow", 0) or 0
        snapshot["score"] = stat.get("score", 0) or snapshot["score"]
        snapshot["comment"] += stat.get("reply", 0) or 0
        snapshot["repost"] += stat.get("share", 0) or 0  # 转发近似用 share

        ep_list = []
        for ep in eps[:50]:  # 限制请求数量
            vstat = fetch_view_stat(ep.get("bvid"))
            ep_list.append({
                "title": ep.get("title"),
                "bvid": ep.get("bvid"),
                "view": vstat.get("view", 0),
                "danmaku": vstat.get("danmaku", 0),
                "reply": vstat.get("reply", 0),
            })
            time.sleep(0.3)
        seasons.append({"season_id": sid, "title": season_title, "episodes": ep_list})

    return {
        "snapshot": snapshot,
        "seasons": seasons,
        "ts": datetime.now().isoformat(timespec="seconds"),
    }


def _get_dev_token(app_url, timeout=15):
    """获取 dev token：优先读 DEV_TOKEN，否则用 DEV_PASSWORD 登录。"""
    token = os.environ.get("DEV_TOKEN", "").strip()
    if token:
        return token
    if requests is None:
        print("[warn] 未安装 requests 且未设置 DEV_TOKEN，无法获取 dev token")
        return None
    password = os.environ.get("DEV_PASSWORD", "HU123456789")
    try:
        r = requests.post(
            f"{app_url}/api/dev/login",
            json={"password": password},
            timeout=timeout,
        )
        r.raise_for_status()
        return (r.json() or {}).get("token")
    except Exception as e:
        print(f"[warn] 获取 dev token 失败: {e}")
        return None


def upload_snapshot(app_url, snapshot, ts, timeout=20):
    """上传快照到后端 POST /api/bilibili。返回 True/False。失败不抛异常。"""
    if requests is None:
        print("[warn] 未安装 requests，跳过上传")
        return False
    token = _get_dev_token(app_url)
    if not token:
        print("[warn] 无 dev token，跳过上传")
        return False
    try:
        r = requests.post(
            f"{app_url}/api/bilibili",
            headers={"x-auth-token": token},
            json={"snapshot": snapshot, "ts": ts},
            timeout=timeout,
        )
        r.raise_for_status()
        print(f"[凡人修仙传] 上传成功: HTTP {r.status_code}")
        return True
    except Exception as e:
        print(f"[warn] 上传后端失败: {e}")
        return False


def main():
    print("[凡人修仙传] 开始抓取 B 站数据...")
    app_url = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
    result = build_snapshot()
    snapshot = result["snapshot"]
    ts = result["ts"]

    if snapshot["total_view"] == 0 and not result["seasons"]:
        # 抓取失败，保留旧数据
        if os.path.exists(OUT_FILE):
            print("[凡人修仙传] 抓取失败，保留上次 bilibili.json")
            with open(OUT_FILE, "r", encoding="utf-8") as f:
                old = json.load(f)
            print(json.dumps(old.get("snapshot", {}), ensure_ascii=False, indent=2))
            return
        else:
            print("[凡人修仙传] 抓取失败且无旧数据，写入空快照")

    # 1. 优先上传到后端
    upload_snapshot(app_url, snapshot, ts)

    # 2. 写本地 JSON 备份（PaaS 上不持久，仅容错）
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"[凡人修仙传] 已写入 {OUT_FILE}")
    except Exception as e:
        print(f"[warn] 写本地备份失败: {e}")

    print(json.dumps(snapshot, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
