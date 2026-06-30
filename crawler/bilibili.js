// 凡人修仙传 B站数据爬虫（Node.js 版，Vercel Cron 适配）
//
// 每小时运行一次，抓取《凡人修仙传》动画在 B 站的真实数据。
// 至少包含 12 项：总播放、弹幕、收藏、点赞、投币、分享、追番、评分、评论、
// 同时在线、最高在线、转发。
//
// 写入方式（适配 Vercel Cron 等 PaaS 云环境）：
//   1. 优先通过 HTTP POST 上传到后端 /api/bilibili（写入 bilibili_stats 表）
//   2. 同时写本地 data/bilibili.json 作为备份（Vercel 上文件不持久，仅容错用）
//
// 环境变量：
//   APP_URL       后端服务地址（默认 http://localhost:3000）
//   DEV_TOKEN     开发者令牌；若无则用 DEV_PASSWORD 登录 /api/dev/login 获取
//   DEV_PASSWORD  开发者密码（默认 HU123456789）
//
// 运行：node crawler/bilibili.js
// 调度：Vercel Cron 调用 api/cron/bilibili.js
//
// 说明：season_id 可在 B 站番剧页 URL 中找到（如 ss42544）。
// 仅依赖 Node 18+ 内置 fetch，无需额外 HTTP 库。

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'bilibili.json');

// 凡人修仙传动画 season_id（用户可自行替换为最新季）
const SEASON_IDS = ['42544'];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com',
  Accept: 'application/json, text/plain, */*',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 带重试的 GET，返回 JSON 对象或 null。
async function _get(url, params, retries = 3) {
  let lastErr = null;
  const qs = new URLSearchParams(params || {}).toString();
  const full = qs ? `${url}?${qs}` : url;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(full, { headers: HEADERS });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (i + 1));
    }
  }
  console.warn(`[warn] 请求失败 ${url}: ${lastErr}`);
  return null;
}

// 番剧总体统计：播放/弹幕/收藏/点赞/投币/分享/追番/评分/评论。
async function fetchSeasonStat(seasonId) {
  const data = await _get('https://api.bilibili.com/pgc/web/season/stat', {
    season_id: seasonId,
  });
  if (!data || data.code !== 0) return {};
  return data.data || {};
}

// 番剧分集列表。
async function fetchSeasonSection(seasonId) {
  const data = await _get('https://api.bilibili.com/pgc/web/season/section', {
    season_id: seasonId,
  });
  if (!data || data.code !== 0) return [];
  const sections = (data.data || {}).sections || [];
  const episodes = [];
  for (const sec of sections) {
    for (const ep of sec.episodes || []) {
      episodes.push({
        title: ep.long_title || ep.title || '',
        bvid: ep.bvid || '',
        aid: ep.aid || 0,
        cid: ep.cid || 0,
      });
    }
  }
  return episodes;
}

// 单集 stat：可补充同时在线等。返回对象。
async function fetchViewStat(bvid) {
  if (!bvid) return {};
  const data = await _get('https://api.bilibili.com/x/web-interface/view', {
    bvid,
  });
  if (!data || data.code !== 0) return {};
  const d = data.data || {};
  const stat = d.stat || {};
  return {
    view: stat.view || 0,
    danmaku: stat.danmaku || 0,
    reply: stat.reply || 0,
    favorite: stat.favorite || 0,
    coin: stat.coin || 0,
    share: stat.share || 0,
    like: stat.like || 0,
    now_rank: stat.now_rank || 0,
  };
}

// 汇总所有 season 数据为一份快照。
async function buildSnapshot() {
  const snapshot = {
    title: '凡人修仙传',
    total_view: 0,
    danmaku: 0,
    favorite: 0,
    like: 0,
    coin: 0,
    share: 0,
    follow: 0,
    score: 0,
    comment: 0,
    current_online: null,
    max_online: null,
    repost: 0,
  };
  const seasons = [];
  for (const sid of SEASON_IDS) {
    const stat = await fetchSeasonStat(sid);
    const eps = await fetchSeasonSection(sid);
    const seasonTitle = `凡人修仙传 ${sid}`;
    // 累加
    snapshot.total_view += stat.views || 0;
    snapshot.danmaku += stat.danmaku || 0;
    snapshot.favorite += stat.favorites || 0;
    snapshot.like += stat.likes || 0;
    snapshot.coin += stat.coins || 0;
    snapshot.share += stat.share || 0;
    snapshot.follow += stat.follow || 0;
    snapshot.score = stat.score || snapshot.score;
    snapshot.comment += stat.reply || 0;
    snapshot.repost += stat.share || 0; // 转发近似用 share

    const epList = [];
    for (const ep of eps.slice(0, 50)) {
      // 限制请求数量
      const vstat = await fetchViewStat(ep.bvid);
      epList.push({
        title: ep.title,
        bvid: ep.bvid,
        view: vstat.view || 0,
        danmaku: vstat.danmaku || 0,
        reply: vstat.reply || 0,
      });
      await sleep(300);
    }
    seasons.push({ season_id: sid, title: seasonTitle, episodes: epList });
  }

  return {
    snapshot,
    seasons,
    ts: new Date().toISOString(),
  };
}

// 获取 dev token：优先读 DEV_TOKEN，否则用 DEV_PASSWORD 登录。
async function getDevToken(appUrl) {
  const token = (process.env.DEV_TOKEN || '').trim();
  if (token) return token;
  const password = process.env.DEV_PASSWORD || 'HU123456789';
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
    console.warn(`[warn] 获取 dev token 失败: ${e}`);
    return null;
  }
}

// 上传快照到后端 POST /api/bilibili。返回 true/false。失败不抛异常。
async function uploadSnapshot(appUrl, snapshot, ts) {
  const token = await getDevToken(appUrl);
  if (!token) {
    console.warn('[warn] 无 dev token，跳过上传');
    return false;
  }
  try {
    const r = await fetch(`${appUrl}/api/bilibili`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify({ snapshot, ts }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log(`[凡人修仙传] 上传成功: HTTP ${r.status}`);
    return true;
  } catch (e) {
    console.warn(`[warn] 上传后端失败: ${e}`);
    return false;
  }
}

// 主流程：抓取 → 上传后端 → 写本地备份 → 返回结果。
// 返回 { snapshot, seasons, ts } 便于 cron 函数复用。
async function main() {
  console.log('[凡人修仙传] 开始抓取 B 站数据...');
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const result = await buildSnapshot();
  const snapshot = result.snapshot;
  const ts = result.ts;

  if (snapshot.total_view === 0 && result.seasons.length === 0) {
    // 抓取失败，保留旧数据
    if (fs.existsSync(OUT_FILE)) {
      console.log('[凡人修仙传] 抓取失败，保留上次 bilibili.json');
      try {
        const old = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
        console.log(JSON.stringify(old.snapshot || {}, null, 2));
        return {
          snapshot: old.snapshot || {},
          seasons: old.seasons || [],
          ts: old.ts || null,
          stale: true,
        };
      } catch (e) {
        console.warn(`[warn] 读取旧文件失败: ${e}`);
      }
    } else {
      console.log('[凡人修仙传] 抓取失败且无旧数据，写入空快照');
    }
  }

  // 1. 优先上传到后端
  await uploadSnapshot(appUrl, snapshot, ts);

  // 2. 写本地 JSON 备份（Vercel 上不持久，仅容错）
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`[凡人修仙传] 已写入 ${OUT_FILE}`);
  } catch (e) {
    console.warn(`[warn] 写本地备份失败: ${e}`);
  }

  console.log(JSON.stringify(snapshot, null, 2));
  return result;
}

module.exports = {
  main,
  buildSnapshot,
  fetchSeasonStat,
  fetchSeasonSection,
  fetchViewStat,
  getDevToken,
  uploadSnapshot,
  SEASON_IDS,
};

if (require.main === module) {
  main();
}
