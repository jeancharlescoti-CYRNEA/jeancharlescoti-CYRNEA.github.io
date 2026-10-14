const {chromium}=require('playwright');
const fs=require('fs');
const formIds=['xXOqpk','b5oz46','7R6AZa','GxZbE2'];
const states=[
 {label:'date-31-oct-2026',flag:'non',expectedVisible:false},
 {label:'date-24-oct-2026',flag:'oui',expectedVisible:true},
 {label:'unclassified-direct-site',flag:null,expectedVisible:true}
];
const outcome=[];
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
for(const form of formIds)for(const st of states)for(const device of ['desktop','mobile']){
 const page=await browser.newPage({viewport:device==='desktop'?{width:1440,height:900}:{width:390,height:844},locale:'fr-FR'});
 const url=new URL('https://tally.so/r/'+form);
 url.searchParams.set('mission',form==='xXOqpk'?'RELAIS':form==='b5oz46'?'RELAIS':'VOIR PRÉSENCE');
 url.searchParams.set('creneau',st.flag==='oui'?'2026-10-24 10:00':'2026-10-31 10:00');
 if(st.flag!==null)url.searchParams.set('execution_anticipee_14j',st.flag);
 let record={form,device,case:st.label,flag:st.flag,expectedVisible:st.expectedVisible,passed:false};
 try{
  const response=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(850);
  const obs=await page.evaluate(()=>{
    const text=document.body.innerText||'';
    const needle='EXÉCUTION AVANT LA FIN DU DÉLAI DE RÉTRACTATION';
    return{headingVisible:text.includes(needle),
      optionsVisible:text.includes('Je demande expressément que l’exécution')||text.includes('Je demande expressément que l’exécution'.replace('’',"'")),
      cgv:text.includes('Conditions Générales'),
      title:text.split('\n').find(x=>x.includes('PROPRIÉTAIRES'))||null
    };
  });
  record={...record,httpStatus:response.status(),...obs};
  record.passed=response.status()===200&&obs.headingVisible===st.expectedVisible&&obs.optionsVisible===st.expectedVisible&&obs.cgv;
 }catch(e){record.error=String(e).slice(0,340);}
 outcome.push(record);
 console.log('RETRACT_CASE '+JSON.stringify(record));
 await page.close();
}
}finally{await browser.close();}
fs.mkdirSync('tally-retract-gate-results',{recursive:true});
fs.writeFileSync('tally-retract-gate-results/report.json',JSON.stringify(outcome,null,2));
const fails=outcome.filter(x=>!x.passed);
console.log('RETRACT_FINAL '+JSON.stringify({scenarios:outcome.length,success:outcome.length-fails.length,failures:fails.length,failuresByForm:Object.fromEntries(formIds.map(x=>[x,fails.filter(y=>y.form===x).length]))}));
if(fails.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});