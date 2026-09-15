# Claude Code 使用指南

[中文](CLAUDE.md) | [English](CLAUDE_en.md)

Claude Code Adapter 在本机使用同一 Go Core 保存任务状态。它提供请求评估、完整计划确认、文件范围与验证控制、任务恢复、多仓库和工作区生命周期。当前为源码能力，尚未发布；真实 Claude 会话及各平台原生验收结果不能由静态检查代替。

## 安装与维护

需要 Node.js >=24、Git 和本机 Claude Code >=2.1.270；开发构建还需要仓库贡献指南规定的 Go、pnpm。目标运行时为 macOS arm64 与 Windows x64。安装前自行完成 Claude 认证；Adapter 不保存认证凭据。

```sh
pnpm dev-flow:local -- install --host claude --yes
node packages/dev-flow/bin/dev-flow.mjs status --host claude
node packages/dev-flow/bin/dev-flow.mjs doctor --host claude
```

统一入口支持 install、upgrade、repair、reinstall、uninstall、factory-reset。尚未发布时使用本地构建产物维护，不从 npm 请求不存在的稳定 Claude 包。直接打包：

```sh
node scripts/build-claude-local.mjs --output <绝对输出目录>
```

插件注册到 Claude 用户范围的 dev-flow-claude-local 市场，插件为 dev-flow-claude。安装后重载插件或开始新会话，并按 Claude 提示审阅权限。用户设置目录使用 CLAUDE_CONFIG_DIR；DEV_FLOW_DATA_DIR 指定已有的规范绝对数据目录，MCP、Hook 与助手必须一致。默认数据目录在 macOS 为 ~/.dev-flow/data，在 Windows 为本地 AppData 下的 dev-flow/data。

## 开始与恢复

在 Claude 对话中发送：

```text
/dev-flow-claude:dev-flow 为登录接口增加失败限流，只修改认证相关文件。
```

先查看只读评估并选择直接开发或 Dev Flow。默认在原目录新建任务分支；还可以使用当前分支或独立工作树。确认分支、已有修改归属；独立工作树同时确认本地或远端来源、起始分支和目标目录。最多八个仓库共同组成一个固定任务范围。所有仓库准备完成才创建 Core Task。

完整需求、设计、工作项、文件范围和验证安排需明确确认。计划变更会使旧确认失效。Core 管理全部节点、验证预算、阻塞与恢复；Claude 的本地待办完成不代表 Core Task 已结束。plain、spec-kit、openspec 使用现有方法规则；缺少方法工具时如实说明。

恢复时回到原工作区和已保存的 Claude 会话，明确继续同一任务。启动失败时读取保留的 launch 和会话记录；结果不确定不能重复启动或重建工作树。原目录被替换或分支改变时按 Core 恢复指示处理。需求交接保留原始相关讨论及更正。

## 文件与任务生命周期

可信 PreToolUse Hook 检查 Write、Edit、NotebookEdit；Core 决定当前计划是否允许目标。放行不会绕过 Claude 自身权限。Bash 和外部工具的修改由后续 Core 观察发现，不能用来规避已拒绝的写入。

取消、放弃和恢复通过 Core 当前工具执行。独立工作区迁移先由 Core 准备，再由 Host 移动所有仓库，最后由 Core 核对新绑定。部分失败保留现场。DONE/CANCELLED 释放占用，不自动提交、发布或删除。工作树与分支分别授权清理；原目录模式保留目录和分支。

## 查看进度与诊断

```sh
dev-flow webui start
dev-flow pet start
dev-flow-claude status --json
```

WebUI 可按 Claude Code 筛选任务并打开原任务；桌面宠物复用 Core 的任务发现与状态。状态只表示已保存的 Core 结果。

工具故障先保留完整输出，再查看 [命令参考](COMMANDS.md) 和 [支持矩阵](SUPPORT-MATRIX.md)。模拟 Hook/CLI 测试、最终包检查、真实 Claude 会话和 macOS/Windows 原生结果分别记录，未完成项仍是验收缺口。

