// 基于 IP 的内存滑动窗口限流中间件
// 工厂函数 createRateLimit({ windowMs, max, message }) 返回 Express 中间件
// 说明：依赖 app.set('trust proxy', true)，req.ip 才能在反向代理后获取真实客户端 IP
function createRateLimit({ windowMs = 60000, max = 3, message = '请求过于频繁，请稍后再试' } = {}) {
  // Map: ip -> 请求时间戳数组
  const hits = new Map();
  const MAX_IPS = 10000; // 防内存泄漏：最多保留 10000 个 IP 记录

  return function rateLimit(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    // 取出该 IP 的时间戳数组，清理超出窗口的旧记录
    let arr = hits.get(ip);
    if (arr) {
      // 过滤掉超出滑动窗口的旧记录
      let i = 0;
      while (i < arr.length && now - arr[i] > windowMs) i++;
      if (i > 0) arr = arr.slice(i);
    } else {
      arr = [];
    }

    // 若剩余记录数 >= max，则触发限流
    if (arr.length >= max) {
      return res.status(429).json({ error: message });
    }

    // 记录本次请求时间戳
    arr.push(now);
    hits.set(ip, arr);

    // 防 Map 无限增长：超过阈值时清理最旧的一批 IP
    if (hits.size > MAX_IPS) {
      // Map 保持插入顺序，删除最早的 1000 条
      const it = hits.keys();
      for (let k = 0; k < 1000; k++) {
        const key = it.next().value;
        if (key === undefined) break;
        hits.delete(key);
      }
    }

    next();
  };
}

module.exports = { createRateLimit };
