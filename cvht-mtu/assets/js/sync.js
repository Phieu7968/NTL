/* =====================================================================
   sync.js — đồng bộ hai chiều qua một máy chủ nhỏ

   Máy giảng viên và máy sinh viên nằm ở hai nơi khác nhau, nên muốn "sinh
   viên sửa số điện thoại là thầy cô thấy ngay" thì bắt buộc phải có một
   nơi lưu chung. Tệp server/cvht-sync.gs dựng chỗ đó bằng Google Apps
   Script trên chính tài khoản Google của tác giả, dữ liệu nằm trong một
   Google Sheet do tác giả sở hữu.

   Quy tắc hợp nhất: bản ghi nào sửa sau thì thắng (so theo updatedAt).
   Riêng mấy trường liên hệ thì sinh viên là người nắm đúng nhất, nên máy
   chủ chỉ cho máy sinh viên ghi đúng những trường đó của chính em ấy.
   ===================================================================== */
window.CV = window.CV || {};

CV.sync = (function () {
  "use strict";
  const U = CV.util;

  /** Các bảng được đồng bộ. Những bảng còn lại chỉ nằm ở máy giảng viên. */
  const SYNCED = ["classes", "students", "semesters", "scores", "conduct",
    "termResults", "registrations", "appointments", "notes"];

  /** Bảng nào thuộc về một sinh viên cụ thể, để máy chủ lọc đúng phần của em ấy. */
  const OWNED_BY_STUDENT = ["scores", "conduct", "termResults", "registrations",
    "appointments", "notes"];

  const cfg = () => {
    const s = CV.store.settings();
    if (!s.sync) s.sync = { url: "", key: "", enabled: false, auto: true, lastAt: "", lastError: "" };
    return s.sync;
  };

  const isOn = () => { const c = cfg(); return !!(c.enabled && c.url); };

  /* ------------------------------------------------------------------ */
  /* 1. Gọi máy chủ                                                      */
  /* ------------------------------------------------------------------ */
  async function call(action, payload) {
    const c = cfg();
    if (!c.url) throw new Error("Chưa khai địa chỉ máy chủ đồng bộ.");
    const body = Object.assign({ action }, payload || {});
    let res;
    try {
      // Apps Script chỉ nhận được nội dung dạng text/plain mà không đòi
      // preflight CORS, nên gửi JSON dưới dạng text.
      res = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        redirect: "follow"
      });
    } catch (e) {
      throw new Error("Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ đã khai.");
    }
    if (!res.ok) throw new Error(`Máy chủ trả về lỗi ${res.status}.`);
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error("Máy chủ trả về nội dung không phải JSON. Kiểm tra lại đường dẫn triển khai."); }
    if (!data || data.ok !== true) throw new Error((data && data.error) || "Máy chủ từ chối yêu cầu.");
    return data;
  }

  const ping = () => call("ping", auth());

  /** Thông tin xác thực tuỳ theo máy này là của giảng viên hay sinh viên. */
  function auth() {
    if (CV.pack.isStudentDevice()) {
      const st = CV.store.all("students")[0] || {};
      return { role: "student", mssv: st.mssv, token: st.linkToken };
    }
    return { role: "advisor", key: cfg().key };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Đóng gói bản ghi để gửi lên                                      */
  /* ------------------------------------------------------------------ */
  /** Mã số sinh viên mà bản ghi này thuộc về, để máy chủ lọc. */
  function ownerOf(col, row) {
    if (col === "students") return String(row.mssv || "");
    if (OWNED_BY_STUDENT.indexOf(col) >= 0) {
      const st = CV.store.get("students", row.studentId);
      return st ? String(st.mssv || "") : "";
    }
    return "";
  }

  /** Bỏ những trường không được rời khỏi máy giảng viên. */
  function scrub(col, row) {
    const out = Object.assign({}, row);
    if (col === "students") { delete out.secret; }
    return out;
  }

  /**
   * Khoá của bản ghi trên máy chủ.
   * Hồ sơ sinh viên khoá theo MÃ SỐ SINH VIÊN chứ không theo id nội bộ: nếu
   * cố vấn nhập lại danh sách lớp thì id nội bộ đổi, mà mã số thì không.
   * Khoá theo id sẽ sinh ra hai hồ sơ trùng mã số trên máy chủ, làm hỏng
   * cả việc xác thực lẫn việc đồng bộ.
   */
  function keyOf(col, row) {
    if (col === "students") return "students:" + String(row.mssv || row.id).toUpperCase();
    return col + ":" + row.id;
  }

  function collectSince(since) {
    const out = [];
    SYNCED.forEach((col) => {
      CV.store.all(col).forEach((row) => {
        const at = row.updatedAt || row.createdAt || "";
        if (since && at && at <= since) return;
        out.push({ key: keyOf(col, row), collection: col, id: row.id, owner: ownerOf(col, row),
          updatedAt: at, json: JSON.stringify(scrub(col, row)) });
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Hợp nhất dữ liệu nhận về                                         */
  /* ------------------------------------------------------------------ */
  /**
   * Ghi các bản ghi nhận được vào máy này. Bản nào ở máy đang mới hơn thì
   * giữ nguyên, không để máy chủ ghi đè mất việc vừa làm.
   */
  function merge(records) {
    const applied = [], skipped = [];
    (records || []).forEach((rec) => {
      if (SYNCED.indexOf(rec.collection) < 0) return;
      let row;
      try { row = JSON.parse(rec.json); }
      catch (e) { return; }
      if (!row || !row.id) return;

      // Máy sinh viên: hồ sơ nhận về phải ghép vào đúng bản ghi đang có, nhận
      // diện theo mã số sinh viên, kẻo id đổi lại thành hai hồ sơ trùng nhau.
      if (rec.collection === "students") {
        const same = CV.store.first("students",
          (x) => String(x.mssv || "").toUpperCase() === String(row.mssv || "").toUpperCase());
        if (same && same.id !== row.id) row.id = same.id;
      }

      const mine = CV.store.get(rec.collection, row.id);
      const mineAt = mine ? (mine.updatedAt || mine.createdAt || "") : "";
      const theirAt = row.updatedAt || row.createdAt || "";
      if (mine && mineAt && theirAt && mineAt > theirAt) { skipped.push(rec); return; }

      // Mã PIN chỉ nằm ở nơi đã có, không bao giờ nhận từ máy chủ
      if (rec.collection === "students") {
        if (mine && mine.secret) row.secret = mine.secret;
        else delete row.secret;
      }
      CV.store.put(rec.collection, row, { save: false });
      applied.push(rec);
    });
    if (applied.length) CV.store.save("sync:merge");
    return { applied: applied.length, skipped: skipped.length };
  }

  /* ------------------------------------------------------------------ */
  /* 4. Hai chiều                                                        */
  /* ------------------------------------------------------------------ */

  /** Máy giảng viên: đẩy thay đổi lên rồi kéo thay đổi của sinh viên về. */
  async function syncAdvisor(opts) {
    const c = cfg();
    const full = opts && opts.full;
    const since = full ? "" : (c.lastAt || "");
    const records = collectSince(since);
    if (records.length) await call("push", Object.assign({ records }, auth()));
    const got = await call("pull", Object.assign({ since }, auth()));
    const res = merge(got.records);
    c.lastAt = got.now || new Date().toISOString();
    c.lastError = "";
    CV.store.save("sync:advisor");
    return { pushed: records.length, pulled: (got.records || []).length, ...res };
  }

  /** Máy sinh viên: kéo hồ sơ của mình về, đẩy phần mình tự sửa lên. */
  async function syncStudent(opts) {
    const c = cfg();
    const me = CV.store.all("students")[0];
    if (!me) throw new Error("Máy này chưa có hồ sơ sinh viên nào.");

    if (!opts || opts.push !== false) {
      const fields = {};
      CV.pack.STUDENT_FIELDS.forEach((f) => { fields[f.key] = me[f.key] || ""; });
      const appointments = CV.store
        .find("appointments", (a) => a.studentId === me.id && a.createdBy === "student")
        .map((a) => ({ id: a.id, date: a.date, time: a.time, topic: a.topic,
          place: a.place, status: a.status, createdBy: "student",
          createdAt: a.createdAt, updatedAt: a.updatedAt }));
      await call("spush", Object.assign({ fields, appointments }, auth()));
    }

    const got = await call("spull", auth());
    const res = merge(got.records);
    c.lastAt = got.now || new Date().toISOString();
    c.lastError = "";
    CV.store.save("sync:student");
    return { pulled: (got.records || []).length, ...res };
  }

  /** Đồng bộ một lần, tự chọn đúng chiều theo vai trò của máy. */
  async function run(opts) {
    if (!isOn()) throw new Error("Chưa bật đồng bộ trong mục Cài đặt.");
    const c = cfg();
    try {
      const r = CV.pack.isStudentDevice() ? await syncStudent(opts) : await syncAdvisor(opts);
      return { ok: true, ...r };
    } catch (e) {
      c.lastError = e.message;
      CV.store.save("sync:error");
      return { ok: false, error: e.message };
    }
  }

  /* ------------------------------------------------------------------ */
  /* 5. Chạy nền                                                         */
  /* ------------------------------------------------------------------ */
  let timer = null;
  let running = false;

  /** Đồng bộ ngầm, không làm phiền người dùng khi mạng chập chờn. */
  async function quiet() {
    if (running || !isOn() || !cfg().auto) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    running = true;
    try {
      const r = await run();
      if (r.ok && (r.applied || 0) > 0 && CV.app && CV.app.render) CV.app.render();
    } finally { running = false; }
  }

  function start(everyMs) {
    stop();
    if (!isOn() || !cfg().auto) return;
    quiet();
    timer = setInterval(quiet, everyMs || 120000);
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", quiet);
    }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  /** Mô tả ngắn tình trạng đồng bộ để hiện trên giao diện. */
  function status() {
    const c = cfg();
    if (!c.url) return { key: "off", text: "Chưa cấu hình" };
    if (!c.enabled) return { key: "off", text: "Đang tắt" };
    if (c.lastError) return { key: "err", text: "Lỗi: " + c.lastError };
    if (!c.lastAt) return { key: "idle", text: "Bật, chưa đồng bộ lần nào" };
    return { key: "ok", text: "Đồng bộ lúc " + U.dmyhm(c.lastAt) };
  }

  return { SYNCED, cfg, isOn, call, ping, auth, keyOf, collectSince, merge,
    syncAdvisor, syncStudent, run, start, stop, quiet, status };
})();
