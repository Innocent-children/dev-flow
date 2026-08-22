# Dev Flow 支持矩阵

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

本文件只记录已经由公开制品和最终 Host lifecycle evidence 建立的支持声明。源码可构建、包已
上传或 fixture 测试通过，均不能单独扩大支持范围。

| 产品 | 公开版本 | Bundled Core | 平台 | Host 兼容范围 | 状态与证据 |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.5.1` | `0.5.0` | macOS arm64、Node.js `>=24` | Codex `>=0.147.0`；最终 Journey 使用 `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.5.1) · [codex-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.1) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.5.1` | `0.5.0` | macOS arm64、Node.js `>=24` | DSH `>=0.1.0-rc.6`；最终 Journey 使用 `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.5.1) · [deepseek-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.1) · native registry journey passed |

## 证据说明

两个 `0.5.1` Release manifest 都记录 `normal` 验证、double-build、closed package、
forbidden-content scan 和 final registry-package Journey。Codex 证据覆盖安装、版本/Core
handshake、setup、remove、uninstall 与 repository unchanged；DeepSeek 证据覆盖安装、显式触发、
restart/resume、`DONE`、remove、uninstall 与 retained reopen。

Core、Codex 和 DeepSeek 是独立产品身份。Host package 版本与 bundled Core 版本可以不同，
兼容性由实际 executable、closed schemas/catalog、artifact digest 和 runtime evidence 建立。

当前没有 Linux、Windows、Intel Mac、Rosetta 或 remote MCP 支持声明。
