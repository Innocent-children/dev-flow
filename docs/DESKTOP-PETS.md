# 桌面宠物形象包

[中文](DESKTOP-PETS.md) | [English](DESKTOP-PETS_en.md)

桌面宠物从本地文件夹导入形象。用户提供图片与描述，Dev Flow 负责显示任务阶段、气泡、点击跳转和播放。
形象不需要 Swift、重新编译或重新安装应用。

## 导入与切换

1. 从宠物右键菜单或菜单栏打开“选择形象”。
2. 点击“导入形象…”，选择包含 `pet.json` 的文件夹。
3. 导入成功后立即使用；菜单可以切回内置形象或其他已导入形象。

导入会保存一份副本；源文件夹可以移走。修改素材后重新导入，同 ID 更新已有形象。验证失败保留原有形象。
任务选择与形象选择分别保存；切换形象不会改变关注任务，也不会重新播放旧的完成提示。

用户素材位于 `productRoot/pet/appearances/<id>`，`selected_appearance` 保存在宠物设置中。
程序升级和普通卸载保留素材与选择；已确认的 factory-reset 随整个宠物目录清理。保存的形象缺失或损坏时，
程序提示并暂用内置形象，用户可以重新导入。

## Dev Flow 静态形象

最小形象包只需要两个文件：

```text
orange-square/
  pet.json
  pet.png
```

`pet.json`：

```json
{
  "id": "orange-square",
  "name": "Orange square",
  "image": "pet.png"
}
```

`id` 为 1–64 个小写英文字母、数字、连字符或下划线，首字符为字母或数字；`name` 为 1–100 个字符。
`image` 是相对当前文件夹的 PNG 路径，建议使用透明背景。单张图用于所有阶段，阶段区别仍由气泡文字说明。
可以复制仓库中的 [静态示例](../packages/desktop-pet/examples/orange-square/pet.json)，替换图片与名称。

## Dev Flow 动画形象

动画包的 `pet.json` 只填写 `id` 与 `name`；同目录提供 `animations.json` 和 `Assets/`：

```text
my-pet/
  pet.json
  animations.json
  Assets/
    idle/0.png
    idle/1.png
    working/0.png
    blocked/0.png
    complete/0.png
    complete/1.png
    disconnected/0.png
```

下面清单对应 128×128 的图片，所有帧使用相同画布和角色位置：

```json
{
  "canvas": { "width": 128, "height": 128 },
  "anchor": { "x": 64, "y": 128 },
  "clips": {
    "idle": { "frames": ["idle/0.png", "idle/1.png"], "fps": 8, "loop_range": [0, 1], "rest_frame": 0 },
    "working": { "frames": ["working/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 },
    "blocked": { "frames": ["blocked/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 },
    "complete": { "frames": ["complete/0.png", "complete/1.png"], "fps": 8, "loop_range": null, "rest_frame": 1 },
    "disconnected": { "frames": ["disconnected/0.png"], "fps": 8, "loop_range": [0, 0], "rest_frame": 0 }
  }
}
```

五类动作均需存在，可以重复引用同一张图。单帧动作使用静态显示。多帧动作按 `fps` 播放；
也可以添加与 `frames` 等长的 `frame_durations_ms` 数组，逐帧指定毫秒时长并优先于 `fps`。
`loop_range` 包含首尾索引；完成动作使用 `null`，播放结束保持 `rest_frame`。减少动态效果与动画开关使用静态帧。
播放器按完整画布等比缩放，作者用一致画布对齐角色；`anchor` 保留共同素材参考点。

## Codex 宠物包

同一导入入口接受 Codex 本地包，无需修改原文件：

```json
{
  "id": "my-codex-pet",
  "displayName": "My Codex pet",
  "description": "My companion",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

选择具体宠物文件夹，例如 `~/.codex/pets/my-codex-pet`；该文件夹须包含 `pet.json` 和其引用的 PNG/WebP 图集。
省略 `spriteVersionNumber` 按 1 处理；版本 1 图集为 1536×1872，版本 2 为 1536×2288，均为 8 列、192×208 单格。
这些是素材格式版本，不是 Dev Flow 产品版本。

| Dev Flow 展示 | Codex 动作行 | 帧数 |
| --- | --- | --- |
| 待机 | idle，行 0 | 6 |
| 普通阶段 | running，行 7 | 6 |
| 受阻 | waiting，行 6 | 6 |
| 完成 | jumping，行 4 | 5 |
| 未连接 | failed，行 5 | 8 |

导入时拆成 PNG 帧并保留标准逐帧时长，之后使用统一播放器。只读取所需动作行；Codex 的追视、行走和
任务活动行为不属于 Dev Flow 的形象导入。任务含义、完成提示条件和跳转目标继续由 Dev Flow 决定。
源文件夹保持原样，安装目录 ID 从 Codex 的 `id` 稳定生成。

## 文件要求

- 描述文件最多 256 KiB。文件路径必须为相对路径，引用普通文件；不接受符号链接或目录外引用。
- Dev Flow PNG 每边不超过 1024 像素，动画帧尺寸须与 `canvas` 一致。
- 动作清单最多 512 个帧引用，PNG 总大小最多 64 MiB，单动作按 RGBA 估算的展开数据不超过 128 MiB。
- `fps` 为 0.1–120，逐帧时长为 9–60000 毫秒。循环及静态索引必须有效。
- Codex 图集最多 64 MiB，尺寸须符合上表版本。形象包只提供数据，不提供执行脚本。

当前入口导入本地文件夹。打包、启动和平台范围见[命令参考](COMMANDS.md#桌面宠物本地开发包)。
