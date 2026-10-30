'use strict';
const CACHE='hm3-stiftkarten-v14-20261030';
const SHELL=['./','./index.html','./style.css','./app.js','./cards.json','./version.json','./manifest.webmanifest','./assets/mathjax-tex-svg.js','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hm3-stiftkarten-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  const fresh= request.mode==='navigate'||['index.html','app.js','style.css','cards.json','version.json','manifest.webmanifest'].some(p=>url.pathname.endsWith('/'+p));
  if(fresh){
    event.respondWith(
      fetch(request,{cache:'no-store'}).then(response=>{
        if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
        return response;
      }).catch(async()=>{
        const cached=await caches.match(request,{ignoreSearch:true});
        if(cached)return cached;
        if(request.mode==='navigate')return caches.match('./index.html');
        return Response.error();
      })
    );
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
    return response;
  })));
});