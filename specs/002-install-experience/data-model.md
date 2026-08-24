# Data Model: Codex Setup 安装展示

## UserConfigurationPreparation

| 字段 | 规则 |
| --- | --- |
| `configuration_path` | canonical HOME 下 `$HOME/.dev-flow/config.json`。 |
| `file_change` | 缺失创建为 `{path, change:"created"}`；既有有效配置为 null。 |

默认文件为完整 codex/deepseek false/false closed JSON，末尾一个换行。新目录 `0700`、新文件 `0600`。
既有文件最大 16 KiB、普通文件、非 symlink、group/other 无权限；验证成功后字节不变。

## SetupFileChange

| 字段 | 规则 |
| --- | --- |
| `path` | setup 直接写入的配置或 registration receipt 绝对路径。 |
| `change` | `created` 或 `updated`。 |

有序数组先配置、后 receipt。外部 cache、目录和 unchanged 文件不进入数组。

## SetupSuccessResult

| 字段 | 规则 |
| --- | --- |
| `operation` | 固定 `setup`。 |
| `status` | 延续 `installed` 或 `already-installed`。 |
| `changed` | file_changes 非空。 |
| `receipt_path` | 现有 Codex ownership receipt。 |
| `configuration_path` | 固定用户配置。 |
| `file_changes` | 有序 SetupFileChange[]。 |
| `next_step` | 唯一 `$dev-flow-codex:dev-flow <task description>`。 |

## SetupPresentation

| 模式 | 规则 |
| --- | --- |
| `rich` | TTY、宽度、Unicode 与颜色能力可用，fresh/upgrade 5～8 逻辑行。 |
| `plain` | 无 ANSI/动画/Unicode 边框，包含同一事实。 |
| `json` | 一行 closed JSON，保留现有字段并追加新字段。 |

locale 为 `zh-CN` 或 `en`；命令、路径和状态 token 不翻译。

## Lifecycle

```text
resolve paths -> ensure/validate config -> setupRegistration
 -> receipt change fact -> SetupSuccessResult -> rich/plain/JSON
```

配置失败时 registration 零 mutation。配置 created 后 registration 失败时，stderr 报告已完成配置变化、
registration 未完成和重新执行 setup；receipt 不存在或保持旧值。
