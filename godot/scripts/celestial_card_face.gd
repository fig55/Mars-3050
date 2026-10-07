extends PanelContainer
class_name CelestialCardFace

const ATLASES := [
	"res://visuals/assets/cards-stars-atlas.png",
	"res://visuals/assets/cards-planets-atlas.png",
	"res://visuals/assets/cards-moons-atlas.png",
	"res://visuals/assets/cards-small-bodies-atlas.png"
]

var rank_label: Label
var art: TextureRect
var name_label: Label
var size_label: Label
var compact := false

func _init(is_compact: bool = false) -> void:
	compact = is_compact

func _ready() -> void:
	custom_minimum_size = Vector2(88, 91) if compact else Vector2(96, 108)
	add_theme_stylebox_override("panel", _style())
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 0)
	add_child(layout)
	rank_label = Label.new()
	rank_label.add_theme_color_override("font_color", Color("302d2b"))
	rank_label.add_theme_font_size_override("font_size", 15 if compact else 16)
	layout.add_child(rank_label)
	var art_frame := Control.new()
	art_frame.custom_minimum_size.y = 35 if compact else 50
	art_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(art_frame)
	art = TextureRect.new()
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art_frame.add_child(art)
	name_label = Label.new()
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.add_theme_color_override("font_color", Color("252322"))
	name_label.add_theme_font_size_override("font_size", 10)
	name_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	layout.add_child(name_label)
	size_label = Label.new()
	size_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	size_label.add_theme_color_override("font_color", Color("6b5145"))
	size_label.add_theme_font_size_override("font_size", 9)
	layout.add_child(size_label)
	set_back()

func _style() -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = Color("f1e8d5")
	style.border_color = Color("b49977")
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 5
	style.content_margin_right = 5
	style.content_margin_top = 3
	style.content_margin_bottom = 4
	style.shadow_color = Color(0, 0, 0, 0.42)
	style.shadow_size = 4
	return style

func set_back() -> void:
	if rank_label == null:
		return
	rank_label.text = "✦"
	art.texture = null
	name_label.text = "待发牌"
	size_label.text = ""
	tooltip_text = ""

func set_card(card: Dictionary, body: Dictionary) -> void:
	rank_label.text = "%s  %s" % [CelestialCatalog.rank_text(card.r), CelestialCatalog.ICONS[card.s]]
	name_label.text = str(body.get("name", "?"))
	var radius: float = body.get("radius_km", 0.0)
	size_label.text = "半径 %s" % _radius_text(radius)
	tooltip_text = "%s · %s\n半径 %s\n牌面图像为写实艺术呈现" % [body.get("category", "天体"), body.get("name", "?"), _radius_text(radius)]
	var atlas: Texture2D = load(ATLASES[card.s])
	var image := AtlasTexture.new()
	image.atlas = atlas
	var index: int = card.r - 2
	if card.s == 0:
		index = {12: 4, 13: 12, 14: 15}.get(card.r, index)
	elif card.s == 1:
		index = {2: 0, 3: 3, 4: 8, 5: 9, 6: 10, 7: 1, 8: 2, 9: 11, 10: 12, 11: 7, 12: 6, 13: 5, 14: 4}[card.r]
	elif card.s == 2 and card.r == 12:
		index = 0
	elif card.s == 3 and card.r == 14:
		index = 12
	image.region = Rect2((index % 4) * 384, (index / 4) * 256, 384, 256)
	art.texture = image

func _radius_text(radius: float) -> String:
	if radius < 1.0:
		return "%.3f km" % radius
	if radius < 10.0:
		return "%.1f km" % radius
	return "%.0f km" % radius
