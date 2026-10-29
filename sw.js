'use strict';
const CACHE='hm3-stiftkarten-v3-20261029';
const SHELL=['./','./index.html','./style.css','./app.js','./cards.json','./manifest.webmanifest','./assets/mathjax-tex-svg.js','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hm3-stiftkarten-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;
  const isDeck=url.pathname.endsWith('/cards.json');
  if(isDeck){e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(e.request,copy));}return response;}).catch(()=>caches.match(e.request)));return;}
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(e.request,response.clone()));return response;})));
});