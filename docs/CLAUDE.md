# Claude Code 使用指南

[中文](CLAUDE.md) | [English](CLAUDE_en.md)

本指南说明如何安装 Dev Flow 的 Claude Code 集成，开始或恢复任务，以及维护、移除安装。公开包与源码的可用范围见[支持矩阵](SUPPORT-MATRIX.md)。

## 选择安装方式

Claude Adapter 目前通过源码或本地开发包体验。它需要 Node.js `>=24`、Git 和 Claude Code `>=2.1.270`。开始开发任务前，按 Claude Code 自身的提示完成登录。目标平台为 Windows x64 和 macOS arm64；实际验证范围以支持矩阵为准。

### 从仓库源码安装

此方式还需要 Go `>=1.26`、pnpm `>=11 <12`，并须在仓库根目录执行命令。开发环境配置见[贡献指南](../CONTRIBUTING_zh-CN.md)。

```sh
pnpm dev-flow:local -- install --host claude --yes
```

该命令构建本地安装包，用临时管理器安装 Claude Adapter。它不会升级机器上已有的全局 `dev-flow` 命令。安装完成后，仍在仓库根目录检查：

```sh
node packages/dev-flow/bin/dev-flow.mjs status --host claude
node packages/dev-flow/bin/dev-flow.mjs doctor --host claude
```

### 安装已经构建好的 Adapter 包

如果维护者提供了本地 `.tgz`，不需要自行编译 Go。将占位路径替换成实际包路径：

```sh
npm install --global "<dev-flow-claude包路径.tgz>"
dev-flow-claude setup --json
dev-flow-claude status --json
```

这个包提供 `dev-flow-claude`，不包含全局 `dev-flow` 管理器或桌面宠物。完整 Windows 开发包的安装方式见[桌面宠物指南](DESKTOP-PETS.md)；源码打包命令供维护者在[脚本说明](../scripts/README.md)中查阅。

## 验证安装

安装器会将插件注册到 Claude 用户范围。插件名为 `dev-flow-claude`，来自 `dev-flow-claude-local` 市场。重载 Claude 插件或开始新会话，按 Claude 的提示审阅插件和权限。

`dev-flow-claude status --json` 的 `status` 应为 `ready`。若为 `partial`，先查看安装器输出及诊断结果，不要开始新的 Dev Flow 任务。`ready` 表示安装检查通过，不表示 Claude 已登录或开发任务已经完成。

## 开始任务

进入要修改的代码仓库，在 Claude 对话中发送：

```text
/dev-flow-claude:dev-flow 为登录接口增加失败限流，只修改认证相关文件。
```

Claude 会先评估请求并让你选择直接开发或 Dev Flow。选择 Dev Flow 后，默认在当前目录新建分支；也可以指定使用当前分支或独立工作树。请明确分支名，以及已有未提交修改是否属于这项任务。独立工作树还需确认来源、起始分支和目标目录。

一项任务最多包含八个明确选择的仓库。全部仓库准备好后才创建任务。实现前，查看并确认需求、设计、工作项、预计文件和验证安排；计划或文件范围改变后，需要确认更新后的方案。

如需 OpenSpec 或 Spec Kit，在请求中明确提出；否则使用普通开发方式。未安装的方法工具应先处理其缺失问题，不能把工具缺失当成工作完成。

## 恢复、取消与清理

回到任务原来的工作目录和 Claude 会话，发送：

```text
/dev-flow-claude:dev-flow 继续之前保存的任务，先说明当前状态和剩余工作。
```

若启动失败、操作结果不明或工作目录被替换，保留原始错误和会话信息，让 Claude 检查已有记录。不要为了重试而重新创建任务、删除工作树或清空数据。

取消任务时，明确发送“取消当前 Dev Flow 任务，并保留文件”。任务取消或完成后，文件和分支仍然保留。需要清理独立工作树或分支时分别提出；不要将退出 Claude 当成取消任务。

需要移动工作目录时，先要求 Claude 迁移当前任务。仅全部采用独立工作树的任务支持这项操作；本地目录模式应在原目录恢复。移动未完成时，按返回的恢复说明处理原目录和目标目录。

## 文件范围与权限

可信的写入检查会核对 Claude 的 Write、Edit 和 NotebookEdit 操作。计划外文件会要求你选择允许该次操作、调整计划或恢复文件。允许某个路径不会取消 Claude 自身的权限要求。

Shell 或外部程序的修改可能先发生，再被任务检查发现。不要换一种工具绕过已经拒绝的写入。

## 查看进度与维护

源码安装用户在仓库根目录使用同一源码入口：

```sh
node packages/dev-flow/bin/dev-flow.mjs webui start
node packages/dev-flow/bin/dev-flow.mjs webui stop
pnpm dev-flow:local -- repair --host claude --yes
```

WebUI 可以筛选 Claude Code 任务并查看其保存状态。源码维护命令会重新构建本地包；不要用旧版全局 CLI 的 `latest` 安装路径代替它。若使用的是包含当前管理器的完整开发包，则使用该包提供的 `dev-flow` 命令。

宠物另外需要安装桌面应用，不能仅凭 Adapter 的 `ready` 状态判断宠物可用。安装与操作见[桌面宠物指南](DESKTOP-PETS.md)。

## 移除与数据

先结束相关 Claude 会话；如果启用了 WebUI，使用启动它的管理入口停止服务。源码安装用户可以执行：

```sh
node packages/dev-flow/bin/dev-flow.mjs uninstall --host claude --yes
```

只有 Adapter 包、没有源码管理器时：

```sh
dev-flow-claude remove --json
npm uninstall --global dev-flow-claude
```

普通维护和卸载保留任务数据与无关的 Claude 设置。清空数据使用管理器的 `factory-reset`，须确认它列出的准确目录；普通卸载不需要这样做。

`CLAUDE_CONFIG_DIR` 可以指定 Claude 设置目录。`DEV_FLOW_DATA_DIR` 可以指定已有的规范绝对数据目录，启动 Claude 和管理命令时必须保持一致。默认任务数据位于 macOS 的 `~/.dev-flow/data` 或 Windows 的 `%LOCALAPPDATA%\dev-flow\data`。

更多命令见[命令参考](COMMANDS.md)，已执行检查和未验证项目见[项目状态](PROJECT-STATUS.md)。
