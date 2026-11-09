// Runs the real worker.js locally (in-memory KV + SQLite as D1) for browser tests.
import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import w from '../tg/worker.js';
const TOKEN = '123:ABC';
const kv = new Map();
const conv = a => a.map(x => x === undefined ? null : x);
const db = new DatabaseSync(':memory:');
const st = (sql, args = []) => ({ bind: (...a) => st(sql, a), first: async () => db.prepare(sql).get(...conv(args)) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...conv(args)) }), run: async () => ({ meta: { changes: db.prepare(sql).run(...conv(args)).changes } }) });
const D1 = { prepare: sql => st(sql), batch: async l => { for (const s of l) await s.run(); } };
const env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'S', SUPPORT: '@me', DB: process.env.NO_DB ? undefined : D1,
  WALLET: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v) } };
const sent = [];
globalThis.fetch = async (u, o) => { sent.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, result: 'https://t.me/$inv' }) }; };
const initData = (id, name, extra = {}) => { const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: name, username: name.toLowerCase(), language_code: 'ru' }), ...extra });
  const c = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(c).digest('hex')); return p.toString(); };
const login = id => { const d = { id: String(id), first_name: 'Abd', username: 'abd', auth_date: String(Math.floor(Date.now() / 1000)) };
  const c = Object.keys(d).sort().map(k => `${k}=${d[k]}`).join('\n');
  d.hash = crypto.createHmac('sha256', crypto.createHash('sha256').update(TOKEN).digest()).update(c).digest('hex'); return new URLSearchParams(d).toString(); };
http.createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
  const u = new URL('http://x' + req.url);
  if (u.pathname === '/initdata') { res.writeHead(200, cors); return res.end(initData(Number(u.searchParams.get('id') || 42), u.searchParams.get('name') || 'Abd', u.searchParams.get('sp') ? { start_param: u.searchParams.get('sp') } : {})); }
  if (u.pathname === '/login') { res.writeHead(200, cors); return res.end(login(42)); }
  if (u.pathname === '/kv') { res.writeHead(200, cors); if (env.DB) { const r = db.prepare('SELECT data FROM players WHERE id = ?').get(Number(u.searchParams.get('id') || 42)); return res.end(r ? r.data : (kv.get('u:42') || '{}')); } return res.end(kv.get('u:42') || '{}'); }
  if (u.pathname === '/sent') { res.writeHead(200, cors); return res.end(JSON.stringify(sent)); }
  let body = ''; for await (const ch of req) body += ch;
  const hdr = { 'content-type': 'application/json' };
  if (req.headers['x-telegram-bot-api-secret-token']) hdr['X-Telegram-Bot-Api-Secret-Token'] = req.headers['x-telegram-bot-api-secret-token'];
  const r = await w.fetch(new Request('http://127.0.0.1:8770' + req.url, { method: req.method, headers: hdr, body: req.method === 'POST' ? body : undefined }), env);
  res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json', ...cors }); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8770, '127.0.0.1');
