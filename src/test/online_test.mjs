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
const A = init(42, 'Abd'), B = init(77, 'Ali'), C = init(99, 'Zed');
const call = async (path, who, body = {}) => { const r = await w.fetch(new Request('https://x.dev' + path, { method: 'POST', body: JSON.stringify({ initData: who, ...body }) }), env); const j = await r.json(); j._s = r.status; return j; };
const hook = u => w.fetch(new Request('https://x.dev/hook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': SEC }, body: JSON.stringify(u) }), env);
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok ', m); };
const lastMsg = () => sent.filter(s => s[0] === 'sendMessage').at(-1)?.[1];

// admin + migration + new player notice
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42, language_code: 'ru' }, text: '/admin S' } });
ok(lastMsg().text.includes('владелец'), '/admin with secret makes owner');
let p = await call('/api/profile', A);
ok(p.clips === 50 && p.coins === 2 && p.scores.x1.me === 1, 'old KV profile moved into D1');
const before = sent.length;
p = await call('/api/profile', B);
ok(sent.slice(before).some(s => s[1].chat_id === 42 && /Новый игрок: Ali @ali/.test(s[1].text)), 'owner notified about a new player');
await call('/api/profile', A); ok(!sent.slice(before + 1).some(s => /Новый игрок: Abd/.test(s[1].text || '')), 'no notice for returning player');

// online X02.0
let g = await call('/api/g/new', A, { mode: 'x02', minutes: 2, side: 1 });
ok(g.status === 'waiting' && g.me === 1 && g.link.endsWith('startapp=g_' + g.id), 'host creates a game, gets link');
const id = g.id;
let j = await call('/api/g/join', B, { id }); ok(j.status === 'active' && j.me === 2 && j.players[1].name === 'Abd' && j.players[2].name === 'Ali', 'friend joins, both names visible');
j = await call('/api/g/join', C, { id }); ok(j._s === 409 && j.error === 'full', 'third player cannot join');
j = await call('/api/g/move', B, { id, a: 0 }); ok(j.state.t.b[0] === 0, 'O cannot move on X turn');
j = await call('/api/g/move', A, { id, a: 99 }); ok(j._s === 409, 'out-of-range move rejected');
for (const [who, a] of [[A, 0], [B, 3], [A, 1], [B, 4], [A, 2]]) j = await call('/api/g/move', who, { id, a });
ok(j.state.t.result === 1 && j.state.phase === 'prelude' && j.state.g.stars[1] === 1 && j.state.g.turn === 2, 'X wins warm-up: gets a star, O moves first');
NOW += 4000;
j = await call('/api/g/state', B, { id, ver: 0 }); ok(j.state.phase === 'main', 'main game starts after the pause');
const v = j.ver; j = await call('/api/g/state', B, { id, ver: v }); ok(j.same === true, 'poll with same version returns "same"');
j = await call('/api/g/move', B, { id, a: 40 }); ok(j.state.g.cells[40] === 2 && j.state.lastA === 40, 'O plays 5-5');
j = await call('/api/g/move', A, { id, a: 0 }); ok(j._s === 409 && j.error === 'illegal', 'X must play in board 5');
NOW += 30000;
const n0 = sent.length;
j = await call('/api/g/move', A, { id, a: 36 }); ok(j.state.g.cells[36] === 1, 'X plays 5-1');
ok(sent.slice(n0).some(s => s[1].chat_id === 77 && /Твой ход/.test(s[1].text) && s[1].reply_markup.inline_keyboard[0][0].web_app.url.endsWith('?g=' + id)), 'friend away 30s -> bot says "your move" with a button into the game');
j = await call('/api/g/say', A, { id, k: 2 }); ok(j.chat.at(-1).k === 2 && j.chat.at(-1).p === 1, 'quick phrase sent');
j = await call('/api/g/say', A, { id, k: 3 }); ok(j._s === 409 && j.error === 'slow', 'phrase spam limited');
j = await call('/api/g/resign', B, { id }); ok(j.status === 'done' && j.state.result === 1 && j.state.reason === 'resign', 'resign: X wins');
p = await call('/api/profile', A); ok(p.scores.fx.me === 1 && p.clips === 50, 'win recorded; no clips (fewer than 12 moves)');
p = await call('/api/profile', B); ok(p.scores.fx.bot === 1, 'loss recorded for friend');
j = await call('/api/g/rematch', B, { id }); ok(j.next && j.next.length === 8, 'rematch offered');
j = await call('/api/g/state', A, { id, ver: 0 }); const nid = j.next; ok(!!nid, 'other player sees rematch offer');
j = await call('/api/g/join', A, { id: nid }); ok(j.status === 'active' && j.me === 2, 'rematch accepted with sides swapped');
// timeout in Nostalgia
let c = await call('/api/g/new', A, { mode: 'classic', minutes: 2, side: 2 });
await call('/api/g/join', B, { id: c.id });
j = await call('/api/g/move', B, { id: c.id, a: 4 }); ok(j.state.t.b[4] === 1, 'Nostalgia: X (friend) moves');
NOW += 2 * 60000 + 1000;
j = await call('/api/g/state', A, { id: c.id, ver: 0 }); ok(j.status === 'done' && j.state.result === 1 && j.state.reason === 'timeout', 'O ran out of time -> X wins');
// full X02.0 win with reward: play random legal moves until someone wins
const E = (await import('../tg/worker.js')).default && null;
let x = await call('/api/g/new', A, { mode: 'x02', minutes: 5, side: 1 }); await call('/api/g/join', B, { id: x.id });
let s = await call('/api/g/move', A, { id: x.id, a: 4 }); // ...draw the warm-up quickly? just skip by playing to a result
for (const [who, a] of [[B, 0], [A, 8], [B, 2], [A, 1], [B, 7], [A, 3], [B, 5], [A, 6]]) s = await call('/api/g/move', who, { id: x.id, a });
ok(s.state.t.result === 3 && (s.state.coin === 1 || s.state.coin === 2), 'warm-up draw: server tossed the coin');
NOW += 6000;
s = await call('/api/g/state', A, { id: x.id, ver: 0 });
const legal = (await import('node:module')).createRequire(import.meta.url);
let guard = 0;
const ENG = Function((await import('node:fs')).readFileSync(new URL('../engine.js', import.meta.url), 'utf8') + '; return ENGINE();')();
while (s.status === 'active' && guard++ < 400) {
  const turn = s.state.g.turn, who = turn === 1 ? A : B;
  const acts = ENG.legal(s.state.g).filter(a => a < 100 || a >= 300);
  s = await call('/api/g/move', who, { id: x.id, a: acts[(Math.random() * acts.length) | 0] });
  if (s._s !== 200) { console.log('move err', s.error); break; }
}
ok(s.status === 'done', 'random full X02.0 game finished: ' + s.state.reason + ', moves ' + s.state.g.moves);
const winner = s.state.result;
if (winner === 1 || winner === 2) {
  const wid = winner === 1 ? A : B;
  const wp = await call('/api/profile', wid);
  ok(s.state.rewards[winner] === 10, 'winner of a real game gets +10 paperclips');
}
// lists and admin
NOW += 1000;
let L = await call('/api/g/list', A); ok(Array.isArray(L.games), 'list of active games works (' + L.games.length + ')');
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/stats' } });
const st = lastMsg().text; ok(/Игроков всего: <b>2<\/b>/.test(st) && /Партий с друзьями сегодня/.test(st), '/stats for owner');
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/players' } });
ok(/Abd @abd/.test(lastMsg().text) && /Ali @ali/.test(lastMsg().text), '/players lists names');
await hook({ message: { chat: { id: 77, type: 'private' }, from: { id: 77, language_code: 'ru' }, text: '/stats' } });
ok(/только для владельца/.test(lastMsg().text), 'others cannot use /stats');
// payment idempotency in D1
const pay = { message: { chat: { id: 77, type: 'private' }, from: { id: 77 }, successful_payment: { currency: 'XTR', total_amount: 50, invoice_payload: JSON.stringify({ u: 77, p: 0 }), telegram_payment_charge_id: 'c9' } } };
await hook(pay); await hook(pay);
p = await call('/api/profile', B); ok(p.coins === 10, 'payment credited once in D1');
await hook({ message: { chat: { id: 5, type: 'private' }, from: { id: 5, language_code: 'ru' }, text: '/start g_abcd2345' } });
ok(lastMsg().reply_markup.inline_keyboard[0][0].web_app.url.endsWith('?g=abcd2345'), '/start with a game link answers with a button into the game');
// ---- v13: newcomer bonuses, friends list, plays per mode, support button
p = await call('/api/profile', C);
const c0 = p.clips;
let bz = await call('/api/bonus', C, { kind: 'welcome' });
ok(bz.paid === 20 && bz.clips === c0 + 20 && bz.bonus.includes('welcome'), 'welcome bonus +20 once');
bz = await call('/api/bonus', C, { kind: 'welcome' });
ok(bz.paid === 0 && bz.clips === c0 + 20, 'welcome bonus is not paid twice');
const [q1, q2] = await Promise.all([call('/api/bonus', C, { kind: 'learn' }), call('/api/bonus', C, { kind: 'learn' })]);
p = await call('/api/profile', C);
ok((q1.paid | 0) + (q2.paid | 0) === 30 && p.clips === c0 + 50, 'two quick taps on the tutorial bonus pay +30 only once');
bz = await call('/api/bonus', C, { kind: 'cheat' }); ok(bz._s === 400, 'unknown bonus kind rejected');
const D = init(55, 'Dee');
p = await call('/api/profile', D, { local: { clips: 20, bonus: ['welcome'] } });
bz = await call('/api/bonus', D, { kind: 'welcome' });
ok(bz.paid === 0 && p.bonus.includes('welcome'), 'a bonus taken as a guest is not paid again after login');
let F = await call('/api/friends', A);
const ali = F.friends.find(f => f.name === 'Ali');
ok(ali && ali.w + ali.l + ali.d >= 1 && typeof ali.seen === 'number', 'friends list: Ali with the score (' + (ali ? `${ali.w}:${ali.l}` : '-') + ')');
const g2 = await call('/api/g/new', A, { mode: 'classic', minutes: 3, side: 1 });
await call('/api/g/join', B, { id: g2.id });
F = await call('/api/friends', B);
ok(F.friends[0].name === 'Abd' && F.friends[0].game && F.friends[0].game.id === g2.id && F.friends[0].game.myTurn === false, 'friends list shows the active game and whose move it is');
F = await call('/api/friends', A);
ok(F.friends[0].game && F.friends[0].game.myTurn === true, 'the host sees "your move" in the friends list');
F = await call('/api/friends', C); ok(Array.isArray(F.friends) && F.friends.length === 0, 'no friends yet -> empty list');
await call('/api/result', A, { bot: 'c1', r: 'win', ms: 5000, key: 'k1' });
await call('/api/result', A, { bot: 'x1', r: 'lose', ms: 30000, key: 'k2' });
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/stats' } });
const st2 = lastMsg().text;
ok(/Партий за 7 дней: X02\.0 — <b>\d+<\/b>, Ностальгия — <b>\d+<\/b>/.test(st2) && /Прошли обучение: <b>1<\/b>/.test(st2), '/stats shows plays per mode and the tutorial count');
await hook({ message: { chat: { id: 5, type: 'private' }, from: { id: 5, language_code: 'ru' }, text: '/start support' } });
ok(!lastMsg().reply_markup, '/start support answers with the support text');
// ---- v14: invitations, "Play" from the friends list, chat challenges, victory pictures, sources
const initSp = (id, name, sp) => { const p = new URLSearchParams({ auth_date: String(Math.floor(NOW / 1000)), start_param: sp, user: JSON.stringify({ id, first_name: name, username: name.toLowerCase(), language_code: 'ru' }) });
  const c = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(c).digest('hex')); return p.toString(); };
const E1 = initSp(1001, 'Eva', 'r_42');
let a0 = (await call('/api/profile', A)).clips;
p = await call('/api/profile', E1, { dev: 'dev-eva' });
ok(p.ref && p.ref.name === 'Abd', 'a newcomer by an invite link sees who invited them');
let r1 = await call('/api/result', E1, { bot: 'c1', r: 'win', ms: 5000, key: 'e1' });
ok(!r1.refPaid, 'one Nostalgia game is not enough yet');
const nMsg = sent.length;
await call('/api/result', E1, { bot: 'c2', r: 'lose', ms: 5000, key: 'e2' });
r1 = await call('/api/result', E1, { bot: 'c1', r: 'lose', ms: 5000, key: 'e3' });
ok(r1.refPaid === 50, 'after three counted Nostalgia games the newcomer gets +50');
ok((await call('/api/profile', A)).clips === a0 + 50, 'the inviter gets +50 too');
ok(sent.slice(nMsg).some(s => s[1].chat_id === 42 && /Eva пришёл по твоей ссылке/.test(s[1].text)), 'the bot tells the inviter');
r1 = await call('/api/result', E1, { bot: 'x1', r: 'lose', ms: 30000, key: 'e4' }); ok(!r1.refPaid, 'an invitation is paid only once');
p = await call('/api/profile', initSp(1002, 'Fox', 'r_42'), { dev: 'dev-eva' });
r1 = await call('/api/result', initSp(1002, 'Fox', 'r_42'), { bot: 'x1', r: 'lose', ms: 30000, key: 'f1' });
ok(!r1.refPaid && !p.ref, 'the same phone cannot bring a second paid invitation');
p = await call('/api/profile', initSp(1003, 'Gus', 'r_1003')); ok(!p.ref, 'inviting yourself does nothing');
r1 = await call('/api/result', initSp(1004, 'Hal', 'r_42'), { bot: 'x1', r: 'lose', ms: 30000, key: 'h1' });
ok(!r1.refPaid, 'an old player (no fresh profile through /api/profile) is not counted');
F = await call('/api/friends', A);
ok(F.refs.n >= 1 && F.refs.paid === 1 && F.friends.some(f => f.name === 'Eva'), 'friends list includes invited players and the counter');
// "Play" from the friends list: the bot writes to the friend
const ev = F.friends.find(f => f.name === 'Eva');
const n2 = sent.length;
let inv = await call('/api/g/invite', A, { fid: ev.fid, mode: 'x02', minutes: 3 });
ok(inv.status === 'waiting' && inv.sent === true && sent.slice(n2).some(s => s[1].chat_id === 1001 && /Abd зовёт тебя сыграть/.test(s[1].text)), '"Play": a game is created and the friend gets a bot message');
inv = await call('/api/g/invite', A, { fid: '1001.000000000000' }); ok(inv._s === 400, 'a forged friend token is rejected');
// chat challenge: lazy game, first tap plays, the message follows the game
await hook({ inline_query: { id: 'q1', from: { id: 42, first_name: 'Abd', language_code: 'ru' }, query: '5' } });
const ans = sent.filter(s => s[0] === 'answerInlineQuery').at(-1)[1];
ok(ans.results.length >= 2 && /^c_42_x5_/.test(ans.results[0].id) && ans.results[0].reply_markup.inline_keyboard[0][0].url.includes('startapp=c_42_x5_'), 'inline query offers challenges (5 min asked)');
const code = ans.results[0].id;
await hook({ chosen_inline_result: { result_id: code, from: { id: 42 }, query: '5', inline_message_id: 'IM1' } });
let ch = await call('/api/g/challenge', initSp(1005, 'Ira', code), { code });
ok(ch.status === 'active' && ch.me === 2 && ch.minutes === 5, 'first tap on a challenge joins the game');
ok(sent.some(s => s[0] === 'editMessageText' && s[1].inline_message_id === 'IM1' && /против/.test(s[1].text)), 'the challenge message in the chat shows the game is on');
ch = await call('/api/g/challenge', C, { code }); ok(ch._s === 409 && ch.error === 'taken' && ch.by === 'Ira', 'the second tap sees "already taken by Ira"');
ch = await call('/api/g/challenge', A, { code }); ok(ch.me === 1, 'the host opens the same game');
await call('/api/g/resign', A, { id: ch.id });
ok(sent.some(s => s[0] === 'editMessageText' && s[1].inline_message_id === 'IM1' && /победил/.test(s[1].text)), 'the chat message shows the winner at the end');
ok(sent.some(s => s[0] === 'sendMessage' && s[1].chat_id === 1005 && s[1].reply_markup && s[1].reply_markup.inline_keyboard[0][0].switch_inline_query === ''), 'after an online game the bot sends the result with a Share button');
// victory picture
const jpg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
let cd = await call('/api/card', A, { img: jpg, text: 'Я победил «Нет»' });
ok(/\/card\/[a-z0-9]+\.jpg$/.test(cd.url) && cd.play.endsWith('startapp=k_42'), 'victory picture stored, prepared for sharing');
const img = await w.fetch(new Request(cd.url), env);
ok(img.status === 200 && img.headers.get('content-type') === 'image/jpeg', 'the picture is served as JPEG');
cd = await call('/api/card', A, { img: 'data:image/png;base64,AAAA' }); ok(cd._s === 400, 'only JPEG pictures are accepted');
await hook({ inline_query: { id: 'q2', from: { id: 42, first_name: 'Abd', language_code: 'ru' }, query: '' } });
ok(sent.filter(s => s[0] === 'answerInlineQuery').at(-1)[1].results.some(r => r.type === 'photo'), 'inline mode also offers the latest victory picture');
// sources and the channel link command
await call('/api/profile', initSp(1006, 'Jon', 'ch_uzgames'));
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/link uzgames' } });
ok(/startapp=ch_uzgames/.test(lastMsg().text), '/link gives a channel link');
await hook({ message: { chat: { id: 42, type: 'private' }, from: { id: 42 }, text: '/stats' } });
const st3 = lastMsg().text;
ok(/канал uzgames — 1/.test(st3) && /по приглашению/.test(st3) && /засчитано <b>1<\/b>/.test(st3), '/stats shows sources and invitations');
