# Bảng kiểm thử phân quyền

Chạy trong **Firebase Console → Firestore → Rules → Rules Playground**. Mỗi dòng là một
phép thử; cột cuối là kết quả bắt buộc. Một dòng sai là một lỗ hổng, không phải chuyện nhỏ.

## Dữ liệu dựng sẵn để thử

```
/khoa/XD                     { code: "XD", name: "Khoa Xây dựng" }
/khoa/KT                     { code: "KT", name: "Khoa Kinh tế" }

/advisors/uidPhieu           { role: "owner",     khoaId: "XD", classIds: ["XD26CT01"],
                               email: "truonghoangphieu@mtu.edu.vn" }
/advisors/uidAnh             { role: "advisor",   khoaId: "XD", classIds: ["XD26CT02"],
                               email: "anh@mtu.edu.vn" }
/advisors/uidBinh            { role: "khoaAdmin", khoaId: "XD", classIds: [],
                               email: "binh@mtu.edu.vn" }
/advisors/uidCuc             { role: "advisor",   khoaId: "KT", classIds: ["KT26QT01"],
                               email: "cuc@mtu.edu.vn" }
/advisors/uidMoi             { role: "pending",   khoaId: "XD", classIds: [],
                               email: "moi@mtu.edu.vn" }

/classes/XD26CT01            { khoaId: "XD", advisorUid: "uidPhieu" }
/classes/XD26CT02            { khoaId: "XD", advisorUid: "uidAnh" }
/classes/KT26QT01            { khoaId: "KT", advisorUid: "uidCuc" }

/students/2250001            { mssv: "2250001", classId: "XD26CT01",
                               authEmail: "sv2250001@mtu.edu.vn", fullName: "…" }
/students/2250002            { mssv: "2250002", classId: "XD26CT02",
                               authEmail: "sv2250002@mtu.edu.vn" }

/links/uidSV1                { mssv: "2250001", classId: "XD26CT01" }
```

---

## A. Hồ sơ sinh viên

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| A1 | `uidPhieu` (owner) | đọc `/students/2250002` (lớp không phụ trách) | **Cho** |
| A2 | `uidAnh` (advisor XD26CT02) | đọc `/students/2250002` | **Cho** |
| A3 | `uidAnh` | đọc `/students/2250001` (lớp của người khác) | **Từ chối** |
| A4 | `uidCuc` (advisor Khoa KT) | đọc `/students/2250001` (Khoa XD) | **Từ chối** |
| A5 | `uidBinh` (khoaAdmin XD) | đọc `/students/2250001` | **Cho** |
| A6 | `uidBinh` (khoaAdmin XD) | đọc `/students` của Khoa KT | **Từ chối** |
| A7 | `uidMoi` (pending) | đọc bất kỳ hồ sơ nào | **Từ chối** |
| A8 | chưa đăng nhập | đọc `/students/2250001` | **Từ chối** |
| A9 | `sv2250001@mtu.edu.vn` | đọc hồ sơ `/students/2250001` của mình | **Cho** |
| A10 | `sv2250001@mtu.edu.vn` | đọc `/students/2250002` của bạn cùng khoá | **Từ chối** |

## B. Sinh viên sửa hồ sơ

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| B1 | `sv2250001` | đổi `phone` của mình | **Cho** |
| B2 | `sv2250001` | đổi `phone` + `zalo` + `address` cùng lúc | **Cho** |
| B3 | `sv2250001` | đổi `fullName` của mình | **Từ chối** |
| B4 | `sv2250001` | đổi `classId` sang lớp khác | **Từ chối** |
| B5 | `sv2250001` | đổi `phone` **và** `classId` cùng một lần ghi | **Từ chối** |
| B6 | `sv2250001` | đổi `authEmail` sang địa chỉ khác | **Từ chối** |
| B7 | `sv2250001` | sửa `phone` của `/students/2250002` | **Từ chối** |
| B8 | `uidPhieu` | đổi `mssv` của `/students/2250001` | **Từ chối** |

## C. Căn cước công dân

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| C1 | `uidPhieu` | tạo sinh viên mới kèm trường `cccd` | **Từ chối** |
| C2 | `uidPhieu` | cập nhật hồ sơ, thêm trường `cmnd` | **Từ chối** |
| C3 | `uidPhieu` | tạo sinh viên mới không có trường nào trong nhóm đó | **Cho** |

## D. Ghi chú riêng của cố vấn

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| D1 | `uidPhieu` | đọc `/students/2250001/private/ghi1` | **Cho** |
| D2 | `sv2250001` | đọc `/students/2250001/private/ghi1` (của chính mình) | **Từ chối** |
| D3 | `uidAnh` | đọc `/students/2250001/private/ghi1` | **Từ chối** |
| D4 | `uidBinh` (khoaAdmin) | ghi vào `/students/2250001/private/ghi1` | **Từ chối** |

> D2 là phép thử quan trọng nhất của cả bảng: sinh viên đọc được hồ sơ của mình nhưng
> **không** được đọc ghi chú cố vấn viết về mình.

## E. Nối tài khoản

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| E1 | `sv2250001@mtu.edu.vn` | tạo `/links/uidSV1 = {mssv:"2250001", classId:"XD26CT01"}` | **Cho** |
| E2 | `sv2250001@mtu.edu.vn` | tạo link trỏ tới `mssv: "2250002"` | **Từ chối** |
| E3 | `sv2250001@mtu.edu.vn` | tạo link với `classId` sai so với hồ sơ | **Từ chối** |
| E4 | `sv2250001@mtu.edu.vn` | sửa `/links/uidSV1` sang mssv khác | **Từ chối** |
| E5 | `ngoai@gmail.com` | tạo link bất kỳ | **Từ chối** |

## F. Tự nâng quyền

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| F1 | `uidMoi` (pending) | tự đổi `role` của mình thành `advisor` | **Từ chối** |
| F2 | `uidMoi` | tự thêm `"XD26CT01"` vào `classIds` của mình | **Từ chối** |
| F3 | `uidMoi` | tự đổi `name` và `phone` của mình | **Cho** |
| F4 | `uidAnh` (advisor) | duyệt `uidMoi` thành `advisor` | **Từ chối** |
| F5 | `uidBinh` (khoaAdmin XD) | duyệt `uidMoi` (Khoa XD) thành `advisor` | **Cho** |
| F6 | `uidBinh` (khoaAdmin XD) | phong `uidMoi` thành `owner` | **Từ chối** |
| F7 | `uidBinh` (khoaAdmin XD) | đổi `khoaId` của `uidCuc` từ KT sang XD | **Từ chối** |
| F8 | `uidBinh` | duyệt một người của Khoa KT | **Từ chối** |
| F9 | `uidPhieu` (owner) | làm tất cả những việc trên | **Cho** |
| F10 | `ngoai@gmail.com` | tự tạo `/advisors/{uid}` cho mình | **Từ chối** |
| F11 | `moi@mtu.edu.vn` chưa có hồ sơ | tự tạo `/advisors/{uid}` với `role: "pending"` | **Cho** |
| F12 | `moi@mtu.edu.vn` chưa có hồ sơ | tự tạo `/advisors/{uid}` với `role: "owner"` | **Từ chối** |

## G. Nhật ký

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| G1 | `uidPhieu` | ghi thêm một dòng nhật ký đứng tên mình | **Cho** |
| G2 | `uidPhieu` | ghi một dòng đứng tên `anh@mtu.edu.vn` | **Từ chối** |
| G3 | `uidPhieu` | ghi một dòng với `at` là giờ tự đặt | **Từ chối** |
| G4 | `uidPhieu` (owner) | sửa một dòng nhật ký đã có | **Từ chối** |
| G5 | `uidPhieu` (owner) | xoá một dòng nhật ký | **Từ chối** |
| G6 | `uidPhieu` (owner) | đọc nhật ký | **Cho** |
| G7 | `uidAnh` (advisor) | đọc nhật ký | **Từ chối** |

> G4 và G5 là chỗ bảo đảm nhật ký có giá trị làm chứng: ngay cả người có quyền cao nhất
> cũng không xoá được dấu vết của mình.

## H. Điểm danh

| # | Ai | Làm gì | Phải ra |
|---|---|---|---|
| H1 | `sv2250001` | thêm tên mình vào `present` của buổi điểm danh lớp mình | **Cho** |
| H2 | `sv2250001` | sửa ngày giờ buổi điểm danh | **Từ chối** |
| H3 | `sv2250001` | điểm danh cho buổi của lớp XD26CT02 | **Từ chối** |
| H4 | `sv2250001` | xoá buổi điểm danh | **Từ chối** |
| H5 | `uidPhieu` | tạo và xoá buổi điểm danh lớp mình | **Cho** |

---

## Cách chạy

Rules Playground không dựng sẵn dữ liệu, nên với mỗi phép thử cần:

1. Chọn loại thao tác (get / list / create / update / delete) và đường dẫn tài liệu.
2. Bật **Authenticated**, điền `uid` và, trong Custom claims, điền
   `{ "email": "...", "email_verified": true }`.
3. Với `create` / `update`, dán phần dữ liệu định ghi vào ô Document data.
4. Bấm Run và đối chiếu với cột "Phải ra".

Những phép thử cần đọc tài liệu khác (ví dụ A2 phải đọc `/advisors/uidAnh` và
`/classes/XD26CT02`) thì các tài liệu đó phải tồn tại thật trong Firestore — nên dựng bộ dữ
liệu ở đầu tệp này trước, bằng dữ liệu giả, **không dùng tên và mã số sinh viên thật**.

Chạy đủ 50 phép thử mất khoảng một tiếng. Đáng, vì mỗi dòng sai là một đường rò.
