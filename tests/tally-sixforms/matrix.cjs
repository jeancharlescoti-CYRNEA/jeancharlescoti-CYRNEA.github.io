/*
CYRNEA TALLY: observational matrix QA only.
Absolutely no form submission, no fake order, no interaction with payment gateway.
*/ 
const {chromium}=require('playwright');
const fs=require('fs');
const CFG=[{"id":"xXOqpk","privateQ":{"qid":"d0718f8b-5491-4f9c-a3f3-3b8ffe72381d","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"0a175579-55cc-4790-8f5d-7bd67f37f3b1","text":"OUI"},{"id":"64361158-73f9-44b6-afc9-ce18dce3b48c","text":"NON"}]},"rights":{"qid":"f1dc6226-2cc8-4bc7-85af-4c8593711fbe","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"f0f490f4-a3dc-4d2f-afc3-46a3d79828e0","text":"NON"},{"id":"89a5f5ab-dc04-43b6-a1fc-68c5687ff6c7","text":"OUI"},{"id":"439dc29d-af44-488a-98dd-5070e177bfd1","text":"JE NE SAIS PAS"}]},"access":{"qid":"355a5d55-3bf9-4e50-93e2-5cbbfba0ce1a","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"d1aa7b2b-a330-4018-87be-2c513f5a76fa","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"e422ccd6-62cc-4f95-bbde-c16e9f468414","text":"CYRNEA devra accéder seul à l’aide d’une clé, d’un badge, d’un code, d’une boîte à clés ou d’un autre moyen d’accès."}]},"means":{"qid":"a8032422-b3a0-49a8-b004-d430b08de1ae","title":"Comment RELAIS disposera-t-il du moyen d'accès nécessaire à votre mission ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"11ebfb91-6c27-4b79-b7cd-1bc2613b1238","text":"Un code ou une boîte à clés déjà utilisable sur place."},{"id":"3ae68008-7732-47fc-a7c8-670fc8564a2f","text":"Les clés seront remises directement à RELAIS avant la mission."},{"id":"328623c9-c171-4e09-a570-e4fc388cf4dc","text":"RELAIS récupérera les clés auprès d'une personne désignée en Corse."},{"id":"2cb01612-f17f-44ab-82eb-2f71beccac48","text":"Les clés devront être expédiées depuis le continent."},{"id":"e0531897-4d7e-41f2-a17d-3949a4978c2a","text":"Aucun moyen d'accès n'est actuellement disponible."}]},"available":{"qid":"265977a9-ec87-4b45-aee2-b7c09bd4f138","title":"Si les clés sont expédiées depuis le continent, seront-elles effectivement disponibles en Corse avant le créneau demandé ?","type":"DROPDOWN_OPTION","options":[{"id":"4995cfb4-dd4a-4481-98ca-d6b7320770ba","text":"NON"},{"id":"121075ad-686b-42b2-9725-9fa9502c047f","text":"OUI"},{"id":"59aeee9b-085c-46a3-b834-a9de48fe8e0c","text":"JE NE SAIS PAS"}]},"missions":["RELAIS SIMPLE","RELAIS","AVANT INTEMPÉRIE","APRÈS INTEMPÉRIE — VÉRIFICATION PRATIQUE","VOIR RELAIS"],"hidden":["mission","objet","tarif","creneau","reference_temporaire","nom_client","email_client","telephone_client","cadre_client"]},{"id":"b5oz46","privateQ":{"qid":"91991da6-3cc7-4c9d-b6d6-42c5808c979e","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"728cb2d3-61f9-4080-9eca-7d9c028e0ad6","text":"OUI"},{"id":"700fc4e5-eefe-4796-8da9-e4b275f6a232","text":"NON"}]},"rights":{"qid":"a97cfa2c-98a1-4753-a882-94dc9e5dee29","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"7de4a60c-206c-4f5b-85b2-c7523a9f2ffb","text":"NON"},{"id":"2be77d7a-8fa2-4278-b0e2-0380d31df818","text":"OUI"},{"id":"34e364bf-0ec8-4c6e-9d3c-9055d1ac2cc0","text":"JE NE SAIS PAS"}]},"access":{"qid":"5f36821e-5862-4ecd-a4c8-f6285fb7bcee","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"febf4cbe-84e7-4052-81a9-0622f3dc4b3f","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"948ca5e0-bf20-4d85-9434-dca80e66c63f","text":"RELAIS devra accéder seul à l'aide d'une clé, d'un badge, d'un code, d'une boîte à clés ou d'un autre moyen d'accès."}]},"means":{"qid":"8f5a4d5b-cacc-4cf8-9a51-424e62fbcb15","title":"Moyen d'accès autonome (si RELAIS accède seul)","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"02a15eda-c3de-4cd5-94df-adc011f26d3c","text":"Code ou boîte à clés utilisable sur place"},{"id":"479ba605-97b4-4fd2-b2a5-11ea83904018","text":"Remise directe des clés à RELAIS"},{"id":"f6360344-0f0b-486b-b0d4-195e4e821fce","text":"Récupération auprès d'une personne désignée en Corse"},{"id":"3085eb52-c3cd-4fa6-8f81-c3f36b4148e6","text":"Expédition des clés depuis le continent"},{"id":"93085996-d3cb-4e23-9be4-53307be3a14b","text":"Aucun moyen d'accès disponible"}]},"available":{"qid":"e5faf073-5503-4642-8dae-d6838b30e54c","title":"Si les clés sont expédiées depuis le continent, seront-elles disponibles en Corse avant le crén","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"d7f33518-ea84-45e1-972a-eba693b616e0","text":"OUI — Elles seront disponibles avant le créneau."},{"id":"4686afa6-afc1-4613-9935-74148761d4f3","text":"NON — Elles ne seront pas disponibles à temps."},{"id":"05dee6a0-820a-4f70-8ecf-0f6de9af99ca","text":"JE NE SAIS PAS — La date d'arrivée reste incertaine."}]},"missions":["RELAIS SIMPLE","RELAIS","RELAIS - AVANT INTEMPÉRIE","RELAIS SIMPLE - APRÈS INTEMPÉRIE","VOIR RELAIS"],"hidden":["mission","objet","tarif","creneau","reference_temporaire","nom_client","email_client","telephone_client","cadre_client","availability_mode"]},{"id":"7R6AZa","privateQ":{"qid":"788e1163-a31c-4157-8283-834f13a442e9","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"e08d55fe-424b-4d83-9b39-99e95b63e29e","text":"OUI"},{"id":"0b25cc55-e5ed-4d71-a945-1c3c57245367","text":"NON"}]},"rights":{"qid":"d35affdd-07f6-499c-8475-0bb11d05bae7","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"74b7a574-61f3-4e64-acc3-03dc045f32ae","text":"NON"},{"id":"1dc05097-c0cb-431a-9f3f-bfb5fc742f41","text":"OUI"},{"id":"54c7ab28-1772-47b6-8a97-78121f0c43f3","text":"JE NE SAIS PAS"}]},"access":{"qid":"7cd89c01-ccf9-4dce-b296-ba26af96c115","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"86772e78-90c8-4600-ad88-38246f0955cb","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"27092123-0ac4-45ff-bb96-8b2dc1b71f64","text":"CYRNEA devra accéder seul à l’aide d’une clé, d’un badge, d’un code, d’une boîte à clés ou d’un autre moyen d’accès."}]},"means":{"qid":"91885677-3808-4d39-9427-3a052958d1e5","title":"Comment PRÉSENCE pourra-t-il accéder aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"33156c11-54e4-4112-be1d-b205472021fb","text":"Un code ou une boîte à clés est déjà utilisable sur place."},{"id":"502d1b96-5121-49fd-b752-25b28190ea34","text":"Je remettrai directement les clés à PRÉSENCE."},{"id":"82421681-6f4e-4b62-bfaa-4811c8bcdbea","text":"PRÉSENCE récupérera les clés auprès d'une personne désignée en Corse."},{"id":"8e2a46c3-7e14-43fa-9fa5-f6d235b5d9c1","text":"J'expédierai les clés depuis le continent."},{"id":"c06f433c-c336-4b4f-b9a2-b5ba5db0f04a","text":"Aucun moyen d'accès n'est actuellement disponible."}]},"available":{"qid":"69e0b373-791d-458f-a117-b5649935e9d0","title":"Les clés pourront-elles effectivement être mises à disposition de PRÉSENCE avant le créneau dem","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"9122a38a-ac8b-45d9-b23f-aef159011f8c","text":"OUI"},{"id":"cd0202e3-5774-4e98-85d8-29b61303a53b","text":"NON"},{"id":"caa2af2d-be6f-46c8-9d65-14691e5bf677","text":"JE NE SAIS PAS"}]},"missions":["VOIR PRÉSENCE","DÉCIDER","SUIVRE"],"hidden":["mission","objet","tarif","creneau","reference_temporaire","nom_client","email_client","telephone_client","cadre_client","societe_client","availability_mode"]},{"id":"GxZbE2","privateQ":{"qid":"d589f65b-8ed3-4ff7-9686-a9f1b8f3a1d4","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"a766d4e4-5912-4464-8f54-4186eca823ce","text":"OUI"},{"id":"204a91fd-6824-440e-ae13-88f7f0ab1d69","text":"NON"}]},"rights":{"qid":"573d1249-54ff-4d36-8115-0cc174dcc6d7","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"27ca622a-a765-4779-b733-d7ceb843d5ae","text":"NON"},{"id":"eccf65cb-109f-4031-bb53-dc27ead3b233","text":"OUI"},{"id":"52428a81-afe2-47d9-a31a-5eef8b6974c1","text":"JE NE SAIS PAS"}]},"access":{"qid":"9774f911-3f9d-4cfc-913d-3f361e555c1a","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"292d7769-120f-4548-9f5b-2e81345a5e5c","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"5b9f7436-3a30-46a4-b777-ec469b616cd9","text":"CYRNEA devra accéder seul à l’aide d’une clé, d’un badge, d’un code, d’une boîte à clés ou d’un autre moyen d’accès."}]},"means":{"qid":"a17a4014-8373-4658-98ce-47aba6fcf82e","title":"Comment PRÉSENCE pourra-t-il accéder aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"0454ce36-7cbf-4705-bbf1-7d11c1e7fab5","text":"Code ou boîte à clés utilisable sur place."},{"id":"75fde294-f745-44f7-8ccf-1f15bb87bbdf","text":"Remise directe des clés à PRÉSENCE."},{"id":"212e5dc8-4825-450d-8afc-e18bb5d7dcd9","text":"Récupération auprès d'une personne désignée en Corse."},{"id":"bd8df95c-e5ed-4aaa-b840-f1629158374f","text":"Expédition des clés depuis le continent."},{"id":"7b7860bc-2440-4ddc-a9ba-e07c1aea396a","text":"Aucun moyen d'accès disponible."}]},"available":{"qid":"abae7885-cb2e-4b9d-89ca-32e616bd4441","title":"Les clés seront-elles disponibles avant le créneau de mission ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"a95e24bc-0859-4aad-a927-049d3765e9b4","text":"OUI"},{"id":"c4b24fe6-241f-4f90-9e15-aff7e997136f","text":"NON"},{"id":"51de3b29-c697-481f-9115-c76142a1a536","text":"JE NE SAIS PAS"}]},"missions":["VOIR PRÉSENCE","VOIR PRIORITAIRE","DÉCIDER","SUIVRE"],"hidden":["mission","objet","tarif","creneau","reference_temporaire","nom_client","email_client","telephone_client","cadre_client","societe_client","availability_mode"]},{"id":"2EQWLD","privateQ":{"qid":"aab8de66-6253-4ba8-94a5-195495c9d98b","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"c83a4db7-d39e-4241-bb80-cfadd675f59a","text":"OUI"},{"id":"9de06dd5-3bc9-491f-bc24-9ced74e471ef","text":"NON"}]},"rights":{"qid":"4ed0df7b-2b45-465a-bcc6-6b50a2f152f9","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"f768e573-1720-431b-991d-eacd4dbd7386","text":"NON"},{"id":"e214d47c-b221-4be7-a2e4-d1a1cc2a7580","text":"OUI"},{"id":"cb6108c0-77d5-46a5-a338-bc4629bd1ff4","text":"JE NE SAIS PAS"}]},"access":{"qid":"b88d4644-2ffc-4fea-8de9-0fa0a600bdf4","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"d2871fe5-e41c-408d-a764-9f4bc78ae133","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"31639928-6d87-4b4d-8fe7-ec846f329476","text":"CYRNEA devra accéder seul à l’aide d’une clé, d’un badge, d’un code, d’une boîte à clés ou d’un autre moyen d’accès."}]},"means":{"qid":"be55bf77-26ed-4d5e-a764-93918a094bbc","title":"Comment PRÉSENCE disposera-t-il du moyen d'accès nécessaire à cette mission ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"082d9197-4655-497f-8b7d-0699cb14ce4d","text":"Un moyen d'accès utilisable est déjà disponible sur place."},{"id":"5bb283a8-1547-4f03-ac71-95ec0daf91fe","text":"Remise directe des clés ou badges à PRÉSENCE avant la mission."},{"id":"facff336-68a6-494a-94de-392fbc26c42b","text":"Récupération des clés ou badges auprès d'une personne désignée en Corse."},{"id":"973098ad-ce7a-421f-9cc4-7ccf660c67d7","text":"Expédition des clés ou badges depuis le continent."},{"id":"846c5cc8-6db4-454e-ad32-36bbe8e7531a","text":"Aucun moyen d'accès disponible."}]},"available":{"qid":"e299c6a1-833b-48df-83ba-bb98340871dd","title":"Les clés expédiées depuis le continent seront-elles disponibles en Corse avant le créneau deman","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"944d5ece-74d0-4ae5-9104-599e2024c873","text":"OUI"},{"id":"7f3a5e7e-17bb-47a6-9092-d381a9960aa8","text":"NON"},{"id":"2eaa7205-63e4-4d83-aae0-146ee568a431","text":"JE NE SAIS PAS"}]},"missions":["VISITE TERRAIN PILOTÉE - 350 € HT","PRÉSENCE PROJET - 490 € HT","PRÉSENCE PROJET ÉTENDUE - 690 € HT","CONTINUITÉ PROJET - 1 190 € HT","ACCÈS B2B - 109 € HT","REMISE CLÉ / BADGE B2B - 109 € HT","RÉCUPÉRATION CLÉ / BADGE B2B - 109 € HT","PRÉSENCE LOGISTIQUE B2B - 169 € HT"],"hidden":["mission","disponibilite","reference_temporaire","objet","tarif","creneau","supplement_ht","total_ht","tva","total_ttc","base_ht","nom_client","email_client","telephone_client","cadre_client"]},{"id":"RGp0PQ","privateQ":{"qid":"01ce0597-de08-4f54-92e9-4d88b365b113","title":"Cette mission nécessite-t-elle que CYRNEA accède à un lieu privé, fermé ou réservé ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"2cd88010-cc7d-4805-b447-e1303eb5a2c5","text":"OUI"},{"id":"13ecb340-d25f-4cb1-841f-941279118db9","text":"NON"}]},"rights":{"qid":"29d083ff-87bd-4241-bf10-6d10f8ce2859","title":"Une autre personne dispose-t-elle actuellement d’un droit d’occupation, de jouissance ou d’accè","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"1ee16943-c460-4c20-a516-5ac46d45991d","text":"NON"},{"id":"136b2800-a157-4269-bf2c-6c92c8d0aedf","text":"OUI"},{"id":"dda800c4-00b1-46cc-bf4e-42dd7bb3ddfc","text":"JE NE SAIS PAS"}]},"access":{"qid":"b42207f4-da4c-42aa-9ca4-57e110f55ac4","title":"Comment CYRNEA accédera-t-il aux lieux ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"ceca57dc-5f93-4dfd-b391-28d5268f93b5","text":"Une personne autorisée sera présente sur place pour donner accès à CYRNEA."},{"id":"b4106aa9-ed2e-495a-8dc7-753c5481c257","text":"CYRNEA devra accéder seul à l’aide d’une clé, d’un badge, d’un code, d’une boîte à clés ou d’un autre moyen d’accès."}]},"means":{"qid":"da27a319-ad13-48d0-9db1-0384f66f68ba","title":"Comment PRÉSENCE disposera-t-il du moyen d'accès nécessaire à cette mission ?","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"82a13c86-19e7-4b89-92c8-bb30cb5c0231","text":"Un moyen d'accès utilisable est déjà disponible sur place."},{"id":"c807cbf1-7557-4d54-aa77-81ffe93399b9","text":"Remise directe des clés ou badges à PRÉSENCE avant la mission."},{"id":"840faf7a-5c87-4622-a135-992843108529","text":"Récupération des clés ou badges auprès d'une personne désignée en Corse."},{"id":"ad0ff8b8-d2c8-4e52-90df-02106e93828c","text":"Expédition des clés ou badges depuis le continent."},{"id":"56bc31f3-57ed-4525-aca9-adc87240c75a","text":"Aucun moyen d'accès disponible."}]},"available":{"qid":"bffc538d-3c45-40ed-80b5-7f9929976e0f","title":"Les clés expédiées depuis le continent seront-elles disponibles en Corse avant le créneau deman","type":"MULTIPLE_CHOICE_OPTION","options":[{"id":"8823554d-2364-4575-b667-e8fbc9af2252","text":"OUI"},{"id":"bfbb37ad-2740-400e-9463-3efa1177f0da","text":"NON"},{"id":"ad9adaa1-a378-46a1-9f17-080937daba1c","text":"JE NE SAIS PAS"}]},"missions":["VISITE TERRAIN PILOTÉE - 350 € HT","PRÉSENCE PROJET - 490 € HT","PRÉSENCE PROJET ÉTENDUE - 690 € HT","CONTINUITÉ PROJET - 1 190 € HT","ACCÈS B2B - 109 € HT","REMISE CLÉ / BADGE B2B - 109 € HT","RÉCUPÉRATION CLÉ / BADGE B2B - 109 € HT","PRÉSENCE LOGISTIQUE B2B - 169 € HT"],"hidden":["mission","availability_mode","reference_temporaire","objet","tarif","creneau","supplement_ht","total_ht","tva","total_ttc","base_ht","nom_client","email_client","telephone_client","cadre_client"]}];
const INDEX=Number(process.env.FORM_INDEX);
if(!Number.isInteger(INDEX)||INDEX<0||INDEX>=CFG.length)throw Error('Invalid FORM_INDEX');
const f=CFG[INDEX],out='tally-matrix-results/'+f.id;
fs.mkdirSync(out,{recursive:true});
const observations=[];
const timeout=ms=>new Promise(r=>setTimeout(r,ms));
async function pickRadio(page,q,index){
 if(!q?.qid)throw Error('MISSING_QUESTION_ID');
 const els=page.locator('input[type=radio][name="multiple_choice_'+q.qid+'"]');
 if(await els.count()<=index)throw Error('OPTION_NOT_RENDERED '+q.title+' index='+index+' count='+await els.count());
 for(let i=0;i<3;i++){
  try{
   const el=els.nth(index),eid=await el.getAttribute('id');
   if(eid){const lab=page.locator('label[for="'+eid+'"]'); if(await lab.count())await lab.first().evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));}
   await timeout(140);await el.check({force:true,timeout:3600});await timeout(140);
   if(await el.isChecked())return;
  }catch(e){if(i===2)throw e;}
 }
 throw Error('OPTION_NOT_SELECTED '+q.title);
}
function idx(q,text){
 const i=q?.options?.findIndex(x=>x.text.trim().toUpperCase().startsWith(text))??-1;
 if(i<0)throw Error('UNEXPECTED_OPTION '+q?.title+' '+text);
 return i;
}
async function selectAvail(page,txt){
 const q=f.available;
 if(q.type!=='DROPDOWN_OPTION')return pickRadio(page,q,idx(q,txt));
 // Dropdown from RELAIS STANDARD
 const el=page.locator('[role=combobox]:visible, [aria-haspopup=listbox]:visible');
 if(!await el.count()){
   const debug=await page.evaluate(()=>[...document.querySelectorAll('input,button,[role=combobox]')].map(z=>({tag:z.tagName,role:z.getAttribute('role'),aria:z.getAttribute('aria-label'),id:z.id,placeholder:z.getAttribute('placeholder')})).slice(-30));
   throw Error('DROPDOWN_MISSING '+q.qid+' '+JSON.stringify(debug));
 }
 await el.last().click({force:true});
 if(f.id==='xXOqpk')console.log('DROPDOWN_STATE '+JSON.stringify(await page.evaluate(()=>({
  combos:[...document.querySelectorAll('[role=combobox]')].map(e=>({tag:e.tagName,id:e.id,value:e.value,txt:e.textContent?.slice(0,140),open:e.getAttribute('aria-expanded')})),
  options:[...document.querySelectorAll('[role=option]')].map(e=>({text:e.textContent?.trim().slice(0,80),visible:e.getBoundingClientRect().height>0})),
  lists:[...document.querySelectorAll('[role=listbox]')].map(e=>e.textContent?.slice(0,300)),html:document.getElementById('265977a9-c01e-4482-bc4c-d34e705d915b')?.parentElement?.parentElement?.outerHTML.slice(0,4500)
 }))));
 const desired=page.getByRole('option',{name:txt,exact:true});
 if(await desired.count())await desired.first().click({force:true});
 else {
  const input=el.last();
  await input.fill(txt,{force:true,timeout:3600});
  await timeout(120);
  await input.press('ArrowDown');await input.press('Enter');
 }
 await timeout(260);
 if(f.id==='xXOqpk' && (await page.locator('#'+q.qid).inputValue()).trim()!==txt)throw Error('DROPDOWN_VALUE_DID_NOT_STICK '+txt);
 if(f.id==='xXOqpk')console.log('DROPDOWN_AFTER '+JSON.stringify(await page.evaluate(()=>({value:document.getElementById('265977a9-c01e-4482-bc4c-d34e705d915b')?.value,optionTexts:[...document.querySelectorAll('[role=option]')].map(z=>z.textContent?.trim()),bodyTail:document.body.innerText.slice(-400)}))));
}
async function snapshot(page){
 return page.evaluate(()=>{
 const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.height>0&&r.width>0};
 const txt=document.body.innerText||'';
 const b=[...document.querySelectorAll('button,input[type=submit]')].filter(visible);
 return {
  submitVisible:b.some(x=>/COMMANDER ET PAYER|VALIDER MA MISSION|ENVOYER MA DEMANDE/i.test(x.innerText||x.value||'')),
  stopText:/ACCÈS AUTONOME IMPOSSIBLE|ACCÈS IMPOSSIBLE|disponibilité des clés ne permet pas|clés ne seront pas disponibles|date d'arrivée reste incertaine|Aucun moyen d'accès/i.test(txt),
  postal:/La Poste|Envoyer mes clés/i.test(txt),
  returnQuestion:/Modalités de restitution des clés|Comment.*clés.*restitu|Que devra faire.*clés/i.test(txt),
  availabilityQuestion:/seront-elles.*disponibles en Corse|seront-elles disponibles avant|clés pourront-elles effectivement|effectivement disponibles en Corse/i.test(txt),
  totalLines:txt.split('\n').filter(x=>/Total à régler|Total TTC|Tarif HT|Tarif TTC/i.test(x)).slice(0,8),
  phoneCount:[...document.querySelectorAll('input[type=tel]')].filter(visible).length,
  legalText:/Une autre personne dispose-t-elle/i.test(txt),
  bodyLength:txt.length,
  blankHeading:visible(document.querySelector('input[aria-label="Untitled dropdown field"]')),
  horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3
 };
 });
}
function expect(rec,k,condition,actual){
 rec.tests.push({check:k,pass:!!condition,actual}); if(!condition)rec.failed++;
}
async function one(browser,label,device,run){
 let page=await browser.newPage({viewport:device==='mobile'?{width:390,height:844}:{width:1440,height:900},locale:'fr-FR',acceptDownloads:false});
 let rec={id:f.id,scenario:label,device,tests:[],failed:0};let phase='navigation';
 try{
  const url=new URL('https://tally.so/r/'+f.id);
  const mission=(['xXOqpk','b5oz46'].includes(f.id)?f.missions[1]:f.missions[0])||'RELAIS SIMPLE';
  const sampleTarif=/(\d[\d ]* € HT)/.exec(mission)?.[1]||'169 € TTC';
  for(const [key,value] of Object.entries({mission,objet:'AUDIT AUTOMATIQUE SANS COMMANDE',tarif:sampleTarif,creneau:'2026-10-31 10:00',availability_mode:'normal',disponibilite:'normal',nom_client:'Audit Technique',email_client:'audit@example.invalid',telephone_client:'0612345678'}))url.searchParams.set(key,value);
  const response=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:33000}); await timeout(450);
  expect(rec,'HTTP200',response?.status()===200,response?.status());
  phase='answers';await run(page,rec);
  let s=await snapshot(page);
  expect(rec,'NO_UNLABELLED_DROPDOWN',!s.blankHeading,s.blankHeading);
  expect(rec,'NO_HORIZONTAL_OVERFLOW',!s.horizontalOverflow,s.horizontalOverflow);
 }catch(e){rec.tests.push({check:'SCRIPT_COMPLETE',pass:false,phase,error:String(e).slice(0,420)});rec.failed++;}
 if(rec.failed){try{await page.screenshot({path:out+'/'+label+'-'+device+'.png',fullPage:true});}catch(e){}}
 await page.close().catch(()=>{});
 observations.push(rec);console.log('MATRIX_CASE '+JSON.stringify(rec));
}
async function getToMeans(page,right='NON'){
 await pickRadio(page,f.privateQ,idx(f.privateQ,'OUI'));
 if(f.rights)await pickRadio(page,f.rights,idx(f.rights,right));
 await pickRadio(page,f.access,1);
}
async function runMatrix(browser,device){
 for(const availability of ['OUI','NON','JE NE SAIS PAS']){
  await one(browser,'SHIPPING_'+availability.replaceAll(' ','_'),device,async(p,r)=>{
   await getToMeans(p);
   await pickRadio(p,f.means,3);
   let before=await snapshot(p);
   expect(r,'POSTAL_GUIDE_VISIBLE',before.postal,before);
   expect(r,'KEY_AVAILABILITY_QUESTION',before.availabilityQuestion,before);
   await selectAvail(p,availability);
   const after=await snapshot(p);
   if(availability!=='OUI'){
    expect(r,'BLOCKED_NO_KEYS',!after.submitVisible,after);
   } else {
    expect(r,'RESTORE_QUESTION',after.returnQuestion,after);
   }
  });
 }
 await one(browser,'NO_MEANS_STOP',device,async(p,r)=>{
  await getToMeans(p);await pickRadio(p,f.means,4);
  const s=await snapshot(p);expect(r,'NO_MEANS_BLOCKS_SUBMISSION',!s.submitVisible,s);
 });
 for(const rights of ['OUI','JE NE SAIS PAS']){
  await one(browser,'RIGHTS_'+rights.replaceAll(' ','_')+'_AUTONOMOUS',device,async(p,r)=>{
   await getToMeans(p,rights);await pickRadio(p,f.means,0);
   const s=await snapshot(p);expect(r,'RIGHTS_AUTONOMOUS_STOP',!s.submitVisible,s);
  });
 }
 await one(browser,'STOP_THEN_RECOVER',device,async(p,r)=>{
  await getToMeans(p);await pickRadio(p,f.means,4);
  let s=await snapshot(p);expect(r,'INITIAL_STOP',!s.submitVisible,s);
  await pickRadio(p,f.means,0); s=await snapshot(p);
  expect(r,'STOP_CLEARED_WITH_KEYS',s.submitVisible,s);
 });
 await one(browser,'ACCOMPANIED_NO_KEYS_QUESTION',device,async(p,r)=>{
  await pickRadio(p,f.privateQ,idx(f.privateQ,'OUI'));
  await pickRadio(p,f.rights,idx(f.rights,'NON'));
  await pickRadio(p,f.access,0);
  let s=await snapshot(p);
  expect(r,'ACCOMPANIED_NO_KEY_SELECTOR',!(await p.locator('input[type=radio][name="multiple_choice_'+f.means.qid+'"]').first().isVisible().catch(()=>false)),s);
 });
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const device of ['desktop','mobile'])await runMatrix(browser,device);}
 finally{await browser.close();}
 let n=observations.reduce((x,z)=>x+z.tests.length,0),fails=observations.reduce((x,z)=>x+z.failed,0);
 fs.writeFileSync(out+'/report.json',JSON.stringify({id:f.id,scenarios:observations.length,checks:n,failures:fails,observations},null,2));
 console.log('MATRIX_FINAL '+JSON.stringify({id:f.id,scenarios:observations.length,checks:n,failures:fails}));
 if(fails)process.exitCode=1;
})().catch(e=>{console.error('FATAL',e);process.exitCode=1;});
