
const {chromium}=require('playwright');
const fs=require('node:fs');
const I={op:'944d3254-2839-4b34-a8b5-8d21638220b2',priv:'d0718f8b-5491-4f9c-a3f3-3b8ffe72381d',rights:'f1dc6226-2cc8-4bc7-85af-4c8593711fbe',alone:'355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a',means:'a8032422-b3a0-49a8-b004-d430b08de1ae',keys:'2f16adb9-ec87-4b45-aee2-b7c09bd4f138',deadline:'265977a9-c01e-4482-bc4c-d34e705d915b'};
const f={};
async function survey(page,step){
 await page.waitForTimeout(150);
 const d=await page.evaluate(()=>{
   const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0};
   let radio=[...document.querySelectorAll('input[type=radio]')].filter(vis);
   let groups={};radio.forEach(e=>{const id=e.name;groups[id]??=[];groups[id].push({label:document.querySelector('label[for="'+e.id+'"]')?.innerText?.replace(/\s+/g,' ').trim()||'',checked:e.checked,required:e.required})});
   let cbs=[...document.querySelectorAll('input[type=checkbox]')].filter(vis).map(e=>({label:document.querySelector('label[for="'+e.id+'"]')?.innerText?.replace(/\s+/g,' ').slice(0,140),required:e.required}));
   let combos=[...document.querySelectorAll('input[role=combobox]')].filter(vis).map(e=>({id:e.id,aria:e.getAttribute('aria-label')||'',value:e.value}));
   let body=document.body.innerText||'';
   return {groups,cbs,combos,titles:body.split('\n').filter(x=>x.includes('?')).slice(0,45),text:body.slice(0,4000),submitVisible:body.includes('COMMANDER ET PAYER')};
 });
 f[step]=d;console.log('SURVEY '+JSON.stringify({step,groups:d.groups,cbs:d.cbs,combos:d.combos,questions:d.titles,submit:d.submitVisible}));
}
async function sel(page,id,n){const l=page.locator('input[type=radio][name="multiple_choice_'+id+'"]').nth(n);await l.check({force:true,timeout:4500});await page.waitForTimeout(120)}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  let page=await browser.newPage({viewport:{width:390,height:844},locale:'fr-FR'});
  await page.goto('https://tally.so/r/xXOqpk?mission=RELAIS%20SIMPLE&tarif=109%20%E2%82%AC%20TTC&creneau=2026-10-15%2010%3A00',{waitUntil:'domcontentloaded'});
  await survey(page,'initial');
  await sel(page,I.op,0);await survey(page,'recuperer');
  await sel(page,I.priv,0);await survey(page,'private_yes');
  await sel(page,I.rights,0);await survey(page,'rights_non');
  await sel(page,I.alone,1);await survey(page,'alone');
  for(let n=0;n<5;n++){await sel(page,I.means,n);await survey(page,'means_'+n)}
  await sel(page,I.means,1);await survey(page,'means_direct');
  await sel(page,I.op,1);await survey(page,'remettre_with_private_yes');
  await sel(page,I.priv,1);await survey(page,'remettre_private_non');
  for(let n=0;n<3;n++){await sel(page,I.keys,n);await survey(page,'remettre_keys_'+n)}
  fs.mkdirSync('survey-results',{recursive:true});fs.writeFileSync('survey-results/relais-questions.json',JSON.stringify(f,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error('ERROR',String(e));process.exitCode=1});
