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
window.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(debounce);store()}},true);
['homeTop','backTop','timeline'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>{clearTimeout(debounce);store()},true));
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

// Réhydrater le formulaire / la checklist déjà affichés par boot() avant ce module.
if(hasPrep()){
 reinstate();
 const heading=document.querySelector('#app h1');
 if(heading&&!document.getElementById('cyrneaPrepGuide')){
  const box=document.createElement('div');box.id='cyrneaPrepGuide';box.className='notice';box.style.margin='8px 0 16px';
  box.innerHTML='<b>AVANT LE DÉPART — '+esc(S.result?.mission||'MISSION')+'</b><br>'+esc(PREP[S.result?.mission]||'Vérifier adresse, accès, personne désignée, consignes et documents nécessaires.');
  heading.after(box);
 }
}
})();