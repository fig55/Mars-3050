extends RefCounted
class_name CelestialCatalog

const FILE := "res://data/celestial_cards.json"
const CATEGORIES := ["恒星", "行星", "卫星", "小天体"]
const ICONS := ["✦", "◉", "☾", "◆"]

static func load_cards() -> Array:
	var file := FileAccess.open(FILE, FileAccess.READ)
	if file == null:
		push_error("无法读取天体牌目录")
		return []
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Array:
		push_error("天体牌目录格式错误")
		return []
	return parsed

static func validate(cards: Array) -> bool:
	if cards.size() != 52:
		return false
	var seen: Dictionary = {}
	var names: Dictionary = {}
	var previous: Array = [0.0, 0.0, 0.0, 0.0]
	for card in cards:
		var suit: int = card.get("s", -1)
		var rank: int = card.get("r", -1)
		if suit < 0 or suit > 3 or rank < 2 or rank > 14:
			return false
		var key := "%d:%d" % [suit, rank]
		if seen.has(key) or names.has(card.name):
			return false
		seen[key] = true
		names[card.name] = true
		if card.category != CATEGORIES[suit] or card.radius_km <= previous[suit] or not card.has("source"):
			return false
		previous[suit] = card.radius_km
	return true

static func lookup(cards: Array, card: Dictionary) -> Dictionary:
	return cards[card.s * 13 + card.r - 2] if cards.size() == 52 else {}

static func rank_text(rank: int) -> String:
	return {11: "J", 12: "Q", 13: "K", 14: "A"}.get(rank, str(rank))

static func short_text(cards: Array, card: Dictionary) -> String:
	var body := lookup(cards, card)
	return "%s%s %s" % [rank_text(card.r), ICONS[card.s], body.get("name", "?")]
