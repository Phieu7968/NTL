/* =====================================================================
   view-auth.js — thiết lập lần đầu, chọn vai trò và đăng nhập
   Nguyên tắc: trong mã nguồn KHÔNG có sẵn bất kỳ tài khoản, mật khẩu hay
   mã PIN nào. Tài khoản đầu tiên do chính người dùng tạo lúc cài đặt.
   ===================================================================== */
window.CV = window.CV || {};

CV.auth = (function () {
  "use strict";
  const U = CV.util;
  const THROTTLE_KEY = "CVHT_MTU_THROTTLE_V1";
  const MAX_TRIES = 5;
  const LOCK_MS = 60 * 1000;

  function throttleRead() {
    try { return JSON.parse(window.localStorage.getItem(THROTTLE_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function throttleWrite(obj) {
    try { window.localStorage.setItem(THROTTLE_KEY, JSON.stringify(obj)); } catch (e) { /* bỏ qua */ }
  }
  /** Còn bị khoá thì trả về số giây phải chờ, không thì trả về 0. */
  function lockedFor(key) {
    const t = throttleRead()[key];
    if (!t || !t.until || Date.now() > t.until) return 0;
    return Math.ceil((t.until - Date.now()) / 1000);
  }
  function noteFail(key) {
    const all = throttleRead();
    const t = all[key] || { n: 0 };
    t.n++;
    if (t.n >= MAX_TRIES) { t.until = Date.now() + LOCK_MS; t.n = 0; }
    all[key] = t;
    throttleWrite(all);
    return t;
  }
  function noteOk(key) {
    const all = throttleRead();
    delete all[key];
    throttleWrite(all);
  }

  /** Đăng nhập cố vấn bằng email hoặc mã cán bộ + mật khẩu. */
  function loginAdvisor(login, password) {
    const key = "adv:" + U.fold(login);
    const wait = lockedFor(key);
    if (wait) return { ok: false, error: `Sai quá nhiều lần. Vui lòng thử lại sau ${wait} giây.` };

    const k = U.fold(login);
    const adv = CV.store.first("advisors", (a) =>
      U.fold(a.email) === k || U.fold(a.code) === k);

    // So sánh cả khi không tìm thấy tài khoản để thời gian phản hồi không
    // tiết lộ email nào có thật.
    const rec = adv && adv.secret ? adv.secret : { salt: "khong-ton-tai", hash: "0".repeat(64), rounds: 2000 };
    const okPass = U.checkSecret(password, rec);

    if (!adv || !okPass) {
      noteFail(key);
      return { ok: false, error: "Sai tài khoản hoặc mật khẩu." };
    }
    if (adv.active === false) return { ok: false, error: "Tài khoản đã bị khoá. Liên hệ quản trị." };

    noteOk(key);
    CV.store.setSession("advisor", adv.id);
    CV.store.put("advisors", { id: adv.id, lastLoginAt: new Date().toISOString() });
    return { ok: true, advisor: adv };
  }

  /** Đăng nhập sinh viên: MSSV + mã PIN (hoặc ngày sinh, tuỳ cài đặt). */
  function loginStudent(mssv, secret) {
    const code = String(mssv || "").trim().toUpperCase();
    const key = "sv:" + code;
    const wait = lockedFor(key);
    if (wait) return { ok: false, error: `Sai quá nhiều lần. Vui lòng thử lại sau ${wait} giây.` };

    const st = CV.store.first("students", (s) => String(s.mssv || "").toUpperCase() === code);
    const mode = CV.store.settings().studentLogin === "dob" ? "dob" : "pin";

    if (mode === "dob") {
      const okDob = st && st.dob && CV.io.toIsoDate(secret) === st.dob;
      if (!okDob) { noteFail(key); return { ok: false, error: "Sai mã số sinh viên hoặc ngày sinh." }; }
    } else {
      const rec = st && st.secret ? st.secret : { salt: "khong-ton-tai", hash: "0".repeat(64), rounds: 2000 };
      const okPin = U.checkSecret(secret, rec);
      if (!st || !st.secret) {
        noteFail(key);
        return { ok: false, error: "Tài khoản chưa được cấp mã PIN. Vui lòng liên hệ giảng viên cố vấn." };
      }
      if (!okPin) { noteFail(key); return { ok: false, error: "Sai mã số sinh viên hoặc mã PIN." }; }
    }

    noteOk(key);
    CV.store.setSession("student", st.id);
    CV.store.put("students", { id: st.id, lastLoginAt: new Date().toISOString() });
    return { ok: true, student: st, mustChange: !!st.mustChangeSecret };
  }

  function logout() { CV.store.clearSession(); }

  /** Người đang đăng nhập, kèm vai trò. */
  function current() {
    const s = CV.store.session();
    if (!s) return null;
    const who = s.kind === "advisor" ? CV.store.get("advisors", s.id) : CV.store.get("students", s.id);
    return who ? { kind: s.kind, user: who } : null;
  }

  return { loginAdvisor, loginStudent, logout, current, lockedFor };
})();

CV.viewAuth = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui;

  function logo(size) {
    return el("img", { src: "assets/icons/icon-192.png", alt: "", width: size || 72, height: size || 72 });
  }

  function gateShell(children) {
    document.getElementById("shell").hidden = true;
    const host = document.getElementById("view-gate") || el("div", { id: "view-gate", class: "gate" });
    host.innerHTML = "";
    host.appendChild(el("div", { class: "gate-box" }, children));
    if (!host.parentNode) document.body.appendChild(host);
    host.hidden = false;
    return host;
  }
  function hideGate() {
    const host = document.getElementById("view-gate");
    if (host) host.hidden = true;
    document.getElementById("shell").hidden = false;
  }

  /* ---------- 1. Thiết lập lần đầu ---------- */
  function renderSetup(onDone) {
    const s = CV.store.settings();
    const f = ui.form([
      { name: "school", label: "Tên trường", value: s.schoolName, required: true, full: true },
      { name: "faculty", label: "Khoa / Bộ môn", value: s.facultyName, placeholder: "Khoa Xây dựng", full: true },
      { name: "sep1", type: "separator", label: "Tài khoản giảng viên cố vấn đầu tiên" },
      { name: "name", label: "Họ và tên", required: true, placeholder: "Trương Hoàng Phiếu",
        validate: (v) => CV.academic.validate.name(v) },
      { name: "title", label: "Học hàm / học vị", placeholder: "ThS." },
      { name: "email", label: "Email đăng nhập", type: "email", required: true,
        autocomplete: "username", validate: (v) => CV.academic.validate.email(v) },
      { name: "code", label: "Mã cán bộ", placeholder: "Dùng thay email khi đăng nhập cũng được" },
      { name: "phone", label: "Điện thoại", type: "tel", validate: (v) => CV.academic.validate.phone(v) },
      { name: "pw", label: "Mật khẩu", type: "password", required: true, autocomplete: "new-password",
        hint: "Tối thiểu 8 ký tự, có cả chữ và số.",
        validate: (v) => CV.academic.validate.password(v) },
      { name: "pw2", label: "Nhập lại mật khẩu", type: "password", required: true, autocomplete: "new-password" }
    ]);

    const strength = el("p", { class: "hint", style: "margin:-.4rem 0 1rem;grid-column:1/-1" });
    f.node.appendChild(strength);
    f.inputs.pw.input.addEventListener("input", () => {
      const r = U.passwordStrength(f.inputs.pw.input.value);
      strength.textContent = f.inputs.pw.input.value
        ? `Độ mạnh: ${r.label}${r.tips.length ? " — nên " + r.tips.join(", ") : ""}` : "";
    });

    const submit = el("button", { class: "btn btn-primary btn-block", type: "button", text: "Tạo tài khoản và bắt đầu" });
    submit.addEventListener("click", () => {
      const d = f.validate();
      if (!d) return;
      if (d.pw !== d.pw2) { ui.toast("Hai ô mật khẩu chưa giống nhau.", "err"); f.inputs.pw2.input.focus(); return; }

      const st = CV.store.settings();
      st.schoolName = d.school;
      st.facultyName = d.faculty;
      CV.store.put("advisors", {
        name: d.name, title: d.title, email: d.email, code: d.code,
        phone: d.phone, role: "owner", active: true, secret: U.makeSecret(d.pw)
      });
      CV.store.save("setup");
      ui.toast("Đã tạo tài khoản. Mời đăng nhập.", "ok");
      onDone();
    });

    gateShell([
      el("div", { class: "gate-head" }, [
        logo(72),
        el("h1", { text: "Cài đặt lần đầu" }),
        el("p", { text: "Ứng dụng chưa có tài khoản nào. Hãy tạo tài khoản giảng viên cố vấn đầu tiên." })
      ]),
      ui.card3d([
        el("div", { class: "lift-1" }, [f.node, submit])
      ]),
      el("p", { class: "gate-note", text: "Mật khẩu được băm bằng SHA-256 có muối trước khi lưu. Không có tài khoản mặc định nào cài sẵn trong mã nguồn." })
    ]);
  }

  /* ---------- 2. Chọn vai trò ---------- */
  function renderRoles(go) {
    const s = CV.store.settings();
    const mk = (icon, title, desc, action) => {
      const btn = el("button", { class: "role-card", type: "button" }, [
        el("div", { class: "card3d-in" }, [
          el("div", { class: "role-ico lift-2" }, el("span", { class: "nav-ico", "data-ico": icon })),
          el("h2", { class: "lift-1", text: title }),
          el("p", { class: "lift-1", text: desc }),
          el("p", { class: "go lift-2", text: "Đăng nhập →" })
        ])
      ]);
      const wrap = el("div", { class: "card3d" }, btn.firstChild);
      btn.innerHTML = "";
      btn.appendChild(wrap);
      ui.tilt(wrap, 9);
      btn.addEventListener("click", action);
      return btn;
    };

    gateShell([
      el("div", { class: "gate-head" }, [
        logo(76),
        el("h1", { text: "Cố vấn học tập " + (s.schoolShort || "MTU") }),
        el("p", { text: s.schoolName + (s.facultyName ? " — " + s.facultyName : "") })
      ]),
      el("div", { class: "role-deck" }, [
        mk("user", "Cổng Sinh viên", "Xem kết quả học tập, tín chỉ nợ và đặt lịch gặp cố vấn.", () => renderStudentLogin(go)),
        mk("users", "Giảng viên Cố vấn", "Quản lý lớp, nhập điểm, theo dõi cảnh báo học vụ và lập báo cáo.", () => renderAdvisorLogin(go))
      ]),
      el("p", { class: "gate-note", text: "Dữ liệu được lưu ngay trên thiết bị này. Xem mục Cài đặt để sao lưu." })
    ]);
  }

  /* ---------- 3. Đăng nhập cố vấn ---------- */
  function renderAdvisorLogin(go) {
    const f = ui.form([
      { name: "login", label: "Email hoặc mã cán bộ", required: true, full: true, autocomplete: "username" },
      { name: "pw", label: "Mật khẩu", type: "password", required: true, full: true, autocomplete: "current-password" }
    ]);
    const btn = el("button", { class: "btn btn-primary btn-block", type: "button", text: "Đăng nhập" });
    const back = el("button", { class: "btn btn-ghost btn-block", type: "button", text: "← Quay lại", style: "margin-top:.6rem" });

    function submit() {
      const d = f.validate();
      if (!d) return;
      const r = CV.auth.loginAdvisor(d.login, d.pw);
      if (!r.ok) { ui.toast(r.error, "err"); return; }
      ui.toast(`Xin chào ${r.advisor.name}.`, "ok");
      go();
    }
    btn.addEventListener("click", submit);
    f.node.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    back.addEventListener("click", () => renderRoles(go));

    gateShell([
      el("div", { class: "gate-head" }, [logo(64), el("h1", { text: "Giảng viên Cố vấn" })]),
      el("div", { style: "max-width:430px;margin-inline:auto" },
        ui.card3d([el("div", { class: "lift-1" }, [f.node, btn, back])], { strength: 5 }))
    ]);
  }

  /* ---------- 4. Đăng nhập sinh viên ---------- */
  function renderStudentLogin(go) {
    const byDob = CV.store.settings().studentLogin === "dob";
    const f = ui.form([
      { name: "mssv", label: "Mã số sinh viên", required: true, full: true, autocomplete: "username",
        placeholder: "Ví dụ: 26XD01001" },
      byDob
        ? { name: "secret", label: "Ngày sinh", type: "date", required: true, full: true }
        : { name: "secret", label: "Mã PIN", type: "password", required: true, full: true,
            inputmode: "numeric", autocomplete: "current-password",
            hint: "Mã PIN 6 chữ số do giảng viên cố vấn cấp." }
    ]);
    const btn = el("button", { class: "btn btn-primary btn-block", type: "button", text: "Xem hồ sơ của tôi" });
    const back = el("button", { class: "btn btn-ghost btn-block", type: "button", text: "← Quay lại", style: "margin-top:.6rem" });

    function submit() {
      const d = f.validate();
      if (!d) return;
      const r = CV.auth.loginStudent(d.mssv, d.secret);
      if (!r.ok) { ui.toast(r.error, "err"); return; }
      go();
      if (r.mustChange) setTimeout(() => CV.viewStudent.forceChangePin(), 300);
    }
    btn.addEventListener("click", submit);
    f.node.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    back.addEventListener("click", () => renderRoles(go));

    gateShell([
      el("div", { class: "gate-head" }, [logo(64), el("h1", { text: "Cổng Sinh viên" })]),
      el("div", { style: "max-width:430px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [f.node, btn, back])], { strength: 5 }),
        ui.note("Mỗi sinh viên chỉ xem được hồ sơ của chính mình. Nếu chưa có mã PIN, hãy liên hệ giảng viên cố vấn của lớp.", "info")
      ])
    ]);
  }

  return { renderSetup, renderRoles, renderAdvisorLogin, renderStudentLogin, hideGate, gateShell };
})();
