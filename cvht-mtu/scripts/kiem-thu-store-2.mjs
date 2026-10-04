import fs from 'fs'; import vm from 'vm';
const JS=new URL('../assets/js/', import.meta.url).pathname; const mem=new Map();
const ctx={console,window:{},localStorage:{getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)},
 crypto:{getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);return a;}}};
ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['util.js','store.js']) vm.runInContext(fs.readFileSync(JS+f,'utf8'),ctx,{filename:f});
const S=ctx.CV.store; S.load();
let pass=0,fail=0; const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};

const day=[];
S.useBackend({name:'gia',push:(c,o)=>{day.push(['push',c,o.id]);return Promise.resolve();},
  del:(c,i)=>{day.push(['del',c,i]);return Promise.resolve();},status:()=>({online:true})});

console.log('\n=== removeClass ===');
const A=S.put('classes',{code:'A'}), B=S.put('classes',{code:'B'});
S.put('schedules',{classId:A.id,day:2}); S.put('schedules',{classId:B.id,day:3});
S.put('meetings',{classId:A.id,title:'Họp A'}); S.put('meetings',{classId:B.id,title:'Họp B'});
const sv=S.put('students',{mssv:'1',classId:A.id});

let r=S.removeClass(A.id);
ok('lớp còn sinh viên thì từ chối xoá', r.ok===false, JSON.stringify(r));
ok('lớp vẫn còn đó', !!S.get('classes',A.id));

S.removeStudentCascade(sv.id);
day.length=0;
r=S.removeClass(A.id);
ok('lớp trống thì xoá được', r.ok===true);
ok('thời khoá biểu lớp A mất', S.find('schedules',x=>x.classId===A.id).length===0);
ok('sổ họp lớp A mất', S.find('meetings',x=>x.classId===A.id).length===0);
ok('lớp B còn nguyên thời khoá biểu', S.find('schedules',x=>x.classId===B.id).length===1);
ok('lớp B còn nguyên sổ họp', S.find('meetings',x=>x.classId===B.id).length===1);
ok('có gửi lệnh xoá lên máy chủ', day.filter(d=>d[0]==='del').length>=3, JSON.stringify(day));
const delIds=day.filter(d=>d[0]==='del').map(d=>d[2]);
const bIds=[...S.all('schedules'),...S.all('meetings')].map(x=>x.id);
ok('KHÔNG xoá nhầm bản ghi của lớp B', !delIds.some(i=>bIds.includes(i)));

console.log('\n=== xuất / nhập vẫn chạy ===');
const js=S.exportJson(); ok('exportJson ra JSON hợp lệ', JSON.parse(js)._app==='CVHT MTU');
const im=S.importJson(js,'replace'); ok('importJson nạp lại được', im.ok===true, JSON.stringify(im));

console.log('\n'+pass+' đạt, '+fail+' sai');
process.exit(fail?1:0);
