/* =====================================================================
   pack.js — gói dữ liệu riêng cho từng sinh viên

   Cổng sinh viên đã chỉ hiển thị hồ sơ của người đang đăng nhập, nhưng nếu
   cả cơ sở dữ liệu của lớp nằm trên máy sinh viên thì đó mới chỉ là ẩn đi
   trên giao diện. Tệp gói ở đây giải quyết tận gốc: nó **chỉ chứa dữ liệu
   của đúng một em**, nên trên máy em ấy không hề có dữ liệu của bạn khác
   để mà lộ.

   Gói được mã hoá bằng mã PIN của chính em đó (AES-GCM, khoá dẫn xuất bằng
   PBKDF2-SHA256 200.000 vòng), vì tệp sẽ đi qua Zalo hay email.
   ===================================================================== */
window.CV = window.CV || {};

CV.pack = (function () {
  "use strict";
  const U = CV.util;

  const TYPE_PLAIN = "student-package";
  const TYPE_ENC = "student-package-encrypted";
  const TYPE_UPDATE = "student-update";
  const TYPE_UPDATE_ENC = "student-update-encrypted";

  /** Những trường sinh viên được tự sửa rồi gửi ngược về cho cố vấn. */
  const STUDENT_FIELDS = [
    { key: "phone", label: "Điện thoại" },
    { key: "zalo", label: "Zalo" },
    { key: "email", label: "Email" },
    { key: "address", label: "Địa chỉ" },
    { key: "contactNote", label: "Ghi chú liên hệ" }
  ];
  const PBKDF2_ROUNDS = 200000;

  const subtle = () => (typeof crypto !== "undefined" && crypto.subtle) ? crypto.subtle : null;

  /* ------------------------------------------------------------------ */
  /* 1. Dựng gói — quyết định cái gì được đi, cái gì ở lại               */
  /* ------------------------------------------------------------------ */

  /**
   * Danh sách những thứ CỐ Ý không đưa vào gói. Ghi ra đây để sau này ai
   * đọc mã cũng thấy ngay, và để màn hình xuất gói hiện đúng nội dung này
   * cho cố vấn xem trước khi gửi.
   */
  const EXCLUDED = [
    "Hồ sơ, điểm, điểm rèn luyện của mọi sinh viên khác",
    "Mật khẩu của giảng viên (chỉ lấy tên, email, điện thoại để liên hệ)",
    "Nhật ký cố vấn đánh dấu chỉ giảng viên xem",
    "Sổ họp lớp và phiếu tự đánh giá công tác của giảng viên",
    "Danh sách lớp, sĩ số và thống kê toàn lớp"
  ];

  /** Chỉ giữ các trường cần cho việc hiển thị, bỏ những gì thừa. */
  function pickFields(obj, fields) {
    const out = {};
    fields.forEach((f) => { if (obj[f] !== undefined) out[f] = obj[f]; });
    return out;
  }

  /**
   * Dựng gói dữ liệu của một sinh viên.
   * @returns {{ok:boolean, data?:object, error?:string}}
   */
  function build(studentId) {
    const S = CV.store;
    const st = S.get("students", studentId);
    if (!st) return { ok: false, error: "Không tìm thấy sinh viên." };
    if (!st.secret) {
      return { ok: false, error: "Sinh viên chưa được cấp mã PIN. Hãy cấp mã PIN trước khi gửi gói dữ liệu." };
    }

    const klass = st.classId ? S.get("classes", st.classId) : null;
    const settings = S.settings();

    // Chỉ lấy thông tin liên hệ của giảng viên phụ trách, tuyệt đối không lấy secret
    const staffIds = [];
    if (klass) {
      if (klass.advisorId) staffIds.push({ id: klass.advisorId, role: "Cố vấn học tập" });
      if (klass.gvcnId && klass.gvcnId !== klass.advisorId) {
        staffIds.push({ id: klass.gvcnId, role: "Giáo viên chủ nhiệm" });
      }
    }
    const advisors = staffIds.map((x) => {
      const a = S.get("advisors", x.id);
      if (!a) return null;
      const contact = pickFields(a, ["id", "name", "title", "email", "phone"]);
      contact.roleLabel = x.role;
      contact.contactOnly = true;   // không có secret, không đăng nhập được
      return contact;
    }).filter(Boolean);

    const mine = (col) => S.find(col, (r) => r.studentId === studentId);
    const scores = mine("scores");
    const conduct = mine("conduct");
    const termResults = mine("termResults");
    const registrations = mine("registrations");
    const appointments = mine("appointments");
    // Ghi chú riêng của cố vấn thì giữ lại, không gửi đi
    const notes = S.find("notes", (n) => n.studentId === studentId && !n.privateNote);

    // Chỉ những học kỳ mà em này thực sự có dữ liệu
    const usedSem = new Set();
    [scores, conduct, termResults, registrations].forEach((rows) =>
      rows.forEach((r) => { if (r.semesterId) usedSem.add(r.semesterId); }));
    const semesters = S.all("semesters")
      .filter((x) => usedSem.has(x.id))
      .map((x) => pickFields(x, ["id", "code", "name", "startDate", "endDate",
        "firstOfCourse", "regStart", "regEnd", "regDeadline"]));

    // Mã liên kết: cố vấn sinh ra, gói mang theo, sinh viên gửi ngược lại khi
    // cập nhật. Nhờ đó cố vấn biết tệp cập nhật đúng là của em ấy, và dùng
    // luôn mã này làm khoá mã hoá cho chiều về.
    let token = st.linkToken;
    if (!token) {
      token = U.randomHex(16);
      CV.store.put("students", { id: st.id, linkToken: token });
    }

    return {
      ok: true,
      data: {
        _app: "CVHT MTU",
        _type: TYPE_PLAIN,
        _version: 1,
        issuedAt: new Date().toISOString(),
        linkToken: token,
        // Địa chỉ máy chủ đồng bộ, để máy sinh viên khỏi phải gõ tay.
        // Không kèm khoá giảng viên: máy sinh viên xác thực bằng mã liên kết.
        sync: settings.sync && settings.sync.url
          ? { url: settings.sync.url, enabled: !!settings.sync.enabled } : null,
        student: Object.assign({}, st, { linkToken: token }),
        klass: klass ? pickFields(klass, ["id", "code", "name", "course", "major", "advisorId", "gvcnId"]) : null,
        advisors, semesters, scores, conduct, termResults, registrations, appointments, notes,
        // Chỉ những thiết lập cần cho việc hiển thị. Cố ý không có nhánh
        // sync (chứa khoá giảng viên) và không có duty/registration.
        settings: pickFields(settings, ["schoolName", "schoolShort", "facultyName",
          "gradeScale", "conductScale", "warning", "studentLogin", "retakeRule", "theme"])
      }
    };
  }

  /** Những gì gói sẽ mang theo, để hiện cho cố vấn xem trước khi gửi. */
  function summarize(pkg) {
    return [
      `Hồ sơ cá nhân của ${pkg.student.name} (${pkg.student.mssv})`,
      `${pkg.scores.length} điểm học phần`,
      `${pkg.termResults.length} kết quả học kỳ`,
      `${pkg.conduct.length} lần chấm điểm rèn luyện`,
      `${pkg.registrations.length} bản đăng ký học phần`,
      `${pkg.appointments.length} lịch tư vấn`,
      `${pkg.notes.length} lời nhắn của cố vấn (loại sinh viên xem được)`,
      `Liên hệ của ${pkg.advisors.length} giảng viên phụ trách`
    ];
  }

  /* ------------------------------------------------------------------ */
  /* 2. Mã hoá bằng mã PIN của sinh viên                                 */
  /* ------------------------------------------------------------------ */
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const toB64 = (bytes) => {
    let s = "";
    const a = new Uint8Array(bytes);
    for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  };
  const fromB64 = (b64) => {
    const bin = atob(b64);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  };

  async function deriveKey(pin, salt) {
    const base = await subtle().importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
    return subtle().deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /** Bọc một đối tượng bằng AES-GCM, khoá dẫn xuất từ chuỗi bí mật cho trước. */
  async function seal(obj, secret, type, head) {
    if (!subtle()) {
      throw new Error("Trình duyệt này không mã hoá được (cần chạy qua https hoặc localhost).");
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(secret, salt);
    const cipher = await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return Object.assign({
      _app: "CVHT MTU", _type: type, _version: 1,
      rounds: PBKDF2_ROUNDS, salt: toB64(salt), iv: toB64(iv), data: toB64(cipher)
    }, head || {});
  }

  /** Mở tệp đã bọc. Sai khoá thì báo lỗi rõ ràng. */
  async function open(file, secret, wrongMsg) {
    if (!subtle()) {
      throw new Error("Trình duyệt này không giải mã được (cần chạy qua https hoặc localhost).");
    }
    const key = await deriveKey(secret, fromB64(file.salt));
    try {
      const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, key, fromB64(file.data));
      return JSON.parse(dec.decode(plain));
    } catch (e) {
      throw new Error(wrongMsg || "Không mở được tệp: sai khoá hoặc tệp đã hỏng.");
    }
  }

  /** Mã hoá gói dữ liệu bằng mã PIN của sinh viên. */
  function encrypt(pkg, pin) {
    return seal(pkg, pin, TYPE_ENC, { mssv: pkg.student.mssv, issuedAt: pkg.issuedAt });
  }

  /** Giải mã gói bằng mã PIN. */
  function decrypt(file, pin) {
    if (!file || file._type !== TYPE_ENC) {
      return Promise.reject(new Error("Tệp không phải gói dữ liệu đã mã hoá."));
    }
    return open(file, pin, "Mã PIN không đúng, hoặc tệp đã hỏng.");
  }

  /* ------------------------------------------------------------------ */
  /* 2b. Chiều ngược: sinh viên gửi cập nhật về cho cố vấn               */
  /* ------------------------------------------------------------------ */

  /**
   * Dựng phiếu cập nhật từ máy sinh viên: chỉ gồm mấy trường liên hệ em ấy
   * tự sửa, cộng với những lịch hẹn em đặt khi chưa gửi được cho cố vấn.
   */
  function buildUpdate(studentId) {
    const S = CV.store;
    const st = S.get("students", studentId);
    if (!st) return { ok: false, error: "Không tìm thấy hồ sơ." };
    if (!st.linkToken) {
      return { ok: false, error: "Hồ sơ này chưa có mã liên kết. Hãy xin cố vấn gửi lại gói dữ liệu." };
    }
    const fields = {};
    STUDENT_FIELDS.forEach((f) => { if (st[f.key] !== undefined) fields[f.key] = st[f.key] || ""; });

    const appointments = S.find("appointments",
      (a) => a.studentId === studentId && a.createdBy === "student")
      .map((a) => pickFields(a, ["id", "studentId", "advisorId", "date", "time", "topic",
        "place", "status", "createdBy", "createdAt"]));

    return {
      ok: true,
      data: {
        _app: "CVHT MTU", _type: TYPE_UPDATE, _version: 1,
        mssv: st.mssv, name: st.name, studentId,
        linkToken: st.linkToken,
        sentAt: new Date().toISOString(),
        fields, appointments
      }
    };
  }

  const encryptUpdate = (upd) =>
    seal(upd, upd.linkToken, TYPE_UPDATE_ENC, { mssv: upd.mssv, sentAt: upd.sentAt });

  /**
   * Mở phiếu cập nhật ở máy cố vấn. Khoá chính là mã liên kết đang lưu trong
   * hồ sơ sinh viên, nên tệp của em nào chỉ mở được bằng hồ sơ em ấy.
   */
  async function openUpdate(file) {
    if (!file) throw new Error("Không đọc được tệp.");
    if (file._type === TYPE_UPDATE) return file;   // bản chưa mã hoá
    if (file._type !== TYPE_UPDATE_ENC) throw new Error("Tệp này không phải phiếu cập nhật của sinh viên.");
    const st = CV.store.first("students",
      (x) => String(x.mssv).toUpperCase() === String(file.mssv || "").toUpperCase());
    if (!st) throw new Error(`Không có sinh viên nào mang mã ${file.mssv} trong danh sách.`);
    if (!st.linkToken) throw new Error(`Chưa từng gửi gói dữ liệu cho ${st.name}, nên không mở được phiếu này.`);
    return open(file, st.linkToken,
      "Phiếu này không khớp với hồ sơ đang lưu. Có thể em ấy đã được gửi gói mới hơn.");
  }

  /** So sánh phiếu cập nhật với hồ sơ hiện có, liệt kê đúng những gì đổi. */
  function diffUpdate(upd) {
    const st = CV.store.first("students",
      (x) => String(x.mssv).toUpperCase() === String(upd.mssv || "").toUpperCase());
    if (!st) return { ok: false, error: `Không tìm thấy sinh viên ${upd.mssv}.` };
    if (st.linkToken && upd.linkToken && st.linkToken !== upd.linkToken) {
      return { ok: false, error: "Mã liên kết trong phiếu không khớp hồ sơ. Phiếu có thể đã cũ." };
    }
    const changes = [];
    STUDENT_FIELDS.forEach((f) => {
      const now = st[f.key] || "";
      const next = (upd.fields || {})[f.key] || "";
      if (String(now) !== String(next)) changes.push({ ...f, from: now, to: next });
    });
    const known = new Set(CV.store.all("appointments").map((a) => a.id));
    const newAppointments = (upd.appointments || []).filter((a) => !known.has(a.id));
    return { ok: true, student: st, changes, newAppointments };
  }

  /** Ghi phiếu cập nhật vào dữ liệu của cố vấn. */
  function applyUpdate(upd) {
    const d = diffUpdate(upd);
    if (!d.ok) return d;
    const payload = { id: d.student.id };
    d.changes.forEach((c) => { payload[c.key] = c.to; });
    payload.updateReceivedAt = new Date().toISOString();
    CV.store.put("students", payload, { save: false });
    d.newAppointments.forEach((a) => {
      CV.store.put("appointments", Object.assign({}, a, { studentId: d.student.id }), { save: false });
    });
    CV.store.save("apply-student-update");
    return { ok: true, student: d.student, changes: d.changes, newAppointments: d.newAppointments };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Nạp gói vào máy sinh viên                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Thay toàn bộ dữ liệu trên máy này bằng nội dung gói, rồi khoá ứng dụng
   * vào chế độ sinh viên. Sau bước này trên máy chỉ còn dữ liệu của một em.
   */
  function install(pkg) {
    if (!pkg || pkg._type !== TYPE_PLAIN || !pkg.student) {
      return { ok: false, error: "Nội dung gói không đúng định dạng." };
    }
    const S = CV.store;
    S.reset();
    const db = S.data();

    Object.assign(db.settings, pkg.settings || {});
    db.settings.deviceMode = "student";
    if (pkg.sync && pkg.sync.url) {
      db.settings.sync = { url: pkg.sync.url, key: "", enabled: !!pkg.sync.enabled,
        auto: true, lastAt: "", lastError: "" };
    }
    db.settings.packageOf = pkg.student.mssv;
    db.settings.installedAt = new Date().toISOString();

    db.advisors = (pkg.advisors || []).map((a) => Object.assign({ active: false }, a));
    db.classes = pkg.klass ? [pkg.klass] : [];
    db.students = [pkg.student];
    db.semesters = pkg.semesters || [];
    db.scores = pkg.scores || [];
    db.conduct = pkg.conduct || [];
    db.termResults = pkg.termResults || [];
    db.registrations = pkg.registrations || [];
    db.appointments = pkg.appointments || [];
    db.notes = pkg.notes || [];

    const ok = S.save("install-package");
    return ok ? { ok: true, student: pkg.student } : { ok: false, error: "Không ghi được vào bộ nhớ trình duyệt." };
  }

  const isStudentDevice = () => CV.store.settings().deviceMode === "student";

  /* ------------------------------------------------------------------ */
  /* 4. Kiểm tra gói không lọt dữ liệu người khác                        */
  /* ------------------------------------------------------------------ */
  /**
   * Soi lại gói trước khi gửi: mọi bản ghi phải thuộc đúng sinh viên này,
   * và không được mang theo bất kỳ dấu vết mật khẩu nào của giảng viên.
   * Dùng cả trong phép thử tự động lẫn trước lúc xuất tệp.
   */
  function audit(pkg) {
    const problems = [];
    const id = pkg.student.id;
    [["scores", "điểm học phần"], ["conduct", "điểm rèn luyện"], ["termResults", "kết quả học kỳ"],
     ["registrations", "đăng ký học phần"], ["appointments", "lịch tư vấn"], ["notes", "lời nhắn"]
    ].forEach(([col, label]) => {
      (pkg[col] || []).forEach((r) => {
        if (r.studentId !== id) problems.push(`Có ${label} của sinh viên khác trong gói.`);
      });
    });
    if ((pkg.notes || []).some((n) => n.privateNote)) {
      problems.push("Gói chứa ghi chú riêng của cố vấn.");
    }
    (pkg.advisors || []).forEach((a) => {
      if (a.secret) problems.push(`Gói chứa mật khẩu của ${a.name}.`);
    });
    if (pkg.settings && pkg.settings.sync) problems.push("Gói chứa khoá máy chủ của giảng viên.");
    if (pkg.sync && pkg.sync.key) problems.push("Gói chứa khoá máy chủ của giảng viên.");
    if (Array.isArray(pkg.students) || pkg.classes) {
      problems.push("Gói chứa danh sách lớp hoặc danh sách sinh viên.");
    }
    return { ok: problems.length === 0, problems: Array.from(new Set(problems)) };
  }

  return {
    TYPE_PLAIN, TYPE_ENC, TYPE_UPDATE, TYPE_UPDATE_ENC, EXCLUDED, PBKDF2_ROUNDS, STUDENT_FIELDS,
    build, summarize, encrypt, decrypt, install, isStudentDevice, audit,
    buildUpdate, encryptUpdate, openUpdate, diffUpdate, applyUpdate
  };
})();
