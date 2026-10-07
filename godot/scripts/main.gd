extends Control

const SAVE_FILE := "user://mars_v2_save.json"
const BG := Color("101721")
const PANEL := Color("1a2933dc")
const GOLD := Color("e9bc74")
const LIGHT := Color("f5e8d0")
const MUTED := Color("a8b8b7")
const CRYSTAL_COLORS := [Color("f2bd77"), Color("a7e4e4"), Color("bd9cf2"), Color("7ccab3"), Color("ece1b7")]

var game: PokerGame
var catalog: Array = []
var visuals: Dictionary = {}
var visual_indices := {"environments": 0, "tables": 0, "people": 0}
var selected: Dictionary = {}
var pot_inventory: Dictionary = {}
var drag_value := 0
var drag_source := ""
var drag_start := Vector2.ZERO
var dragging := false
var drag_ghost: TextureRect
var drag_ghost_label: Label
var environment_view: TextureRect
var table_view: TextureRect
var table_panel: PanelContainer
var table_drop: Control
var seat_boxes: Array = []
var seat_labels: Array = []
var seat_card_labels: Array = []
var seat_portraits: Array = []
var board_cards: Array = []
var hero_cards: Array = []
var pot_label: Label
var pot_crystal_row: HBoxContainer
var phase_label: Label
var turn_label: Label
var status_label: Label
var hero_hand_label: Label
var selected_label: Label
var bank_box: HBoxContainer
var tray_drop: PanelContainer
var tray_label: Label
var tray_icon_row: HBoxContainer
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
	_initialize_pot_crystals()
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

func _table_clear_style() -> StyleBoxEmpty:
	var style := StyleBoxEmpty.new()
	style.content_margin_left = 0
	style.content_margin_right = 0
	style.content_margin_top = 0
	style.content_margin_bottom = 0
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
	journal.bbcode_enabled = true
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
	top_seats.custom_minimum_size.y = 100
	top_seats.add_theme_constant_override("separation", 8)
	main.add_child(top_seats)
	for seat in [1, 2, 3]:
		_create_seat(top_seats, seat)

	table_panel = PanelContainer.new()
	table_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	table_panel.custom_minimum_size.y = 310
	table_panel.add_theme_stylebox_override("panel", _table_clear_style())
	main.add_child(table_panel)
	table_drop = table_panel
	table_view = TextureRect.new()
	table_view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	table_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	table_view.stretch_mode = TextureRect.STRETCH_SCALE
	table_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	table_panel.add_child(table_view)
	var table_inner := VBoxContainer.new()
	table_inner.alignment = BoxContainer.ALIGNMENT_CENTER
	table_inner.add_theme_constant_override("separation", 3)
	table_panel.add_child(table_inner)
	pot_label = _label("", 20, GOLD)
	pot_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(pot_label)
	pot_crystal_row = HBoxContainer.new()
	pot_crystal_row.alignment = BoxContainer.ALIGNMENT_CENTER
	pot_crystal_row.custom_minimum_size.y = 24
	table_inner.add_child(pot_crystal_row)
	var board_row := HBoxContainer.new()
	board_row.alignment = BoxContainer.ALIGNMENT_CENTER
	board_row.add_theme_constant_override("separation", 7)
	table_inner.add_child(board_row)
	for i in range(5):
		var card := CelestialCardFace.new()
		board_row.add_child(card)
		board_cards.append(card)
	hero_hand_label = _label("", 15, LIGHT)
	hero_hand_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(hero_hand_label)
	var hero_row := HBoxContainer.new()
	hero_row.alignment = BoxContainer.ALIGNMENT_CENTER
	hero_row.add_theme_constant_override("separation", 5)
	table_inner.add_child(hero_row)
	for i in range(2):
		var hero_card := CelestialCardFace.new(true)
		hero_row.add_child(hero_card)
		hero_cards.append(hero_card)
	turn_label = _label("", 14, MUTED)
	turn_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	table_inner.add_child(turn_label)

	var bottom_seats := HBoxContainer.new()
	bottom_seats.custom_minimum_size.y = 100
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
	tray_drop.custom_minimum_size = Vector2(335, 65)
	tray_drop.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tray_drop.add_theme_stylebox_override("panel", _panel(Color("3a3030e6"), 12, GOLD))
	tray_drop.gui_input.connect(_tray_input)
	staging_row.add_child(tray_drop)
	var tray_content := VBoxContainer.new()
	tray_content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tray_drop.add_child(tray_content)
	tray_label = _label("桌前待推 · 空", 15, GOLD)
	tray_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tray_content.add_child(tray_label)
	tray_icon_row = HBoxContainer.new()
	tray_icon_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tray_icon_row.add_theme_constant_override("separation", 3)
	tray_content.add_child(tray_icon_row)
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
	drag_ghost = EnergyCrystalArt.sprite(5, Vector2(64, 64))
	drag_ghost.visible = false
	drag_ghost.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(drag_ghost)
	drag_ghost_label = _label("", 18, GOLD)
	drag_ghost_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	drag_ghost_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	drag_ghost_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	drag_ghost.add_child(drag_ghost_label)
	emote_bubble = _label("", 27, GOLD)
	emote_bubble.visible = false
	emote_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	emote_bubble.add_theme_stylebox_override("normal", _panel(Color("27363be8"), 15, GOLD))
	add_child(emote_bubble)

func _create_seat(parent: HBoxContainer, seat: int) -> void:
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", _panel(Color("14232a88"), 14))
	parent.add_child(panel)
	seat_boxes.resize(6)
	seat_labels.resize(6)
	seat_card_labels.resize(6)
	seat_portraits.resize(6)
	seat_boxes[seat] = panel
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	panel.add_child(row)
	var portrait_holder := Control.new()
	portrait_holder.custom_minimum_size = Vector2(96, 74) if seat != 0 else Vector2(32, 74)
	portrait_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(portrait_holder)
	var portrait := TextureRect.new()
	portrait.size = Vector2(103, 124)
	portrait.position = Vector2(-8, -14)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	portrait_holder.add_child(portrait)
	seat_portraits[seat] = portrait
	var inner := VBoxContainer.new()
	inner.add_theme_constant_override("separation", 2)
	inner.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(inner)
	var name := _label("", 16, GOLD)
	inner.add_child(name)
	seat_labels[seat] = name
	var cards := _label("", 12, LIGHT)
	inner.add_child(cards)
	seat_card_labels[seat] = cards

func _clear(container: Node) -> void:
	for child in container.get_children():
		child.queue_free()

func _refresh() -> void:
	phase_label.text = "第 %d 手   /   %s" % [game.hand, {"preflop": "翻牌前", "flop": "翻牌", "turn": "转牌", "river": "河牌", "done": "结算"}.get(game.phase, "准备")]
	pot_label.text = "能源池  %d" % game.pot()
	_render_pot_crystals()
	for i in range(6):
		var player: Dictionary = game.players[i]
		seat_labels[i].text = "%s  ·  %d 能源%s" % [player.name, player.stack, "  ◉ 行动中" if game.actor == i else ""]
		seat_labels[i].add_theme_color_override("font_color", GOLD if game.actor == i else LIGHT)
		var cards_text := "  ".join(player.cards.map(func(card): return CelestialCatalog.short_text(catalog, card))) if i == 0 or game.showdown else "✦  未亮牌  ✦"
		var stacks: Array = Crystals.split(player.stack, true)
		var crystals_text := " ".join(stacks.map(func(group): return "%d×%d" % [group.value, group.count - (selected.get(group.value, 0) if i == 0 else 0)]))
		seat_card_labels[i].text = "%s\n%s · 本轮 %d · 本手 %d\n◆ %s" % [cards_text, player.last, player.bet, player.total, crystals_text if not crystals_text.is_empty() else "无晶片"]
		seat_boxes[i].add_theme_stylebox_override("panel", _panel(Color("30403baa") if game.actor == i else Color("14232a88"), 14, GOLD if game.actor == i else Color.TRANSPARENT))
	for i in range(5):
		if i < game.board.size():
			var card: Dictionary = game.board[i]
			var body := CelestialCatalog.lookup(catalog, card)
			board_cards[i].set_card(card, body)
		else:
			board_cards[i].set_back()
	for i in range(2):
		if i < game.players[0].cards.size():
			var card: Dictionary = game.players[0].cards[i]
			hero_cards[i].set_card(card, CelestialCatalog.lookup(catalog, card))
		else:
			hero_cards[i].set_back()
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
	_render_journal()

func _render_pot_crystals() -> void:
	_clear(pot_crystal_row)
	for value in Crystals.DENOMINATIONS:
		var quantity: int = pot_inventory.get(value, 0)
		if quantity <= 0:
			continue
		var item := HBoxContainer.new()
		item.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pot_crystal_row.add_child(item)
		item.add_child(EnergyCrystalArt.icon(value, Vector2(30, 27)))
		var count := _label("×%d" % quantity, 13, LIGHT)
		count.autowrap_mode = TextServer.AUTOWRAP_OFF
		count.mouse_filter = Control.MOUSE_FILTER_IGNORE
		item.add_child(count)

func _initialize_pot_crystals() -> void:
	pot_inventory.clear()
	for seat in [game.sb, game.bb]:
		if seat < 0:
			continue
		for group in Crystals.split(game.players[seat].total):
			pot_inventory[group.value] = pot_inventory.get(group.value, 0) + group.count

func _add_pot_crystals(groups: Dictionary) -> void:
	for value in groups:
		pot_inventory[value] = pot_inventory.get(value, 0) + int(groups[value])

func _render_journal() -> void:
	var sections: Array = []
	var previous := ""
	for entry in game.journal_entries:
		var phase_name: String = {"preflop": "第 1 轮 · 翻牌前", "flop": "第 2 轮 · 翻牌", "turn": "第 3 轮 · 转牌", "river": "第 4 轮 · 河牌", "done": "结算"}.get(entry.phase, "准备")
		var key := "%d:%s" % [entry.hand, entry.phase]
		if key != previous:
			sections.append("[color=#e9bc74][b]第 %d 手  /  %s[/b][/color]" % [entry.hand, phase_name])
			previous = key
		sections.append("   %s" % entry.message)
	journal.text = "\n".join(sections)

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
		crystal.custom_minimum_size = Vector2(85, 64)
		crystal.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		crystal.disabled = available <= 0
		var index: int = Crystals.DENOMINATIONS.find(value)
		crystal.add_theme_stylebox_override("normal", _panel(Color("152630e6"), 10, CRYSTAL_COLORS[index]))
		crystal.add_theme_stylebox_override("hover", _panel(Color("29414c"), 10, CRYSTAL_COLORS[index]))
		crystal.gui_input.connect(_crystal_input.bind(value))
		bank_box.add_child(crystal)
		var content := HBoxContainer.new()
		content.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		content.alignment = BoxContainer.ALIGNMENT_CENTER
		crystal.add_child(content)
		content.add_child(EnergyCrystalArt.icon(value, Vector2(37, 43)))
		var count_label := _label("%d\n×%d" % [value, available], 14, LIGHT)
		count_label.autowrap_mode = TextServer.AUTOWRAP_OFF
		count_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
		content.add_child(count_label)
	selected_label.text = "桌前 %d / 余额 %d" % [_selected_amount(), player.stack]

func _render_tray() -> void:
	var amount := _selected_amount()
	_clear(tray_icon_row)
	if amount == 0:
		tray_label.text = "桌前暂存区 · 空"
		var hint := _label("从左侧数晶片到这里", 14, MUTED)
		hint.autowrap_mode = TextServer.AUTOWRAP_OFF
		tray_icon_row.add_child(hint)
	else:
		tray_label.text = "桌前待推 %d · 拖向能源池" % amount
		for value in Crystals.DENOMINATIONS:
			if selected.get(value, 0) > 0:
				tray_icon_row.add_child(EnergyCrystalArt.icon(value, Vector2(25, 26)))
				var count := _label("×%d" % selected[value], 13, LIGHT)
				count.autowrap_mode = TextServer.AUTOWRAP_OFF
				count.mouse_filter = Control.MOUSE_FILTER_IGNORE
				tray_icon_row.add_child(count)
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
			var ghost_value: int = selected.keys()[0] if drag_source == "tray" and not selected.is_empty() else drag_value
			drag_ghost.texture = EnergyCrystalArt.texture(ghost_value)
			drag_ghost_label.text = "%d" % drag_value
			drag_ghost.global_position = event.position + Vector2(15, 10)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		var was_dragging := dragging
		var value := drag_value
		var source := drag_source
		drag_value = 0
		drag_source = ""
		dragging = false
		drag_ghost.visible = false
		if source == "tray" and was_dragging and _point_over_table(event.position):
			_drop_selected()
		elif source == "bank" and was_dragging and tray_drop.get_global_rect().has_point(event.position):
			_select_crystal(value)
		elif source == "bank" and not was_dragging and drag_start.distance_to(event.position) < 12:
			_select_crystal(value)
		else:
			status_label.text = "已取消移动；桌前待推晶片与余额未变。" if source == "tray" else "请先把晶片数到自己桌前，再推入能源池。"

func _point_over_table(point: Vector2) -> bool:
	var bounds := table_drop.get_global_rect()
	var offset := point - bounds.get_center()
	var x := offset.x / (bounds.size.x * 0.48)
	var y := offset.y / (bounds.size.y * 0.43)
	return x * x + y * y <= 1.0

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
	_fly_crystals(tray_drop.get_global_rect().get_center(), selected.duplicate())
	_add_pot_crystals(selected)
	selected.clear()
	_hero_act(move[0], move[1] if move.size() > 1 else 0)

func _hero_act(action: String, amount: int = 0) -> void:
	if game.actor != 0 or not game.act(action, amount):
		return
	selected.clear()
	status_label.text = "动作已记录。"
	_refresh()
	_schedule_advance()

func _fly_crystals(origin: Vector2, groups: Dictionary) -> void:
	var target := pot_label.get_global_rect().get_center()
	var index := 0
	for value in Crystals.DENOMINATIONS:
		for _n in range(int(groups.get(value, 0))):
			var fly := EnergyCrystalArt.sprite(value, Vector2(42, 42))
			fly.mouse_filter = Control.MOUSE_FILTER_IGNORE
			add_child(fly)
			fly.global_position = origin + Vector2(index % 4 * 8, index / 4 * 5)
			fly.pivot_offset = Vector2(21, 21)
			fly.scale = Vector2(0.72, 0.72)
			var destination := target + Vector2((index % 5 - 2) * 9, (index % 3 - 1) * 5)
			var tween := create_tween()
			tween.set_parallel(true)
			tween.tween_property(fly, "global_position", destination, 0.48 + index * 0.035).set_delay(index * 0.025).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
			tween.tween_property(fly, "scale", Vector2(0.38, 0.38), 0.48 + index * 0.035).set_delay(index * 0.025)
			tween.chain().tween_property(fly, "modulate:a", 0.0, 0.18)
			tween.finished.connect(fly.queue_free)
			index += 1
	var pulse := create_tween()
	pulse.tween_property(pot_label, "modulate", Color("fff1ba"), 0.14).set_delay(0.42)
	pulse.tween_property(pot_label, "modulate", Color.WHITE, 0.30)

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
			var seat: int = game.actor
			var before: int = game.players[seat].stack
			var move := game.bot_action()
			game.act(move[0], move[1] if move.size() > 1 else 0)
			var paid: int = before - game.players[seat].stack
			if paid > 0:
				var groups: Dictionary = {}
				for group in Crystals.split(paid):
					groups[group.value] = group.count
				_fly_crystals(seat_boxes[seat].get_global_rect().get_center(), groups)
				_add_pot_crystals(groups)
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
	_initialize_pot_crystals()
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
		table_panel.add_theme_stylebox_override("panel", _table_clear_style())
		var surface := VisualCatalog.texture(str(entry.get("image", "")))
		table_view.texture = surface if surface != null else load("res://visuals/assets/oval-poker-table.png")
		table_view.visible = true
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
	_render_journal()
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
