extends RefCounted
class_name Crystals

const DENOMINATIONS := [500, 100, 25, 5, 1]

static func split(amount: int, change: bool = false) -> Array:
	assert(amount >= 0)
	var remaining := amount
	var groups: Array = []
	for value in DENOMINATIONS:
		var count: int = remaining / value
		if change and value > 1 and count > 0:
			count -= 1
		remaining -= count * value
		if count > 0:
			groups.append({"value": value, "count": count})
	return groups

static func move(amount: int, player: Dictionary, options: Dictionary) -> Array:
	if options.is_empty() or amount <= 0 or amount > player.stack:
		return []
	if amount == options.call:
		return ["call"]
	var total: int = player.bet + amount
	if not options.can_raise or total <= player.bet + options.call:
		return []
	if total < options.min and total != options.max:
		return []
	return ["raise", total]
