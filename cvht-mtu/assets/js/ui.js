/* =====================================================================
   ui.js — các mảnh giao diện dùng lại: thẻ 3D, hộp thoại, biểu mẫu, bảng
   ===================================================================== */
window.CV = window.CV || {};

CV.ui = (function () {
  "use strict";
  const U = CV.util;
  const el = U.el;

  /* ---------- thông báo nổi ---------- */
  function toast(message, kind, ms) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const node = el("div", { class: `toast ${kind || ""}` }, [
      el("span", { class: "nav-ico", "data-ico": kind === "err" ? "note" : "note",
        style: "flex:0 0 18px;width:18px;height:18px;margin-top:2px" }),
      el("div", { text: message })
    ]);
    root.appendChild(node);
    // giữ nhiều nhất 3 thông báo để không che mất thanh điều hướng
    while (root.children.length > 3) root.removeChild(root.firstChild);
    setTimeout(() => {
      node.style.transition = "opacity .25s,transform .25s";
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      setTimeout(() => node.remove(), 260);
    }, ms || (kind === "err" ? 5200 : 3200));
  }

  /* ---------- hộp thoại ---------- */
  let openModals = 0;

  function modal(opt) {
    const back = el("div", { class: "modal-back" });
    const box = el("div", { class: `modal ${opt.size === "lg" ? "modal-lg" : ""}`,
      role: "dialog", "aria-modal": "true", "aria-label": opt.title || "Hộp thoại" });

    const head = el("div", { class: "modal-head" }, [
      el("h2", { text: opt.title || "" }),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Đóng",
        onclick: () => close(), html: "&times;", style: "font-size:1.4rem;line-height:1" })
    ]);
    const body = el("div", { class: "modal-body" });
    (Array.isArray(opt.body) ? opt.body : [opt.body]).forEach((n) => {
      if (n) body.appendChild(typeof n === "string" ? el("p", { text: n }) : n);
    });
    box.appendChild(head);
    box.appendChild(body);

    if (opt.actions && opt.actions.length) {
      const foot = el("div", { class: "modal-foot" });
      opt.actions.forEach((a) => {
        foot.appendChild(el("button", {
          class: `btn ${a.class || "btn-ghost"}`, type: "button", text: a.label,
          onclick: () => a.onClick && a.onClick(close)
        }));
      });
      box.appendChild(foot);
    }

    back.appendChild(box);
    const prevFocus = document.activeElement;

    function onKey(ev) {
      if (ev.key === "Escape") { ev.stopPropagation(); close(); return; }
      if (ev.key !== "Tab") return;
      // giữ tiêu điểm bàn phím quanh quẩn trong hộp thoại
      const f = U.$$("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])", box)
        .filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }

    function close() {
      back.remove();
      document.removeEventListener("keydown", onKey, true);
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.style.overflow = "";
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opt.onClose) opt.onClose();
    }

    back.addEventListener("pointerdown", (ev) => { if (ev.target === back && opt.dismissable !== false) close(); });
    document.addEventListener("keydown", onKey, true);
    document.getElementById("modal-root").appendChild(back);
    openModals++;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const target = U.$("input,select,textarea,button.btn-primary", box) || box.querySelector("button");
      if (target && target.focus) target.focus();
    }, 40);
    return { close, body, box };
  }

  function confirm(opt) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title: opt.title || "Xác nhận",
        body: [el("p", { text: opt.message || "" }),
               opt.detail ? el("p", { class: "hint", text: opt.detail, style: "color:var(--muted);font-size:.85rem" }) : null],
        actions: [
          { label: opt.cancelText || "Huỷ", class: "btn-ghost", onClick: (close) => { done = true; close(); resolve(false); } },
          { label: opt.okText || "Đồng ý", class: opt.danger ? "btn-danger" : "btn-primary",
            onClick: (close) => { done = true; close(); resolve(true); } }
        ],
        onClose: () => { if (!done) resolve(false); }
      });
      return m;
    });
  }

  /* ---------- thẻ 3D ---------- */
  const reduceMotion = () =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * Gắn hiệu ứng nghiêng theo con trỏ.
   * Chỉ chạy với chuột/bút trên màn hình rộng; trên điện thoại và khi người
   * dùng bật chế độ giảm chuyển động thì bỏ qua để không gây chóng mặt.
   */
  function tilt(wrap, strength) {
    if (reduceMotion()) return;
    const inner = wrap.querySelector(".card3d-in");
    if (!inner) return;
    const max = strength || 7;
    let frame = null;

    function move(ev) {
      if (ev.pointerType === "touch") return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = wrap.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width;
        const py = (ev.clientY - r.top) / r.height;
        inner.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
        inner.style.setProperty("--rx", `${(0.5 - py) * 2 * max}deg`);
        inner.style.setProperty("--mx", `${px * 100}%`);
        inner.style.setProperty("--my", `${py * 100}%`);
        wrap.classList.add("tilting");
      });
    }
    function leave() {
      if (frame) cancelAnimationFrame(frame);
      wrap.classList.remove("tilting");
      inner.style.setProperty("--rx", "0deg");
      inner.style.setProperty("--ry", "0deg");
    }
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerleave", leave);
    wrap.addEventListener("pointercancel", leave);
  }

  /** Bọc nội dung vào một thẻ 3D. */
  function card3d(children, opt) {
    const inner = el("div", { class: "card3d-in" }, children);
    const wrap = el("div", { class: `card3d ${(opt && opt.class) || ""}` }, inner);
    tilt(wrap, opt && opt.strength);
    return wrap;
  }

  /** Thẻ số liệu nổi khối. */
  function stat(o) {
    const body = [
      el("div", { class: "stat-top lift-1" }, [
        el("span", { class: "stat-label", text: o.label }),
        el("span", { class: "stat-chip" }, el("span", { class: "nav-ico", "data-ico": o.icon || "users" }))
      ]),
      el("div", { class: "stat-value lift-2", text: o.value }),
      o.note ? el("p", { class: "stat-note lift-1", text: o.note }) : null
    ];
    const inner = el("div", { class: `card3d-in stat ${o.tone ? "is-" + o.tone : ""}` }, body);
    const wrap = el("div", { class: "card3d" }, inner);
    tilt(wrap);
    if (o.onClick) {
      inner.style.cursor = "pointer";
      inner.setAttribute("tabindex", "0");
      inner.setAttribute("role", "button");
      inner.addEventListener("click", o.onClick);
      inner.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); o.onClick(); }
      });
    }
    return wrap;
  }

  function card(title, children, opt) {
    const head = title
      ? el("div", { class: "card-head" }, [
          el("div", {}, [
            el("h2", { text: title }),
            opt && opt.sub ? el("p", { class: "card-sub", text: opt.sub }) : null
          ]),
          opt && opt.actions ? el("div", { class: "row" }, opt.actions) : null
        ])
      : null;
    return el("section", { class: `card ${(opt && opt.class) || ""}` },
      [head].concat(Array.isArray(children) ? children : [children]).filter(Boolean));
  }

  function empty(title, message, action) {
    return el("div", { class: "empty" }, [
      el("strong", { text: title }),
      el("p", { text: message || "" }),
      action || null
    ]);
  }

  function note(text, kind) {
    return el("div", { class: `note note-${kind || "info"}` }, [
      el("div", {}, typeof text === "string" ? el("span", { html: text }) : text)
    ]);
  }

  /* ---------- bảng ---------- */
  /**
   * @param {{key:string,label:string,num?:boolean,render?:Function,width?:string}[]} columns
   */
  function table(columns, rows, opt) {
    const o = opt || {};
    if (!rows.length) return empty(o.emptyTitle || "Chưa có dữ liệu", o.emptyText || "", o.emptyAction);
    const wrap = el("div", { class: "table-wrap" });
    const t = el("table");
    t.appendChild(el("thead", {}, el("tr", {}, columns.map((c) =>
      el("th", { class: c.num ? "num" : "", style: c.width ? `width:${c.width}` : null, text: c.label })))));
    const tb = el("tbody");
    rows.forEach((row) => {
      const tr = el("tr", { class: o.onRow ? "clickable" : "" });
      columns.forEach((c) => {
        const td = el("td", { class: c.num ? "num" : "" });
        const v = c.render ? c.render(row) : row[c.key];
        if (v === null || v === undefined) td.textContent = "—";
        else if (typeof v === "object" && v.nodeType) td.appendChild(v);
        else td.textContent = String(v);
        tr.appendChild(td);
      });
      if (o.onRow) {
        tr.setAttribute("tabindex", "0");
        tr.addEventListener("click", (ev) => {
          if (ev.target.closest("button,a,input,select")) return;
          o.onRow(row);
        });
        tr.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); o.onRow(row); }
        });
      }
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function badge(level, label) {
    const map = { none: "badge-info", ok: "badge-ok", watch: "badge-watch", warn: "badge-warn", critical: "badge-critical" };
    return el("span", { class: `badge ${map[level] || "badge-info"}`, text: label });
  }

  /* ---------- biểu mẫu ---------- */
  /**
   * Dựng một biểu mẫu từ mô tả trường.
   * field: {name,label,type,required,hint,options,value,placeholder,min,max,step,validate,full}
   */
  function form(fields, values) {
    const v = values || {};
    const wrap = el("form", { class: "form-grid", novalidate: true });
    const inputs = {};

    fields.forEach((f) => {
      if (f.type === "separator") {
        wrap.appendChild(el("h3", { text: f.label, style: "grid-column:1/-1;margin:.6rem 0 .2rem;font-size:.9rem;color:var(--muted)" }));
        return;
      }
      const id = `f_${f.name}_${Math.random().toString(36).slice(2, 7)}`;
      const box = el("div", { class: "field", style: f.full ? "grid-column:1/-1" : null });
      box.appendChild(el("label", { for: id, text: f.label + (f.required ? " *" : "") }));

      let input;
      if (f.type === "select") {
        input = el("select", { id, name: f.name });
        (f.options || []).forEach((o) =>
          input.appendChild(el("option", { value: o.value, text: o.label,
            selected: String(v[f.name] ?? f.value ?? "") === String(o.value) })));
      } else if (f.type === "textarea") {
        input = el("textarea", { id, name: f.name, rows: f.rows || 3, placeholder: f.placeholder || "" });
        input.value = v[f.name] ?? f.value ?? "";
      } else {
        input = el("input", {
          id, name: f.name, type: f.type || "text", placeholder: f.placeholder || "",
          min: f.min, max: f.max, step: f.step, autocomplete: f.autocomplete || "off",
          inputmode: f.inputmode
        });
        input.value = v[f.name] ?? f.value ?? "";
      }
      const err = el("span", { class: "err", hidden: true });
      box.appendChild(input);
      if (f.hint) box.appendChild(el("span", { class: "hint", text: f.hint }));
      box.appendChild(err);
      wrap.appendChild(box);
      inputs[f.name] = { input, err, spec: f };
    });

    /** Chạy kiểm tra, tô đỏ ô sai, trả về dữ liệu nếu hợp lệ. */
    function validate() {
      let firstBad = null;
      const out = {};
      for (const name in inputs) {
        const { input, err, spec } = inputs[name];
        const raw = typeof input.value === "string" ? input.value.trim() : input.value;
        let msg = null;
        if (spec.required && !raw) msg = "Không được để trống.";
        else if (raw && spec.validate) msg = spec.validate(raw, out);
        if (msg) {
          err.textContent = msg; err.hidden = false;
          input.setAttribute("aria-invalid", "true");
          if (!firstBad) firstBad = input;
        } else {
          err.hidden = true; input.removeAttribute("aria-invalid");
        }
        out[name] = raw;
      }
      if (firstBad) { firstBad.focus(); return null; }
      return out;
    }

    return { node: wrap, inputs, validate };
  }

  /** Hộp thoại chứa biểu mẫu; trả về Promise với dữ liệu hoặc null. */
  function formModal(opt) {
    return new Promise((resolve) => {
      const f = form(opt.fields, opt.values);
      let done = false;
      const m = modal({
        title: opt.title,
        size: opt.size,
        body: [opt.intro ? note(opt.intro, opt.introKind || "info") : null, f.node],
        actions: [
          { label: "Huỷ", class: "btn-ghost", onClick: (close) => { done = true; close(); resolve(null); } },
          {
            label: opt.okText || "Lưu", class: "btn-primary",
            onClick: (close) => {
              const data = f.validate();
              if (!data) return;
              if (opt.check) {
                const msg = opt.check(data);
                if (msg) { toast(msg, "err"); return; }
              }
              done = true; close(); resolve(data);
            }
          }
        ],
        onClose: () => { if (!done) resolve(null); }
      });
      f.node.addEventListener("submit", (ev) => ev.preventDefault());
      f.node.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && ev.target.tagName !== "TEXTAREA") {
          ev.preventDefault();
          U.$(".modal-foot .btn-primary", m.box).click();
        }
      });
    });
  }

  /* ---------- nhóm nút chọn ---------- */
  function segmented(options, current, onPick) {
    const box = el("div", { class: "seg", role: "group" });
    options.forEach((o) => {
      const b = el("button", { type: "button", text: o.label, "aria-pressed": String(o.value === current) });
      b.addEventListener("click", () => {
        U.$$("button", box).forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        onPick(o.value);
      });
      box.appendChild(b);
    });
    return box;
  }

  /* ---------- giao diện sáng/tối ---------- */
  function applyTheme(mode) {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = mode === "dark" ||
        (mode === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#0b1017" : "#123a6b");
    }
  }
  function cycleTheme() {
    const order = ["auto", "light", "dark"];
    const s = CV.store.settings();
    const next = order[(order.indexOf(s.theme || "auto") + 1) % order.length];
    s.theme = next;
    CV.store.save("theme");
    applyTheme(next);
    toast(`Giao diện: ${next === "auto" ? "theo hệ thống" : next === "light" ? "sáng" : "tối"}`);
  }

  /** Chọn tệp từ máy, trả về nội dung dạng chữ. */
  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = el("input", { type: "file", accept: accept || ".csv,.txt", style: "display:none" });
      document.body.appendChild(input);
      input.addEventListener("change", async () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) { resolve(null); return; }
        try { resolve({ name: file.name, text: await CV.io.readFile(file) }); }
        catch (e) { toast(e.message, "err"); resolve(null); }
      });
      input.click();
    });
  }

  /** Báo cáo kết quả nhập tệp: số dòng thêm/cập nhật và danh sách lỗi. */
  function importReport(title, res) {
    const items = [
      el("p", { text: `Thêm mới: ${res.added} · Cập nhật: ${res.updated} · Tổng dòng đọc được: ${res.total}` })
    ];
    (res.notes || []).forEach((n) => items.push(note(n, "info")));
    if (res.errors && res.errors.length) {
      items.push(note(`<strong>${res.errors.length} dòng có vấn đề</strong> — những dòng còn lại đã được nhập bình thường.`, "warn"));
      const list = el("ul", { style: "margin:0;padding-left:1.1rem;font-size:.85rem;max-height:260px;overflow:auto" });
      res.errors.forEach((e) => list.appendChild(el("li", { text: e })));
      items.push(list);
    } else {
      items.push(note("Không có dòng nào lỗi.", "info"));
    }
    modal({ title, body: items, actions: [{ label: "Đóng", class: "btn-primary", onClick: (c) => c() }] });
  }

  return {
    toast, modal, confirm, tilt, card3d, stat, card, empty, note, table, badge,
    form, formModal, segmented, applyTheme, cycleTheme, pickFile, importReport
  };
})();
