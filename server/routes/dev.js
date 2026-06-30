// 开发者面板数据
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireDev } = require('../middleware/auth');

const router = express.Router();

const DEV_PASSWORD = 'HU123456789';

function genDevToken() {
  return crypto.randomBytes(24).toString('hex');
}

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

// POST /api/dev/login  body { password }
router.post('/login', wrap(async (req, res) => {
  const { password } = req.body || {};
  if (password !== DEV_PASSWORD) {
    return res.status(401).json({ error: '开发者密码错误' });
  }
  const token = genDevToken();
  const ts = new Date().toISOString();
  await db.query('INSERT INTO dev_sessions (token, ts) VALUES ($1,$2)', [token, ts]);
  res.json({ token });
}));

// GET /api/dev/stats 综合统计
router.get('/stats', requireDev, wrap(async (req, res) => {
  // 注册用户
  const { rows: users } = await db.query(
    'SELECT id, phone, email, nickname, created_at FROM users ORDER BY created_at DESC'
  );
  const registeredUsers = { count: users.length, list: users };

  // 浏览量：总计 + 各 board 明细
  const totalViewsRow = await db.queryOne('SELECT COUNT(*) AS c FROM views');
  const { rows: boardRows } = await db.query(
    'SELECT board, COUNT(*) AS c FROM views GROUP BY board ORDER BY c DESC'
  );
  const totalViews = {
    total: Number(totalViewsRow.c),
    boards: boardRows.map((r) => ({ board: r.board, count: Number(r.c) })),
  };

  // 评论统计：总数 + 按时间
  const commentTotalRow = await db.queryOne('SELECT COUNT(*) AS c FROM comments');
  const commentSpamRow = await db.queryOne('SELECT COUNT(*) AS c FROM comments WHERE is_spam = 1');
  const { rows: recentComments } = await db.query(
    'SELECT id, type, nickname, content, board, ts, is_spam FROM comments ORDER BY id DESC LIMIT 100'
  );
  const commentStats = {
    total: Number(commentTotalRow.c),
    spam: Number(commentSpamRow.c),
    recent: recentComments,
  };

  // 反馈
  const { rows: feedbacks } = await db.query('SELECT * FROM feedbacks ORDER BY id DESC');

  // B站最新快照
  const biliRow = await db.queryOne(
    'SELECT id, snapshot, ts FROM bilibili_stats ORDER BY id DESC LIMIT 1'
  );
  let bilibili = { id: null, snapshot: null, ts: null };
  if (biliRow) {
    bilibili = { id: biliRow.id, snapshot: parseSnapshot(biliRow.snapshot), ts: biliRow.ts };
  }

  res.json({
    registeredUsers,
    totalViews,
    commentStats,
    feedbacks,
    bilibili,
  });
}));

// GET /api/dev/users 用户登录数据（手机号/邮箱/ID）
router.get('/users', requireDev, wrap(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, phone, email, nickname, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(rows);
}));

// GET /api/dev/views/:board 某板块浏览详情
router.get('/views/:board', requireDev, wrap(async (req, res) => {
  const { board } = req.params;
  const countRow = await db.queryOne('SELECT COUNT(*) AS c FROM views WHERE board = $1', [board]);
  const { rows } = await db.query(
    'SELECT id, user_id, board, page, ts, ip FROM views WHERE board = $1 ORDER BY id DESC LIMIT 200',
    [board]
  );
  res.json({ board, count: Number(countRow.c), list: rows });
}));

module.exports = router;
