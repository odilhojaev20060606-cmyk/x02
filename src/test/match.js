// usage: node match.js <games> <msNew> <msOld> <seed>
const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
const [games, msNew, msOld, sd] = process.argv.slice(2).map(Number);
let res = { new: 0, old: 0, draw: 0 }, moves = 0;
for (let g = 0; g < games; g++) {
  const newSide = 1 + ((g + sd) % 2);
  let s = E.newMain(1);
  while (!s.result) {
    const a = s.turn === newSide ? E.think2(s, msNew, { seed: sd * 1000 + g * 7 + moves }).action : E.think(s, msOld).action;
    s = E.applyMut(s, a); moves++;
  }
  if (s.result === 3) res.draw++; else if (s.result === newSide) res.new++; else res.old++;
  console.log(`game ${g + 1}: new as ${newSide === 1 ? 'X' : 'O'} -> ${s.result === 3 ? 'draw' : s.result === newSide ? 'NEW wins' : 'old wins'}${s.byCount ? ' (count)' : ''}${s.secret >= 0 ? ' (secret)' : ''}, ${s.moves} moves`);
}
console.log('TOTAL', JSON.stringify(res));
