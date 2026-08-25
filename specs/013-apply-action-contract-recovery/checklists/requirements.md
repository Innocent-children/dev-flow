# Specification Quality Checklist: Apply Action 合同恢复

**Purpose**：Validate requirements before planning
**Created**：2026-08-25
**Feature**：[spec.md](../spec.md)

## Content Quality

- [x] 定义可观察的 Host 投影结果、错误结构与纠正结果
- [x] 分离当前事实、修正、兼容与继续行为
- [x] 不含未解决占位符

## Requirement Completeness

- [x] 定义根 Schema 形态与全树 composition 禁令
- [x] 定义可见的顶层身份字段、`action_kind` 与 payload envelope
- [x] 定义 `node_result` 并集完整性与封闭性
- [x] 定义 `checks` 完整结构与 source-specific 规则的可见位置
- [x] 定义 Host 压缩预算约束
- [x] 定义闭合 Violation rule 枚举与稳定 `path`
- [x] 定义闭合 Guard rule 枚举与 `guard_id` 来源
- [x] 明确保留 findings/problem_class、`deviations`、`completed_work_item_ids` 语义
- [x] 定义零写入判定与 `retry_safe=false` 的保留场景
- [x] 定义一次纠正的全部前置条件与第二次失败后的停止
- [x] 保留现有 error code、六工具目录、持久化、Action identity、Process Definition、Evidence wire
- [x] 定义有限的四组定向验证与发布排除

## Feature Readiness

- [x] 每个 P1/P2 story 都有独立确定性测试陈述
- [x] FR 与 SC 以确定性合同测量；最终 callable 能力另以一次授权的真实 Host 回读确认
- [x] Data disposition 明确为 `not-applicable`
- [x] 没有需求依赖运行期读取 Feature Markdown

## Notes

- 被拒的真实请求使用 `checks[3].source=user` 与 `checks[3].command_count=1`；当前 workflow 权威
  要求所有非 automated source 的命令数为零。
- Host 投影规则由 Host 拥有。仓库合同复现其当前公开行为，最终真实 callable 回读需要独立授权，
  最终真实 Host 回读已通过，因此 Feature 可以标记为 Complete。
- 发布 Schema 的建模体积贴近 Host 压缩预算上限，任何新增 payload 成员都必须重新评估该预算。
