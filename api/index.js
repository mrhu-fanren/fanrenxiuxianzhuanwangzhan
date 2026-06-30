// Vercel Serverless 入口（@vercel/node）
// 把 Express app 作为 Serverless Function 导出。
// app.js 已确保 require.main !== module 时不调用 app.listen，故此处导入安全。
// 静态文件（pages/ assets/ data/）由 vercel.json 配置走 CDN，本函数只处理 /api/* 路由。
const app = require('../server/app');
module.exports = app;
