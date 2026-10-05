# Dựng máy chủ đồng bộ bằng Google Apps Script

Không có máy chủ thì ứng dụng vẫn chạy đủ chức năng, chỉ khác là trao đổi với sinh viên
bằng cách gửi tệp qua Zalo. Dựng máy chủ để sinh viên sửa số điện thoại hay đặt lịch gặp
là máy thầy cô nhận được ngay.

Dữ liệu nằm trong **một Google Sheet của chính thầy cô**, không qua dịch vụ nào khác,
không tốn tiền.

## 1. Tạo Sheet và dán mã

1. Mở [sheets.new](https://sheets.new), đặt tên ví dụ *CVHT MTU — dữ liệu đồng bộ*.
2. Menu **Tiện ích mở rộng → Apps Script**.
3. Xoá hết nội dung trong `Code.gs`, dán toàn bộ nội dung tệp `cvht-sync.gs` vào.
4. Bấm biểu tượng đĩa mềm để lưu.

## 2. Sinh khoá giảng viên

1. Trong Apps Script, chọn hàm `datKhoaGiangVien` ở ô chọn hàm rồi bấm **Chạy**.
2. Lần đầu Google sẽ hỏi cấp quyền — chọn tài khoản, bấm **Nâng cao → Chuyển đến…**,
   rồi **Cho phép**. Đây là quyền cho script ghi vào chính Sheet vừa tạo.
3. Mở **Nhật ký thực thi**, chép chuỗi khoá in ra. Giữ kín chuỗi này như mật khẩu.

## 3. Triển khai

1. Bấm **Triển khai → Triển khai mới**.
2. Loại: **Ứng dụng web**.
3. *Thực thi với tư cách*: **Tôi**.
4. *Ai có quyền truy cập*: **Bất kỳ ai**.

   Nghe đáng lo nhưng đúng là cần: máy sinh viên không đăng nhập Google nên phải gọi
   được. Bù lại, mọi yêu cầu đều phải kèm khoá giảng viên hoặc mã liên kết của sinh
   viên, không có thì máy chủ từ chối.
5. Bấm **Triển khai**, chép **URL ứng dụng web** (đuôi `/exec`).

## 4. Khai vào ứng dụng

Mở ứng dụng → **Cài đặt → Đồng bộ với máy sinh viên**: dán URL và khoá giảng viên, chọn
**Bật**, bấm **Kiểm tra kết nối**. Được thì bấm **Đồng bộ ngay** để đẩy dữ liệu lên lần đầu.

Từ lúc này, gói dữ liệu gửi cho sinh viên sẽ **tự mang theo địa chỉ máy chủ**, các em
không phải gõ gì. Gói không bao giờ chứa khoá giảng viên.

## 5. Ai được làm gì

| | Đọc | Ghi |
|---|---|---|
| Máy giảng viên (có khoá) | Toàn bộ | Toàn bộ |
| Máy sinh viên (mã số + mã liên kết) | Chỉ dữ liệu của chính em ấy, cộng danh sách lớp và học kỳ | Chỉ điện thoại, Zalo, email, địa chỉ, ghi chú liên hệ của chính em ấy và lịch hẹn do em ấy đặt |

Máy chủ tự kiểm tra, không dựa vào giao diện. Sinh viên có sửa yêu cầu gửi lên cũng không
ghi được sang hồ sơ bạn khác, cũng không sửa được điểm của chính mình.

**Mã PIN của sinh viên không bao giờ được gửi lên máy chủ.** Nó chỉ nằm trên máy đã nhận
gói dữ liệu.

## 6. Thử trên máy mình trước

```bash
node server/mock-sync.js
```

Chạy một máy chủ giả ở `http://127.0.0.1:8787` với khoá `khoa-thu-nghiem`, cùng giao thức.
Dùng để thử luồng đồng bộ trước khi đụng tới Google. **Không dùng cho dữ liệu thật**:
không có HTTPS và tắt là mất dữ liệu.

## 7. Vài điều nên biết

- Sửa mã trong Apps Script xong phải **Triển khai → Quản lý triển khai → sửa → Phiên bản mới**,
  nếu không URL cũ vẫn chạy mã cũ.
- Hàm `xoaToanBoDuLieu()` xoá sạch dữ liệu trên máy chủ, không hoàn tác được.
- Google giới hạn số lần chạy mỗi ngày cho tài khoản thường. Một cố vấn với vài trăm sinh
  viên thì không chạm ngưỡng, nhưng nhân ra toàn trường thì nên tính tới máy chủ của Trường.
- Dữ liệu để trên Google Drive là để ở máy chủ đặt ngoài Việt Nam. Xem mục 9 của README
  chính về Nghị định 13/2023/NĐ-CP trước khi dùng cho dữ liệu sinh viên thật.
