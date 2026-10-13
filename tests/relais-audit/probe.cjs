/**
 * CYRNEA RELAIS STANDARD: NON-DESTRUCTIVE browser functional tests.
 * PUBLIC published site: never submit, pay, enter true PII or modify account.
 * This is NOT a certification of unpublished Tally changes or Gateway.
 */
const { chromium } = require('playwright');
const fs=require('node:fs');
const OUT='relais-audit-results';
fs.mkdirSync(OUT,{recursive:true});
const BASE='https://tally.so/r/xXOqpk';
const tariffs={'RELAIS SIMPLE':109,'RELAIS':169,'VOIR RELAIS':260,'RELAIS - AVANT INTEMPÉRIE':169,'RELAIS SIMPLE - APRÈS INTEMPÉRIE':109};
const I={
  operation:'944d3254-2839-4b34-a8b5-8d21638220b2',
  privateAccess:'d0718f8b-5491-4f9c-a3f3-3b8ffe72381d',
  rights:'f1dc6226-2cc8-4bc7-85af-4c8593711fbe',
  alone:'355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a',
  material:'a8032422-b3a0-49a8-b004-d430b08de1ae',
  keysCorsica:'2f16adb9-ec87-4b45-aee2-b7c09bd4f138',
  under24:'265977a9-c01e-4482-bc4c-d34e705d915b',
  restitution:'6a42d8bd-7ab8-42f6-800d-7b1889a49710'
};
const results=[];
function url(mission='RELAIS SIMPLE') {
 const q=new URLSearchParams({mission,objet:'AUDIT TECHNIQUE SANS COMMANDE',tarif:tariffs[mission]+' € TTC',creneau:'2026-10-15 10:00',cadre_client:'PROPRIÉTAIRE PARTICULIER',availability_mode:'standard'});
 return BASE+'?'+q.toString();
}
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
async function diagnostic(page,tag){
 let d=await page.evaluate(()=>{
   const visible=(e)=>{if(!e)return false;const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0};
   let radio=[...document.querySelectorAll('input[type=radio]')].map(e=>({
     name:e.name,
     label:document.querySelector('label[for="'+e.id+'"]')?.textContent?.trim().replace(/\s+/g,' ').slice(0,190),
     visible:visible(e), checked:e.checked
   }));
   let select=[...document.querySelectorAll('input[role=combobox]')].map(e=>({id:e.id,aria:e.getAttribute('aria-label'),visible:visible(e)}));
   let text=document.body.innerText||'';
   const btn=[...document.querySelectorAll('button,input[type=submit]')].filter(e=>(e.innerText||e.value||'').includes('COMMANDER ET PAYER')).map(e=>({visible:visible(e),disabled:e.disabled}));
   return {url:location.href,title:document.title,radios:radio,dropdowns:select,body:text.slice(0,9000),btn,total:text.match(/Total à régler[^\n]*/)?.[0]||''};
 });
 fs.writeFileSync(OUT+'/'+tag+'.json',JSON.stringify(d,null,2));
 const summary={tag,button:d.btn,total:d.total,dropdowns:d.dropdowns,radioGroups:[...new Set(d.radios.filter(x=>x.visible).map(x=>x.name))],stopLegal:/ACCÈS AUTONOME IMPOSSIBLE/.test(d.body),stopMaterial:/La disponibilité des clés ne permet pas|Aucun moyen d.accès n.est actuellement disponible|L.accès nécessaire à votre mission ne peut pas/.test(d.body)};
 console.log('CHECK '+JSON.stringify(summary));
 return { ...d,summary };
}
async function open(page,mission='RELAIS SIMPLE'){
 await page.goto(url(mission),{waitUntil:'domcontentloaded',timeout:35000});
 await page.waitForTimeout(650);
}
async function pick(page,uuid,pattern){
 const group=page.locator('input[type="radio"][name="multiple_choice_'+uuid+'"]');
 let n=await group.count();
 if(!n) throw new Error('RADIO_GROUP_NOT_FOUND '+uuid+'; actual groups: '+JSON.stringify(await page.locator('input[type="radio"]').evaluateAll(es=>[...new Set(es.map(e=>e.name))])));
 let entries=[];
 for(let i=0;i<n;i++){
  entries.push(await group.nth(i).evaluate(e=>({label:document.querySelector('label[for="'+e.id+'"]')?.textContent?.replace(/\s+/g,' ').trim()||'',value:e.value})));
 }
 let index=entries.findIndex(e=>typeof pattern==='number'?false:clean(e.label).toUpperCase().includes(clean(pattern).toUpperCase()));
 if(typeof pattern==='number') index=pattern;
 if(index<0||index>=n)throw new Error('RADIO_CHOICE_NOT_FOUND '+uuid+' '+pattern+' choices='+JSON.stringify(entries));
 await group.nth(index).check({force:true,timeout:4500});
 await page.waitForTimeout(270);
 console.log('PICK '+JSON.stringify({uuid,pattern,index,chosen:entries[index].label}));
}
async function dropdown(page,choice){
 const inp=page.locator('input[role="combobox"][id="'+I.under24+'"]');
 if(!(await inp.count()))throw new Error('24H_DROPDOWN_NOT_FOUND');
 await inp.click({force:true,timeout:4000});
 await page.waitForTimeout(150);
 const opts=page.getByRole('option',{name:choice,exact:true});
 if(await opts.count()){await opts.first().click({timeout:3500});}
 else {
  const matching=page.getByText(choice,{exact:true});
  if(!(await matching.count()))throw new Error('24H_OPTION_NOT_FOUND '+choice+'; view='+JSON.stringify((await diagnostic(page,'dropdown-options-error')).body.slice(-2000)));
  await matching.last().click({timeout:3500,force:true});
 }
 await page.waitForTimeout(280);
 console.log('PICK_24H '+choice);
}
async function caseRun(browser,name,mission,run){
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'fr-FR',acceptDownloads:false});
 try{
  await open(page,mission);
  const actual=await run(page);
  results.push({name,status:'EXECUTED',...(actual||{})});
  console.log('CASE_EXECUTED '+JSON.stringify({name,...actual}));
 }catch(e){const err=String(e?.message||e).slice(0,800);results.push({name,status:'INCOMPLETE',error:err});console.log('CASE_INCOMPLETE '+JSON.stringify({name,error:err}));await page.screenshot({path:OUT+'/'+name+'-issue.png',fullPage:true}).catch(()=>{});}
 finally{await page.close()}
}

/**
 * Finite matrix of meaningful STOP states (rather than the full Cartesian
 * product, which would include logically inaccessible form branches).
 * Every test loads a fresh PUBLIC form. No submit is EVER clicked.
 */
async function runMatrix(browser){
  const missions=Object.keys(tariffs);
  const payVisible=d=>d.summary.button.some(x=>x.visible&&!x.disabled);
  async function assertCase(page,name,blocked,{legal=false,material=false}={}){
    const d=await diagnostic(page,'matrix-'+String(results.length).padStart(3,'0'));
    const pay=payVisible(d);
    const blockingMessage=legal?d.summary.stopLegal:material?d.summary.stopMaterial:true;
    const ok=(pay!==blocked)&&blockingMessage;
    const item={name,status:ok?'PASS':'FAIL',expectedBlocked:blocked,actualPaymentVisible:pay,expectedStopKind:legal?'legal':material?'material':'none',legalMessage:d.summary.stopLegal,materialMessage:d.summary.stopMaterial,total:d.total};
    results.push(item);
    console.log('MATRIX '+JSON.stringify(item));
  }
  for(let [mi,mission] of missions.entries()){
    // 3 legal-rights answers x 2 ways to get into a private space.
    for(const rights of [0,1,2]){
      for(const access of [0,1]){
        const name='LEGAL_'+mi+'_RIGHTS_'+rights+'_ACCESS_'+access;
        await caseRun(browser,name,mission,async page=>{
          if(mission==='RELAIS SIMPLE')await pick(page,I.operation,0);
          await pick(page,I.privateAccess,0);
          // On an accompanied access, select the access mode BEFORE rights.
          // This avoids Tally's re-render during the rights=OUI transition
          // intercepting an otherwise valid radio selection.
          if(access===0){
            await pick(page,I.alone,access);
            await pick(page,I.rights,rights);
          }else{
            await pick(page,I.rights,rights);
            await pick(page,I.alone,access);
            await pick(page,I.material,0);
          }
          const accessActuallySelected=await page.locator('input[type="radio"][name="multiple_choice_'+I.alone+'"]').nth(access).isChecked();
          if(!accessActuallySelected)throw new Error('ACCESS_CHOICE_LOST_AFTER_RIGHTS_CHANGE_'+rights+'_'+access); // locally usable code, isolate legal STOP
          const shouldBlock=rights!==0&&access===1;
          await assertCase(page,name,shouldBlock,{legal:shouldBlock});
        });
      }
    }
    // Rights are clear, access is autonomous: every access means.
    for (const means of [0,1,2,4]) {
      const name='MEANS_'+mi+'_CHOICE_'+means;
      await caseRun(browser,name,mission,async page=>{
        if(mission==='RELAIS SIMPLE')await pick(page,I.operation,0);
        await pick(page,I.privateAccess,0);
        await pick(page,I.rights,0);
        await pick(page,I.alone,1);
        await pick(page,I.material,means);
        await assertCase(page,name,means===4,{material:means===4});
      });
    }
    // Shipping from mainland: delay answers all three, all five missions.
    for (const delay of ['OUI','NON','JE NE SAIS PAS']){
      const name='SHIP_'+mi+'_DELAY_'+delay.replace(/\s+/g,'_');
      await caseRun(browser,name,mission,async page=>{
        if(mission==='RELAIS SIMPLE')await pick(page,I.operation,0);
        await pick(page,I.privateAccess,0);
        await pick(page,I.rights,0);
        await pick(page,I.alone,1);
        await pick(page,I.material,3);
        await dropdown(page,delay);
        await assertCase(page,name,delay!=='NON',{material:delay!=='NON'});
      });
    }
  }
  // REMETTRE without private access: available locally versus shipping / unknown.
  for(const availability of [0,1,2]){
    const delays=availability===0?[null]:['OUI','NON','JE NE SAIS PAS'];
    for(const delay of delays){
      const name='REMETTRE_NO_PRIVATE_AVAIL_'+availability+'_DELAY_'+String(delay);
      await caseRun(browser,name,'RELAIS SIMPLE',async page=>{
        await pick(page,I.operation,1);
        await pick(page,I.privateAccess,1);
        await pick(page,I.keysCorsica,availability);
        if(delay!==null)await dropdown(page,delay);
        const shouldBlock=availability!==0&&delay!=='NON';
        await assertCase(page,name,shouldBlock,{material:shouldBlock});
        // Plain key handover should never ask where to return same keys.
        const d=await page.evaluate(()=>document.body.innerText||'');
        const restitutionVisible=d.includes('Que devra faire RELAIS des clés, badges ou télécommandes à l’issue de la mission ?')||d.includes("Que devra faire RELAIS des clés, badges ou télécommandes à l'issue de la mission ?");
        results.push({name:name+'_NO_RESTITUTION',status:restitutionVisible?'FAIL':'PASS'});
      });
    }
  }
  // Changing access rights and access mode should immediately lift obsolete STOP.
  await caseRun(browser,'BACKTRACK_LEGAL','RELAIS SIMPLE',async page=>{
    await pick(page,I.operation,0);
    await pick(page,I.privateAccess,0);
    await pick(page,I.rights,2);
    await pick(page,I.alone,1);
    await pick(page,I.material,0);
    await assertCase(page,'BACKTRACK_UNKNOWN_ALONE',true,{legal:true});
    await pick(page,I.rights,0);
    await assertCase(page,'BACKTRACK_RIGHTS_NON',false);
    await pick(page,I.rights,1);
    await assertCase(page,'BACKTRACK_RIGHTS_OUI',true,{legal:true});
    await pick(page,I.alone,0);
    await assertCase(page,'BACKTRACK_ACCOMPANIED',false);
  });
  console.log('MATRIX_DONE scenarios='+results.filter(x=>x.name.startsWith('LEGAL_')||x.name.startsWith('MEANS_')||x.name.startsWith('SHIP_')||x.name.startsWith('REMETTRE_NO_PRIVATE_')||x.name.startsWith('BACKTRACK_')).length);
}

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(let [mission,expected] of Object.entries(tariffs)){
   await caseRun(browser,'TARIF-'+mission.replace(/[^a-zA-Z0-9]+/g,'-'),'RELAIS SIMPLE',async page=>{
    await open(page,mission);
    const d=await diagnostic(page,'tariff-'+Object.keys(tariffs).indexOf(mission));
    let pass=d.total.includes(expected+' € TTC');
    results.push({name:'PRICE_CHECK '+mission,status:pass?'PASS':'FAIL',expected,observed:d.total});
    return {expected,observed:d.total,check:pass?'PASS':'FAIL'};
   })
  }
  await caseRun(browser,'REMETTRE-CORSE','RELAIS SIMPLE',async page=>{
    await pick(page,I.operation,1); // B = REMETTRE
    let d=await diagnostic(page,'remettre-after-operation');
    await pick(page,I.privateAccess,1); // B = NON
    d=await diagnostic(page,'remettre-access-non');
    await pick(page,I.keysCorsica,1); // B = NON, keys on continent
    d=await diagnostic(page,'remettre-keys-continent');
    for(let x of ['OUI','JE NE SAIS PAS','NON']){
      await dropdown(page,x);
      const s=await diagnostic(page,'remettre-24h-'+x.replace(/\s/g,'-'));
      const payment=s.summary.button.some(b=>b.visible);
      let expectedBlock=x!=='NON';
      let pass=payment===!expectedBlock && (expectedBlock?s.summary.stopMaterial:!s.summary.stopMaterial);
      results.push({name:'REMETTRE 24h='+x,status:pass?'PASS':'FAIL',paymentVisible:payment,stopMaterial:s.summary.stopMaterial});
    }
    return {done:true};
  });
  await caseRun(browser,'RECUPERER-AUTONOME-STOP','RELAIS SIMPLE',async page=>{
    await pick(page,I.operation,0); // A = RECUPERER
    await pick(page,I.privateAccess,0); // A = OUI
    const before=await diagnostic(page,'recuperer-access-oui');
    await pick(page,I.rights,2); // C = JE NE SAIS PAS
    await pick(page,I.alone,1); // B = seul
    let d=await diagnostic(page,'juridical-unknown-autonome');
    let blocked=d.summary.stopLegal && !d.summary.button.some(b=>b.visible);
    results.push({name:'RIGHTS UNKNOWN + ALONE',status:blocked?'PASS':'FAIL',legal:d.summary.stopLegal,pay:d.summary.button});
    await pick(page,I.rights,1); // B = OUI
    d=await diagnostic(page,'juridical-yes-autonome');
    blocked=d.summary.stopLegal && !d.summary.button.some(b=>b.visible);
    results.push({name:'RIGHTS YES + ALONE',status:blocked?'PASS':'FAIL',legal:d.summary.stopLegal,pay:d.summary.button});
    await pick(page,I.alone,0); // accompanied -> unblock legal
    d=await diagnostic(page,'juridical-yes-accompanied');
    let clears=!d.summary.stopLegal && d.summary.button.some(b=>b.visible);
    results.push({name:'RIGHTS YES + ACCOMPANIED recovery',status:clears?'PASS':'FAIL',legal:d.summary.stopLegal,pay:d.summary.button});
    return {checked:true};
  });
  await caseRun(browser,'MATERIAL-NO-ACCESS','RELAIS SIMPLE',async page=>{
    await pick(page,I.operation,0);
    await pick(page,I.privateAccess,0);
    await pick(page,I.rights,0);
    await pick(page,I.alone,1);
    let pre=await diagnostic(page,'material-before');
    await pick(page,I.material,4); // E aucun moyen
    let d=await diagnostic(page,'material-none');
    const blocked=d.summary.stopMaterial&&!d.summary.button.some(x=>x.visible);
    results.push({name:'NO ACCESS MATERIAL STOP',status:blocked?'PASS':'FAIL',stop:d.summary.stopMaterial,pay:d.summary.button});
    return {blocked};
  });
  await runMatrix(browser);
 }finally{await browser.close()}
 fs.writeFileSync(OUT+'/REPORT.json',JSON.stringify(results,null,2));
 const sum={total:results.length,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,incomplete:results.filter(x=>x.status==='INCOMPLETE').length,executed:results.filter(x=>x.status==='EXECUTED').length};console.log('RESULT_SUMMARY '+JSON.stringify(sum));if(sum.fail||sum.incomplete)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
