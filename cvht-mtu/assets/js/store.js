/* =====================================================================
   store.js — tầng dữ liệu
   Mọi thao tác đọc/ghi của ứng dụng đều đi qua tệp này. Hôm nay nơi lưu
   là localStorage của trình duyệt; muốn chuyển sang máy chủ thật thì chỉ
   cần thay phần adapter bên dưới, phần còn lại của ứng dụng giữ nguyên.
   ===================================================================== */
window.CV = window.CV || {};

CV.store = (function () {
  "use strict";
  const U = CV.util;

  const DB_KEY = "CVHT_MTU_DB_V1";
  const SESSION_KEY = "CVHT_MTU_SESSION_V1";
  const SCHEMA_VERSION = 1;

  /** Các bảng dữ liệu. Thứ tự này cũng là thứ tự xuất hiện trong tệp sao lưu. */
  const COLLECTIONS = [
    "advisors",     // giảng viên cố vấn
    "classes",      // lớp cố vấn
    "students",     // sinh viên
    "semesters",    // học kỳ
    "scores",       // điểm học phần
    "conduct",      // điểm rèn luyện
    "appointments", // lịch tư vấn 1-1
    "notes",        // nhật ký cố vấn
    "schedules",    // thời khoá biểu
    "handbook",     // cẩm nang học vụ
    "templates"     // mẫu thông báo
  ];

  /* ---------- thiết lập mặc định ---------- */
  function defaultSettings() {
    return {
      schoolName: "Trường Đại học Xây dựng Miền Tây",
      schoolShort: "MTU",
      facultyName: "",
      // Thang điểm chữ. Sửa được trong mục Cài đặt để khớp quy chế của Trường.
      // Mặc định theo Quy chế đào tạo trình độ đại học (Thông tư 08/2021/TT-BGDĐT).
      gradeScale: [
        { letter: "A",  min: 8.5, gpa4: 4.0, label: "Giỏi / Xuất sắc" },
        { letter: "B+", min: 8.0, gpa4: 3.5, label: "Khá giỏi" },
        { letter: "B",  min: 7.0, gpa4: 3.0, label: "Khá" },
        { letter: "C+", min: 6.5, gpa4: 2.5, label: "Trung bình khá" },
        { letter: "C",  min: 5.5, gpa4: 2.0, label: "Trung bình" },
        { letter: "D+", min: 5.0, gpa4: 1.5, label: "Trung bình yếu" },
        { letter: "D",  min: 4.0, gpa4: 1.0, label: "Yếu (đạt)" },
        { letter: "F",  min: 0.0, gpa4: 0.0, label: "Không đạt" }
      ],
      // Ngưỡng cảnh báo học vụ. Sửa được để khớp quy chế của Trường.
      warning: {
        gpaWatch: 2.0,      // GPA tích luỹ dưới mức này: cần theo dõi
        gpaWarn: 1.5,       // dưới mức này: cảnh báo
        gpaCritical: 1.0,   // dưới mức này: nguy cơ buộc thôi học
        debtWatch: 1,       // nợ từ ngần này tín chỉ: cần theo dõi
        debtWarn: 8,        // nợ quá ngần này tín chỉ: cảnh báo
        debtCritical: 24    // nợ quá ngần này tín chỉ: nguy cơ buộc thôi học
      },
      conductScale: [
        { min: 90, label: "Xuất sắc" }, { min: 80, label: "Tốt" },
        { min: 65, label: "Khá" }, { min: 50, label: "Trung bình" },
        { min: 35, label: "Yếu" }, { min: 0, label: "Kém" }
      ],
      // Cách tính khi sinh viên học lại một học phần:
      // "best" = lấy điểm cao nhất, "latest" = lấy điểm của lần học gần nhất.
      retakeRule: "best",
      studentLogin: "pin",   // "pin" = MSSV + mã PIN do CVHT cấp; "dob" = MSSV + ngày sinh
      theme: "auto",
      createdAt: new Date().toISOString()
    };
  }

  function emptyDb() {
    const db = { version: SCHEMA_VERSION, settings: defaultSettings() };
    COLLECTIONS.forEach((c) => (db[c] = []));
    return db;
  }

  /* ---------- nơi lưu ---------- */
  const adapter = {
    read(key) {
      try { return window.localStorage.getItem(key); }
      catch (e) { console.warn("Không đọc được localStorage:", e); return null; }
    },
    write(key, value) {
      try { window.localStorage.setItem(key, value); return true; }
      catch (e) {
        console.error("Không ghi được localStorage:", e);
        return false;
      }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* bỏ qua */ }
    }
  };

  let db = null;
  let lastWriteFailed = false;
  const listeners = new Set();
  let channel = null;

  function notify(reason) {
    listeners.forEach((fn) => {
      try { fn(reason); } catch (e) { console.error(e); }
    });
  }

  /* ---------- nạp / ghi ---------- */
  function load() {
    const raw = adapter.read(DB_KEY);
    if (!raw) { db = emptyDb(); return db; }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      console.error("Dữ liệu lưu trữ hỏng, tạo cơ sở dữ liệu trống:", e);
      db = emptyDb();
      return db;
    }
    db = migrate(parsed);
    return db;
  }

  /** Bổ khuyết những trường còn thiếu khi nâng cấp phiên bản. */
  function migrate(raw) {
    const fresh = emptyDb();
    const out = { version: SCHEMA_VERSION };
    out.settings = Object.assign({}, fresh.settings, raw.settings || {});
    out.settings.warning = Object.assign({}, fresh.settings.warning, (raw.settings || {}).warning || {});
    if (!Array.isArray(out.settings.gradeScale) || !out.settings.gradeScale.length) {
      out.settings.gradeScale = fresh.settings.gradeScale;
    }
    if (!Array.isArray(out.settings.conductScale) || !out.settings.conductScale.length) {
      out.settings.conductScale = fresh.settings.conductScale;
    }
    COLLECTIONS.forEach((c) => { out[c] = Array.isArray(raw[c]) ? raw[c] : []; });
    return out;
  }

  function save(reason) {
    if (!db) return false;
    const ok = adapter.write(DB_KEY, JSON.stringify(db));
    lastWriteFailed = !ok;
    if (ok && channel) {
      try { channel.postMessage({ type: "db-changed", at: Date.now() }); } catch (e) { /* bỏ qua */ }
    }
    notify(reason || "save");
    return ok;
  }

  const data = () => db || load();
  const settings = () => data().settings;

  /* ---------- CRUD chung ---------- */
  function all(col) {
    const rows = data()[col];
    return Array.isArray(rows) ? rows : [];
  }
  const get = (col, id) => all(col).find((r) => r.id === id) || null;
  const find = (col, fn) => all(col).filter(fn);
  const first = (col, fn) => all(col).find(fn) || null;

  function put(col, obj, opts) {
    const rows = data()[col];
    const now = new Date().toISOString();
    if (!obj.id) {
      obj.id = U.uid(col.slice(0, 3));
      obj.createdAt = now;
      obj.updatedAt = now;
      rows.push(obj);
    } else {
      const i = rows.findIndex((r) => r.id === obj.id);
      obj.updatedAt = now;
      if (i === -1) { obj.createdAt = obj.createdAt || now; rows.push(obj); }
      else rows[i] = Object.assign({}, rows[i], obj);
    }
    if (!opts || opts.save !== false) save(`put:${col}`);
    return obj;
  }

  function remove(col, id, opts) {
    const rows = data()[col];
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return false;
    rows.splice(i, 1);
    if (!opts || opts.save !== false) save(`remove:${col}`);
    return true;
  }

  /** Xoá sinh viên kèm mọi dữ liệu phụ thuộc, tránh để lại bản ghi mồ côi. */
  function removeStudentCascade(studentId) {
    ["scores", "conduct", "appointments", "notes", "schedules"].forEach((col) => {
      data()[col] = all(col).filter((r) => r.studentId !== studentId);
    });
    remove("students", studentId, { save: false });
    save("remove:student-cascade");
  }

  /** Xoá lớp: chỉ cho phép khi lớp không còn sinh viên. */
  function removeClass(classId) {
    if (all("students").some((s) => s.classId === classId)) {
      return { ok: false, reason: "Lớp vẫn còn sinh viên. Hãy chuyển hoặc xoá sinh viên trước." };
    }
    data().schedules = all("schedules").filter((r) => r.classId !== classId);
    remove("classes", classId);
    return { ok: true };
  }

  /* ---------- phiên đăng nhập ---------- */
  const SESSION_HOURS = { advisor: 8, student: 3 };

  function setSession(kind, id) {
    const hours = SESSION_HOURS[kind] || 2;
    const s = { kind, id, at: Date.now(), exp: Date.now() + hours * 3600 * 1000 };
    adapter.write(SESSION_KEY, JSON.stringify(s));
    notify("session");
    return s;
  }
  function session() {
    const raw = adapter.read(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s || !s.exp || Date.now() > s.exp) { adapter.remove(SESSION_KEY); return null; }
      // phiên trỏ tới bản ghi đã bị xoá thì coi như hết hiệu lực
      const who = s.kind === "advisor" ? get("advisors", s.id) : get("students", s.id);
      if (!who) { adapter.remove(SESSION_KEY); return null; }
      return s;
    } catch (e) { adapter.remove(SESSION_KEY); return null; }
  }
  function clearSession() { adapter.remove(SESSION_KEY); notify("session"); }
  /** Gia hạn phiên mỗi khi người dùng còn thao tác. */
  function touchSession() {
    const s = session();
    if (s) setSession(s.kind, s.id);
  }

  /* ---------- sao lưu / phục hồi ---------- */
  function exportJson() {
    return JSON.stringify({
      _app: "CVHT MTU", _version: SCHEMA_VERSION, _exportedAt: new Date().toISOString(),
      data: data()
    }, null, 2);
  }

  function importJson(text, mode) {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { ok: false, error: "Tệp không phải JSON hợp lệ." }; }
    const incoming = parsed && parsed.data ? parsed.data : parsed;
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.students)) {
      return { ok: false, error: "Tệp không đúng cấu trúc sao lưu của ứng dụng." };
    }
    const next = migrate(incoming);
    if (mode === "merge") {
      const cur = data();
      COLLECTIONS.forEach((col) => {
        const byId = new Map(cur[col].map((r) => [r.id, r]));
        next[col].forEach((r) => byId.set(r.id, r));
        next[col] = Array.from(byId.values());
      });
      next.settings = Object.assign({}, cur.settings, next.settings);
    }
    db = next;
    const ok = save("import");
    return ok ? { ok: true, counts: countAll() } : { ok: false, error: "Không ghi được vào bộ nhớ trình duyệt." };
  }

  function countAll() {
    const out = {};
    COLLECTIONS.forEach((c) => (out[c] = all(c).length));
    return out;
  }

  function reset() {
    db = emptyDb();
    adapter.remove(SESSION_KEY);
    save("reset");
  }

  /** Ước lượng dung lượng đang chiếm, để cảnh báo trước khi đầy. */
  function usage() {
    const raw = adapter.read(DB_KEY) || "";
    const bytes = raw.length * 2; // UTF-16 trong localStorage
    return { bytes, kb: Math.round(bytes / 1024), limitKb: 5120 };
  }

  /* ---------- đồng bộ giữa các tab trên CÙNG một máy ---------- */
  function initSync() {
    if (typeof BroadcastChannel === "function") {
      try {
        channel = new BroadcastChannel("cvht-mtu");
        channel.onmessage = (ev) => {
          if (ev.data && ev.data.type === "db-changed") { load(); notify("remote"); }
        };
      } catch (e) { channel = null; }
    }
    if (typeof window.addEventListener === "function") {
      window.addEventListener("storage", (ev) => {
        if (ev.key === DB_KEY) { load(); notify("remote"); }
        if (ev.key === SESSION_KEY) notify("session");
      });
    }
  }

  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  return {
    COLLECTIONS, SCHEMA_VERSION, DB_KEY,
    load, save, data, settings, defaultSettings,
    all, get, find, first, put, remove, removeStudentCascade, removeClass,
    setSession, session, clearSession, touchSession,
    exportJson, importJson, reset, countAll, usage, initSync, on,
    get writeFailed() { return lastWriteFailed; }
  };
})();
