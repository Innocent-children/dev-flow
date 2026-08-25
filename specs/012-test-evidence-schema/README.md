# Feature 012：TEST Evidence Schema 精确暴露

**状态**：Complete
**变更类型**：Product Feature
**基线**：`main` at `b324c2137630067f33b1aaed173d0c27c60c81b1`

## 权威与边界

- [`spec.md`](spec.md)：Host 可见 Schema、用户证据语义和兼容验收。
- [`checklists/requirements.md`](checklists/requirements.md)：需求质量门禁。
- [`plan.md`](plan.md)、[`research.md`](research.md)、[`data-model.md`](data-model.md)、
  [`contracts/`](contracts/)：实现设计与精确合同。
- [`tasks.md`](tasks.md)：精确路径、依赖、验收映射与四条定向验证。

本 Feature 修正 `dev_flow_apply_action` 的 Host schema投影和 TEST evidence约束表达。它不改变
`standard-development` 节点、transition、Task、持久化或现有 wire JSON 语义，也不重新实施
Feature 010。

`.specify/feature.json` 选择本目录。完成 requirements、design、tasks 和 analyze 后才能修改生产代码。

## 当前检查点

T001–T010 已完成；四条定向验证预算通过，未运行全仓库、真实 Host、registry或 release验证。
Feature 010 的保留实现与 developer 21/21 evidence shape 已由 application回归覆盖。发布仍未授权。
