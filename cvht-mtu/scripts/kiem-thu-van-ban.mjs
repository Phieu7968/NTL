import fs from 'fs'; import vm from 'vm';
const JS=new URL('../assets/js/', import.meta.url).pathname; const mem=new Map();
const ctx={console,window:{},localStorage:{getItem:k=>mem.has(k)?mem.get(k):null,
  setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)},
  document:{getElementById:()=>null,createElement:()=>({style:{},setAttribute(){},appendChild(){}})},
  crypto:{getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);return a;}}};
ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['util.js','store.js','academic.js','docvn.js','mau-vb.js'])
  vm.runInContext(fs.readFileSync(JS+f,'utf8'),ctx,{filename:f});
const {store:S,docvn:D,mauVb:M,util:U}=ctx.CV;

let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};
const co=(h,s)=>h.includes(s);

S.load();
const st=S.settings(); st.schoolName='Trường Đại học Xây dựng Miền Tây'; st.facultyName='Khoa Xây dựng';
const adv=S.put('advisors',{name:'Trương Hoàng Phiếu',title:'ThS.',email:'phieu@mtu.edu.vn',
  phone:'0372837968',role:'owner',active:true});
const k=S.put('classes',{code:'XD26CT01',name:'Xây dựng dân dụng K26',advisorId:adv.id,khoaId:'XD'});
const sem=S.put('semesters',{name:'Học kỳ 1, năm học 2026-2027',active:true});
const ten=['Nguyễn Văn An','Trần Thị Bình','Lê Hoàng Cường','Phạm Thị Dung','Võ Minh Em'];
const svs=ten.map((n,i)=>S.put('students',{name:n,mssv:'225000'+(i+1),dob:'2008-0'+(i+1)+'-15',
  classId:k.id,cadreRole:i===0?'Lớp trưởng':(i===1?'Bí thư Chi đoàn':'')}));
svs.forEach((s,i)=>{
  S.put('scores',{studentId:s.id,semesterId:sem.id,subjectCode:'XD10'+i,
    subjectName:'Sức bền vật liệu',credits:3,score10:i===4?3.2:7.5+i*0.3});
  S.put('scores',{studentId:s.id,semesterId:sem.id,subjectCode:'XD20'+i,
    subjectName:'Kết cấu bê tông cốt thép & các vấn đề liên quan',credits:4,score10:i===4?4.1:6.8+i*0.4});
  S.put('conduct',{studentId:s.id,semesterId:sem.id,score:70+i*4});
});
const hop=S.put('meetings',{classId:k.id,semesterId:sem.id,date:'2026-09-15',mode:'Trực tiếp',
  attended:4,place:'Phòng A201',content:'Phổ biến quy chế đào tạo và kế hoạch học kỳ',
  minutes:'Cố vấn phổ biến Thông báo 411 về đăng ký học phần. Lớp thống nhất lịch sinh hoạt hằng tháng.'});

console.log('\n=== 1. Biên bản sinh hoạt lớp ===');
{
  const vb=M.bienBanHopLop(hop.id);
  ok('dựng được văn bản',!!vb);
  const h=D.htmlWord(vb);
  ok('có quốc hiệu',co(h,'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
  ok('có tiêu ngữ',co(h,'Độc lập - Tự do - Hạnh phúc'));
  ok('có tên loại BIÊN BẢN',co(h,'>BIÊN BẢN<'));
  ok('có địa danh và ngày',co(h,'Vĩnh Long, ngày 15 tháng 09 năm 2026'),
     (h.match(/Vĩnh Long[^<]*/)||[''])[0]);
  ok('có tên cơ quan',co(h,'KHOA XÂY DỰNG'));
  ok('có đủ 5 sinh viên trong phiếu điểm danh',
     ten.every(n=>co(h,n)));
  ok('có cột ký tên',co(h,'Ký tên'));
  ok('ghi đúng chức vụ ban cán sự',co(h,'Lớp trưởng')&&co(h,'Bí thư Chi đoàn'));
  ok('có nội dung biên bản đã nhập',co(h,'Thông báo 411'));
  ok('ký đôi: thư ký và chủ trì',co(h,'THƯ KÝ')&&co(h,'CHỦ TRÌ'));
  ok('KHÔNG có khối ký mặc định thừa',!co(h,'Nơi nhận'));
  ok('có ngắt trang trước phiếu điểm danh',co(h,'page-break-before:always'));
  ok('lề Word đúng NĐ30 (trái 85pt = 30mm)',co(h,'margin:56.7pt 42.5pt 56.7pt 85.0pt'));
  ok('phông Times New Roman',co(h,"'Times New Roman'"));
  ok('tên tệp bỏ dấu',/^[A-Za-z0-9_]+\.doc$/.test(D.tenTep(vb)),D.tenTep(vb));
}

console.log('\n=== 1b. Số liệu vô lý phải được nêu ra, không in bừa ===');
{
  const sai=S.put('meetings',{classId:k.id,semesterId:sem.id,date:'2026-09-20',
    format:'Trực tuyến',attended:99,content:'x',minutes:'y'});
  const h=D.htmlWord(M.bienBanHopLop(sai.id));
  ok('nêu rõ số liệu cần kiểm tra lại',co(h,'SỐ LIỆU CẦN KIỂM TRA LẠI'));
  ok('nói rõ sĩ số thật',co(h,'lớn hơn sĩ số 5'),(h.match(/lớn hơn sĩ số \d+/)||[''])[0]);
  ok('KHÔNG in "vắng 0" sai lệch',!co(h,'vắng 0'));
  ok('đọc đúng hình thức họp đã nhập',co(h,'Trực tuyến'),
     'biểu mẫu lưu vào trường format, không phải mode');
  S.remove('meetings',sai.id);

  const trong=S.put('meetings',{classId:k.id,semesterId:sem.id,date:'2026-09-21'});
  const h2=D.htmlWord(M.bienBanHopLop(trong.id));
  ok('chưa nhập số dự thì để chỗ trống điền tay',co(h2,'……… sinh viên'));
  S.remove('meetings',trong.id);

  const du=S.put('meetings',{classId:k.id,semesterId:sem.id,date:'2026-09-22',attended:3});
  const h3=D.htmlWord(M.bienBanHopLop(du.id));
  ok('số hợp lệ thì tính đúng số vắng',co(h3,'3 sinh viên  (vắng 2)'),
     (h3.match(/\d+ sinh viên[^<]*/)||[''])[0]);
  S.remove('meetings',du.id);
}

console.log('\n=== 2. Phiếu theo dõi kết quả học tập ===');
{
  const vb=M.phieuHocTap(svs[0].id);
  const h=D.htmlWord(vb);
  ok('có tên và mã số sinh viên',co(h,'Nguyễn Văn An')&&co(h,'2250001'));
  ok('có lớp',co(h,'XD26CT01'));
  ok('có GPA hệ 4 và hệ 10',co(h,'hệ 4')&&co(h,'hệ 10'));
  ok('có bảng điểm từng học phần',co(h,'Sức bền vật liệu'));
  ok('có điểm chữ',/>[ABCDF]\+?</.test(h));
  ok('có thang điểm áp dụng',co(h,'Thang điểm áp dụng'));
  ok('có mức cảnh báo học vụ',co(h,'cảnh báo học vụ'));
  ok('có khối ký của cố vấn',co(h,'CỐ VẤN HỌC TẬP')&&co(h,'ThS. Trương Hoàng Phiếu'));
  ok('có Nơi nhận',co(h,'Nơi nhận'));
  ok('tên dài không làm vỡ bảng',co(h,'word-wrap:break-word'));
}

console.log('\n=== 3. Báo cáo công tác cố vấn học tập ===');
{
  const vb=M.baoCaoCongTac(k.id,{semesterId:sem.id,kyBaoCao:'Học kỳ 1, năm học 2026-2027'});
  const h=D.htmlWord(vb);
  ok('có tên loại BÁO CÁO',co(h,'>BÁO CÁO<'));
  ok('có Kính gửi',co(h,'Kính gửi'));
  ok('có bảng phân loại học lực',co(h,'PHÂN LOẠI HỌC LỰC'));
  ok('có mục cảnh báo học vụ',co(h,'Tình hình cảnh báo học vụ'.toUpperCase()));
  ok('nêu được sinh viên yếu',co(h,'Võ Minh Em'),'SV có GPA thấp phải vào danh sách cảnh báo');
  ok('có công tác sinh hoạt lớp',co(h,'CÔNG TÁC SINH HOẠT LỚP'));
  ok('viện dẫn Quyết định 758',co(h,'758'));
  ok('đếm đúng số buổi họp',co(h,'1/4 buổi'),(h.match(/\d+\/\d+ buổi/)||[''])[0]);
  ok('có bảng chi tiết buổi họp',co(h,'Phổ biến quy chế'));
  ok('có khối ký và Nơi nhận',co(h,'Nơi nhận')&&co(h,'CỐ VẤN HỌC TẬP'));
}

console.log('\n=== 4. Bản in và bản Word phải khớp nhau ===');
{
  const vb=M.phieuHocTap(svs[0].id);
  const w=D.htmlWord(vb), i=D.htmlIn(vb);
  // Bản Word bọc thêm <div class="Section1"> để Word nhận thiết lập trang,
  // nên so phần thân nằm giữa, không so cả lớp bọc.
  const than=(x)=>{
    const a=x.indexOf('<table class="kh-dau"');
    const b=x.lastIndexOf('</body>');
    return x.slice(a,b).replace(/<\/div>$/,'');
  };
  ok('phần thân giống hệt nhau từng ký tự',than(w)===than(i),
     'dài '+than(w).length+' vs '+than(i).length);
  ok('bản Word có bọc Section1 cho thiết lập trang',co(w,'<div class="Section1">'));
  ok('bản in có @page A4',co(i,'size:A4 portrait'));
  ok('bản in có lề NĐ30',co(i,'margin:20mm 15mm 20mm 30mm'));
  ok('bản Word có khai báo mso',co(w,'w:WordDocument'));
}

console.log('\n=== 5. Chặn chèn mã độc qua tên sinh viên ===');
{
  const xau=S.put('students',{name:'<script>alert(1)</script>',mssv:'<b>x</b>',classId:k.id});
  const h=D.htmlWord(M.phieuHocTap(xau.id));
  ok('thẻ script bị vô hiệu',!co(h,'<script>alert'));
  ok('vẫn hiện đúng chữ',co(h,'&lt;script&gt;'));
  ok('thẻ b trong mã số cũng bị vô hiệu',!co(h,'<b>x</b>'));
  S.remove('students',xau.id);
}

console.log('\n=== 5b. Không tự bịa tên cơ quan ===');
{
  const cu=S.settings().facultyName;
  S.settings().facultyName='';
  const h=D.htmlWord(M.baoCaoCongTac(k.id,{}));
  ok('không có Khoa thì KHÔNG tự điền tên Khoa',!h.includes('KHOA XÂY DỰNG'));
  // Tên dài nay được ngắt dòng cân đối nên có <br> ở giữa — bỏ thẻ rồi mới so.
  const phang=(x)=>x.replace(/<br>/g,' ');
  ok('vẫn in tên Trường ở phần đầu',
     phang(h).includes('TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TÂY'));
  ok('mục Đơn vị công tác khớp với phần đầu',
     h.includes('Đơn vị công tác: Trường Đại học Xây dựng Miền Tây'),
     (h.match(/Đơn vị công tác:[^<]*/)||[''])[0]);
  S.settings().facultyName=cu;
  const h2=D.htmlWord(M.baoCaoCongTac(k.id,{}));
  ok('có Khoa thì in cả Trường lẫn Khoa',
     phang(h2).includes('TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TÂY')&&h2.includes('KHOA XÂY DỰNG'));
  ok('mục Đơn vị công tác ghi đủ Khoa và Trường',
     h2.includes('Đơn vị công tác: Khoa Xây dựng, Trường Đại học Xây dựng Miền Tây'),
     (h2.match(/Đơn vị công tác:[^<]*/)||[''])[0]);
}

console.log('\n=== 5c. Ngắt dòng tên cơ quan cho cân đối ===');
{
  const n=D.ngatCanDoi;
  ok('tên dài ngắt ở giữa, hai dòng cân nhau',
     n('TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TÂY')==='TRƯỜNG ĐẠI HỌC<br>XÂY DỰNG MIỀN TÂY',
     n('TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TÂY'));
  ok('tên ngắn giữ nguyên một dòng',n('KHOA XÂY DỰNG')==='KHOA XÂY DỰNG');
  ok('một từ dài thì không ngắt bừa',n('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123')==='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123');
  ok('vẫn chặn thẻ HTML',n('<b>Trường Rất Dài Tên Của Nó Đây</b>').indexOf('<b>')===-1,
     n('<b>Trường Rất Dài Tên Của Nó Đây</b>'));
  const h=D.htmlWord(M.baoCaoCongTac(k.id,{}));
  ok('áp dụng vào phần đầu văn bản',h.includes('TRƯỜNG ĐẠI HỌC<br>XÂY DỰNG MIỀN TÂY'));
  ok('quốc hiệu không được vỡ dòng',h.includes('white-space:nowrap'));
}

console.log('\n=== 6. Dữ liệu trống thì không vỡ ===');
{
  const k2=S.put('classes',{code:'XD26CT99',name:'Lớp trống'});
  const vb=M.baoCaoCongTac(k2.id,{});
  ok('vẫn dựng được báo cáo cho lớp trống',!!vb);
  const h=D.htmlWord(vb);
  ok('báo không có sinh viên cảnh báo',co(h,'không có sinh viên thuộc diện cảnh báo'));
  ok('không sinh ra chuỗi undefined',!co(h,'undefined'),
     (h.match(/.{30}undefined.{30}/)||[''])[0]);
  ok('không sinh ra NaN',!co(h,'NaN'),(h.match(/.{30}NaN.{30}/)||[''])[0]);
  ok('biên bản của buổi họp không tồn tại trả về null',M.bienBanHopLop('khong-co')===null);
  ok('phiếu của sinh viên không tồn tại trả về null',M.phieuHocTap('khong-co')===null);
}

console.log('\n'+'='.repeat(46)+'\n'+pass+' đạt, '+fail+' sai');
process.exit(fail?1:0);
