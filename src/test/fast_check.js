const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
E.buildWinc();
let bad = 0, steps = 0;
const buf = new Int16Array(200);
function same(s, F, where) {
  const G = E.fastFrom(s);
  for (let k = 0; k < G.length; k++) if (G[k] !== F[k]) { if (bad++ < 5) console.log('MISMATCH at', where, 'idx', k, 'ref', G[k], 'fast', F[k]); return false; }
  return true;
}
for (let g = 0; g < 4000; g++) {
  let s = E.newMain(1 + (g % 2), g % 3 === 0 ? { 1: 2, 2: 1 } : g % 5 === 0 ? { 1: 3, 2: 3 } : null);
  let F = E.fastFrom(s);
  let guard = 0;
  while (!s.result && guard++ < 600) {
    const ref = E.legal(s).slice().sort((a, b) => a - b);
    const n = E.fastLegal(F, buf);
    const fl = Array.from(buf.slice(0, n)).sort((a, b) => a - b);
    if (ref.join() !== fl.join()) { if (bad++ < 5) console.log('LEGAL MISMATCH', ref.length, fl.length); break; }
    // bias towards stars and strikes so they get exercised
    let a;
    const sp = ref.filter(x => x >= 100);
    a = (sp.length && Math.random() < 0.3) ? sp[(Math.random() * sp.length) | 0] : ref[(Math.random() * ref.length) | 0];
    s = E.applyMut(s, a); E.fastApply(F, a); steps++;
    if (!same(s, F, 'game ' + g + ' step ' + guard + ' a=' + a)) break;
  }
}
console.log('steps checked', steps, 'mismatches', bad);
// rollout sanity + speed
let s0 = E.newMain(1), t0 = Date.now(), res = { 1: 0, 2: 0, 3: 0 }, nRoll = 0;
const r = E.think2(s0, 1000, { seed: 7 });
console.log('think2 1s from start: iters', r.iters, 'nodes', r.search.nodes, 'best', r.action);
const old = E.think(s0, 1000);
console.log('old think 1s: iters', old.iters);
