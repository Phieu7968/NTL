# teamhoc.shop — Website bán template Google Sheets & Web App

Website thương mại điện tử cho sản phẩm số: template Google Sheets / Excel và Web App Apps Script,
phục vụ quản lý công việc, tài chính, bán hàng, nhân sự và học tập.

Toàn bộ site là **HTML/CSS/JavaScript thuần** — không cần build, không cần backend, không phụ thuộc
thư viện ngoài. Mở `index.html` bằng trình duyệt là chạy.

## Chạy thử

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Deploy thẳng lên GitHub Pages, Netlify, Vercel hoặc bất kỳ hosting tĩnh nào.

## Cấu trúc

```
index.html           Trang chủ: hero, danh mục, bán chạy, Web App, quy trình, cảm nhận, blog, CTA
shop.html            Danh sách sản phẩm: lọc danh mục / giá / sao, tìm kiếm, sắp xếp, phân trang
product.html?id=     Chi tiết: ảnh, giá, tính năng, tab mô tả/hướng dẫn/đánh giá, sản phẩm liên quan
cart.html            Giỏ hàng: đổi số lượng, xoá, mã giảm giá
checkout.html        Thanh toán: form validate, mã QR VietQR kèm số tiền, sinh mã đơn hàng
about.html           Giới thiệu + FAQ
contact.html         Liên hệ / đặt làm riêng
blog.html            Danh sách bài viết
blog-post.html?slug= Nội dung bài viết
chinh-sach.html      Điều khoản, đổi trả – hoàn tiền, bản quyền, bảo mật, khiếu nại
robots.txt           Chặn index trang giỏ hàng / thanh toán
sitemap.xml          34 URL cho công cụ tìm kiếm
build.js             Gộp cả site thành một file HTML (node build.js -> dist/)
apps-script/         Script Google nhận đơn vào Sheet + gửi mail (kèm HUONG-DAN.md)

data/products.js     ⭐ TOÀN BỘ NỘI DUNG: thương hiệu, thanh toán, 24 sản phẩm, blog, FAQ
assets/css/style.css Stylesheet (biến màu ở :root đầu file)
assets/js/app.js     Header/footer dùng chung, giỏ hàng, ảnh bìa tự sinh, dựng payload VietQR
assets/js/qr.js      Bộ mã hoá QR (chế độ byte, mức sửa lỗi M, phiên bản 1–15)
assets/img/          Ảnh Open Graph 1200x630 + file nguồn để chỉnh lại
```

## ⚠ Việc còn lại trước khi chạy quảng cáo

### Sản phẩm chưa có thật

24 sản phẩm trong `data/products.js` là **nội dung mẫu** để lấp đầy bố cục — tên, mô tả, tính năng
và giá đều do người dựng web nghĩ ra, chưa có file Google Sheets nào tương ứng. Cần dựng sản phẩm
thật rồi sửa lại `data/products.js` cho khớp và xoá những mục chưa có.

### Đã xong

- ✔ **Mã QR thanh toán** — đã quét thử và xác nhận đúng người nhận.
- ✔ **Số điện thoại / Zalo** — 0372 837 968.
- ✔ **Đánh giá ảo** — `showSocialProof: false`, đã ẩn sao, lượt bán, cảm nhận khách,
  bộ lọc theo sao và tuỳ chọn sắp xếp theo đánh giá.
- ✔ **Trang chính sách** — `chinh-sach.html` với 6 mục, link từ chân trang và ô đồng ý khi thanh toán.
- ✔ **Open Graph** — đủ thẻ trên 10 trang, ảnh 1200×630, `canonical`, JSON-LD, `robots.txt`, `sitemap.xml`.
- ✔ **Nhận đơn hàng** — code đã sẵn sàng, chỉ còn cài đặt phía Google (xem mục dưới).

## Nhận đơn hàng vào Google Sheet

Đơn hàng và yêu cầu tư vấn được gửi lên một **Google Apps Script Web App**, ghi vào Google Sheet
và bắn email báo cho chủ shop, đồng thời gửi email xác nhận cho khách. Không cần server, không tốn phí.

**Cài đặt (khoảng 10 phút):** làm theo [`apps-script/HUONG-DAN.md`](apps-script/HUONG-DAN.md),
rồi điền hai dòng vào `SITE.brand` trong `data/products.js`:

```js
orderEndpoint: "https://script.google.com/macros/s/AKfycb...../exec",
orderToken: "chuoi-bi-mat-cua-ban",   // trùng TOKEN trong apps-script/Code.gs
```

**Khi chưa cấu hình** (`orderEndpoint` để trống) website vẫn chạy bình thường, nhưng trang cảm ơn
sẽ báo rõ đơn chưa tới tay chủ shop và hiện nút nhắn Zalo / gửi email để khách gửi tay.

**Không có đơn nào biến mất trong im lặng.** Mọi đơn đều được lưu một bản trong `localStorage` của
khách (khoá `teamhoc_orders`, giữ 20 đơn gần nhất) trước khi gửi đi, kèm cờ `daGui`.

Lưu ý: `orderToken` nằm trong mã nguồn trang web nên ai cũng đọc được — nó chặn bot quét bừa, không
phải bảo mật thật. Với quy mô shop nhỏ thì đủ; muốn chắc hơn cần backend thật.

## Đưa web lên mạng

### GitHub Pages (miễn phí)

Repo đã có sẵn workflow `.github/workflows/deploy-pages.yml`. Bật một lần:

1. Vào **Settings → Pages** của repo
2. Mục **Source** chọn **GitHub Actions**
3. Mỗi lần push, web tự deploy lên `https://<tài-khoản>.github.io/NTL/`

### Trỏ tên miền teamhoc.shop

1. Ở nhà cung cấp tên miền, tạo 4 bản ghi `A` cho `@` trỏ tới `185.199.108.153`,
   `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
2. Tạo bản ghi `CNAME` cho `www` trỏ tới `<tài-khoản>.github.io`
3. Vào **Settings → Pages → Custom domain**, nhập `teamhoc.shop`, bật **Enforce HTTPS**

Kiểm tra lại các địa chỉ IP trên với tài liệu GitHub Pages hiện hành trước khi cấu hình.

### Bản gộp một file

```bash
node build.js
```

Sinh ra hai file trong `dist/` (không commit vào repo):

- `dist/index.html` — cả website trong một file, mở bằng trình duyệt là chạy, gửi qua Zalo/email
  hoặc dùng offline được. Điều hướng bằng hash: `#!/shop.html?cat=web-app`.
- `dist/artifact.html` — cùng nội dung nhưng bỏ thẻ bao ngoài, dùng để đăng lên Artifact.

Sau khi sửa nội dung, nhớ chạy lại `node build.js` để bản gộp cập nhật theo.

## Tuỳ chỉnh

**Thông tin shop & thanh toán** — sửa `SITE.brand` trong `data/products.js`:

```js
brand: {
  name: "TeamHọc", domain: "teamhoc.shop",
  owner: "TRUONG HOANG PHIEU",
  address: "Phường Tân Hạnh, tỉnh Vĩnh Long",
  pay: { provider: "Viettel Money", acc: "9704229200178016449", owner: "TRUONG HOANG PHIEU" }
}
```

**Thêm / sửa sản phẩm** — thêm object vào `SITE.products`:

| Trường | Ý nghĩa |
|---|---|
| `id` | mã duy nhất, dùng trong URL `product.html?id=...` |
| `cat` | slug danh mục (khớp `SITE.categories`) |
| `emoji` | biểu tượng trên ảnh bìa tự sinh |
| `price` / `old` | giá bán / giá gạch ngang (VNĐ) |
| `badge` | `"HOT"`, `"MỚI"`, `"BÁN CHẠY"` hoặc bỏ trống |
| `features[]` / `includes[]` | tính năng và những gì khách nhận được |

**Đổi màu thương hiệu** — sửa `--brand`, `--accent` ở đầu `assets/css/style.css`.
Hiện dùng tím `#7c3aed` làm màu chính và hồng `#db2777` làm màu nhấn.

**Đổi mã giảm giá** — sửa hằng `COUPONS` trong `assets/js/app.js`
(hiện có `GIAM10`, `GIAM20`, `TEAMHOC`).

## Ghi chú kỹ thuật

- **Ảnh sản phẩm sinh bằng SVG** (hàm `cover()` trong `app.js`) — gradient theo hash mã sản phẩm,
  không cần file ảnh. Muốn dùng ảnh thật: thêm trường `img` cho sản phẩm rồi sửa `card()` để ưu tiên `p.img`.
- **Mã QR sinh hoàn toàn phía trình duyệt** bằng `assets/js/qr.js`, không gọi API bên ngoài nên
  số tài khoản không rời khỏi máy người dùng. Mã trên trang đặt hàng thành công đã gắn sẵn số tiền
  và mã đơn, khách quét là điền sẵn.
- **Giỏ hàng lưu ở `localStorage`** (khoá `teamhoc_cart_v1`), không có server.
- **Chưa nối cổng thanh toán tự động** — khách chuyển khoản rồi chủ shop đối soát thủ công.
  Muốn tự động cần backend nối VNPay/Momo hoặc dịch vụ đối soát biến động số dư.
- Font Google (Be Vietnam Pro) tải qua CDN, có font hệ thống dự phòng khi không có mạng.
- Responsive từ 360px; header có menu hamburger dưới 960px. Tôn trọng `prefers-reduced-motion`.

## Đã kiểm thử

- **Bộ mã hoá QR**: đối chiếu từng module với thư viện tham chiếu `python-qrcode` — khớp **88/88**
  trường hợp (11 payload × 8 mask, phiên bản 1–13).
- **Giải mã ngược**: mã QR VietQR sinh ra được OpenCV đọc lại đúng nguyên chuỗi 131 ký tự.
- **Payload VietQR**: cấu trúc TLV hợp lệ, CRC-16/CCITT-FALSE khớp.
- **Luồng nhận đơn**: thử với endpoint giả ở cả bốn tình huống — chưa cấu hình, chạy tốt, bị từ
  chối token, endpoint chết. Mỗi tình huống hiện đúng thông báo, đơn luôn được lưu local, và bấm
  dồn nút đặt hàng chỉ sinh ra một mã đơn.
- **Bản gộp một file**: điều hướng, giỏ hàng, mã giảm giá, thanh toán, QR và neo trong trang đều
  chạy đúng; listener không bị nhân đôi khi quay lại cùng một trang; F5 giữa chừng giữ nguyên vị trí.
- **Toàn bộ 10 trang**: không có lỗi JavaScript; luồng thêm giỏ → mã giảm giá → thanh toán → sinh mã
  đơn kèm QR chạy đúng; bộ lọc/tìm kiếm/sắp xếp/phân trang hoạt động; không tràn ngang ở khổ 390px; không có link chết.

---

© teamhoc.shop — Nội dung và sản phẩm do TRUONG HOANG PHIEU biên soạn.
