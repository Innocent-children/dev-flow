# Codex Skill Activation Contract

## Metadata

`packages/codex/plugin/skills/dev-flow/agents/openai.yaml` 必须精确启用：

```yaml
policy:
  allow_implicit_invocation: true
```

Invocation policy 只存在于 `agents/openai.yaml`，不复制到 `SKILL.md` frontmatter。

`packages/codex/package.json` 和 `packages/codex/plugin/.codex-plugin/plugin.json` 的公开 description /
interface 必须说明智能隐式选择与精确强制入口，不得继续声明 explicit-only。Plugin default prompt 可以
保留精确 selector 作为确定性示例。

## Implicit selection description

Skill description 必须以前置、可截断后仍可识别的方式表达：

- 允许用途：implementation、bug fix、refactoring、targeted testing、development delivery；
- 排除用途：explanation-only、status-only、design discussion、ordinary question、ambiguous request；
- 排除类型不得因隐式选择自动创建 Dev Flow Task。

描述负责 Host 匹配，不是确定性运行时分类器或授权边界。

## Explicit selection

唯一精确 selector 保持：

```text
$dev-flow-codex:dev-flow
```

`$dev-flow`、错误 Plugin namespace 和错误 Skill base name 不是别名或有效显式选择。

## Shared admission

Skill 被 Host 隐式选择或被用户精确显式选择后，必须进入同一 admission gate：

1. 当前请求包含一个实质、有界的开发结果或明确的兼容 Task 恢复意图；
2. 空请求和会话型请求不调用 Core；
3. repository root、附加仓库与 writable authority 继续按既有规则解析；
4. `dev_flow_server_info` 仍是第一次 Dev Flow 调用；
5. Task discovery、Action、Recovery、evidence 和 presentation 合同保持不变。

显式选择强制选择 Skill，但不强制创建 Task，也不绕过任何授权。

## MCP and setup mirror

Launcher admission instructions 必须表达同一双入口合同。Setup validator 必须拒绝：

- implicit policy 不是 `true`；
- description 缺少正向用途或负向 Task 边界；
- Skill 或 MCP instructions 仍声称 selector 是唯一合法入口；
- 精确 selector 或非 selector 名称边界缺失；
- implicit 与 explicit 使用不同 startup contract。

## Compatibility

不支持 implicit selection 的旧 Codex Host 仍可使用精确 selector。Feature 不改变 Plugin/package name、
MCP tool catalog、Core process digest、Task data 或 DeepSeek behavior。
