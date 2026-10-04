# Thiết kế lại tầng dữ liệu — đồng bộ nhiều thiết bị, hai chiều, tức thời

> Lập ngày 04/10/2026. Trả lời yêu cầu: một cố vấn cài trên cả điện thoại lẫn máy tính,
> hai máy luôn khớp nhau; phía sinh viên cũng cập nhật nhanh.
>
> **Sửa lần 1 — 04/10/2026**, sau khi Thầy trả lời ba câu hỏi: Trường có cấp thư điện tử
> cho sinh viên; dùng lại dự án `cvht-mtu`; phạm vi là **nhiều cố vấn, nhiều Khoa, toàn
> trường**. Mục 3, 5, 7 và 9 đã viết lại theo đó. Quy tắc bảo mật đầy đủ nay nằm ở
> `server/firestore.rules`.

---

## 1. Kết luận trước, lý lẽ sau

**Giữ Firestore. Thêm phần mà bản AI Studio đã bỏ sót: đăng nhập.**

Bản AI Studio chọn đúng cơ sở dữ liệu rồi bỏ mất nửa còn lại. Firestore sinh ra chính là để
làm việc này: nghe thay đổi theo thời gian thực, giữ bản sao dưới máy để chạy khi mất mạng,
tự hoà giải khi có mạng lại, và phân quyền bằng quy tắc chạy trên máy chủ. Cả bốn thứ đó
đều cần, và viết tay lại bằng Apps Script thì lúc nào cũng thua một bậc.

Cái sai duy nhất bên đó là không có đăng nhập. Không biết người gọi là ai thì quy tắc nào
cũng phải quy về `if true`. Thêm Firebase Authentication vào là chỗ dột đó bịt lại, và
`request.auth.uid` trở thành thứ quy tắc bám vào để phân quyền thật.

**Và không viết lại ứng dụng.** Đây là điểm quan trọng nhất của bản thiết kế này.

---

## 2. Vì sao không phải viết lại

Toàn bộ phần JS hiện có là 340 KB. Các màn hình không nói chuyện trực tiếp với localStorage —
chúng đi qua `CV.store`:

```js
const U = CV.util, el = U.el, ui = CV.ui, A = CV.academic, S = CV.store;
...
S.all("classes")      S.get("students", id)      S.put("students", obj)
```

Nên nếu `CV.store` **giữ nguyên bộ hàm** mà thay ruột bên dưới, thì 174 KB mã màn hình
(`view-advisor.js`, `view-student.js`), 30 KB logic học vụ, phần biểu đồ, Excel, in ấn —
**không phải sửa một dòng nào**.

| Tệp | Dung lượng | Số phận |
|---|---|---|
| `store.js` | 14,7 KB | **Thay ruột** — bản sao trong bộ nhớ, nghe Firestore |
| `sync.js` | 11,3 KB | **Bỏ** — Firestore tự lo |
| `view-auth.js` | 17,9 KB | **Viết lại** — Firebase Auth |
| `pack.js` | 18,2 KB | **Rút gọn** — không cần gói tệp nữa, còn giữ phần mã liên kết |
| `academic.js` `charts.js` `xlsx.js` `io.js` `ui.js` `util.js` | 113 KB | Không đụng |
| `view-advisor.js` `view-student.js` | 154 KB | Không đụng |

Khoảng **18% mã nguồn** thay đổi. 82% giữ nguyên.

### Chỗ khó duy nhất, và cách gỡ

`CV.store` hiện **đồng bộ**: `S.all("classes")` trả về mảng ngay lập tức. Firestore thì
**bất đồng bộ**. Nếu đổi store thành bất đồng bộ thì mọi chỗ gọi đều phải sửa — tức là
phải đụng vào cả 154 KB kia. Không chấp nhận được.

Cách gỡ là **giữ một bản sao trong bộ nhớ** (local mirror):

```
Firestore onSnapshot ──► cập nhật bản sao trong RAM ──► notify() ──► app.render()
                                      ▲
                 S.all() / S.get() ───┘  đọc thẳng từ RAM, vẫn đồng bộ, không sửa gì

S.put() ──► ghi vào RAM ngay (màn hình phản ứng tức thì)
        └─► đồng thời đẩy lên Firestore (lỗi thì báo bằng toast)
```

Mấu chốt: `store.js` **đã có sẵn chỗ để cắm vào**. Dòng 128 có `listeners`, dòng 131 có
`notify()`, dòng 346 có `on()`, dòng 330 có `BroadcastChannel` để đồng bộ giữa các tab.
Mạch "có thay đổi → vẽ lại màn hình" đã chạy rồi; việc còn lại chỉ là đổi nguồn phát tín
hiệu từ BroadcastChannel sang `onSnapshot` của Firestore.

Đây chính là lý do con số 18% là thật chứ không phải ước đoán lạc quan.

---

## 3. Mô hình dữ liệu

Phạm vi toàn trường nên phải có cấp Khoa, và phải có số liệu tổng hợp sẵn.

```
/khoa/{khoaId}
    code, name, dean, active

/advisors/{uid}                         ◄── khoá là uid của tài khoản đăng nhập
    name, title, email, khoaId,
    role: "owner" | "khoaAdmin" | "advisor" | "pending",
    classIds: [...], active

/classes/{classId}
    code, name, khoaId, majorId, advisorUid, gvcnUid, cohort, active

/students/{mssv}                        ◄── khoá là MSSV
    mssv, fullName, dob, gender, classId,
    authEmail,                          ◄── thư điện tử Trường cấp; đây là thứ nhận ra em ấy
    phone, zalo, email, address, contactNote
    (KHÔNG có CCCD — xem mục 4.3)

/students/{mssv}/terms/{termId}         điểm từng học kỳ, GPA, tín chỉ
/students/{mssv}/private/{docId}        ◄── ghi chú riêng của CVHT, sinh viên KHÔNG đọc được

/classes/{classId}/meetings/{id}        sổ họp lớp
/classes/{classId}/attendance/{id}      điểm danh
/consultations/{id}                     hộp thư tư vấn hai chiều
/links/{uid}                            nối tài khoản ↔ MSSV (xem mục 5)
/audit/{id}                             nhật ký, chỉ ghi thêm, không sửa không xoá

/class_stats/{classId}                  ◄── số liệu tổng hợp đã tính sẵn
/khoa_stats/{khoaId}
```

Ghi chú riêng của cố vấn nằm ở **bộ sưu tập con** `private/`. Trong Firestore, quy tắc của
bộ sưu tập con độc lập với tài liệu cha — sinh viên đọc được hồ sơ của mình nhưng vẫn không
chạm tới `private/`. Đúng yêu cầu trong tài liệu phân quyền.

### 3.1. Bốn vai trò

| Vai trò | Thấy gì | Sửa được gì |
|---|---|---|
| `owner` | Toàn trường | Mọi thứ, kể cả phân quyền |
| `khoaAdmin` | Toàn bộ Khoa mình | Duyệt và phân lớp cho cố vấn trong Khoa. **Không** nhập điểm thay cố vấn, **không** tạo ra owner, **không** chuyển người sang Khoa khác |
| `advisor` | Lớp mình phụ trách | Dữ liệu học vụ của lớp mình |
| `pending` | Không gì cả | Không gì cả — vừa đăng ký, đang chờ duyệt |

Vai trò `khoaAdmin` là thứ mới, phát sinh từ câu trả lời thứ 3. Với trăm cố vấn thì một
mình Thầy không thể ngồi phân lớp cho từng người; phải uỷ quyền xuống Khoa. Nếu Thầy không
muốn có vai trò này thì nói, tôi bỏ đi — nhưng lúc đó mọi việc phân quyền đổ hết về Thầy.

### 3.2. Vì sao phải có số liệu tổng hợp

Thống kê toàn trường mà quét qua hàng nghìn hồ sơ sinh viên thì vừa chậm vừa tốn. Nên mỗi
lớp giữ sẵn một tài liệu `class_stats` (sĩ số, phổ điểm, số em cảnh báo), cập nhật ngay lúc
nhập điểm. Thống kê Khoa cộng từ vài chục tài liệu đó, thống kê trường cộng từ vài chục
tài liệu Khoa. Đọc chục tài liệu thay vì mấy nghìn.

## 4. Quy tắc bảo mật

**Bộ quy tắc đầy đủ đã viết xong: `server/firestore.rules` (283 dòng).** Dưới đây là những
chỗ đáng chú ý nhất; phần còn lại xem thẳng trong tệp.

### 4.1. Sinh viên chỉ sửa được thông tin liên hệ

```
allow update: if ( canEditClass(resource.data.classId) && noNationalId()
                   && request.resource.data.mssv == resource.data.mssv )
           || ( isSelf(resource.data)
                && request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['phone','zalo','email','address','contactNote','updatedAt']) );
```

Dòng `hasOnly([...])` là điều bản Apps Script đang làm bằng mã, nay **chính cơ sở dữ liệu
ép buộc**. Sinh viên đụng vào GPA hay lớp là Firestore từ chối, không cần ứng dụng kiểm.

### 4.2. Ghi chú riêng của cố vấn

```
match /private/{docId} {
  allow read, write: if canEditClass(
    get(/databases/$(database)/documents/students/$(mssv)).data.classId
  );
}
```

Quy tắc bộ sưu tập con độc lập với tài liệu cha. Sinh viên đọc được hồ sơ của mình mà vẫn
không chạm tới phần này.

### 4.3. Chặn căn cước công dân ngay ở tầng cơ sở dữ liệu

```
function noNationalId() {
  return !request.resource.data.keys().hasAny(['cccd','soCccd','cmnd','canCuoc']);
}
```

Phần nhập Excel đã cố tình bỏ qua cột CCCD. Đây là lớp chặn thứ hai: dù về sau có lỗi lập
trình nào, nó cũng không vào được.

### 4.4. Nhật ký không ai sửa được

```
allow create: if signedIn()
  && request.resource.data.email == email()
  && request.resource.data.at == request.time;
allow update, delete: if false;
```

Chỉ ghi thêm. Không ai sửa, không ai xoá — kể cả người viết, kể cả `owner`. Dấu thời gian
bắt buộc là giờ máy chủ nên máy khách không khai man được. Mạnh hơn hẳn cách băm chuỗi phía
máy khách mà tài liệu phân quyền đang đề xuất, vì nó do máy chủ ép.

### 4.5. Không tự nâng quyền cho mình

```
allow update: if ( request.auth.uid == uid
                   && ...affectedKeys().hasOnly(['name','title','phone','office','updatedAt']) )
           || isOwner()
           || ( isKhoaAdmin(resource.data.khoaId)
                && request.resource.data.role != 'owner'
                && request.resource.data.khoaId == resource.data.khoaId );
```

Người dùng tự sửa được tên và số điện thoại của mình, nhưng `role` và `classIds` thì không.
Quản trị Khoa duyệt được người trong Khoa mình, nhưng không phong ai làm `owner` và không
kéo người từ Khoa khác sang.

### 4.6. Một hiểu nhầm cần tránh

Khối cuối tệp:

```
match /{document=**} {
  allow read, write: if false;
}
```

Khối này **không** thu hẹp những gì các khối trên đã mở. Firestore cộng dồn quyền chứ không
đè lên nhau — chỉ cần một quy tắc cho phép là cho phép. Nó chỉ đóng những đường chưa khối
nào nhắc tới. Bộ quy tắc hiện trên Firebase Console của Thầy có đúng hiểu nhầm này: khối
cuối ghi "Khóa toàn bộ các collection nhạy cảm còn lại" nhưng thực tế không khoá được gì
mà các khối trên đã mở.

## 5. Tài khoản sinh viên — đơn giản hẳn

Trường có cấp thư điện tử cho sinh viên, nên **toàn bộ phần phát mã liên kết trong bản
thiết kế đầu bỏ đi được.** Không phải phát mã, không phải giữ mật khẩu hộ ai, không phải
lo em nào quên.

**Đăng nhập bằng tài khoản thư điện tử của Trường.** Cả cố vấn lẫn sinh viên.

Cách nhận ra sinh viên:

1. Cố vấn tải danh sách lớp lên, trong đó **có cột thư điện tử của Trường cấp** cho từng em.
   Địa chỉ đó lưu vào trường `authEmail` trên hồ sơ.
2. Sinh viên mở ứng dụng, bấm đăng nhập bằng tài khoản Trường. Không đặt mật khẩu mới,
   không nhập mã gì.
3. Quy tắc đối chiếu địa chỉ đang đăng nhập với `authEmail` trên hồ sơ. Khớp thì em ấy
   thấy hồ sơ của mình, không khớp thì không thấy gì.

Chính dòng danh sách lớp là bằng chứng. Cố vấn đã xác nhận "em này tên này, thư này, lớp
này" khi tải lên rồi.

Cách này **không phụ thuộc Trường đặt địa chỉ thư theo kiểu nào** — dù là `2250001@mtu.edu.vn`
hay `nguyenvana.xd26@mtu.edu.vn` đều chạy. Quy tắc so sánh nguyên chuỗi chứ không cố đoán
MSSV từ địa chỉ.

Bảng `/links/{uid}` vẫn giữ, nhưng chỉ làm một việc: ghi nhớ "tài khoản này ứng với MSSV nào,
lớp nào", để lúc cần biết sinh viên thuộc lớp nào thì đọc một lượt thay vì hai. Tạo ra nó
cũng phải qua kiểm tra `authEmail`, và `allow update: if false` nên đã nối rồi thì không
chuyển sang em khác được.

Phía giảng viên, cố vấn tự đăng ký rồi vào trạng thái `pending`; `khoaAdmin` của Khoa hoặc
`owner` duyệt và gán lớp. Quy tắc chặn việc tự nâng quyền cho mình:

```
allow create: if request.auth.uid == uid
  && schoolEmail()
  && request.resource.data.role == 'pending'
  && request.resource.data.classIds.size() == 0;
```

## 6. Chạy khi không có mạng

Firestore có sẵn bộ nhớ đệm bền:

```js
initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
```

- Đọc: lấy từ máy, không cần mạng.
- Ghi: xếp hàng dưới máy, có mạng là tự đẩy lên.
- Mở lại ứng dụng khi đang mất mạng: vẫn đầy đủ dữ liệu.

Điện thoại và máy tính cùng một tài khoản thì cùng một `uid`, cùng nghe một luồng, nên tự
khớp nhau — không phải bấm đồng bộ, không phải xuất tệp mang qua.

Phần vỏ ứng dụng vẫn do `sw.js` nạp trước như hiện nay. **Bộ thư viện Firebase sẽ tải về đặt
trong `assets/vendor/`** chứ không gọi từ `gstatic.com`, để cài xong là chạy được cả khi
không mạng — đúng tinh thần bản hiện tại. (Tôi chưa đo được dung lượng thật vì máy đang
không ra được gstatic; ước chừng 500 KB, sẽ đo chính xác khi làm.)

---

## 7. Chi phí — chỗ này đổi nhiều nhất

Bản thiết kế đầu tính cho một cố vấn và kết luận gói Spark miễn phí dư sức. **Toàn trường
thì không còn đúng nữa.**

Gói Spark miễn phí: 50.000 lượt đọc/ngày, 20.000 lượt ghi/ngày, 1 GiB lưu trữ.

| Quy mô | Ước tính lượt đọc/ngày | Gói |
|---|---|---|
| Một mình Thầy, ~200 sinh viên | 2.000–5.000 | Spark, thoải mái |
| Khoa Xây dựng, ~8 cố vấn, ~800 sinh viên | 10.000–20.000 | Spark, vẫn trong ngưỡng |
| Toàn trường, ~100 cố vấn, vài nghìn sinh viên | 50.000–150.000 | **Phải lên Blaze** |

Đây là ước tính, chưa đo thật — sẽ biết chính xác sau khi chạy thử một Khoa. Nhưng hướng
thì rõ: **đến quy mô toàn trường là phải lên gói Blaze trả theo mức dùng.**

Hai điều Thầy cần biết trước:

1. **Blaze vẫn giữ nguyên hạn mức miễn phí hằng ngày**, chỉ tính tiền phần vượt, với đơn
   giá tính trên mỗi trăm nghìn lượt. Ở quy mô này nhiều khả năng chỉ vài đô la một tháng.
   Tôi **không nêu con số cụ thể vì chưa tra lại bảng giá hiện hành** — sẽ tra và báo Thầy
   trước khi cần quyết.
2. **Blaze bắt buộc gắn thẻ thanh toán.** Đây là việc của Trường chứ không phải việc kỹ
   thuật: ai đứng tên, ai trả, duyệt thế nào. Nên biết sớm để xin chủ trương.

Vì vậy tôi đề nghị **triển khai theo bậc**: làm xong, chạy thử trong Khoa Xây dựng trên gói
Spark miễn phí. Có số liệu dùng thật rồi mới trình Trường xin mở rộng — lúc đó có con số
cụ thể để thuyết minh, thay vì xin trước mà chưa chứng minh được gì.

### 7.1. Dùng lại dự án `cvht-mtu` — hai việc phải làm trước

Thầy chọn dùng lại dự án cũ. Được, nhưng dự án đó đã từng mở cho cả Internet, nên trước khi
đưa dữ liệu thật vào:

1. **Dán bộ quy tắc mới và Publish.** Tệp `server/firestore.rules` đã viết xong.
2. **Dọn sạch dữ liệu cũ.** Những gì đang nằm trong `students`, `consultations`,
   `attendances` của bản AI Studio là dữ liệu đã từng ai cũng đọc được, lại không có
   `authEmail` hay `khoaId` nên không khớp mô hình mới. Xuất ra giữ làm bản lưu, rồi xoá
   khỏi Firestore và nạp lại từ đầu theo mô hình mới.

Nếu Thầy muốn chắc chắn hơn nữa thì vẫn nên mở dự án mới — nhưng dùng lại mà dọn sạch thì
cũng chấp nhận được.

## 8. Cái mất

Nói thẳng, không giấu:

| Mất gì | Mức độ |
|---|---|
| Không còn chạy được bằng cách mở thẳng tệp `file://` | Đáng kể với người thử, không đáng kể khi dùng thật |
| **Phải đăng nhập, và lần đầu phải có mạng** | Không thương lượng được. Dữ liệu 42 con người thì bắt buộc phải có tài khoản |
| Tải về nặng thêm ~500 KB lần đầu | Chấp nhận được, sau đó nằm trong bộ nhớ đệm |
| Phụ thuộc Google | Đổi lại được đồng bộ tức thời và quy tắc do máy chủ ép. Dữ liệu vẫn xuất ra JSON/Excel bất cứ lúc nào |

Thứ **không** mất: toàn bộ phần in ấn, báo cáo, Excel, biểu đồ, logic học vụ — chúng không
biết dữ liệu từ đâu tới.

---

## 9. Khối lượng

Phạm vi toàn trường làm tăng thêm ba phần: cấp Khoa và vai trò `khoaAdmin`, số liệu tổng
hợp, và màn hình duyệt cố vấn.

| Phần | Giờ |
|---|---|
| Mô hình dữ liệu + quy tắc + thử vượt quyền bằng Rules Playground | 8–10 |
| `store.js` — bản sao trong RAM trên nền Firestore, giữ nguyên bộ hàm | 10–12 |
| `view-auth.js` — đăng nhập bằng tài khoản Trường, hai phía | 6–8 |
| Màn hình quản trị: duyệt cố vấn, phân lớp, phân Khoa | 6–8 |
| Số liệu tổng hợp cấp lớp và cấp Khoa | 5–6 |
| Nhật ký hoạt động | 3–4 |
| Tự chứa thư viện Firebase + nạp trước trong `sw.js` | 3–4 |
| Công cụ chuyển dữ liệu đang có dưới máy lên Firestore | 3–4 |
| Kiểm thử: hai máy, mất mạng, thử vượt quyền giữa các Khoa | 8–10 |
| **Cộng** | **52–66** |

So với bản thiết kế đầu (44–56 giờ) thì tăng khoảng 8–10 giờ. Phần tăng nằm ở quản trị
nhiều người và cách ly giữa các Khoa, không phải ở phần đồng bộ.

Đăng nhập bằng tài khoản Trường **giảm được** 2–3 giờ so với bản đầu, vì bỏ hẳn phần phát
mã liên kết và quản lý mật khẩu.

Phần chép từ bản AI Studio (in A4, xuất Word, ba mẫu phiếu — 9–12 giờ) **độc lập hoàn toàn**
với việc này, vì chúng đọc qua `CV.store` mà bộ hàm đó không đổi. Làm trước hay sau đều được,
không phải làm lại.

## 10. Thứ tự đề nghị

| Bước | Việc | Giờ |
|---|---|---|
| 0 | Thầy khoá quy tắc Firestore hiện tại | 5 phút |
| 1 | Mô hình dữ liệu + quy tắc, thử vượt quyền bằng Rules Playground | 6–8 |
| 2 | Thay ruột `store.js`, giữ nguyên bộ hàm | 10–12 |
| 3 | Đăng nhập cố vấn — **đến đây là điện thoại và máy tính đã khớp nhau** | 8–10 |
| 4 | Nối tài khoản sinh viên + màn hình phát mã | 5–6 |
| 5 | Chuyển dữ liệu đang có lên, nhật ký, tự chứa thư viện | 6–8 |
| 6 | Kiểm thử hai máy và thử vượt quyền | 6–8 |
| 7 | In A4 + xuất Word NĐ 30 (chép từ bản AI Studio) | 9–12 |

Xong **bước 3** là trả lời được đúng câu Thầy hỏi: một cố vấn, hai máy, luôn khớp. Xong
**bước 4** là phía sinh viên thông luôn.

---

## 11. Cần Thầy cho biết — vòng hai

Ba câu trước đã trả lời xong. Phát sinh thêm bốn câu từ phạm vi toàn trường:

1. **Thư điện tử của Trường chạy trên nền nào — Google Workspace hay Microsoft 365?**
   Firebase hỗ trợ cả hai, nhưng màn hình đăng nhập viết khác nhau. Đây là thứ duy nhất
   đang chặn bước 3; các bước khác không phụ thuộc. Thầy xem trong hộp thư: đăng nhập ở
   `accounts.google.com` thì là Google, ở `login.microsoftonline.com` thì là Microsoft.

2. **Có chấp nhận vai trò `khoaAdmin` không?** Với trăm cố vấn thì một mình Thầy không ngồi
   phân lớp cho từng người được. Không muốn uỷ quyền thì bỏ, nhưng lúc đó mọi việc phân
   quyền đổ hết về Thầy.

3. **Danh sách lớp Trường xuất ra có cột thư điện tử sinh viên không?** Có thì nhập một lần
   là xong. Không thì phải ghép từ nguồn khác, và tôi cần xem thử một tệp mẫu.

4. **Triển khai theo bậc có được không?** Tôi đề nghị: làm xong → chạy thử Khoa Xây dựng
   trên gói Spark miễn phí → có số liệu dùng thật → trình Trường xin mở rộng và xin gắn
   thanh toán Blaze. Xin trước mà chưa chứng minh được gì thì khó thuyết phục hơn.

## 12. Nghĩa vụ về dữ liệu cá nhân ở quy mô trường

Khi còn là công cụ riêng của một cố vấn thì đây là chuyện nội bộ. Mở ra toàn trường, giữ
hồ sơ vài nghìn sinh viên, thì **Trường trở thành bên kiểm soát dữ liệu cá nhân** theo Nghị
định 13/2023/NĐ-CP, kèm theo một số nghĩa vụ: có thông báo xử lý dữ liệu, có căn cứ pháp lý,
có thời hạn lưu trữ, có người chịu trách nhiệm, và có quy trình khi xảy ra sự cố.

Đây là việc của Trường chứ không phải việc lập trình, nên tôi chỉ nêu ra để Thầy đưa vào tờ
trình ngay từ đầu — xin chủ trương một lần gọn hơn là làm xong rồi mới phát hiện thiếu.
Phần kỹ thuật thì bộ quy tắc và nhật ký hoạt động đã đáp ứng sẵn những gì thuộc về kỹ thuật.
