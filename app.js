'use strict';
const $ = id => document.getElementById(id);
let game = new Poker.Game(), timer, shown = 0, talkAt = 0;
let pendingAction = null;
const fmt = n => n.toLocaleString('zh-CN');
const phases = { ready: '等候入座', preflop: '翻牌前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈', done: '本手结束' };
function card(c, placeholder = '') { if (!c) return `<div class="card empty">${placeholder}</div>`; return `<div class="card ${c.s === 1 || c.s === 2 ? 'red' : ''}" aria-label="${['黑桃','红心','方块','梅花'][c.s]}${c.r}">${({11:'J',12:'Q',13:'K',14:'A'})[c.r] || c.r}<span>${['♠','♥','♦','♣'][c.s]}</span></div>`; }
function position(i) { return [i === game.button ? '庄家' : '', i === game.sb ? '小盲' : '', i === game.bb ? '大盲' : ''].filter(Boolean).join(' / '); }
function render() {
  $('handLabel').textContent = `第 ${String(game.hand || 1).padStart(2, '0')} 手`; $('phaseLabel').textContent = phases[game.phase];
  $('pot').innerHTML = `${fmt(game.pot)} <small>${game.phase === 'done' ? '已结算' : '筹码'}</small>`;
  $('board').innerHTML = Array.from({length:5}, (_, i) => card(game.board[i], ['翻','牌','圈','转牌','河牌'][i])).join('');
  $('hole').innerHTML = [0,1].map(i => card(game.players[0].cards[i], '待发')).join('');
  $('opponents').innerHTML = game.players.slice(1).map((p,j) => `<article class="seat seat-${j+1} ${p.folded ? 'folded' : ''} ${game.actor === j+1 ? 'active' : ''} ${game.phase === 'done' && p.stack > p.startStack ? 'winner' : ''}" aria-label="${p.name}的座位"><div class="portrait" style="--sprite:${j*25}%" aria-hidden="true"></div><div class="nameplate"><div class="seat-name">${p.name}<span class="pos">${position(j+1)}</span></div><div class="seat-stack"><small>筹码</small> ${fmt(p.stack)}</div><div class="seat-action">${game.actor === j+1 ? '正在思考…' : p.last || p.style}</div></div>${game.showdown && !p.folded ? `<div class="cards revealed">${p.cards.map(c=>card(c)).join('')}</div>` : ''}<p class="tell"></p></article>`).join('');
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
  const complete = hero.stack === 0 || game.players.filter(p=>p.stack > 0).length < 2;
  $('next').textContent = game.phase === 'ready' ? '入座，开始第一手' : complete ? (hero.stack ? '你赢下了整桌 · 再来一场' : '筹码已耗尽 · 重新入座') : '继续下一手';
  for (const id of ['fold','call','raise','allin','raiseAmount','raiseRange']) $(id).disabled = !mine;
  $('raise').disabled = !o?.canRaise; $('raiseAmount').disabled = !o?.canRaise; $('allin').disabled = !mine || (!o.canRaise && o.max > game.current);
  $('raiseRange').disabled = !o?.canRaise;
  document.querySelectorAll('[data-pot]').forEach(b=>b.disabled = !o?.canRaise);
  $('call').innerHTML = `${o?.call ? `跟注 ${fmt(o.call)}` : '过牌'} <kbd>C</kbd>`;
  if (o) { $('raiseAmount').min = Math.min(o.min,o.max); $('raiseAmount').max = o.max; if (+$('raiseAmount').value < Math.min(o.min,o.max) || +$('raiseAmount').value > o.max) $('raiseAmount').value = Math.min(o.min,o.max); }
  syncRange();
  $('scene').textContent = game.phase === 'ready' ? '荷官理好牌堆，等你入座。' : game.phase === 'done' ? '有人收拢筹码，有人不动声色地靠回椅背。' : game.pot >= 1200 ? '桌心的筹码越堆越高，连呼吸都轻了下来。' : game.phase === 'river' ? '最后一张牌已经落下。谁会先移开目光？' : '没有人开口，目光在牌面和彼此之间移动。';
  $('result').hidden = !game.results.length; $('result').textContent = game.results.map(r=>`${r.names} 收回 ${fmt(r.amount)}（${r.label}）`).join(' · ');
  const journal = $('journal'), nearBottom = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
  if (shown > game.logs.length) { journal.replaceChildren(); shown = 0; }
  // Keep the journal keyed by entries, even when the engine trims its bounded history.
  const fresh = game.logs.filter(l=>!l.displayed);
  for (const l of fresh) { const el = document.createElement('div'); el.className = `entry log-${l.kind}`; const small = document.createElement('small'); small.textContent = `第 ${String(l.hand).padStart(2,'0')} 手 / ${l.kind === 'talk' ? '桌边' : '现场'}`; el.append(small, document.createTextNode(l.text)); journal.append(el); l.displayed = true; }
  while (journal.children.length > 240) journal.firstElementChild.remove(); shown = game.logs.length;
  if (nearBottom) journal.scrollTop = journal.scrollHeight;
  $('latest').hidden = nearBottom || !fresh.length;
}
function schedule() {
  clearTimeout(timer); render(); if (game.phase === 'done' || game.phase === 'ready' || game.actor === 0) return;
  timer = setTimeout(()=> { try { if (game.awaitingStreet) game.street(); else game.act(...Poker.bot(game)); schedule(); } catch(e) { $('error').textContent = e.message; } }, +$('speed').value);
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
  $('raiseRange').value = $('raiseAmount').value;
}
$('raiseRange').oninput = () => { $('raiseAmount').value = $('raiseRange').value; };
$('raiseAmount').oninput = syncRange;
$('cancelAction').onclick = () => { pendingAction = null; $('confirmAction').close(); };
$('acceptAction').onclick = () => { const action = pendingAction; pendingAction = null; $('confirmAction').close(); if(action) act(...action,true); };
$('confirmAction').addEventListener('close',()=>pendingAction=null);
$('fold').onclick = ()=>act('fold'); $('call').onclick = ()=>act('call'); $('raise').onclick = ()=>act('raise',Number($('raiseAmount').value));
$('allin').onclick = ()=> { const o = game.options(); if (o && game.actor === 0) act(o.max <= game.current ? 'call' : 'raise',o.max); };
$('next').onclick = ()=> { clearTimeout(timer); if (game.phase === 'done' && (!game.players[0].stack || game.players.filter(p=>p.stack > 0).length < 2)) { game = new Poker.Game(); $('journal').replaceChildren(); shown = 0; } game.start(); $('error').textContent = ''; schedule(); };
document.querySelectorAll('[data-pot]').forEach(b=>b.onclick = ()=> { const o = game.options(); if(o && game.actor === 0) { $('raiseAmount').value = Math.min(o.max,Math.max(o.min,game.current + Math.round((game.pot + o.call)*Number(b.dataset.pot)))); syncRange(); } });
function talk(text) {
  if (Date.now()-talkAt < 1200 || !text.trim()) return;
  talkAt=Date.now(); game.players[0].tell=text.trim(); game.log(`你${text.trim()}`,'talk');
  const listeners = game.players.slice(1).filter(p=>p.stack || (!p.folded && game.phase !== 'done'));
  if (listeners.length && game.rng() < .65) {
    const p = listeners[Math.floor(game.rng()*listeners.length)], responses = { '老陈':'没有接话，只是看了一眼你的手。', '林小姐':'微微点头：「牌桌上，行动更有说服力。」', '阿杰':'笑了一声：「别光说，等你下注。」', '周先生':'抬头看了你一眼，又低头数起筹码。', '小鹿':'笑着说：「你的表情，我记住了。」' };
    game.log(`${p.name}${responses[p.name]}`,'talk');
  }
  render();
}
document.querySelectorAll('[data-talk]').forEach(b=>b.onclick = ()=>talk(b.dataset.talk));
$('chatForm').onsubmit = e=> { e.preventDefault(); const text = $('chat').value.trim(); if(text) { talk(`说：「${text}」`); $('chat').value=''; } };
$('rulesBtn').onclick = ()=>$('rules').showModal(); $('closeRules').onclick = ()=>$('rules').close(); $('speed').onchange = schedule;
$('charactersBtn').onclick = () => { const off = document.body.classList.toggle('text-only'); $('charactersBtn').setAttribute('aria-pressed',String(!off)); $('charactersBtn').textContent = `人物：${off?'关':'开'}`; };
$('journalBtn').onclick = () => { const off = document.body.classList.toggle('journal-hidden'); $('tableJournal').hidden = off; $('journalBtn').setAttribute('aria-expanded',String(!off)); };
$('latest').onclick = () => { $('journal').scrollTop = $('journal').scrollHeight; $('latest').hidden = true; };
$('journal').addEventListener('scroll',()=> { $('latest').hidden = $('journal').scrollHeight - $('journal').scrollTop - $('journal').clientHeight < 70; });
document.addEventListener('keydown',e=> { if(e.repeat || e.ctrlKey || e.altKey || e.metaKey || $('rules').open || $('confirmAction').open || ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return; const id = {f:'fold',c:'call',r:'raise'}[e.key.toLowerCase()]; if(id && !$(id).disabled) { e.preventDefault(); $(id).click(); } });
game.log('老陈捻了捻指尖。阿杰把椅子往前挪了半寸。小鹿抬头：「人齐了，开始吧。」','talk'); render();
