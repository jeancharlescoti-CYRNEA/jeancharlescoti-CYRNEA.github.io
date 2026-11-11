
/* La passerelle existante valide le créneau, calcule le montant, crée la référence
   et fournit l'URL Tally. Tester l'origine www.relaisproprietaire.fr
   avec site-relais-intent et site-presence-intent avant mise en publicité. */
(function(){
  function init(){
    var root=document.querySelector('.ci-intemperies-article'); if(!root)return;
    // Uniquement dans cet article : éviter le doublon de titre ajouté par Wmaker.
    var titreInterne=root.querySelector('.ci-meteo-title');
    if(titreInterne){
      var attendu=titreInterne.textContent.replace(/\s+/g,' ').trim();
      document.querySelectorAll('.titre, h1, h2').forEach(function(el){
        if(root.contains(el)) return;
        if(el.textContent.replace(/\s+/g,' ').trim()===attendu){
          el.style.display='none';
        }
      });
    }
    var box=root.querySelector('#ci-meteo-reservation');
    var form=root.querySelector('#ci-reserve-form');
    var dateEl=root.querySelector('#ci-reserve-date');
    var hourEl=root.querySelector('#ci-reserve-hour');
    var minuteEl=root.querySelector('#ci-reserve-minute');
    var msg=root.querySelector('#ci-reserve-message');
    var submit=root.querySelector('#ci-reserve-submit');
    // Safari : bouton réactivé au retour arrière depuis Tally (cache de navigation).
    function reinitialiserRetourTally(){
      submit.disabled=false;
      if(msg.textContent.trim()==='Préparation du formulaire Tally…')msg.textContent='';
    }
    window.addEventListener('pagehide',reinitialiserRetourTally);
    window.addEventListener('pageshow',reinitialiserRetourTally);
    var cfg={
      avant:{label:'RELAIS PROPRIÉTAIRE — Prévention avant une intempérie · 149 € TTC',endpoint:'site-relais-intent',type:'meteo_simple'},
      apres:{label:'RELAIS PROPRIÉTAIRE — Après une intempérie · 109 € TTC',endpoint:'site-relais-intent',type:'meteo_apres_simple'},
      voir:{label:'CYRNEA PRÉSENCE — VOIR · 260 € TTC',endpoint:'site-presence-intent',type:'voir'}
    };
    var selected=null;
    // Masquage d'état garanti, même si Wmaker change son CSS de section.
    box.hidden=true;
    box.setAttribute('aria-hidden','true');
    box.classList.remove('is-open');
    // Sur RELAIS, conserver l'habillage, les menus et le pied de page du site.
    function pad(v){return String(v).padStart(2,'0')}
    function todayInCorsica(){var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());var d={};p.forEach(function(x){d[x.type]=x.value});return d.year+'-'+d.month+'-'+d.day}
    dateEl.min=todayInCorsica();
    root.querySelectorAll('[data-cyrnea-reserve]').forEach(function(a){
      a.addEventListener('click',function(e){
        e.preventDefault();selected=a.getAttribute('data-cyrnea-reserve');if(!cfg[selected])return;
        root.querySelector('#ci-reserve-choice').textContent=cfg[selected].label;
        msg.textContent='';
        msg.style.color='';
        box.hidden=false;box.removeAttribute('aria-hidden');
        box.classList.add('is-open');box.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
    root.querySelector('#ci-reserve-close').addEventListener('click',function(){box.classList.remove('is-open');box.hidden=true;box.setAttribute('aria-hidden','true');selected=null;msg.textContent=''});
    form.addEventListener('submit',async function(e){
      e.preventDefault(); if(!selected||!cfg[selected])return;
      msg.style.color='';
      var date=dateEl.value;
      var hour=hourEl.value, minute=minuteEl.value;
      var time=hour+':'+minute;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||! /^(0[89]|1[0-8])$/.test(hour)||! /^(00|15|30|45)$/.test(minute)){
        msg.textContent='Choisissez une date, une heure et les minutes (00, 15, 30 ou 45).';msg.style.color='#FF0000';return;
      }
      var hh=Number(hour);
      if(cfg[selected].endpoint==='site-relais-intent'&&(hh<8||hh>18)){
        msg.textContent='Pour RELAIS, choisissez une heure entre 08 h 00 et 18 h 45.';msg.style.color='#FF0000';return;
      }
      submit.disabled=true;msg.textContent='Préparation du formulaire Tally…';
      try{
        var gateway='https://cyrnea-payment-gateway.jeancharles-coti.workers.dev/'+cfg[selected].endpoint;
        var res=await fetch(gateway,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({type:cfg[selected].type,date:date,time:time,requested_mode:'standard'}),cache:'no-store'});
        var data=await res.json().catch(function(){return {}});
        if(!res.ok||!data.tally_url)throw new Error(data.error||'Erreur de réservation');
        // La mission et le montant ne sont pas modifiables côté page.
        location.assign(data.tally_url);
      }catch(error){
        var map={origin_not_allowed:'Ce site doit encore être autorisé à utiliser la passerelle de réservation.',not_standard_slot:'Ce créneau n’est pas disponible en ligne. Choisissez une autre date ou une autre heure.',online_hours_limited:'Réservation RELAIS possible entre 08 h et 18 h 45.',night_not_available_online:'Ce créneau n’est pas disponible en ligne.',past_schedule:'Le créneau choisi est déjà passé.',invalid_schedule:'Vérifiez la date et l’heure.'};
        msg.textContent=map[error.message]||'Réservation non ouverte : '+(['Failed to fetch','Load failed','NetworkError'].includes(error.message)?'connexion entre le site mobile et la réservation indisponible.':error.message);
        msg.style.color='#FF0000';
        submit.disabled=false;
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
