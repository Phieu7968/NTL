/**
 * cvht-sync.gs — máy chủ đồng bộ cho ứng dụng Cố vấn học tập MTU
 *
 * Chạy bằng Google Apps Script, dữ liệu nằm trong một Google Sheet của
 * chính thầy cô. Không tốn tiền, không cần đăng ký dịch vụ nào khác, và
 * dữ liệu không rời khỏi tài khoản Google của Trường.
 *
 * Cách triển khai xem tệp HUONG-DAN.md cùng thư mục.
 *
 * Quy tắc phân quyền, cố ý viết ngay đầu tệp cho dễ soát:
 *   - Máy giảng viên phải gửi đúng khoá ADVISOR_KEY mới được đọc/ghi tất cả.
 *   - Máy sinh viên xác thực bằng mã số sinh viên kèm mã liên kết, và
 *     CHỈ đọc được phần dữ liệu của chính em ấy, CHỈ ghi được mấy trường
 *     liên hệ của chính em ấy cùng lịch hẹn do em ấy đặt.
 */

/** Những trường sinh viên được phép tự sửa. Ngoài danh sách này là từ chối. */
var STUDENT_FIELDS = ['phone', 'zalo', 'email', 'address', 'contactNote'];

/** Bảng không gắn với sinh viên nào, máy sinh viên cũng cần để hiển thị. */
var SHARED_COLLECTIONS = ['classes', 'semesters'];

var DATA_SHEET = 'data';
var HEADERS = ['key', 'collection', 'id', 'owner', 'updatedAt', 'json'];

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function advisorKey_() {
  return PropertiesService.getScriptProperties().getProperty('ADVISOR_KEY') || '';
}

/** Đọc toàn bộ bảng dữ liệu thành mảng đối tượng. */
function readAll_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    out.push({
      row: i + 2,
      key: String(values[i][0]),
      collection: String(values[i][1]),
      id: String(values[i][2]),
      owner: String(values[i][3] || ''),
      updatedAt: String(values[i][4] || ''),
      json: String(values[i][5] || '')
    });
  }
  return out;
}

/**
 * Ghi các bản ghi vào bảng. Bản nào trên máy chủ mới hơn thì giữ nguyên,
 * để máy nào đó gửi dữ liệu cũ lên cũng không xoá mất việc người khác vừa làm.
 */
function upsert_(records) {
  var sh = sheet_();
  var all = readAll_();
  var byKey = {};
  for (var i = 0; i < all.length; i++) byKey[all[i].key] = all[i];

  var updates = [];
  var appends = [];
  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    if (!r || !r.collection || !r.id) continue;
    // Khoá do máy gửi lên quyết định, vì hồ sơ sinh viên khoá theo mã số
    // chứ không theo id nội bộ (id đổi mỗi lần nhập lại danh sách lớp).
    var key = String(r.key || (r.collection + ':' + r.id));
    var at = String(r.updatedAt || '');
    var row = [key, r.collection, r.id, String(r.owner || ''), at, String(r.json || '')];
    var cur = byKey[key];
    if (cur) {
      if (cur.updatedAt && at && cur.updatedAt > at) continue;  // trên máy chủ mới hơn
      updates.push({ row: cur.row, values: row });
      cur.updatedAt = at;
    } else {
      appends.push(row);
      byKey[key] = { row: -1, key: key, updatedAt: at };
    }
  }
  for (var k = 0; k < updates.length; k++) {
    sh.getRange(updates[k].row, 1, 1, HEADERS.length).setValues([updates[k].values]);
  }
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, HEADERS.length).setValues(appends);
  }
  return updates.length + appends.length;
}

/* ------------------------------------------------------------------ */
/* Xác thực                                                            */
/* ------------------------------------------------------------------ */
function checkAdvisor_(body) {
  var key = advisorKey_();
  if (!key) throw new Error('Máy chủ chưa đặt ADVISOR_KEY. Xem HUONG-DAN.md.');
  if (String(body.key || '') !== key) throw new Error('Khoá giảng viên không đúng.');
}

/** Tìm hồ sơ sinh viên trên máy chủ và đối chiếu mã liên kết. */
function checkStudent_(body) {
  var mssv = String(body.mssv || '').toUpperCase();
  var token = String(body.token || '');
  if (!mssv || !token) throw new Error('Thiếu mã số sinh viên hoặc mã liên kết.');
  var all = readAll_();
  var wanted = 'students:' + mssv;
  var found = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].key !== wanted) continue;
    var row;
    try { row = JSON.parse(all[i].json); } catch (e) { continue; }
    found = { record: all[i], student: row, mssv: mssv };
    break;
  }
  if (!found) throw new Error('Không tìm thấy sinh viên này trên máy chủ. Nhờ cố vấn đồng bộ trước.');
  if (String(found.student.linkToken || '') !== token) throw new Error('Mã liên kết không đúng.');
  return found;
}

/* ------------------------------------------------------------------ */
/* Các hành động                                                        */
/* ------------------------------------------------------------------ */
function actionPing_(body) {
  if (String(body.role) === 'student') checkStudent_(body);
  else checkAdvisor_(body);
  return { ok: true, version: 1, count: readAll_().length, now: new Date().toISOString() };
}

function actionPush_(body) {
  checkAdvisor_(body);
  var n = upsert_(body.records || []);
  return { ok: true, applied: n, now: new Date().toISOString() };
}

function actionPull_(body) {
  checkAdvisor_(body);
  var since = String(body.since || '');
  var all = readAll_();
  var out = [];
  for (var i = 0; i < all.length; i++) {
    if (since && all[i].updatedAt && all[i].updatedAt <= since) continue;
    out.push({ collection: all[i].collection, id: all[i].id,
      owner: all[i].owner, updatedAt: all[i].updatedAt, json: all[i].json });
  }
  return { ok: true, records: out, now: new Date().toISOString() };
}

/** Máy sinh viên chỉ nhận về phần của chính em ấy cộng vài bảng dùng chung. */
function actionStudentPull_(body) {
  var me = checkStudent_(body);
  var all = readAll_();
  var out = [];
  for (var i = 0; i < all.length; i++) {
    var rec = all[i];
    var mine = rec.owner && rec.owner.toUpperCase() === me.mssv;
    var shared = SHARED_COLLECTIONS.indexOf(rec.collection) >= 0;
    if (!mine && !shared) continue;
    out.push({ collection: rec.collection, id: rec.id, owner: rec.owner,
      updatedAt: rec.updatedAt, json: rec.json });
  }
  return { ok: true, records: out, now: new Date().toISOString() };
}

/**
 * Máy sinh viên ghi lên. Chỉ nhận đúng mấy trường liên hệ và lịch hẹn do
 * em ấy đặt; mọi trường khác trong yêu cầu đều bị bỏ qua.
 */
function actionStudentPush_(body) {
  var me = checkStudent_(body);
  var now = new Date().toISOString();
  var student = me.student;
  var changed = false;

  var fields = body.fields || {};
  for (var i = 0; i < STUDENT_FIELDS.length; i++) {
    var f = STUDENT_FIELDS[i];
    if (!Object.prototype.hasOwnProperty.call(fields, f)) continue;
    var v = fields[f] === null || fields[f] === undefined ? '' : String(fields[f]);
    if (String(student[f] || '') !== v) { student[f] = v; changed = true; }
  }

  var records = [];
  if (changed) {
    student.updatedAt = now;
    student.updateReceivedAt = now;
    records.push({ key: me.record.key, collection: 'students', id: student.id,
      owner: me.mssv, updatedAt: now, json: JSON.stringify(student) });
  }

  var appts = body.appointments || [];
  for (var j = 0; j < appts.length; j++) {
    var a = appts[j];
    if (!a || !a.id) continue;
    var appt = {
      id: a.id, studentId: student.id, date: String(a.date || ''), time: String(a.time || ''),
      topic: String(a.topic || ''), place: String(a.place || ''),
      status: String(a.status || 'Chờ duyệt'), createdBy: 'student',
      createdAt: String(a.createdAt || now), updatedAt: String(a.updatedAt || now)
    };
    records.push({ collection: 'appointments', id: appt.id, owner: me.mssv,
      updatedAt: appt.updatedAt, json: JSON.stringify(appt) });
  }

  var n = records.length ? upsert_(records) : 0;
  return { ok: true, applied: n, changed: changed, now: now };
}

/* ------------------------------------------------------------------ */
/* Điểm vào                                                            */
/* ------------------------------------------------------------------ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut({ ok: false, error: 'Máy chủ đang bận, thử lại sau giây lát.' });
  }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(body.action || '');
    if (action === 'ping') return jsonOut(actionPing_(body));
    if (action === 'push') return jsonOut(actionPush_(body));
    if (action === 'pull') return jsonOut(actionPull_(body));
    if (action === 'spull') return jsonOut(actionStudentPull_(body));
    if (action === 'spush') return jsonOut(actionStudentPush_(body));
    return jsonOut({ ok: false, error: 'Không hiểu yêu cầu: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonOut({ ok: true, service: 'CVHT MTU sync', version: 1 });
}

/** Chạy một lần trong trình soạn thảo Apps Script để đặt khoá giảng viên. */
function datKhoaGiangVien() {
  var key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ADVISOR_KEY', key);
  Logger.log('Khoá giảng viên (chép vào mục Cài đặt của ứng dụng): ' + key);
}

/** Xoá sạch dữ liệu trên máy chủ. Cân nhắc kỹ trước khi chạy. */
function xoaToanBoDuLieu() {
  var sh = sheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}
