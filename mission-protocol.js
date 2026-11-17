/* CYRNEA — préparation opérationnelle et comparaison passage à passage. */
(function(){
'use strict';
const M=window.CyrneaMissionSchema;
if(!M)throw Error("Module de règles CYRNEA absent");
const mission=()=>S.result?.mission||"";
const kind=()=>M.typeOf(mission(),S.need,S.sub,S.result?.multi);
const isCompare=()=>kind()==="compare";
const initialPlan=()=>{
 let previous=S.missionPlan;if(previous?.mission===mission()&&previous.kind===kind())return M.normalize(previous,S);
 const fields={};const h=S.h2Dossier?.h2||{};
 fields.scope=String(S.prep?.note||S.h2Dossier?.initial?.brief||S.obj||"").slice(0,1200);
 if(kind()==="access"||kind()==="logistics")fields.person=String(S.prep?.contact||h.on_site_contact||"").slice(0,500);
 if(kind()==="meeting")fields.people=String(S.prep?.contact||h.participants||h.on_site_contact||"").slice(0,500);
 return M.normalize({fields},S);
};
function planChecks(plan,addr){
 const st={result:S.result,need:S.need,sub:S.sub,prep:S.prep,pendingPrepAddress:addr||S.prep?.addr};
 return M.check(plan,st,S.missionPlanReferenceSnapshot||[]);
}
function persistPrep(){
 const root=document.getElementById("cyrneaProtocolPrep");if(!root)return;
 const plan=initialPlan();plan.fields={...plan.fields};
 for(const inp of root.querySelectorAll("[data-protocol-field]"))plan.fields[inp.dataset.protocolField]=inp.value;
 const seq=root.querySelector("#cyrneaKeySequence");if(seq)plan.sequence=seq.value;
 plan.savedAt=(new Date()).toISOString();
 S.missionPlan=plan;save();
}
function getPlan(){return S.missionPlan?.mission===mission()?S.missionPlan:initialPlan()}
function mountPreparation(){
 if(!document.getElementById("addr")||document.getElementById("cyrneaProtocolPrep"))return;
 const btn=document.querySelector('#app button[onclick="collectPreparation()"]');
 if(!btn)return;
 const p=getPlan(),schema=M.requiredFor(mission(),S.need,S.sub,S.result?.multi);
 const root=document.createElement("div");root.id="cyrneaProtocolPrep";root.className="neutral";root.style.cssText="margin:18px 0;padding:14px";
 let html='<div class="guideTitle">PLAN OPÉRATIONNEL — '+esc(schema.name.toUpperCase())+'</div>'+
  '<div class="muted">Remplir avant le départ. Les points convenus restent sous votre contrôle ; aucune action supplémentaire n’est autorisée.</div>';
 for(const [id,label] of schema.fields){
  const value=p.fields?.[id]||"",isLong=id==="scope"||id==="referencePoints"||id==="questions"||id==="photoInstructions"||id==="limits"||id==="equipment"||id==="safety"||id==="photos";
  html+='<div class="field"><label>'+esc(label)+' <b>*</b></label>'+
   (isLong?'<textarea rows="'+(id==="referencePoints"?'4':'2')+'" maxlength="1800" data-protocol-field="'+esc(id)+'">'+esc(value)+'</textarea>':
   '<input type="text" maxlength="800" data-protocol-field="'+esc(id)+'" value="'+esc(value)+'">')+'</div>';
 }
 if(kind()==="keys"&&S.result?.multi){
  html+='<div class="field"><label>Ordre des deux passages *</label><select id="cyrneaKeySequence">'+
  '<option value="">— Confirmer l’ordre —</option>'+
  '<option value="GIVE_GET"'+(p.sequence==="GIVE_GET"?' selected':'')+'>REMETTRE puis RÉCUPÉRER</option>'+
  '<option value="GET_GIVE"'+(p.sequence==="GET_GIVE"?' selected':'')+'>RÉCUPÉRER puis REMETTRE</option></select></div>';
 }
 const locked=!!(S.missionPlanReferenceSnapshot?.length);
 if(locked&&isCompare())html+='<div class="notice">Repères figés depuis le premier passage : vous pouvez compléter les observations, mais pas changer les points de comparaison.</div>';
 html+='<div id="cyrneaProtocolValidation" class="muted" aria-live="polite">Le contrôle aura lieu avant « Mission préparée ».</div>';
 root.innerHTML=html;btn.before(root);
 if(locked){const ref=root.querySelector('[data-protocol-field="referencePoints"]');if(ref)ref.readOnly=true}
 root.addEventListener('input',onChange,true);root.addEventListener('change',onChange,true);
}
function onChange(){
 persistPrep();
 const result=planChecks(getPlan(),document.getElementById("addr")?.value.trim());
 const hint=document.getElementById("cyrneaProtocolValidation");
 if(hint)hint.textContent=result.ok?"Plan opérationnel complet.":result.errors.join(" ");
}
function summaryHtml(){
 const p=getPlan(),spec=M.requiredFor(mission(),S.need,S.sub,S.result?.multi);
 return '<div class="neutral" id="cyrneaProtocolSummary"><b>PLAN OPÉRATIONNEL — '+esc(spec.name)+'</b>'+
 spec.fields.map(([id,label])=>'<div class="row"><b>'+esc(label)+'</b><span>'+esc(p.fields?.[id]||"Non précisé")+'</span></div>').join('')+
 (p.sequence?'<div class="row"><b>Ordre des passages</b><span>'+esc(p.sequence==="GIVE_GET"?"REMETTRE puis RÉCUPÉRER":"RÉCUPÉRER puis REMETTRE")+'</span></div>':'')+'</div>';
}
function readySummary(){
 if(S.stage!=="PRÊTE")return;
 const heading=document.querySelector("#app .card h1");if(!heading||document.getElementById("cyrneaProtocolSummary"))return;
 const wrap=document.createElement('div');wrap.innerHTML=summaryHtml();heading.after(wrap.firstChild);
 const action=document.querySelector('#app button[onclick="startTerrainFromReady()"]');
 if(action&&!document.getElementById("cyrneaReadySpecific")){
  const label=document.createElement('label');label.className="check";label.id="cyrneaReadySpecific";
  label.innerHTML='<input type="checkbox" name="cyrneaReadyProtocol"><span>J’ai vérifié les informations et moyens spécifiques à cette mission, y compris les pièces ou leur absence convenue.</span>';
  action.before(label);
 }
}
const oldPrep=preparationMission;
preparationMission=function(){const r=oldPrep.apply(this,arguments);mountPreparation();return r};
const oldCollect=collectPreparation;
collectPreparation=function(){
 persistPrep();
 const v=planChecks(getPlan(),document.getElementById("addr")?.value.trim());
 if(!v.ok){alert("PRÉPARATION INCOMPLÈTE\n• "+v.errors.join("\n• "));return}
 S.missionPlan=v.plan;save();
 return oldCollect.apply(this,arguments);
};
const oldReady=ready;
ready=function(){const r=oldReady.apply(this,arguments);readySummary();return r};
const oldStart=startTerrainFromReady;
startTerrainFromReady=function(){
 const v=planChecks(getPlan(),S.prep?.addr);
 if(!v.ok){alert("Préparation spécifique incomplète : "+v.errors.join(" / "));return preparationMission()}
 if(!document.querySelector('input[name="cyrneaReadyProtocol"]')?.checked)return alert("Confirmer les contrôles spécifiques de cette mission avant d'ouvrir le terrain.");
 return oldStart.apply(this,arguments);
};
const oldMissionDesk=missionDesk;
missionDesk=function(){const r=oldMissionDesk.apply(this,arguments);const heading=document.querySelector('#app .card h1');if(heading&&!document.getElementById("cyrneaProtocolSummary")){const d=document.createElement('div');d.innerHTML=summaryHtml();heading.after(d.firstChild)}return r};
const oldMarkArrival=markArrival;
markArrival=function(){
 if(isCompare()&&!S.missionPlanReferenceSnapshot?.length){
  S.missionPlanReferenceSnapshot=M.references(getPlan().fields.referencePoints);
  save();
 }
 return oldMarkArrival.apply(this,arguments);
};
function recordsCurrent(){const p=String(S.passage||1);return S.comparisonRecords?.[p]||{}}
function saveCurrentComparisons(){
 if(!isCompare())return;
 const wrap=document.getElementById('cyrneaComparisonInputs');if(!wrap)return;
 const passage=String(S.passage||1),data={...recordsCurrent()};
 for(const row of wrap.querySelectorAll('[data-compare-index]')){
  const i=row.dataset.compareIndex;
  data[i]={status:row.querySelector('[data-role="status"]')?.value||"",
    note:row.querySelector('[data-role="note"]')?.value.trim()||"",
    photo:row.querySelector('[data-role="photo"]')?.value||""};
 }
 S.comparisonRecords={...(S.comparisonRecords||{}),[passage]:data};save();
}
function previousRecord(i){
 const prior=(S.passageHistory||[]).filter(p=>Number(p.passage)<Number(S.passage)).sort((a,b)=>Number(b.passage)-Number(a.passage))[0];
 const values=prior?.observations||S.comparisonRecords?.[String(prior?.passage||"")];
 return {passage:prior?.passage||0,data:values?.[i]||null};
}
function currentCompareHtml(){
 const p=getPlan(),refs=M.references(p.fields.referencePoints);
 const found=recordsCurrent(),options=M.comparisonStatuses(S.passage);
 return '<div class="neutral" id="cyrneaComparisonInputs" style="margin:15px 0;padding:12px">'+
  '<b>COMPARAISON — PASSAGE '+Number(S.passage||1)+'</b>'+
  '<p class="muted">Même point et même angle à chaque visite. Les conclusions se limitent à ce qui est réellement observable.</p>'+
  refs.map((label,i)=>{const prev=previousRecord(i),cur=found[i]||{};
   return '<div class="field" data-compare-index="'+i+'" style="border-top:1px solid #ddd;padding-top:12px">'+
   '<label><b>REPÈRE '+(i+1)+' — '+esc(label)+'</b></label>'+
   (prev.data?'<div class="notice"><b>Passage '+prev.passage+' :</b> '+esc(prev.data.status||"—")+' — '+esc(prev.data.note||"Observation non détaillée")+(prev.data.photo?' · Photo : '+esc(prev.data.photo):'')+'</div>':'')+
   '<label>Constat de ce passage *</label><select data-role="status"><option value="">— Choisir —</option>'+
   options.map(x=>'<option value="'+x+'"'+(cur.status===x?' selected':'')+'>'+esc(x==="OBSERVE"?"Observé (base de référence)":x==="IDENTIQUE"?"Aucune différence visible dans les éléments observés":x==="DIFFERENT"?"Différence visible documentée":"Non observable / non vérifiable")+'</option>').join('')+'</select>'+
   '<label>Description factuelle / limite *</label><textarea rows="2" maxlength="1000" data-role="note" placeholder="Décrire ce qui est réellement visible, sans conclusion technique.">'+esc(cur.note||"")+'</textarea>'+
   '<label>Photo de ce repère (si disponible)</label><select data-role="photo"><option value="">— Aucune photo associée —</option>'+(cur.photo?'<option value="'+esc(cur.photo)+'" selected>'+esc(cur.photo)+'</option>':'')+'</select>'+
   '</div>';
  }).join('')+
  '<div id="cyrneaCompareValidation" class="muted" aria-live="polite">Chaque repère doit être renseigné avant de terminer le passage.</div></div>';
}
async function updatePhotoOptions(){
 if(!isCompare())return;
 const container=document.getElementById('cyrneaComparisonInputs');if(!container)return;
 let records=[];try{records=await getTerrainMediaRecords(S,false)}catch(e){return}
 for(const select of container.querySelectorAll('[data-role="photo"]')){
  const selected=select.value,imgs=records.filter(x=>String(x.type||"").startsWith("image/"));
  select.innerHTML='<option value="">— Aucune photo associée —</option>'+
    imgs.map(x=>'<option value="'+esc(x.name)+'"'+(selected===x.name?' selected':'')+'>'+esc(x.name)+'</option>').join('');
 }
}
function mountComparison(){
 if(!isCompare())return;
 const root=document.querySelector('#app input[name="terrainGuard"]');
 if(!root||document.getElementById("cyrneaComparisonInputs"))return;
 const btn=document.querySelector('#app button[onclick="collectTerrain()"]');
 if(!btn)return;
 const holder=document.createElement('div');holder.innerHTML=currentCompareHtml();btn.before(holder.firstChild);
 const panel=document.getElementById('cyrneaComparisonInputs');
 panel.addEventListener('input',saveCurrentComparisons,true);
 panel.addEventListener('change',saveCurrentComparisons,true);
 updatePhotoOptions();
}
const oldStoreMedia=storeSelectedTerrainMedia;
storeSelectedTerrainMedia=async function(){
 const result=await oldStoreMedia.apply(this,arguments);
 await updatePhotoOptions();return result;
};
const oldTerrain=terrain;
terrain=function(){
 if(!S.arrivalAt){
  const v=planChecks(getPlan(),S.prep?.addr);
  if(!v.ok){alert("Préparation de mission incomplète. Compléter le plan avant de commencer le terrain.");return preparationMission()}
 }
 const r=oldTerrain.apply(this,arguments);mountComparison();return r;
};
const oldCollectTerrain=collectTerrain;
collectTerrain=async function(){
 if(isCompare()){
  saveCurrentComparisons();
  const result=M.checkObservations(getPlan(),S.passage,recordsCurrent());
  if(!result.ok)return alert("COMPARAISON À COMPLÉTER\n• "+result.errors.join("\n• "));
 }
 return oldCollectTerrain.apply(this,arguments);
};
const oldRecord=recordPassageSnapshot;
recordPassageSnapshot=function(){
 const r=oldRecord.apply(this,arguments);
 if(isCompare()){
  const p=Number(S.passage||1),row=(S.passageHistory||[]).find(x=>Number(x.passage)===p);
  if(row&&!row.observations){row.observations=JSON.parse(JSON.stringify(recordsCurrent()));save()}
 }
 return r;
};
function comparisonReview(){
 if(!isCompare())return;
 const heading=document.querySelector('#app .card h1');
 if(!heading||document.getElementById("cyrneaComparisonReview"))return;
 const wrap=document.createElement("div");wrap.id="cyrneaComparisonReview";wrap.className="neutral";
 const points=M.comparisonGrid(getPlan(),S.passageHistory||[]);
 const current=recordsCurrent();
 wrap.innerHTML='<b>RELEVÉ DES REPÈRES — PASSAGE '+(Number(S.passage||1))+'</b>'+
 points.map(p=>'<div class="row"><b>'+esc(p.label)+'</b><span>'+esc(current[p.index]?.status||"Non renseigné")+
   ' — '+esc(current[p.index]?.note||"—")+(current[p.index]?.photo?' · '+esc(current[p.index].photo):'')+'</span></div>').join('');
 heading.after(wrap);
}
const oldRestitution=restitution;
restitution=function(){const r=oldRestitution.apply(this,arguments);comparisonReview();return r};
window.CyrneaMissionProtocol={
 kind,planChecks,currentCompareHtml,saveCurrentComparisons,renderPrep:mountPreparation,renderCompare:mountComparison
};
// Reprise directe de la mission après chargement et rafraîchissement.
if(document.getElementById("addr"))mountPreparation();
if(S.stage==="PRÊTE")readySummary();
if(S.stage==="TERRAIN")mountComparison();
if(S.stage==="RESTITUTION")comparisonReview();
})();