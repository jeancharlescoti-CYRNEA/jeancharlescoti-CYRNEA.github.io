/* CYRNEA — règles opérationnelles pures. Aucune écriture réseau ni paiement. */
(function(root){
'use strict';
const SPEC={
 access:{name:"Accès / rendez-vous",fields:[
  ["scope","Opération exacte et limite convenue",12],
  ["person","Personne autorisée / intervenant et coordonnées (ou accès autonome explicitement convenu)",5],
  ["closing","Fermeture des lieux et remise en sécurité prévues",5]]},
 logistics:{name:"Présence logistique",fields:[
  ["scope","Opération attendue et durée totale convenue",12],
  ["person","Intervenant ou livreur désigné, rendez-vous exact",5],
  ["closing","Fin de l'opération, départ du tiers et fermeture",5]]},
 gestures:{name:"Gestes simples",fields:[
  ["scope","Liste exacte des gestes autorisés",12],
  ["equipment","Équipements / emplacement précis",5],
  ["limits","Limites à respecter et conduite en cas d'anomalie",8]]},
 keys:{name:"Clés, badges et télécommandes",fields:[
  ["scope","Opération(s) prévue(s) et quantité à contrôler",12],
  ["origin","Provenance et personne qui remet les clés",5],
  ["destination","Destinataire ou lieu de restitution, preuve convenue",5]]},
 visit:{name:"Visite factuelle de site",fields:[
  ["scope","Points précis à observer ou documenter",12],
  ["zones","Zones autorisées et points non accessibles",5],
  ["photos","Photos, repères ou documents attendus (ou aucun si convenu)",5]]},
 meeting:{name:"Présence à rendez-vous / projet",fields:[
  ["scope","Objectif précis et zones concernées",12],
  ["people","Interlocuteurs / visio prévus (ou aucun)",5],
  ["questions","Questions convenues (ou aucune, simple présence factuelle)",5]]},
 observe:{name:"Observation factuelle",fields:[
  ["scope","Points à observer, définis à l'avance",12],
  ["zones","Périmètre autorisé et limites",5],
  ["photos","Vues de référence et preuves prévues (ou aucune)",5]]},
 compare:{name:"Observations comparatives",fields:[
  ["scope","Situation unique et objet à comparer",12],
  ["referencePoints","Points de repère, UN PAR LIGNE (1 à 8, mêmes pour tous les passages)",8],
  ["photoInstructions","Angles de prise de vue à reproduire (ou mention qu'aucune photo n'est possible)",8]]},
 weather:{name:"Intervention avant / après intempéries",fields:[
  ["scope","Éléments précis à observer ou mettre à l'abri",12],
  ["zone","Zones accessibles et moyen d'accès",5],
  ["safety","Interdictions, sécurité et cas d'arrêt",8]]},
 other:{name:"Mission ponctuelle",fields:[["scope","Objectif et limites exactes",12],["means","Modalités d'accès et de preuve",5]]}
};
function typeOf(mission, need="", sub="", multi=false){
 const m=String(mission||"").toUpperCase(),n=String(need||"").toUpperCase(),s=String(sub||"").toUpperCase();
 if(m.includes("INTEMPÉRIE")||m.includes("INTEMPERIE")||n==="WEATHER")return "weather";
 if(multi&&(m.includes("SUIV")||m.includes("CONTINUIT")||m.includes("OBSERVATIONS")||m.includes("CLÉS — 2 PASSAGES")||m.includes("RÉCUPÉRATION CLÉ"))) {
  if(m.includes("CLÉ")||m.includes("BADGE"))return "keys";
  return "compare";
 }
 if(m.includes("CLÉ")||m.includes("BADGE")||n==="KEY"||s.startsWith("KEY_"))return "keys";
 if(m.includes("GESTES SIMPLES"))return "gestures";
 if(m.includes("ACCÈS")||m.includes("RELAIS SIMPLE")||n==="THIRD"||n==="ART"||n==="DEL")return "access";
 if(m.includes("LOGISTIQUE"))return "logistics";
 if(m.includes("VISITE TERRAIN"))return "visit";
 if(m.includes("PRÉSENCE PROJET"))return "meeting";
 if(m.includes("VOIR")||m.includes("DÉCIDER")||n==="SEE"||n==="DECIDE")return "observe";
 if(m.includes("SUIV")||m.includes("CONTINUIT")||m.includes("OBSERVATIONS"))return "compare";
 if(m==="RELAIS"&&n==="OPEN")return "access";
 return "other";
}
function references(s){
 const arr=String(s||"").split(/\r?\n|;/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
 return arr;
}
function fingerprintRef(xs){return JSON.stringify(xs.map(x=>x.toLocaleLowerCase('fr-FR')))}
function requiredFor(mission,need,sub,multi){return SPEC[typeOf(mission,need,sub,multi)]||SPEC.other}
function normalize(plan,st){
 const kind=typeOf(st?.result?.mission,st?.need,st?.sub,st?.result?.multi);
 const fields={};for(const [id] of SPEC[kind].fields)fields[id]=String(plan?.fields?.[id]||"").trim();
 return {kind,mission:String(st?.result?.mission||""),fields,sequence:String(plan?.sequence||""),savedAt:plan?.savedAt||""};
}
function check(plan,st,prior){
 const normalized=normalize(plan,st),errors=[],schema=SPEC[normalized.kind];
 if(!st?.prep?.addr && !st?.pendingPrepAddress)errors.push("Adresse exacte de mission absente.");
 for(const [id,label,min] of schema.fields){
  const val=normalized.fields[id];if(val.length<min)errors.push(label+" : précisez avant départ.");
 }
 if(normalized.kind==="compare"){
  const refs=references(normalized.fields.referencePoints);
  if(refs.length<1||refs.length>8)errors.push("Prévoir entre 1 et 8 repères comparatifs.");
  if(new Set(refs.map(x=>x.toLocaleLowerCase('fr-FR'))).size!==refs.length)errors.push("Les points de repère doivent être distincts.");
  if(prior?.length && fingerprintRef(prior)!==fingerprintRef(refs))errors.push("Les repères d'origine ne peuvent pas être modifiés après le premier passage.");
 }
 if(normalized.kind==="keys"&&st?.result?.multi && !["GIVE_GET","GET_GIVE"].includes(normalized.sequence))errors.push("Pour les clés en deux passages, indiquer l'ordre REMETTRE/RÉCUPÉRER.");
 return {ok:errors.length===0,errors,plan:normalized,refs:normalized.kind==="compare"?references(normalized.fields.referencePoints):[]};
}
function comparisonStatuses(passage){return Number(passage)>1?["IDENTIQUE","DIFFERENT","NON_OBSERVABLE"]:["OBSERVE","NON_OBSERVABLE"]}
function checkObservations(plan,passage,obs){
 const errs=[],p=Number(passage||1),allowed=comparisonStatuses(p);
 if(plan?.kind!=="compare")return {ok:true,errors:[]};
 const refs=references(plan.fields?.referencePoints),records=obs&&typeof obs==="object"?obs:{};
 for(let i=0;i<refs.length;i++){
  const row=records[i]||{},status=String(row.status||""),description=String(row.note||"").trim();
  if(!allowed.includes(status)){errs.push("Repère "+(i+1)+" (« "+refs[i]+" ») : choisir ce qui a été réellement constaté.");continue}
  if((status!=="IDENTIQUE")&&description.length<8)errs.push("Repère "+(i+1)+" : décrire factuellement le constat ou la limite.");
 }
 return {ok:errs.length===0,errors:errs};
}
function comparisonGrid(plan,history){
 const refs=references(plan?.fields?.referencePoints||"");
 const passages=Array.isArray(history)?history:[];
 return refs.map((label,i)=>({
  label,index:i,history:passages.map(p=>({passage:Number(p.passage||0),...(p.observations?.[i]||{})}))
 }));
}
const api={SPEC,typeOf,references,fingerprintRef,requiredFor,normalize,check,comparisonStatuses,checkObservations,comparisonGrid};
root.CyrneaMissionSchema=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:this);