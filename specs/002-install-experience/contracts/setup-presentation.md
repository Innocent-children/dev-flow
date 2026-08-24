# Codex Setup Presentation Contract

## Rich

fresh/compatible setup success 使用 5～8 逻辑行：Dev Flow 自有标题、ready、配置路径、文件变化、唯一
next step。可使用自有颜色和紧凑边框；含义不依赖颜色/符号，无动画或延时。

## Plain

非 TTY、`NO_COLOR`、宽度不足、Unicode 能力不确定时使用纯文本；无 ANSI、动画和 Unicode 边框。
already-installed 使用紧凑零变化结果，不展示完整品牌卡。

## Locale

按 `LC_ALL`、`LC_MESSAGES`、`LANG` 选择。`zh_CN`、`zh_SG`、`zh_Hans` 常见变体为简中；其他/缺失
为英文。同一结果只用一种用户文案语言。路径、命令、JSON key、status/change token 保持原值。

## Command boundary

- `setup`: rich 或 plain；
- `setup --json`: 仅 setup result JSON；
- `mcp`: 零 presentation bytes；
- remove、`--version`: 现有输出不变；
- renderer 能力错误降级 plain，不改变 setup 成败。
