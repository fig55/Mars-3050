# 火星牌局 · Mars-3050 V2 优化方向

## 版本边界

《夜局》Alpha 是已封板的六人德州扑克原型，封板提交 `6f668f8`、本地标记 `night-alpha-freeze`。Tauri/JavaScript 版本保持可追溯，不在 V2 工作区改动其页面或存档。V2 在独立 `mars-v2` worktree 开发，使用本机 Godot 4.5.1、GDScript；首版以编辑器内运行和 Mac 调试为交付方式。暂不制作 DMG 或独立 .app。

V2 保留规则语义：六人桌、每人两张底牌、五张公共牌、九种标准牌型、10/20 盲注、四轮下注、短码全下、主池/边池、平分与庄家顺时针分配余数。新概念改变牌面和能源晶片的呈现，不改变胜负与账目。

## 天体牌与能源晶片

- 52 张牌由恒星、行星、卫星、小天体四类各 13 张组成，分别映射四种花色。每类按核验后的半径由小到大对应 2–A；跨类只比较映射后的点数和标准花色规则，不直接比较公里数。
- 牌面同时显示点数、类别图符、天体名称和约值半径；完整名称、精度与来源保存在 `godot/data/celestial_cards.json`。恒星与系外行星半径按 NASA Exoplanet Archive 的太阳/地球半径单位换算；太阳系行星和卫星采用 JPL 资料；小天体采用 JPL SBDB 直径的一半。
- 旧版圆形筹码换成桌前可见的**能源晶片**。面额 500/100/25/5/1，显示真实枚数。点击逐枚数取，拖向桌心投放；无效下注或取消拖放保留桌前晶片和已选金额。飞行动画按投放金额呈现，规则引擎只处理整数金额。
- V2 存档只写 `user://mars_v2_save.json`，不读取也不覆盖《夜局》的 Tauri localStorage。

## 体验与技术路线

Godot 场景承担窗口布局、牌桌、人物席位、晶片与动画；`poker_rules.gd`、`poker_game.gd`、`crystals.gd` 独立承载牌型、牌局和面额规则。牌桌、席位、底池、操作和结算使用独立区域；缩小 Mac 窗口时整体按设计视口缩放，避免人脸/信息、公共牌/手牌、底池/操作互挡。每个对手有可见思考等待，当前牌型命中时短暂强化提示；新手规则使用牌面图示解释九种牌型。

GDScript 作为首版统一代码路径，也保留未来 Web 试玩的可能；Godot 4 的 C# 项目目前不能导出 Web。独立 Mac .app 需要另装导出模板并单独验收，不纳入本次 P0。

## 优先级与验收

### P0 · 一手可玩

可在 Godot 4.5.1 中打开 `godot/project.godot` 并完成一手：盲注、行动等待、点击数取与拖动投放、翻牌/转牌/河牌、结算及继续下一手。先使用代码绘制的席位和晶片，角色美术不阻塞规则验收。

固定牌局核验九种牌型、A2345、主池/边池、奇数平分、短码全下和能源守恒；300 组牌面与旧 JavaScript 评分对照，100 手自动牌局检验账目。桌面验收覆盖晶片拖放/取消、结算完整显示、Mac 常见窗口比例与规则图示。新目录必须有 52 张且每类严格递增。

### P1 · 角色和火星美术

统一六个席位的视觉尺度，制作火星居住区桌面与角色形象；按对手性格设计等待、犹豫与动作节奏。对白只使用公开信息，不能通过表现泄露底牌。把晶片飞行优化为逐枚、桌面落点和结算回流，但继续与金额模型隔离。

### P2 · 传播和延展

接入可回放的牌局纪事、手间轻叙事与统计，再制作独立 Mac .app，安装导出模板并验证签名/分发；之后评估 Web 试玩。暂缓联网、真钱、账号、资源经营、3D 和大模型决定对手策略。

## 资料与运行

- [JPL 行星物理参数](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL 卫星物理参数](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [JPL 小天体数据库 API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html)
- [NASA Exoplanet Archive API](https://exoplanetarchive.ipac.caltech.edu/docs/program_interfaces.html)
- [NASA 太阳半径定义](https://science.nasa.gov/universe/glossary/)
- [Godot 4.5 Web 导出限制](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)

运行和自动测试命令见 [Godot README](godot/README.md)。
