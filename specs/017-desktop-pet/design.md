# 桌面宠物技术设计

[中文](design.md) | [English](design_en.md)

本设计实现[桌面宠物方案](plan.md)：统一入口取得可用 Adapter 的 Core，启动包内的原生应用，应用通过
现有 HTTP 接口展示所选任务。原生应用及素材随统一入口更新，Task 和流程规则继续由 Core 负责。
本文中的新文件、参数和测试入口均为实现目标，当前尚未交付。

## 职责与改动位置

| 位置 | 职责及改动 |
| --- | --- |
| `packages/dev-flow/bin/dev-flow.mjs` | 将 `pet` 分派给宠物编排，保持已有 lifecycle/WebUI 分派 |
| `packages/dev-flow/lib/pet.mjs`（新增） | 解析开启/关闭请求，复用 `resolveCoreRuntime`，协调 WebUI 与原生启动 |
| `packages/dev-flow/lib/cli.mjs`、`presentation.mjs`、`runtime.mjs` | 交互菜单、双语结果与帮助；宠物命令由启动器处理 |
| `packages/dev-flow/lib/platform/macos/pet.mjs`（新增） | 定位包内应用、以参数数组启动原生入口、处理启动确认与退出结果 |
| `packages/desktop-pet/macos/`（新增） | Swift Package；AppKit 窗口、菜单、HTTP 客户端、展示、动画、原生进程管理、偏好和测试 |
| `packages/dev-flow/lib/lifecycle.mjs`、`plan.mjs`、`ownership.mjs` | 维护所选 Adapter 前停止宠物；将宠物目录纳入已确认 reset 计划和清理目标 |
| `scripts/build-desktop-pet.mjs`（新增） | 编译、资源装配、签名公证与应用检查；输出到显式暂存目录 |
| `scripts/release-dev-flow.mjs`、`packages/dev-flow/package.json` 及包测试 | 把已检查的应用放入统一入口 staging，再打包及回读 |
| 现有 `internal/webui/`、`internal/application/`、`internal/store/` | 复用任务与运行状态读取，按当前接口执行 |

Swift 实现按窗口、读取、展示/动画、进程和偏好划分少量直接模块。接口数据模型只解码响应；动画触发
由展示模块决定；macOS 进程和文件操作集中在原生进程模块。Node 的 macOS 模块负责调用它，不再实现
一套进程身份算法。平台选择在启动器边界完成，Core 不增加操作系统分支。

统一入口原有 Windows x64 支持保留。Windows 菜单不显示宠物入口，直接调用宠物命令返回不支持平台；
不加载 macOS 原生应用，也不改变其他命令行为。

## 用户命令

新增的公开语法为 `dev-flow pet start` 和 `dev-flow pet stop`，无任务 ID 或其他参数；总帮助列出这两项。
子命令和交互菜单调用相同编排。输出为无 ANSI 的简短文本：成功写 stdout，失败写 stderr。
退出码为成功 `0`、安装/平台/连接/进程失败 `1`、参数错误 `2`。

宠物没有 `status`、`--json` 或独立状态查询接口。Core 的 `webui ... --json` 仍是内部复用接口，
与宠物的用户命令分开。关闭只负责结束已有宠物，清理过程不以重新找到 Adapter 为前提，也不启动服务。

## 开启与原生启动约定

1. 启动器先检查平台，再调用现有 `resolveCoreRuntime`，启用 `initializeDefaultData`。
   现有函数先验证 Adapter 候选，再按已有规则准备默认目录。显式 `DEV_FLOW_DATA_DIR` 必须已存在；
   无可用 Adapter 时返回安装提示，不创建宠物窗口或自动安装依赖。
2. 使用选定的可执行文件，以 `DEV_FLOW_DATA_DIR` 指定数据目录，调用 `webui status --json`。
   正常运行时直接使用结果；`unavailable` 时，本次显式开启可调用 `webui start --no-open --json`。
   命令失败或 `incompatible` 时显示错误并停止。仅有本地只读存储、没有可连接服务时不激活宠物。
3. 对返回的 `core_identity`、`data_root_digest`、`url` 和 `pid` 做类型校验，并读取
   `GET /api/system/status` 确认相同身份与地址。实际可读取的 `read_only` 服务可展示只读结果。
4. 启动包内应用。原生入口以参数数组接收以下私有参数，路径均为启动器已解析的绝对路径。
   首次成功建立窗口后返回启动确认，启动器随即结束；桌面进程继续运行。

| 私有入口/参数 | 含义 |
| --- | --- |
| `run` | 开启窗口，或恢复相同运行时与数据目录的现有实例 |
| `--core-path` | 选定 Adapter 提供的 Core 可执行文件 |
| `--data-dir` | 当前数据目录 |
| `--product-root` | 当前用户产品目录，用于宠物运行记录和偏好 |
| `--core-identity` | 已核对的 Core 身份 |
| `--data-root-digest` | Core 返回的数据目录身份 |
| `stop --product-root <path>` | 原生内部关闭入口；不创建窗口 |
| 关闭入口的 `--core-path <path>` | Adapter 维护时只停止使用该 Core 的实例 |

原生启动确认只使用一行 `ready` 或 `restored`，不返回 Task、连接快照或另一套可查询状态。
首次启动失败写 stderr；原生入口在窗口和运行记录就绪后才写确认。启动器最多等待 10 秒，超时
返回失败；重复操作仍经过单实例检查。确认后关闭启动通信通道，日常日志使用系统日志。

原生应用再次调用同一个 Core 的 status 核对身份，避免使用启动期间已失效的结果。直接双击包内应用
且缺少启动参数时，提示从 Dev Flow 入口开启并退出。该约定表达产品依赖，不是同用户进程之间的认证机制。

## 单实例与退出

macOS 原生模块使用 `productRoot/pet/instance.lock` 的进程持有锁，保证同一用户只有一个实例。
窗口就绪后原子写入 `runtime.json`，记录 `pid`、`process_start_identity`、`executable_path`、
`core_path`、`core_identity`、`data_root_digest`。启动身份来自操作系统的实际进程创建信息。

锁已被占用时，核对运行记录与实际进程。同一 Core 和数据目录通过内部 `SIGUSR1` 通知原生主线程
恢复窗口，返回 `restored`；Core 或数据目录不同则提示先关闭再开启。信号只表达显示操作，不携带
Task 或连接状态。过期记录仅在确认没有匹配进程及持有锁后移除，不按 PID 或应用名称单独判断身份。

关闭核对当前用户、进程启动身份和可执行文件，再发送 `SIGTERM`，最多等待 5 秒。原生主线程取消
请求、停止动画、保存偏好、关闭窗口和菜单栏入口、移除自己的运行记录并释放锁。超时返回失败并保留
运行记录，阻止依赖它的卸载或 reset 继续；普通关闭不自动强杀、不停止 WebUI。无实例时直接成功。

## Core 与 HTTP 读取

当前 Core JSON 输出由 [writeRuntimeState](../../cmd/dev-flow/main.go) 生成，字段在顶层：
`operation`、`readiness`、`core_identity`、`data_root_digest`、`url`、`pid`。
进程返回失败时不保证 stdout 有 JSON，客户端同时检查退出码和输出。单次 Core 调用最多等待 10 秒。

HTTP 使用系统 `URLSession`。只访问已确认的 `http://127.0.0.1:<port>` origin，禁用重定向，
单次 HTTP 超时为 3 秒。任务文本按纯文本显示，任务 ID 作为一个编码后的路径段使用。

| 接口与字段 | 桌面用途 |
| --- | --- |
| `GET /api/system/status` 的 `readiness/core_identity/data_root_digest/url` | 确认当前连接；与所选 Core 输出一致 |
| `GET /api/tasks` 的 `items/page/has_next` | 任务选择、默认关注对象和分页 |
| 详情 `summary.task_id/request_summary/current_node/revision/updated_at` | 关注对象、阶段、变化识别及任务更新时间 |
| `summary.origin_host/repository_keys/worktree_path` | 来源工具和仓库提示；不推断当前前台会话 |
| `summary.blocker` | Core 已提供的可读阻塞说明；缺失时显示通用受阻文案 |
| `summary.archived`、详情 `readiness` | 归档和只读提示 |

列表及详情使用当前 [TaskSummary 和 TaskDetailResponse](../../internal/webui/types.go)。
阻塞文本已经由 [summarizeDetail](../../internal/webui/read_handlers.go) 提供，不为显示原因解析整个
`blocker.value` JSON，也不在桌面端复制 blocker 分类规则。未使用的响应字段无需建立桌面模型。

### 轮询与请求归属

- 显示时每次请求结束后等待 5 秒，再读取所选任务；没有选择时只检查服务，不扫描全部任务。
- 列表仅在打开或翻页时读取，使用当前 `page`、`lifecycle`、`has_next` 规则。
- 切换、显示或系统唤醒时立即刷新。连接代次、任务 ID 和列表请求代次约束响应归属；过期响应丢弃。
- 隐藏时取消请求、计时器和动画；显示时重新建立观察。唤醒、重连和切换均清空上一轮提示触发依据。
- 网络失败后立即进入未连接，每 15 秒使用同一 Core 的 status 检查服务，恢复后取得新地址。
  后台检查只读；用户点击“重试连接”时可显式调用同一 Core 的 start，然后重新核对。
- Core 路径缺失或身份变化时退出宠物并提示重新开启。外部 Adapter 变动在既有检查中处理，
  不增加安装目录监听器或运行中的自动 Core 切换。

HTTP 404 表示所选任务不可用，不等同于整个服务断线。成功响应中的 `archived=true` 单独显示归档。
其他失败显示请求结果并转入连接检查；对当前数据错误不新增迁移或兼容读取。

### 展示优先级与动画触发

依次处理连接不可用、无选择、任务不存在、任务归档，再处理当前节点；只读是附加标记。
终态即使未归档也保留关注对象。归档和不存在停止阶段动画，使用相应静态姿态。

同一任务连续成功读取时，以当前节点和阻塞文本比较变化。只有从非终态进入 `DONE` 才触发完成动画；
进入 `BLOCKED` 或阻塞文本变化时播放受阻提示，随后保持其轻微循环。普通 revision 增加不重播提示。
提示是内存中的展示事件，不写入 Core 或偏好。节点和连接文案立即更新，动作转场按动画规格完成。

## 点击跳转

点击前执行当前 Core 的 status 并再次核对服务。服务不可用时显示连接提示；成功时将选中任务 ID
编码为一个路径段，交给 macOS 默认浏览器打开 `<origin>/tasks/<encoded_task_id>`。无选择或任务
不存在时打开 `<origin>/tasks`；已归档任务仍可进入其详情。

浏览器打开失败保留画面，允许再次点击。后台刷新不打开浏览器；任务选择、拖动或展开气泡不提交 Task
操作。页面上的修改继续使用 WebUI 自己的 Origin、session 和 revision 检查。

## 偏好与 Adapter 生命周期

偏好存放在 `productRoot/pet/settings.json`：

| 字段 | 内容 |
| --- | --- |
| `position` | 窗口在屏幕坐标中的 `x`、`y`；屏幕变化后限制在可见区域 |
| `animations_enabled` | 用户菜单中的动画开关，默认开启；系统减少动态效果具有优先级 |
| `selected_tasks` | 以 `data_root_digest` 为键、任务 ID 为值的关注对象 |
| `selected_appearance` | 当前形象 ID；未设置时使用内置形象 |

语言在运行时读取系统偏好，不保存语言配置。Task 节点、Action、终态和历史不写入设置。
宠物目录使用当前用户私有权限，JSON 使用原子写入；不存在时采用默认偏好，不创建旧格式读取分支。

统一 lifecycle 在已确认操作即将改变所选 Adapter 前，调用按 `core_path` 过滤的原生关闭入口。
尚未确认的预览、只读 status/doctor、对其他 Adapter 的维护不停止宠物。更新或卸载统一入口本身前，
用户先通过宠物关闭入口退出；普通 npm 安装不自动开启宠物。

factory-reset 的观察结果、计划摘要、确认内容和实际清理目标都增加存在的 `productRoot/pet`。
这个目录是 `productRoot/data` 的同级目录，`executeCleanup` 已将其列为独立清理目标。复用已有
Trash/永久删除方式及精确授权；停止成功后才清理，保留明确的数据目录授权边界。

## 构建、签名与 npm 分发

当前实施范围按用户的功能优先要求调整：提供 macOS arm64 本地构建、应用装配和统一入口 tarball，
开发包使用 ad-hoc 签名进行本机功能检查。以下 Developer ID、公证、公开发布和最低系统验证要求属于
正式分发条件，本次不执行这些操作，也不将本地开发包声明为正式分发包。

Swift Package 提供应用可执行目标和定向测试；AppKit、Foundation 与系统网络客户端承担运行时能力。
T01 根据所用 API 核验最低 macOS 和 Xcode/Swift 支持范围，并写入构建配置及验收环境记录。
这些最低版本尚未由原生运行验证，本文不将开发机版本直接宣称为最低支持版本。

应用在最终 npm 包中的固定位置为：

```text
runtime/darwin-arm64/DevFlowPet.app/
  Contents/
    Info.plist
    MacOS/DevFlowPet
    Resources/
      Assets/
      animations.json
      zh-Hans.lproj/
      en.lproj/
```

`Info.plist` 设置稳定 bundle identifier、`LSUIElement` 和经核验的最低系统版本。
应用版本从统一入口 package metadata 生成，宠物不另设产品版本。素材规格和 `animations.json`
字段见[界面与动画规格](ui-design.md#素材交付)。

构建流程按以下顺序执行：

1. 在 macOS arm64 构建环境编译 Swift，装配正式素材、语言资源与应用 metadata。
2. 在仓库外 staging 完成 Developer ID 签名，使用 Apple 公证流程提交应用归档，附加公证票据。
   开发构建可用于调试，不能替代最终签名包的验收。
3. 将完整应用加入统一入口 staging，按 package 文件清单打出 npm tarball。
4. 从 tarball 解包并安装到隔离前缀，检查资源清单、可执行权限、代码签名、公证票据和实际启动。
   签名后不改动应用资源；打包后的实际内容通过检查才可进入发布。
5. 正式发布从同一已检查的应用制备最终 tarball，并沿用现有摘要、注册表回读与发布恢复规则。

当前统一入口在 [scripts/release-dev-flow.mjs](../../scripts/release-dev-flow.mjs) 的 `prepare` 中
直接执行 npm 打包。新增应用构建应接入这条链路及其固定包检查，并让本地包验证复用相同装配逻辑。
`release/prepare.mjs` 当前用于 Codex/DeepSeek 包，不是本功能的统一入口打包位置。

签名身份、公证凭据引用和可用构建机在 T01 核验；密钥不写入仓库或验收日志。
Apple 的[分发说明](https://developer.apple.com/documentation/xcode/packaging-mac-software-for-distribution)
和[公证流程](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
用于落实这部分。npm 的 tarball 不是直接提交给 Apple 的公证容器；应用先通过受支持的归档格式公证，
再随 npm 分发。

本需求新增构建和包检查，不执行公开发布。发布选择、固定检查、Tag、npm 和 GitHub Release 仍由既有
独立发布流程负责。当前 Core 的流程定义、内容摘要、节点、完整出边、Schema 和 MCP 投影保持原样。

## 当前本地构建入口

`node scripts/build-desktop-pet.mjs --output <absolute-directory>` 从现有 Swift Package 和素材源生成
本地统一入口 tarball。源码 package manifest 保留 JS 文件清单；构建时在 staging manifest 加入唯一的
`runtime/darwin-arm64/DevFlowPet.app`。复用 `scripts/dev-flow-local.mjs` 的 USTAR 工具保留原生执行权限，
解包后核对可执行文件、语言资源、素材与 ad-hoc 签名。安装包运行不依赖仓库文件。
正式发布脚本仍保持原状；此本地开发入口没有公证和公开发布操作。


用户形象保存到 `productRoot/pet/appearances/<id>`。`PetAppearanceStore` 负责受限文件读取、导入校验和
替换；`CodexPetImporter` 只在导入时拆分标准图集；`PetAppearanceSelection` 负责资源加载成功与选择保存
的一致性；`PetCharacterView` 负责统一播放。偏好增加 `selected_appearance`，与按数据目录保存的
`selected_tasks` 独立；偏好更新在同一锁内完成，写入失败保留原值。切换释放旧帧，直接显示当前状态，
不重新播放旧提示。形象格式见 [DESKTOP-PETS](../../docs/DESKTOP-PETS.md)。
