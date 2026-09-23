extends Control

const SAVE_FILE := "user://mars_v2_save.json"
const BG := Color("101721")
const PANEL := Color("1a2933dc")
const TABLE := Color("153a39e8")
const GOLD := Color("e9bc74")
const LIGHT := Color("f5e8d0")
const MUTED := Color("a8b8b7")
const CRYSTAL_COLORS := [Color("f2bd77"), Color("a7e4e4"), Color("bd9cf2"), Color("7ccab3"), Color("ece1b7")]

var game: PokerGame
var catalog: Array = []
var visuals: Dictionary = {}
var visual_indices := {"environments": 0, "tables": 0, "people": 0}
var selected: Dictionary = {}
var drag_value := 0
var drag_source := ""
var drag_start := Vector2.ZERO
var dragging := false
var drag_ghost: Label
var environment_view: TextureRect
var table_view: TextureRect
var table_panel: PanelContainer
var table_drop: Control
var seat_boxes: Array = []
var seat_labels: Array = []
var seat_card_labels: Array = []
var seat_portraits: Array = []
var board_cards: Array = []
var pot_label: Label
var phase_label: Label
var turn_label: Label
var status_label: Label
var hero_hand_label: Label
var selected_label: Label
var bank_box: HBoxContainer
var tray_drop: PanelContainer
var tray_label: Label
var action_box: HBoxContainer
var result_label: RichTextLabel
var journal: RichTextLabel
var rules_layer: Control
var rules_dialog: PanelContainer
var pulse_layer: Label
var emote_bubble: Label
var displayed_logs := 0
var last_moment := ""
var busy := false
var bot_wait := 0.0
var last_board_count := 0
var animations: Array = []

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	catalog = CelestialCatalog.load_cards()
	if not CelestialCatalog.validate(catalog):
		push_error("52 张天体牌目录未通过校验")
	game = PokerGame.new(_read_stacks())
	visuals = VisualCatalog.load_catalog()
	_load_visual_preferences()
	_build_ui()
	_apply_visuals()
	game.start()
	_refresh()
	_schedule_advance()

func _process(delta: float) -> void:
	if game == null:
		return
	if game.actor >= 0 and game.actor != 0 and not busy:
		bot_wait += delta
		var dots := ".".repeat(1 + int(Time.get_ticks_msec() / 350) % 3)
		turn_label.text = "%s 正在思考%s" % [game.players[game.actor].name, dots]
	elif game.actor == 0:
		turn_label.text = "轮到你 · 先数晶片到桌前，再推入能源池"
	elif game.awaiting_street:
		turn_label.text = "等待下一张公共牌…"
	elif game.phase == "done":
		turn_label.text = "本手结算完成"
	for effect in animations.duplicate():
		effect.time -= delta
		if effect.time <= 0:
			effect.node.queue_free()
			animations.erase(effect)

func _panel(color: Color, radius: int = 16, border: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.set_corner_radius_all(radius)
	style.border_color = border
	style.set_border_width_all(1 if border.a > 0 else 0)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style

func _label(text_value: String, size: int = 18, color: Color = LIGHT) -> Label:
	var label := Label.new()
	label.text = text_value
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label

func _button(text_value: String, callback: Callable, accent: bool = false) -> Button:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(90, 45)
	button.add_theme_font_size_override("font_size", 18)
	button.add_theme_color_override("font_color", BG if accent else LIGHT)
	button.add_theme_stylebox_override("normal", _panel(GOLD if accent else PANEL, 10, GOLD if not accent else Color.TRANSPARENT))
	button.add_theme_stylebox_override("hover", _panel(Color("f5d394") if accent else Color("28434a"), 10))
	button.pressed.connect(callback)
	return button

func _build_ui() -> void:
	var background := ColorRect.new()
	background.color = BG
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	environment_view = TextureRect.new()
	environment_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	environment_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	environment_view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	environment_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	environment_view.modulate.a = 0.64
	add_child(environment_view)
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("separation", 10)
	root.offset_left = 16
	root.offset_right = -16
	root.offset_top = 12
	root.offset_bottom = -12
	add_child(root)

	var header := HBoxContainer.new()
	header.custom_minimum_size.y = 60
	root.add_child(header)
	var title := _label("火星牌局  /  MARS TABLE", 30, GOLD)
	title.custom_minimum_size.x = 380
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(title)
	header.add_spacer(false)
	for selector in [["environments", "场景"], ["tables", "桌面"], ["people", "人物"]]:
		var choice := OptionButton.new()
		choice.custom_minimum_size = Vector2(113, 42)
		choice.add_theme_font_size_override("font_size", 15)
		choice.add_theme_color_override("font_color", LIGHT)
		choice.add_theme_stylebox_override("normal", _panel(PANEL, 8, GOLD))
		for entry in visuals.get(selector[0], []):
			choice.add_item("%s · %s" % [selector[1], entry.name])
		if choice.item_count > 0:
			choice.select(clampi(visual_indices[selector[0]], 0, choice.item_count - 1))
		choice.item_selected.connect(_change_visual.bind(selector[0]))
		header.add_child(choice)
	phase_label = _label("", 17, MUTED)
	phase_label.custom_minimum_size.x = 165
	phase_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(phase_label)
	header.add_child(_button("玩法图示", _show_rules))

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	root.add_child(body)
	var main := VBoxContainer.new()
	main.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	main.add_theme_constant_override("separation", 9)
	body.add_child(main)
	var sidebar := PanelContainer.new()
	sidebar.custom_minimum_size.x = 300
	sidebar.size_flags_horizontal = Control.SIZE_SHRINK_END
	sidebar.add_theme_stylebox_override("panel", _panel(PANEL, 18))
	body.add_child(sidebar)
	var side_inner := VBoxContainer.new()
	sidebar.add_child(side_inner)
	side_inner.add_child(_label("桌边纪事", 25, GOLD))
	side_inner.add_child(_label("最近动作与结算", 14, MUTED))
	journal = RichTextLabel.new()
	journal.bbcode_enabled = false
	journal.scroll_following = false
	journal.size_flags_vertical = Control.SIZE_EXPAND_FILL
	journal.add_theme_font_size_override("normal_font_size", 17)
	journal.add_theme_color_override("default_color", LIGHT)
	side_inner.add_child(journal)
	side_inner.add_child(_label("发送表情", 16, GOLD))
	var emotes := HBoxContainer.new()
	emotes.add_theme_constant_override("separation", 3)
	side_inner.add_child(emotes)
	for item in [["☺", "微笑"], ["👍", "赞"], ["😮", "惊讶"], ["🤔", "思考"]]:
		var button := _button(item[0], _send_emote.bind(item[0], item[1]))
		button.custom_minimum_size = Vector2(54, 42)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		emotes.add_child(button)

	var top_seats := HBoxContainer.new()
	top_seats.custom_minimum_size.y = 124
	top_seats.add_theme_constant_override("separation", 8)
	main.add_child(top_seats)
	for seat in [1, 2, 3]:
		_create_seat(top_seats, seat)

	table_panel = PanelContainer.new()
	table_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	table_panel.custom_minimum_size.y = 220
	table_panel.clip_contents = true
	table_panel.add_theme_stylebox_override("panel", _panel(TABLE, 34, Color("477367")))
	main.add_child(table_panel)
	table_drop = table_panel
	table_view = TextureRect.new()
	table_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	table_view.offset_left = 8
	table_view.offset_right = -8
	table_view.offset_top = 8
	table_view.offset_bottom = -8
	table_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	table_view.stretch_mode = TextureRect.STRETCH_SCALE
	table_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	table_view.modulate.a = 0.72
	table_panel.add_child(table_view)
	var table_inner := VBoxContainer.new()
	table_inner.alignment = BoxContainer.ALIGNMENT_CENTER
	table_inner.add_theme_constant_override("separation", 10)
	table_panel.add_child(table_inner)
	pot_label = _label("", 25, GOLD)
	pot_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(pot_label)
	var board_row := HBoxContainer.new()
	board_row.alignment = BoxContainer.ALIGNMENT_CENTER
	board_row.add_theme_constant_override("separation", 7)
	table_inner.add_child(board_row)
	for i in range(5):
		var card := _card_label()
		board_row.add_child(card)
		board_cards.append(card)
	hero_hand_label = _label("", 17, LIGHT)
	hero_hand_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(hero_hand_label)
	turn_label = _label("", 17, MUTED)
	turn_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(turn_label)

	var bottom_seats := HBoxContainer.new()
	bottom_seats.custom_minimum_size.y = 124
	bottom_seats.add_theme_constant_override("separation", 8)
	main.add_child(bottom_seats)
	for seat in [4, 0, 5]:
		_create_seat(bottom_seats, seat)

	var controls := PanelContainer.new()
	controls.add_theme_stylebox_override("panel", _panel(PANEL, 16))
	main.add_child(controls)
	var control_inner := VBoxContainer.new()
	control_inner.add_theme_constant_override("separation", 6)
	controls.add_child(control_inner)
	var bank_header := HBoxContainer.new()
	control_inner.add_child(bank_header)
	var bank_title := _label("能源晶片 · 数取到桌前 → 推入能源池", 17, GOLD)
	bank_title.custom_minimum_size.x = 440
	bank_title.autowrap_mode = TextServer.AUTOWRAP_OFF
	bank_header.add_child(bank_title)
	bank_header.add_spacer(false)
	selected_label = _label("", 16, LIGHT)
	selected_label.custom_minimum_size.x = 170
	selected_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	bank_header.add_child(selected_label)
	var staging_row := HBoxContainer.new()
	staging_row.add_theme_constant_override("separation", 8)
	control_inner.add_child(staging_row)
	bank_box = HBoxContainer.new()
	bank_box.add_theme_constant_override("separation", 6)
	bank_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	staging_row.add_child(bank_box)
	tray_drop = PanelContainer.new()
	tray_drop.custom_minimum_size = Vector2(335, 58)
	tray_drop.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tray_drop.add_theme_stylebox_override("panel", _panel(Color("3a3030e6"), 12, GOLD))
	tray_drop.gui_input.connect(_tray_input)
	staging_row.add_child(tray_drop)
	tray_label = _label("桌前待推 · 空", 17, GOLD)
	tray_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tray_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	tray_drop.add_child(tray_label)
	action_box = HBoxContainer.new()
	action_box.add_theme_constant_override("separation", 8)
	control_inner.add_child(action_box)
	status_label = _label("", 15, MUTED)
	control_inner.add_child(status_label)

	var result_panel := PanelContainer.new()
	result_panel.custom_minimum_size.y = 75
	result_panel.add_theme_stylebox_override("panel", _panel(Color("26312b"), 14, GOLD))
	main.add_child(result_panel)
	result_label = RichTextLabel.new()
	result_label.bbcode_enabled = true
	result_label.fit_content = true
	result_label.add_theme_font_size_override("normal_font_size", 17)
	result_label.add_theme_color_override("default_color", LIGHT)
	result_panel.add_child(result_label)

	rules_layer = Control.new()
	rules_layer.visible = false
	rules_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rules_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(rules_layer)
	var dimmer := ColorRect.new()
	dimmer.color = Color(0, 0, 0, 0.72)
	dimmer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rules_layer.add_child(dimmer)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rules_layer.add_child(center)
	rules_dialog = PanelContainer.new()
	rules_dialog.custom_minimum_size = Vector2(740, 700)
	rules_dialog.add_theme_stylebox_override("panel", _panel(Color("182731"), 20, GOLD))
	center.add_child(rules_dialog)
	_build_rules()
	pulse_layer = _label("", 44, GOLD)
	pulse_layer.visible = false
	pulse_layer.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pulse_layer.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pulse_layer.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	pulse_layer.custom_minimum_size = Vector2(420, 100)
	pulse_layer.add_theme_stylebox_override("normal", _panel(Color("402f33"), 20, GOLD))
	pulse_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(pulse_layer)
	drag_ghost = _label("", 23, GOLD)
	drag_ghost.visible = false
	drag_ghost.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(drag_ghost)
	emote_bubble = _label("", 27, GOLD)
	emote_bubble.visible = false
	emote_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	emote_bubble.add_theme_stylebox_override("normal", _panel(Color("27363be8"), 15, GOLD))
	add_child(emote_bubble)

func _create_seat(parent: HBoxContainer, seat: int) -> void:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _panel(PANEL, 14))
	parent.add_child(panel)
	seat_boxes.resize(6)
	seat_labels.resize(6)
	seat_card_labels.resize(6)
	seat_portraits.resize(6)
	seat_boxes[seat] = panel
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	panel.add_child(row)
	var portrait := TextureRect.new()
	portrait.custom_minimum_size = Vector2(70, 98)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(portrait)
	seat_portraits[seat] = portrait
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 2)
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(inner)
	var name := _label("", 18, GOLD)
	inner.add_child(name)
	seat_labels[seat] = name
	var cards := _label("", 15, LIGHT)
	inner.add_child(cards)
	seat_card_labels[seat] = cards

func _card_label() -> Label:
	var card := _label("?", 15, BG)
	card.custom_minimum_size = Vector2(100, 118)
	card.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	card.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	card.add_theme_stylebox_override("normal", _panel(Color("f6efdc"), 9))
	return card

func _clear(container: Node) -> void:
	for child in container.get_children():
		child.queue_free()

func _radius_text(radius: float) -> String:
	if radius < 1.0:
		return "%.3f km" % radius
	if radius < 10.0:
		return "%.1f km" % radius
	return "%.0f km" % radius

func _refresh() -> void:
	phase_label.text = "第 %d 手   /   %s" % [game.hand, {"preflop": "翻牌前", "flop": "翻牌", "turn": "转牌", "river": "河牌", "done": "结算"}.get(game.phase, "准备")]
	pot_label.text = "能源池  %d" % game.pot()
	for i in range(6):
		var player: Dictionary = game.players[i]
		seat_labels[i].text = "%s  ·  %d 能源%s" % [player.name, player.stack, "  ◉ 行动中" if game.actor == i else ""]
		seat_labels[i].add_theme_color_override("font_color", GOLD if game.actor == i else LIGHT)
		var cards_text := "  ".join(player.cards.map(func(card): return CelestialCatalog.short_text(catalog, card))) if i == 0 or game.showdown else "✦  未亮牌  ✦"
		var stacks: Array = Crystals.split(player.stack, true)
		var crystals_text := " ".join(stacks.map(func(group): return "%d×%d" % [group.value, group.count - (selected.get(group.value, 0) if i == 0 else 0)]))
		seat_card_labels[i].text = "%s\n%s · 本轮 %d · 本手 %d\n◆ %s" % [cards_text, player.last, player.bet, player.total, crystals_text if not crystals_text.is_empty() else "无晶片"]
		seat_boxes[i].add_theme_stylebox_override("panel", _panel(Color("30403b") if game.actor == i else PANEL, 14, GOLD if game.actor == i else Color.TRANSPARENT))
	for i in range(5):
		if i < game.board.size():
			var card: Dictionary = game.board[i]
			var body := CelestialCatalog.lookup(catalog, card)
			board_cards[i].text = "%s  %s\n%s\n%s" % [CelestialCatalog.rank_text(card.r), CelestialCatalog.ICONS[card.s], body.get("name", "?"), _radius_text(float(body.get("radius_km", 0.0)))]
		else:
			board_cards[i].text = "✦\n待发牌"
	var moment := {} if game.players[0].folded else PokerRules.hand_moment(game.players[0].cards, game.board)
	hero_hand_label.text = "你的当前牌型：%s" % (moment.label if not moment.is_empty() else "等待成牌")
	if not moment.is_empty() and moment.key != last_moment:
		last_moment = moment.key
		_pulse(moment.label)
	if game.board.size() > last_board_count:
		for i in range(last_board_count, game.board.size()):
			var tween := create_tween()
			board_cards[i].modulate.a = 0.25
			tween.tween_property(board_cards[i], "modulate:a", 1.0, 0.45)
	last_board_count = game.board.size()
	_render_bank()
	_render_tray()
	_render_actions()
	_render_result()
	journal.text = "\n\n".join(game.logs)

func _render_bank() -> void:
	_clear(bank_box)
	var player: Dictionary = game.players[0]
	var inventory := Crystals.split(player.stack, true)
	for group in inventory:
		var value: int = group.value
		var count: int = group.count
		var chosen: int = selected.get(value, 0)
		var available := count - chosen
		var crystal := Button.new()
		crystal.text = "◆ %d\n可数 × %d" % [value, available]
		crystal.custom_minimum_size = Vector2(85, 58)
		crystal.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		crystal.disabled = available <= 0
		crystal.add_theme_font_size_override("font_size", 17)
		crystal.add_theme_color_override("font_color", BG)
		var index: int = Crystals.DENOMINATIONS.find(value)
		crystal.add_theme_stylebox_override("normal", _panel(CRYSTAL_COLORS[index], 12))
		crystal.add_theme_stylebox_override("hover", _panel(CRYSTAL_COLORS[index].lightened(0.18), 12))
		crystal.gui_input.connect(_crystal_input.bind(value))
		bank_box.add_child(crystal)
	selected_label.text = "桌前 %d / 余额 %d" % [_selected_amount(), player.stack]

func _render_tray() -> void:
	var amount := _selected_amount()
	if amount == 0:
		tray_label.text = "桌前暂存区 · 空\n从左侧数晶片到这里"
	else:
		var parts: Array = []
		for value in Crystals.DENOMINATIONS:
			if selected.get(value, 0) > 0:
				parts.append("%d×%d" % [value, selected[value]])
		tray_label.text = "桌前待推 %d · 拖向能源池\n◆ %s" % [amount, " ".join(parts)]
	tray_drop.add_theme_stylebox_override("panel", _panel(Color("3a3030e6") if amount else Color("273138dd"), 12, GOLD if amount else MUTED))

func _render_actions() -> void:
	_clear(action_box)
	var opt := game.options(0)
	if game.phase == "done":
		action_box.add_child(_button("继续下一手", _next_hand, true))
		return
	if opt.is_empty():
		var waiting := _label("等待其他玩家行动…", 17, MUTED)
		waiting.custom_minimum_size.x = 260
		waiting.autowrap_mode = TextServer.AUTOWRAP_OFF
		action_box.add_child(waiting)
		return
	action_box.add_child(_button("弃牌", func(): _hero_act("fold")))
	if opt.call == 0:
		action_box.add_child(_button("过牌", func(): _hero_act("call"), true))
	action_box.add_child(_button("推入能源池 %d" % _selected_amount(), _drop_selected, true))
	action_box.add_child(_button("收回桌前晶片", _clear_selected))
	status_label.text = "跟注需从桌前推 %d；加注至少到 %d；最多到 %d。先数取，再拖动桌前晶片或按“推入能源池”。" % [opt.call, opt.min, opt.max]

func _render_result() -> void:
	if game.phase != "done":
		result_label.text = "[color=#e9bc74]结果区[/color]  ·  结算后在这里完整显示赢家、边池和平分。"
		return
	var lines: Array = []
	for result in game.results:
		lines.append("%s · %s 获得 %d 能源（%s）" % ["、".join(result.seats.map(func(i): return game.players[i].name)), result.names, result.amount, result.label])
	result_label.text = "[color=#e9bc74]第 %d 手结果[/color]  ·  %s\n你的余额 %d  ·  %s" % [game.hand, "；".join(lines), game.players[0].stack, game.players[0].last]

func _crystal_input(event: InputEvent, value: int) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		drag_value = value
		drag_source = "bank"
		drag_start = event.global_position
		dragging = false

func _tray_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if _selected_amount() == 0:
			status_label.text = "先从左侧数晶片到桌前。"
			return
		drag_value = _selected_amount()
		drag_source = "tray"
		drag_start = event.global_position
		dragging = false

func _input(event: InputEvent) -> void:
	if drag_value == 0:
		return
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		if event.position.distance_to(drag_start) > 8:
			dragging = true
			drag_ghost.visible = true
			drag_ghost.text = "◆ 待推 %d" % drag_value if drag_source == "tray" else "◆ %d" % drag_value
			drag_ghost.global_position = event.position + Vector2(15, 10)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		var was_dragging := dragging
		var value := drag_value
		var source := drag_source
		drag_value = 0
		drag_source = ""
		dragging = false
		drag_ghost.visible = false
		if source == "tray" and was_dragging and table_drop.get_global_rect().has_point(event.position):
			_drop_selected()
		elif source == "bank" and was_dragging and tray_drop.get_global_rect().has_point(event.position):
			_select_crystal(value)
		elif source == "bank" and not was_dragging and drag_start.distance_to(event.position) < 12:
			_select_crystal(value)
		else:
			status_label.text = "已取消移动；桌前待推晶片与余额未变。" if source == "tray" else "请先把晶片数到自己桌前，再推入能源池。"

func _select_crystal(value: int) -> void:
	var inventory := Crystals.split(game.players[0].stack, true)
	var owned := 0
	for group in inventory:
		if group.value == value:
			owned = group.count
	if selected.get(value, 0) >= owned:
		status_label.text = "该面额已数完；不会从桌前消失。"
		return
	selected[value] = selected.get(value, 0) + 1
	_refresh()

func _selected_amount() -> int:
	var amount := 0
	for value in selected:
		amount += int(value) * int(selected[value])
	return amount

func _clear_selected() -> void:
	selected.clear()
	_refresh()
	status_label.text = "已取消数取；桌前能源未变化。"

func _drop_selected() -> void:
	var opt := game.options(0)
	var amount := _selected_amount()
	var move := Crystals.move(amount, game.players[0], opt)
	if move.is_empty():
		status_label.text = "投放无效：需恰好跟注，或达到最小加注 / 全下。已选晶片保留，可继续数取。"
		return
	_fly_crystals(amount)
	selected.clear()
	_hero_act(move[0], move[1] if move.size() > 1 else 0)

func _hero_act(action: String, amount: int = 0) -> void:
	if game.actor != 0 or not game.act(action, amount):
		return
	selected.clear()
	status_label.text = "动作已记录。"
	_refresh()
	_schedule_advance()

func _fly_crystals(amount: int) -> void:
	var origin := tray_drop.get_global_rect().get_center()
	var target := table_drop.get_global_rect().get_center()
	for i in range(mini(5, maxi(1, amount / 100))):
		var fly := _label("◆", 25, CRYSTAL_COLORS[i % 5])
		fly.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(fly)
		fly.global_position = origin + Vector2(i * 14, 0)
		var tween := create_tween()
		tween.tween_property(fly, "global_position", target + Vector2(i * 16, 0), 0.42 + i * 0.04).set_trans(Tween.TRANS_CUBIC)
		tween.tween_property(fly, "modulate:a", 0.0, 0.18)
		tween.finished.connect(fly.queue_free)

func _schedule_advance() -> void:
	if busy or game.phase == "done":
		if game.phase == "done":
			_save()
		return
	if game.actor == 0:
		return
	busy = true
	_advance_async()

func _advance_async() -> void:
	if game.phase == "done":
		busy = false
		_save()
		return
	if game.awaiting_street:
		await get_tree().create_timer(0.85).timeout
		game.street()
	elif game.actor > 0:
		await get_tree().create_timer(0.9 + game.rng.randf() * 0.8).timeout
		if game.actor > 0:
			var move := game.bot_action()
			game.act(move[0], move[1] if move.size() > 1 else 0)
	_refresh()
	busy = false
	_schedule_advance()

func _next_hand() -> void:
	selected.clear()
	last_moment = ""
	last_board_count = 0
	if not game.start():
		status_label.text = "人数不足，无法开始下一手。"
		return
	_refresh()
	_schedule_advance()

func _pulse(message: String) -> void:
	pulse_layer.text = "✦  %s  ✦" % message
	pulse_layer.visible = true
	pulse_layer.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(pulse_layer, "modulate:a", 1.0, 0.16)
	tween.tween_interval(1.0)
	tween.tween_property(pulse_layer, "modulate:a", 0.0, 0.4)
	tween.finished.connect(func(): pulse_layer.visible = false)

func _build_rules() -> void:
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(710, 670)
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rules_dialog.add_child(scroll)
	var inner := VBoxContainer.new()
	inner.custom_minimum_size.x = 650
	inner.add_theme_constant_override("separation", 10)
	scroll.add_child(inner)
	var header := HBoxContainer.new()
	inner.add_child(header)
	var title := _label("新手图示 · 一手看懂", 27, GOLD)
	title.custom_minimum_size.x = 330
	title.autowrap_mode = TextServer.AUTOWRAP_OFF
	header.add_child(title)
	header.add_spacer(false)
	header.add_child(_button("关闭", func(): rules_layer.hide()))
	inner.add_child(_rule_text("每人 2 张底牌 + 桌上最多 5 张公共牌；任选 5 张组成最强牌型。", 17))
	inner.add_child(_rule_text("四种天体类别对应四种花色；同一点数可跨类别组成对子，尺寸只决定类别内部的 2–A 排序。", 16, MUTED))
	var examples := [
		["高牌", "A✦  J◉  9☾  5◆  2✦"], ["一对", "Q✦  Q◉  9☾  5◆  2✦"],
		["两对", "K✦  K☾  4◉  4◆  2✦"], ["三条", "7✦  7◉  7☾  J◆  2✦"],
		["顺子", "5✦  6◉  7☾  8◆  9✦"], ["同花", "2✦  5✦  8✦  J✦  A✦"],
		["葫芦", "9✦  9◉  9☾  3◆  3✦"], ["四条", "A✦  A◉  A☾  A◆  2✦"],
		["同花顺", "10✦  J✦  Q✦  K✦  A✦"]
	]
	for example in examples:
		var row := HBoxContainer.new()
		inner.add_child(row)
		var hand_title := _label(example[0], 17, GOLD)
		hand_title.custom_minimum_size.x = 105
		row.add_child(hand_title)
		var cards := _label(example[1], 18, LIGHT)
		cards.custom_minimum_size.x = 450
		cards.autowrap_mode = TextServer.AUTOWRAP_OFF
		cards.add_theme_stylebox_override("normal", _panel(Color("31434a"), 7))
		row.add_child(cards)
	inner.add_child(_rule_text("行动：弃牌 / 跟注或过牌 / 加注。翻牌前、翻牌、转牌、河牌各有下注轮。", 16))
	inner.add_child(_rule_text("小盲 10 · 大盲 20。全下时按投入层级拆主池与边池；同牌型平分，余数按庄家顺时针分配。", 16))

func _rule_text(value: String, size: int, color: Color = LIGHT) -> Label:
	var label := _label(value, size, color)
	label.custom_minimum_size.x = 640
	return label

func _show_rules() -> void:
	rules_layer.show()
	rules_layer.move_to_front()

func _change_visual(index: int, kind: String) -> void:
	visual_indices[kind] = index
	_apply_visuals()
	_save_visual_preferences()

func _apply_visuals() -> void:
	var environments: Array = visuals.get("environments", [])
	if not environments.is_empty():
		var entry: Dictionary = environments[clampi(visual_indices.environments, 0, environments.size() - 1)]
		environment_view.texture = VisualCatalog.texture(str(entry.get("image", "")))
	var tables: Array = visuals.get("tables", [])
	if not tables.is_empty():
		var entry: Dictionary = tables[clampi(visual_indices.tables, 0, tables.size() - 1)]
		var table_color := Color(str(entry.get("color", "#173b3a")))
		table_color.a = 0.84
		table_panel.add_theme_stylebox_override("panel", _panel(table_color, 34, Color(str(entry.get("border", "#957754")))))
		table_view.texture = VisualCatalog.texture(str(entry.get("image", "")))
		table_view.visible = table_view.texture != null
	var people: Array = visuals.get("people", [])
	if not people.is_empty():
		var entry: Dictionary = people[clampi(visual_indices.people, 0, people.size() - 1)]
		for seat in range(seat_portraits.size()):
			var portrait: TextureRect = seat_portraits[seat]
			portrait.texture = VisualCatalog.portrait(entry, seat)
			portrait.visible = portrait.texture != null

func _load_visual_preferences() -> void:
	var file := FileAccess.open("user://mars_v2_visual_prefs.json", FileAccess.READ)
	if file == null:
		return
	var saved: Variant = JSON.parse_string(file.get_as_text())
	if not saved is Dictionary:
		return
	for kind in visual_indices:
		if saved.get(kind) is int:
			visual_indices[kind] = saved[kind]

func _save_visual_preferences() -> void:
	var file := FileAccess.open("user://mars_v2_visual_prefs.json", FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(visual_indices))

func _send_emote(glyph: String, meaning: String) -> void:
	game.add_log("你发送表情：%s %s" % [glyph, meaning])
	journal.text = "\n\n".join(game.logs)
	emote_bubble.text = "%s  %s" % [glyph, meaning]
	emote_bubble.global_position = seat_boxes[0].get_global_rect().position + Vector2(115, -22)
	emote_bubble.modulate.a = 1.0
	emote_bubble.show()
	var tween := create_tween()
	tween.tween_interval(1.4)
	tween.tween_property(emote_bubble, "modulate:a", 0.0, 0.5)
	tween.finished.connect(func(): emote_bubble.hide())

func _read_stacks() -> Array:
	if not FileAccess.file_exists(SAVE_FILE):
		return []
	var file := FileAccess.open(SAVE_FILE, FileAccess.READ)
	if file == null:
		return []
	var value: Variant = JSON.parse_string(file.get_as_text())
	if not value is Dictionary or value.get("version") != 2:
		return []
	var stacks: Array = value.get("stacks", [])
	if stacks.size() != 6:
		return []
	for stack in stacks:
		if not stack is int or stack < 0:
			return []
	return stacks

func _save() -> void:
	if game.phase != "done":
		return
	var file := FileAccess.open(SAVE_FILE, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({"version": 2, "stacks": game.players.map(func(p): return p.stack)}))
