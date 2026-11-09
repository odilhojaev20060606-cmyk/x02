const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
// speed
let s = E.newMain(1);
let r = E.think(s, 1000); console.log('iterations in 1s from empty board:', r.iters);
s = E.newMain(1, {1: 2, 2: 2}); for (let k = 0; k < 20; k++) { const a = E.legal(s); s = E.apply(s, a[(Math.random()*a.length)|0]); if (s.result) break; }
if (!s.result) { r = E.think(s, 1000); console.log('iterations in 1s mid-game with stars:', r.iters); }

function play(msX, msO, label) { // ms null = random player
  let st = E.newMain(1);
  while (!st.result) {
    const ms = st.turn === 1 ? msX : msO;
    let a;
    if (ms === null) { const acts = E.legal(st); a = acts[(Math.random()*acts.length)|0]; }
    else a = E.think(st, ms).action;
    st = E.applyMut(st, a);
  }
  return st.result;
}
const t0 = Date.now();
let w = { 1: 0, 2: 0, 3: 0 };
for (let g = 0; g < 6; g++) { const bx = g % 2 === 0; const res = bx ? play(150, null) : play(null, 150); const botWon = (bx && res === 1) || (!bx && res === 2); w[botWon ? 1 : res === 3 ? 3 : 2]++; }
console.log('MCTS 150ms vs random — bot wins', w[1], 'losses', w[2], 'draws', w[3], (Date.now()-t0)/1000 + 's');
w = { strong: 0, weak: 0, draw: 0 };
for (let g = 0; g < 6; g++) { const sx = g % 2 === 0; const res = sx ? play(600, 100) : play(100, 600); const strongWon = (sx && res === 1) || (!sx && res === 2); if (res === 3) w.draw++; else if (strongWon) w.strong++; else w.weak++; }
console.log('MCTS 600ms vs 100ms —', JSON.stringify(w), (Date.now()-t0)/1000 + 's');
