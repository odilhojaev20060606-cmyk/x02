import pathlib, re, base64, shutil, json, sys
version = sys.argv[1]
api = sys.argv[2] if len(sys.argv) > 2 else ''
src = pathlib.Path('x02-pwa'); out = pathlib.Path('x02-flat')
if out.exists(): shutil.rmtree(out)
out.mkdir()
html = (src/'index.html').read_text(encoding='utf-8')
html = re.sub(r'url\("fonts/([^"]+)"\)', lambda m: 'url("data:font/woff2;base64,' + base64.b64encode((src/'fonts'/m.group(1)).read_bytes()).decode() + '")', html)
html = html.replace('href="icons/favicon-32.png"', 'href="icon-192.png"').replace('sizes="32x32" ', '').replace('href="icons/apple-touch-icon.png"', 'href="apple-touch-icon.png"')
assert 'fonts/' not in html and 'icons/' not in html
if api: html = html.replace('"__API_BASE__"', json.dumps(api.rstrip('/')))
html = html.replace('"__APP_VERSION__"', json.dumps(version))
(out/'index.html').write_text(html, encoding='utf-8')
for f in ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']: shutil.copy(src/'icons'/f, out/f)
man = json.loads((src/'manifest.webmanifest').read_text(encoding='utf-8'))
for ic in man['icons']: ic['src'] = ic['src'].replace('icons/', '')
(out/'manifest.webmanifest').write_text(json.dumps(man, ensure_ascii=False, indent=2), encoding='utf-8')
assets = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"]
sw = (src/'sw.js').read_text(encoding='utf-8')
sw = re.sub(r'const ASSETS = \[.*?\];', 'const ASSETS = ' + json.dumps(assets, indent=2) + ';', sw, flags=re.S)
sw = sw.replace('const CACHE = "x02-v1";', f'const CACHE = "x02-{version}";')
(out/'sw.js').write_text(sw, encoding='utf-8')
print('flat built', version)
