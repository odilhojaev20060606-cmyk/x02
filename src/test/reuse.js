const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
function acts(log) { const o = []; for (const e of log) { if (e.k === 'm') o.push(e.i); else if (e.k === 's') o.push(200 + e.i); else { o.push(100 + e.i); if (e.to >= 0) o.push(300 + e.to); } } return o; }
let keep = null, keepActs = [], reusedCount = 0, total = 0;
let s = E.newMain(1, { 1: 1, 2: 1 });
const t0 = Date.now();
while (!s.result) {
  let a;
  if (s.turn === 1) {
    const A = acts(s.log); let reuse = null, path = null;
    if (keep && A.length >= keepActs.length && keepActs.every((x, i) => x === A[i])) { reuse = keep; path = A.slice(keepActs.length); }
    const se = E.createSearch2(E.cloneLite(s), { reuse, path, cap: 220000 });
    se.step(400); total++; if (se.reused) reusedCount++;
    a = se.best(); keep = se.keep(); keepActs = A;
  } else a = E.think(s, 150).action;
  s = E.applyMut(s, a);
}
console.log('result', s.result, 'moves', s.moves, '| new-bot turns', total, 'tree reused', reusedCount, '|', ((Date.now() - t0) / 1000).toFixed(1) + 's');
