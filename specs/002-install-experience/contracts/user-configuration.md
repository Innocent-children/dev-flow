# Codex Setup User Configuration Contract

固定路径为 `$HOME/.dev-flow/config.json`。缺失时创建：

```json
{
  "codex": {
    "codebase_memory": false
  },
  "deepseek": {
    "codebase_memory": false
  }
}
```

文件末尾一个换行。新目录 mode `0700`，新文件 mode `0600`，路径不得穿过 symlink。

既有文件必须是最大 16 KiB 的普通非 symlink 文件，group/other 权限位为 0，并通过当前 UTF-8、
single JSON、duplicate/unknown field、host object 与 boolean 规则。成功时字节级保留；失败时不 chmod、
覆盖、删除、改名或修复，并在 registration mutation 前返回一个恢复步骤。

remove、npm uninstall、Core 和 DeepSeek 不删除该文件。
