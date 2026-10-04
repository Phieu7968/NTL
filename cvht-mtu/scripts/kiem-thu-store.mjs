import fs from 'fs';
import vm from 'vm';

const JS = new URL('../assets/js/', import.meta.url).pathname;
const mem = new Map();
const ctx = {
  console,
  window: {},
  localStorage: {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k)
  },
  BroadcastChannel: undefined,
  crypto: { getRandomValues: a => { for (let i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; } }
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of ['util.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(JS + f, 'utf8'), ctx, { filename: f });
}
const S = ctx.CV.store;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  SAI  ' + name + (extra ? '  → ' + extra : '')); }
};

console.log('\n=== 1. Chạy không cắm backend: y như trước ===');
S.load();
const c1 = S.put('classes', { code: 'XD26CT01', name: 'Lớp thử' });
const s1 = S.put('students', { mssv: '2250001', fullName: 'Nguyễn Văn A', classId: c1.id });
ok('put trả về bản ghi có id', !!s1.id);
ok('all() đồng bộ, thấy ngay', S.all('students').length === 1);
ok('get() tìm được', S.get('students', s1.id).mssv === '2250001');
ok('không có backend thì backendStatus là local', S.backendStatus().kind === 'local');

console.log('\n=== 2. put() tự điền classId cho bản ghi phụ ===');
const sc1 = S.put('scores', { studentId: s1.id, code: 'MH01', score10: 8.5 });
ok('scores được điền classId', sc1.classId === c1.id, 'classId=' + sc1.classId);
const n1 = S.put('notes', { studentId: s1.id, body: 'ghi chú riêng' });
ok('notes được điền classId', n1.classId === c1.id);
const sem = S.put('semesters', { name: 'HK1' });
ok('semesters KHÔNG bị điền classId (dùng chung)', sem.classId === undefined);

console.log('\n=== 3. Cắm backend giả: put() đẩy lên ===');
const day = [];
const fake = {
  name: 'gia',
  push: (col, obj) => { day.push(['push', col, obj.id]); return Promise.resolve(); },
  del: (col, id) => { day.push(['del', col, id]); return Promise.resolve(); },
  pushSettings: () => { day.push(['settings']); return Promise.resolve(); },
  status: () => ({ online: true, text: 'thử' })
};
S.useBackend(fake);
const s2 = S.put('students', { mssv: '2250002', fullName: 'Trần Thị B', classId: c1.id });
ok('put đẩy lên backend', day.some(d => d[0]==='push' && d[1]==='students' && d[2]===s2.id));
S.remove('students', s2.id);
ok('remove đẩy lệnh xoá', day.some(d => d[0]==='del' && d[1]==='students' && d[2]===s2.id));
ok('backendStatus lấy từ backend', S.backendStatus().text === 'thử');

console.log('\n=== 4. applyRemote: máy chủ báo đổi thì bản sao đổi theo ===');
let reDraw = 0;
S.on(() => reDraw++);
const before = reDraw;
S.applyRemote('students', [
  { id: s1.id, mssv: '2250001', fullName: 'Nguyễn Văn A (đã sửa máy khác)', classId: c1.id },
  { id: 'stu_moi', mssv: '2250003', fullName: 'Lê Văn C', classId: c1.id }
], []);
ok('bản sao nhận bản ghi mới', S.all('students').length === 2);
ok('bản ghi cũ bị ghi đè', S.get('students', s1.id).fullName.includes('đã sửa máy khác'));
ok('có phát tín hiệu vẽ lại', reDraw > before);
ok('all() vẫn đồng bộ sau khi nhận từ xa', Array.isArray(S.all('students')));

console.log('\n=== 5. applyRemote KHÔNG được đẩy ngược lên (tránh vòng lặp) ===');
const n = day.length;
S.applyRemote('students', [{ id: 'stu_x', mssv: '9', classId: c1.id }], []);
ok('không đẩy ngược lên máy chủ', day.length === n, 'thêm ' + (day.length - n) + ' lệnh');

console.log('\n=== 6. applyRemote xoá bản ghi ===');
S.applyRemote('students', [], ['stu_x']);
ok('bản ghi bị xoá nơi khác thì mất ở đây', !S.get('students', 'stu_x'));

console.log('\n=== 7. replace: thay toàn bộ bộ sưu tập ===');
S.applyRemote('students', [{ id: 'chi_con_1', mssv: '1', classId: c1.id }], [], { replace: true });
ok('replace thay sạch', S.all('students').length === 1 && S.all('students')[0].id === 'chi_con_1');

console.log('\n=== 8. xoá sinh viên kéo theo bản ghi phụ ===');
S.applyRemote('students', [{ id: s1.id, mssv: '2250001', classId: c1.id }], [], { replace: true });
S.applyRemote('scores', [{ id: 'sc_a', studentId: s1.id, classId: c1.id },
                         { id: 'sc_b', studentId: 'khac', classId: c1.id }], [], { replace: true });
day.length = 0;
S.removeStudentCascade(s1.id);
ok('điểm của em đó bị xoá', !S.get('scores', 'sc_a'));
ok('điểm của em khác còn nguyên', !!S.get('scores', 'sc_b'));
ok('gửi lệnh xoá từng bản ghi lên máy chủ', day.some(d => d[0]==='del' && d[2]==='sc_a'));
ok('KHÔNG xoá nhầm của em khác', !day.some(d => d[0]==='del' && d[2]==='sc_b'));

console.log('\n=== 9. applyRemoteSettings ===');
S.applyRemoteSettings({ schoolShort: 'MTU-X', retakeRule: 'latest' });
ok('thiết lập từ xa được nạp', S.settings().schoolShort === 'MTU-X');
ok('trường thiếu được bổ khuyết', Array.isArray(S.settings().gradeScale) && S.settings().gradeScale.length === 8);

console.log('\n=== 10. gỡ backend thì quay về chạy một máy ===');
S.useBackend(null);
const n2 = day.length;
S.put('students', { mssv: '9999', classId: c1.id });
ok('không đẩy đi đâu nữa', day.length === n2);
ok('vẫn ghi được vào bản sao', S.all('students').some(s => s.mssv === '9999'));

console.log('\n' + '='.repeat(46));
console.log(pass + ' đạt, ' + fail + ' sai');
process.exit(fail ? 1 : 0);
