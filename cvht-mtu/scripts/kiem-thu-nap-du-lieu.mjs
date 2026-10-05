import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SHIM=fs.readFileSync(new URL('./firebase-gia.js', import.meta.url),'utf8');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};

async function moi(){
  const ctx=await b.newContext({viewport:{width:1400,height:1100},locale:'vi-VN'});
  await ctx.addInitScript(SHIM);
  await ctx.addInitScript(()=>{
    Object.assign(window.__FB.docs,{
     'khoa/XD':{id:'XD',code:'XD',name:'Khoa Xây dựng'},
     'advisors/u1':{id:'u1',name:'Phiếu',email:'phieu@mtu.edu.vn',role:'owner',
       khoaId:'XD',classIds:[],active:true}});
    window.__FB.nextUser={uid:'u1',email:'phieu@mtu.edu.vn',displayName:'Phiếu'};
  });
  const errs=[]; const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('LOI '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon|firebase-/.test(m.text()))errs.push('CONSOLE '+m.text());});
  await p.goto('http://127.0.0.1:8141/index.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>{CV.cloudConfig.enabled=true;CV.cloudConfig.provider='google';
    CV.cloudConfig.hostedDomain='mtu.edu.vn';
    CV.cloudConfig.firebase={apiKey:'x',projectId:'cvht-mtu',authDomain:'x'};CV.app.render();});
  await p.waitForTimeout(700);
  await p.click('#view-gate button'); await p.waitForTimeout(1600);
  return {p,ctx,errs};
}

console.log('\n=== 1. Soát: bắt được dữ liệu hỏng ===');
{
  const {p,ctx,errs}=await moi();
  const vd=await p.evaluate(()=>{
    const S=CV.store;
    const k=S.put('classes',{code:'XD26CT01',khoaId:'XD'});
    const kThieu=S.put('classes',{code:'XD26CT02'});                 // thiếu Khoa
    S.put('students',{mssv:'1',name:'A',classId:k.id,authEmail:'a@mtu.edu.vn'});
    S.put('students',{mssv:'2',name:'B',classId:k.id,cccd:'0123456789'}); // trường cấm
    S.put('students',{mssv:'3',name:'C'});                            // thiếu lớp
    S.put('students',{mssv:'4',name:'D',classId:k.id,authEmail:'a@mtu.edu.vn'}); // trùng thư
    S.put('students',{mssv:'1',name:'E',classId:k.id});               // trùng mssv
    return CV.napDuLieu.soat().map(x=>({muc:x.muc,nang:x.nang,moTa:x.moTa}));
  });
  const co=(t)=>vd.some(x=>new RegExp(t,'i').test(x.moTa));
  ok('bắt được căn cước công dân',co('căn cước'),JSON.stringify(vd.map(x=>x.moTa)));
  ok('bắt được lớp thiếu Khoa',co('chưa thuộc Khoa'));
  ok('bắt được sinh viên thiếu lớp',co('chưa thuộc lớp'));
  ok('bắt được trùng mã số sinh viên',co('mã số sinh viên bị trùng'));
  ok('bắt được trùng địa chỉ thư',co('địa chỉ thư bị dùng cho nhiều'));
  ok('nhắc sinh viên chưa có thư điện tử',co('chưa có địa chỉ thư của Trường'));
  const chan=await p.evaluate(()=>CV.napDuLieu.coChan(CV.napDuLieu.soat()));
  ok('kết luận là BỊ CHẶN',chan===true);
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 2. Dọn: sửa được những chỗ sửa tự động được ===');
{
  const {p,ctx,errs}=await moi();
  const r=await p.evaluate(()=>{
    const S=CV.store;
    const k=S.put('classes',{code:'X1',khoaId:'XD'});
    const sv=S.put('students',{mssv:'1',name:'A',classId:k.id,cccd:'0123',authEmail:'a@mtu.edu.vn'});
    S.put('scores',{studentId:sv.id,subjectCode:'M1',score10:8});
    // cố ý xoá classId để giả lập dữ liệu cũ
    CV.store.all('scores').forEach(x=>{delete x.classId;});
    const truoc=CV.napDuLieu.soat().length;
    const nCam=CV.napDuLieu.donTruongCam();
    const dien=CV.napDuLieu.dienLaiMaLop();
    return {truoc,nCam,dien,sau:CV.napDuLieu.soat(),
            svCon:Object.keys(CV.store.get('students',sv.id))};
  });
  ok('dọn được trường cấm',r.nCam>0,'so ban ghi: '+r.nCam);
  ok('căn cước biến mất khỏi hồ sơ',!r.svCon.includes('cccd'),r.svCon.join(','));
  ok('điền lại được mã lớp',r.dien.sua>0,JSON.stringify(r.dien));
  ok('sau khi dọn thì hết chỗ bị chặn',
     !r.sau.some(x=>x.nang==='chan'),JSON.stringify(r.sau.map(x=>x.moTa)));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 3. Nạp: đẩy đúng và đủ ===');
{
  const {p,ctx,errs}=await moi();
  const r=await p.evaluate(async ()=>{
    const S=CV.store;
    const k=S.put('classes',{code:'X1',name:'Lớp 1',khoaId:'XD'});
    for(let i=1;i<=5;i++)
      S.put('students',{mssv:'225000'+i,name:'SV '+i,classId:k.id,
        authEmail:'sv'+i+'@mtu.edu.vn'});
    window.__FB.batches=0;
    const kq=await CV.napDuLieu.nap();
    const tren=Object.keys(window.__FB.docs);
    return {kq,soSV:tren.filter(x=>x.startsWith('students/')).length,
            soLop:tren.filter(x=>x.startsWith('classes/')).length,
            batches:window.__FB.batches};
  });
  ok('báo thành công',r.kq.ok===true,JSON.stringify(r.kq.loi));
  ok('đẩy đủ 5 sinh viên lên máy chủ',r.soSV===5,'co '+r.soSV);
  ok('đẩy cả lớp lên',r.soLop===1);
  ok('dùng ghi theo mẻ',r.batches>0,'so me: '+r.batches);
  ok('đếm đúng số bản ghi đã nạp',r.kq.daNap===r.kq.tong,JSON.stringify(r.kq));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 4. Nạp đúng THỨ TỰ: Khoa và lớp trước sinh viên ===');
{
  const {p,ctx,errs}=await moi();
  const thuTu=await p.evaluate(async ()=>{
    const S=CV.store;
    const k=S.put('classes',{code:'X1',khoaId:'XD'});
    S.put('students',{mssv:'1',name:'A',classId:k.id,authEmail:'a@mtu.edu.vn'});
    S.put('scores',{studentId:CV.store.all('students')[0].id,classId:k.id,score10:8});
    window.__FB.written.length=0;
    await CV.napDuLieu.nap();
    // bỏ trùng, giữ thứ tự lần đầu mỗi bảng xuất hiện
    const seen=[];
    window.__FB.written.forEach(w=>{if(!seen.includes(w[0]))seen.push(w[0]);});
    return seen;
  });
  const vt=(c)=>thuTu.indexOf(c);
  ok('lớp nạp trước sinh viên',vt('classes')<vt('students'),thuTu.join(' → '));
  ok('sinh viên nạp trước điểm',vt('students')<vt('scores'),thuTu.join(' → '));
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 5. Lỗi giữa chừng thì báo rõ, không im lặng ===');
{
  const {p,ctx,errs}=await moi();
  const r=await p.evaluate(async ()=>{
    const S=CV.store;
    const k=S.put('classes',{code:'X1',khoaId:'XD'});
    S.put('students',{mssv:'1',name:'A',classId:k.id,authEmail:'a@mtu.edu.vn'});
    window.__FB.batchLoi={code:'permission-denied',message:'Missing permissions'};
    const kq=await CV.napDuLieu.nap();
    window.__FB.batchLoi=null;
    return kq;
  });
  ok('báo KHÔNG thành công',r.ok===false);
  ok('liệt kê từng mẻ lỗi',r.loi.length>0,JSON.stringify(r.loi));
  ok('giải thích được lý do bị từ chối',/thiếu mã lớp|chưa đủ quyền/.test(r.loi[0].thong),
     r.loi[0].thong);
  ok('không lỗi trang',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 6. Màn hình: chặn nạp khi dữ liệu còn hỏng ===');
{
  const {p,ctx,errs}=await moi();
  await p.evaluate(()=>{
    const S=CV.store;
    S.put('classes',{code:'X1'});                       // thiếu Khoa → bị chặn
    S.put('students',{mssv:'1',name:'A',classId:CV.store.all('classes')[0].id});
    CV.app.go('advisor/nap-du-lieu');
  });
  await p.waitForTimeout(800);
  const t=await p.locator('#view').innerText();
  ok('hiện kết quả soát',/Kết quả soát/.test(t),t.slice(0,120));
  ok('cảnh báo bị chặn',/TỪ CHỐI/.test(t));
  const tat=await p.locator('button:has-text("Nạp")').first().isDisabled();
  ok('nút nạp bị tắt',tat===true);
  await p.evaluate(()=>{CV.store.all('classes').forEach(c=>{c.khoaId='XD';});
    CV.store.save('x'); CV.app.render();});
  await p.waitForTimeout(700);
  const bat=await p.locator('button:has-text("Nạp")').first().isDisabled();
  ok('sửa xong thì nút nạp bật lại',bat===false);
  ok('không lỗi',errs.length===0,errs.join(' | '));
  await ctx.close();
}

console.log('\n=== 7. Cố vấn thường không mở được công cụ ===');
{
  const ctx=await b.newContext({viewport:{width:1200,height:900},locale:'vi-VN'});
  await ctx.addInitScript(SHIM);
  await ctx.addInitScript(()=>{
    Object.assign(window.__FB.docs,{
     'khoa/XD':{id:'XD',code:'XD',name:'Khoa Xây dựng'},
     'classes/c1':{id:'c1',code:'X1',khoaId:'XD',advisorId:'u9'},
     'advisors/u9':{id:'u9',name:'Cúc',email:'cuc@mtu.edu.vn',role:'advisor',
       khoaId:'XD',classIds:['c1'],active:true}});
    window.__FB.nextUser={uid:'u9',email:'cuc@mtu.edu.vn',displayName:'Cúc'};
  });
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8141/index.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>{CV.cloudConfig.enabled=true;CV.cloudConfig.provider='google';
    CV.cloudConfig.hostedDomain='mtu.edu.vn';
    CV.cloudConfig.firebase={apiKey:'x',projectId:'cvht-mtu',authDomain:'x'};CV.app.render();});
  await p.waitForTimeout(700);
  await p.click('#view-gate button'); await p.waitForTimeout(1600);
  await p.evaluate(()=>CV.app.go('advisor/nap-du-lieu')); await p.waitForTimeout(700);
  ok('bị chặn',/Không có quyền/.test(await p.locator('#view').innerText()));
  await ctx.close();
}

console.log('\n'+'='.repeat(46)+'\n'+pass+' đạt, '+fail+' sai');
await b.close(); process.exit(fail?1:0);
