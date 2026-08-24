/* =========================================================
   teamhoc.shop — core: layout, cart, helpers
   ========================================================= */
(function () {
  "use strict";
  const S = window.SITE;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- helpers ---------- */
  const vnd = (n) => new Intl.NumberFormat("vi-VN").format(n) + "₫";
  const catOf = (slug) => S.categories.find((c) => c.slug === slug) || { name: "Khác", icon: "📄" };
  const byId = (id) => S.products.find((p) => p.id === id);
  const qs = (k) => new URLSearchParams(location.search).get(k);
  const slugify = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0111/g, "d").replace(/\u0110/g, "D")
     .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
  const off = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);

  /* ---------- generated cover art (no external images) ---------- */
  const PALETTE = [
    ["#7c3aed", "#c084fc"], ["#db2777", "#f9a8d4"], ["#2563eb", "#7dd3fc"],
    ["#059669", "#6ee7b7"], ["#ea580c", "#fdba74"], ["#0891b2", "#67e8f9"],
    ["#9333ea", "#e9d5ff"], ["#e11d48", "#fda4af"]
  ];
  function cover(p, w, h) {
    w = w || 640; h = h || 480;
    let seed = 0; for (const ch of p.id + p.name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const [c1, c2] = PALETTE[seed % PALETTE.length];
    const label = catOf(p.cat).name.toUpperCase();
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const S1 = w / 640; // scale factor relative to design size

    // decorative spreadsheet grid
    let grid = "";
    for (let i = 1; i < 9; i++) grid += `<line x1="${(i * w) / 9}" y1="0" x2="${(i * w) / 9}" y2="${h}"/>`;
    for (let j = 1; j < 7; j++) grid += `<line x1="0" y1="${(j * h) / 7}" x2="${w}" y2="${(j * h) / 7}"/>`;

    // decorative bar chart, kept in the top-right corner away from the text
    let bars = "";
    for (let i = 0; i < 5; i++) {
      const bh = (26 + ((seed >> (i * 3)) % 58)) * S1;
      bars += `<rect x="${w - (160 - i * 30) * S1}" y="${h * 0.3 - bh}" width="${19 * S1}" height="${bh}" rx="${4 * S1}" fill="#fff" opacity="${0.3 + i * 0.11}"/>`;
    }

    // wrap the product name onto at most two lines
    const maxChars = 26;
    const lines = [];
    let line = "";
    for (const word of p.name.split(/\s+/)) {
      if (!line) { line = word; }
      else if ((line + " " + word).length <= maxChars) { line += " " + word; }
      else { lines.push(line); line = word; if (lines.length === 2) break; }
    }
    if (lines.length < 2 && line) lines.push(line);
    if (lines.length === 2 && p.name.replace(/\s+/g, " ").length > lines.join(" ").length) {
      lines[1] = lines[1].slice(0, maxChars - 1) + "…";
    }
    const nameY = h * 0.74;
    const nameSvg = lines.map((t, i) =>
      `<text x="${44 * S1}" y="${nameY + i * 30 * S1}" font-family="sans-serif" font-size="${24 * S1}" font-weight="700" fill="#fff">${esc(t)}</text>`
    ).join("");

    const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g stroke="#fff" stroke-width="1" opacity=".13">${grid}</g>
<circle cx="${w - 70 * S1}" cy="${64 * S1}" r="${120 * S1}" fill="#fff" opacity=".08"/>
${bars}
<text x="${42 * S1}" y="${h * 0.42}" font-size="${h * 0.28}">${p.emoji}</text>
<text x="${44 * S1}" y="${h * 0.58}" font-family="sans-serif" font-size="${17 * S1}" font-weight="700" fill="#fff" opacity=".85" letter-spacing="${2 * S1}">${esc(label)}</text>
${nameSvg}
</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  /* ---------- gửi đơn về Google Sheet ---------- */
  const ORDERS_KEY = "teamhoc_orders";

  /* Luôn giữ một bản sao trên máy khách để không mất đơn khi mạng lỗi. */
  function saveLocalOrder(rec) {
    try {
      const all = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      all.unshift(rec);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all.slice(0, 20)));
    } catch (e) {}
  }
  function localOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); } catch (e) { return []; }
  }
  function markOrderSent(maDon) {
    try {
      const all = localOrders();
      const hit = all.find((o) => o.maDon === maDon);
      if (hit) { hit.daGui = true; localStorage.setItem(ORDERS_KEY, JSON.stringify(all)); }
    } catch (e) {}
  }

  /**
   * Gửi đơn / yêu cầu tư vấn lên Apps Script.
   * Trả về "sent" khi chắc chắn tới nơi, "unknown" khi đã bắn đi nhưng
   * không đọc được phản hồi, "off" khi chưa cấu hình, "failed" khi hỏng.
   */
  async function submitOrder(payload) {
    const url = S.brand.orderEndpoint;
    const rec = Object.assign({ luc: new Date().toISOString(), daGui: false }, payload);
    saveLocalOrder(rec);
    if (!url) return "off";

    const body = JSON.stringify(Object.assign({ token: S.brand.orderToken }, payload));
    // text/plain để trình duyệt không phải hỏi preflight — Apps Script không trả lời preflight
    const opts = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body };

    try {
      const res = await fetch(url, opts);
      const data = await res.json().catch(() => null);
      if (data && data.ok) { markOrderSent(payload.maDon); return "sent"; }
      if (data && !data.ok) { console.error("Apps Script từ chối:", data.message); return "failed"; }
      markOrderSent(payload.maDon);
      return "unknown";
    } catch (e1) {
      // CORS chặn đọc phản hồi -> bắn lại kiểu no-cors, dữ liệu vẫn tới nơi
      try {
        await fetch(url, Object.assign({ mode: "no-cors" }, opts));
        markOrderSent(payload.maDon);
        return "unknown";
      } catch (e2) {
        console.error("Không gửi được đơn:", e2);
        return "failed";
      }
    }
  }

  /* Link gửi đơn thủ công khi không kết nối được — để khách không mắc kẹt. */
  function fallbackLinks(tomTat) {
    const zalo = S.brand.zalo.replace(/\s/g, "");
    return {
      zalo: "https://zalo.me/" + zalo,
      email: "mailto:" + S.brand.email +
        "?subject=" + encodeURIComponent("Đơn hàng " + (tomTat.maDon || "")) +
        "&body=" + encodeURIComponent(tomTat.text)
    };
  }

  /* ---------- VietQR (EMVCo) ---------- */
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  const tlv = (id, val) => id + String(val.length).padStart(2, "0") + val;

  /* Dựng chuỗi VietQR. amount/note bỏ trống => mã tĩnh, người trả tự nhập. */
  function payPayload(amount, note) {
    const P = S.brand.pay;
    if (P.qrPayload) return P.qrPayload;           // payload gốc lấy từ app -> ưu tiên tuyệt đối
    const merchant = tlv("00", "A000000727") +
      tlv("01", tlv("00", P.bin) + tlv("01", P.acc)) +
      tlv("02", P.service);
    let body = tlv("00", "01") + tlv("01", amount ? "12" : "11") + tlv("38", merchant) + tlv("53", "704");
    if (amount) body += tlv("54", String(Math.round(amount)));
    body += tlv("58", "VN");
    if (note) body += tlv("62", tlv("08", String(note).slice(0, 25)));
    body += "6304";
    return body + crc16(body);
  }

  /* Trả về src cho <img>: ảnh QR do chủ shop cung cấp, hoặc mã tự dựng. */
  function payQR(amount, note) {
    const P = S.brand.pay;
    if (P.qrImage) return P.qrImage;
    if (!window.QR) return "";
    return window.QR.dataUri(payPayload(amount, note), { fg: "#1d1033", label: "Mã QR chuyển khoản" });
  }

  /* ---------- cart (localStorage) ---------- */
  const KEY = "teamhoc_cart_v1";
  const readCart = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const saveCart = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} paintCount(); };
  const cartCount = () => readCart().reduce((n, i) => n + i.qty, 0);
  const cartTotal = () => readCart().reduce((n, i) => { const p = byId(i.id); return p ? n + p.price * i.qty : n; }, 0);
  function addToCart(id, qty) {
    qty = qty || 1;
    const c = readCart(); const hit = c.find((i) => i.id === id);
    if (hit) hit.qty += qty; else c.push({ id: id, qty: qty });
    saveCart(c);
    const p = byId(id);
    toast("Đã thêm “" + (p ? p.name : "sản phẩm") + "” vào giỏ 🛒");
  }
  function setQty(id, qty) {
    let c = readCart();
    if (qty <= 0) c = c.filter((i) => i.id !== id);
    else { const hit = c.find((i) => i.id === id); if (hit) hit.qty = qty; }
    saveCart(c);
  }
  const clearCart = () => saveCart([]);
  function paintCount() { $$(".cart-count").forEach((e) => { const n = cartCount(); e.textContent = n; e.style.display = n ? "grid" : "none"; }); }

  /* ---------- coupon ---------- */
  const COUPONS = { GIAM10: 0.10, GIAM20: 0.20, TEAMHOC: 0.15 };
  const CKEY = "teamhoc_coupon";
  const getCoupon = () => { try { return localStorage.getItem(CKEY) || ""; } catch (e) { return ""; } };
  const setCoupon = (c) => { try { c ? localStorage.setItem(CKEY, c) : localStorage.removeItem(CKEY); } catch (e) {} };
  const discountRate = () => COUPONS[getCoupon()] || 0;

  /* ---------- toast ---------- */
  let tEl, tTimer;
  function toast(msg) {
    if (!tEl) { tEl = document.createElement("div"); tEl.className = "toast"; document.body.appendChild(tEl); }
    tEl.textContent = msg;
    requestAnimationFrame(() => tEl.classList.add("show"));
    clearTimeout(tTimer);
    tTimer = setTimeout(() => tEl.classList.remove("show"), 2600);
  }

  /* ---------- product card ---------- */
  function card(p) {
    const bcls = p.badge === "MỚI" ? "new" : p.badge === "HOT" ? "hot" : "";
    return `<article class="pc">
      <a class="pc-thumb" href="product.html?id=${p.id}">
        <img src="${cover(p, 480, 360)}" alt="${p.name}" loading="lazy" width="480" height="360">
        ${p.badge ? `<span class="badge ${bcls}">${p.badge}</span>` : ""}
        ${off(p) ? `<span class="save">-${off(p)}%</span>` : ""}
      </a>
      <div class="pc-body">
        <div class="pc-cat">${catOf(p.cat).icon} ${catOf(p.cat).name}</div>
        <a href="product.html?id=${p.id}"><h3 class="pc-name">${p.name}</h3></a>
        ${S.showSocialProof ? `<div class="pc-meta"><span class="stars">${stars(p.rating)}</span> ${p.rating} · đã bán ${p.sold}</div>` : ""}
        <div class="pc-price"><span class="price">${vnd(p.price)}</span>${p.old ? `<span class="old">${vnd(p.old)}</span>` : ""}</div>
        <div class="pc-act">
          <button class="btn btn-primary" data-add="${p.id}">Thêm vào giỏ</button>
          <a class="btn btn-ghost btn-sm" href="product.html?id=${p.id}" aria-label="Xem chi tiết">Chi tiết</a>
        </div>
      </div></article>`;
  }

  /* ---------- header / footer ---------- */
  const NAV = [
    ["index.html", "Trang chủ"], ["shop.html", "Sản phẩm"], ["shop.html?cat=web-app", "Web App"],
    ["blog.html", "Bài viết"], ["about.html", "Giới thiệu"], ["contact.html", "Liên hệ"]
  ];
  function layout() {
    const here = location.pathname.split("/").pop() || "index.html";
    const b = S.brand;
    const hd = $("#site-header");
    if (hd) hd.innerHTML =
`<div class="topbar"><div class="wrap">
  <span class="topbar-left">📩 Giao file qua email · Hỗ trợ cài đặt 1-1 · Cập nhật trọn đời</span>
  <span class="topbar-links"><a href="tel:${b.hotline.replace(/\s/g, "")}">☎ ${b.hotline}</a><a href="mailto:${b.email}">✉ ${b.email}</a></span>
</div></div>
<header class="hd"><div class="wrap hd-in">
  <a class="logo" href="index.html"><span class="logo-mark">🎓</span><span>${b.name}<small>${b.tagline}</small></span></a>
  <nav class="nav" id="nav">${NAV.map(([h, t]) =>
    `<a href="${h}" class="${h === here ? "on" : ""}">${t}</a>`).join("")}</nav>
  <div class="hd-act">
    <a class="icon-btn" href="cart.html" aria-label="Giỏ hàng">🛒<span class="cart-count">0</span></a>
    <a class="btn btn-primary btn-sm" href="shop.html">Mua ngay</a>
    <button class="icon-btn burger" id="burger" aria-label="Menu">☰</button>
  </div>
</div></header>`;

    const ft = $("#site-footer");
    if (ft) ft.innerHTML =
`<footer class="ft"><div class="wrap">
  <div class="ft-grid">
    <div>
      <a class="logo" href="index.html"><span class="logo-mark">🎓</span><span>${b.name}<small>${b.tagline}</small></span></a>
      <p style="margin-top:1rem">${b.slogan}. Công cụ dựng sẵn trên Google Sheets: mở ra là dùng, sửa được theo cách của bạn, không phí hằng tháng.</p>
      <div class="socials"><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="YouTube">▶</a><a href="#" aria-label="TikTok">♪</a><a href="#" aria-label="Zalo">Z</a></div>
    </div>
    <div><h4>Danh mục</h4>${S.categories.map((c) => `<a href="shop.html?cat=${c.slug}">${c.name}</a>`).join("")}</div>
    <div><h4>Hỗ trợ</h4>
      <a href="contact.html">Liên hệ</a><a href="about.html#faq">Câu hỏi thường gặp</a>
      <a href="about.html">Về chúng tôi</a><a href="blog.html">Bài viết hướng dẫn</a>
      <a href="chinh-sach.html#doi-tra">Đổi trả &amp; hoàn tiền</a>
      <a href="chinh-sach.html#bao-mat">Chính sách bảo mật</a>
      <a href="chinh-sach.html#dieu-khoan">Điều khoản sử dụng</a></div>
    <div><h4>Liên hệ</h4>
      <p>📍 ${b.address}<br>☎ ${b.hotline}<br>✉ ${b.email}<br>💬 Zalo: ${b.zalo}</p>
      <p style="font-size:.82rem">Giờ làm việc: 8:00 – 21:00, T2 – CN</p></div>
  </div>
  <div class="ft-bottom">
    <span>© ${new Date().getFullYear()} ${b.domain} — Nội dung và sản phẩm do ${b.owner} biên soạn. Vui lòng không sao chép, bán lại hoặc phân phối lại khi chưa được đồng ý.</span>
    <span><a href="chinh-sach.html">Chính sách &amp; điều khoản</a> · Thanh toán: ${b.pay.provider}</span></div>
</div></footer>`;

    if (!$(".fab")) {
      const fab = document.createElement("div");
      fab.className = "fab";
      fab.innerHTML = `<a class="zalo" href="https://zalo.me/${b.zalo.replace(/\s/g,"")}" target="_blank" rel="noopener" title="Chat Zalo">💬</a>
        <button id="toTop" title="Lên đầu trang">↑</button>`;
      document.body.appendChild(fab);
      $("#toTop").onclick = () => scrollTo({ top: 0, behavior: "smooth" });
    }
    const bg = $("#burger");
    if (bg) bg.onclick = () => $("#nav").classList.toggle("open");
    paintCount();
  }

  /* ---------- global delegated events ---------- */
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); addToCart(add.dataset.add, 1); }
  });

  /* ---------- scroll reveal ---------- */
  function reveal() {
    const els = $$(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); }
    }), { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
    // safety net: never leave content permanently invisible
    setTimeout(() => els.forEach((el) => el.classList.add("in")), 4000);
  }

  /* ---------- expose ---------- */
  window.TV = { $, $$, S, vnd, catOf, byId, qs, slugify, stars, off, cover, card, toast,
    readCart, saveCart, addToCart, setQty, clearCart, cartCount, cartTotal,
    getCoupon, setCoupon, discountRate, COUPONS, reveal,
    payPayload, payQR, layout,
    submitOrder, localOrders, fallbackLinks };

  document.addEventListener("DOMContentLoaded", () => { layout(); reveal(); });
})();
