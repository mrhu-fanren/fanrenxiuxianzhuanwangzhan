/* 开发者面板前端：拉取 /api/dev/stats 并渲染，支持点入查看详情 */
(function () {
  "use strict";
  var FR = window.FR;
  var DEV_TOKEN = localStorage.getItem("fanren_dev_token");

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (DEV_TOKEN) h["Authorization"] = "Bearer " + DEV_TOKEN;
    return h;
  }

  function fmtTs(ts) {
    if (!ts) return "-";
    try { return new Date(ts).toLocaleString("zh-CN"); } catch (e) { return ts; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function init() {
    var root = document.getElementById("dev-root");
    if (!root) return;
    if (!DEV_TOKEN) {
      root.innerHTML = '<p class="muted text-center">未登录开发者，<a href="dev-login.html">前往登录</a></p>';
      return;
    }
    root.innerHTML = '<p class="muted">加载中…</p>';
    fetch("/api/dev/stats", { headers: authHeaders() })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          root.innerHTML = '<p class="form-msg err">' + esc((res.json && res.json.error) || "加载失败") + "</p>";
          return;
        }
        render(res.json);
      });
  }

  function render(data) {
    var root = document.getElementById("dev-root");
    var u = data.registeredUsers;
    var v = data.totalViews;
    var c = data.commentStats;
    var f = data.feedbacks;
    var b = data.bilibili;

    var statBoxes =
      statBox("注册用户", u.count, "查看用户列表", "toggle", "users-box") +
      statBox("总浏览量", v.total, "查看各板块", "toggle", "views-box") +
      statBox("评论总数", c.total, "含垃圾 " + c.spam + " 条", "toggle", "comments-box") +
      statBox("反馈数量", f.length, "查看反馈", "toggle", "feedback-box") +
      statBox("B站快照", b.ts ? "有" : "无", "查看快照", "toggle", "bili-box");

    root.innerHTML =
      '<div class="stat-grid">' + statBoxes + "</div>" +
      '<div id="users-box" class="card hidden mt"></div>' +
      '<div id="views-box" class="card hidden mt"></div>' +
      '<div id="comments-box" class="card hidden mt"></div>' +
      '<div id="feedback-box" class="card hidden mt"></div>' +
      '<div id="bili-box" class="card hidden mt"></div>';

    document.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-toggle");
        var el = document.getElementById(target);
        if (!el) return;
        if (el.classList.contains("hidden")) {
          fill(target, data);
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
      });
    });
  }

  function statBox(num, lbl, hint, action, target) {
    return '<div class="stat-box"><div class="num">' + esc(num) + "</div>" +
      '<div class="lbl">' + esc(lbl) + "</div>" +
      '<div class="hint"><button class="btn sm" data-' + action + '="' + target + '">' + esc(hint) + " →</button></div></div>";
  }

  function fill(target, data) {
    var el = document.getElementById(target);
    if (target === "users-box") {
      var rows = data.registeredUsers.list.map(function (u) {
        return "<tr><td>" + esc(u.id) + "</td><td>" + esc(u.phone) + "</td><td>" + esc(u.email || "-") +
          "</td><td>" + esc(u.nickname) + "</td><td>" + fmtTs(u.created_at) + "</td></tr>";
      }).join("");
      el.innerHTML = "<h3>用户登录数据（手机号 / 邮箱 / ID）</h3>" +
        table(["ID", "手机号", "邮箱", "昵称", "注册时间"], rows);
    } else if (target === "views-box") {
      var vrows = data.totalViews.boards.map(function (b) {
        return "<tr><td><a href=\"javascript:loadBoard('" + esc(b.board) + "')\">" + esc(b.board || "-") + "</a></td><td>" +
          esc(b.count) + "</td></tr>";
      }).join("");
      el.innerHTML = "<h3>各板块浏览量（点入查看详情）</h3><div id='board-detail'></div>" +
        table(["板块", "浏览量"], vrows);
      window.loadBoard = loadBoard;
    } else if (target === "comments-box") {
      var crows = data.commentStats.recent.map(function (c) {
        return "<tr><td>" + esc(c.ts ? fmtTs(c.ts) : "-") + "</td><td>" + esc(c.type) + "</td><td>" +
          esc(c.nickname) + "</td><td>" + esc(c.board || "-") + "</td><td>" +
          (c.is_spam ? '<span class="seal-tag">垃圾</span> ' : "") + esc(c.content) + "</td></tr>";
      }).join("");
      el.innerHTML = "<h3>最近评论（可点入查看内容）</h3>" +
        table(["时间", "类型", "昵称", "板块", "内容"], crows);
    } else if (target === "feedback-box") {
      var frows = data.feedbacks.map(function (f) {
        return "<tr><td>" + fmtTs(f.ts) + "</td><td>" + esc(f.nickname) + "</td><td>" +
          esc(f.contact || "-") + "</td><td>" + esc(f.source) + "</td><td>" + esc(f.content) + "</td></tr>";
      }).join("");
      el.innerHTML = "<h3>全部反馈</h3>" + table(["时间", "昵称", "联系方式", "来源", "内容"], frows || emptyRow(5));
    } else if (target === "bili-box") {
      var s = data.bilibili.snapshot;
      var html = "<h3>最新 B 站快照</h3>";
      if (s && s.snapshot) {
        html += "<p class='muted'>抓取时间：" + fmtTs(data.bilibili.ts) + "</p>";
        var ks = Object.keys(s.snapshot);
        html += table(["指标", "数值"], ks.map(function (k) {
          return "<tr><td>" + esc(k) + "</td><td>" + esc(s.snapshot[k]) + "</td></tr>";
        }).join(""));
      } else if (s) {
        html += "<p class='muted'>抓取时间：" + fmtTs(data.bilibili.ts) + "</p>" +
          table(["指标", "数值"], Object.keys(s).map(function (k) {
            return "<tr><td>" + esc(k) + "</td><td>" + esc(s[k]) + "</td></tr>";
          }).join(""));
      } else {
        html += "<p class='muted'>暂无快照数据。请运行 crawler/bilibili.py 或通过 API 写入。</p>";
      }
      el.innerHTML = html;
    }
  }

  function loadBoard(board) {
    var detail = document.getElementById("board-detail");
    if (!detail) return;
    detail.innerHTML = "<p class='muted'>加载 " + board + " 详情…</p>";
    fetch("/api/dev/views/" + encodeURIComponent(board), { headers: authHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) { detail.innerHTML = "<p class='form-msg err'>" + esc(j.error) + "</p>"; return; }
        detail.innerHTML = "<p class='muted'>板块 " + esc(j.board) + " 共 " + esc(j.count) + " 次浏览</p>" +
          table(["时间", "用户", "页面", "IP"], (j.list || []).map(function (r) {
            return "<tr><td>" + fmtTs(r.ts) + "</td><td>" + esc(r.user_id || "-") + "</td><td>" +
              esc(r.page || "-") + "</td><td>" + esc(r.ip || "-") + "</td></tr>";
          }).join(""));
      });
  }

  function table(headers, rowsHtml) {
    var th = headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    return '<table class="data-table"><thead><tr>' + th + "</tr></thead><tbody>" +
      (rowsHtml || emptyRow(headers.length)) + "</tbody></table>";
  }
  function emptyRow(n) {
    return "<tr><td colspan='" + n + "' class='muted text-center'>暂无数据</td></tr>";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
