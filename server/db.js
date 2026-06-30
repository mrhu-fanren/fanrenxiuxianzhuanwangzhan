// 数据库统一接口层（双模式）
// - 若 process.env.DATABASE_URL 存在 → 用 pg (PostgreSQL)，适配 Render 等 PaaS
// - 否则 → 用 better-sqlite3 (本地开发模式)，行为与原版完全一致
const path = require('path');
const fs = require('fs');

const USE_PG = !!process.env.DATABASE_URL;

let pool = null;
let sqliteDb = null;

if (USE_PG) {
  // PostgreSQL 模式
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Render 需要
  });
} else {
  // SQLite 模式：保持原状
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'app.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
}

function isPg() {
  return USE_PG;
}

// 将 pg 风格的 $1,$2... 占位符转为 sqlite 的 ?
// 同时去掉 pg 的类型cast（如 ::jsonb），sqlite 不需要
function toSqliteSql(sql) {
  return sql.replace(/\$(\d+)/g, '?').replace(/::\w+/g, '');
}

// SQLite 模式下，$N 占位符可重复引用同一参数（如 WHERE phone=$1 OR id=$1），
// 但 better-sqlite3 的 ? 占位符需要一一对应。此函数按原 $N 索引展开 params。
// 输入：原始 pg 风格 sql（含 $N）与 params 数组；输出：与 ? 数量一致的 params 数组。
function expandParamsForSqlite(originalSql, params) {
  const matches = originalSql.match(/\$(\d+)/g) || [];
  if (matches.length === 0) return params;
  return matches.map((m) => {
    const idx = Number(m.slice(1)) - 1;
    return params[idx];
  });
}

// 统一查询接口：返回 { rows }
// - pg 模式：直接 pool.query
// - sqlite 模式：根据 SQL 类型分发到 .all / .get / .run
async function query(sql, params = []) {
  if (USE_PG) {
    const result = await pool.query(sql, params);
    return { rows: result.rows };
  }

  // sqlite 模式
  const converted = toSqliteSql(sql);
  const expandedParams = expandParamsForSqlite(sql, params);
  const head = converted.trimStart().toUpperCase();

  if (head.startsWith('SELECT') || head.startsWith('WITH')) {
    const rows = sqliteDb.prepare(converted).all(...expandedParams);
    return { rows };
  }

  // INSERT / UPDATE / DELETE
  if (/\bRETURNING\b/i.test(converted)) {
    // SQLite 3.35+ 支持 RETURNING，better-sqlite3 v12 已内置
    const row = sqliteDb.prepare(converted).get(...expandedParams);
    return { rows: row ? [row] : [] };
  }

  const info = sqliteDb.prepare(converted).run(...expandedParams);
  return { rows: [], insertId: info.lastInsertRowid, changes: info.changes };
}

// 辅助：返回第一行或 null
async function queryOne(sql, params = []) {
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

// 异步初始化建表
async function initDb() {
  if (USE_PG) {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE, email TEXT, nickname TEXT, password TEXT, created_at TEXT)`,
      `CREATE TABLE IF NOT EXISTS views (id SERIAL PRIMARY KEY, user_id TEXT, board TEXT, page TEXT, ts TEXT, ip TEXT)`,
      `CREATE TABLE IF NOT EXISTS comments (id SERIAL PRIMARY KEY, type TEXT, nickname TEXT, content TEXT, contact TEXT, long_id TEXT, board TEXT, ts TEXT, is_spam INTEGER DEFAULT 0, user_id TEXT)`,
      `CREATE TABLE IF NOT EXISTS feedbacks (id SERIAL PRIMARY KEY, nickname TEXT, contact TEXT, content TEXT, source TEXT, ts TEXT, is_read INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS dev_sessions (token TEXT PRIMARY KEY, ts TEXT)`,
      `CREATE TABLE IF NOT EXISTS bilibili_stats (id SERIAL PRIMARY KEY, snapshot JSONB, ts TEXT)`,
      `CREATE INDEX IF NOT EXISTS idx_views_board ON views(board)`,
      `CREATE INDEX IF NOT EXISTS idx_views_ts ON views(ts)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_board ON comments(board)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_is_spam ON comments(is_spam)`,
    ];
    for (const stmt of statements) {
      await pool.query(stmt);
    }
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        email TEXT,
        nickname TEXT,
        password TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        board TEXT,
        page TEXT,
        ts TEXT,
        ip TEXT
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        nickname TEXT,
        content TEXT,
        contact TEXT,
        long_id TEXT,
        board TEXT,
        ts TEXT,
        is_spam INTEGER DEFAULT 0,
        user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT,
        contact TEXT,
        content TEXT,
        source TEXT,
        ts TEXT,
        is_read INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS dev_sessions (
        token TEXT PRIMARY KEY,
        ts TEXT
      );

      CREATE TABLE IF NOT EXISTS bilibili_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot JSON,
        ts TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_views_board ON views(board);
      CREATE INDEX IF NOT EXISTS idx_views_ts ON views(ts);
      CREATE INDEX IF NOT EXISTS idx_comments_board ON comments(board);
      CREATE INDEX IF NOT EXISTS idx_comments_is_spam ON comments(is_spam);
    `);
  }
}

module.exports = { query, queryOne, initDb, isPg };
