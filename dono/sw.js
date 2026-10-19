/* A agenda mudou de /dono/ para /login/: este service worker antigo se desliga e limpa o que guardou. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.delete("agenda-donos-v1").then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: "window" }))
    .then(cs => cs.forEach(c => c.navigate(c.url)))));
