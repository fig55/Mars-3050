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
// Presentation follows public engine events; animation never changes game accounting.
let visualGame, visualHand = -1, visualEvent = 0;
const chipMotions = new Set();
let selectedChips=[], selectionContext='', dragChips=null;
const selectedAmount=()=>selectedChips.reduce((a,b)=>a+b,0);
function chipGroups(groups, interactive=false) {
  return groups.map(({value,count})=>{
    const tokens=Array.from({length:count},(_,i)=>`<span class="real-chip denomination-${value}" data-value="${value}" style="--level:${i}" aria-hidden="true">${value}</span>`).join('');
    const label=`${value} 面额，${count} 枚${interactive?'，点击选一枚':''}`;
    return `<${interactive?'button type="button"':'span'} class="chip-group" ${interactive?`data-pick-chip="${value}"`:''} aria-label="${label}"><span class="chip-column" style="--count:${count};--chip-step:${Math.min(2,16/Math.max(1,count-1))}px">${tokens}</span><small>${value} × ${count}</small></${interactive?'button':'span'}>`;
  }).join('');
}
function chipStack(amount,change=false) { return chipGroups(TableChips.split(amount,change)); }
function clearChipSelection() {selectedChips=[];updateChipSelection();}
function updateChipSelection() {
  const tray=$('chipSelection'); if(!tray) return;
  const amount=selectedAmount();
  tray.hidden=game.actor!==0;
  $('selectedChipAmount').textContent=amount?`已选 ${fmt(amount)}（尚未下注）· 拖动桌前筹码到公共牌或底池`:'点击筹码数好金额，直接从自己面前拖到公共牌或底池';
  $('throwChips').disabled=!amount;$('resetChips').disabled=!amount;
  $('selectedChipPreview').innerHTML=chipGroups(TableChips.denominations.map(value=>({value,count:selectedChips.filter(v=>v===value).length})).filter(g=>g.count));
  $('chipDropZone').hidden=!amount;
  const bank=document.querySelector('.hero .seat-chips');
  if(bank) {
    const groups=TableChips.split(game.players[0].stack,true);
    bank.innerHTML=chipGroups(groups,game.actor===0);
    bank.querySelectorAll('[data-pick-chip]').forEach(button=>{
      const count=selectedChips.filter(v=>v===Number(button.dataset.pickChip)).length;
      button.classList.toggle('chip-selected',count>0);
      if(count){const badge=document.createElement('span');badge.className='chip-selected-count';badge.textContent=`已选 ${count}`;button.append(badge);}
    });
    bank.setAttribute('aria-label',`余额 ${fmt(game.players[0].stack)}，其中已选 ${fmt(amount)}，尚未下注`);
  }
  document.querySelector('.board-area').classList.toggle('accepts-chips',amount>0);
}
function submitChips() {
  if(game.actor!==0)return;
  try {
    const move=TableChips.move(selectedAmount(),game.players[0],game.options());
    $('error').textContent='';act(...move);
    if(game.actor!==0) clearChipSelection();
  } catch(error) {$('error').textContent=`${error.message}；筹码已退回待投区。`;}
}
window.addEventListener('resize',()=>{
  for (const {animation} of chipMotions) animation.cancel();
});
function flyChips(from, to, amount, delay = 0, tokens = null) {
  if (!from || !to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage=document.querySelector('.table-stage'), origin=stage.getBoundingClientRect();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  let index=0;
  for(const {value,count} of tokens || TableChips.split(amount)) for(let n=0;n<count;n++) {
  const chip = document.createElement('span');
  chip.className = `flying-chip real-chip denomination-${value}`; chip.textContent=value;chip.dataset.value=value;chip.setAttribute('aria-hidden','true');
  chip.style.left = `${a.left+a.width/2-origin.left-9}px`; chip.style.top = `${a.top+a.height/2-origin.top-6}px`;
  stage.append(chip);
  const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
  const animation = chip.animate([
    {transform:'translate(0,0) scale(1)',opacity:0},
    {opacity:1,offset:.12},
    {transform:`translate(${dx*.55}px,${dy*.55-14}px) rotate(12deg)`,opacity:1,offset:.55},
    {transform:`translate(${dx}px,${dy}px) rotate(0deg)`,opacity:0}
  ],{duration:620,delay:delay+index++*24,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'});
  const motion = {animation,chip}; chipMotions.add(motion);
  animation.finished.catch(()=>{}).finally(()=>{chip.remove();chipMotions.delete(motion);});
  }
}
function renderTableActivity() {
  if (visualGame !== game || visualHand !== game.hand) {
    selectedChips=[];
    for (const {animation,chip} of chipMotions) { animation.cancel();chip.remove(); }
    chipMotions.clear(); visualGame=game; visualHand=game.hand; visualEvent=0;
  }
  const seats = [document.querySelector('.hero'), ...document.querySelectorAll('.seat')];
  seats.forEach((seat,i)=>{
    seat.querySelector('.seat-chips')?.remove();
    seat.querySelector('.waiting-indicator')?.remove();
    const chips = document.createElement('div'); chips.className='seat-chips';
    chips.setAttribute('aria-label',`剩余筹码 ${fmt(game.players[i].stack)}`);
    chips.innerHTML=chipStack(game.players[i].stack,true);
    seat.append(chips);
    if (game.actor===i && !['ready','done'].includes(game.phase)) {
      const waiting=document.createElement('span'); waiting.className='waiting-indicator';
      waiting.innerHTML=`<span>${i===0?'等待你操作':'思考中'}</span><i></i><i></i><i></i>`;
      const actionLabel=seat.querySelector('.seat-action');
      if (actionLabel) actionLabel.replaceChildren(waiting);
      else seat.querySelector('.hero-info').append(waiting);
    }
  });
  let potChips=$('potChips');
  if (!potChips) { potChips=document.createElement('div');potChips.id='potChips';potChips.className='pot-chips';document.querySelector('.pot-line').prepend(potChips); }
  potChips.innerHTML=chipStack(game.phase==='done'?0:game.pot);
  document.body.dataset.phase=game.phase;
  document.querySelector('.turn-line').classList.toggle('waiting',!['ready','done'].includes(game.phase));
  const anchor=i=>seats[i]?.querySelector('.seat-chips');
  for (const event of game.events.slice(visualEvent)) {
    if (event.type==='blind') { flyChips(anchor(event.sb),potChips,event.sbAmount);flyChips(anchor(event.bb),potChips,event.bbAmount,100); }
    if (event.type==='action' && event.paid>0) flyChips(anchor(event.seat),potChips,event.paid,0,event.seat===0&&selectedAmount()===event.paid?TableChips.denominations.map(value=>({value,count:selectedChips.filter(v=>v===value).length})):null);
    if (event.type==='payout') event.seats.forEach((seat,i)=>flyChips(potChips,anchor(seat),Math.floor(event.amount/event.seats.length)+(i<event.amount%event.seats.length?1:0),200+i*150));
  }
  visualEvent=game.events.length;
  const context=[game.hand,game.phase,game.actor,game.players[0].stack,game.players[0].bet].join(':');
  if(selectionContext!==context){selectedChips=[];selectionContext=context;cancelChipDrag();}
  updateChipSelection();
}
let momentGame=null,momentHand=-1,momentBoard='',momentKey='',momentUntil=0,momentTimer;
function renderHandMoment(){
  const hero=game.players[0],boardKey=game.board.map(c=>`${c.r}:${c.s}`).join(',');
  if(momentGame!==game||momentHand!==game.hand){momentGame=game;momentHand=game.hand;momentBoard='';momentKey='';momentUntil=0;}
  let banner=$('handMoment');
  if(!banner){banner=document.createElement('div');banner.id='handMoment';banner.setAttribute('role','status');banner.hidden=true;document.querySelector('.controls').prepend(banner);}
  const moment=!hero.folded&&game.phase!=='done'?Poker.handMoment(hero.cards,game.board):null;
  if(boardKey!==momentBoard){
    momentBoard=boardKey;
    if(moment&&moment.key!==momentKey){
      momentKey=moment.key;momentUntil=Date.now()+2300;
      banner.innerHTML=`<strong>击中${moment.label}</strong><small>你的当前最佳组合 · 非胜负判定</small>`;
      banner.classList.remove('moment-enter');void banner.offsetWidth;banner.classList.add('moment-enter');
      clearTimeout(momentTimer);momentTimer=setTimeout(renderHandMoment,2350);
    }else if(!moment){momentKey='';momentUntil=0;}
  }
  const active=!!moment&&Date.now()<momentUntil;
  banner.hidden=!active;document.querySelector('.board-area').classList.toggle('hand-impact',active);
  for(const [id,cards] of [['board',game.board],['hole',hero.cards]]){
    [...$(id).children].forEach((el,i)=>el.classList.toggle('best-card',active&&moment.cards.some(c=>c.r===cards[i]?.r&&c.s===cards[i]?.s)));
  }
}
function render() {
  const ajiePose = pose.hand===game.hand && Date.now()<pose.until ? pose.state : game.actor===3 ? 'thinking' : 'idle';
  $('handLabel').textContent = `第 ${String(game.hand || 1).padStart(2, '0')} 手`; $('phaseLabel').textContent = phases[game.phase];
  $('pot').innerHTML = `${fmt(game.pot)} <small>${game.phase === 'done' ? '已结算' : '筹码'}</small>`;
  $('board').innerHTML = Array.from({length:5}, (_, i) => card(game.board[i], ['翻','牌','圈','转牌','河牌'][i])).join('');
  $('hole').innerHTML = [0,1].map(i => card(game.players[0].cards[i], '待发')).join('');
  $('opponents').innerHTML = game.players.slice(1).map((p,j) => `<article class="seat seat-${j+1} ${p.folded ? 'folded' : ''} ${game.actor === j+1 ? 'active' : ''} ${game.phase === 'done' && p.stack > p.startStack ? 'winner' : ''}" aria-label="${p.name}的座位"><div class="portrait" style="--sprite:${j*25}%;${j===2 ? `--pose:${poses[ajiePose]*20}%` : ''}" aria-hidden="true"></div><div class="nameplate"><div class="seat-name">${p.name}<span class="pos">${position(j+1)}</span></div><div class="seat-stack"><small>筹码</small> ${fmt(p.stack)}</div><div class="seat-action">${game.actor === j+1 ? '正在思考…' : p.last || p.style}</div>${game.showdown && !p.folded ? `<div class="cards revealed" aria-label="${p.name}亮牌：${p.cards.map(cardText).join('、')}">${p.cards.map(c=>card(c)).join('')}</div>` : ''}</div><p class="tell"></p></article>`).join('');
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
  const result = $('result');
  result.hidden = !game.results.length;
  const net = hero.stack - hero.startStack;
  if (game.results.length) {
    const summary = document.createElement('strong');
    summary.className = `result-summary ${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}`;
    summary.textContent = net === 0 ? '本手结果 · 你持平' : `本手结果 · 你净${net > 0 ? '赢' : '输'} ${fmt(Math.abs(net))}`;
    const payouts = document.createElement('div');
    payouts.className = 'result-payouts';
    for (const r of game.results) {
      const payout = document.createElement('div');
      payout.className = 'result-payout';
      const title = document.createElement('span');
      title.textContent = `${r.names} 收回 ${fmt(r.amount)} · ${r.label}`;
      payout.append(title);
      if (r.hands?.length) {
        const best = document.createElement('small');
        best.textContent = `最佳五张：${r.hands.map(h=>`${game.players[h.seat].name} ${h.cards.map(cardText).join(' ')}`).join('；')}`;
        payout.append(best);
      }
      payouts.append(payout);
    }
    result.replaceChildren(summary,payouts);
  } else result.replaceChildren();
  $('review').hidden = !game.history.length;
  const journal = $('journal'), nearBottom = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
  if (shown > game.logs.length) { journal.replaceChildren(); shown = 0; }
  // Keep the journal keyed by entries, even when the engine trims its bounded history.
  const fresh = game.logs.filter(l=>!l.displayed);
  for (const l of fresh) { const el = document.createElement('div'); el.className = `entry log-${l.kind}`; const small = document.createElement('small'); small.textContent = `第 ${String(l.hand).padStart(2,'0')} 手 / ${l.kind === 'talk' ? '桌边' : '现场'}`; el.append(small, document.createTextNode(l.text)); journal.append(el); l.displayed = true; }
  while (journal.children.length > 240) journal.firstElementChild.remove(); shown = game.logs.length;
  if (nearBottom) journal.scrollTop = journal.scrollHeight;
  $('latest').hidden = journal.scrollHeight - journal.scrollTop - journal.clientHeight < 70;
  renderTableActivity();
  renderHandMoment();
}
function schedule() {
  clearTimeout(timer); saveGame();
  if (game.phase==='done' && (pose.hand!==game.hand || !['winning','losing'].includes(pose.state))) {
    const delta=game.players[3].stack-game.players[3].startStack;
    if (delta) setPose(delta>0?'winning':'losing');
  }
  render(); if (game.phase === 'done' || game.phase === 'ready' || game.actor === 0) return;
  // A separate UI-only variation gives each opponent a readable thinking interval.
  const delay = +$('speed').value * (game.awaitingStreet ? 1 : 1.1 + Math.random()*.5);
  timer = setTimeout(()=> { try { if (game.awaitingStreet) game.street(); else {const actor=game.actor, move=Poker.bot(game); game.act(...move); if(actor===3) setPose(move[0]==='fold'?'folding':move[0]==='raise'?'betting':'idle');} schedule(); } catch(e) { $('error').textContent = e.message; } }, delay);
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
// Keep the drag handle stable while the individual bank tokens are re-rendered.
const chipTray=document.createElement('div');
chipTray.id='chipSelection';chipTray.hidden=true;
chipTray.innerHTML='<span id="selectedChipAmount" role="status"></span><button id="throwChips" type="button" disabled><span id="selectedChipPreview"></span><span>拖动 / 点击投放</span></button><button id="resetChips" type="button" disabled>放回</button>';
document.querySelector('.controls').append(chipTray);
const chipDropZone=document.createElement('div');chipDropZone.id='chipDropZone';chipDropZone.hidden=true;chipDropZone.textContent='拖到这里投放';document.querySelector('.board-area').append(chipDropZone);
document.querySelector('.hero').addEventListener('click',e=>{
  if(suppressChipClick){suppressChipClick=false;return;}
  const button=e.target.closest('[data-pick-chip]');if(!button||game.actor!==0)return;
  const value=Number(button.dataset.pickChip),available=TableChips.split(game.players[0].stack,true).find(g=>g.value===value)?.count||0;
  if(selectedChips.filter(v=>v===value).length<available){selectedChips.push(value);updateChipSelection();}
});
$('resetChips').onclick=clearChipSelection;
let suppressChipClick=false;
$('throwChips').onclick=()=>{if(!suppressChipClick)submitChips();suppressChipClick=false;};
function cancelChipDrag(){
  if(dragChips?.moved)suppressChipClick=true;
  dragChips?.ghost?.remove();dragChips=null;chipDropZone.classList.remove('drag-over');document.querySelector('.board-area').classList.remove('drag-over');
}
function beginChipDrag(e){
  const source=e.target.closest('[data-pick-chip]');
  if(e.button!==0||game.actor!==0||(!source&&e.currentTarget!==$('throwChips'))||document.querySelector('dialog[open]'))return;
  suppressChipClick=false;dragChips={x:e.clientX,y:e.clientY,moved:false,value:Number(source?.dataset.pickChip)||0};e.currentTarget.setPointerCapture(e.pointerId);
}
function moveChipDrag(e){
  if(!dragChips)return;
  if(Math.hypot(e.clientX-dragChips.x,e.clientY-dragChips.y)>6&&!dragChips.moved){
    if(!selectedAmount()&&dragChips.value){selectedChips.push(dragChips.value);updateChipSelection();}
    if(!selectedAmount())return;
    dragChips.moved=true;const ghost=document.createElement('div');ghost.className='chip-drag-ghost';ghost.innerHTML=$('selectedChipPreview').innerHTML;document.body.append(ghost);dragChips.ghost=ghost;
  }
  if(dragChips.ghost){dragChips.ghost.style.left=`${e.clientX}px`;dragChips.ghost.style.top=`${e.clientY}px`;}
  const r=document.querySelector('.board-area').getBoundingClientRect(),inside=e.clientX>=r.left-12&&e.clientX<=r.right+12&&e.clientY>=r.top-12&&e.clientY<=r.bottom+30;
  chipDropZone.classList.toggle('drag-over',inside);document.querySelector('.board-area').classList.toggle('drag-over',inside);
}
function endChipDrag(e){
  if(!dragChips)return;moveChipDrag(e);const moved=dragChips.moved,value=dragChips.value,inside=chipDropZone.classList.contains('drag-over');
  cancelChipDrag();suppressChipClick=moved;
  if(!moved&&value){
    const available=TableChips.split(game.players[0].stack,true).find(g=>g.value===value)?.count||0;
    if(selectedChips.filter(v=>v===value).length<available){selectedChips.push(value);updateChipSelection();}
    suppressChipClick=true;
  }
  if(moved&&inside)submitChips();
  else if(moved)$('error').textContent='未投放：筹码仍在你面前，请拖到发光的公共牌区域。';
}
for(const handle of [$('throwChips'),document.querySelector('.hero')]){
  handle.addEventListener('pointerdown',beginChipDrag);handle.addEventListener('pointermove',moveChipDrag);handle.addEventListener('pointerup',endChipDrag);
  handle.addEventListener('pointercancel',()=>{suppressChipClick=true;cancelChipDrag();});
  handle.addEventListener('lostpointercapture',()=>{if(dragChips){suppressChipClick=true;cancelChipDrag();}});
}
window.addEventListener('blur',cancelChipDrag);window.addEventListener('resize',cancelChipDrag);
document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelChipDrag();});
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
const usesMacNativeWindow = /Macintosh|Mac OS X/.test(navigator.userAgent);
if (appWindow && !usesMacNativeWindow) {
  $('winControls').hidden = false;
  $('winMin').onclick = () => appWindow.minimize();
  $('winMax').onclick = () => appWindow.toggleMaximize();
  $('winClose').onclick = () => appWindow.close();
}
