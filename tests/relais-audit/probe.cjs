/**
 * CYRNEA RELAIS STANDARD — browser reconnaissance & safe checks.
 * Never submits a form, never clicks payment, never edits production.
 * Do not enter personally identifiable data or valid payment references.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const base = 'https://tally.so/r/xXOqpk';
const queries = {
  'RELAIS SIMPLE': 109,
  'RELAIS': 169,
  'VOIR RELAIS': 260,
  'RELAIS - AVANT INTEMPÉRIE': 169,
  'RELAIS SIMPLE - APRÈS INTEMPÉRIE': 109
};
fs.mkdirSync('relais-audit-results', {recursive:true});
function url(mission, price) {
  let q = new URLSearchParams({
    mission,
    objet:'TEST AUTOMATIQUE SANS COMMANDE',
    tarif:price+' € TTC',
    creneau:'2026-10-15 10:00',
    cadre_client:'PROPRIÉTAIRE PARTICULIER',
    availability_mode:'standard'
  });
  return base + '?' + q.toString();
}
const IDS={
  operation:'944d3254-2839-4b34-a8b5-8d21638220b2',
  privateAccess:'d0718f8b-5491-4f9c-a3f3-3b8ffe72381d',
  rights:'f1dc6226-2cc8-4bc7-85af-4c8593711fbe',
  alone:'355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a',
  material:'a8032422-b3a0-49a8-b004-d430b08de1ae',
  keysInCorsica:'2f16adb9-ec87-4b45-aee2-b7c09bd4f138',
  under24:'265977a9-c01e-4482-bc4c-d34e705d915b',
  returnKeys:'6a42d8bd-7ab8-42f6-800d-7b1889a49710'
};
function norm(s){return String(s||'').replace(/\s+/g,' ').trim()}
async function snapshot(page,label){
 const data=await page.evaluate((IDS)=>{
   const visible=e=>{if(!e)return false;let s=getComputedStyle(e);let r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
   const block=id=>{let els=[...document.querySelectorAll('[data-block-id]')].filter(e=>e.getAttribute('data-block-id')===id);return els.map(e=>({visible:visible(e),tag:e.tagName,html:e.outerHTML.slice(0,1650),text:(e.innerText||'').slice(0,420)}))};
   let txt=document.body.innerText||'';
   let paymentBtns=[...document.querySelectorAll('button, input[type=submit]')].filter(e=>(e.innerText||e.value||'').includes('COMMANDER ET PAYER'));
   return {title:document.title,url:location.href,
    recap:txt.slice(0,500),
    submit:paymentBtns.map(e=>({text:e.innerText,visible:visible(e),disabled:e.disabled})),
    total:txt.match(/Total à régler[^\n]*/)?.[0]||'NOT PRESENT',
    stoppages:(txt.match(/ACCÈS AUTONOME IMPOSSIBLE|Aucun moyen d'accès n'est actuellement disponible|La disponibilité des clés ne permet pas|L'accès nécessaire à votre mission ne peut pas/g)||[]),
    ghostCount:[...document.querySelectorAll('input')].filter(e=>e.getAttribute('aria-label')==='Untitled dropdown field'&&visible(e)).length,
    fields:Object.fromEntries(Object.entries(IDS).map(([key,id])=>[key,block(id)]))
   };
 },IDS);
 const out={label,...data};fs.writeFileSync('relais-audit-results/'+label+'.json',JSON.stringify(out,null,2));
 const brief={label,title:data.title,submit:data.submit,total:data.total,stoppages:data.stoppages,ghostCount:data.ghostCount,visible:Object.fromEntries(Object.entries(data.fields).map(([k,b])=>[k,b.map(x=>x.visible)]))};
 console.log('AUDIT_SNAPSHOT '+JSON.stringify(brief));
 return data;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for (let [mission,price] of Object.entries(queries)) {
   const page=await browser.newPage({viewport:{width:390,height:844},locale:'fr-FR'});
   const errs=[];page.on('pageerror',e=>errs.push(String(e).slice(0,300)));
   try{
    let resp=await page.goto(url(mission,price),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForTimeout(1400);
    const key=Object.keys(queries).indexOf(mission)+1;
    await snapshot(page,'mission-'+key);
    if(key===1){
      await page.screenshot({path:'relais-audit-results/initial-mobile.png',fullPage:true});
      for(let [name,id] of Object.entries(IDS)){
       let x=page.locator('[data-block-id="'+id+'"]');
       let ct=await x.count();
       console.log('PROBE_FIELD '+JSON.stringify({name,id,count:ct,
         sample:ct?(await x.first().evaluate(el=>el.outerHTML.slice(0,1900))):''}));
      }
      // No form submission. Probe only the initial field selection.
      const rem=page.getByText('Remettre vos clés, badges ou télécommandes.',{exact:false});
      console.log('PROBE_REMETTRE count='+await rem.count());
      if(await rem.count()){
        await rem.first().click({timeout:7000});
        await page.waitForTimeout(450);
        await snapshot(page,'after-remettre');
      }
      const access=page.getByText('Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?', {exact:false});
      console.log('PROBE_ACCESS_QUESTION count='+await access.count());
      await page.screenshot({path:'relais-audit-results/after-remettre.png',fullPage:true});
    }
    console.log('MISSION_RESULT '+JSON.stringify({mission,http:resp.status(),errors:errs}));
   }catch(e){console.error('MISSION_ERROR '+JSON.stringify({mission,error:String(e)}));process.exitCode=1}
   finally{await page.close()}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
