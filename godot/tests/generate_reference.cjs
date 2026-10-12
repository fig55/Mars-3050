// Run from the repository root: node godot/tests/generate_reference.cjs
const fs = require('node:fs');
const { deck, evaluate } = require('../../src/engine.js');
let state = 3050;
function random() { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }
const cases = [];
for (let i = 0; i < 300; i++) {
  const cards = deck();
  for (let j = cards.length - 1; j > 0; j--) {
    const k = Math.floor(random() * (j + 1));
    [cards[j], cards[k]] = [cards[k], cards[j]];
  }
  const hand = cards.slice(0, i % 2 ? 5 : 7);
  cases.push({ cards: hand, score: evaluate(hand) });
}
fs.writeFileSync('godot/tests/js_reference.json', JSON.stringify(cases) + '\n');
