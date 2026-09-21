/* =====================================================================
   io.js — nhập và xuất dữ liệu
   CSV xuất ra có thêm dấu BOM nên Excel mở lên là đúng tiếng Việt ngay,
   không phải chọn lại bảng mã.
   ===================================================================== */
window.CV = window.CV || {};

CV.io = (function () {
  "use strict";
  const U = CV.util;
  const A = () => CV.academic;

  /* ---------- CSV ---------- */
  function csvCell(v) {
    const s = v === null || v === undefined ? "" : String(v);
    // Chặn công thức bị Excel tự chạy khi ô bắt đầu bằng = + - @
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return /[",;\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  }

  function toCsv(headers, rows, sep) {
    const d = sep || ";"; // dấu chấm phẩy: hợp với Excel bản tiếng Việt
    const lines = [headers.map(csvCell).join(d)];
    rows.forEach((r) => lines.push(r.map(csvCell).join(d)));
    return lines.join("\r\n");
  }

  /** Đọc CSV, tự đoán dấu phân cách giữa ; , và tab. */
  function parseCsv(text) {
    let src = String(text || "").replace(/^﻿/, "");
    const firstLine = src.split(/\r?\n/)[0] || "";
    const counts = { ";": 0, ",": 0, "\t": 0 };
    let inQ = false;
    for (const ch of firstLine) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && counts[ch] !== undefined) counts[ch]++;
    }
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  /* ---------- tải tệp xuống ---------- */
  function download(filename, content, mime) {
    const type = mime || "text/plain;charset=utf-8";
    const bom = type.indexOf("csv") >= 0 ? "﻿" : "";
    const blob = new Blob([bom + content], { type });
    const url = URL.createObjectURL(blob);
    const a = U.el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  /** Đọc tệp dạng nhị phân, dùng cho .xlsx. */
  function readBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("Không đọc được tệp."));
      fr.readAsArrayBuffer(file);
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Không đọc được tệp."));
      fr.readAsText(file, "utf-8");
    });
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  /* ---------- ngày tháng linh hoạt ---------- */
  function toIsoDate(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${U.pad2(m[2])}-${U.pad2(m[3])}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${m[3]}-${U.pad2(m[2])}-${U.pad2(m[1])}`;
    return "";
  }

  /* ---------- XUẤT ---------- */
  const H_STUDENT = ["MSSV", "Họ và tên", "Giới tính", "Ngày sinh", "Điện thoại", "Email",
    "Lớp", "Chức vụ", "Trạng thái", "Ghi chú"];

  function exportStudents(students) {
    const rows = students.map((s) => {
      const k = s.classId ? CV.store.get("classes", s.classId) : null;
      return [s.mssv, s.name, s.gender || "", U.dmy(s.dob) === "—" ? "" : U.dmy(s.dob),
        s.phone || "", s.email || "", k ? k.code : "", s.cadreRole || "",
        s.status || "Đang học", s.note || ""];
    });
    download(`danh-sach-sinh-vien-${stamp()}.csv`, toCsv(H_STUDENT, rows), "text/csv;charset=utf-8");
  }

  /** Bảng tổng hợp kết quả học tập: mỗi sinh viên một dòng. */
  function exportSummary(students) {
    const head = ["MSSV", "Họ và tên", "Lớp", "Số học phần", "Tín chỉ tích luỹ", "Tín chỉ nợ",
      "GPA hệ 4", "GPA hệ 10", "Xếp loại", "Điểm rèn luyện", "Mức cảnh báo", "Lý do"];
    const rows = students.map((s) => {
      const p = A().profileOf(s.id);
      return [s.mssv, s.name, p.klass ? p.klass.code : "",
        p.stats.subjects, p.stats.earnedCredits, p.stats.debtCredits,
        p.stats.gpa4 === null ? "" : U.num(p.stats.gpa4),
        p.stats.gpa10 === null ? "" : U.num(p.stats.gpa10),
        p.learning.label,
        p.stats.conductAvg === null ? "" : U.num(p.stats.conductAvg, 1),
        p.warning.label, p.warning.reasons.join("; ")];
    });
    download(`ket-qua-hoc-tap-${stamp()}.csv`, toCsv(head, rows), "text/csv;charset=utf-8");
  }

  const H_SCORE = ["MSSV", "Mã học phần", "Tên học phần", "Số tín chỉ", "Điểm hệ 10", "Học kỳ"];

  function exportScores(scores) {
    const rows = scores.map((sc) => {
      const st = CV.store.get("students", sc.studentId);
      const sem = sc.semesterId ? CV.store.get("semesters", sc.semesterId) : null;
      return [st ? st.mssv : "", sc.subjectCode || "", sc.subjectName || "",
        sc.credits, U.num(sc.score10), sem ? sem.code : ""];
    });
    download(`bang-diem-${stamp()}.csv`, toCsv(H_SCORE, rows), "text/csv;charset=utf-8");
  }

  /**
   * Tệp mẫu để người dùng điền rồi nhập ngược lại. Thứ tự cột đặt theo
   * mẫu "Danh sách lớp sinh viên" của Trường cho dễ chép qua lại, và có
   * thêm cột STT để khớp với bản in.
   */
  function templateStudents() {
    const head = ["STT", "MSSV", "Họ và tên", "Ngày sinh", "Giới tính", "Điện thoại",
      "Email", "Lớp", "Chức vụ", "Trạng thái", "Ghi chú"];
    download("mau-nhap-sinh-vien.csv",
      toCsv(head, [["1", "26D15802010320", "NGUYỄN VĂN MẪU", "03/06/2008", "Nam", "0900000001",
        "mau@example.edu.vn", "XD26CT01", "Lớp trưởng", "Đang học", ""]]),
      "text/csv;charset=utf-8");
  }
  function templateScores() {
    download("mau-nhap-diem.csv",
      toCsv(H_SCORE, [["26XD01001", "MTU101", "Toán cao cấp 1", "3", "8,5", "2025-1"]]),
      "text/csv;charset=utf-8");
  }

  function backup() {
    download(`sao-luu-cvht-mtu-${stamp()}.json`, CV.store.exportJson(), "application/json;charset=utf-8");
  }

  /* ---------- NHẬP ---------- */
  function headerIndex(headerRow) {
    const idx = {};
    headerRow.forEach((h, i) => { idx[U.fold(h)] = i; });
    const pick = (...names) => {
      for (const n of names) { const k = U.fold(n); if (idx[k] !== undefined) return idx[k]; }
      return -1;
    };
    return pick;
  }

  /**
   * Nhập sinh viên từ CSV.
   * Đối chiếu theo MSSV: đã có thì cập nhật, chưa có thì thêm mới.
   * Không ghi đè mã PIN đã cấp.
   */
  function importStudents(text, defaultClassId) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: "Tệp không có dòng dữ liệu nào." };
    const pick = headerIndex(rows[0]);
    const iM = pick("MSSV", "Ma so sinh vien", "Mã số sinh viên");
    const iN = pick("Ho va ten", "Họ và tên", "Ho ten", "Tên");
    if (iM < 0 || iN < 0) {
      return { ok: false, error: "Thiếu cột bắt buộc: MSSV và Họ và tên." };
    }
    const iG = pick("Gioi tinh", "Giới tính");
    const iD = pick("Ngay sinh", "Ngày sinh");
    const iP = pick("Dien thoai", "Điện thoại", "SDT");
    const iE = pick("Email");
    const iC = pick("Lop", "Lớp");
    const iR = pick("Chuc vu", "Chức vụ");
    const iS = pick("Trang thai", "Trạng thái");
    const iNo = pick("Ghi chu", "Ghi chú");
    const iCccd = pick("CCCD", "So CCCD", "Số CCCD", "CMND", "Can cuoc cong dan");

    const classes = CV.store.all("classes");
    const errors = [], seen = new Set();
    const notes = [];
    let added = 0, updated = 0;

    // Danh sách lớp của Trường có cột CCCD. Ứng dụng không dùng số căn cước
    // vào bất kỳ chức năng nào, mà dữ liệu lại nằm ngay trong trình duyệt,
    // nên cột này được bỏ qua có chủ ý thay vì lưu lại.
    if (iCccd >= 0) {
      notes.push("Tệp có cột CCCD. Ứng dụng không lưu số căn cước công dân — " +
        "cột này đã được bỏ qua.");
    }

    rows.slice(1).forEach((r, n) => {
      const line = n + 2;
      const mssv = String(r[iM] || "").trim().toUpperCase();
      const name = String(r[iN] || "").trim();
      const eM = A().validate.mssv(mssv), eN = A().validate.name(name);
      if (eM) { errors.push(`Dòng ${line}: ${eM}`); return; }
      if (eN) { errors.push(`Dòng ${line}: ${eN}`); return; }
      if (seen.has(mssv)) { errors.push(`Dòng ${line}: MSSV ${mssv} lặp lại trong tệp.`); return; }
      seen.add(mssv);

      const phone = iP >= 0 ? String(r[iP] || "").trim() : "";
      const email = iE >= 0 ? String(r[iE] || "").trim() : "";
      const eP = A().validate.phone(phone), eE = A().validate.email(email);
      if (eP) errors.push(`Dòng ${line} (${mssv}): ${eP} — đã bỏ trống ô này.`);
      if (eE) errors.push(`Dòng ${line} (${mssv}): ${eE} — đã bỏ trống ô này.`);

      let classId = defaultClassId || "";
      if (iC >= 0 && String(r[iC] || "").trim()) {
        const code = U.fold(r[iC]);
        const k = classes.find((c) => U.fold(c.code) === code || U.fold(c.name) === code);
        if (k) classId = k.id;
        else errors.push(`Dòng ${line} (${mssv}): không tìm thấy lớp "${String(r[iC]).trim()}", đã xếp vào lớp đang chọn.`);
      }

      const dob = iD >= 0 ? toIsoDate(r[iD]) : "";
      if (iD >= 0 && String(r[iD] || "").trim() && !dob) {
        errors.push(`Dòng ${line} (${mssv}): ngày sinh "${String(r[iD]).trim()}" không đọc được (cần dd/mm/yyyy).`);
      }

      const existing = CV.store.first("students", (s) => String(s.mssv).toUpperCase() === mssv);
      const payload = {
        mssv, name, classId,
        gender: iG >= 0 ? String(r[iG] || "").trim() : "",
        dob,
        phone: eP ? "" : phone,
        email: eE ? "" : email,
        cadreRole: iR >= 0 ? String(r[iR] || "").trim() : "",
        status: (iS >= 0 && String(r[iS] || "").trim()) || "Đang học",
        note: iNo >= 0 ? String(r[iNo] || "").trim() : ""
      };
      if (existing) { CV.store.put("students", Object.assign({ id: existing.id }, payload), { save: false }); updated++; }
      else { CV.store.put("students", payload, { save: false }); added++; }
    });

    CV.store.save("import:students");
    return { ok: true, added, updated, errors, notes, total: rows.length - 1 };
  }

  /** Nhập điểm từ CSV. Trùng (MSSV + mã học phần + học kỳ) thì ghi đè điểm cũ. */
  function importScores(text, defaultSemesterId) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: "Tệp không có dòng dữ liệu nào." };
    const pick = headerIndex(rows[0]);
    const iM = pick("MSSV", "Mã số sinh viên");
    const iC = pick("Ma hoc phan", "Mã học phần", "Ma HP");
    const iN = pick("Ten hoc phan", "Tên học phần");
    const iCr = pick("So tin chi", "Số tín chỉ", "Tin chi");
    const iS = pick("Diem he 10", "Điểm hệ 10", "Diem");
    const iSem = pick("Hoc ky", "Học kỳ");
    if (iM < 0 || iCr < 0 || iS < 0 || (iC < 0 && iN < 0)) {
      return { ok: false, error: "Thiếu cột bắt buộc: MSSV, Mã (hoặc Tên) học phần, Số tín chỉ, Điểm hệ 10." };
    }

    const students = CV.store.all("students");
    const semesters = CV.store.all("semesters");
    const errors = [];
    let added = 0, updated = 0;

    rows.slice(1).forEach((r, n) => {
      const line = n + 2;
      const mssv = String(r[iM] || "").trim().toUpperCase();
      const st = students.find((s) => String(s.mssv).toUpperCase() === mssv);
      if (!st) { errors.push(`Dòng ${line}: không có sinh viên nào mang MSSV ${mssv || "(trống)"}.`); return; }

      const code = iC >= 0 ? String(r[iC] || "").trim().toUpperCase() : "";
      const sname = iN >= 0 ? String(r[iN] || "").trim() : "";
      if (!code && !sname) { errors.push(`Dòng ${line} (${mssv}): thiếu mã và tên học phần.`); return; }

      const eC = A().validate.credits(r[iCr]);
      if (eC) { errors.push(`Dòng ${line} (${mssv}): ${eC}`); return; }
      const eS = A().validate.score10(r[iS]);
      if (eS) { errors.push(`Dòng ${line} (${mssv}): ${eS}`); return; }

      let semesterId = defaultSemesterId || "";
      if (iSem >= 0 && String(r[iSem] || "").trim()) {
        const key = U.fold(r[iSem]);
        const sem = semesters.find((s) => U.fold(s.code) === key || U.fold(s.name) === key);
        if (sem) semesterId = sem.id;
        else errors.push(`Dòng ${line} (${mssv}): không tìm thấy học kỳ "${String(r[iSem]).trim()}", đã xếp vào học kỳ đang chọn.`);
      }

      const key = code || sname.toUpperCase();
      const existing = CV.store.first("scores", (sc) =>
        sc.studentId === st.id && sc.semesterId === semesterId &&
        String(sc.subjectCode || sc.subjectName || "").toUpperCase() === key);

      const payload = {
        studentId: st.id, semesterId,
        subjectCode: code, subjectName: sname,
        credits: U.parseNum(r[iCr]), score10: U.parseNum(r[iS]),
        gradedAt: new Date().toISOString()
      };
      if (existing) { CV.store.put("scores", Object.assign({ id: existing.id }, payload), { save: false }); updated++; }
      else { CV.store.put("scores", payload, { save: false }); added++; }
    });

    CV.store.save("import:scores");
    return { ok: true, added, updated, errors, total: rows.length - 1 };
  }

  /* =====================================================================
     KẾT QUẢ HỌC TẬP THEO HỌC KỲ (tệp KQHT của Phòng Đào tạo)
     ===================================================================== */

  /** Tìm dòng tiêu đề trong bảng: dòng đầu tiên có ô chứa "Mã SV" hoặc "MSSV". */
  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const folded = (rows[i] || []).map((c) => U.fold(c));
      if (folded.some((c) => c === "ma sv" || c === "mssv" || c === "ma so sinh vien")) return i;
    }
    return -1;
  }

  /**
   * Nhập bảng Kết quả học tập của một học kỳ.
   * @param {string[][]} rows các hàng đọc từ .xlsx hoặc CSV
   * @param {{semesterId:string, createIn?:string}} opt
   */
  function importTermResults(rows, opt) {
    const hi = findHeaderRow(rows);
    if (hi < 0) {
      return { ok: false, error: 'Không tìm thấy dòng tiêu đề có cột "Mã SV". ' +
        "Hãy kiểm tra lại tệp Kết quả học tập." };
    }
    const pick = headerIndex(rows[hi]);
    const iM = pick("Ma SV", "MSSV", "Mã số sinh viên");
    const iName = pick("Ho va ten", "Họ và tên");
    const iDob = pick("Ngay sinh", "Ngày sinh");
    const i10 = pick("Diem TBC hoc ky (he 10)", "Điểm TBC học kỳ (hệ 10)", "Diem TBC he 10", "TBC he 10");
    const i4 = pick("Diem TBC hoc ky (he 4)", "Điểm TBC học kỳ (hệ 4)", "Diem TBC he 4", "TBC he 4", "Diem TBC");
    const iCum = pick("Diem TBC tich luy toan khoa", "Điểm TBC tích lũy toàn khóa", "Diem TBCTL", "TBCTL");
    const iCr = pick("So tin chi tich luy", "Số tín chỉ tích lũy", "So TCTL");
    const iRank = pick("Xep loai hoc ky", "Xếp loại học kỳ", "Xep loai");
    const iClass = pick("Lop", "Lớp", "Ma Lop SV");
    const iNote = pick("Ghi chu", "Ghi chú");
    const iDebt = pick("So TC con no", "Số TC còn nợ");

    if (iM < 0 || i4 < 0) {
      return { ok: false, error: 'Tệp thiếu cột bắt buộc: "Mã SV" và "Điểm TBC học kỳ (hệ 4)".' };
    }

    const students = CV.store.all("students");
    const classes = CV.store.all("classes");
    const errors = [], notes = [], unknown = [];
    let added = 0, updated = 0, created = 0;

    rows.slice(hi + 1).forEach((r, n) => {
      const line = hi + n + 2;
      const mssv = String(r[iM] || "").trim().toUpperCase();
      if (!mssv) return;
      if (A().validate.mssv(mssv)) { errors.push(`Dòng ${line}: mã sinh viên "${mssv}" không hợp lệ.`); return; }

      let st = students.find((x) => String(x.mssv).toUpperCase() === mssv);
      if (!st) {
        if (!opt || !opt.createIn) { unknown.push(mssv); return; }
        let classId = opt.createIn;
        if (iClass >= 0 && String(r[iClass] || "").trim()) {
          const key = U.fold(r[iClass]);
          const k = classes.find((c) => U.fold(c.code) === key || U.fold(c.name) === key);
          if (k) classId = k.id;
        }
        st = CV.store.put("students", {
          mssv, classId,
          name: iName >= 0 ? String(r[iName] || "").trim() : mssv,
          dob: iDob >= 0 ? toIsoDate(r[iDob]) : "",
          status: "Đang học"
        }, { save: false });
        // put() đã thêm vào mảng students rồi, không push lại
        created++;
      }

      const payload = {
        studentId: st.id, semesterId: opt.semesterId,
        gpa10: i10 >= 0 ? U.parseNum(r[i10]) : NaN,
        gpa4: U.parseNum(r[i4]),
        cumGpa4: iCum >= 0 ? U.parseNum(r[iCum]) : NaN,
        credits: iCr >= 0 ? U.parseNum(r[iCr]) : NaN,
        debtCredits: iDebt >= 0 ? U.parseNum(r[iDebt]) : NaN,
        rank: iRank >= 0 ? String(r[iRank] || "").trim() : "",
        note: iNote >= 0 ? String(r[iNote] || "").trim() : ""
      };
      ["gpa10", "gpa4", "cumGpa4", "credits", "debtCredits"].forEach((k) => {
        if (isNaN(payload[k])) payload[k] = null;
      });
      if (payload.gpa4 !== null && (payload.gpa4 < 0 || payload.gpa4 > 4)) {
        errors.push(`Dòng ${line} (${mssv}): điểm hệ 4 là ${r[i4]}, nằm ngoài khoảng 0–4.`);
        return;
      }

      const existing = CV.store.first("termResults",
        (t) => t.studentId === st.id && t.semesterId === opt.semesterId);
      if (existing) { payload.id = existing.id; updated++; } else { added++; }
      CV.store.put("termResults", payload, { save: false });
    });

    if (created) notes.push(`Đã tạo mới ${created} sinh viên chưa có trong danh sách.`);
    if (unknown.length) {
      notes.push(`Bỏ qua ${unknown.length} dòng có mã sinh viên không nằm trong lớp bạn phụ trách` +
        (unknown.length <= 6 ? ` (${unknown.join(", ")})` : "") + ".");
    }
    CV.store.save("import:termResults");
    return { ok: true, added, updated, created, errors, notes, total: rows.length - hi - 1 };
  }

  /* =====================================================================
     XUẤT BẢNG CẢNH CÁO HỌC VỤ — đúng 14 cột theo mẫu của Trường
     ===================================================================== */
  const H_WARNING = ["STT", "MSSV", "Họ", "Tên", "Ngày sinh", "Mã Lớp SV", "Điểm TBC",
    "Điểm TBCTL", "Số TCTL", "Số TC còn nợ", "CB - TT học vụ", "Số TC ĐK", "Ghi chú", "NGHỈ"];

  /** Tiêu đề cột đăng ký tín chỉ, gắn mã học kỳ kế tiếp cho giống bản của Trường. */
  function warningHeader() {
    const head = H_WARNING.slice();
    const sems = U.sortBy(CV.store.all("semesters"), (x) => x.code);
    if (sems.length) head[11] = `Số TC ĐK ${sems[sems.length - 1].code}`;
    return head;
  }
  const W_WARNING = [6, 18, 16, 10, 12, 12, 9, 10, 9, 12, 22, 10, 30, 8];

  /** Tách "Nguyễn Hoàng Huy" thành họ "Nguyễn Hoàng" và tên "Huy". */
  function splitName(full) {
    const parts = String(full || "").trim().split(/\s+/);
    if (parts.length < 2) return { ho: "", ten: parts[0] || "" };
    return { ho: parts.slice(0, -1).join(" "), ten: parts[parts.length - 1] };
  }

  /** Dựng các hàng của bảng cảnh cáo học vụ từ danh sách sinh viên. */
  function warningRows(students) {
    const rows = [];
    let stt = 0;
    U.sortBy(students, (s) => {
      const k = CV.store.get("classes", s.classId);
      return (k ? k.code : "") + "|" + s.mssv;
    }).forEach((s) => {
      const p = A().profileOf(s.id);
      const w = p.warning;
      if (!w.termWarning || !w.termWarning.times) return; // chỉ xuất sinh viên thuộc diện
      const last = p.stats.terms[p.stats.terms.length - 1] || {};
      const name = splitName(s.name);
      const k = p.klass;
      stt++;
      rows.push([
        stt, s.mssv, name.ho, name.ten,
        U.dmy(s.dob) === "—" ? "" : U.dmy(s.dob),
        k ? k.code : "",
        last.gpa4 === null || last.gpa4 === undefined ? 0 : Number(last.gpa4),
        last.cumGpa4 === null || last.cumGpa4 === undefined ? 0 : Number(last.cumGpa4),
        last.credits === null || last.credits === undefined ? 0 : Number(last.credits),
        Number(p.stats.debtCredits || (last.debtCredits || 0)),
        w.termWarning.status,
        "",
        w.termWarning.lastShort || w.termWarning.lastReason || "",
        /Thôi học|Bảo lưu|Đình chỉ/.test(s.status || "") ? "Nghỉ" : ""
      ]);
    });
    return rows;
  }

  /** Xuất tệp .xlsx đúng mẫu. Trình duyệt cũ không hỗ trợ thì rơi về CSV. */
  async function exportWarning(students, sheetName) {
    const rows = warningRows(students);
    const head = warningHeader();
    const all = [head].concat(rows);
    if (!CV.xlsx.supported()) {
      download(`canh-cao-hoc-vu-${stamp()}.csv`, toCsv(head, rows), "text/csv;charset=utf-8");
      return { ok: true, count: rows.length, format: "csv" };
    }
    const blob = await CV.xlsx.write([{
      name: (sheetName || "CANH CAO HOC VU").slice(0, 31),
      headerRows: 1, widths: W_WARNING, rows: all
    }]);
    const url = URL.createObjectURL(blob);
    const a = U.el("a", { href: url, download: `canh-cao-hoc-vu-${stamp()}.xlsx` });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    return { ok: true, count: rows.length, format: "xlsx" };
  }

  /** Tệp mẫu Kết quả học tập, đúng thứ tự cột của Phòng Đào tạo. */
  async function templateTermResults() {
    const head = ["STT", "Mã SV", "Họ và tên", "Ngày sinh", "Điểm TBC học kỳ (hệ 10)",
      "Điểm TBC học kỳ (hệ 4)", "Điểm TBC tích lũy toàn khóa", "Số tín chỉ tích lũy",
      "Xếp loại học kỳ", "Lớp", "Ghi chú"];
    const rows = [[1, "26D15802010320", "NGUYỄN VĂN MẪU", "03/06/2008", 6.44, 2.29, 2.66, 17,
      "Trung bình", "XD26CT01", ""]];
    if (!CV.xlsx.supported()) {
      download("mau-ket-qua-hoc-tap.csv", toCsv(head, rows), "text/csv;charset=utf-8");
      return;
    }
    const blob = await CV.xlsx.write([{ name: "KQHT", headerRows: 1,
      widths: [6, 18, 26, 12, 14, 14, 16, 12, 14, 12, 20], rows: [head].concat(rows) }]);
    const url = URL.createObjectURL(blob);
    const a = U.el("a", { href: url, download: "mau-ket-qua-hoc-tap.xlsx" });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  /* ---------- in báo cáo ---------- */
  /** Dựng nội dung in vào #print-root rồi gọi hộp thoại in của trình duyệt. */
  function print(titleText, nodes) {
    const root = document.getElementById("print-root");
    root.innerHTML = "";
    const s = CV.store.settings();
    root.appendChild(U.el("div", { class: "print-head" }, [
      U.el("h1", { text: titleText }),
      U.el("p", { text: `${s.schoolName}${s.facultyName ? " — " + s.facultyName : ""}` }),
      U.el("p", { text: `Lập ngày ${U.dmy(U.todayISO())}` })
    ]));
    (Array.isArray(nodes) ? nodes : [nodes]).forEach((n) => root.appendChild(n));
    const after = () => { root.innerHTML = ""; window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after);
    window.print();
  }

  return {
    toCsv, parseCsv, download, readFile, readBuffer, toIsoDate, findHeaderRow, splitName,
    importTermResults, exportWarning, warningRows, templateTermResults, H_WARNING, warningHeader,
    exportStudents, exportSummary, exportScores,
    templateStudents, templateScores, backup,
    importStudents, importScores, print
  };
})();
