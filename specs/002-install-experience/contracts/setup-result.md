# Codex Setup Result Contract

`setup --json` success 为一行 closed JSON：

```json
{
  "operation": "setup",
  "status": "installed",
  "changed": true,
  "receipt_path": "/Users/example/Library/Application Support/dev-flow/registrations/codex.json",
  "configuration_path": "/Users/example/.dev-flow/config.json",
  "file_changes": [
    { "path": "/Users/example/.dev-flow/config.json", "change": "created" },
    { "path": "/Users/example/Library/Application Support/dev-flow/registrations/codex.json", "change": "created" }
  ],
  "next_step": "$dev-flow-codex:dev-flow <task description>"
}
```

- status 保留 `installed|already-installed`；change 为 `created|updated`；object 拒绝未知字段。
- `changed` 等价于 file_changes 非空；数组按配置、receipt 顺序。
- fresh receipt=`created`，compatible upgrade=`updated`，already-installed=null。
- 配置 created 后 registration 失败继续 exit nonzero；stderr 文本列出配置 created、registration 未完成
  和重新执行 `dev-flow-codex setup`。不新增通用 JSON error schema。
- 不输出文件内容、凭据、Task data、cache、package resources、digest 或环境值。
