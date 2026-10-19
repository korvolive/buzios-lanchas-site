/* Agenda (donos, marinheiros e equipe): guarda a tela do app para abrir rápido; a agenda vem sempre da internet */
const CACHE = "agenda-acesso-v1";
const SHELL = ["/login/", "/login/manifest.webmanifest", "/login/icon-192.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith("/login/")) return;
  /* internet primeiro; sem sinal, abre a última versão guardada */
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request.mode === "navigate" ? "/login/" : e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request.mode === "navigate" ? "/login/" : e.request)));
});
