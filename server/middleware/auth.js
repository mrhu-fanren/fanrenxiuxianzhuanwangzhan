// 会话校验中间件
// 普通用户会话存储于数据库 sessions 表（Serverless 兼容，无内存依赖），
// 开发者会话存于 dev_sessions 表
const db = require('../db');

// 会话有效期 7 天（毫秒）
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 写入 / 更新会话（UPSERT）。token 已存在则刷新 user_id/nickname/ts
async function setSession(token, userId, nickname) {
  const ts = new Date().toISOString();
  await db.query(
    `INSERT INTO sessions (token, user_id, nickname, ts) VALUES ($1,$2,$3,$4)
     ON CONFLICT (token) DO UPDATE SET user_id=$2, nickname=$3, ts=$4`,
    [token, userId, nickname, ts]
  );
}

// 读取会话；过期则删除并返回 null
async function getSession(token) {
  const row = await db.queryOne(
    'SELECT user_id, nickname, ts FROM sessions WHERE token=$1',
    [token]
  );
  if (!row) return null;
  const ts = Date.parse(row.ts);
  if (Number.isNaN(ts) || Date.now() - ts > SESSION_TTL_MS) {
    await clearSession(token);
    return null;
  }
  return { userId: row.user_id, nickname: row.nickname, ts };
}

// 删除会话
async function clearSession(token) {
  await db.query('DELETE FROM sessions WHERE token=$1', [token]);
}

// 清理过期会话（登录时顺带调用，避免 sessions 表无限膨胀）
async function cleanExpiredSessions() {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  await db.query('DELETE FROM sessions WHERE ts < $1', [cutoff]);
}

// 从请求中提取 Bearer token
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-auth-token'] || null;
}

// async 路由错误捕获包装
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 普通用户校验（数据库会话，异步）
const requireUser = wrap(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: '未登录' });
  const session = await getSession(token);
  if (!session) return res.status(401).json({ error: '会话已过期，请重新登录' });
  req.user = { id: session.userId, nickname: session.nickname, token };
  next();
});

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
  cleanExpiredSessions,
};
