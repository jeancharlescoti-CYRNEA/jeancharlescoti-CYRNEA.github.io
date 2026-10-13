'use strict';
const {chromium}=require('playwright');
const phoneUuid='cdf940ce-e80d-459e-b5ef-e8aacdd871ec';
const variants=[
 {label:'no_phone',value:null},
 {label:'national_06',value:'0612345678'},
 {label:'international_plus33',value:'+33612345678'},
 {label:'actual_pwa_formatted',value:'+33 6 12 34 56 78'},
 {label:'international_0033',value:'0033612345678'},
 {label:'national_without_zero',value:'612345678'}
];
function link(value){
 const u=new URL('https://tally.so/r/xXOqpk');
 for(const [k,v] of Object.entries({mission:'RELAIS SIMPLE',objet:'AUDIT TECHNIQUE SANS SOUMISSION',tarif:'109 € TTC',creneau:'2026-10-15 10:00',nom_client:'Audit',email_client:'audit@example.invalid',cadre_client:'PROPRIÉTAIRE PARTICULIER',availability_mode:'standard'}))u.searchParams.set(k,v);
 if(value!==null)u.searchParams.set('telephone_client',value);
 return u.toString();
}
async function inspect(page){
 return await page.evaluate(id=>{
 const e=document.querySelector('input[type=tel][id="'+id+'"]');
 if(!e)return {error:'NO_PHONE_INPUT'};
 return {value:e.value,valid:e.checkValidity(),validationMessage:e.validationMessage,role:e.getAttribute('role'),required:e.required,
  selectedCountry:document.querySelector('[aria-label="Pays"]')?.textContent?.trim().slice(0,150)||null,
  nearText:e.closest('div[data-sentry-component="InputPhoneNumber"]')?.parentElement?.innerText?.slice(0,150)||null,
  telInputHTML:e.outerHTML.slice(0,450)};
 },phoneUuid);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const screen of [{name:'iphone',width:390,height:844},{name:'desktop',width:1440,height:900}]){
   for(const v of variants){
    const p=await browser.newPage({viewport:{width:screen.width,height:screen.height},locale:'fr-FR'});
    try{
     const response=await p.goto(link(v.value),{waitUntil:'domcontentloaded',timeout:35000});
     await p.waitForTimeout(350);
     const result=await inspect(p);
     console.log('PHONE_PREFILL '+JSON.stringify({screen:screen.name,variant:v.label,input:v.value,status:response.status(),...result}));
     if(v.value===null){
       const t=p.locator('input[type=tel][id="'+phoneUuid+'"]');
       for(const input of ['0612345678','612345678','+33612345678']){
        await t.fill(input);await p.waitForTimeout(110);
        console.log('PHONE_ENTRY '+JSON.stringify({screen:screen.name,input,...await inspect(p)}));
       }
     }
    }catch(err){console.log('PHONE_ERROR '+JSON.stringify({screen:screen.name,variant:v.label,error:String(err).slice(0,500)}));process.exitCode=1}
    finally{await p.close()}
   }
  }
 }finally{await browser.close()}
})().catch(err=>{console.log('PHONE_FATAL '+String(err));process.exitCode=1});

// Tally client phone field: no real submissions.
