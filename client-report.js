/* CYRNEA — COMPTE RENDU CLIENT + PIECES, version de travail 17/11/2026. */
(function(){
'use strict';
function safe(x){return String(x==null?'':x)}
function html(x){return safe(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function tidyName(x){return safe(x||'piece').replace(/[\\/:*?"<>|\x00-\x1f]+/g,'-').slice(0,120)}
function points(x){return safe(x).split(/\s*;\s*|\n+/).map(s=>s.trim()).filter(Boolean)}
function passages(st){
 const arr=(Array.isArray(st.passageHistory)?st.passageHistory:[]).map(p=>({...p}));
 if(st.arrivalAt&&!arr.some(p=>Number(p.passage)===Number(st.passage||1)))
  arr.push({passage:st.passage||1,date:st.date,slot:st.slot,arrivalAt:st.arrivalAt,departureAt:st.departureAt,facts:st.facts,incident:st.incident,reportDetails:st.reportDetails||{},media:st.terrainMedia||[]});
 return arr.sort((a,b)=>Number(a.passage)-Number(b.passage));
}
function model(media){
 const st=S,mission=typeof b2bCommercialMissionName==='function'?b2bCommercialMissionName(st.result?.mission):st.result?.mission;
 return {reference:st.missionId||st.draftKey||'—',client:st.name||'Non renseigné',mission:mission||'Mission non renseignée',contract:st.result?.contract||'',site:st.prep?.addr||st.city||'Non renseigné',objet:st.obj||'Non renseigné',schedule:typeof scheduleText==='function'?scheduleText():(st.date||''),status:document.getElementById('fs')?.value||st.finalStatus||(st.departureAt?'MISSION RÉALISÉE — RESTITUTION À VALIDER':'BROUILLON — TERRAIN NON TERMINÉ'),arrivee:st.arrivalAt||'',depart:st.departureAt||'',faits:points(st.facts),incident:st.incident||'Non renseigné',passages:passages(st),details:st.reportDetails||{},media};
}
function sections(m){
 const a=[
 ['IDENTIFICATION',[
 ['Référence de mission',m.reference],['Client / entreprise',m.client],['Mission',m.mission],['Adresse du site',m.site],['Date et créneau',m.schedule],['Statut',m.status]]],
 ['OBJET CONVENU',[['Périmètre',m.objet]]]
 ];
 if(m.passages.length>1)for(const p of m.passages)a.push(['PASSAGE '+p.passage,[
  ['Date et heure prévue',[p.date,p.slot].filter(Boolean).join(' ')||'Non renseigné'],
  ['Arrivée',p.arrivalAt||'Non horodatée'],
  ['Départ',p.departureAt||'Non horodaté'],
  ['Faits et actions réellement relevés',points(p.facts).join(' ; ')||'Non renseignés'],
  ['Incident / limite',p.incident||'Non renseigné']]]);
 else a.push(['OBSERVATIONS ET ACTIONS',[
  ['Arrivée',m.arrivee||'Non horodatée'],['Départ',m.depart||'Non horodaté'],
  ['Faits relevés / actions réalisées',m.faits.join(' ; ')||'Non renseignés'],
  ['Incident, impossibilité ou limite',m.incident]]]);
 const detailed=m.passages.length>1?m.passages:[{passage:1,reportDetails:m.details||{}}];
 for(const passage of detailed){
  const d=passage.reportDetails||{};
  if(d.observations||d.declarations||d.limites)
   a.push([(m.passages.length>1?'COMPLÉMENTS — PASSAGE '+passage.passage:'PRÉCISIONS FACTUELLES'),[
    ['Observations complémentaires',d.observations||'Aucune précision complémentaire'],
    ['Déclarations attribuées à des tiers',d.declarations||'Aucune déclaration complémentaire'],
    ['Limites / éléments non vérifiés',d.limites||'Aucune limite complémentaire signalée']
   ]]);
 }
 a.push(['PIÈCES JOINTES',[['Inventaire',m.media.map(r=>'Passage '+(r.passage||'client')+' — '+r.name).join(' ; ')||'Aucune pièce']]]); 
 a.push(['NATURE DU COMPTE RENDU',[['Limites','Restitution factuelle des informations enregistrées. Aucune expertise, diagnostic, conformité, réception de travaux ou décision prise à la place du client. Les éléments non observables restent non vérifiés.']]]);
 return a;
}
function reportHtml(m){return '<h1 style="font-size:24px;margin:0 0 8px">CYRNEA — COMPTE RENDU CLIENT</h1><p><b>'+html(m.mission)+'</b> — '+html(m.reference)+'</p>'+sections(m).map(([title,rows])=>'<h2 style="font-size:15px;margin:20px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px">'+html(title)+'</h2>'+rows.map(([k,v])=>'<p style="margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere"><b>'+html(k)+' :</b> '+html(v)+'</p>').join('')).join('')}
function pdfText(s){
 const cp={8211:150,8212:151,8216:145,8217:146,8220:147,8221:148,8230:133,8364:128,338:140,339:156,376:159};
 let x='';
 for(const c of safe(s)){let n=c.codePointAt(0);if(cp[n]!=null)n=cp[n];if(n>255)n=63;
  if(n===40||n===41||n===92)x+='\\'+String.fromCharCode(n);
  else if(n<32||n>126)x+='\\'+n.toString(8).padStart(3,'0');
  else x+=String.fromCharCode(n)}
 return x;
}
function wrap(s,max){
 const out=[];for(const par of safe(s).split('\n')){
  let row='';for(let word of par.split(/\s+/)){if(!word)continue;
   while(word.length>max){if(row){out.push(row);row=''}out.push(word.slice(0,max));word=word.slice(max)}
   if(!word)continue;if(row.length+word.length+1>max){out.push(row);row=word}else row+=(row?' ':'')+word}
  out.push(row||' ')}return out;
}
function pdf(m){
 const lines=[];function add(t,b,size,gap){lines.push({t:safe(t),b:!!b,s:size||10,g:gap||0})}
 add('CYRNEA — COMPTE RENDU CLIENT',true,17,15);add(m.mission+' — '+m.reference,true,12,8);
 for(const [title,rows] of sections(m)){add(title,true,12,12);
  for(const [k,v] of rows){add(k+' :',true,10,5);for(const l of wrap(v,93))add(l,false,10,0)}}
 const pages=[[]];let y=780;for(const l of lines){const h=l.s*1.5+l.g;if(y-h<60){pages.push([]);y=780}pages[pages.length-1].push({...l,y:y-l.g});y-=h}
 const encoder=new TextEncoder(),objs={1:'<< /Type /Catalog /Pages 2 0 R >>',3:'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',4:'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'},ids=[];
 pages.forEach((rows,i)=>{const p=5+i*2,c=p+1;ids.push(p+' 0 R');
  let stream='0 0 0 rg\n';
  for(const r of rows)stream+='BT /F'+(r.b?'2':'1')+' '+r.s+' Tf 1 0 0 1 48 '+r.y.toFixed(2)+' Tm ('+pdfText(r.t)+') Tj ET\n';
  stream+='BT /F1 8 Tf 1 0 0 1 48 38 Tm ('+pdfText(m.reference)+' — Page '+(i+1)+' / '+pages.length+') Tj ET\n';
  objs[p]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+c+' 0 R >>';
  objs[c]='<< /Length '+encoder.encode(stream).length+' >>\nstream\n'+stream+'endstream';
 });
 objs[2]='<< /Type /Pages /Kids ['+ids.join(' ')+'] /Count '+ids.length+' >>';
 let data='%PDF-1.4\n%CYRNEA\n',offs=[0],max=4+pages.length*2;
 for(let i=1;i<=max;i++){offs[i]=encoder.encode(data).length;data+=i+' 0 obj\n'+objs[i]+'\nendobj\n'}
 const xref=encoder.encode(data).length;data+='xref\n0 '+(max+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=max;i++)data+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
 data+='trailer\n<< /Size '+(max+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return encoder.encode(data);
}
function expectedFiles(){
 const e=[];for(const p of (S.passageHistory||[]))for(const n of (p.media||[]))e.push(Number(p.passage||1)+'|'+n);
 for(const n of (S.terrainMedia||[]))e.push(Number(S.passage||1)+'|'+n);
 return [...new Set(e)];
}
async function mediaOnThisDevice(){
 const r=await getTerrainMediaRecords(S,true);
 const names=new Set(r.map(v=>Number(v.passage||0)+'|'+v.name));
 const missing=expectedFiles().filter(n=>!names.has(n));
 if(missing.length)throw Error('Pièces attendues absentes de cet appareil : '+missing.join(', ')+'. Utiliser l’iPhone ayant pris ces photos.');
 return r;
}
function emailText(m){return 'Objet : CYRNEA — Compte rendu de mission '+m.reference+'\n\nBonjour,\n\nVeuillez trouver ci-joint le dossier de notre intervention « '+m.mission+' » sur le site '+m.site+'.\n\nIl contient le compte rendu factuel au format PDF et les pièces associées lorsqu’elles existent.\n\nLes décisions vous appartiennent.\n\nCordialement,\nCYRNEA\n'}
function fingerprint(){return JSON.stringify({id:S.missionId,p:S.passage,faits:S.facts,incident:S.incident,details:S.reportDetails||{},depart:S.departureAt,historique:S.passageHistory||[],fichiers:S.terrainMedia||[],statut:document.getElementById('fs')?.value||S.finalStatus||''})}
async function addClientDocs(){
 const input=document.getElementById('crDocs'),files=[...(input?.files||[])];
 if(!files.length)return alert('Sélectionnez les documents à joindre.');
 try{await requestPersistentStorage();const db=await openMediaDb();
  await new Promise((resolve,reject)=>{const tx=db.transaction(MEDIA_DB_STORE,'readwrite'),store=tx.objectStore(MEDIA_DB_STORE);
   for(const f of files)store.put({id:[activeMissionKey(S),0,f.name,f.size,f.lastModified||0].join('::'),missionId:activeMissionKey(S),passage:0,missionPassage:activeMissionKey(S)+'::0',name:f.name,type:f.type||'application/octet-stream',size:f.size,lastModified:f.lastModified||0,storedAt:Date.now(),blob:f});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
  db.close();S.clientReportExportedAt='';S.archivePreparedAt='';save();await openReport();
 }catch(e){alert('Pièce non conservée : '+String(e.message||e))}
}
async function openReport(){
 if(typeof saveRestitutionDetails==='function'&&document.getElementById('crNotesObservations'))saveRestitutionDetails();
 try{const m=model(await mediaOnThisDevice());document.getElementById('crDialog')?.remove();
  const d=document.createElement('div');d.id='crDialog';d.style.cssText='position:fixed;inset:0;overflow-y:auto;z-index:9999;background:#202425ee;padding:12px 6px';
  d.innerHTML='<div style="max-width:760px;margin:auto;background:white;padding:18px;box-sizing:border-box;line-height:1.5;font-family:Arial;color:#303437">'+
  '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" onclick="crCloseReport()">FERMER</button><button type="button" onclick="crExportClient()">EXPORTER PDF + PIÈCES</button></div>'+
  (S.departureAt?'':'<p style="color:#ad5100"><b>BROUILLON — terrain non terminé</b></p>')+reportHtml(m)+
  '<p><b>Documents reçus dans Tally :</b> s’ils sont utiles et absents du dossier, ajoutez-les manuellement. Les originaux restent dans Tally.</p>'+
  '<input id="crDocs" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.txt" style="max-width:100%"><button type="button" onclick="crAddClientDocs()">ENREGISTRER CES PIÈCES</button></div>';
  document.body.appendChild(d);document.body.style.overflow='hidden';
 }catch(e){alert('Compte rendu indisponible : '+String(e.message||e))}
}
function closeReport(){document.getElementById('crDialog')?.remove();document.body.style.overflow=''}
async function exportClient(){
 if(typeof saveRestitutionDetails==='function'&&document.getElementById('crNotesObservations'))saveRestitutionDetails();
 if(!S.departureAt)return alert('Terminer le terrain avant d’envoyer un compte rendu client.');
 if(S.stage==='RESTITUTION')return alert('Valider la restitution puis choisir le statut de clôture avant l’export définitif.');
 try{const media=await mediaOnThisDevice(),m=model(media),enc=new TextEncoder();
  const items=[{name:'COMPTE_RENDU_CLIENT.pdf',data:pdf(m)},{name:'EMAIL_PRET_A_ENVOYER.txt',data:enc.encode(emailText(m))}];
  const seen=new Set();
  for(const f of media){let root='PIECES/'+(Number(f.passage)===0?'DOCUMENTS_CLIENT':'PASSAGE_'+String(f.passage).padStart(2,'0'))+'/';
   let name=tidyName(f.name),path=root+name,i=1;while(seen.has(path)){i++;path=root+i+'_'+name}seen.add(path);
   items.push({name:path,data:new Uint8Array(await f.blob.arrayBuffer())});}
  const zip=await makeStoredZip(items),file=new File([zip],tidyName(m.reference)+'_CLIENT.zip',{type:'application/zip'});
  if(navigator.canShare&&navigator.share&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'CYRNEA — dossier client '+m.reference,text:'Compte rendu factuel et pièces. Envoi sous votre contrôle.'});
  else {const url=URL.createObjectURL(zip),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);alert('ZIP client téléchargé : vérifier son contenu et son enregistrement.');}
  S.clientReportExportedAt=nowStamp();S.clientReportFingerprint=fingerprint();save();closeReport();
 }catch(e){if(e?.name!=='AbortError')alert('Export non terminé : '+String(e.message||e))}
}
function crInstallReportActions(){
 if(!S.result||!S.missionId||!['RESTITUTION','CLÔTURE','ARCHIVE'].includes(S.stage))return;
 const host=document.getElementById('app'),card=host?.querySelector('.card');if(!card)return;
 const closeBtn=host.querySelector('button[onclick="finalizeArchive()"]');
 if(!host.querySelector('button[onclick="crExportClient()"]')){
  const panel=document.createElement('div');panel.className='neutral';panel.style.margin='14px 0';
  panel.innerHTML='<b>COMPTE RENDU CLIENT</b><p>PDF factuel et pièces réellement conservées sur cet appareil, dans un ZIP distinct de l’archive interne.</p><div class="toolbar"><button type="button" class="btn ghost" onclick="crOpenReport()">PRÉVISUALISER</button><button type="button" class="btn primary" onclick="crExportClient()">EXPORTER PDF + PIÈCES (ZIP)</button></div>';
  if(S.stage==='CLÔTURE'&&closeBtn)closeBtn.before(panel);else card.appendChild(panel);
 }
 if(S.stage==='CLÔTURE'&&closeBtn&&!document.getElementById('archiveIcloudChecked')){
  const archiveUI=document.createElement('div');archiveUI.className='neutral';
  archiveUI.innerHTML='<b>ARCHIVAGE INTERNE</b><div class="toolbar"><button id="archiveExportBtn" type="button" class="btn primary" onclick="exportMissionArchive()">EXPORTER DOSSIER INTERNE → iCLOUD</button></div><label class="check"><input id="archiveIcloudChecked" type="checkbox"><span>J’atteste avoir enregistré et contrôlé l’archive interne dans iCloud Drive.</span></label>';
  closeBtn.before(archiveUI);
 }
}
const oldDraw=draw;
draw=function(content,remember){const ret=oldDraw(content,remember);crInstallReportActions();return ret};
const oldFinalize=finalizeArchive;
finalizeArchive=function(){
 if(!S.clientReportExportedAt||S.clientReportFingerprint!==fingerprint())return alert('Exporter le compte rendu client actualisé (PDF et pièces) avant archivage.');
 if(!S.archivePreparedAt)return alert('Exporter le dossier interne avant archivage.');
 if(!document.getElementById('archiveIcloudChecked')?.checked)return alert('Confirmer le classement de l’archive dans iCloud Drive.');
 return oldFinalize();
};
window.crOpenReport=openReport;window.crCloseReport=closeReport;window.crExportClient=exportClient;window.crAddClientDocs=addClientDocs;
window.crReportPdf=pdf;window.crReportModel=model;
// Le démarrage de index.html précède le chargement de ce module : réhydrater l’écran actuel.
crInstallReportActions();
})();