/* Agenda (donos, marinheiros e equipe): guarda a tela do app para abrir rápido; a agenda vem sempre da internet */
const CACHE = "agenda-acesso-v2";
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

/* notificação no celular (passeio aprovado para o dono, pedido novo para a Búzios Lanchas) */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Búzios Lanchas", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "/login/icon-192.png", badge: "/login/icon-192.png", data: { url: d.url || "/login/" } }));
});
/* toque na notificação: abre (ou traz para frente) a agenda */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/login/", location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => new URL(x.url).pathname.startsWith("/login/"));
    if (w) return w.focus().then(x => (x || w).navigate ? (x || w).navigate(url) : null).catch(() => clients.openWindow(url));
    return clients.openWindow(url);
  }));
});
