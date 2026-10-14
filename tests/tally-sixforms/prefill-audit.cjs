// Exact PWA mission aliases; diagnostic never submits or pays.
const {chromium}=require('playwright');
const fs=require('fs');
const CASES=[
{id:'b5oz46',mission:'VOIR PRIORITAIRE RELAIS',mode:'priority',expected:350,note:'PWA RELAIS PRIORITÉ'},
{id:'b5oz46',mission:'VOIR RELAIS',mode:'priority',expected:350,note:'TALLY RELAIS PRIORITÉ direct'},
{id:'b5oz46',mission:'VOIR RELAIS',mode:'evening',expected:350,note:'RELAIS VOIR SOIR VALIDÉ'},
{id:'xXOqpk',mission:'RELAIS - AVANT INTEMPÉRIE',mode:'standard',expected:169,note:'PWA STANDARD MÉTÉO'},
{id:'xXOqpk',mission:'RELAIS SIMPLE - APRÈS INTEMPÉRIE',mode:'standard',expected:109,note:'PWA STANDARD APRÈS'},
{id:'2EQWLD',mission:'CONTINUITÉ PROJET - 1190 € HT',mode:'standard',expected:1428,note:'PWA B2B STANDARD CONTINUITÉ'},
{id:'RGp0PQ',mission:'CONTINUITÉ PROJET - 1 190 € HT',mode:'priority',expected:1572,note:'PWA B2B HORS CONTINUITÉ'},
{id:'GxZbE2',mission:'VOIR PRIORITAIRE',mode:'priority',expected:350,note:'PWA PRÉSENCE PRIORITÉ'},
{id:'GxZbE2',mission:'SUIVRE',mode:'priority',expected:1160,note:'PWA SUIVRE 2 passages sous 24h attend 980+90+90 TTC'},
{id:'RGp0PQ',mission:'CONTINUITÉ PROJET - 1 190 € HT',mode:'priority',expected:1716,note:'PWA CONTINUITÉ 2 jalons prioritaires attend (1190+120+120)*1.2 TTC'}
];
const out=[];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const c of CASES){
   const page=await browser.newPage({viewport:{width:1440,height:900},locale:'fr-FR'});
   try{
    const u=new URL('https://tally.so/r/'+c.id);
    for(const [k,v] of Object.entries({mission:c.mission,objet:'AUDIT TECHNIQUE SANS COMMANDE',tarif:c.expected+' € TTC',creneau:'2026-10-24 10:00',availability_mode:c.mode,disponibilite:c.mode,nom_client:'Audit',email_client:'audit@example.invalid',telephone_client:'0612345678',reference_temporaire:'AUDIT-NE-PAS-PAYER'}))u.searchParams.set(k,v);
    const resp=await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:35000});await page.waitForTimeout(800);
    const data=await page.evaluate(()=>{let text=document.body.innerText||'';let lines=text.split('\n').map(z=>z.trim()).filter(Boolean);
      return {summary:lines.filter(z=>/Total TTC|Total à régler|Tarif TTC|Total HT|TVA 20%/i.test(z)).slice(0,6),
        missionCombo:[...document.querySelectorAll('input[role=combobox]')].map(z=>({id:z.id,value:z.value,aria:z.getAttribute('aria-labelledby')})),
        missionInput:[...document.querySelectorAll('input')].filter(z=>/mission/i.test(z.name||'')).map(z=>({name:z.name,value:z.value})),
        errors:lines.filter(z=>/impossible|aucun moyen|non disponible|refus|pas propos/i.test(z)).slice(0,5),
        button:[...document.querySelectorAll('button')].filter(z=>/COMMANDER ET PAYER/.test(z.innerText||'')).map(z=>({visible:z.getBoundingClientRect().height>0,disabled:z.disabled}))};});
    const result={...c,http:resp.status(),...data};
    out.push(result);console.log('PREFILL_CASE '+JSON.stringify(result));
   }catch(e){out.push({...c,error:String(e).slice(0,250)});console.log('PREFILL_CASE_ERROR '+JSON.stringify(out.at(-1)))}
   finally{await page.close()}
  }
 }finally{await browser.close()}
 fs.mkdirSync('tally-prefill-audit',{recursive:true});fs.writeFileSync('tally-prefill-audit/report.json',JSON.stringify(out,null,2));
 console.log('PREFILL_FINAL '+JSON.stringify({cases:out.length,errors:out.filter(x=>x.error).length}));
})().catch(e=>{console.error(e);process.exitCode=0});
