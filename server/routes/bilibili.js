// B站数据读取
const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireDev } = require('../middleware/auth');

const router = express.Router();

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 读取 data/bilibili.json 作为兜底数据
function loadFallback() {
  try {
    const p = path.join(__dirname, '..', '..', 'data', 'bilibili.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) { /* ignore */ }
  return null;
}

// 解析 snapshot 字段：pg 的 JSONB 已是对象，sqlite 返回字符串
function parseSnapshot(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

// GET /api/bilibili 返回最新 B 站快照（优先 DB，兜底 JSON）
router.get('/', wrap(async (req, res) => {
  const row = await db.queryOne(
    'SELECT id, snapshot, ts FROM bilibili_stats ORDER BY id DESC LIMIT 1'
  );
  if (row) {
    return res.json({ id: row.id, snapshot: parseSnapshot(row.snapshot), ts: row.ts, source: 'db' });
  }
  const fb = loadFallback();
  res.json({ id: null, snapshot: fb, ts: null, source: 'fallback' });
}));

// POST /api/bilibili 开发者用，手动写入一条快照
router.post('/', requireDev, wrap(async (req, res) => {
  const snapshot = req.body || {};
  const ts = new Date().toISOString();
  // pg 用 $1::jsonb 显式 cast；sqlite 模式由 db.js 封装层去掉 ::jsonb
  const { rows } = await db.query(
    'INSERT INTO bilibili_stats (snapshot, ts) VALUES ($1::jsonb, $2) RETURNING id',
    [JSON.stringify(snapshot), ts]
  );
  res.json({ id: rows[0].id, ts });
}));

module.exports = router;
