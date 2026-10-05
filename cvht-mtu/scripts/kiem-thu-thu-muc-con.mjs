import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL_SUB='http://127.0.0.1:8142/cvht-mtu/index.html';   // giả lập /NTL/cvht-mtu/
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1280,height:900},locale:'vi-VN'});
const errs=[],req404=[];
const p=await ctx.newPage();
p.on('pageerror',e=>errs.push('LOI '+e.message));
p.on('response',r=>{if(r.status()>=400&&!/favicon/.test(r.url()))req404.push(r.status()+' '+r.url());});
let pass=0,fail=0;
const ok=(n,c,e)=>{c?(pass++,console.log('  OK   '+n)):(fail++,console.log('  SAI  '+n+(e?' → '+e:'')));};

await p.goto(URL_SUB,{waitUntil:'networkidle'});
await p.waitForTimeout(1800);

console.log('\n=== Chạy ở thư mục con (như GitHub Pages) ===');
const sw=await p.evaluate(async ()=>{
  if(!('serviceWorker' in navigator)) return {co:false};
  const rs=await navigator.serviceWorker.getRegistrations();
  return {co:rs.length>0, scope:rs[0]?rs[0].scope:'', active:!!(rs[0]&&(rs[0].active||rs[0].installing))};
});
ok('service worker đăng ký được',sw.co,JSON.stringify(sw));
ok('phạm vi đúng thư mục con',/\/cvht-mtu\/$/.test(sw.scope||''),sw.scope);

const mf=await p.evaluate(async ()=>{
  const l=document.querySelector('link[rel=manifest]');
  const r=await fetch(l.href); const j=await r.json();
  return {href:l.href, ok:r.ok, start:new URL(j.start_url,l.href).pathname,
          scope:new URL(j.scope,l.href).pathname,
          icon:new URL(j.icons[0].src,l.href).pathname};
});
ok('manifest tải được',mf.ok,mf.href);
ok('start_url trỏ đúng thư mục con',/\/cvht-mtu\/index\.html$/.test(mf.start),mf.start);
ok('scope trỏ đúng thư mục con',/\/cvht-mtu\/$/.test(mf.scope),mf.scope);
ok('đường dẫn biểu tượng đúng',/\/cvht-mtu\/assets\/icons\//.test(mf.icon),mf.icon);

ok('ứng dụng vẽ được màn hình',(await p.locator('#view-gate, #shell').count())>0);
ok('không lỗi JavaScript',errs.length===0,errs.join(' | '));
ok('không tệp nào tải hỏng',req404.length===0,req404.join(' | '));

// Nạp trước có đủ không
const cache=await p.evaluate(async ()=>{
  const ks=await caches.keys(); if(!ks.length) return {n:0};
  const c=await caches.open(ks[0]); const r=await c.keys();
  return {ten:ks[0], n:r.length, mau:r.slice(0,2).map(x=>new URL(x.url).pathname)};
});
ok('bộ nhớ đệm có nạp tệp',cache.n>0,JSON.stringify(cache));
ok('tệp nạp đúng thư mục con',(cache.mau||[]).every(x=>x.includes('/cvht-mtu/')),
   JSON.stringify(cache.mau));

console.log('\n'+'='.repeat(46)+'\n'+pass+' đạt, '+fail+' sai');
await b.close(); process.exit(fail?1:0);
