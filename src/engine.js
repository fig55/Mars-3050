(function (root) {
  'use strict';
  const names = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
  const deck = () => Array.from({ length: 52 }, (_, i) => ({ r: i % 13 + 2, s: Math.floor(i / 13) }));
  const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  // Frozen baseline: test.js keeps an independent copy of this as refEvaluate.
  // Do not touch these two until the fast bitwise evaluator lands in stage 3.
  function five(cards) {
    const ranks = cards.map(c => c.r).sort((a, b) => b - a), groups = [...new Set(ranks)].map(r => [ranks.filter(v => v === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const flush = cards.every(c => c.s === cards[0].s), unique = [...new Set(ranks)];
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
  function evaluate(cards) {
    let best = [-1];
    for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++) for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++) for (let e = d + 1; e < cards.length; e++) {
      const score = five([cards[a], cards[b], cards[c], cards[d], cards[e]]); if (compare(score, best) > 0) best = score;
    }
    return best;
  }
  function bestFive(cards) {
    const target = evaluate(cards);
    for (let a=0;a<cards.length-4;a++) for(let b=a+1;b<cards.length-3;b++) for(let c=b+1;c<cards.length-2;c++) for(let d=c+1;d<cards.length-1;d++) for(let e=d+1;e<cards.length;e++) {
      const hand=[cards[a],cards[b],cards[c],cards[d],cards[e]];
      if (compare(five(hand),target)===0) return hand.map(card=>({r:card.r,s:card.s}));
    }
    return [];
  }

  // Table rules and seat count. Nothing here may encode a specific seat count:
  // the engine must stay correct for any players.length the content provides.
  const DEFAULT_CONFIG = {
    seats: 6,
    startingStack: 2000,
    blinds: { sb: 10, bb: 20 },
    heroIndex: 0,
    content: null
  };

  // Every human-readable string lives here, never in the engine. `format` is a pure
  // function of the event, so a recorded event replays to identical text forever.
  // `kinds` maps an event type to the log style the UI colours it with.
  // Tells are callbacks rather than plain strings because the engine interleaves rng
  // draws with them: they receive the rng *function* so the draw lands at the same
  // point in the sequence as the original inline implementation.
  const DEFAULT_CONTENT = {
    seats: [
      { name: '你', style: '沉着应战', aggression: 0, foldBias: 0.17, habit: '拇指停在牌角，试着让呼吸平稳。' },
      { name: '老陈', style: '老练 · 紧凶', aggression: 0.16, foldBias: 0.17, habit: '把筹码码成同样高的小摞，眼皮都没抬。' },
      { name: '林小姐', style: '冷静 · 均衡', aggression: 0.13, foldBias: 0.17, habit: '确认了一遍下注数额，轻轻点头。' },
      { name: '阿杰', style: '张扬 · 松凶', aggression: 0.32, foldBias: 0.17, habit: '向椅背一靠：「看看谁敢跟。」' },
      { name: '周先生', style: '谨慎 · 紧弱', aggression: 0.06, foldBias: 0.30, habit: '反复看了一眼剩余筹码，才收回手。' },
      { name: '小鹿', style: '灵动 · 松跟', aggression: 0.12, foldBias: 0.17, habit: '笑着看了看众人，又迅速收起笑容。' }
    ],
    tells: {
      initial: () => '把筹码整齐地码在面前。',
      idle: () => '看了一眼自己的筹码，没有说话。',
      out: () => '推开椅子，离开了牌桌。',
      habit: (p) => p.habit,
      action: (p, ev, rng) => {
        const list = ev.kind === 'fold'
          ? ['将牌轻轻推向荷官，靠回椅背。', '抿了一下嘴唇，松开压着牌的手。']
          : ev.kind === 'raise'
            ? ['数出筹码推向桌心，目光停在对面。', '指尖停顿了一瞬，随后把筹码推了出去。', '嘴角浮起一点笑意，没有解释。']
            : ['指节轻叩桌沿，神色未变。', '看了看公共牌，又看向对面的手。', '缓缓呼出一口气，挪了挪椅子。'];
        return list[Math.floor(rng() * list.length)];
      },
      allInAside: () => '面前一枚筹码也没剩下，双手慢慢离开桌沿。',
      bigPotAside: () => '桌上的筹码让这次沉默显得格外漫长。',
      bust: (p, d) => d < -400 ? '盯着空出来的位置，久久没有说话。' : '重新数了数面前的筹码，轻轻叹气。',
      win: () => '把赢来的筹码拢到面前，努力压住笑意。'
    },
    labels: {
      waiting: '等待行动',
      left: '已离桌',
      fold: '弃牌',
      check: '过牌',
      call: (n) => `跟注 ${n}`,
      callAllIn: (n) => `全下跟注 ${n}`,
      raiseTo: (a) => `加注至 ${a}`,
      allInTo: (a) => `全下至 ${a}`,
      handResult: (d) => d > 0 ? `本手 +${d}` : `本手 ${d}`,
      potMain: '主池',
      potSide: '边池',
      split: '平分',
      refund: '未获跟注，退回',
      uncontested: '其他玩家全部弃牌'
    },
    kinds: { handStart: 'street', blind: 'action', street: 'street', action: 'action', payout: 'win', bust: 'reaction' },
    format: (e) => {
      switch (e.type) {
        case 'handStart': return `第 ${e.hand} 手 · 庄家 ${e.buttonName}。洗牌声停下，所有人向桌边靠了靠。`;
        case 'blind': return `${e.sbName} 放入小盲 ${e.sbAmount}；${e.bbName} 放入大盲 ${e.bbAmount}。`;
        case 'street': return `${({ flop: '翻牌', turn: '转牌', river: '河牌' })[e.street]}落下。${e.street === 'river' ? '最后一张牌，桌边突然安静了。' : '几道目光同时移向桌心。'}`;
        case 'action': return `${e.name} ${e.last}。${e.tell}`;
        case 'payout': return `${e.names} 收回 ${e.amount} 筹码（${e.label}）。`;
        case 'bust': return `${e.name} 输掉 ${-e.delta} 筹码。${e.tell}${e.busted ? '他的位置空了下来。' : ''}`;
        default: return '';
      }
    }
  };

  class Game {
    // Accepts both the historical new Game() / new Game(rng) and the configured
    // new Game(config) / new Game(config, rng) forms.
    constructor(a = Math.random, b) {
      const config = typeof a === 'function'
        ? { ...DEFAULT_CONFIG, rng: a, aiRng: a }
        : { ...DEFAULT_CONFIG, ...a };
      if (typeof b === 'function') config.rng = config.aiRng = b;
      config.rng ??= Math.random;
      config.aiRng ??= config.rng;
      if (typeof config.rng !== 'function' || typeof config.aiRng !== 'function') throw new TypeError('rng 和 aiRng 必须是随机函数');

      this.config = config;
      this.content = config.content || DEFAULT_CONTENT;
      this.rng = config.rng;
      this.aiRng = config.aiRng;

      if (this.content.seats.length < config.seats) throw Error(`座位定义不足：需要 ${config.seats} 个，内容只提供了 ${this.content.seats.length} 个`);
      // seat is the stable seat index: it survives elimination, and the odd-chip
      // rule in settle() orders winners relative to the button through it.
      this.players = this.content.seats.slice(0, config.seats).map((s, seat) => ({
        seat,
        name: s.name,
        stack: config.startingStack,
        cards: [],
        total: 0,
        bet: 0,
        folded: false,
        style: s.style,
        habit: s.habit,
        tell: this.content.tells.initial(),
        last: '',
        profile: { aggression: s.aggression, foldBias: s.foldBias }
      }));

      this.logs = [];
      this.history = [];
      this.hand = 0;
      this.button = -1;
      this.phase = 'ready';
      this.resetHand();
    }
    // Per-hand state, reset from the constructor too: settle() must work on a hand
    // assembled by hand that never called start().
    resetHand() {
      this.board = [];
      this.deck = [];
      this.results = [];
      this.events = [];
      this.pending = new Set();
      this.current = 0;
      this.minRaise = this.config.blinds.bb;
      this.actor = -1;
      this.awaitingStreet = false;
      this.showdown = false;
      this.sb = -1;
      this.bb = -1;
    }
    log(text, kind = 'action') { this.logs.push({ text, kind, hand: this.hand }); if (this.logs.length > 240) this.logs.shift(); }
    // Single write point for engine narration: the event is the public, replayable
    // record of the hand, the log line is merely its rendering. Events are scoped to
    // the current hand by resetHand(), so the array stays bounded.
    emit(event) {
      event.hand = this.hand;
      this.events.push(event);
      this.log(this.content.format(event, this), this.content.kinds[event.type]);
    }
    next(from, test) { for (let n = 1; n <= this.players.length; n++) { const i = (from + n) % this.players.length; if (test(this.players[i], i)) return i; } return -1; }
    get pot() { return this.players.reduce((s, p) => s + p.total, 0); }
    pay(i, amount) { const p = this.players[i], n = Math.min(p.stack, amount); p.stack -= n; p.bet += n; p.total += n; return n; }
    start() {
      if (!['ready', 'done'].includes(this.phase)) throw Error('本手尚未结束');
      if (this.players.filter(p => p.stack > 0).length < 2) return false;
      const blinds = this.config.blinds;
      this.resetHand();
      this.hand++; this.phase = 'preflop';
      this.current = blinds.bb; this.minRaise = blinds.bb;
      this.deck = deck(); for (let i = 51; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
      this.players.forEach(p => { p.cards = []; p.bet = 0; p.total = 0; p.folded = p.stack === 0; p.actedAt = null; p.startStack = p.stack; p.last = p.stack ? this.content.labels.waiting : this.content.labels.left; p.tell = p.stack ? this.content.tells.idle(p, this) : this.content.tells.out(p, this); });
      this.button = this.next(this.button, p => !p.folded);
      const count = this.players.filter(p => !p.folded).length;
      this.sb = count === 2 ? this.button : this.next(this.button, p => !p.folded); this.bb = this.next(this.sb, p => !p.folded);
      for (let round = 0; round < 2; round++) { let i = this.button; for (let n = 0; n < count; n++) { i = this.next(i, p => !p.folded); this.players[i].cards.push(this.deck.pop()); } }
      this.emit({ type: 'handStart', button: this.button, buttonName: this.players[this.button].name });
      this.pay(this.sb, blinds.sb); this.pay(this.bb, blinds.bb);
      this.emit({ type: 'blind', sb: this.sb, bb: this.bb, sbName: this.players[this.sb].name, sbAmount: this.players[this.sb].bet, bbName: this.players[this.bb].name, bbAmount: this.players[this.bb].bet });
      this.pending = new Set(this.players.map((p, i) => !p.folded && p.stack ? i : -1).filter(i => i >= 0)); this.advance(this.bb); return true;
    }
    options(i = this.actor) {
      const p = this.players[i]; if (!p || i !== this.actor || this.phase === 'done') return null;
      const call = Math.min(p.stack, Math.max(0, this.current - p.bet)), max = p.bet + p.stack;
      const reopened = p.actedAt === null || this.current - p.actedAt >= this.minRaise;
      const canRaise = max > this.current && reopened && this.players.some((q, j) => j !== i && !q.folded && q.stack > 0);
      return { call, min: this.current + this.minRaise, max, canRaise };
    }
    act(type, amount) {
      const i = this.actor, p = this.players[i], o = this.options(); if (!o) throw Error('当前不能行动');
      if (!['fold', 'call', 'raise'].includes(type)) throw Error('无效动作');
      if (type === 'raise' && (!o.canRaise || !Number.isInteger(amount) || amount <= this.current || amount > o.max || (amount < o.min && amount !== o.max))) throw Error('加注金额不符合规则');
      const L = this.content.labels;
      // `move` is the normalised action key ('check' is a call of zero) that stats
      // and replays consume; `paid` is what actually left the stack.
      let move = type, paid = 0;
      if (type === 'fold') { p.folded = true; p.last = L.fold; }
      else if (type === 'call') {
        paid = this.pay(i, o.call);
        move = paid ? 'call' : 'check';
        p.last = paid ? (p.stack === 0 ? L.callAllIn(paid) : L.call(paid)) : L.check;
      }
      else {
        const delta = amount - this.current; paid = this.pay(i, amount - p.bet);
        if (delta >= this.minRaise) this.minRaise = delta;
        this.current = amount; p.last = p.stack === 0 ? L.allInTo(amount) : L.raiseTo(amount);
        this.players.forEach((q, j) => { if (j !== i && !q.folded && q.stack && q.bet < this.current) this.pending.add(j); });
      }
      p.actedAt = this.current; this.pending.delete(i);
      // One draw always; the second draw happens only when the habit branch loses,
      // exactly as the original inline ternary short-circuited.
      const roll = this.rng();
      p.tell = roll < .4 && type !== 'fold'
        ? this.content.tells.habit(p, { kind: type, amount }, this)
        : this.content.tells.action(p, { kind: type, amount }, this.rng);
      if (!p.stack && !p.folded) p.tell += this.content.tells.allInAside(p, this);
      else if (this.pot > 1200 && this.rng() < .4) p.tell += this.content.tells.bigPotAside(p, this);
      this.emit({ type: 'action', seat: i, name: p.name, move, street: this.phase, last: p.last, tell: p.tell, amount: type === 'raise' ? amount : paid, paid, pot: this.pot });
      this.advance(i);
    }
    advance(from) {
      const live = this.players.filter(p => !p.folded);
      if (live.length === 1) {
        const p = live[0], amount = this.pot; p.stack += amount;
        this.results = [{ seats: [p.seat], names: p.name, amount, label: this.content.labels.uncontested }];
        this.finish(); return;
      }
      for (const i of this.pending) if (this.players[i].folded || !this.players[i].stack) this.pending.delete(i);
      const able = this.players.filter(p => !p.folded && p.stack);
      if (able.length === 1 && able[0].bet >= this.current) this.pending.clear();
      if (this.pending.size) { this.actor = this.next(from, (_, i) => this.pending.has(i)); return; }
      this.actor = -1; // The UI reveals each remaining street separately, including all-in runouts.
      this.awaitingStreet = true;
    }
    street() {
      if (!this.awaitingStreet || this.phase === 'done') return;
      this.awaitingStreet = false;
      if (this.phase === 'river') { this.settle(); return; }
      const next = { preflop: 'flop', flop: 'turn', turn: 'river' }; this.phase = next[this.phase]; this.deck.pop();
      for (let n = 0; n < (this.phase === 'flop' ? 3 : 1); n++) this.board.push(this.deck.pop());
      this.current = 0; this.minRaise = this.config.blinds.bb; this.players.forEach(p => { p.bet = 0; p.actedAt = null; });
      this.emit({ type: 'street', street: this.phase, board: this.board.map(c => ({ r: c.r, s: c.s })) });
      this.pending = new Set(this.players.map((p, i) => !p.folded && p.stack ? i : -1).filter(i => i >= 0)); this.advance(this.button);
    }
    settle() {
      this.showdown = true;
      const L = this.content.labels, n = this.players.length;
      const levels = [...new Set(this.players.map(p => p.total).filter(Boolean))].sort((a, b) => a - b); let previous = 0;
      for (const level of levels) {
        const contributors = this.players.filter(p => p.total >= level), amount = (level - previous) * contributors.length; previous = level;
        if (contributors.length === 1) { contributors[0].stack += amount; this.results.push({ seats: [contributors[0].seat], names: contributors[0].name, amount, label: L.refund }); continue; }
        const eligible = contributors.filter(p => !p.folded); let best = [-1], winners = [];
        for (const p of eligible) { const score = evaluate([...p.cards, ...this.board]), cmp = compare(score, best); if (cmp > 0) { best = score; winners = [p]; } else if (cmp === 0) winners.push(p); }
        if (!winners.length) throw Error('底池缺少有效玩家');
        // Odd chips go to the first winner clockwise from the button. Seat count
        // must come from players.length, never a literal.
        winners.sort((a, b) => ((a.seat - this.button + n - 1) % n) - ((b.seat - this.button + n - 1) % n));
        winners.forEach((p, i) => p.stack += Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0));
        this.results.push({ seats: winners.map(p => p.seat), names: winners.map(p => p.name).join('、'), amount, label: `${this.results.length ? L.potSide : L.potMain} · ${names[best[0]]}${winners.length > 1 ? ' · ' + L.split : ''}`, hands: winners.map(p=>({seat:p.seat,cards:bestFive([...p.cards,...this.board])})) });
      }
      this.finish();
    }
    finish() {
      this.phase = 'done'; this.actor = -1; this.awaitingStreet = false;
      this.results.forEach(r => this.emit({ type: 'payout', seats: r.seats, names: r.names, amount: r.amount, label: r.label }));
      this.players.forEach(p => {
        const d = p.stack - p.startStack; p.last = this.content.labels.handResult(d);
        if (d < 0) { p.tell = this.content.tells.bust(p, d, this); this.emit({ type: 'bust', seat: p.seat, name: p.name, delta: d, tell: p.tell, busted: p.stack === 0 }); }
        else if (d > 0) p.tell = this.content.tells.win(p, this);
      });
      this.history.push({hand:this.hand,button:this.button,board:this.board.map(c=>({r:c.r,s:c.s})),heroCards:this.players[this.config.heroIndex].cards.map(c=>({r:c.r,s:c.s})),events:this.events.map(e=>structuredClone(e)),results:structuredClone(this.results),net:this.players.map(p=>p.stack-p.startStack)});
      if(this.history.length>10) this.history.shift();
    }
  }
  // ponytail: personality-weighted heuristics, not a solver; replace with equity simulation for stronger opponents.
  function bot(game) {
    const p = game.players[game.actor], o = game.options(), r = game.rng();
    const [a,b] = p.cards;
    let strength;
    if (!game.board.length) strength = .18 + (a.r+b.r)/28*.42 + (a.r===b.r ? .18+a.r/140 : 0) + (a.s===b.s ? .05 : 0) + (Math.abs(a.r-b.r)<=2 ? .05 : 0);
    else {
      const hand = evaluate([...p.cards,...game.board]);
      strength = [.22,.48,.68,.8,.89,.92,.96,.985,.995][hand[0]] + (hand[1]||0)/14*.05;
      if (game.board.length===5 && compare(hand,evaluate(game.board))===0) strength -= .08;
      const suits = [0,1,2,3].map(s=>[...p.cards,...game.board].filter(c=>c.s===s).length);
      if (game.board.length<5 && Math.max(...suits)===4 && p.cards.some(c=>c.s===suits.indexOf(4))) strength += .12;
    }
    const late = ((game.actor-game.button+game.players.length)%game.players.length)/(game.players.length-1);
    strength += late*.06;
    const price = o.call / Math.max(1,game.pot+o.call);
    if (o.call && strength+r*.24 < price+p.profile.foldBias) return ['fold'];
    if (o.canRaise && r < p.profile.aggression*(strength>.55?1.4:.45) + (strength>.78?.18:0)) {
      const amount = Math.min(o.max,Math.max(o.min,game.current+Math.ceil(game.pot*(.25+strength*.7)/10)*10)); return ['raise',amount];
    }
    return ['call'];
  }
  root.Poker = { Game, evaluate, bestFive, compare, deck, names, bot, DEFAULT_CONFIG, DEFAULT_CONTENT };
  if (typeof module !== 'undefined') module.exports = root.Poker;
})(typeof window !== 'undefined' ? window : globalThis);
