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

    const terms = termResultsOf(studentId);
    const last = terms.length ? terms[terms.length - 1] : null;

    // Chưa nhập điểm từng học phần nhưng đã có kết quả học kỳ chính thức thì
    // lấy luôn số của Phòng Đào tạo, để bàn làm việc và báo cáo không trống.
    if (total.gpa4 === null && last) {
      if (last.cumGpa4 !== null && last.cumGpa4 !== undefined) total.gpa4 = last.cumGpa4;
      if (last.credits !== null && last.credits !== undefined) {
        total.earnedCredits = last.credits;
        total.credits = last.credits;
      }
      if (last.debtCredits !== null && last.debtCredits !== undefined) {
        total.debtCredits = last.debtCredits;
      }
      total.fromTerm = true;
    }

    return {
      ...total,
      terms,
      official: terms.length ? terms[terms.length - 1] : null,
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

  /* =====================================================================
     3b. Kết quả học kỳ chính thức
     Phòng Đào tạo gửi bảng "Kết quả học tập" theo từng học kỳ, gồm điểm
     trung bình chung học kỳ (hệ 10 và hệ 4), điểm trung bình tích luỹ,
     số tín chỉ tích luỹ và xếp loại. Đây là số liệu gốc để xét cảnh báo
     học vụ, chính xác hơn số do ứng dụng tự tính từ điểm từng học phần.
     ===================================================================== */

  /** Kết quả các học kỳ của một sinh viên, sắp theo mã học kỳ tăng dần. */
  function termResultsOf(studentId) {
    return CV.store.find("termResults", (t) => t.studentId === studentId)
      .map((t) => ({ ...t, semester: CV.store.get("semesters", t.semesterId) }))
      .sort((a, b) => String((a.semester || {}).code || "").localeCompare(
        String((b.semester || {}).code || ""), "vi"));
  }

  /**
   * Một học kỳ có bị tính là cảnh báo hay không.
   * Hai trường hợp, đúng như hai dòng ghi chú trong bảng của Trường:
   *   - "Có HK dưới 1.0": điểm trung bình chung học kỳ thấp hơn ngưỡng.
   *   - "Không có điểm TB để xét": học kỳ không có điểm nào để tính.
   */
  function termFlagged(term, isFirstTerm) {
    const w = S().warning || {};
    // Ngưỡng 0,8 chỉ dùng cho học kỳ được đánh dấu là học kỳ đầu khoá trong
    // mục Học kỳ. Không suy đoán từ thứ tự dữ liệu đã nhập: cố vấn thường chỉ
    // nhập một vài học kỳ gần đây, học kỳ sớm nhất trong máy không đồng nghĩa
    // là học kỳ đầu tiên của khoá.
    const sem = term.semester || CV.store.get("semesters", term.semesterId) || {};
    const first = isFirstTerm === undefined ? !!sem.firstOfCourse : isFirstTerm;
    const gpa = U.parseNum(term.gpa4);
    const credits = U.parseNum(term.credits);
    const noScore = (isNaN(gpa) || gpa === 0) && (isNaN(credits) || credits === 0);
    if (noScore) {
      return w.countNoScoreTerm === false
        ? null
        : { reason: "Không có điểm TB để xét", short: "Không có điểm TB để xét" };
    }
    if (isNaN(gpa)) return null;
    const limit = first ? w.termGpaFirstBelow : w.termGpaBelow;
    if (gpa < limit) {
      return {
        reason: `Điểm trung bình học kỳ ${U.num(gpa)} dưới ${U.num(limit)}`,
        // Chữ ngắn đúng như Trường ghi trong cột Ghi chú của bảng cảnh cáo
        // Trường ghi số ở đây bằng dấu chấm, ví dụ "Có HK dưới 1.0"
        short: `Có HK dưới ${Number(limit).toFixed(1)}`
      };
    }
    return null;
  }

  /**
   * Xét cảnh báo học vụ theo đúng cách Trường ghi trong bảng CẢNH CÁO HỌC VỤ:
   * đếm số học kỳ bị cảnh báo và kiểm tra hai học kỳ liền nhau.
   * Trả về cả chuỗi chữ giống hệt cột "CB - TT học vụ" để xuất báo cáo.
   */
  function termWarning(terms) {
    const flags = terms.map((t) => ({ term: t, flag: termFlagged(t) }));
    const hit = flags.filter((x) => x.flag);
    if (!hit.length) return { times: 0, consecutive: false, status: "", reasons: [] };

    let consecutive = false;
    for (let i = 1; i < flags.length; i++) {
      if (flags[i].flag && flags[i - 1].flag) consecutive = true;
    }
    const times = hit.length;
    const status = consecutive ? "CBHV 2 lần liên tiếp" : `CBHV lần ${Math.min(times, 2)}`;
    const last = hit[hit.length - 1];
    const lastIsCurrent = flags.length > 0 && flags[flags.length - 1].flag !== null;

    return {
      times, consecutive, status,
      lastIsCurrent,
      lastReason: last.flag.reason,
      lastShort: last.flag.short || last.flag.reason,
      reasons: hit.map((x) => {
        const code = (x.term.semester || {}).code || "học kỳ không rõ";
        return `${code}: ${x.flag.reason}`;
      })
    };
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

    // Có kết quả học kỳ chính thức thì xét theo quy tắc của Trường.
    if (stats.terms && stats.terms.length) {
      const tw = termWarning(stats.terms);
      const debt = stats.debtCredits;
      if (tw.times) {
        if (tw.consecutive) bump("critical");
        else if (tw.lastIsCurrent) bump("warn");
        else bump("watch");
        reasons.push(...tw.reasons);
      }
      if (debt > w.debtCritical) { bump("critical"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtCritical}`); }
      else if (debt > w.debtWarn) { bump("warn"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtWarn}`); }
      else if (debt >= w.debtWatch && w.debtWatch > 0) { bump("watch"); reasons.push(`Đang nợ ${debt} tín chỉ`); }

      if (!reasons.length) {
        const last = stats.terms[stats.terms.length - 1];
        reasons.push(`Điểm trung bình học kỳ gần nhất ${U.num(last.gpa4)}, không thuộc diện cảnh báo`);
      }
      return { level, ...LEVELS[level], reasons, source: "term", termWarning: tw };
    }

    if (stats.gpa4 === null) {
      return { level: "none", ...LEVELS.none, reasons: ["Chưa nhập điểm học phần nào."], source: "none" };
    }
    const gpa = stats.gpa4, debt = stats.debtCredits;

    if (gpa < w.gpaCritical) { bump("critical"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaCritical)}`); }
    else if (gpa < w.gpaWarn) { bump("warn"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaWarn)}`); }
    else if (gpa < w.gpaWatch) { bump("watch"); reasons.push(`GPA tích luỹ ${U.num(gpa)} dưới ${U.num(w.gpaWatch)}`); }

    if (debt > w.debtCritical) { bump("critical"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtCritical}`); }
    else if (debt > w.debtWarn) { bump("warn"); reasons.push(`Nợ ${debt} tín chỉ, quá ${w.debtWarn}`); }
    else if (debt >= w.debtWatch && w.debtWatch > 0) { bump("watch"); reasons.push(`Đang nợ ${debt} tín chỉ`); }

    if (!reasons.length) reasons.push(`GPA ${U.num(gpa)}, không nợ tín chỉ`);
    return { level, ...LEVELS[level], reasons, source: "scores" };
  }

  /** Diễn giải quy tắc cảnh báo thành câu chữ, in kèm báo cáo. */
  function warningRuleText() {
    const w = S().warning || {};
    return [
      `Khi đã nhập Kết quả học tập theo học kỳ: cảnh báo nếu điểm trung bình chung học kỳ ` +
      `dưới ${U.num(w.termGpaBelow)} (học kỳ đầu khoá: dưới ${U.num(w.termGpaFirstBelow)}), ` +
      `hoặc học kỳ đó không có điểm để xét. Bị hai học kỳ liền nhau là "CBHV 2 lần liên tiếp".`,
      `Khi chưa có kết quả học kỳ, ứng dụng tạm xét theo điểm tích luỹ:`,
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

  /* =====================================================================
     6. Quy định riêng của Trường Đại học Xây dựng Miền Tây
     Các con số dưới đây chép thẳng từ văn bản, có ghi rõ điều khoản để
     sau này đối chiếu lại cho nhanh.
     ===================================================================== */

  /* --- Ban cán sự lớp — Quyết định 724/QĐ-ĐHXDMT ngày 28/11/2025 --- */

  /** Điều 2.2: mỗi lớp có 01 lớp trưởng, 01 lớp phó và Bí thư Chi đoàn (nếu có). */
  const CADRE_ROLES = [
    { value: "", label: "— Không giữ chức vụ —" },
    { value: "Lớp trưởng", label: "Lớp trưởng", unique: true },
    { value: "Lớp phó", label: "Lớp phó", unique: true },
    { value: "Bí thư Chi đoàn", label: "Bí thư Chi đoàn", unique: true },
    { value: "Lớp phó kiêm Bí thư", label: "Lớp phó kiêm Bí thư (lớp dưới 20 sinh viên)", unique: true }
  ];

  /**
   * Điều 3.3: ban cán sự phải có điểm trung bình học tập từ 5,5 (thang 10)
   * trở lên và điểm rèn luyện từ loại Khá. Sinh viên năm nhất chưa có điểm
   * thì căn cứ điểm xét tuyển hoặc tinh thần tự nguyện, nên không kết luận.
   */
  function cadreStandard(stats) {
    if (stats.gpa10 === null) {
      return { key: "unknown", ok: true,
        note: "Chưa có điểm học tập — theo Điều 3.3 thì xét theo điểm tuyển sinh hoặc tinh thần tự nguyện." };
    }
    const reasons = [];
    if (stats.gpa10 < 5.5) reasons.push(`điểm trung bình ${U.num(stats.gpa10)} dưới 5,5 (thang 10)`);
    const conduct = classifyConduct(stats.conductAvg);
    const goodConduct = stats.conductAvg !== null && stats.conductAvg >= 65;
    if (stats.conductAvg === null) reasons.push("chưa chấm điểm rèn luyện");
    else if (!goodConduct) reasons.push(`rèn luyện xếp loại ${conduct.label}, chưa đạt từ Khá`);
    return reasons.length
      ? { key: "fail", ok: false, note: "Chưa đạt tiêu chuẩn ban cán sự: " + reasons.join("; ") + "." }
      : { key: "pass", ok: true,
          note: `Đạt tiêu chuẩn ban cán sự: điểm trung bình ${U.num(stats.gpa10)}, rèn luyện ${conduct.label}.` };
  }

  /** Kiểm tra một lớp có bị trùng chức vụ không. */
  function cadreConflicts(classId, exceptStudentId) {
    const list = CV.store.find("students", (s) => s.classId === classId && s.cadreRole &&
      s.id !== exceptStudentId);
    const taken = {};
    list.forEach((s) => { taken[s.cadreRole] = (taken[s.cadreRole] || []).concat(s.name); });
    return taken;
  }

  /* --- Đăng ký học phần — Thông báo 411/TB-ĐHXDMT ngày 30/7/2026 --- */

  const REG_STATUS = {
    none:      { label: "Chưa đăng ký", badge: "badge-critical" },
    pending:   { label: "Chờ cố vấn xác nhận", badge: "badge-watch" },
    confirmed: { label: "Đã xác nhận", badge: "badge-ok" },
    fix:       { label: "Cần sửa lại", badge: "badge-warn" }
  };

  /** Bản đăng ký của một sinh viên trong một học kỳ. */
  function registrationOf(studentId, semesterId) {
    return CV.store.first("registrations",
      (r) => r.studentId === studentId && r.semesterId === semesterId);
  }

  /** Trạng thái đăng ký, kèm nhận xét về số tín chỉ nếu Trường có đặt giới hạn. */
  function registrationState(reg) {
    const cfg = S().registration || {};
    if (!reg || reg.credits === null || reg.credits === undefined || U.parseNum(reg.credits) === 0) {
      return { key: "none", ...REG_STATUS.none, credits: 0, notes: ["Chưa có tín chỉ nào đăng ký."] };
    }
    const credits = U.parseNum(reg.credits);
    const notes = [];
    if (cfg.maxCredits > 0 && credits > cfg.maxCredits) {
      notes.push(`Đăng ký ${credits} tín chỉ, vượt mức tối đa ${cfg.maxCredits}.`);
    }
    if (cfg.minCredits > 0 && credits < cfg.minCredits) {
      notes.push(`Đăng ký ${credits} tín chỉ, thấp hơn mức tối thiểu ${cfg.minCredits}.`);
    }
    const key = reg.status === "confirmed" ? "confirmed" : reg.status === "fix" ? "fix" : "pending";
    return { key, ...REG_STATUS[key], credits, notes };
  }

  /**
   * Tổng hợp tình hình đăng ký của một nhóm sinh viên trong một học kỳ.
   * Thông báo 411 giao cho cố vấn "kiểm tra, xác nhận kết quả đăng ký học phần
   * của sinh viên và gửi về Phòng Quản lý Đào tạo" trước một mốc hạn.
   */
  function registrationSummary(students, semesterId) {
    const counts = { none: 0, pending: 0, confirmed: 0, fix: 0 };
    let credits = 0;
    const rows = students.map((st) => {
      const reg = registrationOf(st.id, semesterId);
      const state = registrationState(reg);
      counts[state.key]++;
      credits += state.credits;
      return { student: st, reg, state };
    });
    const sem = CV.store.get("semesters", semesterId) || {};
    const deadline = sem.regDeadline || "";
    let daysLeft = null;
    if (deadline) {
      const d = new Date(deadline + "T23:59:59");
      if (!isNaN(d)) daysLeft = Math.ceil((d - new Date()) / 86400000);
    }
    return {
      rows, counts, totalCredits: credits, total: students.length,
      deadline, daysLeft,
      done: counts.confirmed === students.length && students.length > 0,
      avgCredits: students.length ? credits / students.length : 0
    };
  }

  /**
   * Gợi ý điểm tiêu chí "Tư vấn đăng ký môn học" (tối đa 30) từ tình hình thực tế.
   * Quy định trừ 10 điểm khi không duyệt đăng ký đúng thời hạn.
   */
  function suggestRegisterScore(summary) {
    const max = 30;
    if (!summary.total) return max;
    if (summary.done) return max;
    const overdue = summary.daysLeft !== null && summary.daysLeft < 0;
    return overdue ? Math.max(0, max - 10) : max;
  }

  /* --- Công tác CVHT & GVCN — Quyết định 758/QĐ-ĐHXDMT ngày 10/12/2025 --- */

  /**
   * Điều 13.4: sáu tiêu chí, tổng 100 điểm. Mỗi tiêu chí chấm từ mức trừ
   * điểm ghi trong quy định, nên ở đây để người dùng tự nhập số điểm đạt.
   */
  const EVAL_CRITERIA = [
    { key: "meetings", label: "Tổ chức họp lớp", max: 20,
      rule: "Thiếu mỗi buổi họp lớp trừ 05 điểm." },
    { key: "office", label: "Lịch gặp sinh viên hằng tuần", max: 20,
      rule: "Thiếu mỗi buổi trực gặp sinh viên trừ 05 điểm." },
    { key: "register", label: "Tư vấn đăng ký môn học", max: 30,
      rule: "Mỗi trường hợp tư vấn sai trừ 05 điểm. Không duyệt đăng ký môn học đúng thời hạn trừ 10 điểm." },
    { key: "notify", label: "Thông báo tới sinh viên", max: 10,
      rule: "Không thông báo lịch tiếp sinh viên trừ 05 điểm. Không phổ biến thông báo của Nhà trường trừ 05 điểm." },
    { key: "training", label: "Tham dự tập huấn, hội nghị, hội thảo", max: 10,
      rule: "Vắng không lý do 01 buổi tập huấn trừ 05 điểm. Vắng sự kiện khác được triệu tập trừ 05 điểm/lần." },
    { key: "report", label: "Nộp báo cáo / điểm đánh giá rèn luyện", max: 10,
      rule: "Trừ 05 điểm mỗi lần trễ hạn." }
  ];
  const EVAL_TOTAL = 100;

  /** Điều 13.4 và Điều 18: xếp loại và mức hưởng giờ quy đổi. */
  function evalLevel(score) {
    const v = U.parseNum(score);
    if (isNaN(v)) return { key: "none", label: "Chưa chấm", percent: 0, badge: "badge-info" };
    if (v >= 90) return { key: "xs", label: "Hoàn thành xuất sắc nhiệm vụ", percent: 100, badge: "badge-ok" };
    if (v >= 70) return { key: "tot", label: "Hoàn thành tốt nhiệm vụ", percent: 75, badge: "badge-ok" };
    if (v >= 50) return { key: "ht", label: "Hoàn thành nhiệm vụ", percent: 50, badge: "badge-watch" };
    return { key: "kht", label: "Không hoàn thành nhiệm vụ", percent: 0, badge: "badge-critical" };
  }

  /** Điều 18.3: giờ quy đổi theo sĩ số lớp phụ trách. */
  function advisorHours(size) {
    const table = ((S().duty || {}).hoursBySize || []).slice().sort((a, b) => a.max - b.max);
    if (!table.length) return null;
    const row = table.find((r) => size <= r.max);
    return row ? row.hours : table[table.length - 1].hours;
  }

  /** Số buổi họp lớp đã ghi nhận trong một học kỳ, so với mức tối thiểu. */
  function meetingStatus(classId, semesterId) {
    const need = (S().duty || {}).meetingsPerTerm || 0;
    const rows = CV.store.find("meetings", (m) =>
      m.classId === classId && (!semesterId || m.semesterId === semesterId));
    const withMinutes = rows.filter((m) => m.minutes && String(m.minutes).trim()).length;
    return { count: rows.length, need, withMinutes, enough: rows.length >= need };
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
    termResultsOf, termFlagged, termWarning,
    REG_STATUS, registrationOf, registrationState, registrationSummary, suggestRegisterScore,
    CADRE_ROLES, cadreStandard, cadreConflicts,
    EVAL_CRITERIA, EVAL_TOTAL, evalLevel, advisorHours, meetingStatus,
    validate: V
  };
})();
