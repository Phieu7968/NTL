/* =====================================================================
   sw.js — service worker
   Toàn bộ tài nguyên của ứng dụng đều nằm cùng tên miền (không có CDN),
   nên lưu đệm được hết. Mất mạng vẫn mở và dùng bình thường.
   Mỗi lần sửa mã nguồn, đổi số VERSION để trình duyệt nạp bản mới.
   ===================================================================== */
const VERSION = "cvht-mtu-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/css/app.css",
  "./assets/js/util.js",
  "./assets/js/cloud-config.js",
  "./assets/js/store.js",
  "./assets/js/cloud.js",
  "./assets/js/academic.js",
  "./assets/js/charts.js",
  "./assets/js/xlsx.js",
  "./assets/js/io.js",
  "./assets/js/docvn.js",
  "./assets/js/ui.js",
  "./assets/js/pack.js",
  "./assets/js/sync.js",
  "./assets/js/nhat-ky.js",
  "./assets/js/mau-vb.js",
  "./assets/js/view-auth.js",
  "./assets/js/view-cloud.js",
  "./assets/js/nap-du-lieu.js",
  "./assets/js/view-quantri.js",
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

/* Thư viện Firebase: chỉ cần khi bật đồng bộ nhiều thiết bị. Chưa tải về đặt
   vào assets/vendor/ thì ứng dụng vẫn chạy bình thường trên một máy, nên
   những tệp này nạp trước theo kiểu "có thì tốt", thiếu cũng không sao.
   Xem assets/vendor/README.md. */
const ASSETS_TUY_CHON = [
  "./assets/vendor/firebase-app-compat.js",
  "./assets/vendor/firebase-auth-compat.js",
  "./assets/vendor/firebase-firestore-compat.js"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(VERSION).then(async (c) => {
      // Phần bắt buộc: thiếu một tệp là hỏng cả ứng dụng, nên để addAll báo lỗi.
      await c.addAll(ASSETS);
      // Phần tuỳ chọn: nạp từng tệp một, tệp nào không có thì bỏ qua.
      // Nếu gộp chung vào addAll thì một tệp thiếu làm hỏng toàn bộ bộ nhớ đệm
      // và service worker không cài được — mất luôn khả năng chạy khi mất mạng.
      await Promise.all(ASSETS_TUY_CHON.map((u) =>
        c.add(u).catch(() => { /* chưa tải thư viện về, bỏ qua */ })
      ));
      await self.skipWaiting();
    })
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
