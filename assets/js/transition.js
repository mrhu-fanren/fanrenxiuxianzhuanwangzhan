/* ===========================================================
   transition.js — 页面切换淡入淡出高级转场（雾气/墨迹质感）
   由 common.js 动态注入到 <head>，全站 pages/*.html 生效。
   - 拦截站内链接点击 → 遮罩淡出当前页(350ms) → 跳转 → 新页遮罩淡入(350ms)
   - 监听 pageshow 支持 bfcache 前进后退
   - 首次进入站点触发 Hero 墨迹展开渐显
   - requestAnimationFrame + will-change，顺滑无闪烁
   =========================================================== */
(function (global) {
  "use strict";

  var FLAG_ENTER = "fr_entering";      // 标记：正在跨页转场（由前一页设置）
  var FLAG_FIRST = "fr_first_enter";   // 标记：本次会话已触发过首访 Hero
  var FADE_MS = 350;

  var navigating = false;   // 离开页过程中，阻止重复触发
  var enterHandled = false; // 防止 boot 与 pageshow 重复淡入

  // ---------- 遮罩层 ----------
  function createMask(initialOpacity) {
    var mask = document.getElementById("fr-page-transition");
    if (!mask) {
      mask = document.createElement("div");
      mask.id = "fr-page-transition";
      mask.className = "page-transition";
      mask.style.willChange = "opacity";
      mask.style.opacity = String(initialOpacity);
      (document.body || document.documentElement).appendChild(mask);
    }
    return mask;
  }

  function forceReflow(el) { void el.offsetHeight; }

  // 双 rAF：先提交 transition，再改变 opacity，确保过渡生效
  function fadeTo(mask, target, done) {
    forceReflow(mask);
    requestAnimationFrame(function () {
      mask.style.transition = "opacity " + FADE_MS + "ms ease";
      requestAnimationFrame(function () {
        mask.style.opacity = String(target);
        if (done) setTimeout(done, FADE_MS + 40);
      });
    });
  }

  // 淡入新页：遮罩 1 → 0
  function fadeInNewPage() {
    var mask = createMask(1);
    fadeTo(mask, 0, function () {
      mask.style.transition = "";
      if (!navigating && mask.parentNode) mask.parentNode.removeChild(mask);
    });
  }

  // 离开当前页：遮罩 0 → 1 后跳转
  function fadeOutAndGo(href) {
    if (navigating) return;
    navigating = true;
    var mask = createMask(0);
    fadeTo(mask, 1, function () {
      try { sessionStorage.setItem(FLAG_ENTER, "1"); } catch (e) {}
      location.href = href;
    });
  }

  function handleEnter() {
    if (enterHandled) return;
    enterHandled = true;
    fadeInNewPage();
  }

  // ---------- 链接拦截 ----------
  function isInternalLink(a) {
    if (!a || !a.getAttribute) return false;
    var tgt = a.getAttribute("target");
    if (tgt && tgt.toLowerCase() === "_blank") return false;
    var href = a.getAttribute("href");
    if (!href) return false;
    if (href.charAt(0) === "#") return false;                       // 纯锚点
    if (/^(javascript:|mailto:|tel:)/i.test(href)) return false;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return false;               // 仅同源
    } catch (e) { return false; }
    return true;
  }

  function onDocClick(e) {
    if (navigating) { e.preventDefault(); return; }
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // 修饰键（新窗口等）
    var node = e.target;
    var a = null;
    while (node && node !== document) {
      if (node.tagName && node.tagName.toLowerCase() === "a") { a = node; break; }
      node = node.parentNode;
    }
    if (!a) return;
    if (!isInternalLink(a)) return;
    e.preventDefault();
    fadeOutAndGo(a.href);
  }

  // ---------- pageshow：支持 bfcache 前进后退 ----------
  function onPageShow(e) {
    if (sessionStorage.getItem(FLAG_ENTER)) {
      try { sessionStorage.removeItem(FLAG_ENTER); } catch (ex) {}
      handleEnter();
    } else if (e.persisted) {
      // bfcache 恢复（前进/后退），触发淡入
      handleEnter();
    }
  }

  // ---------- 首次进入站点：Hero 墨迹展开 ----------
  function firstEnter() {
    var seen;
    try { seen = sessionStorage.getItem(FLAG_FIRST); } catch (e) {}
    if (seen) return;
    var add = function () { if (document.body) document.body.classList.add("first-enter"); };
    if (document.body) add();
    else document.addEventListener("DOMContentLoaded", add);
    try { sessionStorage.setItem(FLAG_FIRST, "1"); } catch (e) {}
  }

  // ---------- 启动 ----------
  function boot() {
    firstEnter();
    document.addEventListener("click", onDocClick, true);
    global.addEventListener("pageshow", onPageShow);
    // 若带 entering 标记进入（来自站内跳转），尽早淡入
    if (sessionStorage.getItem(FLAG_ENTER)) {
      try { sessionStorage.removeItem(FLAG_ENTER); } catch (e) {}
      handleEnter();
    }
  }

  global.FR = global.FR || {};
  global.FR.transition = { fadeInNewPage: fadeInNewPage, fadeOutAndGo: fadeOutAndGo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
