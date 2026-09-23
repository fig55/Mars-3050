extends RefCounted
class_name VisualCatalog

const BUILTIN := "res://visuals/catalog.json"
const USER_EXTENSION := "user://mars_v2_visuals.json"

static func load_catalog() -> Dictionary:
	var catalog := _read_json(BUILTIN)
	for kind in ["environments", "tables", "people"]:
		if not catalog.has(kind) or not catalog[kind] is Array:
			catalog[kind] = []
	var custom := _read_json(USER_EXTENSION)
	for kind in ["environments", "tables", "people"]:
		if custom.get(kind) is Array:
			for entry in custom[kind]:
				if entry is Dictionary and entry.has("id") and entry.has("name"):
					catalog[kind].append(entry)
	return catalog

static func _read_json(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var data: Variant = JSON.parse_string(file.get_as_text())
	return data if data is Dictionary else {}

static func texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if path.begins_with("res://"):
		return ResourceLoader.load(path) as Texture2D
	if path.begins_with("user://"):
		var image := Image.new()
		if image.load(ProjectSettings.globalize_path(path)) == OK:
			return ImageTexture.create_from_image(image)
	return null

static func portrait(pack: Dictionary, seat: int) -> Texture2D:
	var portraits: Array = pack.get("portraits", [])
	if seat < portraits.size() and not str(portraits[seat]).is_empty():
		return texture(str(portraits[seat]))
	var regions: Array = pack.get("regions", [])
	if seat >= regions.size() or not regions[seat] is Array or regions[seat].size() != 4:
		return null
	var atlas := texture(str(pack.get("atlas", "")))
	if atlas == null:
		return null
	var part := AtlasTexture.new()
	part.atlas = atlas
	var region: Array = regions[seat]
	part.region = Rect2(float(region[0]), float(region[1]), float(region[2]), float(region[3]))
	return part
