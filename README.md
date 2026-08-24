# TempViet — Website bán template Google Sheets & Web App

Website thương mại điện tử cho sản phẩm số (template Google Sheets / Excel và Web App Apps Script),
dựng theo mô hình của các shop template Việt Nam như taitemp.shop.

Toàn bộ site là **HTML/CSS/JavaScript thuần** — không cần build, không cần backend, không phụ thuộc
thư viện ngoài. Mở `index.html` bằng trình duyệt là chạy.

## Chạy thử

```bash
# cách nhanh nhất
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

Có thể deploy thẳng lên GitHub Pages, Netlify, Vercel hoặc bất kỳ hosting tĩnh nào.

## Cấu trúc

```
index.html          Trang chủ: hero, danh mục, bán chạy, Web App, quy trình, đánh giá, blog, CTA
shop.html           Danh sách sản phẩm: lọc danh mục / giá / sao, tìm kiếm, sắp xếp, phân trang
product.html?id=    Chi tiết sản phẩm: ảnh, giá, tính năng, tab mô tả/hướng dẫn/đánh giá, sản phẩm liên quan
cart.html           Giỏ hàng: đổi số lượng, xoá, mã giảm giá
checkout.html       Thanh toán: form có kiểm tra dữ liệu, chọn phương thức, sinh mã đơn hàng
about.html          Giới thiệu + FAQ
contact.html        Liên hệ / đặt làm riêng (form có validate)
blog.html           Danh sách bài viết
blog-post.html?slug= Nội dung bài viết

data/products.js    ⭐ TOÀN BỘ NỘI DUNG: thương hiệu, danh mục, 24 sản phẩm, bài viết, đánh giá, FAQ
assets/css/style.css Stylesheet (biến màu nằm ở :root đầu file)
assets/js/app.js    Header/footer dùng chung, giỏ hàng, ảnh bìa tự sinh, helper
```

## Tuỳ chỉnh

**Đổi tên shop, hotline, số tài khoản** — sửa `SITE.brand` trong `data/products.js`:

```js
brand: {
  name: "TênShopCủaBạn",
  hotline: "0900 000 000",
  bank: { name: "Vietcombank", acc: "0123456789", owner: "NGUYEN VAN A" }
}
```

**Thêm / sửa sản phẩm** — thêm một object vào mảng `SITE.products`. Các trường:

| Trường | Ý nghĩa |
|---|---|
| `id` | mã duy nhất, dùng trong URL `product.html?id=...` |
| `cat` | slug danh mục (phải khớp `SITE.categories`) |
| `emoji` | biểu tượng hiển thị trên ảnh bìa tự sinh |
| `price` / `old` | giá bán / giá gạch ngang (VNĐ, số nguyên) |
| `badge` | nhãn góc ảnh: `"HOT"`, `"MỚI"`, `"BÁN CHẠY"` hoặc bỏ trống |
| `features[]` / `includes[]` | danh sách tính năng và những gì khách nhận được |

**Đổi màu thương hiệu** — sửa `--brand`, `--accent` ở đầu `assets/css/style.css`.

**Đổi mã giảm giá** — sửa hằng `COUPONS` trong `assets/js/app.js`.

## Ghi chú kỹ thuật

- **Ảnh sản phẩm được sinh bằng SVG trong `assets/js/app.js`** (hàm `cover()`) — gradient theo hash
  của mã sản phẩm, không cần file ảnh nào. Muốn dùng ảnh thật: thêm trường `img` cho sản phẩm rồi
  sửa `card()` để ưu tiên `p.img`.
- **Giỏ hàng lưu ở `localStorage`** (khoá `tempviet_cart_v1`). Không có server, dữ liệu nằm trên
  máy người dùng.
- **Thanh toán là mô phỏng**: form kiểm tra dữ liệu rồi sinh mã đơn và hiển thị thông tin chuyển
  khoản. Không có giao dịch thật, không gửi dữ liệu đi đâu. Muốn chạy thật cần nối cổng thanh toán
  (VNPay/Momo) ở phía server.
- Font Google (Be Vietnam Pro) tải qua CDN, có font hệ thống dự phòng nếu không có mạng.
- Responsive từ 360px trở lên; header có menu hamburger dưới 960px.
- Tôn trọng `prefers-reduced-motion`; hiệu ứng cuộn chỉ bật khi có JavaScript.

## Trạng thái đã kiểm thử

Đã chạy kiểm thử bằng Chromium headless trên toàn bộ 10 trang: không có lỗi JavaScript, luồng
thêm giỏ → áp mã giảm giá → thanh toán → sinh mã đơn hoạt động, bộ lọc/tìm kiếm/sắp xếp/phân trang
hoạt động, không tràn ngang ở khổ 390px.
