/* =====================================================================
   charts.js — biểu đồ vẽ bằng SVG thuần
   Không dùng thư viện ngoài, nên biểu đồ vẫn hiện khi máy mất mạng.
   Quy ước màu: thang một sắc xanh cho dữ liệu có thứ tự, bộ màu trạng
   thái cho mức cảnh báo (luôn kèm nhãn chữ, không bao giờ chỉ dựa vào màu).
   ===================================================================== */
window.CV = window.CV || {};

CV.charts = (function () {
  "use strict";
  const U = CV.util;
  const NS = "http://www.w3.org/2000/svg";

  const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];
  const STATUS = {
    none:     { color: "var(--muted)",    label: "Chưa có điểm" },
    ok:       { color: "var(--ok)",       label: "Bình thường" },
    watch:    { color: "var(--warn)",     label: "Cần theo dõi" },
    warn:     { color: "var(--serious)",  label: "Cảnh báo" },
    critical: { color: "var(--critical)", label: "Nguy cơ thôi học" }
  };

  function svgEl(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------- chú giải dạng bong bóng ---------- */
  let tipEl = null;
  function tip(html, ev) {
    if (!tipEl) {
      tipEl = U.el("div", { class: "tip" });
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.style.display = "block";
    const pad = 12;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY - h - pad;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - pad;
    if (y < 8) y = ev.clientY + pad;
    tipEl.style.left = x + "px";
    tipEl.style.top = y + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.display = "none"; }

  function bindTip(node, htmlFn) {
    node.addEventListener("pointerenter", (ev) => { node.classList.add("on"); tip(htmlFn(), ev); });
    node.addEventListener("pointermove", (ev) => tip(htmlFn(), ev));
    node.addEventListener("pointerleave", () => { node.classList.remove("on"); hideTip(); });
    node.addEventListener("focus", (ev) => tip(htmlFn(), { clientX: node.getBoundingClientRect().left, clientY: node.getBoundingClientRect().top }));
    node.addEventListener("blur", hideTip);
  }

  /** Góc bo 4px ở đầu cột, chân cột vuông và dính trục. */
  function topRoundedPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h);
    return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
  }

  /* =====================================================================
     1. Cột — phân bố sinh viên theo mức GPA (nhóm có thứ tự -> thang một sắc)
     ===================================================================== */
  function bars(host, opt) {
    const labels = opt.labels || [];
    const values = opt.values || [];
    const unit = opt.unit || "sinh viên";
    host.innerHTML = "";
    const W = 560, H = 250, ml = 34, mr = 8, mt = 14, mb = 46;
    const iw = W - ml - mr, ih = H - mt - mb;
    const max = Math.max(1, ...values);
    const ticks = niceTicks(max, 4);
    const top = ticks[ticks.length - 1];

    const svg = svgEl("svg", {
      class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": opt.ariaLabel || "Biểu đồ cột"
    });

    ticks.forEach((t) => {
      const y = mt + ih - (t / top) * ih;
      svg.appendChild(svgEl("line", { class: "c-grid", x1: ml, x2: W - mr, y1: y, y2: y }));
      const lb = svgEl("text", { x: ml - 7, y: y + 4, "text-anchor": "end" });
      lb.textContent = String(t);
      svg.appendChild(lb);
    });

    const step = iw / Math.max(1, labels.length);
    const bw = Math.min(58, step * 0.62);
    labels.forEach((lab, i) => {
      const v = values[i] || 0;
      const h = top ? (v / top) * ih : 0;
      const x = ml + step * i + (step - bw) / 2;
      const y = mt + ih - h;
      const color = (opt.colors && opt.colors[i]) || SEQ[Math.min(i, SEQ.length - 1)];
      if (h > 0) {
        const p = svgEl("path", { class: "c-mark", d: topRoundedPath(x, y, bw, h, 4), fill: color, tabindex: "0" });
        bindTip(p, () => `<strong>${U.esc(lab)}</strong><br>${v} ${U.esc(unit)}`);
        svg.appendChild(p);
      }
      if (v > 0) {
        const t = svgEl("text", { class: "c-val", x: x + bw / 2, y: y - 6, "text-anchor": "middle" });
        t.textContent = String(v);
        svg.appendChild(t);
      }
      // nhãn trục X, tự xuống dòng khi dài
      const words = String(lab).split(" ");
      const lines = words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [lab];
      lines.forEach((ln, k) => {
        const t = svgEl("text", { x: ml + step * i + step / 2, y: mt + ih + 18 + k * 13, "text-anchor": "middle" });
        t.textContent = ln;
        svg.appendChild(t);
      });
    });

    svg.appendChild(svgEl("line", { class: "c-axis", x1: ml, x2: W - mr, y1: mt + ih, y2: mt + ih }));
    host.appendChild(svg);
    host.appendChild(tableFallback(labels, values, opt.unitCol || "Số sinh viên"));
    return svg;
  }

  /* =====================================================================
     2. Thanh xếp chồng — cơ cấu mức cảnh báo (bộ phận trên tổng thể)
     ===================================================================== */
  function stack(host, segments, opt) {
    host.innerHTML = "";
    const total = U.sum(segments, (s) => s.value);
    const bar = U.el("div", { class: "bar-stack", role: "img",
      "aria-label": (opt && opt.ariaLabel) || "Cơ cấu mức cảnh báo" });
    if (!total) {
      bar.appendChild(U.el("span", { style: "width:100%;background:var(--line)" }));
    } else {
      segments.forEach((s) => {
        if (!s.value) return;
        const span = U.el("span", {
          style: `width:${(s.value / total) * 100}%;background:${s.color}`,
          tabindex: "0", role: "listitem"
        });
        bindTip(span, () => `<strong>${U.esc(s.label)}</strong><br>${s.value} sinh viên · ${U.num((s.value / total) * 100, 1)}%`);
        bar.appendChild(span);
      });
    }
    host.appendChild(bar);

    const legend = U.el("div", { class: "legend" });
    segments.forEach((s) => {
      legend.appendChild(U.el("span", {}, [
        U.el("i", { style: `background:${s.color}` }),
        U.el("span", { text: `${s.label}: ${s.value}${total ? ` (${U.num((s.value / total) * 100, 0)}%)` : ""}` })
      ]));
    });
    host.appendChild(legend);
  }

  /* =====================================================================
     3. Đường — GPA qua các học kỳ (một chuỗi duy nhất, không cần chú giải)
     ===================================================================== */
  function line(host, points, opt) {
    host.innerHTML = "";
    const W = 560, H = 240, ml = 34, mr = 14, mt = 16, mb = 42;
    const iw = W - ml - mr, ih = H - mt - mb;
    const yMax = (opt && opt.yMax) || 4;
    const yMin = (opt && opt.yMin) || 0;

    const svg = svgEl("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": (opt && opt.ariaLabel) || "Biểu đồ đường" });

    if (!points.length) {
      host.appendChild(U.el("p", { class: "empty", text: "Chưa có dữ liệu để vẽ." }));
      return;
    }
    // Một điểm thì đường biểu diễn không nói lên điều gì: hiện thẳng con số.
    if (points.length === 1) {
      const p0 = points[0];
      host.appendChild(U.el("div", { style: "text-align:center;padding:1.25rem 1rem" }, [
        U.el("div", { style: "font-size:2.4rem;font-weight:750;color:var(--ink);line-height:1.1",
          text: U.num(p0.y) }),
        U.el("p", { style: "margin:.25rem 0 0;color:var(--muted);font-size:.85rem",
          text: `${p0.label}${p0.note ? " · " + p0.note : ""}` }),
        U.el("p", { style: "margin:.5rem 0 0;color:var(--muted);font-size:.8rem",
          text: "Có từ hai học kỳ trở lên sẽ hiện biểu đồ xu hướng." })
      ]));
      return;
    }

    const ticks = [0, 1, 2, 3, 4].filter((t) => t >= yMin && t <= yMax);
    ticks.forEach((t) => {
      const y = mt + ih - ((t - yMin) / (yMax - yMin)) * ih;
      svg.appendChild(svgEl("line", { class: "c-grid", x1: ml, x2: W - mr, y1: y, y2: y }));
      const lb = svgEl("text", { x: ml - 7, y: y + 4, "text-anchor": "end" });
      lb.textContent = U.num(t, 1);
      svg.appendChild(lb);
    });

    const n = points.length;
    const px = (i) => (n === 1 ? ml + iw / 2 : ml + (iw * i) / (n - 1));
    const py = (v) => mt + ih - ((U.clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * ih;

    // vùng mờ dưới đường cho dễ đọc xu hướng
    const area = points.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.y)}`).join(" ")
      + ` L${px(n - 1)},${mt + ih} L${px(0)},${mt + ih} Z`;
    svg.appendChild(svgEl("path", { d: area, fill: "var(--seq-3)", opacity: ".12" }));
    svg.appendChild(svgEl("path", {
      d: points.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.y)}`).join(" "),
      fill: "none", stroke: "var(--seq-3)", "stroke-width": 2,
      "stroke-linejoin": "round", "stroke-linecap": "round"
    }));

    points.forEach((p, i) => {
      const g = svgEl("g", { class: "c-mark", tabindex: "0" });
      g.appendChild(svgEl("circle", { cx: px(i), cy: py(p.y), r: 8, fill: "transparent" }));
      g.appendChild(svgEl("circle", {
        cx: px(i), cy: py(p.y), r: 4.5, fill: "var(--seq-3)",
        stroke: "var(--card)", "stroke-width": 2
      }));
      bindTip(g, () => `<strong>${U.esc(p.label)}</strong><br>GPA ${U.num(p.y)}${p.note ? "<br>" + U.esc(p.note) : ""}`);
      svg.appendChild(g);
      const t = svgEl("text", { x: px(i), y: mt + ih + 18, "text-anchor": "middle" });
      t.textContent = p.short || p.label;
      svg.appendChild(t);
    });

    // ghi số ở điểm đầu và điểm cuối, không ghi tràn lan
    [0, n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach((i) => {
      const t = svgEl("text", { class: "c-val", x: px(i), y: py(points[i].y) - 12, "text-anchor": "middle" });
      t.textContent = U.num(points[i].y);
      svg.appendChild(t);
    });

    svg.appendChild(svgEl("line", { class: "c-axis", x1: ml, x2: W - mr, y1: mt + ih, y2: mt + ih }));
    host.appendChild(svg);
    host.appendChild(tableFallback(points.map((p) => p.label), points.map((p) => U.num(p.y)), "GPA hệ 4"));
  }

  /* ---------- bảng số liệu kèm theo, cho người đọc bằng trình đọc màn hình
       và cho trường hợp không phân biệt được màu ---------- */
  function tableFallback(labels, values, valueHead) {
    const det = U.el("details", { class: "no-print" });
    det.appendChild(U.el("summary", { text: "Xem số liệu dạng bảng", style: "cursor:pointer;font-size:.8rem;color:var(--muted);margin-top:.5rem" }));
    const wrap = U.el("div", { class: "table-wrap", style: "margin-top:.5rem" });
    const tb = U.el("table", { style: "min-width:0" });
    tb.appendChild(U.el("thead", {}, U.el("tr", {}, [
      U.el("th", { text: "Nhóm" }), U.el("th", { class: "num", text: valueHead })
    ])));
    const body = U.el("tbody");
    labels.forEach((l, i) => body.appendChild(U.el("tr", {}, [
      U.el("td", { text: l }), U.el("td", { class: "num", text: String(values[i]) })
    ])));
    tb.appendChild(body);
    wrap.appendChild(tb);
    det.appendChild(wrap);
    return det;
  }

  function niceTicks(max, count) {
    const raw = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    const step = Math.max(1, Math.ceil(raw / mag) * mag);
    const out = [];
    for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v));
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
    return out;
  }

  return { bars, stack, line, STATUS, SEQ, hideTip, niceTicks };
})();
