/* =====================================================================
   sw.js — service worker
   Toàn bộ tài nguyên của ứng dụng đều nằm cùng tên miền (không có CDN),
   nên lưu đệm được hết. Mất mạng vẫn mở và dùng bình thường.
   Mỗi lần sửa mã nguồn, đổi số VERSION để trình duyệt nạp bản mới.
   ===================================================================== */
const VERSION = "cvht-mtu-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/app.css",
  "./assets/js/util.js",
  "./assets/js/store.js",
  "./assets/js/academic.js",
  "./assets/js/charts.js",
  "./assets/js/xlsx.js",
  "./assets/js/io.js",
  "./assets/js/ui.js",
  "./assets/js/pack.js",
  "./assets/js/sync.js",
  "./assets/js/view-auth.js",
  "./assets/js/view-advisor.js",
  "./assets/js/view-student.js",
  "./assets/js/app.js",
  "./assets/icons/logo-mtu.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Điều hướng trang: ưu tiên mạng để lấy bản mới, mất mạng thì lấy bản đã lưu.
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Tài nguyên tĩnh: lấy bản đã lưu trước cho nhanh, đồng thời làm mới ngầm.
  ev.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
