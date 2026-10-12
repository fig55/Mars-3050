extends RefCounted
class_name PokerRules

const NAMES := ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"]

static func deck() -> Array:
	var cards: Array = []
	for suit in range(4):
		for rank in range(2, 15):
			cards.append({"r": rank, "s": suit})
	return cards

static func compare(a: Array, b: Array) -> int:
	for i in range(maxi(a.size(), b.size())):
		var left: int = a[i] if i < a.size() else 0
		var right: int = b[i] if i < b.size() else 0
		if left != right:
			return 1 if left > right else -1
	return 0

static func five(cards: Array) -> Array:
	assert(cards.size() == 5)
	var ranks: Array = cards.map(func(card): return int(card.r))
	ranks.sort_custom(func(a, b): return a > b)
	var groups: Array = []
	for rank in ranks:
		var found := false
		for group in groups:
			if group[1] == rank:
				group[0] += 1
				found = true
				break
		if not found:
			groups.append([1, rank])
	groups.sort_custom(func(a, b): return a[0] > b[0] if a[0] != b[0] else a[1] > b[1])
	var flush := true
	for card in cards:
		if card.s != cards[0].s:
			flush = false
	var straight := 0
	if groups.size() == 5:
		if ranks[0] - ranks[4] == 4:
			straight = ranks[0]
		elif ranks == [14, 5, 4, 3, 2]:
			straight = 5
	if straight and flush:
		return [8, straight]
	if groups[0][0] == 4:
		return [7, groups[0][1], groups[1][1]]
	if groups[0][0] == 3 and groups[1][0] == 2:
		return [6, groups[0][1], groups[1][1]]
	if flush:
		return [5] + ranks
	if straight:
		return [4, straight]
	if groups[0][0] == 3:
		return [3] + groups.map(func(group): return group[1])
	if groups[0][0] == 2:
		return [2 if groups[1][0] == 2 else 1] + groups.map(func(group): return group[1])
	return [0] + ranks

static func evaluate(cards: Array) -> Array:
	var best: Array = [-1]
	for a in range(cards.size() - 4):
		for b in range(a + 1, cards.size() - 3):
			for c in range(b + 1, cards.size() - 2):
				for d in range(c + 1, cards.size() - 1):
					for e in range(d + 1, cards.size()):
						var score := five([cards[a], cards[b], cards[c], cards[d], cards[e]])
						if compare(score, best) > 0:
							best = score
	return best

static func best_five(cards: Array) -> Array:
	var target := evaluate(cards)
	for a in range(cards.size() - 4):
		for b in range(a + 1, cards.size() - 3):
			for c in range(b + 1, cards.size() - 2):
				for d in range(c + 1, cards.size() - 1):
					for e in range(d + 1, cards.size()):
							var hand := [cards[a], cards[b], cards[c], cards[d], cards[e]]
							if compare(five(hand), target) == 0:
								return hand
	return []

static func hand_moment(hole: Array, board: Array) -> Dictionary:
	if hole.size() != 2 or board.size() < 3:
		return {}
	var score := evaluate(hole + board)
	var kind: int = score[0]
	if kind < 1 or (board.size() == 5 and compare(score, evaluate(board)) <= 0):
		return {}
	var label: String = NAMES[kind]
	if kind == 1:
		var top := 0
		var top_count := 0
		for card in board:
			top = maxi(top, card.r)
		for card in board:
			if card.r == top:
				top_count += 1
		if hole[0].r == hole[1].r and hole[0].r > top:
			label = "超对"
		elif score[1] == top and top_count == 1 and (hole[0].r == top or hole[1].r == top):
			label = "击中顶对"
		else:
			return {}
	if kind in [3, 7] and hole[0].r != score[1] and hole[1].r != score[1]:
		return {}
	return {"label": label, "type": kind, "key": "%s:%s" % [label, str(score)], "cards": best_five(hole + board)}
