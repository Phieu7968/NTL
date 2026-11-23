# Cấu trúc bài khoa học và checklist nội dung

Script kiểm tra có hay không có đề mục. Tài liệu này dùng khi **đọc trực tiếp** để kiểm tra mỗi phần có
đủ ý không. Quy định của trường hoặc tạp chí luôn được ưu tiên.

## Khóa luận / luận văn / đồ án (`--loai khoa-luan`)

**Phần đầu:** trang bìa → trang phụ bìa → lời cam đoan → lời cảm ơn → mục lục → danh mục chữ viết tắt →
danh mục bảng → danh mục hình.

**Mở đầu** (thường 4–8 trang) phải trả lời đủ:
- [ ] Tính cấp thiết: vấn đề gì, vì sao bây giờ, khoảng trống nghiên cứu nào (có dẫn nguồn).
- [ ] Mục tiêu chung và mục tiêu cụ thể (đo được, mỗi mục tiêu ứng với một chương hoặc kết quả).
- [ ] Câu hỏi nghiên cứu / giả thuyết (nếu là nghiên cứu định lượng).
- [ ] Đối tượng nghiên cứu (nghiên cứu cái gì) và khách thể/đối tượng khảo sát (khảo sát ai).
- [ ] Phạm vi: nội dung, không gian, thời gian (số liệu năm nào).
- [ ] Phương pháp: thu thập dữ liệu (mẫu, cỡ mẫu, công cụ) và phân tích (phần mềm, kỹ thuật).
- [ ] Ý nghĩa khoa học và thực tiễn.
- [ ] Bố cục các chương.

**Chương tổng quan / cơ sở lý thuyết:** khái niệm có nguồn; các lý thuyết nền; tổng quan nghiên cứu trong
và ngoài nước **có nhận xét khoảng trống**, không chỉ liệt kê; mô hình/khung nghiên cứu đề xuất.

**Chương phương pháp** (nếu tách riêng): quy trình nghiên cứu; thiết kế bảng hỏi và thang đo (nguồn gốc
thang đo); chọn mẫu; cách xử lý dữ liệu. Mô tả phải đủ để người khác làm lại được.

**Chương kết quả / thực trạng:** trình bày theo đúng thứ tự mục tiêu; mỗi bảng/hình có số, tên, nguồn và
được nhắc trong văn bản; diễn giải số liệu, không chỉ chép lại bảng.

**Thảo luận / giải pháp:** so sánh với các nghiên cứu trước đã nêu ở tổng quan; giải pháp xuất phát từ kết quả.

**Kết luận và kiến nghị:** trả lời từng mục tiêu hoặc câu hỏi nghiên cứu; nêu hạn chế; hướng nghiên cứu tiếp.
**Không đưa số liệu hoặc trích dẫn mới** vào phần kết luận.

**TLTK → Phụ lục** (bảng hỏi, kết quả chạy phần mềm, ...).

## Bài báo khoa học IMRaD (`--loai bai-bao`)

- [ ] Tên bài: ngắn, nêu được đối tượng và bối cảnh.
- [ ] Tóm tắt 150–250 từ (tuỳ tạp chí): mục đích → phương pháp → kết quả chính (có số) → kết luận. Không có trích dẫn.
- [ ] 3–6 từ khóa, không trùng nguyên tên bài.
- [ ] Giới thiệu: bối cảnh → khoảng trống → mục tiêu/câu hỏi → đóng góp.
- [ ] Phương pháp: dữ liệu, mẫu, công cụ, phân tích, đạo đức nghiên cứu (nếu có người tham gia).
- [ ] Kết quả: bảng/hình đánh số và được nhắc trong bài.
- [ ] Thảo luận: giải thích, so sánh với nghiên cứu trước, hạn chế.
- [ ] Kết luận ngắn gọn, không lặp lại tóm tắt.
- [ ] Tài liệu tham khảo đúng mẫu của tạp chí; ưu tiên nguồn 5 năm gần đây.

## Báo cáo thực tập (`--loai bao-cao-thuc-tap`)

Lời cảm ơn · nhận xét của đơn vị (có chữ ký) · mục lục · giới thiệu đơn vị (lịch sử, cơ cấu, lĩnh vực) ·
nội dung công việc được giao (theo tuần) · kết quả, kiến thức áp dụng, bài học · đề xuất cho đơn vị/nhà
trường · kết luận · phụ lục (nhật ký, minh chứng).

## Tiểu luận (`--loai tieu-luan`) và đề cương (`--loai de-cuong`)

Tiểu luận: mở đầu (lý do, mục tiêu, phạm vi) → nội dung (các chương/phần) → kết luận → TLTK.
Đề cương: tên đề tài, tính cấp thiết, tổng quan, mục tiêu, đối tượng – phạm vi, phương pháp, dự kiến kết
cấu, kế hoạch – tiến độ, TLTK.

## Trình bày (thường gặp ở quy định các trường — đối chiếu quy định cụ thể)

Khổ A4; Times New Roman 13–14; giãn dòng 1,3–1,5; lề trái 3–3,5 cm, phải 2 cm, trên/dưới 2–2,5 cm;
đánh số trang ở giữa phía dưới; đề mục tối đa 4 cấp (1.1.1.1); tên bảng đặt **trên** bảng, tên hình đặt
**dưới** hình, kèm nguồn; số thập phân dùng dấu phẩy trong văn bản tiếng Việt (85,3%).
Script không đọc phông chữ hay lề. Nếu cần, mở .docx bằng python-docx để kiểm tra.

## Cấu trúc theo quy định riêng

Tạo tệp JSON rồi chạy với `--cau-truc-rieng quy-dinh.json`:

```json
{
  "ten": "Khóa luận — quy định Trường X",
  "muc": [
    {"ten": "Lời cam đoan", "mau": ["lời cam đoan"], "bat_buoc": true},
    {"ten": "Tóm tắt khóa luận", "mau": ["^tóm tắt"], "bat_buoc": true, "cho_phep_trong_dong": true},
    {"ten": "Chương 1", "mau": ["^chương\\s+1\\b"], "bat_buoc": true}
  ]
}
```

`mau` là danh sách biểu thức chính quy (không phân biệt hoa thường), được dò trên các đề mục. Các mục bắt
buộc phải xuất hiện đúng thứ tự trong danh sách.
