'use strict';
const {chromium}=require('playwright');const fs=require('fs');
const pages=[
 {source:'SITE_RELAIS_ACCUEIL',url:'https://www.relaisproprietaire.fr/'},
 {source:'SITE_PRESENCE_ACCUEIL',url:'https://www.cyrneapresence.fr/'},
 {source:'SITE_PRESENCE_PROPRIETAIRES',url:'https://www.cyrneapresence.fr/ESPACE-PROPRIETAIRES_a20.html'},
 {source:'SITE_PRESENCE_ENTREPRISES',url:'https://www.cyrneapresence.fr/ESPACE-ENTREPRISES_a21.html'},
 {source:'PWA_GITHUB_PAGES',url:'https://jeancharlescoti-CYRNEA.github.io/jeancharlescoti-CYRNEA.github.io/'}
];
const only=(u)=>{try{let x=new URL(u);return {domain:x.hostname,path:x.pathname,queryKeys:[...x.searchParams.keys()].sort(),mission:x.searchParams.get('mission')?.slice(0,75),hasFlag:x.searchParams.has('execution_anticipee_14j'),flag:x.searchParams.get('execution_anticipee_14j'),creneau:x.searchParams.get('creneau')?.slice(0,25)}}catch(e){return null}};
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 let report=[];
 try{
 for(const p of pages){
  const page=await browser.newPage({locale:'fr-FR',viewport:{width:1440,height:900}});
  await page.route('**/*', async route=>{
   const req=route.request();if(req.method()!=='GET'&&req.method()!=='HEAD')return route.abort();
   if(/stripe|payment-gateway|\/intent|\/pay(\?|$)/i.test(req.url()))return route.abort();
   return route.continue();
  });
  let rec={source:p.source,origin:p.url,ok:false,controls:[]};
  try{
   let resp=await page.goto(p.url,{waitUntil:'domcontentloaded',timeout:28000});
   await page.waitForTimeout(1300);
   rec.ok=!!resp&&resp.status()<400;rec.http=resp?.status();rec.final=only(page.url());
   const items=await page.evaluate(()=>{
    let nodes=[...document.querySelectorAll('a,button,[role=button],input[type=button]')];
    return nodes.map(x=>({tag:x.tagName,text:(x.innerText||x.getAttribute('aria-label')||x.value||'').replace(/\s+/g,' ').trim().slice(0,125),href:x.getAttribute('href'),onClick:x.getAttribute('onclick')?.slice(0,160),title:x.getAttribute('title')?.slice(0,90)})).filter(x=>/mission|réserv|demande|tally|pwa|choisir|calcul|propriet|entrepris|sur place|commander|payer|formulaire|ACCÉDER|accéder/i.test(x.text+' '+(x.href||'')+' '+(x.onClick||''))).slice(0,180);
   });
   rec.controls=items.map(z=>({text:z.text,href:only(z.href?new URL(z.href,page.url()).href:null),rawInternal:z.href&&!/^https?:/.test(z.href)?z.href.slice(0,115):undefined,onclick:z.onClick,tag:z.tag}));rec.controlCount=rec.controls.length;
   rec.title=await page.title();
   rec.bodyIntro=(await page.locator('body').innerText()).slice(0,340).replace(/\s+/g,' ');
  }catch(e){rec.error=String(e).slice(0,400)}
  console.log('SOURCE_PATH '+JSON.stringify(rec));report.push(rec);await page.close();
 }
 }finally{await browser.close();}
 fs.mkdirSync('tally-site-pwa-entry-results',{recursive:true});fs.writeFileSync('tally-site-pwa-entry-results/report.json',JSON.stringify(report,null,2));
 console.log('SOURCE_FINAL '+JSON.stringify({tested:report.length,httpOk:report.filter(x=>x.ok).length,entryControls:report.reduce((n,x)=>n+(x.controlCount||0),0)}));
})().catch(e=>{console.log('SOURCE_SCRIPT_ERROR',String(e));process.exitCode=0;});
