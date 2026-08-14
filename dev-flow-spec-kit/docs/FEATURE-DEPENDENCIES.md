# 功能依赖关系

```text
001-bootstrap-monorepo
                │
                ▼
002-govern-and-resume-single-repository-task
                │
        Core Contract 0.1 冻结
          ┌─────┴─────┐
          ▼           ▼
003-codex-explicit   004-deepseek-explicit
-dev-flow            -dev-flow
          └─────┬─────┘
                ▼
005-recover-uncertain-actions-and-drift
                │
                ▼
006-publish-two-installable-products
```

## 并行规则

`003` 与 `004` 可在 `002` 验收并冻结以下公共合同后并行：

- Core Contract `0.1`；
- MCP Tool Surface `0.1`；
- Result Envelope `0.1`；
- State Schema `1`；
- Recovery Semantics `0.1`。

两个宿主分支不得自行修改公共工具、状态机、错误码、SQLite 模型或恢复规则。发现缺口时
应暂停宿主实现，先建立共享 Core 变更。

## 规格成熟度

| Spec | 当前产物 | 进入下一阶段的门禁 |
|---|---|---|
| `001` | spec/plan/research/model/contracts/tasks | Constitution 审查完成 |
| `002` | spec/plan/research/model/contracts/tasks | `001` 完成 |
| `003` | spec | `002` 完成并冻结 Core Contract `0.1` |
| `004` | spec | `002` 完成并冻结 Core Contract `0.1` |
| `005` | spec | 两个宿主真实重启/恢复 journey 完成 |
| `006` | spec | `005` 恢复合同稳定，两个产品可本地安装 |

未达到门禁时，不生成依赖具体实现事实的 `plan.md` 和 `tasks.md`。
