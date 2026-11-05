/* CYRNEA — passerelle H2 PWA, lecture sécurisée, 05/11/2026 */
(function(){
'use strict';
const BASE='https://cyrnea-h2-dossier.jeancharles-coti.workers.dev';
const PAY=/^D-\d{14}-[A-F0-9]{32}$/;
let seq=0;
function official(ref,contract){
 const m=/^D-(\d{14})-([A-F0-9]{32})$/.exec(String(ref||'').trim());
 if(!m||!['RELAIS','PRÉSENCE PROPRIÉTAIRES','PRÉSENCE ENTREPRISES'].includes(contract))return '';
 return (contract==='RELAIS'?'RP':'CP')+'-'+m[1].slice(0,4)+'-'+(BigInt('0x'+m[2])%1000000000000n).toString().padStart(12,'0');
}
function baseMission(v){return String(v||'').toUpperCase().replace(/\s+-\s+[\d\s\u00a0\u202f]+€\s*(?:HT|TTC)?$/u,'').replace(/\s+/g,' ').trim()}
function matching(d){return d?.ok===true&&d.payment_reference===S.tallyReference&&d.contract===S.result?.contract&&d.official_reference===official(d.payment_reference,d.contract)&&baseMission(d.mission)===baseMission(S.result?.mission)}
function html(){
 const d=S.h2Dossier;
 if(!matching(d))return '<div class="muted">Préparation H2 à rapprocher du dossier PWA.</div>';
 const h=d.h2||{},i=d.initial||{},out=[];
 const row=(label,value)=>value?'<div class="row"><b>'+esc(label)+'</b><span>'+esc(String(value))+'</span></div>':'';
 out.push(row('Référence paiement',d.payment_reference),row('Référence officielle H2',d.official_reference),row('Besoin de la commande',i.brief));
 if(i.documents||i.documents_choice)out.push(row('Pièces commande','Consulter la soumission Tally'+(i.documents_choice?' — '+i.documents_choice:'')));
 if(d.h2){
  for(const [l,v] of [['Adresse',h.address],['Point d’accès',h.access_point],['Mode d’accès déclaré',h.access_mode],['Contact sur place',h.on_site_contact],['Localisation / Maps',h.maps_url],['Participants',h.participants],['Visioconférence',h.videoconference],['Consignes',h.practical_notes]])out.push(row(l,v));
  if(Array.isArray(h.files)&&h.files.length){
   const files=h.files.map(f=>{const label=esc(String(f.name||'Document'));let url='';try{const u=new URL(String(f.url||''));if(u.protocol==='https:')url=u.href}catch(e){}return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':label}).join(' • ');
   out.push('<div class="row"><b>Pièces H2 Tally</b><span>'+files+'</span></div>');
  }
 }else out.push('<div class="muted">Le formulaire de préparation n’est pas encore reçu. Le brief de commande est conservé.</div>');
 return '<div class="notice"><b>COMMANDE / PRÉPARATION CLIENT — TALLY / H2</b>'+out.join('')+'<div class="muted">Les fichiers restent dans Tally. Autorisations et accès à contrôler avant intervention.</div></div>';
}
function display(message){const el=document.getElementById('cyrneaH2Panel');if(el)el.innerHTML=message||html()}
function prefill(){
 if(!document.getElementById('addr'))return;
 const d=S.h2Dossier||{},h=d.h2||{},i=d.initial||{},p=S.prep||{};
 const fill=(id,val)=>{const e=document.getElementById(id);if(e&&!String(e.value||'').trim()&&val)e.value=String(val).slice(0,e.maxLength>0?e.maxLength:4000)};
 fill('addr',p.addr||h.address);fill('contact',p.contact||h.on_site_contact);fill('map',p.map||h.maps_url);
 const note=String(p.note||h.practical_notes||i.brief||'');
 if(note.length<=4000){fill('note',note);if(document.getElementById('note')?.value)document.getElementById('prepExtra')?.classList.remove('hidden')}
 if((i.documents||h.files?.length||p.docsChoice==='TALLY')&&!document.querySelector('input[name="docsChoice"]:checked')){
  const r=document.querySelector('input[name="docsChoice"][value="TALLY"]');if(r){r.checked=true;toggleDocsChoice()}
 }
 const a=document.getElementById('access');
 if(a&&h.access_point&&a.value==='Portail / entrée principale'&&[...a.options].some(o=>o.value===h.access_point))a.value=h.access_point;
 const m=document.getElementById('mode');
 if(m&&(m.value===''||m.value==='Clés reçues / disponibles avant la mission')){
  const v=String(p.mode||h.access_mode||'').toLowerCase();let target='';
  if(v.includes('récupérer')||v.includes('recuperer'))target='Clés à récupérer';
  else if(v.includes('digicode')||v.includes('code'))target='Code / digicode';
  else if(v.includes('tiers'))target='Accès donné par un tiers';
  else if(v.includes('libre')||v.includes('accueil'))target='Accès libre / accueil';
  else if(v.includes('clé')||v.includes('cle'))target='Clés reçues / disponibles avant la mission';
  if(target&&[...m.options].some(o=>o.value===target))m.value=target;
 }
}
async function read(ref,contract){
 const key=getSyncKey();
 if(!key)throw Error('Clé de synchronisation CYRNEA absente');
 if(!PAY.test(ref)||!official(ref,contract))throw Error('Référence invalide');
 const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
 try{
  const r=await fetch(BASE+'/pwa-h2-brief?payment_reference='+encodeURIComponent(ref),{method:'GET',headers:{Accept:'application/json','X-Cyrnea-Sync-Key':key},credentials:'omit',cache:'no-store',signal:c.signal});
  const d=await r.json().catch(()=>null);
  if(!r.ok||!d?.ok)throw Error(d?.error||'H2 HTTP '+r.status);
  if(d.payment_reference!==ref||d.contract!==contract||d.official_reference!==official(ref,contract))throw Error('Référence ou contrat H2 incohérent');
  if(baseMission(d.mission)!==baseMission(S.result?.mission))throw Error('La mission payée ne correspond pas au dossier PWA');
  return d;
 }finally{clearTimeout(t)}
}
async function refresh(){
 const ref=String(S.tallyReference||''),contract=S.result?.contract;
 if(!official(ref,contract))return;
 const turn=++seq;
 try{
  const d=await read(ref,contract);
  if(turn!==seq||ref!==S.tallyReference||contract!==S.result?.contract)return;
  if(JSON.stringify(S.h2Dossier||null)!==JSON.stringify(d)){
   S.h2Dossier=d;save();if(getSyncKey())syncCentralMissions({silent:true}).catch(()=>{});
  }
  display();prefill();
 }catch(e){if(turn===seq&&ref===S.tallyReference)display('<div class="warn">H2 indisponible : '+esc(String(e.message||e))+'. Dossier PWA et paiement inchangés.</div>')}
}
async function attach(){
 if(!S.result?.contract)return alert('Choisissez une mission.');
 const input=prompt('Référence de paiement de la commande du site (D-...):',String(S.tallyReference||''));
 if(input===null)return;
 const ref=String(input).trim().toUpperCase(),contract=S.result.contract;
 if(!official(ref,contract))return alert('Référence de paiement invalide.');
 if(S.tallyIntentReady && S.tallyReference && S.tallyReference!==ref)
  return alert('Cette fiche possède déjà une commande PWA sécurisée. Ne remplacez pas sa référence de paiement.');
 for(const [k,v] of Object.entries(loadActiveMissionMap()))if(v?.tallyReference===ref&&k!==activeMissionKey(S))return alert('Commande déjà associée au dossier PWA '+k+'. Ouvrez-le.');
 try{
  const d=await read(ref,contract);
  S.tallyReference=ref;S.h2Dossier=d;save();if(getSyncKey())syncCentralMissions({silent:true}).catch(()=>{});
  display();prefill();alert('Commande rattachée au dossier existant ; aucun doublon créé.');
 }catch(e){alert('Rattachement refusé : '+String(e.message||e)+'. Aucune donnée modifiée.')}
}
function mount(preparation){
 const card=document.querySelector('#app .card')||document.querySelector('.card');
 if(!card||!S.result?.contract)return;
 const div=document.createElement('div');div.id='cyrneaH2Panel';div.innerHTML=html();
 const h=card.querySelector('h1');if(h)h.insertAdjacentElement('afterend',div);else card.prepend(div);
 if(preparation){
  const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent='RATTACHER UNE COMMANDE DU SITE — RÉFÉRENCE PAIEMENT';
  button.addEventListener('click',attach);div.insertAdjacentElement('afterend',button);
  const choice=document.querySelector('.choices input[name="docsChoice"]');
  if(choice&&!document.querySelector('input[name="docsChoice"][value="TALLY"]')){
   const label=document.createElement('label');label.className='choice';label.innerHTML='<input type="radio" name="docsChoice" value="TALLY" onchange="toggleDocsChoice()"> DÉJÀ TRANSMIS DANS TALLY';
   choice.closest('.choices')?.insertBefore(label,choice.closest('label'));
  }
  prefill();
 }
 refresh();
}
const previousMissionId=missionId;
missionId=function(){
 const ref=String(S.tallyReference||''),id=official(ref,S.result?.contract);
 if(!id)return previousMissionId();
 for(const [k,v] of Object.entries(loadActiveMissionMap()))if((k===id||v?.tallyReference===ref)&&k!==activeMissionKey(S)){
  alert('Un dossier PWA existe déjà pour ce paiement : '+k+'. Ouvrez-le.');throw Error('duplicate_payment_dossier');
 }
 return id;
};
const previousPrep=preparationMission;
preparationMission=function(){const ret=previousPrep.apply(this,arguments);mount(true);return ret};
const previousReady=ready;
ready=function(){const ret=previousReady.apply(this,arguments);mount(false);return ret};
const previousDoc=showMissionDoc;
showMissionDoc=function(kind){const ret=previousDoc.apply(this,arguments);if(kind==='fiche'||kind==='support')mount(false);return ret};
})();
