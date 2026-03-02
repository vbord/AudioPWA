const isLocalhost = self.location.hostname === "localhost";
const PREFIX = isLocalhost ? "/" : "/ab/";
const CACHE = "ab-cache-v4";

const FILES = [
    `${PREFIX}index.html`,
    `${PREFIX}styles.css`,
    `${PREFIX}app.js`,
    `${PREFIX}manifest.json`,
    `${PREFIX}service-worker.js`,
    `${PREFIX}icons/icon-192.png`,
    `${PREFIX}icons/icon-512.png`
];

self.addEventListener("install", e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    );
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
    e.respondWith(
        caches.match(e.request).then(resp => resp || fetch(e.request))
    );
});
