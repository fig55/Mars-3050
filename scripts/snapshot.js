'use strict';
// Deterministic behaviour snapshot.
//
// Runs a fixed-seed game for HANDS hands and prints a byte-comparable JSON of
// every log line plus final stacks. Used to prove that a refactor did NOT
// change the order in which the engine consumes rng() — shuffling, tell
// selection and bot decisions all draw from it, so any reordering shows up
// here as a diff even when every assertion in test.js still passes.
//
// Usage:
//   node scripts/snapshot.js > snap.json     # capture
//   node scripts/snapshot.js | diff - snap.json   # compare
//
// HANDS=<n> overrides the default hand count.

const crypto = require('node:crypto');
const path = require('node:path');
const { Game, bot } = require(path.join(__dirname, '..', 'src', 'engine.js'));

const HANDS = Number(process.env.HANDS || 5);

// Same LCG as test.js, so the snapshot and the test suite share one timeline.
let seed = 42;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

const game = new Game(rng);
const snapshot = [];

for (let played = 0; played < HANDS; played++) {
  if (game.players.filter(p => p.stack > 0).length < 2) break;
  if (!game.start()) break;
  let steps = 0;
  while (game.phase !== 'done') {
    if (steps++ > 400) throw new Error(`第 ${game.hand} 手未收敛`);
    if (game.awaitingStreet) game.street();
    else game.act(...bot(game));
  }
  // The engine trims logs to 240 entries, so scope to the current hand only.
  snapshot.push({
    hand: game.hand,
    logs: game.logs.filter(l => l.hand === game.hand).map(l => l.text),
    stacks: game.players.map(p => p.stack)
  });
}

const json = JSON.stringify(snapshot);
console.error(`手数 ${snapshot.length} · sha256 ${crypto.createHash('sha256').update(json).digest('hex')}`);
process.stdout.write(json);
