// Script execution: deterministic, static, zero API calls.
'use strict';
/** CYRNEA static Tally logic audit. All reachable discrete combinations.
 * Does NOT access the network, touch Tally, submit orders or process payments.
 */
const fs=require('fs');
const raw=JSON.parse(fs.readFileSync('tests/tally-sixforms/rule-fixture-20261014.json','utf8'));
let all=[];
let byForm=[];
function normalize(s){return String(s||'').trim().toUpperCase();}
function locate(groups,predicate){return groups.find(g=>predicate(g.options.map(z=>normalize(z.text)),g));}
function findStructures(f){
 const gs=f.groups;
 const mi=locate(gs,(v)=>v.some(z=>z.includes('RELAIS')||z.includes('SUIVRE')||z.includes('CONTINUITÉ PROJET')));
 const pr=locate(gs,(v)=>v.length===2&&v.includes('OUI')&&v.includes('NON'));
 const right=locate(gs,(v)=>v.length===3&&v[0]==='NON'&&v[1]==='OUI'&&v[2]==='JE NE SAIS PAS');
 const who=locate(gs,(v)=>v.length===2&&v[0].startsWith('POUR MON PROPRE COMPTE'));
 const access=locate(gs,(v)=>v.length===2&&v[0].includes('UNE PERSONNE AUTORISÉE'));
 const means=locate(gs,(v)=>v.length===5&&v[0].toLowerCase().includes('code')||v.length===5&&v[0].includes("UN MOYEN D'ACCÈS"));
 const meansIndex=gs.findIndex(g=>g.id===means?.id);
 const av=gs.slice(meansIndex+1).find(g=>g.options.length===3&&g.options.some(z=>normalize(z.text).startsWith('JE NE SAIS PAS'))&&g.options.some(z=>normalize(z.text).startsWith('OUI'))&&g.options.some(z=>normalize(z.text).startsWith('NON')));
 const ret=locate(gs,(v)=>v.length===4&&v.some(z=>z.includes('POSTAL')));
 const retract=locate(gs,(v)=>v.length===2&&v[0].startsWith('OUI — « JE DEMANDE'));
 const op=locate(gs,(v)=>v.length===3&&v.some(z=>z.includes('RÉCUPÉRER'))&&v.some(z=>z.includes('REMETTRE')));
 const other=gs.filter(g=>g.options.length===2&&g.options[0].text==='OUI'&&g.options[1].text==='NON'&&g.id!==pr?.id);
 return {mi,pr,right,who,access,means,av,ret,retract,op,other};
}
const hby=(f,n)=>f.hidden.find(x=>x.name===n)?.id;
function setting(state,g,i){if(g)state[g.id]=g.options[i]?.id;}
function ev(c,state,unknown){
 if(c.type==='GROUP')return evalConditions(c.payload.conditionals||[],c.payload.logicalOperator||'AND',state,unknown);
 let p=c.payload||{},v=state[p.field?.uuid],want=p.value;
 switch(p.comparison){
 case 'IS':return v===want;
 case 'IS_NOT':return v!==want;
 case 'IS_ANY_OF':return Array.isArray(want)&&want.includes(v);
 case 'IS_NOT_ANY_OF':return Array.isArray(want)&&!want.includes(v);
 case 'IS_EMPTY':return v===undefined||v===null||v==='';
 case 'IS_NOT_EMPTY':return v!==undefined&&v!==null&&v!=='';
 case 'EQUAL':return Number(v)===Number(want);
 case 'NOT_EQUAL':return Number(v)!==Number(want);
 default:unknown.add(p.comparison);return false;
 }
}
function evalConditions(a,op,state,u){let values=a.map(x=>ev(x,state,u));return op==='OR'?values.some(Boolean):values.every(Boolean)}
function result(f,s,unknown){
 const activated=f.rules.filter(z=>evalConditions(z.conditions,z.operator,s,unknown));
 const stop=activated.some(z=>z.actions.some(a=>a.type==='HIDE_BUTTON_TO_DISABLE_COMPLETION'));
 const calc={};for(const rule of activated)for(const a of rule.actions||[])if(a.type==='CALCULATE'){
 let name=a.payload?.calculate?.field?.title||'unknown';
 (calc[name]??=[]).push({expr:a.payload?.calculate?.expression,rule:rule.id});
 }
 let conflicts=Object.entries(calc).filter(([k,values])=>new Set(values.map(v=>v.expr)).size>1).map(([k,values])=>k+'='+values.map(v=>v.expr).join('|'));
 return {stop,calc,conflicts,activated};
}
function* reachable(f,p){
 for(let m=0;m<(p.mi?.options.length||1);m++)
 for(const mode of (f.id==='xXOqpk'||f.id==='7R6AZa'||f.id==='2EQWLD'?['normal']:['normal','priority','evening','sunday',...(f.id==='RGp0PQ'?['night']:[])]))
 for(let pri=0;pri<2;pri++)
 for(let role=0;role<2;role++)
 for(let rights=0;rights<(normalize(p.pr?.options[pri]?.text)==='OUI'?3:1);rights++)
 for(let access=0;access<(normalize(p.pr?.options[pri]?.text)==='OUI'?2:1);access++){
  let privateYes=normalize(p.pr?.options[pri]?.text)==='OUI';
  let usesMeans=privateYes&&access===1;
  for(let k=0;k<(usesMeans?5:1);k++){
    let shipping=usesMeans&&k===3;
    for(let a=0;a<(shipping?3:1);a++){
      let availabilityYes=shipping&&normalize(p.av?.options[a]?.text).startsWith('OUI');
      let useReturn=usesMeans&&(k===1||k===2||(k===3&&availabilityYes));
      for(let t=0;t<(useReturn?4:1);t++){
       for(let rw=0;rw<(p.retract?2:1);rw++){
        let s={},hidden=hby(f,'mission'),mh=hby(f,'availability_mode')||hby(f,'disponibilite');
        let label=p.mi?.options[m]?.text||'';
        if(hidden)s[hidden]=label;
        if(mh)s[mh]=mode;
        setting(s,p.mi,m);setting(s,p.pr,pri);if(privateYes){setting(s,p.who,role);setting(s,p.right,rights);setting(s,p.access,access);}
        if(usesMeans){setting(s,p.means,k);if(shipping)setting(s,p.av,a);if(useReturn)setting(s,p.ret,t);}
        setting(s,p.retract,rw);
        // B2B timing answers are independently varied in a separate local submatrix
        yield {s,labels:{mission:label,mode,pri,role,rights,access,means:usesMeans?k:null,shipping:shipping?a:null,return:useReturn?t:null,retract:rw},expected:{
          stop:(usesMeans&&(k===4||(shipping&&!availabilityYes)))||(usesMeans&&rights!==0)
        }};
       }
      }
    }
  }
 }
}
function main(){
 for(const f of raw.forms){
  let p=findStructures(f),unknown=new Set(),cases=0,policyFail=[],calcConflicts=[],noBase=[],rulesHit=new Map(),stops=0;
  let pos={...Object.fromEntries(Object.entries(p).filter(([k,v])=>!Array.isArray(v)).map(([k,v])=>[k,!!v]))};
  for(const {s,labels,expected} of reachable(f,p)){
   cases++;
   let q=result(f,s,unknown);if(q.stop)stops++;
   for(const r of q.activated)rulesHit.set(r.id,(rulesHit.get(r.id)||0)+1);
   if(expected.stop&&!q.stop&&policyFail.length<30)policyFail.push(labels);
   if(q.conflicts.length&&calcConflicts.length<30)calcConflicts.push({labels,conflicts:q.conflicts});
   let calcNames=Object.keys(q.calc);
   let baseFound=calcNames.some(x=>['c_base','base_price'].includes(x));
   if(!baseFound&&noBase.length<25)noBase.push(labels);
  }
  let never=f.rules.filter(r=>!rulesHit.has(r.id)).map(r=>r.id);
  let r={id:f.id,cases,stopCases:stops,policyFails:policyFail,calcConflicts,noBase,unmatchedRuleCount:never.length,unmatchedRules:never.slice(0,25),unknownComparisons:[...unknown],detected:pos};
  byForm.push(r);console.log('EXHAUSTIVE_FORM '+JSON.stringify({id:r.id,cases:r.cases,stops:r.stopCases,policyFailureExamples:r.policyFails.slice(0,2),calcConflictExamples:r.calcConflicts.slice(0,2),noBaseExamples:r.noBase.slice(0,2),unmatchedRules:r.unmatchedRuleCount,unknown:[...unknown],detected:pos}));
 }
 fs.mkdirSync('tally-exhaustive-results',{recursive:true});fs.writeFileSync('tally-exhaustive-results/logic-report.json',JSON.stringify(byForm,null,2));
 console.log('EXHAUSTIVE_FINAL '+JSON.stringify({forms:byForm.length,totalCombinations:byForm.reduce((n,x)=>n+x.cases,0),policyFails:byForm.reduce((n,x)=>n+x.policyFails.length,0),calcConflicts:byForm.reduce((n,x)=>n+x.calcConflicts.length,0),noBase:byForm.reduce((n,x)=>n+x.noBase.length,0)}));
}
main();
