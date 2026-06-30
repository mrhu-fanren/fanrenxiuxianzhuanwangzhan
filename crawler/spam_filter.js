// 垃圾评论自动屏蔽脚本（Node.js 版，Vercel Cron 适配）
//
// 每日运行一次，通过后端 API 获取全部评论（含 is_spam=0），
// 识别垃圾评论（广告/色情/赌博/外链/刷屏等）并调用后端接口将其 is_spam 置为 1。
//
// Vercel（PaaS）上无本地 SQLite，故改为调用后端 API：
//   GET  /api/comments/all       获取全部评论（含已标记垃圾，需 dev token）
//   POST /api/comments/:id/spam  将指定评论 is_spam 置 1（需 dev token）
//
// 环境变量：
//   APP_URL       后端服务地址（默认 http://localhost:3000）
//   DEV_PASSWORD  开发者密码（默认 HU123456789）
//
// 运行：node crawler/spam_filter.js
// 调度：Vercel Cron 调用 api/cron/spam.js
// 仅依赖 Node 18+ 内置 fetch，无需额外 HTTP 库。

const SPAM_KEYWORDS = [
  '加微信', '加qq', '加Q', '免费看', '色情', '博彩', '六合彩', '代理',
  '出售', '代刷', '兼职', '刷单', '推广', '招商', '投资理财', '日赚',
  'http://', 'https://', 'www.', '.com', '.cn', 'qq群号', '微信号',
  '澳门', '赌场', '裸聊', '一夜暴富', '稳赚', '零投资', '扫码',
  '低价代', '外挂', '辅助', '刷钻', '刷赞',
];

// 判断单条评论是否为垃圾。freqCount 为该内容出现次数。
function isSpam(content, freqCount) {
  if (!content) return false;
  const low = String(content).toLowerCase();
  // 1. 关键词命中
  for (const kw of SPAM_KEYWORDS) {
    if (low.includes(kw.toLowerCase())) return true;
  }
  // 2. 纯重复字符超长（连续 20+ 相同字符）
  if (/(.)\1{19,}/.test(content)) return true;
  // 3. 内容过短且含链接特征
  if (content.length < 4 && (low.includes('http') || low.includes('www') || low.includes('.com'))) {
    return true;
  }
  // 4. 同内容刷屏（同一内容出现 5+ 次）
  if (freqCount >= 5) return true;
  return false;
}

// 用 DEV_PASSWORD 登录 /api/dev/login 获取 dev token。
async function getDevToken(appUrl, password) {
  try {
    const r = await fetch(`${appUrl}/api/dev/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (data || {}).token;
  } catch (e) {
    console.warn(`[spam_filter] 获取 dev token 失败: ${e}`);
    return null;
  }
}

// 调用 POST /api/comments/:id/spam 将评论置为垃圾。失败不抛异常。
async function markSpam(appUrl, token, commentId) {
  try {
    const r = await fetch(`${appUrl}/api/comments/${commentId}/spam`, {
      method: 'POST',
      headers: { 'x-auth-token': token },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return true;
  } catch (e) {
    console.warn(`[spam_filter] 屏蔽评论 id=${commentId} 失败: ${e}`);
    return false;
  }
}

// 主流程：登录 → 拉全部评论 → 识别 → 屏蔽。返回扫描结果。
async function main() {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const devPassword = process.env.DEV_PASSWORD || 'HU123456789';

  const token = await getDevToken(appUrl, devPassword);
  if (!token) {
    console.log('[spam_filter] 无 dev token，退出');
    return { ok: false, scanned: 0, blocked: 0, reason: 'no token' };
  }

  // 获取全部评论（含 is_spam=0 与已标记的）
  let comments;
  try {
    const r = await fetch(`${appUrl}/api/comments/all`, {
      headers: { 'x-auth-token': token },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    comments = await r.json();
  } catch (e) {
    console.warn(`[spam_filter] 获取评论失败: ${e}`);
    return { ok: false, scanned: 0, blocked: 0, reason: 'fetch comments failed' };
  }

  if (!Array.isArray(comments)) {
    console.log(`[spam_filter] 评论数据格式异常: ${typeof comments}`);
    return { ok: false, scanned: 0, blocked: 0, reason: 'bad format' };
  }

  // 统计内容频次
  const freq = new Map();
  for (const c of comments) {
    const key = String(c.content || '').trim();
    freq.set(key, (freq.get(key) || 0) + 1);
  }

  let blocked = 0;
  const examples = [];
  for (const c of comments) {
    // 跳过已标记为垃圾的
    if (c.is_spam) continue;
    const id = c.id;
    const content = String(c.content || '').trim();
    if (!id) continue;
    if (isSpam(content, freq.get(content) || 0)) {
      if (await markSpam(appUrl, token, id)) {
        blocked++;
        if (examples.length < 5) {
          examples.push({ id, content: content.slice(0, 40) });
        }
      }
    }
  }

  console.log(`[spam_filter] 扫描 ${comments.length} 条，屏蔽 ${blocked} 条`);
  for (const ex of examples) {
    console.log(`  - id=${ex.id}: ${ex.content}`);
  }

  return { ok: true, scanned: comments.length, blocked, examples };
}

module.exports = { main, isSpam, getDevToken, markSpam, SPAM_KEYWORDS };

if (require.main === module) {
  main();
}
