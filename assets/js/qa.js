/* 问答系统前端：加载 / 分类筛选 / 分页 / 答题 / 查看答案 / 反馈提交 */
(function () {
  "use strict";
  var FR = window.FR;
  var PAGE_SIZE = 20;

  var allQA = [];
  var cats = [];
  var curCat = "全部";
  var curPage = 1;
  var userAnswers = {}; // qid -> 选中的选项索引
  var revealed = {};    // qid -> 是否已查看答案

  function $(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function init() {
    if (!$("qa-list")) return;
    fetch("/data/qa.json").then(function (r) { return r.json(); }).then(function (data) {
      allQA = data.items || [];
      cats = ["全部"].concat(data.categories || []);
      renderCats();
      renderList();
      // 显式埋点 board=qa
      try {
        var uid = localStorage.getItem("fanren_uid");
        FR.api("/api/stats/view", {
          method: "POST",
          body: { board: "qa", page: "qa.html", user_id: uid || null }
        }).catch(function () {});
      } catch (e) {}
    }).catch(function () {
      $("qa-list").innerHTML = '<p class="muted text-center">题目加载失败，请稍后重试。</p>';
    });

    var fb = $("fb-submit");
    if (fb) fb.addEventListener("click", function () {
      if (window.FR_submitFeedback) {
        window.FR_submitFeedback({
          nicknameId: "f-nick",
          contactId: "f-contact",
          contentId: "f-content",
          msgId: "f-msg",
          source: "qa"
        });
      }
    });
  }

  function filtered() {
    return curCat === "全部" ? allQA : allQA.filter(function (q) { return q.category === curCat; });
  }

  function totalPages() {
    return Math.max(1, Math.ceil(filtered().length / PAGE_SIZE));
  }

  function renderCats() {
    var bar = $("cat-bar");
    if (!bar) return;
    bar.innerHTML = cats.map(function (c) {
      var cls = c === curCat ? "btn" : "btn ghost";
      return '<button class="' + cls + ' sm" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + "</button>";
    }).join("");
    bar.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        curCat = b.getAttribute("data-cat");
        curPage = 1;
        renderCats();
        renderList();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderList() {
    var list = filtered();
    var total = list.length;
    var tp = totalPages();
    if (curPage > tp) curPage = tp;
    if (curPage < 1) curPage = 1;
    var start = (curPage - 1) * PAGE_SIZE;
    var page = list.slice(start, start + PAGE_SIZE);

    var el = $("qa-list");
    if (!total) {
      el.innerHTML = '<p class="muted text-center">暂无该分类题目</p>';
      if ($("pager")) $("pager").innerHTML = "";
      if ($("page-info")) $("page-info").textContent = "";
      return;
    }

    el.innerHTML = page.map(function (q, i) {
      var num = start + i + 1;
      var opts = q.options.map(function (o, idx) {
        var cls = "qa-opt";
        if (userAnswers[q.id] === idx) cls += " selected";
        if (revealed[q.id]) {
          if (idx === q.answer) cls += " correct";
          else if (userAnswers[q.id] === idx) cls += " wrong";
        }
        return '<li class="' + cls + '" data-qid="' + q.id + '" data-idx="' + idx + '">' +
          '<span class="qa-letter">' + String.fromCharCode(65 + idx) + "</span>" +
          '<span class="qa-text">' + escapeHtml(o) + "</span>" +
          "</li>";
      }).join("");

      var showAns = !!revealed[q.id];
      var answered = userAnswers[q.id] !== undefined;

      var viewBtn = (answered && !showAns)
        ? '<button class="btn sm qa-view" data-qid="' + q.id + '">查看答案</button>'
        : "";

      var ansBlock = showAns
        ? '<div class="qa-ans revealed">' +
          '<span class="qa-correct">✓ 正确答案：' + String.fromCharCode(65 + q.answer) + ". " + escapeHtml(q.options[q.answer]) + "</span>" +
          '<p class="qa-explain">' + escapeHtml(q.explain || "") + "</p>" +
          "</div>"
        : "";

      return '<div class="card mt qa-card' + (showAns ? " revealed" : "") + '" data-qid="' + q.id + '">' +
        "<h3>" + num + ". " + escapeHtml(q.question) + "</h3>" +
        '<div class="meta">分类：<span class="tag">' + escapeHtml(q.category) + "</span>　题号 #" + q.id + "</div>" +
        '<ol class="qa-opts" style="list-style:none;padding:0">' + opts + "</ol>" +
        viewBtn + ansBlock +
        "</div>";
    }).join("");

    // 选项点击
    el.querySelectorAll(".qa-opt").forEach(function (li) {
      li.addEventListener("click", function () {
        var qid = li.getAttribute("data-qid");
        if (revealed[qid]) return;
        var idx = parseInt(li.getAttribute("data-idx"), 10);
        userAnswers[qid] = idx;
        renderList();
      });
    });
    // 查看答案
    el.querySelectorAll(".qa-view").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var qid = btn.getAttribute("data-qid");
        revealed[qid] = true;
        renderList();
      });
    });

    renderPager(total, tp);
  }

  function renderPager(total, tp) {
    if ($("page-info")) {
      $("page-info").textContent = "第 " + curPage + " / " + tp + " 页 · 共 " + total + " 题";
    }
    var p = $("pager");
    if (!p) return;
    var prevDis = curPage <= 1;
    var nextDis = curPage >= tp;
    var html = "";
    html += '<button class="btn sm' + (prevDis ? " disabled" : "") + '" id="prev-page"' + (prevDis ? " disabled" : "") + ">上一页</button>";
    html += ' <button class="btn sm' + (nextDis ? " disabled" : "") + '" id="next-page"' + (nextDis ? " disabled" : "") + ">下一页</button>";
    p.innerHTML = html;
    var prev = $("prev-page"), next = $("next-page");
    if (prev) prev.addEventListener("click", function () { if (curPage > 1) { curPage--; renderList(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
    if (next) next.addEventListener("click", function () { if (curPage < tp) { curPage++; renderList(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
  }

  onReady(init);
})();
