// 会话校验中间件
// 普通用户会话存储于内存（token -> userId），开发者会话存于 dev_sessions 表
const db = require('../db');

// 简易内存会话表：token -> { userId, nickname, ts }
const sessions = new Map();

function setSession(token, userId, nickname) {
  sessions.set(token, { userId, nickname, ts: Date.now() });
}

function getSession(token) {
  return sessions.get(token) || null;
}

function clearSession(token) {
  sessions.delete(token);
}

// 从请求中提取 Bearer token
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-auth-token'] || null;
}

// 普通用户校验（内存会话，保持同步）
function requireUser(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: '未登录' });
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: '会话已过期，请重新登录' });
  req.user = { id: session.userId, nickname: session.nickname, token };
  next();
}

// 开发者校验（异步查 dev_sessions 表）
async function requireDev(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: '需要开发者权限' });
    const { rows } = await db.query(
      'SELECT token, ts FROM dev_sessions WHERE token = $1',
      [token]
    );
    if (!rows.length) return res.status(403).json({ error: '开发者令牌无效' });
    req.dev = { token: rows[0].token };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireUser,
  requireDev,
  setSession,
  getSession,
  clearSession,
  extractToken,
};
