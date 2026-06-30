// 反馈
const express = require('express');
const db = require('../db');
const { requireDev } = require('../middleware/auth');

const router = express.Router();

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/feedback  body { nickname, contact?, content, source }
router.post('/', wrap(async (req, res) => {
  const { nickname, contact, content, source } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '反馈内容不能为空' });
  }
  const ts = new Date().toISOString();
  const { rows } = await db.query(
    'INSERT INTO feedbacks (nickname, contact, content, source, ts, is_read) VALUES ($1,$2,$3,$4,$5,0) RETURNING id',
    [nickname || '匿名', contact || null, String(content).trim(), source || 'unknown', ts]
  );
  res.json({ id: rows[0].id });
}));

// GET /api/feedback 开发者用，返回全部反馈
router.get('/', requireDev, wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM feedbacks ORDER BY id DESC');
  res.json(rows);
}));

module.exports = router;
