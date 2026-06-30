// 评论：长评 / 短评 / 留言
const express = require('express');
const db = require('../db');
const { requireDev } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// 限流策略（参考站机制：每分钟最多 3 条评论）
// 评论：每分钟 3 条
const commentLimiter = createRateLimit({
  windowMs: 60000,
  max: 3,
  message: '评论过于频繁，请稍后再试',
});

// 点赞：每分钟 10 次（当前无点赞接口，未来新增时启用）
// const likeLimiter = createRateLimit({
//   windowMs: 60000,
//   max: 10,
//   message: '点赞过于频繁，请稍后再试',
// });

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 简单垃圾词过滤（前端隐藏，开发者可见）
const SPAM_KEYWORDS = ['广告', '代刷', '加微信', '色情', 'http://', 'https://', '赌博', '兼职'];

function isSpamContent(content) {
  if (!content) return false;
  const lower = String(content).toLowerCase();
  return SPAM_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

// 生成随机 12 位数字 long_id
async function genLongId() {
  for (let i = 0; i < 100; i++) {
    let id = '';
    for (let j = 0; j < 12; j++) id += Math.floor(Math.random() * 10);
    const row = await db.queryOne('SELECT id FROM comments WHERE long_id = $1', [id]);
    if (!row) return id;
  }
  throw new Error('生成 long_id 失败');
}

// POST /api/comments （每分钟限 3 条，第 4 条返回 429）
router.post('/', commentLimiter, wrap(async (req, res) => {
  const { type, nickname, content, contact, board, user_id } = req.body || {};
  if (!type || !['short', 'long'].includes(type)) {
    return res.status(400).json({ error: '评论类型无效' });
  }
  if (!nickname || !String(nickname).trim()) {
    return res.status(400).json({ error: '昵称不能为空' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  let long_id = null;
  if (type === 'long') {
    // 长评需 contact（手机号或邮箱）
    if (!contact || !String(contact).trim()) {
      return res.status(400).json({ error: '长评需提供手机号或邮箱' });
    }
    long_id = await genLongId();
  }

  const ts = new Date().toISOString();
  const spam = isSpamContent(content) ? 1 : 0;
  const { rows } = await db.query(
    `INSERT INTO comments (type, nickname, content, contact, long_id, board, ts, is_spam, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, long_id, is_spam`,
    [type, String(nickname).trim(), String(content).trim(), contact || null, long_id, board || null, ts, spam, user_id || null]
  );

  const row = rows[0];
  res.json({ id: row.id, long_id: row.long_id, is_spam: row.is_spam });
}));

// GET /api/comments?board=&type=
router.get('/', wrap(async (req, res) => {
  const { board, type } = req.query;
  let sql = 'SELECT id, type, nickname, content, long_id, board, ts FROM comments WHERE is_spam = 0';
  const params = [];
  if (board) { params.push(board); sql += ` AND board = $${params.length}`; }
  if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
  sql += ' ORDER BY id DESC LIMIT 200';
  const { rows } = await db.query(sql, params);
  res.json(rows);
}));

// GET /api/comments/all （开发者用，含垃圾标记）
router.get('/all', requireDev, wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, type, nickname, content, contact, long_id, board, ts, is_spam, user_id FROM comments ORDER BY id DESC LIMIT 500'
  );
  res.json(rows);
}));

// POST /api/comments/:id/spam （开发者用，标记垃圾评论）
router.post('/:id/spam', requireDev, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: '无效的评论 id' });
  const { rows } = await db.query(
    'UPDATE comments SET is_spam = 1 WHERE id = $1 RETURNING id, is_spam',
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: '评论不存在' });
  res.json({ ok: true, id: rows[0].id, is_spam: rows[0].is_spam });
}));

module.exports = router;
