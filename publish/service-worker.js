// Dual-environment base (dev vs prod)
const isLocalhost = self.location.hostname === "localhost";
// IMPORTANT: production path is uppercase to match your hosting folder
const BASE = isLocalhost ? "/" : "/AB/";

const STATIC_CACHE = "ab-static-v5";

// Only pre-cache small, static UI pieces. No audio or API.
const PRECACHE = [
    `${BASE}index.html`,
    `${BASE}styles.css`,
    `${BASE}app.js`,
    `${BASE}custom-player.js`,
    `${BASE}tree-search.js`,
    `${BASE}manifest.json`,
];

self.addEventListener("install", (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);

    // Cross-origin requests: let them pass through
    if (url.origin !== self.location.origin) return;

    // Never cache audio (large + range requests) or API calls
    if (url.pathname.includes("/Uploads/Audio/")) return;
    if (url.pathname.startsWith("/api/")) return;

    // Static: cache-first
    e.respondWith(
        caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
});