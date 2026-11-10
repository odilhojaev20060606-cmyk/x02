(function () {
"use strict";
const E = ENGINE();
const SYM = ["", "X", "O"];
const $ = id => document.getElementById(id);
const reduce = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const sleep = ms => new Promise(r => setTimeout(r, reduce() ? Math.min(ms, 40) : ms));
// Telegram Mini App (present only when the game is opened inside Telegram)
const TG = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ? window.Telegram.WebApp : null;
// Coin wallet server (Cloudflare Worker). Empty = coins can't be bought (shop shows "buy in Telegram").
const API_BASE = "__API_BASE__";
const API_OK = !!(API_BASE && API_BASE.indexOf("__") !== 0);
const BOT_NAME = "xo_version2bot";
const BOT_LINK = "https://t.me/" + BOT_NAME + "/play";
const GAME_URL = location.origin + location.pathname;
const APP_VERSION = "__APP_VERSION__";
const hapticsOn = () => store.get("haptics", true) !== false;
const haptic = kind => { try { if (hapticsOn() && TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred(kind || "light"); } catch (e) {} };
const hapticResult = ok => { try { if (hapticsOn() && TG && TG.HapticFeedback) TG.HapticFeedback.notificationOccurred(ok ? "success" : "error"); } catch (e) {} };
const store = {
  get(k, d) { try { const v = localStorage.getItem("x02." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("x02." + k, JSON.stringify(v)); } catch (e) {} }
};

// signed-in session for the web/PWA version ("Log in with Telegram"); inside Telegram initData is used instead
// ---------------- sound: everything is synthesized, no audio files ----------------
const SND = (() => {
  let ctx = null, master = null, on = store.get("sound", true) !== false, noiseBuf = null;
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // a pen stroke on paper: band-passed noise with a frequency sweep
  function scratch(t0, dur, f0, f1, gain, q) {
    const src = ctx.createBufferSource(); src.buffer = noise();
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q || 1.2;
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  function tone(freq, t0, dur, gain, type, f1) {
    const o = ctx.createOscillator(); o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const FX = {
    x: n => { scratch(n, 0.09, 3200, 1900, 0.5); scratch(n + 0.12, 0.09, 3000, 1800, 0.5); },
    o: n => { scratch(n, 0.2, 2200, 3400, 0.42, 0.9); },
    star: n => { scratch(n, 0.16, 2600, 2000, 0.4); [1568, 2093, 2637].forEach((f, i) => tone(f, n + 0.05 + i * 0.06, 0.25, 0.05)); },
    strike: n => { scratch(n, 0.32, 1400, 380, 0.85, 0.7); scratch(n + 0.1, 0.22, 900, 300, 0.6, 0.7); },
    capture: n => { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, n + i * 0.07, 0.42, 0.09, "triangle")); },
    choose: n => { tone(880, n, 0.12, 0.08, "triangle"); tone(1175, n + 0.07, 0.16, 0.07, "triangle"); },
    coin: n => { tone(1318.5, n, 0.18, 0.12); tone(1975.5, n + 0.07, 0.35, 0.1); },
    flip: n => { for (let i = 0; i < 9; i++) tone(2400 + i * 60, n + i * 0.16, 0.03, 0.04, "square"); },
    win: n => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, n + i * 0.11, 0.5, 0.1, "triangle")); },
    lose: n => { tone(392, n, 0.32, 0.1, "triangle"); tone(311.1, n + 0.22, 0.32, 0.1, "triangle"); tone(261.6, n + 0.44, 0.6, 0.1, "triangle", 196); },
    draw: n => { tone(440, n, 0.3, 0.08, "triangle"); tone(440, n + 0.2, 0.4, 0.07, "triangle"); },
    click: n => { tone(1600, n, 0.04, 0.05, "square"); }
  };
  return {
    get on() { return on; },
    toggle() { on = !on; store.set("sound", on); if (on) this.play("click"); return on; },
    unlock() { if (on) ac(); },
    play(k, delay) { if (!on || !FX[k]) return; try { if (!ac()) return; FX[k](ctx.currentTime + 0.01 + (delay || 0)); } catch (e) {} }
  };
})();
let session = store.get("session", null);
const authBody = () => TG ? { initData: TG.initData } : (session && session.token ? { session: session.token } : null);
const serverOn = () => API_OK && !!authBody();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// ---------------- bots ----------------
const BOTS = {
  x02: [ { id: "x1", level: 1, ms: 700 }, { id: "x2", level: 2, ms: 1700 }, { id: "x3", level: 3, ms: 7000, deep: true } ],
  classic: [ { id: "c1", level: 1 }, { id: "c2", level: 2 }, { id: "c3", level: 3 } ]
};
// ---------------- language ----------------
const LANGS = ["ru", "uz", "en"];
function detectLang() {
  const saved = store.get("lang", "");
  if (LANGS.includes(saved)) return saved;
  try {
    const tl = TG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.language_code;
    if (tl) return tl.startsWith("uz") ? "uz" : tl.startsWith("ru") ? "ru" : "en";
  } catch (e) {}
  const n = (navigator.language || "ru").toLowerCase();
  return n.startsWith("uz") ? "uz" : n.startsWith("en") ? "en" : "ru";
}
let lang = detectLang();
const t = (k, ...a) => { const v = I18N[lang][k] !== undefined ? I18N[lang][k] : I18N.ru[k]; return typeof v === "function" ? v(...a) : v; };
const bt = (id, k) => I18N[lang].bots[id][k];
const opp = () => !!(app.bot || app.online);
const oppCard = () => (app.online && app.online.players && app.online.players[3 - app.side]) || null;
const oppName = () => { const c = oppCard(); return c ? c.name : "…"; };
const botQ = () => app.online ? esc(oppName()) : t("q", bt(app.bot.id, "name"));
const sw = (sym) => `<b style="color:${sym === "X" ? "var(--ink-x)" : "var(--ink-o)"}">${sym}</b>`;
function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $("rulesBody").innerHTML = t("rulesHTML");
  document.querySelectorAll(".seg[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}
function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l; store.set("lang", l);
  applyStatic(); buildMenu(); if (app.screen === "shop") renderShop(); else render(null);
}

const app = {
  screen: "menu", mode: null, bot: null, gameId: 0, history: [], nav: [], home: "menu", learn: null,
  side: store.get("side", 1) === 2 ? 2 : 1,
  scores: store.get("scores", {}) || {}
};
const recorded = new Set(), rewarded = new Set();
const cur = () => app.history[app.history.length - 1];
const isBot = p => opp() && p > 0 && p !== app.side;      // "the other side" (bot or online friend) — locks input
const nameOf = p => (opp() ? (p === app.side ? t("you") : botQ()) : SYM[p]);
const objOf = p => (opp() ? (p === app.side ? t("youAcc") : botQ()) : SYM[p]);
const isYou = p => opp() && p === app.side;
const pres = (p, third, second) => (opp() && p === app.side ? second : third);
let uiMode = null;        // null | "star" | "strike"
let flash = null;
let inputBusy = false;

// ---------------- hand-drawn marks ----------------
function seeded(k) { const x = Math.sin(k * 9301 + 49297) * 233280; return x - Math.floor(x); }
function xPaths(k) {
  const j = i => (seeded(k * 7 + i) - .5) * 8;
  return [
    `M${12+j(1)} ${14+j(2)} Q ${50+j(3)} ${48+j(4)} ${88+j(5)} ${86+j(6)}`,
    `M${86+j(7)} ${12+j(8)} Q ${52+j(9)} ${50+j(10)} ${14+j(11)} ${88+j(12)}`
  ];
}
function oPath(k) {
  const j = i => (seeded(k * 11 + i) - .5) * 7;
  const sx = 50 + j(2), sy = 13 + j(3);
  return `M${sx} ${sy} C ${84+j(4)} ${12+j(5)} ${90+j(6)} ${60+j(7)} ${62+j(8)} ${84+j(9)} C ${38+j(10)} ${96+j(11)} ${8+j(12)} ${76+j(13)} ${12+j(14)} ${44+j(15)} C ${14+j(16)} ${22+j(17)} ${34+j(18)} ${10+j(19)} ${sx+10} ${sy+3}`;
}
function starPath(k) {
  const j = i => (seeded(k * 13 + i) - .5) * 5;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 19 : 44, a = -Math.PI / 2 + i * Math.PI / 5;
    d += (i ? " L" : "M") + (50 + Math.cos(a) * r + j(i)).toFixed(1) + " " + (53 + Math.sin(a) * r + j(i + 20)).toFixed(1);
  }
  return d + " Z";
}
// ---------------- skins & wallet ----------------
const SHOP = [
  { id: "x_classic", kind: "xShape", price: 0 },
  { id: "x_plus", kind: "xShape", price: 100, cur: "clips" },
  { id: "x_star", kind: "xShape", price: 150, cur: "clips" },
  { id: "x_hash", kind: "xShape", price: 150, cur: "clips" },
  { id: "x_skew", kind: "xShape", price: 200, cur: "clips" },
  { id: "x_fire", kind: "xShape", price: 500, cur: "clips" },
  { id: "o_classic", kind: "oShape", price: 0 },
  { id: "o_square", kind: "oShape", price: 100, cur: "clips" },
  { id: "o_diamond", kind: "oShape", price: 120, cur: "clips" },
  { id: "o_pent", kind: "oShape", price: 150, cur: "clips" },
  { id: "o_hex", kind: "oShape", price: 150, cur: "clips" },
  { id: "o_fire", kind: "oShape", price: 500, cur: "clips" },
  { id: "xc_blue", kind: "xColor", price: 0 },
  { id: "xc_purple", kind: "xColor", price: 150, cur: "clips" },
  { id: "xc_graphite", kind: "xColor", price: 150, cur: "clips" },
  { id: "oc_red", kind: "oColor", price: 0 },
  { id: "oc_green", kind: "oColor", price: 150, cur: "clips" },
  { id: "oc_orange", kind: "oColor", price: 150, cur: "clips" },
  { id: "x_neon", kind: "xShape", price: 25, cur: "coins", premium: true, r: "rare" },
  { id: "o_neon", kind: "oShape", price: 25, cur: "coins", premium: true, r: "rare" },
  { id: "x_cosmos", kind: "xShape", price: 35, cur: "coins", premium: true, r: "rare" },
  { id: "o_cosmos", kind: "oShape", price: 35, cur: "coins", premium: true, r: "rare" },
  { id: "x_vostok", kind: "xShape", price: 45, cur: "coins", premium: true, r: "epic" },
  { id: "o_vostok", kind: "oShape", price: 45, cur: "coins", premium: true, r: "epic" },
  { id: "x_samurai", kind: "xShape", price: 60, cur: "coins", premium: true, r: "epic" },
  { id: "o_samurai", kind: "oShape", price: 60, cur: "coins", premium: true, r: "epic" },
  { id: "x_pirate", kind: "xShape", price: 60, cur: "coins", premium: true, r: "epic" },
  { id: "o_pirate", kind: "oShape", price: 60, cur: "coins", premium: true, r: "epic" },
  { id: "x_gold", kind: "xShape", price: 100, cur: "coins", premium: true, r: "legend" },
  { id: "o_gold", kind: "oShape", price: 100, cur: "coins", premium: true, r: "legend" }
];
const CHEST_START = ["x_neon", "o_neon", "x_cosmos", "o_cosmos"];
const CHEST_KING = ["x_neon", "o_neon", "x_cosmos", "o_cosmos", "x_vostok", "o_vostok", "x_samurai", "o_samurai", "x_pirate", "o_pirate", "x_gold", "o_gold"];
const PACKS = [{ coins: 10, stars: 50 }, { coins: 100, stars: 400 }, { coins: 30, stars: 135 }, { coins: 250, stars: 900 },
  { coins: 20, stars: 150, items: CHEST_START, once: "start" }, { coins: 100, stars: 990, items: CHEST_KING, once: "king" }];   // must match worker.js
const EXCHANGE = [[5, 100], [10, 250], [20, 600]];   // coins -> paperclips; bigger packs give more (base 20 per coin)
const REWARD = { x1: 10, x2: 30, x3: 50, c1: 1, c2: 3 };   // paperclips, wins only; beating "Нет" gives both golden marks instead
const DEFAULT_EQUIP = { xShape: "x_classic", oShape: "o_classic", xColor: "xc_blue", oColor: "oc_red" };
function loadProfile() {
  const p = store.get("profile", null) || {};
  return {
    clips: (p.clips != null ? p.clips : p.fives) | 0, coins: p.coins | 0,
    owned: Array.isArray(p.owned) ? p.owned : [], equip: Object.assign({}, DEFAULT_EQUIP, p.equip || {}, { xColor: "xc_blue", oColor: "oc_red" }),
    netLosses: p.netLosses | 0, netCounter: p.netCounter | 0, netBeaten: !!p.netBeaten,
    cc: p.cc || {}, cnext: p.cnext || {}, bonus: Array.isArray(p.bonus) ? p.bonus : [],
    streak: p.streak && typeof p.streak === "object" ? p.streak : { last: "", n: 0 },
    packs: Array.isArray(p.packs) ? p.packs : []
  };
}
let profile = loadProfile(), skinRev = 0;
const saveProfile = () => store.set("profile", profile);
async function apiCall(path, body) {
  const r = await fetch(API_BASE + path, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.assign({}, authBody(), body || {})) });
  const j = await r.json().catch(() => ({}));
  return Object.assign({ status: r.status }, j);
}
function refreshWalletViews() {
  if (app.screen === "shop") renderShop();
  else if (isMenuScreen(app.screen)) buildMenu();
}
// server profile is the source of truth when signed in
function applyProfile(p) {
  if (!p || typeof p.coins !== "number") return false;
  profile.coins = p.coins;
  if (typeof p.clips === "number") profile.clips = p.clips;
  if (Array.isArray(p.owned)) profile.owned = [...new Set([...p.owned, ...(p.gold || [])])];
  if (p.equip) profile.equip = Object.assign({}, DEFAULT_EQUIP, p.equip, { xColor: "xc_blue", oColor: "oc_red" });
  if (typeof p.netLosses === "number") profile.netLosses = p.netLosses;
  if (typeof p.netBeaten === "boolean") profile.netBeaten = p.netBeaten;
  if (p.scores && typeof p.scores === "object") { app.scores = p.scores; store.set("scores", app.scores); }
  if (Array.isArray(p.bonus)) profile.bonus = p.bonus;
  if (p.streak && typeof p.streak === "object") profile.streak = p.streak;
  if (Array.isArray(p.packs)) profile.packs = p.packs;
  skinRev++; saveProfile(); refreshWalletViews();
  return true;
}
const accountId = () => TG ? "tg:" + ((TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.id) || "") : (session && session.token ? "s:" + session.token.split(".")[0] : "");
async function syncProfile() {
  if (!serverOn()) return false;
  const uid = accountId(), linked = store.get("linked", "") === uid;
  try {
    await flushPending();
    const p = await apiCall("/api/profile", linked ? spBody() : { ...spBody(), local: {
      clips: profile.clips, owned: profile.owned, equip: profile.equip, scores: app.scores, netLosses: profile.netLosses, netBeaten: profile.netBeaten, bonus: profile.bonus } });
    if (p.status === 401 && !TG) { session = null; store.set("session", null); refreshWalletViews(); return false; }
    if (applyProfile(p)) {
      store.set("linked", uid);
      if (p.ref && !store.get("refShown", false) && !app.linkVisit) { store.set("refShown", true); setTimeout(() => toast(t("refWelcome", p.ref.name || "…")), 1200); }
      return true;
    }
  } catch (e) {}
  return false;
}
// game results go to the server, which counts scores and pays paperclips (with its own limits)
async function sendResult(item, live) {
  try {
    const p = await apiCall("/api/result", item);
    if (p.status === 401 || p.status === 400) return;
    if (!applyProfile(p)) throw new Error("bad");
    if (p.refPaid) toast(t("refPaidToast", p.refPaid));
    if (live && p.capped) {
      const rw = app.mode === "classic" ? $("cBannerReward") : $("bannerReward");
      rw.innerHTML = `<span class="quote">${t("capped")}</span>`;
    }
  } catch (e) {
    const q = store.get("pending", []); q.push(item); store.set("pending", q.slice(-50));
  }
}
async function flushPending() {
  const q = store.get("pending", []);
  if (!q.length) return;
  store.set("pending", []);
  for (const it of q) await sendResult(it, false);
}
function reportResult(r) {
  if (!serverOn() || !app.bot) return;
  sendResult({ bot: app.bot.id, r: r === 3 ? "draw" : r === app.side ? "win" : "lose", undo: !!app.undoUsed,
    ms: app.t0 ? Date.now() - app.t0 : 0, key: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }, true);
}
// ---- "Log in with Telegram" (web/PWA version)
function renderLogin() {
  const box = $("tgLogin");
  if (!box) return;
  if (TG || !API_OK) { box.innerHTML = ""; return; }
  box.innerHTML = session && session.token
    ? `<button class="link-btn" type="button" data-act="logout">${t("logout")}</button>`
    : `<button class="btn small tg-btn" type="button" data-act="login">${ICON_TG}${t("login")}</button><div id="tgWidget" class="tg-widget"></div>`;
}
// ---- player profile card (menu)
const ICON_TG = '<svg class="ico-tg" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 4.2 2.9 11.4c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.4 4.6 3.4c.7.5 1.7.1 1.9-.7l3.2-15.1c.2-1.2-.9-2.1-2.1-1.9Z"/></svg>';
const ICON_SOUND = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>${on ? '<path d="M15.5 9c1.2 1.6 1.2 4.4 0 6M18 6.5c2.6 3 2.6 8 0 11"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/>'}</svg>`;
const SILHOUETTE = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 18 C 64 18 70 30 69 41 C 68 54 60 62 50 62 C 40 62 32 54 31 41 C 30 30 36 18 50 18 Z M 18 92 C 20 74 33 66 50 66 C 67 66 80 74 82 92"/></svg>';
function playerInfo() {
  if (TG) {
    const u = (TG.initDataUnsafe && TG.initDataUnsafe.user) || {};
    const full = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Telegram";
    return { name: full, first: u.first_name || full, user: u.username ? "@" + u.username : "", photo: u.photo_url || "", logged: true };
  }
  if (session && session.token) {
    const nm = session.name || "";
    const full = session.first || nm || "Telegram";
    return { name: full, first: session.fn || full.split(" ")[0], user: session.user ? "@" + session.user : (nm[0] === "@" ? nm : ""), photo: session.photo || "", logged: true };
  }
  return { name: t("guest"), first: t("guest"), user: t("guestSub"), photo: "", logged: false };
}
function renderProfile() { renderCover(); renderMe(); renderSettings(); }
function showLoginWidget() {
  const w = $("tgWidget");
  if (!w || w.childElementCount) return;
  const sc = document.createElement("script");
  sc.async = true; sc.src = "https://telegram.org/js/telegram-widget.js?22";
  sc.setAttribute("data-telegram-login", BOT_NAME);
  sc.setAttribute("data-size", "large");
  sc.setAttribute("data-auth-url", GAME_URL);
  w.appendChild(sc);
  w.insertAdjacentHTML("beforeend", `<p class="shop-hint">${t("loginHint")}</p>`);
}
async function handleLoginReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.get("hash") || !q.get("id") || !q.get("auth_date")) return;
  const tg = {};
  for (const k of ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]) if (q.get(k) != null) tg[k] = q.get(k);
  try { history.replaceState(null, "", GAME_URL); } catch (e) {}
  if (!API_OK || TG) return;
  try {
    const r = await fetch(API_BASE + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tg, ...spBody() }) });
    const j = await r.json();
    if (j.session) { session = { token: j.session, name: j.name, first: [tg.first_name, tg.last_name].filter(Boolean).join(" "), fn: tg.first_name || "", user: tg.username || "", photo: tg.photo_url || "" }; store.set("session", session); refreshWalletViews(); }
  } catch (e) {}
}
function logout() {
  session = null; store.set("session", null); store.set("linked", "");
  refreshWalletViews();
}
const itemOf = id => SHOP.find(s => s.id === id);
const owns = id => { const it = itemOf(id); return !!it && (it.price === 0 || profile.owned.includes(id)); };
const DEF_SKIN = { shape: null, color: null };
function skinOf(p) {
  if (app.bot && p !== app.side) return DEF_SKIN;
  const e = profile.equip;
  return p === 1 ? { shape: e.xShape, color: e.xColor } : { shape: e.oShape, color: e.oColor };
}
function skinClasses(sk) {
  let c = "";
  if (sk.color && sk.color !== "xc_blue" && sk.color !== "oc_red") c += " col-" + sk.color.slice(3);
  if (sk.shape === "x_gold" || sk.shape === "o_gold") c += " gold";
  if (sk.shape === "x_fire" || sk.shape === "o_fire") c += " fire";
  const m = /^[xo]_(neon|cosmos|vostok|samurai|pirate)$/.exec(sk.shape || ""); if (m) c += " " + m[1];
  return c;
}
const jit = (k, i, a) => (seeded(k * 17 + i) - .5) * a;
// hand-drawn "#" grid: 2 vertical + 2 horizontal slightly wobbly pen lines, in a 0..100 box
function gridPaths(k, at, from, to, wob) {
  const out = [];
  [[at[0], 0], [at[1], 1], [at[0], 2], [at[1], 3]].forEach(([p, n], idx) => {
    const v = idx < 2, j = i => jit(k + n, i, wob);
    const a = from + j(1), z = to + j(2), m1 = from + (to - from) * 0.36, m2 = from + (to - from) * 0.7;
    out.push(v ? `M${(p + j(3)).toFixed(1)} ${a.toFixed(1)} C${(p + j(4)).toFixed(1)} ${m1.toFixed(1)} ${(p + j(5)).toFixed(1)} ${m2.toFixed(1)} ${(p + j(6)).toFixed(1)} ${z.toFixed(1)}`
               : `M${a.toFixed(1)} ${(p + j(3)).toFixed(1)} C${m1.toFixed(1)} ${(p + j(4)).toFixed(1)} ${m2.toFixed(1)} ${(p + j(5)).toFixed(1)} ${z.toFixed(1)} ${(p + j(6)).toFixed(1)}`);
  });
  return out;
}
function gridSVG(cls, k, at, from, to, wob) {
  return `<svg class="hand-grid ${cls}" viewBox="0 0 100 100" aria-hidden="true">` +
    gridPaths(k, at, from, to, wob).map((d, i) => `<path pathLength="1" style="animation-delay:${i * 0.09}s" d="${d}"/>`).join("") + `</svg>`;
}
// a pen stroke through a winning line (slight curve and overshoot), in a 0..size box
function penStroke(A, Z, k, size) {
  const dx = Z[0] - A[0], dy = Z[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const over = size * 0.07, a = [A[0] - ux * over, A[1] - uy * over], z = [Z[0] + ux * over, Z[1] + uy * over];
  const bend = (seeded(k) - .5) * size * 0.06, mx = (a[0] + z[0]) / 2 - uy * bend, my = (a[1] + z[1]) / 2 + ux * bend;
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${z[0].toFixed(1)} ${z[1].toFixed(1)}`;
}
// rough loop around a captured small board, in a 0..100 box
function roughRing(k) {
  const pts = [[5, 7], [50, 3], [95, 6], [97, 50], [94, 95], [50, 97], [6, 94], [3, 50], [7, 9]];
  const p = pts.map(([x, y], i) => [x + jit(k, i, 3), y + jit(k, i + 20, 3)]);
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length; i += 2) d += ` Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${p[i + 1][0].toFixed(1)} ${p[i + 1][1].toFixed(1)}`;
  return d;
}
function polyPath(k, n, r, rot) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = rot + i * 2 * Math.PI / n;
    d += (i ? " L" : "M") + (50 + Math.cos(a) * r + jit(k, i, 4)).toFixed(1) + " " + (52 + Math.sin(a) * r + jit(k, i + 9, 4)).toFixed(1);
  }
  return d + " Z";
}
function shapePaths(p, k, shape) {
  switch (shape) {
    case "x_plus": return [`M${(50 + jit(k, 1, 5)).toFixed(1)} 12 L${(50 + jit(k, 3, 5)).toFixed(1)} 88`, `M12 ${(50 + jit(k, 6, 5)).toFixed(1)} L88 ${(50 + jit(k, 8, 5)).toFixed(1)}`];
    case "x_star": return [90, 30, 150].map((deg, i) => {
      const a = deg * Math.PI / 180, dx = Math.cos(a) * 40, dy = Math.sin(a) * 40;
      return `M${(50 - dx + jit(k, i, 3)).toFixed(1)} ${(50 - dy + jit(k, i + 3, 3)).toFixed(1)} L${(50 + dx + jit(k, i + 6, 3)).toFixed(1)} ${(50 + dy + jit(k, i + 9, 3)).toFixed(1)}`;
    });
    case "x_hash": return [`M${(40 + jit(k, 1, 3)).toFixed(1)} 12 L${(32 + jit(k, 2, 3)).toFixed(1)} 88`, `M${(70 + jit(k, 3, 3)).toFixed(1)} 12 L${(62 + jit(k, 4, 3)).toFixed(1)} 88`,
      `M12 ${(38 + jit(k, 5, 3)).toFixed(1)} L88 ${(35 + jit(k, 6, 3)).toFixed(1)}`, `M12 ${(66 + jit(k, 7, 3)).toFixed(1)} L88 ${(63 + jit(k, 8, 3)).toFixed(1)}`];
    case "x_skew": return [`M${(30 + jit(k, 1, 4)).toFixed(1)} 88 L${(70 + jit(k, 2, 4)).toFixed(1)} 12`, `M16 ${(52 + jit(k, 3, 4)).toFixed(1)} L84 ${(47 + jit(k, 4, 4)).toFixed(1)}`];
    case "o_square": return [polyPath(k, 4, 45, Math.PI / 4)];
    case "o_diamond": return [polyPath(k, 4, 42, -Math.PI / 2)];
    case "o_pent": return [polyPath(k, 5, 42, -Math.PI / 2)];
    case "o_hex": return [polyPath(k, 6, 41, 0)];
    case "x_fire": case "x_neon": return xPaths(k);
    case "o_neon": return [oPath(k)];
    case "x_cosmos": return [...xPaths(k), { d: "M30 52 h.1 M70 46 h.1 M52 26 h.1 M48 76 h.1", c: "star" }];
    case "o_cosmos": return [oPath(k), { d: "M50 50 h.1 M86 22 h.1 M16 84 h.1", c: "star" }, { d: "M8 58 C 30 40, 70 40, 92 46", c: "ring" }];
    case "x_vostok": return [...xPaths(k), { d: "M50 44 L56 50 L50 56 L44 50 Z", c: "gem" }, { d: "M20 20 h.1 M80 80 h.1 M80 20 h.1 M20 80 h.1", c: "dot" }];
    case "o_vostok": return [polyPath(k, 8, 38, Math.PI / 8), { d: "M50 40 L60 50 L50 60 L40 50 Z", c: "gem" }];
    case "x_samurai": return [`M${(20 + jit(k, 1, 3)).toFixed(1)} 18 C 40 40, 58 60, ${(82 + jit(k, 2, 3)).toFixed(1)} 84`, `M${(82 + jit(k, 3, 3)).toFixed(1)} 16 C 62 36, 40 62, ${(18 + jit(k, 4, 3)).toFixed(1)} 86`, { d: "M30 22 L74 78", c: "blade" }];
    case "o_samurai": return ["M62 18 C 30 10, 12 40, 22 66 C 32 90, 72 92, 84 64 C 90 48, 84 32, 72 24", { d: "M47 47 h6 v6 h-6 Z", c: "seal" }];
    case "x_pirate": return ["M24 24 L76 76", "M76 24 L24 76", { d: "M19 23 h.1 M25 17 h.1 M75 83 h.1 M81 77 h.1 M75 17 h.1 M81 23 h.1 M19 77 h.1 M25 83 h.1", c: "knob" }];
    case "o_pirate": return ["M50 22 A 28 28 0 1 1 49.9 22", "M50 30 V70 M30 50 H70 M36 36 L64 64 M64 36 L36 64", { d: "M50 14 V20 M50 80 V86 M14 50 H20 M80 50 H86", c: "handle" }];
    case "o_fire": return [oPath(k)];
    default: return p === 1 ? xPaths(k) : [oPath(k)];
  }
}
const pathsFor = (p, k, star, sk) => { const sh = (sk || skinOf(p)).shape, fire = !star && (sh === "x_fire" || sh === "o_fire"), gold = !star && (sh === "x_gold" || sh === "o_gold");
  const coreSh = fire || /_(neon|pirate|vostok)$/.test(sh || "");
  return (star ? [starPath(k)] : shapePaths(p, k, sh)).map(d => typeof d === "object" ? `<path class="${d.c}" pathLength="1" d="${d.d}"/>` : gold
    ? `<path class="gb" pathLength="1" d="${d}"/><path pathLength="1" d="${d}"/><path class="gg" pathLength="1" d="${d}"/>`        // gold bar: dark edge, metal, running glint
    : `<path pathLength="1" d="${d}"/>` + (coreSh ? `<path class="core" pathLength="1" d="${d}"/>` : "")).join(""); };
function markSVG(p, k, cls, star, sk) {
  sk = sk || skinOf(p);
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="mark ${p === 1 ? "x" : "o"}${star ? " is-star" : ""}${skinClasses(sk)} ${cls || ""}">${pathsFor(p, k, star, sk)}</svg>`;
}
function setTurnMark(el, p, star) {
  if (!p) { el.innerHTML = ""; return; }
  const sk = skinOf(p);
  el.innerHTML = pathsFor(p, 999, star, sk);
  el.setAttribute("class", `mark ${p === 1 ? "x" : "o"}${star ? " is-star" : ""}${skinClasses(sk)}`);
}
const dots = '<span class="thinking" aria-hidden="true"><i></i><i></i><i></i></span>';

// ---------------- DOM building ----------------
const boardEl = $("board"), mainEl = $("mainBoard");
const subEls = [], cellEls = [], slotEls = [], mcellEls = [], pCells = [], cCells = [];
function buildDOM() {
  let h = "";
  for (let b = 0; b < 9; b++) {
    h += `<div class="sub" data-b="${b}" role="rowgroup"><span class="sub-num">${b + 1}</span>`;
    for (let c = 0; c < 9; c++) { const i = b * 9 + c; h += `<button class="cell" type="button" data-i="${i}" id="cell-${i}"></button>`; }
    h += `<div class="overlay-slot"></div></div>`;
  }
  boardEl.innerHTML = h;
  boardEl.querySelectorAll(".sub").forEach((s, b) => { subEls[b] = s; slotEls[b] = s.querySelector(".overlay-slot"); });
  boardEl.querySelectorAll(".cell").forEach(el => { cellEls[+el.dataset.i] = el; });
  mainEl.innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="mcell" data-i="${i}"><span class="n">${i + 1}</span></div>`).join("");
  mainEl.querySelectorAll(".mcell").forEach((m, i) => { mcellEls[i] = m; });
  const ttt = pre => Array.from({ length: 9 }, (_, i) => `<button class="tcell" type="button" data-i="${i}" id="${pre}-${i}"></button>`).join("");
  $("preludeGrid").innerHTML = ttt("pc") + gridSVG("g3", 31, [33.3, 66.7], 3, 97, 1.6);
  $("tttBoard").innerHTML = ttt("tc") + gridSVG("g3", 47, [33.3, 66.7], 3, 97, 1.6);
  boardEl.insertAdjacentHTML("beforeend", gridSVG("g9", 63, [33.2, 66.8], 0.6, 99.4, 0.9));
  mainEl.insertAdjacentHTML("beforeend", gridSVG("gm", 71, [33.3, 66.7], 4, 96, 2));
  for (let i = 0; i < 9; i++) { pCells[i] = $("pc-" + i); cCells[i] = $("tc-" + i); }
  $("faceX").innerHTML = markSVG(1, 777, "", false, DEF_SKIN);
  $("faceO").innerHTML = markSVG(2, 778, "", false, DEF_SKIN);
}

// ---------------- menu ----------------
function scoreOf(id) { return app.scores[id] || { me: 0, bot: 0, draw: 0 }; }
// ---------------- menu (v13): cover + sub screens ----------------
const MENU_SCREENS = ["menu", "modex02", "modeclassic", "online", "me", "settings", "about", "shop"];
const ALL_SCREENS = ["menu", "x02", "classic", "shop", "wait", "modex02", "modeclassic", "online", "me", "settings", "about"];
const isMenuScreen = s => MENU_SCREENS.includes(s);
const inGame = () => app.screen === "x02" || app.screen === "classic";
let coverLine = { id: "", text: "" };
let friendsCache = { at: 0, list: [], busy: false, ok: false };
function avatarHTML(info) {
  const initial = (info.name || "?").trim().charAt(0).toUpperCase() || "?";
  return info.photo ? `<img src="${esc(info.photo)}" alt="" referrerpolicy="no-referrer" data-i="${esc(initial)}">`
    : info.logged ? `<span class="pf-initial">${esc(initial)}</span>` : SILHOUETTE;
}
function paintAvatar(el, info) {
  if (!el) return;
  const key = `${info.logged}|${info.photo}|${info.name}`;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  el.classList.toggle("guest", !info.logged);
  el.innerHTML = avatarHTML(info);
  const img = el.querySelector("img");
  if (img) img.addEventListener("error", () => { el.innerHTML = `<span class="pf-initial">${esc(img.dataset.i || "?")}</span>`; }, { once: true });
}
function totals() {
  let w = 0, l = 0, d = 0;
  for (const id of [...BOTS.x02, ...BOTS.classic].map(b => b.id).concat(["fx", "fc"])) { const s = scoreOf(id); w += s.me; l += s.bot; d += s.draw; }
  return { w, l, d };
}
const played = id => { const s = scoreOf(id); return s.me + s.bot + s.draw; };
// the next opponent on a ladder: the weakest bot you have not beaten yet
function nextBot(mode) { const b = BOTS[mode].find(x => scoreOf(x.id).me === 0); return b ? b.id : ""; }
function myTurnGames() { return (ogCache.games || []).filter(g => g.myTurn && g.status !== "waiting"); }
const learnPaid = () => (profile.bonus || []).includes("learn");
const learnDone = () => !!store.get("learnDone", false) || learnPaid();

function coverBanner() {
  const turn = myTurnGames()[0];
  if (turn) return { cls: "turn", ic: "!", text: t("bnTurn", esc(turn.opp ? turn.opp.name : "…")), act: "og:" + turn.id };
  const rs = resumeData();
  if (rs) return { cls: "turn", ic: "▶", text: t("resumeBn", rs.botId ? t("q", bt(rs.botId, "name")) : ""), act: "resume" };
  if (!learnDone()) return { cls: "", ic: "?", text: t("bnLearn"), right: learnPaid() ? "" : "+30", act: "learn" };
  const dy = dailyState();
  if (!dy.won) return { cls: "daily", ic: "🧩", text: t("dailyBn", dailyNo()), right: dy.tries ? t("dailyTries", dy.tries) : t("dailySolve"), act: "daily" };
  if (!TG && API_OK && !(session && session.token)) return { cls: "info", ic: "→", text: t("bnLogin"), act: "login" };
  const tt = totals();
  if (installKind() && !store.get("instAsked", false) && tt.w + tt.l + tt.d >= 3) return { cls: "info", ic: "⌂", text: t("bnHome"), act: "install" };
  return { cls: "info", ic: "+", text: t("bnInvite"), act: "invite" };
}
function renderCover() {
  const info = playerInfo(), w = $("menuWallet");
  w.innerHTML = `<span class="wpill" title="${t("clips")}">${ICON_CLIP}<b>${profile.clips}</b><i class="plus" aria-hidden="true">+</i></span>` +
    `<span class="wpill" title="${t("coins")}">${ICON_COIN}<b>${profile.coins}</b><i class="plus" aria-hidden="true">+</i></span>`;
  w.setAttribute("aria-label", `${t("shop")}: ${profile.clips} ${t("clipsWord", profile.clips)}, ${profile.coins} ${t("coinsWord", profile.coins)}`);
  $("gearBtn").setAttribute("aria-label", t("settings"));
  $("gearBtn").title = t("settings");
  paintAvatar($("cAva"), info);
  $("cName").textContent = info.first || info.name;
  const tot = totals(), fr = friendsCache.list.length;
  renderMedal(); renderSig(); renderLogo(); renderInstallSticker();
  $("cSub").textContent = !info.logged ? "" : [streakNow() ? "🔥 " + streakNow() : "", tot.w ? t("cardWins", tot.w) : ""].filter(Boolean).join(" · ");
  $("cFriends").innerHTML = friendsCache.list.slice(0, 3).map(f => miniAva(f)).join("") + `<span class="pc-plus" aria-hidden="true">+</span>`;
  const bn = coverBanner(), be = $("coverBanner");
  be.hidden = false;
  be.className = "cbanner" + (bn.cls ? " " + bn.cls : "");
  be.dataset.bn = bn.act;
  be.innerHTML = `<span class="cb-ic" aria-hidden="true">${bn.ic}</span><span class="cb-t">${bn.text}</span>${bn.right ? `<b>${bn.right}</b>` : ""}`;
  // the bot on the cover is whoever you play next in X02.0
  const id = nextBot("x02") || "x3";
  if (coverLine.id !== id || coverLine.lang !== lang) {
    const arr = ((t("botTalk") || {})[id] || {}).start || [];
    coverLine = { id, lang, text: arr.length ? arr[(Math.random() * arr.length) | 0] : "" };
  }
  const face = $("coverFace");
  if (face.dataset.k !== id) { face.dataset.k = id; face.innerHTML = faceSVG(id, FACE_IDLE[id] || "idle"); }
  $("coverSay").textContent = coverLine.text;
  $("coverBot").setAttribute("aria-label", t("playVs", t("q", bt(id, "name")), bt(id, "line")));
  const n = myTurnGames().length, badge = $("onlineBadge");
  badge.hidden = !n; badge.textContent = n;
}
function rewardChip(id) {
  if (id === "c3") return `<span class="ln-rw gold">${t("rwGold")}</span>`;
  const n = REWARD[id] || 0;
  return n ? `<span class="ln-rw">+${n}${ICON_CLIP}</span>` : "";
}
function renderLadder(mode) {
  const box = document.querySelector(`.ladder[data-mode="${mode}"]`);
  if (!box) return;
  const nb = nextBot(mode);
  box.innerHTML = [...BOTS[mode]].reverse().map((b, i) => {
    const s = scoreOf(b.id), pl = played(b.id), score = t("scoreMenu", s.me, s.bot, s.draw);
    const done = s.me > 0, next = b.id === nb;
    const line = done ? t("ladDone", score) : next ? t("ladNext") + (pl ? " · " + score : "") : pl ? score : bt(b.id, "line");
    return (i ? '<i class="ln-link" aria-hidden="true"></i>' : "") +
      `<button class="opp lnode${done ? " done" : ""}${next ? " next" : ""}" type="button" data-mode="${mode}" data-bot="${b.id}" aria-label="${t("playVs", t("q", bt(b.id, "name")), bt(b.id, "line"))}">
        <span class="ln-face"><span class="bot-face">${faceSVG(b.id, FACE_IDLE[b.id] || "idle")}</span></span>
        <span class="opp-name">${t("q", bt(b.id, "name"))}</span><span class="opp-line">${line}</span>${rewardChip(b.id)}</button>`;
  }).join("");
  document.querySelector(`.friend-row[data-mode="${mode}"]`).innerHTML =
    `<button class="opp fbtn" type="button" data-mode="${mode}" data-bot=""><span class="opp-name">${t("nearby")}</span></button>` +
    `<button class="opp fbtn opp-link" type="button" data-online="${mode}">${ICON_LINK}<span class="opp-name">${t("byLink")}</span></button>`;
}
function renderBridge() {     // after a few easy wins in Nostalgia, nudge towards the main game
  const cw = BOTS.classic.reduce((a, b) => a + scoreOf(b.id).me, 0);
  const xp = BOTS.x02.reduce((a, b) => a + played(b.id), 0) + played("fx");
  const el = $("bridge");
  el.hidden = !(cw >= 3 && xp < 3);
  if (!el.hidden) el.innerHTML = `<span class="bot-face">${faceSVG("c2", "smug")}</span><span>${t("bridgeText")}</span>`;
}
function renderMe() {
  const info = playerInfo();
  paintAvatar($("pfAva"), info);
  $("pfName").textContent = info.name;
  $("pfSub").textContent = info.user;
  const tot = totals(), none = !(tot.w + tot.l + tot.d);
  $("pfStats").innerHTML = none ? "" : [[tot.w, t("stW")], [tot.l, t("stL")], [tot.d, t("stD")]].map(([n, l]) => `<div class="ms"><b>${n}</b><span>${l}</span></div>`).join("");
  $("pfStats").hidden = none;
  const row = (name, s) => { const pl = s.me + s.bot + s.draw; return `<div class="mbr"><b>${name}</b><span>${pl ? t("scoreMenu", s.me, s.bot, s.draw) : t("notPlayed")}</span></div>`; };
  const fx = scoreOf("fx"), fc = scoreOf("fc");
  $("meBots").innerHTML = none ? `<div class="me-empty"><span>${t("meEmpty")}</span><button class="btn primary small" type="button" data-go="modex02">${t("meFirst")}</button></div>`
    : [...BOTS.x02, ...BOTS.classic].map(b => row(t("q", bt(b.id, "name")), scoreOf(b.id))).join("") +
    row(t("meOnline"), { me: fx.me + fc.me, bot: fx.bot + fc.bot, draw: fx.draw + fc.draw });
  const rf = friendsCache.refs;
  $("refLine").textContent = myId() ? (rf && rf.n ? t("refCount", rf.n, rf.paid) : t("refHint")) : "";
  renderFriends();
}
function renderFriendsTop() {
  const box = $("friendsTop");
  if (!box) return;
  const top = friendsCache.top || [];
  if (!serverOn() || top.length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<p class="lbl">${t("frTopTitle")}</p>` + top.slice(0, 10).map((e, i) =>
    `<div class="ftop${e.me ? " me" : ""}"><b class="ft-n">${i === 0 && e.w ? "👑" : i + 1}</b>${miniAva(e)}<span class="ft-name">${e.me ? t("frTopYou") : esc(e.name || "?")}</span><span class="ft-w">${t("cardWins", e.w)}</span></div>`).join("") +
    `<p class="ft-hint">${t("frTopHint")}</p>`;
}
function renderFriends() {
  renderFriendsTop();
  const box = $("friendsList");
  if (!box) return;
  if (!serverOn()) {
    box.innerHTML = `<p class="empty-note">${t("friendsLogin")}</p>` + (!TG && API_OK ? `<div><button class="btn small tg-btn" type="button" data-act="loginTop">${ICON_TG}${t("login")}</button></div>` : "");
    return;
  }
  const list = friendsCache.list;
  if (!list.length) { box.innerHTML = `<p class="empty-note">${friendsCache.ok ? t("friendsEmpty") : "…"}</p>`; return; }
  const now = Date.now();
  box.innerHTML = list.map(f => {
    const g = f.game, turn = !!(g && g.myTurn), mins = Math.max(0, Math.floor((now - (f.seen || 0)) / 60000));
    const sub = g ? (turn ? t("frTurn") : t("frTheir")) : (mins < 5 ? t("frOnline") : t("ago", mins));
    const score = f.w || f.l || f.d ? ` · ${f.w | 0} : ${f.l | 0}` : "";
    const right = g ? `<button class="btn" type="button" data-og="${esc(g.id)}">${turn ? t("frGo") : t("frOpen")}</button>`
      : f.fid ? `<button class="btn" type="button" data-fplay="${esc(f.fid)}" data-fname="${esc(f.name || "")}">${t("frPlay")}</button>` : "";
    return `<div class="fr${turn ? " turn" : ""}">${miniAva(f)}<span class="fr-id"><span class="fr-name">${esc(f.name || "?")}</span><span class="fr-sub">${sub}${score}</span></span>${right}</div>`;
  }).join("");
}
function fetchFriends(force) {
  if (!serverOn() || friendsCache.busy) return;
  if (!force && Date.now() - friendsCache.at < 20000) return;
  friendsCache.busy = true;
  apiCall("/api/friends", {}).then(r => {
    const ok = Array.isArray(r.friends);
    friendsCache = { at: Date.now(), list: ok ? r.friends : friendsCache.list, busy: false, ok: ok || friendsCache.ok, refs: r.refs || friendsCache.refs, top: Array.isArray(r.top) ? r.top : friendsCache.top };
    if (app.screen === "menu") renderCover(); else if (app.screen === "me") renderMe();
  }).catch(() => { friendsCache.busy = false; friendsCache.at = Date.now(); });
}
function renderSettings() {
  const press = (sel, on) => document.querySelectorAll(sel).forEach(b => b.setAttribute("aria-pressed", String(on(b))));
  press("[data-sound]", b => (b.dataset.sound === "1") === SND.on);
  press("[data-haptics]", b => (b.dataset.haptics === "1") === hapticsOn());
  press("[data-talk]", b => (b.dataset.talk === "1") === talkOn());
  press(".seg[data-side]", b => +b.dataset.side === app.side);
  press(".seg[data-lang]", b => b.dataset.lang === lang);
  const info = playerInfo();
  $("accLine").textContent = info.logged ? t("accTg", info.user || info.name) : (API_OK ? "" : t("guestSub"));
  renderLogin();
  renderInstallRow();
  $("verLine").textContent = t("version", APP_VERSION.indexOf("__") === 0 ? "dev" : APP_VERSION);
}
function renderAbout() {
  $("aboutRules").innerHTML = t("rulesHTML");
  $("aboutBots").innerHTML = [...BOTS.x02, ...BOTS.classic].map(b => `<div class="ab-row"><span class="bot-face">${faceSVG(b.id, FACE_IDLE[b.id] || "idle")}</span><span><b>${t("q", bt(b.id, "name"))}</b><span>${bt(b.id, "line")}</span></span></div>`).join("");
  const lb = `<span>${t("learnBtn")}</span>` + (learnPaid() ? "<span>✓</span>" : "<b>+30</b>");
  $("learnBtnA").innerHTML = lb;
  $("learnBtnX").innerHTML = lb;
}
function buildMenu() {
  renderCover();
  renderLadder("x02"); renderLadder("classic"); renderBridge();
  renderMe(); renderSettings(); renderAbout();
  renderOnlineList();
  fetchFriends();
}
const BACK_SIDE = ["settings", "shop", "me", "about"];
function show(screen) {
  const from = app.screen, prevBg = from && from !== screen ? getComputedStyle(document.body).backgroundImage + "|" + getComputedStyle(document.body).backgroundColor : "";
  if (screen === "menu" && from && from !== "menu") nextAlloma();
  const plan = from && from !== screen ? notebookPlan(from, screen) : null;
  const ov = plan ? notebookOverlays(plan, from, prevBg) : null;
  const go = () => {
    app.screen = screen;
    for (const id of ALL_SCREENS) $("scr-" + id).classList.toggle("active", id === screen);
    document.body.classList.toggle("on-cover", screen === "menu");
    document.body.classList.toggle("on-back", BACK_SIDE.includes(screen));
    try { const c = screen === "menu" || BACK_SIDE.includes(screen) ? "#a8d3f1" : "#f6f7f2"; if (TG && TG.setHeaderColor) TG.setHeaderColor(c); if (TG && TG.setBackgroundColor) TG.setBackgroundColor(c); } catch (e) {}
    window.scrollTo(0, 0);
    tgBack();
    if (screen === "menu" && logoPending) setTimeout(runLogoIntro, plan ? 650 : 200);
    if (plan === "flip-out" || plan === "flip-back") { const el = $("scr-" + screen); el.classList.remove("fx-flip-in"); void el.offsetWidth; el.classList.add("fx-flip-in"); setTimeout(() => el.classList.remove("fx-flip-in"), 700); }
  };
  go();
  if (ov) setTimeout(() => ov.forEach(o => o.remove()), plan === "open" ? 780 : plan === "close" ? 620 : 360);
}
// the notebook moves: the cover opens for play, it turns over for settings/shop/profile/about, closes on the way back
function notebookPlan(from, to) {
  if (reduce() || document.hidden) return null;
  if (from === "menu") return BACK_SIDE.includes(to) ? "flip-out" : "open";
  if (to === "menu") return BACK_SIDE.includes(from) ? "flip-back" : "close";
  return null;
}
function snapScreen(id, cls, bg) {
  const src = $("scr-" + id);
  if (!src) return null;
  const ov = document.createElement("div"), ap = document.createElement("div"), c = src.cloneNode(true);
  ov.className = "fx-cover " + cls;
  if (bg) { const [img, col] = bg.split("|"); ov.style.backgroundImage = img; ov.style.backgroundColor = col; ov.style.backgroundSize = getComputedStyle(document.body).backgroundSize; }
  ap.className = "app";
  c.removeAttribute("id"); c.classList.add("active"); c.classList.remove("fx-flip-in");
  c.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
  ap.appendChild(c); ov.appendChild(ap); document.body.appendChild(ov);
  return ov;
}
function notebookOverlays(plan, from, prevBg) {
  try {
    if (plan === "open") { const o = snapScreen("menu", "is-blue"); if (o) o.classList.add("fx-open"); return o ? [o] : null; }
    if (plan === "flip-out") { const o = snapScreen("menu", "is-blue"); if (o) o.classList.add("fx-flip-out"); return o ? [o] : null; }
    if (plan === "flip-back") { const o = snapScreen(from, "is-blue"); if (o) o.classList.add("fx-flip-out"); return o ? [o] : null; }
    if (plan === "close") {
      renderCover();
      const u = snapScreen(from, "under", prevBg), o = snapScreen("menu", "is-blue");
      if (o) o.classList.add("fx-close");
      return [u, o].filter(Boolean);
    }
  } catch (e) {}
  return null;
}
// menu navigation: a small stack, so "Back" always returns to where you came from
function openScreen(s) {
  if (!s || s === app.screen) return;
  if (s === "shop") { openShop(); return; }
  if (isMenuScreen(app.screen)) app.nav.push(app.screen);
  else app.nav = s === "menu" ? [] : ["menu"];
  if (s === "online") ogCache.at = 0;
  if (s === "me") fetchFriends(true);
  buildMenu();
  show(s);
}
function goBack() {
  const p = app.nav.pop() || "menu";
  buildMenu();
  show(p);
}
function homeHere() { if (isMenuScreen(app.screen)) app.home = app.screen === "shop" ? "menu" : app.screen; }
function anySheet() { return !!document.querySelector("#signSheet:not([hidden])") || !$("rulesSheet").hidden || !$("onlineSheet").hidden || !$("welcomeSheet").hidden || !$("installSheet").hidden || !!document.querySelector("#streakSheet:not([hidden])"); }
function tgBack() {
  if (!TG || !TG.BackButton) return;
  try { if (app.screen === "menu" && !anySheet()) TG.BackButton.hide(); else TG.BackButton.show(); } catch (e) {}
}
function tgInit() {
  if (!TG) return;
  document.documentElement.classList.add("in-tg");
  try { TG.ready(); } catch (e) {}
  try { TG.expand(); } catch (e) {}
  const v = x => { try { return !!(TG.isVersionAtLeast && TG.isVersionAtLeast(x)); } catch (e) { return false; } };
  // full screen on phones: no Telegram header, it looks like a real game
  try { if (v("8.0") && ["android", "ios"].includes(TG.platform)) { TG.requestFullscreen(); if (TG.lockOrientation) TG.lockOrientation(); } } catch (e) {}
  try { if (v("7.7") && TG.disableVerticalSwipes) TG.disableVerticalSwipes(); } catch (e) {}
  try {
    if (v("8.0") && TG.checkHomeScreenStatus) {
      TG.checkHomeScreenStatus(st => { homeStatus = st || ""; try { renderSettings(); if (app.screen === "menu") renderCover(); } catch (e) {} });
      TG.onEvent("homeScreenAdded", () => { homeStatus = "added"; installDone(); try { renderSettings(); renderCover(); } catch (e) {} });
    }
  } catch (e) {}   // a swipe down must not close the game mid-move
  try { if (TG.setHeaderColor) TG.setHeaderColor("#a8d3f1"); if (TG.setBackgroundColor) TG.setBackgroundColor("#a8d3f1"); } catch (e) {}
  try { if (v("7.0") && TG.SettingsButton) { TG.SettingsButton.show(); TG.SettingsButton.onClick(() => { if (inGame() || app.screen === "wait") goMenu(); openScreen("settings"); }); } } catch (e) {}
  try {
    TG.BackButton.onClick(() => {
      if (!$("rulesSheet").hidden) closeRules();
      else if (!$("onlineSheet").hidden) closeOnlineSheet();
      else if (!$("welcomeSheet").hidden) welcomeClose(false);
      else if (!$("installSheet").hidden) closeInstall();
      else if (inGame() || app.screen === "wait") goMenu();
      else if (app.screen !== "menu") goBack();
    });
  } catch (e) {}
  tgBack();
}
// from a game back to where it was started: the ladder, the online screen or the cover
function goMenu() {
  if (app.learn) endLearn();
  cancelBot();
  clearTimeout(slowTimer);
  if (app.online) stopOnline();
  document.body.classList.remove("is-bot");
  uiMode = null;
  const home = isMenuScreen(app.home) && app.home !== "shop" ? app.home : "menu";
  app.nav = home === "menu" ? [] : ["menu"];
  buildMenu();
  show(home);
}
function shareGameInvite() {
  const link = inviteLink(), text = hook() + "\n" + (myId() ? t("inviteRef") : t("inviteGame")), share = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text);
  try { if (TG && TG.openTelegramLink) { TG.openTelegramLink(share); return; } } catch (e) {}
  if (navigator.share) { navigator.share({ text, url: link }).catch(() => {}); return; }
  window.open(share, "_blank", "noopener");
}
function hook() { const h = t("hooks"); return Array.isArray(h) ? h[Math.floor(Math.random() * h.length)] : ""; }
function openSupport() {
  const url = "https://t.me/" + BOT_NAME + "?start=support";
  try { if (TG && TG.openTelegramLink) { TG.openTelegramLink(url); return; } } catch (e) {}
  window.open(url, "_blank", "noopener");
}
async function checkUpdate() {
  toast(t("updating"));
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
    const r = await fetch(location.pathname + "?v=" + Date.now(), { cache: "no-store" });
    const m = /const APP_VERSION = "([^"]+)"/.exec(await r.text());
    if (m && m[1] !== APP_VERSION) { setTimeout(() => location.reload(), 600); return; }
  } catch (e) {}
  toast(t("upToDate"));
}

// ---------------- v14: invitations, victory pictures, chat challenges, install, resume ----------------
const tgv = x => { try { return !!(TG && TG.isVersionAtLeast && TG.isVersionAtLeast(x)); } catch (e) { return false; } };
const DEV = store.get("dev", "") || (() => { const d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); store.set("dev", d); return d; })();
function myId() {
  if (TG) { const u = TG.initDataUnsafe && TG.initDataUnsafe.user; return u && u.id ? String(u.id) : ""; }
  return session && session.token ? session.token.split(".")[0] : "";
}
const inviteLink = () => myId() ? `${BOT_LINK}?startapp=r_${myId()}` : BOT_LINK;
// where this visit came from on the web (in Telegram the signed start_param already carries it)
(function rememberSource() {
  try {
    const q = new URLSearchParams(location.search), r = q.get("r"), ch = q.get("ch");
    if (r && /^\d{1,15}$/.test(r)) store.set("sp", "r_" + r);
    else if (ch && /^[a-z0-9_]{1,20}$/.test(ch)) store.set("sp", "ch_" + ch);
  } catch (e) {}
})();
const spBody = () => ({ dev: DEV, sp: store.get("sp", "") || undefined });
function challengeFromLink() {
  try {
    const sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param;
    if (sp && /^c_\d{1,15}_[xc][235]_[a-z0-9]{4,12}$/.test(sp)) return sp;
  } catch (e) {}
  return "";
}
async function joinChallenge(code) {
  if (!serverOn()) { toast(t("gameLogin")); return; }
  try {
    const v = await apiCall("/api/g/challenge", { code });
    if (v.error === "taken") { toast(t("chTaken", v.by || "")); openScreen("online"); return; }
    if (!v.state) { toast(t("gameGone")); return; }
    enterOnline(v);
  } catch (e) { toast(t("netError")); }
}
// "Play" next to a friend: the bot writes to them with a button into a new game
async function playFriend(fid, name) {
  if (!serverOn()) { toast(t("gameLogin")); return; }
  try {
    const v = await apiCall("/api/g/invite", { fid, mode: "x02", minutes: onlineMinutes, side: store.get("side", 1) === 2 ? 2 : 1 });
    if (!v.id) throw new Error(v.error || "bad");
    homeHere();
    enterOnline(v);
    if (v.sent) toast(t("frCalled", name || "")); else { toast(t("frNotSent")); setTimeout(shareInvite, 400); }
  } catch (e) { toast(t("netError")); }
}
// one polite request, after the first finished game: may the bot write to you ("your move", "a friend is calling")
function askWrite() {
  try {
    const u = TG && TG.initDataUnsafe && TG.initDataUnsafe.user;
    if (!TG || store.get("wa", false) || !tgv("6.9") || !TG.requestWriteAccess || (u && u.allows_write_to_pm)) return;
    store.set("wa", true);
    setTimeout(() => { try { TG.requestWriteAccess(() => {}); } catch (e) {} }, 2500);
  } catch (e) {}
}

// ---- victory picture: drawn on a canvas, shared to a chat or a story
function cardInfoSet(info) {
  app.cardInfo = info;
  for (const id of ["bannerShare", "cBannerShare"]) {
    const el = $(id);
    el.hidden = !info;
    el.innerHTML = !info ? "" : `<button class="btn small primary" type="button" data-act="shareCard">${t("shareWin")}</button>` +
      (TG && tgv("7.8") && TG.shareToStory && serverOn() ? `<button class="btn small" type="button" data-act="shareStory">${t("shareStory")}</button>` : "");
  }
}
// ---- puzzle of the day: the same X02.0 position for everyone, beat the bot from it in as few moves as you can
const DAILY_EPOCH = Date.UTC(2026, 10, 10);
function dailyNo() { return Math.floor((Date.now() + 5 * 3600000 - DAILY_EPOCH) / 86400000) + 1; }
function dailyState() { const d = store.get("daily", null); return d && d.no === dailyNo() ? d : { no: dailyNo(), tries: 0, won: false }; }
function dailyPosition(no, side) {        // generated for X; an O player gets the same position with the colours swapped
  const g = dailyPositionX(no);
  if (side === 2) { const sw = v => v === 1 ? 2 : v === 2 ? 1 : v; g.cells = g.cells.map(sw); g.owner = g.owner.map(sw); g.turn = 2; g.stars = [g.stars[0], g.stars[2], g.stars[1]]; }
  return g;
}
function dailyPositionX(no) {
  const side = 1;
  for (let salt = 0; salt < 50; salt++) {
    let x = (no * 7919 + salt * 104729) >>> 0;
    const rnd = () => { x = (x + 0x6D2B79F5) >>> 0; let z = x; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
    let g = E.newMain(1), placed = 0;
    while (!g.result && (placed < 12 || g.turn !== side || g.choosing)) {
      const acts = E.legal(g).filter(a => a < 81 || a >= 300);
      if (!acts.length || placed > 20) break;
      const a = acts[Math.floor(rnd() * acts.length)];
      g = E.apply(g, a); if (a < 81) placed++;
    }
    if (!g.result && g.turn === side && !g.choosing && g.owner.filter(o => o === 1 || o === 2).length <= 1) { g.log = []; return g; }
  }
  return E.newMain(side);
}
function startDaily() {
  startGame("x02", "x2");
  const g = dailyPosition(dailyNo(), app.side);
  app.daily = { no: dailyNo(), start: g.moves };
  app.history = [{ phase: "main", g }];
  renderX02(null); saveResume(); kickBot();
}
function dailyEnd(r) {
  const d = dailyState(), g = cur() && cur().g;
  d.tries++;
  if (r === app.side && !d.won && g) { d.won = true; d.moves = g.moves - app.daily.start; d.grid = g.owner.slice(); d.side = app.side; }
  store.set("daily", d);
  if (d.won) for (const id of ["bannerShare", "cBannerShare"]) { const el = $(id); el.hidden = false; el.innerHTML = `<button class="btn small primary" type="button" data-act="dailyShare">${t("dailyShareBtn")}</button>`; }
  if (d.won && r === app.side) { const nd = installNudge(); if (nd) $("bannerReward").insertAdjacentHTML("beforeend", nd); }
}
function shareDaily() {
  const d = dailyState();
  if (!d.won) return;
  const em = o => o === d.side ? "🟩" : o === 3 - d.side ? "🟥" : o === 3 ? "⬜" : "▫️";
  const grid = [0, 3, 6].map(i => d.grid.slice(i, i + 3).map(em).join("")).join("\n");
  const link = inviteLink(), text = t("dailyText", d.no, grid, d.moves, d.tries) + "\n" + t("dailyTry");
  const share = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text);
  try { if (TG && TG.openTelegramLink) { TG.openTelegramLink(share); return; } } catch (e) {}
  if (navigator.share) { navigator.share({ text, url: link }).catch(() => {}); return; }
  window.open(share, "_blank", "noopener");
}
function shouldBridge() {        // wins Nostalgia but has never tried the real game
  const sc = id => app.scores[id] || { me: 0, bot: 0, draw: 0 }, sum = ids => ids.reduce((n, id) => n + sc(id).me + sc(id).bot + sc(id).draw, 0);
  const cw = ["c1", "c2", "c3"].reduce((n, id) => n + sc(id).me, 0);
  return cw >= 2 && sum(["x1", "x2", "x3"]) === 0 && (store.get("bridgeShown", 0) | 0) < 3;
}

// ---- the logo on the cover: X and 0 are drawn with the skins you own, a pen writes it once a day and after a new skin
const LOGO_P = { two: "M234 52 C 237 27 279 22 285 47 C 291 71 254 93 231 121 L 293 119", zero: "M364 24 C 392 24 401 62 399 86 C 397 112 382 127 360 125 C 337 123 326 99 328 72 C 330 45 343 25 366 27", ul: "M18 142 C 140 133 300 147 424 137" };
const LOGO_T = { x: [5, 16, 1.15], o: [110, 17, 1.15] };
let logoBusy = false, logoPending = false, logoIdleN = 0;
const logoSvgEl = () => document.querySelector("#scr-menu .logo");
function logoSkinKey() { const e = profile.equip; return [e.xShape, e.xColor, e.oShape, e.oColor, skinRev > 0 ? 1 : 0].slice(0, 4).join("|"); }
function logoSVG() {
  const e = profile.equip, sx = { shape: e.xShape, color: e.xColor }, so = { shape: e.oShape, color: e.oColor };
  const strip = h => h.replace(/ pathLength="1"/g, "");
  const g = (p, sk, k) => { const [tx, ty, sc] = LOGO_T[k]; return `<g class="lg-mark lg-${k} mark ${p === 1 ? "x" : "o"}${skinClasses(sk)}" transform="translate(${tx} ${ty}) scale(${sc})" data-t="${tx},${ty},${sc}"><g class="lg-wig">${strip(pathsFor(p, 7, false, sk))}</g></g>`; };
  return `<title id="logoTitle">X02.0</title><text class="lg-old" x="301" y="4" text-anchor="middle">1.0</text><path class="lg-cross" d="M281 -6 Q300 -9 321 -4"/>` +
    g(1, sx, "x") + g(2, so, "o") +
    `<path class="lg-v lg-2" d="${LOGO_P.two}"/><circle class="lg-dot" cx="315" cy="116" r="7.5"/><path class="lg-v lg-0" d="${LOGO_P.zero}"/><path class="lg-ul" d="${LOGO_P.ul}"/>` +
    `<g class="lg-pen" opacity="0"><path d="M0 0 L-6 -22 L6 -22 Z" fill="#2b3a55"/><rect x="-6" y="-70" width="12" height="48" rx="3" fill="#1f3fa8"/><rect x="-6" y="-70" width="12" height="9" rx="2" fill="#c4362f"/></g>`;
}
function renderLogo() {
  const svg = logoSvgEl();
  if (!svg) return;
  const key = logoSkinKey();
  if (svg.dataset.k === key) return;
  const changed = !!svg.dataset.k || (store.get("logoSkin", "") && store.get("logoSkin", "") !== key);
  svg.setAttribute("viewBox", "0 -30 440 180");
  svg.innerHTML = logoSVG(); svg.dataset.k = key;
  store.set("logoSkin", key);
  const first = store.get("logoDay", "") !== tashDay(0);
  if ((first || changed) && !reduce()) { logoPending = true; if (app.screen === "menu") setTimeout(runLogoIntro, 250); }
}
function runLogoIntro() {
  if (!logoPending || logoBusy || app.screen !== "menu" || document.hidden) return;
  logoPending = false; store.set("logoDay", tashDay(0));
  logoIntro().catch(() => {}).finally(() => { logoBusy = false; });
}
async function logoIntro() {
  const svg = logoSvgEl(); if (!svg) return;
  logoBusy = true;
  const pen = svg.querySelector(".lg-pen"), dot = svg.querySelector(".lg-dot"), old = svg.querySelector(".lg-old"), cross = svg.querySelector(".lg-cross");
  const all = [...svg.querySelectorAll(".lg-mark path, .lg-v, .lg-ul")];
  const len = p => { try { return p.getTotalLength(); } catch (e) { return 100; } };
  all.forEach(p => { const L = len(p); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  const cl = len(cross); cross.style.strokeDasharray = cl; cross.style.strokeDashoffset = cl;
  dot.style.opacity = 0; old.style.opacity = 0;
  const tag = document.querySelector("#scr-menu .tagline"), tagFinal = tag ? tag.innerHTML : "";
  if (tag) tag.innerHTML = "&nbsp;";
  const draw = (paths, ms, tr) => new Promise(res => {
    const main = paths[0], L = len(main), t0 = performance.now();
    pen.setAttribute("opacity", 1);
    const f = now => {
      if (app.screen !== "menu") { paths.forEach(p => { p.style.strokeDashoffset = 0; }); return res(); }
      const k = Math.min(1, (now - t0) / ms);
      paths.forEach(p => { p.style.strokeDashoffset = len(p) * (1 - k); });
      const pt = main.getPointAtLength(L * k), x = tr ? pt.x * tr[2] + tr[0] : pt.x, y = tr ? pt.y * tr[2] + tr[1] : pt.y;
      pen.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(18)`);
      if (k < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  await sleep(250);
  old.style.transition = "opacity .3s"; old.style.opacity = 1; await sleep(350);
  cross.style.transition = "stroke-dashoffset .3s"; cross.style.strokeDashoffset = 0; await sleep(380);
  for (const k of ["x", "o"]) {
    const grp = svg.querySelector(".lg-" + k), tr = grp.dataset.t.split(",").map(Number);
    const mains = [...grp.querySelectorAll("path:not(.core):not(.gb):not(.gg)")];
    SND.play(k === "x" ? "x" : "o", 0.25);
    for (const m of mains) await draw([m, ...[...grp.querySelectorAll("path")].filter(q => q !== m && q.getAttribute("d") === m.getAttribute("d"))], k === "x" ? 230 : 420, tr);
    if (grp.classList.contains("fire")) { try { FX.mark(grp, k === "x" ? 1 : 2); } catch (e) {} }
  }
  await draw([svg.querySelector(".lg-2")], 380);
  dot.style.transition = "opacity .15s"; dot.style.opacity = 1;
  await draw([svg.querySelector(".lg-0")], 420);
  await draw([svg.querySelector(".lg-ul")], 360);
  pen.setAttribute("opacity", 0);
  if (tag && app.screen === "menu") {
    const a = t("taglineA"), w = t("taglineWrong"), b = t("taglineB");
    for (let i = 1; i <= a.length; i += 2) { tag.innerHTML = esc(a.slice(0, i)); await sleep(16); }
    for (let i = 1; i <= w.length; i += 2) { tag.innerHTML = esc(a) + "<br>" + esc(w.slice(0, i)); await sleep(16); }
    await sleep(380);
    tag.innerHTML = esc(a) + "<br><s>" + esc(w) + "</s>"; await sleep(420);
    tag.innerHTML = esc(a) + "<br><s>" + esc(w) + "</s><br><span class=\"lg-fix\">" + esc(b) + "</span>";
    await sleep(2200);
    tag.innerHTML = tagFinal;
  } else if (tag) tag.innerHTML = tagFinal;
}
setInterval(() => {        // now and then the letters come alive
  if (app.screen !== "menu" || document.hidden || logoBusy || reduce()) return;
  const svg = logoSvgEl(); if (!svg) return;
  const acts = [[".lg-x .lg-wig", "lg-wiggle"], [".lg-o .lg-wig", "lg-roll"], [".lg-dot", "lg-hop"]], [sel, cls] = acts[logoIdleN++ % 3];
  const el = svg.querySelector(sel); if (!el) return;
  el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 900);
}, 4200);

// ---- the medallion: one of the great scholars of the land each day, like on the notebook covers
const ALLOMA = [
  { id: "tomaris", n: "Tomaris", y: { ru: "VI в. до н. э.", uz: "mil. avv. VI asr", en: "6th c. BC" }, s: "crown" },
  { id: "spitamen", n: "Spitamen", y: { ru: "? – 328 до н. э.", uz: "? – mil. avv. 328", en: "? – 328 BC" }, s: "bow" },
  { id: "jaloliddin", n: "Jaloliddin Manguberdi", y: "1199–1231", s: "sword" },
  { id: "xorazmiy", n: "Muhammad al-Xorazmiy", y: "783–850", s: "algebra" },
  { id: "fargoniy", n: "Ahmad al-Farg‘oniy", y: "797–865", s: "waves" },
  { id: "beruniy", n: "Abu Rayhon Beruniy", y: "973–1048", s: "globe" },
  { id: "ibnsino", n: "Abu Ali ibn Sino", y: "980–1037", s: "bowl" },
  { id: "ulugbek", n: "Mirzo Ulug‘bek", y: "1394–1449", s: "sextant" },
  { id: "qushchi", n: "Ali Qushchi", y: "1403–1474", s: "dividers" },
  { id: "temur", n: "Amir Temur", y: "1336–1405", s: "knight" },
  { id: "bobur", n: "Zahiriddin Bobur", y: "1483–1530", s: "tree" },
  { id: "pahlavon", n: "Pahlavon Mahmud", y: "1247–1326", s: "belt" },
  { id: "lutfiy", n: "Lutfiy", y: "1366–1465", s: "rose" },
  { id: "navoiy", n: "Alisher Navoiy", y: "1441–1501", s: "quill" },
  { id: "behzod", n: "Kamoliddin Behzod", y: "1455–1535", s: "palette" },
  { id: "uvaysiy", n: "Uvaysiy", y: "1781–1845", s: "ikat" },
  { id: "nodira", n: "Nodira", y: "1792–1842", s: "tulip" },
  { id: "ogahiy", n: "Ogahiy", y: "1809–1874", s: "scroll" },
  { id: "muqimiy", n: "Muqimiy", y: "1850–1903", s: "dutar" },
  { id: "furqat", n: "Furqat", y: "1859–1909", s: "compass" },
  { id: "behbudiy", n: "Mahmudxo‘ja Behbudiy", y: "1875–1919", s: "masks" },
  { id: "fitrat", n: "Abdurauf Fitrat", y: "1886–1938", s: "letters" },
  { id: "qodiriy", n: "Abdulla Qodiriy", y: "1894–1938", s: "book" },
  { id: "cholpon", n: "Cho‘lpon", y: "1897–1938", s: "dawn" },
  { id: "zulfiya", n: "Zulfiya", y: "1915–1996", s: "heart" },
  { id: "buxoriy", n: "Imom al-Buxoriy", y: "810–870", s: "lamp" },
  { id: "termiziy", n: "Imom at-Termiziy", y: "824–892", s: "minaret" },
  { id: "moturidiy", n: "Abu Mansur Moturidiy", y: "870–944", s: "star8" },
  { id: "marginoniy", n: "al-Marg‘inoniy", y: "1123–1197", s: "scales" },
  { id: "kubro", n: "Najmiddin Kubro", y: "1145–1221", s: "staff" },
  { id: "naqshband", n: "Bahouddin Naqshband", y: "1318–1389", s: "rosette" }
];
// symbols for the medallion: drawn in dark gold, no faces
const SYM_ART = {
  crown: `<path d="M24 68 L28 36 L40 52 L50 28 L60 52 L72 36 L76 68 Z" class="f"/><path d="M24 76 H76"/><circle cx="50" cy="26" r="3" class="f"/>`,
  bow: `<path d="M36 18 C 70 34, 70 66, 36 82"/><path d="M36 18 L36 82" class="th"/><path d="M24 50 H80"/><path d="M72 43 L81 50 L72 57"/><path d="M26 45 L22 50 L26 55"/>`,
  sword: `<path d="M46 66 V22 L50 13 L54 22 V66 Z" class="f"/><path d="M34 68 H66"/><path d="M50 68 V82"/><circle cx="50" cy="86" r="4" class="f"/>`,
  algebra: `<text x="50" y="58" class="tx" font-size="40">x²</text><text x="50" y="82" class="tx" font-size="16">1 2 3</text>`,
  waves: `<path d="M50 18 V82" class="th"/><path d="M44 26 H50 M46 36 H50 M44 46 H50 M46 56 H50 M44 66 H50"/><path d="M18 62 Q26 54 34 62 T50 62 T66 62 T82 62"/><path d="M18 74 Q26 66 34 74 T50 74 T66 74 T82 74"/>`,
  globe: `<circle cx="50" cy="50" r="28"/><ellipse cx="50" cy="50" rx="12" ry="28"/><path d="M22 50 H78 M27 36 H73 M27 64 H73"/>`,
  bowl: `<path d="M26 58 H74 C 72 76, 28 76, 26 58 Z" class="f"/><path d="M50 52 C 44 38, 54 26, 66 22 C 66 36, 60 46, 50 52 Z"/><path d="M50 52 L60 32" class="th"/>`,
  sextant: `<path d="M50 24 L26 74 M50 24 L74 74"/><path d="M26 74 A 52 52 0 0 0 74 74"/><path d="M50 24 L56 70"/><circle cx="50" cy="24" r="4" class="f"/><path d="M33 72 L34 77 M42 75 L42 80 M58 75 L58 80 M67 72 L66 77" class="th"/>`,
  dividers: `<circle cx="50" cy="22" r="5" class="f"/><path d="M47 26 L32 80 M53 26 L68 80"/><path d="M38 62 Q50 70 62 62" class="th"/>`,
  knight: `<path d="M34 80 H68 L64 70 C 68 56, 66 40, 56 30 L54 20 L47 29 C 38 31, 30 41, 32 50 L44 50 C 42 57, 39 63, 36 70 Z" class="f"/><circle cx="46" cy="38" r="2.5" fill="#f6e3ad" stroke="none"/>`,
  tree: `<path d="M50 84 V54"/><circle cx="50" cy="38" r="15" class="f"/><circle cx="36" cy="50" r="10" class="f"/><circle cx="64" cy="50" r="10" class="f"/><path d="M38 84 H62"/>`,
  belt: `<path d="M18 46 H82 V56 H18 Z" class="f"/><circle cx="50" cy="51" r="7"/><path d="M46 58 L38 80 M54 58 L62 80"/>`,
  rose: `<circle cx="50" cy="40" r="15"/><path d="M50 40 C 56 40, 56 32, 50 32 C 42 32, 42 46, 50 46 C 60 46, 62 30, 52 27"/><path d="M50 55 V86"/><path d="M50 72 C 40 66, 34 70, 32 74 C 40 78, 46 76, 50 72 Z" class="f"/>`,
  quill: `<path d="M34 66 H62 L58 84 H38 Z" class="f"/><path d="M52 64 C 56 44, 66 28, 80 16 C 76 34, 68 50, 56 64 Z"/><path d="M52 64 L72 26" class="th"/>`,
  palette: `<path d="M50 26 C 28 26, 18 42, 22 58 C 26 74, 46 78, 52 70 C 56 64, 50 60, 56 56 C 62 52, 76 58, 78 46 C 80 34, 66 26, 50 26 Z"/><circle cx="38" cy="42" r="4" class="f"/><circle cx="52" cy="38" r="4" class="f"/><circle cx="64" cy="44" r="4" class="f"/><path d="M60 82 L84 30" class="th"/>`,
  ikat: `<path d="M18 34 L34 24 L50 34 L66 24 L82 34"/><path d="M18 50 L34 40 L50 50 L66 40 L82 50" class="th"/><path d="M18 66 L34 56 L50 66 L66 56 L82 66"/><path d="M34 70 L42 76 L34 82 L26 76 Z M66 70 L74 76 L66 82 L58 76 Z" class="f"/>`,
  tulip: `<path d="M36 28 C 34 50, 40 58, 50 58 C 60 58, 66 50, 64 28 L57 38 L50 24 L43 38 Z" class="f"/><path d="M50 58 V86"/><path d="M50 76 C 42 70, 34 70, 30 64 C 36 64, 46 66, 50 76 Z" class="f"/>`,
  scroll: `<path d="M32 26 H70 V74 H32 Z"/><path d="M28 22 H36 V30 H28 Z M28 70 H36 V78 H28 Z" class="f"/><path d="M40 38 H62 M40 48 H62 M40 58 H56" class="th"/>`,
  dutar: `<ellipse cx="50" cy="68" rx="14" ry="16" class="f"/><path d="M48 14 H52 V54 H48 Z" class="f"/><path d="M44 18 H48 M52 22 H56"/><path d="M47 60 V82 M53 60 V82" stroke="#f6e3ad" stroke-width="1.6"/>`,
  compass: `<circle cx="50" cy="50" r="28"/><path d="M50 28 L57 50 L50 72 L43 50 Z"/><path d="M50 28 L57 50 L43 50 Z" class="f"/><text x="50" y="20" class="tx" font-size="11">N</text>`,
  masks: `<path d="M22 30 H48 V50 C 48 64, 22 64, 22 50 Z"/><path d="M28 40 H32 M38 40 H42 M29 52 Q35 57 41 52" class="th"/><path d="M52 40 H78 V60 C 78 74, 52 74, 52 60 Z" class="f"/><path d="M58 50 H62 M68 50 H72 M59 66 Q65 61 71 66" stroke="#f6e3ad" stroke-width="2.4"/>`,
  letters: `<text x="50" y="64" class="tx" font-size="38">A Б</text><path d="M24 74 H76" class="th"/>`,
  book: `<path d="M20 32 C 34 28, 44 30, 50 36 C 56 30, 66 28, 80 32 V72 C 66 68, 56 70, 50 76 C 44 70, 34 68, 20 72 Z"/><path d="M50 36 V76" class="th"/><path d="M60 30 V52 L64 47 L68 52 V29" class="f"/>`,
  dawn: `<path d="M50 20 L55 40 L74 45 L55 50 L50 70 L45 50 L26 45 L45 40 Z" class="f"/><path d="M18 78 H82" /><circle cx="76" cy="24" r="2.5" class="f"/><circle cx="26" cy="66" r="2" class="f"/>`,
  heart: `<path d="M50 78 C 20 58, 18 36, 32 30 C 42 26, 48 32, 50 38 C 52 32, 58 26, 68 30 C 82 36, 80 58, 50 78 Z" class="f"/>`,
  lamp: `<path d="M22 62 C 28 76, 66 76, 74 60 L84 56 L70 54 C 62 50, 34 50, 22 62 Z" class="f"/><path d="M80 50 C 76 42, 82 36, 84 28 C 88 36, 88 46, 80 50 Z"/><path d="M40 52 C 40 44, 48 42, 50 50" class="th"/>`,
  minaret: `<path d="M44 84 V36 H56 V84 Z" class="f"/><path d="M40 36 H60 L56 28 H44 Z"/><path d="M50 28 V16"/><circle cx="50" cy="14" r="3" class="f"/><path d="M44 52 H56 M44 68 H56" stroke="#f6e3ad" stroke-width="2.4"/><path d="M36 84 H64"/>`,
  star8: `<path d="M30 30 H70 V70 H30 Z"/><path d="M50 22 L78 50 L50 78 L22 50 Z"/><circle cx="50" cy="50" r="8" class="f"/>`,
  scales: `<path d="M50 22 V80 M36 80 H64 M24 34 H76"/><path d="M24 34 L16 56 H32 Z M76 34 L68 56 H84 Z" class="th"/><path d="M16 56 Q24 64 32 56 M68 56 Q76 64 84 56" class="f"/><circle cx="50" cy="20" r="4" class="f"/>`,
  staff: `<path d="M50 86 V26"/><path d="M50 26 C 50 14, 66 14, 66 26 C 66 34, 56 34, 56 28"/><path d="M44 56 H56" class="th"/>`,
  rosette: `<circle cx="50" cy="50" r="28"/><g class="f"><ellipse cx="50" cy="34" rx="5" ry="10"/><ellipse cx="50" cy="66" rx="5" ry="10"/><ellipse cx="34" cy="50" rx="10" ry="5"/><ellipse cx="66" cy="50" rx="10" ry="5"/></g><g class="th"><ellipse cx="50" cy="50" rx="5" ry="16" transform="rotate(45 50 50)"/><ellipse cx="50" cy="50" rx="5" ry="16" transform="rotate(-45 50 50)"/></g><circle cx="50" cy="50" r="4" class="f"/>`
};

// a new scholar every time you come back to the cover: a shuffled round, no repeats until everyone was shown
function allomaRound() {
  const sub = subjectOf(), key = (sub ? sub.k : "-") + ":" + ALLOMA.length;
  let o = store.get("alOrder", null);
  if (!Array.isArray(o) || store.get("alKey", "") !== key) {
    o = ALLOMA.map((a, i) => i);
    if (sub) for (const id of sub.a) { const i = ALLOMA.findIndex(a => a.id === id); if (i >= 0) o.push(i); }   // linked scholars come twice
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    for (let i = 1; i < o.length; i++) if (o[i] === o[i - 1]) { const j = (i + 2) % o.length; [o[i], o[j]] = [o[j], o[i]]; }
    store.set("alOrder", o); store.set("alKey", key); store.set("alPos", 0);
  }
  return o;
}
function allomaToday() { const o = allomaRound(), pos = (store.get("alPos", 0) | 0) % o.length; return ALLOMA[o[pos]] || ALLOMA[0]; }
function nextAlloma() {
  const o = allomaRound(); let pos = (store.get("alPos", 0) | 0) + 1;
  if (pos >= o.length) { store.set("alOrder", null); allomaRound(); pos = 0; }
  store.set("alPos", pos);
  const card = $("medCard"); if (card) card.hidden = true;
  try { renderMedal(); } catch (e) {}
}
const allomaYears = a => typeof a.y === "string" ? a.y : (a.y[lang] || a.y.ru);
function medalFace(a) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="msym">${SYM_ART[a.s] || ""}</svg>`;
}
function renderMedal() {
  const a = allomaToday(), el = $("medFace");
  if (!el) return;
  if (el.dataset.k !== a.id) { el.dataset.k = a.id; el.innerHTML = medalFace(a); }
  $("medName").textContent = a.n; $("medYears").textContent = `(${allomaYears(a)})`;
  $("medBtn").classList.toggle("long", a.n.length > 17);
  const card = $("medCard"), facts = t("allomaFacts") || {};
  if (!card.hidden) card.innerHTML = `<b>${esc(a.n)} <small>${esc(allomaYears(a))}</small></b>${esc(facts[a.id] || "")}`;
}
function toggleMedal() {
  const card = $("medCard");
  if (!card.onclick) card.onclick = () => { card.hidden = true; };
  card.hidden = !card.hidden;
  renderMedal();
}
// ---- the subject on the cover: scholars linked to it show up twice as often in the medallion
const SUBJECTS = [
  { k: "math", n: "Matematika", a: ["xorazmiy", "qushchi", "ulugbek", "beruniy"] },
  { k: "phys", n: "Fizika", a: ["fargoniy", "ulugbek", "beruniy", "qushchi"] },
  { k: "astro", n: "Astronomiya", a: ["fargoniy", "ulugbek", "beruniy", "qushchi"] },
  { k: "bio", n: "Biologiya", a: ["ibnsino", "beruniy"] },
  { k: "chem", n: "Kimyo", a: ["ibnsino", "beruniy"] },
  { k: "geo", n: "Geografiya", a: ["beruniy", "bobur", "furqat", "fargoniy"] },
  { k: "hist", n: "Tarix", a: ["temur", "bobur", "tomaris", "spitamen", "jaloliddin", "ogahiy"] },
  { k: "lit", n: "Adabiyot", a: ["navoiy", "lutfiy", "qodiriy", "cholpon", "zulfiya", "nodira", "uvaysiy"] },
  { k: "lang", n: "Ona tili", a: ["navoiy", "fitrat", "qodiriy", "behbudiy"] },
  { k: "art", n: "Tasviriy san’at", a: ["behzod", "bobur"] },
  { k: "music", n: "Musiqa", a: ["muqimiy", "uvaysiy", "navoiy"] },
  { k: "sport", n: "Jismoniy tarbiya", a: ["pahlavon", "spitamen", "jaloliddin"] },
  { k: "law", n: "Huquq", a: ["marginoniy", "temur"] },
  { k: "rel", n: "Dinshunoslik", a: ["buxoriy", "termiziy", "moturidiy", "kubro", "naqshband"] }
];
const subjectOf = () => { const s = sigData(); return s && SUBJECTS.find(x => x.k === s.subj) || null; };
// ---- the signature on the cover: school, class and name, written in pen
function sigData() { const s = store.get("sig", null); return s && typeof s === "object" ? s : null; }
function renderSig() {
  const s = sigData(), info = playerInfo();
  $("sigSchool").textContent = s ? s.school || "" : "";
  $("sigClass").textContent = s ? s.cls || "" : "";
  $("sigName").textContent = s ? s.name || "" : (info.logged ? info.first || info.name || "" : "");
  const sub = subjectOf();
  $("sigSubj").textContent = sub ? sub.n : "";
  $("sigSubjSuf").hidden = !sub;
  $("sigHint").textContent = s ? "" : t("sigHint");
  $("sigNote").textContent = s && s.note ? s.note : "";
  $("noteHint").textContent = s && !s.note ? t("noteHint") : "";
}
function openSign() {
  const s = sigData() || {}, info = playerInfo();
  let sh = $("signSheet");
  if (!sh) { sh = document.createElement("div"); sh.className = "sheet"; sh.id = "signSheet"; sh.setAttribute("role", "dialog"); document.body.appendChild(sh); }
  const val = v => esc(String(v || ""));
  sh.innerHTML = `<div class="sheet-card sign-card"><h2>${t("sigTitle")}</h2><p>${t("sigSub")}</p>
    <label>${t("sigSchool")}<input id="sgSchool" maxlength="6" inputmode="numeric" value="${val(s.school)}" placeholder="47"></label>
    <label>${t("sigClass")}<input id="sgClass" maxlength="8" value="${val(s.cls)}" placeholder="7 «B»"></label>
    <label>${t("sigName")}<input id="sgName" maxlength="40" value="${val(s.name || (info.logged ? [info.first, ""].join("") || info.name : ""))}" placeholder="${val(t("sigNamePh"))}"></label>
    <label>${t("sigSubject")}<select id="sgSubj"><option value="">${t("sigSubjectNone")}</option>${SUBJECTS.map(x => `<option value="${x.k}"${s.subj === x.k ? " selected" : ""}>${esc(x.n)}</option>`).join("")}</select></label>
    <label>${t("sigNote")}<input id="sgNote" maxlength="60" value="${val(s.note)}" placeholder="${val(t("sigNotePh"))}"></label>
    <p class="sign-tip">${t("sigNoteTip")}</p>
    <p class="sign-err" id="sgErr" hidden>${t("sigNeedName")}</p>
    <button class="btn primary big" type="button" data-act="signSave">${t("sigSave")}${sigData() || (profile.bonus || []).includes("sign") ? "" : " · +" + BONUS.sign}</button>
    <button class="btn big" type="button" data-act="signLater">${t("later")}</button></div>`;
  sh.hidden = false;
  const nm = $("sgName"); nm.addEventListener("input", () => { $("sgErr").hidden = true; });
}
async function saveSign() {
  const v = id => ($(id).value || "").trim().slice(0, 40);
  if (!v("sgName")) { $("sgErr").hidden = false; $("sgName").focus(); return; }
  const first = !sigData(), old = sigData() || {}, note = v("sgNote").slice(0, 60);
  store.set("sig", { school: v("sgSchool").slice(0, 6), cls: v("sgClass").slice(0, 8), name: v("sgName"), subj: $("sgSubj").value || "", note });
  if (note && note !== old.note) sendNote(note);
  if (($("sgSubj").value || "") !== (old.subj || "")) { allomaRound(); renderMedal(); }
  $("signSheet").hidden = true;
  renderSig();
  SND.play("star", 0.35);
  if (first) { const n = await claimBonus("sign"); if (n) toast(t("bonusGot", n)); }
}
async function sendNote(text) {        // the comment line is also a note to the author: the bot forwards it
  if (!serverOn()) return;
  try { const r = await apiCall("/api/note", { text, name: (sigData() || {}).name || "" }); if (r && r.ok) toast(t("noteSent")); else if (r && r.error === "slow") toast(t("noteSlow")); } catch (e) {}
}
function addMultTables() {        // the back of the notebook: a faded multiplication table on top
  for (const id of BACK_SIDE) {
    const sec = $("scr-" + id);
    if (!sec || sec.querySelector(".mtable")) continue;
    let cells = "";
    for (let b = 2; b <= 4; b++) for (let a = 2; a <= 6; a++) cells += `<span>${a}×${b}=${a * b}</span>`;
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = `<div class="mtable-t">KO‘PAYTIRISH JADVALI</div><div class="mtable">${cells}</div>`;
    const bar = sec.querySelector(".sub-bar, .game-bar, header");
    if (bar && bar.nextSibling) sec.insertBefore(wrap, bar.nextSibling); else sec.insertBefore(wrap, sec.firstChild);
  }
}
function dareSet() {        // lost to a bot: dare a friend to do better
  for (const id of ["bannerShare", "cBannerShare"]) {
    const el = $(id); el.hidden = false;
    el.innerHTML = `<button class="btn small primary" type="button" data-act="dare">${t("dareBtn")}</button>`;
  }
}
function shareDare() {
  const link = inviteLink(), text = t("dareText", botQ()), share = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text);
  try { if (TG && TG.openTelegramLink) { TG.openTelegramLink(share); return; } } catch (e) {}
  if (navigator.share) { navigator.share({ text, url: link }).catch(() => {}); return; }
  window.open(share, "_blank", "noopener");
}
function wob(ctx, pts, w, color, k) {         // a hand-drawn line through points
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    ctx.quadraticCurveTo((x0 + x1) / 2 + (seeded(k + i) - .5) * 10, (y0 + y1) / 2 + (seeded(k + i * 7) - .5) * 10, x1, y1);
  }
  ctx.stroke();
}
function drawMark(ctx, p, cx, cy, r, k) {
  if (p === 1) {
    wob(ctx, [[cx - r, cy - r], [cx + r, cy + r]], r * .22, "#1f3fa8", k);
    wob(ctx, [[cx + r, cy - r * .95], [cx - r * .95, cy + r]], r * .22, "#1f3fa8", k + 3);
  } else if (p === 2) {
    ctx.strokeStyle = "#c4362f"; ctx.lineWidth = r * .2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.02, r * .94, seeded(k) * .6, .15, Math.PI * 2 + .35); ctx.stroke();
  }
}
async function drawCard(info) {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  try { await Promise.all([document.fonts.load('700 120px "Caveat"'), document.fonts.load('500 40px "Golos Text"')]); } catch (e) {}
  ctx.fillStyle = "#f6f7f2"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#cfdcea"; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(196,54,47,.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(108, 0); ctx.lineTo(108, H); ctx.stroke();
  const hand = (size) => `700 ${size}px "Caveat", cursive`, body = (size) => `500 ${size}px "Golos Text", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  // logo
  ctx.font = hand(150);
  const parts = [["X", "#1f3fa8"], ["0", "#c4362f"], ["2.0", "#2b3a55"]], widths = parts.map(([s]) => ctx.measureText(s).width);
  let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = "left";
  parts.forEach(([s, col], i) => { ctx.fillStyle = col; ctx.fillText(s, x, 190); x += widths[i]; });
  ctx.textAlign = "center";
  // headline
  ctx.fillStyle = "#2b3a55"; ctx.font = hand(96); ctx.fillText(t("cardWin", ""), W / 2, 330);
  ctx.fillStyle = info.botId === "c3" ? "#c4362f" : "#1f3fa8";
  let size = 130; ctx.font = hand(size);
  while (ctx.measureText(info.opp).width > W - 200 && size > 60) { size -= 6; ctx.font = hand(size); }
  ctx.fillText(info.opp, W / 2, 470);
  ctx.fillStyle = "#6b707a"; ctx.font = body(38);
  ctx.fillText(info.botId === "c3" ? t("cardNetSub") : t("cardMoves", info.moves || 0, info.mode === "classic" ? t("classicName") : "X02.0"), W / 2, 545);
  // the final position: the main board of X02.0 or the 3×3 of Nostalgia
  const B = 520, bx = (W - B) / 2, by = 600, cs = B / 3;
  [[1, 0], [2, 0], [1, 1], [2, 1]].forEach(([i, v], n) => {
    const p = i * cs;
    wob(ctx, v ? [[bx - 10, by + p], [bx + B + 10, by + p]] : [[bx + p, by - 10], [bx + p, by + B + 10]], 7, "#2b3a55", 50 + n * 11);
  });
  const cells = info.cells || [];
  if (!cells.some(v => v === 1 || v === 2)) {        // won before any mark was placed (resign, time): one big mark of the winner instead of an empty board
    ctx.clearRect(bx - 20, by - 20, B + 40, B + 40);
    ctx.fillStyle = "#f6f7f2"; ctx.fillRect(bx - 20, by - 20, B + 40, B + 40);
    drawMark(ctx, info.sym || 1, W / 2, by + B / 2, B * .32, 7);
  }
  for (let i = 0; i < 9; i++) if (cells[i] === 1 || cells[i] === 2) drawMark(ctx, cells[i], bx + cs * (i % 3) + cs / 2, by + cs * ((i / 3) | 0) + cs / 2, cs * .3, i * 5 + 3);
  if (info.line) {
    const a = info.line[0], z = info.line[2], cxy = i => [bx + cs * (i % 3) + cs / 2, by + cs * ((i / 3) | 0) + cs / 2];
    const [x0, y0] = cxy(a), [x1, y1] = cxy(z), dx = (x1 - x0) * .18, dy = (y1 - y0) * .18;
    ctx.globalAlpha = .75; wob(ctx, [[x0 - dx, y0 - dy], [x1 + dx, y1 + dy]], 16, "#c4362f", 99); ctx.globalAlpha = 1;
  }
  // footer
  ctx.fillStyle = "#c4362f"; let fs = 50; ctx.font = hand(fs);
  while (ctx.measureText(t("cardHook")).width > W - 200 && fs > 34) { fs -= 4; ctx.font = hand(fs); }
  ctx.fillText(t("cardHook"), W / 2, 1168);
  ctx.fillStyle = "#2b3a55"; ctx.font = hand(64); ctx.fillText(`${t("cardFoot")}:`, W / 2, 1222);
  ctx.font = body(40); ctx.fillStyle = "#1f3fa8"; ctx.fillText("t.me/xo_version2bot", W / 2, 1275);
  if (info.me) { ctx.fillStyle = "#6b707a"; ctx.font = hand(52); ctx.textAlign = "right"; ctx.fillText("— " + info.me, W - 70, 1112); ctx.textAlign = "center"; }
  return c.toDataURL("image/jpeg", 0.86);
}
let cardBusy = false;
async function shareCard(story) {
  const info = app.cardInfo;
  if (!info || cardBusy) return;
  cardBusy = true;
  toast(t("cardMaking"));
  try {
    const url = await drawCard(info), text = t("cardText", info.opp);
    if (TG && serverOn()) {
      const r = await apiCall("/api/card", { img: url, text });
      if (story && r.url && TG.shareToStory) { TG.shareToStory(r.url, { text: `${text} ${r.play || inviteLink()}`.slice(0, 200) }); return; }
      if (!story && r.prepared && TG.shareMessage && tgv("8.0")) { TG.shareMessage(r.prepared, () => {}); return; }
      TG.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(r.play || inviteLink()) + "&text=" + encodeURIComponent(text));
      return;
    }
    const blob = await (await fetch(url)).blob(), file = new File([blob], "x02-win.jpg", { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${inviteLink()}` }).catch(() => {}); return; }
    const a = document.createElement("a"); a.href = url; a.download = "x02-win.jpg"; document.body.appendChild(a); a.click(); a.remove();
    toast(t("cardSaved"));
  } catch (e) { toast(t("netError")); }
  finally { cardBusy = false; }
}
function cardFromGame(r) {        // a win against a bot: what goes on the picture
  const e = cur(), info = playerInfo();
  if (!app.bot || r !== app.side || !e) return null;
  const base = { opp: t("q", bt(app.bot.id, "name")), botId: app.bot.id, mode: app.mode, me: info.logged ? info.first : "", sym: app.side };
  if (app.mode === "classic") return Object.assign(base, { cells: e.t.b.slice(), line: e.t.line, moves: e.t.b.filter(Boolean).length });
  return Object.assign(base, { cells: e.g.owner.map(o => o === 1 || o === 2 ? o : 0), line: e.g.winLine, moves: e.g.moves });
}

// ---- install / home screen
let deferredInstall = null, homeStatus = "";
window.addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); deferredInstall = ev; try { renderSettings(); } catch (e) {} });
window.addEventListener("appinstalled", () => { deferredInstall = null; installDone(); try { renderSettings(); } catch (e) {} });
function installKind() {
  if (TG) return tgv("8.0") && TG.addToHomeScreen && (homeStatus === "missed" || homeStatus === "unknown") ? "tg" : "";
  try { if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) return ""; } catch (e) {}
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|Instagram|Line\/|Snapchat|; wv\)/.test(ua)) return "inapp";
  if (deferredInstall) return "prompt";
  if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return "ios";
  return "";
}
function doInstall() {
  store.set("instAsked", true);
  const k = installKind();
  if (k === "tg") { try { TG.addToHomeScreen(); } catch (e) {} return; }
  if (k === "prompt" && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; renderSettings(); }); return; }
  const box = $("installBody");
  box.innerHTML = k === "ios" ? `<p>${t("iosSteps")}</p>`
    : `<p>${t("inappSteps")}</p><div class="install-link">${esc(GAME_URL)}</div><div><button class="btn primary" type="button" data-act="copyGame">${t("copyLink")}</button></div>`;
  $("installSheet").hidden = false; tgBack();
}
// ---- the install sticker on the cover: tap it, it falls, Telegram offers to put the game on the home screen (+1 coin)
function renderInstallSticker() {
  const w = $("instWrap"); if (!w) return;
  const em = w.querySelector(".inst-lab em"); if (em && !em.dataset.k) { em.dataset.k = "1"; em.innerHTML = "+1 " + ICON_COIN; }
  const done = !!store.get("instDone", false) || homeStatus === "added", k = installKind();
  w.hidden = !(k || done);
  w.classList.toggle("done", done);
  if (!done) { $("instLab").style.removeProperty("visibility"); $("instTape").classList.remove("torn"); }
}
function installSticker() {
  const lab = $("instLab");
  if (!lab || $("instWrap").classList.contains("done") || lab.dataset.busy) return;
  lab.dataset.busy = "1";
  $("instTape").classList.add("torn");
  const an = reduce() ? null : lab.animate([{ transform: "rotate(-4deg)" }, { transform: "rotate(10deg) translateY(10px)", offset: .25 }, { transform: "rotate(28deg) translate(30px, 420px)", opacity: .9 }], { duration: 850, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
  setTimeout(() => {
    delete lab.dataset.busy;
    doInstall();
    if (installKind() !== "tg") setTimeout(() => { if (!store.get("instDone", false)) { if (an) an.cancel(); $("instTape").classList.remove("torn"); } }, 400);
    else setTimeout(() => { if (!store.get("instDone", false)) { if (an) an.cancel(); $("instTape").classList.remove("torn"); } }, 6000);
  }, reduce() ? 0 : 650);
}
async function installDone() {
  if (store.get("instDone", false)) return;
  store.set("instDone", true);
  renderInstallSticker();
  const n = await claimBonus("install");
  if (n) { toast(t("instGot")); SND.play("coin", 0.4); hapticResult(true); }
}
function installNudge() {        // a good moment (first win, solved puzzle, day 2 of the streak): offer the shortcut once a day
  if (!installKind() || store.get("instDone", false) || store.get("instNudge", "") === tashDay(0)) return "";
  store.set("instNudge", tashDay(0));
  return `<div class="bridge"><span>${t("instNudge")}</span><button class="btn small primary" type="button" data-act="installSticker">${t("instLabT")} · +1 🪙</button></div>`;
}
function closeInstall() { $("installSheet").hidden = true; tgBack(); }
function renderInstallRow() {
  const k = installKind(), row = $("installRow");
  row.hidden = !k;
  if (!k) return;
  $("installLabel").textContent = k === "tg" ? t("homeAdd") : t("installBtn");
  $("installBtn").textContent = k === "tg" ? t("homeAdd") : t("installBtn");
}

// ---- resume: leaving mid-game against a bot (or two players) keeps the game for later
function saveResume() {
  if (app.online || app.learn || !inGame()) return;
  const e = cur();
  if (!e) return;
  const over = app.mode === "classic" ? !!e.t.result : (e.phase === "main" && !!e.g.result);
  store.set("resume", over ? null : { mode: app.mode, botId: app.bot ? app.bot.id : "", side: app.side, history: [e], t0: app.t0 || Date.now(), undoUsed: !!app.undoUsed, daily: app.daily || null });
}
function resumeData() {
  const d = store.get("resume", null);
  return d && d.mode && Array.isArray(d.history) && d.history.length && (d.mode === "classic" ? !!d.history[0].t : !!d.history[0].phase) ? d : null;
}
function resumeGame() {
  const d = resumeData();
  if (!d) return;
  if (app.learn) endLearn();
  cancelBot();
  homeHere();
  app.mode = d.mode;
  app.bot = d.botId ? BOTS[d.mode].find(b => b.id === d.botId) || null : null;
  app.side = d.side === 2 ? 2 : 1;
  app.history = d.history;
  app.gameId++; app.t0 = d.t0; app.undoUsed = d.undoUsed; uiMode = null; flash = null; app.daily = d.daily && d.daily.no === dailyNo() ? d.daily : null;
  $("bannerReward").innerHTML = ""; $("cBannerReward").innerHTML = ""; cardInfoSet(null);
  syncTalkClass();
  show(d.mode === "classic" ? "classic" : "x02");
  drawGrids();
  render(null);
  kickBot();
}

// ---------------- newcomer: a gift for the first visit ----------------
const BONUS = { welcome: 20, learn: 30, sign: 20, install: 1 };    // must match worker.js (install pays a coin, the rest paperclips)
function maybeWelcome() {
  if (store.get("welcomed", false)) return;
  const tot = totals();
  if (tot.w + tot.l + tot.d > 0 || (profile.bonus || []).includes("welcome")) { store.set("welcomed", true); return; }
  if (app.screen !== "menu" || anySheet()) return;
  $("welcomeFace").innerHTML = faceSVG("c3", "idle");
  $("welcomeSheet").querySelector(".cover-say").textContent = t("welcomeBot", t("q", bt("c3", "name")));
  $("welcomeSum").innerHTML = `+${BONUS.welcome} ${ICON_CLIP}`;
  $("welcomeSheet").hidden = false;
  tgBack();
}
async function claimBonus(kind) {
  if ((profile.bonus || []).includes(kind)) return 0;
  if (serverOn()) {
    try { const p = await apiCall("/api/bonus", { kind }); if (applyProfile(p)) return p.paid | 0; } catch (e) {}
  }
  if (kind === "install") profile.coins += BONUS.install; else profile.clips += BONUS[kind] || 0;
  profile.bonus = [...(profile.bonus || []), kind];
  saveProfile(); refreshWalletViews();
  return BONUS[kind] || 0;
}
// ---- daily streak: come back every day, the reward grows; day 7 gives a fire skin
const STREAK = [10, 15, 20, 25, 30, 40, 50];
const tashDay = off => new Date(Date.now() + 5 * 3600000 - (off || 0) * 86400000).toISOString().slice(0, 10);
function streakNext() { const st = profile.streak || { last: "", n: 0 }; return st.last === tashDay(1) ? st.n + 1 : 1; }
function streakNow() { const st = profile.streak || { last: "", n: 0 }; return st.last === tashDay(0) || st.last === tashDay(1) ? st.n : 0; }
function maybeStreak() {
  if (!store.get("welcomed", false) || app.learn || app.screen !== "menu" || anySheet()) return;
  if ((profile.streak || {}).last === tashDay(0) || store.get("streakShown", "") === tashDay(0)) return;
  store.set("streakShown", tashDay(0));
  const n = streakNext(), slot = (n - 1) % 7;
  let sh = $("streakSheet");
  if (!sh) { sh = document.createElement("div"); sh.className = "sheet"; sh.id = "streakSheet"; sh.setAttribute("role", "dialog"); document.body.appendChild(sh); }
  const days = STREAK.map((v, i) => `<div class="sd${i < slot ? " got" : i === slot ? " now" : ""}"><span>${t("streakDay", i + 1)}</span><b>${i === 6 ? "🎁" : "+" + v}</b></div>`).join("");
  sh.innerHTML = `<div class="sheet-card streak-card"><h2>🔥 ${t("streakTitle", n)}</h2><p>${t("streakSub")}</p><div class="sdays">${days}</div>
    <button class="btn primary big" type="button" data-act="streakTake">${t("streakTake", STREAK[slot])}</button><button class="btn big" type="button" data-act="streakLater">${t("later")}</button>${n === 2 ? installNudge() : ""}</div>`;
  sh.hidden = false;
}
async function streakTake() {
  const sh = $("streakSheet"); if (sh) sh.hidden = true;
  let paid = 0, gift = "";
  if (serverOn()) { try { const r = await apiCall("/api/streak", {}); if (applyProfile(r)) { paid = r.paid | 0; gift = r.gift || ""; } } catch (e) {} }
  else if ((profile.streak || {}).last !== tashDay(0)) {
    const n = streakNext(), slot = (n - 1) % 7; paid = STREAK[slot];
    if (slot === 6) { gift = ["x_fire", "o_fire"].find(id => !profile.owned.includes(id)) || ""; if (gift) profile.owned.push(gift); else paid += 100; }
    profile.streak = { last: tashDay(0), n }; profile.clips += paid; saveProfile(); refreshWalletViews();
  }
  if (paid) { toast(gift ? t("streakGift", paid, itemName(gift)) : t("bonusGot", paid)); SND.play("coin", 0.4); hapticResult(true); }
  if (app.screen === "menu") renderCover();
}
function welcomeClose(learn) {
  $("welcomeSheet").hidden = true;
  store.set("welcomed", true);
  tgBack();
  claimBonus("welcome").then(n => { if (n) toast(t("bonusGot", n)); });
  if (learn) startLearn();
}

// ---------------- tutorial: 5 short steps on a real board ----------------
const LEARN_ABORT = { abort: true };
let learnSeq = 0;
function learnAlive(id) { if (!app.learn || app.learn.id !== id) throw LEARN_ABORT; }
function mainFrom(spec) {           // a hand-made position for a tutorial step
  const g = E.newMain(spec.turn || 1);
  for (const [p, list] of [[1, spec.x || []], [2, spec.o || []]]) for (const i of list) { g.cells[i] = p; g.filled[(i / 9) | 0]++; }
  for (const i of spec.star || []) g.star[i] = 1;
  for (const [b, p] of spec.owner || []) g.owner[b] = p;
  g.stars = [0, spec.sx || 0, spec.so || 0];
  g.active = spec.active == null ? -1 : spec.active;
  return g;
}
function learnCard(step, html, buttons) {
  const c = $("learnCard");
  c.hidden = false;
  c.innerHTML = `<div class="lc-step">${t("learnStep", step)}</div><div class="lc-text">${html}</div>
    <div class="lc-actions">${buttons || ""}<button class="link-btn" type="button" data-act="learnExit">${t("learnExit")}</button></div>`;
}
function learnMark(els) {
  document.querySelectorAll(".learn-target").forEach(el => el.classList.remove("learn-target"));
  const list = (els || []).filter(Boolean);
  list.forEach(el => el.classList.add("learn-target"));
  const el = list[0];
  if (el && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 20) el.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" });
  }
}
function learnWait(id, allow, btn) {      // waits for one of the allowed moves (or a press on the star / strike button)
  learnAlive(id);
  return new Promise(res => { Object.assign(app.learn, { allow: allow ? new Set(allow) : null, btn: btn || null, done: res }); });
}
function learnNextWait(id) {
  learnAlive(id);
  return new Promise(res => { Object.assign(app.learn, { allow: null, btn: null, next: res }); });
}
function learnResolve(kind, v) {
  const L = app.learn;
  if (!L) return;
  if (kind === "next" && L.next) { const f = L.next; L.next = null; f(v); }
  else if (kind === "move" && L.done) { const f = L.done; Object.assign(L, { done: null, allow: null, btn: null }); f(v); }
}
const learnAllows = a => !!(app.learn && app.learn.allow && app.learn.allow.has(a));
async function learnBot(id, a) {
  learnAlive(id);
  setFace("think", true);
  await sleep(950);
  learnAlive(id);
  setFace(null);
  await doMain(a);
  learnAlive(id);
}
async function learnScript(id) {
  const next = `<button class="btn primary small" type="button" data-act="learnNext">${t("learnNext")}</button>`;
  const push = spec => { app.history.push({ phase: "main", g: mainFrom(spec) }); renderX02(null); };
  // 1. warm-up: win a small 3×3
  learnCard(1, t("l1a")); learnMark([pCells[8]]);
  await learnWait(id, [8]);
  learnMark([]); learnCard(1, t("l1b"), next);
  await learnNextWait(id);
  // 2. the cell decides the board
  push({ turn: 2, sx: 1 });
  learnCard(2, t("l2a")); learnMark([]);
  await sleep(1300);
  await learnBot(id, 38);
  learnCard(2, t("l2b")); learnMark([cellEls[22]]);
  await learnWait(id, [22]);
  learnMark([]);
  await learnBot(id, 36);
  learnCard(2, t("l2c"), next);
  await learnNextWait(id);
  // 3. three in a row wins a small board: a star for you, a free move for the loser
  push({ turn: 1, sx: 1, x: [22, 54, 58, 13], o: [38, 36, 60, 70, 12], active: 6 });
  learnCard(3, t("l3a")); learnMark([cellEls[62]]);
  await learnWait(id, [62]);
  learnMark([]); learnCard(3, t("l3b"));
  await sleep(2200);
  await learnBot(id, 40);
  learnMark([]);
  const paid = await claimBonus("learn");
  learnAlive(id);
  store.set("learnDone", true);
  learnCard(3, t("l6") + (paid ? `<div class="lc-reward">${t("bonusGot", paid)}</div>` : `<div class="lc-step">${t("learnAgain")}</div>`),
    `<button class="btn primary small" type="button" data-act="learnPlay">${t("learnPlay", t("q", bt("x1", "name")))}</button><button class="btn small" type="button" data-act="menu">${t("toMenu")}</button>`);
  if (paid) { SND.play("win", 0.4); hapticResult(true); }
}
async function startLearn() {
  if (app.learn) endLearn();
  cancelBot(); clearTimeout(slowTimer);
  if (app.online) stopOnline();
  if (!$("onlineSheet").hidden) closeOnlineSheet();
  if (!$("rulesSheet").hidden) closeRules();
  homeHere();
  const id = ++learnSeq;
  app.learn = { id, prevSide: app.side, allow: null, btn: null, done: null, next: null };
  app.side = 1; app.mode = "x02"; app.bot = BOTS.x02[0]; app.gameId++;
  uiMode = null; flash = null; app.undoUsed = false; app.chance = false;
  $("bannerReward").innerHTML = ""; $("banner").classList.remove("show");
  document.body.classList.remove("is-bot");
  document.querySelectorAll(".phrases").forEach(el => { el.hidden = true; });
  for (const b of ["bubble", "cBubble"]) $(b).hidden = true;
  $("scr-x02").classList.add("in-learn");
  app.history = [{ phase: "prelude", t: { b: [1, 2, 0, 0, 1, 0, 2, 0, 0], turn: 1, result: 0, line: null, last: -1 }, coin: 0, golden: 0, goal: "win" }];
  show("x02");
  document.querySelectorAll(".hand-grid").forEach(gEl => { gEl.classList.remove("drawn"); void gEl.getBoundingClientRect(); gEl.classList.add("drawn"); });
  renderX02(null);
  try { await learnScript(id); } catch (e) { if (e !== LEARN_ABORT) console.error(e); }
}
function endLearn() {
  const L = app.learn;
  if (!L) return;
  app.learn = null;
  app.side = L.prevSide;
  $("scr-x02").classList.remove("in-learn");
  $("learnCard").hidden = true; $("learnCard").innerHTML = "";
  learnMark([]);
}

// ---------------- game flow ----------------
function newPrelude() {
  const goal = app.bot && app.bot.level > 1 && Math.random() < 0.5 ? "lose" : "win";
  return { phase: "prelude", t: E.newTTT(1), coin: 0, golden: 0, goal };
}
function startGame(mode, botId) {
  if (app.learn) endLearn();
  app.daily = null;
  cancelBot();
  if (app.online) stopOnline();
  app.mode = mode;
  app.bot = botId ? BOTS[mode].find(b => b.id === botId) || null : null;
  app.gameId++;
  uiMode = null; flash = null;
  $("bannerReward").innerHTML = ""; $("cBannerReward").innerHTML = ""; cardInfoSet(null);
  app.undoUsed = false; app.chance = false; app.chanceUsed = false; app.t0 = Date.now();
  // "Нет" gives one chance every 10 games after 1000 losses, until it is beaten once
  // "Попробуй" makes one real mistake every 2–3 games, "Зря" every 5–7
  if (app.bot && (app.bot.id === "c1" || app.bot.id === "c2")) {
    const id = app.bot.id, lo = id === "c1" ? 2 : 5, hi = id === "c1" ? 3 : 7;
    const nextGap = () => lo + Math.floor(Math.random() * (hi - lo + 1));
    if (!profile.cnext[id]) profile.cnext[id] = nextGap();
    profile.cc[id] = (profile.cc[id] || 0) + 1;
    if (profile.cc[id] >= profile.cnext[id]) { app.chance = true; profile.cc[id] = 0; profile.cnext[id] = nextGap(); }
    saveProfile();
  }
  if (app.bot && app.bot.id === "c3" && profile.netLosses >= 1000 && !profile.netBeaten && !(owns("x_gold") && owns("o_gold"))) {
    profile.netCounter++; saveProfile();
    app.chance = profile.netCounter % 10 === 0;
  }
  document.querySelectorAll(".hand-grid").forEach(gEl => { gEl.classList.remove("drawn"); void gEl.getBoundingClientRect(); gEl.classList.add("drawn"); });
  syncTalkClass();
  document.querySelectorAll(".phrases").forEach(el => { el.hidden = true; });
  for (const id of ["bubble", "cBubble"]) $(id).hidden = true;
  if (app.bot) { talkLast = 0; const bot = app.bot, gid = app.gameId; setTimeout(() => { if (app.bot === bot && app.gameId === gid) botSay("start"); }, 700); }
  if (mode === "x02") {
    app.history = [newPrelude()];
    if (app.screen !== "x02") show("x02");
    renderX02(null);
  } else {
    app.history = [{ t: E.newTTT(1) }];
    if (app.screen !== "classic") show("classic");
    renderClassic(null);
  }
  saveResume();
  kickBot();
}
function actorOf(e) {
  if (!e) return -1;
  if (app.mode === "classic") return e.t.result ? -1 : e.t.turn;
  if (e.phase === "prelude") return e.t.result ? 0 : e.t.turn;
  return e.g.result ? -1 : e.g.turn;
}
function render(ctx) { if (app.screen === "x02") renderX02(ctx); else if (app.screen === "classic") renderClassic(ctx); }

function undo() {
  if (app.history.length <= 1 || flipping || inputBusy) return;
  if (app.bot) app.undoUsed = true;   // no reward for a game against a bot after an undo
  cancelBot();
  uiMode = null;
  app.history.pop();
  while (app.history.length > 1 && isBot(actorOf(cur()))) app.history.pop();
  render(null);
  kickBot();
}
function recordResult(r) {
  if (!app.bot || recorded.has(app.gameId)) return;
  recorded.add(app.gameId);
  const s = scoreOf(app.bot.id);
  if (r === 3) s.draw++; else if (r === app.side) s.me++; else s.bot++;
  app.scores[app.bot.id] = s;
  store.set("scores", app.scores);
}
function grantReward(r) {
  if (!app.bot || rewarded.has(app.gameId)) return null;
  rewarded.add(app.gameId);
  if (app.bot.id === "c3" && r !== app.side && r !== 3) { profile.netLosses++; saveProfile(); }
  if (app.undoUsed || r !== app.side) return null;
  if (app.bot.id === "c3") {
    for (const id of ["x_gold", "o_gold"]) if (!profile.owned.includes(id)) profile.owned.push(id);
    profile.netBeaten = true; skinRev++; saveProfile();
    return { gold: true };
  }
  const n = REWARD[app.bot.id] || 0;
  if (n) { profile.clips += n; saveProfile(); }
  return n ? { clips: n } : null;
}
function onGameEnd(r) {
  if (app.learn) return;
  store.set("resume", null);
  cardInfoSet(cardFromGame(r));
  if (app.bot && r !== 3 && r !== app.side) dareSet();
  if (app.daily) dailyEnd(r);
  askWrite();
  recordResult(r);
  clearTimeout(slowTimer);
  if (app.bot) {
    const botWon = r !== 3 && r !== app.side;
    botSay(r === 3 ? "draw" : botWon ? "win" : "lose");
    if (!botWon && r !== 3 && app.bot.id === "c3") botSay("beaten");
  }
  SND.play(r === 3 ? "draw" : (!app.bot || r === app.side) ? "win" : "lose", 0.45);
  if (r !== 3) hapticResult(!app.bot || r === app.side);
  const g = grantReward(r);
  reportResult(r);
  const rw = app.mode === "classic" ? $("cBannerReward") : $("bannerReward");
  rw.innerHTML = !g ? "" : g.gold
    ? `<span class="reward-pop gold-pop">${t("goldWon")}</span><span class="quote">${t("winQuote")}</span>`
    : `<span class="reward-pop">${t("reward", g.clips)} ${curIcon("clips")}</span>`;
  if (app.bot && r === app.side && !app.daily) { const nd = totals().w <= 1 ? installNudge() : ""; if (nd) rw.insertAdjacentHTML("beforeend", nd); }
  if (app.mode === "classic" && app.bot && r === app.side && shouldBridge()) {
    store.set("bridgeShown", (store.get("bridgeShown", 0) | 0) + 1);
    rw.insertAdjacentHTML("beforeend", `<div class="bridge"><span>${t("bridgeText")}</span><button class="btn small primary" type="button" data-act="bridge">${t("bridgeBtn")}</button></div>`);
  }
  renderBars();
  if (r !== 3 && (!app.bot || r === app.side)) setTimeout(() => confetti(r), 650);
  const bEl = app.mode === "classic" ? $("tttBoard") : $("board");
  setTimeout(() => FX.end(r === 3 ? "draw" : (!app.bot || r === app.side) ? "win" : "lose", r, bEl), 380);
}

// ---------------- actions ----------------
async function doMain(a) {
  const e = cur(), g = e.g;
  if (!E.isLegal(g, a)) return false;
  if (a >= 200 && a < 300) { SND.play("strike"); await animateStrike(a - 200); }
  const n = E.apply(g, a);
  uiMode = null;
  app.history.push({ phase: "main", g: n });
  if (a >= 300) SND.play("choose");
  else if (a < 200) SND.play(a >= 100 ? "star" : g.turn === 1 ? "x" : "o");
  const b0 = ((a % 100) / 9) | 0;
  if (a < 300 && g.owner[b0] === 0 && (n.owner[b0] === 1 || n.owner[b0] === 2)) SND.play("capture", 0.25);
  if (app.bot && !n.result && a < 300) {
    const cap = g.owner[b0] === 0 && (n.owner[b0] === 1 || n.owner[b0] === 2);
    if (cap || a >= 200) botSay(isBot(g.turn) ? "good" : "bad", cap ? 0.75 : 0.6);
  }
  renderX02({ prev: g, action: a });
  if (a < 300) {
    const b = ((a % 100) / 9) | 0;
    if (g.owner[b] === 0 && (n.owner[b] === 1 || n.owner[b] === 2)) { flyToMain(b, n.owner[b]); await sleep(800); }
  }
  if (n.result) onGameEnd(n.result); else saveResume();
  return true;
}
function doPrelude(i) {
  const e = cur(), t = E.tttApply(e.t, i);
  if (!t) return false;
  SND.play(e.t.turn === 1 ? "x" : "o");
  if (t.result) SND.play(t.result === 3 ? "draw" : "capture", 0.35);
  if (app.bot && (t.result === 1 || t.result === 2)) botSay(isBot(t.result) ? "good" : "bad", 0.9);
  app.history.push(Object.assign({}, e, { t }));
  renderX02({ prelude: true });
  saveResume();
  return true;
}
function doClassic(i) {
  const t = E.tttApply(cur().t, i);
  if (!t) return false;
  const mover = cur().t.turn;
  SND.play(mover === 1 ? "x" : "o");
  if (app.bot && !t.result && E.LINES.some(l => { const v = l.map(k => t.b[k]); return v.filter(x => x === mover).length === 2 && v.includes(0); }))
    botSay(isBot(mover) ? "good" : "bad", 0.5);
  app.history.push({ t });
  renderClassic({ played: true });
  if (t.result) onGameEnd(t.result); else saveResume();
  return true;
}
function startMainFromPrelude() {
  const e = cur(), t = e.t;
  let g;
  if (t.result === 1 || t.result === 2) g = E.newMain(3 - t.result, { [t.result]: 1 });
  else g = E.newMain(e.coin || 1, e.golden ? { [e.coin]: 1 } : null);
  app.history.push({ phase: "main", g });
  renderX02(null);
  saveResume();
  kickBot();
}

// ---------------- bot runner ----------------
let botJob = 0, activeJob = -1;
let pool = null, poolOK = true, reqSeq = 0;
const pending = new Map();
const POOL_N = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
const WORKER_SRC = () => ENGINE.toString() + `
var E = ENGINE(), keep = null, keepKey = "", keepActs = [];
self.onmessage = function (e) {
  var d = e.data;
  if (d.kind === "basic") { var r = E.think(d.state, d.ms); self.postMessage({ id: d.id, action: r.action }); return; }
  var reuse = null, path = null;
  if (keep && keepKey === d.key && d.acts.length >= keepActs.length) {
    var ok = true;
    for (var i = 0; i < keepActs.length; i++) if (keepActs[i] !== d.acts[i]) { ok = false; break; }
    if (ok) { reuse = keep; path = d.acts.slice(keepActs.length); }
  }
  var s = E.createSearch2(d.state, { seed: d.seed, reuse: reuse, path: path, cap: d.cap });
  s.step(d.ms);
  keep = s.keep(); keepKey = d.key; keepActs = d.acts.slice();
  self.postMessage({ id: d.id, stats: s.stats(), iters: s.iters });
};`;
function makePool() {
  if (!poolOK) return null;
  if (pool) return pool;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SRC()], { type: "text/javascript" }));
    pool = [];
    for (let k = 0; k < POOL_N; k++) {
      const w = new Worker(url);
      w.onmessage = ev => { const f = pending.get(ev.data.id); if (f) { pending.delete(ev.data.id); f(ev.data); } };
      w.onerror = ev => { if (ev && ev.preventDefault) ev.preventDefault(); poolOK = false; killPool(); };
      pool.push(w);
    }
  } catch (err) { poolOK = false; pool = null; }
  return pool;
}
window.X02_DEBUG = () => ({ pool: !!pool, poolOK, workers: POOL_N });
function killPool() {
  if (pool) { for (const w of pool) { try { w.terminate(); } catch (e) {} } pool = null; }
  for (const f of pending.values()) f(null);
  pending.clear();
}
function ask(w, msg, ms) {
  return new Promise(resolve => {
    const id = ++reqSeq;
    msg.id = id;
    pending.set(id, resolve);
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, ms + 8000);
    try { w.postMessage(msg); } catch (e) { pending.delete(id); resolve(null); }
  });
}
function actionsFromLog(log) {
  const out = [];
  for (const e of log) {
    if (e.k === "m") out.push(e.i);
    else if (e.k === "s") out.push(200 + e.i);
    else { out.push(100 + e.i); if (e.to >= 0) out.push(300 + e.to); }
  }
  return out;
}
function mergeStats(list) {
  for (const st of list) if (st.forced >= 0) return st.forced;
  const m = list[0].mover, tot = new Map(), lose = new Set();
  for (const st of list) for (const [a, N, W, proof] of st.kids) {
    if (proof === m) return a;
    if (proof && proof !== 3) lose.add(a);
    tot.set(a, (tot.get(a) || 0) + N);
  }
  let best = -1, bn = -1, any = -1, an = -1;
  for (const [a, n] of tot) { if (n > an) { an = n; any = a; } if (!lose.has(a) && n > bn) { bn = n; best = a; } }
  return best >= 0 ? best : any;
}
async function localSearch(make, ms, job) {
  const s = make(), t0 = Date.now();
  while (!s.done && Date.now() - t0 < ms) {
    if (job !== botJob) return null;
    s.step(18);
    await new Promise(r => setTimeout(r, 0));
  }
  return s.best();
}
// "Лёгкий?" and "Уже нет": the original single-thread search
async function searchMain(g, ms, job) {
  const state = E.cloneLite(g), p = makePool();
  if (p) {
    const r = await ask(p[0], { kind: "basic", state, ms }, ms);
    if (r && r.action !== undefined && r.action !== null) return r.action;
    if (job !== botJob) return null;
  }
  return localSearch(() => E.createSearch(state), ms, job);
}
// "Конец": the strongest search on every available core, with the tree kept between moves
function quickWin(g) {        // a move that ends the game in the bot's favour right now
  for (const a of E.legal(g)) { try { if (E.apply(g, a).result === g.turn) return a; } catch (e) {} }
  return -1;
}
function threatCells(tt, p) {        // empty cells where player p would complete three in a row
  const out = [];
  for (const L of E.LINES) { const v = L.map(i => tt.b[i]); if (v.filter(x => x === p).length === 2 && v.includes(0)) out.push(L[v.indexOf(0)]); }
  return out;
}
async function searchDeep(g, ms, job) {
  const state = E.cloneLite(g), acts = actionsFromLog(g.log), key = String(app.gameId), p = makePool();
  if (p) {
    const res = await Promise.all(p.map((w, k) => ask(w, { kind: "deep", state, ms, acts, key, cap: 220000, seed: (Date.now() ^ (k * 7919 + 13)) | 0 }, ms)));
    if (job !== botJob) return null;
    const ok = res.filter(r => r && r.stats);
    if (ok.length) return mergeStats(ok.map(r => r.stats));
  }
  return localSearch(() => E.createSearch2(state, {}), ms, job);
}
function cancelBot() { botJob++; if (pending.size) killPool(); }
async function kickBot() {
  if (!app.bot || app.learn || !inGame() || activeJob === botJob) return;
  const job = botJob;
  activeJob = job;
  try {
    while (job === botJob) {
      const e = cur();
      if (!e || !isBot(actorOf(e))) break;
      render(null);
      setFace("think", true);
      const t0 = Date.now();
      let a;
      let after = null;
      if (app.mode === "classic") {
        a = -1;
        if (app.chance && !app.chanceUsed) { a = E.tttBlunder(e.t); if (a >= 0) app.chanceUsed = true; }
        if (a < 0) a = E.tttBot(e.t, app.bot.level, "win");
        if (threatCells(e.t, app.side).includes(a)) after = "close";        // blocked your three in a row
      }
      else if (e.phase === "prelude") a = E.tttBot(e.t, app.bot.level, e.goal);
      else {
        const qw = app.bot.deep ? quickWin(e.g) : -1;
        if (qw >= 0) { a = qw; after = "sure"; }        // a grandmaster does not think over a winning move
        else {
          let ms = app.bot.ms;
          if (app.bot.deep) ms = e.g.moves < 6 ? 1800 : 5000;
          if (e.g.choosing) ms = Math.max(350, ms * 0.4);
          const muse = app.bot.deep && ms >= 4000 ? setTimeout(() => { if (job === botJob) botSay("deep", 0.45); }, 2600) : 0;
          a = await (app.bot.deep ? searchDeep : searchMain)(e.g, ms, job);
          clearTimeout(muse);
        }
      }
      const minShow = app.mode === "classic" || e.phase === "prelude" ? 520 : 650;
      const left = minShow - (Date.now() - t0);
      if (left > 0) await sleep(left);
      if (job !== botJob || cur() !== e || a === null || a === undefined) break;
      setFace(null);
      if (app.mode === "classic") doClassic(a);
      else if (e.phase === "prelude") doPrelude(a);
      else await doMain(a);
      if (after) botSay(after, after === "sure" ? 0.9 : 0.7);
    }
  } finally {
    if (activeJob === job) activeJob = -1;
  }
  if (job === botJob) armSlow();
}

// ---------------- animations ----------------
async function animateStrike(i) {
  const el = cellEls[i];
  if (!el || reduce()) return;
  el.classList.add("struck");
  el.insertAdjacentHTML("beforeend", '<svg class="scratch" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M10 18 C 34 40, 62 62, 92 84 M 12 84 C 40 62, 64 40, 90 16"/></svg>');
  await sleep(560);
}
function flyToMain(b, p) {
  if (reduce()) return;
  const src = subEls[b].getBoundingClientRect(), dst = mcellEls[b].getBoundingClientRect();
  if (!src.width || !dst.width || !document.body.animate) return;
  const el = document.createElement("div");
  el.className = "fly " + (p === 1 ? "x" : "o") + skinClasses(skinOf(p));
  Object.assign(el.style, { left: src.left + "px", top: src.top + "px", width: src.width + "px", height: src.height + "px" });
  el.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${pathsFor(p, b + 100)}</svg>`;
  document.body.appendChild(el);
  const dx = dst.left + dst.width / 2 - (src.left + src.width / 2);
  const dy = dst.top + dst.height / 2 - (src.top + src.height / 2);
  const sc = (dst.width * 0.68) / src.width;
  const an = el.animate([
    { transform: "translate(0px, 0px) scale(1) rotate(0deg)", opacity: 0.3 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 80}px) scale(${((1 + sc) / 2) * 1.08}) rotate(-12deg)`, opacity: 0.95, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(0deg)`, opacity: 0 }
  ], { duration: 820, easing: "cubic-bezier(.45,0,.2,1)" });
  const done = () => el.remove();
  an.onfinish = done; an.oncancel = done;
}
function confetti(winner) {
  if (reduce()) return;
  const cv = $("confetti"), ctx = cv.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = { 1: "#1f3fa8", 2: "#c4362f", 3: "#d99a0b" };
  const parts = Array.from({ length: 120 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 2.4, vy: 1.4 + Math.random() * 3,
    r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.22,
    s: 7 + Math.random() * 9,
    k: Math.random() < 0.55 ? winner : (Math.random() < 0.6 ? 3 : 3 - winner)
  }));
  const t0 = performance.now();
  function frame(now) {
    const el = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = el > 2600 ? Math.max(0, 1 - (el - 2600) / 700) : 1;
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.035; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.strokeStyle = ctx.fillStyle = colors[p.k]; ctx.lineWidth = 2.6; ctx.lineCap = "round";
      const s = p.s / 2;
      ctx.beginPath();
      if (p.k === 1) { ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke(); }
      else if (p.k === 2) { ctx.arc(0, 0, s, 0, 6.283); ctx.stroke(); }
      else { for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    if (el < 3300) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}


// ---------------- juice: ink bursts, captures, victory stamp ----------------
const FX = (() => {
  const COL = { 1: "#1f3fa8", 2: "#c4362f", 3: "#d99a0b" };
  let layer = null, combo = { g: null, p: 0, n: 0 };
  const L = () => { if (!layer) { layer = document.createElement("div"); layer.id = "fxLayer"; layer.setAttribute("aria-hidden", "true"); document.body.appendChild(layer); } return layer; };
  const ok = () => !reduce() && document.visibilityState !== "hidden";
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; };
  function drops(x, y, col, n, dist, size) {
    const lay = L();
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i"), a = Math.random() * 6.283, r = dist * (0.45 + Math.random() * 0.75), s = size * (0.5 + Math.random() * 0.8);
      d.className = "fx-drop"; d.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${col}`;
      lay.appendChild(d);
      const an = d.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { opacity: 1, offset: .55 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r + r * 0.25}px)) scale(.2)`, opacity: 0 }],
        { duration: 420 + Math.random() * 320, easing: "cubic-bezier(.15,.7,.3,1)" });
      an.onfinish = () => d.remove();
    }
  }
  function embers(x, y, w) {
    const lay = L();
    for (let i = 0; i < 14; i++) {
      const d = document.createElement("i"), s = Math.max(3, w * (0.06 + Math.random() * 0.08)), dx = (Math.random() - .5) * w * 1.1, up = w * (0.6 + Math.random() * 0.9);
      d.className = "fx-drop"; d.style.cssText = `left:${x + (Math.random() - .5) * w * .5}px;top:${y + w * .15}px;width:${s}px;height:${s}px;background:${["#ffd43b", "#ff922b", "#f03e3e"][i % 3]}`;
      lay.appendChild(d);
      d.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% - ${up * .5}px)) scale(.8)`, opacity: .9 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${up}px)) scale(.1)`, opacity: 0 }], { duration: 650 + Math.random() * 500, easing: "ease-out" }).onfinish = () => d.remove();
    }
  }
  function ring(x, y, col, size) {
    const d = document.createElement("i"); d.className = "fx-ring"; d.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-color:${col}`;
    L().appendChild(d);
    d.animate([{ transform: "translate(-50%,-50%) scale(.3)", opacity: .9 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }], { duration: 520, easing: "ease-out" }).onfinish = () => d.remove();
  }
  function pop(x, y, text, col, big) {
    const d = document.createElement("b"); d.className = "fx-pop" + (big ? " big" : ""); d.textContent = text; d.style.cssText = `left:${x}px;top:${y}px;color:${col}`;
    L().appendChild(d);
    d.animate([{ transform: "translate(-50%,-30%) scale(.4) rotate(-8deg)", opacity: 0 }, { transform: "translate(-50%,-80%) scale(1.15) rotate(-3deg)", opacity: 1, offset: .25 },
      { transform: "translate(-50%,-110%) scale(1) rotate(-3deg)", opacity: 1, offset: .75 }, { transform: "translate(-50%,-150%) scale(.9)", opacity: 0 }], { duration: 1300, easing: "ease-out" }).onfinish = () => d.remove();
  }
  function shake(el, k) { if (el && el.animate) el.animate([{ transform: "none" }, { transform: `translate(${-3 * k}px,${1 * k}px) rotate(${-0.6 * k}deg)` }, { transform: `translate(${3 * k}px,${-1 * k}px) rotate(${0.5 * k}deg)` }, { transform: `translate(${-2 * k}px,0)` }, { transform: "none" }], { duration: 360 }); }
  return {
    mark(el, p) {
      if (!ok() || !el) return; const [x, y, w] = center(el);
      if (el.querySelector(".mark.fire")) { embers(x, y, w); return; }
      drops(x, y, COL[p], 10, w * 0.8, Math.max(5, w * 0.15));
    },
    capture(el, p, boardEl) {
      if (!ok() || !el) return;
      const [x, y, w] = center(el);
      ring(x, y, COL[p], w); drops(x, y, COL[p], 22, w * 0.95, Math.max(5, w * 0.07));
      shake(boardEl, 1.2); haptic("medium");
      if (combo.g !== app.gameId) combo = { g: app.gameId, p: 0, n: 0 };
      combo.n = combo.p === p ? combo.n + 1 : 1; combo.p = p;
      pop(x, y - w * 0.1, combo.n >= 2 ? t("fxCombo", combo.n) : t("fxCapture"), COL[p]);
    },
    end(kind, p, boardEl) {
      if (!ok()) return;
      const lay = L(), W = window.innerWidth, H = window.innerHeight;
      if (kind === "win") {
        const f = document.createElement("i"); f.className = "fx-flash"; lay.appendChild(f);
        f.animate([{ opacity: .75 }, { opacity: 0 }], { duration: 450, easing: "ease-out" }).onfinish = () => f.remove();
        [[.3, .35, 0], [.7, .3, 260], [.5, .55, 520]].forEach(([fx, fy, dl]) => setTimeout(() => { ring(W * fx, H * fy, COL[p], 140); drops(W * fx, H * fy, COL[p], 26, 170, 9); drops(W * fx, H * fy, COL[3], 10, 120, 7); }, dl));
      } else if (kind === "lose") { shake(boardEl, 2.2); if (boardEl && boardEl.animate) boardEl.animate([{ filter: "grayscale(0)" }, { filter: "grayscale(.85)" }, { filter: "grayscale(0)" }], { duration: 1600 }); }
      const st = document.createElement("b"); st.className = "fx-stamp " + kind;
      st.textContent = kind === "win" ? (opp() ? t("fxWin") : t("fxWinSym", SYM[p])) : kind === "lose" ? t("fxLose") : t("fxDraw");
      if (kind === "win") st.style.color = COL[p];
      lay.appendChild(st);
      st.animate([{ transform: "translate(-50%,-50%) scale(3) rotate(-14deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.92) rotate(-8deg)", opacity: 1, offset: .18 },
        { transform: "translate(-50%,-50%) scale(1) rotate(-8deg)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-50%) scale(1) rotate(-8deg)", opacity: 1, offset: .82 }, { transform: "translate(-50%,-50%) scale(1.1) rotate(-8deg)", opacity: 0 }],
        { duration: 1500, easing: "ease-out" }).onfinish = () => st.remove();
    }
  };
})();

// ---------------- coin ----------------
let flipping = false;
function showCoinFace(r) {
  const c = $("coin");
  if (c.getAnimations) c.getAnimations().forEach(an => an.cancel());
  const sh = $("coinShadow");
  if (sh.getAnimations) sh.getAnimations().forEach(an => an.cancel());
  c.style.transform = `rotateX(${r === 2 ? 180 : 0}deg)`;
}
function flipCoin(cb, forced, forcedGolden) {
  if (flipping) return;
  flipping = true;
  const r = forced || (Math.random() < 0.5 ? 1 : 2);
  const golden = forced ? !!forcedGolden : (Math.random() < 0.01 || location.hash === "#gold");   // hidden 1% golden coin
  const c = $("coin"), sh = $("coinShadow");
  const end = 360 * 7 + (r === 2 ? 180 : 0);
  const done = () => {
    flipping = false;
    SND.play(golden ? "win" : "coin");
    if (c.getAnimations) c.getAnimations().forEach(an => an.cancel());
    c.style.transform = `rotateX(${end % 360}deg)`;
    cb(r, golden);
  };
  if (reduce() || !c.animate) { done(); return; }
  SND.play("flip");
  if (c.getAnimations) c.getAnimations().forEach(an => an.cancel());
  const an = c.animate([
    { transform: "translateY(0) rotateX(0deg) rotateZ(0deg) scale(1)", easing: "cubic-bezier(.2,.7,.4,1)" },
    { transform: `translateY(-170px) rotateX(${end * 0.5}deg) rotateZ(5deg) scale(1.18)`, offset: 0.45, easing: "cubic-bezier(.6,0,.8,.4)" },
    { transform: `translateY(0) rotateX(${end - 14}deg) rotateZ(-2deg) scale(1)`, offset: 0.82 },
    { transform: `translateY(-16px) rotateX(${end + 7}deg) rotateZ(1deg) scale(1.02)`, offset: 0.9 },
    { transform: `translateY(0) rotateX(${end - 3}deg) rotateZ(0deg) scale(1)`, offset: 0.96 },
    { transform: `translateY(0) rotateX(${end}deg) rotateZ(0deg) scale(1)` }
  ], { duration: 1900, fill: "forwards" });
  sh.animate([
    { transform: "scale(1)", opacity: 1 },
    { transform: "scale(.5)", opacity: 0.4, offset: 0.45 },
    { transform: "scale(1)", opacity: 1, offset: 0.82 },
    { transform: "scale(.9)", opacity: 0.85, offset: 0.9 },
    { transform: "scale(1)", opacity: 1 }
  ], { duration: 1900, fill: "forwards" });
  an.onfinish = done;
}

// ---------------- render: bars ----------------
function renderBars() {
  const vs = app.online
    ? miniAva(oppCard()) + t("vsBot", sw(SYM[app.side]), botQ())
    : app.bot ? t("vsBot", sw(SYM[app.side]), botQ())
    : t("vsFriend", sw("X"), sw("O"));
  const chip = app.bot ? (() => { const s = scoreOf(app.bot.id); return t("chip", s.me, s.bot, botQ(), s.draw); })() : "";
  for (const [v, c] of [["x02Vs", "x02Score"], ["cVs", "cScore"]]) {
    $(v).innerHTML = vs;
    $(c).hidden = !app.bot;
    $(c).textContent = chip;
  }
  syncFace();
}

// ---------------- render: X02.0 ----------------
function renderX02(ctx) {
  const e = cur();
  if (!e) return;
  const pre = e.phase === "prelude";
  $("scr-x02").classList.toggle("in-prelude", pre);
  $("prelude").hidden = !pre;
  renderBars();
  if (pre) { $("banner").classList.remove("show"); renderPrelude(e, ctx); }
  else renderMain(e.g, ctx);
  document.querySelectorAll('#scr-x02 [data-act="undo"]').forEach(b => { b.disabled = app.history.length <= 1; });
  document.querySelectorAll('#scr-x02 [data-act="resign"]').forEach(b => { b.disabled = !app.online || app.online.status !== "active" || !!(app.online.state && app.online.state.result); });
}

function drawLine(container, line, winner) {
  const k = line ? line.join(",") : "";
  if (container.dataset.line === k) return;
  container.dataset.line = k;
  const old = container.querySelector(".ttt-line");
  if (old) old.remove();
  if (!line) return;
  const pt = i => [(i % 3) * 100 + 50, Math.floor(i / 3) * 100 + 50];
  const d = penStroke(pt(line[0]), pt(line[2]), line[0] * 7 + line[2], 300);
  container.insertAdjacentHTML("beforeend", `<svg class="ttt-line ${winner === 2 ? "o" : "x"}" viewBox="0 0 300 300" aria-hidden="true"><path pathLength="1" d="${d}"/></svg>`);
}
function renderTTTCells(cells, tt, ctx, offset, lockAll) {
  for (let i = 0; i < 9; i++) {
    const el = cells[i], v = tt.b[i];
    const fresh = ctx && tt.last === i;
    const key = v ? `${v}.${skinRev}` : "";
    if (el.dataset.k !== key || fresh) { el.dataset.k = key; el.innerHTML = v ? markSVG(v, offset + i, fresh ? "fresh" : "") : ""; }
    if (fresh && v) FX.mark(el, v);
    el.disabled = !!v || !!tt.result || lockAll;
    el.setAttribute("aria-label", `${t("aTCell")} ${i + 1}: ${v ? SYM[v] : t("aEmpty")}`);
  }
}
function preludeTaunt(e) {
  const r = e.t.result, bs = 3 - app.side, nm = botQ();
  if (r === bs) return t("taunt", nm, e.goal === "lose" ? t("tBotWinLose") : t("tBotWin"));
  if (r === app.side) return t("taunt", nm, e.goal === "lose" ? t("tHumanWinLose") : t("tHumanWin"));
  return t("taunt", nm, t("tDraw"));
}
function starOwnerText(p) { return opp() ? t("starOwner", p === app.side, botQ()) : t("starOwnerSym", SYM[p]); }
function firstText(p) { return opp() ? t("firstMover", p === app.side, botQ()) : t("firstMover", false, SYM[p]); }
function renderPrelude(e, ctx) {
  const tt = e.t, coinMode = tt.result === 3;
  const botTurn = !tt.result && isBot(tt.turn);
  const pr = $("prelude");
  const wasCoin = pr.classList.contains("in-coin");
  pr.classList.toggle("in-coin", coinMode);
  $("coinStage").hidden = !coinMode;
  renderTTTCells(pCells, tt, ctx, 500, botTurn);
  drawLine($("preludeGrid"), tt.line, tt.result);
  // coin
  if (!flipping) showCoinFace(e.coin || 1);
  const online = !!app.online;
  $("coinBtn").hidden = online || !(coinMode && !e.coin);
  $("coinBtn").disabled = flipping;
  $("coinStart").hidden = online || !(coinMode && e.coin);
  const gold = !!(e.coin && e.golden);
  $("coin").classList.toggle("golden", gold && !flipping);
  $("coinText").classList.toggle("golden", gold);
  $("coinText").textContent = flipping ? "…" : e.coin
    ? (gold ? t("coinGolden", SYM[e.coin], firstText(e.coin)) : t("coinResult", SYM[e.coin], firstText(e.coin)))
    : t("coinWho");
  if (coinMode && !wasCoin && !e.coin) setTimeout(() => { try { $("coinBtn").focus(); } catch (err) {} }, 50);
  $("preludeStart").hidden = online || !(tt.result === 1 || tt.result === 2);
  $("preludeSkip").hidden = online || !!tt.result;
  // notes
  setTurnMark($("turnMark"), tt.result ? 0 : tt.turn, false);
  if (tt.result) {
    $("turnWho").textContent = t("warmupOver");
    $("turnWhere").textContent = tt.result === 3 ? (e.coin ? firstText(e.coin) : t("needCoin")) : firstText(3 - tt.result);
  } else {
    $("turnWho").innerHTML = (opp() ? (tt.turn === app.side ? t("yourTurn") : t("thinks", botQ()) + dots) : t("turnOf", SYM[tt.turn]));
    $("turnWhere").textContent = t("warmupSub");
  }
  const st = $("status");
  st.className = "status";
  if (!tt.result) st.textContent = t("warmupHint");
  else if (tt.result === 3) {
    st.textContent = (app.bot ? preludeTaunt(e) + " " : "") + (e.coin ? (gold ? t("golden") : "") : t("noStarsToss"));
  } else {
    const facts = `${starOwnerText(tt.result)}, ${firstText(3 - tt.result)}.`;
    st.textContent = app.bot ? `${preludeTaunt(e)} ${facts[0].toUpperCase() + facts.slice(1)}` : facts[0].toUpperCase() + facts.slice(1);
  }
}

function whereText(g) {
  if (g.result) return "";
  if (g.choosing) return isBot(g.turn) ? t("whereBotChoosing") : t("whereYouChoose");
  const a = E.allowed(g);
  if (g.moves === 0) return t("whereFirst");
  if (g.free) return t("whereFree");
  if (a.length === 1) return t("whereBoard", a[0] + 1);
  return t("whereAny");
}
function statusMain(g) {
  if (flash) return [flash, "warn"];
  const last = g.log[g.log.length - 1];
  if (g.result) {
    const r = g.result, k = E.count(g.owner);
    if (g.secret >= 0) return [t("resSecret", isYou(r), nameOf(r), g.secret + 1), "star"];
    if (r === 3) return [t("resDraw", k[1], k[2]), ""];
    if (g.byCount) return [t("resCount", isYou(r), nameOf(r), k[1], k[2]), ""];
    return [t("resRow", isYou(r), nameOf(r)), ""];
  }
  if (g.choosing) {
    return isBot(g.turn)
      ? [t("botStarChoosing", nameOf(g.turn)), "star"]
      : [t("youStarChoose", opp() ? t("opponentAcc") : SYM[3 - g.turn]), "star"];
  }
  if (uiMode === "star") return [t("starMode"), "star"];
  if (uiMode === "strike") {
    const any = E.legal(g).some(a => a >= 200 && a < 300);
    return any ? [t("strikeMode"), "star"] : [t("strikeNone"), "warn"];
  }
  if (!last) {
    const who = g.turn;
    let m = app.daily ? t("dailyStart") : opp() ? (who === app.side ? t("youStart") : t("botStart", botQ())) : t("symStart", SYM[who]);
    if (g.stars[1] || g.stars[2]) m += t("startStar", g.stars[1] ? "X" : "O");
    return [m, ""];
  }
  const b = (last.i / 9) | 0, c = last.i % 9, p = last.p, o = 3 - p;
  let m;
  const cell = `${b + 1}-${c + 1}`;
  if (last.k === "s") m = t("strikeDone", isYou(p), nameOf(p), cell);
  else if (last.k === "n" && last.to >= 0) m = t("starSent", isYou(p), nameOf(p), isYou(o), objOf(o), last.to + 1);
  else if (last.note === "won") m = t("wonBoard", isYou(p), nameOf(p), b + 1, isYou(o), nameOf(o));
  else if (last.note === "draw") m = t("boardDraw", b + 1);
  else m = t("moved", isYou(p), nameOf(p), cell);
  if (!g.result && E.noRowPossible(g.owner)) { const k = E.count(g.owner); m += t("countMode", k[1], k[2]); }
  return [m, ""];
}
function renderMain(g, ctx) {
  const prev = ctx && ctx.prev;
  const botTurn = !g.result && isBot(g.turn);
  if (g.choosing || g.result || botTurn) uiMode = null;
  if ((uiMode === "star" && g.stars[g.turn] < 1) || (uiMode === "strike" && g.stars[g.turn] < 2)) uiMode = null;
  const allowed = E.allowed(g);
  const legal = new Set(E.legal(g));
  boardEl.classList.toggle("locked", botTurn);
  boardEl.classList.toggle("strike-mode", uiMode === "strike");
  const last = g.log[g.log.length - 1];
  const chose = ctx && ctx.action >= 300;
  for (let b = 0; b < 9; b++) {
    const sub = subEls[b], isAllowed = allowed.includes(b);
    sub.classList.toggle("allowed", isAllowed);
    sub.classList.toggle("target", !!g.choosing && isAllowed);
    sub.classList.toggle("only", isAllowed && allowed.length === 1 && !g.choosing && !g.result);
    sub.classList.toggle("neutral", g.owner[b] === 3);
    const newlyWon = !!prev && prev.owner[b] === 0 && (g.owner[b] === 1 || g.owner[b] === 2);
    sub.classList.remove("won-now", "sent");
    if (newlyWon || (chose && last && last.to === b)) { void sub.offsetWidth; sub.classList.add(newlyWon ? "won-now" : "sent"); }
    if (newlyWon) { const bo = g.owner[b]; setTimeout(() => FX.capture(sub, bo, $("board")), 120); }
    const o = g.owner[b], ov = o === 1 || o === 2 ? `${o}.${skinRev}` : "";
    if (slotEls[b].dataset.o !== ov) {
      slotEls[b].dataset.o = ov;
      slotEls[b].innerHTML = ov ? `<svg class="overlay ${o === 1 ? "x" : "o"}${skinClasses(skinOf(o))}${newlyWon ? " fresh" : ""}" viewBox="0 0 100 100" aria-hidden="true">${pathsFor(o, b + 100)}</svg>`
        + `<svg class="ring ${o === 1 ? "x" : "o"}${newlyWon ? " fresh" : ""}" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="${roughRing(b * 13 + o)}"/></svg>` : "";
    }
    for (let c = 0; c < 9; c++) {
      const i = b * 9 + c, el = cellEls[i], v = g.cells[i];
      const isLast = g.last === i && v !== 0;
      const fresh = !!ctx && !!prev && isLast && (ctx.action % 100) === i && ctx.action < 200;
      const ok = !botTurn && !g.result && (g.choosing ? isAllowed : uiMode === "strike" ? legal.has(200 + i) : (v === 0 && legal.has(i)));
      el.dataset.legal = ok ? "1" : "0";
      el.classList.toggle("last", isLast);
      el.classList.remove("struck");
      const key = v ? `${v}${g.star[i]}.${skinRev}` : "";
      if (el.dataset.k !== key || fresh) { el.dataset.k = key; el.innerHTML = v ? markSVG(v, i + 1, fresh ? "fresh" : "", g.star[i]) : ""; }
      if (fresh && v) FX.mark(el, v);
      el.setAttribute("aria-label", g.choosing
        ? `${t("aBoard")} ${b + 1}${ok ? ": " + t("aSendHere") : ""}`
        : `${t("aBoard")} ${b + 1}, ${t("aCell")} ${c + 1}: ${v ? SYM[v] + (g.star[i] ? ", " + t("aStar") : "") : (ok ? t("aPlayable") : t("aEmpty"))}`);
    }
  }
  // main board
  for (let b = 0; b < 9; b++) {
    const m = mcellEls[b], o = g.owner[b], key = o === 1 || o === 2 ? `${o}.${skinRev}` : "";
    m.classList.toggle("neutral", o === 3);
    if (m.dataset.k !== key) {
      const arrive = !!prev && !!key && prev.owner[b] === 0;
      m.dataset.k = key;
      m.classList.remove("arrive");
      m.innerHTML = `<span class="n">${b + 1}</span>` + (key ? markSVG(o, b + 200, arrive ? "fresh" : "") : "");
      if (arrive) { void m.offsetWidth; m.classList.add("arrive"); }
    }
  }
  const wl = g.winLine ? g.winLine.join(",") : "";
  if (mainEl.dataset.wl !== wl) {
    mainEl.dataset.wl = wl;
    const old = mainEl.querySelector(".strike-line");
    if (old) old.remove();
    if (g.winLine) {
      const pt = i => [(i % 3) * 33.33 + 16.67, Math.floor(i / 3) * 33.33 + 16.67];
      const d = penStroke(pt(g.winLine[0]), pt(g.winLine[2]), g.winLine[0] * 7 + g.winLine[2], 100);
      mainEl.insertAdjacentHTML("beforeend", `<svg class="strike-line ${g.result === 2 ? "o" : "x"}" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="${d}"/></svg>`);
    }
  }
  // turn
  setTurnMark($("turnMark"), g.result ? 0 : g.turn, uiMode === "star");
  $("turnWho").innerHTML = g.result ? t("gameOver")
    : opp() ? (g.turn === app.side ? t("yourTurn") : t("thinks", botQ()) + dots) : t("turnOf", SYM[g.turn]);
  $("turnWhere").textContent = whereText(g);
  // stars
  const canAct = !g.result && !g.choosing && !botTurn;
  const sb = $("starBtn"), kb = $("strikeBtn");
  sb.setAttribute("aria-pressed", String(uiMode === "star"));
  kb.setAttribute("aria-pressed", String(uiMode === "strike"));
  sb.disabled = !canAct || g.stars[g.turn] < 1;
  kb.disabled = !canAct || g.stars[g.turn] < 2;
  const starSpans = p => {
    let h = "";
    for (let k = 0; k < g.stars[p]; k++) h += `<span class="st${prev && k >= prev.stars[p] ? " pop" : ""}">★</span>`;
    return h || "0";
  };
  $("starsCount").innerHTML = `<b class="x">X</b> ${starSpans(1)} · <b class="o">O</b> ${starSpans(2)}`;
  // status
  const [text, cls] = statusMain(g);
  const st = $("status");
  st.className = "status" + (cls ? " " + cls : "");
  st.textContent = text;
  // log
  const log = $("log");
  if (!g.log.length) log.innerHTML = `<li class="empty">${t("noMoves")}</li>`;
  else {
    log.innerHTML = g.log.map((en, n) => {
      const b = (en.i / 9) | 0, c = en.i % 9;
      let note = "";
      if (en.k === "n") note += ` <span class="note s">★${en.to >= 0 ? "→" + (en.to + 1) : ""}</span>`;
      if (en.k === "s") note += ` <span class="note k">${t("logStrike")}</span>`;
      if (en.note === "won") note += ` <span class="note">${t("logBoard", b + 1)}</span>`;
      if (en.note === "draw") note += ` <span class="note">${t("logDraw")}</span>`;
      return `<li><span class="num">${n + 1}.</span><span class="${en.p === 1 ? "px" : "po"}">${SYM[en.p]}</span> ${b + 1}-${c + 1}${note}</li>`;
    }).join("");
    log.scrollTop = log.scrollHeight;
  }
  // banner
  const banner = $("banner");
  if (g.result) {
    const r = g.result, k = E.count(g.owner);
    $("bannerTitle").textContent = g.secret >= 0 ? t("secretTitle")
      : r === 3 ? t("drawTitle")
      : opp() ? (r === app.side ? t("youWon") : t("botWon", app.online ? oppName() : botQ())) : t("symWon", SYM[r]);
    $("bannerTaunt").textContent = app.bot ? t("q", bt(app.bot.id, r === 3 ? "draw" : r === app.side ? "lose" : "win")) : "";
    $("bannerText").textContent = g.secret >= 0
      ? t("secretText", g.secret + 1, SYM[r])
      : g.byCount
        ? (r === 3 ? t("countDrawText", k[1], k[2]) : t("countWinText", k[1], k[2]))
        : t("rowText", g.moves);
    if (!banner.classList.contains("show")) banner.classList.add("show");
  } else if (!(app.online && app.online.ended)) banner.classList.remove("show");
}

// ---------------- render: Ностальгия ----------------
function renderClassic(ctx) {
  const e = cur();
  if (!e) return;
  const tt = e.t, botTurn = !tt.result && isBot(tt.turn);
  renderBars();
  renderTTTCells(cCells, tt, ctx, 600, botTurn);
  drawLine($("tttBoard"), tt.line, tt.result);
  setTurnMark($("cTurnMark"), tt.result ? 0 : tt.turn, false);
  $("cTurnWho").innerHTML = tt.result ? t("gameOver")
    : opp() ? (tt.turn === app.side ? t("yourTurn") : t("thinks", botQ()) + dots) : t("turnOf", SYM[tt.turn]);
  $("cTurnWhere").textContent = tt.result ? "" : t("threeWins");
  const st = $("cStatus");
  st.className = "status";
  const filled = tt.b.filter(Boolean).length;
  st.textContent = tt.result
    ? (tt.result === 3 ? t("classicDraw") : t("threeRow", isYou(tt.result), nameOf(tt.result)))
    : filled === 0 ? (opp() ? (app.side === 1 ? t("youStartShort") : t("botStart", botQ())) : t("xStarts"))
    : app.bot && app.bot.level === 3 ? t("goodLuck") : "";
  document.querySelectorAll('#scr-classic [data-act="undo"]').forEach(b => { b.disabled = app.history.length <= 1; });
  document.querySelectorAll('#scr-classic [data-act="resign"]').forEach(b => { b.disabled = !app.online || app.online.status !== "active" || !!(app.online.state && app.online.state.result); });
  const banner = $("cBanner");
  if (tt.result) {
    const r = tt.result;
    $("cBannerTitle").textContent = r === 3 ? t("drawTitle") : opp() ? (r === app.side ? t("youWon") : t("botWon", app.online ? oppName() : botQ())) : t("symWon", SYM[r]);
    $("cBannerTaunt").textContent = app.bot ? t("q", bt(app.bot.id, r === 3 ? "draw" : r === app.side ? "lose" : "win")) : "";
    if (!banner.classList.contains("show")) banner.classList.add("show");
  } else if (!(app.online && app.online.ended)) banner.classList.remove("show");
}

// ---------------- bots: faces and talk ----------------
const FACE_IDLE = { x2: "smug", c2: "smug" };
const EMO = {
  start: { x1: "happy", x2: "smug", x3: "idle", c1: "happy", c2: "smug", c3: "idle" },
  good: { x1: "happy", x2: "smug", x3: "smug", c1: "happy", c2: "smug", c3: "idle" },
  bad: { x1: "sad", x2: "surprised", x3: "surprised", c1: "surprised", c2: "sad", c3: "idle" },
  slow: { x1: "idle", x2: "smug", x3: "think", c1: "happy", c2: "smug", c3: "idle" },
  reply: { x1: "surprised", x2: "smug", x3: "idle", c1: "happy", c2: "smug", c3: "idle" },
  win: { x1: "happy", x2: "smug", x3: "smug", c1: "happy", c2: "smug", c3: "idle" },
  lose: { x1: "sad", x2: "sad", x3: "surprised", c1: "surprised", c2: "sad", c3: "surprised" },
  draw: { x1: "idle", x2: "idle", x3: "idle", c1: "happy", c2: "idle", c3: "idle" },
  beaten: { c3: "surprised" }
};
function faceSVG(id, emo) {
  if (id === "c3" && emo !== "surprised") emo = "idle";        // «Нет» keeps a stone face. Almost always.
  const P = d => `<path class="ln" d="${d}"/>`, C = (x, y, r, cls) => `<circle class="${cls || "dot"}" cx="${x}" cy="${y}" r="${r}"/>`;
  let head, eyes = "", mouth = "", extra = "";
  if (id === "x3") {
    head = '<path class="ln" d="M30 14 V7"/><circle class="ant" cx="30" cy="5.5" r="3.2"/><rect class="hd" x="11" y="14" width="38" height="36" rx="6"/>';
    eyes = emo === "happy" || emo === "smug" ? P("M19 30 Q23 26 27 30 M33 30 Q37 26 41 30")
      : emo === "surprised" ? '<rect class="dot" x="19" y="24" width="8" height="9" rx="1.5"/><rect class="dot" x="33" y="24" width="8" height="9" rx="1.5"/>'
      : emo === "think" ? '<rect class="dot" x="22" y="24" width="6" height="6" rx="1"/><rect class="dot" x="36" y="24" width="6" height="6" rx="1"/>'
      : '<rect class="dot" x="20" y="25" width="6" height="6" rx="1"/><rect class="dot" x="34" y="25" width="6" height="6" rx="1"/>';
    mouth = emo === "happy" || emo === "smug" ? P("M22 40 Q30 45 38 40") : emo === "surprised" ? P("M23 42 h14") : P("M21 41 h18 M25 38.5 v5 M30 38.5 v5 M35 38.5 v5");
    return `<svg viewBox="0 0 60 60" aria-hidden="true">${head}${eyes}${mouth}</svg>`;
  }
  head = id === "c3"
    ? '<path class="hd" d="M13 21 Q12 12 22 11 L39 11 Q49 12 48 22 L48 43 Q48 51 39 51 L21 51 Q12 51 12 42 Z"/>'
    : '<path class="hd" d="M30 9 C 44 9 51 19 50 31 C 49 44 41 51 30 51 C 18 51 10 43 10 30 C 10 18 17 9 30 9 Z"/>';
  switch (emo) {
    case "happy": eyes = P("M19 29 Q23 24 27 29 M33 29 Q37 24 41 29"); mouth = P("M20 37 Q30 49 40 37"); break;
    case "smug": eyes = P("M19 27.5 h8 M33 27.5 h8") + C(23, 29.6, 1.8) + C(37, 29.6, 1.8); mouth = P("M23 41 Q33 44 39 36"); break;
    case "surprised": eyes = C(23, 28, 4.2, "ln") + C(37, 28, 4.2, "ln") + C(23, 28, 1.6) + C(37, 28, 1.6); mouth = C(30, 42, 4, "ln"); break;
    case "sad": eyes = C(23, 29, 2.6) + C(37, 29, 2.6) + P("M18 24 L26 21.5 M34 21.5 L42 24"); mouth = P("M22 45 Q30 37 38 45"); break;
    case "think": eyes = C(25, 25.5, 2.6) + C(39, 25.5, 2.6) + P("M33 19.5 L42 18"); mouth = P("M25 42 Q30 40 35 42.5"); break;
    default: eyes = C(23, 28, 2.8) + C(37, 28, 2.8); mouth = P("M23 40 Q30 43.5 37 40");
  }
  if (id === "c3") {
    eyes = emo === "surprised" ? C(24, 28, 3.6, "ln") + C(36, 28, 3.6, "ln") + C(24, 28, 1.3) + C(36, 28, 1.3) : C(24, 28, 2) + C(36, 28, 2);
    mouth = emo === "surprised" ? C(30, 42, 3, "ln") : P("M24 41 h12");
  }
  if (id === "x1") { extra += P("M28 9.5 C 25 3, 34 1.5, 32.5 6.5"); if (emo === "sad" || emo === "surprised") extra += '<path class="drop" d="M46 17 Q42 23 46 25.5 Q50 23 46 17 Z"/>'; }
  if (id === "x2") { extra += P("M13 23 Q19 8 36 10 Q45 11 48 19"); if (emo !== "sad" && emo !== "think") extra += P("M18 21.5 L27 22.5 M33 21 L42 18.5"); }
  if (id === "c1") extra += '<ellipse class="blush" cx="16.5" cy="36" rx="4.2" ry="2.6"/><ellipse class="blush" cx="43.5" cy="36" rx="4.2" ry="2.6"/>';
  if (id === "c2") { extra += C(37, 28, 6.6, "ln") + P("M43.4 30.5 Q48 40 44 48"); if (emo !== "sad") extra += P("M32 19.5 L42.5 16.5"); }
  return `<svg viewBox="0 0 60 60" aria-hidden="true">${head}${extra}${eyes}${mouth}</svg>`;
}
let faceTimer = null, talkLast = 0, slowTimer = null;
const talkOn = () => store.get("botTalk", true) !== false;
const faceEl = () => $(app.mode === "classic" ? "cFace" : "x02Face");
function setFace(emo, hold) {
  if (!app.bot) return;
  const id = app.bot.id, el = faceEl(), e = emo || FACE_IDLE[id] || "idle";
  el.classList.toggle("think", e === "think");
  if (el.dataset.k !== id + e) {
    el.dataset.k = id + e;
    el.innerHTML = faceSVG(id, e);
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }
  clearTimeout(faceTimer);
  if (emo && !hold) faceTimer = setTimeout(() => { if (app.bot && app.bot.id === id) setFace(null); }, 2600);
}
function syncFace() {
  for (const id of ["x02Face", "cFace"]) $(id).hidden = !app.bot;
  if (app.bot && !(faceEl().dataset.k || "").startsWith(app.bot.id)) setFace(null);
}
function botSay(ev, prob) {
  if (!app.bot || app.learn) return;
  const id = app.bot.id;
  if (EMO[ev] && EMO[ev][id]) setFace(EMO[ev][id], ev === "win" || ev === "lose" || ev === "draw" || ev === "beaten");
  if (!talkOn()) return;
  const now = Date.now(), forced = ev === "start" || ev === "reply" || ev === "beaten";
  if (!forced && (now - talkLast < 6000 || Math.random() > (prob == null ? 1 : prob))) return;
  const pack = (t("botTalk") || {})[id] || {};
  let line = ev === "beaten" ? pack.beaten : "";
  if (!line) { const arr = pack[ev] || []; if (!arr.length) return; line = arr[(Math.random() * arr.length) | 0]; }
  talkLast = now;
  showBubbleText(line, t("q", bt(id, "name")), false);
  const el = faceEl();
  el.classList.remove("talk"); void el.offsetWidth; el.classList.add("talk");
}
function armSlow() {
  clearTimeout(slowTimer);
  if (!app.bot || app.online || app.learn) return;
  const e = cur();
  slowTimer = setTimeout(() => {
    if (app.bot && !app.learn && cur() === e && inGame() && actorOf(e) === app.side) botSay("slow", 1);
  }, 22000);
}
function syncTalkClass() { document.body.classList.toggle("is-bot", !!app.bot && !app.online && talkOn()); }

// ---------------- online: play a friend by link ----------------
const ICON_LINK = '<svg class="ico-link" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4L12 18.4"/></svg>';
let onlineMinutes = [2, 3, 5].includes(store.get("minutes", 3)) ? store.get("minutes", 3) : 3;
let pollTimer = null, clockTimer = null, pollBusy = false, bubbleTimer = null, phraseLock = 0;
let ogCache = { at: 0, games: [], busy: false };
const MODE_NAME = m => (m === "classic" ? t("classicName") : "X02.0");
const onlineActor = s => {
  if (!s || s.result) return 0;
  if (s.mode === "classic") return s.t.turn;
  if (s.phase === "prelude") return s.t.result ? 0 : s.t.turn;
  return s.g.turn;
};
const entryFromState = s => s.mode === "classic" ? { t: s.t }
  : s.phase === "prelude" ? { phase: "prelude", t: s.t, coin: s.coin || 0, golden: s.golden || 0, goal: "win" }
  : { phase: "main", g: s.g };
const entryKey = e => !e ? "" : e.g ? `m${e.g.log.length}.${e.g.turn}.${e.g.active}.${e.g.choosing}.${e.g.result}` : `${e.phase || "c"}${e.t.b.join("")}.${e.coin || 0}`;
function miniAva(card) {
  const c = card || {}, init = (c.name || "?").trim().charAt(0).toUpperCase() || "?";
  return `<span class="mini-ava">${c.photo ? `<img src="${esc(c.photo)}" alt="" data-i="${esc(init)}" referrerpolicy="no-referrer">` : `<span>${esc(init)}</span>`}</span>`;
}
function toast(text) {
  document.querySelectorAll(".toast").forEach(el => el.remove());
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function gameFromLink() {
  let id = "";
  try {
    const sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param;
    if (sp && /^g_[a-z0-9]{6,16}$/.test(sp)) id = sp.slice(2);
    const q = new URLSearchParams(location.search).get("g");
    if (!id && q && /^[a-z0-9]{6,16}$/.test(q)) id = q;
    if (q) history.replaceState(null, "", location.pathname + location.hash);
  } catch (e) {}
  return id;
}

// create a game: pick the time per move, then invite
function openOnlineSheet(mode) {
  homeHere();
  app.pendingMode = mode;
  renderOnlineSheet();
  $("onlineSheet").hidden = false;
  tgBack();
}
function closeOnlineSheet() { $("onlineSheet").hidden = true; tgBack(); }
function renderOnlineSheet() {
  const mode = app.pendingMode || "x02", box = $("onlineBody");
  if (!API_OK) { box.innerHTML = `<div class="ob"><p>${t("onlineNoServer")}</p></div>`; return; }
  if (!serverOn()) {
    box.innerHTML = `<div class="ob"><p>${t("onlineNeedLogin")}</p><div><button class="btn primary tg-btn" type="button" data-act="loginTop">${ICON_TG}${t("login")}</button></div></div>`;
    return;
  }
  const side = store.get("side", 1) === 2 ? 2 : 1;
  box.innerHTML = `<div class="ob">
    <h3 style="margin:0">${mode === "classic" ? esc(MODE_NAME(mode)) : '<span style="color:var(--ink-x)">X</span><span style="color:var(--ink-o)">0</span>2.0'}</h3>
    <div class="ob-row"><span>${t("onlineMinutes")}</span>
      <div class="seg-group min-pick" role="group">${[2, 3, 5].map(m => `<button class="seg" type="button" data-min="${m}" aria-pressed="${m === onlineMinutes}">${t("minShort", m)}</button>`).join("")}</div></div>
    <p>${t("onlineSide", sw(SYM[side]))}</p>
    <p class="shop-hint">${t("onlineHow")}</p>
    <div><button class="btn primary" type="button" data-act="createOnline">${t("onlineCreate")}</button></div>
  </div>`;
}
async function createOnline() {
  const mode = app.pendingMode || "x02";
  const btn = document.querySelector('[data-act="createOnline"]');
  if (btn) btn.disabled = true;
  try {
    const v = await apiCall("/api/g/new", { mode, minutes: onlineMinutes, side: store.get("side", 1) === 2 ? 2 : 1 });
    if (!v.id) throw new Error(v.error || "bad");
    closeOnlineSheet();
    enterOnline(v);
    shareInvite();
  } catch (e) { toast(t("netError")); if (btn) btn.disabled = false; }
}
async function joinOnline(id) {
  if (!API_OK) { toast(t("onlineNoServer")); return; }
  if (!serverOn()) { toast(t("gameLogin")); return; }
  if (app.online && app.online.id === id) return;
  try {
    const v = await apiCall("/api/g/join", { id });
    if (v.error === "full") { toast(t("gameFull")); return; }
    if (!v.state || (v.status === "done" && v.state.reason === "cancel")) { toast(t("gameGone")); return; }
    enterOnline(v);
  } catch (e) { toast(t("netError")); }
}
function enterOnline(v) {
  if (app.learn) endLearn();
  cancelBot();
  if (app.online) stopOnline();
  app.online = { id: v.id, mode: v.mode, minutes: v.minutes, ver: 0, status: v.status, state: null, players: v.players || {}, deadline: 0, offset: 0,
    chatSeen: Math.max(0, ...(v.chat || []).map(c => c.t)), key: "", ended: false, next: "", link: v.link, reward: 0 };
  app.bot = null; app.mode = v.mode; app.side = v.me || 1; app.gameId++;
  clearTimeout(slowTimer); syncTalkClass();
  uiMode = null; flash = null;
  document.body.classList.add("is-online");
  for (const id of ["bannerReward", "cBannerReward"]) $(id).innerHTML = "";
  for (const id of ["rematchNote", "cRematchNote"]) $(id).hidden = true;
  document.querySelectorAll(".phrases").forEach(el => { el.hidden = true; });
  $("banner").classList.remove("show"); $("cBanner").classList.remove("show");
  onlineApply(v, true);
  clearInterval(pollTimer); clearInterval(clockTimer);
  pollTimer = setInterval(pollOnline, 1500);
  clockTimer = setInterval(updateClock, 250);
}
function stopOnline() {
  clearInterval(pollTimer); clearInterval(clockTimer); clearTimeout(bubbleTimer);
  pollTimer = clockTimer = null;
  app.online = null;
  app.side = store.get("side", 1) === 2 ? 2 : 1;
  document.body.classList.remove("is-online");
  for (const id of ["clock", "cClock", "bubble", "cBubble", "rematchNote", "cRematchNote"]) $(id).hidden = true;
  document.querySelectorAll('[data-act="again"]').forEach(b => { if (b.dataset.i18n) b.textContent = t(b.dataset.i18n); });
  ogCache.at = 0;
}
function drawGrids() {
  document.querySelectorAll(".hand-grid").forEach(gEl => { gEl.classList.remove("drawn"); void gEl.getBoundingClientRect(); gEl.classList.add("drawn"); });
}
function renderWait(v) {
  $("waitMode").textContent = MODE_NAME(v.mode);
  $("waitMeta").textContent = t("waitMeta", MODE_NAME(v.mode), v.minutes);
  $("waitLink").textContent = v.link || "";
  $("copyBtn").textContent = t("copyLink");
}
function actionSound(e, a, by) {
  if (e && e.phase === "main") { if (a >= 300) SND.play("choose"); else if (a >= 100 && a < 200) SND.play("star"); else if (a < 100) SND.play(by === 1 ? "x" : "o"); }
  else SND.play(by === 1 ? "x" : "o");
}
// a new server state: animate what the friend did, keep the clock in sync, show chat phrases, end the game
async function onlineApply(v, initial) {
  const o = app.online;
  if (!o || v.id !== o.id || !v.state || (v.ver && v.ver < o.ver)) return;
  const prevState = o.state, prevE = cur(), wasWaiting = o.status === "waiting";
  o.ver = v.ver; o.status = v.status; o.players = v.players || o.players; o.deadline = v.deadline || 0;
  o.offset = (v.now || Date.now()) - Date.now(); o.next = v.next || ""; o.reward = v.reward || 0; o.link = v.link || o.link;
  o.state = v.state;
  if (v.status === "waiting") { if (app.screen !== "wait") show("wait"); renderWait(v); return; }
  const screen = v.mode === "classic" ? "classic" : "x02";
  if (app.screen !== screen) { show(screen); drawGrids(); initial = true; if (wasWaiting && v.status === "active") { SND.play("coin"); hapticResult(true); } }
  for (const c of v.chat || []) if (c.t > o.chatSeen) { o.chatSeen = c.t; if (c.p !== app.side) { showBubble(c.k, false); SND.play("click"); } }
  const s = v.state, e = entryFromState(s), key = entryKey(e);
  const changed = key !== o.key, mine = s.lastBy === app.side;
  o.key = key;
  if (s.mode === "x02" && s.phase === "prelude" && s.t.result === 3 && s.coin && !(prevState && prevState.coin) && !initial) {
    app.history = [Object.assign({}, e, { coin: 0 })];
    renderX02(null);
    flipCoin(() => { if (app.online === o) { app.history = [e]; renderX02(null); } }, s.coin, s.golden);
  } else if (!changed || initial) {
    app.history = [e];
    render(null);
  } else if (s.mode === "x02" && s.phase === "main" && prevE && prevE.phase === "main") {
    if (!mine && s.lastA >= 200 && s.lastA < 300) { SND.play("strike"); await animateStrike(s.lastA - 200); }
    else if (!mine) actionSound(prevE, s.lastA, s.lastBy);
    if (app.online !== o) return;
    app.history = [e];
    renderX02({ prev: prevE.g, action: s.lastA });
    const b = ((s.lastA % 100) / 9) | 0;
    if (s.lastA >= 0 && s.lastA < 300 && prevE.g.owner[b] === 0 && (s.g.owner[b] === 1 || s.g.owner[b] === 2)) {
      if (!mine) SND.play("capture", 0.25);
      flyToMain(b, s.g.owner[b]);
    }
  } else {
    if (!mine && s.lastBy && (s.mode === "classic" || s.phase === "prelude")) actionSound(null, s.lastA, s.lastBy);
    app.history = [e];
    if (s.mode === "classic") renderClassic({ played: true });
    else renderX02(s.phase === "prelude" ? { prelude: true } : null);
  }
  if (s.result && !o.ended) onlineEnd(v, initial);
  else if (o.ended) showRematch();
  updateClock();
}
function onlineEnd(v, quiet) {
  const o = app.online, s = v.state, r = s.result, won = r === app.side;
  o.ended = true;
  const classic = s.mode === "classic";
  const banner = $(classic ? "cBanner" : "banner");
  $(classic ? "cBannerTitle" : "bannerTitle").textContent = r === 3 ? t("drawTitle") : won ? t("youWon") : t("botWon", oppName());
  const reason = s.reason === "timeout" ? t("reasonTimeout", !won) : s.reason === "resign" ? t("reasonResign", !won) : "";
  if (classic) $("cBannerTaunt").textContent = reason;
  else { $("bannerTaunt").textContent = ""; if (reason) $("bannerText").textContent = reason; }
  $(classic ? "cBannerReward" : "bannerReward").innerHTML = v.reward ? `<span class="reward-pop">${t("reward", v.reward)} ${curIcon("clips")}</span>` : "";
  banner.querySelectorAll('[data-act="again"]').forEach(b => { b.textContent = r !== 3 && !won ? t("revengeBtn") : t("rematch"); });
  if (!banner.classList.contains("show")) banner.classList.add("show");
  if (!quiet) {
    SND.play(r === 3 ? "draw" : won ? "win" : "lose", 0.4);
    if (r !== 3) hapticResult(won);
    if (won) setTimeout(() => confetti(r), 650);
    setTimeout(() => FX.end(r === 3 ? "draw" : won ? "win" : "lose", r, $(classic ? "tttBoard" : "board")), 380);
  }
  showRematch();
  setTimeout(syncProfile, 700);
  if (!quiet) {
    const mainCells = s.g ? s.g.owner.map(o => o === 1 || o === 2 ? o : 0) : [];
    cardInfoSet(won ? { opp: oppName(), mode: s.mode, me: playerInfo().first, sym: app.side,
      cells: classic ? s.t.b.slice() : (mainCells.some(Boolean) ? mainCells : (s.t ? s.t.b.slice() : [])), line: classic ? s.t.line : (s.g ? s.g.winLine : null),
      moves: classic ? s.t.b.filter(Boolean).length : (s.g ? s.g.moves : 0) } : null);
    askWrite();
    if (s.refPaid && s.refPaid[app.side]) toast(t("refPaidToast", s.refPaid[app.side]));
  }
}
function showRematch() {
  const o = app.online;
  if (!o) return;
  const note = $(o.mode === "classic" ? "cRematchNote" : "rematchNote");
  note.hidden = !o.next;
  if (o.next) {
    note.textContent = t("rematchOffer", oppName());
    document.querySelectorAll(`#${o.mode === "classic" ? "cBanner" : "banner"} [data-act="again"]`).forEach(b => { b.textContent = t("rematchAccept"); });
  }
}
async function pollOnline() {
  const o = app.online;
  if (!o || pollBusy || document.hidden) return;
  if (o.status === "done" && Date.now() - (o.lastPoll || 0) < 3000) return;
  pollBusy = true; o.lastPoll = Date.now();
  try {
    const v = await apiCall("/api/g/state", { id: o.id, ver: o.ver });
    if (app.online !== o) return;
    if (v.same) { o.deadline = v.deadline || o.deadline; o.offset = (v.now || Date.now()) - Date.now(); }
    else if (v.state) await onlineApply(v, false);
  } catch (e) {} finally { pollBusy = false; }
}
async function onlineMove(a) {
  const o = app.online;
  if (!o || inputBusy || o.status !== "active" || (o.state && o.state.result)) return;
  const prevE = cur();
  let ne = null;
  if (o.mode === "classic") { const t2 = E.tttApply(prevE.t, a); if (t2) ne = { t: t2 }; }
  else if (prevE.phase === "prelude") { const t2 = E.tttApply(prevE.t, a); if (t2) ne = Object.assign({}, prevE, { t: t2 }); }
  else if (E.isLegal(prevE.g, a)) ne = { phase: "main", g: E.apply(prevE.g, a) };
  if (!ne) return;
  inputBusy = true;
  try {
    haptic("light");
    if (prevE.phase === "main" && a >= 200 && a < 300) { SND.play("strike"); await animateStrike(a - 200); }
    else actionSound(prevE, a, app.side);
    uiMode = null;
    // show the move right away, then let the server confirm it
    app.history = [ne]; o.key = entryKey(ne);
    if (prevE.phase === "main") {
      renderX02({ prev: prevE.g, action: a });
      const b = ((a % 100) / 9) | 0;
      if (a < 300 && prevE.g.owner[b] === 0 && (ne.g.owner[b] === 1 || ne.g.owner[b] === 2)) { SND.play("capture", 0.25); flyToMain(b, ne.g.owner[b]); }
    } else if (o.mode === "classic") renderClassic({ played: true });
    else renderX02({ prelude: true });
    const v = await apiCall("/api/g/move", { id: o.id, a, ver: o.ver });
    if (app.online !== o) return;
    if (v.state) { if (v.error) o.key = ""; await onlineApply(v, false); }
    else throw new Error(v.error || "net");
  } catch (err) {
    if (app.online === o) { toast(t("netError")); o.key = ""; o.ver = 0; pollOnline(); }
  } finally { inputBusy = false; }
}
function updateClock() {
  const o = app.online;
  const el = $(app.mode === "classic" ? "cClock" : "clock");
  $(app.mode === "classic" ? "clock" : "cClock").hidden = true;
  const actor = o && o.status === "active" ? onlineActor(o.state) : 0;
  if (!o || !actor || !o.deadline) { el.hidden = true; return; }
  const left = Math.max(0, o.deadline - (Date.now() + o.offset)), sec = Math.ceil(left / 1000), mine = actor === app.side;
  el.hidden = false;
  const cls = "clock" + (mine ? " mine" : "") + (sec <= 20 ? " low" : "");
  if (el.className !== cls) el.className = cls;
  el.innerHTML = `⏱ <b>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}</b> <span>${mine ? t("clockYou") : t("clockOpp", botQ())}</span>`;
  if (left <= 0 && Date.now() - (o.lastPoll || 0) > 1000) pollOnline();
}
async function onlineResign() {
  const o = app.online;
  if (!o || o.status !== "active") return;
  const go = async () => {
    try { const v = await apiCall("/api/g/resign", { id: o.id }); if (v.state) onlineApply(v, false); } catch (e) { toast(t("netError")); }
  };
  if (TG && TG.showConfirm) { try { TG.showConfirm(t("resignConfirm"), ok => { if (ok) go(); }); return; } catch (e) {} }
  if (window.confirm(t("resignConfirm"))) go();
}
async function onlineRematch() {
  const o = app.online;
  if (!o) return;
  if (o.next) { joinOnline(o.next); return; }
  try {
    const v = await apiCall("/api/g/rematch", { id: o.id });
    if (v.next) joinOnline(v.next);
    else toast(t("netError"));
  } catch (e) { toast(t("netError")); }
}
async function cancelOnline() {
  const o = app.online;
  if (o) { try { await apiCall("/api/g/resign", { id: o.id }); } catch (e) {} }
  goMenu();
}
function inviteText() { const o = app.online; return o ? t("inviteText", MODE_NAME(o.mode), o.minutes) + "\n" + hook() : ""; }
function shareInvite() {
  const o = app.online;
  if (!o || !o.link) return;
  const text = inviteText();
  if (TG && TG.openTelegramLink) { try { TG.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(o.link)}&text=${encodeURIComponent(text)}`); return; } catch (e) {} }
  if (navigator.share) { navigator.share({ text, url: o.link }).catch(() => {}); return; }
  copyInvite();
}
function copyInvite() {
  const o = app.online;
  if (!o || !o.link) return;
  const done = () => { $("copyBtn").textContent = t("copied"); };
  try { navigator.clipboard.writeText(o.link).then(done, () => {}); } catch (e) {}
}
function togglePhrases() {
  const box = document.querySelector(`#scr-${app.screen} .phrases`);
  if (!box) return;
  if (box.hidden) box.innerHTML = t("chatPhrases").map((p, k) => `<button class="phrase" type="button" data-phrase="${k}">${esc(p)}</button>`).join("");
  box.hidden = !box.hidden;
}
async function sayPhrase(k) {
  const o = app.online;
  if ((!o && !app.bot) || Date.now() < phraseLock) return;
  phraseLock = Date.now() + 2600;
  document.querySelectorAll(".phrase").forEach(b => { b.disabled = true; });
  setTimeout(() => document.querySelectorAll(".phrase").forEach(b => { b.disabled = false; }), 2600);
  showBubble(k, true);
  if (!o) { const bot = app.bot; setTimeout(() => { if (app.bot === bot) botSay("reply"); }, 1100 + Math.random() * 700); return; }
  try { const v = await apiCall("/api/g/say", { id: o.id, k }); if (v.chat) o.chatSeen = Math.max(o.chatSeen, ...v.chat.map(c => c.t)); } catch (e) {}
}
function showBubble(k, mine) { showBubbleText((t("chatPhrases") || [])[k], mine ? "" : oppName(), mine); }
function showBubbleText(text, name, mine) {
  const el = $(app.mode === "classic" ? "cBubble" : "bubble");
  if (!el || !text) return;
  el.className = "bubble" + (mine ? " mine" : "");
  el.innerHTML = (name ? `<small>${esc(name)}</small>` : "") + esc(text);
  el.hidden = true; void el.offsetWidth; el.hidden = false;
  clearTimeout(el._hide);
  el._hide = setTimeout(() => { el.hidden = true; }, 3200);
}
// menu: games with friends that are still going
function renderOnlineList() {
  const box = $("onlineGames"), empty = $("onlineEmpty");
  if (!box) return;
  $("newX02").innerHTML = ICON_LINK + esc(t("newOnline", "X02.0"));
  $("newClassic").innerHTML = ICON_LINK + esc(t("newOnline", t("classicName")));
  if (!serverOn()) { box.innerHTML = ""; empty.hidden = false; empty.textContent = API_OK ? t("onlineNeedLogin") : t("onlineNoServer"); return; }
  if (Date.now() - ogCache.at > 8000 && !ogCache.busy) {
    ogCache.busy = true;
    apiCall("/api/g/list", {}).then(r => {
      ogCache = { at: Date.now(), games: r.games || [], busy: false };
      if (app.screen === "menu") renderCover(); else if (app.screen === "online") renderOnlineList();
    }).catch(() => { ogCache.busy = false; ogCache.at = Date.now(); });
  }
  const games = ogCache.games;
  empty.hidden = !!games.length;
  empty.textContent = t("onlineEmpty");
  box.innerHTML = !games.length ? "" : `<div class="og-list">` + games.map(g => {
    const flag = g.status === "waiting" ? t("waitingFlag") : g.myTurn ? t("yourMoveFlag") : t("theirMoveFlag");
    return `<button class="og${g.myTurn ? " my-turn" : ""}" type="button" data-og="${esc(g.id)}">${miniAva(g.opp)}
      <span><span class="og-name">${g.opp ? esc(g.opp.name) : t("waitingName")}</span><span class="og-sub">${esc(MODE_NAME(g.mode))} · ⏱ ${t("minShort", g.minutes)}</span></span>
      <span class="og-flag">${flag}</span></button>`;
  }).join("") + `</div>`;
}

// ---------------- shop ----------------
const ICON_CLIP = '<svg class="ico-clip" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.5 V16 a3 3 0 0 0 6 0 V6 a4.5 4.5 0 0 0 -9 0 V16.5 a6 6 0 0 0 12 0 V8"/></svg>';
// the coin: gold with the X0 logo struck in it (defs live once in the page: #coinFace, #coinEdge)
const ICON_COIN = '<svg class="ico-coin" viewBox="10 4 100 100" aria-hidden="true"><circle cx="60" cy="57" r="46" fill="url(#coinEdge)"/><circle cx="60" cy="52" r="46" fill="url(#coinFace)" stroke="#8a5a00" stroke-width="3"/><circle cx="60" cy="52" r="36" fill="none" stroke="#a86a00" stroke-width="3" stroke-dasharray="3 4"/><path d="M40 35 L57 67 M57 35 L40 67" stroke="#9a6400" stroke-width="8.5" stroke-linecap="round"/><ellipse cx="75" cy="51" rx="10.5" ry="15.5" fill="none" stroke="#9a6400" stroke-width="7.5"/><path d="M30 34 Q40 18 60 16" stroke="#fffbe0" stroke-width="5" fill="none" stroke-linecap="round"/></svg>';
const curIcon = cur => (cur === "coins" ? ICON_COIN : ICON_CLIP);
function walletHTML() {
  return `<span class="cur" title="${t("clips")}">${ICON_CLIP}<b>${profile.clips}</b> <span class="cur-name">${t("clipsWord", profile.clips)}</span></span>` +
    `<span class="cur" title="${t("coins")}">${ICON_COIN}<b>${profile.coins}</b> <span class="cur-name">${t("coinsWord", profile.coins)}</span></span>`;
}
let shopNote = null, justBought = null, shopBusy = false;
function openShop() {
  cancelBot(); shopNote = null;
  if (isMenuScreen(app.screen) && app.screen !== "shop") app.nav.push(app.screen); else if (app.screen !== "shop") app.nav = ["menu"];
  show("shop"); renderShop(); syncProfile();
}
function itemName(id) { return I18N[lang].items[id]; }
function previewSkin(it) {
  const e = profile.equip;
  if (it.kind === "xShape") return { sym: 1, sk: { shape: it.id, color: it.premium ? null : e.xColor } };
  if (it.kind === "oShape") return { sym: 2, sk: { shape: it.id, color: it.premium ? null : e.oColor } };
  if (it.kind === "xColor") return { sym: 1, sk: { shape: e.xShape === "x_gold" || e.xShape === "x_fire" ? "x_classic" : e.xShape, color: it.id } };
  return { sym: 2, sk: { shape: e.oShape === "o_gold" || e.oShape === "o_fire" ? "o_classic" : e.oShape, color: it.id } };
}
function itemCard(it, n) {
  const pv = previewSkin(it), own = owns(it.id), on = profile.equip[it.kind] === it.id;
  const btn = on ? `<button class="btn small" type="button" disabled>${t("equipped")}</button>`
    : own ? `<button class="btn small" type="button" data-equip="${it.id}">${t("equip")}</button>`
    : `<button class="btn small ${it.cur === "coins" ? "gold-btn" : "primary"}" type="button" data-buy="${it.id}">${t("buy")} · ${it.price} ${curIcon(it.cur)}</button>`;
  return `<div class="item${on ? " on" : ""}${it.premium ? " premium" : ""}${it.r ? " r-" + it.r : ""}${/_fire$/.test(it.id) ? " epic" : ""}${justBought === it.id ? " just-bought" : ""}">
    <div class="item-prev">${markSVG(pv.sym, 41 + n, justBought === it.id ? "fresh" : "", false, pv.sk)}</div>
    <div class="item-name">${itemName(it.id)}</div>
    <div class="item-price">${it.r ? `<span class="rar ${it.r}">${t("rar_" + it.r)}</span>` : ""}${it.price === 0 ? t("free") : own ? t("owned") : ""}</div>
    ${btn}</div>`;
}
function renderShop() {
  $("shopWallet").innerHTML = walletHTML();
  const sec = (title, list, note) => `<section class="shop-sec"><h3>${title}</h3>${note ? `<p class="shop-hint">${note}</p>` : ""}<div class="items">${list.map((it, n) => itemCard(it, n)).join("")}</div></section>`;
  const by = (kind, prem) => SHOP.filter(s => s.kind === kind && !!s.premium === prem);
  const base = PACKS[0].coins / PACKS[0].stars;
  const packs = TG && serverOn() ? PACKS.map((p, k) => ({ p, k })).filter(x => !x.p.items).sort((a, b) => a.p.coins - b.p.coins).map(({ p, k }) => {
    const save = Math.round((1 - (p.stars / p.coins) / (PACKS[0].stars / PACKS[0].coins)) * 100);
    return `<div class="item pack"><div class="item-prev coin-prev">${ICON_COIN}</div><div class="item-name">${p.coins} ${t("coinsWord", p.coins)}</div><div class="item-price">${save > 0 ? `<span class="rar rare">−${save}%</span>` : ""}</div>
      <button class="btn small gold-btn" type="button" data-pack="${k}">${p.stars} ⭐</button></div>`;
  }).join("") : "";
  const coinSec = TG && serverOn()
    ? `<section class="shop-sec"><h3>${t("secCoins")}</h3><p class="shop-hint">${t("coinsStars")}</p><div class="items">${packs}</div></section>`
    : `<section class="shop-sec"><h3>${t("secCoins")}</h3><p class="shop-hint">${serverOn() ? t("coinsBot") : t("coinsTg")}</p>${TG ? "" : `<button class="btn small gold-btn" type="button" data-open-tg="1">${t("openTg")}</button>`}</section>`;
  const exch = EXCHANGE.map(([c, n], k) => {
    const bonus = Math.round((n / (c * 20) - 1) * 100);
    return `<div class="item pack"><div class="item-prev ex-prev">${ICON_COIN}<span class="ex-arrow">→</span>${ICON_CLIP}</div>
      <div class="item-name">${n} ${t("clipsWord", n)}</div><div class="item-price">${bonus > 0 ? t("bonusLabel", bonus) : ""}</div>
      <button class="btn small gold-btn" type="button" data-exchange="${k}">${t("exchangeBtn")} · ${c} ${ICON_COIN}</button></div>`;
  }).join("");
  $("shopBody").innerHTML =
    `<p class="shop-hint earn">${t("earnHint")}</p>` +
    (shopNote ? `<p class="shop-note ${shopNote[1]}">${shopNote[0]}</p>` : "") +
    (TG && serverOn() ? chestSec() : "") +
    sec(t("secPremium"), SHOP.filter(s => s.premium), t("premiumHint")) +
    sec(t("secXShape"), by("xShape", false)) +
    sec(t("secOShape"), by("oShape", false)) +
    `<section class="shop-sec"><h3>${t("secExchange")}</h3><p class="shop-hint">${t("exchangeHint")}</p><div class="items">${exch}</div></section>` +
    coinSec;
  justBought = null;
}
function chestSec() {        // generous one-time chests for Stars
  const cards = PACKS.map((p, k) => ({ p, k })).filter(x => x.p.items).map(({ p, k }) => {
    const done = (profile.packs || []).includes(p.once), worth = p.items.reduce((n, id) => n + (itemOf(id) || { price: 0 }).price, 0) + p.coins;
    const prev = p.items.slice(0, 6).map((id, n) => { const it = itemOf(id); const pv = previewSkin(it); return markSVG(pv.sym, 70 + n, "", false, pv.sk); }).join("");
    return `<div class="chest ${p.once}"><div class="chest-t">${t("chest_" + p.once)}</div><div class="chest-prev">${prev}${p.items.length > 6 ? `<span class="more">+${p.items.length - 6}</span>` : ""}</div>
      <div class="chest-what">${t("chestWhat", p.items.length, p.coins)}</div><div class="chest-worth">${t("chestWorth", Math.round(worth * 4))} ⭐</div>
      ${done ? `<button class="btn small" type="button" disabled>${t("owned")}</button>` : `<button class="btn small gold-btn big-chest" type="button" data-pack="${k}">${t("chestBuy")} · ${p.stars} ⭐</button>`}</div>`;
  }).join("");
  return `<section class="shop-sec"><h3>${t("secChests")}</h3><p class="shop-hint">${t("chestHint")}</p><div class="chests">${cards}</div></section>`;
}
function shopNoteSet(text, kind) { shopNote = [text, kind]; renderShop(); }
async function serverSpend(item) {
  shopBusy = true;
  try { return await apiCall("/api/spend", { item }); }
  catch (e) { return { error: "net" }; }
  finally { shopBusy = false; }
}
function waitForCoins(before, added, tries) {
  syncProfile().then(() => {
    if (profile.coins >= before + added) { hapticResult(true); SND.play("win"); shopNoteSet(t("paid", added), "ok"); }
    else if (tries > 0) setTimeout(() => waitForCoins(before, added, tries - 1), 1500);
    else shopNoteSet(t("paidLater"), "warn");
  });
}
async function buyPack(k) {
  const p = PACKS[k];
  if (!p || shopBusy) return;
  shopBusy = true; shopNoteSet(t("wait"), "ok");
  let res;
  try { res = await apiCall("/api/invoice", { pack: k }); } catch (e) { res = { error: "net" }; }
  shopBusy = false;
  if (!res.link) { shopNoteSet(t("netError"), "warn"); return; }
  shopNote = null; renderShop();
  const before = profile.coins;
  try {
    TG.openInvoice(res.link, status => {
      if (status === "paid") { shopNoteSet(t("wait"), "ok"); waitForCoins(before, p.coins, 8); }
      else if (status === "failed") shopNoteSet(t("payFailed"), "warn");
    });
  } catch (e) { shopNoteSet(t("payFailed"), "warn"); }
}
async function shopAction(ev) {
  const b = ev.target.closest("button");
  if (!b || shopBusy) return;
  if (b.dataset.buy) {
    const it = itemOf(b.dataset.buy);
    if (!it || owns(it.id)) return;
    const have = profile[it.cur];
    if (have < it.price) { shopNoteSet(it.cur === "clips" ? t("notEnoughClips", it.price - have) : t("notEnoughCoins", it.price - have), "warn"); return; }
    if (serverOn()) {
      const w = await serverSpend(it.id);
      const short = w.error === "coins" || w.error === "clips";
      if (w.error === "net" || (!w.ok && !short)) { shopNoteSet(t("netError"), "warn"); return; }
      applyProfile(w);
      if (!w.ok) { const h = profile[it.cur]; shopNoteSet(it.cur === "clips" ? t("notEnoughClips", it.price - h) : t("notEnoughCoins", it.price - h), "warn"); return; }
    } else profile[it.cur] -= it.price;
    if (!profile.owned.includes(it.id)) profile.owned.push(it.id);
    profile.equip[it.kind] = it.id;
    skinRev++; saveProfile();
    shopNote = it.premium ? [t("buyQuote"), "quote"] : [t("bought", itemName(it.id)), "ok"]; justBought = it.id;
    SND.play("coin");
    renderShop();
  } else if (b.dataset.equip) {
    const it = itemOf(b.dataset.equip);
    if (!it || !owns(it.id)) return;
    profile.equip[it.kind] = it.id; skinRev++; saveProfile();
    if (serverOn()) apiCall("/api/equip", { id: it.id }).then(applyProfile).catch(() => {});
    shopNote = null; renderShop();
  } else if (b.dataset.exchange) {
    const k = +b.dataset.exchange, [c, n] = EXCHANGE[k];
    if (profile.coins < c) { shopNoteSet(t("notEnoughCoins", c - profile.coins), "warn"); return; }
    if (serverOn()) {
      const w = await serverSpend("ex" + k);
      if (w.error === "net" || (!w.ok && w.error !== "coins")) { shopNoteSet(t("netError"), "warn"); return; }
      applyProfile(w);
      if (!w.ok) { shopNoteSet(t("notEnoughCoins", c - profile.coins), "warn"); return; }
    } else { profile.coins -= c; profile.clips += n; saveProfile(); }
    SND.play("coin");
    shopNoteSet(t("exchanged", c, n), "ok");
  } else if (b.dataset.pack) {
    if (TG && serverOn()) buyPack(+b.dataset.pack);
  } else if (b.dataset.openTg) {
    try { window.open(BOT_LINK, "_blank"); } catch (e) {}
  }
}

// ---------------- rules sheet ----------------
let lastFocus = null;
function openRules() {
  lastFocus = document.activeElement;
  $("rulesSheet").hidden = false;
  tgBack();
  setTimeout(() => { try { $("rulesClose").focus(); } catch (e) {} }, 30);
}
function closeRules() {
  $("rulesSheet").hidden = true;
  tgBack();
  if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
}

// ---------------- events ----------------
function bind() {
  document.addEventListener("pointerdown", () => SND.unlock(), { once: true, capture: true });
  document.addEventListener("click", ev => {
    const act = ev.target.closest("[data-act]");
    if (!act) return;
    const a = act.dataset.act;
    if (a === "menu") goMenu();
    else if (a === "back") goBack();
    else if (a === "settings") openScreen("settings");
    else if (a === "learn") startLearn();
    else if (a === "learnNext") learnResolve("next");
    else if (a === "learnExit") goMenu();
    else if (a === "learnPlay") startGame("x02", "x1");
    else if (a === "invite") shareGameInvite();
    else if (a === "support") openSupport();
    else if (a === "update") checkUpdate();
    else if (a === "welcomeLearn") welcomeClose(true);
    else if (a === "welcomeLater") welcomeClose(false);
    else if (a === "shareCard") shareCard(false);
    else if (a === "shareStory") shareCard(true);
    else if (a === "dare") shareDare();
    else if (a === "install") doInstall();
    else if (a === "closeInstall") closeInstall();
    else if (a === "copyGame") { try { navigator.clipboard.writeText(GAME_URL); toast(t("copied")); } catch (e) {} }
    else if (a === "rules") openRules();
    else if (a === "again") { if (app.online) onlineRematch(); else if (app.daily) startDaily(); else startGame(app.mode, app.bot ? app.bot.id : ""); }
    else if (a === "dailyShare") shareDaily();
    else if (a === "streakTake") streakTake();
    else if (a === "streakLater") { const sh = $("streakSheet"); if (sh) sh.hidden = true; }
    else if (a === "bridge") { homeHere(); if (!learnDone()) startLearn(); else startGame("x02", "x1"); }
    else if (a === "resign") onlineResign();
    else if (a === "chat") togglePhrases();
    else if (a === "share") shareInvite();
    else if (a === "copy") copyInvite();
    else if (a === "cancelGame") cancelOnline();
    else if (a === "closeOnline") closeOnlineSheet();
    else if (a === "createOnline") createOnline();
    else if (a === "loginTop") { closeOnlineSheet(); openScreen("settings"); setTimeout(showLoginWidget, 50); }
    else if (a === "undo") undo();
    else if (a === "shop") openShop();
    else if (a === "medal") toggleMedal();
    else if (a === "installSticker") { if (app.screen !== "menu") { goMenu(); setTimeout(installSticker, 700); } else installSticker(); }
    else if (a === "sign") openSign();
    else if (a === "signSave") saveSign();
    else if (a === "signLater") { const sh = $("signSheet"); if (sh) sh.hidden = true; }
    else if (a === "login") showLoginWidget();
    else if (a === "logout") logout();
  });
  // menu: screens, opponents, the cover banner
  document.addEventListener("click", ev => {
    const go = ev.target.closest("[data-go]");
    if (go) { openScreen(go.dataset.go); return; }
    const on = ev.target.closest("[data-online]");
    if (on) { openOnlineSheet(on.dataset.online); return; }
    const o = ev.target.closest(".opp[data-mode]");
    if (o) { homeHere(); startGame(o.dataset.mode, o.dataset.bot); return; }
    if (ev.target.closest("#scr-menu .lg-mark")) { openShop(); return; }        // tap your X or 0 in the logo: straight to the skins
    const bn = ev.target.closest("#coverBanner");
    if (bn) {
      const act = bn.dataset.bn || "";
      if (act === "learn") startLearn();
      else if (act === "invite") shareGameInvite();
      else if (act === "login") { openScreen("settings"); setTimeout(showLoginWidget, 50); }
      else if (act === "resume") resumeGame();
      else if (act === "install") doInstall();
      else if (act === "daily") { homeHere(); startDaily(); }
      else if (act.startsWith("og:")) { homeHere(); joinOnline(act.slice(3)); }
    }
  });
  document.querySelectorAll(".seg[data-side]").forEach(b => b.addEventListener("click", () => {
    app.side = +b.dataset.side;
    store.set("side", app.side);
    renderSettings();
  }));
  document.querySelectorAll(".seg[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  $("rulesClose").addEventListener("click", closeRules);
  $("onlineSheet").addEventListener("click", ev => {
    if (ev.target === $("onlineSheet")) { closeOnlineSheet(); return; }
    const m = ev.target.closest("[data-min]");
    if (m) { onlineMinutes = +m.dataset.min; store.set("minutes", onlineMinutes); renderOnlineSheet(); }
  });
  document.addEventListener("click", ev => {
    const tk = ev.target.closest("[data-talk]");
    if (tk) { store.set("botTalk", tk.dataset.talk === "1"); renderSettings(); }
    const sd = ev.target.closest("[data-sound]");
    if (sd) { if ((sd.dataset.sound === "1") !== SND.on) SND.toggle(); renderSettings(); }
    const hp = ev.target.closest("[data-haptics]");
    if (hp) { store.set("haptics", hp.dataset.haptics === "1"); renderSettings(); haptic("light"); }
    const ph = ev.target.closest("[data-phrase]");
    if (ph) sayPhrase(+ph.dataset.phrase);
    const fp = ev.target.closest("[data-fplay]");
    if (fp) playFriend(fp.dataset.fplay, fp.dataset.fname);
    const og = ev.target.closest("[data-og]");
    if (og) { homeHere(); joinOnline(og.dataset.og); }
  });
  document.addEventListener("error", ev => {      // a friend's photo failed to load: show the first letter instead
    const img = ev.target;
    if (img && img.tagName === "IMG" && img.parentElement && img.parentElement.classList.contains("mini-ava")) {
      const sp = document.createElement("span"); sp.textContent = img.dataset.i || "?"; img.replaceWith(sp);
    }
  }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && app.online) pollOnline(); });
  $("shopBody").addEventListener("click", shopAction);
  $("rulesSheet").addEventListener("click", ev => { if (ev.target === $("rulesSheet")) closeRules(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !$("rulesSheet").hidden) closeRules(); });
  $("welcomeSheet").addEventListener("click", ev => { if (ev.target === $("welcomeSheet")) welcomeClose(false); });
  $("installSheet").addEventListener("click", ev => { if (ev.target === $("installSheet")) closeInstall(); });

  boardEl.addEventListener("click", async ev => {
    const btn = ev.target.closest(".cell");
    if (!btn || inputBusy) return;
    const e = cur();
    if (!e || e.phase !== "main") return;
    const g = e.g;
    if (g.result || isBot(g.turn)) return;
    const i = +btn.dataset.i, b = (i / 9) | 0;
    const a = g.choosing ? 300 + b : uiMode === "strike" ? 200 + i : uiMode === "star" ? 100 + i : i;
    if (app.learn && !learnAllows(a)) { flash = t("learnTap"); renderX02(null); flash = null; return; }
    if (!E.isLegal(g, a)) {
      const al = E.allowed(g);
      flash = g.choosing ? t("fNoFree")
        : uiMode === "strike" ? t("fStrikeOnly")
        : g.cells[i] ? t("fOccupied")
        : al.length === 1 ? t("fOnlyBoard", al[0] + 1) : t("fCannot");
      renderX02(null);
      flash = null;
      return;
    }
    if (app.online) { onlineMove(a); return; }
    inputBusy = true;
    haptic("light");
    try { await doMain(a); } finally { inputBusy = false; }
    if (app.learn) { learnResolve("move", a); return; }
    kickBot();
  });
  $("preludeGrid").addEventListener("click", ev => {
    const btn = ev.target.closest(".tcell");
    const e = cur();
    if (!btn || !e || e.phase !== "prelude" || e.t.result || isBot(e.t.turn)) return;
    if (app.online) { onlineMove(+btn.dataset.i); return; }
    if (app.learn) { if (learnAllows(+btn.dataset.i) && doPrelude(+btn.dataset.i)) { haptic("light"); learnResolve("move", +btn.dataset.i); } return; }
    if (doPrelude(+btn.dataset.i)) { haptic("light"); kickBot(); }
  });
  $("tttBoard").addEventListener("click", ev => {
    const btn = ev.target.closest(".tcell");
    const e = cur();
    if (!btn || !e || e.t.result || isBot(e.t.turn)) return;
    if (app.online) { onlineMove(+btn.dataset.i); return; }
    if (doClassic(+btn.dataset.i)) { haptic("light"); kickBot(); }
  });
  $("starBtn").addEventListener("click", () => {
    if (app.learn) { if (app.learn.btn === "star") { uiMode = "star"; renderX02(null); learnResolve("move", "star"); } return; }
    uiMode = uiMode === "star" ? null : "star"; renderX02(null);
  });
  $("strikeBtn").addEventListener("click", () => {
    if (app.learn) { if (app.learn.btn === "strike") { uiMode = "strike"; renderX02(null); learnResolve("move", "strike"); } return; }
    uiMode = uiMode === "strike" ? null : "strike"; renderX02(null);
  });
  $("preludeStart").addEventListener("click", startMainFromPrelude);
  $("coinStart").addEventListener("click", startMainFromPrelude);
  $("preludeSkip").addEventListener("click", () => {
    cancelBot();
    app.history.push({ phase: "main", g: E.newMain(1) });
    renderX02(null);
    kickBot();
  });
  $("coinBtn").addEventListener("click", () => {
    const e = cur();
    if (!e || e.phase !== "prelude" || e.t.result !== 3 || e.coin || flipping) return;
    $("coinBtn").disabled = true;
    $("coinText").textContent = "…";
    $("coin").classList.remove("golden");
    flipCoin((r, golden) => {
      const c = cur();
      app.history.push(Object.assign({}, c, { coin: r, golden: golden ? 1 : 0 }));
      renderX02(null);
    });
  });
}

// ---------------- boot ----------------
function snapshot() {
  if (app.online || app.learn) return {};
  return { screen: app.screen, mode: app.mode, botId: app.bot ? app.bot.id : "", side: app.side, history: app.history, gameId: app.gameId };
}
function boot(data) {
  tgInit();
  const gid = gameFromLink(), cid = gid ? "" : challengeFromLink();
  app.linkVisit = !!(gid || cid);
  addMultTables(); document.body.classList.toggle("on-cover", app.screen === "menu");
  try { const sp = TG && TG.initDataUnsafe && TG.initDataUnsafe.start_param; if (sp === "install") setTimeout(() => { if (app.screen === "menu" && installKind()) installSticker(); }, 1800); } catch (e) {}
  handleLoginReturn().then(syncProfile).then(() => { if (gid) joinOnline(gid); else if (cid) joinChallenge(cid); else { maybeWelcome(); setTimeout(maybeStreak, 700); } });
  buildDOM();
  applyStatic();
  buildMenu();
  bind();
  const ok = data && data.mode && (data.screen === "x02" || data.screen === "classic") && Array.isArray(data.history) && data.history.length
    && (data.mode === "classic" ? !!data.history[0].t : !!data.history[0].phase);
  if (ok) {
    app.mode = data.mode;
    app.bot = data.botId ? BOTS[data.mode].find(b => b.id === data.botId) || null : null;
    app.side = data.side === 2 ? 2 : 1;
    app.history = data.history;
    app.gameId = data.gameId || 1;
    show(data.screen);
    render(null);
    kickBot();
  } else show("menu");
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(snapshot); } catch (e) {}
}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
