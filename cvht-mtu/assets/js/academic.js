/* =====================================================================
   academic.js — toàn bộ logic học vụ
   Đây là nơi DUY NHẤT định nghĩa thang điểm, cách tính GPA, tín chỉ nợ
   và ngưỡng cảnh báo. Mọi màn hình đều gọi vào đây, nên không thể xảy ra
   chuyện máy tính GPA nói một đằng còn báo cáo nói một nẻo.
   ===================================================================== */
window.CV = window.CV || {};

CV.academic = (function () {
  "use strict";
  const U = CV.util;
  const S = () => CV.store.settings();

  /* ---------- 1. Thang điểm ---------- */

  /** Thang điểm hiện hành, sắp xếp giảm dần theo ngưỡng. */
  function scale() {
    return (S().gradeScale || []).slice().sort((a, b) => b.min - a.min);
  }

  /**
   * Quy đổi điểm hệ 10 sang điểm chữ và hệ 4.
   * @param {number|string} score10 điểm hệ 10
   * @returns {{letter:string,gpa4:number,label:string,passed:boolean}|null}
   */
  function toGrade(score10) {
    const s = U.parseNum(score10);
    if (isNaN(s)) return null;
    const v = U.clamp(s, 0, 10);
    const rows = scale();
    for (const r of rows) {
      if (v >= r.min) {
        return { letter: r.letter, gpa4: r.gpa4, label: r.label || "", passed: r.gpa4 > 0, score10: v };
      }
    }
    const last = rows[rows.length - 1];
    return { letter: last.letter, gpa4: last.gpa4, label: last.label || "", passed: false, score10: v };
  }

  /** Kiểm tra thang điểm do người dùng sửa có hợp lệ không. */
  function validateScale(rows) {
    const errs = [];
    if (!Array.isArray(rows) || rows.length < 2) errs.push("Thang điểm phải có ít nhất 2 mức.");
    const sorted = (rows || []).slice().sort((a, b) => b.min - a.min);
    sorted.forEach((r, i) => {
      if (!r.letter) errs.push(`Mức thứ ${i + 1} chưa có ký hiệu điểm chữ.`);
      if (isNaN(Number(r.min)) || r.min < 0 || r.min > 10) errs.push(`Ngưỡng của mức ${r.letter || i + 1} phải nằm trong 0–10.`);
      if (isNaN(Number(r.gpa4)) || r.gpa4 < 0 || r.gpa4 > 4) errs.push(`Điểm hệ 4 của mức ${r.letter || i + 1} phải nằm trong 0–4.`);
      if (i > 0 && Number(r.min) === Number(sorted[i - 1].min)) errs.push(`Hai mức ${sorted[i - 1].letter} và ${r.letter} trùng ngưỡng.`);
    });
    if (sorted.length && Number(sorted[sorted.length - 1].min) !== 0) {
      errs.push("Mức thấp nhất phải bắt đầu từ 0 để không có điểm nào lọt ra ngoài thang.");
    }
    return errs;
  }

  /** Mô tả thang điểm thành một dòng chữ để in vào báo cáo. */
  function scaleSummary() {
    return scale().map((r, i, arr) => {
      // khoảng nửa mở: lấy cận dưới, cận trên là ngưỡng của mức liền trên (không bao gồm)
      const hi = i === 0 ? null : arr[i - 1].min;
      const range = hi === null
        ? `từ ${U.num(r.min, 1)}`
        : `${U.num(r.min, 1)} đến dưới ${U.num(hi, 1)}`;
      return `${r.letter} ${range} = ${U.num(r.gpa4, 1)}`;
    }).join(" · ");
  }

  /* ---------- 2. Học phần và GPA ---------- */

  const keyOf = (sc) => String(sc.subjectCode || sc.subjectName || "").trim().toUpperCase();

  /**
   * Gom các lần học của cùng một học phần, chọn ra lần được tính điểm.
   * Quy tắc lấy theo cài đặt: "best" (điểm cao nhất) hoặc "latest" (lần gần nhất).
   */
  function bestAttempts(scores) {
    const rule = S().retakeRule === "latest" ? "latest" : "best";
    const map = new Map();
    scores.forEach((sc) => {
      const k = keyOf(sc);
      if (!k) return;
      const cur = map.get(k);
      if (!cur) { map.set(k, sc); return; }
      if (rule === "best") {
        const a = U.parseNum(sc.score10), b = U.parseNum(cur.score10);
        if (!isNaN(a) && (isNaN(b) || a > b)) map.set(k, sc);
      } else {
        const a = sc.gradedAt || sc.createdAt || "", b = cur.gradedAt || cur.createdAt || "";
        if (String(a) >= String(b)) map.set(k, sc);
      }
    });
    return Array.from(map.values());
  }

  /** Tính GPA trên một tập điểm đã cho (không gom học lại). */
  function gpaOf(scores) {
    let cr = 0, w4 = 0, w10 = 0, earned = 0, debt = 0;
    scores.forEach((sc) => {
      const g = toGrade(sc.score10);
      const c = U.parseNum(sc.credits);
      if (!g || isNaN(c) || c <= 0) return;
      cr += c;
      w4 += g.gpa4 * c;
      w10 += g.score10 * c;
      if (g.passed) earned += c; else debt += c;
    });
    return {
      credits: cr,
      earnedCredits: earned,
      debtCredits: debt,
      gpa4: cr ? w4 / cr : null,
      gpa10: cr ? w10 / cr : null
    };
  }

  /** Toàn bộ số liệu học tập của một sinh viên. */
  function statsOf(studentId) {
    const rows = CV.store.find("scores", (r) => r.studentId === studentId);
    const graded = rows.filter((r) => !isNaN(U.parseNum(r.score10)) && U.parseNum(r.credits) > 0);
    const counted = bestAttempts(graded);
    const total = gpaOf(counted);

    // GPA từng học kỳ: tính trên các học phần có điểm trong kỳ đó
    const bySem = [];
    CV.store.all("semesters")
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code), "vi"))
      .forEach((sem) => {
        const inSem = graded.filter((r) => r.semesterId === sem.id);
        if (!inSem.length) return;
        const g = gpaOf(inSem);
        const conduct = CV.store.first("conduct", (c) => c.studentId === studentId && c.semesterId === sem.id);
        bySem.push({ semester: sem, ...g, conduct: conduct ? U.parseNum(conduct.score) : null });
      });

    const conductRows = CV.store
      .find("conduct", (c) => c.studentId === studentId)
      .map((c) => U.parseNum(c.score))
      .filter((v) => !isNaN(v));
    const conductAvg = conductRows.length ? U.sum(conductRows) / conductRows.length : null;

    return {
      ...total,
      subjects: counted.length,
      attempts: graded.length,
      retakes: graded.length - counted.length,
      bySemester: bySem,
      conductAvg,
      debtSubjects: counted.filter((sc) => { const g = toGrade(sc.score10); return g && !g.passed; })
    };
  }

  /* ---------- 3. Xếp loại ---------- */

  function classifyLearning(gpa4) {
    if (gpa4 === null || gpa4 === undefined || isNaN(gpa4)) return { key: "none", label: "Chưa có điểm" };
    if (gpa4 >= 3.6) return { key: "xs", label: "Xuất sắc" };
    if (gpa4 >= 3.2) return { key: "gioi", label: "Giỏi" };
    if (gpa4 >= 2.5) return { key: "kha", label: "Khá" };
    if (gpa4 >= 2.0) return { key: "tb", label: "Trung bình" };
    if (gpa4 >= 1.0) return { key: "yeu", label: "Yếu" };
    return { key: "kem", label: "Kém" };
  }

  function classifyConduct(score) {
    const v = U.parseNum(score);
    if (isNaN(v)) return { label: "Chưa chấm", key: "none" };
    const row = (S().conductScale || []).slice().sort((a, b) => b.min - a.min).find((r) => v >= r.min);
    return { label: row ? row.label : "Kém", key: "ok", score: v };
  }

  /* ---------- 4. Cảnh báo học vụ ---------- */
  /* Mỗi mức đều kèm lý do bằng chữ, nêu rõ con số và ngưỡng đã dùng,
     để số liệu trên báo cáo luôn truy ngược được.                      */

  const LEVELS = {
    none:     { rank: 0, label: "Chưa có điểm",  badge: "badge-info" },
    ok:       { rank: 1, label: "Bình thường",   badge: "badge-ok" },
    watch:    { rank: 2, label: "Cần theo dõi",  badge: "badge-watch" },
    warn:     { rank: 3, label: "Cảnh báo",      badge: "badge-warn" },
    critical: { rank: 4, label: "Nguy cơ buộc thôi học", badge: "badge-critical" }
  };

  function warningOf(stats) {
    const w = S().warning || {};
    const reasons = [];
    let level = "ok";
    const bump = (lv) => { if (LEVELS[lv].rank > LEVELS[level].rank) level = lv; };

    if (stats.gpa4 === null) {
      return { level: "none", ...LEVELS.none, reasons: ["Chưa nhập điểm học phần nào."] };
    }
    const gpa = stats.gpa4, debt = stats.debtCredits;

    if (gpa < w.gpaCritical) { bump("critical"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaCritical)}`); }
    else if (gpa < w.gpaWarn) { bump("warn"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaWarn)}`); }
    else if (gpa < w.gpaWatch) { bump("watch"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaWatch)}`); }

    if (debt > w.debtCritical) { bump("critical"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtCritical}`); }
    else if (debt > w.debtWarn) { bump("warn"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtWarn}`); }
    else if (debt >= w.debtWatch && w.debtWatch > 0) { bump("watch"); reasons.push(`Đang nợ ${debt} tín chỉ`); }

    if (!reasons.length) reasons.push(`GPA ${U.num(gpa)}, không nợ tín chỉ`);
    return { level, ...LEVELS[level], reasons };
  }

  /** Diễn giải quy tắc cảnh báo thành câu chữ, in kèm báo cáo. */
  function warningRuleText() {
    const w = S().warning || {};
    return [
      `Cần theo dõi: GPA tích luỹ < ${U.num(w.gpaWatch)} hoặc nợ từ ${w.debtWatch} tín chỉ.`,
      `Cảnh báo: GPA tích luỹ < ${U.num(w.gpaWarn)} hoặc nợ quá ${w.debtWarn} tín chỉ.`,
      `Nguy cơ buộc thôi học: GPA tích luỹ < ${U.num(w.gpaCritical)} hoặc nợ quá ${w.debtCritical} tín chỉ.`
    ];
  }

  /* ---------- 5. Hồ sơ đầy đủ của một sinh viên ---------- */
  function profileOf(studentId) {
    const st = CV.store.get("students", studentId);
    if (!st) return null;
    const stats = statsOf(studentId);
    return {
      student: st,
      klass: st.classId ? CV.store.get("classes", st.classId) : null,
      stats,
      warning: warningOf(stats),
      learning: classifyLearning(stats.gpa4),
      conduct: classifyConduct(stats.conductAvg)
    };
  }

  /** Tổng hợp cho cả danh sách sinh viên (dùng cho bảng và biểu đồ). */
  function summarize(students) {
    const counts = { none: 0, ok: 0, watch: 0, warn: 0, critical: 0 };
    const gpaBins = [0, 0, 0, 0, 0]; // <2,0 | 2,0–2,5 | 2,5–3,2 | 3,2–3,6 | ≥3,6
    let gpaSum = 0, gpaN = 0, debtTotal = 0;
    const rows = students.map((st) => {
      const stats = statsOf(st.id);
      const warn = warningOf(stats);
      counts[warn.level]++;
      debtTotal += stats.debtCredits;
      if (stats.gpa4 !== null) {
        gpaSum += stats.gpa4; gpaN++;
        const g = stats.gpa4;
        const i = g < 2 ? 0 : g < 2.5 ? 1 : g < 3.2 ? 2 : g < 3.6 ? 3 : 4;
        gpaBins[i]++;
      }
      return { student: st, stats, warning: warn, learning: classifyLearning(stats.gpa4) };
    });
    return {
      rows, counts, gpaBins, debtTotal,
      total: students.length,
      gpaAvg: gpaN ? gpaSum / gpaN : null,
      graded: gpaN
    };
  }

  /* ---------- 6. Kiểm tra dữ liệu nhập ---------- */
  const V = {
    mssv(v) {
      const s = String(v || "").trim().toUpperCase();
      if (!s) return "Chưa nhập mã số sinh viên.";
      if (!/^[A-Z0-9._-]{3,20}$/.test(s)) return "MSSV chỉ gồm chữ, số, dấu chấm, gạch ngang (3–20 ký tự).";
      return null;
    },
    name(v) {
      const s = String(v || "").trim();
      if (s.length < 2) return "Họ tên quá ngắn.";
      if (s.length > 80) return "Họ tên quá dài.";
      return null;
    },
    score10(v) {
      const n = U.parseNum(v);
      if (isNaN(n)) return "Điểm phải là số.";
      if (n < 0 || n > 10) return "Điểm hệ 10 nằm trong khoảng 0–10.";
      return null;
    },
    credits(v) {
      const n = U.parseNum(v);
      if (isNaN(n)) return "Số tín chỉ phải là số.";
      if (!Number.isInteger(n)) return "Số tín chỉ phải là số nguyên.";
      if (n < 1 || n > 15) return "Số tín chỉ nằm trong khoảng 1–15.";
      return null;
    },
    conduct(v) {
      const n = U.parseNum(v);
      if (isNaN(n)) return "Điểm rèn luyện phải là số.";
      if (n < 0 || n > 100) return "Điểm rèn luyện nằm trong khoảng 0–100.";
      return null;
    },
    email(v) {
      const s = String(v || "").trim();
      if (!s) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : "Địa chỉ email không hợp lệ.";
    },
    phone(v) {
      const s = String(v || "").replace(/[\s.]/g, "");
      if (!s) return null;
      return /^(0|\+84)\d{8,10}$/.test(s) ? null : "Số điện thoại không hợp lệ.";
    },
    dob(v) {
      const s = String(v || "").trim();
      if (!s) return null;
      const d = new Date(s);
      if (isNaN(d)) return "Ngày sinh không hợp lệ.";
      const year = d.getFullYear();
      if (year < 1950 || d > new Date()) return "Ngày sinh không hợp lý.";
      return null;
    },
    pin(v) {
      const s = String(v || "").trim();
      if (!/^\d{6}$/.test(s)) return "Mã PIN gồm đúng 6 chữ số.";
      if (/^(\d)\1{5}$/.test(s)) return "Mã PIN không nên gồm 6 chữ số giống nhau.";
      if ("0123456789".includes(s) || "9876543210".includes(s)) return "Mã PIN không nên là dãy số liên tiếp.";
      return null;
    },
    password(v) {
      const s = String(v || "");
      if (s.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
      if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Mật khẩu cần có cả chữ và số.";
      return null;
    }
  };

  return {
    scale, toGrade, validateScale, scaleSummary,
    bestAttempts, gpaOf, statsOf, profileOf, summarize,
    classifyLearning, classifyConduct,
    warningOf, warningRuleText, LEVELS,
    validate: V
  };
})();
