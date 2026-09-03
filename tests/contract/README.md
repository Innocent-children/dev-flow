# Repository Contract Tests

本目录提供 deterministic contract evidence，验证当前源码的公共闭合边界。测试使用 checkout
中的权威文件或临时目录/数据库；它们不启动真实 Codex，不发布 package，也不产生 public
Release evidence。

## 覆盖范围

- `mcp_contract_test.go`：Core current contract exact seventeen-tool catalog、semantic-only
  Action submission schemas、workspace/relocation/abandon fields、Recovery、ServerInfo 与 storage identity；
- `result_envelope_test.go`：typed Result Envelope、stable public errors、closed/redacted output；
- `graph_contract_test.go`：`standard-development` 节点、29 transitions、guard/reason/problem
  class 和 method-profile public semantics；
- `current_storage_contract_test.go`：Fresh current storage、strict snapshot、single current runtime、unsupported
  safe-stop、lifecycle non-deletion 和 private-path redaction；
- `platform_boundary_test.go`：Core 语义层无操作系统判断、三个 package 使用封闭平台实现、双 runtime
  只从统一构建目录产生；
- `fixture_contract_test.go`：current Core contract graph fixtures 与 Host parity；
- `repository_root_test.go`：repository layout、package manifest、scripts 和 executable allowlist；
- `final_local_payload_test.go`：final local payload 与 Host 投影；
- `webui_package_closure_test.go`：WebUI 嵌入制品闭合性。

## 证据类型

- **static evidence**：checked-in manifest、schema 和 JSON fixture；
- **deterministic contract evidence**：Go tests 对闭合 schema、ordering、allowlist、zero-write 和
  redaction 的实际执行结果；
Host parity fixture 证明 Core identity parity，不证明 DeepSeek 产品。Package/layout contract
通过不等于 source-local artifact 已构建，也不等于 native Codex 或 public registry 验收。
