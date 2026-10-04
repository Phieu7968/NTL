import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE='http://127.0.0.1:8141/index.html';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1366,height:1000},locale:'vi-VN',acceptDownloads:true});
const errs=[]; const page=await ctx.newPage();
page.on('pageerror',e=>errs.push('LOI '+e.message));
page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push('CONSOLE '+m.text());});
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};

await page.goto(BASE,{waitUntil:'networkidle'});
await page.fill('input[name=name]','Trương Hoàng Phiếu');
await page.fill('input[name=email]','phieu@mtu.edu.vn');
await page.fill('input[name=pw]','MatKhau2026'); await page.fill('input[name=pw2]','MatKhau2026');
await page.click('button:has-text("Tạo tài khoản và bắt đầu")'); await page.waitForTimeout(500);
await page.click('.role-card:has-text("Giảng viên Cố vấn")'); await page.waitForTimeout(300);
await page.fill('input[name=login]','phieu@mtu.edu.vn'); await page.fill('input[name=pw]','MatKhau2026');
await page.click('button:has-text("Đăng nhập")'); await page.waitForTimeout(700);
await page.evaluate(()=>CV.viewAdvisor.seedDemo()); await page.waitForTimeout(900);

console.log('\n=== Sổ họp lớp: nút Biên bản ===');
await page.evaluate(()=>CV.app.go('advisor/meetings')); await page.waitForTimeout(700);
// bảo đảm có ít nhất một buổi họp
const soHop=await page.evaluate(()=>CV.store.all('meetings').length);
if(!soHop){
  await page.evaluate(()=>{const k=CV.viewAdvisor.myClasses?CV.viewAdvisor.myClasses()[0]:CV.store.all('classes')[0];
    const sem=CV.store.all('semesters').slice(-1)[0];
    CV.store.put('meetings',{classId:k.id,semesterId:sem.id,date:'2026-09-15',mode:'Trực tiếp',
      attended:30,place:'Phòng A201',content:'Phổ biến quy chế đào tạo',
      minutes:'Lớp thống nhất lịch sinh hoạt hằng tháng.'});});
  await page.evaluate(()=>CV.app.render()); await page.waitForTimeout(600);
}
ok('có nút Biên bản',(await page.locator('button:has-text("Biên bản")').count())>0);
await page.locator('button:has-text("Biên bản")').first().click(); await page.waitForTimeout(500);
const mt=await page.locator('.modal').innerText();
ok('mở được hộp thoại xuất văn bản',/Nghị định 30/.test(mt),mt.slice(0,80));
ok('có đủ ba lựa chọn',/Xem thử/.test(mt)&&/Tải bản Word/.test(mt)&&/In/.test(mt));

console.log('\n=== Tải tệp Word thật ===');
const dl=page.waitForEvent('download');
await page.click('.modal-foot button:has-text("Tải bản Word")');
const d=await dl;
const ten=d.suggestedFilename();
ok('tải được tệp',!!ten,ten);
ok('tên tệp đuôi .doc',/\.doc$/.test(ten),ten);
ok('tên tệp không dấu',!/[^\x00-\x7F]/.test(ten),ten);
const path=(process.env.TMPDIR||'/tmp')+'/'+ten;
await d.saveAs(path);
const fs=await import('fs');
const noiDung=fs.readFileSync(path,'utf8');
ok('tệp có BOM để Word đọc đúng tiếng Việt',noiDung.charCodeAt(0)===0xFEFF);
ok('có quốc hiệu',noiDung.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
ok('có khai báo Word',noiDung.includes('w:WordDocument'));
ok('có lề chuẩn NĐ30',noiDung.includes('56.7pt 42.5pt 56.7pt 85.0pt'));
ok('có danh sách điểm danh',noiDung.includes('Ký tên'));
console.log('     cỡ tệp: '+Math.round(fs.statSync(path).size/1024)+' KB');

console.log('\n=== Hồ sơ sinh viên: Phiếu học tập ===');
await page.evaluate(()=>CV.app.go('advisor/students')); await page.waitForTimeout(600);
await page.locator('tbody tr').first().click(); await page.waitForTimeout(700);
ok('có nút Phiếu học tập',(await page.locator('button:has-text("Phiếu học tập")').count())>0);
await page.locator('button:has-text("Phiếu học tập")').first().click(); await page.waitForTimeout(400);
ok('mở được hộp thoại',(await page.locator('.modal').count())>0);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

console.log('\n=== Màn hình báo cáo: Nghị định 30 ===');
await page.evaluate(()=>CV.app.go('advisor/reports')); await page.waitForTimeout(600);
ok('có nút Báo cáo theo Nghị định 30',(await page.locator('button:has-text("Nghị định 30")').count())>0);
await page.locator('button:has-text("Nghị định 30")').first().click(); await page.waitForTimeout(400);
const nhac=await page.locator('.toasts').innerText().catch(()=>'');
ok('chưa chọn lớp thì nhắc chọn lớp',/Chọn một lớp/.test(nhac),nhac.slice(0,60));
await page.selectOption('select', {index:1}); await page.waitForTimeout(500);
await page.locator('button:has-text("Nghị định 30")').first().click(); await page.waitForTimeout(500);
ok('chọn lớp rồi thì mở được hộp thoại',(await page.locator('.modal').count())>0);
const dl2=page.waitForEvent('download');
await page.click('.modal-foot button:has-text("Tải bản Word")');
const d2=await dl2; const p2=(process.env.TMPDIR||'/tmp')+'/'+d2.suggestedFilename();
await d2.saveAs(p2);
const bc=fs.readFileSync(p2,'utf8');
ok('báo cáo có Kính gửi',bc.includes('Kính gửi'));
ok('báo cáo có Nơi nhận',bc.includes('Nơi nhận'));
ok('báo cáo viện dẫn QĐ 758',bc.includes('758'));
ok('báo cáo có bảng phân loại học lực',bc.includes('PHÂN LOẠI HỌC LỰC'));
console.log('     '+d2.suggestedFilename()+' — '+Math.round(fs.statSync(p2).size/1024)+' KB');

console.log('\n'+(errs.length?'LỖI:\n'+errs.join('\n'):'Không có lỗi trang nào.'));
if(errs.length)fail++;
console.log('='.repeat(46)+'\n'+pass+' đạt, '+fail+' sai');
await b.close(); process.exit(fail?1:0);
