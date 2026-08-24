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

data/products.js     ⭐ TOÀN BỘ NỘI DUNG: thương hiệu, thanh toán, 24 sản phẩm, blog, FAQ
assets/css/style.css Stylesheet (biến màu ở :root đầu file)
assets/js/app.js     Header/footer dùng chung, giỏ hàng, ảnh bìa tự sinh, dựng payload VietQR
assets/js/qr.js      Bộ mã hoá QR (chế độ byte, mức sửa lỗi M, phiên bản 1–15)
```

## ⚠ Ba việc phải làm trước khi đưa web lên chạy thật

### 1. Kiểm tra mã QR thanh toán

Mã QR trên trang thanh toán được **tự dựng** theo chuẩn VietQR từ khối `SITE.brand.pay` trong
`data/products.js`. Trường `bin: "970422"` lấy từ 6 số đầu của chính số tài khoản, **không phải tra
từ danh sách BIN chính thức của Napas** — chưa được xác minh.

**Hãy tự quét thử mã QR bằng app ngân hàng và kiểm tra tên người nhận hiện ra có đúng không.**

Nếu chưa đúng, dùng một trong hai cách chắc chắn:

```js
pay: {
  qrPayload: "00020101021138...",   // dán payload gốc giải mã từ QR trong app Viettel Money
  qrImage:   "assets/img/qr.png"    // hoặc dùng thẳng ảnh QR xuất từ app
}
```

Khi một trong hai trường có giá trị, website dùng nó và bỏ qua phần tự dựng.

### 2. Thay số điện thoại

`hotline` và `zalo` trong `data/products.js` đang là số giả `0900 000 000`.

### 3. Xử lý phần "bằng chứng xã hội"

Số sao, số lượt đã bán và toàn bộ mục cảm nhận khách hàng hiện là **số liệu mẫu do người dựng web
đặt ra**, không phải dữ liệu thật. Trên một website bán hàng thật, để nguyên là quảng cáo sai sự thật.

Đặt `showSocialProof: false` ở đầu `data/products.js` để ẩn toàn bộ, bật lại khi đã có số liệu thật:

```js
window.SITE = {
  showSocialProof: false,   // ẩn sao, lượt bán và cảm nhận khách hàng
  ...
}
```

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
- **Toàn bộ 9 trang**: không có lỗi JavaScript; luồng thêm giỏ → mã giảm giá → thanh toán → sinh mã
  đơn kèm QR chạy đúng; bộ lọc/tìm kiếm/sắp xếp/phân trang hoạt động; không tràn ngang ở khổ 390px.

---

© teamhoc.shop — Nội dung và sản phẩm do TRUONG HOANG PHIEU biên soạn.
