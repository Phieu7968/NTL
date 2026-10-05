/* =====================================================================
   view-cloud.js — đăng nhập bằng tài khoản thư điện tử của Trường
   ---------------------------------------------------------------------
   Chen vào trước cổng đăng nhập cũ khi cloud-config.js bật enabled.
   Tắt đi thì ứng dụng quay về cách đăng nhập cũ, không màn hình nào đổi.

   Sau khi đăng nhập xong, tệp này đặt phiên bằng CV.store.setSession()
   đúng như cách cũ, nên CV.auth.current() và toàn bộ phần còn lại của
   ứng dụng chạy y nguyên, không biết là đã đổi cách xác thực.
   ===================================================================== */
window.CV = window.CV || {};

CV.viewCloud = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui, S = CV.store;

  let started = false;     // đã gọi init chưa
  let user = null;         // tài khoản Firebase đang đăng nhập
  let scope = null;        // phạm vi đã xác định
  let phase = "khoi-dong"; // khoi-dong | can-dang-nhap | dang-tai | xong | loi
  let message = "";
  let redraw = null;       // hàm vẽ lại của app.js

  const cfg = () => (window.CV.cloudConfig || { enabled: false });

  /** Có bật phần đồng bộ không, và thư viện có sẵn không. */
  function active() {
    const c = cfg();
    if (!c.enabled) return false;
    if (!c.firebase || !c.firebase.projectId) return false;
    return CV.cloud && CV.cloud.available();
  }

  /** Bật nhưng thiếu thư viện Firebase — cảnh báo cho người cài đặt. */
  function misconfigured() {
    const c = cfg();
    return !!c.enabled && (!CV.cloud || !CV.cloud.available());
  }

  /* ---------- khởi động ---------- */

  async function start(rerender) {
    redraw = rerender;
    if (started) return;
    started = true;
    const c = cfg();
    try {
      await CV.cloud.init(c.firebase, {
        provider: c.provider === "microsoft" ? "microsoft" : "google",
        hostedDomain: c.hostedDomain || "",
        tenantId: c.tenantId || ""
      });
    } catch (e) {
      phase = "loi";
      message = "Không khởi động được kết nối máy chủ: " + (e && e.message);
      if (redraw) redraw();
      return;
    }

    CV.cloud.onAuth(async (u) => {
      user = u;
      if (!u) {
        scope = null;
        // Vừa bị thoát vì sai tên miền thì giữ nguyên lời báo, đừng nhảy về
        // màn hình đăng nhập làm người dùng không kịp đọc vì sao bị từ chối.
        if (phase === "sai-ten-mien") { S.clearSession(); S.useBackend(null); return; }
        phase = "can-dang-nhap";
        S.clearSession();
        S.useBackend(null);
        if (redraw) redraw();
        return;
      }
      await afterSignIn(u);
    });
  }

  /** Địa chỉ này có thuộc tên miền của Trường không. */
  function dungTenMien(e) {
    const mien = (cfg().hostedDomain || "").toLowerCase().trim();
    if (!mien) return true;                        // không khai thì không chặn
    const addr = String(e || "").toLowerCase();
    return addr.endsWith("@" + mien) || addr.endsWith("." + mien);
  }

  /** Đăng nhập xong: xác định là ai, gắn listener, đặt phiên. */
  async function afterSignIn(u) {
    // Tham số hd chỉ là gợi ý cho ô chọn tài khoản của Google, vượt qua được.
    // Nên kiểm lại ở đây và thoát ngay, để người dùng thấy lời báo dễ hiểu
    // thay vì đi tới màn hình "chưa tìm thấy hồ sơ". Chặn cuối vẫn là quy tắc.
    if (!dungTenMien(u.email)) {
      const sai = u.email || "";
      phase = "sai-ten-mien";
      message = sai;
      if (redraw) redraw();
      try { await CV.cloud.signOut(); } catch (e) { /* bỏ qua */ }
      phase = "sai-ten-mien";          // signOut làm onAuth bắn về can-dang-nhap
      message = sai;
      if (redraw) redraw();
      return;
    }

    phase = "dang-tai";
    message = "";
    if (redraw) redraw();

    try {
      scope = await CV.cloud.resolveScope(u);
    } catch (e) {
      phase = "loi";
      message = dienGiai(e);
      if (redraw) redraw();
      return;
    }

    // Chưa có hồ sơ nào: thử nối vào danh sách lớp xem có phải sinh viên không.
    if (scope.kind === "unknown") {
      try {
        const r = await CV.cloud.linkStudent(u);
        if (r.ok) scope = await CV.cloud.resolveScope(u);
        else { phase = "chua-co-ho-so"; message = r.error; if (redraw) redraw(); return; }
      } catch (e) {
        // Quy tắc từ chối = địa chỉ này không có trong danh sách lớp nào.
        phase = "chua-co-ho-so";
        message = "Không tìm thấy hồ sơ nào mang địa chỉ thư " + (u.email || "") +
                  ". Nếu Thầy/Cô là giảng viên thì bấm nút đăng ký bên dưới.";
        if (redraw) redraw();
        return;
      }
    }

    if (scope.kind === "pending") { phase = "cho-duyet"; if (redraw) redraw(); return; }

    // Gắn listener và cắm vào store.
    S.useBackend(CV.cloud.backend);
    CV.cloud.connect(scope);

    // Chờ bản ghi của chính mình về tới bản sao thì mới đặt phiên — nếu đặt
    // sớm quá, CV.auth.current() không tìm thấy hồ sơ và sẽ đá ra cổng.
    const id = scope.kind === "advisor" ? scope.uid : scope.studentId;
    const col = scope.kind === "advisor" ? "advisors" : "students";
    const ok = await doiBanGhi(col, id, 12000);
    if (!ok) {
      phase = "loi";
      message = "Đã đăng nhập nhưng chưa tải được hồ sơ về. Kiểm tra kết nối mạng, " +
                "hoặc nhờ quản trị xem lại quyền của tài khoản này.";
      if (redraw) redraw();
      return;
    }

    S.setSession(scope.kind, id);
    if (CV.nhatKy) {
      CV.nhatKy.ghi("dang-nhap",
        "Đăng nhập với vai trò " + (scope.role || scope.kind), scope.khoaId || "");
    }
    phase = "xong";
    if (redraw) redraw();
  }

  /** Đợi một bản ghi xuất hiện trong bản sao, tối đa ms mili giây. */
  function doiBanGhi(col, id, ms) {
    return new Promise((resolve) => {
      if (S.get(col, id)) return resolve(true);
      let xong = false;
      const thoi = setTimeout(() => { if (!xong) { xong = true; huy(); resolve(false); } }, ms || 10000);
      const huy = S.on(() => {
        if (xong) return;
        if (S.get(col, id)) { xong = true; clearTimeout(thoi); huy(); resolve(true); }
      });
    });
  }

  function dienGiai(e) {
    const code = (e && e.code) || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return "Cửa sổ đăng nhập đã bị đóng. Bấm lại để thử lần nữa.";
    }
    if (code === "auth/popup-blocked") {
      return "Trình duyệt đã chặn cửa sổ đăng nhập. Cho phép cửa sổ bật lên rồi thử lại.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Cách đăng nhập này chưa được bật trong Firebase Console " +
             "(Authentication → Sign-in method).";
    }
    if (code === "auth/unauthorized-domain") {
      return "Tên miền của trang này chưa được cho phép trong Firebase Console " +
             "(Authentication → Settings → Authorized domains).";
    }
    if (code === "permission-denied") {
      return "Máy chủ từ chối. Tài khoản này chưa được phân quyền.";
    }
    return (e && e.message) || "Lỗi không rõ.";
  }

  /* ---------- các màn hình ---------- */

  function khung(children) {
    return CV.viewAuth.gateShell(children);
  }

  function dau(tieuDe, phu) {
    const s = S.settings();
    return el("div", { class: "gate-head" }, [
      el("img", { src: "assets/icons/logo-mtu.png",
        alt: "Logo Trường Đại học Xây dựng Miền Tây", width: 133, height: 112 }),
      el("h1", { text: tieuDe }),
      el("p", { text: phu || (s.schoolName + (s.facultyName ? " — " + s.facultyName : "")) })
    ]);
  }

  /** Dấu chữ G của Google, vẽ thẳng bằng SVG để không phải tải ảnh từ mạng. */
  function dauG() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 48 48");
    svg.setAttribute("width", "19");
    svg.setAttribute("height", "19");
    svg.setAttribute("aria-hidden", "true");
    svg.style.flex = "0 0 auto";
    [
      ["#4285F4", "M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"],
      ["#34A853", "M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"],
      ["#FBBC05", "M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"],
      ["#EA4335", "M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"]
    ].forEach(([mau, d]) => {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("fill", mau);
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    return svg;
  }

  function nutDangNhap(nen, nhan) {
    const chu = el("span", { text: nhan, style: "min-width:0" });
    const b = el("button", {
      class: "btn btn-primary btn-block",
      type: "button",
      // .btn đặt white-space:nowrap; với nút dài chiếm hết bề ngang thì nhãn
      // không co được và đẩy cả thẻ tràn khỏi màn hình điện thoại. Cho xuống
      // dòng và bỏ chiều rộng tối thiểu để chuyện đó không xảy ra nữa.
      style: "display:flex;align-items:center;justify-content:center;gap:.6rem;" +
             "white-space:normal;line-height:1.3;min-width:0;padding-block:.7rem;" +
             "text-align:left"
    });
    if (nen === "google") {
      const trong = el("span", {
        style: "display:inline-flex;align-items:center;justify-content:center;" +
               "width:26px;height:26px;border-radius:50%;background:#fff;flex:0 0 auto"
      }, dauG());
      b.appendChild(trong);
    }
    b.appendChild(chu);
    b.addEventListener("click", async () => {
      b.disabled = true;
      chu.textContent = "Đang mở cửa sổ đăng nhập…";
      try {
        await CV.cloud.signIn(nen);
      } catch (e) {
        b.disabled = false;
        chu.textContent = nhan;
        ui.toast(dienGiai(e), "warn", 6000);
      }
    });
    return b;
  }

  function manDangNhap() {
    const c = cfg();
    const nut = [];
    if (c.provider === "google" || c.provider === "ca-hai") {
      nut.push(nutDangNhap("google", "Đăng nhập bằng tài khoản Trường"));
      nut.push(el("p", { class: "muted",
        style: "text-align:center;font-size:.82rem;margin:.65rem 0 0",
        text: "Chọn tài khoản Google có đuôi @" + (c.hostedDomain || "mtu.edu.vn") }));
    }
    if (c.provider === "microsoft" || c.provider === "ca-hai") {
      const b = nutDangNhap("microsoft", "Đăng nhập bằng tài khoản Microsoft");
      if (nut.length) b.className = "btn btn-ghost btn-block";
      nut.push(b);
    }

    khung([
      dau("Cố vấn học tập " + (S.settings().schoolShort || "MTU")),
      el("div", { style: "max-width:430px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [
          el("p", { text: "Dùng địa chỉ thư điện tử @" + (c.hostedDomain || "mtu.edu.vn") +
                          " mà Trường đã cấp. Cả giảng viên và sinh viên đều đăng nhập ở đây." })
        ].concat(nut))], { strength: 5 }),
        ui.note("Hệ thống không giữ mật khẩu của Thầy/Cô hay của sinh viên. " +
                "Việc xác thực do hệ thống thư điện tử của Trường đảm nhiệm.", "info")
      ])
    ]);
  }

  function manDangTai() {
    khung([
      dau("Đang tải dữ liệu…"),
      el("div", { style: "max-width:430px;margin-inline:auto" }, [
        ui.note("Đang lấy phần dữ liệu mà tài khoản này được phép xem. " +
                "Lần đầu trên một máy mới có thể lâu hơn một chút.", "info")
      ])
    ]);
  }

  function manChoDuyet() {
    khung([
      dau("Tài khoản đang chờ duyệt"),
      el("div", { style: "max-width:470px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [
          el("p", { text: "Tài khoản " + ((user && user.email) || "") +
                          " đã đăng ký nhưng chưa được phân quyền." }),
          el("p", { text: "Nhờ quản trị cấp Khoa hoặc tác giả hệ thống duyệt và " +
                          "giao lớp phụ trách. Duyệt xong thì đăng nhập lại là dùng được." })
        ])], { strength: 5 }),
        nutDangXuat()
      ])
    ]);
  }

  function manChuaCoHoSo() {
    khung([
      dau("Chưa tìm thấy hồ sơ"),
      el("div", { style: "max-width:470px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [
          el("p", { text: message || "" }),
          el("p", { class: "muted", text: "Nếu em là sinh viên: nhờ cố vấn học tập kiểm tra " +
                    "xem danh sách lớp đã có địa chỉ thư này chưa." })
        ])], { strength: 5 }),
        el("button", { class: "btn btn-primary btn-block", type: "button",
          text: "Tôi là giảng viên — đăng ký tài khoản", onclick: manDangKy }),
        nutDangXuat()
      ])
    ]);
  }

  function manDangKy() {
    const f = ui.form([
      { name: "name", label: "Họ và tên", required: true, full: true },
      { name: "title", label: "Học hàm, học vị", placeholder: "ThS.", full: true },
      { name: "khoaId", label: "Mã Khoa", placeholder: "XD", required: true, full: true }
    ], { name: (user && user.displayName) || "" });

    const nut = el("button", { class: "btn btn-primary btn-block", type: "button",
      text: "Gửi đăng ký" });
    nut.addEventListener("click", async () => {
      if (!f.validate()) return;
      const v = {};
      Object.keys(f.inputs).forEach((k) => { v[k] = f.inputs[k].value.trim(); });
      nut.disabled = true;
      nut.textContent = "Đang gửi…";
      try {
        await CV.cloud.registerAdvisor(user, v);
        scope = { kind: "pending" };
        phase = "cho-duyet";
        if (redraw) redraw();
      } catch (e) {
        nut.disabled = false;
        nut.textContent = "Gửi đăng ký";
        ui.toast(dienGiai(e), "warn", 6000);
      }
    });

    khung([
      dau("Đăng ký tài khoản giảng viên"),
      el("div", { style: "max-width:470px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [f.node, nut])], { strength: 5 }),
        ui.note("Đăng ký xong, tài khoản ở trạng thái chờ duyệt và chưa xem được dữ liệu " +
                "của lớp nào. Quản trị Khoa duyệt rồi mới dùng được.", "info"),
        nutDangXuat()
      ])
    ]);
  }

  function manSaiTenMien() {
    const mien = cfg().hostedDomain || "mtu.edu.vn";
    khung([
      dau("Sai tài khoản"),
      el("div", { style: "max-width:470px;margin-inline:auto" }, [
        ui.card3d([el("div", { class: "lift-1" }, [
          el("p", { text: "Địa chỉ " + (message || "") + " không thuộc Trường." }),
          el("p", { text: "Hệ thống chỉ nhận tài khoản có đuôi @" + mien +
                          " mà Trường đã cấp. Tài khoản Gmail cá nhân không dùng được." }),
          el("p", { class: "muted", text: "Đang đăng nhập nhầm tài khoản khác trên máy này thì " +
                    "bấm lại rồi chọn đúng tài khoản của Trường." })
        ])], { strength: 5 }),
        el("button", { class: "btn btn-primary btn-block", type: "button",
          text: "Thử lại với tài khoản của Trường",
          onclick: () => { phase = "can-dang-nhap"; message = ""; if (redraw) redraw(); } })
      ])
    ]);
  }

  function manLoi() {
    khung([
      dau("Không vào được"),
      el("div", { style: "max-width:470px;margin-inline:auto" }, [
        ui.note(message || "Lỗi không rõ.", "warn"),
        el("button", { class: "btn btn-primary btn-block", type: "button",
          text: "Thử lại", onclick: () => { phase = "dang-tai"; if (redraw) redraw();
            if (user) afterSignIn(user); else { phase = "can-dang-nhap"; if (redraw) redraw(); } } }),
        nutDangXuat()
      ])
    ]);
  }

  function nutDangXuat() {
    return el("div", { style: "text-align:center;margin-top:1rem" },
      el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Đăng xuất",
        onclick: async () => { try { await CV.cloud.signOut(); } catch (e) { /* bỏ qua */ } } }));
  }

  /* ---------- chen vào trước cổng cũ ---------- */

  /**
   * app.js gọi hàm này đầu mỗi lần vẽ.
   * @returns true nếu đã vẽ màn hình của mình và app.js phải dừng lại.
   */
  function gate(rerender) {
    if (misconfigured()) {
      CV.viewAuth.gateShell([
        dau("Thiếu thư viện Firebase"),
        el("div", { style: "max-width:470px;margin-inline:auto" },
          ui.note("cloud-config.js đang bật enabled nhưng chưa nạp được thư viện Firebase. " +
                  "Xem hướng dẫn trong assets/vendor/README.md, hoặc đặt enabled: false " +
                  "để chạy tạm trên một máy.", "warn"))
      ]);
      return true;
    }
    if (!active()) return false;

    if (!started) { start(rerender); }

    switch (phase) {
      case "khoi-dong":     manDangTai(); return true;
      case "can-dang-nhap": manDangNhap(); return true;
      case "dang-tai":      manDangTai(); return true;
      case "cho-duyet":     manChoDuyet(); return true;
      case "chua-co-ho-so": manChuaCoHoSo(); return true;
      case "sai-ten-mien":  manSaiTenMien(); return true;
      case "loi":           manLoi(); return true;
      default:              return false;   // "xong" — để app.js vẽ tiếp như thường
    }
  }

  async function signOut() {
    try { await CV.cloud.signOut(); } catch (e) { /* bỏ qua */ }
  }

  return { active, misconfigured, gate, signOut,
    get phase() { return phase; },
    get scope() { return scope; } };
})();
