# Dựng dự án Firebase mới cho web app Cố vấn học tập

Làm một lần, khoảng 45–60 phút. Mỗi bước có mục **“Thấy gì là đúng”** để Thầy tự kiểm
trước khi sang bước sau — sai ở bước đầu mà đi tiếp thì rất khó tìm ra.

> **Vì sao dự án mới, không dùng lại `cvht-mtu`**
> Dự án cũ đang cho bản AI Studio chạy, mà bản đó cần quy tắc mở toang mới hoạt động.
> Hai bản không dùng chung một dự án được. Dự án mới cũng sạch sẽ: không phải phân vân
> dữ liệu nào trong đó đã từng bị ai đọc.
>
> **Nhưng dự án cũ vẫn đang hở.** Mở dự án mới không làm chỗ cũ an toàn hơn. Khi bản mới
> chạy ổn, phải quay lại `cvht-mtu` đóng quy tắc và dọn dữ liệu. Xem mục 11.

---

## 1. Tạo dự án

Vào [console.firebase.google.com](https://console.firebase.google.com) → **Create a project**.

| Mục | Chọn gì |
|---|---|
| Project name | `cvht-mtu-truong` (hoặc tên khác, miễn đừng trùng dự án cũ) |
| Google Analytics | **Tắt**. Không cần, mà bật thì thêm một nơi thu thập dữ liệu người dùng |

**Thấy gì là đúng:** vào được trang tổng quan dự án, góc trên trái hiện đúng tên vừa đặt.
Kiểm lại cho chắc — làm nhầm trên dự án cũ là hỏng việc đang chạy.

---

## 2. Tạo cơ sở dữ liệu Firestore

**Build → Firestore Database → Create database**.

| Mục | Chọn gì | Vì sao |
|---|---|---|
| Mode | **Production mode** (khoá sẵn) | Test mode mở toang 30 ngày. Mình dán quy tắc riêng ở bước 3 |
| Location | **asia-southeast1 (Singapore)** | Gần Việt Nam nhất, truy cập nhanh hơn |

> **Chỗ này chọn xong KHÔNG đổi được.** Muốn đổi vùng phải xoá cả dự án làm lại.
> Chọn kỹ rồi hãy bấm.

**Thấy gì là đúng:** tab **Data** trống rỗng, tab **Rules** có sẵn đoạn mặc định
`allow read, write: if false;`.

---

## 3. Dán quy tắc bảo mật

Tab **Rules** → bấm vào khung mã → `Ctrl+A` → dán đè toàn bộ nội dung tệp
`cvht-mtu/server/firestore.rules` (358 dòng) → bấm **Publish**.

**Thấy gì là đúng:** không có dòng nào gạch đỏ báo lỗi cú pháp, và sau khi Publish thì
mốc thời gian mới nhất bên trái là vừa xong.

---

## 4. Bật đăng nhập bằng Google

**Build → Authentication → Get started → Sign-in method → Google → Enable**.

| Mục | Điền gì |
|---|---|
| Project public-facing name | `Cố vấn học tập MTU` |
| Project support email | `truonghoangphieu@mtu.edu.vn` |

**Thấy gì là đúng:** dòng **Google** trong bảng Sign-in providers ghi **Enabled**.

---

## 5. Khai báo tên miền được phép

**Authentication → Settings → Authorized domains**.

Mặc định đã có `localhost` và hai tên miền của Firebase. Thêm tên miền nơi Thầy đặt
ứng dụng (xem mục 8). Dùng GitHub Pages thì thêm `phieu7968.github.io`.

**Thấy gì là đúng:** tên miền vừa thêm nằm trong danh sách.

> Thiếu bước này thì đăng nhập báo lỗi `auth/unauthorized-domain`. Ứng dụng có sẵn lời
> nhắc cho trường hợp này nên gặp sẽ biết ngay.

---

## 6. Lấy cấu hình dự án

**Project settings** (bánh răng góc trên trái) → cuộn xuống **Your apps** →
bấm biểu tượng **web** `</>`.

| Mục | Điền gì |
|---|---|
| App nickname | `CVHT MTU` |
| Firebase Hosting | **Không tích**, dùng cách khác ở mục 8 |

Bấm **Register app**. Màn hình hiện khối `firebaseConfig`. Chép lấy sáu dòng trong đó.

Mở `cvht-mtu/assets/js/cloud-config.js`, điền vào:

```js
enabled: true,
provider: "google",
hostedDomain: "mtu.edu.vn",
firebase: {
  apiKey: "...",              // chép từ Console
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}
```

> **Khối này không phải bí mật.** Google ghi rõ `apiKey` phía trình duyệt chỉ để biết gọi
> tới dự án nào, không phải khoá bí mật — mọi ứng dụng web Firebase đều lộ nó. Cái giữ an
> toàn là bộ quy tắc ở bước 3. Nên đưa tệp này lên kho công khai được.

---

## 7. Tải thư viện Firebase

Tải ba tệp, đặt vào `cvht-mtu/assets/vendor/` với đúng tên:

```
https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js
https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js
```

Ứng dụng không gọi thư viện từ Internet — đó là lý do cài xong tắt mạng vẫn dùng được.
Chi tiết trong `assets/vendor/README.md`.

**Thấy gì là đúng:** mở ứng dụng, bấm F12 xem Console, không còn dòng 404 nào về
`firebase-...-compat.js`.

---

## 8. Đặt ứng dụng lên mạng

Cài được lên điện thoại thì ứng dụng phải chạy qua **HTTPS**. Mở tệp từ ổ đĩa không cài
được. Hai cách, đều miễn phí:

### Cách A — GitHub Pages (đề nghị dùng)

Kho `Phieu7968/NTL` đã ở sẵn trên GitHub. Vào **Settings → Pages**, chọn nhánh
`claude/new-session-wd88wx`, thư mục `/ (root)`, bấm Save.

Vài phút sau ứng dụng chạy tại `https://phieu7968.github.io/NTL/cvht-mtu/`.

Không cần cài gì trên máy. Nhớ thêm `phieu7968.github.io` vào Authorized domains (mục 5).

### Cách B — Firebase Hosting

Cùng dự án, miễn phí 10GB và 360MB truyền mỗi ngày. Nhưng phải cài Firebase CLI qua npm
và chạy lệnh. Tiện hơn về lâu dài, rườm rà hơn lúc đầu.

> **Lưu ý:** đặt lên mạng nghĩa là ai cũng mở được trang. Điều đó không sao — họ thấy màn
> hình đăng nhập và không lấy được dữ liệu nào, vì quy tắc ở bước 3 chặn. An toàn nằm ở
> quy tắc, không nằm ở chỗ giấu địa chỉ.

---

## 9. Đăng nhập lần đầu và tự cấp quyền

Đây là chỗ hay vướng nhất, vì lúc này **chưa ai có quyền gì cả**, kể cả Thầy.

1. Mở ứng dụng, bấm **Đăng nhập bằng tài khoản Trường**, chọn tài khoản `@mtu.edu.vn`.
2. Ứng dụng báo **“Chưa tìm thấy hồ sơ”** → bấm **“Tôi là giảng viên — đăng ký tài khoản”**
   → điền họ tên, học vị, mã Khoa (ví dụ `XD`) → Gửi.
3. Màn hình chuyển sang **“Tài khoản đang chờ duyệt”**. Đúng như vậy, chưa sai gì.
4. Quay lại Firebase Console → **Firestore → Data → `advisors`** → mở tài liệu vừa sinh ra
   (mã dài loằng ngoằng, đó là `uid` của Thầy) → sửa trường `role` từ `pending` thành
   `owner` → Update.
5. Về ứng dụng, đăng xuất rồi đăng nhập lại.

**Thấy gì là đúng:** vào thẳng Bàn làm việc, thanh bên trái có thêm hai mục **Quản trị** và
**Nhật ký**.

> Bước 4 làm được vì tab **Data** của Console bỏ qua quy tắc — Thầy là chủ dự án.
> Đó cũng là cách duy nhất tạo ra người `owner` đầu tiên. Từ đó về sau Thầy duyệt người
> khác ngay trong ứng dụng, không phải vào Console nữa.

---

## 10. Khai báo và nạp dữ liệu

Trong ứng dụng, vào **Quản trị**:

1. **Khoa** → Thêm Khoa (`XD` — Khoa Xây dựng).
2. **Phân công lớp** → gán Khoa cho từng lớp, chọn cố vấn phụ trách.
3. Có dữ liệu cũ dưới máy thì bấm **Mở công cụ nạp dữ liệu** → đọc kết quả soát → sửa hết
   chỗ **Bị chặn** → bấm nạp.

**Thấy gì là đúng:** mục **Kiểm tra nhất quán** cuối màn hình Quản trị hiện nền xanh,
không có dòng lệch nào.

---

## 11. Hai việc làm sau khi bản mới chạy ổn

**Một — chạy bảng kiểm thử phân quyền.** `server/kiem-thu-phan-quyen.md` có 54 phép thử
chạy trong **Rules Playground**. Khoảng một tiếng. Đây là chỗ duy nhất kiểm được quy tắc
có đúng như thiết kế hay không — tôi không chạy thay được, vì quy tắc chỉ chạy trên máy
chủ Google. **Dùng dữ liệu giả, đừng dùng tên và mã số sinh viên thật.**

**Hai — đóng dự án cũ.** Khi nào không cần bản AI Studio nữa:

1. Dự án `cvht-mtu` → Firestore → Rules → thay bằng `allow read, write: if false;` → Publish.
2. Mở tab Data xem trong `students` có dữ liệu sinh viên thật không. Có thì theo Nghị định
   13/2023 đây là sự cố dữ liệu cá nhân, cần báo Trường.
3. Xuất ra giữ bản lưu rồi xoá dữ liệu trong dự án cũ.

Để càng lâu thì dữ liệu càng phơi lâu. Nên đặt cho mình một mốc thời gian.

---

## Gặp lỗi thì tra ở đây

| Lời báo | Nguyên nhân | Sửa |
|---|---|---|
| `auth/unauthorized-domain` | Tên miền chưa khai báo | Mục 5 |
| `auth/operation-not-allowed` | Chưa bật Google sign-in | Mục 4 |
| Màn hình “Thiếu thư viện Firebase” | Chưa tải ba tệp về `assets/vendor/` | Mục 7 |
| “Máy chủ từ chối đọc mục …” | Tài khoản chưa được phân quyền | Mục 9 |
| “Sai tài khoản” | Đăng nhập bằng Gmail cá nhân | Chọn lại tài khoản `@mtu.edu.vn` |
| Nạp dữ liệu báo `permission-denied` | Bản ghi thiếu mã lớp hoặc mã Khoa | Đọc kết quả soát ở mục 10 |
