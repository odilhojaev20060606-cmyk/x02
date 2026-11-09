# X02.0 — исходники

Сайт игры — файлы в корне репозитория (`index.html`, `sw.js`, иконки). Здесь — исходный код, из которого они собираются.

Сборка (из папки `src`):
```
python3 build.py && python3 build_pwa.py && python3 make_flat.py vN https://x0-wallet.odilhojaev20060606.workers.dev
python3 tg/make_worker.py   # сервер → tg/worker.js (вставляется в Cloudflare)
```
План и статус работ — `PROMPT-X02-next.md`.
