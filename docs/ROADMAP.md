# Dev Flow 发展路线

路线图描述当前源码能力和真正的未来方向。历史实施材料保留在 Git 历史中，不在当前源码树
维护文档合同副本。

## 当前源码：Development Process Graph

当前源码已经实现：

- 内建 `standard-development`，11 个节点和 29 条正常流转；
- `TaskIntent`、versioned requirements/design/task-plan baselines 和 authority invalidation；
- TEST、COMPREHENSION_REVIEW、REFACTOR 与受控回退循环；
- `plain`、`spec-kit`、`openspec` method profiles；
- current Core contract 六工具与 closed graph payload；
- Fresh current SQLite format、strict strict current snapshot 和无历史任务兼容的零写入拒绝；
- 五分类 graph-native recovery、CAS、BLOCKED/resume、restart 和 retained data；
- Codex explicit-only Adapter、Skill 和 method-profile renderer。

Feature 008 的准确状态为：

```text
Feature 008: Complete
Implementation: Complete
Native graph-flow acceptance: Complete
Exact-artifact lifecycle acceptance: Complete
Composite local acceptance: Complete
    Publication: dev-flow-codex@0.4.0 complete
    Selected release: dev-flow-codex@0.4.0 / macOS arm64
```

最终 source-local 门禁使用同一精确 artifact 的两个互补证据组件：Attempt 3 的 native Codex
graph-flow evidence，以及不启动 Codex 的 deterministic exact-artifact lifecycle evidence。前者
保留 runner 在 native sessions 完成后的真实失败状态，后者独立证明 setup/remove/uninstall/
reinstall/retained reopen。最终 repository validation 首次通过，analyze 无阻塞发现，converge
为零 gap。

Feature 完成不代表 released、published、ready for merge 或 production available from npm。

## 已完成：Final Feature Gate

1. Attempt 3 的四个真实 Codex session 离线重验通过，Core 到达 `DONE`；
2. 同一精确 source-local artifact 的 deterministic lifecycle 完成同一 lifecycle Task 的
   remove/uninstall/reinstall/terminal reopen；
3. 唯一一次最终 `RELEASE_BASE_SHA=... pnpm run validate` 首次通过；
4. 最终 Spec Kit analyze 无阻塞发现，converge 零 gap；
5. T001–T112 和 SC-001–SC-025 全部完成。

该门禁未执行 npm publication、Tag、GitHub Release 或 public installation claim。

## 已完成：Feature 009 Release Change

Feature 009 已批准以下 Codex-only 发布工作：

- 使用版本 `0.4.0`；
- 对齐 `VERSION`、package、plugin 和 bundled Core identity；
- 从一个 reviewed clean source identity 构建 official artifact；
- 执行 npm publication 和 registry read-back；
- 创建精确 Git Tag 和 GitHub Release；
- 上传、回读并验证 official assets；
- 使用最终分发制品完成要求的 native Journey；
- 形成与真实证据一致的 macOS arm64 Codex public installation claim；
- 使用一条 exact-confirmation 命令编排完整发布并支持精确恢复。

Feature 008 的 source-local acceptance artifact 继续作为冻结测试证据；Feature 009 从新的干净
`main` source identity 构建 official `0.4.0` artifact，不复用或改写该历史制品。

当前公开 Codex 产品版本为 `0.5.0`；npm `dev-flow-codex@0.5.0`、Tag `v0.5.0` 和 GitHub
Release `v0.5.0` 使用同一 source identity。Feature 009 仍只记录 `0.4.0` 历史发布，不被改写。

## 已完成：Feature 010 DeepSeek Explicit Graph Host

Feature 010 从当前 current Core contract、current SQLite format 和 `standard-development` 基线实现独立的
DeepSeek source-local 产品。它在正式实现前冻结 DSH rc.8、显式 `/dev-flow` 授权、六工具、
生命周期、数据保留和证据合同，并已完成精确 Artifact 的 source-local Native Acceptance。
Feature 完成不选择公开 DeepSeek 版本，也不执行 npm、Tag 或 GitHub Release 操作。

## 未来产品方向

只有真实使用证明价值并建立独立规格后，才考虑：

- 新平台或架构的最终制品；
- 只读 doctor 和任务检查；
- 有明确用户授权的跨 Host handoff；
- verification budget 或 shared contract 的下一次版本化修订；
- DeepSeek 产品的独立公开发布；
- 供应链签名、notarization 或透明度证据。

用户自定义 graph、workflow DSL、Web UI、remote MCP、generic shell、Core Git mutation、
multi-repository 和自动历史任务迁移不属于当前路线。
