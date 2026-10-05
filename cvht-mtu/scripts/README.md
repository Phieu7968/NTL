# Kiểm thử

## Chạy bằng node, không cần trình duyệt

```
node scripts/kiem-thu-store.mjs      # 25 phép thử: bản sao dữ liệu, đẩy/nhận, xoá dây chuyền
node scripts/kiem-thu-store-2.mjs    # 11 phép thử: xoá lớp, xuất/nhập JSON
node scripts/kiem-thu-van-ban.mjs    # 76 phép thử: văn bản hành chính theo NĐ 30
```

## Chạy bằng trình duyệt

Cần một máy chủ tĩnh và Playwright + Chromium.

```
python3 -m http.server 8141          # chạy trong thư mục cvht-mtu/
node scripts/kiem-thu-dang-nhap.mjs  # 47 phép thử: toàn bộ luồng đăng nhập
node scripts/kiem-thu-van-ban-ui.mjs # 20 phép thử: xuất Word và in, qua giao diện thật
node scripts/kiem-thu-quan-tri.mjs   # 53 phép thử: duyệt cố vấn, phân lớp, nhật ký
```

`firebase-gia.js` là một bản Firebase giả, đủ bề mặt để chạy thử mà không cần
dự án thật và không chạm vào dữ liệu thật. Nó đã bắt được một lỗi thật: Firebase
phát trạng thái đăng nhập trước khi màn hình kịp đăng ký nghe, làm ứng dụng treo
ở màn hình "đang tải". Giữ lại để lần sau còn bắt được nữa.

**Lưu ý:** những phép thử này kiểm tra phần mã chạy trên máy. Bộ quy tắc bảo mật
thì phải chạy riêng trong Rules Playground — xem `server/kiem-thu-phan-quyen.md`.

## Đo bề ngang chữ

```
node scripts/do-be-ngang-chu.mjs
```

In ra bề ngang thật của quốc hiệu và tên cơ quan ở từng cỡ chữ, bằng phông Times
New Roman. Dùng để định lại hằng số chọn cỡ chữ trong `docvn.js` nếu sau này đổi
tên Trường hoặc đổi lề. Đừng đoán bằng số ký tự — tôi đã đoán và sai hai lần.
