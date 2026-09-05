# Dev Flow 桌面宠物方案

[中文](plan.md) | [English](plan_en.md)

开发者可以在桌面上查看所关注 Dev Flow 任务的阶段，任务受阻或完成时看到提示，点击宠物直接进入
该任务的 Web UI。方案提供 macOS arm64 原生桌面组件，以 Codex 为主要使用场景，并支持展示
DeepSeek 的 Dev Flow 任务，复用 Core 已有的任务数据和本地服务。

交付包含完整桌面交互、任务选择与状态提示、正式宠物素材、安装与移除、双语界面、文档和实际安装包
验收。上述内容全部完成后才算交付完成。

本文是待实现方案，按 2026-09-05 的源码整理。文中的新增命令、目录和桌面行为均为设计内容；本次
交付只增加方案文档，不改变当前产品、版本或支持声明。

## 使用场景

开发者让 Codex 持续处理一个 Dev Flow 任务，随后切换到编辑器、浏览器或其他工作。任务已经进入
新阶段、遇到阻塞或完成，但开发者需要重新打开会话或 Web UI 才能发现。

## 当前做法

开发者通过 Codex / DeepSeek 会话或本地 Web UI 查看进度。Web UI 已有任务列表、详情页、流程图
和阻塞信息；详情页每两秒刷新一次，查看这些信息仍需打开页面。

Codex 的自定义宠物可以提供品牌形象。已查阅的[官方宠物说明](https://developers.openai.com/codex/pets)
介绍了外观、宿主活动和返回宿主的点击行为，没有给出插件注入 Dev Flow 状态或指定外部点击目标的
扩展方式。本方案采用自己控制窗口和点击行为的桌面组件，不依赖尚未确认的 Codex 宠物扩展接口。

## 现有数据与接口

- Core 保存任务 ID、摘要、当前节点、revision、更新时间、阻塞信息和终态；这些字段已通过本地 HTTP 接口返回。
- Web UI 支持 `/tasks/{task_id}` 详情路径，可以直接进入具体任务。
- Codex、DeepSeek 和 Web UI 共用所选数据目录中的 Core Task；宠物读取同一组接口即可展示两种工具创建的任务。
- Core 的当前节点表示最近保存的流程阶段。它不能说明 Codex 或 DeepSeek 此刻正在执行、等待输入或已经退出。
- Web UI 使用动态 loopback 端口；现有运行时检查核对进程身份、Core 身份、数据目录摘要和服务地址。

## 职责与处理规则

宠物只决定如何展示已有状态，以及用户点击后打开哪个页面。是否继续、复核、重试、阻塞或结束任务，
仍由 Core 和现有的 Codex / DeepSeek 操作流程决定。收到 `BLOCKED` 时显示“暂时受阻”和具体原因，不把所有阻塞
都解释为“等待用户批准”。

这个功能的价值是让用户更早发现需要关注的任务，并减少寻找对应页面的步骤。接入过程使用已有
Task 和本地接口，不增加新的流程节点，也不要求开发者为了宠物增加工作步骤。

## 交互效果

宠物以小窗口停留在桌面角落，上方常驻两行信息，例如“登录改造 / 测试验证”。悬停展开最近更新时间
和阻塞原因；单击打开当前任务详情，拖动调整位置，右键菜单提供任务切换、打开任务列表、隐藏和退出。
隐藏后可从菜单栏入口恢复。

宠物关注一个任务。其他任务通过列表选择，选定后保持关注对象；宠物不会跟随其他任务的每次更新跳来跳去。

## 风险与影响

把旧信息显示成实时执行状态，可能让用户误以为任务仍在推进；遗漏阻塞提示，会延迟用户处理。
打开错误任务或旧服务地址，则会让用户在错误任务页面中操作。因此展示中区分任务更新时间和连接状态，
跳转前重新确认本地服务身份，操作任务的界面继续由 Web UI 提供。

## 验收方式

以下是完整实现的验收要求，本次文档交付没有执行这些测试。

| 场景 | 通过条件 | 验证方式 |
| --- | --- | --- |
| 日常桌面使用 | 宠物可见、可拖动；更新不抢键盘焦点；隐藏后能恢复；退出后没有残留窗口 | macOS arm64 原生桌面检查 |
| 阶段变化 | 普通节点前进或回退后显示 Core 当前值；阶段不换算为百分比，也不推断 Codex 或 DeepSeek 正在运行 | 展示逻辑测试，并在实际 Codex 中完成任务流程 |
| 共用任务数据 | Codex 与 DeepSeek 创建的任务都可选择、更新和跳转；使用同一套展示规则 | 以 Codex 完整任务流程为主，并在实际 DeepSeek 中验证任务读取与跳转 |
| 阻塞与终态 | 展示当前阻塞原因；仅观察到所关注任务进入 `DONE` 时庆祝一次；`CANCELLED` 不庆祝 | 状态样例测试和实际任务的状态变化 |
| 点击跳转 | 动态端口变化后仍打开正确任务；身份不符或服务不可用时不打开旧地址 | 运行时集成测试，加浏览器实际打开检查 |
| 任务切换 | 快速从 A 切到 B 后，A 的迟到响应不覆盖 B；列表支持现有分页 | HTTP 客户端定向测试 |
| 数据与连接异常 | 服务停止、任务不存在或归档时明确显示对应结果；恢复连接不重放完成动画 | 故障注入和原生服务启停检查 |
| 启停边界 | 重复启动只有一个宠物；停止宠物保留 Web UI、Codex / DeepSeek 会话和任务；状态查询不创建产品数据 | 启动器测试和 macOS 进程检查 |
| 最终安装包 | 从实际 npm tarball 解包安装后可启动和退出；应用签名、资源、执行权限与包内容一致 | 安装包检查，并在 macOS 上验证安装后的完整操作流程 |

## 非目标

- 桌面组件的平台范围为 macOS arm64；Windows、Linux、Intel Mac 和跨机器桌面组件不属于本方案，Dev Flow 已有平台能力保持原范围。
- 不控制 Codex 内置宠物，不读取 Codex 私有会话数据库，也不监听 Codex 或 DeepSeek 的内部事件。
- 不在宠物中提交 Action、解除 blocker、批准测试、创建任务或执行 Git 操作。
- 不新增 Core 节点、转换、MCP 工具、Task 字段、SQLite 布局或历史数据处理分支。
- 不提供全量任务后台监控、预计剩余时间、全局完成百分比，也不判断 Codex 或 DeepSeek 是否正在执行。
- 不做登录自启、云同步、语音、养成系统、插件化皮肤市场或独立自动更新器。

## 桌面交互和状态展示

### 任务阶段与连接状态分别显示

普通节点沿用 Web UI 的中英文名称，包括 `REQUIREMENTS`、`DESIGN`、`TASKS`、`IMPLEMENT`、`TEST`、
`COMPREHENSION_REVIEW`、`REFACTOR` 和 `DELIVERY`。这些名称只用于展示，不在桌面端复制节点顺序、
合法转换或完成条件。节点回退时直接显示新的当前节点。

| 接口返回或读取结果 | 气泡内容与动作 |
| --- | --- |
| 普通流程节点 | 任务简称和节点名称；使用轻微工作主题动画，文案只描述阶段 |
| `BLOCKED` | “暂时受阻”；展开显示 Core 的 `blocker`，点击进入详情 |
| `DONE` | “已完成”；连续在线观察到该任务由非终态进入 `DONE` 时短暂庆祝，随后静止 |
| `CANCELLED` | “已取消”；保持静态 |
| 详情标为只读 | 保留阶段，增加“当前仅可查看”提示；详情页面决定可用操作 |
| 没有选择任务 | “选择一个任务”；单击打开任务列表 |
| 所选任务已归档或不存在 | 明确显示“已归档”或“任务已不可用”，由用户切换；不存在时单击进入任务列表 |
| 请求失败或服务身份不符 | 显示“未连接”；旧信息标为“上次记录”，停止工作与庆祝动画 |

启动、切换任务和断线重连后的第一次成功读取只建立当前画面，不播放历史完成动画。后续提示根据
同一任务连续观察到的变化触发；普通 revision 增加不重复触发完成或阻塞动画。

`updated_at` 显示“任务更新于”；客户端记录的成功读取时间显示“最近同步”。前者长时间不变，
不能据此判断 Codex 或 DeepSeek 断线。Core 没有提供已完成检查数量时，也不把测试预算消耗显示为完成比例。

### 选择关注对象

启动时恢复当前 `data_root_digest` 下保存的任务 ID，并直接读取该任务。没有保存的选择时，先从
`lifecycle=blocked` 的第一页选最近更新的任务，再尝试 `lifecycle=active`；两者为空则保持待机。
已保存的任务不可用时展示该结果，不悄悄替换为另一个任务。

任务选择面板使用 `GET /api/tasks?page=...`，展示任务简称、来源工具、阶段和仓库提示，按 `has_next`
加载下一页。当前接口每页最多返回 50 条，默认排除归档任务。切换面板打开时读取，后台不遍历所有
任务，也不显示无法完整计算的“全部待处理任务数”。

选定任务后，即使它完成也继续显示该任务，便于点击查看结果。另一任务受阻不会改变当前关注对象。
“当前任务”始终指用户选定的 Dev Flow Task，不推断 Codex 当前前台会话。

### 点击、窗口和动画

单击宠物打开关注任务，拖动结束不触发跳转。气泡展开和周期更新不抢焦点；任务选择面板仅在用户
打开后接收键盘输入。窗口保持紧凑，避免用大面积透明窗口覆盖其他应用。

右键与菜单栏提供同一组入口：选择任务、打开任务列表、重新连接、启动本地服务、设置、隐藏/显示、退出。
“重新连接”只检查已经运行的服务；“启动本地服务”显式调用已有启动能力。隐藏时停止动画和任务
轮询，重新显示后立即刷新。设置提供跟随系统/简体中文/英文语言选择和动画开关。记录窗口位置；
显示器移除后将窗口放回仍可见的屏幕区域。

交付一个 Dev Flow 原创形象，以及待机、普通阶段、受阻、完成和未连接的完整姿态与透明背景素材。
形象应延续现有 Dev Flow 图标的色彩和线条特征，并在气泡、菜单栏和设置入口保持一致。正式素材
必须检查透明边缘、不同缩放下的清晰度及动画切换；占位图不能作为最终交付。

动画按状态按需播放，支持关闭动画，并遵循系统减少动态效果设置。全屏应用、多桌面和多显示器的
实际窗口表现须在交付前完成原生验证，并写清支持行为。

## 技术方案和职责

### macOS 桌面实现

采用 Swift + AppKit：`NSPanel` 承载宠物与气泡，`NSStatusItem` 提供菜单栏入口，
`LSUIElement` 用于后台应用的 Dock 行为。HTTP 使用系统客户端，详情页交给默认浏览器。Apple 提供了
这些基础能力；交付前需验证它们在本产品中的焦点、窗口层级和屏幕切换组合。
参见 [NSPanel](https://developer.apple.com/documentation/appkit/nspanel)、
[NSStatusItem](https://developer.apple.com/documentation/appkit/nsstatusitem) 和
[LSUIElement](https://developer.apple.com/documentation/bundleresources/information-property-list/lsuielement)。

原生实现对应一个小窗口、少量菜单和 HTTP 读取。Swift 构建与 macOS 签名属于交付工作；系统窗口、
进程和路径行为由 macOS 实现负责，Core 保持平台无关的任务语义。

### 职责划分

| 位置 | 负责的行为 |
| --- | --- |
| 现有 Go Core | Task、流程、revision、阻塞和终态；本方案复用现有行为 |
| 现有本地 Web UI 服务 | 读取任务，提供运行状态与浏览器页面；保持已有 HTTP 和 mutation 检查 |
| 统一启动器 | 选择并校验已安装 Core，确定数据目录，启动桌面组件，分派新增宠物命令 |
| 桌面应用的读取与展示模块 | 获取当前接口结果，选择关注对象，生成气泡文案与动画提示 |
| macOS 实现 | 窗口、鼠标、菜单栏、打开浏览器、单实例、进程身份及本地设置文件 |
| 构建与发布代码 | 编译、资源装配、签名、公证、npm 包内容检查和最终安装包验证 |

这些职责可以由少量直接模块完成。任务的数据模型只表示接口返回的数据；动画选择放在展示模块，进程与
路径逻辑放在 macOS 实现，避免把运行行为放入常量或配置对象。

## 连接 Core 和打开 Web UI

### 启动流程

1. 用户通过统一启动器开启宠物。启动器复用 `resolveCoreRuntime` 和现有路径规则，选出
   Core 可执行文件与数据目录，不额外寻找相邻仓库或直接打开 SQLite。
2. 使用所选 Core 执行现有 `webui status --json`。只有服务确实未运行时，在本次显式启动中调用
   `webui start --no-open --json`；遇到身份冲突或当前数据不可读时返回具体错误。
3. 读取返回的 `core_identity`、`data_root_digest`、`url` 和 `pid`，确认服务响应后再启动桌面窗口。
   默认数据目录的创建沿用 Web UI start 规则；显式 `DEV_FLOW_DATA_DIR` 仍必须已经存在且满足当前校验。
4. 启动器以固定参数传入已确认的 Core 路径、数据目录和身份。桌面应用重连时调用这一 Core 的
   `webui status --json`，复用 receipt 和进程检查，不自行解析 runtime receipt 或计算另一套目录摘要。

### 数据读取

数据读取使用现有 `GET /api/system/status`、`GET /api/tasks` 和 `GET /api/tasks/{task_id}`。
成功状态必须对应同一个 Core、数据目录和当前 loopback 地址；HTTP 请求限制在确认后的
`http://127.0.0.1:<port>` origin，不跟随重定向，也不使用任务文本拼接主机名。

宠物显示期间每五秒读取一次所选任务；一次请求完成或失败后再安排下一次，HTTP 超时为三秒。
切换任务、重新显示或系统唤醒时立即刷新。每次新连接分配一个序号，读取请求关联该序号和任务 ID；旧连接或旧任务的响应返回后
直接丢弃。revision 用于识别任务变化；只读、归档和连接提示也按实际响应更新。

请求失败后立即标记未连接，并每十五秒检查一次服务状态；服务自行恢复后重新取得地址。用户显式
停止 Web UI 后，宠物不会在后台反复启动它。Core 可执行文件缺失或身份变化时提示重新开启宠物，
由启动器重新选择运行时。

现有详情接口返回内容较多，轮询限定为所选任务，任务列表仅按需读取。验收记录响应体大小和读取
耗时，确认周期读取不会堆积请求或明显干扰桌面使用。本方案沿用现有接口，不新增 SSE、WebSocket
或轮询专用接口。

### 点击跳转

点击时重新取得并检查运行状态，将合法任务 ID 编码为一个路径段，构造
`<origin>/tasks/<encoded_task_id>`。未选择任务或任务不存在时打开 `<origin>/tasks`。
Core 的静态页面处理和前端路由已支持直接进入详情，不需要新增深链接协议。

服务未连接时先在气泡中显示结果，用户可通过菜单重新连接或启动服务。打开浏览器失败时保留任务
画面并允许重试。宠物只发起查询；进入 Web UI 后的用户操作继续走现有页面的 Origin、session 和
revision 校验。

## 启停管理、设置与打包

组件随 `@imotong/dev-flow` 统一入口提供。Codex 插件继续通过该入口安装与管理；仅安装
`dev-flow-codex` 的用户如需宠物，再安装统一入口。应用只打包一份，不分别放入 Codex 和 DeepSeek
Adapter，也不直接复制到 Codex 的自定义宠物目录。

以下为拟新增命令，当前命令解析器尚未实现：

| 拟新增入口 | 行为 |
| --- | --- |
| `dev-flow pet start` | 用户显式开启宠物，必要时启动本地服务；已有同目录实例时恢复显示 |
| `dev-flow pet status` | 查询宠物进程及连接状态；即使 Adapter 已移除也可查询；不创建目录或启动服务 |
| `dev-flow pet stop` | 只停止当前用户、身份匹配的宠物；已经停止时成功返回 |

三项入口提供 `--plain` 和 `--json`；普通启动无需输入任务 ID，任务选择在宠物内完成。`dev-flow`
交互菜单同时提供“桌面宠物”的开启、查看状态和关闭入口。子命令与菜单调用同一套编排，由统一
启动器分派，不能原样传给 Go Core。安装后由用户开启宠物。

macOS 实现为每个用户维护一个实例。重复启动同一数据目录时复用它；另一数据目录的启动返回当前
实例正在使用的目录，用户先退出再切换。单实例锁和运行记录只记录进程 ID、启动身份、应用路径与
所选数据目录身份，不保存流程位置。停止前验证进程和可执行文件身份，禁止按名称批量结束进程。

本地设置放在现有 `productRoot` 下的 `pet/settings.json`，保存位置、语言、动画偏好，以及绑定
`data_root_digest` 的关注任务 ID。应用路径由启动器传入；Task 状态仅作内存快照，设置文件
不保存节点、Action、终态或另一份任务历史。

退出或停止宠物保留共享 Web UI、Codex / DeepSeek 会话和任务。Adapter 卸载导致服务停止时，宠物显示未连接；
更新或卸载提供宠物的统一入口前，按文档先停止宠物。普通卸载保留设置；显式 factory-reset 对
产品目录的既有清理流程覆盖该设置目录，并在清理前停止宠物，不能由宠物自行执行数据清理。

## 预计改动位置

以下是实现阶段的目标位置，本次不创建其中的代码或生成文件。

| 路径 | 实现阶段改动 |
| --- | --- |
| `packages/desktop-pet/macos/`（新增） | Swift 应用、AppKit 窗口、HTTP 读取、展示与设置、原生测试及素材 |
| `packages/dev-flow/lib/pet.mjs`（新增） | 宠物命令参数、Core 选择和启动编排；复用现有 runtime/path 模块 |
| `packages/dev-flow/bin/dev-flow.mjs`、`packages/dev-flow/lib/runtime.mjs` | 分派宠物入口并更新帮助；现有 Core 选择规则继续共用 |
| `packages/dev-flow/lib/cli.mjs`、`packages/dev-flow/lib/presentation.mjs` | 交互菜单中的宠物入口、中英文说明与结果展示 |
| `packages/dev-flow/lib/lifecycle.mjs` | 在显式 reset 清理产品目录前停止身份匹配的宠物 |
| `packages/dev-flow/package.json`、`packages/dev-flow/tests/` | 包文件清单，命令、生命周期和最终包的定向检查 |
| `packages/dev-flow/runtime/darwin-arm64/DevFlowPet.app/`（生成） | 由统一入口携带的最终原生应用；资源在构建时装入 |
| `scripts/build-desktop-pet.mjs`（新增）、`release/prepare.mjs` 及相关安装包构建要求 | 编译、装配及验证；正式发布仍使用独立 release 流程 |

Core 的 `internal/domain/`、`internal/workflow/`、`internal/store/`、MCP payload 和当前持久 Schema
没有计划改动。流程定义及其内容摘要、节点和允许的节点转换均保持当前实现；宠物不提交状态
转换。因此按本方案实现不要求修改 `CORE_VERSION`。若实施中确需改变实际交付的 Core 或其公开
接口规范，应先说明新增需求，再按仓库规则更新 Core 版本及调用该接口的组件。

### 实现时同步的文档

本次提案只写入 `specs/017-desktop-pet/plan.md` 和 `plan_en.md`。功能实现后再同步下列当前产品文档，
使新增能力、命令和平台说明与最终安装包一致：

- 九个根入口：`README.md`、`README_zh-CN.md`、`README_zh-TW.md`、`README_ja.md`、`README_ko.md`、
  `README_es.md`、`README_fr.md`、`README_de.md`、`README_pt-BR.md`。
- 产品与架构：`docs/PRODUCT.md`、`docs/PRODUCT_en.md`、`docs/ARCHITECTURE.md`、`docs/ARCHITECTURE_en.md`。
- 命令与页面：`docs/COMMANDS.md`、`docs/COMMANDS_en.md`、`docs/WEBUI.md`、`docs/WEBUI_en.md`。
- 支持与编程工具使用：`docs/SUPPORT-MATRIX.md`、`docs/SUPPORT-MATRIX_en.md`、`docs/CODEX_en.md`、`docs/DEEPSEEK_en.md`。
- 安装与包说明：`packages/dev-flow/README.md`、`packages/codex/README.md`、`packages/deepseek/README.md`。

若实现改变其他文档中相同的命令或支持陈述，再同步对应中英文文件。Codex 和 DeepSeek 的中文
使用说明分别位于对应 package README，与 `docs/CODEX_en.md`、`docs/DEEPSEEK_en.md` 配对维护。

## 实施与完成标准

实施按依赖关系安排工作，最终交付同一套完整功能：

1. 完成 Swift 应用、窗口、菜单栏和启动器接入，连通真实 Core，补齐焦点、拖动、隐藏、唤醒、
   单实例和不同屏幕环境下的行为。确定并验证最低 macOS 与 Xcode/Swift 构建环境。
2. 完成任务选择、稳定轮询、阶段展示、受阻/完成提示、断线与本地设置。界面文案区分任务状态与
   连接状态，Codex 和 DeepSeek 使用相同读取与展示逻辑。
3. 完成正式形象、全部必要动画和中英文界面，检查缩放、透明边缘、减少动态效果及菜单入口。
4. 在实际 Codex 中验证任务推进、受阻、恢复、完成的完整流程；验证 DeepSeek 原生任务的选择、状态
   更新和跳转。记录常驻资源消耗、响应体与耗时，完成验收表中的异常与生命周期检查。
5. 完成 tarball 构建、签名、公证和包内容检查，从实际安装包验证启动、退出、移除和 reset 顺序，
   同步所有受影响的产品文档。签名与公证配置必须在实施中核验并准备就绪。

完成标准是：正式素材与全部交互可用、两种工具创建的任务验收通过、生命周期操作完整、最终安装包可
安装运行、签名与资源检查通过、文档同步完成。任一项未完成时，交付状态保持未完成。

本次方案文档不附带在实际 macOS 上运行的结果、资源测量或已签名安装包。Apple 的分发流程参见
[Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)。

开发验证与正式发布分别进行。功能完成不自动执行 npm 发布、Tag 或 GitHub Release；发布时仍由用户
明确选择产品、channel、精确版本与确认，再执行该产品的独立发布命令。

## 相关实现

以下链接对应本方案复用的当前实现，相关入口与字段已按本文日期核对。

- [运行时选择与 Web UI 转发](../../packages/dev-flow/lib/runtime.mjs)：`resolveCoreRuntime`、`runDevFlow`。
- [公共入口分派](../../packages/dev-flow/bin/dev-flow.mjs)与[路径解析](../../packages/dev-flow/lib/ownership.mjs)。
- [Core 命令与 JSON 输出](../../cmd/dev-flow/main.go)：`runWebUI`、`writeRuntimeState`。
- [Web UI 运行状态](../../internal/webui/runtime.go)与[进程记录](../../internal/webui/receipt.go)。
- [HTTP 路由](../../internal/webui/server.go)与[读取投影](../../internal/webui/read_handlers.go)。
- [任务读取](../../internal/application/control_center_read.go)与[分页、排序和归档过滤](../../internal/store/control_center_read.go)。
- [详情路径](../../packages/webui/src/app/router.tsx)、[静态页面入口](../../internal/webui/static.go)、
  [详情轮询](../../packages/webui/src/pages/TaskDetailPage.tsx)与[阶段名称](../../packages/webui/src/lib/i18n.tsx)。
- [统一入口包清单](../../packages/dev-flow/package.json)、[包检查](../../packages/dev-flow/tests/package-contract.test.mjs)
  与[独立发布说明](../../release/dev-flow/README.md)。
