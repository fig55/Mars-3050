# 火星牌局 V2 · Godot P0

这是独立于《夜局》Tauri 客户端的 Godot 4.5.1 / GDScript 可玩版本。打开本目录的 `project.godot`，按 F6/F5 运行即可在编辑器中调试。Mac 首版不需要导出模板；尚未制作 `.app` 或 DMG。

牌桌保留六人德州规则。你的两张图像底牌和五张公共牌都展示在实体椭圆桌面上，牌面叠加天体名称与半径。跟注与加注都要完成两步：从可用晶片中逐枚点击数取，或拖到自己的**桌前暂存区**；确认金额后，拖动暂存区到能源池，或点击“推入能源池”。数取时只在可用晶片与桌前之间移动，余额不会改变；推入时才验证金额并记账。金额不合法时暂存晶片保留，可继续数取；拖到桌外会取消该次推动，点击“收回桌前晶片”可全部撤回。能源池显示按实际投放累积的晶片枚数，自己与对手的晶片会逐枚飞入池中。弃牌和零金额过牌仍可直接操作。

右侧保留“桌边纪事”，按第几手、翻牌前/翻牌/转牌/河牌的第几轮分组记录动作与结算；下方表情按钮可发送本地桌边表情，纪事会留下记录。右上角“玩法图示”展示九种牌型。对手思考、牌型命中和投放有短暂动画。

项目以 1440×900 设计视口适配 Mac 窗口，缩小时整体按比例缩放，结算区始终位于牌桌下方。每个席位显示余额、已投入金额和按 500/100/25/5/1 换算的真实晶片枚数。存档在 Godot 的 `user://mars_v2_save.json`，只于一手结算后写入余额，不触碰旧版 localStorage。

规则和数据与 UI 分离：

- `scripts/poker_rules.gd`：九种牌型、A2345、最佳五张、牌型提示。
- `scripts/poker_game.gd`：盲注、回合、对手、主池/边池、平分与结算。
- `scripts/crystals.gd`：面额、枚数和投放合法性。
- `data/celestial_cards.json`：四类各 13 张，按半径升序映射 2–A，含来源。
- `visuals/catalog.json` 与 `scripts/visual_catalog.gd`：环境图、实体椭圆牌桌与人物的独立替换入口；顶栏可分别切换，选择另存于 `user://mars_v2_visual_prefs.json`。
- `scripts/celestial_card_face.gd` 与 `scripts/energy_crystal_art.gd`：图像牌面、尺寸标注和真实枚数晶片。玩家与对手投放时按实际枚数播放入池动画。
- `concepts/mars-immersive-v1.png`：沉浸式火星牌局视觉概念；当前 Godot 界面是可交互的第一轮实现，后续会按反馈继续调整构图和人物尺度。

自定义素材的格式和放置方法见 [visuals/README.md](visuals/README.md)。默认有暮色居住舱/夜间观测台两张环境图、两种桌面和可关闭的《夜局》人物立绘；三个类别彼此独立，不写死在牌局规则中。

在仓库根目录运行：

```sh
node godot/tests/generate_reference.cjs
/Applications/Godot_mono.app/Contents/MacOS/Godot --headless --path godot --script res://tests/run_tests.gd
/Applications/Godot_mono.app/Contents/MacOS/Godot --headless --path godot --script res://tests/ui_probe.gd
```

测试用 300 组旧版 JavaScript 评分作对照，另核验九种牌型、边池、奇数平分、晶片合法性和 100 手随机自动牌局的金额守恒。`tests/ui_probe.gd` 核查弹层/结算区位置、资源切换、暂存/撤回/非法金额/合法投放以及表情纪事。`../OPTIMIZATION_PLAN.md` 记录 V2 优先级与资料来源。
