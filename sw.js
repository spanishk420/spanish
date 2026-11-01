// Offline-Unterstützung: immer erst online laden, sonst aus dem Speicher
const CACHE = "espanol-v22";
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
// Sprachaufnahmen gleich mitladen, damit der Sprachmodus auch ohne Netz (Auto) klingt
const cacheAudio = c => fetch("audio/manifest.json", { cache: "no-cache" }).then(r => r.json())
  .then(m => Promise.all(Object.values(m).map(f => c.add("audio/" + f).catch(() => {})))).catch(() => {});
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).then(() => cacheAudio(c)))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Eigene Dateien immer beim Server nachfragen (sonst liefert der Browser bis zu 10 Min. alte Versionen)
  const own = new URL(e.request.url).origin === location.origin;
  e.respondWith(fetch(own ? new Request(e.request.url, { cache: "no-cache" }) : e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
