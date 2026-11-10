// ===================== X02.0 server =====================
// Secrets (Settings → Variables and Secrets): BOT_TOKEN, WEBHOOK_SECRET, optional SUPPORT (e.g. "@yourname").
// Bindings (Settings → Bindings): D1 database "DB" (players, online games, payments, admin);
//   KV namespace "WALLET" (old storage, read once to move players into D1; still used if DB is missing).

const GAME_URL = "https://odilhojaev20060606-cmyk.github.io/x02/";
const GAME_ORIGIN = "https://odilhojaev20060606-cmyk.github.io";
const BOT_LINK = "https://t.me/xo_version2bot/play";
const TZ_OFFSET = 5 * 3600 * 1000;    // Tashkent time for "today" in admin stats
const PACKS = [{ coins: 10, stars: 50 }, { coins: 100, stars: 400 }];
const GOLD = ["x_gold", "o_gold"];
const EXCHANGE = { ex0: [5, 100], ex1: [10, 250], ex2: [20, 600] };          // coins -> paperclips
// paperclip shop (must match SHOP in app.js); price 0 = free, -1 = coins only
const ITEMS = {
  x_classic: ["xShape", 0], x_plus: ["xShape", 100], x_star: ["xShape", 150], x_hash: ["xShape", 150], x_skew: ["xShape", 200], x_fire: ["xShape", 500],
  o_classic: ["oShape", 0], o_square: ["oShape", 100], o_diamond: ["oShape", 120], o_pent: ["oShape", 150], o_hex: ["oShape", 150], o_fire: ["oShape", 500],
  xc_blue: ["xColor", 0], xc_purple: ["xColor", 150], xc_graphite: ["xColor", 150],
  oc_red: ["oColor", 0], oc_green: ["oColor", 150], oc_orange: ["oColor", 150],
  x_gold: ["xShape", -1], o_gold: ["oShape", -1],
};
const REWARD = { x1: 10, x2: 30, x3: 50, c1: 1, c2: 3 };      // paperclips per win against bots
const FRIEND_REWARD = 10;                                     // paperclips per online X02.0 win (Nostalgia: none)
const FRIEND_MIN_MOVES = 12;                                  // online win counts only after this many main moves
const BOTS = ["x1", "x2", "x3", "c1", "c2", "c3"];
const MIN_MS = { x1: 20000, x2: 20000, x3: 20000, c1: 3000, c2: 3000, c3: 3000 };
const DAILY_CLIPS = 500;
const STREAK = [10, 15, 20, 25, 30, 40, 50];   // daily visits in a row; day 7 also gives a fire skin (or +100 if both are owned)
const BONUS = { welcome: 20, learn: 30, sign: 20, install: 1 };   // install pays a coin, the rest paperclips   // one-time gifts for newcomers: first visit, finished tutorial (outside the daily cap)
const REF_REWARD = 50;        // invite a friend: +50 for both once the friend has really played (outside the daily cap)
const REF_DAILY = 20;         // paid invitations per inviter per day
const REF_NEED = 3;           // "really played": one X02.0 game (counts 3) or three Nostalgia games (1 each)
const CARD_TTL = 30 * 86400;  // victory pictures live 30 days
const CARD_DAILY = 20;
const IMPORT_CAP = 3000;      // max paperclips imported from a device when linking
const MINUTES = [2, 3, 5];    // time per move in online games
const PHRASES = 8;            // quick chat phrases (texts live in the app)

const TEXT = {
  ru: {
    hello: "<b>X02.0</b> — крестики-нолики сложнее шахмат.\n\n81 клетка, звёзды, удары и боты, которые почти не проигрывают.\n\nПобедишь хотя бы «Лёгкого?» 😏",
    again: "Игра ждёт. Жми кнопку 👇",
    play: "▶ Играть", move: "▶ Сделать ход", open: "▶ Открыть партию",
    paid: n => `Оплата прошла: +${n} монет 🪙\nВозвращайся в игру.`,
    support: s => `По вопросам оплаты напиши ${s || "автору игры"}. Опиши, что купил и когда — разберёмся и при необходимости вернём звёзды.`,
    invTitle: n => `${n} монет X02.0`,
    invDesc: "Монеты для магазина X02.0: золотые знаки и обмен на скрепки.",
    yourTurn: (n, m) => `⏱ Твой ход в партии с ${n}! На ход — ${m} мин.`,
    joined: n => `🎮 ${n} принял вызов. Партия началась!`,
    owner: "Готово: ты владелец бота ✅\nКоманды: /stats — статистика, /players — игроки.",
    notOwner: "Эта команда только для владельца.",
    noDb: "Подключи базу D1 (DB) в Cloudflare, чтобы видеть статистику.",
    refPaid: n => `🎉 ${n} пришёл по твоей ссылке и сыграл первую партию: +50 скрепок тебе и ему!`,
    callYou: (n, m, min) => `🎮 ${n} зовёт тебя сыграть в ${m} (${min} мин на ход).`,
    chText: (n, m, min) => `⚔️ <b>${n}</b> вызывает на партию <b>${m}</b> (${min} мин на ход).\n🧠 Думаешь, ты умный? Это игра сложнее шахмат.\nКто первый нажмёт — тот и играет!`,
    chTitle: (m, min) => `⚔️ Вызов: ${m} · ${min} мин`, chDesc: "Кто первый нажмёт — тот играет", chAccept: "⚔️ Принять вызов",
    chLive: (a, b, m) => `⚔️ <b>${a}</b> против <b>${b}</b> — партия ${m} идёт…`,
    chEnd: (w, m) => w ? `🏆 <b>${w}</b> победил в партии ${m}!` : `🤝 Ничья в партии ${m}.`, chMore: "▶ Сыграть тоже",
    cardTitle: "🏆 Моя последняя победа", cardDesc: "Отправить картинку с победой",
    resWin: (n, k) => `🏆 Ты победил ${n}${k ? ` за ${k} ходов` : ""}! Похвастайся друзьям.`, resLose: n => `${n} победил в этот раз. Реванш?`, resDraw: n => `Ничья с ${n}.`, share: "📤 Поделиться", revenge: "🔥 Отомстить", topChat: "🏆 <b>Рейтинг чата · неделя</b>", topAll: "🏆 <b>Рейтинг X02.0 · неделя</b>", topWins: n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "победа" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "победы" : "побед"}`, topJoin: "Напиши /top, чтобы попасть в рейтинг чата. Король недели получает корону 👑", topHint: "Считаются онлайн-победы с понедельника.", topEmpty: "На этой неделе ещё никто не победил онлайн. Будь первым!", topEmptyChat: "В рейтинге чата пока пусто. Напиши /top, сыграй онлайн с кем-то из чата — и ты в таблице!", rematchBtn: "🔁 Реванш", wantsRematch: n => `🔥 <b>${n}</b> хочет реванша! Принимаешь?`,
    link: c => `Ссылка для канала «${c}»:\nhttps://t.me/xo_version2bot/play?startapp=ch_${c}\n\nВсех, кто придёт по ней, увидишь в /stats.`,
    newPlayer: (n, u, s) => `🆕 Новый игрок: ${n}${u ? " @" + u : ""} · ${s}`,
  },
  uz: {
    hello: "<b>X02.0</b> — shaxmatdan ham murakkab X-O.\n\n81 katak, yulduzlar, zarbalar va deyarli yutqazmaydigan botlar.\n\nHech bo'lmasa «Osonmi?»ni yenga olasanmi? 😏",
    again: "O'yin kutyapti. Tugmani bos 👇",
    play: "▶ O'ynash", move: "▶ Yurish qilish", open: "▶ O'yinni ochish",
    paid: n => `To'lov o'tdi: +${n} tanga 🪙\nO'yinga qayt.`,
    support: s => `To'lov bo'yicha savollar uchun ${s || "o'yin muallifiga"} yozing. Nima va qachon sotib olganingizni yozing — hal qilamiz.`,
    invTitle: n => `X02.0: ${n} tanga`,
    invDesc: "X02.0 do'koni uchun tangalar: oltin belgilar va skrepkaga almashtirish.",
    yourTurn: (n, m) => `⏱ ${n} bilan o'yinda sizning yurishingiz! Yurishga — ${m} daqiqa.`,
    joined: n => `🎮 ${n} chaqiruvni qabul qildi. O'yin boshlandi!`,
    owner: "Tayyor: siz bot egasisiz ✅\nBuyruqlar: /stats, /players.",
    notOwner: "Bu buyruq faqat egasi uchun.",
    noDb: "Statistika uchun Cloudflare'da D1 (DB) bazasini ulang.",
    refPaid: n => `🎉 ${n} havolangiz orqali keldi va birinchi o'yinni o'ynadi: sizga ham, unga ham +50 skrepka!`,
    callYou: (n, m, min) => `🎮 ${n} sizni ${m} o'ynashga chaqiryapti (yurishga ${min} daqiqa).`,
    chText: (n, m, min) => `⚔️ <b>${n}</b> <b>${m}</b> o'yiniga chaqiradi (yurishga ${min} daqiqa).\n🧠 O'zingni aqlli deb o'ylaysanmi? Bu shaxmatdan ham qiyin o'yin.\nKim birinchi bossa — o'sha o'ynaydi!`,
    chTitle: (m, min) => `⚔️ Chaqiruv: ${m} · ${min} daq`, chDesc: "Kim birinchi bossa — o'sha o'ynaydi", chAccept: "⚔️ Chaqiruvni qabul qilish",
    chLive: (a, b, m) => `⚔️ <b>${a}</b> va <b>${b}</b> — ${m} o'yini ketmoqda…`,
    chEnd: (w, m) => w ? `🏆 <b>${w}</b> ${m} o'yinida g'alaba qozondi!` : `🤝 ${m} o'yinida durang.`, chMore: "▶ Men ham o'ynayman",
    cardTitle: "🏆 Oxirgi g'alabam", cardDesc: "G'alaba rasmini yuborish",
    resWin: (n, k) => `🏆 Siz ${n} ustidan g'alaba qozondingiz${k ? ` (${k} yurishda)` : ""}! Do'stlaringizga maqtaning.`, resLose: n => `Bu safar ${n} yutdi. Revansh?`, resDraw: n => `${n} bilan durang.`, share: "📤 Ulashish", revenge: "🔥 O'ch olish", topChat: "🏆 <b>Chat reytingi · hafta</b>", topAll: "🏆 <b>X02.0 reytingi · hafta</b>", topWins: n => `${n} g'alaba`, topJoin: "Chat reytingiga kirish uchun /top yozing. Hafta qiroli toj oladi 👑", topHint: "Dushanbadan beri onlayn g'alabalar hisoblanadi.", topEmpty: "Bu hafta hali hech kim onlayn yutmadi. Birinchi bo'ling!", topEmptyChat: "Chat reytingi hozircha bo'sh. /top yozing va chatdagilar bilan onlayn o'ynang!", rematchBtn: "🔁 Revansh", wantsRematch: n => `🔥 <b>${n}</b> revansh xohlaydi! Qabul qilasanmi?`,
    link: c => `«${c}» kanali uchun havola:\nhttps://t.me/xo_version2bot/play?startapp=ch_${c}`,
    newPlayer: (n, u, s) => `🆕 Yangi o'yinchi: ${n}${u ? " @" + u : ""} · ${s}`,
  },
  en: {
    hello: "<b>X02.0</b> — tic-tac-toe harder than chess.\n\n81 cells, stars, strikes and bots that almost never lose.\n\nCan you beat at least «Easy?» 😏",
    again: "The game is waiting. Tap the button 👇",
    play: "▶ Play", move: "▶ Make a move", open: "▶ Open the game",
    paid: n => `Payment received: +${n} coins 🪙\nHead back to the game.`,
    support: s => `For payment questions, message ${s || "the game's author"}. Tell us what you bought and when — we'll sort it out and refund Stars if needed.`,
    invTitle: n => `${n} X02.0 coins`,
    invDesc: "Coins for the X02.0 shop: golden marks and paperclip exchange.",
    yourTurn: (n, m) => `⏱ Your move in the game with ${n}! ${m} min per move.`,
    joined: n => `🎮 ${n} accepted the challenge. The game is on!`,
    owner: "Done: you are the bot owner ✅\nCommands: /stats, /players.",
    notOwner: "This command is for the owner only.",
    noDb: "Connect the D1 database (DB) in Cloudflare to see stats.",
    refPaid: n => `🎉 ${n} came via your link and played a first game: +50 paperclips for both of you!`,
    callYou: (n, m, min) => `🎮 ${n} invites you to play ${m} (${min} min per move).`,
    chText: (n, m, min) => `⚔️ <b>${n}</b> challenges you to <b>${m}</b> (${min} min per move).\n🧠 Think you're smart? This game is harder than chess.\nFirst to tap plays!`,
    chTitle: (m, min) => `⚔️ Challenge: ${m} · ${min} min`, chDesc: "First to tap plays", chAccept: "⚔️ Accept the challenge",
    chLive: (a, b, m) => `⚔️ <b>${a}</b> vs <b>${b}</b> — a ${m} game is on…`,
    chEnd: (w, m) => w ? `🏆 <b>${w}</b> won the ${m} game!` : `🤝 The ${m} game ended in a draw.`, chMore: "▶ I want to play too",
    cardTitle: "🏆 My latest win", cardDesc: "Send the victory picture",
    resWin: (n, k) => `🏆 You beat ${n}${k ? ` in ${k} moves` : ""}! Show it off.`, resLose: n => `${n} won this time. Rematch?`, resDraw: n => `A draw with ${n}.`, share: "📤 Share", revenge: "🔥 Take revenge", topChat: "🏆 <b>Chat ranking · this week</b>", topAll: "🏆 <b>X02.0 ranking · this week</b>", topWins: n => n === 1 ? "1 win" : `${n} wins`, topJoin: "Type /top to join the chat ranking. The king of the week gets a crown 👑", topHint: "Online wins since Monday count.", topEmpty: "No online wins this week yet. Be the first!", topEmptyChat: "The chat ranking is empty. Type /top and play online with someone from the chat!", rematchBtn: "🔁 Rematch", wantsRematch: n => `🔥 <b>${n}</b> wants a rematch! Are you in?`,
    link: c => `Link for the "${c}" channel:\nhttps://t.me/xo_version2bot/play?startapp=ch_${c}`,
    newPlayer: (n, u, s) => `🆕 New player: ${n}${u ? " @" + u : ""} · ${s}`,
  },
};

function lang(code) {
  code = (code || "").toLowerCase();
  if (code.startsWith("uz")) return "uz";
  if (/^(ru|uk|be|kk|ky|tg)/.test(code)) return "ru";
  return "en";
}
const escHtml = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
const playButton = (t, url, label) => ({ inline_keyboard: [[{ text: label || t.play, web_app: { url: url || GAME_URL } }]] });

// ---- Telegram Mini App initData check (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
const enc = new TextEncoder();
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
async function userFromInitData(env, initData) {
  if (typeof initData !== "string" || !initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac("WebAppData", env.BOT_TOKEN);
  if (hex(await hmac(secret, check)) !== hash) return null;
  const age = Date.now() / 1000 - Number(p.get("auth_date") || 0);
  if (!(age < 7 * 86400)) return null;
  try {
    const u = JSON.parse(p.get("user") || "null");
    const sp = p.get("start_param") || "";
    return u && u.id ? { ...u, src: "tg", sp: /^[a-z]{1,2}_[A-Za-z0-9_-]{1,48}$/.test(sp) ? sp : "" } : null;
  } catch (e) { return null; }
}
// ---- "Log in with Telegram" widget check (https://core.telegram.org/widgets/login#checking-authorization)
async function userFromLogin(env, data) {
  if (!data || typeof data !== "object" || !data.hash || !data.id) return null;
  const check = Object.keys(data).filter(k => k !== "hash" && data[k] != null && data[k] !== "").sort().map(k => `${k}=${data[k]}`).join("\n");
  const secret = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(env.BOT_TOKEN)));
  if (hex(await hmac(secret, check)) !== String(data.hash)) return null;
  if (!(Date.now() / 1000 - Number(data.auth_date || 0) < 86400)) return null;
  return { id: Number(data.id), username: data.username, first_name: data.first_name, last_name: data.last_name, photo_url: data.photo_url, language_code: "", src: "web" };
}
// our own session token for the web/PWA version: "id.expires.signature"
async function makeSession(env, id) {
  const exp = Math.floor(Date.now() / 1000) + 180 * 86400;
  return `${id}.${exp}.${hex(await hmac(env.WEBHOOK_SECRET + ":session", `${id}.${exp}`))}`;
}
async function userFromSession(env, token) {
  const m = /^(\d+)\.(\d+)\.([0-9a-f]{64})$/.exec(String(token || ""));
  if (!m || Number(m[2]) < Date.now() / 1000) return null;
  if (hex(await hmac(env.WEBHOOK_SECRET + ":session", `${m[1]}.${m[2]}`)) !== m[3]) return null;
  return { id: Number(m[1]), language_code: "", src: "web" };
}
async function auth(env, body) {
  if (body.initData) return userFromInitData(env, body.initData);
  if (body.session) return userFromSession(env, body.session);
  return null;
}

// ===================== storage: D1 (with KV as the old store) =====================
let schemaReady = false;
async function ensureSchema(env) {
  if (!env.DB || schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, data TEXT NOT NULL, name TEXT, username TEXT, photo TEXT, lang TEXT, src TEXT, created INTEGER, seen INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, mode TEXT, minutes INTEGER, host INTEGER, guest INTEGER, host_side INTEGER, status TEXT, state TEXT, chat TEXT, ver INTEGER, created INTEGER, updated INTEGER, deadline INTEGER, seen_h INTEGER, seen_g INTEGER, notified INTEGER, next TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS games_host ON games(host, updated)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS games_guest ON games(guest, updated)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS payments (charge TEXT PRIMARY KEY, uid INTEGER, coins INTEGER, stars INTEGER, at INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS bonuses (id INTEGER, kind TEXT, t INTEGER, PRIMARY KEY (id, kind))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS plays (day TEXT, mode TEXT, n INTEGER, PRIMARY KEY (day, mode))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS refs (invitee INTEGER PRIMARY KEY, inviter INTEGER, device TEXT, created INTEGER, games INTEGER, paid INTEGER, paid_at INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS refs_inviter ON refs(inviter, paid_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS challenges (code TEXT PRIMARY KEY, host INTEGER, mode TEXT, minutes INTEGER, inline_id TEXT, game TEXT, created INTEGER)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS challenges_game ON challenges(game)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS chat_members (chat INTEGER, uid INTEGER, t INTEGER, PRIMARY KEY (chat, uid))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, uid INTEGER, t INTEGER, text TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS games_done ON games(status, updated)"),
  ]);
  schemaReady = true;
}
function normProfile(p) {
  p = p || {};
  return {
    coins: p.coins | 0, gold: Array.isArray(p.gold) ? p.gold : [],
    clips: p.clips | 0, owned: Array.isArray(p.owned) ? p.owned : [], equip: p.equip || {},
    scores: p.scores || {}, netLosses: p.netLosses | 0, netBeaten: !!p.netBeaten,
    imported: p.imported | 0, day: p.day || "", dayClips: p.dayClips | 0, rk: Array.isArray(p.rk) ? p.rk : [],
    bonus: Array.isArray(p.bonus) ? p.bonus.filter(k => BONUS[k]) : [],
    streak: p.streak && typeof p.streak === "object" ? { last: String(p.streak.last || ""), n: p.streak.n | 0 } : { last: "", n: 0 },
  };
}
// returns { p, fresh } — fresh = this player was never seen before (neither in D1 nor in old KV)
async function getProfile(env, id) {
  if (env.DB) {
    await ensureSchema(env);
    const row = await env.DB.prepare("SELECT data FROM players WHERE id = ?").bind(id).first();
    if (row) return { p: normProfile(JSON.parse(row.data)), fresh: false, inDb: true };
  }
  const old = env.WALLET ? await env.WALLET.get("u:" + id, "json") : null;
  return { p: normProfile(old), fresh: !old, inDb: false };
}
// meta: { name, username, photo, lang, src } — written when known
async function putProfile(env, id, p, meta) {
  const now = Date.now();
  if (env.DB) {
    await ensureSchema(env);
    const m = meta || {};
    await env.DB.prepare(
      `INSERT INTO players (id, data, name, username, photo, lang, src, created, seen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, seen = excluded.seen,
         name = COALESCE(?3, name), username = COALESCE(?4, username), photo = COALESCE(?5, photo), lang = COALESCE(?6, lang), src = COALESCE(src, ?7)`
    ).bind(id, JSON.stringify(p), m.name ?? null, m.username ?? null, m.photo ?? null, m.lang ?? null, m.src ?? null, now).run();
    return;
  }
  if (env.WALLET) await env.WALLET.put("u:" + id, JSON.stringify(p));
}
// where a new player came from: "tg", "web", "tg:r" (invited), "tg:c" (chat challenge), "tg:ch_name" (a channel link)…
function srcOf(u) {
  if (!u || !u.src) return null;
  const sp = u.sp || "";
  const k = /^ch_/.test(sp) ? sp.slice(0, 24) : /^[rgckh]_/.test(sp) ? sp[0] : "";
  return k ? `${u.src}:${k}` : u.src;
}
function metaOf(u) {
  if (!u || !u.first_name) return u && u.src ? { src: srcOf(u) } : null;
  return {
    name: [u.first_name, u.last_name].filter(Boolean).join(" ").slice(0, 64),
    username: u.username || "", photo: u.photo_url || "", lang: u.language_code || null, src: srcOf(u),
  };
}
function srcName(s) {
  s = String(s || "");
  const base = s.startsWith("web") ? "сайт" : "бот", k = s.split(":")[1] || "";
  const how = k === "r" ? "по приглашению" : k === "c" ? "по вызову в чате" : k === "g" ? "по ссылке на партию" : k === "k" ? "по карточке победы" : k === "h" ? "царь горы" : k.startsWith("ch_") ? "канал " + k.slice(3) : "";
  return how ? `${base}, ${how}` : base;
}
async function getMeta(env, k) {
  if (!env.DB) return null;
  await ensureSchema(env);
  const r = await env.DB.prepare("SELECT v FROM meta WHERE k = ?").bind(k).first();
  return r ? r.v : null;
}
async function setMeta(env, k, v) {
  await ensureSchema(env);
  await env.DB.prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, String(v)).run();
}
async function notifyOwnerNewPlayer(env, u) {
  try {
    const owner = await getMeta(env, "owner");
    if (!owner) return;
    const name = u.first_name ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "id " + u.id;
    const s = srcOf(u) || "";
    await tg(env, "sendMessage", { chat_id: Number(owner), text: TEXT.ru.newPlayer(name, u.username, srcName(s)) });
  } catch (e) {}
}

// ---- weekly rankings: online wins since Monday 00:00 (Tashkent)
const weekStart = now => { const ds = dayStart(now), dow = new Date(ds + TZ_OFFSET).getUTCDay(); return ds - ((dow + 6) % 7) * 86400000; };
async function weekWins(env, since, ids) {        // Map uid -> { w: wins, g: games }
  let q = "SELECT host, guest, host_side, state FROM games WHERE status = 'done' AND guest IS NOT NULL AND updated > ?1";
  const binds = [since];
  if (ids) { const ph = ids.map((_, i) => "?" + (i + 2)).join(","); q += ` AND (host IN (${ph}) OR guest IN (${ph}))`; binds.push(...ids); }
  const rows = (await env.DB.prepare(q + " LIMIT 3000").bind(...binds).all()).results || [];
  const m = new Map(), add = (u, k) => { const e = m.get(u) || { w: 0, g: 0 }; e[k]++; m.set(u, e); };
  for (const r of rows) {
    let st = null; try { st = JSON.parse(r.state); } catch (e) { continue; }
    if (!st || !(st.result >= 1 && st.result <= 3) || st.reason === "cancel") continue;
    add(r.host, "g"); add(r.guest, "g");
    if (st.result !== 3) add(st.result === r.host_side ? r.host : r.guest, "w");
  }
  return m;
}
async function topText(env, t, chatId) {        // /top: the chat's members in a group, everyone in a private chat
  const now = Date.now();
  let ids = null;
  if (chatId) ids = ((await env.DB.prepare("SELECT uid FROM chat_members WHERE chat = ? LIMIT 200").bind(chatId).all()).results || []).map(r => r.uid);
  const wk = await weekWins(env, weekStart(now), ids && ids.length ? ids : (chatId ? [-1] : null));
  let list = [...wk.entries()].filter(([id, e]) => e.w > 0 && (!ids || ids.includes(id))).sort((a, b) => b[1].w - a[1].w || b[1].g - a[1].g).slice(0, 10);
  if (!list.length) return chatId ? t.topEmptyChat : t.topEmpty;
  const pr = (await env.DB.prepare(`SELECT id, name, username FROM players WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list.map(e => e[0])).all()).results || [];
  const nm = new Map(pr.map(r => [r.id, r.name || (r.username ? "@" + r.username : "Player")]));
  const lines = list.map(([id, e], i) => `${i === 0 ? "👑" : i + 1 + "."} ${escHtml(nm.get(id) || "Player")} — ${t.topWins(e.w)}`);
  return (chatId ? t.topChat : t.topAll) + "\n\n" + lines.join("\n") + "\n\n" + (chatId ? t.topJoin : t.topHint);
}
const publicProfile = p => ({ coins: p.coins, gold: p.gold, clips: p.clips, owned: p.owned, equip: p.equip, scores: p.scores, netLosses: p.netLosses, netBeaten: p.netBeaten, bonus: p.bonus, streak: p.streak });
const ownsItem = (p, id) => ITEMS[id] && (ITEMS[id][1] === 0 || p.owned.includes(id) || p.gold.includes(id));
const today = () => new Date().toISOString().slice(0, 10);
async function countPlay(env, mode) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT INTO plays (day, mode, n) VALUES (?, ?, 1) ON CONFLICT(day, mode) DO UPDATE SET n = n + 1").bind(today(), mode === "classic" ? "classic" : "x02").run();
  } catch (e) {}
}
function payClips(p, n) {      // daily cap on paperclips from wins
  if (p.day !== today()) { p.day = today(); p.dayClips = 0; }
  const k = Math.min(n, Math.max(0, DAILY_CLIPS - p.dayClips));
  p.clips += k; p.dayClips += k;
  return k;
}
function mergeLocal(p, local) {
  if (!local || typeof local !== "object") return;
  const add = Math.min(Math.max(0, (local.clips | 0) - p.clips), Math.max(0, IMPORT_CAP - p.imported));
  p.clips += add; p.imported += add;
  for (const id of (Array.isArray(local.owned) ? local.owned : [])) if (ITEMS[id] && ITEMS[id][1] > 0 && !p.owned.includes(id)) p.owned.push(id);
  if (local.netBeaten) { p.netBeaten = true; for (const g of GOLD) if (!p.gold.includes(g)) p.gold.push(g); }
  p.netLosses = Math.max(p.netLosses, local.netLosses | 0);
  // bonuses already taken while playing as a guest are not paid a second time
  for (const k of (Array.isArray(local.bonus) ? local.bonus : [])) if (BONUS[k] && !p.bonus.includes(k)) p.bonus.push(k);
  const ls = local.scores && typeof local.scores === "object" ? local.scores : {};
  for (const b of BOTS) {
    const a = p.scores[b] || { me: 0, bot: 0, draw: 0 }, c = ls[b] || {};
    p.scores[b] = { me: Math.max(a.me | 0, c.me | 0), bot: Math.max(a.bot | 0, c.bot | 0), draw: Math.max(a.draw | 0, c.draw | 0) };
  }
  if (local.equip && typeof local.equip === "object") for (const [kind, id] of Object.entries(local.equip)) {
    if (!p.equip[kind] && ITEMS[id] && ITEMS[id][0] === kind && ownsItem(p, id)) p.equip[kind] = id;
  }
}

const cors = { "Access-Control-Allow-Origin": GAME_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors } });

// ===================== online games (play a friend by link) =====================
const E = ENGINE();
const rid = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(x => "abcdefghijkmnpqrstuvwxyz23456789"[x & 31]).join(""); };
const actorOf = s => {
  if (s.result) return 0;
  if (s.mode === "classic") return s.t.turn;
  if (s.phase === "prelude") return s.t.result ? 0 : s.t.turn;
  return s.g.turn;
};
function rowToGame(r) {
  return {
    id: r.id, mode: r.mode, minutes: r.minutes, host: r.host, guest: r.guest, hostSide: r.host_side, status: r.status,
    state: JSON.parse(r.state), chat: JSON.parse(r.chat || "[]"), ver: r.ver, created: r.created, updated: r.updated,
    deadline: r.deadline || 0, seenH: r.seen_h || 0, seenG: r.seen_g || 0, notified: r.notified || 0, next: r.next || "",
  };
}
async function loadGame(env, id) {
  const r = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(String(id || "").slice(0, 16)).first();
  return r ? rowToGame(r) : null;
}
// optimistic write: only succeeds if nobody changed the game since we read it
async function saveGame(env, g, prevVer) {
  const r = await env.DB.prepare(
    `UPDATE games SET guest = ?, status = ?, state = ?, chat = ?, ver = ?, updated = ?, deadline = ?, seen_h = ?, seen_g = ?, notified = ?, next = ? WHERE id = ? AND ver = ?`
  ).bind(g.guest, g.status, JSON.stringify(g.state), JSON.stringify(g.chat), g.ver, g.updated, g.deadline, g.seenH, g.seenG, g.notified, g.next || null, g.id, prevVer).run();
  return !!(r.meta && r.meta.changes);
}
const sideOf = (g, uid) => uid === g.host ? g.hostSide : uid === g.guest ? 3 - g.hostSide : 0;
const uidOfSide = (g, side) => side === g.hostSide ? g.host : g.guest;

function newState(mode) {
  return mode === "classic"
    ? { mode, t: E.newTTT(1), result: 0, reason: "", lastBy: 0, lastA: -1 }
    : { mode, phase: "prelude", t: E.newTTT(1), g: null, coin: 0, golden: 0, mainAt: 0, result: 0, reason: "", lastBy: 0, lastA: -1 };
}
// time-driven changes: warm-up -> main game, and running out of time
function tick(g, now) {
  if (g.status !== "active") return false;
  const s = g.state;
  let changed = false;
  if (s.mode === "x02" && s.phase === "prelude" && s.t.result && s.mainAt && now >= s.mainAt) {
    s.phase = "main"; s.lastA = -1; s.lastBy = 0;
    g.deadline = now + g.minutes * 60000;
    changed = true;
  }
  const actor = actorOf(s);
  if (actor && g.deadline && now > g.deadline) { finishState(s, 3 - actor, "timeout"); changed = true; }
  return changed;
}
function finishState(s, winner, reason) { s.result = winner; s.reason = reason; }
function warmupDone(g, now) {      // prelude finished: prepare the main game, start it a few seconds later
  const s = g.state, r = s.t.result;
  if (r === 1 || r === 2) { s.g = E.newMain(3 - r, { [r]: 1 }); s.mainAt = now + 3500; }
  else {
    const a = new Uint8Array(2); crypto.getRandomValues(a);
    s.coin = a[0] & 1 ? 1 : 2; s.golden = a[1] < 3 ? 1 : 0;        // ~1% golden coin
    s.g = E.newMain(s.coin, s.golden ? { [s.coin]: 1 } : null); s.mainAt = now + 5600;
  }
  g.deadline = s.mainAt + g.minutes * 60000;
}
function applyMove(g, side, a) {
  const s = g.state, now = Date.now();
  if (s.result || actorOf(s) !== side) return "turn";
  a = Number(a);
  if (s.mode === "classic" || s.phase === "prelude") {
    if (!Number.isInteger(a) || a < 0 || a > 8) return "illegal";
    const t = E.tttApply(s.t, a);
    if (!t) return "illegal";
    s.t = t; s.lastA = a; s.lastBy = side;
    if (s.mode === "classic") { if (t.result) finishState(s, t.result, t.result === 3 ? "draw" : "row"); else g.deadline = now + g.minutes * 60000; }
    else if (t.result) warmupDone(g, now);
    else g.deadline = now + g.minutes * 60000;
    return "";
  }
  if (!Number.isInteger(a) || !E.isLegal(s.g, a)) return "illegal";
  s.g = E.apply(s.g, a); s.lastA = a; s.lastBy = side;
  if (s.g.result) finishState(s, s.g.result, s.g.secret >= 0 ? "secret" : s.g.result === 3 ? "draw" : s.g.byCount ? "count" : "row");
  else g.deadline = now + g.minutes * 60000;
  return "";
}
// game over: scores for both players, paperclips for an X02.0 win
async function settle(env, g) {
  const s = g.state, key = s.mode === "classic" ? "fc" : "fx", rewards = {};
  const cards = await playerCards(env, g);
  for (const side of [1, 2]) {
    const uid = uidOfSide(g, side);
    if (!uid) continue;
    const { p } = await getProfile(env, uid);
    const real = s.mode === "classic" ? 1 : (s.g && s.g.moves >= FRIEND_MIN_MOVES ? REF_NEED : 0);
    const rp = await refProgress(env, uid, real, p, (cards[side] || {}).name);
    if (rp) (s.refPaid = s.refPaid || {})[side] = rp;
    const sc = p.scores[key] || { me: 0, bot: 0, draw: 0 };
    if (s.result === 3) sc.draw++; else if (s.result === side) sc.me++; else sc.bot++;
    p.scores[key] = sc;
    if (s.mode === "x02" && s.result === side && s.g && s.g.moves >= FRIEND_MIN_MOVES) {
      const n = payClips(p, FRIEND_REWARD);
      if (n) rewards[side] = n;
    }
    await putProfile(env, uid, p, null);
  }
  s.rewards = rewards;
  await countPlay(env, s.mode);
  await challengeEdit(env, g, "end");
  // the result in the bot chat, with a button that shares a challenge into any chat
  if (s.reason !== "cancel") for (const side of [1, 2]) {
    const uid = uidOfSide(g, side);
    if (!uid) continue;
    try {
      const row = await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(uid).first();
      const t = TEXT[lang(row && row.lang)], other = (cards[3 - side] || {}).name || "?";
      const text = s.result === 3 ? t.resDraw(other) : s.result === side ? t.resWin(other, s.mode === "x02" && s.g ? s.g.moves : 0) : t.resLose(other);
      const kb = [[{ text: t.share, switch_inline_query: "" }], [{ text: t.play, web_app: { url: GAME_URL } }]];
      if (s.result !== side) kb.unshift([{ text: s.result === 3 ? t.rematchBtn : t.revenge, url: `${BOT_LINK}?startapp=g_${g.id}` }]);
      await tg(env, "sendMessage", { chat_id: uid, text, reply_markup: { inline_keyboard: kb } });
    } catch (e) {}
  }
}
async function playerCards(env, g) {
  const ids = [g.host, g.guest].filter(Boolean);
  const out = {};
  if (!ids.length) return out;
  const rows = (await env.DB.prepare(`SELECT id, name, username, photo FROM players WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results || [];
  for (const r of rows) {
    const side = sideOf(g, r.id);
    out[side] = { name: r.name || (r.username ? "@" + r.username : "Player"), username: r.username || "", photo: r.photo || "" };
  }
  for (const side of [1, 2]) if (!out[side] && uidOfSide(g, side)) out[side] = { name: "Player", username: "", photo: "" };
  return out;
}
async function viewOf(env, g, uid) {
  const me = sideOf(g, uid), s = g.state;
  return {
    id: g.id, mode: g.mode, minutes: g.minutes, status: g.status, ver: g.ver, now: Date.now(), deadline: g.deadline,
    me, host: uid === g.host, state: s, chat: g.chat, next: g.next || "",
    players: await playerCards(env, g),
    reward: s.rewards ? s.rewards[me] || 0 : 0,
    link: `${BOT_LINK}?startapp=g_${g.id}`,
  };
}
// "your move" message from the bot, if the player is not looking at the game right now
async function nudge(env, g, now) {
  const s = g.state, actor = actorOf(s);
  if (!actor || g.status !== "active" || g.notified === g.ver) return;
  const uid = uidOfSide(g, actor), seen = actor === g.hostSide ? g.seenH : g.seenG;
  if (!uid || now - seen < 25000) return;
  const opp = uidOfSide(g, 3 - actor);
  const rows = (await env.DB.prepare("SELECT id, name, username, lang FROM players WHERE id IN (?, ?)").bind(uid, opp || 0).all()).results || [];
  const meRow = rows.find(r => r.id === uid) || {}, oppRow = rows.find(r => r.id === opp) || {};
  const t = TEXT[lang(meRow.lang)];
  const oppName = oppRow.name || (oppRow.username ? "@" + oppRow.username : "?");
  g.notified = g.ver;
  try {
    await tg(env, "sendMessage", { chat_id: uid, text: t.yourTurn(oppName, g.minutes), reply_markup: playButton(t, `${GAME_URL}?g=${g.id}`, t.move) });
  } catch (e) {}
}
function markSeen(g, uid, now) {
  if (uid === g.host && now - g.seenH > 10000) { g.seenH = now; return true; }
  if (uid === g.guest && now - g.seenG > 10000) { g.seenG = now; return true; }
  return false;
}

async function insertGame(env, host, mode, minutes, hostSide, seenH) {
  const now = Date.now();
  const g = { id: rid(), mode, minutes, host, guest: null, hostSide, status: "waiting", state: newState(mode), chat: [], ver: 1, created: now, updated: now, deadline: 0, seenH, seenG: 0, notified: 0, next: "" };
  await env.DB.prepare("INSERT INTO games (id, mode, minutes, host, guest, host_side, status, state, chat, ver, created, updated, deadline, seen_h, seen_g, notified, next) VALUES (?, ?, ?, ?, NULL, ?, 'waiting', ?, '[]', 1, ?, ?, 0, ?, 0, 0, NULL)")
    .bind(g.id, mode, minutes, host, hostSide, JSON.stringify(g.state), now, now, seenH).run();
  return g;
}
const nameOfUser = u => (u.first_name ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "") || (u.username ? "@" + u.username : "?");
const modeTitle = (m, t) => m === "classic" ? (t === TEXT.uz ? "Nostalgiya" : t === TEXT.en ? "Nostalgia" : "Ностальгия") : "X02.0";
// a friend from the friends list is addressed by a signed token, never by a bare id
async function fidOf(env, me, other) { return `${other}.${hex(await hmac(env.WEBHOOK_SECRET + ":fid", `${me}:${other}`)).slice(0, 12)}`; }
async function fidCheck(env, me, fid) {
  const m = /^(\d+)\.([0-9a-f]{12})$/.exec(String(fid || ""));
  return m && (await fidOf(env, me, m[1])) === fid ? Number(m[1]) : 0;
}

// ---- invite a friend: noted when a brand-new player arrives by someone's link, paid once the newcomer has really played
async function noteReferral(env, user, sp, dev) {
  if (!env.DB || !sp) return;
  let inviter = 0;
  if (/^[rk]_\d{1,15}$/.test(sp)) inviter = Number(sp.slice(2));
  else if (/^c_\d{1,15}_/.test(sp)) inviter = Number(sp.split("_")[1]);
  else if (/^g_[a-z0-9]{6,16}$/.test(sp)) { const r = await env.DB.prepare("SELECT host FROM games WHERE id = ?").bind(sp.slice(2)).first(); inviter = r ? r.host : 0; }
  if (!inviter || inviter === user.id) return;
  if (!(await env.DB.prepare("SELECT id FROM players WHERE id = ?").bind(inviter).first())) return;
  const device = String(dev || "").slice(0, 40);
  if (device && await env.DB.prepare("SELECT invitee FROM refs WHERE device = ? AND paid = 1").bind(device).first()) return;   // one paid invitation per phone
  await env.DB.prepare("INSERT OR IGNORE INTO refs (invitee, inviter, device, created, games, paid, paid_at) VALUES (?, ?, ?, ?, 0, 0, 0)").bind(user.id, inviter, device, Date.now()).run();
}
// add progress for an invited player; returns the paperclips paid to them (and pays the inviter too)
async function refProgress(env, uid, add, p, inviteeName) {
  if (!env.DB || !add) return 0;
  const r = await env.DB.prepare("SELECT inviter, games, paid FROM refs WHERE invitee = ?").bind(uid).first();
  if (!r || r.paid) return 0;
  const games = (r.games | 0) + add, now = Date.now();
  if (games < REF_NEED) { await env.DB.prepare("UPDATE refs SET games = ? WHERE invitee = ? AND paid = 0").bind(games, uid).run(); return 0; }
  const today = ((await env.DB.prepare("SELECT COUNT(*) AS n FROM refs WHERE inviter = ? AND paid = 1 AND paid_at >= ?").bind(r.inviter, dayStart(now)).first()) || {}).n || 0;
  const ok = today < REF_DAILY;
  const u = await env.DB.prepare("UPDATE refs SET games = ?, paid = ?, paid_at = ? WHERE invitee = ? AND paid = 0").bind(games, ok ? 1 : 2, now, uid).run();
  if (!(u.meta && u.meta.changes) || !ok) return 0;
  p.clips += REF_REWARD;
  const { p: ip } = await getProfile(env, r.inviter);
  ip.clips += REF_REWARD;
  await putProfile(env, r.inviter, ip, null);
  try {
    const row = await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(r.inviter).first();
    const t = TEXT[lang(row && row.lang)];
    await tg(env, "sendMessage", { chat_id: r.inviter, text: t.refPaid(inviteeName || "Друг"), reply_markup: playButton(t) });
  } catch (e) {}
  return REF_REWARD;
}

// ---- challenges sent from any chat through inline mode: "c_<host>_<x|c><minutes>_<nonce>"
function parseChallenge(code) {
  const m = /^c_(\d{1,15})_([xc])([235])_([a-z0-9]{4,12})$/.exec(String(code || ""));
  return m ? { code: m[0], host: Number(m[1]), mode: m[2] === "c" ? "classic" : "x02", minutes: Number(m[3]) } : null;
}
async function challengeEdit(env, g, phase) {
  try {
    const row = await env.DB.prepare("SELECT * FROM challenges WHERE game = ?").bind(g.id).first();
    if (!row || !row.inline_id) return;
    const hostRow = await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(g.host).first();
    const t = TEXT[lang(hostRow && hostRow.lang)], cards = await playerCards(env, g), m = modeTitle(g.mode, t);
    const nm = side => escHtml((cards[side] || {}).name || "?");
    const r = g.state && g.state.result;
    const text = phase === "end" ? t.chEnd(r === 1 || r === 2 ? nm(r) : "", m) : t.chLive(nm(g.hostSide), nm(3 - g.hostSide), m);
    const more = `${BOT_LINK}?startapp=c_${g.host}_${g.mode === "classic" ? "c" : "x"}${g.minutes}_${rid().slice(0, 6)}`;
    await tg(env, "editMessageText", { inline_message_id: row.inline_id, text, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[phase === "end" ? { text: t.chMore, url: more } : { text: t.play, url: BOT_LINK }]] } });
  } catch (e) {}
}

async function gameApi(env, path, body, user) {
  if (!env.DB) return json({ error: "no_db" }, 503);
  await ensureSchema(env);
  const now = Date.now(), uid = user.id;

  if (path === "/api/g/new" || path === "/api/g/invite") {
    const mode = body.mode === "classic" ? "classic" : "x02";
    const minutes = MINUTES.includes(Number(body.minutes)) ? Number(body.minutes) : 3;
    const hostSide = Number(body.side) === 2 ? 2 : 1;
    let friend = 0;
    if (path === "/api/g/invite") { friend = await fidCheck(env, uid, body.fid); if (!friend) return json({ error: "bad" }, 400); }
    const g = await insertGame(env, uid, mode, minutes, hostSide, now);
    const v = await viewOf(env, g, uid);
    if (friend) {           // the bot writes to the friend with a button straight into this game
      let sent = false;
      try {
        const row = await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(friend).first();
        const t = TEXT[lang(row && row.lang)];
        const res = await tg(env, "sendMessage", { chat_id: friend, text: t.callYou(nameOfUser(user), modeTitle(mode, t), minutes), reply_markup: playButton(t, `${GAME_URL}?g=${g.id}`, t.open) });
        sent = !!(res && res.ok);
      } catch (e) {}
      v.sent = sent;
    }
    return json(v);
  }

  if (path === "/api/g/challenge") {
    const c = parseChallenge(body.code);
    if (!(await env.DB.prepare("SELECT id FROM players WHERE id = ?").bind(uid).first())) {   // opened the challenge before anything else: create the player now
      const { p: np } = await getProfile(env, uid);
      await putProfile(env, uid, np, metaOf(user));
    }
    if (!c || !(await env.DB.prepare("SELECT id FROM players WHERE id = ?").bind(c.host).first())) return json({ error: "not_found" }, 404);
    let row = await env.DB.prepare("SELECT * FROM challenges WHERE code = ?").bind(c.code).first();
    if (!row || !row.game) {
      const g = await insertGame(env, c.host, c.mode, c.minutes, 1, 0);     // the host is not watching: tell them by a bot message when someone accepts
      await env.DB.prepare("INSERT INTO challenges (code, host, mode, minutes, inline_id, game, created) VALUES (?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(code) DO UPDATE SET game = COALESCE(game, excluded.game)")
        .bind(c.code, c.host, c.mode, c.minutes, g.id, now).run();
      row = await env.DB.prepare("SELECT * FROM challenges WHERE code = ?").bind(c.code).first();
    }
    const g = await loadGame(env, row.game);
    if (!g) return json({ error: "not_found" }, 404);
    if (uid === g.host || uid === g.guest) return json(await viewOf(env, g, uid));
    if (g.status !== "waiting" || g.guest) {
      const cards = await playerCards(env, g);
      return json({ error: "taken", by: (cards[3 - g.hostSide] || {}).name || "" }, 409);
    }
    return gameApi(env, "/api/g/join", { id: g.id }, user);
  }

  if (path === "/api/g/list") {
    const rows = (await env.DB.prepare("SELECT * FROM games WHERE (host = ?1 OR guest = ?1) AND status IN ('waiting', 'active') AND updated > ?2 ORDER BY updated DESC LIMIT 5").bind(uid, now - 3 * 86400000).all()).results || [];
    const list = [];
    for (const r of rows) {
      const g = rowToGame(r), prev = g.ver;
      if (tick(g, now)) { g.ver++; g.updated = now; if (g.state.result) { g.status = "done"; await settle(env, g); } await saveGame(env, g, prev); }
      if (g.status === "done") continue;
      const v = await viewOf(env, g, uid);
      list.push({ id: g.id, mode: g.mode, minutes: g.minutes, status: g.status, me: v.me, myTurn: actorOf(g.state) === v.me, opp: v.players[3 - v.me] || null, link: v.link });
    }
    return json({ games: list });
  }

  let g = await loadGame(env, body.id);
  if (!g) return json({ error: "not_found" }, 404);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) g = await loadGame(env, body.id);
    const prev = g.ver;
    let changed = tick(g, now), side = sideOf(g, uid), err = "", joinedNow = false;

    if (path === "/api/g/join") {
      if (!side) {
        if (g.status !== "waiting" || g.guest) return json({ error: "full" }, 409);
        g.guest = uid; g.status = "active"; g.seenG = now; g.deadline = now + g.minutes * 60000;
        side = sideOf(g, uid); changed = true; joinedNow = true;
      }
    } else if (!side) return json({ error: "not_player" }, 403);
    else if (path === "/api/g/move") {
      if (g.status !== "active") err = "not_active";
      else { err = applyMove(g, side, body.a); if (!err) changed = true; }
    } else if (path === "/api/g/say") {
      const k = Number(body.k) | 0;
      const last = [...g.chat].reverse().find(c => c.p === side);
      if (k < 0 || k >= PHRASES) err = "bad";
      else if (last && now - last.t < 2500) err = "slow";
      else { g.chat = [...g.chat, { p: side, k, t: now }].slice(-12); changed = true; }
    } else if (path === "/api/g/resign") {
      if (g.status === "active" && !g.state.result) { finishState(g.state, 3 - side, "resign"); changed = true; }
      else if (g.status === "waiting" && uid === g.host) { g.status = "done"; finishState(g.state, 0, "cancel"); changed = true; }
    } else if (path === "/api/g/rematch") {
      if (g.status !== "done" || !g.guest) err = "not_done";
      else if (!g.next) {
        const ng = { id: rid(), mode: g.mode, minutes: g.minutes, hostSide: 3 - side };
        const st = newState(g.mode);
        await env.DB.prepare("INSERT INTO games (id, mode, minutes, host, guest, host_side, status, state, chat, ver, created, updated, deadline, seen_h, seen_g, notified, next) VALUES (?, ?, ?, ?, NULL, ?, 'waiting', ?, '[]', 1, ?, ?, 0, ?, 0, 0, NULL)")
          .bind(ng.id, g.mode, g.minutes, uid, ng.hostSide, JSON.stringify(st), now, now, now).run();
        g.next = ng.id; changed = true;
        try {   // tell the other player, who may have closed the game already
          const other = uidOfSide(g, 3 - side), cards = await playerCards(env, g);
          const row = other && await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(other).first();
          if (other) { const t = TEXT[lang(row && row.lang)];
            await tg(env, "sendMessage", { chat_id: other, parse_mode: "HTML", text: t.wantsRematch(escHtml((cards[side] || {}).name || "?")),
              reply_markup: { inline_keyboard: [[{ text: t.rematchBtn, url: `${BOT_LINK}?startapp=g_${g.id}` }]] } }); }
        } catch (e) {}
      }
    }
    if (err && err !== "turn") return json({ error: err, ...(await viewOf(env, g, uid)) }, 409);
    const seenNow = markSeen(g, uid, now);
    if (!changed && seenNow) await env.DB.prepare("UPDATE games SET seen_h = ?, seen_g = ? WHERE id = ?").bind(g.seenH, g.seenG, g.id).run();

    if (!changed && path === "/api/g/state" && Number(body.ver) === g.ver) return json({ same: true, ver: g.ver, now, deadline: g.deadline });
    if (changed) {
      g.ver++; g.updated = now;
      if (g.state.result && g.status === "active") { g.status = "done"; await settle(env, g); }
      if (!(await saveGame(env, g, prev))) continue;          // someone else wrote first: retry on fresh data
      if (joinedNow) {
        try {
          const host = await env.DB.prepare("SELECT lang FROM players WHERE id = ?").bind(g.host).first();
          const t = TEXT[lang(host && host.lang)];
          const meName = (user.first_name ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "") || (user.username ? "@" + user.username : "?");
          if (now - g.seenH > 25000) await tg(env, "sendMessage", { chat_id: g.host, text: t.joined(meName), reply_markup: playButton(t, `${GAME_URL}?g=${g.id}`, t.open) });
        } catch (e) {}
        await challengeEdit(env, g, "join");
      }
      if (path === "/api/g/move" || joinedNow) {
        const before = g.notified;
        await nudge(env, g, now);
        if (g.notified !== before) await env.DB.prepare("UPDATE games SET notified = ? WHERE id = ?").bind(g.notified, g.id).run();
      }
    }
    return json(await viewOf(env, g, uid));
  }
  return json({ error: "busy" }, 409);
}

// ===================== HTTP API for the game =====================
async function api(request, env, path) {
  const body = await request.json().catch(() => ({}));

  if (path === "/api/login") {
    const u = await userFromLogin(env, body.tg);
    if (!u) return json({ error: "auth" }, 401);
    if (typeof body.sp === "string" && /^[a-z]{1,2}_[A-Za-z0-9_-]{1,48}$/.test(body.sp)) u.sp = body.sp;
    const { p, fresh } = await getProfile(env, u.id);
    await putProfile(env, u.id, p, metaOf(u));
    if (fresh) { await noteReferral(env, u, u.sp, body.dev); await notifyOwnerNewPlayer(env, u); }
    return json({ session: await makeSession(env, u.id), name: u.username ? "@" + u.username : (u.first_name || String(u.id)) });
  }

  const user = await auth(env, body);
  if (!user) return json({ error: "auth" }, 401);
  if (!user.sp && typeof body.sp === "string" && /^[a-z]{1,2}_[A-Za-z0-9_-]{1,48}$/.test(body.sp)) user.sp = body.sp;
  if (path.startsWith("/api/g/")) return gameApi(env, path, body, user);

  const t = TEXT[lang(user.language_code)];
  const { p, fresh } = await getProfile(env, user.id);

  if (path === "/api/profile" || path === "/api/wallet") {
    if (body.local) mergeLocal(p, body.local);
    if (body.local && env.DB && p.bonus.length) {
      try { await env.DB.batch(p.bonus.map(k => env.DB.prepare("INSERT OR IGNORE INTO bonuses (id, kind, t) VALUES (?, ?, ?)").bind(user.id, k, Date.now()))); } catch (e) {}
    }
    if (body.local || env.DB) await putProfile(env, user.id, p, metaOf(user));
    if (fresh) { await noteReferral(env, user, user.sp, body.dev); await notifyOwnerNewPlayer(env, user); }
    let ref = null;           // invited and not paid yet: the game shows who invited them
    if (env.DB) {
      const r = await env.DB.prepare("SELECT r.paid, p.name FROM refs r LEFT JOIN players p ON p.id = r.inviter WHERE r.invitee = ?").bind(user.id).first();
      if (r && !r.paid) ref = { name: r.name || "" };
    }
    return json({ ...publicProfile(p), ref });
  }

  if (path === "/api/result") {
    const bot = String(body.bot || ""), r = body.r;
    if (!BOTS.includes(bot) || !["win", "lose", "draw"].includes(r)) return json({ error: "bad" }, 400);
    const key = String(body.key || "").slice(0, 40);
    if (key && p.rk.includes(key)) return json({ ...publicProfile(p), reward: null });     // already counted
    if (key) p.rk = [key, ...p.rk].slice(0, 30);
    const sc = p.scores[bot] || { me: 0, bot: 0, draw: 0 };
    if (r === "win") sc.me++; else if (r === "lose") sc.bot++; else sc.draw++;
    p.scores[bot] = sc;
    if (bot === "c3" && r === "lose") p.netLosses++;
    const counted = !body.undo && (Number(body.ms) || 0) >= MIN_MS[bot];
    const refPaid = counted ? await refProgress(env, user.id, bot[0] === "x" ? REF_NEED : 1, p, nameOfUser(user)) : 0;
    let reward = null, capped = false;
    const fair = r === "win" && !body.undo && (Number(body.ms) || 0) >= MIN_MS[bot];
    if (fair && bot === "c3") {
      p.netBeaten = true; for (const g of GOLD) if (!p.gold.includes(g)) p.gold.push(g);
      reward = { gold: true };
    } else if (fair && REWARD[bot]) {
      const n = payClips(p, REWARD[bot]);
      capped = n < REWARD[bot];
      if (n) reward = { clips: n };
    }
    await putProfile(env, user.id, p, metaOf(user));
    await countPlay(env, bot[0] === "c" ? "classic" : "x02");
    return json({ ...publicProfile(p), reward, capped, refPaid });
  }

  if (path === "/api/bonus") {
    const kind = String(body.kind || "");
    if (!BONUS[kind]) return json({ error: "bad" }, 400);
    let fresh = !p.bonus.includes(kind);
    if (fresh && env.DB) {        // the table makes it atomic: two quick taps can't pay twice
      const r = await env.DB.prepare("INSERT OR IGNORE INTO bonuses (id, kind, t) VALUES (?, ?, ?)").bind(user.id, kind, Date.now()).run();
      fresh = !!(r.meta && r.meta.changes);
    }
    if (!fresh) {                 // already taken: answer with the stored profile, never overwrite it here
      const cur = (await getProfile(env, user.id)).p;
      if (!cur.bonus.includes(kind)) cur.bonus.push(kind);
      return json({ ...publicProfile(cur), paid: 0 });
    }
    p.bonus.push(kind);
    if (kind === "install") p.coins += BONUS.install; else p.clips += BONUS[kind];
    await putProfile(env, user.id, p, metaOf(user));
    return json({ ...publicProfile(p), paid: BONUS[kind] });
  }

  if (path === "/api/note") {        // the comment line on the cover: forwarded to the owner, at most once an hour per player
    const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!text || !env.DB) return json({ error: "bad" }, 400);
    await ensureSchema(env);
    const now = Date.now(), last = await env.DB.prepare("SELECT MAX(t) AS t FROM notes WHERE uid = ?").bind(user.id).first();
    if (last && last.t && now - last.t < 3600000) return json({ error: "slow" });
    await env.DB.prepare("INSERT INTO notes (uid, t, text) VALUES (?, ?, ?)").bind(user.id, now, text).run();
    const owner = await getMeta(env, "owner");
    if (owner) {
      const who = [user.first_name, user.last_name].filter(Boolean).join(" ") || String(body.name || "").slice(0, 40) || "Player";
      try { await tg(env, "sendMessage", { chat_id: Number(owner), text: `✍️ Комментарий с обложки от ${who}${user.username ? " @" + user.username : ""} (id ${user.id}):\n\n${text}` }); } catch (e) {}
    }
    return json({ ok: true });
  }

  if (path === "/api/streak") {        // daily visit: the reward grows each day in a row, day 7 brings a fire skin
    const now = Date.now(), d0 = dayStart(now) + TZ_OFFSET;
    const day = new Date(d0).toISOString().slice(0, 10), yday = new Date(d0 - 86400000).toISOString().slice(0, 10);
    if (p.streak.last === day) return json({ ...publicProfile(p), paid: 0 });
    if (env.DB) {
      const r = await env.DB.prepare("INSERT OR IGNORE INTO bonuses (id, kind, t) VALUES (?, ?, ?)").bind(user.id, "d:" + day, now).run();
      if (!(r.meta && r.meta.changes)) return json({ ...publicProfile((await getProfile(env, user.id)).p), paid: 0 });
    }
    const n = p.streak.last === yday ? p.streak.n + 1 : 1, slot = (n - 1) % 7;
    let paid = STREAK[slot], gift = "";
    if (slot === 6) { gift = ["x_fire", "o_fire"].find(id => !p.owned.includes(id)) || ""; if (gift) p.owned.push(gift); else paid += 100; }
    p.streak = { last: day, n };
    p.clips += paid;
    await putProfile(env, user.id, p, metaOf(user));
    return json({ ...publicProfile(p), paid, gift, n });
  }

  if (path === "/api/friends") {
    if (!env.DB) return json({ friends: [] });
    const now = Date.now(), uid = user.id;
    const rows = (await env.DB.prepare("SELECT id, host, guest, host_side, mode, status, state, updated FROM games WHERE (host = ?1 OR guest = ?1) AND guest IS NOT NULL AND updated > ?2 ORDER BY updated DESC LIMIT 300")
      .bind(uid, now - 90 * 86400000).all()).results || [];
    const by = new Map();
    for (const r of rows) {
      const other = r.host === uid ? r.guest : r.host;
      if (!other || other === uid) continue;
      const mySide = r.host === uid ? r.host_side : 3 - r.host_side;
      let st = null;
      try { st = JSON.parse(r.state); } catch (e) {}
      const f = by.get(other) || { w: 0, l: 0, d: 0, last: 0, game: null };
      if (r.updated > f.last) f.last = r.updated;
      if (r.status === "done" && st && st.result) {
        if (st.result === 3) f.d++; else if (st.result === mySide) f.w++; else if (st.result === 1 || st.result === 2) f.l++;
      } else if (r.status === "active" && st && !st.result && !f.game) {
        f.game = { id: r.id, mode: r.mode, myTurn: actorOf(st) === mySide };
      }
      by.set(other, f);
    }
    const refRows = (await env.DB.prepare("SELECT invitee AS a, paid FROM refs WHERE inviter = ?1 UNION ALL SELECT inviter AS a, 9 AS paid FROM refs WHERE invitee = ?1").bind(uid).all()).results || [];
    let refN = 0, refPaidN = 0;
    for (const r of refRows) {
      if (r.paid !== 9) { refN++; if (r.paid === 1) refPaidN++; }
      if (!by.has(r.a) && r.a !== uid) by.set(r.a, { w: 0, l: 0, d: 0, last: 0, game: null });
    }
    const ids = [...by.keys()].slice(0, 50);
    const cards = new Map();
    if (ids.length) {
      const pr = (await env.DB.prepare(`SELECT id, name, username, photo, seen FROM players WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results || [];
      for (const r of pr) cards.set(r.id, r);
    }
    const friends = ids.map(id => {
      const f = by.get(id), c = cards.get(id) || {};
      return { name: c.name || (c.username ? "@" + c.username : "Player"), username: c.username || "", photo: c.photo || "", seen: c.seen || 0, w: f.w, l: f.l, d: f.d, last: f.last || c.seen || 0, game: f.game, _id: id };
    }).sort((a, b) => ((b.game && b.game.myTurn) ? 1 : 0) - ((a.game && a.game.myTurn) ? 1 : 0) || (b.game ? 1 : 0) - (a.game ? 1 : 0) || b.last - a.last);
    for (const f of friends) { f.fid = await fidOf(env, uid, f._id); delete f._id; }
    // this week's online wins: me and my friends, best first
    let top = [];
    try {
      const tids = [uid, ...ids], wk = await weekWins(env, weekStart(now), tids);
      const me = await env.DB.prepare("SELECT name, username, photo FROM players WHERE id = ?").bind(uid).first() || {};
      top = tids.map(id => { const c = id === uid ? me : (cards.get(id) || {}), e = wk.get(id) || { w: 0, g: 0 };
        return { name: c.name || (c.username ? "@" + c.username : "Player"), photo: c.photo || "", w: e.w, g: e.g, me: id === uid }; })
        .sort((a, b) => b.w - a.w || b.g - a.g || (b.me ? 1 : 0) - (a.me ? 1 : 0));
    } catch (e) {}
    return json({ friends, refs: { n: refN, paid: refPaidN }, top });
  }

  if (path === "/api/card") {
    if (!env.WALLET) return json({ error: "no_kv" }, 503);
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.img || ""));
    if (!m || m[1].length > 1100000) return json({ error: "bad" }, 400);
    const bin = Uint8Array.from(atob(m[1]), ch => ch.charCodeAt(0));
    if (bin[0] !== 0xff || bin[1] !== 0xd8) return json({ error: "bad" }, 400);
    const dk = `cardn:${user.id}:${today()}`, n = Number(await env.WALLET.get(dk)) || 0;
    if (n >= CARD_DAILY) return json({ error: "limit" }, 429);
    await env.WALLET.put(dk, String(n + 1), { expirationTtl: 2 * 86400 });
    const id = rid();
    await env.WALLET.put("card:" + id, bin.buffer, { expirationTtl: CARD_TTL });
    await env.WALLET.put("lastcard:" + user.id, id, { expirationTtl: CARD_TTL });
    const origin = new URL(request.url).origin, url = `${origin}/card/${id}.jpg`;
    const caption = String(body.text || "").slice(0, 300);
    const play = `${BOT_LINK}?startapp=k_${user.id}`;
    let prepared = null;
    try {
      const res = await tg(env, "savePreparedInlineMessage", { user_id: user.id,
        result: { type: "photo", id: "k" + id, photo_url: url, thumbnail_url: url, caption, reply_markup: { inline_keyboard: [[{ text: t.play, url: play }]] } },
        allow_user_chats: true, allow_bot_chats: true, allow_group_chats: true, allow_channel_chats: true });
      if (res && res.ok) prepared = res.result.id;
    } catch (e) {}
    return json({ url, prepared, play });
  }

  if (path === "/api/invoice") {
    const k = body.pack | 0, pack = PACKS[k];
    if (!pack || String(body.pack) !== String(k)) return json({ error: "pack" }, 400);
    const res = await tg(env, "createInvoiceLink", {
      title: t.invTitle(pack.coins),
      description: t.invDesc,
      payload: JSON.stringify({ u: user.id, p: k }),
      currency: "XTR",
      prices: [{ label: t.invTitle(pack.coins), amount: pack.stars }],
    });
    return res.ok ? json({ link: res.result }) : json({ error: "telegram", detail: res.description }, 502);
  }

  if (path === "/api/spend") {
    const item = String(body.item || "");
    if (EXCHANGE[item]) {
      const [c, n] = EXCHANGE[item];
      if (p.coins < c) return json({ error: "coins", ...publicProfile(p) }, 409);
      p.coins -= c; p.clips += n;
    } else if (GOLD.includes(item)) {
      if (!p.gold.includes(item)) {
        if (p.coins < 1) return json({ error: "coins", ...publicProfile(p) }, 409);
        p.coins -= 1; p.gold.push(item);
      }
      p.equip[ITEMS[item][0]] = item;
    } else if (ITEMS[item] && ITEMS[item][1] > 0) {
      if (!p.owned.includes(item)) {
        if (p.clips < ITEMS[item][1]) return json({ error: "clips", ...publicProfile(p) }, 409);
        p.clips -= ITEMS[item][1]; p.owned.push(item);
      }
      p.equip[ITEMS[item][0]] = item;
    } else return json({ error: "item" }, 400);
    await putProfile(env, user.id, p, null);
    return json({ ok: true, ...publicProfile(p) });
  }

  if (path === "/api/equip") {
    const id = String(body.id || "");
    if (!ITEMS[id] || !ownsItem(p, id)) return json({ error: "item", ...publicProfile(p) }, 409);
    if (p.equip[ITEMS[id][0]] !== id) { p.equip[ITEMS[id][0]] = id; await putProfile(env, user.id, p, null); }
    return json({ ok: true, ...publicProfile(p) });
  }
  return json({ error: "not found" }, 404);
}

// ===================== admin commands in the bot =====================
const dayStart = now => Math.floor((now + TZ_OFFSET) / 86400000) * 86400000 - TZ_OFFSET;
function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}
async function adminStats(env) {
  const now = Date.now(), d0 = dayStart(now), d7 = now - 7 * 86400000;
  const one = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()) || {};
  const total = (await one("SELECT COUNT(*) AS n FROM players")).n || 0;
  const newToday = (await one("SELECT COUNT(*) AS n FROM players WHERE created >= ?", d0)).n || 0;
  const new7 = (await one("SELECT COUNT(*) AS n FROM players WHERE created >= ?", d7)).n || 0;
  const active = (await one("SELECT COUNT(*) AS n FROM players WHERE seen >= ?", d0)).n || 0;
  const active7 = (await one("SELECT COUNT(*) AS n FROM players WHERE seen >= ?", d7)).n || 0;
  const src = (await env.DB.prepare("SELECT src, COUNT(*) AS n FROM players GROUP BY src").all()).results || [];
  const bySrc = s => src.filter(r => String(r.src || "tg").startsWith(s)).reduce((a, r) => a + r.n, 0);
  const src7 = (await env.DB.prepare("SELECT src, COUNT(*) AS n FROM players WHERE created >= ? GROUP BY src ORDER BY n DESC").bind(d7).all()).results || [];
  const refAll = await one("SELECT COUNT(*) AS n, COALESCE(SUM(paid = 1), 0) AS p FROM refs");
  const activeTotal = Math.max(1, active7);
  const gToday = (await one("SELECT COUNT(*) AS n FROM games WHERE created >= ? AND guest IS NOT NULL", d0)).n || 0;
  const gLive = (await one("SELECT COUNT(*) AS n FROM games WHERE status = 'active' AND updated > ?", now - 15 * 60000)).n || 0;
  const pay = await one("SELECT COUNT(*) AS n, COALESCE(SUM(stars), 0) AS s FROM payments");
  const since = new Date(now - 6 * 86400000).toISOString().slice(0, 10);
  const plays = (await env.DB.prepare("SELECT mode, SUM(n) AS n FROM plays WHERE day >= ? GROUP BY mode").bind(since).all()).results || [];
  const playsOf = m => (plays.find(r => r.mode === m) || {}).n || 0;
  const bonusN = (await one("SELECT COUNT(*) AS n FROM bonuses WHERE kind = 'learn'")).n || 0;
  return `📊 <b>X02.0 — статистика</b>\n\n` +
    `Игроков всего: <b>${total}</b>\n` +
    `Новых сегодня: <b>${newToday}</b> · за 7 дней: <b>${new7}</b>\n` +
    `Заходили сегодня: <b>${active}</b> · за 7 дней: <b>${active7}</b>\n` +
    `Через бота: ${bySrc("tg")} · через сайт: ${bySrc("web")}\n\n` +
    `Партий с друзьями сегодня: <b>${gToday}</b> · идут сейчас: ${gLive}\n` +
    `Партий за 7 дней: X02.0 — <b>${playsOf("x02")}</b>, Ностальгия — <b>${playsOf("classic")}</b>\n` +
    `Прошли обучение: <b>${bonusN}</b>\n` +
    `Новые за 7 дней по источникам: ${src7.length ? src7.map(r => `${escHtml(srcName(r.src))} — ${r.n}`).join(", ") : "—"}\n` +
    `Приглашения: пришло <b>${refAll.n || 0}</b>, засчитано <b>${refAll.p || 0}</b> · на одного активного игрока: ${((refAll.p || 0) / activeTotal).toFixed(2)}\n` +
    `Покупок: <b>${pay.n || 0}</b> · звёзд: <b>${pay.s || 0} ⭐</b>`;
}
async function adminPlayers(env, page) {
  const per = 25, now = Date.now();
  const total = ((await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first()) || {}).n || 0;
  const rows = (await env.DB.prepare("SELECT id, name, username, src, seen, data FROM players ORDER BY seen DESC LIMIT ? OFFSET ?").bind(per, (page - 1) * per).all()).results || [];
  if (!rows.length) return page > 1 ? "Дальше пусто." : "Игроков пока нет.";
  const lines = rows.map((r, i) => {
    let p = {};
    try { p = JSON.parse(r.data); } catch (e) {}
    let w = 0, l = 0;
    for (const s of Object.values(p.scores || {})) { w += s.me | 0; l += s.bot | 0; }
    const who = escHtml(r.name || "id " + r.id) + (r.username ? " @" + escHtml(r.username) : "");
    return `${(page - 1) * per + i + 1}. ${who} · ${escHtml(srcName(r.src))} · ${ago(now - (r.seen || 0))}\n     побед ${w} · пораж. ${l} · 📎${p.clips | 0} 🪙${p.coins | 0}`;
  });
  const pages = Math.ceil(total / per);
  return `👥 <b>Игроки</b> (${total}) · стр. ${page}/${pages}\n\n${lines.join("\n")}` + (page < pages ? `\n\nДальше: /players ${page + 1}` : "");
}

// ===================== inline mode: "@xo_version2bot" in any chat =====================
async function onInline(env, q) {
  const t = TEXT[lang(q.from && q.from.language_code)], me = q.from || {};
  const name = escHtml(nameOfUser(me));
  const want = (String(q.query || "").match(/[235]/) || ["3"])[0];
  const nonce = () => rid().slice(0, 6);
  const thumb = GAME_URL + "icon-192.png";
  const results = [];
  for (const mode of ["x02", "classic"]) {
    const code = `c_${me.id}_${mode === "classic" ? "c" : "x"}${want}_${nonce()}`;
    results.push({ type: "article", id: code, title: t.chTitle(modeTitle(mode, t), want), description: t.chDesc, thumbnail_url: thumb,
      input_message_content: { message_text: t.chText(name, modeTitle(mode, t), want), parse_mode: "HTML" },
      reply_markup: { inline_keyboard: [[{ text: t.chAccept, url: `${BOT_LINK}?startapp=${code}` }]] } });
  }
  if (env.WALLET) {
    const card = await env.WALLET.get("lastcard:" + me.id);
    if (card) {
      const origin = env.PUBLIC_ORIGIN || "https://x0-wallet.odilhojaev20060606.workers.dev", url = `${origin}/card/${card}.jpg`;
      results.push({ type: "photo", id: "k" + card, photo_url: url, thumbnail_url: url, title: t.cardTitle, description: t.cardDesc,
        reply_markup: { inline_keyboard: [[{ text: t.play, url: `${BOT_LINK}?startapp=k_${me.id}` }]] } });
    }
  }
  await tg(env, "answerInlineQuery", { inline_query_id: q.id, results, cache_time: 0, is_personal: true });
}

// ===================== Telegram updates =====================
async function onUpdate(env, update) {
  // Payment confirmation step: Telegram asks us to approve before charging.
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    let ok = false;
    try { const p = JSON.parse(q.invoice_payload); ok = q.currency === "XTR" && !!PACKS[p.p] && PACKS[p.p].stars === q.total_amount && p.u === q.from.id; } catch (e) {}
    await tg(env, "answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true }
      : { pre_checkout_query_id: q.id, ok: false, error_message: "Invalid order. Please reopen the shop and try again." });
    return;
  }

  if (update.inline_query) { await onInline(env, update.inline_query); return; }
  if (update.chosen_inline_result) {
    const r = update.chosen_inline_result, c = parseChallenge(r.result_id);
    if (c && r.inline_message_id && env.DB) {
      await ensureSchema(env);
      await env.DB.prepare("INSERT INTO challenges (code, host, mode, minutes, inline_id, game, created) VALUES (?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(code) DO UPDATE SET inline_id = excluded.inline_id")
        .bind(c.code, c.host, c.mode, c.minutes, r.inline_message_id, Date.now()).run();
    }
    return;
  }

  const msg = update.message;
  if (msg && msg.chat && (msg.chat.type === "group" || msg.chat.type === "supergroup") && typeof msg.text === "string" && /^\/top(@\w+)?\b/.test(msg.text.trim()) && env.DB) {
    const t = TEXT[lang(msg.from && msg.from.language_code)];
    await ensureSchema(env);
    if (msg.from && !msg.from.is_bot) await env.DB.prepare("INSERT OR REPLACE INTO chat_members (chat, uid, t) VALUES (?, ?, ?)").bind(msg.chat.id, msg.from.id, Date.now()).run();
    await tg(env, "sendMessage", { chat_id: msg.chat.id, parse_mode: "HTML", text: await topText(env, t, msg.chat.id), reply_markup: { inline_keyboard: [[{ text: t.play, url: BOT_LINK }]] } });
    return;
  }
  if (!msg || !msg.chat || msg.chat.type !== "private") return;
  const t = TEXT[lang(msg.from && msg.from.language_code)];

  if (msg.successful_payment) {
    const sp = msg.successful_payment;
    let p = null;
    try { p = JSON.parse(sp.invoice_payload); } catch (e) {}
    const pack = p && PACKS[p.p];
    if (!pack || sp.currency !== "XTR" || sp.total_amount !== pack.stars) return;
    const charge = sp.telegram_payment_charge_id;
    if (env.DB) {
      await ensureSchema(env);
      const r = await env.DB.prepare("INSERT OR IGNORE INTO payments (charge, uid, coins, stars, at) VALUES (?, ?, ?, ?, ?)").bind(charge, msg.from.id, pack.coins, sp.total_amount, Date.now()).run();
      if (!(r.meta && r.meta.changes)) return;                       // already credited (Telegram retry)
    } else {
      if (await env.WALLET.get("p:" + charge)) return;
      await env.WALLET.put("p:" + charge, JSON.stringify({ u: msg.from.id, coins: pack.coins, stars: sp.total_amount, at: Date.now() }));
    }
    const { p: w } = await getProfile(env, msg.from.id);
    w.coins += pack.coins;
    await putProfile(env, msg.from.id, w, metaOf({ ...msg.from, src: null }));
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.paid(pack.coins), reply_markup: playButton(t) });
    return;
  }

  const text = typeof msg.text === "string" ? msg.text.trim() : "";
  if (text.startsWith("/paysupport") || /^\/start\s+support\b/.test(text)) {
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.support(env.SUPPORT) });
    return;
  }
  if (text.startsWith("/admin")) {
    if (!env.DB) { await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.noDb }); return; }
    if (text.split(/\s+/)[1] === env.WEBHOOK_SECRET) { await setMeta(env, "owner", msg.from.id); await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.owner }); }
    else await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.notOwner });
    return;
  }
  if (text.startsWith("/top") && env.DB) {
    await tg(env, "sendMessage", { chat_id: msg.chat.id, parse_mode: "HTML", text: await topText(env, t, null), reply_markup: playButton(t) });
    return;
  }
  if (text.startsWith("/link")) {
    if (!env.DB || String(await getMeta(env, "owner")) !== String(msg.from.id)) { await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.notOwner }); return; }
    const code = (text.split(/\s+/)[1] || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: code ? t.link(code) : "Напиши так: /link название_канала" });
    return;
  }
  if (text.startsWith("/stats") || text.startsWith("/players")) {
    if (!env.DB) { await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.noDb }); return; }
    if (String(await getMeta(env, "owner")) !== String(msg.from.id)) { await tg(env, "sendMessage", { chat_id: msg.chat.id, text: t.notOwner }); return; }
    const page = Math.max(1, parseInt(text.split(/\s+/)[1], 10) || 1);
    await tg(env, "sendMessage", { chat_id: msg.chat.id, parse_mode: "HTML", text: text.startsWith("/stats") ? await adminStats(env) : await adminPlayers(env, page) });
    return;
  }
  // "/start g_xxxx" from a game link opened in the chat: answer with a button straight into that game
  const startGame = /^\/start\s+g_([a-z0-9]{6,16})/.exec(text);
  await tg(env, "sendMessage", {
    chat_id: msg.chat.id,
    text: startGame ? t.again : text.startsWith("/start") ? t.hello : t.again,
    parse_mode: "HTML",
    reply_markup: playButton(t, startGame ? `${GAME_URL}?g=${startGame[1]}` : GAME_URL, startGame ? t.open : t.play),
  });
}

// ---- bot settings (webhook, commands, menu button, description): applied by itself after a deploy that changes SETUP_VER
const SETUP_VER = "15.1";
const BOT_INFO = {
  ru: { cmd: [["start", "Играть"], ["top", "Рейтинг недели"], ["paysupport", "Помощь с оплатой"]],
    short: "Крестики-нолики 2.0 — игра сложнее шахмат 🧠",
    desc: "X02.0 — крестики-нолики 2.0. Девять досок в одной, звёзды и зачёркивания: игра сложнее шахмат.\n\nИграй с ботами и друзьями прямо в Telegram, решай головоломку дня и стань королём своего чата." },
  uz: { cmd: [["start", "O'ynash"], ["top", "Hafta reytingi"], ["paysupport", "To'lov bo'yicha yordam"]],
    short: "Iks-nol 2.0 — shaxmatdan ham qiyin o'yin 🧠",
    desc: "X02.0 — iks-nol 2.0. Bitta doskada to'qqizta doska, yulduzlar va o'chirishlar: shaxmatdan ham qiyin o'yin.\n\nBotlar va do'stlar bilan Telegramda o'ynang, kun jumbog'ini yeching va chatingiz qiroli bo'ling." },
  en: { cmd: [["start", "Play"], ["top", "Weekly ranking"], ["paysupport", "Payment help"]],
    short: "Tic-tac-toe 2.0 — a game harder than chess 🧠",
    desc: "X02.0 — tic-tac-toe 2.0. Nine boards in one, stars and strikes: a game harder than chess.\n\nPlay bots and friends right in Telegram, solve the puzzle of the day and become the king of your chat." },
};
async function botSetup(env, origin, drop) {
  const res = await tg(env, "setWebhook", {
    url: `${env.PUBLIC_ORIGIN || origin}/hook`, secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ["message", "pre_checkout_query", "inline_query", "chosen_inline_result"], drop_pending_updates: !!drop,
  });
  for (const [lc, b] of Object.entries(BOT_INFO)) {
    const extra = lc === "ru" ? {} : { language_code: lc };
    await tg(env, "setMyCommands", { commands: b.cmd.map(([command, description]) => ({ command, description })), ...extra });
    await tg(env, "setMyShortDescription", { short_description: b.short, ...extra });
    await tg(env, "setMyDescription", { description: b.desc, ...extra });
  }
  await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "▶ X02.0", web_app: { url: GAME_URL } } });
  return res;
}
let setupChecked = false;
async function autoSetup(env, origin) {
  if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET || !env.DB) return;
  await ensureSchema(env);
  if (String(await getMeta(env, "setupVer")) === SETUP_VER) return;
  await setMeta(env, "setupVer", SETUP_VER);        // first, so parallel requests don't repeat it
  const res = await botSetup(env, origin, false);
  if (!res || !res.ok) await setMeta(env, "setupVer", "failed");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!setupChecked && ctx && ctx.waitUntil) { setupChecked = true; ctx.waitUntil(autoSetup(env, url.origin).catch(() => { setupChecked = false; })); }

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });
      if (request.method !== "POST") return json({ error: "method" }, 405);
      if (!env.DB && !env.WALLET) return json({ error: "no storage" }, 500);
      try { return await api(request, env, url.pathname); }
      catch (e) { return json({ error: "server", detail: String(e && e.message || e) }, 500); }
    }

    // One-time setup: open https://<worker>/setup?key=<WEBHOOK_SECRET> in a browser.
    if (url.pathname === "/setup") {
      const plain = { headers: { "content-type": "text/plain; charset=utf-8" } };
      if (!env.BOT_TOKEN || !env.WEBHOOK_SECRET) return new Response("Нет секретов BOT_TOKEN / WEBHOOK_SECRET", { status: 500, ...plain });
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("Неверный key", { status: 403, ...plain });
      const res = await botSetup(env, url.origin, true);
      let db = "База D1 (DB) не подключена ❌ (игра с друзьями и статистика не будут работать)";
      if (env.DB) { try { await ensureSchema(env); db = "База D1 подключена ✅"; } catch (e) { db = "Ошибка базы D1: " + e.message; } }
      const kv = env.WALLET ? "KV подключён ✅" : "KV не подключён (это нормально, если всё уже в D1)";
      return new Response((res.ok ? "Готово: бот подключён ✅" : "Ошибка: " + JSON.stringify(res)) + "\n" + db + "\n" + kv, plain);
    }

    const cm = /^\/card\/([a-z0-9]{6,16})\.jpg$/.exec(url.pathname);
    if (cm && env.WALLET) {
      const img = await env.WALLET.get("card:" + cm[1], "arrayBuffer");
      return img ? new Response(img, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" } }) : new Response("not found", { status: 404 });
    }

    if (url.pathname === "/hook" && request.method === "POST") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      const update = await request.json().catch(() => null);
      if (update) { try { await onUpdate(env, update); } catch (e) {} }
      return new Response("ok");
    }

    return new Response("X02.0 bot is running");
  },
};
