extends RefCounted
class_name PokerGame

const NAMES := ["你", "老陈", "林小姐", "阿杰", "周先生", "小鹿"]
const AGGRESSION := [0.0, 0.16, 0.13, 0.32, 0.06, 0.12]
const FOLD_BIAS := [0.17, 0.17, 0.17, 0.17, 0.30, 0.17]
const BIG_BLIND := 20
const SMALL_BLIND := 10

var players: Array = []
var board: Array = []
var cards_left: Array = []
var results: Array = []
var logs: Array = []
var journal_entries: Array = []
var phase := "ready"
var hand := 0
var button := -1
var sb := -1
var bb := -1
var actor := -1
var current := 0
var min_raise := BIG_BLIND
var pending: Array = []
var awaiting_street := false
var showdown := false
var rng := RandomNumberGenerator.new()

func _init(stacks: Array = []) -> void:
	rng.randomize()
	for i in range(NAMES.size()):
		var stack: int = stacks[i] if i < stacks.size() else 2000
		players.append({"seat": i, "name": NAMES[i], "stack": stack, "cards": [], "total": 0, "bet": 0, "folded": false, "last": "", "acted_at": -1, "start_stack": stack})

func set_seed(value: int) -> void:
	rng.seed = value

func pot() -> int:
	var amount := 0
	for player in players:
		amount += player.total
	return amount

func bankroll() -> int:
	var amount := pot()
	for player in players:
		amount += player.stack
	return amount

func next_seat(from: int, active: Callable) -> int:
	for offset in range(1, players.size() + 1):
		var seat: int = posmod(from + offset, players.size())
		if active.call(players[seat], seat):
			return seat
	return -1

func pay(seat: int, amount: int) -> int:
	var player: Dictionary = players[seat]
	var paid: int = mini(player.stack, amount)
	player.stack -= paid
	player.bet += paid
	player.total += paid
	return paid

func add_log(message: String) -> void:
	logs.push_front(message)
	journal_entries.push_front({"hand": hand, "phase": phase, "message": message})
	if logs.size() > 80:
		logs.resize(80)
	if journal_entries.size() > 80:
		journal_entries.resize(80)

func start() -> bool:
	if phase != "ready" and phase != "done":
		return false
	var alive := 0
	for player in players:
		if player.stack > 0:
			alive += 1
	if alive < 2:
		return false
	board.clear()
	results.clear()
	pending.clear()
	awaiting_street = false
	showdown = false
	hand += 1
	phase = "preflop"
	current = BIG_BLIND
	min_raise = BIG_BLIND
	cards_left = PokerRules.deck()
	for i in range(cards_left.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var tmp: Dictionary = cards_left[i]
		cards_left[i] = cards_left[j]
		cards_left[j] = tmp
	for player in players:
		player.cards = []
		player.bet = 0
		player.total = 0
		player.folded = player.stack == 0
		player.acted_at = -1
		player.start_stack = player.stack
		player.last = "已离桌" if player.folded else "等待行动"
	button = next_seat(button, func(p, _i): return not p.folded)
	sb = button if alive == 2 else next_seat(button, func(p, _i): return not p.folded)
	bb = next_seat(sb, func(p, _i): return not p.folded)
	for _round in range(2):
		var seat := button
		for _n in range(alive):
			seat = next_seat(seat, func(p, _i): return not p.folded)
			players[seat].cards.append(cards_left.pop_back())
	pay(sb, SMALL_BLIND)
	pay(bb, BIG_BLIND)
	add_log("第 %d 手 · 庄家 %s；%s 小盲 %d，%s 大盲 %d。" % [hand, players[button].name, players[sb].name, players[sb].bet, players[bb].name, players[bb].bet])
	for i in range(players.size()):
		if not players[i].folded and players[i].stack > 0:
			pending.append(i)
	advance(bb)
	return true

func options(seat: int = -2) -> Dictionary:
	if seat == -2:
		seat = actor
	if seat < 0 or seat != actor or phase == "done":
		return {}
	var player: Dictionary = players[seat]
	var call: int = mini(player.stack, maxi(0, current - player.bet))
	var maximum: int = player.bet + player.stack
	var reopened: bool = player.acted_at == -1 or current - player.acted_at >= min_raise
	var other_able := false
	for i in range(players.size()):
		if i != seat and not players[i].folded and players[i].stack > 0:
			other_able = true
	return {"call": call, "min": current + min_raise, "max": maximum, "can_raise": maximum > current and reopened and other_able}

func act(action: String, amount: int = 0) -> bool:
	var opt := options()
	if opt.is_empty() or action not in ["fold", "call", "raise"]:
		return false
	if action == "raise" and (not opt.can_raise or amount <= current or amount > opt.max or (amount < opt.min and amount != opt.max)):
		return false
	var seat := actor
	var player: Dictionary = players[seat]
	if action == "fold":
		player.folded = true
		player.last = "弃牌"
	elif action == "call":
		var paid := pay(seat, opt.call)
		player.last = "过牌" if paid == 0 else "跟注 %d" % paid
	else:
		var increase := amount - current
		pay(seat, amount - player.bet)
		if increase >= min_raise:
			min_raise = increase
		current = amount
		player.last = "全下至 %d" % amount if player.stack == 0 else "加注至 %d" % amount
		for i in range(players.size()):
			if i != seat and not players[i].folded and players[i].stack > 0 and players[i].bet < current and not pending.has(i):
				pending.append(i)
	player.acted_at = current
	pending.erase(seat)
	add_log("%s %s。" % [player.name, player.last])
	advance(seat)
	return true

func advance(from: int) -> void:
	var live: Array = players.filter(func(p): return not p.folded)
	if live.size() == 1:
		var winner: Dictionary = live[0]
		var amount := pot()
		winner.stack += amount
		results = [{"seats": [winner.seat], "names": winner.name, "amount": amount, "label": "其他玩家全部弃牌"}]
		finish()
		return
	for seat in pending.duplicate():
		if players[seat].folded or players[seat].stack == 0:
			pending.erase(seat)
	var able: Array = players.filter(func(p): return not p.folded and p.stack > 0)
	if able.size() == 1 and able[0].bet >= current:
		pending.clear()
	if not pending.is_empty():
		actor = next_seat(from, func(_p, i): return pending.has(i))
		return
	actor = -1
	awaiting_street = true

func street() -> void:
	if not awaiting_street or phase == "done":
		return
	awaiting_street = false
	if phase == "river":
		settle()
		return
	phase = {"preflop": "flop", "flop": "turn", "turn": "river"}[phase]
	cards_left.pop_back()
	for _i in range(3 if phase == "flop" else 1):
		board.append(cards_left.pop_back())
	current = 0
	min_raise = BIG_BLIND
	for player in players:
		player.bet = 0
		player.acted_at = -1
	add_log({"flop": "翻牌", "turn": "转牌", "river": "河牌"}[phase] + "落下。")
	pending.clear()
	for i in range(players.size()):
		if not players[i].folded and players[i].stack > 0:
			pending.append(i)
	advance(button)

func settle() -> void:
	showdown = true
	var levels: Array = []
	for player in players:
		if player.total > 0 and not levels.has(player.total):
			levels.append(player.total)
	levels.sort()
	var previous := 0
	for level in levels:
		var contributors: Array = players.filter(func(p): return p.total >= level)
		var amount: int = (level - previous) * contributors.size()
		previous = level
		if contributors.size() == 1:
			contributors[0].stack += amount
			results.append({"seats": [contributors[0].seat], "names": contributors[0].name, "amount": amount, "label": "未获跟注，退回"})
			continue
		var eligible: Array = contributors.filter(func(p): return not p.folded)
		var best: Array = [-1]
		var winners: Array = []
		for player in eligible:
			var score := PokerRules.evaluate(player.cards + board)
			var comparison := PokerRules.compare(score, best)
			if comparison > 0:
				best = score
				winners = [player]
			elif comparison == 0:
				winners.append(player)
		if winners.is_empty():
			push_error("底池缺少有效玩家")
			return
		winners.sort_custom(func(a, b): return posmod(a.seat - button - 1, players.size()) < posmod(b.seat - button - 1, players.size()))
		for i in range(winners.size()):
			winners[i].stack += int(amount / winners.size()) + (1 if i < amount % winners.size() else 0)
		var names: Array = winners.map(func(p): return p.name)
		var hands: Array = winners.map(func(p): return {"seat": p.seat, "cards": PokerRules.best_five(p.cards + board)})
		results.append({"seats": winners.map(func(p): return p.seat), "names": "、".join(names), "amount": amount, "label": ("边池" if not results.is_empty() else "主池") + " · " + PokerRules.NAMES[best[0]] + (" · 平分" if winners.size() > 1 else ""), "hands": hands})
	finish()

func finish() -> void:
	phase = "done"
	actor = -1
	awaiting_street = false
	for result in results:
		add_log("%s 收回 %d 能源（%s）。" % [result.names, result.amount, result.label])
	for player in players:
		var delta: int = player.stack - player.start_stack
		player.last = "本手 %+d" % delta

func bot_action() -> Array:
	var player: Dictionary = players[actor]
	var opt := options()
	var hole: Array = player.cards
	var strength := 0.0
	if board.is_empty():
		strength = 0.18 + float(hole[0].r + hole[1].r) / 28.0 * 0.42
		if hole[0].r == hole[1].r:
			strength += 0.18 + float(hole[0].r) / 140.0
		if hole[0].s == hole[1].s:
			strength += 0.05
		if abs(hole[0].r - hole[1].r) <= 2:
			strength += 0.05
	else:
		var score := PokerRules.evaluate(hole + board)
		strength = [0.22, 0.48, 0.68, 0.8, 0.89, 0.92, 0.96, 0.985, 0.995][score[0]] + float(score[1]) / 14.0 * 0.05
		if board.size() == 5 and PokerRules.compare(score, PokerRules.evaluate(board)) == 0:
			strength -= 0.08
	strength += float(posmod(actor - button, players.size())) / float(players.size() - 1) * 0.06
	var price := float(opt.call) / float(maxi(1, pot() + opt.call))
	var roll := rng.randf()
	if opt.call > 0 and strength + roll * 0.24 < price + FOLD_BIAS[actor]:
		return ["fold"]
	if opt.can_raise and roll < AGGRESSION[actor] * (1.4 if strength > 0.55 else 0.45) + (0.18 if strength > 0.78 else 0.0):
		var target: int = mini(opt.max, maxi(opt.min, current + int(ceil(float(pot()) * (0.25 + strength * 0.7) / 10.0)) * 10))
		return ["raise", target]
	return ["call"]
