# -*- coding: utf-8 -*-
"""
垃圾评论自动屏蔽脚本（PaaS 适配版）

每日运行一次，通过后端 API 获取全部评论（含 is_spam=0），
识别垃圾评论（广告/色情/赌博/外链/刷屏等）并调用后端接口将其 is_spam 置为 1。

PaaS（Render 等）上无本地 SQLite，故改为调用后端 API：
  GET  /api/comments/all       获取全部评论（含已标记垃圾，需 dev token）
  POST /api/comments/:id/spam  将指定评论 is_spam 置 1（需 dev token）

环境变量：
  APP_URL       后端服务地址（默认 http://localhost:3000）
  DEV_PASSWORD  开发者密码（默认 HU123456789）

依赖：requests (见 crawler/requirements.txt)
运行：python crawler/spam_filter.py
调度：见 scripts/schedule.md（每日 03:00 执行）

注意：本脚本依赖后端新增 POST /api/comments/:id/spam 接口，
      该接口由后端改造 agent 负责实现。
"""

import os
import re
from collections import defaultdict

import requests

APP_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
DEV_PASSWORD = os.environ.get("DEV_PASSWORD", "HU123456789")

SPAM_KEYWORDS = [
    "加微信", "加qq", "加Q", "免费看", "色情", "博彩", "六合彩", "代理",
    "出售", "代刷", "兼职", "刷单", "推广", "招商", "投资理财", "日赚",
    "http://", "https://", "www.", ".com", ".cn", "qq群号", "微信号",
    "澳门", "赌场", "裸聊", "一夜暴富", "稳赚", "零投资", "扫码",
    "低价代", "外挂", "辅助", "刷钻", "刷赞",
]


def is_spam(content, freq_count):
    """判断单条评论是否为垃圾。freq_count 为该内容出现次数。"""
    if not content:
        return False
    low = content.lower()
    # 1. 关键词命中
    for kw in SPAM_KEYWORDS:
        if kw.lower() in low:
            return True
    # 2. 纯重复字符超长（连续 20+ 相同字符）
    if re.search(r"(.)\1{19,}", content):
        return True
    # 3. 内容过短且含链接特征
    if len(content) < 4 and ("http" in low or "www" in low or ".com" in low):
        return True
    # 4. 同内容刷屏（同一内容出现 5+ 次）
    if freq_count >= 5:
        return True
    return False


def _get_dev_token(timeout=15):
    """用 DEV_PASSWORD 登录 /api/dev/login 获取 dev token。"""
    try:
        r = requests.post(
            f"{APP_URL}/api/dev/login",
            json={"password": DEV_PASSWORD},
            timeout=timeout,
        )
        r.raise_for_status()
        return (r.json() or {}).get("token")
    except Exception as e:
        print(f"[spam_filter] 获取 dev token 失败: {e}")
        return None


def _mark_spam(token, comment_id, timeout=15):
    """调用 POST /api/comments/:id/spam 将评论置为垃圾。失败不抛异常。"""
    try:
        r = requests.post(
            f"{APP_URL}/api/comments/{comment_id}/spam",
            headers={"x-auth-token": token},
            timeout=timeout,
        )
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"[spam_filter] 屏蔽评论 id={comment_id} 失败: {e}")
        return False


def main():
    token = _get_dev_token()
    if not token:
        print("[spam_filter] 无 dev token，退出")
        return

    # 获取全部评论（含 is_spam=0 与已标记的）
    try:
        r = requests.get(
            f"{APP_URL}/api/comments/all",
            headers={"x-auth-token": token},
            timeout=30,
        )
        r.raise_for_status()
        comments = r.json()
    except Exception as e:
        print(f"[spam_filter] 获取评论失败: {e}")
        return

    if not isinstance(comments, list):
        print(f"[spam_filter] 评论数据格式异常: {type(comments).__name__}")
        return

    # 统计内容频次
    freq = defaultdict(int)
    for c in comments:
        freq[(c.get("content") or "").strip()] += 1

    blocked = 0
    examples = []
    for c in comments:
        # 跳过已标记为垃圾的
        if c.get("is_spam"):
            continue
        _id = c.get("id")
        content = (c.get("content") or "").strip()
        if not _id:
            continue
        if is_spam(content, freq.get(content, 0)):
            if _mark_spam(token, _id):
                blocked += 1
                if len(examples) < 5:
                    examples.append((_id, content[:40]))

    print(f"[spam_filter] 扫描 {len(comments)} 条，屏蔽 {blocked} 条")
    for _id, ex in examples:
        print(f"  - id={_id}: {ex}")


if __name__ == "__main__":
    main()
