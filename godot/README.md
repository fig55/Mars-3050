# 火星牌局 V2 · Godot P0

这是独立于《夜局》Tauri 客户端的 Godot 4.5.1 / GDScript 可玩版本。打开本目录的 `project.godot`，按 F6/F5 运行即可在编辑器中调试。Mac 首版不需要导出模板；尚未制作 `.app` 或 DMG。

牌桌保留六人德州规则。你的底牌在下方席位，公共牌、能源池在桌心；轮到你时可弃牌、跟注/过牌、最小加注或全下。点击桌前能源晶片逐枚数取，点击“投放已选”或从晶片拖到桌心下注；拖到桌外会取消本次投放。非法金额会保留已选晶片，方便继续数取。右上角的“玩法图示”展示九种牌型。对手思考、牌型命中和投放有短暂动画。

项目以 1440×900 设计视口适配 Mac 窗口，缩小时整体按比例缩放，结算区始终位于牌桌下方。每个席位显示余额、已投入金额和按 500/100/25/5/1 换算的真实晶片枚数。存档在 Godot 的 `user://mars_v2_save.json`，只于一手结算后写入余额，不触碰旧版 localStorage。

规则和数据与 UI 分离：

- `scripts/poker_rules.gd`：九种牌型、A2345、最佳五张、牌型提示。
- `scripts/poker_game.gd`：盲注、回合、对手、主池/边池、平分与结算。
- `scripts/crystals.gd`：面额、枚数和投放合法性。
- `data/celestial_cards.json`：四类各 13 张，按半径升序映射 2–A，含来源。
- `concepts/mars-immersive-v1.png`：沉浸式火星牌局视觉概念；当前 Godot P0 界面仍是便于规则调试的代码绘制版本。

在仓库根目录运行：

```sh
node godot/tests/generate_reference.cjs
/Applications/Godot_mono.app/Contents/MacOS/Godot --headless --path godot --script res://tests/run_tests.gd
```

测试用 300 组旧版 JavaScript 评分作对照，另核验九种牌型、边池、奇数平分、晶片合法性和 100 手随机自动牌局的金额守恒。`tests/ui_probe.gd` 可在 headless 模式检查规则弹层的设计视口位置。`../OPTIMIZATION_PLAN.md` 记录 V2 优先级与资料来源。
