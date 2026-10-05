const CACHE='cyrnea-assistant-20261006-restitution-client-v1';
const ASSETS=['./index.html','./rapport-client.html','./terrain-clock.js','./manifest.webmanifest','./icons/icon-192.png'];

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
      .then(()=>self.clients.claim())
      .then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true}))
      .then(clients=>Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>null))))
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
    const target=requestUrl.pathname.endsWith('/rapport-client.html')?'./rapport-client.html':'./index.html';
    event.respondWith(
      fetch(target,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(target,copy));
          return response;
        })
        .catch(()=>caches.match(target))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>
      cached || fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
    )
  );
});
