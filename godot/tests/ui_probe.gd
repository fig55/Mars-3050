extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene: PackedScene = load("res://scenes/Main.tscn")
	var main: Control = scene.instantiate()
	root.add_child(main)
	await process_frame
	await process_frame
	main._show_rules()
	await process_frame
	var bounds: Rect2 = main.get_global_rect()
	var dialog: Rect2 = main.rules_dialog.get_global_rect()
	var result: Rect2 = main.result_label.get_global_rect()
	var table: Rect2 = main.table_drop.get_global_rect()
	var valid: bool = bounds.encloses(dialog) and bounds.encloses(result) and table.end.y < result.position.y
	# The fixed console must keep its real controls within the design viewport.
	var console: Control = main.get_node("TableStage/PlayerConsole")
	valid = valid and bounds.encloses(console.get_global_rect())
	for area in [main.bank_box, main.tray_drop, main.action_box, main.status_label]:
		valid = valid and console.get_global_rect().encloses(area.get_global_rect())
	for card in main.board_cards + main.hero_cards:
		valid = valid and bounds.encloses(card.get_global_rect())
	valid = valid and main.drag_ghost.size.x <= 70 and main.drag_ghost.size.y <= 70
	valid = valid and main.table_view.texture != null and main.hero_cards.size() == 2 and main.hero_cards[0].art.texture != null
	valid = valid and _pot_art_amount(main) == main.game.pot()
	main.drag_ghost.texture = EnergyCrystalArt.texture(25)
	valid = valid and main.drag_ghost.size.x <= 70 and main.drag_ghost.size.y <= 70
	main.game.board.append(main.game.players[0].cards[0])
	main._refresh()
	valid = valid and main.board_cards[0].art.texture != null
	main.game.board.clear()
	main._refresh()
	if not valid:
		push_error("规则弹层或结算区超出设计视口：dialog=%s result=%s table=%s" % [dialog, result, table])
	main.rules_layer.hide()
	valid = valid and main.visuals.environments.size() >= 2 and main.visuals.tables.size() >= 2 and main.visuals.people.size() >= 2
	main.visual_indices.environments = 1
	main.visual_indices.tables = 1
	main.visual_indices.people = 1
	main._apply_visuals()
	valid = valid and main.environment_view.texture != null and main.table_view.texture != null and not main.seat_portraits[1].visible
	main.visual_indices.people = 0
	main._apply_visuals()
	valid = valid and main.seat_portraits[1].texture != null
	main.game.actor = 0
	var initial_stack: int = main.game.players[0].stack
	main._select_crystal(5)
	valid = valid and main._selected_amount() == 5 and main.game.players[0].stack == initial_stack
	main._drop_selected()
	valid = valid and main._selected_amount() == 5 and main.game.players[0].stack == initial_stack
	main._clear_selected()
	valid = valid and main._selected_amount() == 0 and main.game.players[0].stack == initial_stack
	for _i in range(4):
		main._select_crystal(5)
	main._drop_selected()
	valid = valid and main._selected_amount() == 0 and main.game.players[0].stack == initial_stack - 20
	valid = valid and _pot_art_amount(main) == main.game.pot()
	main._send_emote("☺", "微笑")
	valid = valid and main.game.logs[0].contains("发送表情")
	main.game.phase = "flop"
	main.game.add_log("翻牌测试")
	main._render_journal()
	valid = valid and "第 2 轮" in main.journal.text and "第 1 轮" in main.journal.text
	main.game.phase = "done"
	main.game.results = [{"seats": [0], "names": "你", "amount": 120, "label": "主池 · 一对"}, {"seats": [1, 2], "names": "老陈、林小姐", "amount": 80, "label": "边池 · 平分"}]
	main._render_result()
	valid = valid and "边池" in main.result_label.text and "120" in main.result_label.text
	print("Godot V2 UI bounds/result: ", "PASS" if valid else "FAIL")
	main.queue_free()
	await process_frame
	quit(0 if valid else 1)

func _pot_art_amount(main: Control) -> int:
	var amount := 0
	for value in main.pot_inventory:
		amount += int(value) * int(main.pot_inventory[value])
	return amount
