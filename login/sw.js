/* Agenda (donos, marinheiros e equipe): guarda a tela do app para abrir rápido; a agenda vem sempre da internet */
const CACHE = "agenda-acesso-v5";
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

/* número no ícone do app (Rodrigo 2026-10-23): o app grava o total certo ao abrir; cada aviso que chega soma 1 */
const BADGE = "/login/__badge";
const badgeGet = () => caches.open(CACHE).then(c => c.match(BADGE)).then(r => r ? r.text() : "0").then(x => +x || 0).catch(() => 0);
const badgeSet = n => caches.open(CACHE).then(c => c.put(BADGE, new Response(String(n)))).then(() => {
  if (!self.navigator.setAppBadge) return; return n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge(); }).catch(() => {});
self.addEventListener("message", e => { if (e.data && e.data.tipo === "badge") e.waitUntil(badgeSet(+e.data.n || 0)); });
/* notificação no celular (passeio aprovado para o dono, pedido novo para a Búzios Lanchas) */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: e.data && e.data.text() }; }
  const show = () => self.registration.showNotification(d.title || "Búzios Lanchas", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "/login/icon-192.png", badge: "/login/icon-192.png", data: { url: d.url || "/login/" },
    ...(/^alerta-/.test(d.tag || "") ? { requireInteraction: true, vibrate: [400, 150, 400, 150, 800] } : {}) }); /* alerta da equipe: fica na tela até tocar */
  /* app aberto na frente: avisa a página (som + aviso dentro do app) em vez da notificação do sistema.
     Site aberto na frente: toca o mesmo som e mostra a notificação normal (Rodrigo, 2026-10-22: todo aviso com som) */
  e.waitUntil(badgeGet().then(n => badgeSet(n + 1)).then(() => clients.matchAll({ type: "window", includeUncontrolled: true })).then(ws => {
    const vis = ws.filter(x => x.visibilityState === "visible" && x.focused), app = vis.find(x => new URL(x.url).pathname.startsWith("/login/"));
    if (app) { app.postMessage({ tipo: /^chat-/.test(d.tag || "") ? "chat" : /^alerta-/.test(d.tag || "") ? "alerta" : "aviso", ...d }); return; }
    vis.forEach(x => x.postMessage({ tipo: "som" }));
    return show();
  }));
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
