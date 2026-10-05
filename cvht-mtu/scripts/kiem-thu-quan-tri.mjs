import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE='http://127.0.0.1:8141/index.html';
const SHIM=fs.readFileSync(new URL('./firebase-gia.js', import.meta.url),'utf8');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};

const KHOA={'khoa/XD':{id:'XD',code:'XD',name:'Khoa Xây dựng'},
            'khoa/KT':{id:'KT',code:'KT',name:'Khoa Kinh tế'}};
const LOP={'classes/cls_A':{id:'cls_A',code:'XD26CT01',name:'Lớp A',khoaId:'XD',advisorId:'uid_phieu'},
           'classes/cls_B':{id:'cls_B',code:'XD26CT02',name:'Lớp B',khoaId:'XD'},
           'classes/cls_C':{id:'cls_C',code:'KT26QT01',name:'Lớp C',khoaId:'KT'}};
const GV={'advisors/uid_phieu':{id:'uid_phieu',name:'Trương Hoàng Phiếu',title:'ThS.',
            email:'phieu@mtu.edu.vn',role:'owner',khoaId:'XD',classIds:['cls_A'],active:true},
          'advisors/uid_moi':{id:'uid_moi',name:'Nguyễn Văn Mới',email:'moi@mtu.edu.vn',
            role:'pending',khoaId:'XD',classIds:[],active:true,createdAt:'2026-10-01T08:00:00.000Z'},
          'advisors/uid_anh':{id:'uid_anh',name:'Trần Văn Anh',email:'anh@mtu.edu.vn',
            role:'advisor',khoaId:'XD',classIds:[],active:true},
          'advisors/uid_cuc':{id:'uid_cuc',name:'Lê Thị Cúc',email:'cuc@mtu.edu.vn',
            role:'advisor',khoaId:'KT',classIds:['cls_C'],active:true}};

async function moi(user,seed){
  const ctx=await b.newContext({viewport:{width:1366,height:1000},locale:'vi-VN'});
  await ctx.addInitScript(SHIM);
  await ctx.addInitScript(({s,u})=>{Object.assign(window.__FB.docs,s);window.__FB.nextUser=u;},
    {s:seed||Object.assign({},KHOA,LOP,GV),u:user});
  const errs=[]; const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('LOI '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push('CONSOLE '+m.text());});
  await p.goto(BASE,{waitUntil:'networkidle'});
  await p.evaluate(()=>{CV.cloudConfig.enabled=true;CV.cloudConfig.provider='google';
    CV.cloudConfig.hostedDomain='mtu.edu.vn';
    CV.cloudConfig.firebase={apiKey:'x',projectId:'cvht-mtu',authDomain:'x'};CV.app.render();});
  await p.waitForTimeout(700);
  await p.click('#view-gate button');
  await p.waitForTimeout(1600);
  return {p,ctx,errs};
}

console.log('\n=== 1. Owner: thấy mục Quản trị và Nhật ký ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_phieu',email:'phieu@mtu.edu.vn',displayName:'Phiếu'});
  const nav=await p.locator('#nav-desktop').innerText();
  ok('có mục Quản trị',/Quản trị/.test(nav),nav.replace(/\n/g,' | '));
  ok('có mục Nhật ký',/Nhật ký/.test(nav));
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(700);
  const t=await p.locator('#view').innerText();
  ok('hiện khối chờ duyệt',/chờ duyệt/i.test(t));
  ok('nêu đúng người đang chờ',/Nguyễn Văn Mới/.test(t));
  ok('hiện danh sách giảng viên',/Giảng viên \(/.test(t));
  ok('owner thấy cả Khoa khác',/Lê Thị Cúc/.test(t),'owner phải thấy toàn trường');
  ok('hiện khối phân công lớp',/Phân công lớp/.test(t));
  ok('owner thấy khối quản lý Khoa',/Khoa \(2\)/.test(t));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 2. Duyệt một tài khoản chờ ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_phieu',email:'phieu@mtu.edu.vn',displayName:'Phiếu'});
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(700);
  await p.locator('button:has-text("Duyệt")').first().click(); await p.waitForTimeout(500);
  ok('mở được hộp thoại phân quyền',(await p.locator('.modal').count())>0);
  const opts=await p.locator('.modal select[name=role] option').allTextContents();
  ok('owner chọn được cả quản trị Khoa',opts.some(x=>/Quản trị Khoa/.test(x)),opts.join(' / '));
  ok('owner chọn được cả vai trò toàn trường',opts.some(x=>/sáng lập/.test(x)));
  await p.selectOption('.modal select[name=role]','advisor');
  await p.selectOption('.modal select[name=khoaId]','XD');
  await p.click('.modal-foot button:has-text("Duyệt")'); await p.waitForTimeout(600);
  const st=await p.evaluate(()=>{const a=CV.store.get('advisors','uid_moi');
    return {role:a.role,khoa:a.khoaId,log:window.__FB.written.filter(w=>w[0]==='audit').length};});
  ok('đổi được vai trò thành cố vấn',st.role==='advisor',JSON.stringify(st));
  ok('gán đúng Khoa',st.khoa==='XD');
  ok('có ghi nhật ký',st.log>0,'so dong audit: '+st.log);
  const t=await p.locator('#view').innerText();
  ok('người đó rời khỏi danh sách chờ',!/Tài khoản chờ duyệt/.test(t));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 3. Giao lớp: phải sửa CẢ HAI nơi ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_phieu',email:'phieu@mtu.edu.vn',displayName:'Phiếu'});
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(700);
  const r=await p.evaluate(()=>{
    CV.viewQuanTri.ganLop('uid_anh','cls_B','cvht');
    const gv=CV.store.get('advisors','uid_anh'), lop=CV.store.get('classes','cls_B');
    return {classIds:gv.classIds,advisorId:lop.advisorId};
  });
  ok('ghi vào classIds trên hồ sơ giảng viên',r.classIds.includes('cls_B'),JSON.stringify(r));
  ok('ghi vào advisorId trên bản ghi lớp',r.advisorId==='uid_anh');

  const r2=await p.evaluate(()=>{
    CV.viewQuanTri.boLop('uid_anh','cls_B');
    const gv=CV.store.get('advisors','uid_anh'), lop=CV.store.get('classes','cls_B');
    return {classIds:gv.classIds,advisorId:lop.advisorId};
  });
  ok('thu hồi thì xoá khỏi CẢ HAI nơi',
     !r2.classIds.includes('cls_B')&&!r2.advisorId,JSON.stringify(r2));

  // Quyết định 758 Điều 2.3: một người có thể vừa là CVHT vừa là GVCN cùng lớp.
  // Thu hồi MỘT vai trò thì vẫn còn quyền xem lớp đó.
  const r3=await p.evaluate(()=>{
    CV.viewQuanTri.ganLop('uid_anh','cls_B','cvht');
    CV.viewQuanTri.ganLop('uid_anh','cls_B','gvcn');
    CV.viewQuanTri.boLop('uid_anh','cls_B','cvht');      // chỉ bỏ vai trò CVHT
    const gv=CV.store.get('advisors','uid_anh'), lop=CV.store.get('classes','cls_B');
    return {ids:gv.classIds,cvht:lop.advisorId,gvcn:lop.gvcnId};
  });
  ok('thu hồi một vai trò thì vẫn giữ quyền xem lớp',r3.ids.includes('cls_B'),JSON.stringify(r3));
  ok('bỏ đúng vai trò CVHT',!r3.cvht,JSON.stringify(r3));
  ok('KHÔNG đụng tới vai trò GVCN',r3.gvcn==='uid_anh',JSON.stringify(r3));

  // Bỏ nốt vai trò còn lại thì mới mất quyền
  const r4=await p.evaluate(()=>{
    CV.viewQuanTri.boLop('uid_anh','cls_B','gvcn');
    return CV.store.get('advisors','uid_anh').classIds;
  });
  ok('bỏ hết vai trò thì mất quyền xem lớp',!r4.includes('cls_B'),JSON.stringify(r4));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 4. Phát hiện và sửa lệch phân quyền ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_phieu',email:'phieu@mtu.edu.vn',displayName:'Phiếu'});
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(700);
  const lech=await p.evaluate(()=>{
    // Cố ý làm lệch: hồ sơ khai có lớp mà bảng phân công không có
    CV.store.put('advisors',{id:'uid_anh',classIds:['cls_A','cls_B']});
    return CV.viewQuanTri.choLech().map(x=>({ai:x.gv.id,khai:x.khai,that:x.that}));
  });
  ok('phát hiện được chỗ lệch',lech.length>0,JSON.stringify(lech));
  ok('nêu đúng người bị lệch',lech.some(x=>x.ai==='uid_anh'));
  await p.evaluate(()=>CV.app.render()); await p.waitForTimeout(500);
  const t=await p.locator('#view').innerText();
  ok('màn hình cảnh báo rõ',/Lệch phân quyền/.test(t)&&/máy chủ vẫn từ chối/.test(t));
  const sau=await p.evaluate(()=>{CV.viewQuanTri.tinhLaiClassIds('uid_anh');
    return {ids:CV.store.get('advisors','uid_anh').classIds,
            conLech:CV.viewQuanTri.choLech().map(x=>x.gv.id)};});
  ok('sửa lại thì người đó hết lệch',!sau.conLech.includes('uid_anh'),JSON.stringify(sau));
  ok('tính lại đúng theo bảng phân công',sau.ids.length===0,JSON.stringify(sau.ids));
  // uid_cuc khai cls_C mà bảng lớp không giao — chỗ lệch có thật trong dữ liệu mẫu,
  // giữ lại để chứng minh hàm dò không bỏ sót người khác.
  ok('vẫn phát hiện chỗ lệch của người khác',sau.conLech.includes('uid_cuc'),
     JSON.stringify(sau.conLech));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 5. Quản trị Khoa: chỉ thấy Khoa mình ===');
{
  const seed=Object.assign({},KHOA,LOP,GV);
  seed['advisors/uid_binh']={id:'uid_binh',name:'Phạm Văn Bình',email:'binh@mtu.edu.vn',
    role:'khoaAdmin',khoaId:'XD',classIds:[],active:true};
  const {p,ctx,errs}=await moi({uid:'uid_binh',email:'binh@mtu.edu.vn',displayName:'Bình'},seed);
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(700);
  const t=await p.locator('#view').innerText();
  ok('thấy người trong Khoa mình',/Trần Văn Anh/.test(t));
  ok('KHÔNG thấy người Khoa khác',!/Lê Thị Cúc/.test(t),'quan tri Khoa XD khong duoc thay Khoa KT');
  ok('KHÔNG thấy lớp Khoa khác',!/KT26QT01/.test(t));
  ok('KHÔNG có khối quản lý Khoa',!/\+ Thêm Khoa/.test(t));
  await p.locator('button:has-text("Duyệt")').first().click(); await p.waitForTimeout(500);
  const opts=await p.locator('.modal select[name=role] option').allTextContents();
  ok('KHÔNG phong được vai trò toàn trường',!opts.some(x=>/sáng lập/.test(x)),opts.join(' / '));
  ok('KHÔNG phong được quản trị Khoa',!opts.some(x=>/Quản trị Khoa/.test(x)));
  const khoaOpts=await p.locator('.modal select[name=khoaId] option').allTextContents();
  ok('ô chọn Khoa chỉ có Khoa của chính mình',
     khoaOpts.length===1&&/Xây dựng/.test(khoaOpts[0]),khoaOpts.join(' / '));
  ok('KHÔNG kéo người sang Khoa khác được',!khoaOpts.some(x=>/Kinh tế/.test(x)));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 6. Cố vấn thường: không vào được ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_cuc',email:'cuc@mtu.edu.vn',displayName:'Cúc'});
  const nav=await p.locator('#nav-desktop').innerText();
  ok('KHÔNG thấy mục Quản trị trên thanh điều hướng',!/Quản trị/.test(nav),nav.replace(/\n/g,' | '));
  ok('KHÔNG thấy mục Nhật ký',!/Nhật ký/.test(nav));
  await p.evaluate(()=>CV.app.go('advisor/quan-tri')); await p.waitForTimeout(600);
  const t=await p.locator('#view').innerText();
  ok('gõ thẳng địa chỉ cũng bị chặn',/Không có quyền/.test(t),t.slice(0,80));
  await p.evaluate(()=>CV.app.go('advisor/nhat-ky')); await p.waitForTimeout(600);
  ok('nhật ký cũng bị chặn',/Không có quyền/.test(await p.locator('#view').innerText()));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 7. Nhật ký: ghi đúng và đọc được ===');
{
  const {p,ctx,errs}=await moi({uid:'uid_phieu',email:'phieu@mtu.edu.vn',displayName:'Phiếu'});
  const n=await p.evaluate(()=>window.__FB.written.filter(w=>w[0]==='audit').length);
  ok('đăng nhập có ghi nhật ký',n>0,'so dong: '+n);
  const d=await p.evaluate(()=>{
    const k=Object.keys(window.__FB.docs).find(x=>x.startsWith('audit/'));
    return window.__FB.docs[k];
  });
  ok('ghi đúng người làm',d&&d.email==='phieu@mtu.edu.vn',JSON.stringify(d));
  ok('có mã việc',d&&d.viec==='dang-nhap');
  ok('có dấu thời gian',d&&!!d.at);
  await p.evaluate(()=>CV.app.go('advisor/nhat-ky')); await p.waitForTimeout(900);
  const t=await p.locator('#view').innerText();
  ok('màn hình nhật ký đọc được',/Nhật ký hoạt động/.test(t),t.slice(0,100));
  ok('nói rõ không ai sửa xoá được',/không ai/.test(t)&&/sửa hay xoá/.test(t));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n'+'='.repeat(46)+'\n'+pass+' đạt, '+fail+' sai');
await b.close(); process.exit(fail?1:0);
