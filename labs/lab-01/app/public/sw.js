const CACHE='rag-engine-lab-v15';
const CORE=['/','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET'||url.pathname.startsWith('/api/')) return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{return await fetch(req,{cache:'no-store'});}catch{return (await caches.match('/'));}
    })());
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    try{
      const fresh=await fetch(req);
      if(fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone());}
      return fresh;
    }catch{return cached;}
  })());
});
