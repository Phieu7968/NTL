# Nối website với Google Sheet để nhận đơn hàng

Sau khi làm xong, mỗi lần khách đặt hàng trên teamhoc.shop:

- Đơn được ghi thành một dòng trong Google Sheet của bạn
- Bạn nhận email báo có đơn mới, kèm đầy đủ thông tin
- Khách nhận email xác nhận kèm mã đơn

Không tốn phí, không cần server. Làm một lần khoảng 10 phút.

---

## Bước 1 — Tạo Google Sheet

1. Vào [sheets.new](https://sheets.new) để tạo một bảng tính mới
2. Đặt tên, ví dụ **Đơn hàng teamhoc.shop**

Không cần tạo cột gì cả — script tự tạo khi có đơn đầu tiên.

## Bước 2 — Dán mã script

1. Trong bảng tính vừa tạo, vào menu **Tiện ích mở rộng → Apps Script**
   (bản tiếng Anh: *Extensions → Apps Script*)
2. Xoá hết đoạn `function myFunction() {}` có sẵn
3. Mở file `apps-script/Code.gs` trong repo này, copy **toàn bộ**, dán vào
4. Bấm biểu tượng đĩa mềm để lưu

## Bước 3 — Sửa phần cấu hình

Ngay đầu file vừa dán, sửa khối `CAU_HINH`:

```js
var CAU_HINH = {
  EMAIL_NHAN: "",                    // để trống = gửi về email đang đăng nhập
  TOKEN: "doi-chuoi-nay-di",         // ĐỔI thành một chuỗi ngẫu nhiên của bạn
  GUI_MAIL_CHO_KHACH: true,
  TEN_SHOP: "teamhoc.shop",
  HOTLINE: "0372 837 968"
};
```

**Nhớ chuỗi `TOKEN` bạn vừa đặt** — lát nữa phải điền đúng chuỗi đó vào website.

## Bước 4 — Chạy thử một lần để cấp quyền

1. Ở thanh chọn hàm phía trên, chọn **`thuGhiDonMau`**
2. Bấm **Chạy** (*Run*)
3. Google hỏi quyền → **Xem lại quyền** → chọn tài khoản của bạn
4. Gặp màn hình *"Google chưa xác minh ứng dụng này"* → bấm **Nâng cao**
   (*Advanced*) → **Đi tới … (không an toàn)**. Đây là script của chính bạn
   nên không sao.
5. Bấm **Cho phép**

Xong, quay lại bảng tính: phải thấy sheet **Đơn hàng** với một dòng thử nghiệm,
và hộp thư của bạn có một email báo đơn. Xoá dòng thử nghiệm đó đi.

## Bước 5 — Deploy thành Web App

1. Góc phải trên, bấm **Triển khai → Lượt triển khai mới**
   (*Deploy → New deployment*)
2. Bấm biểu tượng bánh răng cạnh **Chọn loại**, chọn **Ứng dụng web**
   (*Web app*)
3. Điền:
   - **Mô tả**: `Nhận đơn teamhoc.shop`
   - **Thực thi với tư cách**: **Tôi** (*Me*)
   - **Ai có quyền truy cập**: **Bất kỳ ai** (*Anyone*) ← **quan trọng**
4. Bấm **Triển khai**, rồi **copy địa chỉ Web App**

Địa chỉ có dạng:

```
https://script.google.com/macros/s/AKfycb...................../exec
```

> **Ai có quyền truy cập** phải là **Bất kỳ ai**, không phải *Bất kỳ ai có
> Tài khoản Google*. Chọn sai thì website không gửi đơn lên được.

Mở thử địa chỉ đó bằng trình duyệt — thấy dòng *"✅ Script nhận đơn đang chạy"*
là đúng.

## Bước 6 — Điền vào website

Mở `data/products.js`, tìm khối `brand`, điền hai dòng này:

```js
orderEndpoint: "https://script.google.com/macros/s/AKfycb...../exec",
orderToken: "doi-chuoi-nay-di",     // trùng đúng TOKEN ở bước 3
```

Lưu lại, push lên GitHub. Nếu dùng bản gộp một file thì chạy lại `node build.js`.

## Bước 7 — Đặt thử một đơn

Vào website, đặt một đơn thật với email của bạn. Kết quả đúng phải là:

- Trang cảm ơn hiện khung tím **"✅ Đơn đã gửi tới TeamHọc"**
- Google Sheet có thêm một dòng
- Bạn nhận email báo đơn mới
- Email bạn điền khi đặt hàng nhận được thư xác nhận

Xong thì xoá dòng thử nghiệm trong Sheet.

---

## Khi có gì đó không chạy

**Trang cảm ơn hiện khung cam "Không gửi được đơn lên hệ thống"**

- Kiểm tra `orderEndpoint` đã dán đúng chưa, có đuôi `/exec` không
  (dán nhầm đuôi `/dev` là hỏng)
- Kiểm tra deploy đã đặt **Ai có quyền truy cập = Bất kỳ ai** chưa
- Mở Console trình duyệt (F12), nếu thấy dòng `Apps Script từ chối: Sai mã bảo vệ`
  thì `orderToken` trong website chưa trùng `TOKEN` trong script

**Sheet có dòng mới nhưng không nhận được email**

Vào Apps Script → **Nhật ký thực thi** (*Executions*) xem lỗi. Thường là do
vượt hạn mức gửi mail trong ngày (tài khoản Gmail thường khoảng 100 email/ngày).

**Sửa script rồi mà website vẫn chạy bản cũ**

Mỗi lần sửa code phải **Triển khai → Quản lý lượt triển khai → sửa (bút chì) →
Phiên bản: Phiên bản mới → Triển khai**. Địa chỉ Web App giữ nguyên.

---

## Hai điều cần biết

**`orderToken` không phải là bảo mật thật.** Nó nằm trong mã nguồn trang web,
ai bấm "Xem nguồn trang" cũng đọc được. Nó chỉ chặn bot quét bừa, không chặn
được người cố tình. Muốn chắc hơn thì cần backend thật — với quy mô shop nhỏ
thì hàng rào này là đủ.

**Website luôn giữ một bản sao đơn trên máy khách.** Kể cả khi mạng hỏng hay
script chết, đơn vẫn được lưu trong trình duyệt của khách và trang cảm ơn sẽ
hiện nút nhắn Zalo / gửi email để khách gửi tay cho bạn. Không có đơn nào biến
mất trong im lặng.
