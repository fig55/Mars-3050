# 可替换视觉资源

顶栏的“场景”“桌面”“人物”分别切换，不需要修改牌局脚本。内置目录在 `catalog.json`：环境条目用 `image`，桌面条目用 `image`、`color` 和 `border`，人物条目可用六张 `portraits`，或一张 `atlas` 加六组 `regions`。座位顺序为：你、老陈、林小姐、阿杰、周先生、小鹿；自己的位置可以留空，因为底牌采用第一人称视角。

把 PNG 放进本项目 `visuals/assets/` 后，可在 `catalog.json` 增加条目，路径写成 `res://visuals/assets/文件名.png`。也可把图片与下面的 JSON 放进 Godot 用户数据目录，JSON 文件名为 `mars_v2_visuals.json`，图片路径写成 `user://文件名.png`，重启游戏后会出现在对应选择框。用户目录可在 Godot 运行时通过 `OS.get_user_data_dir()` 查看。图片加载失败时回退到颜色或空席位，不影响规则。

```json
{
  "environments": [
    {"id": "my-room", "name": "我的舱室", "image": "user://my-room.png"}
  ],
  "tables": [
    {"id": "my-table", "name": "我的桌面", "image": "user://my-table.png", "color": "#273d3c", "border": "#b39268"}
  ],
  "people": [
    {"id": "my-cast", "name": "我的人物", "portraits": ["", "user://chen.png", "user://lin.png", "user://ajie.png", "user://zhou.png", "user://xiaolu.png"]}
  ]
}
```

环境图建议 16:9，中央桌面区域要暗且简洁。桌面图片会铺在桌面色块之上；人物图片建议透明背景，五位对手尽量统一身高与基线。`user://` 素材不会写入 Git，也不会改变《夜局》资源。
