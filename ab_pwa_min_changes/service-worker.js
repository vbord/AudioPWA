
const BASE = "/AB/";
const CACHE = "ab-static-v4";

const FILES = [
  `${BASE}index.html`,
  `${BASE}styles.css`,
  `${BASE}app.js`,
  `${BASE}custom-player.js`,
  `${BASE}tree-search.js`,
  `${BASE}manifest.json`
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Do NOT cache audio or API
  if (url.pathname.includes("/Uploads/Audio/")) return;
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
