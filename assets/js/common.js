/* ===========================================================
   公共：导航页头 / 页脚 / 弹窗 / 埋点 / 登录态
   依赖：页面需引入本文件，并在 body 顶部留空，由本文件注入。
   =========================================================== */
(function (global) {
  "use strict";

  /* ===========================================================
     转场与动效收敛：GSAP / Lenis / transition.js
     - 顶部注入 GSAP + Lenis CDN，onload 初始化
     - 头部动态注入 transition.js（若未引入），全站转场生效
     - 进入新页时同步创建遮罩，避免闪烁（由 transition.js 负责淡出）
     =========================================================== */
  var GSAP_URL = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
  var LENIS_URL = "https://unpkg.com/lenis@1.1.13/dist/lenis.min.js";
  var TRANSITION_URL = "/assets/js/transition.js";

  // 进入新页：同步创建遮罩（opacity:1），防止页面先闪现再被覆盖
  (function earlyEnterMask() {
    try {
      if (sessionStorage.getItem("fr_entering")) {
        if (!document.getElementById("fr-page-transition")) {
          var m = document.createElement("div");
          m.id = "fr-page-transition";
          m.className = "page-transition";
          m.style.willChange = "opacity";
          m.style.transition = "none";  // 进入时瞬时显示为不透明，不触发过渡
          m.style.opacity = "1";
          (document.body || document.documentElement).appendChild(m);
        }
      }
    } catch (e) {}
  })();

  function loadScript(url, cb) {
    var s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = cb;
    s.onerror = function () {};
    document.head.appendChild(s);
  }

  function onDomReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // 头部动态注入 transition.js（若未引入）
  function ensureTransitionScript() {
    var list = document.querySelectorAll("script[src]");
    for (var i = 0; i < list.length; i++) {
      if ((list[i].getAttribute("src") || "").indexOf("transition.js") !== -1) return;
    }
    var s = document.createElement("script");
    s.src = TRANSITION_URL;
    s.async = false; // 尽快有序执行，便于转场遮罩尽早接管
    document.head.appendChild(s);
  }

  // Lenis 平滑滚动
  function initLenis() {
    if (!global.Lenis || global.__fr_lenis) return;
    try {
      var lenis = new global.Lenis({
        duration: 1.1,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.4
      });
      global.__fr_lenis = lenis;
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e) {}
  }

  // GSAP：缓慢云雾流动 + 视差（仅缓慢位移/透明度，无弹跳/闪光）
  function initGsapEffects() {
    var gsap = global.gsap;
    if (!gsap) return;
    if (global.ScrollTrigger && gsap.registerPlugin) {
      try { gsap.registerPlugin(global.ScrollTrigger); } catch (e) {}
    }
    // 缓慢云雾流动：背景雾气层轻微位移/透明度
    var mist = document.querySelectorAll(".mist-layer, .hero-bg");
    Array.prototype.forEach.call(mist, function (el) {
      gsap.to(el, {
        x: "+=18",
        y: "-=10",
        opacity: "+=0.04",
        duration: 14,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true
      });
    });
    // 视差：[data-parallax]
    var px = document.querySelectorAll("[data-parallax]");
    if (px.length && global.ScrollTrigger) {
      Array.prototype.forEach.call(px, function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.3;
        gsap.to(el, {
          y: (1 - speed) * 80,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
        });
      });
    } else if (px.length) {
      initNativeParallax(px); // 无 ScrollTrigger 时原生兜底
    }
  }

  function initNativeParallax(nodes) {
    var vh = window.innerHeight;
    function update() {
      Array.prototype.forEach.call(nodes, function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.3;
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2 - vh / 2;
        var offset = center * speed * -0.25;
        el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
      });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () { vh = window.innerHeight; update(); });
    update();
  }

  // 注入动效库与转场脚本（GSAP/Lenis onload 后初始化）
  ensureTransitionScript();
  loadScript(GSAP_URL, function () { onDomReady(initGsapEffects); });
  loadScript(LENIS_URL, function () { onDomReady(initLenis); });

  var API = ""; // 同源
  function api(path, opts) {
    opts = opts || {};
    var headers = { "Content-Type": "application/json" };
    var token = localStorage.getItem("fanren_token");
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return { error: "响应解析失败" }; })
        .then(function (json) { return { ok: r.ok, status: r.status, json: json }; });
    });
  }

  // ---------- 当前页面标识（用于埋点） ----------
  function currentPage() {
    var p = location.pathname.split("/").pop();
    return p || "index.html";
  }
  function currentBoard() {
    var name = currentPage().replace(".html", "");
    return name || "index";
  }

  // ---------- 页头注入 ----------
  var NAV = [
    { href: "index.html", text: "首页" },
    { href: "characters.html", text: "人物" },
    { href: "treasures.html", text: "法宝" },
    { href: "beasts.html", text: "灵兽" },
    { href: "scenes.html", text: "场景" },
    { href: "cultivation.html", text: "境界" },
    { href: "sects.html", text: "宗门" },
    { href: "geography.html", text: "秘境" },
    { href: "pills.html", text: "丹药" },
    { href: "materials.html", text: "材料" },
    { href: "runes.html", text: "符阵" },
    { href: "novel.html", text: "原著" },
    { href: "timeline.html", text: "时间线" },
    { href: "quotes.html", text: "语录" },
    { href: "battles.html", text: "战斗" },
    { href: "terms.html", text: "术语" },
    { href: "map.html", text: "地图" },
    { href: "music.html", text: "音乐" },
    { href: "qa.html", text: "问答" },
    { href: "bilibili.html", text: "B站" },
    { href: "index.html#boards", text: "全部板块" },
  ];

  function injectHeader() {
    var header = document.createElement("header");
    header.className = "site-header";
    var navHtml = NAV.map(function (n) {
      return '<a href="' + n.href + '">' + n.text + "</a>";
    }).join("");
    header.innerHTML =
      '<div class="header-inner">' +
      '<a class="brand" href="index.html">凡人修仙传<small>凡人修仙</small></a>' +
      '<nav class="nav">' + navHtml + "</nav>" +
      '<div class="header-right">' +
        '<span class="dev-entry" onclick="location.href=\'dev-login.html\'">开发者模式</span>' +
        '<button class="btn sm" id="fr-login-btn">登录</button>' +
      "</div>" +
      "</div>";
    document.body.insertBefore(header, document.body.firstChild);
    var btn = document.getElementById("fr-login-btn");
    btn.addEventListener("click", function () {
      if (localStorage.getItem("fanren_token")) {
        if (confirm("已登录为 " + (localStorage.getItem("fanren_nick") || "") + "，是否退出？")) {
          localStorage.removeItem("fanren_token");
          localStorage.removeItem("fanren_nick");
          location.reload();
        }
      } else {
        openLoginModal();
      }
    });
    refreshLoginBtn();
  }

  function refreshLoginBtn() {
    var btn = document.getElementById("fr-login-btn");
    if (!btn) return;
    if (localStorage.getItem("fanren_token")) {
      btn.textContent = localStorage.getItem("fanren_nick") || "已登录";
    } else {
      btn.textContent = "登录";
    }
  }

  // ---------- 页脚注入 ----------
  function injectFooter() {
    var footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="footer-inner">' +
        '<div><h4>互动留言</h4><p>底部留言区对所有人开放，欢迎道友留言交流。</p>' +
          '<p><a href="index.html#message">前往留言区 →</a></p></div>' +
        '<div><h4>加入我们（代公部）</h4>' +
          '<p>Email：代公部</p><p>QQ群：代公部</p><p>微信：代公部</p></div>' +
        '<div><h4>免责声明</h4>' +
          '<p class="disclaimer">数据量过大，整理可能有误。本站为粉丝自发整理，仅供交流学习之用。</p></div>' +
        '<div><h4>关于</h4><p>本站为《凡人修仙传》粉丝站点，内容来自公开资料整理。</p>' +
          '<p><a href="dev-login.html">开发者入口</a></p></div>' +
      "</div>" +
      '<div class="footer-bottom">© 凡人修仙传粉丝站 · 修仙路漫漫，且行且珍惜</div>';
    document.body.appendChild(footer);
  }

  // ---------- 登录弹窗 ----------
  function openLoginModal() {
    var mask = ensureModalMask();
    mask.querySelector(".modal").innerHTML =
      '<span class="close" data-close>×</span>' +
      '<h3>道友请登录</h3>' +
      '<div class="form-group"><label>标识（手机号 / ID / 邮箱）</label>' +
        '<input class="input" id="lm-id" placeholder="手机号 / 用户ID / 邮箱"></div>' +
      '<div class="form-group"><label>密码</label>' +
        '<input class="input" id="lm-pwd" type="password" placeholder="密码"></div>' +
      '<div class="form-msg err hidden" id="lm-msg"></div>' +
      '<button class="btn" id="lm-submit" style="width:100%">登录</button>' +
      '<p class="form-hint text-center">还没有账号？<a href="register.html">立即注册</a></p>';
    mask.classList.add("show");
    bindClose(mask);
    document.getElementById("lm-submit").addEventListener("click", function () {
      var id = document.getElementById("lm-id").value.trim();
      var pwd = document.getElementById("lm-pwd").value;
      if (!id || !pwd) return showMsg("lm-msg", "请填写完整", true);
      api("/api/login", { method: "POST", body: { identifier: id, password: pwd } })
        .then(function (res) {
          if (res.ok && res.json.token) {
            localStorage.setItem("fanren_token", res.json.token);
            localStorage.setItem("fanren_nick", res.json.nickname);
            localStorage.setItem("fanren_uid", res.json.id);
            closeMask();
            refreshLoginBtn();
            location.reload();
          } else {
            showMsg("lm-msg", (res.json && res.json.error) || "登录失败", true);
          }
        });
    });
  }

  function openRegisterModal() {
    location.href = "register.html";
  }

  function ensureModalMask() {
    var mask = document.getElementById("fr-mask");
    if (!mask) {
      mask = document.createElement("div");
      mask.id = "fr-mask";
      mask.className = "modal-mask";
      mask.innerHTML = '<div class="modal"></div>';
      document.body.appendChild(mask);
      mask.addEventListener("click", function (e) {
        if (e.target === mask) closeMask();
      });
    }
    return mask;
  }
  function closeMask() {
    var mask = document.getElementById("fr-mask");
    if (mask) mask.classList.remove("show");
  }
  function bindClose(mask) {
    var c = mask.querySelector("[data-close]");
    if (c) c.addEventListener("click", closeMask);
  }
  function showMsg(id, msg, isErr) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(isErr ? "err" : "ok");
  }
  global.FR = global.FR || {};
  global.FR.api = api;
  global.FR.openLoginModal = openLoginModal;
  global.FR.closeMask = closeMask;
  global.FR.refreshLoginBtn = refreshLoginBtn;
  global.FR.showMsg = showMsg;

  // ---------- 新用户首访弹窗 ----------
  function firstVisitPrompt() {
    if (localStorage.getItem("fanren_visited")) return;
    if (currentPage() === "register.html" || currentPage() === "login.html") return;
    setTimeout(function () {
      var mask = ensureModalMask();
      mask.querySelector(".modal").innerHTML =
        '<span class="close" data-close>×</span>' +
        '<h3>欢迎道友踏入修仙界</h3>' +
        '<p class="text-center muted">登录后可发表评论、留言，体验更完整。也可稍后再说。</p>' +
        '<div class="row" style="justify-content:center;margin-top:14px">' +
          '<button class="btn" id="fv-login">立即登录</button>' +
          '<button class="btn ghost" id="fv-reg">注册账号</button>' +
        '</div>';
      mask.classList.add("show");
      bindClose(mask);
      document.getElementById("fv-login").addEventListener("click", function () {
        closeMask();
        openLoginModal();
      });
      document.getElementById("fv-reg").addEventListener("click", function () {
        location.href = "register.html";
      });
      localStorage.setItem("fanren_visited", "1");
    }, 800);
  }

  // ---------- 浏览埋点 ----------
  function trackView() {
    var body = { board: currentBoard(), page: currentPage() };
    var uid = localStorage.getItem("fanren_uid");
    if (uid) body.user_id = uid;
    api("/api/stats/view", { method: "POST", body: body }).catch(function () {});
  }

  // ---------- 初始化 ----------
  function init() {
    injectHeader();
    injectFooter();
    firstVisitPrompt();
    trackView();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
