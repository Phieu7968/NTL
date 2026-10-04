/* =====================================================================
   docvn.js — dựng văn bản hành chính theo Nghị định 30/2020/NĐ-CP
   ---------------------------------------------------------------------
   Một văn bản được mô tả bằng DỮ LIỆU, rồi kết xuất ra hai đường:
     taiWord(vb)  → tệp .doc, Word mở ra đúng thể thức
     inA4(vb)     → hộp thoại in của trình duyệt, khổ A4

   Dùng dữ liệu chứ không viết hai chuỗi HTML song song, để sửa một lần
   là cả bản in lẫn bản Word cùng đổi, không bao giờ lệch nhau.

   Thể thức theo Nghị định 30/2020/NĐ-CP, Phụ lục I:
     - Khổ A4, lề trên 20mm, dưới 20mm, trái 30mm, phải 15mm
     - Phông Times New Roman, phần nội dung cỡ 13
     - Quốc hiệu in hoa đậm, tiêu ngữ đậm có gạch dưới
     - Thụt đầu dòng 1,27cm

   KHÔNG cần thư viện nào: tệp .doc thật ra là HTML kèm chú thích mso-*,
   Word đọc được. Nhờ vậy giữ được tính chất chạy khi không có mạng.
   ===================================================================== */
window.CV = window.CV || {};

CV.docvn = (function () {
  "use strict";
  const U = CV.util;

  /* ---------- an toàn ---------- */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /** Cho phép xuống dòng trong một đoạn, nhưng vẫn chặn thẻ HTML. */
  function escLn(v) { return esc(v).replace(/\n/g, "<br>"); }

  /* ---------- ngày tháng kiểu văn bản ---------- */
  function ngayThang(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) return ngayThang(null);
    const hai = (n) => (n < 10 ? "0" + n : String(n));
    return "ngày " + hai(d.getDate()) + " tháng " + hai(d.getMonth() + 1) +
           " năm " + d.getFullYear();
  }

  /* ================= các khối trong thân văn bản ================= */
  /* Dùng trong mảng `than` của văn bản. */

  const muc    = (so, ten)        => ({ t: "muc", so, ten });
  const muc2   = (so, ten)        => ({ t: "muc2", so, ten });
  const doan   = (text)           => ({ t: "doan", text });
  const dong   = (text)           => ({ t: "dong", text });
  const gach   = (items)          => ({ t: "gach", items });
  const bang   = (cols, rows, o)  => Object.assign({ t: "bang", cols, rows }, o || {});
  const trong  = (cao)            => ({ t: "trong", cao: cao || 10 });
  const sangTrang = ()            => ({ t: "sangTrang" });
  const oTrong = (nhan, so)       => ({ t: "oTrong", nhan, so: so || 1 });

  /* ================= kết xuất thân ================= */

  function veBang(b) {
    const cols = b.cols || [];
    let h = '<table class="bang">';
    if (b.tieuDe) {
      h += '<caption class="bang-ten">' + esc(b.tieuDe) + "</caption>";
    }
    h += "<thead><tr>";
    cols.forEach((c) => {
      h += '<th style="width:' + (c.rong || "auto") + ";text-align:" +
           (c.canTrai ? "left" : "center") + '">' + esc(c.ten) + "</th>";
    });
    h += "</tr></thead><tbody>";
    (b.rows || []).forEach((r) => {
      h += "<tr>";
      cols.forEach((c, i) => {
        const v = Array.isArray(r) ? r[i] : r[c.key];
        h += '<td style="text-align:' +
             (c.canPhai ? "right" : c.canTrai ? "left" : "center") + '">' +
             escLn(v) + "</td>";
      });
      h += "</tr>";
    });
    if (!(b.rows || []).length) {
      h += '<tr><td colspan="' + cols.length +
           '" style="text-align:center;font-style:italic">(Không có dữ liệu)</td></tr>';
    }
    h += "</tbody></table>";
    if (b.ghiChu) h += '<p class="bang-ghi-chu">' + escLn(b.ghiChu) + "</p>";
    return h;
  }

  function veKhoi(b) {
    switch (b.t) {
      case "muc":
        return '<p class="muc-lon">' + esc(b.so) + ". " + esc(b.ten).toUpperCase() + "</p>";
      case "muc2":
        return '<p class="muc-nho">' + esc(b.so) + ". " + esc(b.ten) + "</p>";
      case "doan":
        return '<p class="than-doan">' + escLn(b.text) + "</p>";
      case "dong":
        return '<p class="than-dong">' + escLn(b.text) + "</p>";
      case "gach":
        return (b.items || []).map((x) =>
          '<p class="than-gach">- ' + escLn(x) + "</p>").join("");
      case "bang":
        return veBang(b);
      case "trong":
        return '<div style="height:' + Number(b.cao) + 'pt"></div>';
      case "sangTrang":
        return '<div style="page-break-before:always;mso-break-type:page-break"></div>';
      case "oTrong":
        return '<p class="than-dong">' + esc(b.nhan) + " " +
               ".".repeat(Math.max(10, Number(b.so) * 30)) + "</p>";
      default:
        return "";
    }
  }

  /* ================= phần đầu và phần cuối ================= */

  /**
   * Tên cơ quan dài thì tự xuống dòng ở chỗ xấu (ví dụ rớt mỗi chữ "TÂY").
   * Hàm này chủ động ngắt ở ranh giới từ gần giữa nhất, cho hai dòng cân nhau.
   * Trả về chuỗi ĐÃ escape, có thể kèm thẻ <br>.
   */
  function ngatCanDoi(text, nguong) {
    const t = String(text || "").trim();
    const max = nguong || 26;
    if (t.length <= max) return esc(t);
    const tu = t.split(/\s+/);
    if (tu.length < 2) return esc(t);
    const giua = t.length / 2;
    let tot = 1, lech = Infinity;
    for (let i = 1; i < tu.length; i++) {
      const dai = tu.slice(0, i).join(" ").length;
      const d = Math.abs(dai - giua);
      if (d < lech) { lech = d; tot = i; }
    }
    return esc(tu.slice(0, tot).join(" ")) + "<br>" + esc(tu.slice(tot).join(" "));
  }

  function veDau(vb) {
    const cq = vb.coQuan || {};
    let trai = "";
    if (cq.tren) {
      trai += '<p class="cq-tren">' + ngatCanDoi(String(cq.tren).toUpperCase()) + "</p>";
    }
    if (cq.chinh) {
      trai += '<p class="cq-chinh">' + ngatCanDoi(String(cq.chinh).toUpperCase()) + "</p>";
    }
    trai += '<div class="gach-cq"></div>';
    if (vb.so) trai += '<p class="so-vb">Số: ' + esc(vb.so) + "</p>";

    return '' +
      '<table class="kh-dau"><tr>' +
        '<td class="kh-trai">' + trai + "</td>" +
        '<td class="kh-phai">' +
          '<p class="quoc-hieu">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>' +
          '<p class="tieu-ngu">Độc lập - Tự do - Hạnh phúc</p>' +
          '<div class="gach-tn"></div>' +
          '<p class="dia-danh">' + esc(vb.diaDanh || "Vĩnh Long") + ", " +
            esc(ngayThang(vb.ngay)) + "</p>" +
        "</td>" +
      "</tr></table>";
  }

  function veTieuDe(vb) {
    let h = '<div class="kh-ten">';
    h += '<p class="loai-vb">' + esc(vb.loai || "").toUpperCase() + "</p>";
    if (vb.trichYeu) h += '<p class="trich-yeu">' + escLn(vb.trichYeu) + "</p>";
    if (vb.ghiChuTen) h += '<p class="ghi-chu-ten">' + escLn(vb.ghiChuTen) + "</p>";
    h += "</div>";
    return h;
  }

  function veKinhGui(ds) {
    if (!ds || !ds.length) return "";
    return '<table class="kh-kg"><tr>' +
      '<td class="kg-nhan"><p class="than-dong"><b>Kính gửi:</b></p></td>' +
      '<td class="kg-ds">' + ds.map((x, i) =>
        '<p class="than-dong">- ' + escLn(x) + (i === ds.length - 1 ? "." : ";") + "</p>"
      ).join("") + "</td>" +
    "</tr></table>";
  }

  function veCuoi(vb) {
    // Văn bản tự dựng khối ký riêng (ví dụ biên bản ký đôi) thì bỏ khối này.
    if (!vb.kyTen && !(vb.noiNhan && vb.noiNhan.length)) return "";
    const k = vb.kyTen || {};
    const nn = vb.noiNhan || [];
    const trai = nn.length
      ? '<p class="nn-nhan">Nơi nhận:</p>' + nn.map((x, i) =>
          '<p class="nn-dong">- ' + escLn(x) + (i === nn.length - 1 ? "." : ";") + "</p>").join("")
      : "";
    const phai = '' +
      '<p class="ky-chuc">' + esc(k.chucDanh || "").toUpperCase() + "</p>" +
      '<p class="ky-ghi">' + esc(k.ghiChu || "(Ký và ghi rõ họ tên)") + "</p>" +
      '<div class="ky-cho"></div>' +
      '<p class="ky-ten">' + esc(k.hoTen || "") + "</p>" +
      (k.lienHe ? '<p class="ky-lien-he">' + esc(k.lienHe) + "</p>" : "");

    return '<table class="kh-cuoi"><tr>' +
      '<td class="cuoi-trai">' + trai + "</td>" +
      '<td class="cuoi-phai">' + phai + "</td>" +
    "</tr></table>";
  }

  /* ================= kiểu chữ dùng chung ================= */
  /* Một bộ duy nhất cho cả bản in lẫn bản Word, để hai bên không lệch nhau. */

  function kieuChung() {
    return `
      body { font-family:'Times New Roman',Times,serif; font-size:13pt; line-height:1.3;
             color:#000; background:#fff; margin:0; padding:0; }
      p { margin:0 0 3pt 0; line-height:1.3; font-size:13pt; mso-pagination:widow-orphan; }
      table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }

      /* --- phần đầu --- */
      .kh-dau { width:100%; table-layout:fixed; margin-bottom:10pt; border:none; }
      .kh-dau td { border:none; vertical-align:top; padding:0; text-align:center; }
      /* Bề ngang còn lại sau lề NĐ 30 là 165mm. Quốc hiệu là chữ luật định,
         KHÔNG được vỡ dòng, nên dành cho nó 55% và khoá white-space.
         Tên cơ quan dài thì xuống dòng được — văn bản thật vẫn hay như vậy. */
      .kh-trai { width:45%; padding-right:8pt !important; }
      .kh-phai { width:55%; }
      /* Giữ cỡ 12 đúng Nghị định 30 cho tên cơ quan. Tên dài thì ngắt dòng
         cân đối bằng ngatCanDoi() chứ không hạ cỡ chữ. */
      .cq-tren { font-size:12pt; line-height:1.2; }
      .cq-chinh { font-size:12pt; font-weight:bold; line-height:1.2; }
      .so-vb { font-size:13pt; margin-top:2pt; }
      .quoc-hieu { font-size:12pt; font-weight:bold; text-transform:uppercase;
                   white-space:nowrap; }
      .tieu-ngu { font-size:13pt; font-weight:bold; margin-top:1pt; white-space:nowrap; }
      .dia-danh { font-size:13pt; font-style:italic; margin-top:3pt; }
      .gach-cq { width:70pt; border-top:0.75pt solid #000; margin:5pt auto 2pt auto;
                 height:0; font-size:0; line-height:0; }
      .gach-tn { width:150pt; border-top:1pt solid #000; margin:3pt auto 2pt auto;
                 height:0; font-size:0; line-height:0; }

      /* --- tên văn bản --- */
      .kh-ten { text-align:center; margin:14pt 0 10pt 0; page-break-after:avoid; }
      .loai-vb { font-size:14pt; font-weight:bold; text-transform:uppercase; }
      .trich-yeu { font-size:13pt; font-weight:bold; margin-top:2pt; }
      .ghi-chu-ten { font-size:12pt; font-style:italic; margin-top:2pt; }

      /* --- kính gửi --- */
      .kh-kg { width:100%; table-layout:fixed; margin:8pt 0 10pt 0; border:none; }
      .kh-kg td { border:none; vertical-align:top; padding:0; }
      .kg-nhan { width:16%; }
      .kg-ds { width:84%; }

      /* --- thân --- */
      .muc-lon { font-size:13pt; font-weight:bold; margin:9pt 0 4pt 0;
                 page-break-after:avoid; }
      .muc-nho { font-size:13pt; font-weight:bold; font-style:italic;
                 margin:6pt 0 3pt 0; page-break-after:avoid; }
      .than-doan { text-align:justify; text-indent:1.27cm; margin-bottom:4pt; }
      .than-dong { text-align:left; text-indent:0; margin-bottom:3pt; }
      .than-gach { text-align:left; text-indent:0; margin:0 0 2.5pt 10pt; }

      /* --- bảng dữ liệu --- */
      .bang { width:100%; margin:5pt 0 7pt 0; border:0.75pt solid #000;
              table-layout:fixed; }
      .bang th, .bang td { border:0.75pt solid #000; padding:3pt 4pt;
                           font-size:12pt; vertical-align:top;
                           word-wrap:break-word; overflow-wrap:break-word; }
      .bang th { font-weight:bold; background:#eceff4; text-align:center; }
      .bang-ten { caption-side:top; font-size:12.5pt; font-weight:bold;
                  text-align:center; padding-bottom:3pt; }
      .bang-ghi-chu { font-size:11pt; font-style:italic; margin-top:2pt; }
      tr { page-break-inside:avoid; }
      thead { display:table-header-group; }

      /* --- phần cuối --- */
      .kh-cuoi { width:100%; table-layout:fixed; margin-top:16pt;
                 page-break-inside:avoid; border:none; }
      .kh-cuoi td { border:none; vertical-align:top; padding:0; }
      .cuoi-trai { width:46%; text-align:left; }
      .cuoi-phai { width:54%; text-align:center; }
      .nn-nhan { font-size:11pt; font-weight:bold; font-style:italic; margin-bottom:3pt; }
      .nn-dong { font-size:10.5pt; margin-bottom:2pt; }
      .ky-chuc { font-size:12.5pt; font-weight:bold; text-transform:uppercase; }
      .ky-ghi { font-size:11pt; font-style:italic; margin-top:1pt; }
      .ky-cho { height:48pt; }
      .ky-ten { font-size:12.5pt; font-weight:bold; }
      .ky-lien-he { font-size:10pt; color:#333; margin-top:1pt; }
    `;
  }

  /** Ghép toàn bộ phần thân của một văn bản. */
  function veThan(vb) {
    return veDau(vb) + veTieuDe(vb) + veKinhGui(vb.kinhGui) +
      (vb.than || []).map(veKhoi).join("") + veCuoi(vb);
  }

  /* ================= xuất ra tệp Word ================= */

  function htmlWord(vb) {
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40"><head>' +
      '<meta charset="utf-8">' +
      "<title>" + esc(vb.loai || "Văn bản") + "</title>" +
      "<!--[if gte mso 9]><xml><w:WordDocument>" +
        "<w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>" +
        "<w:Compatibility><w:BreakWrappedTables/><w:SnapToGridInCell/>" +
        "<w:WrapTextWithPunct/><w:UseAsianBreakRules/><w:DontGrowAutofit/>" +
        "</w:Compatibility></w:WordDocument></xml><![endif]-->" +
      "<style>" +
        "@page Section1 { size:595.3pt 841.9pt; " +
        /* NĐ 30: trên 20mm, phải 15mm, dưới 20mm, trái 30mm */
        "margin:56.7pt 42.5pt 56.7pt 85.0pt; " +
        "mso-header-margin:36pt; mso-footer-margin:36pt; mso-paper-source:0; }" +
        "div.Section1 { page:Section1; }" +
        kieuChung() +
      "</style></head><body><div class=\"Section1\">" +
      veThan(vb) +
      "</div></body></html>";
  }

  /** Đặt tên tệp cho gọn: bỏ dấu, thay khoảng trắng bằng gạch dưới. */
  function tenTep(vb) {
    const g = (vb.tenTep || vb.loai || "van-ban") + " " +
              (vb.hauTo || U.todayISO());
    return U.fold(g).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") + ".doc";
  }

  function taiWord(vb) {
    const blob = new Blob(["﻿", htmlWord(vb)],
      { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tenTep(vb);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  /* ================= in ra giấy ================= */

  function htmlIn(vb) {
    return "<!DOCTYPE html><html lang=\"vi\"><head><meta charset=\"utf-8\">" +
      "<title>" + esc(vb.loai || "Văn bản") + "</title><style>" +
      "@page { size:A4 portrait; margin:20mm 15mm 20mm 30mm; }" +
      "@media print { body { margin:0; } }" +
      kieuChung() +
      "body { padding:0; }" +
      "</style></head><body>" + veThan(vb) + "</body></html>";
  }

  /**
   * In qua một khung riêng, không dùng CSS của ứng dụng. Nhờ vậy trang in
   * đúng thể thức văn bản chứ không mang theo màu sắc và bố cục giao diện.
   */
  function inA4(vb) {
    const cu = document.getElementById("khung-in-vb");
    if (cu) cu.remove();
    const f = document.createElement("iframe");
    f.id = "khung-in-vb";
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    f.srcdoc = htmlIn(vb);
    f.onload = function () {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (e) {
        console.error("Không mở được hộp thoại in:", e);
        if (CV.ui) CV.ui.toast("Không mở được hộp thoại in. Thử tải bản Word.", "warn");
      }
      // Giữ lại một lúc: vài trình duyệt gỡ khung quá sớm thì huỷ luôn lệnh in.
      setTimeout(() => { const x = document.getElementById("khung-in-vb"); if (x) x.remove(); }, 60000);
    };
    document.body.appendChild(f);
  }

  /** Xem thử trong một cửa sổ mới, để kiểm tra trước khi in hoặc tải. */
  function xemThu(vb) {
    const w = window.open("", "_blank");
    if (!w) {
      if (CV.ui) CV.ui.toast("Trình duyệt chặn cửa sổ mới. Cho phép rồi thử lại.", "warn");
      return null;
    }
    w.document.write(htmlIn(vb));
    w.document.close();
    return w;
  }

  return {
    // khối dựng
    muc, muc2, doan, dong, gach, bang, trong, sangTrang, oTrong,
    // kết xuất
    taiWord, inA4, xemThu, htmlWord, htmlIn, tenTep,
    // dùng lại khi cần
    esc, escLn, ngayThang, ngatCanDoi
  };
})();
