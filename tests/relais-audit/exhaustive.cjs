/**
 * CYRNEA RELAIS STANDARD — full finite decision-matrix browser verification.
 * SHARDED by mission index 0..4. Never click Submit/Pay, never transmit client data.
 * Every reachable case enumerates operation/private/access/rights/means/delay/return/retraction.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');
const SHARD=Number(process.env.SHARD||0);
const OUT='exhaustive-results/mission-'+SHARD;
fs.mkdirSync(OUT,{recursive:true});
const missions=[
  ['RELAIS SIMPLE',109],
  ['RELAIS',169],
  ['VOIR RELAIS',260],
  ['RELAIS - AVANT INTEMPÉRIE',169],
  ['RELAIS SIMPLE - APRÈS INTEMPÉRIE',109]
];
if(!(SHARD>=0&&SHARD<missions.length))throw Error('Invalid shard');
const [mission,price]=missions[SHARD];
const I={
 op:'944d3254-2839-4b34-a8b5-8d21638220b2',
 private:'d0718f8b-5491-4f9c-a3f3-3b8ffe72381d',
 actor:'00f0660b-4174-498d-a2b2-7bcc3cb071ec',
 rights:'f1dc6226-2cc8-4bc7-85af-4c8593711fbe',
 mode:'355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a',
 means:'a8032422-b3a0-49a8-b004-d430b08de1ae',
 keys:'2f16adb9-ec87-4b45-aee2-b7c09bd4f138',
 deadline:'265977a9-c01e-4482-bc4c-d34e705d915b',
 ret:'23bab2ac-8782-4dad-9133-e5aa5a797a0b',
 retract:'d236f8f2-a943-4f89-af8f-2a748d963da4'
};
const observations=[];
const progress={mission,shard:SHARD,planned:0,executed:0,pass:0,fail:0,incomplete:0,errorKinds:{},examples:[]};
function cases(){
  const plans=[];
  const ops=SHARD===0?[0,1,2]:[null];
  const retr=[0,1];
  for(const op of ops)for(const priv of [0,1]){
    const actorChoices=priv===0?[0,1]:[null];
    for(const actor of actorChoices){
      const rightChoices=priv===0?[0,1,2]:[null];
      for(const rights of rightChoices){
        const modeChoices=priv===0?[0,1]:[null];
        for(const mode of modeChoices){
          const meansChoices=(priv===0&&mode===1)?[0,1,2,3,4]:[null];
          for(const means of meansChoices){
            const keyChoices=(SHARD===0&&op===1&&priv===1)?[0,1,2]:[null];
            for(const key of keyChoices){
              const needsDelay=(means===3)||(key===1||key===2);
              const delays=needsDelay?[0,1,2]:[null];
              for(const delay of delays){
                const returns=SHARD===0&&op===0?[0,1,2,3]:[null];
                for(const ret of returns)for(const retract of retr){
                  plans.push({op,priv,actor,rights,mode,means,key,delay,ret,retract});
                }
              }
            }
          }
        }
      }
    }
  }
  return plans;
}
const plans=cases();
progress.planned=plans.length;
fs.writeFileSync(OUT+'/cases.json',JSON.stringify(plans,null,2));
console.log('PLAN '+JSON.stringify({mission,planned:plans.length}));
const url=new URL('https://tally.so/r/xXOqpk');
Object.entries({mission,objet:'AUDIT TECHNIQUE AUCUNE COMMANDE',tarif:price+' € TTC',
  creneau:'2026-10-15 10:00',nom_client:'Audit Technique',
  email_client:'audit@example.invalid',telephone_client:'0612345678',
  cadre_client:'PROPRIÉTAIRE PARTICULIER',availability_mode:'standard'}).forEach(([k,v])=>url.searchParams.set(k,v));
function pushIssue(arr,kind,extra){arr.push({kind,detail:extra});}
async function select(page,id,n){
 const selector='input[type="radio"][name="multiple_choice_'+id+'"]';
 const group=page.locator(selector);
 const count=await group.count();
 if(n>=count)throw new Error('FIELD_MISSING '+id+' index='+n+' count='+count);
 const el=group.nth(n);
 await el.check({force:true,timeout:4500});
 if(!(await el.isChecked()))throw new Error('FIELD_SELECTION_DID_NOT_STICK '+id+' index='+n);
}
async function selectDeadline(page,n){
 const el=page.locator('input[role="combobox"][id="'+I.deadline+'"]');
 if(!(await el.count()))throw Error('DEADLINE_INPUT_MISSING');
 await el.click({force:true,timeout:3000});
 const choice=['OUI','NON','JE NE SAIS PAS'][n];
 const opt=page.getByRole('option',{name:choice,exact:true});
 if(await opt.count())await opt.first().click({force:true,timeout:3000});
 else {
   const x=page.getByText(choice,{exact:true});
   if(!(await x.count()))throw Error('DEADLINE_CHOICE_MISSING '+choice);
   await x.last().click({force:true,timeout:3000});
 }
}
async function observe(page,plan){
 return await page.evaluate(({I,plan,price})=>{
  const vis=e=>{if(!e)return false;const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0};
  const t=document.body.innerText||'';
  const btn=[...document.querySelectorAll('button')].find(e=>e.innerText.includes('COMMANDER ET PAYER'));
  const deadline=document.querySelector('input[id="'+I.deadline+'"]');
  const title=t.includes('Votre mission est-elle prévue dans moins de 24 heures ?');
  const radio=id=>[...document.querySelectorAll('input[name="multiple_choice_'+id+'"]')].filter(vis).map(e=>({checked:e.checked,required:e.required,label:document.querySelector('label[for="'+e.id+'"]')?.textContent?.replace(/\s+/g,' ').trim().slice(0,100)}));
  const phone=document.querySelector('input[type=tel]');
  const cgvs=[...document.querySelectorAll('a')].filter(vis).map(a=>a.href).filter(x=>x.includes('cgv'));
  return {pay:!!btn&&vis(btn),total:t.match(/Total à régler[^\n]*/)?.[0]||'',
   legal:t.includes('ACCÈS AUTONOME IMPOSSIBLE'),
   material:t.includes('La disponibilité des clés ne permet pas de confirmer')||t.includes("Aucun moyen d'accès n'est actuellement disponible pour réaliser votre mission")||t.includes("L'accès nécessaire à votre mission ne peut pas être organisé"),
   deadlineTitle:title,deadlineVisible:vis(deadline),
   ghost:vis(deadline)&&!title,
   poste:t.includes('Vous pourrez expédier vos clés depuis le continent'),
   returnVisible:radio(I.ret).length>0,
   opVisible:radio(I.op).length>0,
   keysVisible:radio(I.keys).length>0,
   actorVisible:radio(I.actor).length>0,
   rightsVisible:radio(I.rights).length>0,
   modeVisible:radio(I.mode).length>0,
   meansVisible:radio(I.means).length>0,
   retract:radio(I.retract),
   acceptedCgvLink:cgvs.some(x=>x.includes('relais-cgv-v16-2026-10-05.pdf')),
   requiredCheckboxes:[...document.querySelectorAll('input[type=checkbox]')].filter(vis).map(x=>x.required),
   phone:phone?{value:phone.value,required:phone.required}:null,
   horizScroll:document.documentElement.scrollWidth>innerWidth+2,
   stopTexts:t.split('\n').filter(x=>/IMPOSSIBLE|NE PEUT PAS|NE PERMET PAS/i.test(x)).slice(0,15)
  };
 },{I,plan,price});
}
async function runCase(browser,plan,i){
 const page=await browser.newPage({viewport:i%2===0?{width:390,height:844}:{width:1440,height:900},locale:'fr-FR',acceptDownloads:false});
 const errs=[];
 try{
  const res=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000});
  if(res.status()!==200)throw Error('HTTP_'+res.status());
  if(plan.op!==null)await select(page,I.op,plan.op);
  await select(page,I.private,plan.priv);
  if(plan.priv===0){
    if(plan.actor!==null)await select(page,I.actor,plan.actor);
    // Accompanied first where rights=OUI to avoid React re-render radio race
    if(plan.mode===0){
      await select(page,I.mode,plan.mode);
      await select(page,I.rights,plan.rights);
    }else{
      await select(page,I.rights,plan.rights);
      await select(page,I.mode,plan.mode);
      if(plan.means!==null)await select(page,I.means,plan.means);
    }
  }
  if(plan.key!==null)await select(page,I.keys,plan.key);
  if(plan.delay!==null)await selectDeadline(page,plan.delay);
  if(plan.ret!==null)await select(page,I.ret,plan.ret);
  await select(page,I.retract,plan.retract);
  await page.waitForTimeout(60);
  const d=await observe(page,plan);
  const expectedLegal=plan.priv===0&&plan.mode===1&&plan.rights!==0;
  const expectedMaterial=(plan.means===4)||(plan.means===3&&plan.delay!==1)||((plan.op===1&&plan.priv===1&&plan.key!==0)&&plan.delay!==1);
  const expectedBlocked=expectedLegal||expectedMaterial;
  if(d.pay===expectedBlocked)pushIssue(errs,'PAYMENT_GATE',{expectedBlocked,paymentShown:d.pay,legal:expectedLegal,material:expectedMaterial});
  if(d.total.includes(price+' € TTC')===expectedBlocked)pushIssue(errs,'TOTAL_GATE',{expectedBlocked,total:d.total});
  if(d.legal!==expectedLegal)pushIssue(errs,'LEGAL_STOP',{expectedLegal,observed:d.legal});
  // Material message may not show on all branches with other simultaneous legal stop.
  if(!expectedLegal&&d.material!==expectedMaterial)pushIssue(errs,'MATERIAL_STOP',{expectedMaterial,observed:d.material});
  if(d.ghost)pushIssue(errs,'UNLABELLED_DEADLINE','24-hour dropdown shown without its question');
  const expectedDeadline=plan.delay!==null;
  if(expectedDeadline&&!(d.deadlineVisible&&d.deadlineTitle))pushIssue(errs,'MISSING_DEADLINE_QUESTION',{got:d.deadlineVisible,title:d.deadlineTitle});
  if(!expectedDeadline&&d.deadlineTitle)pushIssue(errs,'UNEXPECTED_DEADLINE_QUESTION','Deadline question visible without continent shipping');
  const expectedPoste=(plan.means===3)||(plan.op===1&&plan.priv===1&&plan.key===1);
  if(d.poste!==expectedPoste)pushIssue(errs,'LA_POSTE_VISIBILITY',{expectedPoste,observed:d.poste});
  if(plan.op===1&&d.returnVisible)pushIssue(errs,'RETURN_FOR_REMETTRE','restitution visible after REMETTRE');
  if(plan.op===0&&!d.returnVisible)pushIssue(errs,'RETURN_MISSING_RECUPERER','restitution choices absent after RECUPERER');
  if(plan.op!==null&&!d.opVisible)pushIssue(errs,'OPERATION_MISSING',plan.op);
  if(plan.key===null&&d.keysVisible)pushIssue(errs,'IRRELEVANT_CORSICA_KEYS','key availability visible in unrelated branch');
  if(plan.means===null&&d.meansVisible)pushIssue(errs,'IRRELEVANT_ACCESS_METHOD','autonomous means question visible without autonomy');
  if(plan.priv===1&&(d.rightsVisible||d.actorVisible||d.modeVisible))pushIssue(errs,'IRRELEVANT_LEGAL_ACCESS','legal private-access questions visible without private entry');
  if(!d.acceptedCgvLink)pushIssue(errs,'CGV_V16_MISSING','PDF not present');
  if(d.retract.length!==2||!d.retract.some(x=>x.checked))pushIssue(errs,'RETRACTION_MISSING','expected choice not selected');
  if(d.requiredCheckboxes.length<2||d.requiredCheckboxes.some(v=>!v))pushIssue(errs,'REQUIRED_CONSENT','missing mandatory consent');
  if(!d.phone?.required)pushIssue(errs,'PHONE_NOT_REQUIRED','phone required missing');
  if(d.horizScroll)pushIssue(errs,'HORIZONTAL_OVERFLOW','layout exceeds viewport width');
  const record={i,plan,problems:errs,observed:{payment:d.pay,total:d.total,legal:d.legal,material:d.material,ghost:d.ghost,poste:d.poste,phone:d.phone}};
  observations.push(record);
  progress.executed++;
  if(!errs.length)progress.pass++;else{
    progress.fail++;
    for(const x of errs)progress.errorKinds[x.kind]=(progress.errorKinds[x.kind]||0)+1;
    if(progress.examples.length<25){progress.examples.push(record);if(progress.examples.length<4)await page.screenshot({path:OUT+'/failure-'+i+'.png',fullPage:true})}
  }
  if(progress.executed%50===0)console.log('PROGRESS '+JSON.stringify({mission,executed:progress.executed,planned:progress.planned,failed:progress.fail,kinds:progress.errorKinds}));
 }catch(e){
  progress.incomplete++;
  let msg=String(e.message||e).slice(0,450);
  progress.errorKinds['INCOMPLETE_'+msg.split(' ')[0]]=(progress.errorKinds['INCOMPLETE_'+msg.split(' ')[0]]||0)+1;
  if(progress.examples.length<25)progress.examples.push({i,plan,error:msg});
 }finally{
  await page.close().catch(()=>{});
 }
}
async function pool(browser,count=5){
 let next=0;
 await Promise.all(Array.from({length:count},async()=>{
  while(next<plans.length){
   const i=next++;
   await runCase(browser,plans[i],i);
  }
 }));
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{await pool(browser,6)}finally{await browser.close()}
 fs.writeFileSync(OUT+'/results.json',JSON.stringify({progress,observations},null,2));
 console.log('FINAL '+JSON.stringify(progress));
 if(progress.incomplete||progress.fail)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
