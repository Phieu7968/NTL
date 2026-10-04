# Thiết kế lại tầng dữ liệu — đồng bộ nhiều thiết bị, hai chiều, tức thời

> Lập ngày 04/10/2026. Trả lời yêu cầu: một cố vấn cài trên cả điện thoại lẫn máy tính,
> hai máy luôn khớp nhau; phía sinh viên cũng cập nhật nhanh.

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

```
/advisors/{uid}
    name, title, email, role: "owner" | "advisor", classIds: [...], active

/classes/{classId}
    code, name, majorId, advisorUid, gvcnUid, cohort, active

/students/{mssv}                        ◄── khoá là MSSV, không phải id nội bộ
    mssv, fullName, dob, gender, classId, authUid,
    phone, zalo, email, address, contactNote
    (KHÔNG có CCCD — xem mục 4.3)

/students/{mssv}/terms/{termId}         điểm từng học kỳ, GPA, tín chỉ
/students/{mssv}/private/{docId}        ◄── ghi chú riêng của CVHT, sinh viên KHÔNG đọc được

/classes/{classId}/meetings/{id}        sổ họp lớp
/classes/{classId}/attendance/{id}      điểm danh
/consultations/{id}                     hộp thư tư vấn hai chiều
/links/{uid}                            nối tài khoản ↔ MSSV
/audit/{id}                             nhật ký, chỉ ghi thêm, không sửa không xoá
```

Ghi chú riêng của cố vấn nằm ở **bộ sưu tập con** `private/`. Trong Firestore, quy tắc của
bộ sưu tập con độc lập với tài liệu cha — sinh viên đọc được hồ sơ của mình nhưng vẫn không
chạm tới `private/`. Đúng yêu cầu trong tài liệu phân quyền.

---

## 4. Quy tắc bảo mật

Đây là phần thay thế toàn bộ `allow read: if true`.

### 4.1. Hàm nền

```
function signedIn()      { return request.auth != null; }
function myMssv()        { return get(/databases/$(database)/documents/links/$(request.auth.uid)).data.mssv; }
function isAdvisor()     { return exists(/databases/$(database)/documents/advisors/$(request.auth.uid)); }
function advisorDoc()    { return get(/databases/$(database)/documents/advisors/$(request.auth.uid)).data; }
function isOwner()       { return isAdvisor() && advisorDoc().role == 'owner'; }
function teaches(classId){ return isAdvisor() && (isOwner() || classId in advisorDoc().classIds); }
```

### 4.2. Hồ sơ sinh viên

```
match /students/{mssv} {
  allow read:   if isOwner()
                || teaches(resource.data.classId)
                || (signedIn() && myMssv() == mssv);

  allow create, delete: if teaches(request.resource.data.classId);

  allow update: if teaches(resource.data.classId)
                || (signedIn() && myMssv() == mssv
                    && request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['phone','zalo','email','address','contactNote','updatedAt']));

  match /private/{doc} {
    allow read, write: if teaches(get(/databases/$(database)/documents/students/$(mssv)).data.classId);
  }
}
```

Dòng `hasOnly([...])` là điều bản Apps Script đang làm bằng mã, nay **chính cơ sở dữ liệu
ép buộc**. Sinh viên sửa được đúng 5 trường liên hệ; đụng vào GPA hay lớp là Firestore từ chối,
không cần ứng dụng kiểm.

### 4.3. Chặn CCCD ngay ở tầng cơ sở dữ liệu

```
allow create, update: if !request.resource.data.keys().hasAny(['cccd','soCccd','cmnd']);
```

Hiện nay phần nhập Excel nhận ra cột CCCD rồi cố tình bỏ qua. Thêm dòng này thì dù có lỗi
lập trình nào về sau, CCCD cũng không vào được cơ sở dữ liệu.

### 4.4. Nhật ký không sửa được

```
match /audit/{id} {
  allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
  allow read:   if isOwner();
  allow update, delete: if false;
}
```

Chỉ ghi thêm, không ai sửa, không ai xoá — kể cả người viết. Mạnh hơn hẳn cách băm chuỗi
phía máy khách mà tài liệu phân quyền đang đề xuất, vì nó do máy chủ ép.

---

## 5. Tài khoản sinh viên

Chỗ vướng thật sự: 42 sinh viên một lớp thì mở tài khoản kiểu gì.

**Cách chọn: sinh viên tự mở, bằng mã liên kết cố vấn phát.** Tận dụng luôn `linkToken` đã
có sẵn trong bản hiện tại.

1. Cố vấn đồng bộ lớp lên → mỗi sinh viên có một `linkToken` riêng.
2. Cố vấn phát mã cho từng em (in kèm danh sách, hoặc gửi Zalo riêng).
3. Sinh viên mở ứng dụng, nhập **MSSV + mã liên kết**, tự đặt mật khẩu.
4. Ứng dụng tạo tài khoản rồi ghi `/links/{uid} = { mssv }`. Quy tắc kiểm:

```
match /links/{uid} {
  allow create: if request.auth.uid == uid
    && get(/databases/$(database)/documents/students/$(request.resource.data.mssv)).data.linkToken
       == request.resource.data.token;
  allow read:   if request.auth.uid == uid;
  allow update, delete: if false;
}
```

Quy tắc đọc được `linkToken` dù sinh viên không đọc được trường đó — quy tắc chạy trên máy
chủ, không bị giới hạn bởi quyền đọc. Mã vẫn kín. `allow update: if false` nghĩa là một tài
khoản đã nối với MSSV nào thì vĩnh viễn thế, không đổi sang em khác được.

Thầy không phải giữ mật khẩu của ai. Em nào quên thì Thầy phát lại mã liên kết mới.

---

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

## 7. Chi phí

Gói Spark miễn phí: 50.000 lượt đọc/ngày, 20.000 lượt ghi/ngày, 1 GiB lưu trữ.

Một cố vấn với 200 sinh viên: mở ứng dụng 10 lần/ngày ≈ 2.000 lượt đọc, mà còn thấp hơn nữa
vì bộ nhớ đệm chỉ lấy phần thay đổi. Nhập điểm cả lớp một học kỳ ≈ 42 lượt ghi.

**Dư sức trong gói miễn phí.** Nếu sau này mở ra toàn trường 28 ngành thì phải lên gói Blaze
trả theo dùng — tôi nói trước để Thầy khỏi bất ngờ.

---

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

| Phần | Giờ |
|---|---|
| Mô hình dữ liệu + quy tắc + thử bằng Rules Playground | 6–8 |
| `store.js` — bản sao trong RAM trên nền Firestore, giữ nguyên bộ hàm | 10–12 |
| `view-auth.js` — đăng nhập cố vấn, luồng nối tài khoản sinh viên | 8–10 |
| Màn hình cố vấn phát mã liên kết, quản lý tài khoản lớp | 5–6 |
| Nhật ký hoạt động | 3–4 |
| Tự chứa thư viện Firebase + nạp trước trong `sw.js` | 3–4 |
| Công cụ chuyển dữ liệu đang có dưới máy lên Firestore | 3–4 |
| Kiểm thử: hai máy, mất mạng, thử vượt quyền | 6–8 |
| **Cộng** | **44–56** |

Phần chép từ bản AI Studio (in A4, xuất Word, ba mẫu phiếu — 9–12 giờ) **độc lập hoàn toàn**
với việc này, vì chúng đọc qua `CV.store` mà bộ hàm đó không đổi. Làm trước hay sau đều được,
không phải làm lại.

---

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

## 11. Cần Thầy cho biết

1. **Trường có cấp email cho sinh viên không?** Có thì dùng email thật, quên mật khẩu tự lấy
   lại được. Không thì tôi dùng `<MSSV>@sv.cvht-mtu.vn` làm tên đăng nhập — vẫn chạy, nhưng
   quên mật khẩu phải nhờ Thầy phát mã mới.
2. **Dùng lại dự án `cvht-mtu` hay mở dự án Firebase mới?** Tôi nghiêng về **mở mới**: dự án
   cũ đã từng mở cho cả Internet, mở mới thì sạch sẽ và không phải phân vân dữ liệu nào đã
   bị ai đọc. Dữ liệu trong dự án cũ xuất ra rồi nạp sang được.
3. **Phạm vi:** chỉ mình Thầy, hay còn cố vấn khác trong Khoa cùng dùng? Ảnh hưởng tới bước 1
   và tới việc có cần gói Blaze không.
