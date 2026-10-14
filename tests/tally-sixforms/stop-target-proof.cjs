const {chromium}=require('playwright');const fs=require('fs');fs.mkdirSync('tally-stop-proof',{recursive:true});
async function clickOption(page,group,index){const l=page.locator('input[type=radio][name="multiple_choice_'+group+'"]');const n=await l.count();if(n<=index)throw Error('Missing option '+group+' '+index+' of '+n);await l.nth(index).check({force:true});await page.waitForTimeout(220);}
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const device of ['desktop','mobile']){
 const p=await b.newPage({viewport:device==='mobile'?{width:390,height:844}:{width:1360,height:900},locale:'fr-FR'});
 const u=new URL('https://tally.so/r/2EQWLD');Object.entries({mission:'REMISE CLÉ / BADGE B2B - 109 € HT',objet:'REMISE PONCTUELLE TEST SANS COMMANDE',creneau:'2026-10-31 10:00',tarif:'109 € HT',availability_mode:'normal',disponibilite:'normal',nom_client:'Audit',email_client:'audit@example.invalid',telephone_client:'0612345678'}).forEach(([k,v])=>u.searchParams.set(k,v));
 await p.goto(u.href,{waitUntil:'domcontentloaded'});await p.waitForTimeout(700);
 const g=await p.evaluate(()=>[...document.querySelectorAll('input[type=radio]')].reduce((a,z)=>(a[z.name]=(a[z.name]||0)+1,a),{}));console.log('RADIO_COUNTS '+JSON.stringify(g));
 try{
 // private access: select OUI by its option text, then rights NON, autonomous, no means
 const choose=async(textPart)=>{const lab=p.getByText(textPart,{exact:false}).first();await lab.click({force:true});await p.waitForTimeout(250);};
 await choose('Cette mission nécessite-t-elle que CYRNEA accède');
 await choose('OUI');
 await choose('NON');
 await choose('CYRNEA devra accéder seul');
 await choose("Aucun moyen d'accès disponible");
 }catch(e){console.log('INTERACTION_ERROR '+String(e));}
 const state=await p.evaluate(()=>{const t=document.body.innerText;return{
 stop:t.includes('ACCÈS IMPOSSIBLE'),legalHeadline:t.includes('Je certifie disposer du droit nécessaire pour commander cette mission'),obj:t.includes('Objet / consignes'),conditions:t.includes('Acceptation des conditions'),payment:t.includes('Paiement immédiat'),tail:t.slice(-1600)};});
 console.log('STOP_CASE '+JSON.stringify({device,...state}));await p.screenshot({path:'tally-stop-proof/b2b-'+device+'.png',fullPage:true}).catch(()=>{});await p.close();
 }
 const p=await b.newPage({viewport:{width:1360,height:900},locale:'fr-FR'});const u=new URL('https://tally.so/r/xXOqpk');Object.entries({mission:'RELAIS',objet:'Ouvrir avant votre arrivée',tarif:'169 € TTC',creneau:'2026-10-31 10:00',nom_client:'Audit',email_client:'audit@example.invalid',telephone_client:'0612345678'}).forEach(([k,v])=>u.searchParams.set(k,v));
 await p.goto(u.href,{waitUntil:'domcontentloaded'});await p.waitForTimeout(600);let txt=await p.locator('body').innerText();console.log('DATE_CASE '+JSON.stringify({date:'2026-10-31',retractQuestion:txt.includes('EXÉCUTION AVANT LA FIN DU DÉLAI DE RÉTRACTATION'),answers:['Je demande expressément','Je ne demande pas'].map(x=>txt.includes(x))}));await p.close();
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});