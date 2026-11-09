// X02.0 engine: rules for the main game, the classic 3x3 game, and the bots.
// Written as one self-contained function so the same source can run on the page and inside a Web Worker.
function ENGINE() {
  "use strict";
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const CL = [[], [], [], [], [], [], [], [], []];
  for (const l of LINES) for (const i of l) CL[i].push(l);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  // ================= main game =================
  // Players: 1 = X, 2 = O. Cell index i = board * 9 + cell.
  // Actions: 0..80 place, 100..180 place a star (navigator), 200..280 strike, 300..308 choose the opponent's board.
  function newMain(first, bonus) {
    const stars = [0, 0, 0];
    if (bonus) { stars[1] = bonus[1] || 0; stars[2] = bonus[2] || 0; }
    return {
      cells: new Array(81).fill(0), star: new Array(81).fill(0),
      owner: new Array(9).fill(0),      // 0 open, 1 X, 2 O, 3 neutral (draw)
      filled: new Array(9).fill(0),
      stars, turn: first || 1, active: -1, choosing: 0, free: 0,
      result: 0, byCount: 0, secret: -1, winLine: null, last: -1, moves: 0, log: []
    };
  }
  function cloneLite(s) {
    return {
      cells: s.cells.slice(), star: s.star.slice(), owner: s.owner.slice(), filled: s.filled.slice(),
      stars: s.stars.slice(), turn: s.turn, active: s.active, choosing: s.choosing, free: s.free,
      result: s.result, byCount: s.byCount, secret: s.secret, winLine: s.winLine, last: s.last, moves: s.moves, log: null
    };
  }
  function cloneFull(s) {
    const n = cloneLite(s);
    n.log = s.log ? s.log.map(e => Object.assign({}, e)) : [];
    return n;
  }
  function allowed(s) {
    if (s.result) return [];
    if (!s.choosing && s.active >= 0 && s.filled[s.active] < 9) return [s.active];
    const r = [];
    for (let b = 0; b < 9; b++) if (s.filled[b] < 9) r.push(b);
    return r;
  }
  function mainLine(owner) {
    for (const l of LINES) {
      const v = owner[l[0]];
      if ((v === 1 || v === 2) && owner[l[1]] === v && owner[l[2]] === v) return l;
    }
    return null;
  }
  function noRowPossible(owner) {
    for (const l of LINES) {
      let x = 0, o = 0, d = 0;
      for (const i of l) { const v = owner[i]; if (v === 1) x++; else if (v === 2) o++; else if (v === 3) d++; }
      if (!d && !(x && o)) return false;
    }
    return true;
  }
  function count(owner) {
    let x = 0, o = 0;
    for (const v of owner) { if (v === 1) x++; else if (v === 2) o++; }
    return [0, x, o];
  }
  function finishByCount(s) {
    const k = count(s.owner);
    s.result = k[1] > k[2] ? 1 : k[2] > k[1] ? 2 : 3;
    s.byCount = 1;
  }
  function shouldEnd(s) {
    let open = false, undecided = false;
    for (let b = 0; b < 9; b++) { if (s.filled[b] < 9) open = true; if (s.owner[b] === 0) undecided = true; }
    return !open || (!undecided && noRowPossible(s.owner));
  }
  function legal(s) {
    const acts = [];
    if (s.result) return acts;
    const bs = allowed(s);
    if (s.choosing) { for (const b of bs) acts.push(300 + b); return acts; }
    const p = s.turn, o = 3 - p, st = s.stars[p];
    for (const b of bs) {
      const base = b * 9;
      for (let c = 0; c < 9; c++) {
        const i = base + c;
        if (s.cells[i] === 0) { acts.push(i); if (st >= 1) acts.push(100 + i); }
        else if (st >= 2 && s.owner[b] === 0 && s.cells[i] === o) acts.push(200 + i);
      }
    }
    return acts;
  }
  const isLegal = (s, a) => legal(s).indexOf(a) >= 0;

  function applyMut(s, a) {
    const p = s.turn, o = 3 - p;
    if (a >= 300) {                                   // navigator: choose the opponent's board
      const t = a - 300;
      s.choosing = 0; s.free = 0; s.active = t; s.turn = o;
      if (s.log && s.log.length) s.log[s.log.length - 1].to = t;
      return s;
    }
    if (a >= 200) {                                   // strike: remove an opponent's mark (2 stars)
      const i = a - 200, b = (i / 9) | 0, c = i % 9;
      s.cells[i] = 0; s.star[i] = 0; s.filled[b]--; s.stars[p] -= 2;
      s.last = i; s.moves++;
      if (s.log) s.log.push({ p, i, k: "s", to: -1, note: "" });
      s.turn = o; s.active = c; s.free = 0;
      if (shouldEnd(s)) finishByCount(s);
      return s;
    }
    const isStar = a >= 100;
    const i = isStar ? a - 100 : a, b = (i / 9) | 0, c = i % 9, base = b * 9;
    s.cells[i] = p; s.filled[b]++; s.last = i; s.moves++; s.free = 0;
    if (isStar) { s.star[i] = 1; s.stars[p]--; }
    const entry = s.log ? { p, i, k: isStar ? "n" : "m", to: -1, note: "" } : null;
    let won = false;
    if (s.owner[b] === 0) {
      let row = false;
      for (const l of CL[c]) {
        if (s.cells[base + l[0]] === p && s.cells[base + l[1]] === p && s.cells[base + l[2]] === p) { row = true; break; }
      }
      if (row) { s.owner[b] = p; s.stars[p]++; won = true; if (entry) entry.note = "won"; }
      else if (s.filled[b] === 9) { s.owner[b] = 3; if (entry) entry.note = "draw"; }
    }
    if (entry) s.log.push(entry);
    // Secret rule: a whole small board of one player's marks wins outright.
    if (s.filled[b] === 9) {
      let all = true;
      for (let k = 0; k < 9; k++) if (s.cells[base + k] !== p) { all = false; break; }
      if (all) { s.result = p; s.secret = b; return s; }
    }
    const w = mainLine(s.owner);
    if (w) { s.result = s.owner[w[0]]; s.winLine = w; return s; }
    if (shouldEnd(s)) { finishByCount(s); return s; }
    if (isStar && !won) { s.choosing = 1; }
    else { s.turn = o; s.active = won ? -1 : c; s.free = won ? 1 : 0; }   // comeback: the loser of a board moves anywhere
    return s;
  }
  const apply = (s, a) => applyMut(cloneFull(s), a);

  // ---------- bot: Monte Carlo tree search ----------
  function rolloutMove(s) {
    const p = s.turn, o = 3 - p;
    let bs;
    if (!s.choosing && s.active >= 0 && s.filled[s.active] < 9) bs = [s.active];
    else { bs = []; for (let b = 0; b < 9; b++) if (s.filled[b] < 9) bs.push(b); }
    if (s.choosing) return 300 + bs[(Math.random() * bs.length) | 0];
    const em = [];
    let winMain = -1, winBoard = -1;
    for (const b of bs) {
      const base = b * 9, open = s.owner[b] === 0;
      for (let c = 0; c < 9; c++) {
        const i = base + c;
        if (s.cells[i] !== 0) continue;
        em.push(i);
        if (open && winMain < 0) {
          let row = false;
          for (const l of CL[c]) {
            let n = 0;
            for (const k of l) if (k !== c && s.cells[base + k] === p) n++;
            if (n === 2) { row = true; break; }
          }
          if (row) {
            winBoard = i;
            for (const l of CL[b]) {
              let n = 0;
              for (const k of l) if (k !== b && s.owner[k] === p) n++;
              if (n === 2) { winMain = i; break; }
            }
          }
        }
      }
    }
    if (winMain >= 0) return winMain;
    if (winBoard >= 0 && Math.random() < 0.85) return winBoard;
    const st = s.stars[p];
    if (st >= 2 && Math.random() < 0.05) {
      const tg = [];
      for (const b of bs) if (s.owner[b] === 0) for (let c = 0; c < 9; c++) if (s.cells[b * 9 + c] === o) tg.push(200 + b * 9 + c);
      if (tg.length) return tg[(Math.random() * tg.length) | 0];
    }
    const i = em[(Math.random() * em.length) | 0];
    if (st >= 1 && Math.random() < 0.1) return 100 + i;
    return i;
  }

  function createSearch(rootState, opts) {
    const C = (opts && opts.c) || 0.9;
    const root = { a: -1, p: 0, parent: null, kids: [], untried: legal(rootState), N: 0, W: 0 };
    let iters = 0, forced = -1;
    if (root.untried.length === 1) forced = root.untried[0];
    else {
      for (const a of root.untried) {
        const t = applyMut(cloneLite(rootState), a);
        if (t.result === rootState.turn) { forced = a; break; }
      }
    }
    function iterate() {
      let node = root;
      const s = cloneLite(rootState);
      while (node.untried.length === 0 && node.kids.length > 0) {
        const lnN = Math.log(node.N);
        let best = null, bv = -Infinity;
        for (const k of node.kids) {
          const v = k.W / k.N + C * Math.sqrt(lnN / k.N);
          if (v > bv) { bv = v; best = k; }
        }
        node = best;
        applyMut(s, node.a);
      }
      if (node.untried.length > 0 && !s.result) {
        const j = (Math.random() * node.untried.length) | 0, a = node.untried[j];
        node.untried[j] = node.untried[node.untried.length - 1];
        node.untried.pop();
        const mover = s.turn;
        applyMut(s, a);
        const kid = { a, p: mover, parent: node, kids: [], untried: s.result ? [] : legal(s), N: 0, W: 0 };
        node.kids.push(kid);
        node = kid;
      }
      let g = 0;
      while (!s.result && g++ < 400) applyMut(s, rolloutMove(s));
      const r = s.result || 3;
      for (let n = node; n; n = n.parent) { n.N++; if (n.p) n.W += r === n.p ? 1 : (r === 3 ? 0.5 : 0); }
      iters++;
    }
    return {
      step(ms) {
        if (forced >= 0 || root.untried.length + root.kids.length === 0) return;
        const t0 = Date.now();
        do { for (let k = 0; k < 24; k++) iterate(); } while (Date.now() - t0 < ms);
      },
      best() {
        if (forced >= 0) return forced;
        let b = null;
        for (const k of root.kids) if (!b || k.N > b.N) b = k;
        return b ? b.a : root.untried[0];
      },
      get iters() { return iters; },
      get done() { return forced >= 0; }
    };
  }
  function think(state, ms) {
    const s = createSearch(state);
    s.step(ms);
    return { action: s.best(), iters: s.iters };
  }

  // ================= classic 3x3 (Ностальгия and the warm-up) =================
  function newTTT(first) { return { b: new Array(9).fill(0), turn: first || 1, result: 0, line: null, last: -1 }; }
  function tttRes(b) {
    for (const l of LINES) { const v = b[l[0]]; if (v && v === b[l[1]] && v === b[l[2]]) return v; }
    for (let i = 0; i < 9; i++) if (!b[i]) return 0;
    return 3;
  }
  function tttLine(b) {
    for (const l of LINES) { const v = b[l[0]]; if (v && v === b[l[1]] && v === b[l[2]]) return l; }
    return null;
  }
  function tttApply(t, i) {
    if (t.result || t.b[i]) return null;
    const n = { b: t.b.slice(), turn: t.turn, result: 0, line: null, last: i };
    n.b[i] = t.turn;
    const r = tttRes(n.b);
    if (r) { n.result = r; n.line = tttLine(n.b); } else n.turn = 3 - t.turn;
    return n;
  }
  const empties = b => { const r = []; for (let i = 0; i < 9; i++) if (!b[i]) r.push(i); return r; };
  const memo = new Map();
  function negamax(b, turn) {          // score for the player to move; faster wins score higher
    const key = b.join("") + turn;
    const m = memo.get(key);
    if (m !== undefined) return m;
    const r = tttRes(b);
    let v;
    if (r === 3) v = 0;
    else if (r) v = -(1 + empties(b).length);
    else {
      v = -Infinity;
      for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const x = -negamax(b, 3 - turn); b[i] = 0; if (x > v) v = x; }
    }
    memo.set(key, v);
    return v;
  }
  function moveValue(b, i, turn) { b[i] = turn; const v = -negamax(b, 3 - turn); b[i] = 0; return v; }
  function winsAt(b, i, p) { if (b[i]) return false; b[i] = p; const w = tttRes(b) === p; b[i] = 0; return w; }
  const coopMemo = new Map();
  // For a bot that wants to LOSE the warm-up (to take the first move): 2 = opponent wins, 1 = draw, 0 = bot wins.
  function coop(b, turn, bot) {
    const key = b.join("") + turn + bot;
    const m = coopMemo.get(key);
    if (m !== undefined) return m;
    const r = tttRes(b);
    let v;
    if (r) v = r === 3 ? 1 : (r === bot ? 0 : 2);
    else {
      v = -1;
      for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const x = coop(b, 3 - turn, bot); b[i] = 0; if (x > v) v = x; }
    }
    coopMemo.set(key, v);
    return v;
  }
  function tttBot(t, level, goal) {
    const b = t.b.slice(), me = t.turn, op = 3 - me, em = empties(b);
    if (!em.length || t.result) return -1;
    if (goal === "lose") {
      let bv = -1, bs = [];
      for (const i of em) { b[i] = me; const v = coop(b, op, me); b[i] = 0; if (v > bv) { bv = v; bs = [i]; } else if (v === bv) bs.push(i); }
      return pick(bs);
    }
    const best = () => {
      let bv = -Infinity, bs = [];
      for (const i of em) { const v = moveValue(b, i, me); if (v > bv) { bv = v; bs = [i]; } else if (v === bv) bs.push(i); }
      return pick(bs);
    };
    if (level >= 3) return best();
    const win = em.filter(i => winsAt(b, i, me));
    if (win.length) return pick(win);
    const block = em.filter(i => winsAt(b, i, op));
    if (level === 2) {               // plays perfectly; its mistakes are scheduled by the app (every 5–7 games)
      if (block.length) return pick(block);
      return best();
    }
    if (block.length && Math.random() < 0.8) return pick(block);
    if (Math.random() < 0.22) return pick(em);
    return best();
  }

  // ================= fast engine for the strongest bot (bit masks) =================
  // Same rules as applyMut, packed into an Int32Array. Index map:
  const FX = 0, FO = 9, FOWN = 18, FMX = 27, FMO = 28, FMD = 29, FSX = 30, FSO = 31, FTURN = 32, FACT = 33, FCHO = 34, FRES = 35, FFREE = 36, FLEN = 37;
  const LINE_MASKS = LINES.map(l => (1 << l[0]) | (1 << l[1]) | (1 << l[2]));
  const WIN = new Uint8Array(512), POP = new Uint8Array(512), BITS = [];
  for (let m = 0; m < 512; m++) {
    for (const L of LINE_MASKS) if ((m & L) === L) { WIN[m] = 1; break; }
    const bl = [];
    for (let c = 0; c < 9; c++) if (m & (1 << c)) bl.push(c);
    POP[m] = bl.length; BITS.push(bl);
  }
  let WINC = null;   // WINC[(my << 9) | other] = empty cells that complete one of my lines
  function buildWinc() {
    WINC = new Uint16Array(1 << 18);
    for (let my = 0; my < 512; my++) for (let ot = 0; ot < 512; ot++) {
      if (my & ot) continue;
      const occ = my | ot;
      let r = 0;
      for (let c = 0; c < 9; c++) { const bit = 1 << c; if (!(occ & bit) && WIN[my | bit]) r |= bit; }
      WINC[(my << 9) | ot] = r;
    }
  }
  let rs = (Date.now() ^ 0x9e3779b9) | 0 || 1;
  const rnd = () => { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; };
  const seed = s => { rs = (s | 0) || 1; };

  function fastFrom(s) {
    const F = new Int32Array(FLEN);
    for (let b = 0; b < 9; b++) {
      let x = 0, o = 0;
      for (let c = 0; c < 9; c++) { const v = s.cells[b * 9 + c]; if (v === 1) x |= 1 << c; else if (v === 2) o |= 1 << c; }
      F[FX + b] = x; F[FO + b] = o; F[FOWN + b] = s.owner[b];
      if (s.owner[b] === 1) F[FMX] |= 1 << b; else if (s.owner[b] === 2) F[FMO] |= 1 << b; else if (s.owner[b] === 3) F[FMD] |= 1 << b;
    }
    F[FSX] = s.stars[1]; F[FSO] = s.stars[2]; F[FTURN] = s.turn; F[FACT] = s.active;
    F[FCHO] = s.choosing; F[FRES] = s.result; F[FFREE] = s.free;
    return F;
  }
  function fastShouldEnd(F) {
    let open = false;
    for (let b = 0; b < 9; b++) if ((F[FX + b] | F[FO + b]) !== 511) { open = true; break; }
    if (!open) return true;
    if ((F[FMX] | F[FMO] | F[FMD]) !== 511) return false;
    for (const L of LINE_MASKS) if (!(L & F[FMD]) && !((L & F[FMX]) && (L & F[FMO]))) return false;
    return true;
  }
  function fastFinishCount(F) { const x = POP[F[FMX]], o = POP[F[FMO]]; F[FRES] = x > o ? 1 : o > x ? 2 : 3; }
  function fastApply(F, a) {
    const p = F[FTURN], o = 3 - p;
    if (a >= 300) { F[FCHO] = 0; F[FFREE] = 0; F[FACT] = a - 300; F[FTURN] = o; return; }
    if (a >= 200) {
      const i = a - 200, b = (i / 9) | 0, c = i - b * 9;
      F[(o === 1 ? FX : FO) + b] &= ~(1 << c);
      F[p === 1 ? FSX : FSO] -= 2;
      F[FTURN] = o; F[FACT] = c; F[FFREE] = 0;
      if (fastShouldEnd(F)) fastFinishCount(F);
      return;
    }
    const star = a >= 100, i = star ? a - 100 : a, b = (i / 9) | 0, c = i - b * 9;
    const mi = (p === 1 ? FX : FO) + b, pm = F[mi] | (1 << c);
    F[mi] = pm;
    if (star) F[p === 1 ? FSX : FSO]--;
    F[FFREE] = 0;
    const full = (pm | F[(p === 1 ? FO : FX) + b]) === 511;
    let won = false;
    if (F[FOWN + b] === 0) {
      if (WIN[pm]) { F[FOWN + b] = p; F[p === 1 ? FMX : FMO] |= 1 << b; F[p === 1 ? FSX : FSO]++; won = true; }
      else if (full) { F[FOWN + b] = 3; F[FMD] |= 1 << b; }
    }
    if (full && pm === 511) { F[FRES] = p; return; }
    if (won && WIN[F[p === 1 ? FMX : FMO]]) { F[FRES] = p; return; }
    if (fastShouldEnd(F)) { fastFinishCount(F); return; }
    if (star && !won) F[FCHO] = 1;
    else { F[FTURN] = o; F[FACT] = won ? -1 : c; F[FFREE] = won ? 1 : 0; }
  }
  function fastAllowedMask(F) {
    if (F[FRES]) return 0;
    const act = F[FACT];
    if (!F[FCHO] && act >= 0 && (F[FX + act] | F[FO + act]) !== 511) return 1 << act;
    let m = 0;
    for (let b = 0; b < 9; b++) if ((F[FX + b] | F[FO + b]) !== 511) m |= 1 << b;
    return m;
  }
  function fastLegal(F, out) {
    const am = fastAllowedMask(F);
    let n = 0;
    if (!am) return 0;
    if (F[FCHO]) { for (let b = 0; b < 9; b++) if (am & (1 << b)) out[n++] = 300 + b; return n; }
    const p = F[FTURN], st = F[p === 1 ? FSX : FSO];
    for (let b = 0; b < 9; b++) {
      if (!(am & (1 << b))) continue;
      const xm = F[FX + b], om = F[FO + b], em = 511 & ~(xm | om), opp = p === 1 ? om : xm, open = F[FOWN + b] === 0;
      for (let c = 0; c < 9; c++) {
        const bit = 1 << c, i = b * 9 + c;
        if (em & bit) { out[n++] = i; if (st >= 1) out[n++] = 100 + i; }
        else if (st >= 2 && open && (opp & bit)) out[n++] = 200 + i;
      }
    }
    return n;
  }
  // cells of board b where player p would complete a line (only boards nobody owns yet)
  const winCells = (F, p, b) => F[FOWN + b] !== 0 ? 0 : WINC[((p === 1 ? F[FX + b] : F[FO + b]) << 9) | (p === 1 ? F[FO + b] : F[FX + b])];
  // boards whose capture would complete p's line on the main board
  const mainWins = (F, p) => WINC[((p === 1 ? F[FMX] : F[FMO]) << 9) | ((p === 1 ? F[FMO] : F[FMX]) | F[FMD])];

  // ---------- heavy rollout policy ----------
  const RB = new Int16Array(96);
  function rolloutStep(F) {
    const p = F[FTURN], o = 3 - p, am = fastAllowedMask(F);
    const mainOpp = mainWins(F, o);
    if (F[FCHO]) {   // navigator: send the opponent where they cannot win anything at once
      let n = 0, nb = 0, any = 0;
      for (let b = 0; b < 9; b++) {
        if (!(am & (1 << b))) continue;
        any = b;
        const w = winCells(F, o, b);
        if (!w) RB[n++] = b; else if (!(mainOpp & (1 << b))) RB[48 + nb++] = b;
      }
      if (n) return 300 + RB[(rnd() * n) | 0];
      if (nb) return 300 + RB[48 + ((rnd() * nb) | 0)];
      return 300 + any;
    }
    const mainMine = mainWins(F, p);
    let nw = 0;
    for (let b = 0; b < 9; b++) {
      if (!(am & (1 << b))) continue;
      const w = winCells(F, p, b);
      if (!w) continue;
      const bl = BITS[w];
      if (mainMine & (1 << b)) return b * 9 + bl[0];             // wins the whole game
      RB[nw++] = b * 9 + bl[(rnd() * bl.length) | 0];
    }
    if (nw && rnd() < 0.9) return RB[(rnd() * nw) | 0];         // wins a small board
    // block a board the opponent is about to win (if we are in it), sometimes
    // collect empty cells
    let n = 0;
    for (let b = 0; b < 9; b++) {
      if (!(am & (1 << b))) continue;
      const bl = BITS[511 & ~(F[FX + b] | F[FO + b])];
      for (let k = 0; k < bl.length; k++) RB[n++] = b * 9 + bl[k];
    }
    // opponent's chances if they get a free move
    let freeG = -1;
    const dangerOf = (b, c) => {   // after our move at (b,c): 2 = opponent can win the game, 1 = a board, 0 = safe
      let t = c;
      const fullT = t === b ? ((F[FX + b] | F[FO + b] | (1 << c)) === 511) : ((F[FX + t] | F[FO + t]) === 511);
      if (fullT) {
        if (freeG < 0) { freeG = 0; for (let k = 0; k < 9; k++) { const w = winCells(F, o, k); if (w) { if (mainOpp & (1 << k)) { freeG = 2; break; } freeG = 1; } } }
        return freeG;
      }
      if (F[FOWN + t] !== 0) return 0;
      let w;
      if (t === b) {
        const pmask = (p === 1 ? F[FX + b] : F[FO + b]) | (1 << c), omask = p === 1 ? F[FO + b] : F[FX + b];
        w = WINC[(omask << 9) | pmask];
      } else w = winCells(F, o, t);
      return !w ? 0 : (mainOpp & (1 << t)) ? 2 : 1;
    };
    const st = F[p === 1 ? FSX : FSO];
    let fallback = -1, okBoard = -1;
    for (let k = 0; k < 5; k++) {
      const i = RB[(rnd() * n) | 0], b = (i / 9) | 0, c = i - b * 9;
      const d = dangerOf(b, c);
      if (d === 0) return i;
      if (d === 1 && okBoard < 0) okBoard = i;
      if (fallback < 0) fallback = i;
    }
    if (st >= 1 && rnd() < 0.7) return 100 + (okBoard >= 0 ? okBoard : fallback);   // use a star to choose the target
    if (okBoard >= 0) return okBoard;
    return fallback;
  }
  function fastRollout(F) {
    let g = 0;
    while (!F[FRES] && g++ < 400) fastApply(F, rolloutStep(F));
    return F[FRES] || 3;
  }

  // ---------- move ordering (prior knowledge for the tree) ----------
  function orderMoves(F, buf, n) {
    const p = F[FTURN], o = 3 - p, mainMine = mainWins(F, p), mainOpp = mainWins(F, o);
    const myW = new Int32Array(9), opW = new Int32Array(9);
    let oppAnyG = 0, oppAnyB = 0;
    for (let b = 0; b < 9; b++) {
      myW[b] = winCells(F, p, b); opW[b] = winCells(F, o, b);
      if (opW[b] && (F[FX + b] | F[FO + b]) !== 511) { oppAnyB = 1; if (mainOpp & (1 << b)) oppAnyG = 1; }
    }
    const sendPenalty = (b, c, wonHere) => {
      const fullT = c === b ? ((F[FX + b] | F[FO + b] | (1 << c)) === 511) : ((F[FX + c] | F[FO + c]) === 511);
      if (wonHere || fullT) return (oppAnyG ? 5000 : 0) + (oppAnyB ? 40 : 0) + 15;
      if (F[FOWN + c] !== 0) return 0;
      let w;
      if (c === b) w = WINC[((p === 1 ? F[FO + b] : F[FX + b]) << 9) | ((p === 1 ? F[FX + b] : F[FO + b]) | (1 << c))];
      else w = opW[c];
      return !w ? 0 : (mainOpp & (1 << c)) ? 5000 : 45;
    };
    const sc = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const a = buf[k];
      let s = 0;
      if (a >= 300) {
        const t = a - 300;
        s = opW[t] ? ((mainOpp & (1 << t)) ? -5000 : -45) : 0;
      } else if (a >= 200) {
        const i = a - 200, b = (i / 9) | 0, c = i - b * 9, bit = 1 << c;
        const om = p === 1 ? F[FO + b] : F[FX + b], pm = p === 1 ? F[FX + b] : F[FO + b];
        const breaks = opW[b] && !WINC[((om & ~bit) << 9) | pm];
        s = (breaks ? 50 : -40) - (F[FOWN + c] === 0 && opW[c] && c !== b ? 45 : 0);
      } else {
        const star = a >= 100, i = star ? a - 100 : a, b = (i / 9) | 0, c = i - b * 9, bit = 1 << c;
        const wins = (myW[b] & bit) !== 0;
        if (wins) s += (mainMine & (1 << b)) ? 100000 : 120;
        if (opW[b] & bit) s += 70;
        s += c === 4 ? 3 : (c & 1) ? 0 : 1;
        if (star) s += wins ? -80 : -25;          // a star that wins the board is wasted (free move for the opponent)
        else s -= sendPenalty(b, c, wins);
        if (star && wins) s -= sendPenalty(b, c, true);
      }
      sc[k] = s + rnd() * 0.5;
    }
    const idx = Array.from({ length: n }, (_, k) => k).sort((x, y) => sc[y] - sc[x]);
    const out = new Int16Array(n);
    for (let k = 0; k < n; k++) out[k] = buf[idx[k]];
    return out;
  }

  // ---------- the strongest search: MCTS + solver + progressive widening + tree reuse ----------
  function createSearch2(rootState, opts) {
    if (!WINC) buildWinc();
    opts = opts || {};
    if (opts.seed) seed(opts.seed);
    const C = opts.c || 0.7, CAP = opts.cap || 250000;
    const F0 = fastFrom(rootState), F = new Int32Array(FLEN), LB = new Int16Array(200);
    const mk = (a, p, parent, mover) => ({ a, p, parent, mover, kids: null, moves: null, nExp: 0, N: 0, W: 0, proof: 0 });
    let root = null, nodes = 0, iters = 0;
    if (opts.reuse && opts.reuse.root && opts.path) {     // continue the previous tree along the moves played since
      let r = opts.reuse.root;
      const G = new Int32Array(opts.reuse.F);
      for (const a of opts.path) {
        fastApply(G, a);
        r = r && r.kids ? r.kids.find(k => k.a === a) || null : null;
      }
      let same = !!r;
      for (let k = 0; same && k < FLEN; k++) if (G[k] !== F0[k]) same = false;
      if (same) { root = r; root.parent = null; root.p = 0; nodes = Math.floor((opts.reuse.nodes || 0) * 0.3); }
    }
    const reusedFlag = !!root;
    if (!root) root = mk(-1, 0, null, F0[FTURN]);
    if (F0[FRES]) root.proof = F0[FRES];
    let forced = -1;
    {
      const n = fastLegal(F0, LB);
      if (n === 1) forced = LB[0];
      for (let k = 0; forced < 0 && k < n; k++) { F.set(F0); fastApply(F, LB[k]); if (F[FRES] === F0[FTURN]) forced = LB[k]; }
    }
    function tryProve(nd) {
      const m = nd.mover;
      let all = nd.moves && nd.nExp === nd.moves.length, draw = false;
      for (const k of nd.kids) {
        if (k.proof === m) { nd.proof = m; return; }
        if (!k.proof) all = false; else if (k.proof === 3) draw = true;
      }
      if (all) nd.proof = draw ? 3 : 3 - m;
    }
    function iterate() {
      let nd = root;
      F.set(F0);
      for (;;) {
        if (nd.proof || F[FRES]) break;
        if (!nd.moves) { const n = fastLegal(F, LB); nd.moves = orderMoves(F, LB, n); }
        const limit = Math.min(nd.moves.length, 2 + Math.floor(1.6 * Math.sqrt(nd.N)));
        if (nd !== root && !nd.kids && nd.N < 3) break;           // evaluate a fresh leaf a few times before growing it
        if (nd.nExp < limit && nodes < CAP) {
          const a = nd.moves[nd.nExp++], mover = F[FTURN];
          fastApply(F, a);
          const kid = mk(a, mover, nd, F[FTURN]);
          nodes++;
          if (F[FRES]) kid.proof = F[FRES];
          (nd.kids || (nd.kids = [])).push(kid);
          nd = kid;
          break;
        }
        if (!nd.kids) break;
        const m = nd.mover, lnN = Math.log(nd.N + 1);
        let best = null, bv = -1e9;
        for (const k of nd.kids) {
          if (k.proof === m) { best = k; break; }
          const v = k.proof ? (k.proof === 3 ? 0.5 : -1) : k.W / k.N + C * Math.sqrt(lnN / k.N);
          if (v > bv) { bv = v; best = k; }
        }
        fastApply(F, best.a);
        nd = best;
      }
      const r = nd.proof || F[FRES] || fastRollout(F);
      let child = null;
      for (let x = nd; x; x = x.parent) {
        x.N++;
        if (x.p) x.W += r === x.p ? 1 : r === 3 ? 0.5 : 0;
        if (!x.proof && x.kids && child && child.proof) tryProve(x);
        child = x;
      }
      iters++;
    }
    return {
      step(ms) {
        if (forced >= 0) return;
        const t0 = Date.now();
        do { for (let k = 0; k < 16 && !root.proof; k++) iterate(); } while (!root.proof && Date.now() - t0 < ms);
      },
      best() {
        if (forced >= 0) return forced;
        const m = root.mover;
        let best = null;
        for (const k of root.kids || []) if (k.proof === m) return k.a;
        for (const k of root.kids || []) { if (k.proof && k.proof !== 3) continue; if (!best || k.N > best.N) best = k; }
        if (!best) for (const k of root.kids || []) if (!best || k.N > best.N) best = k;
        if (best) return best.a;
        const n = fastLegal(F0, LB);
        return LB[0];
      },
      stats() {
        if (forced >= 0) return { forced, kids: [], mover: root.mover };
        return { forced: -1, mover: root.mover, kids: (root.kids || []).map(k => [k.a, k.N, k.W, k.proof]) };
      },
      keep() { return { root, F: Array.from(F0), nodes }; },
      get iters() { return iters; },
      get nodes() { return nodes; },
      get reused() { return reusedFlag; },
      get done() { return forced >= 0 || !!root.proof; }
    };
  }
  function think2(state, ms, opts) {
    const s = createSearch2(state, opts);
    s.step(ms);
    return { action: s.best(), iters: s.iters, stats: s.stats(), search: s };
  }

  // A deliberate mistake: a move after which the opponent can force a win (used once, for the "chance" game).
  function tttBlunder(t) {
    const b = t.b.slice(), me = t.turn, em = empties(b);
    const losing = em.filter(i => !winsAt(b, i, me) && moveValue(b, i, me) < 0);
    return losing.length ? pick(losing) : -1;
  }

  return {
    LINES, newMain, tttBlunder, createSearch2, think2, fastFrom, fastApply, fastLegal, buildWinc, cloneLite, cloneFull, allowed, legal, isLegal, apply, applyMut, count, noRowPossible,
    createSearch, think, rolloutMove,
    newTTT, tttApply, tttBot, tttRes
  };
}
