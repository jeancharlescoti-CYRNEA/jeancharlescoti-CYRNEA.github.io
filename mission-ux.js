/* CYRNEA — Fiabilisation du parcours preparation/terrain, 17 novembre 2026. */
(function(){
'use strict';
const PREP={
'ACCÈS B2B':'Vérifier le professionnel désigné, son heure précise, le moyen d’accès et la fermeture.',
'PRÉSENCE LOGISTIQUE B2B':'Vérifier le contact, le rendez-vous, l’opération exacte et la durée maximale.',
'GESTES SIMPLES SUR SITE B2B':'Prévoir les gestes précisément autorisés, les équipements et les limites d’intervention.',
'REMISE CLÉ / BADGE B2B':'Confirmer le destinataire, la quantité, le lieu et le moyen de prouver la remise.',
'RÉCUPÉRATION CLÉ / BADGE B2B':'Confirmer la provenance, la quantité, le destinataire final et la preuve de récupération.',
'REMISE ET RÉCUPÉRATION CLÉ / BADGE B2B':'Préparer séparément les deux passages, leurs heures, interlocuteurs et preuves.',
'CLÉS — 2 PASSAGES':'Préparer séparément les deux passages, leurs heures, interlocuteurs et preuves.',
'VISITE TERRAIN PILOTÉE':'Prévoir les zones autorisées, prises de vue, repères et points non vérifiables.',
'PRÉSENCE PROJET':'Prévoir les interlocuteurs, les questions convenues et le lien visioconférence.',
'PRÉSENCE PROJET ÉTENDUE':'Prévoir les zones à parcourir, les interlocuteurs et les questions pour l’objectif unique.',
'CONTINUITÉ PROJET':'Prévoir des photos et repères identiques d’un passage à l’autre.',
'SUIVI DE PROJET - 2 PASSAGES':'Prévoir des photos et repères identiques aux deux passages.',
'SUIVRE':'Prévoir les mêmes zones, angles de vue et observations aux différents passages.',
'VOIR RELAIS':'Lister les points exacts à observer et les photos utiles.',
'RELAIS':'Vérifier la personne autorisée, l’accès, l’opération précise et la fermeture.',
'RELAIS SIMPLE':'Vérifier la personne autorisée, l’accès, l’opération précise et la fermeture.'
};
let debounce;
function hasTerrain(){return !!document.querySelector('#app input[name="terrainGuard"]')}
function hasPrep(){return !!document.querySelector('#app #addr')}
function store(){
 try{
  if(hasTerrain())captureTerrainDraft();
  if(hasPrep()){
   const d={};for(const id of ['addr','access','mode','contact','map','note']){
    const el=document.getElementById(id);if(el)d[id]=el.value;
   }
   d.contactChoice=document.querySelector('input[name="contactChoice"]:checked')?.value||'';
   d.docsChoice=document.querySelector('input[name="docsChoice"]:checked')?.value||'';
   S.prepWorkingDraft=d;save();
  }
 }catch(e){console.warn('Brouillon CYRNEA non confirmé',e)}
}
function queued(){clearTimeout(debounce);debounce=setTimeout(store,350)}
const app=document.getElementById('app');
app.addEventListener('input',e=>{if((hasTerrain()||hasPrep())&&app.contains(e.target))queued()},true);
app.addEventListener('change',e=>{if((hasTerrain()||hasPrep())&&app.contains(e.target))queued()},true);
app.addEventListener('click',e=>{if((hasTerrain()||hasPrep())&&e.target.closest('button')){clearTimeout(debounce);store()}},true);
window.addEventListener('pagehide',()=>{clearTimeout(debounce);store()},true);
function reinstate(){
 const d=S.prepWorkingDraft;if(!hasPrep()||!d)return;
 for(const id of ['addr','access','mode','contact','map','note']){
  const el=document.getElementById(id);if(el&&d[id]&&(!el.value||el.value==='Portail / entrée principale'))el.value=d[id];
 }
 for(const name of ['contactChoice','docsChoice'])if(d[name]){
  const r=[...document.querySelectorAll('input[name="'+name+'"]')].find(x=>x.value===d[name]);
  if(r){r.checked=true;if(name==='contactChoice'&&typeof toggleContactChoice==='function')toggleContactChoice();if(name==='docsChoice'&&typeof toggleDocsChoice==='function')toggleDocsChoice()}
 }
 if(d.note)document.getElementById('prepExtra')?.classList.remove('hidden');
}
const origPrep=preparationMission;
preparationMission=function(){
 const result=origPrep.apply(this,arguments);
 reinstate();
 const heading=document.querySelector('#app h1');
 if(heading&&hasPrep()&&!document.getElementById('cyrneaPrepGuide')){
  const box=document.createElement('div');box.id='cyrneaPrepGuide';box.className='notice';
  box.style.margin='8px 0 16px';
  box.innerHTML='<b>AVANT LE DÉPART — '+esc(S.result?.mission||'MISSION')+'</b><br>'+esc(PREP[S.result?.mission]||'Vérifier adresse, accès, personne désignée, consignes et documents nécessaires.');
  heading.after(box);
 }
 return result;
};
const origCollect=collectPreparation;
collectPreparation=function(){
 const ret=origCollect.apply(this,arguments);
 if(S.prep?.addr){delete S.prepWorkingDraft;save()}
 return ret;
};

const origTerrain=terrain;
terrain=function(){
 const out=origTerrain.apply(this,arguments);
 if(!S.result?.multi||Number(S.passage||1)<=1)return out;
 const previous=(S.passageHistory||[]).filter(p=>Number(p.passage)<Number(S.passage)).sort((a,b)=>Number(b.passage)-Number(a.passage))[0];
 const heading=document.querySelector('#app h1');if(!heading)return out;
 const box=document.createElement('div');box.className='neutral';box.id='cyrneaPreviousPassage';box.style.margin='12px 0 16px';
 if(!previous){box.innerHTML='<b>PASSAGE PRÉCÉDENT</b><br>Aucun état antérieur accessible. Vérifier le dossier d’origine avant comparaison.';heading.after(box);return out;}
 box.innerHTML='<b>RAPPEL DU PASSAGE '+Number(previous.passage)+'</b><br>'+
  '<b>Faits précédents :</b> '+esc(previous.facts||'Non renseignés')+'<br>'+
  '<b>Limites :</b> '+esc(previous.incident||'Non renseignées')+
  (previous.reportDetails?.observations?'<br><b>Précisions :</b> '+esc(previous.reportDetails.observations):'')+
  '<div id="cyrneaComparePhotos" style="margin-top:8px"><small>Recherche des photos précédentes sur cet appareil…</small></div>';
 heading.after(box);
 getTerrainMediaRecords(S,true).then(records=>{
  const area=document.getElementById('cyrneaComparePhotos');if(!area)return;
  const images=records.filter(x=>Number(x.passage)===Number(previous.passage)&&String(x.type||'').startsWith('image/'));
  if(!images.length){area.innerHTML='<small>Photos du passage précédent non présentes sur cet appareil : consulter le dossier du passage d’origine.</small>';return;}
  area.innerHTML='<b>PHOTOS DE REPÈRE — PASSAGE PRÉCÉDENT</b><div class="cyrneaCompareRow" style="display:flex;gap:7px;flex-wrap:wrap;margin-top:7px"></div>';
  const row=area.querySelector('.cyrneaCompareRow');
  images.slice(0,6).forEach(file=>{const url=URL.createObjectURL(file.blob),a=document.createElement('a'),img=document.createElement('img');a.href=url;a.target='_blank';a.rel='noopener';a.title=file.name;img.src=url;img.alt=file.name;img.style.cssText='width:90px;height:90px;object-fit:cover;border:1px solid #ddd;border-radius:4px';a.appendChild(img);row.appendChild(a)});
 }).catch(()=>{const area=document.getElementById('cyrneaComparePhotos');if(area)area.textContent='Consultation des photos antérieures indisponible sur cet appareil.'});
 return out;
};
})();