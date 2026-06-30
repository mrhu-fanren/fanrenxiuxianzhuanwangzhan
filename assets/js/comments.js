/* 评论前端：短评 / 长评 / 留言区渲染 */
(function () {
  "use strict";
  var FR = window.FR;

  function fmtTs(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleString("zh-CN"); } catch (e) { return ts; }
  }

  function renderList(containerId, items) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '<p class="muted text-center">暂无留言，快来抢沙发吧。</p>';
      return;
    }
    el.innerHTML = items.map(function (c) {
      var spam = c.is_spam ? " spam" : "";
      var longTag = c.long_id ? ' <span class="seal-tag">长评 #' + c.long_id + "</span>" : "";
      return '<div class="comment-item' + spam + '">' +
        '<span class="nick">' + escapeHtml(c.nickname) + "</span>" +
        '<span class="ts">' + fmtTs(c.ts) + "</span>" +
        longTag +
        '<div class="ct">' + escapeHtml(c.content) + "</div>" +
        "</div>";
    }).join("");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  // 加载评论（指定 board）
  window.FR_loadComments = function (board, containerId) {
    FR.api("/api/comments?board=" + encodeURIComponent(board))
      .then(function (res) { renderList(containerId, res.json || []); });
  };

  // 提交评论
  window.FR_submitComment = function (opts) {
    // opts: {type, board, nicknameId, contentId, contactId?, msgId, listId}
    var type = opts.type;
    var nickname = document.getElementById(opts.nicknameId).value.trim();
    var content = document.getElementById(opts.contentId).value.trim();
    var contact = opts.contactId ? document.getElementById(opts.contactId).value.trim() : "";
    if (!nickname) return FR.showMsg(opts.msgId, "昵称不能为空", true);
    if (!content) return FR.showMsg(opts.msgId, "内容不能为空", true);
    if (type === "long" && !contact) return FR.showMsg(opts.msgId, "长评需提供手机号或邮箱", true);
    var body = {
      type: type, nickname: nickname, content: content,
      contact: contact || null, board: opts.board,
      user_id: localStorage.getItem("fanren_uid") || null,
    };
    FR.api("/api/comments", { method: "POST", body: body }).then(function (res) {
      if (res.ok) {
        var extra = res.json.long_id ? "（长评 ID：" + res.json.long_id + "）" : "";
        FR.showMsg(opts.msgId, "发表成功" + extra, false);
        document.getElementById(opts.contentId).value = "";
        if (opts.listId) window.FR_loadComments(opts.board, opts.listId);
      } else {
        FR.showMsg(opts.msgId, (res.json && res.json.error) || "发表失败", true);
      }
    });
  };

  // 反馈
  window.FR_submitFeedback = function (opts) {
    var nickname = document.getElementById(opts.nicknameId).value.trim();
    var contact = opts.contactId ? document.getElementById(opts.contactId).value.trim() : "";
    var content = document.getElementById(opts.contentId).value.trim();
    if (!content) return FR.showMsg(opts.msgId, "反馈内容不能为空", true);
    FR.api("/api/feedback", {
      method: "POST",
      body: { nickname: nickname || "匿名", contact: contact || null, content: content, source: opts.source || "site" },
    }).then(function (res) {
      if (res.ok) {
        FR.showMsg(opts.msgId, "反馈已送达开发者，感谢道友！", false);
        document.getElementById(opts.contentId).value = "";
      } else {
        FR.showMsg(opts.msgId, (res.json && res.json.error) || "提交失败", true);
      }
    });
  };
})();
