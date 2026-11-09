# Builds tg/worker.js = game engine + server, as one file to paste into Cloudflare.
import pathlib
here = pathlib.Path(__file__).resolve().parent
engine = (here.parent / 'engine.js').read_text(encoding='utf-8')
server = (here / 'server.js').read_text(encoding='utf-8')
out = ("// X02.0 Telegram bot + coin wallet — Cloudflare Worker.\n"
       "// One file: the game engine (same rules as the app) + the server. Paste all of it into Cloudflare → Edit code.\n\n"
       + engine.strip() + "\n\n" + server)
(here / 'worker.js').write_text(out, encoding='utf-8')
print('worker.js', len(out.encode()), 'bytes')
