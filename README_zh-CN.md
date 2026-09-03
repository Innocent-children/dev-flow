<h1 align="center">Dev Flow</h1>

<p align="center"><strong>让长时间运行的 AI 编程任务守住你定下的改动范围和测试上限，并在继续前知道当前结果是否可信。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 当一个代码任务开始失控

假设你对 Agent 说：

```text
增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

任务比预期更久。Agent 想顺手改一份相邻配置，定向测试一直失败，会话又在剩余检查完成前重启。
这时，光看聊天记录很难回答几个关键问题：额外文件真的属于这次需求吗？还能跑多少测试？再试一次
会有新信息吗？之前通过的检查还适用于现在的代码吗？

Dev Flow 把这些决定和任务放在一起。Agent 仍然负责读代码、改文件和跑命令；Dev Flow 让扩大范围、
增加测试、重复尝试和最终交付变成看得见、需要明确决定的事情，而不是任务悄悄变大。

## 使用后有什么不同

| 直接使用 Agent | 使用 Dev Flow |
| --- | --- |
| 文件范围只写在提示词里 | 计划会记住预计文件；受支持的计划外写入先暂停，让你决定 |
| “只跑定向测试”可能逐渐变成开放式测试 | 自动检查有固定上限，完整测试需要提前允许 |
| 同一个失败容易触发下一轮相似修改 | 第三次完全重复时暂停，要求换思路或明确同意继续 |
| 会话重启后靠残缺聊天重建进度 | 新会话继续同一个任务、同一组限制和剩余检查 |
| 代码改了，旧的测试通过仍可能被沿用 | 与当前代码不再匹配的结果会在交付前作废 |

## 最值得关注的地方

### 任务不会悄悄扩大

每项工作都会记下预计修改的文件和需要完成的检查。受支持的结构化工具要写计划外文件时，会在
写入前暂停；你可以只允许这一次、修改计划或拒绝。进入测试和完成任务之前，还会再次核对实际
改过的路径，包括没有经过写前检查的工具产生的路径。

### 重试必须带来新信息

Dev Flow 会比较最近三次测试尝试。只有同一个失败检查、完整结果，或“修改同一批文件后仍得到
同一失败”连续完全重复时才会暂停。需求、计划或实现发生变化后，旧测试和旧的人工确认也会失效，
不能拿昨天的绿灯批准今天的代码。

### 中断后继续，不靠猜，也不盲目重试

请求、计划、当前进度、检查记录和阻塞原因保存在本机，不只存在聊天里。新会话可以继续同一个
任务。如果一次 Dev Flow 操作没有返回明确结果，集成会先读取已保存的操作和当前仓库，再判断
是否可以安全重试。

### 交付由开发者决定

测试通过是必要条件，但不是全部。交付前，开发者还要看过实际改动、不必要的复杂度和维护风险，
并明确确认自己能够解释和维护结果。之后代码再变，就要重新测试。

### 在本机看清整个任务

当前源码包含本机 Control Center，可以查看 Codex 与 DeepSeek 共用的任务、当前进度、计划路径与
实际路径、检查历史、重复尝试暂停和下一步决定。它读取同一份本机数据，不是云端看板，也不会
另外保存一套任务状态。

## 快速开始

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow 增加登录失败限流。只改认证相关文件，最多运行 4 项定向检查。
/dev-flow 增加登录失败限流。只改认证相关文件，最多运行 4 项定向检查。
```

安装、状态、恢复和移除方式见 [Codex 使用说明](packages/codex/README.md)、
[DeepSeek 使用说明](packages/deepseek/README.md)和[命令参考](docs/COMMANDS.md)。

## 适合与不适合

Dev Flow 适合会跨会话、需要明确文件边界、必须限制测试投入、可能返工，或需要在交付前完成清楚
交接的真实仓库任务。

一次性问答、代码解释、状态查询和无需保存进度的机械性小改动，直接使用 Codex 或 DeepSeek 通常
更简单。Dev Flow 不是通用项目管理工具、远程执行服务或安全沙箱。

## 当前真正可用的范围

### 稳定 npm `@latest`

| 产品 | 已验证环境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

稳定记录覆盖 package 安装、就绪检查、移除、卸载和目标仓库不变性。DeepSeek 的稳定 Journey 还
覆盖明确触发、重启、完成任务和重新打开已保留的数据。

### 当前源码与公开记录

- 当前源码包含本机 WebUI、文件范围决定、自动重复刹车，以及精确的 `darwin-arm64` 和 `win32-x64` runtime。
- Windows 目前只是源码能力：已有 Windows 11 本机记录，但还没有稳定 `@latest` Host Journey。
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) 记录了一次真实 Codex Journey，覆盖重启、
  重构、重新测试、开发者理解确认、交付和完成。

这些记录各自只说明自己的范围，不能合并成“一次运行证明全部能力”。

### 尚未证明或尚未稳定

- 外部使用数据尚未证明 Dev Flow 能降低测试成本、缺陷率或维护成本。
- 外部采用和长期重复使用记录仍然有限。
- Linux、Windows Server、Windows 32 位与 ARM64、Intel Mac、Rosetta 和 remote MCP 没有稳定支持声明。
- 团队视图、云端同步、Task 导出和明确的跨 Host 交接仍是未来工作。

## 边界

- Go Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish。
- 文件修改和命令执行仍由用户授权的 Codex 或 DeepSeek 完成。
- 写前检查只覆盖列出的结构化工具。Bash 和外部工具可能先写入，因此 Dev Flow 不是 shell 或文件系统沙箱。
- WebUI 只在本机 loopback 运行，面向单用户，不提供远程访问或团队权限。
- 稳定支持只以[支持矩阵](docs/SUPPORT-MATRIX.md)为准。

## 文档

- [产品定义](docs/PRODUCT.md) · [演示](docs/DEMO.md) · [项目状态](docs/PROJECT-STATUS.md) · [路线图](docs/ROADMAP.md)
- [架构](docs/ARCHITECTURE.md) · [命令](docs/COMMANDS.md) · [WebUI](docs/WEBUI.md) · [支持矩阵](docs/SUPPORT-MATRIX.md)
- [安全策略](SECURITY.md) · [威胁模型](docs/THREAT-MODEL.md) · [文档职责](MANIFEST.md) · [贡献指南](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)
