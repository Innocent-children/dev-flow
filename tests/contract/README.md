# Repository Contract Tests

本目录提供 deterministic contract evidence，验证当前源码的公共闭合边界。测试使用 checkout
中的权威文件或临时目录/数据库；它们不启动真实 Codex，不发布 package，也不产生 public
Release evidence。

## 覆盖范围

- `mcp_contract_test.go`：Core current Core contract exact fifteen-tool catalog、Action-specific
  submission schemas、Recovery fields、ServerInfo DTO、process/method/storage identity；
- `result_envelope_test.go`：typed Result Envelope、stable public errors、closed/redacted output；
- `graph_contract_test.go`：`standard-development` 节点、29 transitions、guard/reason/problem
  class 和 method-profile public semantics；
- `current_storage_contract_test.go`：Fresh current storage、strict snapshot、no-legacy source、unsupported/future
  safe-stop、lifecycle non-deletion 和 private-path redaction；
- `fixture_contract_test.go`：current Core contract graph fixtures、Host parity、Recovery fixtures 与冻结
  frozen linear contract inventory/parity；
- `package_manifest_test.go`：root/Codex package closed manifest、scripts、allowlist 和 platform；
- `release_contract_test.go`：历史 release schema/fixture/tooling freeze，不能作为当前发布动作。

## 证据类型

- **static evidence**：checked-in manifest、schema 和 JSON fixture；
- **deterministic contract evidence**：Go tests 对闭合 schema、ordering、allowlist、zero-write 和
  redaction 的实际执行结果；
- **historical freeze evidence**：frozen linear contract、已发布 `0.3.0` 和既有 release fixtures，仅证明
  已发生历史，不定义当前 graph runtime。

Host parity fixture 证明 Core identity parity，不证明 DeepSeek 产品。Package/layout contract
通过不等于 source-local artifact 已构建，也不等于 native Codex 或 public registry 验收。
