# Kiểm thử

## Chạy bằng node, không cần trình duyệt

```
node scripts/kiem-thu-store.mjs      # 25 phép thử: bản sao dữ liệu, đẩy/nhận, xoá dây chuyền
node scripts/kiem-thu-store-2.mjs    # 11 phép thử: xoá lớp, xuất/nhập JSON
```

## Chạy bằng trình duyệt

Cần một máy chủ tĩnh và Playwright + Chromium.

```
python3 -m http.server 8141          # chạy trong thư mục cvht-mtu/
node scripts/kiem-thu-dang-nhap.mjs  # 26 phép thử: toàn bộ luồng đăng nhập
```

`firebase-gia.js` là một bản Firebase giả, đủ bề mặt để chạy thử mà không cần
dự án thật và không chạm vào dữ liệu thật. Nó đã bắt được một lỗi thật: Firebase
phát trạng thái đăng nhập trước khi màn hình kịp đăng ký nghe, làm ứng dụng treo
ở màn hình "đang tải". Giữ lại để lần sau còn bắt được nữa.

**Lưu ý:** những phép thử này kiểm tra phần mã chạy trên máy. Bộ quy tắc bảo mật
thì phải chạy riêng trong Rules Playground — xem `server/kiem-thu-phan-quyen.md`.
