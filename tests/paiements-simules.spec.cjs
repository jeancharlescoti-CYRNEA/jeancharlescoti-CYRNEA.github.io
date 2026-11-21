const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function fn(name){
 const start=html.indexOf('function '+name+'(');if(start<0)throw Error('Fonction absente '+name);
 let b=html.indexOf('{',start),depth=0,quote=null,esc=false;
 for(let i=b;i<html.length;i++){const c=html[i];if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote=null;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;if(c==='}'&&!--depth)return html.slice(start,i+1)}
 throw Error('Fonction tronquée '+name);
}
test('RELAIS clés 199 : deux passages vers site officiel, sans lien paiement PWA',()=>{
 let result=null;
 const ctx={S:{caller:'OWNER',need:'KEY_BOTH',sub:'',result:null},showResult(){result=ctx.S.result},draw(){}};
 vm.createContext(ctx);vm.runInContext(fn('sub')+';sub()',ctx,{timeout:1000});
 expect(result).toMatchObject({status:'PARCOURS SITE OFFICIEL',mission:'CLÉS — 2 PASSAGES',price:'199 € TTC',contract:'RELAIS',multi:true,passages:2});
 expect(fn('showResult')).toContain('siteOnly');
 expect(fn('showResult')).toContain('PARCOURS SITE OFFICIEL');
});
test('RELAIS 199 : le validateur refuse de créer une intention PWA',()=>{
 const src=fn('validateOwnerTariffAndSchedule');
 expect(src).toContain('S.result.status!=="PROPOSER"');
 expect(src).not.toContain('"CLÉS — 2 PASSAGES":199');
});
test('simulation locale de montants : centimes TTC sans paiement',()=>{
 const ctx={S:{result:{contract:'RELAIS',price:'199 € TTC'}},VAT_RATE:0.2};
 vm.createContext(ctx);
 vm.runInContext([fn('parseEuroAmount'),fn('isB2BContract'),fn('priceParts'),fn('gatewayPaymentCents')].join('\n'),ctx,{timeout:1000});
 expect(ctx.gatewayPaymentCents()).toBe(19900);
 const cases=[[109,13080],[169,20280],[218,26160],[350,42000],[490,58800],[690,82800],[850,102000],[1190,142800]];
 for(const [ht,expected] of cases){ctx.S.result={contract:'PRÉSENCE ENTREPRISES',price:ht+' € HT'};expect(ctx.gatewayPaymentCents()).toBe(expected)}
});
test('l’intention réseau exige les validations avant tout envoi',()=>{
 const src=fn('registerTallyIntent');
 const validations=['validateB2BShortHours()','validateOwnerTariffAndSchedule()','validateB2BMultiBeforeGateway()','assertVoirContractInvariant()'];
 for(const v of validations)expect(src).toContain(v);
 expect(src.indexOf('validateOwnerTariffAndSchedule()')).toBeLessThan(src.indexOf('fetch(PAYMENT_GATEWAY_URL+"/intent"'));
});
