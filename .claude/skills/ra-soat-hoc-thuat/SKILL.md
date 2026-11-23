---
name: ra-soat-hoc-thuat
description: Rà soát bài học thuật (khóa luận, luận văn, đồ án, báo cáo thực tập, tiểu luận, bài báo, đề cương) trước khi nộp — kiểm tra cấu trúc bắt buộc, đánh số chương/mục/bảng/hình, trích dẫn và danh mục tài liệu tham khảo theo APA 7 hoặc IEEE (số trích dẫn tăng dần, khớp danh mục, xếp ABC), lỗi chính tả và trình bày tiếng Việt, ước tính trùng lặp so với nguồn, đọc giúp báo cáo Turnitin và hướng dẫn sửa trùng lặp bằng trích dẫn đúng cách. Dùng khi người dùng nói "check đạo văn", "kiểm tra trùng lặp", "rà soát khóa luận", "kiểm tra trích dẫn APA/IEEE", "soát lỗi chính tả bài nghiên cứu", "kiểm tra cấu trúc bài khoa học", "đọc báo cáo Turnitin", hoặc gửi tệp .docx/.pdf bài học thuật cần soát.
---

# Rà soát bài học thuật

Skill này giúp bài nghiên cứu **đúng chuẩn và trung thực trước khi nộp**: đủ cấu trúc, trích dẫn đúng kiểu,
không lỗi chính tả, phần trùng lặp được ghi nguồn đúng cách. Kết quả trả cho khách là một báo cáo rà soát
và danh sách đề xuất sửa.

## Giới hạn bắt buộc phải giữ

- **Không có quyền truy cập Turnitin.** Tỷ lệ trùng do skill tính là *ước tính* so với nguồn được cung cấp
  hoặc tìm thấy trên web, không phải điểm Turnitin. Mọi báo cáo phải ghi rõ điều này.
- **Không viết lại văn bản để qua mặt công cụ phát hiện AI hoặc Turnitin.** Không xào câu, thay từ đồng
  nghĩa hàng loạt, chèn ký tự ẩn, đổi bảng mã, dịch đi dịch lại, hay "humanize" bài do AI viết để nộp như
  bài tự làm. Nếu khách yêu cầu việc này, từ chối ngắn gọn và đề xuất cách sửa trung thực ở mục 4.
- **Không viết hộ nội dung** để khách nộp như bài của mình. Được phép: chỉ ra chỗ thiếu, giải thích quy
  định, gợi ý cách diễn đạt cho câu đã có, sửa chính tả, định dạng trích dẫn.
- **Giữ nguyên số liệu, thuật ngữ, ý của tác giả** trong mọi đề xuất sửa.
- **Bảo mật tài liệu:** không gửi toàn văn bài của khách lên dịch vụ ngoài. Khi tìm trên web chỉ dùng từng
  câu ngắn, không kèm tên người, tên trường.

## Quy trình

Script: `scripts/2026-11-23-ra-soat.py` (chỉ cần Python 3, đọc được .docx, .pdf, .txt, .md).
Gọi bằng đường dẫn tuyệt đối tới thư mục skill, ví dụ `python3 <skill>/scripts/2026-11-23-ra-soat.py ...`.
Tệp .doc/.odt hãy chuyển trước: `soffice --headless --convert-to docx <tệp>`.

### Bước 0 — Hỏi ba điều (nếu khách chưa nói)

1. Loại bài: `khoa-luan` · `bai-bao` · `bao-cao-thuc-tap` · `tieu-luan` · `de-cuong`.
2. Kiểu trích dẫn trường/tạp chí yêu cầu: APA hay IEEE (không biết thì để script tự nhận diện).
3. Có văn bản quy định trình bày của trường hoặc mẫu của tạp chí không. **Quy định của trường luôn ưu
   tiên hơn mặc định của skill.** Nếu có, tạo tệp JSON cấu trúc riêng (xem
   `references/2026-11-23-cau-truc-bai-khoa-hoc.md`, mục "Cấu trúc theo quy định riêng") rồi truyền vào
   `--cau-truc-rieng`.

### Bước 1 — Chạy rà soát tự động

```bash
python3 <skill>/scripts/2026-11-23-ra-soat.py tat-ca bai.docx --loai khoa-luan --ra <thư mục kết quả>
```

Lệnh này ghi `YYYY-MM-DD-bao-cao-ra-soat-<tên-tệp>.md` gồm: bảng cấu trúc, đánh số chương/mục/bảng/hình,
trích dẫn & TLTK, chính tả & trình bày. Có thể chạy riêng từng phần: `cau-truc`, `trich-dan`, `chinh-ta`.

Tuỳ chọn hay dùng:
- `--kieu apa|ieee` ép kiểu trích dẫn.
- `--xep-ten-viet ten|ho` (APA): xếp tác giả Việt theo **tên** (mặc định, theo quy định trình bày luận văn
  phổ biến) hay theo họ.

Script chỉ đưa ra **cảnh báo**. Trước khi đưa vào báo cáo cho khách, mở đúng đoạn được nêu để xác nhận và
loại các cảnh báo sai.

### Bước 2 — Đọc trực tiếp những gì script không làm được

```bash
python3 <skill>/scripts/2026-11-23-ra-soat.py trich-xuat bai.docx > bai.txt
```

Mỗi dòng có dạng `[số đoạn|loại|style]`, trong đó H = đề mục, P = thân bài, R = tài liệu tham khảo,
A = phụ lục, T = trong bảng. Đọc toàn bài và rà:

- **Chính tả theo ngữ cảnh:** hỏi/ngã, s/x, ch/tr, d/gi/r, l/n, -n/-ng, -c/-t, từ dùng sai nghĩa
  (giả thiết/giả thuyết, …). Xem `references/2026-11-23-loi-chinh-ta-thuong-gap.md`.
- **Nội dung từng phần có đủ ý** theo checklist trong `references/2026-11-23-cau-truc-bai-khoa-hoc.md`.
- **Tính nhất quán:** mục tiêu ↔ phương pháp ↔ kết quả ↔ kết luận; số liệu nhắc lại ở nhiều chỗ phải khớp;
  chữ viết tắt được giải thích ở lần đầu.
- **Danh mục TLTK:** in nghiêng/ngoặc kép, đủ thành phần theo từng loại tài liệu. Xem
  `references/2026-11-23-quy-tac-trich-dan-apa-ieee.md`.

### Bước 3 — Trùng lặp

Có ba cách, dùng cách nào tuỳ tài liệu khách có:

1. **Có tệp nguồn** (tài liệu khách đã tham khảo, bài cũ, bài của bạn cùng nhóm):
   ```bash
   python3 <skill>/scripts/2026-11-23-ra-soat.py trung-lap bai.docx --nguon nguon1.pdf nguon2.docx
   ```
   Lệnh cho ra tỷ lệ từ trùng (n-gram 5 từ). Mặc định đã loại phần trong ngoặc kép và danh mục TLTK.
   Kèm theo là danh sách câu trùng và nguồn khớp.
2. **Tìm trên web:** chạy `cau-dac-trung` (mặc định 15 câu, rải đều trong bài, không có trích dẫn). Tìm
   từng câu bằng WebSearch trong ngoặc kép. Câu nào khớp nguyên văn với nguồn mà bài không ghi nguồn thì
   ghi vào báo cáo kèm URL. Phạm vi tìm như vậy rất nhỏ so với Turnitin, phải nói rõ trong báo cáo.
3. **Khách đã có báo cáo Turnitin (PDF):** đọc báo cáo, đối chiếu từng nguồn khớp với bài:
   - trùng ở phần trích nguyên văn có ngoặc kép và ghi nguồn → hợp lệ;
   - trùng ở danh mục TLTK, tên cơ quan, thuật ngữ, công thức, mẫu khảo sát → thường được loại khi chấm
     (Exclude bibliography / quotes / small matches), gợi ý khách hỏi giảng viên về cài đặt;
   - trùng ở đoạn diễn đạt **không ghi nguồn** → đây là phần phải sửa;
   - trùng 100% với bài nộp trước đó của chính khách ("Submitted to …") → khả năng bài đã nộp vào kho
     Turnitin; khách cần báo giảng viên, không phải sửa chữ.

### Bước 4 — Đề xuất sửa (trung thực)

Với mỗi đoạn trùng không ghi nguồn, chọn một trong các cách:

- **Thêm trích dẫn** đúng kiểu đang dùng, đồng thời bổ sung mục vào danh mục TLTK.
- **Trích nguyên văn**: đặt trong ngoặc kép, ghi kèm nguồn và số trang. Chỉ nên dùng cho câu ngắn, quan trọng.
- **Tóm lược hoặc diễn giải bằng hiểu biết của tác giả**, vẫn phải ghi nguồn. Chỉ gợi ý hướng diễn giải để
  khách tự viết; không đảo từ máy móc.
- **Rút gọn**: bỏ đoạn sao chép dài không cần thiết, thay bằng một câu dẫn kèm nguồn.

Với AI: nếu khách nói bài **tự viết** nhưng bị máy báo AI, giải thích rằng công cụ phát hiện AI có thể báo
nhầm. Hướng dẫn khách giữ bằng chứng quá trình viết (lịch sử phiên bản Google Docs/Word, bản nháp, ghi
chú, dữ liệu gốc) để trao đổi với giảng viên. Không sửa văn để hạ điểm AI.

Trình bày đề xuất dạng bảng: `Vị trí (đoạn) | Hiện tại | Đề xuất | Lý do`.
Chỉ sửa trực tiếp vào tệp khi khách yêu cầu. Khi sửa thì ghi ra **bản sao mới** (giữ bản gốc), đặt tên
`YYYY-MM-DD-<tên>-da-sua.docx`, và chỉ sửa chính tả, dấu câu, định dạng trích dẫn, số thứ tự.

### Bước 5 — Bàn giao

Báo cáo cuối cho khách gồm:
1. Tóm tắt: số lỗi theo từng nhóm và 3–5 việc ưu tiên sửa.
2. Bảng cấu trúc (đủ / thiếu).
3. Trích dẫn & TLTK: lỗi, bảng đánh số lại (IEEE) hoặc danh sách trích dẫn không khớp (APA).
4. Chính tả & trình bày.
5. Trùng lặp: tỷ lệ ước tính, phạm vi đã so, các đoạn cần ghi nguồn.
6. Ghi chú giới hạn: không phải điểm Turnitin; quy định của trường là căn cứ cuối cùng.

Muốn xuất ra Word: `pandoc <bao-cao>.md -o <bao-cao>.docx`.

## Những gì script làm và không làm

| Kiểm tra | Script | Cần người đọc |
|---|---|---|
| Đủ đề mục bắt buộc, thứ tự đề mục | ✅ | nội dung trong mục có đủ ý không |
| Chương, mục 1.1/1.2, Bảng/Hình nối tiếp, có được nhắc trong bài | ✅ | |
| Tóm tắt (số từ), từ khóa (số lượng) — bài báo | ✅ | |
| IEEE: thứ tự xuất hiện lần đầu tăng dần, bảng đánh số lại, khớp danh mục, trùng mục | ✅ | |
| APA: trích dẫn ↔ danh mục, &/and, et al., xếp ABC, a/b cùng năm, DOI | ✅ | tên tác giả viết khác nhau giữa bài và danh mục |
| Định dạng in nghiêng / ngoặc kép trong TLTK | một phần | ✅ |
| Từ hay viết sai, lặp từ, dấu câu, khoảng trắng, NFD, bảng mã cũ, trộn kiểu bỏ dấu, i/y | ✅ | |
| Chính tả theo ngữ cảnh, dùng từ sai nghĩa, văn phong | | ✅ |
| Trùng lặp với tệp nguồn | ✅ | |
| Trùng lặp với Internet / kho Turnitin | câu mẫu + WebSearch | chỉ Turnitin thật mới có kho bài nộp |
