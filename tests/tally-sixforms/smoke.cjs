const {chromium}=require('playwright');
const fs=require('node:fs');
const data=[{"id":"xXOqpk","private":{"id":"d0718f8b-5491-4f9c-a3f3-3b8ffe72381d","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"a8032422-b3a0-49a8-b004-d430b08de1ae","shipping":3,"title":"Comment RELAIS disposera-t-il du moyen d'accès néces"},"mission":"RELAIS","tarif":"169 € TTC"},{"id":"b5oz46","private":{"id":"91991da6-3cc7-4c9d-b6d6-42c5808c979e","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"5f36821e-5862-4ecd-a4c8-f6285fb7bcee","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"8f5a4d5b-cacc-4cf8-9a51-424e62fbcb15","shipping":3,"title":"Moyen d'accès autonome (si RELAIS accède seul)"},"mission":"RELAIS","tarif":"169 € TTC"},{"id":"7R6AZa","private":{"id":"788e1163-a31c-4157-8283-834f13a442e9","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"7cd89c01-ccf9-4dce-b296-ba26af96c115","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"91885677-3808-4d39-9427-3a052958d1e5","shipping":3,"title":"Comment PRÉSENCE pourra-t-il accéder aux lieux ?"},"mission":"VOIR PRÉSENCE","tarif":"260 € TTC"},{"id":"GxZbE2","private":{"id":"d589f65b-8ed3-4ff7-9686-a9f1b8f3a1d4","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"9774f911-3f9d-4cfc-913d-3f361e555c1a","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"a17a4014-8373-4658-98ce-47aba6fcf82e","shipping":3,"title":"Comment PRÉSENCE pourra-t-il accéder aux lieux ?"},"mission":"VOIR PRÉSENCE","tarif":"260 € TTC"},{"id":"2EQWLD","private":{"id":"aab8de66-6253-4ba8-94a5-195495c9d98b","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"b88d4644-2ffc-4fea-8de9-0fa0a600bdf4","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"be55bf77-26ed-4d5e-a764-93918a094bbc","shipping":3,"title":"Comment PRÉSENCE disposera-t-il du moyen d'accès néc"},"mission":"VISITE TERRAIN PILOTÉE - 350 € HT","tarif":"350 € HT"},{"id":"RGp0PQ","private":{"id":"01ce0597-de08-4f54-92e9-4d88b365b113","yes":0,"title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé"},"access":{"id":"b42207f4-da4c-42aa-9ca4-57e110f55ac4","alone":1,"title":"Comment CYRNEA accédera-t-il aux lieux ?"},"means":{"id":"da27a319-ad13-48d0-9db1-0384f66f68ba","shipping":3,"title":"Comment PRÉSENCE disposera-t-il du moyen d'accès néc"},"mission":"VISITE TERRAIN PILOTÉE - 350 € HT","tarif":"350 € HT"}];
const OUT='tally-audit-results';
fs.mkdirSync(OUT,{recursive:true});
const all=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function inspect(browser,f,device){
  const page=await browser.newPage({viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:900},locale:'fr-FR',acceptDownloads:false});
  const checks=[];let phase='opening';
  function add(name,ok,detail){checks.push({name,status:ok?'PASS':'FAIL',detail});}
  const report=async()=>({id:f.id,device,phase,checks});
  async function pick(x,n){let loc=page.locator('input[type="radio"][name="multiple_choice_'+x+'"]');let count=await loc.count();if(count<=n||n<0)throw Error('CHOICE_MISSING '+x+': '+n+'/'+count);const input=loc.nth(n);let last='';for(let attempt=0;attempt<3;attempt++){try{let id=await input.getAttribute('id');let label=id?page.locator('label[for="'+id+'"]'):null;if(label&&await label.count())await label.first().evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));else await input.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await sleep(250);await input.check({force:true,timeout:4500});await sleep(200);if(await input.isChecked())return;}catch(e){last=String(e).slice(0,260);}await sleep(350);}throw Error('RADIO_NOT_SELECTED_AFTER_SCROLL '+x+': '+n+' attempts=3 '+last);}
  try{
    const url=new URL('https://tally.so/r/'+f.id);
    Object.entries({mission:f.mission,objet:'AUDIT SANS COMMANDE',tarif:f.tarif,creneau:'2026-10-31 10:00',availability_mode:'normal',disponibilite:'normal',nom_client:'Audit Technique',email_client:'audit@example.invalid',telephone_client:'0612345678'}).forEach(([k,v])=>url.searchParams.set(k,v));
    const res=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:35000}); await sleep(950);
    add('PUBLIC_HTTP_200',res&&res.status()===200,res?.status());
    const visible=async text=>page.evaluate(t=>(document.body.innerText||'').includes(t),text);
    add('ACCESS_QUESTION_PRESENT',await visible(f.private.title.slice(0,45)),f.private.title);
    add('PHONE_REQUIRED',await page.locator('input[type=tel][required]').count()===1,'1 champ téléphone obligatoire attendu');
    phase='private_yes';
    await pick(f.private.id,f.private.yes);
    add('PRIVATE_ACCESS_CHOICES',await visible(f.access.title.slice(0,42)),f.access.title);
    phase='autonomous_access';
    await pick(f.access.id,f.access.alone);
    add('KEY_MEANS_VISIBLE',await visible(f.means.title.slice(0,38)),f.means.title);
    phase='postal_shipping';
    await pick(f.means.id,f.means.shipping);
    const state=await page.evaluate(()=>{
      const t=document.body.innerText||'';
      const a=[...document.querySelectorAll('a')].map(x=>x.href).filter(x=>x.includes('laposte.fr'));
      return {postalText:/La Poste|Envoyer mes clés|laposte.fr/i.test(t),postalLinks:a,availabilityText:/clés.*disponibles|clés.*mise|disponibles en Corse/i.test(t),paymentVisible:[...document.querySelectorAll('button')].some(b=>(b.innerText||'').includes('COMMANDER ET PAYER')&&b.getBoundingClientRect().width>0)};
    });
    add('POSTAL_GUIDE_VISIBLE',state.postalText,state.postalLinks.length?'link '+state.postalLinks[0]:'postal text missing');
    add('KEYS_AVAILABILITY_QUESTION',state.availabilityText,'Disponibilité des clés avant le rendez-vous');
    add('NO_AUTOSUBMISSION',true,'Aucune soumission ni paiement dans le script');
    let failing=checks.some(c=>c.status==='FAIL');if(failing)await page.screenshot({path:OUT+'/'+f.id+'-'+device+'.png',fullPage:true}).catch(()=>{});
  }catch(e){add('SCRIPT_COMPLETION',false,String(e).slice(0,380));await page.screenshot({path:OUT+'/'+f.id+'-'+device+'-error.png',fullPage:true}).catch(()=>{});}
  finally{await page.close();}
  return report();
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{for(const f of data)for(const dev of ['desktop','mobile']){const x=await inspect(browser,f,dev);all.push(x);console.log('SCENARIO '+JSON.stringify(x));}}
  finally{await browser.close();}
  const total=all.reduce((a,x)=>a+x.checks.length,0),failed=all.flatMap(x=>x.checks).filter(x=>x.status==='FAIL').length;
  fs.writeFileSync(OUT+'/report.json',JSON.stringify({total,failed,scenarios:all},null,2));
  console.log('FINAL '+JSON.stringify({scenarios:all.length,total,failed}));
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
