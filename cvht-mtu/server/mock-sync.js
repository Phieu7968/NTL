/**
 * mock-sync.js — bản chạy thử của máy chủ đồng bộ, dùng cho máy cá nhân
 *
 * Cùng một giao thức với cvht-sync.gs nhưng chạy bằng Node, dữ liệu để trong
 * bộ nhớ. Dùng để thử đồng bộ trên máy mình trước khi triển khai lên Google
 * Apps Script, hoặc để chạy các phép thử tự động.
 *
 *   node server/mock-sync.js            # cổng 8787, khoá in ra màn hình
 *   node server/mock-sync.js 9000 khoa  # tự chọn cổng và khoá
 *
 * KHÔNG dùng bản này cho dữ liệu thật: không có xác thực HTTPS, không lưu
 * xuống đĩa, tắt là mất.
 */
const http = require("http");

const PORT = Number(process.argv[2] || 8787);
const ADVISOR_KEY = process.argv[3] || "khoa-thu-nghiem";

const STUDENT_FIELDS = ["phone", "zalo", "email", "address", "contactNote"];
const SHARED_COLLECTIONS = ["classes", "semesters"];

/** key "collection:id" -> bản ghi */
const store = new Map();

function upsert(records) {
  let n = 0;
  (records || []).forEach((r) => {
    if (!r || !r.collection || !r.id) return;
    const key = String(r.key || (r.collection + ":" + r.id));
    const cur = store.get(key);
    const at = String(r.updatedAt || "");
    if (cur && cur.updatedAt && at && cur.updatedAt > at) return;
    store.set(key, { key, collection: r.collection, id: r.id, owner: String(r.owner || ""),
      updatedAt: at, json: String(r.json || "") });
    n++;
  });
  return n;
}

const all = () => Array.from(store.values());

function checkAdvisor(body) {
  if (String(body.key || "") !== ADVISOR_KEY) throw new Error("Khoá giảng viên không đúng.");
}

function checkStudent(body) {
  const mssv = String(body.mssv || "").toUpperCase();
  const token = String(body.token || "");
  if (!mssv || !token) throw new Error("Thiếu mã số sinh viên hoặc mã liên kết.");
  const rec = store.get("students:" + mssv);
  if (!rec) throw new Error("Không tìm thấy sinh viên này trên máy chủ. Nhờ cố vấn đồng bộ trước.");
  let row;
  try { row = JSON.parse(rec.json); } catch (e) { throw new Error("Hồ sơ trên máy chủ bị hỏng."); }
  if (String(row.linkToken || "") !== token) throw new Error("Mã liên kết không đúng.");
  return { student: row, mssv, key: rec.key };
}

const handlers = {
  ping(body) {
    if (String(body.role) === "student") checkStudent(body); else checkAdvisor(body);
    return { ok: true, version: 1, count: store.size, now: new Date().toISOString() };
  },
  push(body) {
    checkAdvisor(body);
    return { ok: true, applied: upsert(body.records), now: new Date().toISOString() };
  },
  pull(body) {
    checkAdvisor(body);
    const since = String(body.since || "");
    const records = all().filter((r) => !(since && r.updatedAt && r.updatedAt <= since));
    return { ok: true, records, now: new Date().toISOString() };
  },
  spull(body) {
    const me = checkStudent(body);
    const records = all().filter((r) =>
      (r.owner && r.owner.toUpperCase() === me.mssv) || SHARED_COLLECTIONS.includes(r.collection));
    return { ok: true, records, now: new Date().toISOString() };
  },
  spush(body) {
    const me = checkStudent(body);
    const now = new Date().toISOString();
    const student = me.student;
    let changed = false;
    const fields = body.fields || {};
    STUDENT_FIELDS.forEach((f) => {
      if (!Object.prototype.hasOwnProperty.call(fields, f)) return;
      const v = fields[f] === null || fields[f] === undefined ? "" : String(fields[f]);
      if (String(student[f] || "") !== v) { student[f] = v; changed = true; }
    });
    const records = [];
    if (changed) {
      student.updatedAt = now;
      student.updateReceivedAt = now;
      records.push({ key: me.key, collection: "students", id: student.id, owner: me.mssv,
        updatedAt: now, json: JSON.stringify(student) });
    }
    (body.appointments || []).forEach((a) => {
      if (!a || !a.id) return;
      const appt = { id: a.id, studentId: student.id, date: a.date || "", time: a.time || "",
        topic: a.topic || "", place: a.place || "", status: a.status || "Chờ duyệt",
        createdBy: "student", createdAt: a.createdAt || now, updatedAt: a.updatedAt || now };
      records.push({ collection: "appointments", id: appt.id, owner: me.mssv,
        updatedAt: appt.updatedAt, json: JSON.stringify(appt) });
    });
    return { ok: true, applied: records.length ? upsert(records) : 0, changed, now };
  }
};

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "CVHT MTU sync (ban chay thu)", version: 1 }));
    return;
  }
  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    let out;
    try {
      const body = JSON.parse(raw || "{}");
      const fn = handlers[String(body.action || "")];
      out = fn ? fn(body) : { ok: false, error: "Không hiểu yêu cầu: " + body.action };
    } catch (e) {
      out = { ok: false, error: String(e && e.message ? e.message : e) };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(out));
  });
}).listen(PORT, () => {
  console.log(`Máy chủ đồng bộ (bản chạy thử) đang nghe ở http://127.0.0.1:${PORT}`);
  console.log(`Khoá giảng viên: ${ADVISOR_KEY}`);
});
