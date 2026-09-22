/* =====================================================================
   util.js — tiện ích dùng chung: DOM, định dạng, băm mật khẩu
   Không phụ thuộc thư viện ngoài.
   ===================================================================== */
window.CV = window.CV || {};

CV.util = (function () {
  "use strict";

  /* ---------- DOM ---------- */
  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /** Thoát ký tự để nhúng an toàn vào chuỗi HTML. */
  const esc = (s) =>
    String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* ---------- chuỗi và tìm kiếm tiếng Việt ---------- */
  /** Bỏ dấu để tìm kiếm: "Nguyễn Văn Đức" -> "nguyen van duc" */
  function fold(s) {
    return String(s || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .toLowerCase().trim();
  }
  const initials = (name) => {
    const parts = String(name || "").trim().split(/\s+/);
    if (!parts[0]) return "?";
    return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /* ---------- định dạng ---------- */
  const pad2 = (n) => String(n).padStart(2, "0");

  /** ISO (yyyy-mm-dd) -> dd/mm/yyyy */
  function dmy(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function dmyhm(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${dmy(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  /** Số thập phân kiểu Việt Nam: 3.25 -> "3,25" */
  function num(v, digits) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return "—";
    return Number(v).toFixed(digits === undefined ? 2 : digits).replace(".", ",");
  }
  /** Đọc số người dùng nhập, chấp nhận cả dấu phẩy: "7,5" -> 7.5 */
  function parseNum(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
    return s === "" ? NaN : Number(s);
  }
  const plural = (n, word) => `${n} ${word}`;

  /* ---------- định danh ---------- */
  function uid(prefix) {
    const rnd = (typeof crypto !== "undefined" && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("")
      : Math.random().toString(16).slice(2, 14);
    return `${prefix || "id"}_${Date.now().toString(36)}${rnd}`;
  }

  function randomHex(bytes) {
    const n = bytes || 16;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(n)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let out = "";
    for (let i = 0; i < n * 2; i++) out += Math.floor(Math.random() * 16).toString(16);
    return out;
  }

  /** Mã PIN 6 chữ số, dùng bộ sinh ngẫu nhiên của trình duyệt khi có. */
  function randomPin() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return String(a[0] % 1000000).padStart(6, "0");
    }
    return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  }

  /* ---------- SHA-256 viết thuần, không cần crypto.subtle ----------
     Lý do không dùng crypto.subtle: hàm đó chỉ chạy trong ngữ cảnh bảo mật
     (https hoặc localhost). Bản thuần này chạy được cả khi mở tệp trực tiếp
     bằng file:// nên ứng dụng không bao giờ mất khả năng đăng nhập.        */
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  function utf8Bytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function sha256Bytes(bytes) {
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const len = bytes.length;
    const withPad = bytes.slice();
    withPad.push(0x80);
    while (withPad.length % 64 !== 56) withPad.push(0);
    const bits = len * 8;
    // độ dài 64 bit; dữ liệu của ứng dụng này luôn dưới 2^32 bit nên 4 byte cao là 0
    withPad.push(0, 0, 0, 0,
      (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);

    const w = new Uint32Array(64);
    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) {
        w[i] = (withPad[off + i * 4] << 24) | (withPad[off + i * 4 + 1] << 16)
             | (withPad[off + i * 4 + 2] << 8) | withPad[off + i * 4 + 3];
      }
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = [];
    for (const v of H) out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
    return out;
  }

  const toHex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const sha256 = (str) => toHex(sha256Bytes(utf8Bytes(str)));

  /** Băm có muối, lặp nhiều vòng để làm chậm việc dò mật khẩu. */
  const HASH_ROUNDS = 20000;
  function hashSecret(secret, salt, rounds) {
    const n = rounds || HASH_ROUNDS;
    let digest = sha256Bytes(utf8Bytes(`mtu:${salt}:${secret}`));
    for (let i = 1; i < n; i++) digest = sha256Bytes(digest.concat(utf8Bytes(salt)));
    return toHex(digest);
  }
  /** So sánh trong thời gian gần như không đổi. */
  function safeEqual(a, b) {
    const x = String(a || ""), y = String(b || "");
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
  }
  function makeSecret(plain) {
    const salt = randomHex(16);
    return { salt, hash: hashSecret(plain, salt), rounds: HASH_ROUNDS, setAt: new Date().toISOString() };
  }
  function checkSecret(plain, rec) {
    if (!rec || !rec.salt || !rec.hash) return false;
    return safeEqual(hashSecret(plain, rec.salt, rec.rounds), rec.hash);
  }

  /** Đánh giá độ mạnh mật khẩu: trả về {score 0-4, label, tips[]} */
  function passwordStrength(pw) {
    const s = String(pw || "");
    const tips = [];
    let score = 0;
    if (s.length >= 8) score++; else tips.push("ít nhất 8 ký tự");
    if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++; else tips.push("có cả chữ hoa và chữ thường");
    if (/\d/.test(s)) score++; else tips.push("có chữ số");
    if (/[^A-Za-z0-9]/.test(s)) score++; else tips.push("có ký tự đặc biệt");
    if (s.length >= 12) score = Math.min(4, score + 1);
    const labels = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh"];
    return { score, label: labels[score], tips };
  }

  /* ---------- khác ---------- */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms || 220);
    };
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const sum = (arr, pick) => arr.reduce((a, x) => a + (pick ? pick(x) : x), 0);
  function groupBy(arr, keyFn) {
    const map = new Map();
    arr.forEach((x) => {
      const k = keyFn(x);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(x);
    });
    return map;
  }
  function sortBy(arr, pick, dir) {
    const d = dir === "desc" ? -1 : 1;
    return arr.slice().sort((a, b) => {
      const x = pick(a), y = pick(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * d;
      return String(x).localeCompare(String(y), "vi") * d;
    });
  }

  return {
    $, $$, el, esc, fold, initials,
    dmy, dmyhm, todayISO, num, parseNum, pad2, plural,
    uid, randomHex, randomPin,
    sha256, hashSecret, safeEqual, makeSecret, checkSecret, passwordStrength,
    debounce, clamp, sum, groupBy, sortBy
  };
})();
