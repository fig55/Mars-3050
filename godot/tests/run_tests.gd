extends SceneTree

var failures := 0
var checks := 0

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error(message)

func cards(text: String) -> Array:
	var hand: Array = []
	for token in text.split(" ", false):
		hand.append({"r": "23456789TJQKA".find(token[0]) + 2, "s": "shdc".find(token[1])})
	return hand

func run() -> void:
	var catalog := CelestialCatalog.load_cards()
	check(CelestialCatalog.validate(catalog), "52 张天体牌目录与尺寸排序")
	check(PokerRules.deck().size() == 52, "标准 52 张牌")
	var types := [
		["As Kd Qc Js 9h", 0], ["As Ah Qc Js 9h", 1],
		["As Ah Qc Qs 9h", 2], ["As Ah Ad Js 9h", 3],
		["As 2h 3d 4c 5s", 4], ["As Ks Qs Js 9s", 5],
		["As Ah Ad Ks Kh", 6], ["As Ah Ad Ac 9h", 7],
		["As Ks Qs Js Ts", 8]
	]
	for example in types:
		check(PokerRules.evaluate(cards(example[0]))[0] == example[1], "九种牌型 %s" % example[0])
	check(PokerRules.evaluate(cards("As 2h 3d 4c 5s Kh Qh")) == [4, 5], "A2345 顺子")
	check(PokerRules.evaluate(cards("As Ah Ad Ks Kh Kd 2c")) == [6, 14, 13], "双三条选最佳葫芦")
	var reference_file := FileAccess.open("res://tests/js_reference.json", FileAccess.READ)
	check(reference_file != null, "JavaScript 对照样本存在")
	if reference_file != null:
		var reference: Array = JSON.parse_string(reference_file.get_as_text())
		for sample in reference:
			var actual := PokerRules.evaluate(sample.cards)
			check(PokerRules.compare(actual, sample.score) == 0 and actual.size() == sample.score.size(), "JS/GDScript 牌型评分不一致：%s" % str(sample.cards))
	var side := PokerGame.new()
	side.board = cards("2s 3h 7d 9c Js")
	for player in side.players:
		player.folded = true
		player.total = 0
		player.stack = 0
		player.start_stack = 0
	for i in range(3):
		side.players[i].folded = false
		side.players[i].total = [100, 200, 300][i]
		side.players[i].cards = cards(["As Ah", "Ks Kh", "Qs Qh"][i])
	side.settle()
	check([side.players[0].stack, side.players[1].stack, side.players[2].stack] == [300, 200, 100], "主池/边池分配")
	var split := PokerGame.new()
	split.button = 0
	split.board = cards("As Ks Qs Js Ts")
	for player in split.players:
		player.folded = true
		player.total = 0
		player.stack = 0
		player.start_stack = 0
	for i in range(3):
		split.players[i].total = 1
		split.players[i].cards = cards("2h 3d")
		split.players[i].folded = i == 2
	split.settle()
	check(split.players[0].stack == 1 and split.players[1].stack == 2, "奇数能源按庄家顺时针平分")
	var crystals := Crystals.split(2000, true)
	var sum := 0
	for group in crystals:
		sum += group.value * group.count
	check(sum == 2000, "能源晶片真实枚数与余额一致")
	check(Crystals.move(20, {"stack": 1980, "bet": 0}, {"call": 20, "min": 40, "max": 1980, "can_raise": true}) == ["call"], "晶片投放跟注")
	check(Crystals.move(25, {"stack": 1980, "bet": 0}, {"call": 20, "min": 40, "max": 1980, "can_raise": true}).is_empty(), "非法加注不得消耗晶片")
	var game := PokerGame.new()
	game.set_seed(3050)
	for _hand in range(100):
		if not game.start():
			break
		var initial := game.bankroll()
		var guard := 0
		while game.phase != "done" and guard < 300:
			guard += 1
			if game.awaiting_street:
				game.street()
			elif game.actor >= 0:
				var move := game.bot_action() if game.actor > 0 else ["call"]
				check(game.act(move[0], move[1] if move.size() > 1 else 0), "行动须合法")
		check(guard < 300, "牌局有限步结束")
		var final_amount := 0
		for player in game.players:
			final_amount += player.stack
		check(final_amount == initial, "整手能源守恒")
	print("Godot V2 checks: %d, failures: %d" % [checks, failures])
	quit(0 if failures == 0 else 1)
