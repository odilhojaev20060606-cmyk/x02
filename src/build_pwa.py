import pathlib, json
d = pathlib.Path(__file__).parent
out = d / 'x02-pwa'
css = (d/'style.css').read_text(encoding='utf-8')
body = (d/'body.html').read_text(encoding='utf-8')
eng = (d/'engine.js').read_text(encoding='utf-8')
app = (d/'app.js').read_text(encoding='utf-8')
i18n = (d/'i18n.js').read_text(encoding='utf-8')
CYR = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
LAT = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
faces = []
for fam, file, weights in [("Caveat", "caveat", [500, 700]), ("Golos Text", "golos-text", [400, 500, 700])]:
    for w in weights:
        for sub, rng in [("cyrillic", CYR), ("latin", LAT)]:
            faces.append(f'@font-face {{ font-family: "{fam}"; font-style: normal; font-weight: {w}; font-display: swap; src: url("fonts/{file}-{sub}-{w}-normal.woff2") format("woff2"); unicode-range: {rng}; }}')
fonts = sorted(p.name for p in (out/'fonts').glob('*.woff2'))
pwa_js = r'''
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
// "Установить" button where the browser offers installation (Chrome, Edge, Android)
(function () {
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e;
    const foot = document.querySelector(".menu-foot");
    if (!foot || document.getElementById("installBtn")) return;
    const b = document.createElement("button");
    b.id = "installBtn"; b.type = "button"; b.className = "btn primary"; b.textContent = "Установить приложение";
    b.addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (err) {} deferred = null; b.remove(); });
    foot.prepend(b);
  });
  window.addEventListener("appinstalled", () => { const b = document.getElementById("installBtn"); if (b) b.remove(); });
})();
'''
html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>X02.0</title>
<meta name="description" content="Крестики-нолики, версия 2.0: 81 клетка, звёзды, удары, разминка и боты.">
<meta name="theme-color" content="#2b3a55">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="X02.0">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>
{chr(10).join(faces)}
{css}
</style>
</head>
<body>
{body}
<script>
{eng}
</script>
<script>
{i18n}
</script>
<script>
{app}
</script>
<script>
{pwa_js}
</script>
</body>
</html>
'''
(out/'index.html').write_text(html, encoding='utf-8')
manifest = {
  "name": "X02.0 — крестики-нолики 2.0", "short_name": "X02.0",
  "description": "Крестики-нолики, версия 2.0: 81 клетка, звёзды, удары, разминка и боты.",
  "lang": "ru", "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#f6f7f2", "theme_color": "#2b3a55",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
(out/'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
assets = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
          "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"] + [f"./fonts/{f}" for f in fonts]
sw = f'''// X02.0 service worker: the game keeps working without internet.
// When you upload a new version of the game, change the number in CACHE (v1 -> v2) so phones pick it up.
const CACHE = "x02-v1";
const ASSETS = {json.dumps(assets, indent=2)};
self.addEventListener("install", e => {{
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
}});
self.addEventListener("activate", e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener("fetch", e => {{
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {{
    // the page itself: fresh from the internet when online, from the cache when offline
    e.respondWith(fetch(req).then(res => {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return res; }})
      .catch(() => caches.match("./index.html")));
    return;
  }}
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req)));
}});
'''
(out/'sw.js').write_text(sw, encoding='utf-8')
print('pwa built:', sorted(str(p.relative_to(out)) for p in out.rglob('*') if p.is_file()))
