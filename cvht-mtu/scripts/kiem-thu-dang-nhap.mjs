import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = 'http://127.0.0.1:8141/index.html';
const SHIM = fs.readFileSync(new URL('./firebase-gia.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass = 0, fail = 0;
const ok = (n, c, e) => { c ? (pass++, console.log('  OK   ' + n)) : (fail++, console.log('  SAI  ' + n + (e ? ' → ' + e : ''))); };

async function moi(seed, user) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'vi-VN' });
  const errs = [];
  await ctx.addInitScript(SHIM);
  await ctx.addInitScript(({ seed, user }) => {
    Object.assign(window.__FB.docs, seed);
    window.__FB.nextUser = user;
  }, { seed, user });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('LOI ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Bật cấu hình rồi vẽ lại — đúng đường đi thật của ứng dụng.
  await page.evaluate(() => {
    CV.cloudConfig.enabled = true;
    CV.cloudConfig.provider = 'google';
    CV.cloudConfig.firebase = { apiKey: 'x', projectId: 'cvht-mtu', authDomain: 'x' };
    CV.app.render();
  });
  await page.waitForTimeout(700);
  return { page, ctx, errs };
}

const LOP = { 'classes/cls_A': { id: 'cls_A', code: 'XD26CT01', name: 'Lớp XD26CT01', khoaId: 'XD' } };
const GV  = { 'advisors/uid_phieu': { id: 'uid_phieu', name: 'Trương Hoàng Phiếu', title: 'ThS.',
              email: 'phieu@mtu.edu.vn', role: 'owner', khoaId: 'XD', classIds: ['cls_A'], active: true } };
const SV  = { 'students/stu_1': { id: 'stu_1', mssv: '2250001', fullName: 'Nguyễn Văn A',
              classId: 'cls_A', authEmail: 'sv2250001@mtu.edu.vn' } };

console.log('\n=== 1. Chưa đăng nhập: hiện nút tài khoản Trường ===');
{
  const { page, ctx, errs } = await moi({}, null);
  const t = await page.locator('#view-gate').innerText();
  ok('hiện màn hình đăng nhập bằng tài khoản Trường', /tài khoản Google của Trường/i.test(t), t.slice(0, 120));
  ok('KHÔNG còn ô nhập mật khẩu cũ', (await page.locator('input[type=password]').count()) === 0);
  ok('không lỗi', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 2. Giảng viên đăng nhập → vào thẳng bàn làm việc ===');
{
  const { page, ctx, errs } = await moi(Object.assign({}, LOP, GV, SV),
    { uid: 'uid_phieu', email: 'phieu@mtu.edu.vn', displayName: 'Trương Hoàng Phiếu' });
  await page.click('button:has-text("tài khoản Google")');
  await page.waitForTimeout(1500);
  const title = await page.locator('#page-title').innerText().catch(() => '');
  ok('vào được khung ứng dụng', !(await page.locator('#shell').isHidden()), 'tiêu đề=' + title);
  ok('cổng đăng nhập đã ẩn', await page.locator('#view-gate').isHidden());
  const st = await page.evaluate(() => ({
    phien: CV.store.session(), backend: CV.store.backendStatus().kind,
    sv: CV.store.all('students').length, lop: CV.store.all('classes').length,
    ai: (CV.auth.current() || {}).kind
  }));
  ok('đặt phiên đúng vai trò giảng viên', st.phien && st.phien.kind === 'advisor', JSON.stringify(st.phien));
  ok('CV.auth.current() nhận ra giảng viên', st.ai === 'advisor');
  ok('backend đã cắm Firestore', st.backend === 'firestore', st.backend);
  ok('dữ liệu lớp về tới bản sao', st.lop === 1 && st.sv === 1, 'lop=' + st.lop + ' sv=' + st.sv);
  ok('không lỗi', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 3. Sinh viên đăng nhập → tự nối hồ sơ bằng địa chỉ thư ===');
{
  const { page, ctx, errs } = await moi(Object.assign({}, LOP, GV, SV),
    { uid: 'uid_sv1', email: 'sv2250001@mtu.edu.vn', displayName: 'Nguyễn Văn A' });
  await page.click('button:has-text("tài khoản Google")');
  await page.waitForTimeout(1800);
  const st = await page.evaluate(() => ({
    phien: CV.store.session(), ai: (CV.auth.current() || {}).kind,
    link: window.__FB.docs['links/uid_sv1'],
    ghiChu: CV.store.all('notes').length, gv: CV.store.all('advisors').length
  }));
  ok('tự tạo được bản nối tài khoản', !!st.link, JSON.stringify(st.link));
  ok('nối đúng hồ sơ', st.link && st.link.studentId === 'stu_1');
  ok('đặt phiên vai trò sinh viên', st.phien && st.phien.kind === 'student', JSON.stringify(st.phien));
  ok('CV.auth.current() nhận ra sinh viên', st.ai === 'student');
  ok('KHÔNG tải ghi chú riêng của cố vấn', st.ghiChu === 0);
  ok('KHÔNG tải hồ sơ giảng viên', st.gv === 0, 'gv=' + st.gv);
  ok('không lỗi', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 4. Người lạ: không có trong danh sách lớp nào ===');
{
  const { page, ctx, errs } = await moi(Object.assign({}, LOP, GV, SV),
    { uid: 'uid_la', email: 'nguoila@mtu.edu.vn', displayName: 'Người Lạ' });
  await page.click('button:has-text("tài khoản Google")');
  await page.waitForTimeout(1500);
  const t = await page.locator('#view-gate').innerText();
  ok('báo chưa tìm thấy hồ sơ', /Chưa tìm thấy hồ sơ/i.test(t), t.slice(0, 150));
  ok('có lối đăng ký cho giảng viên', /Tôi là giảng viên/i.test(t));
  ok('KHÔNG vào được khung ứng dụng', await page.locator('#shell').isHidden());
  ok('không lỗi', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 5. Giảng viên chờ duyệt: không thấy dữ liệu nào ===');
{
  const cho = { 'advisors/uid_moi': { id: 'uid_moi', name: 'Mới', email: 'moi@mtu.edu.vn',
                role: 'pending', khoaId: 'XD', classIds: [], active: true } };
  const { page, ctx, errs } = await moi(Object.assign({}, LOP, GV, SV, cho),
    { uid: 'uid_moi', email: 'moi@mtu.edu.vn', displayName: 'Mới' });
  await page.click('button:has-text("tài khoản Google")');
  await page.waitForTimeout(1500);
  const t = await page.locator('#view-gate').innerText();
  ok('báo đang chờ duyệt', /chờ duyệt/i.test(t), t.slice(0, 120));
  ok('KHÔNG vào được khung ứng dụng', await page.locator('#shell').isHidden());
  const n = await page.evaluate(() => CV.store.all('students').length + CV.store.all('classes').length);
  ok('không tải về dữ liệu nào', n === 0, 'n=' + n);
  await ctx.close();
}

console.log('\n=== 6. Tắt enabled → quay về cách đăng nhập cũ ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'vi-VN' });
  const errs = []; const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('LOI ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const t = await page.locator('#view-gate').innerText();
  ok('hiện lại màn hình thiết lập lần đầu như cũ', /Thiết lập|Tạo tài khoản/i.test(t), t.slice(0, 120));
  ok('không lỗi', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

console.log('\n' + '='.repeat(46) + '\n' + pass + ' đạt, ' + fail + ' sai');
await browser.close();
process.exit(fail ? 1 : 0);
