# Dev Flow 发展路线

路线图描述当前源码能力、尚未完成的 Feature 门禁和真正的未来方向。已经完成的 Features
001–007 与公开 `0.3.0` 保留为历史证据，不在这里重述实施流水账。

## 当前源码：Development Process Graph

**规格**：[`008-refactor-to-development-process-graph`](../specs/008-refactor-to-development-process-graph/README.md)

Feature 008 当前源码已经实现：

- 内建 `standard-development@1`，11 个节点和 29 条正常流转；
- `TaskIntent`、versioned requirements/design/task-plan baselines 和 authority invalidation；
- TEST、COMPREHENSION_REVIEW、REFACTOR 与受控回退循环；
- `plain`、`spec-kit`、`openspec` method profiles；
- Core Contract 0.2 六工具与 closed graph payload；
- Fresh Schema 2、strict snapshot-v2 和无历史任务兼容的零写入拒绝；
- 五分类 graph-native recovery、CAS、BLOCKED/resume、restart 和 retained data；
- Codex explicit-only Adapter、Skill 和 method-profile renderer。

Feature 008 的准确状态为：

```text
Feature 008: Complete
Implementation: Complete
Native graph-flow acceptance: Complete
Exact-artifact lifecycle acceptance: Complete
Composite local acceptance: Complete
Publication: Not performed
Separate Release Change: Required
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

## Feature 008 之后：独立 Release Change

公开图产品必须由单独批准的 Release Feature/PR 完成：

- 选择发布版本；
- 对齐 `VERSION`、package、plugin 和 bundled Core identity；
- 从一个 reviewed clean source identity 构建 official artifact；
- 执行 npm publication 和 registry read-back；
- 创建精确 Git Tag 和 GitHub Release；
- 上传、回读并验证 official assets；
- 使用最终分发制品完成要求的 native Journey；
- 形成与真实证据一致的 platform/Host/public installation claim。

当前 Feature 不预选发布版本，也不把 source-local acceptance artifact 称为 release candidate
或 official artifact。

## 未来产品方向

只有真实使用证明价值并建立独立规格后，才考虑：

- 新平台或架构的最终制品；
- 只读 doctor 和任务检查；
- 有明确用户授权的跨 Host handoff；
- verification budget 或 shared contract 的下一次版本化修订；
- 独立实现和验收的 DeepSeek 产品；
- 供应链签名、notarization 或透明度证据。

用户自定义 graph、workflow DSL、Web UI、remote MCP、generic shell、Core Git mutation、
multi-repository 和自动历史任务迁移不属于当前路线。
