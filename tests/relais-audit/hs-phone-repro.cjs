'use strict';
const {chromium}=require('playwright');
const variants=[
  ['sans-preremplissage',null],
  ['numero-francais-10-chiffres','0612345678'],
  ['format-pwa-33','+33 6 12 34 56 78'],
  ['numero-malforme-long','061111111111111111']
];
(async()=>{
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for (const form of [{id:'b5oz46',name:'RELAIS_HORS_STANDARD'},{id:'xXOqpk',name:'RELAIS_STANDARD'}]){
   for(const [label,value] of variants){
    const p=await b.newPage({viewport:{width:390,height:844},locale:'fr-FR'});
    try{
     const u=new URL('https://tally.so/r/'+form.id);
     for(const [k,v] of Object.entries({mission:'RELAIS SIMPLE',objet:'AUDIT TECHNIQUE SANS COMMANDE',tarif:form.id==='b5oz46'?'149 € TTC':'109 € TTC',creneau:'2026-10-15 10:00'}))u.searchParams.set(k,v);
     if(value!==null)u.searchParams.set('telephone_client',value);
     const r=await p.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:30000});
     await p.waitForTimeout(360);
     const d=await p.evaluate(()=>{
      const e=document.querySelector('input[type=tel]');
      const text=document.body.innerText||'';
      return {phone:e?.value,htmlValid:e?.checkValidity(),htmlValidationMessage:e?.validationMessage,
       ariaInvalid:e?.getAttribute('aria-invalid'),required:e?.required,
       phoneLabel:text.includes('Téléphone'),phoneHelp:text.includes('France (+33 déjà affiché)'),
       ghost:!!document.querySelector('input[aria-label="Untitled dropdown field"]'),
       price:text.match(/Tarif[^\n]*/)?.[0]||'',urlPath:location.pathname};
     });
     console.log('HS_PHONE_TEST '+JSON.stringify({form:form.name,label,sourceValue:value,http:r.status(),...d}));
    }catch(err){console.log('HS_PHONE_TEST_ERROR '+JSON.stringify({form:form.name,label,error:String(err).slice(0,350)}));process.exitCode=1}
    finally{await p.close()}
   }
  }
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
