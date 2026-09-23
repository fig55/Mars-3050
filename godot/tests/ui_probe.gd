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
	main.game.phase = "done"
	main.game.results = [{"seats": [0], "names": "你", "amount": 120, "label": "主池 · 一对"}, {"seats": [1, 2], "names": "老陈、林小姐", "amount": 80, "label": "边池 · 平分"}]
	main._render_result()
	valid = valid and "边池" in main.result_label.text and "120" in main.result_label.text
	print("Godot V2 UI bounds/result: ", "PASS" if valid else "FAIL")
	quit(0 if valid else 1)
