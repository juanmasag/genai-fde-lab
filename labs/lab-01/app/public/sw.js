const CACHE='rag-engine-lab-v10';
const APP_SHELL=['/','/styles.css?v=10','/app.js?v=10','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
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
  if(req.mode==='navigate'||['/','/app.js','/styles.css'].includes(url.pathname)){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put(req,fresh.clone());
        return fresh;
      }catch{
        return (await caches.match(req)) || (await caches.match('/'));
      }
    })());
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
