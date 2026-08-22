# Dev Flow 贡献指南

[中文](CONTRIBUTING.md) | [English](CONTRIBUTING_en.md)

感谢你愿意改进 Dev Flow。这个项目欢迎可复现的缺陷、文档修正、经过最终制品验证的平台支持，
以及围绕真实开发问题提出的有界产品改进。

## 提交前先判断变更类型

| 变更 | 需要什么 |
| --- | --- |
| 拼写、链接、表达或现有行为说明修正 | 可以直接提交有界 Pull Request；同步维护对应中英文文档 |
| Constitution、AGENTS、模板或文档治理变化 | 说明治理影响；不修改产品版本，不执行发布 |
| 不改变公共语义的实现缺陷 | 说明已批准合同与实际行为的偏差，并只修复该偏差 |
| 用户可见行为、Core/MCP 合同、持久化、状态图或 Host Adapter 合同变化 | 先建立完整 Product Feature，并按 [Spec Kit 工作流](docs/SPEC-KIT-WORKFLOW.md) 完成规格与分析 |
| 版本提升、npm、Tag 或 GitHub Release | 不作为普通 Pull Request 的交付步骤；由维护者在功能合并后使用独立发布流程执行 |

不确定变更属于哪一类时，先提交 Issue，描述用户问题、当前行为和期望结果。不要先实现一个较大
方案，再要求规格接受已经完成的代码。

## 提交 Issue

缺陷报告请尽量包含：

- 使用的产品与版本，例如 Core、`dev-flow-codex` 或 `dev-flow-deepseek`；
- 操作系统、CPU、Node.js 与 Host 版本；
- 最小复现步骤；
- 预期结果与实际结果；
- 已去除密钥、路径隐私和个人数据的日志或错误输出；
- 问题是否涉及安装、显式触发、Task 流转、Recovery、数据目录或卸载。

产品提案请先说明用户遇到的具体问题、现有流程为什么无法解决、如何判断改进有效。实现方案可以
讨论，但不要把某个技术方案直接当成需求。

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

开始修改前，请阅读 [`AGENTS.md`](AGENTS.md)、
[Constitution](.specify/memory/constitution.md) 和与变更直接相关的文档。产品行为变更还必须显式
选择对应 Feature；不要根据分支名称或最近编辑的目录推断活动 Feature。

## 实施原则

- 只解决 Pull Request 明确描述的问题，不顺带加入未来能力、通用框架或无关重构；
- Go Core 继续独占 Task、节点、合法流转、恢复分类和终态权威；
- Core 只读观察 Git，不增加 shell、commit、push、merge、tag 或发布能力；
- 只运行与改动表面、验收条件或已知风险直接相关的验证；
- 用户可见文档存在中英文配对时，同时更新两份；
- 不直接修改 `.agents/skills/` 下的生成文件；
- 不在普通功能或文档 Pull Request 中提升版本或执行发布。

## 验证

文档改动至少检查：

- Markdown 在 GitHub 上可以正常渲染；
- 相对链接、代码块和 Mermaid 语法没有明显错误；
- 中英文内容表达同一产品事实；
- 没有扩大当前 [支持矩阵](docs/SUPPORT-MATRIX.md) 的声明。

代码改动优先运行受影响 package、节点、合同或用户故事的定向检查。完整仓库验证只在变更合同
要求的最终检查点运行：

```bash
pnpm run validate
```

不要为了“更放心”反复运行完整套件，也不要把模拟、静态检查或用户手工结果描述成真实 Host
最终制品证据。

## Pull Request 要求

从最新 `main` 创建分支，并在 Pull Request 中写清楚：

1. 当前问题；
2. 本次实际修改；
3. 明确未修改的范围；
4. 执行过的验证及结果；
5. 若属于 Product Feature，对应的 Feature、要求或合同引用。

建议使用简洁的 Conventional Commit 风格，例如：

```text
docs: clarify contributor workflow
fix(store): reject invalid snapshot before writable open
```

Pull Request 应保持可独立审查。若同一分支同时包含文档重写、产品行为变化、无关重构和版本发布，
请拆分为不同变更。

## 发布边界

合并产品工作不等于立即发布。Core、Codex 和 DeepSeek 独立版本化；维护者会在变更合并后，
根据实际 diff 选择 `quick` 或 `normal` 发布模式，再执行版本对齐、构建、回读、Tag、npm 和
GitHub Release。普通贡献者无需修改产品版本或生成公开制品。

提交 Pull Request 即表示你同意你的贡献按照本仓库的
[Apache License 2.0](LICENSE) 提供。
