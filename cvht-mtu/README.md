# Cố vấn học tập MTU

Web app quản lý công tác cố vấn học tập sinh viên — Trường Đại học Xây dựng Miền Tây.
Cài được vào điện thoại và máy tính như một ứng dụng thật, chạy được cả khi mất mạng.

Viết bằng HTML/CSS/JavaScript thuần. **Không cần cài đặt, không cần biên dịch, không gọi
một thư viện nào từ Internet.** Mở `index.html` bằng trình duyệt là chạy.

---

## 1. Chạy thử trong 30 giây

Cách gọn nhất:

```bash
cd cvht-mtu
python3 -m http.server 8000
# mở http://localhost:8000
```

Mở thẳng tệp `index.html` bằng trình duyệt cũng chạy, chỉ khác là không cài được vào máy
(tính năng cài đặt đòi hỏi trang phải chạy qua `http://` hoặc `https://`).

Đưa lên mạng: chép nguyên thư mục `cvht-mtu/` lên GitHub Pages, Netlify, Vercel hoặc bất kỳ
máy chủ tĩnh nào. Không cần máy chủ ứng dụng, không cần cơ sở dữ liệu.

## 2. Cài vào máy

| Thiết bị | Cách làm |
|---|---|
| Android (Chrome) | Mở trang → menu ⋮ → **Thêm vào màn hình chính** |
| iPhone / iPad (Safari) | Nút Chia sẻ → **Thêm vào MH chính** |
| Windows / macOS (Chrome, Edge) | Bấm nút **Cài vào máy** trên thanh tiêu đề của app, hoặc biểu tượng cài đặt ở thanh địa chỉ |

Sau khi cài, app có biểu tượng riêng, mở toàn màn hình và **chạy bình thường khi không có
mạng** vì toàn bộ mã nguồn, phông chữ, biểu tượng và biểu đồ đều nằm sẵn trong máy.

Ứng dụng cũng có hai lối tắt: **Bàn làm việc Cố vấn** và **Cổng Sinh viên** (nhấn giữ biểu
tượng trên Android, chuột phải trên Windows).

## 3. Lần đầu mở

Ứng dụng **không cài sẵn tài khoản nào**. Màn hình đầu tiên yêu cầu tạo tài khoản giảng
viên cố vấn: tên trường, khoa, họ tên, email đăng nhập, mật khẩu. Tài khoản này mang vai
trò quản trị — thấy mọi lớp và thêm được các cố vấn khác.

Trình tự dựng dữ liệu:

1. **Lớp cố vấn** → tạo lớp (mã lớp, tên, ngành).
2. **Sinh viên** → thêm từng em, hoặc **Nhập CSV** cả danh sách.
3. **Nhập điểm** → tạo học kỳ, rồi nhập điểm cả lớp theo từng học phần.
4. **Sinh viên → Cấp PIN** → phát mã PIN 6 chữ số cho từng em để các em tự xem hồ sơ.

Muốn xem thử giao diện trước khi nhập dữ liệu thật: **Cài đặt → Nạp dữ liệu minh hoạ**
(một lớp 12 sinh viên, tên và số điện thoại rõ ràng là giả, xoá được bất cứ lúc nào).
Ứng dụng không bao giờ tự sinh dữ liệu ảo mà không hỏi.

## 4. Chức năng

**Giảng viên cố vấn**

- Bàn làm việc: sĩ số, GPA trung bình, số em đang cảnh báo, tổng tín chỉ nợ; biểu đồ phân
  bố học lực và cơ cấu cảnh báo; danh sách em cần gặp sớm xếp theo mức ưu tiên; lịch hẹn sắp tới.
- Lớp cố vấn: thêm, sửa, xoá; khai riêng Cố vấn học tập và Giáo viên chủ nhiệm; xem sĩ số,
  giờ quy đổi và GPA trung bình từng lớp.
- Sinh viên: tìm kiếm không dấu, lọc theo lớp / diện cảnh báo / còn nợ / chưa có điểm /
  cán bộ lớp; thêm sửa xoá; nhập và xuất CSV.
- Hồ sơ từng em: thông tin cá nhân, lý do cảnh báo ghi rõ con số, biểu đồ GPA theo học kỳ,
  bảng điểm có đánh dấu lần học nào được tính GPA, điểm rèn luyện, nhật ký cố vấn, lịch hẹn, in hồ sơ.
- Nhập điểm: quản lý học kỳ; nhập điểm cả lớp theo học phần, gõ tới đâu quy đổi điểm chữ
  tới đó, Enter nhảy xuống ô kế tiếp; nhập điểm hàng loạt từ CSV.
- Kết quả học kỳ: nhận thẳng tệp **Kết quả học tập** `.xlsx` của Phòng Đào tạo, đối chiếu
  diện cảnh báo học vụ và **xuất ra bảng Cảnh cáo học vụ đúng mẫu 14 cột** của Trường.
- Đăng ký học phần: theo dõi số tín chỉ từng em đã đăng ký, xác nhận từng em hoặc hàng loạt,
  yêu cầu em điều chỉnh, đếm ngược tới hạn gửi Phòng Quản lý Đào tạo, in danh sách để nộp.
- Lịch tư vấn: sinh viên gửi yêu cầu, cố vấn duyệt; số việc chờ hiện ngay trên menu.
- Sổ họp lớp: ghi nhận từng buổi sinh hoạt kèm biên bản, đối chiếu với mức tối thiểu
  4 buổi mỗi học kỳ và tính sẵn điểm tiêu chí tương ứng.
- Đánh giá công tác: tự chấm 6 tiêu chí 100 điểm, ra xếp loại, phần trăm được hưởng và
  số giờ quy đổi theo sĩ số từng lớp; in được thành phiếu.
- Báo cáo: bảng chỉ tiêu theo lớp hoặc toàn bộ, danh sách sinh viên cần lưu ý kèm lý do,
  xuất CSV hoặc in ra PDF. Báo cáo luôn in kèm thang điểm và quy tắc cảnh báo đang áp dụng.
- Cài đặt: thông tin đơn vị, thang điểm, ngưỡng cảnh báo, quy tắc học lại, cách sinh viên
  đăng nhập, quản lý tài khoản cố vấn, sao lưu và phục hồi dữ liệu.

**Sinh viên**

- Tổng quan: GPA tích luỹ, tín chỉ tích luỹ, tín chỉ nợ, điểm rèn luyện, tình trạng học vụ
  nói rõ bằng chữ, danh sách học phần chưa đạt, liên hệ của cả Cố vấn học tập lẫn Giáo viên
  chủ nhiệm.
- Bảng điểm: xem theo từng học kỳ kèm GPA học kỳ, in được.
- Lịch tư vấn: xin gặp cố vấn, theo dõi trạng thái, tự huỷ.
- Hồ sơ: tự sửa số điện thoại, email, địa chỉ; tự đổi mã PIN.

**Chung:** giao diện sáng / tối / theo hệ thống; thẻ 3D nghiêng theo con trỏ trên máy tính;
chạy tốt trên điện thoại với thanh điều hướng dưới đáy; tôn trọng thiết lập *giảm chuyển động*
của hệ điều hành.

## 5. Logic học vụ — những con số được tính thế nào

Toàn bộ nằm trong `assets/js/academic.js`, là **nơi duy nhất** định nghĩa thang điểm và
cách tính. Máy tính GPA, bảng điểm, báo cáo và cổng sinh viên đều gọi vào đây nên không thể
lệch nhau.

**Thang điểm mặc định** theo Quy chế đào tạo trình độ đại học (Thông tư 08/2021/TT-BGDĐT):

| Điểm chữ | Điểm hệ 10 | Hệ 4 |
|---|---|---|
| A | từ 8,5 | 4,0 |
| B+ | 8,0 đến dưới 8,5 | 3,5 |
| B | 7,0 đến dưới 8,0 | 3,0 |
| C+ | 6,5 đến dưới 7,0 | 2,5 |
| C | 5,5 đến dưới 6,5 | 2,0 |
| D+ | 5,0 đến dưới 5,5 | 1,5 |
| D | 4,0 đến dưới 5,0 | 1,0 |
| F | dưới 4,0 | 0,0 |

> **Sửa được trong Cài đặt.** Trước khi phát hành, hãy đối chiếu với quy chế đào tạo của
> Trường; nếu khác, sửa ngay trong mục Cài đặt → Thang điểm chữ, mọi GPA tính lại tức thì.

**GPA:** trung bình có trọng số theo số tín chỉ. Học phần bị điểm F vẫn nằm trong mẫu số.

**Học lại:** mỗi học phần chỉ tính một lần. Mặc định lấy điểm cao nhất, đổi được sang "lấy
điểm lần gần nhất" trong Cài đặt. Bảng điểm đánh dấu rõ lần học nào đang được tính.

### Hai nguồn số liệu

Ứng dụng nhận số liệu từ hai đường, và nói rõ đang dùng đường nào:

1. **Kết quả học kỳ** — bảng Phòng Đào tạo gửi sau mỗi học kỳ, có sẵn điểm trung bình chung
   học kỳ, điểm tích luỹ, số tín chỉ và xếp loại. Đây là **số liệu gốc**, ưu tiên hơn.
2. **Điểm từng học phần** — cố vấn tự nhập, để theo dõi chi tiết và tư vấn học lại.

Khi đã có kết quả học kỳ, mọi việc xét cảnh báo học vụ đều dựa vào nó. Chưa có thì ứng dụng
tạm tính từ điểm học phần và ghi rõ là số tạm tính.

**Tín chỉ tích luỹ:** tổng tín chỉ của các học phần đã đạt.
**Tín chỉ nợ:** tổng tín chỉ của các học phần mà lần học được tính vẫn chưa đạt.

**Cảnh báo học vụ** — khi đã có kết quả học kỳ, ứng dụng xét đúng như cách Trường làm trong
bảng *Cảnh cáo học vụ*:

| Tình huống | Ghi chú xuất ra | Mức |
|---|---|---|
| Điểm trung bình chung học kỳ < 1,0 (học kỳ đầu khoá: < 0,8) | `Có HK dưới 1.0` | Cảnh báo |
| Học kỳ không có điểm nào để xét | `Không có điểm TB để xét` | Cảnh báo |
| Bị cảnh báo ở hai học kỳ liền nhau | `CBHV 2 lần liên tiếp` | Nguy cơ buộc thôi học |
| Từng bị cảnh báo nhưng học kỳ gần nhất đã qua | — | Cần theo dõi |

Ngưỡng 1,0 và 0,8 sửa được trong Cài đặt. Học kỳ nào là học kỳ đầu khoá thì đánh dấu trong
mục Học kỳ — ứng dụng **không tự đoán** theo thứ tự dữ liệu, vì cố vấn thường chỉ nhập vài
học kỳ gần đây.

Khi chưa có kết quả học kỳ, ứng dụng tạm xét theo điểm tích luỹ, ngưỡng cũng sửa được:

| Mức | Điều kiện mặc định |
|---|---|
| Cần theo dõi | GPA tích luỹ < 2,0 **hoặc** nợ từ 1 tín chỉ |
| Cảnh báo | GPA tích luỹ < 1,5 **hoặc** nợ quá 8 tín chỉ |
| Nguy cơ buộc thôi học | GPA tích luỹ < 1,0 **hoặc** nợ quá 24 tín chỉ |

Sinh viên **chưa nhập điểm học phần nào** được xếp riêng là "Chưa có điểm", không bị đếm
vào diện cảnh báo — nếu không thì mọi báo cáo gửi Khoa đều sai từ đầu.

Mỗi mức cảnh báo luôn đi kèm lý do ghi rõ con số, ví dụ *"GPA tích luỹ 1,32 dưới 1,50;
Nợ 12 tín chỉ, quá 8"*. Nhờ vậy mọi số liệu trên báo cáo đều truy ngược được.

## 6. Ứng dụng bám theo văn bản nào của Trường

Những chỗ ứng dụng ra quyết định thay người dùng đều dẫn chiếu văn bản cụ thể, để sau này
Trường sửa quy định thì biết ngay phải sửa chỗ nào trong mã nguồn.

| Việc ứng dụng làm | Căn cứ |
|---|---|
| Lớp có thể có Cố vấn học tập và Giáo viên chủ nhiệm là **hai người khác nhau**; ai phụ trách vai trò nào thì thấy lớp đó | QĐ 758/QĐ-ĐHXDMT (10/12/2025), Điều 2.3 |
| Sổ họp lớp nhắc **tối thiểu 4 buổi mỗi học kỳ**, mỗi buổi phải có biên bản | QĐ 758, Điều 9.1 và 9.3 |
| Lịch trực gặp sinh viên **tối thiểu 1 giờ/tuần** tại văn phòng Khoa | QĐ 758, Điều 11.3 |
| Phiếu tự đánh giá: 6 tiêu chí, thang 100 điểm | QĐ 758, Điều 13.4 |
| Xếp loại và mức hưởng: 90–100 xuất sắc (100% giờ), 70–dưới 90 tốt (75%), 50–dưới 70 hoàn thành (50%), dưới 50 không hoàn thành (0%) | QĐ 758, Điều 13.4 |
| Giờ quy đổi theo sĩ số: dưới 10 SV 30 giờ; 10–40 SV 52,5 giờ; 41–50 SV 57,75 giờ; 51–60 SV 63 giờ | QĐ 758, Điều 18.3 |
| Chức vụ ban cán sự chỉ gồm **Lớp trưởng, Lớp phó, Bí thư Chi đoàn**; mỗi lớp một người một chức | QĐ 724/QĐ-ĐHXDMT (28/11/2025), Điều 2.2 |
| Đối chiếu tiêu chuẩn ban cán sự: điểm trung bình từ **5,5 (thang 10)** và rèn luyện **từ loại Khá** | QĐ 724, Điều 3.3 |
| Cố vấn kiểm tra, xác nhận kết quả đăng ký học phần rồi gửi Phòng Quản lý Đào tạo trước hạn | Thông báo 411/TB-ĐHXDMT (30/7/2026), mục Lưu ý |
| Mốc thời gian đăng ký khai theo từng học kỳ, không gắn cứng trong mã | Thông báo 411, mục 1 và 3 |
| Xét cảnh báo theo **điểm trung bình chung học kỳ** dưới 1,0, hoặc học kỳ không có điểm | Suy ra từ bảng *Cảnh cáo học vụ* của bốn Khoa: mọi sinh viên ghi chú "Có HK dưới 1.0" đều có điểm học kỳ dưới 1,0 dù điểm tích luỹ vẫn trên 2,0 |
| Ba mức `CBHV lần 1` / `CBHV lần 2` / `CBHV 2 lần liên tiếp` | Cột *CB - TT học vụ* trong bảng nói trên |
| Cột và thứ tự cột khi xuất bảng cảnh cáo | Đúng mẫu 14 cột của bốn tệp *CẢNH CÁO HỌC VỤ* |
| Cột và tên cột khi nhập Kết quả học tập | Đúng mẫu tệp *KQHT* của Phòng Đào tạo |
| Thang điểm chữ A/B+/…/F | *Chưa có văn bản.* Đang dùng Thông tư 08/2021/TT-BGDĐT, sửa được trong Cài đặt |

Bốn dòng giữa suy ra từ **chính các tệp mẫu Trường đang dùng**, không phải từ văn bản quy
định. Chúng khớp với Thông tư 08/2021/TT-BGDĐT Điều 11, nhưng nếu Quy định Đào tạo trình độ
đại học của Trường (Quyết định 183/QĐ-ĐHXDMT ngày 12/4/2023) nói khác thì lấy văn bản làm
chuẩn — mọi ngưỡng đều sửa được trong Cài đặt.

Dòng "Thang điểm chữ" là chỗ **còn thiếu căn cứ**: thang điểm nằm trong chính Quyết định 183
nói trên, chưa có trong tay. Số tín chỉ tối thiểu và tối đa được đăng ký mỗi học kỳ cũng vậy —
Thông báo 411 chỉ nói "không vượt quá số tín chỉ cho phép" mà không nêu con số, nên trong Cài
đặt hai mức này để 0, nghĩa là **không kiểm tra**. Điền số vào là ứng dụng bắt đầu cảnh báo em
nào đăng ký vượt hoặc thiếu.

Những con số trên đều nằm trong `assets/js/academic.js` và mục Cài đặt, không rải rác
trong giao diện.

## 7. Dữ liệu nằm ở đâu

Dữ liệu lưu trong `localStorage` của trình duyệt, **trên chính thiết bị đang dùng**.

Điều này nghĩa là:

- Không cần máy chủ, không cần đăng ký dịch vụ nào, không tốn tiền, dữ liệu không rời khỏi
  máy — nên không phát sinh chuyện chuyển dữ liệu cá nhân ra nước ngoài.
- **Máy nào dữ liệu nấy.** Nhập điểm trên máy tính thì điện thoại không tự thấy. Các tab của
  cùng một trình duyệt trên cùng một máy thì đồng bộ tức thì với nhau.
- Xoá dữ liệu duyệt web hoặc gỡ ứng dụng là mất. **Hãy sao lưu định kỳ:**
  Cài đặt → *Tải tệp sao lưu (JSON)*. Phục hồi ở ngay bên cạnh.
- Sức chứa thường khoảng 5 MB, đủ cho vài nghìn sinh viên kèm điểm. Màn hình Cài đặt hiện
  dung lượng đang dùng và cảnh báo khi gần đầy.

Cần dùng chung thật sự giữa nhiều máy thì phải có cơ sở dữ liệu trên máy chủ — xem mục 11.

## 8. Hai chiều dữ liệu giữa máy giảng viên và máy sinh viên

Máy giảng viên giữ toàn bộ. Máy sinh viên chỉ giữ **hồ sơ của đúng một em**.
Đây là tách bằng dữ liệu, không phải chỉ ẩn trên giao diện.

### Chiều đi — cố vấn gửi hồ sơ cho sinh viên

Hồ sơ sinh viên → **Gửi dữ liệu cho em này**. Ứng dụng cấp mã PIN mới, dựng một tệp chỉ
chứa dữ liệu của em đó, mã hoá tệp bằng chính mã PIN ấy (AES-GCM, khoá dẫn xuất PBKDF2-SHA256
200.000 vòng), rồi tải về. Cố vấn gửi tệp qua Zalo hoặc email và báo riêng mã PIN.

| Trong gói có | Cố ý không đưa vào gói |
|---|---|
| Hồ sơ cá nhân của em | Hồ sơ, điểm, rèn luyện của mọi sinh viên khác |
| Điểm học phần, kết quả học kỳ, điểm rèn luyện | Mật khẩu giảng viên (chỉ lấy tên, email, điện thoại) |
| Đăng ký học phần, lịch tư vấn của em | Nhật ký cố vấn đánh dấu chỉ giảng viên xem |
| Lời nhắn loại sinh viên xem được | Sổ họp lớp, phiếu tự đánh giá công tác |
| Liên hệ của CVHT và GVCN | Danh sách lớp, sĩ số, thống kê toàn lớp |

Trước khi xuất, ứng dụng **tự soi lại gói**: mọi bản ghi phải thuộc đúng em đó, không có
ghi chú riêng, không có dấu vết mật khẩu. Sai một điểm là chặn, không cho gửi.

Sinh viên mở ứng dụng → *Tôi có tệp dữ liệu do cố vấn gửi* → chọn tệp → nhập mã PIN. Sau
bước đó máy của em khoá vào **chế độ sinh viên**: lối vào dành cho giảng viên biến mất, và
trình cài đặt lần đầu không chạy nữa (nếu không, em có thể tự tạo tài khoản giảng viên).

### Chiều về — sinh viên gửi cập nhật cho cố vấn

Sinh viên tự sửa được **điện thoại, Zalo, email, địa chỉ, ghi chú liên hệ**, và tự đặt lịch
gặp. Xong thì bấm **Tạo phiếu cập nhật**: ứng dụng dựng một tệp nhỏ chỉ gồm mấy trường đó
cộng lịch hẹn em vừa đặt, mã hoá bằng *mã liên kết* mà gói ban đầu đã mang theo, rồi tải về
để em gửi lại cho thầy cô.

Cố vấn vào Sinh viên → **Nhận cập nhật từ SV** → chọn tệp. Ứng dụng mở tệp bằng mã liên kết
đang lưu trong hồ sơ — nên tệp của em nào chỉ mở được bằng hồ sơ em ấy — rồi hiện **bảng đối
chiếu từng mục: đang lưu gì, sinh viên gửi gì**. Cố vấn xem rồi mới bấm ghi. Nhận lại lần hai
cùng một tệp thì báo "không có gì mới".

### Chưa làm được: đồng bộ tự động

Hai chiều ở trên là **thủ công**: phải gửi tệp qua lại. Muốn sinh viên sửa số điện thoại là
máy thầy cô thấy ngay, bắt buộc phải có **một nơi lưu chung trên máy chủ** — xem mục 11.

## 9. Bảo mật — làm được gì và chưa làm được gì

**Đã làm:**

- Không có tài khoản, mật khẩu hay mã PIN nào cài sẵn trong mã nguồn. Tài khoản đầu tiên do
  người dùng tự tạo.
- Mật khẩu và mã PIN được băm SHA-256 với muối ngẫu nhiên, lặp 20.000 vòng; bản rõ không
  bao giờ được lưu.
- Sai quá 5 lần thì khoá 60 giây, áp dụng cho cả cố vấn lẫn sinh viên.
- Sinh viên đăng nhập bằng MSSV + mã PIN do cố vấn cấp, và **bắt buộc đổi mã ở lần đăng nhập
  đầu tiên**. Cổng sinh viên không có ô chọn sinh viên khác; mọi truy vấn đều lọc theo id
  trong phiên đăng nhập. Gõ thẳng địa chỉ màn hình của cố vấn cũng bị đưa về trang của
  chính mình.
- Mỗi cố vấn chỉ thấy lớp mình phụ trách. Phiên làm việc tự hết hạn sau 8 giờ (cố vấn) và
  3 giờ (sinh viên).
- Nhật ký cố vấn có hai mức: chỉ cố vấn xem, hoặc sinh viên xem được.

**Chưa làm được, cần nói thẳng:**

- Đây là ứng dụng chạy hoàn toàn trong trình duyệt. Ai ngồi vào đúng máy đó và mở công cụ
  dành cho lập trình viên thì đọc được dữ liệu đã lưu. Việc băm mật khẩu ngăn được chuyện
  đọc lỏm mật khẩu, **không** biến thiết bị dùng chung thành nơi an toàn.
- Vì vậy: đừng dùng máy tính công cộng, nên đặt mật khẩu/mã PIN màn hình cho máy, và nhớ
  đăng xuất.
- Muốn bảo vệ đúng nghĩa thì phải kiểm tra quyền ở phía máy chủ — xem mục 11.

## 10. Nhập và xuất dữ liệu

### Tệp Excel của Trường

Ứng dụng **đọc và ghi thẳng tệp `.xlsx`**, không cần thư viện ngoài: tệp `.xlsx` thực chất
là một tệp ZIP chứa XML, mà trình duyệt thì có sẵn bộ nén/giải nén và bộ đọc XML.

| Hướng | Tệp | Ghi chú |
|---|---|---|
| Nhập | *Kết quả học tập* (KQHT) | Tự tìm dòng tiêu đề, khớp sinh viên theo mã, hỏi trước khi tạo hồ sơ cho em chưa có |
| Nhập | Số tín chỉ đăng ký | Tệp nào có cột mã sinh viên và cột số tín chỉ đăng ký là đọc được |
| Xuất | *Cảnh cáo học vụ* | Đúng 14 cột, đúng chữ trong cột Ghi chú, cột Số TC ĐK lấy từ màn hình Đăng ký học phần |

Tệp `.xls` đời cũ (định dạng trước 2007) thì mở bằng Excel rồi lưu lại thành `.xlsx` hoặc CSV.
Trình duyệt quá cũ không hỗ trợ thì ứng dụng tự chuyển sang xuất CSV và báo cho biết.

### Mẫu tệp CSV

Tải tệp mẫu ngay trong app (Cài đặt → *Tải tệp mẫu nhập sinh viên*, Nhập điểm → *Tải tệp
mẫu*, Kết quả học kỳ → *Tải tệp mẫu*). Tệp dùng dấu chấm phẩy và có sẵn BOM nên Excel tiếng
Việt mở là đúng chữ.

**Danh sách sinh viên** — bắt buộc `MSSV` và `Họ và tên`, các cột khác tuỳ chọn:

```
MSSV;Họ và tên;Giới tính;Ngày sinh;Điện thoại;Email;Lớp;Chức vụ;Trạng thái;Ghi chú
26XD01001;Nguyễn Văn An;Nam;15/03/2008;0900000001;an.nv@example.edu.vn;26XD01;Lớp trưởng;Đang học;
```

**Bảng điểm** — bắt buộc `MSSV`, `Số tín chỉ`, `Điểm hệ 10` và một trong hai cột mã/tên học phần:

```
MSSV;Mã học phần;Tên học phần;Số tín chỉ;Điểm hệ 10;Học kỳ
26XD01001;MTU101;Toán cao cấp 1;3;8,5;2025-1
```

Bộ nhập đọc thẳng được mẫu *Danh sách lớp sinh viên* của Trường (các cột STT, CCCD, HỌ VÀ
TÊN, NGÀY SINH, MSSV, GHI CHÚ). **Cột CCCD bị bỏ qua có chủ ý**: ứng dụng không dùng số căn
cước vào chức năng nào, mà dữ liệu lại nằm ngay trong trình duyệt, nên không lưu là an toàn
hơn. Báo cáo sau khi nhập sẽ nói rõ điều này.

Khi nhập, ứng dụng đọc được cả `dd/mm/yyyy` lẫn `yyyy-mm-dd`, cả dấu phẩy lẫn dấu chấm
thập phân, và tự nhận dấu phân cách `;` `,` hay tab. Dòng nào sai thì bị bỏ qua và **báo
rõ sai ở dòng nào, sai cái gì**; những dòng còn lại vẫn nhập bình thường. Trùng MSSV thì
cập nhật chứ không tạo bản ghi trùng.

## 11. Muốn dùng chung giữa nhiều thiết bị

Tầng dữ liệu đã được gom sẵn để đổi chỗ lưu mà không phải viết lại giao diện:

- Toàn bộ thao tác đọc/ghi đi qua `assets/js/store.js`, cụ thể là đối tượng `adapter`
  (3 hàm `read` / `write` / `remove`) và bộ hàm `all` / `get` / `put` / `remove`.
- Thay `adapter` bằng lời gọi tới API máy chủ là xong phần lưu trữ. Giao diện, biểu đồ,
  logic học vụ giữ nguyên.
- Khi đó nên chuyển luôn việc kiểm tra quyền sang máy chủ: cổng sinh viên chỉ được trả về
  đúng hồ sơ của người đang đăng nhập, cố vấn chỉ được trả về lớp mình phụ trách.

Lưu ý pháp lý: đưa họ tên, MSSV, điểm và số điện thoại sinh viên thật lên dịch vụ đám mây
đặt ở nước ngoài là chuyển dữ liệu cá nhân ra nước ngoài theo Nghị định 13/2023/NĐ-CP. Nếu
Trường có máy chủ nội bộ thì đặt cơ sở dữ liệu ở đó là sạch nhất.

## 12. Cấu trúc mã nguồn

```
cvht-mtu/
├── index.html              Khung trang, chỉ có bố cục; mọi màn hình do JS dựng
├── manifest.json           Khai báo PWA (một tệp duy nhất, không có bản thứ hai)
├── sw.js                   Service worker: lưu đệm toàn bộ tài nguyên để chạy offline
├── assets/
│   ├── css/app.css         Hệ màu sáng/tối, thẻ 3D, bố cục, kiểu in ấn
│   ├── icons/              5 tệp PNG sinh bằng scripts/make-icons.cjs
│   └── js/
│       ├── util.js         DOM, định dạng số và ngày kiểu Việt, SHA-256 viết thuần
│       ├── store.js        15 bảng dữ liệu, phiên đăng nhập, sao lưu, đồng bộ giữa các tab
│       ├── academic.js     ★ Thang điểm, GPA, cảnh báo, quy định của Trường, kiểm tra dữ liệu
│       ├── charts.js       Biểu đồ cột / thanh xếp chồng / đường, vẽ bằng SVG thuần
│       ├── xlsx.js         Đọc và ghi tệp Excel .xlsx bằng tay, không thư viện ngoài
│       ├── io.js           Đọc ghi CSV và .xlsx, sao lưu JSON, in báo cáo
│       ├── ui.js           Thẻ 3D, hộp thoại, biểu mẫu, bảng, thông báo
│       ├── pack.js         Gói dữ liệu riêng từng sinh viên, mã hoá, phiếu cập nhật chiều về
│       ├── view-auth.js    Cài đặt lần đầu, chọn vai trò, đăng nhập, nạp gói dữ liệu
│       ├── view-advisor.js 12 màn hình của giảng viên cố vấn
│       ├── view-student.js 4 màn hình của cổng sinh viên
│       └── app.js          Định tuyến, khung điều hướng, khởi động, đăng ký service worker
└── scripts/make-icons.cjs  Sinh lại bộ icon PNG
```

## 13. Biểu tượng ứng dụng

Mọi chỗ hiển thị logo trong app — thanh bên, màn hình đăng nhập, biểu tượng khi cài vào
máy, biểu tượng trên thẻ trình duyệt — đều lấy từ **logo chính thức của Trường**.

Tệp gốc là `assets/icons/logo-source.png`. Từ đó, `scripts/make-icons.cjs` sinh ra sáu tệp:

| Tệp | Dùng ở đâu |
|---|---|
| `logo-mtu.png` (320x269) | Hiển thị trong giao diện, giữ nguyên tỉ lệ ngang |
| `favicon-32.png` | Biểu tượng trên thẻ trình duyệt |
| `apple-touch-icon.png` (180) | Màn hình chính của iPhone / iPad |
| `icon-192.png`, `icon-512.png` | Biểu tượng ứng dụng đã cài |
| `icon-maskable-512.png` | Bản chừa lề an toàn cho Android cắt tròn |

Thay logo khác: chép tệp PNG mới đè lên `assets/icons/logo-source.png`, rồi

```bash
node scripts/make-icons.cjs   # không cần cài thêm gì, Node có sẵn là đủ
```

Script tự cắt lề trắng, thu nhỏ bằng cách lấy trung bình vùng cho cạnh hình mịn, giảm
số màu rồi đóng gói PNG bảng màu — cả sáu tệp cộng lại chỉ khoảng 30 KB. Chạy xong nhớ
tăng số `VERSION` trong `sw.js` để máy đã cài nhận bộ biểu tượng mới.

## 14. Vài điểm đáng lưu ý khi bảo trì

- **Sửa mã nguồn xong nhớ tăng `VERSION` trong `sw.js`.** Không tăng thì máy đã cài app vẫn
  chạy bản cũ đã lưu đệm.
- Màu chủ đề khai ở đúng hai chỗ và phải giống nhau: thẻ `<meta name="theme-color">` trong
  `index.html` và `theme_color` trong `manifest.json` (hiện là `#123a6b`).
- Mọi thứ liên quan đến cách tính điểm đều nằm trong `academic.js`. Đừng tính GPA ở chỗ khác.
- Không thêm thư viện nạp từ CDN: chỉ cần một dòng như vậy là app mất khả năng chạy offline.
