/* CYRNEA — pièces utiles réellement disponibles pendant la préparation et sur site. */
(function(){
'use strict';
const prepDocs=()=>Array.isArray(S.prepFiles)?S.prepFiles:[];
async function storePreparedFiles(files){
 const list=[...files||[]];if(!list.length)return;
 const key=activeMissionKey(S);
 if(!key)throw Error("Aucun dossier de mission ouvert pour conserver les fichiers.");
 await requestPersistentStorage();
 const db=await openMediaDb(),added=[];
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(MEDIA_DB_STORE,"readwrite"),store=tx.objectStore(MEDIA_DB_STORE);
   for(const file of list){
    const id=[key,"PREP",file.name,file.size,file.lastModified||0].join("::");
    store.put({id,missionId:key,passage:0,missionPassage:key+"::0",
      name:file.name,type:file.type||"application/octet-stream",size:Number(file.size||0),
      lastModified:file.lastModified||0,storedAt:Date.now(),purpose:"PREP_INTERNAL",blob:file});
    added.push({id,name:file.name,size:Number(file.size||0)});
   }
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("Impossible de sauvegarder les fichiers"));
   tx.onabort=()=>reject(tx.error||Error("Enregistrement interrompu"));
  });
 }finally{db.close()}
 const merged=new Map(prepDocs().map(v=>[v.id,v]));
 for(const item of added)merged.set(item.id,item);
 S.prepFiles=[...merged.values()];save();
}
async function verifyPreparedFiles(){
 const expected=prepDocs();if(!expected.length)return {ok:true,missing:[]};
 let records=[];try{records=(await getTerrainMediaRecords(S,true)).filter(x=>x.purpose==="PREP_INTERNAL")}catch(e){return {ok:false,missing:expected.map(x=>x.name)}}
 const actual=new Set(records.map(x=>x.id));
 const missing=expected.filter(x=>!actual.has(x.id)).map(x=>x.name);
 return {ok:missing.length===0,missing};
}
let saving=Promise.resolve();
function bindInput(){
 const input=document.getElementById("docs");
 if(!input||input.dataset.cyrneaBound==="1")return;
 input.dataset.cyrneaBound="1";
 const note=document.createElement("div");note.className="muted";
 note.textContent="Les fichiers ajoutés sont sauvegardés localement dans cette PWA. Les documents Tally ne sont pas importés automatiquement : ajoutez ici ceux qui doivent être consultés hors connexion.";
 input.parentNode?.appendChild(note);
 input.addEventListener('change',()=>{
  const files=[...input.files||[]];if(!files.length)return;
  saving=saving.then(()=>storePreparedFiles(files)).then(()=>{const el=document.getElementById("cyrneaPrepDocsStatus");if(el)el.textContent=prepDocs().length+" document(s) de préparation conservé(s) sur cet appareil."})
   .catch(e=>alert("Document non conservé : "+String(e.message||e)+". Réessayer avant de partir."));
 },true);
 const status=document.createElement("div");status.id="cyrneaPrepDocsStatus";status.className="notice";
 status.textContent=prepDocs().length?prepDocs().length+" document(s) déjà conservé(s) sur cet appareil.":"Aucun document de préparation encore conservé localement.";
 input.parentNode?.appendChild(status);
}
const oldPrep=preparationMission;
preparationMission=function(){const ret=oldPrep.apply(this,arguments);bindInput();return ret};
const oldCollect=collectPreparation;
collectPreparation=async function(){
 const choice=document.querySelector('input[name="docsChoice"]:checked')?.value||"";
 try{
  await saving;
  if(choice==="OUI"){
   const input=document.getElementById("docs");
   if(input?.files?.length)await storePreparedFiles(input.files);
   const verified=await verifyPreparedFiles();
   if(!verified.ok)return alert("Documents de préparation manquants : "+verified.missing.join(", ")+". Récupérer les fichiers sur cet appareil avant de valider.");
  }
  return await oldCollect.apply(this,arguments);
 }catch(e){alert("Impossible de préparer les pièces : "+String(e.message||e))}
};
const oldStart=startTerrainFromReady;
startTerrainFromReady=async function(){
 const check=await verifyPreparedFiles();
 if(!check.ok)return alert("Départ impossible : fichiers de préparation absents de cet appareil : "+check.missing.join(", ")+". Ouvrir la PWA sur l'appareil qui les détient.");
 return oldStart.apply(this,arguments);
};
async function showStoredFiles(){
 const card=document.querySelector("#app .card");if(!card||document.getElementById("cyrneaStoredDocs"))return;
 const holder=document.createElement("div");holder.id="cyrneaStoredDocs";holder.className="neutral";
 holder.innerHTML="<b>PIÈCES PRÉPARATOIRES DISPONIBLES HORS CONNEXION</b><p class='muted'>Recherche des fichiers enregistrés…</p>";
 const h=card.querySelector("h1");if(h)h.after(holder);else card.prepend(holder);
 let records=[];try{records=(await getTerrainMediaRecords(S,true)).filter(x=>x.purpose==="PREP_INTERNAL")}catch(e){holder.innerHTML="<div class='warn'>Stockage local indisponible : ouvrez l'appareil où les documents ont été conservés.</div>";return}
 if(!records.length){holder.innerHTML="<div class='notice'>Aucun document préparatoire conservé sur cet appareil. Vérifier la soumission Tally si nécessaire.</div>";return}
 holder.innerHTML='<b>PIÈCES PRÉPARATOIRES — '+records.length+'</b><div class="muted">Consultation locale, aucune pièce envoyée au client automatiquement.</div>';
 for(const item of records){
  const link=document.createElement("a");link.className="btn ghost";link.style.cssText="display:block;margin:8px 0;white-space:normal;overflow-wrap:anywhere";
  link.textContent="OUVRIR — "+item.name;link.href=URL.createObjectURL(item.blob);
  link.target="_blank";link.rel="noopener noreferrer";
  holder.appendChild(link);
 }
}
const oldDoc=showMissionDoc;
showMissionDoc=function(kind){const ret=oldDoc.apply(this,arguments);if(kind==="support")showStoredFiles();return ret};
const oldReady=ready;
ready=function(){
 const ret=oldReady.apply(this,arguments);
 if(prepDocs().length){
  const h=document.querySelector("#app .card h1");
  if(h){const note=document.createElement("div");note.className="notice";note.textContent=prepDocs().length+" document(s) préparatoires attendus : contrôle réel avant départ.";h.after(note)}
 }
 return ret;
};
window.CyrneaMissionDocuments={storePreparedFiles,verifyPreparedFiles};
if(document.getElementById("addr"))bindInput();
})();