# 本轮美术资源说明

资源由 Codex 内置 `image_gen` 生成，均已复制到 `visuals/assets/`，由 Godot 本地加载。实际天体名称、花色映射与半径来自 `data/celestial_cards.json`，牌面图像只作写实风格的艺术视觉化，不代表对该具体天体的实拍或科学复原。

生成提示词组：

- `oval-poker-table.png`：透明背景、略俯视的实体椭圆深青色牌桌；铜木外沿和柔和暖光，中央留空供牌与晶片叠加。
- `oval-basalt-table.png`：以上一张牌桌为编辑目标，只将内层台面改为深色玄武岩材质，保持透明轮廓与外沿。
- `energy-crystals-atlas.png`：透明背景的一排五枚同尺寸六棱能源晶片，依次为琥珀、青、紫、绿、象牙色，不含文字。
- `cards-stars-atlas.png`：严格 4×4 网格、十六张不同恒星的写实天文视觉化；黑色太空底，无文字。
- `cards-planets-atlas.png`：严格 4×4 网格、十六张不同岩质、气态和冰质行星的写实视觉化；黑色太空底，无文字。
- `cards-moons-atlas.png`：严格 4×4 网格、十六张不同卫星的写实视觉化；黑色太空底，无文字。
- `cards-small-bodies-atlas.png`：严格 4×4 网格、十六张小天体、彗核和矮行星的写实视觉化；黑色太空底，无文字。

牌面通过 `scripts/celestial_card_face.gd` 的图集区域映射取图，并另行叠加点数、名称和半径；晶片通过 `scripts/energy_crystal_art.gd` 的图集区域映射取图。如此可更换视觉图集而不改变牌局规则与金额记录。
