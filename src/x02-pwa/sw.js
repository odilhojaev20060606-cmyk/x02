// X02.0 service worker: the game keeps working without internet.
// When you upload a new version of the game, change the number in CACHE (v1 -> v2) so phones pick it up.
const CACHE = "x02-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./fonts/caveat-cyrillic-500-normal.woff2",
  "./fonts/caveat-cyrillic-700-normal.woff2",
  "./fonts/caveat-latin-500-normal.woff2",
  "./fonts/caveat-latin-700-normal.woff2",
  "./fonts/golos-text-cyrillic-400-normal.woff2",
  "./fonts/golos-text-cyrillic-500-normal.woff2",
  "./fonts/golos-text-cyrillic-700-normal.woff2",
  "./fonts/golos-text-latin-400-normal.woff2",
  "./fonts/golos-text-latin-500-normal.woff2",
  "./fonts/golos-text-latin-700-normal.woff2"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    // the page itself: fresh from the internet when online, from the cache when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
