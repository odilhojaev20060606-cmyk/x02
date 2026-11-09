const fs = require('fs');
const E = (new Function(fs.readFileSync(__dirname + '/../engine.js', 'utf8') + '; return ENGINE();'))();
let humanWins = 0, total = 0, noBlunder = 0;
for (let g = 0; g < 400; g++) {
  const botSide = 1 + (g % 2); let used = false;
  let t = E.newTTT(1);
  while (!t.result) {
    let m;
    if (t.turn === botSide) { m = -1; if (!used) { m = E.tttBlunder(t); if (m >= 0) used = true; } if (m < 0) m = E.tttBot(t, 3, 'win'); }
    else m = E.tttBot(t, 3, 'win');
    t = E.tttApply(t, m);
  }
  total++; if (!used) noBlunder++; if (t.result === 3 - botSide) humanWins++;
}
console.log('perfect human vs blundering "Нет": human won', humanWins, 'of', total, '| games without a blunder:', noBlunder);
