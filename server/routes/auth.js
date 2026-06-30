// 注册 / 登录 / 当前用户
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { setSession, getSession, extractToken, requireUser } = require('../middleware/auth');

const router = express.Router();

const SALT = 'fanren-cultivation-2024';

// 简单哈希：sha256(盐 + 密码)
function hashPassword(password) {
  return crypto.createHash('sha256').update(SALT + password).digest('hex');
}

// 生成唯一 12 位数字 ID（随机，确保不重复）
async function genUserId() {
  for (let i = 0; i < 100; i++) {
    let id = '';
    for (let j = 0; j < 12; j++) id += Math.floor(Math.random() * 10);
    const row = await db.queryOne('SELECT id FROM users WHERE id = $1', [id]);
    if (!row) return id;
  }
  throw new Error('生成用户 ID 失败');
}

// 生成会话 token
function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/register
router.post('/register', wrap(async (req, res) => {
  const { phone, email, nickname, password } = req.body || {};
  // 校验
  if (!phone || !/^\d{11}$/.test(phone)) {
    return res.status(400).json({ error: '手机号必须为 11 位数字' });
  }
  if (!nickname || !String(nickname).trim()) {
    return res.status(400).json({ error: '昵称不能为空' });
  }
  if (!password || !String(password).trim()) {
    return res.status(400).json({ error: '密码不能为空' });
  }
  // 手机号唯一
  const exist = await db.queryOne('SELECT id FROM users WHERE phone = $1', [phone]);
  if (exist) return res.status(409).json({ error: '该手机号已注册' });

  const id = await genUserId();
  const created_at = new Date().toISOString();
  await db.query(
    'INSERT INTO users (id, phone, email, nickname, password, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, phone, email || null, String(nickname).trim(), hashPassword(password), created_at]
  );

  res.json({ id, nickname: String(nickname).trim() });
}));

// POST /api/login
router.post('/login', wrap(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: '标识与密码不能为空' });
  }
  const hash = hashPassword(password);
  // identifier 可为 phone / id / email
  const row = await db.queryOne(
    `SELECT id, phone, email, nickname, password FROM users
     WHERE phone = $1 OR id = $1 OR email = $1`,
    [identifier]
  );

  if (!row) return res.status(401).json({ error: '用户不存在' });
  if (row.password !== hash) return res.status(401).json({ error: '密码错误' });

  const token = genToken();
  setSession(token, row.id, row.nickname);
  res.json({ id: row.id, nickname: row.nickname, token });
}));

// GET /api/me
router.get('/me', wrap(async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: '未登录' });
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: '会话已过期' });
  const row = await db.queryOne(
    'SELECT id, phone, email, nickname, created_at FROM users WHERE id = $1',
    [session.userId]
  );
  if (!row) return res.status(401).json({ error: '用户不存在' });
  res.json({ id: row.id, phone: row.phone, email: row.email, nickname: row.nickname, created_at: row.created_at });
}));

// GET /api/logout （可选，清除会话）
router.post('/logout', (req, res) => {
  const token = extractToken(req);
  if (token) {
    const { clearSession } = require('../middleware/auth');
    clearSession(token);
  }
  res.json({ ok: true });
});

module.exports = router;
