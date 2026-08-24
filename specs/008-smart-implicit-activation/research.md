# Research: Codex 智能隐式启用

## Decision 1: 使用 Codex 原生 implicit Skill selection

**Decision**: 启用 `policy.allow_implicit_invocation`，由清晰的 Skill `description` 提供匹配语义。

**Rationale**: Codex 已提供显式和隐式两种 Skill 选择方式；直接使用现有 Host 能力即可去除重复输入。

**Alternatives considered**: 复制仓库级 `$dev-flow` Skill、prompt hook 自动注入 selector、实现自有
关键词分类器。

**Why alternatives were rejected**: 复制 Skill 会产生合同漂移；hook 改写用户输入且可移植性差；分类器
引入新运行时和误判维护成本。

**Consequences**: 匹配质量取决于 Host 和 description；产品以代表性正负合同约束描述，不承诺概率性
模型判断绝对确定。

## Decision 2: 双入口汇合到同一 admission gate

**Decision**: implicit selection 与精确 selector 只决定 Skill 如何被选中，后续共用同一实质请求、
repository、handshake、Task 和 Action 合同。

**Rationale**: 激活来源不是 Core 事实，也不应复制现有执行流程。

**Alternatives considered**: 为 implicit 请求建立简化流程、把激活来源写入 Task、receipt 或用户配置。

**Why alternatives were rejected**: 会产生第二流程或无用户价值的持久状态，并扩大 Core/Schema 范围。

**Consequences**: 显式选择仍不能绕过权限或空请求检查；隐式误选的非任务请求不会创建 Task。

## Decision 3: 使用静态 contract tests 验证 package 语义

**Decision**: 测试 metadata、description、admission 和 fixture 的闭合文本合同，不新增真实模型分类矩阵。

**Rationale**: package 能确定的是交给 Host 的 metadata 和语义边界，不能把一次模型结果升级为所有
模型和版本的确定证据。

**Alternatives considered**: 真实 Codex Journey、多个模型的 prompt eval、运行时关键词解析测试。

**Why alternatives were rejected**: Journey 和模型矩阵超出 Feature 预算且不稳定；关键词解析并不存在于
所选实现中。

**Consequences**: 验收证明 package 合同正确、代表请求被清晰表达；实际 Host 选择保留模型性质。
