extends RefCounted
class_name EnergyCrystalArt

const ATLAS := "res://visuals/assets/energy-crystals-atlas.png"

static func texture(value: int) -> Texture2D:
	var index: int = Crystals.DENOMINATIONS.find(value)
	if index < 0:
		return null
	var part := AtlasTexture.new()
	part.atlas = load(ATLAS)
	part.region = Rect2(index * 396, 170, 396, 445)
	return part

static func sprite(value: int, size: Vector2) -> TextureRect:
	var view := TextureRect.new()
	view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	view.texture = texture(value)
	view.size = size
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return view

static func icon(value: int, size: Vector2) -> Control:
	var frame := Control.new()
	frame.custom_minimum_size = size
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var view := sprite(value, size)
	view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.add_child(view)
	return frame
