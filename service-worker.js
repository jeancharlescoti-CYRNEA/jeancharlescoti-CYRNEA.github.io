const CACHE='cyrnea-assistant-20261108-short-sms-session-v5';
const ASSETS=['./index.html','./terrain-clock.js','./change-inbox.js','./manifest.webmanifest','./icons/icon-192.png'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      // Aucun rechargement forcé d'une mission en cours pendant la mise à jour.
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  // Laisser les appels API externes (Cloudflare Workers, Stripe, etc.)
  // passer directement par le navigateur. Safari peut échouer si le service
  // worker intercepte une requête CORS avec en-tête personnalisé.
  const requestUrl=new URL(event.request.url);
  if(requestUrl.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch('./index.html',{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // JS/manifeste : dernière version réseau, puis repli hors connexion.
  if(requestUrl.pathname.endsWith('.js') || requestUrl.pathname.endsWith('.webmanifest')){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
          }
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>
      cached || fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      })
    )
  );
});
