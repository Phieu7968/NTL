import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext()).newPage();
await p.setContent('<body style="margin:0"><span id="s"></span></body>');
const r=await p.evaluate(()=>{
  const s=document.getElementById('s');
  s.style.fontFamily="'Times New Roman',Times,serif";
  s.style.whiteSpace='nowrap';
  const mm=(px)=>px/96*25.4;
  const out=[];
  const chuoi=['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
               'TRƯỜNG ĐẠI HỌC XÂY DỰNG MIỀN TÂY',
               'TRƯỜNG ĐH XÂY DỰNG MIỀN TÂY','KHOA XÂY DỰNG'];
  for(const t of chuoi){
    s.textContent=t;
    const d={text:t,n:t.length,co:{}};
    for(const pt of [13,12,11.5,11,10.5,10,9.5]){
      s.style.fontWeight='bold'; s.style.fontSize=pt+'pt';
      d.co[pt]=+mm(s.getBoundingClientRect().width).toFixed(1);
    }
    out.push(d);
  }
  return {out, font:getComputedStyle(s).fontFamily};
});
console.log('phông dùng:', r.font);
console.log('bề ngang còn lại sau lề NĐ30: 165,0 mm\n');
for(const d of r.out){
  console.log(d.text+'  ('+d.n+' ký tự)');
  console.log('   '+Object.entries(d.co).map(([k,v])=>k+'pt='+v+'mm').join('  '));
}
await b.close();
