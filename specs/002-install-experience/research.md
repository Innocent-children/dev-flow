# Research: Codex Setup 安装展示

## Decision 1: 展示点固定为 `dev-flow-codex setup`

**Decision**: rich/plain/JSON 都由 setup 命令输出；`mcp`、remove、`--version` 与普通 Task 不展示。

**Rationale**: setup 是现有安全交互入口。MCP 使用 STDIO 协议，任何横幅都会破坏传输。

**Alternatives considered**: npm hook、首个 Task、MCP 启动展示。它们缺少现成可靠入口或破坏协议。

## Decision 2: 配置创建发生在 registration mutation 前

**Decision**: Host setup 创建或验证配置，Core loader 保持只读。

**Rationale**: 配置失败可在 Codex registration 零变化时停止；安装副作用不进入 Core runtime。

**Alternatives considered**: Core 启动创建、配置 CLI。它们扩大运行时或命令面。

## Decision 3: 复用现有 receipt，不增加展示状态

**Decision**: existing receipt 只提供本次 created/updated/null 事实，receipt closed schema 不变。

**Rationale**: setup 已区分 fresh、upgrade、already-installed；没有“未来首个界面只显示一次”的需求。

**Alternatives considered**: presentation identity、独立 receipt、写入现有 receipt。均无必要。

## Decision 4: 只报告配置与 registration receipt

**Decision**: 文件摘要限于 setup 能直接证明的两个文件。

**Rationale**: npm 与 Codex CLI cache 由外部工具管理，没有闭合文件清单。扫描 HOME 会越界并误报。

## Decision 5: 品牌化信息设计

采用的一手参考：

- [Angular Schematics CLI](https://github.com/angular/angular-cli/blob/master/packages/angular_devkit/schematics_cli/bin/schematics.ts)：按真实 CREATE/UPDATE 事件输出文件；
- [Bun installer](https://github.com/oven-sh/bun/blob/main/src/cli/install.sh)：成功事实、实际位置和少量下一步；
- [Starship installer](https://github.com/starship/starship/blob/master/install/install.sh)：短状态卡与终端降级；
- [Oh My Zsh installer](https://github.com/ohmyzsh/ohmyzsh/blob/master/tools/install.sh)：鲜明品牌与 TTY 能力检测；
- [Astro create CLI](https://github.com/withastro/astro/tree/main/packages/create-astro)：品牌化交互与 fancy/简化模式；
- [Vite create CLI](https://github.com/vitejs/vite/blob/main/packages/create-vite/src/index.ts)：完成后聚焦一个可执行下一步。

**Decision**: Dev Flow 使用自有 5～8 行标题/状态卡、真实文件动作和唯一 next step。不复制第三方
Logo、ASCII 标志、吉祥物、口号、配色或主题文案，不增加人为延时。

## Decision 6: 事实模型先于 renderer

**Decision**: setup 先构造 success facts，再投影 rich/plain/JSON；renderer 不参与 mutation。

**Rationale**: 语言和终端能力不会改变文件事实，机器输出与交互结果保持一致。
