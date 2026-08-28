# Dev Flow 贡献指南

[中文](CONTRIBUTING.md) | [English](CONTRIBUTING_en.md)

Dev Flow 接受可复现的缺陷、文档修正、经过最终制品验证的平台支持，以及围绕真实开发问题提出的
有界产品改进。

## 变更分类

| 变更 | 要求 |
| --- | --- |
| 拼写、链接、翻译或现有行为说明修正 | 可以直接提交有界 Pull Request；按照 [I18n 策略](docs/I18N.md) 同步该文档族的全部维护 locale |
| 模板或文档维护规则变化 | 说明影响范围；不修改产品版本，不执行发布 |
| 不改变公共语义的实现缺陷 | 说明已批准合同与实际行为的偏差，并只修复该偏差 |
| 用户可见行为、Core/MCP 合同、持久化、状态图或 Host Adapter 合同变化 | 在 Pull Request 中说明用户问题、范围、验收条件和方案，并同步实现、测试、文档与 i18n |
| 版本提升、npm、Tag 或 GitHub Release | 不作为普通 Pull Request 的交付步骤；由维护者在功能合并后使用独立发布流程执行 |

分类不明确时，先提交 Issue，描述用户问题、当前行为和预期结果。不要先实现较大方案，再要求规格
接受已经完成的代码。

## 提交 Issue

缺陷报告请尽量包含：

- 使用的产品与版本，例如 Core、`dev-flow-codex` 或 `dev-flow-deepseek`；
- 操作系统、CPU、Node.js 与 Host 版本；
- 最小复现步骤；
- 预期结果与实际结果；
- 已去除密钥、私有路径和个人数据的日志或错误输出；
- 问题是否涉及安装、显式触发、Task 流转、Recovery、数据目录或卸载。

产品提案应先说明具体用户问题、当前流程为什么无法解决，以及如何判断改进有效。实现方案可以讨论，
但不能直接替代需求定义。

## 本地环境

仓库开发需要：

- Go `>=1.26`；
- Node.js `>=24`；
- pnpm `>=11 <12`。

先在 GitHub Fork 本仓库，再从自己的 Fork 创建分支：

```bash
git clone https://github.com/<your-account>/dev-flow.git
cd dev-flow
git remote add upstream https://github.com/Innocent-children/dev-flow.git
git fetch upstream
git checkout -b <type>/<short-description> upstream/main
pnpm install --frozen-lockfile
```

开始修改前，请阅读 [I18n 策略](docs/I18N.md)、[命令参考](docs/COMMANDS.md) 和与变更直接
相关的文档。

## 实施原则

- 只解决 Pull Request 明确描述的问题，不加入未来能力、通用框架或无关重构；
- Go Core 继续独占 Task、节点、合法流转、恢复分类和终态权威；
- Core 只读观察 Git，不增加 shell、commit、push、merge、tag 或发布能力；
- 只运行与改动表面、验收条件或已知风险直接相关的验证；
- 改变用户可见行为时，必须同步更新全部根 README locale、`docs/PRODUCT*` 和受影响的技术文档；
- 文档修正必须同步该文档族的所有维护语言；
- 新增或修改命令时，对照 package manifest、CLI parser、DSH lifecycle、Core parser 或 MCP catalog，并同步 `docs/COMMANDS*`；
- 面向用户的 npm 安装示例使用 `@latest`，人类阅读文档不记录精确产品版本；
- 不在普通功能或文档 Pull Request 中提升版本或执行发布。

## 验证

文档改动至少检查：

- Markdown、表格、代码块和 Mermaid 在 GitHub 上正常渲染；
- 语言导航中的所有文件存在且互相可达；
- 同一文档族的章节结构、命令、平台和支持声明一致；
- 所有普通安装示例使用 `@latest`，精确产品版本只存在于机器可读文件和发布记录；
- `docs/COMMANDS*` 与实际可执行 command/tool catalog 一致；
- 非英文文件没有占位翻译或整段英文 fallback；
- 没有扩大当前 [支持矩阵](docs/SUPPORT-MATRIX.md) 的声明。

代码改动优先运行受影响 package、节点、合同或用户故事的定向检查。完整仓库验证只在变更合同要求
的最终检查点运行：

```bash
pnpm run validate
```

不要反复运行完整套件作为泛化保险，也不要把模拟、静态检查或用户手工结果描述为真实 Host 最终
制品证据。

## Pull Request 要求

从最新 `main` 创建分支，并在 Pull Request 中说明：

1. 当前问题；
2. 本次实际修改；
3. 明确未修改的范围；
4. 执行过的验证及结果；
5. 验收条件及对应的测试或合同；
6. 修改的文档族和已同步的 locale；
7. 命令或安装文档所对应的实现来源。

建议使用简洁的 Conventional Commit 风格，例如：

```text
docs: synchronize README locales
fix(store): reject invalid snapshot before writable open
```

Pull Request 应保持可独立审查。文档重写、产品行为变化、无关重构和版本发布应拆分为不同变更。

## 发布边界

合并产品工作不等于立即发布。Core、Codex 和 DeepSeek 独立版本化；维护者会在变更合并后根据
实际 diff 选择 `quick` 或 `normal` 发布模式，再执行版本对齐、构建、回读、Tag、npm 和 GitHub
Release。公开版本、平台或安装命令变化也必须在发布前同步全部维护 locale。

提交 Pull Request 即表示你同意你的贡献按照本仓库的
[Apache License 2.0](LICENSE) 提供。
