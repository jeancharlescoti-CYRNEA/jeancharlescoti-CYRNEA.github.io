const {chromium}=require('playwright'),fs=require('fs');
const all=[{"id":"xXOqpk","tax":"TTC","priceMode":"standard","missions":[["RELAIS SIMPLE",109],["RELAIS",169],["AVANT INTEMPÉRIE",169],["APRÈS INTEMPÉRIE — VÉRIFICATION PRATIQUE",109],["VOIR RELAIS",260]]},{"id":"b5oz46","tax":"TTC","priceMode":"hors","missions":[["RELAIS SIMPLE",109],["RELAIS",169],["RELAIS - AVANT INTEMPÉRIE",169],["RELAIS SIMPLE - APRÈS INTEMPÉRIE",109],["VOIR RELAIS",260]]},{"id":"7R6AZa","tax":"TTC","priceMode":"standard","missions":[["VOIR PRÉSENCE",260],["DÉCIDER",480],["SUIVRE",980]]},{"id":"GxZbE2","tax":"TTC","priceMode":"hors-pres","missions":[["VOIR PRÉSENCE",260],["VOIR PRIORITAIRE",350],["DÉCIDER",480],["SUIVRE",980]]},{"id":"2EQWLD","tax":"HT","priceMode":"standard","missions":[["VISITE TERRAIN PILOTÉE - 350 € HT",350],["PRÉSENCE PROJET - 490 € HT",490],["PRÉSENCE PROJET ÉTENDUE - 690 € HT",690],["CONTINUITÉ PROJET - 1 190 € HT",1190],["ACCÈS B2B - 109 € HT",109],["REMISE CLÉ / BADGE B2B - 109 € HT",109],["RÉCUPÉRATION CLÉ / BADGE B2B - 109 € HT",109],["PRÉSENCE LOGISTIQUE B2B - 169 € HT",169]]},{"id":"RGp0PQ","tax":"HT","priceMode":"hors-b2b","missions":[["VISITE TERRAIN PILOTÉE - 350 € HT",350],["PRÉSENCE PROJET - 490 € HT",490],["PRÉSENCE PROJET ÉTENDUE - 690 € HT",690],["CONTINUITÉ PROJET - 1 190 € HT",1190],["ACCÈS B2B - 109 € HT",109],["REMISE CLÉ / BADGE B2B - 109 € HT",109],["RÉCUPÉRATION CLÉ / BADGE B2B - 109 € HT",109],["PRÉSENCE LOGISTIQUE B2B - 169 € HT",169]]}], f=all[Number(process.env.FORM_INDEX)];
if(!f)throw Error('Invalid form');
const out='tally-prices-results/'+f.id;fs.mkdirSync(out,{recursive:true});
function target(m,base,mode){
 if(mode==='normal')return {price:base,blocked:false};
 if(f.priceMode==='standard')return null;
 if(f.priceMode==='hors'){
  if(m==='VOIR RELAIS'){
   if(mode==='evening')return {blocked:true,price:260};
   return {price:base+(mode==='priority'?90:120),blocked:false};
  }
  return {price:base+(mode==='sunday'?60:40),blocked:false};
 }
 if(f.priceMode==='hors-pres'){
  if(m==='VOIR PRIORITAIRE')return {price:350,blocked:false};
  return {price:base+(mode==='sunday'?120:90),blocked:false};
 }
 if(f.priceMode==='hors-b2b'){
  let core=/VISITE TERRAIN|PRÉSENCE PROJET|CONTINUITÉ PROJET/.test(m);
  if((mode==='evening'||mode==='night')&&(!core||/VISITE TERRAIN/.test(m)))return {price:base,blocked:true};
  return {price:base+(core?(mode==='night'?180:mode==='sunday'?180:120):(mode==='sunday'?60:40)),blocked:false};
 }
 return null;
}
function parseTotal(x){
 let lines=x.split('\n').map(z=>z.trim()).filter(Boolean),i=lines.findIndex(z=>/Total à régler|Total TTC|Tarif TTC/i.test(z));
 if(i<0)return {num:null,raw:''};
 let raw=lines[i]+' '+(lines[i+1]||''); 
 let after=raw.replace(/.*?(?:Total à régler|Total TTC|Tarif TTC)\s*:?/i,'').replace(/€|TTC/gi,' ').trim();
 let nums=after.match(/\d[\d\u00a0\u202f\s]*([.,]\d{1,2})?/g)||[];
 return {num:nums.length?Number(nums[0].replace(/[\s\u00a0\u202f]/g,'').replace(',','.')):null,raw:lines[i]};
}
let result=[];
async function run(browser,m,base,mode,dev){
 let p=await browser.newPage({locale:'fr-FR',viewport:dev==='mobile'?{width:390,height:844}:{width:1440,height:900},acceptDownloads:false});
 let e=target(m,base,mode),rec={id:f.id,m,mode,dev,expected:e,pass:false};
 try{
  const u=new URL('https://tally.so/r/'+f.id);
  for(let [k,v] of Object.entries({mission:m,objet:'AUDIT TARIF SANS COMMANDE',tarif:(f.tax==='TTC'?base+' € TTC':base+' € HT'),creneau:'2026-10-31 10:00',availability_mode:mode,disponibilite:mode,nom_client:'Audit Technique',email_client:'audit@example.invalid',telephone_client:'0612345678'}))u.searchParams.set(k,v);
  let q=await p.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:35000});await p.waitForTimeout(720);
  let info=await p.evaluate(()=>{
   const t=document.body.innerText||'';
   return{t,missionShown:t.includes('Mission choisie'),emailRequired:!!document.querySelector('input[type=email][required]'),phoneRequired:!!document.querySelector('input[type=tel][required]'),nameRequired:!!document.querySelector('input[type=text][required]'),submit:[...document.querySelectorAll('button')].some(z=>/COMMANDER ET PAYER/i.test(z.textContent)&&z.getBoundingClientRect().height>0)};
  });
  let total=parseTotal(info.t),expected=f.tax==='HT'?e.price*1.2:e.price;
  rec={...rec,http:q?.status(),observed:total,expectedTtc:expected,coordinates:info.emailRequired&&info.phoneRequired&&info.nameRequired,submit:info.submit};
  const close=total.num!==null&&Math.abs(expected-total.num)<0.025;
  rec.pass=q?.status()===200&&close&&rec.coordinates&&(e.blocked?!info.submit:true);
  if(!rec.pass){rec.textLines=info.t.split('\n').filter(x=>/Total|Tarif|TVA|STOP|IMPOSSIBLE/i.test(x)).slice(0,12);await p.screenshot({path:out+'/'+result.length+'-'+dev+'.png',fullPage:true}).catch(()=>{});}
 }catch(err){rec.error=String(err).slice(0,260)}
 result.push(rec);console.log('PRICE_CASE '+JSON.stringify(rec));
 await p.close();
}
(async()=>{let b=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const[m,base]of f.missions){
  let modes=f.priceMode==='standard'?['normal']:f.priceMode==='hors-b2b'?['normal','priority','evening','night','sunday']:['normal','priority','evening','sunday'];
  for(const mode of modes){
   if(mode==='normal'||mode==='priority'||mode==='sunday'||m===f.missions[0][0])for(const dev of ['desktop','mobile'])await run(b,m,base,mode,dev);
  }
 }
 }finally{await b.close()}
 const fail=result.filter(x=>!x.pass);fs.writeFileSync(out+'/report.json',JSON.stringify({total:result.length,failures:fail.length,results:result},null,2));
 console.log('PRICE_FINAL '+JSON.stringify({id:f.id,checked:result.length,fail:fail.length}));
 if(fail.length)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1});
