const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const I = (b, c) => (b - 1) * 9 + (c - 1); // 1-based board-cell -> index

// chat opening: X 1-5, O 5-5, X 5-3, O 3-5, X 5-1, O 1-1, X 1-2, O 2-3 -> X must play in board 3
let s = E.newMain(1);
for (const [b, c] of [[1,5],[5,5],[5,3],[3,5],[5,1],[1,1],[1,2],[2,3]]) { ok(E.isLegal(s, I(b, c)), 'chat legal ' + b + '-' + c); s = E.apply(s, I(b, c)); }
ok(JSON.stringify(E.allowed(s)) === '[2]', 'chat: X sent to board 3');

// winning a board: owner, +1 star, loser gets a free move
s = E.newMain(1); s.cells[I(1,1)] = 2; s.cells[I(1,2)] = 1; s.cells[I(1,5)] = 1; s.filled[0] = 3; s.active = 0;
s = E.apply(s, I(1,8));
ok(s.owner[0] === 1 && s.stars[1] === 1, 'board won + star');
ok(s.turn === 2 && s.active === -1 && s.free === 1 && E.allowed(s).length === 9, 'free move for loser');

// navigator: star placement keeps the turn and asks for a board
s.turn = 1; s.active = 3; s.free = 0;
let n = E.apply(s, 100 + I(4,1));
ok(n.choosing === 1 && n.turn === 1 && n.stars[1] === 0 && n.star[I(4,1)] === 1, 'star -> choosing');
ok(E.legal(n).every(a => a >= 300), 'choosing: only board choices');
n = E.apply(n, 300 + 6);
ok(n.turn === 2 && n.active === 6 && n.choosing === 0 && n.log[n.log.length - 1].to === 6, 'choose sends to board 7');

// star that wins a board: no choosing, opponent gets the free move, star refunded by the win
s = E.newMain(1, { 1: 1 }); s.cells[I(6,1)] = 1; s.cells[I(6,2)] = 1; s.cells[I(6,4)] = 2; s.cells[I(6,5)] = 2; s.filled[5] = 4; s.active = 5;
n = E.apply(s, 100 + I(6,3));
ok(n.owner[5] === 1 && n.choosing === 0 && n.turn === 2 && n.free === 1 && n.stars[1] === 1, 'star win -> free move, star refunded');

// strike
s = E.newMain(1, { 1: 2 }); s.cells[I(4,1)] = 2; s.cells[I(4,2)] = 2; s.cells[I(4,4)] = 1; s.filled[3] = 3; s.active = 3;
ok(!E.isLegal(s, 200 + I(4,4)), 'cannot strike own mark');
ok(E.isLegal(s, 200 + I(4,2)), 'strike legal');
n = E.apply(s, 200 + I(4,2));
ok(n.cells[I(4,2)] === 0 && n.stars[1] === 0 && n.turn === 2 && n.active === 1 && n.filled[3] === 2, 'strike effect, sent to board 2');
s.owner[3] = 2; ok(!E.isLegal(s, 200 + I(4,2)), 'no strike in decided board');
s.owner[3] = 0; s.stars[1] = 1; ok(!E.isLegal(s, 200 + I(4,2)), 'strike needs 2 stars');

// secret: full board of one player's marks
s = E.newMain(1); for (let c = 1; c <= 8; c++) s.cells[I(5,c)] = 1; s.filled[4] = 8; s.owner[4] = 1; s.active = 4;
n = E.apply(s, I(5,9)); ok(n.result === 1 && n.secret === 4, 'secret win');

// main row
s = E.newMain(1); s.owner[0] = 1; s.owner[1] = 1; s.cells[I(3,1)] = 1; s.cells[I(3,2)] = 1; s.cells[I(3,4)] = 2; s.cells[I(3,5)] = 2; s.filled[2] = 4; s.active = 2;
n = E.apply(s, I(3,3)); ok(n.result === 1 && JSON.stringify(n.winLine) === '[0,1,2]', 'main row win');

// count finish: no row possible, last board decided
s = E.newMain(1); s.owner = [1,2,1,1,2,2,2,1,0]; s.cells[I(9,1)] = 1; s.cells[I(9,2)] = 1; s.cells[I(9,4)] = 2; s.cells[I(9,5)] = 2; s.filled[8] = 4; s.active = 8;
n = E.apply(s, I(9,3)); ok(n.result === 1 && n.byCount === 1, 'win by count 5:4');
s.turn = 2; n = E.apply(s, I(9,6)); ok(n.result === 2 && n.byCount === 1, 'O wins by count');

// random games: invariants
let games = 0, steps = 0;
for (let g = 0; g < 3000; g++) {
  let st = E.newMain(1 + (g % 2), g % 3 === 0 ? { 1: 1 } : null);
  let guard = 0;
  while (!st.result && guard++ < 500) {
    const acts = E.legal(st); ok(acts.length > 0, 'no legal moves in live game');
    if (!acts.length) break;
    st = E.applyMut(st, acts[(Math.random() * acts.length) | 0]); steps++;
    let cnt = 0; for (let b = 0; b < 9; b++) { let f = 0; for (let c = 0; c < 9; c++) if (st.cells[b*9+c]) f++; if (f !== st.filled[b]) ok(false, 'filled mismatch'); cnt += f; }
    ok(st.stars[1] >= 0 && st.stars[2] >= 0, 'stars negative');
  }
  ok(st.result, 'game did not end'); games++;
}
console.log('random games', games, 'avg moves', (steps / games).toFixed(1));

// TTT
let t = E.newTTT(1); for (const i of [0,3,1,4,2]) t = E.tttApply(t, i); ok(t.result === 1 && JSON.stringify(t.line) === '[0,1,2]', 'ttt win');
let losses = 0, draws33 = 0;
for (let g = 0; g < 3000; g++) {
  let tt = E.newTTT(1); const botSide = 1 + (g % 2);
  while (!tt.result) { const m = tt.turn === botSide ? E.tttBot(tt, 3, 'win') : (() => { const em = tt.b.map((v,i)=>v?-1:i).filter(i=>i>=0); return em[(Math.random()*em.length)|0]; })(); tt = E.tttApply(tt, m); }
  if (tt.result === 3 - botSide) losses++;
}
ok(losses === 0, '"Нет" lost ' + losses + ' games vs random');
for (let g = 0; g < 200; g++) { let tt = E.newTTT(1); while (!tt.result) tt = E.tttApply(tt, E.tttBot(tt, 3, 'win')); if (tt.result === 3) draws33++; }
ok(draws33 === 200, 'perfect vs perfect always draw: ' + draws33);
// lose goal: bot never completes its own row unless forced
let selfWins = 0, oppWins = 0;
for (let g = 0; g < 2000; g++) {
  let tt = E.newTTT(1); const botSide = 1 + (g % 2);
  while (!tt.result) { const m = tt.turn === botSide ? E.tttBot(tt, 3, 'lose') : E.tttBot(tt, 3, 'win'); tt = E.tttApply(tt, m); }
  if (tt.result === botSide) selfWins++; if (tt.result === 3 - botSide) oppWins++;
}
console.log('lose-goal bot vs perfect winner: bot won', selfWins, 'opponent won', oppWins, 'of 2000');
ok(selfWins === 0, 'sandbagging bot won by accident');
console.log(fails ? fails + ' FAILURES' : 'ALL RULE TESTS PASSED');
