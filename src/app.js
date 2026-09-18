'use strict';
const $ = id => document.getElementById(id);
let game = new Poker.Game(), timer, shown = 0, talkAt = 0;
let pendingAction = null;
let pose = {hand:-1,state:'idle',until:0}, poseTimer;
const poses = {idle:0,thinking:1,betting:2,folding:3,winning:4,losing:5};
function setPose(state) {
  clearTimeout(poseTimer);
  pose = {hand:game.hand,state,until:Date.now()+1100};
  poseTimer = setTimeout(render,1150);
}
const SAVE_KEY = 'quiet-table-save-v1', PREF_KEY = 'quiet-table-prefs-v1';
function readSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!data) return null;
    if (data.version !== 1 || !Array.isArray(data.stacks) || data.stacks.length !== game.players.length ||
        !data.stacks.every(n => Number.isSafeInteger(n) && n >= 0) ||
        data.stacks.reduce((a,b)=>a+b,0) !== game.players.length * game.config.startingStack ||
        !Number.isSafeInteger(data.hand) || data.hand < 1 ||
        !Number.isInteger(data.button) || data.button < 0 || data.button >= game.players.length ||
        data.stacks[0] === 0 || data.stacks.filter(n=>n>0).length < 2) throw Error('invalid save');
    return data;
  } catch { try { localStorage.removeItem(SAVE_KEY); } catch {} return null; }
}
let saved = readSaved();
if (saved) { game.players.forEach((p,i)=>p.stack=saved.stacks[i]); game.button=saved.button; game.hand=saved.hand; }
function saveGame() {
  if (game.phase !== 'done') return;
  if (game.players[0].stack === 0 || game.players.filter(p=>p.stack>0).length < 2) { saved=null; try {localStorage.removeItem(SAVE_KEY);} catch {} return; }
  saved = {version:1,hand:game.hand,button:game.button,stacks:game.players.map(p=>p.stack)};
  try { localStorage.setItem(SAVE_KEY,JSON.stringify(saved)); } catch { $('error').textContent='本机无法保存牌局，请检查存储空间。'; }
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY,JSON.stringify({speed:$('speed').value,characters:!document.body.classList.contains('text-only'),journal:!document.body.classList.contains('journal-hidden')})); } catch {}
}
try {
  const prefs=JSON.parse(localStorage.getItem(PREF_KEY));
  if (prefs && ['1400','450','2400'].includes(prefs.speed)) $('speed').value=prefs.speed;
  if (prefs?.characters===false) { document.body.classList.add('text-only'); $('charactersBtn').setAttribute('aria-pressed','false'); $('charactersBtn').textContent='人物：关'; }
  if (prefs?.journal===false) { document.body.classList.add('journal-hidden'); $('tableJournal').hidden=true; $('journalBtn').setAttribute('aria-expanded','false'); }
} catch {}
const fmt = n => n.toLocaleString('zh-CN');
const cardText = c => `${({11:'J',12:'Q',13:'K',14:'A'})[c.r] || c.r}${['♠','♥','♦','♣'][c.s]}`;
const phases = { ready: '等候入座', preflop: '翻牌前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈', done: '本手结束' };
function card(c, placeholder = '') { if (!c) return `<div class="card empty">${placeholder}</div>`; return `<div class="card ${c.s === 1 || c.s === 2 ? 'red' : ''}" aria-label="${['黑桃','红心','方块','梅花'][c.s]}${c.r}">${({11:'J',12:'Q',13:'K',14:'A'})[c.r] || c.r}<span>${['♠','♥','♦','♣'][c.s]}</span></div>`; }
function position(i) { return [i === game.button ? '庄家' : '', i === game.sb ? '小盲' : '', i === game.bb ? '大盲' : ''].filter(Boolean).join(' / '); }
function render() {
  const ajiePose = pose.hand===game.hand && Date.now()<pose.until ? pose.state : game.actor===3 ? 'thinking' : 'idle';
  $('handLabel').textContent = `第 ${String(game.hand || 1).padStart(2, '0')} 手`; $('phaseLabel').textContent = phases[game.phase];
  $('pot').innerHTML = `${fmt(game.pot)} <small>${game.phase === 'done' ? '已结算' : '筹码'}</small>`;
  $('board').innerHTML = Array.from({length:5}, (_, i) => card(game.board[i], ['翻','牌','圈','转牌','河牌'][i])).join('');
  $('hole').innerHTML = [0,1].map(i => card(game.players[0].cards[i], '待发')).join('');
  $('opponents').innerHTML = game.players.slice(1).map((p,j) => `<article class="seat seat-${j+1} ${p.folded ? 'folded' : ''} ${game.actor === j+1 ? 'active' : ''} ${game.phase === 'done' && p.stack > p.startStack ? 'winner' : ''}" aria-label="${p.name}的座位"><div class="portrait" style="--sprite:${j*25}%;${j===2 ? `--pose:${poses[ajiePose]*20}%` : ''}" aria-hidden="true"></div><div class="nameplate"><div class="seat-name">${p.name}<span class="pos">${position(j+1)}</span></div><div class="seat-stack"><small>筹码</small> ${fmt(p.stack)}</div><div class="seat-action">${game.actor === j+1 ? '正在思考…' : p.last || p.style}</div></div>${game.showdown && !p.folded ? `<div class="cards revealed">${p.cards.map(c=>card(c)).join('')}</div>` : ''}<p class="tell"></p></article>`).join('');
  document.querySelectorAll('.seat .tell').forEach((el,i) => el.textContent = game.players[i+1].tell);
  const hero = game.players[0], mine = game.actor === 0, o = mine ? game.options() : null, end = game.phase === 'done' || game.phase === 'ready';
  document.querySelector('.hero').classList.toggle('active',mine);
  document.querySelector('.hero').classList.toggle('folded',hero.folded);
  document.querySelector('.controls').classList.toggle('my-turn',mine);
  $('stack').textContent = fmt(hero.stack); $('position').textContent = position(0) || '玩家'; $('heroTell').textContent = hero.tell;
  $('handRank').textContent = game.board.length && !hero.folded ? `当前牌型 · ${Poker.names[Poker.evaluate([...hero.cards,...game.board])[0]]}` : '你的底牌 · 仅自己可见';
  $('turnText').textContent = end ? (game.phase === 'ready' ? '牌桌已经就绪' : '筹码落定，下一手又是新的故事。') : mine ? '轮到你了。所有人都在等你的决定。' : game.actor >= 0 ? `${game.players[game.actor].name} 正在思考…` : '荷官正在整理牌面…';
  $('callHint').textContent = mine ? o.call ? `跟注需 ${fmt(o.call)} 筹码` : '你可以免费过牌' : hero.folded && !end ? '你已弃牌 · 观战中' : '盲注 10 / 20';
  $('actionControls').hidden = end; $('next').hidden = !end;
  $('startActions').hidden = !end;
  const complete = hero.stack === 0 || game.players.filter(p=>p.stack > 0).length < 2;
  $('next').textContent = game.phase === 'ready' ? (saved ? `继续牌局 · 第 ${game.hand+1} 手` : '入座，开始第一手') : complete ? (hero.stack ? '你赢下了整桌 · 再来一场' : '筹码已耗尽 · 重新入座') : '继续下一手';
  $('newGame').hidden = !end || !saved || game.phase !== 'ready';
  for (const id of ['fold','call','raise','allin','raiseAmount','raiseRange']) $(id).disabled = !mine;
  $('raiseAmount').disabled = !o?.canRaise; $('allin').disabled = !mine || (!o.canRaise && o.max > game.current);
  $('raiseRange').disabled = !o?.canRaise;
  document.querySelectorAll('[data-pot]').forEach(b=>b.disabled = !o?.canRaise);
  $('call').innerHTML = `${o?.call ? `跟注 ${fmt(o.call)}` : '过牌'} <kbd>C</kbd>`;
  if (o) { $('raiseAmount').min = Math.min(o.min,o.max); $('raiseAmount').max = o.max; if (+$('raiseAmount').value < Math.min(o.min,o.max) || +$('raiseAmount').value > o.max) $('raiseAmount').value = Math.min(o.min,o.max); }
  syncRange(); validateRaise();
  $('scene').textContent = game.phase === 'ready' ? '荷官理好牌堆，等你入座。' : game.phase === 'done' ? '有人收拢筹码，有人不动声色地靠回椅背。' : game.pot >= 1200 ? '桌心的筹码越堆越高，连呼吸都轻了下来。' : game.phase === 'river' ? '最后一张牌已经落下。谁会先移开目光？' : '没有人开口，目光在牌面和彼此之间移动。';
  $('result').hidden = !game.results.length;
  const net = hero.stack - hero.startStack;
  $('result').textContent = game.results.length ? (net === 0 ? '你本手持平。' : `你本手净${net>0?'赢':'输'} ${fmt(Math.abs(net))}。`) + game.results.map(r=>`${r.names} 收回 ${fmt(r.amount)}（${r.label}）${r.hands?.length ? '；最佳五张：'+r.hands.map(h=>`${game.players[h.seat].name} ${h.cards.map(cardText).join(' ')}`).join('、') : ''}`).join(' · ') : '';
  $('review').hidden = !game.history.length;
  const journal = $('journal'), nearBottom = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
  if (shown > game.logs.length) { journal.replaceChildren(); shown = 0; }
  // Keep the journal keyed by entries, even when the engine trims its bounded history.
  const fresh = game.logs.filter(l=>!l.displayed);
  for (const l of fresh) { const el = document.createElement('div'); el.className = `entry log-${l.kind}`; const small = document.createElement('small'); small.textContent = `第 ${String(l.hand).padStart(2,'0')} 手 / ${l.kind === 'talk' ? '桌边' : '现场'}`; el.append(small, document.createTextNode(l.text)); journal.append(el); l.displayed = true; }
  while (journal.children.length > 240) journal.firstElementChild.remove(); shown = game.logs.length;
  if (nearBottom) journal.scrollTop = journal.scrollHeight;
  $('latest').hidden = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
}
function schedule() {
  clearTimeout(timer); saveGame();
  if (game.phase==='done' && (pose.hand!==game.hand || !['winning','losing'].includes(pose.state))) {
    const delta=game.players[3].stack-game.players[3].startStack;
    if (delta) setPose(delta>0?'winning':'losing');
  }
  render(); if (game.phase === 'done' || game.phase === 'ready' || game.actor === 0) return;
  timer = setTimeout(()=> { try { if (game.awaitingStreet) game.street(); else {const actor=game.actor, move=Poker.bot(game); game.act(...move); if(actor===3) setPose(move[0]==='fold'?'folding':move[0]==='raise'?'betting':'idle');} schedule(); } catch(e) { $('error').textContent = e.message; } }, +$('speed').value);
}
function act(type,amount,confirmed=false) {
  if (game.actor !== 0) return;
  const o = game.options();
  const allin = (type === 'raise' && amount === o.max) || (type === 'call' && o.call === game.players[0].stack);
  const freeFold = type === 'fold' && o.call === 0;
  if (!confirmed && (allin || freeFold)) {
    pendingAction = [type,amount];
    $('confirmTitle').textContent = allin ? '把剩下的筹码全部推入？' : '这轮可以免费过牌';
    $('confirmText').textContent = allin ? `你将投入剩余 ${fmt(game.players[0].stack)} 筹码。本手之后无法再下注。` : '现在弃牌会放弃争夺底池。你也可以选择过牌，继续看接下来的牌。';
    $('acceptAction').textContent = allin ? '确认全下' : '仍然弃牌'; $('confirmAction').showModal(); return;
  }
  try { game.act(type,amount); $('error').textContent = ''; schedule(); } catch(e) { $('error').textContent = e.message; }
}
function syncRange() {
  $('raiseRange').min = $('raiseAmount').min; $('raiseRange').max = $('raiseAmount').max || 2000;
  $('raiseRange').value = Math.max(+$('raiseRange').min,Math.min(+$('raiseRange').max,+$('raiseAmount').value || +$('raiseRange').min));
}
function validateRaise() {
  const o = game.actor === 0 && game.options(), amount = Number($('raiseAmount').value);
  const invalid = o?.canRaise && (!Number.isInteger(amount) || amount <= game.current || amount > o.max || (amount < o.min && amount !== o.max));
  $('betError').textContent = invalid ? `可加注至 ${fmt(Math.min(o.min,o.max))}–${fmt(o.max)}，或全下` : '';
  $('raiseAmount').setAttribute('aria-invalid',String(!!invalid));
  $('raise').disabled = !o?.canRaise || !!invalid;
}
$('raiseRange').oninput = () => { $('raiseAmount').value = $('raiseRange').value; validateRaise(); };
$('raiseAmount').oninput = () => { syncRange(); validateRaise(); };
$('cancelAction').onclick = () => { pendingAction = null; $('confirmAction').close(); };
$('acceptAction').onclick = () => { const action = pendingAction; pendingAction = null; $('confirmAction').close(); if(action) act(...action,true); };
$('confirmAction').addEventListener('close',()=>pendingAction=null);
$('fold').onclick = ()=>act('fold'); $('call').onclick = ()=>act('call'); $('raise').onclick = ()=>act('raise',Number($('raiseAmount').value));
$('allin').onclick = ()=> { const o = game.options(); if (o && game.actor === 0) act(o.max <= game.current ? 'call' : 'raise',o.max); };
$('next').onclick = ()=> { clearTimeout(timer); clearTimeout(poseTimer); pose.hand=-1; if (game.phase === 'done' && (!game.players[0].stack || game.players.filter(p=>p.stack > 0).length < 2)) { game = new Poker.Game(); $('journal').replaceChildren(); shown = 0; } game.start(); $('error').textContent = ''; schedule(); };
$('newGame').onclick = ()=> { saved=null; try {localStorage.removeItem(SAVE_KEY);} catch {} clearTimeout(poseTimer);pose.hand=-1;game=new Poker.Game(); $('journal').replaceChildren(); shown=0; game.start(); $('error').textContent=''; schedule(); };
document.querySelectorAll('[data-pot]').forEach(b=>b.onclick = ()=> { const o = game.options(); if(o && game.actor === 0) { $('raiseAmount').value = Math.min(o.max,Math.max(o.min,game.current + Math.round((game.pot + o.call)*Number(b.dataset.pot)))); syncRange(); validateRaise(); } });
function talk(text) {
  if (Date.now()-talkAt < 1200 || !text.trim()) return;
  talkAt=Date.now(); game.players[0].tell=text.trim(); game.log(`你${text.trim()}`,'talk');
  const listeners = game.players.slice(1).filter(p=>p.stack || (!p.folded && game.phase !== 'done'));
  if (listeners.length && Math.random() < .65) {
    const p = listeners[Math.floor(Math.random()*listeners.length)], responses = { '老陈':'没有接话，只是看了一眼你的手。', '林小姐':'微微点头：「牌桌上，行动更有说服力。」', '阿杰':'笑了一声：「别光说，等你下注。」', '周先生':'抬头看了你一眼，又低头数起筹码。', '小鹿':'笑着说：「你的表情，我记住了。」' };
    game.log(`${p.name}${responses[p.name]}`,'talk');
  }
  render();
}
document.querySelectorAll('[data-talk]').forEach(b=>b.onclick = ()=>talk(b.dataset.talk));
$('chatForm').onsubmit = e=> { e.preventDefault(); const text = $('chat').value.trim(); if(text) { talk(`说：「${text}」`); $('chat').value=''; } };
$('rulesBtn').onclick = ()=>$('rules').showModal(); $('closeRules').onclick = ()=>$('rules').close(); $('speed').onchange = () => {savePrefs();schedule();};
$('charactersBtn').onclick = () => { const off = document.body.classList.toggle('text-only'); $('charactersBtn').setAttribute('aria-pressed',String(!off)); $('charactersBtn').textContent = `人物：${off?'关':'开'}`; savePrefs(); };
$('journalBtn').onclick = () => { const off = document.body.classList.toggle('journal-hidden'); $('tableJournal').hidden = off; $('journalBtn').setAttribute('aria-expanded',String(!off)); savePrefs(); };
$('latest').onclick = () => { $('journal').scrollTop = $('journal').scrollHeight; $('latest').hidden = true; };
$('journal').addEventListener('scroll',()=> { $('latest').hidden = $('journal').scrollHeight - $('journal').scrollTop - $('journal').clientHeight < 70; });
$('review').onclick = () => {
  $('historySelect').replaceChildren(...game.history.slice().reverse().map((h,i)=>new Option(`第 ${h.hand} 手`,String(game.history.length-1-i))));
  showHistory(); $('historyDialog').showModal();
};
function showHistory() {
  const h=game.history[Number($('historySelect').value)]; if(!h) return;
  const lines=[`第 ${h.hand} 手 · 庄家 ${game.players[h.button].name}`,`你的底牌：${h.heroCards.map(cardText).join(' ')}`,`你的净输赢：${h.net[game.config.heroIndex]>=0?'+':''}${fmt(h.net[game.config.heroIndex])}`,''];
  for(const e of h.events) lines.push(game.content.format(e)+(e.type==='street'?` 公共牌：${e.board.map(cardText).join(' ')}`:''));
  for(const r of h.results) if(r.hands?.length) lines.push(`${r.label} · 最佳五张：${r.hands.map(v=>`${game.players[v.seat].name} ${v.cards.map(cardText).join(' ')}`).join('、')}`);
  $('historyDetails').textContent=lines.join('\n');
}
$('historySelect').onchange=showHistory;
$('closeHistory').onclick=()=>$('historyDialog').close();
document.addEventListener('keydown',e=> { if(e.repeat || e.ctrlKey || e.altKey || e.metaKey || $('rules').open || $('confirmAction').open || $('historyDialog').open || ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return; const id = {f:'fold',c:'call',r:'raise'}[e.key.toLowerCase()]; if(id && !$(id).disabled) { e.preventDefault(); $(id).click(); } });
game.log(saved ? `第 ${saved.hand} 手已结算。筹码与庄位已恢复，下一手可以继续。` : '老陈捻了捻指尖。阿杰把椅子往前挪了半寸。小鹿抬头：「人齐了，开始吧。」','talk'); render();
// The Tauri window is frameless, so the header doubles as the drag region and these three
// stand in for the missing title bar. Opened as a plain page __TAURI__ is undefined: the
// group stays hidden and the browser's own chrome does the job.
const appWindow = window.__TAURI__?.window?.getCurrentWindow?.();
if (appWindow) {
  $('winControls').hidden = false;
  $('winMin').onclick = () => appWindow.minimize();
  $('winMax').onclick = () => appWindow.toggleMaximize();
  $('winClose').onclick = () => appWindow.close();
}
