# 桌面宠物使用与形象指南

[中文](DESKTOP-PETS.md) | [English](DESKTOP-PETS_en.md)

桌面宠物显示一个所选 Dev Flow Task 的已保存状态，点击打开对应 WebUI。形象决定可播放的素材，
本地调度器安排待机活动；Task 状态仍由 Core 决定。本文说明获取与启动、任务选择、程序和素材更新、
动作规则、形象制作及常见问题。

## 环境与交付方式

桌面组件面向 macOS arm64（Apple Silicon），运行时需要至少一个已安装并配置的 Codex 或 DeepSeek Adapter 提供 Core。
Swift Package 与应用 metadata 的部署目标为 macOS 14；最低系统实际运行、Developer ID 签名和 Apple 公证尚未完成正式分发验证。
具体已验证范围见[支持矩阵](SUPPORT-MATRIX.md#桌面宠物功能检查)。

下文 `productRoot` 指产品目录，macOS 默认是 `~/.dev-flow`；设置与形象保存在其中的 `pet/` 子目录。

当前仓库的常规 npm 包清单和正式制备流程不包含 `DevFlowPet.app`。原生应用由专用本地构建脚本加入
`@imotong/dev-flow` 开发包；安装普通 Adapter 包本身不代表已经取得宠物应用。
运行已构建的应用无需 Swift/Xcode，构建机器需要 Node.js >=24 与可通过 `xcrun swift` 使用的 Swift >=6.0 工具链。

## 本地构建与安装

先按[统一安装入口](COMMANDS.md#多数用户需要的推荐入口)配置至少一个 Adapter。已有配置可直接复用。
在仓库根目录执行下列命令，输出目录必须是仓库外的绝对路径：

```bash
node scripts/build-desktop-pet.mjs --output "/absolute/pet-build"
```

脚本编译 Swift、装配素材与语言资源、进行 ad-hoc 签名并生成 `.tgz`，同时输出 `desktop-pet-build.json`。
它不重新构建 Core，也不执行发布。取得同样由此脚本生成的本地包时，可以直接进入安装步骤。
将下面的 `<local-package>.tgz` 换成构建结果中 `tarball` 字段给出的实际文件名：

```bash
npm install -g "/absolute/pet-build/<local-package>.tgz"
dev-flow pet start
```

`dev-flow` 是该本地统一入口包提供的命令。通过它启动宠物，不直接双击应用包；启动器会传入 Core 与数据目录参数。
启动优先使用已有的 `~/.dev-flow/pet/DevFlowPet.app`，其次使用当前统一入口包内的
`runtime/darwin-arm64/DevFlowPet.app`。安装辅助逻辑仅在目标缺失且候选包确实带有应用时复制到用户目录。
已有应用的更新见下一节。

## 更新程序与素材

程序、安装副本和用户素材分别更新：

| 对象 | 更新方式 |
| --- | --- |
| 本地统一入口包 | 先退出宠物，再安装新构建的 `.tgz`。这会更新包内 CLI 与应用。 |
| 用户目录中的 `DevFlowPet.app` | 若已有该应用，安装 npm 包会保留它；需要退出后用新包中的完整 `.app` 替换。 |
| 已导入形象 | 修改或补充源图集后，从菜单重新导入同一形象文件夹。应用升级不会重新读取原始素材目录，也不会补造缺少的动作。 |

运行时可查看 `~/.dev-flow/pet/runtime.json` 的 `executable_path`，确认实际使用的是包内应用还是用户目录中的应用。
该文件在正常退出时清理，应在退出前查看。更新顺序如下：

1. 使用菜单“退出”或 `dev-flow pet stop` 正常结束宠物；停止失败时先从仍在运行的宠物菜单退出。
2. 安装新的本地 `.tgz`。如果上次运行的是用户目录中的应用，选择一个新的空目录，将同一新包解开：

```bash
mkdir -p "/absolute/pet-unpack"
tar -xzf "/absolute/pet-build/<local-package>.tgz" -C "/absolute/pet-unpack"
```

3. 需要更新用户目录副本时，从 `/absolute/pet-unpack/package/runtime/darwin-arm64/` 将完整的 `DevFlowPet.app` 复制到
   `~/.dev-flow/pet/`，在访达中替换同名应用。只替换应用包，保留 `settings.json` 和 `appearances/`。
4. 再执行 `dev-flow pet start`。需要增加形象动作时，再按“导入与切换”重新导入素材。

## 随包内置形象

本地宠物包包含默认形象与鲸鱼娘（`whale-girl 3`）。安装并启动后，从“选择形象”选择
“鲸鱼娘（8× 极清动画修复版）”即可使用，无需手动导入。鲸鱼娘保留九类动作、57 帧、1536×1664
单帧分辨率及逐帧时长，适用本指南的通用触发规则。

内置形象从应用的 `Contents/Resources/Appearances/<id>` 直接读取，随完整应用包更新。
同 ID 的用户导入副本优先，菜单只显示一项；程序升级保留该副本，更新它仍需重新导入。
损坏的用户副本按导入形象错误处理。形象选择保存方式与其他形象相同，切换不改变关注任务。
素材及构建说明见[随包形象素材](../packages/desktop-pet/appearances/README.md)。

## 任务选择与基本操作

启动后优先恢复该数据目录中保存的任务选择；没有保存选择时，先选最近更新的受阻任务，再选最近更新的进行中任务。
都没有时保持未选择状态。可从右键菜单或菜单栏的“选择任务”手动更换关注对象；本次运行初次没有任务时，后续新建任务需要从面板选择。

普通 Codex 对话不会自动成为 Dev Flow Task。所选任务持续处于进行中时，即使 Host 暂时没有输出，宠物仍展示工作或审核动作。

| 操作 | 结果 |
| --- | --- |
| 左键点击宠物或气泡 | 打开所选 Task 的 WebUI；未选择任务时打开列表。 |
| 右键／菜单栏 | 选择任务、选择形象、导入形象、控制动画与待机活动、隐藏或退出。 |
| 鼠标悬停 | 展开气泡；符合休闲条件时，角色悬停还可触发挥手。 |
| 拖动后放下 | 保存新的摆放位置，后续散步围绕该位置进行。 |
| 隐藏或系统睡眠 | 停止动画、位移和观察请求；重新显示或唤醒后读取当前状态。 |
| 退出／`dev-flow pet stop` | 只结束宠物，保留 WebUI、Task、设置和素材。 |

命令仅支持 `dev-flow pet start` 和 `dev-flow pet stop`，输出为纯文本，退出码为成功 `0`、运行失败 `1`、参数错误 `2`。
没有公开的 `pet status` 或 `pet start --json`；启动失败时结合错误文字和本指南的常见问题处理。

## 形象类型与动作可用性

规则按动作键运行，适用于所有形象，不按名称指定行为。素材实际提供哪些动作，决定该形象能展示哪些效果。

| 形象类型 | 保存与播放的内容 |
| --- | --- |
| 单张 PNG | 五类任务动作共用一张图，表现为静态形象。 |
| Dev Flow 原生动画包 | 必须提供五类任务动作，可增加四类附加动作；每类帧数由自己的清单决定。 |
| Codex 标准图集或采用相同布局的高分辨率扩展 | 按固定九行动作提取九类、57 帧。格式 2 的额外追视帧不在提取范围内。 |

五类必需动作是 `idle`、`working`、`blocked`、`complete`、`disconnected`，保证任务状态都有对应展示。
四类附加动作是 `running-right`、`running-left`、`waving`、`review`，用于散步、回应和思考。
缺少的附加动作会从休闲候选中排除；审核节点缺少 review 素材时使用 working。
安装副本的动作可在 `productRoot/pet/appearances/<id>/animations.json` 的 `clips` 中查看。

## 导入与切换

1. 从宠物右键菜单或菜单栏打开“选择形象”。
2. 点击“导入形象…”，选择包含 `pet.json` 的文件夹。
3. 导入成功后立即使用；菜单可以切回内置形象或其他已导入形象。

导入会保存一份副本；源文件夹可以移走。修改素材后重新导入，同 ID 更新已有形象。
转换后的完整形象包在临时目录通过与加载时相同的校验后，才替换已安装目录；验证失败保留原有形象和选择。
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

五类任务动作均需存在，可以重复引用同一张图。清单还可提供 `running-right`、`running-left`、`waving`、
`review` 四类附加动作；所有已提供动作均按相同规则校验和加载。单帧动作使用静态显示。多帧动作按 `fps` 播放；
也可以添加与 `frames` 等长的 `frame_durations_ms` 数组，逐帧指定毫秒时长并优先于 `fps`。
`loop_range` 包含首尾索引；完成动作使用 `null`，播放结束保持 `rest_frame`。减少动态效果与动画开关使用静态帧。
播放器按完整画布等比缩放，作者用一致画布对齐角色；`anchor` 保留共同素材参考点。

## Codex 标准宠物格式兼容

Dev Flow 兼容 Codex 精灵图格式 1 和 2。兼容范围是本地包中的图集布局、所需动作帧和逐帧时长；
任务阶段、提示和点击跳转由 Dev Flow 决定。导入入口接受以下字段组成的 `pet.json` 与 PNG/WebP 图集：

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
本导入器要求 `id`、`displayName` 和 `spritesheetPath`：`id` 非空且最多 256 个字符，`displayName`
包含非空白内容且最多 100 个字符，`spritesheetPath` 为相对文件路径。`description` 可选，不参与任务展示。
`spriteVersionNumber` 可省略，省略时按 1 处理；显式取值只接受 1 或 2。这与
[Codex 官方宠物版本参数](https://developers.openai.com/codex/reference/commands#pets)一致。

| Codex 标准格式 | 图集尺寸 | 网格 | 单格尺寸 |
| --- | --- | --- | --- |
| `spriteVersionNumber: 1` | 1536×1872 | 8 列、9 行 | 192×208 |
| `spriteVersionNumber: 2` | 1536×2288 | 8 列、11 行 | 192×208 |

两种标准格式共用下面九个动作行，Dev Flow 全部导入，共 57 帧。格式 2 另外包含追视帧，
当前导入范围为前九行动作。
这里的 1、2 是 Codex 素材格式版本，不是 Dev Flow 产品版本。

| 动作 | 清单键 | Codex 动作行 | 帧数 |
| --- | --- | --- | --- |
| 待机 | `idle` | idle，行 0 | 6 |
| 向右走 | `running-right` | running-right，行 1 | 8 |
| 向左走 | `running-left` | running-left，行 2 | 8 |
| 挥手 | `waving` | waving，行 3 | 4 |
| 完成 | `complete` | jumping，行 4 | 5 |
| 未连接 | `disconnected` | failed，行 5 | 8 |
| 受阻 | `blocked` | waiting，行 6 | 6 |
| 普通阶段 | `working` | running，行 7 | 6 |
| Review | `review` | review，行 8 | 6 |

导入时拆成 PNG 帧并保留标准逐帧时长，之后使用统一播放器。向右走、向左走、挥手和 review
参与下述待机活动与任务动作选择；循环素材也可按指定完整遍数播放后结束。
任务含义、完成提示条件和跳转目标继续由 Dev Flow 决定；`behavior-map.json` 不参与导入或动作调度。
源文件夹保持原样，安装目录 ID 从 Codex 的 `id` 稳定生成。

## Dev Flow 自有高分辨率扩展

同一入口也支持 Dev Flow 自有的高分辨率图集扩展。它沿用上面的 `pet.json` 字段和动作行布局，
导入时保留原始单格分辨率，转换为统一 PNG 帧。该扩展由 Dev Flow 支持，不属于 Codex 标准格式；
Dev Flow 导入成功不表示原图集能被 Codex 识别。需要同时在 Codex 中使用时，应另行提供上表中
与 `spriteVersionNumber` 匹配的标准尺寸图集。

扩展切图规则：

- 图集固定 8 列，宽度须能被 8 整除；`cell_width = width / 8`。
- 单格保持 192:208 比例，`cell_height = cell_width × 208 / 192` 必须为整数。
- 高度至少覆盖前 9 个完整动作行，即 `height >= cell_height × 9`；完整提取上表九类动作。
- `spriteVersionNumber` 仍只接受 1、2，省略默认 1；扩展图集的切图尺寸由宽度推导，
  该字段不要求扩展图集具有标准格式的总高度。

例如 12288×14976 的 8 位图集使用 1536×1664 单格，包含 9 行；即使字段填写 2，Dev Flow 也按扩展
规则提取九类动作。它不是 Codex 格式 2 的标准图集。源图集的 RGBA 解码预估为 702 MiB，
最大的 8 帧动作预估为 78 MiB，均在以下限制内；导入还需满足转换后 PNG 总大小限制。

## 待机活动与动作触发

菜单提供默认开启的“待机活动”开关，保存为 `idle_activities_enabled`。关闭后保留基础待机与任务动画，
停止休闲轮换、互动挥手和自动位移。“动画”总开关与系统减少动态效果仍优先，关闭动画时只显示静态帧。

服务连接正常、窗口可见且没有选定任务时进入休闲。任务完成、取消或归档后，先保持对应姿态 3 秒再休闲；
真正观察到完成时，先完整播放一次庆祝，再等待这 3 秒。首次读取已完成任务使用静态完成帧，不重播历史庆祝。
任务进行中、受阻、不可用、状态未知或服务失联时使用对应任务展示。

| 动作 | 触发规则 |
| --- | --- |
| 基础待机 | 每个短动作结束后等待随机 6–12 秒，再选择下一项。相同状态的普通轮询保持当前动作和倒计时。 |
| 向右走、向左走 | 初始权重各 25%。对应方向至少有 40 pt 空间时，水平移动 40–80 pt，速度约 20 pt/秒，持续 2–4 秒。结束后有 30% 概率接一次挥手。 |
| 挥手 | 随机权重 20%；空闲启动或重新显示、角色悬停至少 0.4 秒、拖动放下也可触发。每次播放 1–2 遍，共享 20 秒冷却。持续悬停只回应一次，离开至少 2 秒后可重新触发。 |
| Review／看电脑思考 | 随机权重 30%；空闲时随机选择 3–5 秒目标时长，播足完整遍数后回到待机。实际任务位于 `COMPREHENSION_REVIEW` 节点时持续播放，离开该节点后恢复工作动作。 |

先排除缺少素材、冷却中或空间不足的动作，再按剩余权重选择；有其他候选时避免连续重复同一动作。
未提供 review 素材的形象在审核节点使用 working。空闲思考保留原气泡文字，任务含义和跳转目标继续由 Core 状态决定。

自动散步以最后手动摆放位置为中心，水平范围为左右各 120 pt，目标距当前屏幕边缘至少 16 pt，
完整窗口保持在可见区域内。自动位移只保存在内存中，手动拖动才更新保存位置；屏幕布局变化会取消当前路线并重新约束位置。

鼠标进入宠物窗口会停止位移并暂停随机活动；只有角色区域的悬停触发挥手，气泡悬停仍用于展开信息。
按下鼠标、拖动、打开菜单或选择/导入面板时暂停休闲，左键打开 WebUI、右键打开菜单的行为保持不变。
任务受阻、完成或失联的观察结果立即中断休闲。隐藏、睡眠、关闭相关开关时取消休闲计时和位移，恢复后重新安排，
不补播被中断的动作。动作执行、短动作结束和随机等待分别由本地调度器、播放器与窗口协调，普通轮询不会反复重启动作。

## 文件要求

- 描述文件最多 256 KiB。文件路径必须为相对路径，引用普通文件；不接受符号链接或目录外引用。
- Dev Flow PNG 动画帧尺寸须与 `canvas` 一致，宽高须为正整数。静态图片和每个 PNG 帧的解码预估最多 128 MiB。
- 动作清单最多 512 个帧引用；引用的 PNG 文件总大小最多 128 MiB，以容纳九类高分辨率动作。每个动作按
  `canvas.width × canvas.height × 4 × frame_count` 估算的 RGBA 数据不超过 128 MiB，`frame_count` 为动作帧数。
- `fps` 为 0.1–120，逐帧时长为 9–60000 毫秒。循环及静态索引必须有效。
- Codex 标准图集与 Dev Flow 扩展图集的源文件最多 512 MiB，解码预估最多 1 GiB。
- 解码预估在分配像素前按图片元信息计算：`width × height × 4 × ceil(bit_depth / 8)`；`bit_depth` 为位深，支持 1–16 位，
  以四通道估算。它限制图片像素数据，不表示整个进程的内存峰值。
- 源图集满足限制后，转换结果仍须满足 PNG 总大小、动作内存和播放清单限制。
  尺寸超限、整数溢出风险或转换结果超限均以导入错误返回，已安装形象保持原样。

形象包只提供数据，不提供执行脚本。

## 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| 安装 Adapter 后没有宠物应用 | 普通包清单不包含原生应用；取得包含 `DevFlowPet.app` 的本地开发包，并按“本地构建与安装”启动。 |
| 更新程序后仍是原来的表现 | 查看运行记录中的 `executable_path`。用户目录中的应用优先且不会自动替换；程序更新与形象重导入是两步不同操作。 |
| 其他形象没有散步、挥手或思考 | 查看安装副本的 `clips` 是否包含对应附加动作。只有五类动作的形象可正常展示任务，但不能播放未提供的素材。 |
| 源图有九类，安装副本只有五类 | 确认运行的应用副本也已更新，再从包含完整图集的原始文件夹重新导入。程序只读取最近一次导入保存的帧，不会因升级自动补齐。 |
| 是否所有包都有九类、57 帧 | 该固定数量只适用于 Codex 布局图集；单张 PNG 与原生动画包按上表各自的规则处理。 |
| 一直待机或不散步 | 检查任务选择、服务连接、“动画”和“待机活动”开关、系统减少动态效果，以及素材是否有行走动作。鼠标留在窗口内或菜单／面板打开时会暂停；离开后等待 6–12 秒。某方向不足 40 pt 空间时不会向该方向走。 |
| 悬停后没有再次挥手 | 需满足休闲条件和 20 秒冷却，悬停角色至少 0.4 秒；持续停留只回应一次，移开至少 2 秒后才可重新触发。 |
| 正在聊天却没有工作动作，或没聊天却在工作 | 宠物读取所选 Dev Flow Task 的保存状态，不读取普通 Codex 对话活动或键盘输入。先检查是否选择了正确的 Task。 |
| 选择已完成任务没有跳跃 | 庆祝只在持续观察同一任务从未完成变成 DONE 时触发一次；首次读取完成任务使用静态帧，停留后可进入休闲。 |
| 图集文件没有超限，仍提示 PNG 总大小或内存超限 | 源图集和转换后的帧分别计限。WebP 转 PNG 可能增大文件；检查源图集 512 MiB、解码预估 1 GiB、转换后 PNG 总计 128 MiB，以及单动作 128 MiB 限制。 |
| 显示未连接或启动失败 | 确认平台及 Adapter 配置；已启动时可用菜单“重试连接”。显式 `pet start` 可按需启动 WebUI，后台观察只读。不要用不存在的 `pet status` 排查。 |
| 同目录的 behavior-map.json 没生效 | 当前读取 `pet.json`、图集或 `animations.json`；`behavior-map.json` 不控制帧时长或行为，使用当前支持的清单字段。 |

## 验收方式

在 macOS arm64 上执行 `swift test --package-path packages/desktop-pet/macos --filter PetAppearanceTests`：

- 标准格式 1/2 的 PNG 图集导入后保留九类动作、57 帧，单格仍为 192×208；四类附加动作的行位置、帧数和逐帧时长正确。
- 12288×14976 的扩展 PNG 图集导入后保留九类动作和 1536×1664 单格；少于九个完整动作行时拒绝导入并保留旧形象。
- 五类任务动作的原生包可正常加载，清单中无效的附加动作被拒绝。
- 转换后的 PNG 文件超过 128 MiB 时拒绝重导入，旧形象仍可加载，已保存选择保持不变。
- 超大图片头和可能导致整数溢出的画布清单被拒绝，程序返回错误。

待机调度另由 `PetActivityTests` 验证可控时间、冷却、完整动作结束、提醒抢占、位移边界和素材缺项；
`PresentationRulesTests` 覆盖审核节点选择，播放器和窗口测试覆盖实际结束回调与停止移动，偏好测试覆盖开关保存。
这些检查分别覆盖原生导入、展示规则和 AppKit 组件；实际桌面交互检查与完整 Codex/DeepSeek 任务会话结果分别记录。

实现职责见[架构说明](ARCHITECTURE.md#桌面宠物职责)，平台与分发验证范围见[支持矩阵](SUPPORT-MATRIX.md#桌面宠物功能检查)。
