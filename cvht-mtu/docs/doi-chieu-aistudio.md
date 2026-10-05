# Đối chiếu bản AI Studio và bản hiện tại — những gì chép được

> Lập ngày 04/10/2026, sau khi mở thư mục `c_-v_n-h_c-t_p-sinh-vi_n-mtu_9.zip` (35 tệp, đã bỏ `cookies.txt`).
> Bản AI Studio: `index.html` 11.766 dòng · `public/app.js` 31.413 dòng · `public/firebase-sync.js` 2.160 dòng.
> Bản hiện tại: 16 tệp JS, `assets/css/app.css` 445 dòng, không thư viện ngoài.

---

## 1. Việc phải làm trước mọi việc khác

### 1.1. Quy tắc Firestore đang mở cho toàn bộ Internet

Tệp `firestore.rules` của bản AI Studio:

```
match /students/{studentId} {
  allow read: if true;
  allow write: if isValidId(studentId);
}
```

`allow read: if true` nghĩa là **bất kỳ ai trên Internet cũng đọc được toàn bộ bộ sưu tập
`students`** — họ tên, mã số sinh viên, điện thoại, GPA, điểm rèn luyện, cảnh báo học vụ.
`allow write: if isValidId(studentId)` nghĩa là **bất kỳ ai cũng sửa hoặc xoá được**; điều kiện
duy nhất là mã tài liệu phải là chuỗi dài 1–128 ký tự, tức là gần như không có điều kiện nào.
Bốn bộ sưu tập còn lại (`consultations`, `class_cadres`, `attendance_sessions`, `attendances`)
cũng y như vậy.

Mã dự án `cvht-mtu` nằm sẵn trong `public/firebase-sync.js` dòng 13–19, mà tệp này được gửi
xuống trình duyệt của mọi người dùng. Ai mở "Xem nguồn trang" cũng có mã dự án, và từ đó
đọc sạch dữ liệu bằng một đoạn mã khoảng hai mươi dòng. Khoá `apiKey` của Firebase không phải
bí mật và việc nó lộ là bình thường — vấn đề nằm hoàn toàn ở phần quy tắc.

Tôi **không** thử truy cập dự án thật để kiểm chứng, vì đó là dịch vụ đang chạy. Nhưng tệp
quy tắc tự nó đã đủ kết luận: nếu bản AI Studio đã từng được triển khai cùng tệp quy tắc này
và trong Firestore đã có dữ liệu sinh viên thật, thì phải xem như dữ liệu đó đã bị lộ.

Việc nên làm, theo thứ tự:

1. Vào Firebase Console → Firestore → Rules, đổi thành `allow read, write: if false;` rồi
   Publish. Thao tác này tức thì, không cần đụng vào mã nguồn.
2. Mở Firestore xem có dữ liệu sinh viên thật hay chỉ dữ liệu thử.
3. Nếu có dữ liệu thật: theo Nghị định 13/2023/NĐ-CP, đây là sự cố dữ liệu cá nhân và có
   nghĩa vụ thông báo. Thầy cần báo cho Trường trước khi làm gì tiếp.

Không có cách viết lại quy tắc nào khiến kiến trúc này an toàn, vì bản AI Studio **không có
đăng nhập**. Firestore chỉ phân quyền được khi biết người gọi là ai; ở đây không ai đăng nhập
nên Firestore không có gì để xét. Mã PIN trong ứng dụng chỉ ẩn/hiện phần giao diện — máy chủ
không hề biết đến nó. Đây là lý do bản hiện tại đặt phần kiểm tra quyền ở Apps Script phía
máy chủ, chứ không dựa vào việc ẩn nút.

### 1.2. Một điều tôi đoán sai, nay xin sửa lại

Trước đây, chỉ nhìn `bun.lock`, tôi nói khoá `GEMINI_API_KEY` bị Vite đưa ra trình duyệt.
**Sai.** Khoá được giữ ở `server.ts` dòng 20, trình duyệt gọi `/api/chat` (app.js dòng 28033)
và máy chủ mới gọi Gemini. Không có `import.meta.env` hay `VITE_` nào trong mã phía trình
duyệt — tôi đã kiểm tra lại. Phần này bên đó làm đúng.

---

## 2. Chép gần như nguyên xi

Những thứ này không phụ thuộc Tailwind hay thư viện ngoài, dán sang là chạy.

| # | Nội dung | Nguồn | Thời gian | Ghi chú |
|---|----------|-------|-----------|---------|
| 1 | **CSS in ấn A4** — `@page a4-portrait / a4-landscape / a4-decree30`, Times New Roman, lề 20/15/20/30mm, ẩn thanh điều hướng khi in | `index.html` 770–1677 (908 dòng) | 2–3 giờ | Phần giá trị nhất của cả bản kia. Lề `a4-decree30` (20/15/20/25mm) sai một chỗ: NĐ 30 Điều 9 yêu cầu lề trái 30–35mm, bên đó để 25mm. Chép sang thì sửa luôn. |
| 2 | **Xuất văn bản Word chuẩn NĐ 30** — `buildWordDocumentHtml`, `buildClassWordDocumentHtml`, `buildStudentDossierWordHtml` | `app.js` 19069–19560 | 3–4 giờ | Cách làm là xuất HTML kèm thuộc tính `mso-*` rồi đặt tên tệp `.doc`; Word mở ra đúng định dạng. **Không cần thư viện nào** — chỉ là chuỗi và `Blob`. Đây chính là mục "xuất .docx" mà tài liệu phân quyền đang ghi "Chưa có". |
| 3 | **Ba mẫu phiếu/biên bản** — Biên bản & phiếu điểm danh sinh hoạt học vụ · Phiếu theo dõi kết quả học tập & GPA cá nhân · Phiếu theo dõi hồ sơ học vụ & công tác CVHT | `app.js` quanh dòng 4044 / 16045 / 16736 | 4–5 giờ cả ba | Quốc hiệu, tiêu ngữ, khối chữ ký, "Nơi nhận" đã viết đúng thể thức. Phần chữ nghĩa chép được nguyên; phần lấy dữ liệu phải nối vào `CV.store` của bên này. |
| 4 | **Câu chữ và công thức học vụ** — ngưỡng GPA Giỏi ≥ 3,20 / Khá ≥ 2,50 / Trung bình ≥ 2,00 / Yếu, cách diễn đạt cảnh báo, cẩm nang 50 câu hỏi đáp | rải trong `app.js` | 2 giờ | Đối chiếu với `academic.js` bên này; chỗ nào lệch thì theo QĐ 183 của Trường (vẫn đang chờ Thầy gửi). |
| 5 | **Bảng màu MTU** — 9 bậc `--mtu-50 → --mtu-dark` (#eff6ff → #0a1a3f) | `index.html` 132–142 | 30 phút | Bên này đang dùng `--brand:#1a4d9e`. Chỉ cần đổi giá trị trong `:root`, còn lại tự theo. Nhưng xem mục 4.1 trước. |

**Cộng: 12–15 giờ.**

---

## 3. Chép ý rồi dựng lại

Những thứ này cần Tailwind, Font Awesome hoặc thư viện ngoài. Không dán thẳng được, nhưng ý
tưởng thì lấy được hết.

| # | Nội dung | Vướng ở đâu | Thời gian | Cách làm |
|---|----------|-------------|-----------|----------|
| 6 | **Toàn bộ bố cục màn hình** — 10.000 dòng thẻ HTML với 1.180 chỗ `class="..."` kiểu Tailwind | Bên này không có Tailwind. Thêm Tailwind vào thì mất khả năng chạy không mạng — điểm mạnh lớn nhất của bản hiện tại. | — | Không chép ồ ạt. Chọn từng khối đáng chép (mục 7–11), dựng lại bằng CSS sẵn có. |
| 7 | **Điểm danh bằng mã QR** — 39 hàm, có cả bảng theo dõi trực tiếp và phiếu điểm danh in ra | QR hiện được tạo bằng cách **gửi đường liên kết sang `api.qrserver.com` và `quickchart.io`** (app.js 4146–4157). Hai dịch vụ này không liên quan gì đến Trường mà lại nhận được liên kết có chứa mã lớp và mã số sinh viên. Và không có mạng thì không có QR. | 8–10 giờ | Viết bộ tạo QR bằng JS thuần (khoảng 200 dòng, QR phiên bản 1–10 mức sửa lỗi M là đủ), vẽ ra `<canvas>`. Chạy được cả khi không mạng, không gửi gì ra ngoài. |
| 8 | **Xếp lịch hẹn hàng loạt** — `runAutoBulkScheduleAlgorithm`, xếp theo thời khoá biểu, xuất Excel, sinh tin nhắn Zalo | Phần xuất Excel dùng `xlsx-js-style` | 6–8 giờ | Phần thuật toán xếp lịch là JS thuần, chép được. Phần Excel xem mục 10. |
| 9 | **Hộp thư tư vấn hai chiều** | Đang chạy trên Firestore với quy tắc mở toang (mục 1.1) | 5–6 giờ | Dựng lại trên Apps Script sẵn có, có kiểm quyền phía máy chủ: sinh viên chỉ đọc được thư của mình, CVHT chỉ đọc được lớp mình phụ trách. |
| 10 | **Excel có định dạng** — 81 chỗ dùng `XLSX`, có Times New Roman, trộn ô, viền, nền | `assets/js/xlsx.js` bên này chỉ có 2 kiểu cố định (thường và đậm), chưa trộn ô, chưa viền | 5–6 giờ | Mở rộng `xlsx.js`: thêm bảng kiểu vào `styles.xml` và phần `mergeCells`. Là mã của mình nên sửa được, không cần thư viện. |
| 11 | **Trợ lý hỏi đáp học vụ** | Cần máy chủ giữ khoá Gemini | 3–4 giờ | Phần cơ sở tri thức 50 câu hỏi đáp chạy không mạng thì chép được ngay (mục 4). Phần gọi Gemini thì phải có máy chủ — để sau. |

**Cộng: 27–34 giờ.**

---

## 4. Những chỗ không nên chép

### 4.1. Giao diện bên đó chỉ có chế độ sáng

`index.html` dòng 10 và 133: `color-scheme: light`, và CSS khoá màu bằng `!important` ở 20 chỗ
để "chống thiết bị tự đổi màu". Bản hiện tại có cả chế độ sáng và tối, tự theo cài đặt máy.
Chép nguyên bảng màu kèm `!important` sang là mất chế độ tối. Nên chỉ lấy **giá trị màu**,
đặt vào `:root` và viết lại bộ màu tối tương ứng.

### 4.2. Ba tệp manifest và hai service worker chồng nhau

- `public/manifest.json` và `public/manifest.webmanifest` cùng tồn tại, lại thêm `vite.config.ts`
  dòng 17 sinh ra manifest thứ ba khi build.
- `public/sw.js` được sao vào thư mục build, nhưng `VitePWA` cũng sinh ra `sw.js` ở đúng chỗ đó.
  Hai tệp đè nhau, không đoán được tệp nào thắng; mà `index.html` dòng 40 lại gọi thẳng `/sw.js`.
- Danh sách `STATIC_ASSETS` trong `public/sw.js` **không có** Tailwind, Font Awesome, phông chữ
  Google hay ba thư viện kia. Nghĩa là cài ứng dụng rồi tắt mạng thì ra trang HTML trơ không
  định dạng. Đây là "lỗi nhỏ" mà có lẽ Thầy đã gặp.

Bản hiện tại không có vấn đề này: `sw.js` nạp trước đủ 22 tệp, mà tất cả đều là tệp cục bộ.

### 4.3. Phần khung React không dùng đến

`src/App.tsx` chỉ có `return <div></div>`, `src/index.css` chỉ có một dòng `@import "tailwindcss";`.
Toàn bộ ứng dụng thật nằm trong `public/app.js` viết bằng JS thuần. Phần `react`, `react-dom`,
`lucide-react`, `motion`, `express`, `vite` trong `package.json` gần như chỉ để đó.
Riêng `recharts` thì `src/SemesterGpaTrend.tsx` (39.811 byte) có dùng thật — nhưng bên này đã có
`charts.js` vẽ bằng SVG thuần, không cần.

---

## 5. Thứ tự tôi đề nghị

Mỗi bước xong là chạy được và kiểm thử được ngay, không phải chờ bước sau.

| Bước | Việc | Thời gian | Vì sao đặt ở đây |
|------|------|-----------|------------------|
| 0 | Đóng quy tắc Firestore | 5 phút | Việc của Thầy, trên Firebase Console. Làm trước mọi thứ. |
| 1 | CSS in A4 + xuất Word NĐ 30 (mục 1, 2) | 5–7 giờ | Giá trị cao nhất, rủi ro thấp nhất, lại đúng chỗ tài liệu phân quyền đang ghi "Chưa có". |
| 2 | Ba mẫu phiếu/biên bản (mục 3) | 4–5 giờ | Dùng ngay được kết quả bước 1. |
| 3 | Bảng màu + câu chữ học vụ (mục 4, 5) | 2–3 giờ | Việc nhẹ, thấy khác ngay. |
| 4 | Mở rộng `xlsx.js` cho Excel có định dạng (mục 10) | 5–6 giờ | Phải xong trước bước 5. |
| 5 | Điểm danh QR viết bằng JS thuần (mục 7) | 8–10 giờ | Phần nặng nhất, nhưng xong là bản này hơn bản kia: chạy được khi không mạng và không gửi dữ liệu ra ngoài. |
| 6 | Xếp lịch hàng loạt (mục 8) | 6–8 giờ | Cần bước 4. |
| 7 | Hộp thư tư vấn qua Apps Script (mục 9) | 5–6 giờ | Cần quyết định về phân quyền ở tài liệu phân quyền. |

**Tổng: 35–45 giờ.** Riêng bước 1 và 2 (9–12 giờ) đã lấy được phần đáng giá nhất.

---

## 6. Điều cần Thầy quyết

1. Bắt đầu từ bước nào. Tôi đề nghị bước 1.
2. Thư mục `aistudio/` có cần đưa vào kho `Phieu7968/NTL` để làm bản đối chiếu không?
   **Kho này là kho công khai.** `firebase-applet-config.json` và `firebase-sync.js` chứa mã
   dự án Firebase; `index.html` chứa hai địa chỉ Cloud Run nội bộ. Tôi đề nghị **không** đưa
   lên — hiện tôi đang giữ ngoài kho, chỉ dùng để đối chiếu.
3. Trong Firestore của dự án `cvht-mtu` hiện có dữ liệu sinh viên thật hay chỉ dữ liệu thử?
   Câu trả lời quyết định có phải báo sự cố dữ liệu theo NĐ 13/2023 hay không.
