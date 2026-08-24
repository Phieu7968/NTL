/**
 * teamhoc.shop — nhận đơn hàng và yêu cầu tư vấn từ website
 *
 * Việc của file này: nhận dữ liệu website gửi lên, ghi thành một dòng
 * trong Google Sheet và gửi email báo cho chủ shop.
 *
 * Cách cài đặt: xem apps-script/HUONG-DAN.md
 */

/* ====================== CẤU HÌNH ====================== */

var CAU_HINH = {
  // Email nhận thông báo khi có đơn mới. Để trống thì gửi về chính chủ script.
  EMAIL_NHAN: "",

  // Chuỗi bí mật — phải TRÙNG với orderToken trong data/products.js.
  // Đây chỉ là hàng rào chặn spam vặt, không phải bảo mật thật:
  // ai xem mã nguồn trang web cũng đọc được chuỗi này.
  TOKEN: "doi-chuoi-nay-di",

  // Có gửi email xác nhận cho khách không.
  // Lưu ý: tài khoản Gmail thường chỉ gửi được khoảng 100 email/ngày.
  GUI_MAIL_CHO_KHACH: true,

  TEN_SHOP: "teamhoc.shop",
  HOTLINE: "0372 837 968"
};

var COT = ["Thời gian", "Loại", "Mã đơn", "Họ tên", "Điện thoại", "Email",
           "Đơn vị", "Sản phẩm", "Số tiền", "Mã giảm giá", "Thanh toán",
           "Hoá đơn", "Ghi chú", "Trạng thái", "Đã giao file"];

/* ====================== NHẬN DỮ LIỆU ====================== */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return traLoi(false, "Không có dữ liệu");

    var d = JSON.parse(e.postData.contents);

    if (String(d.token || "") !== String(CAU_HINH.TOKEN)) {
      return traLoi(false, "Sai mã bảo vệ");
    }

    var loai = d.loai === "tu-van" ? "Tư vấn" : "Đơn hàng";
    var sheet = laySheet(loai === "Tư vấn" ? "Tư vấn" : "Đơn hàng");

    sheet.appendRow([
      new Date(),
      loai,
      d.maDon || "",
      d.hoTen || "",
      "'" + (d.dienThoai || ""),      // dấu ' để Sheets giữ nguyên số 0 đầu
      d.email || "",
      d.donVi || "",
      d.sanPham || "",
      Number(d.soTien || 0),
      d.maGiamGia || "",
      d.thanhToan || "",
      d.hoaDon || "",
      d.ghiChu || "",
      loai === "Tư vấn" ? "Chưa liên hệ" : "Chờ chuyển khoản",
      false
    ]);

    guiMailChoShop(loai, d);
    if (CAU_HINH.GUI_MAIL_CHO_KHACH && d.email) guiMailChoKhach(loai, d);

    return traLoi(true, "Đã ghi nhận", d.maDon || "");
  } catch (err) {
    // Ghi lại lỗi để chủ shop xem trong Executions, nhưng không lộ chi tiết ra ngoài
    console.error(err);
    return traLoi(false, "Lỗi máy chủ");
  }
}

/** Mở bằng trình duyệt để kiểm tra script đã deploy chưa. */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font:16px/1.6 system-ui;padding:2rem;max-width:34rem">' +
    '<h2 style="margin:0 0 .5rem">✅ Script nhận đơn đang chạy</h2>' +
    '<p>Đây là điểm nhận đơn hàng của <b>' + CAU_HINH.TEN_SHOP + '</b>.</p>' +
    '<p>Dán đúng địa chỉ của trang này vào <code>orderEndpoint</code> ' +
    'trong <code>data/products.js</code>.</p></div>'
  );
}

/* ====================== HÀM PHỤ ====================== */

function traLoi(ok, thongBao, maDon) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, message: thongBao, maDon: maDon || "" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function laySheet(ten) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ten);
  if (!sheet) sheet = ss.insertSheet(ten);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COT);
    var h = sheet.getRange(1, 1, 1, COT.length);
    h.setFontWeight("bold").setBackground("#7c3aed").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(8, 300);
    sheet.setColumnWidth(13, 260);
  }
  return sheet;
}

function tienVN(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

function emailNhan() {
  return CAU_HINH.EMAIL_NHAN || Session.getEffectiveUser().getEmail();
}

function guiMailChoShop(loai, d) {
  var tieuDe = loai === "Tư vấn"
    ? "[" + CAU_HINH.TEN_SHOP + "] Yêu cầu tư vấn từ " + (d.hoTen || "khách")
    : "[" + CAU_HINH.TEN_SHOP + "] Đơn mới " + (d.maDon || "") + " — " + tienVN(d.soTien);

  var dong = [
    ["Loại", loai],
    ["Mã đơn", d.maDon],
    ["Họ tên", d.hoTen],
    ["Điện thoại", d.dienThoai],
    ["Email", d.email],
    ["Đơn vị", d.donVi],
    ["Sản phẩm", d.sanPham],
    ["Số tiền", d.soTien ? tienVN(d.soTien) : ""],
    ["Mã giảm giá", d.maGiamGia],
    ["Thanh toán", d.thanhToan],
    ["Hoá đơn", d.hoaDon],
    ["Ghi chú", d.ghiChu]
  ].filter(function (r) { return r[1]; });

  var html = '<div style="font:15px/1.65 system-ui,sans-serif;color:#1d1033">' +
    '<h2 style="color:#5b21b6;margin:0 0 1rem">' + (loai === "Tư vấn" ? "🗨️ Yêu cầu tư vấn mới" : "🛒 Đơn hàng mới") + '</h2>' +
    '<table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:600px">' +
    dong.map(function (r, i) {
      return '<tr style="background:' + (i % 2 ? "#faf8ff" : "#fff") + '">' +
        '<td style="color:#79708f;width:130px;vertical-align:top">' + r[0] + '</td>' +
        '<td style="font-weight:600">' + String(r[1]).replace(/\n/g, "<br>") + '</td></tr>';
    }).join("") +
    '</table><p style="color:#79708f;font-size:13px;margin-top:1rem">' +
    'Đã ghi vào Google Sheet. Nhớ đối chiếu khoản chuyển khoản trước khi giao file.</p></div>';

  MailApp.sendEmail({ to: emailNhan(), subject: tieuDe, htmlBody: html });
}

function guiMailChoKhach(loai, d) {
  var html, tieuDe;

  if (loai === "Tư vấn") {
    tieuDe = "Đã nhận yêu cầu tư vấn của bạn — " + CAU_HINH.TEN_SHOP;
    html = "<p>Chào " + (d.hoTen || "bạn") + ",</p>" +
      "<p>Chúng tôi đã nhận được yêu cầu của bạn và sẽ liên hệ lại trong vòng 1 ngày làm việc.</p>";
  } else {
    tieuDe = "Đơn hàng " + (d.maDon || "") + " — " + CAU_HINH.TEN_SHOP;
    html = "<p>Chào " + (d.hoTen || "bạn") + ",</p>" +
      "<p>Chúng tôi đã nhận được đơn hàng <b>" + (d.maDon || "") + "</b>.</p>" +
      "<table cellpadding='6' style='border-collapse:collapse'>" +
      "<tr><td style='color:#79708f'>Sản phẩm</td><td><b>" + (d.sanPham || "") + "</b></td></tr>" +
      "<tr><td style='color:#79708f'>Số tiền</td><td><b>" + tienVN(d.soTien) + "</b></td></tr>" +
      "<tr><td style='color:#79708f'>Nội dung chuyển khoản</td><td><b>" + (d.maDon || "") + "</b></td></tr>" +
      "</table>" +
      "<p>Sau khi khoản chuyển khoản được đối soát, chúng tôi gửi link sản phẩm về chính email này, " +
      "thường trong vòng 30 phút giờ hành chính.</p>";
  }

  html += "<p style='color:#79708f;font-size:13px'>Cần hỗ trợ, nhắn Zalo " + CAU_HINH.HOTLINE +
    ".<br>— " + CAU_HINH.TEN_SHOP + "</p>";

  try {
    MailApp.sendEmail({ to: d.email, subject: tieuDe, htmlBody: html, name: CAU_HINH.TEN_SHOP });
  } catch (err) {
    console.error("Không gửi được mail cho khách: " + err);   // không làm hỏng việc ghi đơn
  }
}

/* ====================== TỰ KIỂM TRA ====================== */

/** Chạy hàm này một lần trong trình soạn thảo để thử ghi và gửi mail. */
function thuGhiDonMau() {
  var ketQua = doPost({
    postData: {
      contents: JSON.stringify({
        token: CAU_HINH.TOKEN,
        loai: "don-hang",
        maDon: "TH-THU-NGHIEM",
        hoTen: "Khách thử nghiệm",
        dienThoai: "0372837968",
        email: emailNhan(),
        sanPham: "Việc Gọn – Bảng Điều Phối Đầu Việc x1",
        soTien: 299000,
        thanhToan: "Quét mã QR",
        ghiChu: "Dòng này do hàm thuGhiDonMau tạo ra, xoá được."
      })
    }
  });
  Logger.log(ketQua.getContent());
}
