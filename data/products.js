/* ============================================================
   DỮ LIỆU SẢN PHẨM - chỉnh sửa file này để đổi nội dung shop
   ============================================================ */
window.SITE = {
  /* Bật/tắt toàn bộ "bằng chứng xã hội": số sao, số lượt đã bán và mục
     đánh giá của khách. Các con số đang có trong file này là SỐ MẪU do
     người dựng web đặt ra, không phải số liệu thật. Đặt false để ẩn hết
     cho tới khi bạn có dữ liệu thật. */
  showSocialProof: false,

  brand: {
    name: "TeamHọc",
    domain: "teamhoc.shop",
    tagline: "Học nhanh · Làm gọn · Đi xa",
    slogan: "Bộ công cụ Google Sheets & Web App cho người học và người làm",
    owner: "TRUONG HOANG PHIEU",
    hotline: "0372 837 968",
    zalo: "0372 837 968",
    email: "hotro@teamhoc.shop",
    address: "Phường Tân Hạnh, tỉnh Vĩnh Long",

    /* ---------------------------------------------------------------
       THANH TOÁN — mã QR trên trang thanh toán được dựng từ khối này
       theo chuẩn VietQR (EMVCo), sinh ngay trong trình duyệt.

       ✔ ĐÃ XÁC MINH: chủ tài khoản đã quét thử mã sinh ra bằng app và
         xác nhận thông tin người nhận hiển thị đúng.

       Nếu sau này đổi số tài khoản, nhớ quét thử lại. Khi cần chắc
       chắn tuyệt đối, có thể bỏ qua phần tự dựng bằng một trong hai
       trường sau (trường nào có giá trị thì web ưu tiên dùng):
         1. qrPayload — mở app Viettel Money, xuất mã QR nhận tiền, giải
            mã ra chuỗi bắt đầu bằng "00020101..." rồi dán vào đây.
            Lưu ý: payload cố định sẽ không kèm được số tiền và mã đơn.
         2. qrImage   — lưu ảnh QR từ app vào assets/img/ rồi trỏ đường
            dẫn vào đây (ví dụ "assets/img/qr.png").
       --------------------------------------------------------------- */
    pay: {
      provider: "Viettel Money",
      acc: "9704229200178016449",
      owner: "TRUONG HOANG PHIEU",
      bin: "970422",
      service: "QRIBFTTC",   // chuyển tới số thẻ; dùng "QRIBFTTA" nếu là số tài khoản
      qrPayload: "",
      qrImage: ""
    }
  },

  categories: [
    { slug: "cong-viec",  name: "Quản lý công việc & dự án", icon: "📋", desc: "Kế hoạch, tiến độ, Gantt, checklist" },
    { slug: "tai-chinh",  name: "Tài chính & kế toán",        icon: "💰", desc: "Thu chi, dòng tiền, công nợ, ngân sách" },
    { slug: "kinh-doanh", name: "Kinh doanh & bán hàng",      icon: "🛒", desc: "CRM, đơn hàng, kho, doanh số" },
    { slug: "nhan-su",    name: "Nhân sự & chấm công",        icon: "👥", desc: "Hồ sơ, chấm công, lương, KPI" },
    { slug: "hoc-tap",    name: "Học tập & cá nhân",          icon: "🎓", desc: "Từ vựng, thời khoá biểu, thói quen" },
    { slug: "web-app",    name: "Web App (Apps Script)",       icon: "⚡", desc: "Ứng dụng web chạy trên Google" }
  ],

  products: [
    { id:"p01", cat:"web-app", emoji:"🏗️", badge:"BÁN CHẠY",
      name:"Công Trình 360 – Web App Điều Hành Thi Công",
      price:1290000, old:1990000, rating:4.9, sold:412, updated:"08/2026",
      short:"Theo dõi tiến độ, chi phí, công nợ, nhân sự và hạng mục công việc cho nhà thầu – chạy trực tiếp trên trình duyệt.",
      features:["Dashboard tiến độ & chi phí theo thời gian thực","Quản lý hạng mục – đầu việc – nhân công","Theo dõi công nợ nhà cung cấp & chủ đầu tư","Nhật ký công trường kèm hình ảnh","Xuất báo cáo PDF/Excel một chạm","Phân quyền nhiều tài khoản"],
      includes:["File Google Sheets + mã Apps Script","Video hướng dẫn cài đặt 25 phút","Hỗ trợ setup từ xa 1-1","Cập nhật trọn đời"] },

    { id:"p02", cat:"web-app", emoji:"🏨", badge:"MỚI",
      name:"Lưu Trú 360 – Web App Vận Hành Homestay",
      price:990000, old:1490000, rating:4.8, sold:236, updated:"08/2026",
      short:"Sơ đồ phòng, đặt phòng, khách hàng, thu chi và lịch dọn phòng gói gọn trong một ứng dụng.",
      features:["Sơ đồ phòng trực quan theo ngày","Đặt phòng – nhận phòng – trả phòng","Hồ sơ khách & lịch sử lưu trú","Báo cáo doanh thu / lấp đầy phòng","Lịch dọn phòng cho housekeeping","Gửi xác nhận đặt phòng qua email"],
      includes:["Bản Web App bản quyền","Tài liệu hướng dẫn PDF","Hỗ trợ kỹ thuật 6 tháng","Cập nhật trọn đời"] },

    { id:"p03", cat:"web-app", emoji:"📨",
      name:"Sổ Công Văn Số – Luân Chuyển Hồ Sơ Nội Bộ",
      price:890000, old:1290000, rating:4.7, sold:189, updated:"07/2026",
      short:"Số hoá sổ công văn: vào sổ, phân luồng xử lý, tra cứu và thống kê văn bản cho cơ quan, doanh nghiệp.",
      features:["Vào sổ văn bản đến / đi tự động đánh số","Đính kèm file scan lên Google Drive","Phân luồng xử lý & nhắc hạn","Tra cứu nhanh theo nhiều tiêu chí","Thống kê theo tháng/quý/năm","Nhật ký thao tác người dùng"],
      includes:["Web App + Sheets nguồn","Hướng dẫn triển khai chi tiết","Hỗ trợ cài đặt từ xa","Cập nhật trọn đời"] },

    { id:"p04", cat:"kinh-doanh", emoji:"🚗", badge:"BÁN CHẠY",
      name:"Garage Care – Sổ Chăm Khách Ngành Ô Tô",
      price:590000, old:890000, rating:4.9, sold:521, updated:"08/2026",
      short:"Hệ thống theo dõi khách hàng showroom & garage: lịch hẹn, lịch bảo dưỡng, doanh số tư vấn viên.",
      features:["Pipeline khách hàng theo trạng thái","Nhắc lịch bảo dưỡng & đăng kiểm","Lịch sử dịch vụ từng xe","Báo cáo doanh số theo nhân viên","Phân loại khách nóng – ấm – lạnh","Xuất danh sách chăm sóc hằng ngày"],
      includes:["File Google Sheets bản quyền","Video hướng dẫn 40 phút","Nhóm hỗ trợ Zalo","Cập nhật trọn đời"] },

    { id:"p05", cat:"cong-viec", emoji:"✅", badge:"HOT",
      name:"Việc Gọn – Bảng Điều Phối Đầu Việc",
      price:299000, old:499000, rating:4.8, sold:1204, updated:"08/2026",
      short:"Quản lý toàn bộ đầu việc cá nhân & nhóm theo phương pháp Eisenhower + Kanban ngay trên Google Sheets.",
      features:["Bảng Kanban kéo trạng thái","Ma trận ưu tiên Eisenhower","Dashboard hiệu suất tuần / tháng","Gán việc & theo dõi deadline","Tự động nhắc việc quá hạn","Ghi chú và nhật ký công việc"],
      includes:["File template bản quyền","Hướng dẫn sử dụng chi tiết","Hỗ trợ qua Zalo","Cập nhật trọn đời"] },

    { id:"p06", cat:"cong-viec", emoji:"📊",
      name:"Tiến Độ Rõ – Kế Hoạch Dự Án & Gantt",
      price:349000, old:549000, rating:4.7, sold:487, updated:"06/2026",
      short:"Nhập đầu việc – Gantt tự vẽ. Theo dõi đường găng, phần trăm hoàn thành và nguồn lực.",
      features:["Gantt tự động theo ngày bắt đầu / kết thúc","Cột mốc & phụ thuộc công việc","Tô màu theo trạng thái tiến độ","Phân bổ nhân sự cho từng đầu việc","Báo cáo tiến độ tổng thể","In khổ A3 gọn gàng"],
      includes:["File template bản quyền","Video hướng dẫn","Hỗ trợ 3 tháng","Cập nhật trọn đời"] },

    { id:"p07", cat:"cong-viec", emoji:"🗓️",
      name:"Mục Tiêu Năm – Khung OKR Cá Nhân & Đội Nhóm",
      price:199000, old:349000, rating:4.6, sold:653, updated:"05/2026",
      short:"Đặt mục tiêu năm, chia nhỏ theo quý – tháng – tuần và đo lường bằng chỉ số cụ thể.",
      features:["Khung OKR cho cá nhân & đội nhóm","Tự động tính % hoàn thành mục tiêu","Review tuần / tháng có sẵn câu hỏi","Theo dõi thói quen hỗ trợ mục tiêu","Dashboard tổng quan năm","Bản in đẹp cho bảng treo"],
      includes:["File template bản quyền","Ebook hướng dẫn OKR","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p08", cat:"tai-chinh", emoji:"💵", badge:"BÁN CHẠY",
      name:"Ví Nhà – Sổ Thu Chi Gia Đình",
      price:189000, old:299000, rating:4.9, sold:2140, updated:"08/2026",
      short:"Ghi chép thu chi 10 giây mỗi ngày, tự động phân loại và cảnh báo khi vượt ngân sách.",
      features:["Nhập liệu nhanh trên điện thoại","Ngân sách theo nhóm chi tiêu","Biểu đồ dòng tiền 12 tháng","Theo dõi khoản vay & tiết kiệm","Cảnh báo vượt hạn mức","Báo cáo tài chính cá nhân"],
      includes:["File template bản quyền","Hướng dẫn dùng trên điện thoại","Hỗ trợ qua Zalo","Cập nhật trọn đời"] },

    { id:"p09", cat:"tai-chinh", emoji:"🏦",
      name:"Dòng Tiền Khoẻ – Bảng Điều Hành Tài Chính SME",
      price:690000, old:990000, rating:4.8, sold:312, updated:"07/2026",
      short:"Dự báo dòng tiền 12 tháng, theo dõi công nợ phải thu – phải trả và điểm hoà vốn.",
      features:["Dự báo dòng tiền vào/ra theo tuần","Sổ công nợ phải thu – phải trả","Phân tích điểm hoà vốn","Báo cáo P&L đơn giản","Cảnh báo thiếu hụt tiền mặt","Dashboard cho ban giám đốc"],
      includes:["File template bản quyền","Video hướng dẫn 60 phút","Tư vấn 1-1 30 phút","Cập nhật trọn đời"] },

    { id:"p10", cat:"tai-chinh", emoji:"🧾",
      name:"Sổ Nợ Sạch – Theo Dõi & Nhắc Thu Hồi Công Nợ",
      price:249000, old:399000, rating:4.6, sold:398, updated:"04/2026",
      short:"Theo dõi từng hoá đơn, tuổi nợ và tự động soạn tin nhắn nhắc khách thanh toán.",
      features:["Phân tích tuổi nợ 0–30–60–90 ngày","Tự sinh nội dung nhắc nợ","Đối chiếu thanh toán từng phần","Báo cáo công nợ theo khách hàng","Cảnh báo nợ xấu","Xuất file gửi kế toán"],
      includes:["File template bản quyền","Hướng dẫn sử dụng","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p11", cat:"kinh-doanh", emoji:"📦", badge:"HOT",
      name:"Kho Chuẩn – Xuất Nhập Tồn Tự Động",
      price:399000, old:599000, rating:4.8, sold:876, updated:"08/2026",
      short:"Nhập – xuất – tồn cập nhật tức thì, cảnh báo hết hàng và định giá tồn kho bình quân.",
      features:["Phiếu nhập / xuất có mã tự động","Tồn kho realtime theo từng mã hàng","Cảnh báo tồn tối thiểu","Định giá bình quân gia quyền","Báo cáo hàng bán chạy / hàng chậm","Kiểm kê định kỳ"],
      includes:["File template bản quyền","Video hướng dẫn","Nhóm hỗ trợ Zalo","Cập nhật trọn đời"] },

    { id:"p12", cat:"kinh-doanh", emoji:"🛍️",
      name:"Gộp Đơn Đa Sàn – Lãi Thực Sau Phí Sàn",
      price:459000, old:699000, rating:4.7, sold:534, updated:"07/2026",
      short:"Gộp đơn Shopee – TikTok – Facebook về một nơi, tính lãi thực nhận sau phí sàn.",
      features:["Nhập đơn từ nhiều kênh bán","Tính phí sàn & lợi nhuận thực","Theo dõi trạng thái vận chuyển","Báo cáo doanh thu theo kênh","Quản lý khách hàng thân thiết","Thống kê tỷ lệ hoàn đơn"],
      includes:["File template bản quyền","Hướng dẫn nhập liệu nhanh","Hỗ trợ 6 tháng","Cập nhật trọn đời"] },

    { id:"p13", cat:"kinh-doanh", emoji:"📈",
      name:"Bản Đồ Marketing Quý – Kế Hoạch & Lịch Nội Dung",
      price:229000, old:399000, rating:4.5, sold:421, updated:"03/2026",
      short:"Khung lập kế hoạch marketing từ mục tiêu, kênh, ngân sách đến lịch content chi tiết.",
      features:["Khung mục tiêu SMART theo quý","Phân bổ ngân sách theo kênh","Lịch content 90 ngày","Theo dõi chỉ số CPM / CPC / ROAS","Báo cáo hiệu quả chiến dịch","Thư viện ý tưởng nội dung"],
      includes:["File template bản quyền","Bộ 100 ý tưởng content","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p14", cat:"kinh-doanh", emoji:"🤝",
      name:"Chốt Đơn B2B – Pipeline & Báo Giá Tự Động",
      price:549000, old:799000, rating:4.7, sold:267, updated:"06/2026",
      short:"Quản lý cơ hội bán hàng theo từng giai đoạn, tự sinh báo giá và dự báo doanh thu.",
      features:["Pipeline 6 giai đoạn tuỳ chỉnh","Tự sinh báo giá PDF theo mẫu","Dự báo doanh thu theo xác suất","Nhật ký chăm sóc khách hàng","KPI theo từng sale","Nhắc lịch follow-up"],
      includes:["File template bản quyền","Mẫu báo giá thiết kế sẵn","Hỗ trợ 6 tháng","Cập nhật trọn đời"] },

    { id:"p15", cat:"nhan-su", emoji:"⏰", badge:"BÁN CHẠY",
      name:"Bảng Công Chuẩn – Chấm Công & Tính Lương",
      price:499000, old:749000, rating:4.8, sold:915, updated:"08/2026",
      short:"Chấm công theo ca, tính lương, tăng ca, BHXH và in phiếu lương cho từng nhân viên.",
      features:["Bảng công theo ca / theo giờ","Tính tăng ca, phụ cấp, khấu trừ","Tự động tính BHXH & thuế TNCN","In phiếu lương hàng loạt","Báo cáo quỹ lương theo phòng ban","Theo dõi nghỉ phép"],
      includes:["File template bản quyền","Video hướng dẫn 45 phút","Hỗ trợ 1-1 khi kỳ lương","Cập nhật trọn đời"] },

    { id:"p16", cat:"nhan-su", emoji:"🗂️",
      name:"Hồ Sơ Người – Nhân Sự & Hợp Đồng Lao Động",
      price:299000, old:459000, rating:4.6, sold:388, updated:"05/2026",
      short:"Lưu trữ hồ sơ, theo dõi hạn hợp đồng, bằng cấp và biến động nhân sự toàn công ty.",
      features:["Hồ sơ nhân sự đầy đủ trường thông tin","Cảnh báo hết hạn hợp đồng","Theo dõi biến động vào / ra","Sơ đồ tổ chức tự động","Thống kê cơ cấu nhân sự","Xuất danh sách theo phòng ban"],
      includes:["File template bản quyền","Bộ biểu mẫu HR đi kèm","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p17", cat:"nhan-su", emoji:"🎯",
      name:"Thước Đo KPI – Đánh Giá Năng Lực Theo Kỳ",
      price:359000, old:559000, rating:4.6, sold:243, updated:"04/2026",
      short:"Bộ khung KPI theo phòng ban, chấm điểm đa chiều và xếp loại nhân viên theo kỳ.",
      features:["Thư viện KPI mẫu 12 phòng ban","Chấm điểm 360 độ","Tự động xếp loại A/B/C/D","Biểu đồ radar năng lực","So sánh kỳ trước – kỳ này","Xuất biên bản đánh giá"],
      includes:["File template bản quyền","Bộ KPI mẫu","Hỗ trợ 3 tháng","Cập nhật trọn đời"] },

    { id:"p18", cat:"hoc-tap", emoji:"🔤", badge:"MỚI",
      name:"Từ Vựng Bền – Học Tiếng Anh Bằng Lịch Lặp Lại",
      price:159000, old:259000, rating:4.9, sold:1876, updated:"08/2026",
      short:"Flashcard lặp lại ngắt quãng (spaced repetition) chạy trên Google Sheets, học 15 phút mỗi ngày.",
      features:["Thuật toán lặp lại ngắt quãng SRS","Flashcard hai mặt có phát âm","Thống kê số từ đã thuộc","Nhập từ mới hàng loạt","Kiểm tra nhanh cuối tuần","Học được trên điện thoại"],
      includes:["File template bản quyền","Bộ 3000 từ vựng thông dụng","Hướng dẫn học hiệu quả","Cập nhật trọn đời"] },

    { id:"p19", cat:"hoc-tap", emoji:"📚",
      name:"Kỳ Học Gọn – Thời Khoá Biểu & Điểm GPA",
      price:99000, old:199000, rating:4.5, sold:1129, updated:"03/2026",
      short:"Thời khoá biểu, deadline bài tập, điểm số và tính GPA tự động cho học sinh – sinh viên.",
      features:["Thời khoá biểu tuần trực quan","Quản lý deadline bài tập","Tự động tính GPA theo tín chỉ","Theo dõi điểm từng môn","Nhắc lịch thi","Ghi chú bài giảng"],
      includes:["File template bản quyền","Hướng dẫn sử dụng","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p20", cat:"hoc-tap", emoji:"🌱",
      name:"Nếp Ngày – Theo Dõi Thói Quen 365 Ngày",
      price:89000, old:169000, rating:4.7, sold:1543, updated:"02/2026",
      short:"Đánh dấu thói quen mỗi ngày, xem chuỗi streak và biểu đồ nhiệt cả năm.",
      features:["Theo dõi tối đa 15 thói quen","Biểu đồ nhiệt 365 ngày","Chuỗi streak dài nhất","Thống kê tỷ lệ hoàn thành","Ghi chú cảm xúc mỗi ngày","Bản in treo tường"],
      includes:["File template bản quyền","Hướng dẫn xây thói quen","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p21", cat:"cong-viec", emoji:"📝",
      name:"Họp Ra Việc – Biên Bản & Danh Sách Hành Động",
      price:129000, old:229000, rating:4.4, sold:276, updated:"01/2026",
      short:"Ghi biên bản họp theo mẫu chuẩn và chuyển ngay thành danh sách việc có người phụ trách.",
      features:["Mẫu biên bản họp chuẩn","Chuyển kết luận thành đầu việc","Theo dõi hạn xử lý","Nhắc việc tồn đọng","Lưu trữ theo chủ đề cuộc họp","Xuất biên bản PDF"],
      includes:["File template bản quyền","Bộ mẫu biên bản","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p22", cat:"tai-chinh", emoji:"🏠",
      name:"Đường Về Nhà – Kế Hoạch Mua Nhà & Trả Nợ",
      price:149000, old:249000, rating:4.7, sold:604, updated:"06/2026",
      short:"Tính lịch trả nợ gốc – lãi, so sánh phương án vay và mô phỏng khả năng trả nợ.",
      features:["Lịch trả nợ chi tiết từng kỳ","So sánh dư nợ giảm dần / đều","Mô phỏng trả trước hạn","Tính tỷ lệ nợ trên thu nhập","Kế hoạch tích luỹ trước khi mua","Biểu đồ gốc – lãi theo thời gian"],
      includes:["File template bản quyền","Hướng dẫn tính toán","Hỗ trợ qua email","Cập nhật trọn đời"] },

    { id:"p23", cat:"web-app", emoji:"🍽️",
      name:"Quán Nhẹ – Web App Vận Hành Quán Ăn & Cafe",
      price:790000, old:1190000, rating:4.6, sold:158, updated:"07/2026",
      short:"Order tại bàn, in bill, quản lý nguyên vật liệu và báo cáo lãi lỗ theo ngày.",
      features:["Sơ đồ bàn & order nhanh","In bill từ trình duyệt","Định lượng nguyên vật liệu","Báo cáo lãi lỗ theo ngày","Quản lý ca làm nhân viên","Theo dõi món bán chạy"],
      includes:["Web App bản quyền","Hướng dẫn cài đặt","Hỗ trợ kỹ thuật 6 tháng","Cập nhật trọn đời"] },

    { id:"p24", cat:"nhan-su", emoji:"🎓",
      name:"Lộ Trình Nghề – Đào Tạo Nội Bộ Theo Vị Trí",
      price:279000, old:429000, rating:4.5, sold:187, updated:"05/2026",
      short:"Lập lộ trình đào tạo cho từng vị trí, theo dõi tiến độ học và kết quả kiểm tra.",
      features:["Lộ trình đào tạo theo vị trí","Theo dõi tiến độ từng nhân viên","Lưu kết quả bài kiểm tra","Thống kê giờ đào tạo","Đánh giá hiệu quả khoá học","Nhắc lịch đào tạo định kỳ"],
      includes:["File template bản quyền","Bộ lộ trình mẫu","Hỗ trợ qua email","Cập nhật trọn đời"] }
  ],

  posts: [
    { slug:"5-ham-google-sheets", emoji:"📐", date:"18/08/2026", cat:"Mẹo Google Sheets",
      title:"5 hàm Google Sheets giúp bạn tiết kiệm 2 giờ mỗi ngày",
      excerpt:"QUERY, ARRAYFORMULA, XLOOKUP, IMPORTRANGE và LAMBDA — bộ năm hàm này thay được phần lớn thao tác thủ công bạn đang làm.",
      body:["Phần lớn thời gian làm việc trên bảng tính bị đốt vào những thao tác lặp lại: lọc tay, copy công thức xuống hàng nghìn dòng, gõ lại số liệu từ file khác. Năm hàm dưới đây xử lý gần hết nhóm việc đó.","<b>1. QUERY</b> — viết truy vấn kiểu SQL ngay trong ô. Một công thức QUERY thay được cả bộ lọc, sắp xếp và tổng hợp. Ví dụ lọc đơn hàng trên 5 triệu của tháng 8 chỉ tốn một dòng.","<b>2. ARRAYFORMULA</b> — viết công thức một lần, áp cho cả cột. Không còn cảnh kéo công thức xuống 10.000 dòng rồi file nặng ì ạch.","<b>3. XLOOKUP</b> — thay VLOOKUP với cú pháp dễ nhớ hơn, tra được cả sang trái và trả về giá trị mặc định khi không tìm thấy.","<b>4. IMPORTRANGE</b> — nối dữ liệu giữa các file. Dùng chung với QUERY sẽ tạo được báo cáo tổng hợp từ nhiều chi nhánh mà không cần copy tay.","<b>5. LAMBDA</b> — tự định nghĩa hàm riêng cho những logic bạn dùng đi dùng lại, đặt tên dễ hiểu thay vì công thức lồng ba tầng.","Bắt đầu với QUERY và ARRAYFORMULA trước. Chỉ hai hàm này thôi đã đủ thay đổi cách bạn dựng báo cáo."] },

    { slug:"chon-template-quan-ly", emoji:"🧭", date:"09/08/2026", cat:"Hướng dẫn",
      title:"Chọn template quản lý phù hợp: đừng mua thứ quá to so với đội của bạn",
      excerpt:"Một file quản lý 40 sheet không giúp gì cho đội 5 người. Đây là cách chọn đúng quy mô ngay từ đầu.",
      body:["Lỗi phổ biến nhất khi mua template là chọn bản “đầy đủ nhất”. Càng nhiều tính năng thì càng nhiều ô phải nhập, và đội nhỏ sẽ bỏ dở sau hai tuần.","<b>Đội dưới 10 người:</b> chọn file một mục tiêu duy nhất — hoặc quản lý việc, hoặc quản lý tiền, đừng gộp. Tiêu chí: nhập liệu dưới 2 phút mỗi ngày.","<b>Đội 10–50 người:</b> lúc này cần phân quyền và báo cáo tổng hợp. Ưu tiên bản có dashboard sẵn và tách sheet nhập liệu khỏi sheet báo cáo.","<b>Trên 50 người:</b> cân nhắc Web App thay vì file Sheets thuần, vì nhiều người nhập cùng lúc trên một file sẽ chậm và dễ hỏng công thức.","Cuối cùng, hãy hỏi người bán một câu: “file này cần bao nhiêu phút nhập liệu mỗi ngày?”. Câu trả lời nói lên nhiều điều hơn danh sách tính năng."] },

    { slug:"web-app-apps-script", emoji:"⚙️", date:"27/07/2026", cat:"Web App",
      title:"Web App Apps Script là gì và khi nào nên dùng thay Google Sheets?",
      excerpt:"Khi nhiều người cùng nhập liệu, file Sheets bắt đầu đuối. Web App giải quyết đúng vấn đề đó.",
      body:["Google Apps Script cho phép biến một file Sheets thành ứng dụng web có giao diện riêng, chạy trên trình duyệt và điện thoại. Dữ liệu vẫn nằm trong Sheets, nhưng người dùng không thao tác trực tiếp lên bảng tính nữa.","<b>Khi nào nên chuyển sang Web App:</b> có từ 5 người nhập liệu cùng lúc; cần phân quyền theo vai trò; sợ người dùng xoá nhầm công thức; cần nhập liệu trên điện thoại một cách thoải mái.","<b>Khi nào vẫn nên dùng Sheets:</b> một tới hai người dùng; cần tự do sửa công thức; muốn tuỳ biến liên tục theo cách của mình.","Điểm cần lưu ý: Web App có hạn mức thực thi hằng ngày của Google. Với quy mô vài chục người dùng nội bộ thì hạn mức này thoải mái, nhưng đừng dùng nó thay cho một hệ thống phục vụ hàng nghìn khách bên ngoài."] },

    { slug:"bao-mat-file-sheets", emoji:"🔒", date:"12/07/2026", cat:"Mẹo Google Sheets",
      title:"6 cách bảo vệ file Google Sheets khỏi bị sửa nhầm",
      excerpt:"Bảo vệ dải ô, kiểm soát dữ liệu đầu vào, lịch sử phiên bản — vài thiết lập nhỏ cứu bạn khỏi một buổi tối làm lại từ đầu.",
      body:["<b>1. Bảo vệ dải ô chứa công thức.</b> Chọn vùng công thức, đặt quyền chỉ mình bạn sửa. Đây là lớp phòng thủ quan trọng nhất.","<b>2. Dùng Data Validation.</b> Bắt người dùng chọn từ danh sách thay vì gõ tự do, dữ liệu sạch ngay từ đầu.","<b>3. Tách sheet nhập liệu và sheet tính toán.</b> Người dùng chỉ thấy sheet nhập, phần tính toán ẩn đi.","<b>4. Bật thông báo thay đổi.</b> Công cụ → Quy tắc thông báo, bạn sẽ biết ai sửa gì.","<b>5. Dùng lịch sử phiên bản.</b> Đặt tên phiên bản ở các mốc quan trọng để khôi phục nhanh khi cần.","<b>6. Sao lưu định kỳ.</b> Mỗi tháng tạo một bản sao lưu đặt tên theo ngày. Mất 30 giây, nhưng có ngày sẽ cứu bạn."] }
  ],

  /* ⚠ NỘI DUNG MẪU — những lời nhận xét dưới đây do người viết website
     dựng ra để minh hoạ bố cục, KHÔNG phải khách hàng thật. Trước khi
     đưa web lên chạy thật, hãy thay bằng phản hồi thật (kèm sự đồng ý
     của khách) hoặc xoá hẳn khối này cùng phần hiển thị ở index.html. */
  testimonials: [
    { name:"Trần Minh Quân", role:"Chỉ huy trưởng công trình, Đà Nẵng", emoji:"👷", stars:5,
      text:"Trước đây tôi theo dõi tiến độ bằng ba file Excel rời rạc, cuối tháng ngồi ráp số mất cả buổi. Dùng Web App dự án được bốn tháng thì báo cáo tuần chỉ còn mất 15 phút." },
    { name:"Nguyễn Thu Hà", role:"Kế toán trưởng, công ty thương mại", emoji:"👩‍💼", stars:5,
      text:"File dòng tiền dựng sẵn công thức khá chắc tay. Điều tôi thích nhất là phần dự báo — sếp hỏi tháng sau có đủ tiền trả nhà cung cấp không, mở file ra trả lời được ngay." },
    { name:"Lê Hoàng Nam", role:"Chủ chuỗi 3 homestay, Đà Lạt", emoji:"🏡", stars:4,
      text:"Sơ đồ phòng trực quan, nhân viên lễ tân mới học nửa buổi là dùng được. Có vài chỗ tôi nhờ chỉnh theo mô hình riêng thì bên hỗ trợ làm trong ngày." },
    { name:"Phạm Khánh Linh", role:"Sinh viên năm 3, Hà Nội", emoji:"🎒", stars:5,
      text:"Mua bộ học tập với giá bằng hai cốc trà sữa mà dùng suốt hai học kỳ. Phần tính GPA tự động đỡ hẳn việc ngồi bấm máy tính mỗi kỳ." },
    { name:"Vũ Đức Thắng", role:"Trưởng phòng kinh doanh, ngành ô tô", emoji:"🧑‍💼", stars:5,
      text:"CRM ô tô giúp đội sale của tôi không bỏ sót lịch bảo dưỡng của khách. Doanh thu dịch vụ quý vừa rồi tăng rõ so với cùng kỳ." },
    { name:"Đỗ Thanh Mai", role:"Chủ shop online", emoji:"🛍️", stars:4,
      text:"Gộp đơn ba sàn về một file, cuối tháng biết chính xác lãi thực bao nhiêu sau phí sàn. Trước toàn ước chừng nên tưởng lãi mà hoá ra không." }
  ],

  faqs: [
    { q:"Mua xong tôi nhận sản phẩm bằng cách nào?",
      a:"Sau khi thanh toán được xác nhận, bạn nhận link bản sao file Google Sheets (hoặc bản cài đặt Web App) qua email đã đăng ký, thường trong vòng 30 phút giờ hành chính." },
    { q:"Tôi có cần biết công thức nâng cao để dùng không?",
      a:"Không. Mọi công thức đã được dựng sẵn và khoá lại, bạn chỉ nhập dữ liệu vào các vùng được đánh dấu. Mỗi sản phẩm đều kèm hướng dẫn từng bước." },
    { q:"File có dùng được trên điện thoại không?",
      a:"Có. Tất cả sản phẩm đều chạy trên ứng dụng Google Sheets cho Android/iOS. Riêng nhóm Web App có giao diện tối ưu cho màn hình nhỏ." },
    { q:"Tôi có được chỉnh sửa file theo nhu cầu riêng không?",
      a:"Được. Bạn toàn quyền chỉnh sửa bản sao của mình. Nếu cần tuỳ biến sâu, chúng tôi nhận thiết kế riêng theo yêu cầu với chi phí báo trước." },
    { q:"Chính sách hoàn tiền thế nào?",
      a:"Nếu sản phẩm lỗi kỹ thuật và chúng tôi không khắc phục được trong 7 ngày, bạn được hoàn 100%. Do là sản phẩm số nên chúng tôi không hoàn tiền vì lý do đổi ý sau khi đã nhận file." },
    { q:"Một lần mua dùng được cho bao nhiêu người?",
      a:"Giấy phép mặc định dành cho một cá nhân hoặc một doanh nghiệp. Bạn được chia sẻ file cho nhân viên trong nội bộ, nhưng không bán lại hay phân phối ra ngoài." }
  ]
};
