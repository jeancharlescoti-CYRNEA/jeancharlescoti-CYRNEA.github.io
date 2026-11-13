/**
 * Correctif ciblé CYRNEA – 2 novembre 2026 (à déployer après sauvegarde du Worker LIVE).
 * Contrôle serveur des prix PWA. Les devis personnalisés demeurent transmissibles
 * mais ne sont PAS automatiquement encaissables à un montant libre.
 * Références déjà encaissées et routes des sites restent inchangées.
 */
/**
 * CYRNEA - Gateway paiement client V7
 * Objet : pont sécurisé PWA interne -> Tally -> page paiement client.
 * Rétractation 14 jours :
 * - contrôle uniquement RELAIS et PRÉSENCE PROPRIÉTAIRES ;
 * - PRÉSENCE ENTREPRISES exclue de la mécanique consommateur ;
 * - première date du schedule utilisée pour les missions multi-passage.
 * Retours client : modification du choix de rétractation sans ressaisie + demande de requalification avant paiement.
 * V6 consolidée :
 * - retours client avant paiement, y compris après validation Tally ;
 * - verrouillage anti-rejeu / anti-retard des webhooks ;
 * - contrôle branche PRÉSENCE Propriétaire / Entreprise ;
 * - paiement déjà reçu détecté avant réaffichage d'un moyen de paiement ;
 * - données client initiales conservées pour retour Tally sans ressaisie ;
 * - ancienne référence figée en CHANGE_REQUESTED, nouvelle référence obligatoire après requalification.
 * - décodage fiable des réponses Tally à choix multiple : les webhooks fournissent des IDs d’options dans value, résolus ici vers options[].text avant contrôle métier.
 * - message client de modification clarifié.
 * V7 :
 * - Stripe Checkout dynamique côté serveur : aucun Payment Link par tarif ;
 * - montant/devise/référence relus depuis INTENTS, jamais depuis le navigateur ;
 * - contrôle anti-double-paiement avant création de session ;
 * - compatible avec le webhook Stripe/KV déjà validé via client_reference_id ;
 * - une seule session Stripe par référence (réutilisation + idempotency-key) ;
 * - expiration serveur de la session Stripe avant toute demande de modification.
 * V7.4 :
 * - PayPal Orders v2 dynamique côté serveur en Sandbox : aucun lien fixe par tarif ;
 * - montant/devise/référence relus depuis INTENTS, jamais depuis le navigateur ;
 * - approbation PayPal puis capture serveur ; aucun statut PAID sur simple retour navigateur ;
 * - preuve PAYPAL écrite dans le KV central PAYMENTS uniquement après capture COMPLETED et contrôle du montant ;
 * - PAYPAL_MODE absent = sandbox par sécurité ; live uniquement si PAYPAL_MODE=live avec identifiants live ;
 * - Stripe/Tally/CGV/règles métier inchangés.
 * V7.3 :
 * - ajout du formulaire Tally B2B dédié RGp0PQ ;
 * - B2B validé sans dépendre de la question d'audience du formulaire Propriétaires ;
 * - société B2B requise et préremplie ;
 * - retours de modification B2B renvoyés vers RGp0PQ ;
 * - aucune modification Stripe / webhook / KV / montant.
 * V7.1 :
 * - correctif Safari ciblé sur le déclenchement du POST /stripe-checkout :
 *   lien explicite qui soumet programmatiquement le formulaire POST caché ;
 * - aucun changement de montant, référence, KV, webhook, idempotence ou logique de paiement.
 */

const INTENT_TTL_SECONDS = 30 * 24 * 60 * 60;

const REF_RE = /^D-\d{14}-[A-F0-9]{32}$/;

const TALLY_RELAIS_HS_URL = 'https://tally.so/r/b5oz46';
const TALLY_RELAIS_STANDARD_URL = 'https://tally.so/r/xXOqpk';
const TALLY_PRESENCE_HS_URL = 'https://tally.so/r/GxZbE2';
const TALLY_PRESENCE_STANDARD_URL = 'https://tally.so/r/7R6AZa';
const TALLY_B2B_HS_URL = 'https://tally.so/r/RGp0PQ';
const TALLY_B2B_STANDARD_URL = 'https://tally.so/r/2EQWLD';
const PAYMENT_STATUS_BASE = 'https://cyrnea-payments-webhook.jeancharles-coti.workers.dev';

export default {

  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (url.pathname === '/site-relais-intent') return siteRelaisCorsResponse(request, null, 204);
      if (url.pathname === '/site-presence-intent') return sitePresenceCorsResponse(request, null, 204);
      if (url.pathname === '/short-link') return shortLinkCors(request, env, null, 204);
      return corsResponse(request, env, null, 204);
    }

    try {

      if (url.pathname === '/health' && request.method === 'GET') {

        return json({ ok: true, service: 'cyrnea-payment-gateway-v9.3.2-owner-brief-20261104' }, 200);

      }

      if (url.pathname === '/intent' && request.method === 'POST') {

        return await createIntent(request, env);

      }

      if (url.pathname === '/short-link' && request.method === 'POST') {
        return await createShortLink(request, env);
      }

      if (url.pathname === '/site-relais-intent' && request.method === 'POST') {

        return await createSiteRelaisIntent(request, env);

      }

      if (url.pathname === '/site-presence-intent' && request.method === 'POST') {

        return await createSitePresenceIntent(request, env);

      }

      if (url.pathname === '/tally-validation-webhook' && request.method === 'POST') {

        return await handleTallyWebhook(request, env);

      }

      if (url.pathname === '/validation-status' && request.method === 'GET') {

        return await validationStatus(url, env, request);

      }

      if (url.pathname === '/pay' && request.method === 'GET') {

        return await paymentPage(url, env);

      }

      if (url.pathname === '/stripe-checkout' && (request.method === 'GET' || request.method === 'POST')) {

        return await createStripeCheckout(request, env);

      }

      if (url.pathname === '/paypal-checkout' && (request.method === 'GET' || request.method === 'POST')) {

        return await createPayPalCheckout(request, env);

      }

      if (url.pathname === '/paypal-return' && request.method === 'GET') {

        return await paypalReturn(url, env, ctx);

      }

      if (url.pathname === '/paypal-cancel' && request.method === 'GET') {

        return paypalCancel(url);

      }

      // Le navigateur attend les coordonnées transmises par Tally, jamais de ressaisie.
      if (url.pathname === '/change-mission-ready' && request.method === 'GET') {
        return await changeMissionReady(url, env);
      }

      if (url.pathname === '/change-mission' && request.method === 'GET') {

        return await changeMissionPage(url, env);

      }

      if (url.pathname === '/change-mission' && request.method === 'POST') {

        return await changeMissionRequest(request, env);

      }

      return new Response('Not found', { status: 404 });

    } catch (err) {

      return json({ ok: false, error: 'internal_error' }, 500);

    }

  }

};

const RELAIS_SITE_ORIGINS = new Set([
  'https://www.relaisproprietaire.fr',
  'https://relaisproprietaire.fr',
  'https://www.cyrnea-immobilier.com',
  'https://cyrnea-immobilier.com',
  'https://m.cyrnea-immobilier.com'
]);


const PRESENCE_SITE_ORIGINS = new Set([
  'https://www.cyrneapresence.fr',
  'https://cyrneapresence.fr',
  'https://www.cyrnea-immobilier.com',
  'https://cyrnea-immobilier.com',
  'https://m.cyrnea-immobilier.com',
  'https://www.relaisproprietaire.fr',
  'https://relaisproprietaire.fr'
]);

const PRESENCE_SITE_MISSIONS = Object.freeze({
  voir: {kind:'voir', mission:'VOIR PRÉSENCE', object:'Voir ce qu’il en est sur place'},
  decider: {kind:'decider', mission:'DÉCIDER', object:'Décider sans vous déplacer'},
  suivre: {kind:'suivre', mission:'SUIVRE', object:'Comparer la même situation à trois moments clés'}
});

const RELAIS_SITE_MISSIONS = Object.freeze({
  cle: {kind:'simple', mission:'RELAIS SIMPLE', object:'Remise ou récupération d’une clé ou d’un badge'},
  artisan_acces: {kind:'simple', mission:'RELAIS SIMPLE', object:'Accès à votre professionnel puis départ'},
  artisan_presence: {kind:'relais', mission:'RELAIS', object:'Présence pendant l’intervention de votre professionnel'},
  artisan_voir: {kind:'voir', mission:'VOIR RELAIS', object:'Voir le résultat visible après l’intervention'},
  proche_acces: {kind:'simple', mission:'RELAIS SIMPLE', object:'Accès ponctuel d’un proche ou d’un tiers autorisé'},
  preparation_simple: {kind:'relais', mission:'RELAIS', object:'Ouvrir avant votre arrivée'},
  livraison_acces: {kind:'simple', mission:'RELAIS SIMPLE', object:'Accès au livreur, installateur ou dépanneur puis départ'},
  livraison_presence: {kind:'relais', mission:'RELAIS', object:'Présence pendant la livraison, l’installation ou le dépannage'},
  livraison_voir: {kind:'voir', mission:'VOIR RELAIS', object:'Voir le résultat visible après la livraison ou l’intervention'},
  meteo_simple: {kind:'relais', mission:'AVANT INTEMPÉRIE', object:'Avant intempérie — actions simples précisément définies'},
  meteo_apres_simple: {kind:'simple', mission:'APRÈS INTEMPÉRIE — VÉRIFICATION PRATIQUE', object:'Après intempérie — vérification pratique courte'},
  meteo_voir: {kind:'voir', mission:'VOIR RELAIS', object:'Voir après intempérie'},
  voir_general: {kind:'voir', mission:'VOIR RELAIS', object:'Voir précisément une situation'},
  // Extension ciblée RELAIS : nombre de passages explicite et tarifé côté serveur.
  suivre: {kind:'suivre', mission:'SUIVRE', object:'Comparer une même situation à deux ou trois moments convenus'}
});

async function createSitePresenceIntent(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!PRESENCE_SITE_ORIGINS.has(origin)) {
    return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'origin_not_allowed' }), 403, true);
  }

  const body = await request.json().catch(() => null);
  if (!body) return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_json' }), 400, true);

  const type = clean(body.type, 80);
  const requestedMode = clean(body.requested_mode, 30).toLowerCase();
  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  const cfg = Object.prototype.hasOwnProperty.call(PRESENCE_SITE_MISSIONS, type) ? PRESENCE_SITE_MISSIONS[type] : null;

  if (!cfg) return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'unknown_mission' }), 400, true);
  // Tarifs propriétaires figés : aucune option prioritaire, soirée ou dimanche.
  if (requestedMode !== 'standard') {
    return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_mode' }), 400, true);
  }
  // SUIVRE : la formule doit être explicite. Un ancien formulaire / un appel
  // sans sélection de 2 ou 3 observations ne peut jamais être tarifé à 980 €.
  const observations = cfg.kind === 'suivre' ? Number(body.observations) : null;
  if (cfg.kind === 'suivre' && ![2,3].includes(observations)) {
    return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'suivre_formula_required' }), 422, true);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time)) {
    return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_schedule' }), 400, true);
  }

  const slotUtc = parisLocalToUtc(date, time);
  if (!slotUtc) return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_schedule' }), 400, true);

  const now = new Date();
  if (slotUtc.getTime() <= now.getTime()) {
    return sitePresenceCorsResponse(request, JSON.stringify({ ok:false, error:'past_schedule' }), 422, true);
  }

  const hour = Number(time.slice(0,2));
  const minute = Number(time.slice(3,5));
  const minutes = hour * 60 + minute;
  // La demande peut être faite à tout créneau futur : CYRNEA décidera
  // après paiement de confirmer, proposer un autre créneau ou rembourser.
  // Aucun supplément propriétaire n'est ajouté pour jour/heure/délai.
  const effectiveMode = 'standard';
  // Les montants proviennent EXCLUSIVEMENT de la mission et, pour SUIVRE,
  // du nombre de passages explicitement choisi. Aucune majoration.
  const amountEuros = cfg.kind === 'suivre' ? (observations === 2 ? 490 : 690) : 260;
  const mission = cfg.mission;
  const object = cfg.kind === 'suivre'
    ? `SUIVRE — ${observations} observations factuelles ponctuelles (1 h maximum par passage)`
    : cfg.object;
  const availabilityLabel = 'STANDARD';

  const reference = newGatewayReferenceServer();
  const schedule = `${date} ${time}`;
  const priceText = `${amountEuros} € TTC`;
  const intent = {
    reference,
    universe: 'PRESENCE',
    contract: 'PRÉSENCE PROPRIÉTAIRES',
    mission,
    object,
    schedule,
    email: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    supersedes_reference: '',
    amount_cents: amountEuros * 100,
    currency: 'eur',
    price_text: priceText,
    status: 'CREATED',
    created_at: new Date().toISOString(),
    source: 'presence_site',
    availability_mode: effectiveMode,
    availability_label: availabilityLabel
  };

  await env.INTENTS.put(`intent:${reference}`, JSON.stringify(intent), { expirationTtl: INTENT_TTL_SECONDS });

  const tallyBase = TALLY_PRESENCE_STANDARD_URL;
  const tallyUrl = addParams(tallyBase, {
    mission,
    objet: object,
    tarif: priceText,
    creneau: schedule,
    reference_temporaire: reference,
    cadre_client: 'PROPRIÉTAIRE PARTICULIER',
    availability_mode: effectiveMode,
    execution_anticipee_14j: requiresEarlyExecutionConsent(intent) ? 'oui' : 'non'
  });

  return sitePresenceCorsResponse(request, JSON.stringify({
    ok:true,
    reference,
    mission,
    price_text:priceText,
    availability_mode:effectiveMode,
    availability_label:availabilityLabel,
    tally_url:tallyUrl
  }), 201, true);
}

async function createSiteRelaisIntent(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!RELAIS_SITE_ORIGINS.has(origin)) {
    return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'origin_not_allowed' }), 403, true);
  }

  const body = await request.json().catch(() => null);
  if (!body) return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_json' }), 400, true);

  const type = clean(body.type, 80);
  const requestedMode = clean(body.requested_mode, 30).toLowerCase();
  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  const cfg = Object.prototype.hasOwnProperty.call(RELAIS_SITE_MISSIONS, type) ? RELAIS_SITE_MISSIONS[type] : null;

  if (!cfg) return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'unknown_mission' }), 400, true);
  // SUIVRE : aucun prix par défaut. La formule 2 ou 3 passages est obligatoire.
  const observations = cfg.kind === 'suivre' ? Number(body.observations) : null;
  if (cfg.kind === 'suivre' && ![2, 3].includes(observations)) {
    return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'suivre_formula_required' }), 422, true);
  }
  // RELAIS propriétaires : aucun parcours HORS STANDARD ni supplément.
  if (requestedMode !== 'standard') {
    return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_mode' }), 400, true);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time)) {
    return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_schedule' }), 400, true);
  }

  const slotUtc = parisLocalToUtc(date, time);
  if (!slotUtc) return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'invalid_schedule' }), 400, true);

  const now = new Date();
  if (slotUtc.getTime() <= now.getTime()) {
    return siteRelaisCorsResponse(request, JSON.stringify({ ok:false, error:'past_schedule' }), 422, true);
  }

  const hour = Number(time.slice(0,2));
  const minute = Number(time.slice(3,5));
  const minutes = hour * 60 + minute;
  // Toutes les demandes de créneau futur sont recevables.
  // Confirmation, proposition d'un autre créneau ou remboursement : CYRNEA.
  // Tarifs RELAIS de référence inchangés, aucune majoration automatique.
  // Aucun minimum de 24 h : le choix d'un créneau à court délai
  // n'ajoute aucun prix ni priorité. La mission reste à confirmer.
  const effectiveMode = 'standard';
  const amountEuros = cfg.kind === 'suivre' ? (observations === 2 ? 490 : 690)
    : cfg.kind === 'simple' ? 109 : cfg.kind === 'relais' ? 149 : 260;
  const mission = cfg.mission;
  const object = cfg.kind === 'suivre'
    ? `SUIVRE — ${observations} observations factuelles ponctuelles (1 h maximum par passage)`
    : cfg.object;
  const availabilityLabel = 'STANDARD';

  const reference = newGatewayReferenceServer();
  const schedule = `${date} ${time}`;
  const priceText = `${amountEuros} € TTC`;
  const intent = {
    reference,
    universe: 'RELAIS',
    contract: 'RELAIS',
    mission,
    object,
    ...(cfg.kind === 'suivre' ? { observations } : {}),
    schedule,
    email: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    supersedes_reference: '',
    amount_cents: amountEuros * 100,
    currency: 'eur',
    price_text: priceText,
    status: 'CREATED',
    created_at: new Date().toISOString(),
    source: 'relais_site',
    availability_mode: effectiveMode,
    availability_label: availabilityLabel
  };

  await env.INTENTS.put(`intent:${reference}`, JSON.stringify(intent), { expirationTtl: INTENT_TTL_SECONDS });

  const tallyBase = TALLY_RELAIS_STANDARD_URL;
  const tallyUrl = addParams(tallyBase, {
    mission,
    objet: object,
    tarif: priceText,
    creneau: schedule,
    reference_temporaire: reference,
    cadre_client: 'PROPRIÉTAIRE PARTICULIER',
    availability_mode: effectiveMode,
    execution_anticipee_14j: requiresEarlyExecutionConsent(intent) ? 'oui' : 'non'
  });

  return siteRelaisCorsResponse(request, JSON.stringify({
    ok:true,
    reference,
    mission,
    price_text:priceText,
    availability_mode:effectiveMode,
    availability_label:availabilityLabel,
    tally_url:tallyUrl
  }), 201, true);
}

function newGatewayReferenceServer(){
  const stamp = new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes].map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase();
  return `D-${stamp}-${suffix}`;
}

function parisLocalToUtc(dateStr, timeStr){
  const dm = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(timeStr).match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const y=Number(dm[1]), mo=Number(dm[2]), d=Number(dm[3]), h=Number(tm[1]), mi=Number(tm[2]);
  const probe = new Date(Date.UTC(y,mo-1,d,h,mi,0));
  if (probe.getUTCFullYear()!==y || probe.getUTCMonth()!==mo-1 || probe.getUTCDate()!==d || h>23 || mi>59) return null;
  let offset = parisOffsetMs(probe);
  let out = new Date(probe.getTime() - offset);
  offset = parisOffsetMs(out);
  out = new Date(probe.getTime() - offset);
  const parts = parisParts(out);
  if (parts.year!==y || parts.month!==mo || parts.day!==d || parts.hour!==h || parts.minute!==mi) return null;
  return out;
}

function parisParts(date){
  const parts = new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {year:Number(p.year),month:Number(p.month),day:Number(p.day),hour:Number(p.hour),minute:Number(p.minute),second:Number(p.second)};
}

function parisOffsetMs(date){
  const p=parisParts(date);
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-date.getTime();
}

function isSundayYmd(dateStr){
  const m=String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return false;
  return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))).getUTCDay()===0;
}

function easterSundayUtc(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(year,month-1,day,12,0,0));
}
function addUtcDays(date,days){const d=new Date(date.getTime());d.setUTCDate(d.getUTCDate()+days);return d;}
function ymdUtc(date){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;}
function isFrenchPublicHolidayYmd(dateStr){
  const m=String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m)return false;
  const y=Number(m[1]);
  const fixed=new Set([`${y}-01-01`,`${y}-05-01`,`${y}-05-08`,`${y}-07-14`,`${y}-08-15`,`${y}-11-01`,`${y}-11-11`,`${y}-12-25`]);
  if(fixed.has(dateStr))return true;
  const easter=easterSundayUtc(y);
  return new Set([ymdUtc(addUtcDays(easter,1)),ymdUtc(addUtcDays(easter,39)),ymdUtc(addUtcDays(easter,50))]).has(dateStr);
}

function siteRelaisCorsResponse(request,body,status=200,isJson=false){
  const origin=request.headers.get('Origin')||'';
  const h={'cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if(isJson)h['content-type']='application/json; charset=utf-8';
  if(RELAIS_SITE_ORIGINS.has(origin)){
    h['access-control-allow-origin']=origin;
    h['access-control-allow-methods']='POST,OPTIONS';
    h['access-control-allow-headers']='content-type,accept';
  }
  return new Response(body,{status,headers:h});
}


function sitePresenceCorsResponse(request,body,status=200,isJson=false){
  const origin=request.headers.get('Origin')||'';
  const h={'cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if(isJson)h['content-type']='application/json; charset=utf-8';
  if(PRESENCE_SITE_ORIGINS.has(origin)){
    h['access-control-allow-origin']=origin;
    h['access-control-allow-methods']='POST,OPTIONS';
    h['access-control-allow-headers']='content-type,accept';
  }
  return new Response(body,{status,headers:h});
}

async function createIntent(request, env) {
  const origin = request.headers.get('Origin') || '';
  // Requêtes PWA : pas d'accès sans l'origine configurée côté Worker.
  // Cette protection d'origine s'ajoute à la validation tarifaire serveur, elle ne remplace pas une authentification.
  if (!env.PWA_ORIGIN || origin !== env.PWA_ORIGIN) {
    return corsResponse(request, env, JSON.stringify({ ok: false, error: 'origin_not_allowed' }), 403, true);
  }

  const body = await request.json().catch(() => null);
  if (!body) return corsResponse(request, env, JSON.stringify({ ok: false, error: 'invalid_json' }), 400, true);

  const reference = String(body.reference || '').trim();
  if (!REF_RE.test(reference)) return corsResponse(request, env, JSON.stringify({ ok: false, error: 'invalid_reference' }), 400, true);

  const amountCents = Number(body.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 500000) {
    return corsResponse(request, env, JSON.stringify({ ok: false, error: 'invalid_amount' }), 400, true);
  }

  const supersedesReference = clean(body.supersedes_reference, 80);
  if (supersedesReference && !REF_RE.test(supersedesReference)) {
    return corsResponse(request, env, JSON.stringify({ ok: false, error: 'invalid_supersedes_reference' }), 400, true);
  }

  const intent = {
    reference,
    universe: clean(body.universe, 64),
    contract: clean(body.contract, 80),
    mission: clean(body.mission, 120),
    object: clean(body.object, 500),
    schedule: clean(body.schedule, 200),
    email: clean(body.email, 200).toLowerCase(),
    customer_name: clean(body.customer_name, 200),
    customer_email: clean(body.customer_email || body.email, 200).toLowerCase(),
    customer_phone: clean(body.customer_phone, 80),
    customer_company: clean(body.customer_company, 200),
    supersedes_reference: supersedesReference,
    amount_cents: amountCents,
    currency: String(body.currency || 'eur').toLowerCase() === 'eur' ? 'eur' : '',
    price_text: clean(body.price_text, 80),
    availability_mode: clean(body.availability_mode, 30).toLowerCase(),
    availability_label: clean(body.availability_label, 120),
    status: 'CREATED',
    created_at: new Date().toISOString()
  };

  if (!intent.currency || !intent.contract || !intent.mission || !intent.price_text) {
    return corsResponse(request, env, JSON.stringify({ ok: false, error: 'missing_required_fields' }), 400, true);
  }

  // AUTORITÉ SERVEUR : le tarif, la durée, les horaires et le nombre de passages
  // sont revalidés avant toute écriture KV, même sur appel direct de /intent.
  const commercialCheck = validatePwaCommercialIntent(intent, env);
  if (!commercialCheck.ok) {
    return corsResponse(request, env, JSON.stringify({ ok:false, error:commercialCheck.error }), commercialCheck.http || 422, true);
  }

  const key = `intent:${reference}`;
  const existingRaw = await env.INTENTS.get(key);
  if (existingRaw) {
    const existing = JSON.parse(existingRaw);
    if (sameImmutableIntent(existing, intent)) {
      return corsResponse(request, env, JSON.stringify({ ok: true, status: existing.status, reference, reused: true }), 200, true);
    }
    return corsResponse(request, env, JSON.stringify({ ok: false, error: 'reference_already_exists_with_different_data' }), 409, true);
  }

  await env.INTENTS.put(key, JSON.stringify(intent), { expirationTtl: INTENT_TTL_SECONDS });
  return corsResponse(request, env, JSON.stringify({ ok: true, status: 'CREATED', reference }), 201, true);
}

// Catalogue ciblé de l'entrée PWA /intent. NE PAS TOUCHER aux deux routes site
// et à leur calcul tarifaire autonome. Prix B2B ci-dessous en HT, TVA PWA 20 %.
const PWA_RELAIS_CATALOG = Object.freeze({
  'RELAIS SIMPLE': 109,
  'RELAIS': 149,
  'RELAIS - AVANT INTEMPÉRIE': 149,
  'AVANT INTEMPÉRIE': 149,
  'RELAIS SIMPLE - APRÈS INTEMPÉRIE': 109,
  'APRÈS INTEMPÉRIE — VÉRIFICATION PRATIQUE': 109,
  'VOIR RELAIS': 260,
  'SUIVRE': null // 2 observations : 490 € TTC ; 3 observations : 690 € TTC
});
const PWA_PRESENCE_CATALOG = Object.freeze({
  'VOIR PRÉSENCE': 260,
  'DÉCIDER': 260,
  'SUIVRE': null // 2 observations = 490 €, 3 = 690 €
});
const PWA_B2B_CATALOG = Object.freeze({
  'VISITE TERRAIN PILOTÉE - 350 € HT': {ht:350,group:'visite'},
  'PRÉSENCE PROJET - 490 € HT': {ht:490,group:'projet'},
  'PRÉSENCE PROJET ÉTENDUE - 690 € HT': {ht:690,group:'projet'},
  'CONTINUITÉ PROJET - 1190 € HT': {ht:1190,group:'suivi3',count:3},
  'CONTINUITÉ PROJET - 1 190 € HT': {ht:1190,group:'suivi3',count:3},
  'SUIVI DE PROJET - 2 PASSAGES - 850 € HT': {ht:850,group:'suivi2',count:2},
  'ACCÈS B2B - 109 € HT': {ht:109,group:'logistique'},
  'REMISE CLÉ / BADGE B2B - 109 € HT': {ht:109,group:'logistique'},
  'RÉCUPÉRATION CLÉ / BADGE B2B - 109 € HT': {ht:109,group:'logistique'},
  'PRÉSENCE LOGISTIQUE B2B - 169 € HT': {ht:169,group:'logistique'}
});
function pwaFail(error, http = 422) { return {ok:false,error,http}; }
function pwaNormalizedTtc(value) { return String(value || '').replace(/[\s\u00a0\u202f]/g,'').toUpperCase(); }
function pwaScheduleSlot(date, time, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/.test(time)) return null;
  const start = parisLocalToUtc(date, time);
  if (!start || start.getTime() <= now.getTime()) return null;
  const hh = Number(time.slice(0,2)), mm = Number(time.slice(3));
  return {
    date,time,
    standardHour: hh*60+mm>=480 && hh*60+mm<=1125,
    sunday: isSundayYmd(date) || isFrenchPublicHolidayYmd(date),
    urgent: start.getTime()-now.getTime()<24*60*60*1000,
    night: hh>=21 || hh<8,
    evening: hh>=19 && hh<21
  };
}
// Sortie PWA réelle : Jalon 1: AAAA-MM-JJ HH:MM (Standard...), puis éventuellement
// « N jalon(s) restant(s)... ». Refuser les dates, index ou restes ambigus.
function pwaMultiSlots(schedule, count, now) {
  const chunks = String(schedule||'').split(' | ');
  const result = [];
  let seenReminder = false;
  for (const chunk of chunks) {
    const m = chunk.match(/^Jalon (\d): (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) \((Standard(?: — (?:inclus|compris) dans le forfait)?)\)$/);
    if (m) {
      if (seenReminder || Number(m[1]) !== result.length+1 || result.length>=count) return null;
      const slot = pwaScheduleSlot(m[2],m[3],now);
      if (!slot) return null;
      result.push(slot);
      continue;
    }
    const reminder = chunk.match(/^(\d) jalon\(s\) restant\(s\) : date\(s\) à programmer ultérieurement$/);
    if (!reminder || seenReminder || Number(reminder[1])!==count-result.length) return null;
    seenReminder = true;
  }
  if (!result.length || (result.length<count && !seenReminder) || (result.length===count && seenReminder)) return null;
  return result;
}
function validatePwaCommercialIntent(intent, env) {
  const contract=String(intent.contract||'');
  const mode=String(intent.availability_mode||'').toLowerCase();
  const amount=Number(intent.amount_cents);
  const currency=String(intent.currency||'');
  const timestamp=String(intent.created_at||'');
  const createdAt=timestamp ? new Date(timestamp) : new Date();
  // Au checkout, conserver l'heure de création déterminée par le serveur :
  // les catégories de créneaux ne doivent pas changer pendant le paiement.
  const now=Number.isFinite(createdAt.getTime()) ? createdAt : new Date();
  if (currency!=='eur') return pwaFail('invalid_currency');
  if (!Number.isInteger(amount) || amount<=0) return pwaFail('invalid_amount');
  // Un devis accepté hors catalogue n'est PAS un tarif libre payable en ligne :
  // on conserve sa demande via Tally, sans exposer Stripe/PayPal à un prix saisi par le client.
  // Une approbation humaine reste indispensable pour transmettre une facture adaptée.
  // Une demande B2B exceptionnelle au tarif FIXE du catalogue peut être payée.
  // Les autres devis demeurent enregistrables, mais NON encaissables.
  // Un SUIVI B2B particulier est tarifé par jalon, jamais au forfait de base.
  // Il reste soumis au contrôle de prix complet ci-dessous.
  const b2bQuoteItem = PWA_B2B_CATALOG[intent.mission];
  const pricedB2bQuote = mode==='quote' && contract==='PRÉSENCE ENTREPRISES' &&
    !!b2bQuoteItem &&
    (b2bQuoteItem.count
      ? !!pwaMultiSlots(intent.schedule,b2bQuoteItem.count,now)
      : amount===b2bQuoteItem.ht*120) &&
    pwaNormalizedTtc(intent.price_text)===(String(amount/100)+'€TTC');
  if (mode==='quote' && !pricedB2bQuote) {
    if (!['RELAIS','PRÉSENCE PROPRIÉTAIRES','PRÉSENCE ENTREPRISES'].includes(contract))
      return pwaFail('quote_contract_invalid');
    if (!String(intent.mission||'').trim() || !String(intent.object||'').trim() ||
        !/devis/i.test(String(intent.availability_label||'')))
      return pwaFail('quote_context_missing');
    if (amount>500000) return pwaFail('quote_amount_out_of_range');
    const quoteText=pwaNormalizedTtc(intent.price_text).replace(',', '.');
    const quoteMatch=quoteText.match(/^(\d+(?:\.\d{1,2})?)€TTC$/);
    if (!quoteMatch || Math.round(Number(quoteMatch[1])*100)!==amount)
      return pwaFail('quote_price_text_mismatch');
    return {ok:true,manual_quote:true}; // Droit de DEMANDE uniquement, jamais de paiement.
  }
  if (!['standard','priority','evening','night','sunday','quote'].includes(mode)) return pwaFail('invalid_mode');
  let expectedCents=null;
  if (contract==='RELAIS' || contract==='PRÉSENCE PROPRIÉTAIRES') {
    if (mode!=='standard') return pwaFail('owner_nonstandard_forbidden');
    const ownerCatalog=contract==='RELAIS' ? PWA_RELAIS_CATALOG : PWA_PRESENCE_CATALOG;
    if (!Object.prototype.hasOwnProperty.call(ownerCatalog,intent.mission)) return pwaFail('owner_mission_unknown');
    if (intent.mission==='SUIVRE') {
      // Même mission, deux contrats : conserver les anciennes commandes PRÉSENCE
      // et accepter les nouvelles commandes RELAIS après contrôle prix/objet/calendrier.
      const two=pwaMultiSlots(intent.schedule,2,now);
      const three=pwaMultiSlots(intent.schedule,3,now);
      if ((!two&&!three) || (two&&three)) return pwaFail('owner_suivre_schedule_invalid');
      const slots=two||three;
      if (contract==='RELAIS') {
        // Les commandes web RELAIS sont possibles lun.–sam. hors fériés, 08 h–18 h 45.
        if (slots.some(slot=>!slot.standardHour||slot.sunday)) return pwaFail('relais_suivre_out_of_standard_window');
        const count=two?2:3;
        const expectedObject=`SUIVRE — ${count} observations factuelles ponctuelles`;
        if (String(intent.object||'')!==expectedObject) return pwaFail('relais_suivre_object_mismatch');
      }
      // Les dates des historiques PRÉSENCE restent recevables selon leur contrat.
      expectedCents=two?49000:69000;
    } else {
      const match=String(intent.schedule||'').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
      if (!match) return pwaFail('owner_schedule_invalid');
      const slot=pwaScheduleSlot(match[1],match[2],now);
      if (!slot) return pwaFail('owner_schedule_invalid');
      if (contract==='RELAIS' && (!slot.standardHour||slot.sunday)) return pwaFail('relais_out_of_standard_window');
      expectedCents=ownerCatalog[intent.mission]*100;
    }
  } else if (contract==='PRÉSENCE ENTREPRISES') {
    const item=PWA_B2B_CATALOG[intent.mission];
    if (!item) return pwaFail('b2b_mission_unknown');
    // SUIVI 2 passages à 850 € HT : accessible via la PWA en STANDARD.
    // L'opérateur confirme personnellement le créneau après la demande.
    if (item.count) {
      if (!['standard','quote'].includes(mode)) return pwaFail('b2b_suivi_mode_invalid');
      const slots=pwaMultiSlots(intent.schedule,item.count,now);
      if (!slots) return pwaFail('b2b_suivi_schedule_invalid');
      // SUIVI : chaque passage déjà daté porte au plus une majoration.
      // Un jalon restant à programmer n'est pas majoré par anticipation.
      if (mode==='quote' && !slots.some(x=>!x.standardHour||x.sunday))
        return pwaFail('b2b_suivi_quote_unnecessary');
      const totalSurcharge=slots.reduce((sum,slot)=>sum+(
        (slot.sunday||slot.night) ? 180 :
        (slot.urgent||slot.evening) ? 120 : 0
      ),0);
      expectedCents=(item.ht+totalSurcharge)*120; // TVA 20 %, centimes.
    } else {
      const match=String(intent.schedule||'').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
      if (!match) return pwaFail('b2b_schedule_invalid');
      const slot=pwaScheduleSlot(match[1],match[2],now);
      if (!slot) return pwaFail('b2b_schedule_invalid');
      const extended=item.group==='projet';
      // Hors plage tarifaire connue : paiement du tarif de base, marqué quote
      // (montant fixe contrôlé, acceptation du créneau réservée à CYRNEA).
      const exceptional=!extended && !slot.standardHour;
      const surcharge=exceptional ? 0 : slot.sunday || (extended&&slot.night)
        ? (item.group==='logistique'?60:180)
        : slot.urgent || (extended&&slot.evening)
          ? (item.group==='logistique'?40:120)
          : 0;
      // Même hiérarchie que les libellés calculés par la PWA.
      const actualMode=exceptional?'quote'
        : slot.sunday?'sunday'
        : extended&&slot.night?'night'
        : slot.urgent?'priority'
        : extended&&slot.evening?'evening'
        : 'standard';
      if (mode!==actualMode) return pwaFail('b2b_mode_mismatch');
      expectedCents=(item.ht+surcharge)*120;
    }
  } else return pwaFail('unknown_contract');
  if (expectedCents!==amount) return pwaFail('price_mismatch');
  // Le texte envoyé vers Tally doit refléter le même TTC, sinon le webhook
  // bloque plus tard. Refuser au plus tôt une incohérence.
  const displayTtc=pwaNormalizedTtc(intent.price_text).replace(',', '.');
  const displayMatch=displayTtc.match(/^(\d+(?:\.\d{1,2})?)€TTC$/);
  if (!displayMatch || Math.round(Number(displayMatch[1])*100)!==expectedCents)
    return pwaFail('price_text_mismatch');
  return {ok:true};
}

// Les références créées directement par les pages officielles sont déjà
// tarifées par leurs routes serveur dédiées. Vérifier ici les anciennes
// intentions PWA aussi, pour éviter d'encaisser un montant ancien/injecté.
// Contrôle ciblé des références créées par le Bridge A21 (source b2b_site).
// Elles portent un prix en HT, à la différence du format TTC de la PWA.
// Recalcul serveur des tarifs et modes du Bridge V7 : aucun prix n'est cru sur parole.
function validateB2BSitePaymentIntent(intent) {
  if (intent.contract !== 'PRÉSENCE ENTREPRISES' || intent.universe !== 'B2B')
    return pwaFail('b2b_site_contract_invalid');
  const item = PWA_B2B_CATALOG[String(intent.mission || '')];
  if (!item) return pwaFail('b2b_site_mission_unknown');
  const match = String(intent.schedule || '').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
  if (!match) return pwaFail('b2b_site_schedule_invalid');
  const created = new Date(intent.created_at || '');
  if (!Number.isFinite(created.getTime())) return pwaFail('b2b_site_created_at_invalid');
  const slot = pwaScheduleSlot(match[1], match[2], created);
  if (!slot) return pwaFail('b2b_site_slot_invalid');

  const suivi = !!item.count;
  const h24 = item.group === 'projet' && !suivi;
  const hour = Number(match[2].slice(0, 2));
  const outsideHours = hour < 8 || hour >= 19;
  // Conformité au Bridge B2B déployé : seuls les créneaux hors plage
  // des missions courtes relèvent du mode « quote » sans tarif libre.
  // SUIVI reçoit une majoration de disponibilité sur le premier jalon.
  const quoteRequired = !suivi && !h24 && outsideHours;
  let expectedMode = 'standard';
  if (quoteRequired) expectedMode = 'quote';
  else if (slot.sunday) expectedMode = 'sunday';
  else if (slot.night) expectedMode = 'night';
  else if (slot.evening) expectedMode = 'evening';
  else if (slot.urgent) expectedMode = 'priority';

  const actualMode = String(intent.availability_mode || '').toLowerCase();
  if (actualMode !== expectedMode) return pwaFail('b2b_site_mode_mismatch');

  const logistics = item.group === 'logistique';
  // Une seule majoration, la plus élevée, par passage SUIVI demandé.
  const surcharge = ['standard','quote'].includes(expectedMode) ? 0 :
    (expectedMode === 'sunday' || expectedMode === 'night')
      ? (logistics ? 60 : 180)
      : (logistics ? 40 : 120);
  const totalHt = item.ht + surcharge;
  const totalCents = Math.round(totalHt * 120);
  if (Number(intent.amount_cents) !== totalCents ||
      String(intent.currency || '').toLowerCase() !== 'eur')
    return pwaFail('b2b_site_amount_mismatch');
  if (String(intent.price_text || '') !== `${totalHt} € HT`)
    return pwaFail('b2b_site_price_text_mismatch');
  if (Number(intent.base_ht) !== item.ht ||
      Number(intent.supplement_ht) !== surcharge ||
      Number(intent.total_ht) !== totalHt ||
      Math.round(Number(intent.total_ttc) * 100) !== totalCents)
    return pwaFail('b2b_site_tariff_details_mismatch');
  return {ok:true};
}

function validateStoredPwaPaymentIntent(intent, env) {
  // Le Bridge A21 peut recevoir un règlement immédiat au tarif FIXE
  // vérifié côté serveur, y compris si CYRNEA doit confirmer le créneau.
  if (intent?.source === 'b2b_site') return validateB2BSitePaymentIntent(intent);
  // Les devis libres restent non payables, les devis B2B à prix FIXE
  // ne passent que si date, mission, mode et montant sont exacts.
  if (String(intent?.availability_mode||'').toLowerCase()==='quote') {
    if (intent.contract==='PRÉSENCE ENTREPRISES') {
      const check=validatePwaCommercialIntent(intent,env);
      if (check.ok && !check.manual_quote) return check;
    }
    return pwaFail('quote_requires_manual_payment',409);
  }
  // Les demandes propriétaires provenant des pages officielles ont leur
  // prix et leur objet fixés par ces routes serveur, non par le navigateur.
  if (intent?.source === 'relais_site' && intent?.contract === 'RELAIS' && intent?.mission === 'SUIVRE') {
    // Défense en profondeur : 490/690, nombre de passages, objet et créneau initial
    // restent cohérents avec la référence serveur jusqu'au paiement.
    const n=Number(intent.observations);
    if (n!==2 && n!==3) return pwaFail('relais_suivre_formula_invalid',409);
    const cents=n===2?49000:69000;
    if (Number(intent.amount_cents)!==cents || String(intent.currency)!=='eur' ||
        String(intent.price_text)!==`${cents/100} € TTC` ||
        String(intent.object)!==`SUIVRE — ${n} observations factuelles ponctuelles (1 h maximum par passage)` ||
        String(intent.availability_mode)!=='standard' || String(intent.universe)!=='RELAIS')
      return pwaFail('relais_suivre_commercial_mismatch',409);
    const match=String(intent.schedule||'').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
    const createdAt=new Date(intent.created_at||'');
    if (!match || !Number.isFinite(createdAt.getTime()) ||
        !pwaScheduleSlot(match[1],match[2],createdAt))
      return pwaFail('relais_suivre_schedule_invalid',409);
    return {ok:true};
  }
  if (intent?.source === 'relais_site' || intent?.source === 'presence_site') return {ok:true};
  return validatePwaCommercialIntent(intent, env);
}

async function handleTallyWebhook(request, env) {
  const raw = await request.text();
  const received = request.headers.get('Tally-Signature') || '';
  if (!(await verifyAnyTallySignature(raw, received, env))) {
    return json({ ok: false, error: 'invalid_signature' }, 401);
  }

  const event = JSON.parse(raw);
  if (event?.eventType !== 'FORM_RESPONSE' || !event?.data?.fields) {
    return json({ ok: false, error: 'unexpected_payload' }, 400);
  }

  const fields = mapFields(event.data.fields);
  const reference = String(fields.reference_temporaire || '').trim();
  if (!REF_RE.test(reference)) return json({ ok: false, error: 'invalid_reference' }, 400);

  const key = `intent:${reference}`;
  const rawIntent = await env.INTENTS.get(key);
  if (!rawIntent) return json({ ok: false, error: 'unknown_reference' }, 404);

  const intent = JSON.parse(rawIntent);
  const eventId = String(event.eventId || '');
  const submissionId = String(event.data.submissionId || event.data.responseId || '');
  const currentStatus = String(intent.status || '').toUpperCase();
  const history = Array.isArray(intent.validation_history) ? intent.validation_history : [];

  // CORRECTIF CIBLÉ : les réponses Tally peuvent arriver APRÈS la demande
  // de modification. Leur seule action autorisée est de compléter les coordonnées.
  // Le paiement, la mission et le statut CHANGE_REQUESTED restent BLOQUÉS.
  // Ce traitement doit précéder l'anti-rejeu : un ancien événement valide
  // peut être renvoyé par Tally pour compléter les informations manquantes.
  if (currentStatus === 'CHANGE_REQUESTED') {
    const sameMission =
      String(fields.mission || '') === String(intent.mission || '') &&
      String(fields.tarif || '') === String(intent.price_text || '') &&
      String(fields.creneau || '') === String(intent.schedule || '');

    if (!sameMission) {
      return json({ ok: true, reference, status: 'CHANGE_REQUESTED', ignored: 'change_requested_locked_mismatch' }, 200);
    }

    const fromName = clean(tallyContactAnswer(event.data.fields, ['Nom et prénom','nom et prénom','name','nom_client']) || intent.customer_name, 200);
    const fromEmail = clean(tallyContactAnswer(event.data.fields, ['E-mail','Email','email','email_client']) || intent.customer_email || intent.email, 200).toLowerCase();
    const fromPhone = clean(tallyContactAnswer(event.data.fields, ['Téléphone','telephone','phone','telephone_client']) || intent.customer_phone, 80);
    const shouldEnrich =
      (fromName && fromName !== String(intent.customer_name || '')) ||
      (fromEmail && fromEmail !== String(intent.customer_email || '')) ||
      (fromPhone && fromPhone !== String(intent.customer_phone || ''));

    if (shouldEnrich) {
      // Vérification de prudence avant écriture. Ne jamais rouvrir cette référence.
      const latestRaw = await env.INTENTS.get(key);
      const latest = latestRaw ? JSON.parse(latestRaw) : null;
      if (!latest || String(latest.status || '').toUpperCase() !== 'CHANGE_REQUESTED') {
        return json({ ok: true, reference, status: 'CHANGE_REQUESTED', ignored: 'newer_terminal_state' }, 200);
      }
      const enriched = {
        ...latest,
        status: 'CHANGE_REQUESTED',
        customer_name: clean(latest.customer_name || fromName, 200),
        customer_email: clean(latest.customer_email || fromEmail || latest.email, 200).toLowerCase(),
        customer_phone: clean(latest.customer_phone || fromPhone, 80),
        // Ne rien modifier d'autre : prix, créneau, droits, paiements et historiques inchangés.
      };
      await env.INTENTS.put(key, JSON.stringify(enriched), { expirationTtl: INTENT_TTL_SECONDS });
      const notice = await sendChangeRequestAlert(enriched, env);
      if (!notice.ok) {
        console.error('CYRNEA_CHANGE_CONTACT_ENRICHMENT_ALERT_FAILED', reference, notice.reason || 'unknown');
        return json({ ok: false, reference, status: 'CHANGE_REQUESTED', error: 'contact_alert_failed' }, 503);
      }
      return json({ ok: true, reference, status: 'CHANGE_REQUESTED', contact_enriched: true }, 200);
    }
    return json({ ok: true, reference, status: 'CHANGE_REQUESTED', ignored: 'change_requested_locked' }, 200);
  }

  // Anti-rejeu / anti-retard : un même événement n'a jamais de second effet.
  if ((eventId && intent.tally_event_id === eventId) ||
      (eventId && history.some(x => String(x?.event_id || '') === eventId)) ||
      (submissionId && history.some(x => String(x?.submission_id || '') === submissionId && x?.result === 'VALIDATED'))) {
    return json({ ok: true, reference, status: currentStatus || 'UNKNOWN', reused: true }, 200);
  }

  // Une validation acquise est terminale pour cette référence. Toute modification passe par CHANGE_REQUESTED + nouvelle référence.  if (currentStatus === 'VALIDATED') {
    return json({ ok: true, reference, status: 'VALIDATED', ignored: 'already_validated' }, 200);
  }

  // Un rejet structurel (mismatch / mauvaise branche) est terminal ; seul un rejet de rétractation peut être corrigé sur la même référence.
  if (currentStatus === 'REJECTED' && intent.reject_reason && intent.reject_reason !== 'retraction_14d_without_express_request') {
    return json({ ok: true, reference, status: 'REJECTED', ignored: 'rejected_locked' }, 200);
  }

  const submittedMission = String(fields.mission || '');
  const submittedPrice = String(fields.tarif || '');
  const submittedSchedule = String(fields.creneau || '');

  // Lire le PREMIER champ Tally de contact non vide : certains formulaires
  // contiennent plusieurs champs conditionnels intitulés « Téléphone ».
  const customerName = clean(tallyContactAnswer(event.data.fields, ['Nom et prénom','name','nom_client']) || firstPresent(fields, ['Nom et prénom', 'nom et prénom', 'name']) || fields.nom_client || intent.customer_name, 200);
  const customerEmail = clean(tallyContactAnswer(event.data.fields, ['E-mail','Email','email_client']) || firstPresent(fields, ['E-mail', 'Email', 'email']) || fields.email_client || intent.customer_email || intent.email, 200).toLowerCase();
  const customerPhone = clean(tallyContactAnswer(event.data.fields, ['Téléphone','telephone','phone','telephone_client']) || firstPresent(fields, ['Téléphone', 'telephone', 'phone']) || fields.telephone_client || intent.customer_phone, 80);

  const reject = async (reason, extra = {}) => {
    const now = new Date().toISOString();
    const rejected = {
      ...intent,
      ...extra,
      status: 'REJECTED',
      rejected_at: now,
      reject_reason: reason,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      tally_event_id: eventId || null,
      tally_submission_id: submissionId || null,
      tally_respondent_id: event.data.respondentId || null,
      legal_access_evidence: extractLegalAccessEvidence(fields),
      tally_fields: keepEvidence(fields),
      validation_history: appendHistory(intent, {
        at: now,
        result: `REJECTED_${String(reason).toUpperCase()}`,
        event_id: eventId || null,
        submission_id: submissionId || null,
        evidence: keepEvidence(fields)
      })
    };
    await env.INTENTS.put(key, JSON.stringify(rejected), { expirationTtl: INTENT_TTL_SECONDS });
    return rejected;
  };

  const mismatches = [];
  if (submittedMission !== intent.mission) mismatches.push('mission');
  if (submittedPrice !== intent.price_text) mismatches.push('tarif');
  if (submittedSchedule !== intent.schedule) mismatches.push('creneau');
  if (mismatches.length) {
    await reject(`mismatch:${mismatches.join(',')}`, { mismatch_fields: mismatches });
    return json({ ok: true, reference, status: 'REJECTED', reason: 'intent_mismatch', fields: mismatches }, 200);
  }

  // Sécurité serveur (en complément des règles Tally) : une soumission signée
  // ne suffit pas si les attestations d'accès sont absentes ou incompatibles.
  // Tous les contrats concernés partagent ces questions sur les formulaires actuels.
  const legalAccessError = checkCyrneaLegalAccessAnswers(fields);
  if (legalAccessError) {
    await reject(legalAccessError);
    return json({ ok: true, reference, status: 'REJECTED', reason: 'legal_access_not_validated' }, 200);
  }

  // Cloisonnement contractuel : le formulaire PRÉSENCE Propriétaires reste branché par audience.
  // Le B2B dispose désormais de son formulaire dédié RGp0PQ : aucune question d'audience consommateur n'est requise.
  if (intent.contract === 'PRÉSENCE PROPRIÉTAIRES') {
    const audienceRaw = findFieldValueByLabelFragment(fields, 'vous agissez en tant que') || fields.cadre_client || '';
    const audience = normalizeLabelForMatch(audienceRaw);
    if (!audience) {
      await reject('presence_branch_missing');
      return json({ ok: true, reference, status: 'REJECTED', reason: 'presence_branch_missing' }, 200);
    }
    if (!audience.includes('proprietaire')) {
      await reject('presence_branch_mismatch');
      return json({ ok: true, reference, status: 'REJECTED', reason: 'presence_branch_mismatch' }, 200);
    }
  }

  if (intent.contract === 'PRÉSENCE ENTREPRISES') {
    const company = clean(
      firstPresent(fields, ['Société', 'Societe', 'société', 'societe']) ||
      fields.societe_client ||
      intent.customer_company,
      200
    );
    if (!company) {
      await reject('b2b_company_missing');
      return json({ ok: true, reference, status: 'REJECTED', reason: 'b2b_company_missing' }, 200);
    }
    const unexpectedRetraction = String(findFieldValueByLabelFragment(fields, 'retract') || '').trim();
    if (unexpectedRetraction) {
      await reject('unexpected_consumer_retraction_b2b');
      return json({ ok: true, reference, status: 'REJECTED', reason: 'unexpected_consumer_retraction_b2b' }, 200);
    }
    intent.customer_company = company;
  }

  let retractionValue = '';
  if (requiresEarlyExecutionConsent(intent)) {
    retractionValue = String(findFieldValueByLabelFragment(fields, 'retract') || '').trim().toUpperCase();
    if (!retractionValue.startsWith('OUI')) {
      await reject('retraction_14d_without_express_request', { retraction_value: retractionValue });
      return json({ ok: true, reference, status: 'REJECTED', reason: 'retraction_required' }, 200);
    }
  }

  const now = new Date().toISOString();
  const validated = {
    ...intent,
    status: 'VALIDATED',
    validated_at: now,
    tally_event_id: eventId || null,
    tally_submission_id: submissionId || null,
    tally_respondent_id: event.data.respondentId || null,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    legal_access_evidence: extractLegalAccessEvidence(fields),
    tally_fields: keepEvidence(fields),
    validation_history: appendHistory(intent, {
      at: now,
      result: 'VALIDATED',
      event_id: eventId || null,
      retraction_value: retractionValue,
      submission_id: submissionId || null,
      evidence: keepEvidence(fields)
    })
  };
  delete validated.reject_reason;
  delete validated.rejected_at;
  delete validated.change_requested_at;

  await env.INTENTS.put(key, JSON.stringify(validated), { expirationTtl: INTENT_TTL_SECONDS });

  // Couche temps réel fortement cohérente : échec non bloquant, KV reste la source de secours.
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      // Preuve Tally indépendante du KV, déjà pris en charge par le champ
      // metadata du Durable Object existant (aucune modification du DO).
      // Elle sert à restaurer les coordonnées si un lecteur KV voit une
      // ancienne version, sans modifier les transitions VALIDATED / PAID.
      const doResult = await env.PAYMENT_STATE_SERVICE.setState(reference, {
        status: 'VALIDATED',
        provider: 'TALLY',
        metadata: {
          tally_validation_v1: {
            reference,
            mission: validated.mission,
            schedule: validated.schedule,
            amount_cents: validated.amount_cents,
            currency: validated.currency,
            validated_at: validated.validated_at,
            tally_event_id: validated.tally_event_id,
            tally_submission_id: validated.tally_submission_id,
            tally_respondent_id: validated.tally_respondent_id,
            customer_name: validated.customer_name,
            customer_email: validated.customer_email,
            customer_phone: validated.customer_phone,
            customer_company: validated.customer_company || '',
            legal_access_evidence: validated.legal_access_evidence,
            tally_fields: validated.tally_fields,
            validation_history: validated.validation_history
          }
        }
      });
      if (!doResult?.ok) {
        console.error('DO_SETSTATE_FAILED_VALIDATED', reference, String(doResult?.error || 'unknown'));
      }
    } catch (doErr) {
      console.error('DO_SETSTATE_FAILED_VALIDATED', reference, String(doErr?.message || doErr || ''));
    }
  }

  return json({ ok: true, reference, status: 'VALIDATED' }, 200);
}

async function validationStatus(url, env, request) {

  const reference = String(url.searchParams.get('reference') || '').trim();

  if (!REF_RE.test(reference)) return corsResponse(request, env, JSON.stringify({ ok: false, error: 'invalid_reference' }), 400, true);

  const raw = await env.INTENTS.get(`intent:${reference}`);

  if (!raw) return corsResponse(request, env, JSON.stringify({ ok: false, status: 'UNKNOWN' }), 404, true);

  const x = JSON.parse(raw);

  return corsResponse(request, env, JSON.stringify({
    ok: true,
    reference,
    status: x.status,
    validated_at: x.validated_at || null,
    change_requested_at: x.change_requested_at || null
  }), 200, true);

}

async function paymentPage(url, env) {
  const reference = String(url.searchParams.get('reference') || '').trim();
  if (!REF_RE.test(reference)) return html(errorPage('Référence de paiement invalide.'), 400);

  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);

  // Couche temps réel Durable Object. En cas d'indisponibilité, secours strict par le chemin V7.4 existant.
  let doState = null;
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      const doResult = await env.PAYMENT_STATE_SERVICE.getState(reference);
      if (doResult?.ok && doResult?.state) doState = doResult.state;
    } catch (doErr) {
      console.error('DO_GETSTATE_FAILED', reference, String(doErr?.message || doErr || ''));
    }
  }

  if (String(doState?.status || '').toUpperCase() === 'PAID') {
    return html(paymentAlreadyConfirmedPage(intent, doState), 200);
  }

  const kvStatus = String(intent.status || '').toUpperCase();
  // Le DO VALIDATED accélère uniquement les états non terminaux. Il ne réactive jamais une référence
  // déjà CHANGE_REQUESTED ou REJECTED lorsqu'un état KV plus récent est visible.
  const effectiveStatus =
    String(doState?.status || '').toUpperCase() === 'VALIDATED' &&
    kvStatus !== 'CHANGE_REQUESTED' &&
    kvStatus !== 'REJECTED'
      ? 'VALIDATED'
      : kvStatus;

  const payment = await getPaymentState(reference, env);
  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Le statut du paiement ne peut pas être vérifié pour le moment. Aucun nouveau paiement n’est proposé afin d’éviter un double règlement. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') {
    if (effectiveStatus === 'VALIDATED') {
      return html(paymentAlreadyConfirmedPage(intent, payment.data), 200);
    }
    return html(paymentConflictPage(intent), 409);
  }

  if (effectiveStatus === 'CHANGE_REQUESTED') return html(changeRequestedPage(intent), 202);
  if (effectiveStatus === 'REJECTED') {
    if (intent.reject_reason === 'retraction_14d_without_express_request') return html(retractionBlockedPage(intent), 409);
    return html(errorPage('La validation ne correspond pas à la mission préparée. Aucun paiement n’est autorisé.'), 409);
  }
  if (effectiveStatus !== 'VALIDATED') {
    return html(waitPage('Votre validation est en cours de prise en compte. Revenez dans quelques secondes.', reference), 202);
  }

  // Les devis à montant libre restent bloqués. Les missions B2B du Bridge
  // sont encaissables seulement au montant calculé et validé côté serveur.
  if (String(intent.availability_mode||'').toLowerCase()==='quote' && intent.source !== 'b2b_site') {
    // Seul un SUIVI B2B au montant majoré et recalculé côté serveur peut
    // ouvrir la page de paiement. Tout devis libre reste non encaissable.
    const pricedSuiviQuote = intent.contract === 'PRÉSENCE ENTREPRISES' &&
      !!PWA_B2B_CATALOG[String(intent.mission || '')]?.count &&
      (() => { const result=validatePwaCommercialIntent(intent,env); return result.ok && !result.manual_quote; })();
    if (!pricedSuiviQuote) {
      return html(errorPage('Cette demande nécessite une tarification personnalisée. Aucun paiement automatique n’est proposé.'), 202);
    }
  }
  const tariffGate = validateStoredPwaPaymentIntent(intent, env);
  if (!tariffGate.ok) {
    return html(errorPage('Cette demande contient un ancien tarif ou des conditions non autorisées. Aucun paiement n’est proposé. Contactez CYRNEA pour une nouvelle référence.'), 409);
  }

  const changeUrl = `/change-mission?reference=${encodeURIComponent(reference)}`;
  const stripeEnabled = !!String(env.STRIPE_SECRET_KEY || '').trim();
  const paypalEnabled = !!(
    String(env.PAYPAL_CLIENT_ID || '').trim() &&
    String(env.PAYPAL_CLIENT_SECRET || '').trim() &&
    env.PAYMENTS
  );

  return html(renderPaymentPage(intent, stripeEnabled, paypalEnabled, env, changeUrl), 200);
}

// Récupération non bloquante de la preuve Tally déjà validée dans le DO.
// Le DO fourni possède déjà state.metadata; PAS de changement de Worker DO.
// Jamais de changement de mission, montant, créneau, droit au paiement, ni de
// réactivation d'une référence REJECTED / CHANGE_REQUESTED / PAID.
function overlayTallyValidationFromDo(intent, doState) {
  const status = String(intent?.status || '').toUpperCase();
  if (['REJECTED', 'CHANGE_REQUESTED', 'PAID'].includes(status)) return intent;
  if (String(doState?.status || '').toUpperCase() !== 'VALIDATED' ||
      String(doState?.provider || '').toUpperCase() !== 'TALLY') return intent;
  const proof = doState?.metadata?.tally_validation_v1;
  if (!proof || proof.reference !== intent.reference ||
      proof.mission !== intent.mission || proof.schedule !== intent.schedule ||
      Number(proof.amount_cents) !== Number(intent.amount_cents) ||
      proof.currency !== intent.currency || !proof.validated_at) return intent;

  const enriched = {...intent};
  for (const field of [
    'customer_name', 'customer_email', 'customer_phone', 'customer_company',
    'validated_at', 'tally_event_id', 'tally_submission_id',
    'tally_respondent_id', 'legal_access_evidence', 'tally_fields'
  ]) {
    if (!enriched[field] && proof[field]) enriched[field] = proof[field];
  }
  const history = Array.isArray(enriched.validation_history) ? enriched.validation_history : [];
  if (!history.some(row => row?.result === 'VALIDATED' &&
    (row?.event_id === proof.tally_event_id || row?.submission_id === proof.tally_submission_id))) {
    const validatedLine = Array.isArray(proof.validation_history) ?
      proof.validation_history.find(row => row?.result === 'VALIDATED') : null;
    if (validatedLine) {
      enriched.validation_history = [validatedLine, ...history].slice(-20);
    }
  }
  return enriched;
}

async function createStripeCheckout(request, env) {
  const url = new URL(request.url);
  let reference = '';
  if (request.method === 'GET') {
    reference = String(url.searchParams.get('reference') || '').trim();
  } else {
    const form = await request.formData().catch(() => null);
    reference = String(form?.get('reference') || '').trim();
  }
  if (!REF_RE.test(reference)) return html(errorPage('Référence de paiement invalide.'), 400);

  const secret = String(env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) return html(errorPage('Le paiement par carte est momentanément indisponible.'), 503);

  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);

  // Même état temps réel que paymentPage : le clic paiement ne doit pas retomber sur un INTENTS encore propagé en CREATED.
  let doState = null;
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      const doResult = await env.PAYMENT_STATE_SERVICE.getState(reference);
      if (doResult?.ok && doResult?.state) doState = doResult.state;
    } catch (doErr) {
      console.error('DO_GETSTATE_FAILED_CHECKOUT', reference, String(doErr?.message || doErr || ''));
    }
  }

  if (String(doState?.status || '').toUpperCase() === 'PAID') {
    return html(paymentAlreadyConfirmedPage(intent, doState), 200);
  }

  const kvStatus = String(intent.status || '').toUpperCase();
  const effectiveStatus =
    String(doState?.status || '').toUpperCase() === 'VALIDATED' &&
    kvStatus !== 'CHANGE_REQUESTED' &&
    kvStatus !== 'REJECTED'
      ? 'VALIDATED'
      : kvStatus;

  const payment = await getPaymentState(reference, env);
  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Le statut du paiement ne peut pas être vérifié pour le moment. Aucun nouveau paiement n’est lancé afin d’éviter un double règlement. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') return html(paymentAlreadyConfirmedPage(intent, payment.data), 200);
  if (effectiveStatus !== 'VALIDATED') {
    if (effectiveStatus === 'CHANGE_REQUESTED') return html(changeRequestedPage(intent), 409);
    if (effectiveStatus === 'REJECTED' && intent.reject_reason === 'retraction_14d_without_express_request') return html(retractionBlockedPage(intent), 409);
    return html(errorPage('Cette mission n’est pas autorisée au paiement.'), 409);
  }

  const tariffGate = validateStoredPwaPaymentIntent(intent, env);
  if (!tariffGate.ok) {
    return html(errorPage('Ancien tarif ou conditions de mission non conformes. Aucun paiement par carte n’est lancé.'), 409);
  }

  // Coordonnées signées Tally issues de l'état DO si le KV est en retard.
  // Fallback inchangé : DO sans preuve (anciens dossiers / indisponibilité)
  // => parcours Stripe habituel, avec saisie possible de l'e-mail.
  const stripeIntent = overlayTallyValidationFromDo(intent, doState);

  const amount = Number(intent.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500000) {
    return html(errorPage('Montant de paiement invalide.'), 400);
  }
  if (String(intent.currency || '').toLowerCase() !== 'eur') {
    return html(errorPage('Devise de paiement invalide.'), 400);
  }

  // Une seule session Checkout active par référence : les clics répétés réutilisent la même URL.
  if (intent.stripe_checkout_session_id && intent.stripe_checkout_url) {
    return new Response(null, {
      status: 303,
      headers: {
        'location': String(intent.stripe_checkout_url),
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer'
      }
    });
  }

  const gatewayOrigin = new URL(request.url).origin;
  const successUrl = `${gatewayOrigin}/pay?reference=${encodeURIComponent(reference)}&stripe=success`;
  const cancelUrl = `${gatewayOrigin}/pay?reference=${encodeURIComponent(reference)}&stripe=cancel`;
  const customerEmail = String(stripeIntent.customer_email || stripeIntent.email || '').trim();
  const missionLabel = String(intent.mission || 'Mission CYRNEA').slice(0, 120);

  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('client_reference_id', reference);
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.set('line_items[0][price_data][currency]', 'eur');
  body.set('line_items[0][price_data][unit_amount]', String(amount));
  body.set('line_items[0][price_data][product_data][name]', `CYRNEA — ${missionLabel}`);
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[reference]', reference);
  body.set('metadata[mission]', missionLabel);
  body.set('payment_intent_data[metadata][reference]', reference);
  body.set('payment_intent_data[metadata][mission]', missionLabel);
  if (customerEmail) body.set('customer_email', customerEmail);

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': `cyrnea-checkout-${reference}`
    },
    body
  });

  const stripeData = await stripeResponse.json().catch(() => null);
  if (!stripeResponse.ok || !stripeData?.url || !stripeData?.id) {
    return html(errorPage('Stripe n’a pas pu préparer le paiement. Aucun débit n’a été effectué. Réessayez dans quelques instants.'), 502);
  }

  // Relecture après l'API : restituer la preuve Tally issue du DO quand la
  // lecture KV est ancienne. On conserve aussi les données les plus récentes
  // déjà vues. Pas de verrou additionnel sur la page de paiement.
  const beforeWriteRaw = await env.INTENTS.get(`intent:${reference}`);
  const beforeWrite = beforeWriteRaw ? JSON.parse(beforeWriteRaw) : intent;
  const beforeWriteStatus = String(beforeWrite.status || '').toUpperCase();
  if (['CHANGE_REQUESTED', 'REJECTED', 'PAID'].includes(beforeWriteStatus)) {
    return html(errorPage('Cette mission a changé de statut. Aucun nouveau paiement ne doit être engagé.'), 409);
  }
  const restored = overlayTallyValidationFromDo(beforeWrite, doState);
  for (const field of [
    'customer_name', 'customer_email', 'customer_phone', 'customer_company',
    'validated_at', 'tally_event_id', 'tally_submission_id',
    'tally_respondent_id', 'legal_access_evidence', 'tally_fields'
  ]) {
    if (!restored[field] && stripeIntent[field]) restored[field] = stripeIntent[field];
  }
  const restoredHistory = Array.isArray(restored.validation_history) ? restored.validation_history : [];
  const stripeHistory = Array.isArray(stripeIntent.validation_history) ? stripeIntent.validation_history : [];
  for (const item of stripeHistory) {
    if (item?.result === 'VALIDATED' && !restoredHistory.some(r =>
      r?.result === 'VALIDATED' && r?.event_id === item.event_id)) {
      restoredHistory.unshift(item);
    }
  }
  if (restoredHistory.length) restored.validation_history = restoredHistory.slice(-20);
  const now = new Date().toISOString();
  const updated = {
    ...restored,
    status: effectiveStatus,
    stripe_checkout_session_id: String(stripeData.id),
    stripe_checkout_url: String(stripeData.url),
    stripe_checkout_created_at: now,
    validation_history: appendHistory(restored, {
      at: now,
      result: 'STRIPE_CHECKOUT_CREATED',
      stripe_session_id: String(stripeData.id)
    })
  };
  await env.INTENTS.put(`intent:${reference}`, JSON.stringify(updated), { expirationTtl: INTENT_TTL_SECONDS });

  return new Response(null, {
    status: 303,
    headers: {
      'location': String(stripeData.url),
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer'
    }
  });
}


function paypalApiBase(env) {
  return String(env.PAYPAL_MODE || '').trim().toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken(env) {
  const clientId = String(env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return { ok: false, reason: 'paypal_credentials_missing' };

  const credentials = btoa(`${clientId}:${clientSecret}`);
  try {
    const r = await fetch(`${paypalApiBase(env)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'authorization': `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'application/json'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    const x = await r.json().catch(() => null);
    if (!r.ok || !x?.access_token) return { ok: false, status: r.status, reason: 'paypal_oauth_failed' };
    return { ok: true, token: String(x.access_token) };
  } catch {
    return { ok: false, reason: 'paypal_unreachable' };
  }
}

async function sendPaymentAlert(payload, env, intent = {}) {
  if (!env.ALERT_SECRET) {
    console.error('CYRNEA_ALERT_SKIPPED', {
      reference: payload.reference,
      provider: payload.provider,
      reason: 'alert_secret_missing'
    });
    return;
  }

  if (!env.ALERT_SERVICE) {
    console.error('CYRNEA_ALERT_SKIPPED', {
      reference: payload.reference,
      provider: payload.provider,
      reason: 'alert_service_binding_missing'
    });
    return;
  }

  try {
    const response = await env.ALERT_SERVICE.fetch('https://cyrnea-reservation-alerts/alert', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.ALERT_SECRET}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        reference: payload.reference,
        provider: payload.provider,
        event_id: payload.event_id,
        order_id: payload.order_id,
        amount_cents: payload.amount_cents,
        currency: payload.currency,
        mission: payload.mission || intent.mission || '',
        contract: payload.contract || intent.contract || '',
        universe: payload.universe || intent.universe || '',
        schedule: payload.schedule || intent.schedule || '',
        price_text: payload.price_text || intent.price_text || '',
        customer_name: intent.customer_name || '',
        customer_email: intent.customer_email || intent.email || '',
        customer_phone: intent.customer_phone || '',
        customer_company: intent.customer_company || '',
        alert_id: payload.event_id || `${payload.provider}:${payload.reference}`
      })
    });

    if (!response.ok) {
      console.error('CYRNEA_ALERT_FAILED', {
        reference: payload.reference,
        provider: payload.provider,
        http_status: response.status
      });
    }
  } catch (err) {
    console.error('CYRNEA_ALERT_FAILED', {
      reference: payload.reference,
      provider: payload.provider,
      error: String(err?.message || err)
    });
  }
}


async function createPayPalCheckout(request, env) {
  const url = new URL(request.url);
  let reference = '';
  if (request.method === 'GET') {
    reference = String(url.searchParams.get('reference') || '').trim();
  } else {
    const form = await request.formData().catch(() => null);
    reference = String(form?.get('reference') || '').trim();
  }
  if (!REF_RE.test(reference)) return html(errorPage('Référence de paiement invalide.'), 400);
  if (!env.PAYMENTS) return html(errorPage('PayPal est en cours de configuration serveur. Aucun paiement PayPal n’a été lancé.'), 503);

  const clientId = String(env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return html(errorPage('Le paiement PayPal est momentanément indisponible.'), 503);

  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);

  // Même état temps réel que paymentPage : le clic paiement ne doit pas retomber sur un INTENTS encore propagé en CREATED.
  let doState = null;
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      const doResult = await env.PAYMENT_STATE_SERVICE.getState(reference);
      if (doResult?.ok && doResult?.state) doState = doResult.state;
    } catch (doErr) {
      console.error('DO_GETSTATE_FAILED_CHECKOUT', reference, String(doErr?.message || doErr || ''));
    }
  }

  if (String(doState?.status || '').toUpperCase() === 'PAID') {
    return html(paymentAlreadyConfirmedPage(intent, doState), 200);
  }

  const kvStatus = String(intent.status || '').toUpperCase();
  const effectiveStatus =
    String(doState?.status || '').toUpperCase() === 'VALIDATED' &&
    kvStatus !== 'CHANGE_REQUESTED' &&
    kvStatus !== 'REJECTED'
      ? 'VALIDATED'
      : kvStatus;

  const payment = await getPaymentState(reference, env);
  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Le statut du paiement ne peut pas être vérifié pour le moment. Aucun nouveau paiement n’est lancé afin d’éviter un double règlement. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') return html(paymentAlreadyConfirmedPage(intent, payment.data), 200);
  if (effectiveStatus !== 'VALIDATED') {
    if (effectiveStatus === 'CHANGE_REQUESTED') return html(changeRequestedPage(intent), 409);
    if (effectiveStatus === 'REJECTED' && intent.reject_reason === 'retraction_14d_without_express_request') return html(retractionBlockedPage(intent), 409);
    return html(errorPage('Cette mission n’est pas autorisée au paiement.'), 409);
  }

  const tariffGate = validateStoredPwaPaymentIntent(intent, env);
  if (!tariffGate.ok) {
    return html(errorPage('Ancien tarif ou conditions de mission non conformes. Aucune commande PayPal n’est lancée.'), 409);
  }

  const amount = Number(intent.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500000) {
    return html(errorPage('Montant de paiement invalide.'), 400);
  }
  if (String(intent.currency || '').toLowerCase() !== 'eur') {
    return html(errorPage('Devise de paiement invalide.'), 400);
  }

  // Réutilise une commande PayPal déjà créée pour cette même référence afin d'éviter les doublons.
  if (intent.paypal_order_id && intent.paypal_approve_url) {
    return new Response(null, {
      status: 303,
      headers: {
        'location': String(intent.paypal_approve_url),
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer'
      }
    });
  }

  const auth = await paypalAccessToken(env);
  if (!auth.ok) return html(errorPage('PayPal n’a pas pu être contacté. Aucun débit n’a été effectué. Réessayez dans quelques instants.'), 502);

  const gatewayOrigin = new URL(request.url).origin;
  const returnUrl = `${gatewayOrigin}/paypal-return?reference=${encodeURIComponent(reference)}`;
  const cancelUrl = `${gatewayOrigin}/paypal-cancel?reference=${encodeURIComponent(reference)}`;
  const missionLabel = String(intent.mission || 'Mission CYRNEA').slice(0, 100);
  const value = (amount / 100).toFixed(2);

  const orderBody = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: reference,
      custom_id: reference,
      description: `CYRNEA — ${missionLabel}`.slice(0, 127),
      amount: { currency_code: 'EUR', value }
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'CYRNEA',
          locale: 'fr-FR',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl
        }
      }
    }
  };

  let r;
  let x;
  try {
    r = await fetch(`${paypalApiBase(env)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${auth.token}`,
        'content-type': 'application/json',
        'accept': 'application/json',
        'prefer': 'return=representation',
        'paypal-request-id': `cyrnea-order-${reference}`.slice(0, 108)
      },
      body: JSON.stringify(orderBody)
    });
    x = await r.json().catch(() => null);
  } catch {
    return html(errorPage('PayPal n’a pas pu préparer le paiement. Aucun débit n’a été effectué. Réessayez dans quelques instants.'), 502);
  }

  const approveUrl = Array.isArray(x?.links)
    ? String((x.links.find(l => l?.rel === 'payer-action') || x.links.find(l => l?.rel === 'approve'))?.href || '')
    : '';
  if (!r.ok || !x?.id || !approveUrl) {
    return html(errorPage('PayPal n’a pas pu préparer le paiement. Aucun débit n’a été effectué. Réessayez dans quelques instants.'), 502);
  }

  const now = new Date().toISOString();
  const updated = {
    ...intent,
    status: effectiveStatus,
    paypal_order_id: String(x.id),
    paypal_approve_url: approveUrl,
    paypal_order_created_at: now,
    paypal_mode: String(env.PAYPAL_MODE || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox',
    validation_history: appendHistory(intent, {
      at: now,
      result: 'PAYPAL_ORDER_CREATED',
      paypal_order_id: String(x.id)
    })
  };
  await env.INTENTS.put(`intent:${reference}`, JSON.stringify(updated), { expirationTtl: INTENT_TTL_SECONDS });

  return new Response(null, {
    status: 303,
    headers: {
      'location': approveUrl,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer'
    }
  });
}

async function paypalReturn(url, env, ctx) {
  const reference = String(url.searchParams.get('reference') || '').trim();
  const returnedOrderId = String(url.searchParams.get('token') || '').trim();
  if (!REF_RE.test(reference)) return html(errorPage('Référence de paiement invalide.'), 400);
  if (!env.PAYMENTS) return html(errorPage('La confirmation PayPal ne peut pas être enregistrée pour le moment. Aucun nouveau paiement n’est lancé.'), 503);

  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);

  // Même état temps réel que paymentPage/checkout : le retour PayPal ne doit pas être bloqué par un INTENTS encore propagé.
  let doState = null;
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      const doResult = await env.PAYMENT_STATE_SERVICE.getState(reference);
      if (doResult?.ok && doResult?.state) doState = doResult.state;
    } catch (doErr) {
      console.error('DO_GETSTATE_FAILED_PAYPAL_RETURN', reference, String(doErr?.message || doErr || ''));
    }
  }

  if (String(doState?.status || '').toUpperCase() === 'PAID') {
    return new Response(null, { status: 303, headers: { location: `/pay?reference=${encodeURIComponent(reference)}`, 'cache-control': 'no-store' } });
  }

  const kvStatus = String(intent.status || '').toUpperCase();
  const effectiveStatus =
    String(doState?.status || '').toUpperCase() === 'VALIDATED' &&
    kvStatus !== 'CHANGE_REQUESTED' &&
    kvStatus !== 'REJECTED'
      ? 'VALIDATED'
      : kvStatus;

  const payment = await getPaymentState(reference, env);
  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Le statut du paiement ne peut pas être vérifié pour le moment. Aucun nouveau débit n’est lancé. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') return new Response(null, { status: 303, headers: { location: `/pay?reference=${encodeURIComponent(reference)}`, 'cache-control': 'no-store' } });
  if (effectiveStatus !== 'VALIDATED') {
    return html(errorPage('Cette mission n’est plus autorisée au paiement. Aucun débit PayPal n’a été lancé.'), 409);
  }

  const tariffGate = validateStoredPwaPaymentIntent(intent, env);
  if (!tariffGate.ok) {
    return html(errorPage('Le prix ou les conditions de cette référence ne sont plus autorisés. Aucune capture PayPal effectuée ; contactez CYRNEA.'), 409);
  }

  const storedOrderId = String(intent.paypal_order_id || '').trim();
  if (!storedOrderId || !returnedOrderId || returnedOrderId !== storedOrderId) {
    return html(errorPage('Le retour PayPal ne correspond pas à la mission préparée. Aucun débit n’a été confirmé.'), 409);
  }

  const amount = Number(intent.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500000 || String(intent.currency || '').toLowerCase() !== 'eur') {
    return html(errorPage('Montant de paiement invalide.'), 400);
  }

  const auth = await paypalAccessToken(env);
  if (!auth.ok) return html(errorPage('PayPal n’a pas pu confirmer le paiement pour le moment. Réessayez dans quelques instants.'), 502);

  let r;
  let x;
  try {
    r = await fetch(`${paypalApiBase(env)}/v2/checkout/orders/${encodeURIComponent(storedOrderId)}/capture`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${auth.token}`,
        'content-type': 'application/json',
        'accept': 'application/json',
        'prefer': 'return=representation',
        'paypal-request-id': `cyrnea-capture-${reference}`.slice(0, 108)
      },
      body: '{}'
    });
    x = await r.json().catch(() => null);
  } catch {
    return html(errorPage('PayPal n’a pas pu confirmer le paiement pour le moment. Réessayez dans quelques instants.'), 502);
  }

  // En cas de nouvel appel après une capture déjà effectuée, relire l'ordre évite toute double capture.
  if (!r.ok) {
    try {
      const show = await fetch(`${paypalApiBase(env)}/v2/checkout/orders/${encodeURIComponent(storedOrderId)}`, {
        method: 'GET',
        headers: { 'authorization': `Bearer ${auth.token}`, 'accept': 'application/json' }
      });
      const shown = await show.json().catch(() => null);
      if (show.ok && shown) x = shown;
      else return html(errorPage('PayPal n’a pas confirmé le règlement. Aucun statut payé n’a été enregistré.'), 502);
    } catch {
      return html(errorPage('PayPal n’a pas confirmé le règlement. Aucun statut payé n’a été enregistré.'), 502);
    }
  }

  const capture = extractCompletedPayPalCapture(x);
  const expectedValue = (amount / 100).toFixed(2);
  const captureValue = String(capture?.amount?.value || '');
  const captureCurrency = String(capture?.amount?.currency_code || '').toUpperCase();
  const purchaseUnit = Array.isArray(x?.purchase_units) ? x.purchase_units[0] : null;
  const sourceRef = String(purchaseUnit?.custom_id || purchaseUnit?.reference_id || '');

  if (
    String(x?.status || '').toUpperCase() !== 'COMPLETED' ||
    !capture ||
    String(capture.status || '').toUpperCase() !== 'COMPLETED' ||
    captureValue !== expectedValue ||
    captureCurrency !== 'EUR' ||
    sourceRef !== reference
  ) {
    return html(errorPage('Le paiement PayPal n’est pas confirmé avec les données attendues. Aucun statut payé n’a été enregistré.'), 409);
  }

  const now = new Date().toISOString();
  const proof = {
    reference,
    status: 'PAID',
    provider: 'PAYPAL',
    amount_cents: amount,
    currency: 'eur',
    method: 'PAYPAL',
    order_id: storedOrderId,
    capture_id: String(capture.id || ''),
    payer_id: String(x?.payer?.payer_id || ''),
    event_id: `PAYPAL:${String(capture.id || storedOrderId)}`,
    mission: intent.mission || '',
    contract: intent.contract || '',
    universe: intent.universe || '',
    schedule: intent.schedule || '',
    price_text: intent.price_text || '',
    verified_at: now
  };

  // Même clé que les autres preuves de paiement CYRNEA : le backend /payment-status reste inchangé.
  await env.PAYMENTS.put(`PAYMENT:${reference}`, JSON.stringify(proof));

  // Alerte iPhone uniquement après preuve PAYPAL PAID vérifiée et écrite.
  // Non bloquant : un échec du Worker d'alertes ne remet jamais en cause le paiement.
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(sendPaymentAlert(proof, env, intent));
  } else {
    console.error('CYRNEA_ALERT_SKIPPED', {
      reference,
      provider: 'PAYPAL',
      reason: 'execution_context_missing'
    });
  }

  const updated = {
    ...intent,
    paypal_capture_id: String(capture.id || ''),
    paypal_paid_at: now,
    validation_history: appendHistory(intent, {
      at: now,
      result: 'PAYPAL_CAPTURE_COMPLETED',
      paypal_order_id: storedOrderId,
      paypal_capture_id: String(capture.id || '')
    })
  };
  await env.INTENTS.put(`intent:${reference}`, JSON.stringify(updated), { expirationTtl: INTENT_TTL_SECONDS });

  // État PAID temps réel, après preuve PayPal vérifiée et conservée dans PAYMENTS.
  if (env.PAYMENT_STATE_SERVICE) {
    try {
      const doResult = await env.PAYMENT_STATE_SERVICE.setState(reference, {
        status: 'PAID',
        provider: 'PAYPAL',
        amount_cents: amount,
        currency: 'eur'
      });
      if (!doResult?.ok) {
        console.error('DO_SETSTATE_FAILED_PAID', reference, String(doResult?.error || 'unknown'));
      }
    } catch (doErr) {
      console.error('DO_SETSTATE_FAILED_PAID', reference, String(doErr?.message || doErr || ''));
    }
  }

  return new Response(null, {
    status: 303,
    headers: {
      'location': `/pay?reference=${encodeURIComponent(reference)}&paypal=success`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer'
    }
  });
}

function paypalCancel(url) {
  const reference = String(url.searchParams.get('reference') || '').trim();
  if (!REF_RE.test(reference)) return html(errorPage('Référence de paiement invalide.'), 400);
  return new Response(null, {
    status: 303,
    headers: {
      'location': `/pay?reference=${encodeURIComponent(reference)}&paypal=cancel`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer'
    }
  });
}

function extractCompletedPayPalCapture(order) {
  const units = Array.isArray(order?.purchase_units) ? order.purchase_units : [];
  for (const unit of units) {
    const captures = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [];
    const completed = captures.find(c => String(c?.status || '').toUpperCase() === 'COMPLETED');
    if (completed) return completed;
  }
  return null;
}
// Les informations client ne doivent provenir que de l'intention serveur
// validée/reçue via Tally, jamais de paramètres d'URL exposant des données perso.
function hasChangeContact(intent) {
  const name = clean(intent?.customer_name, 200);
  const email = clean(intent?.customer_email || intent?.email, 200);
  const phone = clean(intent?.customer_phone, 80);
  return Boolean(name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.replace(/\D/g,'').length >= 6);
}

// Lecture seule, sans aucune donnée personnelle dans la réponse.
async function changeMissionReady(url, env) {
  const reference = String(url.searchParams.get('reference') || '').trim();
  if (!REF_RE.test(reference)) return json({ok:false,error:'invalid_reference'},400);
  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return json({ok:false,error:'unknown_reference'},404);
  const intent = JSON.parse(raw);
  const status = String(intent.status || '').toUpperCase();
  if (status === 'CHANGE_REQUESTED') return json({ok:true,ready:false,finished:true},200);
  return json({ok:true,ready:hasChangeContact(intent),finished:false},200);
}

function changeContactSyncPage(intent) {
  const reference = String(intent.reference || '');
  const changeUrl = `/change-mission?reference=${encodeURIComponent(reference)}`;
  const readyUrl = `/change-mission-ready?reference=${encodeURIComponent(reference)}`;
  const backUrl = intent.status === 'VALIDATED'
    ? `/pay?reference=${encodeURIComponent(reference)}`
    : buildTallyUrl(intent);
  const script = `
    (() => {
      let tries = 0;
      const info = document.getElementById('status-contact');
      const action = document.getElementById('action-contact');
      const poll = async () => {
        tries++;
        try {
          const response = await fetch(${JSON.stringify(readyUrl)}, {cache:'no-store',credentials:'omit'});
          const result = await response.json();
          if (result.ok && result.ready) {
            window.location.replace(${JSON.stringify(changeUrl)});
            return;
          }
          if (result.ok && result.finished) {
            window.location.replace(${JSON.stringify(changeUrl)});
            return;
          }
        } catch (e) {}
        if (tries < 20) {
          setTimeout(poll, 1500);
        } else {
          info.textContent = 'La transmission par Tally n’est pas encore terminée. Votre demande de modification n’a pas été enregistrée.';
          action.hidden = false;
        }
      };
      setTimeout(poll, 400);
    })();`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Récupération de votre validation - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Votre validation est en cours de transmission</h1><p id="status-contact">Nous récupérons automatiquement les informations que vous venez de renseigner dans Tally.</p><p><strong>Aucune ressaisie n’est nécessaire.</strong> Aucun paiement n'est lancé et aucune modification n'est enregistrée pendant cette vérification.</p><div class="summary"><b>Mission</b><span>${esc(intent.mission)}</span><b>Créneau</b><span>${esc(intent.schedule)}</span><b>Référence</b><span>${esc(reference)}</span></div><div class="payments"><p id="action-contact" hidden><a class="pay primary" href="${escAttr(changeUrl)}">VÉRIFIER DE NOUVEAU</a></p><a class="pay" href="${escAttr(backUrl)}">REVENIR À LA VALIDATION</a></div><p class="note">Si la transmission Tally échoue durablement, aucune nouvelle demande ne sera confirmée sans les coordonnées nécessaires.</p></main><script>${script}</script></body></html>`;
}

async function changeMissionPage(url, env) {
  const reference = String(url.searchParams.get('reference') || '').trim();
  if (!REF_RE.test(reference)) return html(errorPage('Référence de mission invalide.'), 400);

  const raw = await env.INTENTS.get(`intent:${reference}`);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);
  const payment = await getPaymentState(reference, env);

  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Impossible de vérifier le statut du paiement pour le moment. Aucune modification n’a été enregistrée. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') {
    return html(errorPage('Le paiement de cette mission est déjà confirmé. La commande ne peut plus être modifiée automatiquement. Contactez CYRNEA.'), 409);
  }
  if (intent.status === 'CHANGE_REQUESTED') return html(changeRequestedPage(intent), 200);

  const returnUrl = intent.status === 'VALIDATED' ? `/pay?reference=${encodeURIComponent(reference)}` : buildTallyUrl(intent);
  const returnLabel = intent.status === 'VALIDATED' ? 'REVENIR AU PAIEMENT' : 'REVENIR À LA VALIDATION / COMMANDER';

  // La redirection Tally peut précéder la livraison du webhook. Ne jamais demander
  // au client de ressaisir des coordonnées déjà données dans Tally.
  if (!hasChangeContact(intent)) {
    return html(changeContactSyncPage(intent), 202);
  }

  return html(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Modifier ma mission - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Modifier ma mission</h1><p>Vous demandez à revoir la mission préparée avant paiement.</p><div class="summary"><b>Mission actuelle</b><span>${esc(intent.mission)}</span><b>Créneau</b><span>${esc(intent.schedule)}</span><b>Référence</b><span>${esc(intent.reference)}</span></div><p>Aucun paiement ne sera lancé par cette demande. CYRNEA reprendra la qualification avec les informations déjà connues.</p><div class="payments"><form method="post" action="/change-mission"><input type="hidden" name="reference" value="${escAttr(reference)}"><button class="pay primary" type="submit">CONFIRMER MA DEMANDE DE MODIFICATION</button></form><a class="pay" href="${escAttr(returnUrl)}">${esc(returnLabel)}</a></div><p class="note">Si vous ne souhaitez finalement rien modifier, utilisez le bouton de retour ci-dessus.</p></main></body></html>`, 200);
}

async function changeMissionRequest(request, env) {
  const form = await request.formData().catch(() => null);
  const reference = String(form?.get('reference') || '').trim();
  if (!REF_RE.test(reference)) return html(errorPage('Référence de mission invalide.'), 400);

  const key = `intent:${reference}`;
  const raw = await env.INTENTS.get(key);
  if (!raw) return html(errorPage('Cette référence est inconnue ou a expiré.'), 404);
  const intent = JSON.parse(raw);

  const payment = await getPaymentState(reference, env);
  if (payment.state === 'UNKNOWN') {
    return html(waitPage('Impossible de vérifier le statut du paiement pour le moment. Aucune modification n’a été enregistrée. Réessayez dans quelques instants.', reference), 503);
  }
  if (payment.state === 'PAID') {
    return html(errorPage('Le paiement de cette mission est déjà confirmé. La commande ne peut plus être modifiée automatiquement. Contactez CYRNEA.'), 409);
  }
  if (intent.status === 'CHANGE_REQUESTED') return html(changeRequestedPage(intent), 200);

  // En cas de retard Tally/KV, sécuriser les coordonnées AVANT de bloquer.
  // Jamais de demande inexploitable sans nom, e-mail et téléphone.
  const contactName = clean(intent.customer_name, 200);
  const contactEmail = clean(intent.customer_email || intent.email, 200).toLowerCase();
  const contactPhone = clean(intent.customer_phone, 80);
  if (!contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactPhone.replace(/\D/g,'').length < 6) {
    // Un onglet ancien pouvait contenir le formulaire. Ne jamais enregistrer
    // une demande sans coordonnées ; patienter sans les redemander.
    return html(changeContactSyncPage(intent), 202);
  }

  // Si une session Stripe a déjà été ouverte, on l'expire AVANT de bloquer l'ancienne référence.
  // Ainsi le client ne peut pas payer une ancienne mission après avoir demandé sa modification.
  if (intent.stripe_checkout_session_id) {
    const expired = await expireStripeCheckoutSession(intent.stripe_checkout_session_id, env);
    if (!expired.ok) {
      return html(errorPage('La demande de modification ne peut pas être enregistrée tant que l’ancienne fenêtre de paiement n’est pas neutralisée. Réessayez dans quelques instants.'), 503);
    }
  }

  const now = new Date().toISOString();
  const updated = {
    ...intent,
    customer_name: contactName,
    customer_email: contactEmail,
    customer_phone: contactPhone,
    status: 'CHANGE_REQUESTED',
    change_requested_at: now,
    validation_history: appendHistory(intent, {
      at: now,
      result: 'CHANGE_REQUESTED',
      prior_status: intent.status || null
    })
  };
  await env.INTENTS.put(key, JSON.stringify(updated), { expirationTtl: INTENT_TTL_SECONDS });

  // Alerte opérateur dédiée à la modification, distincte d'une preuve de paiement.
  // Le service ALERT_SERVICE doit prendre en charge provider=CHANGE_REQUEST ;
  // sinon ne jamais annoncer au client que CYRNEA a été avertie.
  const notification = await sendChangeRequestAlert(updated, env);
  if (!notification.ok) {
    console.error('CYRNEA_CHANGE_NOTIFICATION_FAILED', reference, notification.reason || 'unknown');
    return html(changeNotificationPendingPage(updated), 503);
  }
  return html(changeRequestedPage(updated), 200);
}

async function sendChangeRequestAlert(intent, env) {
  if (!env.ALERT_SERVICE || !env.ALERT_SECRET) {
    return { ok: false, reason: 'alert_service_or_secret_missing' };
  }
  try {
    const response = await env.ALERT_SERVICE.fetch('https://cyrnea-reservation-alerts/alert', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.ALERT_SECRET}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'CHANGE_REQUEST',
        event_id: `CHANGE_REQUEST:${intent.reference}`,
        alert_id: `CHANGE_REQUEST:${intent.reference}`,
        reference: intent.reference,
        mission: intent.mission || '',
        contract: intent.contract || '',
        universe: intent.universe || '',
        schedule: intent.schedule || '',
        price_text: intent.price_text || '',
        amount_cents: intent.amount_cents || 0,
        currency: intent.currency || 'eur',
        customer_name: intent.customer_name || '',
        customer_email: intent.customer_email || intent.email || '',
        customer_phone: intent.customer_phone || '',
        customer_company: intent.customer_company || '',
        change_requested_at: intent.change_requested_at || ''
      })
    });
    if (!response.ok) return { ok: false, reason: `alert_http_${response.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

function changeContactMissingPage(reference) {
  const back = `/change-mission?reference=${encodeURIComponent(reference)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Coordonnées à compléter - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Coordonnées à compléter</h1><p>Pour pouvoir vous recontacter à propos de votre modification, CYRNEA doit disposer de votre nom, de votre e-mail et de votre téléphone.</p><p><strong>Aucune modification n'a encore été enregistrée et aucun paiement n'a été lancé.</strong></p><p><a class="pay primary" href="${escAttr(back)}">COMPLÉTER LES INFORMATIONS MANQUANTES</a></p></main></body></html>`;
}

function changeNotificationPendingPage(intent) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Modification en attente - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Modification enregistrée — notification non confirmée</h1><p>Votre ancienne référence de paiement est bloquée. L'envoi de votre demande à CYRNEA n'a pas pu être confirmé. Contactez CYRNEA en indiquant la référence ci-dessous.</p><p class="note">Référence : ${esc(intent.reference)}</p><p>Ne réglez pas l'ancienne demande.</p></main></body></html>`;
}

async function expireStripeCheckoutSession(sessionId, env) {
  const secret = String(env.STRIPE_SECRET_KEY || '').trim();
  if (!secret) return { ok: false, reason: 'stripe_secret_missing' };
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
        'idempotency-key': `cyrnea-expire-${sessionId}`
      },
      body: new URLSearchParams()
    });
    if (r.ok) return { ok: true };
    const x = await r.json().catch(() => null);
    // Une session déjà expirée est sans danger. Une session déjà payée sera détectée par payment-status avant cet appel.
    if (x?.error?.code === 'resource_missing') return { ok: true };
    return { ok: false, status: r.status, error: x?.error?.code || 'stripe_expire_failed' };
  } catch {
    return { ok: false, reason: 'stripe_unreachable' };
  }
}

async function getPaymentState(reference, env) {
  try {
    const u = new URL(PAYMENT_STATUS_BASE + '/payment-status');
    u.searchParams.set('reference', reference);
    const headers = new Headers();
    if (env.PWA_ORIGIN) headers.set('Origin', String(env.PWA_ORIGIN));
    const r = await fetch(u.toString(), { method: 'GET', headers });
    if (r.status === 404) return { state: 'UNPAID' };
    if (!r.ok) return { state: 'UNKNOWN', http_status: r.status };
    const x = await r.json().catch(() => null);
    if (!x) return { state: 'UNKNOWN' };
    return String(x.status || '').toUpperCase() === 'PAID'
      ? { state: 'PAID', data: x }
      : { state: 'UNPAID', data: x };
  } catch {
    return { state: 'UNKNOWN' };
  }
}

function changeRequestedPage(intent) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Modification demandée - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Demande de modification enregistrée</h1><p>Votre demande de modification a bien été enregistrée. CYRNEA va reprendre votre demande et vous adressera un nouveau récapitulatif à valider.</p><p>Aucun paiement ne doit être effectué avec l’ancienne référence. Vous pouvez fermer cette page.</p><p class="note"><b>Si une fenêtre Stripe / PayPal est déjà ouverte, ne l’utilisez plus.</b><br>Référence bloquée : ${esc(intent.reference)}</p></main></body></html>`;
}

function retractionBlockedPage(intent) {
  const retryUrl = buildTallyUrl(intent);
  const changeUrl = `/change-mission?reference=${encodeURIComponent(intent.reference)}`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Choix de rétractation - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Paiement bloqué pour ce créneau</h1><p>Pour ce créneau, le paiement nécessite votre demande expresse d’exécution avant la fin du délai légal de rétractation de 14 jours.</p><p>Vous pouvez modifier uniquement ce choix, sans ressaisir vos coordonnées ni les informations de mission.</p><div class="payments"><a class="pay primary" href="${escAttr(retryUrl)}">MODIFIER MON CHOIX</a><a class="pay" href="${escAttr(changeUrl)}">JE SOUHAITE MODIFIER MA MISSION</a></div><p class="note">Référence : ${esc(intent.reference)}</p></main></body></html>`;
}

function buildTallyUrl(intent) {
  // SUIVI B2B (2 ou 3 jalons) utilise le Tally STANDARD même si le premier
  // passage est particulier, comme le Bridge déployé.
  const isB2bSuivi = intent?.contract === 'PRÉSENCE ENTREPRISES' &&
    !!PWA_B2B_CATALOG[String(intent.mission || '')]?.count;
  const standard = String(intent?.availability_mode || '').trim().toLowerCase() === 'standard' || isB2bSuivi;
  const base = intent.contract === 'RELAIS'
    ? (standard ? TALLY_RELAIS_STANDARD_URL : TALLY_RELAIS_HS_URL)
    : intent.contract === 'PRÉSENCE ENTREPRISES'
      ? (standard ? TALLY_B2B_STANDARD_URL : TALLY_B2B_HS_URL)
      : (standard ? TALLY_PRESENCE_STANDARD_URL : TALLY_PRESENCE_HS_URL);

  return addParams(base, {
    mission: intent.mission || '',
    objet: intent.object || '',
    tarif: intent.price_text || '',
    creneau: intent.schedule || '',
    reference_temporaire: intent.reference || '',
    nom_client: intent.customer_name || '',
    email_client: intent.customer_email || intent.email || '',
    telephone_client: intent.customer_phone || '',
    societe_client: intent.customer_company || '',
    cadre_client: intent.contract === 'PRÉSENCE ENTREPRISES'
      ? 'ENTREPRISE / DONNEUR D’ORDRE PROFESSIONNEL'
      : intent.contract === 'PRÉSENCE PROPRIÉTAIRES'
        ? 'PROPRIÉTAIRE PARTICULIER'
        : '',
    availability_mode: intent.availability_mode || '',
    ...(isConsumerContract(intent.contract) ? {
      execution_anticipee_14j: requiresEarlyExecutionConsent(intent) ? 'oui' : 'non'
    } : {})
  });
}

function renderPaymentPage(i, stripeEnabled, paypalEnabled, env, changeUrl) {

  const amount = (i.amount_cents / 100).toFixed(2).replace('.', ',') + ' €';

  const bankEnabled = !!(env.BANK_IBAN && env.BANK_BENEFICIARY);

  const stripeBlock = stripeEnabled

    ? `<a class="pay primary" rel="nofollow" href="/stripe-checkout?reference=${encodeURIComponent(i.reference)}">Carte bancaire / Apple Pay</a>`

    : `<div class="disabled">Carte / Apple Pay : configuration serveur en cours</div>`;

  const paypalBlock = paypalEnabled

    ? `<a class="pay primary" rel="nofollow" href="/paypal-checkout?reference=${encodeURIComponent(i.reference)}">PayPal</a>`

    : `<div class="disabled">PayPal : temporairement indisponible</div>`;

  const bankBlock = bankEnabled ? `

    <details><summary>Virement SEPA instantané</summary>

      <div class="bank"><b>Bénéficiaire :</b> ${esc(env.BANK_BENEFICIARY)}<br>

      <b>IBAN :</b> <span id="iban">${esc(env.BANK_IBAN)}</span><br>

      <b>Montant :</b> ${esc(amount)}<br>

      <b>Référence obligatoire :</b> <span id="ref">${esc(i.reference)}</span><br>

      <button onclick="navigator.clipboard.writeText(document.getElementById('iban').innerText)">Copier l’IBAN</button>

      <button onclick="navigator.clipboard.writeText(document.getElementById('ref').innerText)">Copier la référence</button>

      <p class="note">La mission ne sera confirmée qu’après constat réel de la réception du virement.</p>

      </div>

    </details>` : '';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">

  <meta name="robots" content="noindex,nofollow"><title>Paiement sécurisé - CYRNEA</title>${css()}</head>

  <body><main class="box"><div class="brand">CYRNEA</div><h1>Régler votre mission</h1>

  <div class="summary"><b>Mission</b><span>${esc(i.mission)}</span><b>Montant</b><span>${esc(amount)}</span><b>Référence</b><span>${esc(i.reference)}</span></div>

  <p>Choisissez votre moyen de paiement. Votre paiement ne confirme pas automatiquement le créneau : CYRNEA pourra le valider, en proposer un autre ou procéder à un remboursement.</p>

  <div class="payments">${stripeBlock}${paypalBlock}${bankBlock}<a class="pay" href="${escAttr(changeUrl)}">MODIFIER MA MISSION AVANT PAIEMENT</a></div>

  <p class="note">Ne modifiez pas la référence de paiement. Si vous demandez une modification, n’utilisez plus une éventuelle fenêtre de paiement déjà ouverte. En cas d’erreur, aucun H1/H2 n’est débloqué.</p>

  </main></body></html>`;

}

function paymentAlreadyConfirmedPage(intent, paymentData) {
  const amount = Number(paymentData?.amount_cents || intent.amount_cents || 0) / 100;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Paiement déjà confirmé - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Paiement déjà confirmé</h1><p>Aucun nouveau paiement n’est nécessaire pour cette référence.</p><div class="summary"><b>Mission</b><span>${esc(intent.mission)}</span><b>Montant enregistré</b><span>${esc(amount.toFixed(2).replace('.', ',') + ' €')}</span><b>Référence</b><span>${esc(intent.reference)}</span></div><p class="note">Vous pouvez fermer cette page. CYRNEA poursuit la confirmation de mission à partir de la preuve serveur du paiement.</p></main></body></html>`;
}

function paymentConflictPage(intent) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Vérification nécessaire - CYRNEA</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Vérification nécessaire</h1><p>Un paiement est enregistré pour cette référence alors que son statut de validation n’est plus compatible avec une poursuite automatique.</p><p>Aucune intervention ne doit être débloquée automatiquement. CYRNEA doit vérifier le dossier.</p><p class="note">Référence : ${esc(intent.reference)}</p></main></body></html>`;
}

function waitPage(message, reference) {

  const autoRefresh = String(message || '').startsWith('Votre validation est en cours de prise en compte.');
  const refreshScript = autoRefresh
    ? `<script>setTimeout(function(){window.location.reload();},1500);<\/script>`
    : '';
  const waitNote = autoRefresh
    ? '<p class="note">Veuillez patienter, cette page s’actualise automatiquement.</p>'
    : '<button onclick="location.reload()">Actualiser</button>';

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Validation en cours</title>${css()}${refreshScript}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Validation en cours</h1><p>${esc(message)}</p><p class="note">Référence : ${esc(reference)}</p>${waitNote}</main></body></html>`;

}

function errorPage(message) {

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Paiement indisponible</title>${css()}</head><body><main class="box"><div class="brand">CYRNEA</div><h1>Paiement indisponible</h1><p>${esc(message)}</p></main></body></html>`;

}

function css(){return `<style>body{font-family:Arial,sans-serif;background:#f5f3ef;color:#28313b;margin:0;padding:24px}.box{max-width:680px;margin:40px auto;background:#fff;border:1px solid #ddd6ce;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.06)}.brand{font-weight:800;letter-spacing:.12em;color:#29415f}.summary{display:grid;grid-template-columns:140px 1fr;gap:9px 16px;padding:16px;background:#f8f7f4;border-radius:12px;margin:18px 0}.payments{display:grid;gap:12px;margin-top:20px}.pay,.disabled,details{display:block;padding:15px;border-radius:10px;border:1px solid #cfc8bf;text-decoration:none;color:#28313b;background:#fff}.pay.primary{background:#29415f;color:#fff;border-color:#29415f}.disabled{opacity:.55}.bank{padding-top:12px;line-height:1.8}button{padding:10px 13px;margin:8px 6px 0 0}.note{font-size:13px;color:#66717c}@media(max-width:600px){body{padding:12px}.box{margin:12px auto;padding:18px}.summary{grid-template-columns:1fr}}</style>`}

// CYRNEA — Rétractation : indicateur commun aux 4 formulaires Propriétaires.
// Champ Tally execution_anticipee_14j : "non" masque la question ; "oui" la laisse visible.
// Les 2 formulaires PRÉSENCE ENTREPRISES ne sont pas concernés.
function cyrneaExecutionAnticipee14j(intent) {
  if (!isConsumerContract(intent?.contract)) return null;
  const schedule = String(intent?.schedule || '');
  const match = schedule.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return 'oui'; // Date inconnue : question visible, par prudence.

  const missionUtc = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  if (!Number.isFinite(missionUtc.getTime()) || ymdUtc(missionUtc) !== match[0]) {
    return 'oui';
  }
  const created = new Date(intent?.created_at || '');
  if (!Number.isFinite(created.getTime())) return 'oui';
  const start = parisParts(created); // Date de la demande dans le fuseau français.
  const expiry = new Date(Date.UTC(start.year, start.month - 1, start.day + 14));

  // Si le 14e jour tombe un samedi, dimanche ou jour férié national,
  // report au premier jour ouvrable (fonction déjà présente dans le Worker).
  while (expiry.getUTCDay() === 6 || expiry.getUTCDay() === 0 ||
         isFrenchPublicHolidayYmd(ymdUtc(expiry))) {
    expiry.setUTCDate(expiry.getUTCDate() + 1);
  }

  // J+14 reste inclus dans le délai ; dès le lendemain de l'échéance effective,
  // la question d'exécution anticipée n'est plus nécessaire. Un paiement tardif
  // est revérifié séparément par requiresEarlyExecutionConsent().
  return match[0] > ymdUtc(expiry) ? 'non' : 'oui';
}

function isConsumerContract(contract) {

  return contract === 'RELAIS' || contract === 'PRÉSENCE PROPRIÉTAIRES';

}

function daysUntilFirstScheduleDate(schedule) {

  const match = String(schedule || '').match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (!match) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {

    timeZone: 'Europe/Paris',

    year: 'numeric',

    month: '2-digit',

    day: '2-digit'

  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));

  const todayUtc = Date.UTC(Number(byType.year), Number(byType.month) - 1, Number(byType.day));

  const missionUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Math.round((missionUtc - todayUtc) / 86400000);

}

function requiresEarlyExecutionConsent(intent) {
  const flag = cyrneaExecutionAnticipee14j(intent);
  if (flag === null) return false; // B2B : aucune rétractation consommateur.
  if (flag === 'oui') return true;
  // Sécurité : au contrôle serveur, si le demandeur a laissé passer des jours
  // avant de valider le formulaire, ne pas manquer une exécution anticipée.
  // En cas de refus, buildTallyUrl réaffichera la question sur le lien de retour.
  return cyrneaExecutionAnticipee14j({
    ...intent, created_at: new Date().toISOString()
  }) === 'oui';
}

function normalizeLabelForMatch(value) {

  return String(value || '')

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .toLowerCase();

}

function findFieldValueByLabelFragment(fields, fragment) {

  const needle = normalizeLabelForMatch(fragment);

  for (const [label, value] of Object.entries(fields || {})) {

    if (normalizeLabelForMatch(label).includes(needle)) return value;

  }

  return '';

}

function sameImmutableIntent(a,b){

  return ['reference','universe','contract','mission','object','schedule','email','supersedes_reference','amount_cents','currency','price_text','availability_mode']

    .every(k => String(a[k] ?? '') === String(b[k] ?? ''));

}

function mapFields(fields){

  const out = {};

  for (const f of fields || []) {

    const label = String(f.label || '').trim();

    if (!label) continue;

    out[label] = normalizeTallyFieldValue(f);

  }

  return out;

}

function normalizeTallyFieldValue(field){
  const v = field?.value;
  const options = Array.isArray(field?.options) ? field.options : [];
  const optionTextById = new Map(options.map(o => [String(o?.id ?? ''), String(o?.text ?? o?.label ?? '')]));

  const resolve = (x) => {
    if (x == null) return '';
    if (typeof x === 'object') return String(x.label ?? x.text ?? x.value ?? JSON.stringify(x));
    const raw = String(x);
    return optionTextById.get(raw) || raw;
  };

  if (Array.isArray(v)) return v.map(resolve).filter(Boolean).join(' | ');
  return resolve(v);
}

function normalizeValue(v){

  if (Array.isArray(v)) return v.map(x => typeof x === 'object' ? (x.label ?? x.text ?? x.value ?? JSON.stringify(x)) : x).join(' | ');

  if (v && typeof v === 'object') return v.label ?? v.text ?? v.value ?? JSON.stringify(v);

  return v == null ? '' : String(v);

}

function firstPresent(map, names){for(const n of names){if(map[n]) return map[n]} return ''}

function tallyContactAnswer(rawFields, acceptedLabels) {
  const allowed = new Set(acceptedLabels.map(x => normalizeLabelForMatch(x).replace(/\s+/g,' ').trim()));
  for (const field of (Array.isArray(rawFields) ? rawFields : [])) {
    const label = normalizeLabelForMatch(field?.label || '').replace(/\s+/g,' ').trim();
    if (!allowed.has(label)) continue;
    const value = clean(normalizeTallyFieldValue(field), 200);
    if (value) return value;
  }
  return '';
}

// Les libellés ci-dessous correspondent aux formulaires Tally publiés.
// Lecture tolérante aux accents / variations mineures mais refus de toute valeur
// manquante ou ambiguë : ne jamais inférer une autorisation.
function cyrneaAnswer(fields, alternatives) {
  for (const fragment of alternatives) {
    const answer = String(findFieldValueByLabelFragment(fields, fragment) || '').trim();
    if (answer) return answer;
  }
  return '';
}

function cyrneaLegalAccessAnswers(fields) {
  return {
    access_required: cyrneaAnswer(fields, [
      'cette mission nécessite-t-elle que CYRNEA accède à un lieu privé'
    ]),
    no_access_declaration: cyrneaAnswer(fields, [
      'habilitation à commander la mission (sans accès privé)'
    ]),
    acting_capacity: cyrneaAnswer(fields, ['pour cette mission, vous agissez']),
    represented_party: cyrneaAnswer(fields, [
      'nom de la personne / société pour le compte de laquelle vous agissez',
      'nom de la personne ou société pour le compte'
    ]),
    concurrent_rights_or_dispute: cyrneaAnswer(fields, [
      'le lieu est-il loué ou soumis au droit d’occupation',
      'une autre personne dispose-t-elle actuellement'
    ]),
    access_method: cyrneaAnswer(fields, [
      'comment CYRNEA accédera-t-il aux lieux'
    ]),
    certification: cyrneaAnswer(fields, [
      'déclaration du demandeur',
      'je certifie disposer du droit nécessaire pour commander'
    ]),
    accompanying_person_name: cyrneaAnswer(fields, [
      'nom et prénom de la personne présente (locataire',
      'nom et prénom de la personne qui donnera accès'
    ]),
    accompanying_person_contact: cyrneaAnswer(fields, [
      'téléphone mobile ou e-mail de la personne présente',
      'coordonnées pour organiser l’accès et l’accompagnement'
    ])
  };
}

function checkCyrneaLegalAccessAnswers(fields) {
  const a = cyrneaLegalAccessAnswers(fields);
  const access = normalizeLabelForMatch(a.access_required).trim();
  if (access !== 'oui' && access !== 'non') return 'legal_access_required_missing_or_invalid';

  if (access === 'non') {
    // Cas sans entrée dans un lieu privé : déclaration distincte obligatoire.
    return normalizeLabelForMatch(a.no_access_declaration).includes('je certifie etre habilite')
      ? '' : 'legal_no_private_access_declaration_missing';
  }

  // Cas avec accès privé : vérifier la chaîne complète d'autorisation.
  const acting = normalizeLabelForMatch(a.acting_capacity);
  if (!acting.includes('pour mon propre compte') &&
      !acting.includes("pour le compte d'une personne") &&
      !acting.includes('pour le compte d’une personne')) {
    return 'legal_acting_capacity_missing';
  }
  if (acting.includes('pour le compte d') && !a.represented_party.trim()) {
    return 'legal_represented_party_missing';
  }
  const rights = normalizeLabelForMatch(a.concurrent_rights_or_dispute).trim();
  if (!rights.startsWith('non') && !rights.startsWith('oui')) {
    return 'legal_rights_unknown_or_disputed';
  }
  if (rights.startsWith('non') && !rights.includes('pas loue')) {
    return 'legal_rights_ambiguous';
  }
  if (rights.startsWith('oui') && !rights.includes('locataire ou occupant')) {
    return 'legal_occupant_authorization_ambiguous';
  }
  if (!normalizeLabelForMatch(a.certification).includes('je certifie disposer du droit necessaire')) {
    return 'legal_certification_missing';
  }
  const method = normalizeLabelForMatch(a.access_method);
  if (!method) return 'legal_access_method_missing';
  if (rights.startsWith('oui')) {
    // Personne détentrice de droits : aucune entrée autonome, même avec clé.
    if (!method.includes('personne autorisee sera presente') ||
        !method.includes('accompagner')) return 'legal_tenant_solo_access_forbidden';
    if (!a.accompanying_person_name.trim() || !a.accompanying_person_contact.trim()) {
      return 'legal_accompanying_person_contact_missing';
    }
  }
  return '';
}

function isLegalAccessEvidenceLabel(label) {
  const x = normalizeLabelForMatch(label);
  return (
    x.includes('cette mission necessite-t-elle que cyrnea accede a un lieu prive') ||
    x.includes('habilitation a commander la mission') ||
    x.includes('pour cette mission, vous agissez') ||
    x.includes('nom de la personne / societe pour le compte de laquelle vous agissez') ||
    x.includes('une autre personne dispose-t-elle actuellement') ||
    x.includes('le lieu est-il loue ou soumis au droit') ||
    x.includes('comment cyrnea accedera-t-il aux lieux') ||
    x.includes('declaration du demandeur') ||
    x.includes('je certifie disposer du droit necessaire') ||
    x.includes('nom et prenom de la personne presente (locataire') ||
    x.includes('telephone mobile ou e-mail de la personne presente')
  );
}

function extractLegalAccessEvidence(fields) {
  return cyrneaLegalAccessAnswers(fields);
}

function keepEvidence(fields) {
  const keep = {};
  for (const [k, v] of Object.entries(fields)) {
    const lk = normalizeLabelForMatch(k);
    if (
      lk.includes('confirmation') ||
      lk.includes('acceptation') ||
      lk.includes('retract') ||
      lk.includes('conditions generales') ||
      lk.includes('cgv') ||
      ['mission', 'objet', 'tarif', 'creneau', 'reference_temporaire'].includes(k) ||
      isLegalAccessEvidenceLabel(k) ||
      // Brief et documents des deux parcours PRÉSENCE, reçus via Tally signé.
      // Conserver les réponses sans modifier le paiement ni les contrôles juridiques.
      lk === 'votre besoin precis' ||
      lk.startsWith('avez-vous un dossier ou des documents utiles') ||
      lk.startsWith('joindre des documents') ||
      lk.startsWith('que souhaitez-vous faire observer ou documenter sur place') ||
      lk.startsWith('photos, plans ou documents de reference') ||
      lk.startsWith('le lieu de la mission est-il dans le secteur des tarifs affiches')
    ) {
      // Limites sur les textes libres, métadonnées des fichiers et choix de zone.
      const isBrief = lk === 'votre besoin precis' ||
        lk.startsWith('que souhaitez-vous faire observer ou documenter sur place');
      const isUpload = lk.startsWith('joindre des documents') ||
        lk.startsWith('photos, plans ou documents de reference');
      const isZone = lk.startsWith('le lieu de la mission est-il dans le secteur des tarifs affiches');
      keep[k] = (isBrief || isUpload || isZone)
        ? String(v ?? '').slice(0, isBrief ? 4000 : isUpload ? 12000 : 250)
        : v;
    }
  }
  return keep;
}

function appendHistory(intent, entry) {
  const history = Array.isArray(intent?.validation_history) ? intent.validation_history.slice(-19) : [];
  history.push(entry);
  return history;
}

async function verifyAnyTallySignature(raw, received, env) {
  if (!received) return false;

  const secrets = [
    String(env.TALLY_SIGNING_SECRET || '').trim(),
    String(env.TALLY_STANDARD_SIGNING_SECRET || '').trim()
  ].filter(Boolean);

  if (!secrets.length) return false;

  for (const secret of [...new Set(secrets)]) {
    if (await verifyTallySignature(raw, received, secret)) return true;
  }
  return false;
}

async function verifyTallySignature(raw, received, secret){

  if (!received || !secret) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));

  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return timingSafeEqual(expected, received);

}

function timingSafeEqual(a,b){

  if (a.length !== b.length) return false;

  let diff = 0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i); return diff===0;

}

function parseJsonMap(v){try{return v?JSON.parse(v):{}}catch{return {}}}

function addParams(base, params){const u=new URL(base);for(const [k,v] of Object.entries(params)){if(v)u.searchParams.set(k,v)}return u.toString()}

function clean(v,max){return String(v ?? '').trim().slice(0,max)}

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function escAttr(s){return esc(s)}

function json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}

function html(body,status=200){return new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://buy.stripe.com https://www.paypal.com https://paypal.com"}})}

function corsResponse(request,env,body,status=200,isJson=false){

  const origin=request.headers.get('Origin')||''; const allow=(env.PWA_ORIGIN&&origin===env.PWA_ORIGIN)?origin:'';

  const h={'cache-control':'no-store','x-content-type-options':'nosniff'}; if(isJson)h['content-type']='application/json; charset=utf-8';

  if(allow){h['access-control-allow-origin']=allow;h['vary']='Origin';h['access-control-allow-methods']='POST,GET,OPTIONS';h['access-control-allow-headers']='content-type';}

  return new Response(body,{status,headers:h});

}


/* AJOUT ISOLÉ — LIENS COURTS CYRNEA — 08/11/2026 */
function shortLinkCors(request, env, body, status=200) {
  const origin=request.headers.get('Origin')||'';
  const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if (env.PWA_ORIGIN && origin===env.PWA_ORIGIN) {
    h['access-control-allow-origin']=origin;
    h['access-control-allow-methods']='POST,OPTIONS';
    h['access-control-allow-headers']='content-type,authorization';
  }
  return new Response(body,{status,headers:h});
}
async function createShortLink(request,env) {
  const respond=(v,status)=>shortLinkCors(request,env,JSON.stringify(v),status);
  if (!env.PWA_ORIGIN || request.headers.get('Origin')!==env.PWA_ORIGIN) return respond({error:'origin_not_allowed'},403);
  if (!env.SHORT_LINK_OPERATOR_KEY || request.headers.get('Authorization')!==`Bearer ${env.SHORT_LINK_OPERATOR_KEY}`) return respond({error:'operator_unauthorized'},401);
  if (!env.SHORT_LINK_SERVICE || !env.SHORT_LINKS_API_KEY || !env.INTENTS) return respond({error:'short_link_configuration_missing'},503);
  const body=await request.json().catch(()=>null);
  if (!body || typeof body.url!=='string' || body.url.length>12000) return respond({error:'invalid_url'},400);
  let u,reference;
  try {
    u=new URL(body.url);
    reference=u.searchParams.getAll('reference_temporaire');
    if (u.protocol!=='https:' || u.hostname!=='tally.so' || !/^\/r\/[A-Za-z0-9]+$/.test(u.pathname) || u.hash || u.username || u.password || reference.length!==1 || !REF_RE.test(reference[0])) throw Error();
  } catch { return respond({error:'invalid_tally_url'},400); }
  const raw=await env.INTENTS.get(`intent:${reference[0]}`);
  if (!raw) return respond({error:'intent_not_found'},404);
  let intent;
  try {intent=JSON.parse(raw);} catch {return respond({error:'intent_invalid'},409);}
  if (['CHANGE_REQUESTED','REJECTED','REFUNDED'].includes(String(intent.status||'').toUpperCase())) return respond({error:'intent_not_shareable'},409);
  if (u.searchParams.get('mission')!==String(intent.mission||'') || u.searchParams.get('tarif')!==String(intent.price_text||'') || u.searchParams.get('creneau')!==String(intent.schedule||'')) return respond({error:'intent_mismatch'},409);
  try {
    const upstream=await env.SHORT_LINK_SERVICE.fetch(new Request('https://cyrnea-liens-courts.jeancharles-coti.workers.dev/api/create',{
      method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${env.SHORT_LINKS_API_KEY}`},body:JSON.stringify({url:u.href})
    }));
    const result=await upstream.json().catch(()=>({error:'invalid_short_link_response'}));
    return respond(result,upstream.status);
  } catch {return respond({error:'short_link_unavailable'},503);}
}