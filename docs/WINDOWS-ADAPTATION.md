# Windows 适配报告

[中文](WINDOWS-ADAPTATION.md) | [English](WINDOWS-ADAPTATION_en.md)

## 范围与结论

本次完善现有 Windows 10/11 桌面 x64 实现，处理器范围是 Intel、AMD 的 x86-64。x64 不代表 32 位 x86；Windows Server、ARM64、32 位和特殊 Windows 环境不在范围内。

已修复 Windows 命令编码与 Codex 可执行文件检查缺陷，隔离已有 Host 平台交织，并完成本机 Windows 验证。所有任务状态、节点、转移、Schema 和 Git 只读边界保持现有设计；不新增工作流、兼容层、迁移或回退读取。

本次没有执行 macOS 测试。完整统一入口包按仓库既有目标表交叉编译 Mac Core 文件，但不运行 Mac 程序。macOS 的路径、权限、信号、命令和宠物安装行为按现有逻辑迁入独立实现，已有 macOS 原生组件未修改。代码结构检查支持平台隔离的判断，但不等于 macOS 运行回归证明。

## 问题与设计依据

现有三个 Node 包在同一文件中混合两套平台规则，Host 路径、权限和生命周期代码仍有具体操作系统分支。Codex 的版本和状态入口没有把 Windows 可执行文件检查策略传给 Core 预检；Windows PowerShell 的重定向输出使用本地代码页，中文输出产生乱码。Core 从桌面 Host 观察 Git 时也未显式隐藏子进程控制台。

用户此前只能依赖已有的部分 Windows 路径适配，或绕过失效的入口直接运行 Core；当前要求是在不改变 macOS 行为的前提下修正现有接口。依据来自当前源码、package manifest、CLI parser、临时 Git 工作树和实际 Windows 进程结果，而不是 Host 对完成状态的推断。

本次把平台机制交给各自实现，把唯一 Task 决策继续留在 Core。错误检查可能阻断可运行的 Windows Core，错误放行可能掩盖缺失文件，因此仍保留文件存在、类型、路径和实际执行检查，仅在 Windows 不要求 POSIX 执行位。平台选择仍只接受现有两个精确 runtime pair。

## 责任与实现

| 责任 | 修改及当前行为 |
| --- | --- |
| Core 平台中立语义 | Domain、Workflow、Application、Recovery 不加入操作系统判断；流程内容摘要与 Schema 不变 |
| Core Windows 进程 | repository 的 Git 命令调用平台配置函数；Windows 设置 HideWindow，darwin 实现为空操作，保留原行为 |
| Host 平台选择 | 三个包的 lib/platform.mjs 只选择对应实现；runtime、路径、权限、信号及清理策略分别保存在 platform/windows/ 与 platform/macos/ |
| Host 路径 | Codex/DeepSeek paths 和统一入口 ownership 使用所选策略计算产品目录；保留 Windows LocalAppData 与 macOS 用户目录规则 |
| Host 命令 | Codex 与统一入口将命令发现、Windows npm 启动器解析和调用放到对应平台目录；Windows PowerShell 明确使用 UTF-8，参数作为字面值编码传递，并保留退出码 |
| Codex 入口 | --version 与 status 向预检传入 requireExecutableMode；Windows 检查实际文件与执行结果，不要求 POSIX 执行位 |
| DeepSeek receipt | 读写权限检查消费所选 permissionPolicy，不在 receipt 代码中判断操作系统 |
| macOS 宠物 | Codex 的安装实现移入 platform/macos/pet-installer.mjs；统一入口通过平台能力选择安装器，Windows 不进入该实现 |
| 构建与安装包 | 同步三个 manifest、Codex 本地 staging 清单、仓库归档检查及相关 package 测试，包含新增平台模块 |
| Core 版本 | CORE_VERSION 按修复影响递增 PATCH，并同步两份受检机器 fixture；npm 版本与公开发布元数据不变 |

开始时已有四个未提交文件：packages/codex/lib/platform.mjs、packages/codex/lib/task-admission.mjs、packages/codex/tests/task-admission.test.mjs、packages/deepseek/tests/workspace-coordinator.test.mjs。原有 Windows Git 路径转换、中文路径测试及 Git 换行设置均已保留；平台文件中的转换函数随本次拆分移入 Windows 实现。

## 验收环境

- 日期：2026-09-07。
- 系统：Microsoft Windows 11 专业版，10.0.26200，64 位。
- CPU：13th Gen Intel Core i5-13600K。
- 工具：本地 Go 1.27.0、Node.js 24.18.0、Git for Windows、系统 Windows PowerShell 与 cmd。
- Core：从当前工作区按 windows/amd64、CGO_ENABLED=0 原生构建，版本通过 CORE_VERSION 注入；输出位于仓库外临时目录。

## 验收结果

| 检查 | 实际执行范围与结果 |
| --- | --- |
| Windows/Host 定向测试 | 20 项通过，0 失败、0 跳过；包含中文路径评估、真实临时 Git 仓库、工作树准备、失败 fetch、单次 dispatch 记录、Codex CLI 参数解析、两个 Adapter 的原生 Core 预检、hook 在 cmd/PowerShell 的调用及可恢复清理 |
| Windows WebUI 原生进程 | 1 项通过；中文空格数据目录、start、重复 start 复用 PID、HTTP 状态、status、stop、停止后重新打开 SQLite |
| Windows 验证归档 | 1 项通过；三个包分别暂存、压缩、解包，逐文件比对 manifest 所列内容，加载平台模块，执行 Codex/统一入口版本命令和 DeepSeek Core 预检 |
| Go 定向 package | internal/repository、internal/webui、cmd/dev-flow、internal/store、internal/mcp、internal/version 均通过；仅 Windows 本机执行 |
| 平台结构约束 | 3 项通过；Core 语义层无系统判断，Host 消费平台策略，两个平台目录不互相导入或重新选择操作系统 |
| 安装包元数据 | Codex manifest 闭合清单、DeepSeek manifest 闭合清单与源码归档清单检查通过 |
| 工具与版本 | npm --version 经实际 Windows 启动器成功；版本同步检查通过 |
| 文档与格式 | 35 份修改文档的 294 个本地链接检查通过；Go 格式与 git diff --check 通过 |

Windows 验证归档只包含 Windows Core，用于验证模块装配与本机运行，不是双平台正式发布安装包。没有用伪造的 macOS binary 补全归档，也没有调用独立发布流程。

## 复现方式

准备好当前 Windows Core，并设置 DEV_FLOW_WINDOWS_CORE 为其仓库外绝对路径。Go 需在当前 PowerShell 的 PATH 中。

~~~powershell
$env:DEV_FLOW_WINDOWS_CORE = "C:\verification\dev-flow.exe"
node --test packages/codex/tests/windows-support.test.mjs packages/codex/tests/windows-command.test.mjs packages/codex/tests/task-admission.test.mjs packages/codex/tests/task-launch.test.mjs packages/deepseek/tests/windows-support.test.mjs packages/deepseek/tests/workspace-coordinator.test.mjs packages/dev-flow/tests/windows-support.test.mjs
node --test packages/codex/tests/windows-webui.test.mjs packages/codex/tests/windows-package.test.mjs
go test ./internal/repository ./internal/webui ./cmd/dev-flow ./internal/store ./internal/mcp ./internal/version
go test ./tests/contract -run 'TestCoreSemanticPackagesContainNoOperatingSystemDecision|TestNodeConsumersUseClosedPlatformImplementations|TestHostPlatformImplementationsRemainSeparate'
node scripts/check-versions.mjs
~~~

测试使用临时目录和测试仓库。工作树与 branch 的创建、fetch、清理仅在测试 fixture 中执行，不改变当前项目 Git 分支、提交、Tag 或远端。真实 Codex CLI 检查只执行帮助参数解析，不创建会话。

## 验证限制与非目标

Windows 10 和 AMD 处理器属于实现目标，但本次没有相应实机，不能报告为已验证。没有执行 macOS 测试、完整 Codex/DeepSeek 用户任务会话、npm 发布、Git Tag 或 Release 操作。完整制包包含 Mac Core 的交叉编译；本机统一入口安装与独立配置下的卸载重装已实测。既有稳定支持声明不扩大。

适配范围覆盖 Windows Core、Codex/DeepSeek Adapter、统一生命周期入口、WebUI 与下述 Windows 桌面宠物。操作系统差异已在受影响表面分离；共享代码未来变化仍需各平台分别回归，不能把文件分离视为绝对无回归保证。

## Windows 桌面功能对齐

在原有平台适配基础上，Windows 已新增独立桌面宠物，覆盖 macOS 现有用户可见功能：任务选择与分页、状态与断连记录、任务更新时间与最后同步时间、WebUI 跳转、托盘和右键菜单、PNG/SVG 静态与原生动画、Codex 格式 1/2 PNG/WebP 图集及高分辨率扩展、九类动作、六档缩放、拖动、隐藏恢复、系统睡眠处理和独立启停。

Windows 实现位于 packages/desktop-pet/windows，运行时依赖仅在该目录的锁文件中维护。macOS 的 Swift/AppKit 实现与原有构建入口未修改。两个桌面实现共享素材和只读 Core 接口，不共享操作系统窗口、进程或安装逻辑。此次桌面补齐没有再修改 Core、流程图、Schema 或产品版本。

| 检查 | 实际结果 |
| --- | --- |
| Windows 桌面定向检查 | 新增 6 项通过；与前述 22 项合并回归共 28 项全部通过：Core 显示映射与断连、默认 9 类/312 帧、受限 SVG 与失败重导入保持、并发设置保存、Windows 菜单与架构选择、保留已有安装与设置；安装单元检查使用明确标注的文件 fixture |
| Windows 原生桌面 | 真实窗口与透明截图、中文气泡、六档缩放、隐藏恢复、实际 Core/WebUI 的空任务列表均通过；构造的显示状态下验证九类素材播放，未将它们当作真实 Task 完成记录 |
| 原生图集导入 | 格式 1 PNG、格式 2 WebP、高分辨率 PNG 均按九类动作提取 57 帧并切换使用；原分辨率与逐帧时长保留 |
| 原生单实例与停止 | ready、restored 确认通过；不匹配 Core 的停止请求保留当前进程；正常停止保留 WebUI、设置与导入素材 |
| 本地包 | Windows 专用构建、运行时装配、默认素材逐文件核对、归档与解包、实际桌面运行通过；未发布或全局替换用户安装 |

源码入口为 scripts/build-desktop-pet-windows.mjs，构建步骤见[桌面宠物指南](DESKTOP-PETS.md#windows-本地构建与安装)。本地构建结果与包摘要保存在输出目录的 desktop-pet-build.json，截图和原生结果保存为 desktop.png、native-result.json、lifecycle-result.json 与 cli-result.json。

鼠标拖放和真实系统睡眠/唤醒尚未进行完整人工操作验证；代码已连接对应 Windows 事件。Windows 10、AMD 实机和完整 Codex/DeepSeek Task 会话仍未验证。未进行任何 macOS 测试或构建，未扩大公开稳定支持声明。

## 统一入口实际验收

先前仅安装两个 Adapter 与手工修复注册的方式不构成本轮最终交付。当前分发包包含完整的两个 Adapter 包和 Windows 桌面程序，均由统一入口管理。

已用独立的 npm 前缀、CODEX_HOME、DSH_HOME 和产品数据目录调用真实 Codex、DSH 与 dev-flow 命令，完成 install、pet start、重复启动、宠物运行中 reinstall、doctor、uninstall 和再次 install。注册与安装没有使用手工补写。卸载后的设置保留已检查。首次宠物启动约 1.25 秒返回，重复启动约 0.69 秒返回，修复了此前依赖超时才能返回的问题。

本机真实配置随后同样使用 npm 引导统一入口，再执行 dev-flow install --host all --profile web --yes、status 和 pet start。Codex、DeepSeek web 均 ready，宠物已运行。安装器在 Windows 按目标包的实际可执行路径、命令和进程创建时间停止占用文件的 MCP 实例；这是统一流程的代码，不是手工终止步骤。

完整包不再缺少 Mac Core 文件；只做交叉编译与制包检查，没有运行 Mac 程序或 Mac 测试。本轮没有发布 npm 或修改公开稳定版本。

## 变更路径

实际修改路径如下；未提交或发布。

- `CORE_VERSION`
- `README.md`
- `README_de.md`
- `README_es.md`
- `README_fr.md`
- `README_ja.md`
- `README_ko.md`
- `README_pt-BR.md`
- `README_zh-CN.md`
- `README_zh-TW.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_en.md`
- `docs/CODEX_en.md`
- `docs/COMMANDS.md`
- `docs/COMMANDS_en.md`
- `docs/DEEPSEEK_en.md`
- `docs/DESKTOP-PETS.md`
- `docs/DESKTOP-PETS_en.md`
- `docs/PRODUCT.md`
- `docs/PRODUCT_en.md`
- `docs/SUPPORT-MATRIX.md`
- `docs/SUPPORT-MATRIX_en.md`
- `docs/TOOLCHAIN-BASELINES.md`
- `docs/WEBUI.md`
- `docs/WEBUI_en.md`
- `docs/WINDOWS-ADAPTATION.md`
- `docs/WINDOWS-ADAPTATION_en.md`
- `docs/WINDOWS-PARITY.md`
- `docs/WINDOWS-PARITY_en.md`
- `internal/README.md`
- `internal/README_en.md`
- `internal/repository/git_observer.go`
- `internal/repository/process_darwin.go`
- `internal/repository/process_windows.go`
- `internal/repository/process_windows_test.go`
- `internal/webui/assets/generated/assets/index-C550w0rZ.js`
- `internal/webui/assets/generated/assets/index-D4HxSYuq.css`
- `internal/webui/assets/generated/index.html`
- `internal/webui/assets/generated/manifest.json`
- `internal/webui/runtime_windows.go`
- `packages/codex/README.md`
- `packages/codex/bin/dev-flow-codex.mjs`
- `packages/codex/lib/command.mjs`
- `packages/codex/lib/lifecycle.mjs`
- `packages/codex/lib/paths.mjs`
- `packages/codex/lib/platform.mjs`
- `packages/codex/lib/platform/macos/command.mjs`
- `packages/codex/lib/platform/macos/pet-installer.mjs`
- `packages/codex/lib/platform/macos/policies.mjs`
- `packages/codex/lib/platform/windows/command.mjs`
- `packages/codex/lib/platform/windows/policies.mjs`
- `packages/codex/lib/task-admission.mjs`
- `packages/codex/package.json`
- `packages/codex/tests/fixtures/graph-method-profiles.json`
- `packages/codex/tests/package-contract.test.mjs`
- `packages/codex/tests/task-admission.test.mjs`
- `packages/codex/tests/task-launch.test.mjs`
- `packages/codex/tests/windows-command.test.mjs`
- `packages/codex/tests/windows-package.test.mjs`
- `packages/codex/tests/windows-webui.test.mjs`
- `packages/deepseek/README.md`
- `packages/deepseek/lib/paths.mjs`
- `packages/deepseek/lib/platform.mjs`
- `packages/deepseek/lib/platform/macos/policies.mjs`
- `packages/deepseek/lib/platform/windows/policies.mjs`
- `packages/deepseek/lib/provisioning-receipt.mjs`
- `packages/deepseek/package.json`
- `packages/deepseek/tests/package-contract.test.mjs`
- `packages/deepseek/tests/workspace-coordinator.test.mjs`
- `packages/desktop-pet/windows/appearance.cjs`
- `packages/desktop-pet/windows/decode.html`
- `packages/desktop-pet/windows/main.cjs`
- `packages/desktop-pet/windows/observation.cjs`
- `packages/desktop-pet/windows/package-lock.json`
- `packages/desktop-pet/windows/package.json`
- `packages/desktop-pet/windows/preload.cjs`
- `packages/desktop-pet/windows/storage.cjs`
- `packages/desktop-pet/windows/tests/contracts.test.cjs`
- `packages/desktop-pet/windows/tests/native.cjs`
- `packages/desktop-pet/windows/view.css`
- `packages/desktop-pet/windows/view.html`
- `packages/desktop-pet/windows/view.js`
- `packages/dev-flow/README.md`
- `packages/dev-flow/lib/cli.mjs`
- `packages/dev-flow/lib/command.mjs`
- `packages/dev-flow/lib/hosts/codex.mjs`
- `packages/dev-flow/lib/lifecycle.mjs`
- `packages/dev-flow/lib/local-packages.mjs`
- `packages/dev-flow/lib/ownership.mjs`
- `packages/dev-flow/lib/pet.mjs`
- `packages/dev-flow/lib/plan.mjs`
- `packages/dev-flow/lib/platform.mjs`
- `packages/dev-flow/lib/platform/macos/command.mjs`
- `packages/dev-flow/lib/platform/macos/maintenance.mjs`
- `packages/dev-flow/lib/platform/macos/policies.mjs`
- `packages/dev-flow/lib/platform/windows/command.mjs`
- `packages/dev-flow/lib/platform/windows/maintenance.mjs`
- `packages/dev-flow/lib/platform/windows/pet-installer.mjs`
- `packages/dev-flow/lib/platform/windows/pet.mjs`
- `packages/dev-flow/lib/platform/windows/policies.mjs`
- `packages/dev-flow/lib/presentation.mjs`
- `packages/dev-flow/package.json`
- `packages/dev-flow/tests/cli.test.mjs`
- `packages/dev-flow/tests/codex-driver.test.mjs`
- `packages/dev-flow/tests/local-packages.test.mjs`
- `packages/dev-flow/tests/package-contract.test.mjs`
- `packages/dev-flow/tests/pet.test.mjs`
- `packages/dev-flow/tests/windows-pet.test.mjs`
- `protocol/fixtures/graph-server-info.json`
- `scripts/README.md`
- `scripts/README_en.md`
- `scripts/build-codex-local.sh`
- `scripts/build-desktop-pet-windows.mjs`
- `scripts/validate-repository.sh`
- `tests/contract/platform_boundary_test.go`
