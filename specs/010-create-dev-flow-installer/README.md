# Feature 010：统一 Adapter 生命周期管理器

**状态**：Complete  
**变更类型**：Product Feature  
**基线**：`main` at `6460abe68a5c0cb6452555e23d5132971b92668a`

## 权威与边界

- [`spec.md`](spec.md)：用户行为、范围、数据清理授权与验收。
- [`checklists/requirements.md`](checklists/requirements.md)：需求质量门禁。
- [`plan.md`](plan.md)、[`research.md`](research.md)、[`data-model.md`](data-model.md) 与
  [`contracts/`](contracts/)：实现设计和闭合合同。
- [`tasks.md`](tasks.md)：依赖、精确路径、验收映射和四条定向验证预算。

本 Feature 一次性交付当前可可靠实现的 `create-dev-flow` 统一生命周期管理器，覆盖 Codex 与
DeepSeek Adapter 的检查、诊断、安装、升级、修复、保留数据重装、卸载、恢复出厂状态和清空后
重装。Go Core、MCP、Task、Host 本体和 release contract保持现有权威。

`.specify/feature.json` 选择本目录。需求质量和跨制品一致性审查已经通过，可以按照 `tasks.md`
从 T001 开始实施；发布仍需独立授权。

## 当前检查点

T001–T012 已实施并对齐实际证据。四条自动验证预算严格保持不变；开发者执行 factory-reset
manager-run 收尾补丁的精确 V1 手工交接并报告 21/21 通过。Feature 012 已修复 user evidence Schema
映射并以 deterministic application回归覆盖该组合。无参数安装优先首页已完成，manager定向测试
23/23 通过；独立发布仍未授权。
