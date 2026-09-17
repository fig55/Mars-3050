const assert = require('node:assert/strict');
const {Game,evaluate,compare,bot} = require('./engine.js');
const cards = text => text.split(' ').map(s=>({r:'23456789TJQKA'.indexOf(s[0])+2,s:'shdc'.indexOf(s[1])}));
assert.equal(evaluate(cards('As Ks Qs Js Ts 2h 3d'))[0],8);
assert.deepEqual(evaluate(cards('As 2h 3d 4c 5s Kh Qh')),[4,5]);
assert.deepEqual(evaluate(cards('As Ah Ad Ks Kh Kd 2c')),[6,14,13]);
assert.equal(evaluate(cards('As Ah Ad Ac Ks Kh 2c'))[0],7);
assert(compare(evaluate(cards('As Ah Kd Qc 8s')),evaluate(cards('Ac Ad Qs Jc 9s')))>0);
assert.equal(compare(evaluate(cards('As Kd Qc Js Th 2s 3s')),evaluate(cards('As Kd Qc Js Th 9h 9d'))),0);
const g = new Game(()=>.5); g.start();
assert.equal(g.actor,3); assert.equal(g.pot,30); assert.equal(g.options().min,40);
assert.throws(()=>g.act('raise',30)); assert.throws(()=>g.act('raise',NaN)); assert.throws(()=>g.act('raise',40.5));
g.act('raise',100); g.players[4].stack=130; g.act('raise',130); g.act('call'); g.act('call'); g.act('call'); g.act('call');
assert.equal(g.actor,3); assert.equal(g.options().canRaise,false); assert.equal(g.options().call,30);
g.act('call'); assert(g.awaitingStreet); g.street(); assert.equal(g.actor,1); assert.equal(g.board.length,3);
const cumulative = new Game(()=>.5); cumulative.start(); cumulative.act('raise',100); cumulative.players[4].stack=140; cumulative.act('raise',140); cumulative.players[5].stack=180; cumulative.act('raise',180); cumulative.act('call'); cumulative.act('call'); cumulative.act('call'); assert.equal(cumulative.actor,3); assert.equal(cumulative.options().canRaise,true);
const h = new Game(()=>.5); h.players.slice(2).forEach(p=>p.stack=0); h.start(); assert.equal(h.button,h.sb); assert.equal(h.actor,h.sb); h.act('call'); h.act('call'); h.street(); assert.equal(h.actor,h.bb);
const side = new Game(); side.board=cards('2s 3h 7d 9c Js'); side.players.forEach(p=>{p.folded=true;p.total=0;p.stack=0;p.startStack=0});
[[100,'As Ah'],[200,'Ks Kh'],[300,'Qs Qh']].forEach(([total,hand],i)=>Object.assign(side.players[i],{folded:false,total,cards:cards(hand)})); side.settle(); assert.deepEqual(side.players.slice(0,3).map(p=>p.stack),[300,200,100]);
const split = new Game(); split.button=0; split.board=cards('As Ks Qs Js Ts'); split.players.forEach(p=>{p.folded=true;p.total=0;p.stack=0;p.startStack=0}); [0,1,2].forEach(i=>Object.assign(split.players[i],{total:1,cards:cards('2h 3d'),folded:i===2})); split.settle(); assert.equal(split.players[0].stack,1); assert.equal(split.players[1].stack,2);
let seed=42; const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let hands=0;
for(let round=0;round<30;round++) {
 const game=new Game(rng);
 for(let hand=0;hand<60 && game.players.filter(p=>p.stack>0).length>1;hand++) {
  game.start(); const dealt=game.players.flatMap(p=>p.cards); assert.equal(new Set(dealt.map(c=>c.r+':'+c.s)).size,dealt.length);
  let steps=0;
  while(game.phase!=='done') { assert(steps++<250,'hand must terminate'); if(game.awaitingStreet) game.street(); else {const o=game.options(); const r=rng(); if(o.canRaise && r<.06) game.act('raise',o.max); else game.act(...bot(game));} assert(game.players.every(p=>Number.isInteger(p.stack)&&p.stack>=0)); if(game.phase!=='done') assert.equal(game.players.reduce((n,p)=>n+p.stack,0)+game.pot,12000); }
  assert.equal(game.players.reduce((n,p)=>n+p.stack,0),12000); hands++;
 }
}
console.log(`通过：牌型、加注合法性、短码全下与累计重开、单挑顺序、边池、奇数平分，${hands} 手随机对局筹码守恒。`);
