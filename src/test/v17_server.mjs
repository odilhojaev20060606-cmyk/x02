import w from '../tg/worker.js';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const TOKEN = '123:ABC', SEC = 'S';
let NOW = 1_800_000_000_000; Date.now = () => NOW;
const conv = a => a.map(x => x === undefined ? null : x);
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const st = (sql, args = []) => ({
    bind: (...a) => st(sql, a),
    first: async () => db.prepare(sql).get(...conv(args)) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...conv(args)) }),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...conv(args)).changes } }),
  });
  return { prepare: sql => st(sql), batch: async l => { for (const s of l) await s.run(); } };
}
const kv = new Map([['u:42', JSON.stringify({ clips: 50, coins: 2, scores: { x1: { me: 1, bot: 0, draw: 0 } } })]]);
const env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: SEC, DB: fakeD1(), WALLET: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, put: async (k, v) => kv.set(k, v) } };
const sent = []; globalThis.fetch = async (u, o) => { const m = u.split('/').pop(); sent.push([m, JSON.parse(o.body)]); return { json: async () => ({ ok: true, result: 'x' }) }; };
const init = (id, name) => { const p = new URLSearchParams({ auth_date: String(Math.floor(NOW / 1000)), user: JSON.stringify({ id, first_name: name, username: name.toLowerCase(), language_code: 'ru' }) });
  const c = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(c).digest('hex')); return p.toString(); };
let A = init(42, 'Abd'), B = init(77, 'Ali'), C = init(99, 'Zed');
const re = () => { A = init(42, 'Abd'); B = init(77, 'Ali'); C = init(99, 'Zed'); };
const call = async (path, who, body = {}) => { const r = await w.fetch(new Request('https://x.dev' + path, { method: 'POST', body: JSON.stringify({ initData: who, ...body }) }), env); const j = await r.json(); j._s = r.status; return j; };
const hook = u => w.fetch(new Request('https://x.dev/hook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': SEC }, body: JSON.stringify(u) }), env);
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok ', m); };
const lastTo = id => sent.filter(s => s[0] === 'sendMessage' && s[1].chat_id === id).at(-1)?.[1];
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42, language_code: 'ru' }, text: '/admin S' } });
let p = await call('/api/profile', A); await call('/api/profile', B); await call('/api/profile', C);
ok(p.tasks && p.tasks.list.length === 3 && new Set(p.tasks.list.map(t => t.k)).size === 3, 'three distinct daily tasks');
// drive every event so all three get done
const want = { bot: 0, botwin: 0, hardwin: 0, online: 0, daily: 0, classicwin: 0, x02play: 0 };
const clips0 = p.clips, coins0 = p.coins;
for (let i = 0; i < 3; i++) p = await call('/api/result', A, { bot: 'x2', r: 'win', ms: 60000, key: 'xw' + i });
p = await call('/api/result', A, { bot: 'c2', r: 'win', ms: 60000, key: 'cw' });
p = await call('/api/task', A, { kind: 'daily' });
let cg = await call('/api/g/new', A, { mode: 'classic', minutes: 2, side: 1 }); await call('/api/g/join', B, { id: cg.id });
for (const [who, a] of [[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]]) await call('/api/g/move', who, { id: cg.id, a });
p = await call('/api/profile', A);
ok(p.tasks.list.every(t => t.done) && p.tasks.all, 'all three tasks done: ' + p.tasks.list.map(t => t.k).join(','));
ok(p.coins === coins0 + 1, 'all three tasks pay 1 coin');
// rating after the classic game
ok(p.elo > 1000 && p.eloN === 1 && p.league === 'pupil', 'winner gains rating: ' + p.elo);
let pb = await call('/api/profile', B); ok(pb.elo === 2000 - p.elo, 'loser loses the same');
ok(/Рейтинг: [+-]\d+ → \d+ \(Ученик\)/.test(lastTo(77).text), 'result message shows rating: ' + lastTo(77).text.split('\n').at(-1));
// coin services
const before = p.coins;
p = await call('/api/spend', A, { item: 'hint' }); ok(p.ok && p.coins === before - 1, 'hint costs 1 coin');
p = await call('/api/spend', A, { item: 'retry' }); ok(p.coins === before - 2, 'puzzle retry costs 1 coin');
p = await call('/api/spend', C, { item: 'freeze' }); ok(p._s === 409 && p.error === 'coins', 'no coins -> no freeze');
// streak freeze: A has coins (2 from KV + 1 tasks - 2) → give some
env.DB.prepare("UPDATE players SET data = json_set(data, '$.coins', 10) WHERE id = 42").run && await env.DB.prepare("UPDATE players SET data = json_set(data, '$.coins', 10) WHERE id = 42").run();
p = await call('/api/spend', A, { item: 'freeze' }); ok(p.freeze === 1 && p.coins === 8, 'freeze bought for 2 coins');
let st = await call('/api/streak', A); ok(st.n === 1, 'streak day 1');
NOW += 86400000; re(); st = await call('/api/streak', A); ok(st.n === 2, 'streak day 2');
NOW += 2 * 86400000; re(); st = await call('/api/streak', A); ok(st.n === 3 && st.froze && st.freeze === 0, 'missed a day: the freeze kept the streak');
NOW += 2 * 86400000; re(); st = await call('/api/streak', A); ok(st.n === 1, 'missed again without a freeze: streak restarts');
// gifts
let F = await call('/api/friends', A); const fidB = F.friends.find(f => f.name === 'Ali').fid;
pb = await call('/api/profile', B); const bc = pb.clips;
let gft = await call('/api/gift', A, { fid: fidB }); ok(gft.ok && gft.left === 2, 'gift sent');
pb = await call('/api/profile', B); ok(pb.clips === bc + 10, 'friend got +10 clips');
ok(/прислал тебе подарок/.test(lastTo(77).text), 'friend notified about the gift');
gft = await call('/api/gift', A, { fid: fidB }); ok(gft.error === 'already', 'one gift per friend per day');
gft = await call('/api/gift', A, { fid: '77.bad' }); ok(gft._s === 400, 'forged friend id rejected');
// subject battle
await call('/api/subj', A, { subj: 3 }); await call('/api/subj', B, { subj: 5 });
await call('/api/result', A, { bot: 'x3', r: 'win', ms: 60000, key: 'sb1' }); await call('/api/result', A, { bot: 'x3', r: 'win', ms: 60000, key: 'sb2' });
await call('/api/result', B, { bot: 'x3', r: 'win', ms: 60000, key: 'sb3' });
let bt = await call('/api/battle', A); ok(bt.week[0].s === 3 && bt.week[0].n === 2 && bt.myWins === 2, 'battle counts wins per subject');
NOW += 7 * 86400000; re(); const cl = (await call('/api/profile', A)).clips;
bt = await call('/api/battle', A); ok(bt.prize === 30 && bt.clips === cl + 30 && bt.last[0].s === 3, 'last week winners get the prize');
bt = await call('/api/battle', A); ok(bt.prize === 0, 'prize only once');
bt = await call('/api/battle', B); ok(bt.prize === 0, 'losing subject gets no prize');
// emotes
cg = await call('/api/g/new', A, { mode: 'classic', minutes: 2, side: 1 }); await call('/api/g/join', B, { id: cg.id });
let e = await call('/api/g/say', A, { id: cg.id, k: 102 }); ok(!e.error, 'emote accepted');
NOW += 3000; re(); e = await call('/api/g/say', A, { id: cg.id, k: 110 }); ok(e.error === 'bad', 'unknown emote rejected');
// evening reminders: B has a streak ending yesterday, C went quiet 3 days ago
await call('/api/profile', C); await call('/api/streak', B); NOW += 86400000; re(); await call('/api/streak', B);
NOW += 86400000 + 3600000; re();     // next day evening, B did not come
let n0 = sent.length; const wq = [];
await w.scheduled({ cron: '7 14 * * *' }, env, { waitUntil: q => wq.push(q) }); await Promise.all(wq);
const rem = sent.slice(n0).filter(s => s[0] === 'sendMessage');
ok(rem.some(s => s[1].chat_id === 77 && /Серия 2 дней сгорит/.test(s[1].text)), 'streak reminder sent');
ok(rem.some(s => s[1].chat_id === 99 && /Тетрадь соскучилась/.test(s[1].text)), 'come-back reminder sent');
n0 = sent.length; const wq2 = [];
await w.scheduled({ cron: '7 14 * * *' }, env, { waitUntil: q => wq2.push(q) }); await Promise.all(wq2);
ok(!sent.slice(n0).some(s => s[0] === 'sendMessage'), 'no second reminder the same day');
await hook({ message: { chat: { id: 99, type: 'private' }, from: { id: 99, language_code: 'ru' }, text: '/quiet' } });
ok(/выключены/.test(lastTo(99).text), '/quiet turns reminders off');
NOW += 4 * 86400000; re(); n0 = sent.length; const wq3 = [];
await w.scheduled({ cron: '7 14 * * *' }, env, { waitUntil: q => wq3.push(q) }); await Promise.all(wq3);
ok(!sent.slice(n0).some(s => s[0] === 'sendMessage' && s[1].chat_id === 99), 'quiet player gets no reminders');
// stats
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/stats' } });
const stt = lastTo(42).text; 
ok(/Удержание/.test(stt) && /подсказок \d/.test(stt) && /Подарков друзьям за 7 дней: \d/.test(stt) && /Топ рейтинга: Abd/.test(stt), '/stats shows retention, coin services, gifts, rating');
