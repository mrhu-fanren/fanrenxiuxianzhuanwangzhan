// Vercel Cron 函数：定时扫描并屏蔽垃圾评论
//
// 在 vercel.json 中配置 cron 触发该路径，例如：
//   { "crons": [{ "path": "/api/cron/spam", "schedule": "0 3 * * *" }] }
//
// APP_URL / DEV_PASSWORD 由 Vercel 环境变量配置。

const { main } = require('../../crawler/spam_filter');

module.exports = async (req, res) => {
  try {
    const result = await main();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/spam] 执行失败:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({
      ok: false,
      error: String((e && e.message) || e),
    });
  }
};
