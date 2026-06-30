// 浏览 / 行为埋点统计
const express = require('express');
const db = require('../db');
const { requireDev } = require('../middleware/auth');

const router = express.Router();

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 解析 snapshot 字段：pg 的 JSONB 已是对象，sqlite 返回字符串
function parseSnapshot(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

// POST /api/stats/view  body { board, page, user_id? }
router.post('/view', wrap(async (req, res) => {
  const { board, page, user_id } = req.body || {};
  if (!board && !page) return res.status(400).json({ error: '缺少 board/page' });
  const ts = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  await db.query(
    'INSERT INTO views (user_id, board, page, ts, ip) VALUES ($1,$2,$3,$4,$5)',
    [user_id || null, board || null, page || null, ts, ip]
  );
  res.json({ ok: true });
}));

// GET /api/stats/bilibili 返回最新 B 站快照
router.get('/bilibili', wrap(async (req, res) => {
  const row = await db.queryOne(
    'SELECT id, snapshot, ts FROM bilibili_stats ORDER BY id DESC LIMIT 1'
  );
  if (!row) return res.json({ snapshot: null, ts: null });
  res.json({ id: row.id, snapshot: parseSnapshot(row.snapshot), ts: row.ts });
}));

module.exports = router;
