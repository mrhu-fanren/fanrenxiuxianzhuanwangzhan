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

// 异步启动：先建表，再 listen
async function start() {
  await db.initDb();
  app.listen(PORT, () => {
    console.log(`[凡人修仙传] 服务已启动: http://localhost:${PORT} (模式: ${db.isPg() ? 'PostgreSQL' : 'SQLite'})`);
  });
}

start().catch((err) => {
  console.error('[凡人修仙传] 启动失败:', err);
  process.exit(1);
});
