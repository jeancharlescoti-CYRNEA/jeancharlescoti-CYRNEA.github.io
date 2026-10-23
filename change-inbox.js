/* CYRNEA — boîte indépendante de demandes de modification avant paiement */
const CYRNEA_CHANGE_INBOX_URL='https://cyrnea-reservation-alerts.jeancharles-coti.workers.dev/change-requests';
let CYRNEA_CHANGE_ITEMS=[];
async function cyrneaChangeApi(action,reference=''){
 const key=getSyncKey();
 if(!key)throw new Error('sync_key_missing');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 let response;
 try{
   response=await fetch(CYRNEA_CHANGE_INBOX_URL,{
     method:'POST',
     headers:{'Content-Type':'text/plain;charset=UTF-8'},
     cache:'no-store',credentials:'omit',signal:controller.signal,
     body:JSON.stringify({key,action,reference})
   });
 }finally{clearTimeout(timeout)}
 let data=null;
 try{data=await response.json()}catch(e){}
 if(!response.ok||!data?.ok)throw new Error(String(data?.error||('change_inbox_http_'+response.status)));
 return data;
}
function cyrneaChangeLines(item){
 return [
   'CYRNEA — DEMANDE DE MODIFICATION AVANT PAIEMENT',
   'Référence bloquée : '+String(item.reference||''),
   'Statut : AUCUN PAIEMENT REÇU',
   'Univers : '+String(item.universe||'-'),
   'Mission : '+String(item.mission||'-'),
   'Créneau initial : '+String(item.schedule||'-'),
   'Client : '+String(item.customer_name||'-'),
   'Société : '+String(item.customer_company||'-'),
   'Téléphone : '+String(item.customer_phone||'-'),
   'E-mail : '+String(item.customer_email||'-'),
   'Demandée le : '+String(item.received_at||'-'),
   '',
   'À requalifier avec le client. Ne pas réutiliser cette référence pour payer.'
 ].join('\n');
}
async function cyrneaCopyChange(reference){
 const item=CYRNEA_CHANGE_ITEMS.find(x=>x.reference===reference);
 if(!item)return alert('Demande introuvable. Actualisez la liste.');
 const value=cyrneaChangeLines(item);
 try{await navigator.clipboard.writeText(value);alert('Informations copiées.');}
 catch(e){prompt('Copiez les informations ci-dessous :',value);}
}
async function cyrneaMarkChangeHandled(reference){
 if(!/^D-\d{14}-[A-F0-9]{32}$/.test(reference))return;
 if(!confirm('Avez-vous bien repris cette demande avec le client ?\n\nCela la classera comme traitée dans cette boîte. L’ancienne référence restera bloquée.'))return;
 try{await cyrneaChangeApi('mark_handled',reference);await openChangeRequests();}
 catch(e){alert('Impossible de classer cette demande : '+String(e?.message||e));}
}
function cyrneaChangeCard(item,handled){
 const ref=String(item.reference||'');
 if(!/^D-\d{14}-[A-F0-9]{32}$/.test(ref))return '';
 const pieces=[item.customer_name,item.customer_company].filter(Boolean).join(' — ');
 const top=handled?'TRAITÉE':'MODIFICATION DEMANDÉE — SANS PAIEMENT';
 return '<div class="card" style="margin-top:10px;padding:14px">'+
 '<div class="guideTitle">'+esc(top)+'</div>'+
 '<div class="missionName">'+esc(item.mission||'Mission à requalifier')+'</div>'+
 '<div class="muted" style="word-break:break-word">Réf : '+esc(ref)+'</div>'+
 '<div class="missionGoal">'+esc(item.schedule||'Créneau non précisé')+'</div>'+
 '<div style="margin-top:10px"><b>Client :</b> '+esc(pieces||'Non renseigné')+'</div>'+
 '<div><b>Téléphone :</b> '+esc(item.customer_phone||'Non renseigné')+'</div>'+
 '<div><b>E-mail :</b> '+esc(item.customer_email||'Non renseigné')+'</div>'+
 '<div class="toolbar" style="margin-top:12px">'+
 '<button type="button" class="btn ghost" onclick="cyrneaCopyChange(\''+ref+'\')">COPIER LES INFORMATIONS</button>'+
 (handled?'':'<button type="button" class="btn primary" onclick="cyrneaMarkChangeHandled(\''+ref+'\')">MARQUER TRAITÉE</button>')+
 '</div></div>';
}
function cyrneaRenderChanges(items,partial){
 CYRNEA_CHANGE_ITEMS=Array.isArray(items)?items:[];
 const pending=CYRNEA_CHANGE_ITEMS.filter(x=>!x.handled_at);
 const handled=CYRNEA_CHANGE_ITEMS.filter(x=>!!x.handled_at);
 draw('<div class="card"><h1>Demandes de modification</h1>'+
 '<div class="operatorOnly">Ces demandes sont <b>AVANT PAIEMENT</b>. Elles ne sont pas des missions confirmées. L’ancienne référence reste bloquée jusqu’à la création d’une nouvelle demande.</div>'+
 '<div class="guideTitle">À REQUALIFIER — '+pending.length+'</div>'+
 (pending.length?pending.map(x=>cyrneaChangeCard(x,false)).join(''):'<div class="neutral">Aucune demande en attente.</div>')+
 (handled.length?'<div class="guideTitle" style="margin-top:20px">DÉJÀ TRAITÉES — '+handled.length+'</div>'+handled.map(x=>cyrneaChangeCard(x,true)).join(''):'')+
 (partial?'<div class="neutral">Liste partielle : seules les 150 demandes les plus récentes sont affichées.</div>':'')+
 '<div class="toolbar" style="margin-top:16px"><button type="button" class="btn primary" onclick="openChangeRequests()">ACTUALISER</button><button type="button" class="btn ghost" onclick="home(false)">← RETOUR ACCUEIL</button></div></div>');
}
async function openChangeRequests(){
 if(!getSyncKey()){alert('Activez d’abord la synchronisation CYRNEA sur cet appareil.');return;}
 draw('<div class="card"><h1>Demandes de modification</h1><div class="neutral">Lecture sécurisée des demandes…</div><div class="toolbar"><button class="btn ghost" onclick="home(false)">← RETOUR ACCUEIL</button></div></div>');
 try{const response=await cyrneaChangeApi('list');cyrneaRenderChanges(response.requests,response.partial);}
 catch(e){
   draw('<div class="card"><h1>Demandes de modification</h1><div class="neutral">Accès impossible : '+esc(String(e?.message||e))+'. Les missions existantes et les paiements ne sont pas affectés.</div><div class="toolbar"><button class="btn ghost" onclick="home(false)">← RETOUR ACCUEIL</button></div></div>');
 }
}
