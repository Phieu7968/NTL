/* =====================================================================
   app.js — khởi động, định tuyến và khung điều hướng
   ===================================================================== */
window.CV = window.CV || {};

CV.app = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui, S = CV.store;

  const HOME = { advisor: "advisor/dashboard", student: "student/home" };
  let deferredInstall = null;

  function routesFor(kind) {
    return kind === "advisor" ? CV.viewAdvisor.routes : CV.viewStudent.routes;
  }

  /* ---------- địa chỉ dạng #/duong-dan?tham=so ---------- */
  function parseHash() {
    const raw = String(location.hash || "").replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const params = {};
    new URLSearchParams(query || "").forEach((v, k) => { params[k] = v; });
    return { key: path || "", params };
  }

  function go(path) {
    const next = "#/" + String(path).replace(/^#?\/?/, "");
    if (location.hash === next) render();
    else location.hash = next;
  }

  /* ---------- thanh điều hướng ---------- */
  function buildNav(kind, activeKey) {
    const routes = routesFor(kind);
    const desktop = document.getElementById("nav-desktop");
    const mobile = document.getElementById("nav-mobile");
    desktop.innerHTML = "";
    mobile.innerHTML = "";

    desktop.appendChild(el("div", { class: "nav-group",
      text: kind === "advisor" ? "Cố vấn học tập" : "Sinh viên" }));

    Object.keys(routes).forEach((key) => {
      const r = routes[key];
      if (!r.nav) return;
      const current = key === activeKey ? "page" : null;

      const link = el("button", { class: "nav-link", type: "button", "aria-current": current }, [
        el("span", { class: "nav-ico", "data-ico": r.icon }),
        el("span", { text: r.nav })
      ]);
      link.addEventListener("click", () => { go(key); closeMenu(); });

      // chấm báo số việc đang chờ
      const n = pendingCount(kind, key);
      if (n) link.appendChild(el("span", { class: "badge-n", text: String(n) }));
      desktop.appendChild(link);

      const tab = el("button", { class: "tab", type: "button", "aria-current": current }, [
        el("span", { class: "nav-ico", "data-ico": r.icon }),
        el("span", { text: r.nav })
      ]);
      tab.addEventListener("click", () => go(key));
      mobile.appendChild(tab);
    });
    mobile.style.gridTemplateColumns = `repeat(${mobile.children.length}, 1fr)`;
  }

  /** Số việc đang chờ xử lý, hiện cạnh mục điều hướng. */
  function pendingCount(kind, key) {
    try {
      if (kind === "advisor" && key === "advisor/appointments") {
        const mine = new Set(CV.viewAdvisor.myStudents().map((s) => s.id));
        return S.all("appointments").filter((a) => mine.has(a.studentId) &&
          (a.status || "Chờ duyệt") === "Chờ duyệt").length;
      }
      if (kind === "student" && key === "student/appointments") {
        const m = CV.viewStudent.me();
        return m ? S.find("appointments", (a) => a.studentId === m.id && a.status === "Đã duyệt").length : 0;
      }
    } catch (e) { /* không để lỗi phụ làm sập điều hướng */ }
    return 0;
  }

  function closeMenu() {
    document.getElementById("sidenav").classList.remove("open");
    document.getElementById("scrim").hidden = true;
  }

  /* ---------- vẽ màn hình ---------- */
  function render() {
    const who = CV.auth.current();

    if (!S.all("advisors").length) { CV.viewAuth.renderSetup(() => render()); return; }
    if (!who) { CV.viewAuth.renderRoles(() => render()); return; }

    CV.viewAuth.hideGate();
    const routes = routesFor(who.kind);
    let { key, params } = parseHash();

    // không cho vai trò này mở màn hình của vai trò kia
    if (!routes[key]) {
      const fallback = HOME[who.kind];
      if (key !== fallback) { go(fallback); return; }
      key = fallback;
    }

    const route = routes[key];
    document.getElementById("page-title").textContent = route.title;
    document.title = `${route.title} — CVHT MTU`;

    const s = S.settings();
    document.getElementById("page-sub").textContent =
      s.schoolName + (s.facultyName ? " — " + s.facultyName : "");

    const name = who.user.name || "—";
    document.getElementById("who-name").textContent = name;
    document.getElementById("who-role").textContent =
      who.kind === "advisor" ? (who.user.role === "owner" ? "Quản trị" : "Cố vấn") : (who.user.mssv || "Sinh viên");
    document.getElementById("who-avatar").textContent = U.initials(name);

    buildNav(who.kind, key);
    buildTopActions(who);

    const view = document.getElementById("view");
    view.innerHTML = "";
    CV.charts.hideTip();
    try {
      route.render(view, params);
    } catch (err) {
      console.error(err);
      view.appendChild(ui.card("Có lỗi khi hiển thị màn hình này", [
        el("p", { text: String(err && err.message ? err.message : err) }),
        el("button", { class: "btn btn-ghost", text: "Về trang chính", onclick: () => go(HOME[who.kind]) })
      ]));
    }
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    S.touchSession();
  }

  function buildTopActions(who) {
    const host = document.getElementById("topbar-actions");
    host.innerHTML = "";
    if (deferredInstall) {
      host.appendChild(el("button", { class: "btn btn-ghost btn-sm", text: "Cài vào máy",
        onclick: async () => {
          deferredInstall.prompt();
          try { await deferredInstall.userChoice; } catch (e) { /* bỏ qua */ }
          deferredInstall = null;
          buildTopActions(who);
        } }));
    }
    if (who.kind === "advisor") {
      host.appendChild(el("button", { class: "btn btn-primary btn-sm only-desktop", text: "+ Sinh viên",
        onclick: () => go("advisor/students") }));
    }
  }

  /* ---------- khởi động ---------- */
  function boot() {
    S.load();
    S.initSync();
    ui.applyTheme(S.settings().theme || "auto");

    // các nút cố định trên khung
    document.getElementById("btn-theme").addEventListener("click", () => ui.cycleTheme());
    document.getElementById("btn-logout").addEventListener("click", async () => {
      if (!(await ui.confirm({ title: "Đăng xuất", message: "Thoát khỏi tài khoản hiện tại?" }))) return;
      CV.auth.logout();
      closeMenu();
      location.hash = "";
      render();
    });
    document.getElementById("btn-menu").addEventListener("click", () => {
      const nav = document.getElementById("sidenav");
      const open = nav.classList.toggle("open");
      document.getElementById("scrim").hidden = !open;
    });
    document.getElementById("scrim").addEventListener("click", closeMenu);
    document.getElementById("btn-who").addEventListener("click", () => {
      const who = CV.auth.current();
      if (!who) return;
      go(who.kind === "advisor" ? "advisor/settings" : "student/profile");
    });

    window.addEventListener("hashchange", render);

    // dữ liệu đổi ở tab khác thì vẽ lại
    S.on((reason) => { if (reason === "remote") render(); });

    // hết hạn phiên thì đưa về màn hình đăng nhập
    setInterval(() => {
      const who = CV.auth.current();
      const gateVisible = document.getElementById("shell").hidden;
      if (!who && !gateVisible) {
        ui.toast("Phiên làm việc đã hết hạn, mời đăng nhập lại.", "warn");
        render();
      }
    }, 30000);

    window.addEventListener("beforeinstallprompt", (ev) => {
      ev.preventDefault();
      deferredInstall = ev;
      const who = CV.auth.current();
      if (who) buildTopActions(who);
    });

    document.getElementById("splash").remove();
    render();

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Không đăng ký được service worker:", e));
      });
    }
  }

  return { boot, go, render, parseHash };
})();

document.addEventListener("DOMContentLoaded", function () {
  try {
    CV.app.boot();
  } catch (err) {
    console.error(err);
    const splash = document.getElementById("splash");
    if (splash) {
      splash.innerHTML = "";
      splash.appendChild(CV.util.el("div", { style: "text-align:center;max-width:420px;padding:1rem" }, [
        CV.util.el("h1", { text: "Không khởi động được ứng dụng" }),
        CV.util.el("p", { text: String(err && err.message ? err.message : err) }),
        CV.util.el("p", { text: "Thử tải lại trang. Nếu vẫn lỗi, dữ liệu lưu trữ có thể đã hỏng." })
      ]));
    }
  }
});
