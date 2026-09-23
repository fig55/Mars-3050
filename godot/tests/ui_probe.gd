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
	main._send_emote("☺", "微笑")
	valid = valid and main.game.logs[0].contains("发送表情")
	main.game.phase = "done"
	main.game.results = [{"seats": [0], "names": "你", "amount": 120, "label": "主池 · 一对"}, {"seats": [1, 2], "names": "老陈、林小姐", "amount": 80, "label": "边池 · 平分"}]
	main._render_result()
	valid = valid and "边池" in main.result_label.text and "120" in main.result_label.text
	print("Godot V2 UI bounds/result: ", "PASS" if valid else "FAIL")
	main.queue_free()
	await process_frame
	quit(0 if valid else 1)
