# Thư viện Firebase đặt ở đây

Ứng dụng này **không gọi thư viện từ Internet**. Đó là lý do cài xong rồi tắt mạng vẫn dùng
được. Nên thư viện Firebase cũng phải tải về đặt trong thư mục này, không để `<script>` trỏ
sang `gstatic.com`.

## Ba tệp cần tải

Tải bản `compat` (ứng dụng dùng thẻ `<script>` chứ không dùng module):

```
https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js
```

Đặt vào đây với đúng tên đó:

```
assets/vendor/firebase-app-compat.js
assets/vendor/firebase-auth-compat.js
assets/vendor/firebase-firestore-compat.js
```

## Rồi làm hai việc

1. Trong `index.html`, thêm ba dòng này **trước** `cloud.js`:

```html
<script src="assets/vendor/firebase-app-compat.js"></script>
<script src="assets/vendor/firebase-auth-compat.js"></script>
<script src="assets/vendor/firebase-firestore-compat.js"></script>
```

2. Trong `sw.js`, thêm ba đường dẫn đó vào mảng `ASSETS` và tăng `VERSION` lên một số.

## Chưa tải thì sao

Không sao cả. `cloud.js` tự kiểm tra: không thấy thư viện thì `CV.cloud.available()` trả về
`false`, `store.js` không cắm backend nào, và ứng dụng chạy đúng như trước — gói gọn trong
một máy, dùng localStorage. Không có màn hình nào hỏng.

## Vì sao không dùng npm

Ứng dụng này cố tình không có bước build: không `package.json`, không `node_modules`, mở
thẳng `index.html` là chạy. Tải ba tệp về đặt vào đây giữ được tính chất đó.
