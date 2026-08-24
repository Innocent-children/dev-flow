# Quickstart: Codex 智能隐式启用验收

## Journey 1: 直接开发请求

**Initial condition**: Plugin 已安装并启用，当前目录是一个授权 Git worktree。

**Prompt**:

```text
修复订单创建接口的幂等性问题，只运行相关测试。
```

**Expected**: Skill description 允许 Host 隐式选择 Dev Flow；用户无需补写 selector。选择后继续既有
handshake、Task discovery 和 Core Action loop。

## Journey 2: 普通解释请求

**Prompt**:

```text
解释一下订单创建接口目前如何保证幂等性。
```

**Expected**: 不自动创建 Dev Flow Task。Codex 可用普通只读能力回答。

## Journey 3: 显式强制入口

**Prompt**:

```text
$dev-flow-codex:dev-flow 恢复当前兼容的 Dev Flow Task。
```

**Expected**: Skill 被显式选择并进入同一 admission、handshake 和 Task discovery。裸 `$dev-flow` 不
选择该 Plugin Skill。

## Targeted validation

```bash
node --test packages/codex/tests/skill-contract.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/launcher.test.mjs packages/codex/tests/package-contract.test.mjs
```

该命令只验证 package 的确定性合同，不声明真实模型匹配矩阵已运行。不得运行完整仓库验证、真实
Host/registry Journey、DeepSeek 或 release command。
