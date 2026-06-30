// Express 入口，挂载所有路由
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 反向代理（Render/Cloudflare/Nginx 等）场景下信任代理头，
// 使 req.ip 能拿到真实客户端 IP（限流中间件依赖此设置）
app.set('trust proxy', true);

// 中间件
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态资源
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// pages 目录下的 HTML 直接以根路径提供
const pagesDir = path.join(__dirname, '..', 'pages');
app.use(express.static(pagesDir));

// 数据库初始化（本地与 Vercel Serverless 共用）
// 冷启动时异步建表（CREATE TABLE IF NOT EXISTS，幂等），每个请求到来前确保已完成。
// Vercel Serverless 无持久内存，不能依赖启动时一次性建表，故在此用 Promise 守门。
const initPromise = db.initDb().catch((err) => {
  console.error('[凡人修仙传] 初始化数据库失败:', err);
  // 返回 err 而非 reject，避免 unhandledRejection；请求时再抛出
  return err;
});
app.use((req, res, next) => {
  initPromise.then((maybeErr) => {
    if (maybeErr instanceof Error) return next(maybeErr);
    next();
  });
});

// API 路由
app.use('/api', require('./routes/auth'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/bilibili', require('./routes/bilibili'));
app.use('/api/dev', require('./routes/dev'));

// 显式页面路由（根路径 -> index.html）
app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDir, 'index.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// 404 兜底
app.use((req, res) => {
  res.status(404).send('404 - 页面不存在');
});

// async 路由错误兜底（4 个参数才算错误处理器）
app.use((err, req, res, next) => {
  console.error('[凡人修仙传] 服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 导出 app 供 Vercel Serverless 入口 (api/index.js) 复用
module.exports = app;

// 仅在直接运行时启动 HTTP 服务；Vercel 导入时不 listen（由平台接管）
if (require.main === module) {
  initPromise.then((maybeErr) => {
    if (maybeErr instanceof Error) {
      console.error('[凡人修仙传] 启动失败:', maybeErr);
      process.exit(1);
    }
    app.listen(PORT, () => {
      console.log(`[凡人修仙传] 服务已启动: http://localhost:${PORT} (模式: ${db.isPg() ? 'PostgreSQL' : 'SQLite'})`);
    });
  });
}
