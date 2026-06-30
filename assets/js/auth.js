/* 注册 / 登录前端逻辑 */
(function () {
  "use strict";
  var FR = window.FR;

  // ---------- 注册页 ----------
  var regForm = document.getElementById("reg-form");
  if (regForm) {
    regForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = document.getElementById("phone").value.trim();
      var email = document.getElementById("email").value.trim();
      var nickname = document.getElementById("nickname").value.trim();
      var password = document.getElementById("password").value;
      var msg = document.getElementById("reg-msg");
      if (!/^\d{11}$/.test(phone)) return FR.showMsg("reg-msg", "手机号必须为 11 位数字", true);
      if (!nickname) return FR.showMsg("reg-msg", "昵称不能为空", true);
      if (!password) return FR.showMsg("reg-msg", "密码不能为空", true);
      FR.api("/api/register", {
        method: "POST",
        body: { phone: phone, email: email || null, nickname: nickname, password: password },
      }).then(function (res) {
        if (res.ok && res.json.id) {
          FR.showMsg("reg-msg", "注册成功！你的用户 ID：" + res.json.id + "，即将跳转登录…", false);
          setTimeout(function () { location.href = "login.html"; }, 1800);
        } else {
          FR.showMsg("reg-msg", (res.json && res.json.error) || "注册失败", true);
        }
      });
    });
  }

  // ---------- 登录页 ----------
  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var identifier = document.getElementById("identifier").value.trim();
      var password = document.getElementById("password").value;
      if (!identifier || !password) return FR.showMsg("login-msg", "请填写完整", true);
      FR.api("/api/login", {
        method: "POST",
        body: { identifier: identifier, password: password },
      }).then(function (res) {
        if (res.ok && res.json.token) {
          localStorage.setItem("fanren_token", res.json.token);
          localStorage.setItem("fanren_nick", res.json.nickname);
          localStorage.setItem("fanren_uid", res.json.id);
          FR.showMsg("login-msg", "登录成功，跳转中…", false);
          setTimeout(function () { location.href = "index.html"; }, 800);
        } else {
          FR.showMsg("login-msg", (res.json && res.json.error) || "登录失败", true);
        }
      });
    });
  }

  // ---------- 开发者登录页 ----------
  var devForm = document.getElementById("dev-form");
  if (devForm) {
    devForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var password = document.getElementById("dev-password").value;
      FR.api("/api/dev/login", { method: "POST", body: { password: password } })
        .then(function (res) {
          if (res.ok && res.json.token) {
            localStorage.setItem("fanren_dev_token", res.json.token);
            location.href = "dev-panel.html";
          } else {
            FR.showMsg("dev-msg", (res.json && res.json.error) || "密码错误", true);
          }
        });
    });
  }
})();
