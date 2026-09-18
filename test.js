const assert = require('node:assert/strict');
const {Game,evaluate,bestFive,compare,bot,DEFAULT_CONTENT} = require('./src/engine.js');
const cards = text => text.split(' ').map(s=>({r:'23456789TJQKA'.indexOf(s[0])+2,s:'shdc'.indexOf(s[1])}));
// Both default and injected-random constructors must reach a playable hand.
for (const args of [[], [{}], [{seats:6}], [{rng:undefined}], [()=>.5], [{rng:()=>.5}], [{seats:6},()=>.5]]) {
  const game = new Game(...args);
  assert.equal(game.start(), true);
  assert.equal(game.players.flatMap(p=>p.cards).length,12);
  assert(game.options(), '开局必须有可行动玩家');
  assert.equal(typeof game.aiRng,'function');
}
const injected = ()=>.25;
assert.equal(new Game({rng:injected}).rng,injected);
assert.equal(new Game({rng:injected}).aiRng,injected);
assert.throws(()=>new Game({rng:123}),TypeError);
assert.throws(()=>new Game({aiRng:'invalid'}),TypeError);
{
  const g = new Game(()=>.23); g.start();
  g.players[g.actor].cards = cards('As Ah');
  const choice = bot(g);
  g.players[1].cards = cards('2c 3d');
  g.players[2].cards = cards('Ks Kh');
  assert.deepEqual(bot(g),choice,'对手不能读取其他玩家的暗牌');
  g.players[g.actor].profile.aggression = 0;
  assert.notDeepEqual(bot(g),choice,'角色的激进程度必须影响决策');
}
assert.equal(evaluate(cards('As Ks Qs Js Ts 2h 3d'))[0],8);
assert.deepEqual(evaluate(cards('As 2h 3d 4c 5s Kh Qh')),[4,5]);
assert.deepEqual(evaluate(cards('As Ah Ad Ks Kh Kd 2c')),[6,14,13]);
assert.equal(evaluate(cards('As Ah Ad Ac Ks Kh 2c'))[0],7);
assert(compare(evaluate(cards('As Ah Kd Qc 8s')),evaluate(cards('Ac Ad Qs Jc 9s')))>0);
assert.equal(compare(evaluate(cards('As Kd Qc Js Th 2s 3s')),evaluate(cards('As Kd Qc Js Th 9h 9d'))),0);
assert.deepEqual(evaluate(bestFive(cards('As Ks Qs Js Ts 2d 3c'))),evaluate(cards('As Ks Qs Js Ts 2d 3c')));
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
  assert.equal(game.history.at(-1).hand,game.hand);
  assert(game.history.length<=10);
  assert(game.history.at(-1).results.every(r=>!r.hands || r.hands.every(h=>h.cards.length===5 && !game.players[h.seat].folded)));
 }
}
// --- Frozen baseline: refEvaluate is an independent copy of the evaluate() under test ---
// Stage 3 rewrites evaluate() as a bitwise fast evaluator, and this copy is the differ.
// It must stay byte-identical and never evolve alongside the implementation.
const refCompare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
function refFive(five) {
  const ranks = five.map(c => c.r).sort((a, b) => b - a), groups = [...new Set(ranks)].map(r => [ranks.filter(v => v === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = five.every(c => c.s === five[0].s), unique = [...new Set(ranks)];
  const straight = unique.length === 5 && (unique[0] - unique[4] === 4 ? unique[0] : unique.join() === '14,5,4,3,2' ? 5 : 0);
  if (straight && flush) return [8, straight];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0][0] === 3) return [3, ...groups.map(g => g[1])];
  if (groups[0][0] === 2) return [groups[1][0] === 2 ? 2 : 1, ...groups.map(g => g[1])];
  return [0, ...ranks];
}
function refEvaluate(cs) {
  let best = [-1];
  for (let a = 0; a < cs.length - 4; a++) for (let b = a + 1; b < cs.length - 3; b++) for (let c = b + 1; c < cs.length - 2; c++) for (let d = c + 1; d < cs.length - 1; d++) for (let e = d + 1; e < cs.length; e++) {
    const score = refFive([cs[a], cs[b], cs[c], cs[d], cs[e]]); if (refCompare(score, best) > 0) best = score;
  }
  return best;
}
let refSeed = 20260917;
const refRng = () => ((refSeed = (Math.imul(refSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
const refPool = []; for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) refPool.push({ r, s });
let diffRounds = 0;
for (let i = 0; i < 2000; i++) {
  const d = refPool.slice();
  for (let j = d.length - 1; j > 0; j--) { const k = Math.floor(refRng() * (j + 1)); [d[j], d[k]] = [d[k], d[j]]; }
  const hand = d.slice(0, 5 + Math.floor(refRng() * 3));
  assert.deepEqual(evaluate(hand), refEvaluate(hand), `refEvaluate 差分不一致：${JSON.stringify(hand)}`);
  diffRounds++;
}
// --- Seat-count independence -------------------------------------------------
// A widened table needs its own content: the engine refuses to build more seats than
// the content defines, which is itself the guard against undefined names leaking in.
const wideContent = n => ({
  ...DEFAULT_CONTENT,
  seats: Array.from({length:n}, (_, i) => ({name:`S${i}`, style:'测试位', aggression:.12, foldBias:.17, habit:'把手收在桌沿。'}))
});
const makeRng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// The odd chip must follow seat order clockwise from the button at ANY table size.
// The legacy `(i - button + 5) % 6` collides once there are 7+ seats: seat 0 and seat 6
// both hash to 5, so the sort tie broke the wrong way and the odd chip went to the
// wrong player. Total chips stay conserved either way, which is exactly why this has
// to assert the RECIPIENT rather than the sum.
for (const n of [7, 9]) {
  const g = new Game({seats:n, content:wideContent(n), rng:makeRng(7)});
  g.button = 0;
  g.board = cards('2s 3h 7d 9c Js');
  g.players.forEach(p => { p.folded = true; p.total = 0; p.stack = 0; p.startStack = 0; });
  Object.assign(g.players[0], {folded:false, total:1, cards:cards('As Ah')});
  Object.assign(g.players[6], {folded:false, total:1, cards:cards('Ac Ad')});
  Object.assign(g.players[3], {total:1, cards:cards('2c 2d')}); // folds, but its chip stays in the pot
  g.settle(); // three chips split between two tied winners -> exactly one odd chip
  assert.equal(g.players[6].stack, 2, `${n} 人桌：奇数筹码应归按钮左手第一位（座位 6）`);
  assert.equal(g.players[0].stack, 1, `${n} 人桌：座位 0 只拿均分部分`);
  assert.equal(g.players.reduce((s,p) => s + p.stack, 0), 3);
}

// A full nine-handed hand must run clean: no undefined ever reaches a player's line.
{
  const g = new Game({seats:9, content:wideContent(9), rng:makeRng(11)});
  let played = 0;
  for (let i = 0; i < 20 && g.players.filter(p => p.stack > 0).length > 1; i++) {
    if (!g.start()) break;
    let steps = 0;
    while (g.phase !== 'done') {
      assert(steps++ < 400, '9 人桌未收敛');
      if (g.awaitingStreet) g.street(); else g.act(...bot(g));
      assert(g.players.every(p => Number.isInteger(p.stack) && p.stack >= 0), '筹码必须始终是非负整数');
      assert(g.players.every(p => typeof p.tell === 'string' && !p.tell.includes('undefined')), `9 人桌出现 undefined：${g.players.map(p=>p.tell).join(' | ')}`);
      assert(g.players.every(p => typeof p.last === 'string' && p.last), `9 人桌出现空动作文案：${g.players.map(p=>p.last).join(' | ')}`);
    }
    assert(!g.logs.some(l => l.text.includes('undefined')), '日志中不得出现 undefined');
    assert.equal(g.players.reduce((s,p) => s + p.stack, 0), 9 * 2000);
    played++;
  }
  assert(played > 0, '9 人桌至少应打完一手');
}

// --- The event stream is the hand's public, replayable record -----------------
{
  const g = new Game(makeRng(23));
  g.start();
  let steps = 0;
  while (g.phase !== 'done') { assert(steps++ < 250, '事件流用例未收敛'); if (g.awaitingStreet) g.street(); else g.act(...bot(g)); }
  const rendered = g.events.map(e => DEFAULT_CONTENT.format(e));
  const engineLogs = g.logs.filter(l => l.hand === g.hand).map(l => l.text);
  // Every engine log line is exactly the rendering of one event, in the same order.
  assert.deepEqual(engineLogs, rendered.slice(rendered.length - engineLogs.length), '每个事件恰好产出一行日志');
  assert(g.events.every(e => e.hand === g.hand), '事件只属于产出它的那一手');
  const moves = g.events.filter(e => e.type === 'action').map(e => e.move);
  assert(moves.every(m => ['fold','check','call','raise'].includes(m)), `动作键非法：${moves.join(',')}`);
  assert(g.events.some(e => e.type === 'payout'), '一手结束必有派彩事件');
  // Replay depends on events surviving serialisation intact.
  assert.deepEqual(JSON.parse(JSON.stringify(g.events)), g.events, '事件必须可无损序列化');
  // Starting a new hand must not carry the previous hand's events forward.
  g.start();
  assert(g.events.every(e => e.hand === g.hand) && g.events.some(e => e.type === 'handStart'), '开新手应清空上一手的事件');
}

console.log(`通过：牌型、加注合法性、短码全下与累计重开、单挑顺序、边池、奇数平分，${hands} 手随机对局筹码守恒，${diffRounds} 组 refEvaluate 差分，7/9 人桌奇数筹码归属，9 人桌 20 手无 undefined，事件流与日志一一对应。`);

// Exercise the real HTTP handler on an ephemeral port, without disturbing previews.
(async () => {
  const server = require('./server');
  const fs = require('node:fs');
  const path = require('node:path');
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [url,file] of [['/','index.html'],['/index.html','index.html'],['/style.css','style.css'],['/engine.js','engine.js'],['/app.js','app.js'],['/assets/players.png','assets/players.png'],['/assets/ajie-poses.png','assets/ajie-poses.png']]) {
      const response = await fetch(base+url);
      assert.equal(response.status,200,url);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(__dirname,'src',file)),url);
      if(file.endsWith('.png')) assert.equal(response.headers.get('content-type'),'image/png');
    }
    assert.equal((await fetch(base+'/package.json')).status,404);
    console.log('通过：默认/配置式开局、随机函数校验、7 个网页资源与源码一致、非公开文件拒绝访问。');
  } finally { await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
