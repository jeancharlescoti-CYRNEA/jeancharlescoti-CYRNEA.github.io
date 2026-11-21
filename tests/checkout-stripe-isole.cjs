'use strict';
// Automated isolated Stripe Checkout TEST payments. NO real card, live keys or production KV.
const {chromium}=require('@playwright/test');
const fs=require('node:fs');
const base='https://cyrnea-payment-gateway-test.jeancharles-coti.workers.dev';
const id='cee7cbe5-04f5-4bdd-92d1-a2de3643ace4';
const statusUrl=base+'/run-status?id='+id;
const results=[];
function save(){fs.writeFileSync('stripe-test-results.json',JSON.stringify({id,results},null,2))}
async function status(){
  const r=await fetch(statusUrl,{headers:{'Cache-Control':'no-cache'}});
  if(!r.ok)throw Error('Gateway TEST HTTP '+r.status);
  const x=await r.json();
  if(x.environment!=='STRIPE_TEST'||x.checkout_created!==19||x.expected!==19||x.entries.length!==19)throw Error('Invalid TEST run');
  return x;
}
async function fill(page,selectors,value,required){
  for(let pass=0;pass<4;pass++){
    for(const frame of page.frames()){
      for(const selector of selectors){
        try {
          const loc=frame.locator(selector).first();
          if(await loc.isVisible({timeout:400})){await loc.fill(value,{timeout:3000});return true}
        }catch(e){}
      }
    }
    await page.waitForTimeout(900);
  }
  if(required)throw Error('Required field missing: '+selectors[0]);
  return false;
}
async function evidence(page,n){
  try{await page.screenshot({path:'stripe-test-'+n+'.png',fullPage:true})}catch(e){}
  for(const f of page.frames()){
    try{
      const inputs=await f.locator('input').evaluateAll(els=>els.map(e=>({name:e.name,placeholder:e.placeholder,id:e.id,aria:e.getAttribute('aria-label')})));
      if(inputs.length)console.log('FORM FIELDS '+f.url().split('?')[0].slice(0,70),JSON.stringify(inputs).slice(0,800));
    }catch(e){}
  }
}
async function pay(page,x,n){
  if(!x.session_id.startsWith('cs_test_')||!x.checkout_url.startsWith('https://checkout.stripe.com/')||!x.checkout_url.includes(x.session_id))throw Error('Non TEST checkout refused');
  await page.goto(x.checkout_url,{waitUntil:'domcontentloaded',timeout:55000});
  await page.waitForTimeout(3000);
  // Force EUR: Stripe adaptive pricing otherwise proposes USD on US CI IP.
  for(const frame of page.frames()){
    try{
      const eur=frame.locator('#currency-eur').first();
      if(await eur.count()){
        await eur.check({force:true,timeout:3000});
        console.log('EUR selected for '+x.session_id);
        await page.waitForTimeout(1600);
        break;
      }
    }catch(e){console.log('EUR selection:',String(e.message).slice(0,140))}
  }
  await fill(page,['input[name="email"]','input[type="email"]','input[autocomplete="email"]'],'cyrnea-stripe-test@example.com',false);
  await fill(page,['input[name="billingName"]','input[name="name"]','input[autocomplete="cc-name"]','input[autocomplete="name"]'],'CYRNEA TEST',false);
  await fill(page,['input[name="number"]','input[name="cardNumber"]','input[autocomplete="cc-number"]','input[placeholder*="1234"]','input[aria-label*="Card number"]','input[aria-label*="Numéro"]'],'4242424242424242',true);
  await fill(page,['input[name="expiry"]','input[name="cardExpiry"]','input[autocomplete="cc-exp"]','input[placeholder*="MM / YY"]','input[aria-label*="Expiration"]'],'1234',true);
  await fill(page,['input[name="cvc"]','input[name="cardCvc"]','input[autocomplete="cc-csc"]','input[placeholder="CVC"]','input[aria-label*="CVC"]'],'123',true);
  await fill(page,['input[name="postalCode"]','input[name="billingPostalCode"]','input[autocomplete="postal-code"]'],'20137',false);
  for(const frame of page.frames()){
    try{
      const buttons=await frame.locator('button').evaluateAll(els=>els.filter(e=>e.offsetParent!==null).map(e=>({text:e.innerText.trim().slice(0,90),type:e.type,aria:e.getAttribute('aria-label')})));
      if(buttons.length)console.log('BUTTONS '+frame.url().split('?')[0].slice(0,65)+' '+JSON.stringify(buttons).slice(0,1300));
    }catch(e){}
  }
  let clicked=false;
  for(const frame of page.frames()){
    for(const selector of ['button:has-text("Payer")','button:has-text("Pay")','button[type="submit"]:visible']){
      try{
        const b=frame.locator(selector).last();
        if(await b.isVisible({timeout:500})&&await b.isEnabled({timeout:500})){
          console.log('CLICK '+selector+' on '+frame.url().split('?')[0].slice(0,80));
          await b.click({timeout:8000});clicked=true;break
        }
      }catch(e){}
    }
    if(clicked)break;
  }
  if(!clicked)throw Error('Pay button missing');
  for(let t=0;t<22;t++){
    await page.waitForTimeout(2000);
    const record=(await status()).entries[n];
    if(record.status==='PAID')return 'PAID';
    if(record.status==='UNVERIFIED')throw Error('Webhook reported UNVERIFIED');
  }
  throw Error('No TEST webhook PAID confirmation after checkout');
}
(async()=>{
  const before=await status();
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(let n=0;n<19;n++){
      const x=before.entries[n];
      if((await status()).entries[n].status==='PAID'){results.push({number:n+1,reference:x.reference,result:'PAID_ALREADY'});save();continue}
      console.log('PAYING TEST '+(n+1)+'/19 '+x.service+' '+x.mission+' '+x.expected_cents+' cents');
      const page=await browser.newPage({locale:'fr-FR',viewport:{width:1280,height:900}});
      try{
        const paid=await pay(page,x,n);
        results.push({number:n+1,reference:x.reference,service:x.service,mission:x.mission,expected_cents:x.expected_cents,result:paid});
        save();
      }catch(e){
        await evidence(page,n+1);
        results.push({number:n+1,reference:x.reference,result:'FAILED',error:String(e.message)});
        save();console.error('STOP: '+e.message);process.exitCode=1;break;
      }finally{await page.close()}
    }
  }finally{await browser.close()}
  const after=await status();
  console.log('WEBHOOK TEST PAID '+after.confirmed_paid+'/19');
  if(after.confirmed_paid!==19)process.exitCode=1;
})().catch(e=>{console.error(e);save();process.exitCode=1});
