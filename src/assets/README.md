# 人物素材

players.png：五位角色的透明背景静态精灵图集，1983 × 793，RGBA。顺序：老陈、林小姐、阿杰、周先生、小鹿。由内置 imagegen 生成。

页面通过 CSS background-size: 500% auto 和 0/25/50/75/100% 的横向位置显示每位角色，不需要额外裁切文件。老陈、林小姐、周先生和小鹿仍是静态姿态。

ajie-poses.png：阿杰六状态透明精灵图，2172 × 724，RGBA。从左到右为平静、思考、下注、弃牌、赢牌、输牌。页面按动作切换对应图格，约 1.1 秒后回归平静；这不是连续逐帧动画。生成提示：以上述五人图集里的阿杰为角色参考，生成单排六格、姿态与基线一致的透明背景像素风德州扑克半身人物精灵图；深棕短发、棕红衬衫，暖色顶光；六个状态依次平静、思考、推筹码下注、弃牌、赢牌、输牌；无桌面、文字、牌、筹码或背景。

生成提示：Production sprite atlas, genuinely transparent alpha background; exactly five equally spaced seated waist-up adult East Asian poker players, older gray-haired man charcoal cardigan, bob-haired woman ivory blouse, young man rust shirt, glasses man brown jacket, ponytail woman sage sweater. Calm cinematic pixel art, warm overhead light, front or gentle three-quarter view, identical baseline, no table, props, text, labels, shadows or background; one idle pose each.
