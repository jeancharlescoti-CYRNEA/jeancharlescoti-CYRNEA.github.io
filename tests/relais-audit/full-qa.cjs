/**
 * CYRNEA RELAIS STANDARD public front-end QA.
 * Tests mobile + desktop, telephone, validation metadata, prefill, CGV links.
 * READ ONLY except harmless local input; NO submit, NO payment, NO publishing.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const OUT='full-qa-results';
fs.mkdirSync(OUT,{recursive:true});
const results=[];
const URL='https://tally.so/r/xXOqpk';
const tariffs={'RELAIS SIMPLE':109,'RELAIS':169,'VOIR RELAIS':260,'RELAIS - AVANT INTEMPÉRIE':169,'RELAIS SIMPLE - APRÈS INTEMPÉRIE':109};
const report=(check,pass,detail,level='required')=>{
 const item={check,status:pass?'PASS':'FAIL',level,detail};
 results.push(item);
 console.log('QA '+JSON.stringify(item));
};
function readSrc(field){return String(field||'').trim().replace(/\s+/g,' ')}
async function one(browser,mission,amount,viewportName,vp) {
 const p=await browser.newPage({viewport:vp,locale:'fr-FR',acceptDownloads:false});
 try {
 const params=new URLSearchParams({mission,objet:'AUDIT SANS COMMANDE',tarif:amount+' € TTC',creneau:'2026-10-15 10:00',nom_client:'Audit Demo',email_client:'audit@example.invalid',telephone_client:'0612345678',cadre_client:'PROPRIÉTAIRE PARTICULIER',availability_mode:'standard'});
 let response=await p.goto(URL+'?'+params.toString(),{waitUntil:'domcontentloaded',timeout:30000});
 await p.waitForTimeout(700);
 const d=await p.evaluate(()=>{
  const vis=e=>{if(!e)return false;let c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.height>0&&r.width>0};
  let body=document.body.innerText||'';
  let inp=[...document.querySelectorAll('input')].filter(vis).map(e=>({id:e.id,type:e.type,required:e.required,aria:e.getAttribute('aria-label'),placeholder:e.placeholder,value:e.value,outer:e.outerHTML.slice(0,540)}));
  let tel=[...document.querySelectorAll('input[type=tel]')].map(e=>({id:e.id,name:e.name,required:e.required,placeholder:e.placeholder,pattern:e.pattern,autocomplete:e.autocomplete,disabled:e.disabled,readOnly:e.readOnly,value:e.value,aria:e.getAttribute('aria-label'),parent:e.parentElement?.parentElement?.outerHTML.slice(0,1850)}));
  let labels=[...document.querySelectorAll('label')].map(e=>e.innerText.trim()).filter(Boolean);
  let links=[...document.querySelectorAll('a')].map(e=>({text:e.innerText.trim(),href:e.href,visible:vis(e)})).filter(x=>x.visible);
  let formCount=document.querySelectorAll('form').length;
  let phoneText=document.body.innerText.match(/Téléphone.{0,120}/)?.[0]||'';
  let ghost=[...document.querySelectorAll('input')].filter(e=>e.getAttribute('aria-label')==='Untitled dropdown field'&&vis(e)).map(e=>({id:e.id,tag:e.tagName,html:e.outerHTML.slice(0,580)}));
  let submit=[...document.querySelectorAll('button,input[type=submit]')].filter(e=>(e.innerText||e.value||'').includes('COMMANDER ET PAYER')).map(e=>({visible:vis(e),disabled:e.disabled,html:e.outerHTML.slice(0,500)}));
  return {title:document.title,body:body.slice(0,9000),inputs:inp,tel,labels,links,formCount,phoneText,ghost,submit,total:body.match(/Total à régler[^\n]*/)?.[0]||'',scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth,hiddenParams:[...document.querySelectorAll('input[type=hidden]')].map(e=>({name:e.name,value:e.value}))};
 });
 const base=viewportName+'-'+Object.keys(tariffs).indexOf(mission);
 fs.writeFileSync(OUT+'/'+base+'.json',JSON.stringify(d,null,2));
 console.log('RAW '+JSON.stringify({base,phoneText:d.phoneText,tel:d.tel.map(x=>({...x,parent:x.parent.slice(0,550)})),visibleInputSummary:d.inputs.map(x=>({type:x.type,required:x.required,placeholder:x.placeholder,value:x.value,aria:x.aria})),links:d.links,scrollWidth:d.scrollWidth,innerWidth:d.innerWidth,ghost:d.ghost}));
 report(base+'_HTTP200',response.status()===200,{status:response.status()});
 report(base+'_PRICE',d.total.includes(amount+' € TTC'),{expected:amount,got:d.total});
 report(base+'_MOBILE_WIDTH',d.scrollWidth<=d.innerWidth+2,{scrollWidth:d.scrollWidth,innerWidth:d.innerWidth});
 report(base+'_PREFILL',d.body.includes(mission)&&d.body.includes('2026-10-15 10:00'),{missionVisible:d.body.includes(mission),dateVisible:d.body.includes('2026-10-15 10:00')});
 report(base+'_PHONE_LABEL',d.body.includes('Téléphone')&&d.body.includes('Exemple : 06 12 34 56 78'),{phoneText:d.phoneText});
 report(base+'_PHONE_REQUIRED',d.tel.length===1&&d.tel[0].required,{telCount:d.tel.length,required:d.tel.map(x=>x.required)});
 report(base+'_PHONE_HINT_COUNTRY',d.body.includes('+33')&&d.body.includes('ne le saisissez pas une seconde fois'),{hint:d.phoneText});
 report(base+'_CGV_V16',d.links.some(l=>l.href.includes('cyrnea-contrats-tally.pages.dev/relais-cgv-v16-2026-10-05.pdf')),{cgvs:d.links.filter(l=>l.href.includes('cgv'))});
 report(base+'_RETRACTION',d.body.includes('RÉTRACTATION'),{hasRetract:d.body.includes('RÉTRACTATION')});
 report(base+'_NO_UNLABELED_DROPDOWN',d.ghost.length===0,{ghost:d.ghost});
 report(base+'_PAYMENT_BUTTON_LABEL',d.submit.length===1,{button:d.submit});
 if(mission==='RELAIS SIMPLE') {
  // Native telephone input behavior; only fills local page, never submits.
  const telInput=p.locator('input[type=tel]').first();
  if(await telInput.count()) {
    await telInput.fill('0612345678');
    await p.waitForTimeout(200);
    const localValue=await telInput.inputValue();
    let options=await p.evaluate(()=>[...document.querySelectorAll('[role=combobox], button')].map(e=>({aria:e.getAttribute('aria-label'),text:e.textContent?.trim().slice(0,60)})).filter(x=>x.aria||x.text?.includes('+33')).slice(0,25));
    fs.writeFileSync(OUT+'/'+base+'-phone.json',JSON.stringify({localValue,options,metadata:d.tel},null,2));
    report(base+'_PHONE_ACCEPTS_FRENCH_LOCAL_NUMBER',localValue.replace(/\D/g,'').length>=9,{localValue,options});
  }else report(base+'_PHONE_ACCEPTS_FRENCH_LOCAL_NUMBER',false,'No tel input');
  await p.screenshot({path:OUT+'/'+base+'.png',fullPage:true});
 }
 }catch(e){report(viewportName+'_'+mission+'_SCRIPT',false,String(e).slice(0,1000));await p.screenshot({path:OUT+'/error-'+viewportName+'-'+Object.keys(tariffs).indexOf(mission)+'.png',fullPage:true}).catch(()=>{})}
 finally{await p.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const [mission,amount] of Object.entries(tariffs)){
    await one(browser,mission,amount,'mobile',{width:390,height:844});
    await one(browser,mission,amount,'desktop',{width:1440,height:900});
  }
  // CGV URL exists and content is served with a successful response.
  let page=await browser.newPage();
  try{
    const req=await page.request.get('https://cyrnea-contrats-tally.pages.dev/relais-cgv-v16-2026-10-05.pdf',{timeout:20000});
    report('CGV_PDF_HTTP200',req.status()===200,{http:req.status(),type:req.headers()['content-type']});
  }catch(e){report('CGV_PDF_HTTP200',false,String(e).slice(0,300))}
  await page.close();
 }finally{await browser.close()}
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(results,null,2));
 let summary={total:results.length,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length};
 console.log('FULL_QA_SUMMARY '+JSON.stringify(summary));
 if(summary.fail)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
