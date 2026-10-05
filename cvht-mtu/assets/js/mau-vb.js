/* =====================================================================
   mau-vb.js — các mẫu văn bản của công tác cố vấn học tập
   ---------------------------------------------------------------------
   Mỗi hàm trả về một VĂN BẢN dạng dữ liệu, rồi giao cho CV.docvn kết
   xuất ra Word hoặc ra máy in. Không hàm nào tự vẽ HTML.

   Căn cứ:
     - Nghị định 30/2020/NĐ-CP (thể thức văn bản hành chính)
     - Quyết định 758/QĐ-ĐHXDMT (công tác CVHT và GVCN)
     - Quyết định 724/QĐ-ĐHXDMT (ban cán sự lớp)
   ===================================================================== */
window.CV = window.CV || {};

CV.mauVb = (function () {
  "use strict";
  const U = CV.util, S = CV.store, A = CV.academic, D = CV.docvn;

  /* ---------- phần đầu dùng chung ---------- */

  /**
   * Khối tên cơ quan ở góc trái phần đầu, tối đa ba dòng:
   *     TRƯỜNG ĐHXD MIỀN TÂY        ← cấp trên, chữ thường
   *     KHOA XÂY DỰNG               ← cấp trên, chữ thường
   *     BAN CỐ VẤN HỌC TẬP          ← nơi ban hành, in đậm
   *
   * Nghị định 30 Phụ lục I chỉ nói tới hai dòng (cơ quan chủ quản và cơ quan
   * ban hành). Dòng thứ ba là theo thực tế công tác: văn bản do Ban Cố vấn
   * học tập của Khoa phát hành. Bỏ trống mục nào thì dòng đó không in.
   *
   * Tên dài thì docvn.vuaMotDong() viết tắt vài từ cho vừa một dòng, chứ
   * không cắt nghĩa; tên đủ ngắn thì giữ nguyên ở cỡ 12 đúng chuẩn.
   */
  function coQuan() {
    const s = S.settings();
    const gon = (x) => CV.docvn.vuaMotDong((x || "").trim());
    // Thầy/Cô tự khai cách viết tên Trường thì dùng y nguyên, không tự sửa.
    const truong = (s.schoolNameDoc || "").trim() || gon(s.schoolName);
    const khoa = gon(s.facultyName);
    const ban = gon(s.banBanHanh);

    if (ban)  return { tren: truong, giua: khoa, chinh: ban };
    if (khoa) return { tren: truong, giua: "",   chinh: khoa };
    return { tren: "", giua: "", chinh: truong };
  }

  /** Đơn vị công tác ghi trong thân văn bản, dùng đúng giá trị như phần đầu. */
  function donViCongTac() {
    const s = S.settings();
    return [ (s.banBanHanh || "").trim(),
             (s.facultyName || "").trim(),
             (s.schoolName || "").trim() ]
      .filter(Boolean).join(", ") || "……………………";
  }

  function nguoiKy(advisor, chucDanh) {
    const a = advisor || {};
    return {
      chucDanh: chucDanh || "CỐ VẤN HỌC TẬP",
      hoTen: [a.title, a.name].filter(Boolean).join(" ") || a.name || "",
      lienHe: [a.phone && ("Điện thoại: " + a.phone), a.email && ("Email: " + a.email)]
        .filter(Boolean).join("  |  ")
    };
  }

  /** Cố vấn phụ trách một lớp, dùng để ký văn bản. */
  function cvhtCua(klass) {
    if (!klass) return null;
    return S.get("advisors", klass.advisorId) || S.get("advisors", klass.gvcnId) || null;
  }

  const svCuaLop = (classId) =>
    U.sortBy(S.find("students", (x) => x.classId === classId && x.active !== false),
      (x) => U.fold(x.name || ""));

  const tenLop = (k) => (k ? (k.code || "") + (k.name ? " — " + k.name : "") : "—");

  /**
   * Dòng "số sinh viên có mặt" của biên bản.
   * Số dự lớn hơn sĩ số là dữ liệu sai. Văn bản hành chính thì KHÔNG được
   * lặng lẽ in con số vô lý rồi để người ký phát hiện sau — nêu thẳng ra
   * để sửa trước khi ký.
   */
  function soCoMat(m, siSo) {
    const v = m.attended;
    if (v == null || v === "") return "……… sinh viên";
    const n = Number(v);
    if (!isFinite(n) || n < 0) return "……… sinh viên";
    if (siSo && n > siSo) {
      return n + " sinh viên  [SỐ LIỆU CẦN KIỂM TRA LẠI: lớn hơn sĩ số " +
             siSo + " — sửa lại trong Sổ họp lớp trước khi ký]";
    }
    return n + " sinh viên" + (siSo ? "  (vắng " + (siSo - n) + ")" : "");
  }

  /* =====================================================================
     1. BIÊN BẢN SINH HOẠT LỚP
     Quyết định 758, Điều 9: mỗi học kỳ họp lớp tối thiểu 4 lần, mỗi buổi
     phải có biên bản. Kèm luôn phiếu điểm danh để ký tại chỗ.
     ===================================================================== */

  function bienBanHopLop(meetingId, opts) {
    const m = S.get("meetings", meetingId);
    if (!m) return null;
    const k = S.get("classes", m.classId);
    const sem = m.semesterId ? S.get("semesters", m.semesterId) : null;
    const adv = cvhtCua(k);
    const ds = svCuaLop(m.classId);
    const coDiemDanh = !opts || opts.kemDiemDanh !== false;

    const than = [
      D.dong("Hôm nay, " + D.ngayThang(m.date) + ", tại " +
        (m.place || "…………………………………") + ", lớp " + tenLop(k) +
        " tiến hành họp lớp định kỳ theo quy định về công tác cố vấn học tập."),
      D.trong(4),

      D.muc("I", "Thành phần tham dự"),
      D.gach([
        "Chủ trì: " + (adv ? [adv.title, adv.name].filter(Boolean).join(" ") : "……………………") +
          ", cố vấn học tập lớp " + (k ? k.code : ""),
        "Thư ký: ……………………………………………………………",
        "Sĩ số lớp: " + ds.length + " sinh viên",
        "Số sinh viên có mặt: " + soCoMat(m, ds.length),
        "Hình thức: " + (m.format || "Trực tiếp") +
          (m.kind ? "  |  Loại buổi họp: " + m.kind : "")
      ]),

      D.muc("II", "Nội dung sinh hoạt"),
      m.content ? D.doan(m.content) : D.dong("…………………………………………………………………………"),

      D.muc("III", "Diễn biến và ý kiến trao đổi"),
      m.minutes ? D.doan(m.minutes)
        : D.dong("…………………………………………………………………………………………\n" +
                 "…………………………………………………………………………………………\n" +
                 "…………………………………………………………………………………………"),

      D.muc("IV", "Kết luận của cố vấn học tập"),
      D.dong("…………………………………………………………………………………………"),
      D.dong("…………………………………………………………………………………………"),
      D.trong(6),
      D.dong("Buổi họp kết thúc lúc ……… giờ ……… cùng ngày. Biên bản được đọc lại " +
             "cho toàn thể sinh viên dự họp cùng nghe và thống nhất thông qua.")
    ];

    if (coDiemDanh && ds.length) {
      than.push(D.sangTrang());
      than.push(D.muc("V", "Phiếu điểm danh"));
      than.push(D.bang(
        [
          { ten: "STT", rong: "7%" },
          { ten: "Họ và tên", rong: "33%", canTrai: true },
          { ten: "Mã số SV", rong: "17%" },
          { ten: "Chức vụ", rong: "18%", canTrai: true },
          { ten: "Có mặt", rong: "12%" },
          { ten: "Ký tên", rong: "13%" }
        ],
        ds.map((x, i) => [String(i + 1), x.name || "", x.mssv || "", x.cadreRole || "", "", ""]),
        { tieuDe: "DANH SÁCH ĐIỂM DANH SINH HOẠT LỚP " + (k ? k.code : ""),
          ghiChu: "Sinh viên có mặt đánh dấu X vào cột “Có mặt” và ký tên xác nhận." }
      ));
    }

    // Biên bản thì hai bên cùng ký: chủ trì và thư ký.
    than.push(D.trong(10));
    than.push({ t: "bang", cols: [
        { ten: "THƯ KÝ", rong: "50%" },
        { ten: "CHỦ TRÌ — CỐ VẤN HỌC TẬP", rong: "50%" }
      ],
      rows: [["(Ký và ghi rõ họ tên)\n\n\n\n", "(Ký và ghi rõ họ tên)\n\n\n\n" +
              (adv ? [adv.title, adv.name].filter(Boolean).join(" ") : "")]]
    });

    return {
      coQuan: coQuan(),
      diaDanh: (S.settings().diaDanh || "Vĩnh Long"),
      ngay: m.date,
      loai: "BIÊN BẢN",
      trichYeu: "Họp lớp " + (k ? k.code : "") +
        (sem ? " — " + (sem.name || "") : ""),
      than,
      // Biên bản dùng khối ký đôi ở trên nên bỏ khối ký mặc định.
      kyTen: null,
      noiNhan: null,
      tenTep: "Bien ban hop lop " + (k ? k.code : ""),
      hauTo: m.date || U.todayISO()
    };
  }

  /* =====================================================================
     2. PHIẾU THEO DÕI KẾT QUẢ HỌC TẬP CÁ NHÂN
     Giao cho sinh viên hoặc kẹp vào hồ sơ lớp.
     ===================================================================== */

  function phieuHocTap(studentId) {
    const p = A.profileOf(studentId);
    if (!p) return null;
    const st = p.student, k = p.klass, adv = cvhtCua(k);
    const diem = U.sortBy(S.find("scores", (r) => r.studentId === st.id),
      (r) => (r.semesterId || "") + (r.subjectCode || ""));
    // Dùng MÃ học kỳ cho gọn cột; không có mã thì mới lấy tên đầy đủ.
    const semTen = (id) => {
      const s = id ? S.get("semesters", id) : null;
      return s ? (s.code || s.name || "") : "";
    };

    const than = [
      D.muc("I", "Thông tin sinh viên"),
      D.bang(
        [{ ten: "Nội dung", rong: "38%", canTrai: true }, { ten: "Thông tin", rong: "62%", canTrai: true }],
        [
          ["Họ và tên", st.name || ""],
          ["Mã số sinh viên", st.mssv || ""],
          ["Ngày sinh", U.dmy(st.dob) || ""],
          ["Lớp", tenLop(k)],
          ["Chức vụ trong lớp", st.cadreRole || "Không giữ chức vụ"],
          ["Cố vấn học tập", adv ? [adv.title, adv.name].filter(Boolean).join(" ") : "—"]
        ]
      ),

      D.muc("II", "Kết quả học tập tích luỹ"),
      D.bang(
        [{ ten: "Chỉ số", rong: "46%", canTrai: true }, { ten: "Giá trị", rong: "54%", canTrai: true }],
        [
          ["Điểm trung bình tích luỹ (hệ 4)", U.num(p.stats.gpa4)],
          ["Điểm trung bình tích luỹ (hệ 10)", U.num(p.stats.gpa10)],
          ["Số tín chỉ tích luỹ", String(p.stats.earnedCredits)],
          ["Số tín chỉ còn nợ", String(p.stats.debtCredits)],
          ["Xếp loại học lực", (p.learning && p.learning.label) || "—"],
          ["Điểm rèn luyện trung bình", U.num(p.stats.conductAvg, 1)],
          ["Xếp loại rèn luyện", (p.conduct && p.conduct.label) || "—"],
          ["Mức cảnh báo học vụ", (p.warning && p.warning.label) || "—"]
        ],
        { ghiChu: p.warning && p.warning.reasons && p.warning.reasons.length
            ? "Căn cứ xét cảnh báo: " + p.warning.reasons.join("; ") + "." : "" }
      ),

      D.muc("III", "Kết quả từng học phần"),
      D.bang(
        [
          { ten: "STT", rong: "6%" },
          { ten: "Học kỳ", rong: "14%", canTrai: true },
          { ten: "Mã HP", rong: "16%" },
          { ten: "Tên học phần", rong: "35%", canTrai: true },
          { ten: "TC", rong: "7%" },
          { ten: "Hệ 10", rong: "10%" },
          { ten: "Điểm chữ", rong: "12%" }
        ],
        diem.map((r, i) => [
          String(i + 1), semTen(r.semesterId), r.subjectCode || "", r.subjectName || "",
          String(r.credits == null ? "" : r.credits), U.num(r.score10, 1),
          ((A.toGrade(r.score10) || {}).letter) || ""
        ]),
        { ghiChu: "Thang điểm áp dụng: " + A.scaleSummary() }
      ),

      D.muc("IV", "Ý kiến của cố vấn học tập"),
      D.dong("…………………………………………………………………………………………"),
      D.dong("…………………………………………………………………………………………"),
      D.dong("…………………………………………………………………………………………")
    ];

    return {
      coQuan: coQuan(),
      diaDanh: S.settings().diaDanh || "Vĩnh Long",
      ngay: U.todayISO(),
      loai: "PHIẾU THEO DÕI KẾT QUẢ HỌC TẬP",
      trichYeu: (st.name || "") + " — " + (st.mssv || ""),
      than,
      kyTen: nguoiKy(adv),
      noiNhan: ["Sinh viên (để biết)", "Lưu: Hồ sơ cố vấn học tập"],
      tenTep: "Phieu hoc tap " + (st.mssv || st.name || ""),
      hauTo: U.todayISO()
    };
  }

  /* =====================================================================
     3. BÁO CÁO CÔNG TÁC CỐ VẤN HỌC TẬP
     Quyết định 758, Điều 13. Thể thức theo Nghị định 30/2020/NĐ-CP.
     ===================================================================== */

  function baoCaoCongTac(classId, opts) {
    const o = opts || {};
    const k = S.get("classes", classId);
    if (!k) return null;
    const adv = cvhtCua(k);
    const ds = svCuaLop(classId);
    const tk = A.summarize(ds);
    const sem = o.semesterId ? S.get("semesters", o.semesterId) : null;
    const kyBaoCao = o.kyBaoCao || (sem ? sem.name : "") || "";

    const hop = U.sortBy(S.find("meetings", (m) => m.classId === classId &&
      (!o.semesterId || m.semesterId === o.semesterId)), (m) => m.date || "");
    const hopCoBb = hop.filter((m) => String(m.minutes || "").trim()).length;
    const dinhMuc = (S.settings().duty || {}).meetingsPerTerm || 4;

    const canhBao = tk.rows.filter((r) => r.warning && r.warning.level !== "ok" &&
      r.warning.level !== "none");

    const than = [
      D.muc("I", "Thông tin cố vấn học tập và lớp phụ trách"),
      D.gach([
        "Họ và tên cố vấn học tập: " +
          (adv ? [adv.title, adv.name].filter(Boolean).join(" ") : "……………………"),
        "Đơn vị công tác: " + donViCongTac(),
        "Lớp phụ trách: " + tenLop(k),
        "Sĩ số lớp: " + ds.length + " sinh viên",
        "Kỳ báo cáo: " + (kyBaoCao || "……………………")
      ]),

      D.muc("II", "Tổng hợp kết quả học tập và rèn luyện"),
      D.doan("Căn cứ dữ liệu học vụ của lớp trong kỳ báo cáo, kết quả được tổng hợp như sau:"),
      D.bang(
        [
          { ten: "STT", rong: "8%" },
          { ten: "Xếp loại học lực", rong: "46%", canTrai: true },
          { ten: "Số lượng (SV)", rong: "23%" },
          { ten: "Tỷ lệ (%)", rong: "23%" }
        ],
        (function () {
          const nhan = ["Dưới 2,00", "Từ 2,00 đến dưới 2,50", "Từ 2,50 đến dưới 3,20",
                        "Từ 3,20 đến dưới 3,60", "Từ 3,60 trở lên"];
          const tong = tk.gpaBins.reduce((a, b) => a + b, 0);
          return tk.gpaBins.map((n, i) => [
            String(i + 1), nhan[i], String(n),
            tong ? U.num((n * 100) / tong, 1) : "0,0"
          ]);
        })(),
        { tieuDe: "PHÂN LOẠI HỌC LỰC THEO ĐIỂM TRUNG BÌNH TÍCH LUỸ (HỆ 4)",
          ghiChu: "Điểm trung bình chung của lớp: " + U.num(tk.gpaAvg) +
                  " (hệ 4). Tổng số tín chỉ còn nợ của cả lớp: " + tk.debtTotal + "." }
      ),

      D.muc("III", "Tình hình cảnh báo học vụ"),
      canhBao.length
        ? D.bang(
            [
              { ten: "STT", rong: "6%" },
              { ten: "Họ và tên", rong: "26%", canTrai: true },
              { ten: "Mã số SV", rong: "14%" },
              { ten: "ĐTB tích luỹ", rong: "13%" },
              { ten: "TC nợ", rong: "9%" },
              { ten: "Mức cảnh báo", rong: "32%", canTrai: true }
            ],
            canhBao.map((r, i) => [
              String(i + 1), r.student.name || "", r.student.mssv || "",
              U.num(r.stats.gpa4), String(r.stats.debtCredits),
              (r.warning && r.warning.label) || ""
            ]),
            { ghiChu: "Tổng số sinh viên thuộc diện cần theo dõi hoặc cảnh báo: " +
                      canhBao.length + "/" + ds.length + "." }
          )
        : D.doan("Trong kỳ báo cáo, lớp không có sinh viên thuộc diện cảnh báo học vụ."),

      D.muc("IV", "Công tác sinh hoạt lớp"),
      D.gach([
        "Số buổi họp lớp đã tổ chức: " + hop.length + "/" + dinhMuc +
          " buổi theo định mức tại Điều 9 Quyết định 758/QĐ-ĐHXDMT",
        "Số buổi đã có biên bản: " + hopCoBb + "/" + hop.length,
        hop.length >= dinhMuc ? "Đánh giá: đã hoàn thành định mức sinh hoạt lớp."
          : "Đánh giá: chưa đủ định mức, còn thiếu " + (dinhMuc - hop.length) + " buổi."
      ]),
      hop.length ? D.bang(
        [
          { ten: "STT", rong: "7%" },
          { ten: "Ngày họp", rong: "16%" },
          { ten: "Hình thức", rong: "15%" },
          { ten: "Số SV dự", rong: "12%" },
          { ten: "Nội dung chính", rong: "36%", canTrai: true },
          { ten: "Biên bản", rong: "14%" }
        ],
        hop.map((m, i) => [
          String(i + 1), U.dmy(m.date), m.format || "Trực tiếp",
          m.attended == null || m.attended === "" ? "" : String(m.attended),
          m.content || "", String(m.minutes || "").trim() ? "Đã có" : "Chưa có"
        ])
      ) : D.dong(""),

      D.muc("V", "Nhận xét và kiến nghị"),
      o.nhanXet ? D.doan(o.nhanXet)
        : D.dong("…………………………………………………………………………………………\n" +
                 "…………………………………………………………………………………………\n" +
                 "…………………………………………………………………………………………")
    ];

    return {
      coQuan: coQuan(),
      so: o.so || "",
      diaDanh: S.settings().diaDanh || "Vĩnh Long",
      ngay: o.ngay || U.todayISO(),
      loai: "BÁO CÁO",
      trichYeu: "Công tác cố vấn học tập lớp " + (k.code || "") +
        (kyBaoCao ? " — " + kyBaoCao : ""),
      kinhGui: o.kinhGui || [
        "Ban Giám hiệu " + (S.settings().schoolName || "Trường"),
        S.settings().facultyName || "Khoa chuyên môn",
        "Phòng Đào tạo (để phối hợp theo dõi)"
      ],
      than,
      kyTen: nguoiKy(adv),
      noiNhan: o.noiNhan || [
        "Như kính gửi",
        "Phòng Công tác sinh viên (để phối hợp)",
        "Lưu: Hồ sơ cố vấn học tập"
      ],
      tenTep: "Bao cao cong tac CVHT " + (k.code || ""),
      hauTo: U.fold(kyBaoCao || U.todayISO())
    };
  }

  /* ---------- danh mục, để màn hình liệt kê ---------- */

  const DANH_MUC = [
    { key: "bienBan", ten: "Biên bản sinh hoạt lớp",
      mo: "Kèm phiếu điểm danh để sinh viên ký tại buổi họp.",
      canCu: "Quyết định 758/QĐ-ĐHXDMT, Điều 9" },
    { key: "phieuHocTap", ten: "Phiếu theo dõi kết quả học tập",
      mo: "Hồ sơ học tập của một sinh viên: GPA, tín chỉ, điểm từng học phần.",
      canCu: "" },
    { key: "baoCao", ten: "Báo cáo công tác cố vấn học tập",
      mo: "Báo cáo kỳ về tình hình lớp, cảnh báo học vụ và sinh hoạt lớp.",
      canCu: "Quyết định 758/QĐ-ĐHXDMT, Điều 13" }
  ];

  return { bienBanHopLop, phieuHocTap, baoCaoCongTac, DANH_MUC,
    coQuan, donViCongTac, nguoiKy, cvhtCua, svCuaLop, tenLop, soCoMat };
})();
