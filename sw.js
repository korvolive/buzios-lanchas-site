/* App Búzios Lanchas (site instalado): internet primeiro; sem sinal, abre a última página guardada.
   A agenda (/login/) tem o seu próprio service worker. */
const CACHE = "buzios-lanchas-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/"]))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith("buzios-lanchas")).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/login/") || u.pathname.startsWith("/dono/")) return;
  if (e.request.mode !== "navigate") return; /* imagens e o resto seguem o cache normal do navegador */
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match("/"))));
});
