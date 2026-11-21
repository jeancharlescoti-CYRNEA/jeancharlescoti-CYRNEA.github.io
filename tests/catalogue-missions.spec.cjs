const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
function extractFunction(name) {
  const start = html.indexOf('function '+name+'(');
  if (start < 0) throw new Error('Fonction absente: '+name);
  const brace = html.indexOf('{',start);
  let depth=0,quote=null,escaped=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];
    if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote=null;continue}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c==='{')depth++;
    if(c==='}'&&!--depth)return html.slice(start,i+1);
  }
  throw new Error('Bloc non terminé '+name);
}
const functions=['b2bCoverage','isB2BLogisticsMission','zoneCoverage','voir','classify'];
const source=functions.map(extractFunction).join('\n');
function classify(caller,city,need,sub){
 const sandbox={S:{caller,city,need,sub,result:null},showResult(){}};
 vm.createContext(sandbox);
 vm.runInContext(source+'\nclassify()',sandbox,{timeout:1000});
 return JSON.parse(JSON.stringify(sandbox.S.result));
}
const cases=[
 ['RELAIS','Porto-Vecchio','ART','ACCESS','109 € TTC'],
 ['RELAIS','Porto-Vecchio','ART','STAY','149 € TTC'],
 ['RELAIS','Porto-Vecchio','SEE','VISIBLE','260 € TTC'],
 ['RELAIS','Porto-Vecchio','KEY','GIVE','109 € TTC'],
 ['RELAIS','Porto-Vecchio','KEY','GET','109 € TTC'],
 ['B2B','Porto-Vecchio','BLOG','ACCESS','109 € HT'],
 ['B2B','Porto-Vecchio','BLOG','KEY_GIVE','109 € HT'],
 ['B2B','Porto-Vecchio','BLOG','KEY_GET','109 € HT'],
 ['B2B','Porto-Vecchio','BLOG','KEY_BOTH','218 € HT'],
 ['B2B','Porto-Vecchio','BLOG','STAY','169 € HT'],
 ['B2B','Porto-Vecchio','BLOG','GESTES','169 € HT'],
 ['B2B','Porto-Vecchio','BVISIT',null,'350 € HT'],
 ['B2B','Porto-Vecchio','BPROJECT',null,'490 € HT'],
 ['B2B','Porto-Vecchio','BEXT',null,'690 € HT'],
 ['B2B','Porto-Vecchio','BSUIVI2',null,'850 € HT'],
 ['B2B','Porto-Vecchio','BCONT',null,'1 190 € HT']
];
for(const [caller,city,need,sub,price] of cases){
 test('tarif '+caller+' '+need+'/'+(sub||'-'),()=>{
  const r=classify(caller,city,need,sub);
  expect(r.price).toBe(price);
  expect(['PROPOSER','PARCOURS SITE OFFICIEL']).toContain(r.status);
 });
}
test('hors secteur B2B : logistique interdite, visite sur devis',()=>{
 expect(classify('B2B','Aléria','BLOG','ACCESS').status).toBe('HORS PÉRIMÈTRE');
 expect(classify('B2B','Aléria','BVISIT',null).status).toBe('DEVIS PRÉALABLE');
});
test('hors secteur B2B : Bonifacio inclus',()=>{
 expect(classify('B2B','Bonifacio','BVISIT',null).status).toBe('PROPOSER');
});
test('RELAIS : expertise technique interdite',()=>{
 expect(classify('RELAIS','Porto-Vecchio','SEE','TECH').status).toBe('HORS PÉRIMÈTRE');
});
test('RELAIS : suivi 2 passages = base 490 TTC dans PWA',()=>{
 expect(classify('RELAIS','Porto-Vecchio','FOLLOW','TWO').price).toBe('490 € TTC');
});
