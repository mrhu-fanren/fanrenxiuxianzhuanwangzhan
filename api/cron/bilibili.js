// Vercel Cron 函数：定时抓取 B站数据并上传后端
//
// 在 vercel.json 中配置 cron 触发该路径，例如：
//   { "crons": [{ "path": "/api/cron/bilibili", "schedule": "0 * * * *" }] }
//
// APP_URL 由 Vercel 环境变量配置（指向后端服务地址）。
// 若与后端同部署，APP_URL 设为该部署的正式域名即可。

const { main } = require('../../crawler/bilibili');

module.exports = async (req, res) => {
  // 仅允许 Vercel Cron 的 GET/POST 触发
  try {
    const result = await main();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      ok: true,
      snapshot: result.snapshot,
      ts: result.ts,
      stale: result.stale === true,
    });
  } catch (e) {
    console.error('[cron/bilibili] 执行失败:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      ok: false,
      error: String((e && e.message) || e),
    });
  }
};
