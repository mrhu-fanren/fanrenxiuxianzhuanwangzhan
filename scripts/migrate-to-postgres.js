#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * SQLite → PostgreSQL 数据迁移脚本
 *
 * 用途：将本地 SQLite (data/app.db) 中的全部业务数据迁移到 Render PostgreSQL。
 *
 * 用法：
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/migrate-to-postgres.js
 *
 * 说明：
 *   - 使用 better-sqlite3 同步读取本地 data/app.db
 *   - 使用 pg (PostgreSQL) 异步写入远程数据库（连接串来自 DATABASE_URL 环境变量）
 *   - 表结构与 server/db.js 保持一致
 *   - 幂等：users / dev_sessions 使用 INSERT ... ON CONFLICT DO NOTHING（按主键去重）
 *           views / comments / feedbacks / bilibili_stats 为自增表，直接 INSERT
 *   - 迁移顺序：先 users（被其他表的外键概念引用），再 views / comments / feedbacks / dev_sessions / bilibili_stats
 *   - 末尾打印各表迁移条数
 *
 * 依赖：better-sqlite3（已含）、pg（需 npm install pg）
 */

'use strict';

const path = require('path');
const fs = require('fs');

// 显式引入（便于在缺失时给出友好提示）
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[错误] 未安装 better-sqlite3，请先执行: npm install better-sqlite3');
  process.exit(1);
}

let pg;
try {
  pg = require('pg');
} catch (e) {
  console.error('[错误] 未安装 pg，请先执行: npm install pg');
  process.exit(1);
}

const { Client } = pg;

// ------------------------------------------------------------------
// 配置
// ------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[错误] 缺少环境变量 DATABASE_URL');
  console.error('       用法: DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/migrate-to-postgres.js');
  process.exit(1);
}

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'app.db');
if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`[错误] 本地 SQLite 文件不存在: ${SQLITE_PATH}`);
  process.exit(1);
}

// PostgreSQL 建表语句（与 server/db.js 表结构一致，类型适配 PG）
const PG_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT,
  nickname TEXT,
  password TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  board TEXT,
  page TEXT,
  ts TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  snapshot JSONB,
  ts TEXT
);

CREATE INDEX IF NOT EXISTS idx_views_board ON views(board);
CREATE INDEX IF NOT EXISTS idx_views_ts ON views(ts);
CREATE INDEX IF NOT EXISTS idx_comments_board ON comments(board);
CREATE INDEX IF NOT EXISTS idx_comments_is_spam ON comments(is_spam);
`;

// ------------------------------------------------------------------
// 迁移逻辑
// ------------------------------------------------------------------

async function migrate() {
  console.log(`[信息] 源 SQLite: ${SQLITE_PATH}`);
  console.log(`[信息] 目标 PostgreSQL: ${DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pgClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const stats = {
    users: 0,
    views: 0,
    comments: 0,
    feedbacks: 0,
    dev_sessions: 0,
    bilibili_stats: 0,
  };

  try {
    await pgClient.connect();
    console.log('[信息] 已连接 PostgreSQL，开始建表（IF NOT EXISTS）...');
    await pgClient.query(PG_SCHEMA_SQL);

    // ---------- users（先迁移） ----------
    const users = sqlite.prepare('SELECT id, phone, email, nickname, password, created_at FROM users').all();
    if (users.length) {
      const stmt = `
        INSERT INTO users (id, phone, email, nickname, password, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `;
      for (const u of users) {
        const r = await pgClient.query(stmt, [u.id, u.phone, u.email, u.nickname, u.password, u.created_at]);
        stats.users += r.rowCount || 0;
      }
    }
    console.log(`[完成] users: ${stats.users} 行`);

    // ---------- views ----------
    const views = sqlite.prepare('SELECT id, user_id, board, page, ts, ip FROM views').all();
    if (views.length) {
      const stmt = `
        INSERT INTO views (user_id, board, page, ts, ip)
        VALUES ($1, $2, $3, $4, $5)
      `;
      for (const v of views) {
        await pgClient.query(stmt, [v.user_id, v.board, v.page, v.ts, v.ip]);
        stats.views += 1;
      }
    }
    console.log(`[完成] views: ${stats.views} 行`);

    // ---------- comments ----------
    const comments = sqlite.prepare(
      'SELECT id, type, nickname, content, contact, long_id, board, ts, is_spam, user_id FROM comments'
    ).all();
    if (comments.length) {
      const stmt = `
        INSERT INTO comments (type, nickname, content, contact, long_id, board, ts, is_spam, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      for (const c of comments) {
        await pgClient.query(stmt, [
          c.type, c.nickname, c.content, c.contact, c.long_id, c.board, c.ts, c.is_spam, c.user_id,
        ]);
        stats.comments += 1;
      }
    }
    console.log(`[完成] comments: ${stats.comments} 行`);

    // ---------- feedbacks ----------
    const feedbacks = sqlite.prepare(
      'SELECT id, nickname, contact, content, source, ts, is_read FROM feedbacks'
    ).all();
    if (feedbacks.length) {
      const stmt = `
        INSERT INTO feedbacks (nickname, contact, content, source, ts, is_read)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      for (const f of feedbacks) {
        await pgClient.query(stmt, [f.nickname, f.contact, f.content, f.source, f.ts, f.is_read]);
        stats.feedbacks += 1;
      }
    }
    console.log(`[完成] feedbacks: ${stats.feedbacks} 行`);

    // ---------- dev_sessions ----------
    const sessions = sqlite.prepare('SELECT token, ts FROM dev_sessions').all();
    if (sessions.length) {
      const stmt = `
        INSERT INTO dev_sessions (token, ts)
        VALUES ($1, $2)
        ON CONFLICT (token) DO NOTHING
      `;
      for (const s of sessions) {
        const r = await pgClient.query(stmt, [s.token, s.ts]);
        stats.dev_sessions += r.rowCount || 0;
      }
    }
    console.log(`[完成] dev_sessions: ${stats.dev_sessions} 行`);

    // ---------- bilibili_stats ----------
    const statsRows = sqlite.prepare('SELECT id, snapshot, ts FROM bilibili_stats').all();
    if (statsRows.length) {
      const stmt = `
        INSERT INTO bilibili_stats (snapshot, ts)
        VALUES ($1, $2)
      `;
      for (const b of statsRows) {
        // SQLite 中 snapshot 列声明为 JSON，读出为字符串；PG 列为 JSONB，可直接接受字符串
        await pgClient.query(stmt, [b.snapshot, b.ts]);
        stats.bilibili_stats += 1;
      }
    }
    console.log(`[完成] bilibili_stats: ${stats.bilibili_stats} 行`);

    // ---------- 汇总 ----------
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    console.log('\n========== 迁移汇总 ==========');
    console.log(`  users          : ${stats.users}`);
    console.log(`  views          : ${stats.views}`);
    console.log(`  comments       : ${stats.comments}`);
    console.log(`  feedbacks      : ${stats.feedbacks}`);
    console.log(`  dev_sessions   : ${stats.dev_sessions}`);
    console.log(`  bilibili_stats : ${stats.bilibili_stats}`);
    console.log(`  -----------------------------`);
    console.log(`  合计           : ${total} 行`);
    console.log('==============================');
    console.log('[成功] 迁移完成。');
  } catch (err) {
    console.error('[失败] 迁移过程中出错:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    try { sqlite.close(); } catch (_) {}
    try { await pgClient.end(); } catch (_) {}
  }
}

migrate();
