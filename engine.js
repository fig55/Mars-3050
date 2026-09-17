(function (root) {
  'use strict';
  const names = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
  const deck = () => Array.from({ length: 52 }, (_, i) => ({ r: i % 13 + 2, s: Math.floor(i / 13) }));
  const compare = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
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
  class Game {
    constructor(rng = Math.random) {
      this.rng = rng; this.button = -1; this.hand = 0; this.phase = 'ready'; this.logs = []; this.actor = -1; this.board = []; this.results = [];
      this.players = ['你', '老陈', '林小姐', '阿杰', '周先生', '小鹿'].map((name, i) => ({ name, stack: 2000, cards: [], total: 0, bet: 0, folded: false, style: ['沉着应战', '老练 · 紧凶', '冷静 · 均衡', '张扬 · 松凶', '谨慎 · 紧弱', '灵动 · 松跟'][i], tell: '把筹码整齐地码在面前。' }));
    }
    log(text, kind = 'action') { this.logs.push({ text, kind, hand: this.hand }); if (this.logs.length > 240) this.logs.shift(); }
    next(from, test) { for (let n = 1; n <= this.players.length; n++) { const i = (from + n) % this.players.length; if (test(this.players[i], i)) return i; } return -1; }
    get pot() { return this.players.reduce((s, p) => s + p.total, 0); }
    pay(i, amount) { const p = this.players[i], n = Math.min(p.stack, amount); p.stack -= n; p.bet += n; p.total += n; return n; }
    start() {
      if (!['ready', 'done'].includes(this.phase)) throw Error('本手尚未结束');
      if (this.players.filter(p => p.stack > 0).length < 2) return false;
      this.hand++; this.board = []; this.results = []; this.phase = 'preflop'; this.showdown = false; this.current = 20; this.minRaise = 20;
      this.deck = deck(); for (let i = 51; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; }
      this.players.forEach(p => { p.cards = []; p.bet = 0; p.total = 0; p.folded = p.stack === 0; p.actedAt = null; p.startStack = p.stack; p.last = p.stack ? '等待行动' : '已离桌'; p.tell = p.stack ? '看了一眼自己的筹码，没有说话。' : '推开椅子，离开了牌桌。'; });
      this.button = this.next(this.button, p => !p.folded);
      const count = this.players.filter(p => !p.folded).length;
      this.sb = count === 2 ? this.button : this.next(this.button, p => !p.folded); this.bb = this.next(this.sb, p => !p.folded);
      for (let round = 0; round < 2; round++) { let i = this.button; for (let n = 0; n < count; n++) { i = this.next(i, p => !p.folded); this.players[i].cards.push(this.deck.pop()); } }
      this.log(`第 ${this.hand} 手 · 庄家 ${this.players[this.button].name}。洗牌声停下，所有人向桌边靠了靠。`, 'street');
      this.pay(this.sb, 10); this.pay(this.bb, 20); this.log(`${this.players[this.sb].name} 放入小盲 ${this.players[this.sb].bet}；${this.players[this.bb].name} 放入大盲 ${this.players[this.bb].bet}。`);
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
      if (type === 'fold') { p.folded = true; p.last = '弃牌'; }
      else if (type === 'call') { const n = this.pay(i, o.call); p.last = n ? `${p.stack === 0 ? '全下跟注' : '跟注'} ${n}` : '过牌'; }
      else {
        const delta = amount - this.current; this.pay(i, amount - p.bet);
        if (delta >= this.minRaise) this.minRaise = delta;
        this.current = amount; p.last = `${p.stack === 0 ? '全下' : '加注'}至 ${amount}`;
        this.players.forEach((q, j) => { if (j !== i && !q.folded && q.stack && q.bet < this.current) this.pending.add(j); });
      }
      p.actedAt = this.current; this.pending.delete(i);
      const gestures = type === 'fold' ? ['将牌轻轻推向荷官，靠回椅背。', '抿了一下嘴唇，松开压着牌的手。'] : type === 'raise' ? ['数出筹码推向桌心，目光停在对面。', '指尖停顿了一瞬，随后把筹码推了出去。', '嘴角浮起一点笑意，没有解释。'] : ['指节轻叩桌沿，神色未变。', '看了看公共牌，又看向对面的手。', '缓缓呼出一口气，挪了挪椅子。'];
      const habits = ['拇指停在牌角，试着让呼吸平稳。', '把筹码码成同样高的小摞，眼皮都没抬。', '确认了一遍下注数额，轻轻点头。', '向椅背一靠：「看看谁敢跟。」', '反复看了一眼剩余筹码，才收回手。', '笑着看了看众人，又迅速收起笑容。'];
      p.tell = this.rng() < .4 && type !== 'fold' ? habits[i] : gestures[Math.floor(this.rng() * gestures.length)];
      if (!p.stack && !p.folded) p.tell += '面前一枚筹码也没剩下，双手慢慢离开桌沿。';
      else if (this.pot > 1200 && this.rng() < .4) p.tell += '桌上的筹码让这次沉默显得格外漫长。';
      this.log(`${p.name} ${p.last}。${p.tell}`);
      this.advance(i);
    }
    advance(from) {
      const live = this.players.filter(p => !p.folded);
      if (live.length === 1) { const p = live[0], amount = this.pot; p.stack += amount; this.results = [{ names: p.name, amount, label: '其他玩家全部弃牌' }]; this.finish(); return; }
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
      this.current = 0; this.minRaise = 20; this.players.forEach(p => { p.bet = 0; p.actedAt = null; });
      this.log(`${{ flop: '翻牌', turn: '转牌', river: '河牌' }[this.phase]}落下。${this.phase === 'river' ? '最后一张牌，桌边突然安静了。' : '几道目光同时移向桌心。'}`, 'street');
      this.pending = new Set(this.players.map((p, i) => !p.folded && p.stack ? i : -1).filter(i => i >= 0)); this.advance(this.button);
    }
    settle() {
      this.showdown = true;
      const levels = [...new Set(this.players.map(p => p.total).filter(Boolean))].sort((a, b) => a - b); let previous = 0;
      for (const level of levels) {
        const contributors = this.players.filter(p => p.total >= level), amount = (level - previous) * contributors.length; previous = level;
        if (contributors.length === 1) { contributors[0].stack += amount; this.results.push({ names: contributors[0].name, amount, label: '未获跟注，退回' }); continue; }
        const eligible = contributors.filter(p => !p.folded); let best = [-1], winners = [];
        for (const p of eligible) { const score = evaluate([...p.cards, ...this.board]), cmp = compare(score, best); if (cmp > 0) { best = score; winners = [p]; } else if (cmp === 0) winners.push(p); }
        if (!winners.length) throw Error('底池缺少有效玩家');
        winners.sort((a, b) => ((this.players.indexOf(a) - this.button + 5) % 6) - ((this.players.indexOf(b) - this.button + 5) % 6));
        winners.forEach((p, i) => p.stack += Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0));
        this.results.push({ names: winners.map(p => p.name).join('、'), amount, label: `${this.results.length ? '边池' : '主池'} · ${names[best[0]]}${winners.length > 1 ? ' · 平分' : ''}` });
      }
      this.finish();
    }
    finish() {
      this.phase = 'done'; this.actor = -1; this.awaitingStreet = false;
      this.results.forEach(r => this.log(`${r.names} 收回 ${r.amount} 筹码（${r.label}）。`, 'win'));
      this.players.forEach(p => { const d = p.stack - p.startStack; p.last = d > 0 ? `本手 +${d}` : `本手 ${d}`; if (d < 0) { p.tell = d < -400 ? '盯着空出来的位置，久久没有说话。' : '重新数了数面前的筹码，轻轻叹气。'; this.log(`${p.name} 输掉 ${-d} 筹码。${p.tell}${p.stack === 0 ? '他的位置空了下来。' : ''}`, 'reaction'); } else if (d > 0) p.tell = '把赢来的筹码拢到面前，努力压住笑意。'; });
    }
  }
  // ponytail: personality-weighted heuristics, not a solver; replace with equity simulation for stronger opponents.
  function bot(game) {
    const p = game.players[game.actor], o = game.options(), r = game.rng();
    const [a, b] = p.cards, score = game.board.length ? evaluate([...p.cards, ...game.board])[0] / 8 + 0.2 : (a.r + b.r) / 38 + (a.r === b.r ? 0.28 : 0) + (a.s === b.s ? 0.07 : 0);
    const aggression = [0, .16, .13, .32, .06, .12][game.actor], price = o.call / Math.max(1, game.pot + o.call);
    if (o.call && score + r * .36 < price + (game.actor === 4 ? .3 : .17)) return ['fold'];
    if (o.canRaise && r < aggression + (score > .75 ? .22 : 0)) {
      const amount = Math.min(o.max, Math.max(o.min, game.current + Math.ceil(game.pot * (.35 + score * .4) / 10) * 10)); return ['raise', amount];
    }
    return ['call'];
  }
  root.Poker = { Game, evaluate, compare, deck, names, bot };
  if (typeof module !== 'undefined') module.exports = root.Poker;
})(typeof window !== 'undefined' ? window : globalThis);
