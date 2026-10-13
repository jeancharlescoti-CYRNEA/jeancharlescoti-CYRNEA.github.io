/**
 * RELAIS STANDARD — targeted conditional regression on the PUBLIC form.
 * Production remains untouched. NEVER submit, never pay, never click Publish.
 * This does NOT test the unpublished Tally editor draft.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const out='conditional-audit-results';
fs.mkdirSync(out,{recursive:true});
const base='https://tally.so/r/xXOqpk';
const I={
 op:'944d3254-2839-4b34-a8b5-8d21638220b2',
 private:'d0718f8b-5491-4f9c-a3f3-3b8ffe72381d',
 rights:'f1dc6226-2cc8-4bc7-85af-4c8593711fbe',
 alone:'355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a',
 material:'a8032422-b3a0-49a8-b004-d430b08de1ae',
 keys:'2f16adb9-ec87-4b45-aee2-b7c09bd4f138',
 deadline:'265977a9-c01e-4482-bc4c-d34e705d915b'
};
const observations=[];
const checks=[];
function assert(label,ok,observed,expected){
 const r={label,status:ok?'PASS':'FAIL',expected,observed};
 checks.push(r);console.log('ASSERT '+JSON.stringify(r));return ok;
}
async function state(page,label){
 await page.waitForTimeout(210);
 const x=await page.evaluate((id)=>{
  const vis=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.height>0&&r.width>0};
  const text=document.body.innerText||'';
  const btn=[...document.querySelectorAll('button,input[type=submit]')].find(e=>(e.innerText||e.value||'').includes('COMMANDER ET PAYER'));
  const dead=document.querySelector('input[id="'+id+'"]');
  let deadlineTitle=text.includes('Votre mission est-elle prévue dans moins de 24 heures ?');
  let restitution=text.includes('Que devra faire RELAIS des clés, badges ou télécommandes à l’issue de la mission ?')||text.includes("Que devra faire RELAIS des clés, badges ou télécommandes à l'issue de la mission ?");
  let laPoste=text.includes('Vous pourrez expédier vos clés depuis le continent');
  let legal=text.includes('ACCÈS AUTONOME IMPOSSIBLE');
  let material=text.includes('La disponibilité des clés ne permet pas de confirmer')||text.includes("Aucun moyen d'accès n'est actuellement disponible pour réaliser votre mission")||text.includes("L'accès nécessaire à votre mission ne peut pas être organisé");
  return {deadlineTitle,deadlineVisible:vis(dead),deadlineLabel:dead?.getAttribute('aria-label')||'',restitution,laPoste,legal,material,payment:!!btn&&vis(btn),total:text.match(/Total à régler[^\n]*/)?.[0]||'', phoneHint:text.includes('Si l’indicatif +33')||text.includes("Si l'indicatif +33")};
 },I.deadline);
 observations.push({label,...x});console.log('STATE '+JSON.stringify({label,...x}));return x;
}
async function pick(page,k,n){
 const uuid=I[k];let loc=page.locator('input[type=radio][name="multiple_choice_'+uuid+'"]');
 if((await loc.count())<=n)throw new Error('RADIO MISSING '+k+' #'+n);
 await loc.nth(n).check({force:true,timeout:7000});
 if(!(await loc.nth(n).isChecked()))throw new Error('RADIO FAILED '+k+' #'+n);
 await page.waitForTimeout(130);
}
async function delay(page,answer){
 const el=page.locator('input[role=combobox][id="'+I.deadline+'"]');
 await el.click({force:true});
 await page.waitForTimeout(130);
 const option=page.getByRole('option',{name:answer,exact:true});
 if(await option.count())await option.first().click({force:true,timeout:4500});
 else await page.getByText(answer,{exact:true}).last().click({force:true,timeout:4500});
 await page.waitForTimeout(180);
}
async function pageStart(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'fr-FR'});
 const q=new URLSearchParams({mission:'RELAIS SIMPLE',objet:'AUDIT AUTOMATIQUE SANS COMMANDE',tarif:'109 € TTC',creneau:'2026-10-15 10:00',cadre_client:'PROPRIÉTAIRE PARTICULIER',availability_mode:'standard'});
 const res=await page.goto(base+'?'+q.toString(),{waitUntil:'domcontentloaded',timeout:40000});
 if(res.status()!==200)throw new Error('HTTP '+res.status());
 await page.waitForTimeout(400);
 return page;
}
async function test(browser,name,fn){
 let page;
 try{page=await pageStart(browser);await fn(page);
 }catch(e){checks.push({label:name,status:'INCOMPLETE',error:String(e).slice(0,650)});console.log('INCOMPLETE '+JSON.stringify({name,error:String(e).slice(0,650)}));if(page)await page.screenshot({path:out+'/error-'+name+'.png',fullPage:true}).catch(()=>{})}
 finally{await page?.close().catch(()=>{})}
}
(async()=>{
 let browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await test(browser,'REMISE_AVAILABILITY',async p=>{
   let s=await state(p,'initial');
   // This is a confirmed error in published form, separate from unpublished draft.
   assert('NO_UNLABELED_24H_ON_INITIAL_PUBLIC',!(s.deadlineVisible&&!s.deadlineTitle),s,'deadline not visible without relevant keys situation');
   await pick(p,'op',1);await pick(p,'private',1);await pick(p,'keys',0);
   s=await state(p,'remettre-local-keys');
   assert('REMISE_LOCAL_NO_RESTITUTION',!s.restitution,s.restitution,false);
   assert('REMISE_LOCAL_NO_LAPOSTE',!s.laPoste,s.laPoste,false);
   await pick(p,'keys',1);
   s=await state(p,'remettre-continent');
   assert('REMISE_CONTINENT_DEADLINE_LABEL',s.deadlineTitle&&s.deadlineVisible,[s.deadlineTitle,s.deadlineVisible],true);
   assert('REMISE_CONTINENT_LAPOSTE',s.laPoste,s.laPoste,true);
   for(const [d,blocked] of [['OUI',true],['JE NE SAIS PAS',true],['NON',false]]){
     await delay(p,d);s=await state(p,'remettre-'+d.replace(/\s/g,'-'));
     assert('REMISE_DELAY_'+d,blocked?s.material&&!s.payment:!s.material&&s.payment,{blocked:s.material,payment:s.payment},blocked?'STOP':'GO');
   }
   await pick(p,'keys',0);
   s=await state(p,'remettre-back-local');
   assert('REMISE_LOCAL_RECOVERY',!s.material&&!s.laPoste&&s.payment,s,{payment:true,laPoste:false,material:false});
  });
  await test(browser,'CUMUL_STOP_LEGAL_MATERIAL',async p=>{
    await pick(p,'op',0);await pick(p,'private',0);await pick(p,'rights',2);await pick(p,'alone',1);
    let s=await state(p,'legal-unknown-alone');
    assert('RIGHTS_UNKNOWN_BLOCK',s.legal&&!s.payment,s,'legal STOP and hidden payment');
    await pick(p,'material',4);s=await state(p,'legal-unknown-means-none');
    assert('BOTH_STOP_BLOCK',s.legal&&!s.payment,s,'legal STOP and hidden payment');
    await pick(p,'rights',0);s=await state(p,'rights-cleared-material-still-none');
    assert('MATERIAL_REMAINS_BLOCKED_AFTER_LEGAL_RESOLVED',s.material&&!s.payment,s,'material STOP and hidden payment');
    await pick(p,'material',0);s=await state(p,'means-code-resolved');
    assert('CUMUL_STOP_RECOVERY',!s.legal&&!s.material&&s.payment,s,'no STOP, payment shown');
  });
  await test(browser,'RECUPERER_RESTITUTION',async p=>{
    await pick(p,'op',0);await pick(p,'private',0);await pick(p,'rights',0);await pick(p,'alone',1);await pick(p,'material',1);
    let s=await state(p,'recuperer-keys-direct');
    // Business doctrine: holding recovered keys temporarily must trigger restitution options.
    assert('RECUPERER_RESTITUTION_PRESENT',s.restitution,s.restitution,true);
    assert('RECUPERER_DIRECT_NO_LAPOSTE',!s.laPoste,s.laPoste,false);
  });
  for(const means of [0,1,2,3,4]){
    await test(browser,'POSTE_MEANS_'+means,async p=>{
      await pick(p,'op',0);
      await pick(p,'private',0);
      await pick(p,'rights',0);
      await pick(p,'alone',1);
      await pick(p,'material',means);
      const d=await state(p,'poste-means-'+means);
      const expected=means===3;
      assert('POSTE_ONLY_CONTINENT_MEANS_'+means,d.laPoste===expected,d.laPoste,expected);
      if(means===3){
        await delay(p,'NON');
        await pick(p,'material',1);
        const after=await state(p,'poste-shipping-back-to-direct');
        assert('POSTE_DISAPPEARS_AFTER_CHANGE_TO_DIRECT',!after.laPoste,after.laPoste,false);
      }
    });
  }
  await test(browser,'ACCESS_AUTH_MISSING',async p=>{
    await pick(p,'op',0);await pick(p,'private',0);
    const dat=await p.evaluate((id)=>{
       let qs=['f1dc6226-2cc8-4bc7-85af-4c8593711fbe','355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a'];
       return Object.fromEntries(qs.map(k=>[k,[...document.querySelectorAll('input[name="multiple_choice_'+k+'"]')].map(el=>({required:el.required,checked:el.checked}))]));
    });
    const qrights=dat[I.rights]||[];
    assert('RIGHTS_FIELD_REQUIRED',qrights.length===3&&qrights.some(e=>e.required),dat,'3 options, required');
    assert('RIGHTS_EMPTY_INITIALLY',qrights.every(e=>!e.checked),dat,'all unchecked');
  });
 }finally{await browser.close()}
 fs.writeFileSync(out+'/report.json',JSON.stringify({date:'2026-10-13',target:'PUBLIC published xXOqpk',checks,observations},null,2));
 let c={pass:checks.filter(x=>x.status==='PASS').length,fail:checks.filter(x=>x.status==='FAIL').length,incomplete:checks.filter(x=>x.status==='INCOMPLETE').length};
 console.log('CONDITIONAL_SUMMARY '+JSON.stringify(c));
 if(c.fail||c.incomplete)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
