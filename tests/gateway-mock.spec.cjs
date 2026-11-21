const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function source(name){
 const start=html.indexOf('function '+name+'(');if(start<0)throw Error('Missing '+name);
 let depth=0,quote='',escaped=false,begin=html.indexOf('{',start);
 for(let i=begin;i<html.length;i++){const c=html[i];if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote='';continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;if(c==='}'&&!--depth)return html.slice(start,i+1).replace(/^function registerTallyIntent/, 'async function registerTallyIntent')}
 throw Error('Unclosed '+name);
}
function sandbox(overrides={}){
 const calls=[],S={result:{status:'PROPOSER',contract:'RELAIS',mission:'RELAIS SIMPLE',price:'109 € TTC'},universe:'RELAIS',email:'test@example.invalid',name:'TEST',phone:'',obj:'Simulation',tallyReference:'D-20261121120000-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',tallyIntentReady:false};
 const ctx={S,URLSearchParams,AbortController,setTimeout,clearTimeout,PAYMENT_GATEWAY_URL:'https://gateway.invalid',zoneCoverage:()=> 'INCLUS',validateB2BShortHours:()=>true,validateOwnerTariffAndSchedule:()=>true,validateB2BMultiBeforeGateway:()=>true,assertVoirContractInvariant:()=>true,gatewayPaymentCents:()=>10900,ensureTallyReference:()=>S.tallyReference,tallyMissionValue:()=>S.result.mission,scheduleText:()=> '2026-11-23 10:00',paymentAmountText:()=>S.result.price,tallyAvailabilityMode:()=> 'standard',save:()=>{},fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>({ok:true,reference:S.tallyReference})}},...overrides};
 vm.createContext(ctx);vm.runInContext(source('registerTallyIntent'),ctx,{timeout:1000});return {ctx,calls,S};
}
test('simulation Gateway : intention 10900 centimes, aucun réseau externe',async()=>{
 const {ctx,calls,S}=sandbox();
 const result=await ctx.registerTallyIntent();
 expect(result.ok).toBe(true);expect(calls).toHaveLength(1);
 expect(calls[0].url).toBe('https://gateway.invalid/intent');
 const body=JSON.parse(calls[0].opts.body);
 expect(body).toMatchObject({amount_cents:10900,currency:'eur',contract:'RELAIS',mission:'RELAIS SIMPLE',reference:S.tallyReference});
 expect(S.tallyIntentReady).toBe(true);
});
test('simulation Gateway : blocage avant réseau si devis',async()=>{
 const {ctx,calls,S}=sandbox();S.result.isQuote=true;
 await expect(ctx.registerTallyIntent()).rejects.toThrow(/Devis hors grille/);
 expect(calls).toHaveLength(0);
});
test('simulation Gateway : blocage avant réseau si B2B hors secteur',async()=>{
 const {ctx,calls,S}=sandbox({zoneCoverage:()=> 'DEVIS PRÉALABLE'});S.result.contract='PRÉSENCE ENTREPRISES';
 await expect(ctx.registerTallyIntent()).rejects.toThrow(/hors secteur/);
 expect(calls).toHaveLength(0);
});
test('simulation Gateway : blocage avant réseau si montant invalide',async()=>{
 const {ctx,calls}=sandbox({gatewayPaymentCents:()=>-1});
 await expect(ctx.registerTallyIntent()).rejects.toThrow(/Montant de paiement invalide/);
 expect(calls).toHaveLength(0);
});
test('simulation Gateway : refus HTTP ne confirme pas une intention',async()=>{
 const {ctx,S}=sandbox({fetch:async()=>({ok:false,status:403,json:async()=>({error:'forbidden_test'})})});
 await expect(ctx.registerTallyIntent()).rejects.toThrow(/forbidden_test/);
 expect(S.tallyIntentReady).toBe(false);
});
