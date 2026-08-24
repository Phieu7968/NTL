/* =========================================================
   build.js — gộp toàn bộ website thành MỘT file HTML duy nhất
   (dist/index.html) để chia sẻ nhanh, xem offline hoặc đưa lên
   nơi chỉ nhận một file.

   Chạy:  node build.js
   Bản gộp dùng định tuyến bằng hash (#!/shop.html?cat=web-app).
   Website gốc nhiều trang vẫn giữ nguyên, không bị ảnh hưởng.
   ========================================================= */
const fs = require("fs");
const path = require("path");

const R = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");

const PAGES = ["index.html", "shop.html", "product.html", "cart.html", "checkout.html",
               "about.html", "contact.html", "blog.html", "blog-post.html", "chinh-sach.html"];

/* --- tách phần thân và script riêng của từng trang --- */
function extract(file) {
  const src = R(file);

  const title = (src.match(/<title>([\s\S]*?)<\/title>/) || [, file])[1].trim();

  const a = src.indexOf('<div id="site-header"></div>');
  const b = src.indexOf('<div id="site-footer"></div>');
  if (a < 0 || b < 0) throw new Error("Không tìm thấy mốc header/footer trong " + file);
  let body = src.slice(a + '<div id="site-header"></div>'.length, b).trim();

  // script riêng của trang = khối <script> không có src, nằm cuối
  let script = "";
  const blocks = [...src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const m of blocks) {
    const code = m[1];
    if (code.includes("DOMContentLoaded")) script = code;
  }
  // bóc lớp vỏ DOMContentLoaded để gọi lại được nhiều lần
  script = script
    .replace(/^\s*document\.addEventListener\(\s*["']DOMContentLoaded["']\s*,\s*function\s*\(\)\s*\{/, "")
    .replace(/\}\s*\)\s*;?\s*$/, "");

  // điều hướng bằng JS -> chuyển sang hash
  script = script.replace(/location\.href\s*=\s*"([a-z0-9\-]+\.html)/g, 'location.href = "#!/$1');

  return { file, title, body, script };
}

const pages = PAGES.map(extract);
console.log("Đã gộp:", pages.map(p => p.file).join(", "));

/* --- router chạy trong bản gộp --- */
const ROUTER = `
(function () {
  "use strict";
  var PAGES = __PAGES__;
  var view = document.getElementById("view");

  /* dọn listener mà script trang trước đã gắn lên document */
  var owned = [], realAdd = document.addEventListener.bind(document);
  function runPage(code) {
    document.addEventListener = function (t, h, o) { owned.push([t, h, o]); realAdd(t, h, o); };
    try { new Function(code)(); }
    catch (e) { console.error("Lỗi script trang:", e); }
    finally { document.addEventListener = realAdd; }
  }
  function dropOwned() {
    owned.forEach(function (l) { document.removeEventListener(l[0], l[1], l[2]); });
    owned = [];
  }

  function parse() {
    var h = location.hash || "";
    if (h.indexOf("#!/") !== 0) return { file: "index.html", query: "", anchor: "" };
    var rest = h.slice(3), anchor = "", q = "";
    var t = rest.indexOf("~"); if (t > -1) { anchor = rest.slice(t + 1); rest = rest.slice(0, t); }
    var qi = rest.indexOf("?"); if (qi > -1) { q = rest.slice(qi + 1); rest = rest.slice(0, qi); }
    return { file: PAGES[rest] ? rest : "index.html", query: q, anchor: anchor };
  }

  var current = "";
  function render() {
    var r = parse(), p = PAGES[r.file];
    window.__ROUTE_QUERY__ = r.query;
    dropOwned();
    view.innerHTML = p.body;
    document.title = p.title;
    if (window.TV && window.TV.layout) window.TV.layout();
    runPage(p.script);
    if (window.TV && window.TV.reveal) window.TV.reveal();

    // đánh dấu mục menu đang mở
    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (a) {
      var h = a.getAttribute("href") || "";
      a.classList.toggle("on", h === r.file || h === "#!/" + r.file);
    });

    if (r.anchor) {
      var el = document.getElementById(r.anchor);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    if (current !== location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    current = location.hash;
  }

  /* mọi link .html đều đi qua router */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;
    var href = a.getAttribute("href") || "";
    if (/^(https?:|mailto:|tel:|data:)/.test(href)) return;

    if (href.charAt(0) === "#" && href.charAt(1) !== "!") {   // neo trong trang
      var el = document.getElementById(href.slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }
      return;
    }
    var m = href.match(/^([a-z0-9\\-]+\\.html)(\\?[^#]*)?(#(.+))?$/i);
    if (!m || !PAGES[m[1]]) return;
    e.preventDefault();
    location.hash = "#!/" + m[1] + (m[2] || "") + (m[4] ? "~" + m[4] : "");
  }, true);

  window.addEventListener("hashchange", render);

  document.addEventListener("DOMContentLoaded", function () {
    /* đọc tham số từ hash thay vì location.search */
    window.TV.qs = function (k) {
      return new URLSearchParams(window.__ROUTE_QUERY__ || "").get(k);
    };
    render();
  });
})();
`;

const pageMap = {};
pages.forEach(p => { pageMap[p.file] = { title: p.title, body: p.body, script: p.script }; });

/* phần dùng chung cho cả hai bản xuất */
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
  '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

const SHELL = `<div id="site-header"></div>
<div id="view"></div>
<div id="site-footer"></div>`;

const SCRIPTS = `<script>document.documentElement.classList.add("js");</script>
<style>
${R("assets/css/style.css")}
</style>
${SHELL}
<script>
${R("data/products.js")}
</script>
<script>
${R("assets/js/qr.js")}
</script>
<script>
${R("assets/js/app.js")}
</script>
<script>
${ROUTER.replace("__PAGES__", JSON.stringify(pageMap))}
</script>`;

/* 1) bản đứng riêng — mở bằng trình duyệt, gửi qua Zalo/email, chạy offline */
const standalone = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>teamhoc.shop — Template Google Sheets &amp; Web App cho người học và người làm</title>
<meta name="description" content="teamhoc.shop — bộ công cụ Google Sheets và Web App quản lý công việc, tài chính, bán hàng, nhân sự và học tập.">
<meta name="theme-color" content="#7c3aed">
${FONTS}
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>">
</head>
<body>
${SCRIPTS}
</body>
</html>
`;

/* 2) bản cho Artifact — không có doctype/html/head/body, hệ thống tự bọc */
const artifact = `<title>teamhoc.shop</title>
${FONTS}
${SCRIPTS}
`;

fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/index.html"), standalone);
fs.writeFileSync(path.join(__dirname, "dist/artifact.html"), artifact);
console.log("→ dist/index.html   ", (standalone.length / 1024).toFixed(0) + " KB (bản đứng riêng)");
console.log("→ dist/artifact.html", (artifact.length / 1024).toFixed(0) + " KB (bản cho Artifact)");
