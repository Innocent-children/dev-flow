# Repository Scripts

[中文](README.md) | [English](README_en.md)

`scripts/` 保存本仓库的开发验证、source-package 构建和 standalone release 工具。开发入口与
发布入口严格分离：普通验证不会安装真实 Host 产品，也不会创建 npm、Tag 或 GitHub Release。

## 日常开发

| 命令 | 用途 |
| --- | --- |
| `pnpm run validate` | 运行有界仓库验证 |
| `pnpm run validate:contracts` | 只运行公共 contract tests |
| `pnpm run versions:check` | 检查 Core、Codex、DeepSeek 版本权威与镜像 |
| `pnpm run dev-flow:local` | 从当前源码打包三个产品并进入与 `dev-flow` 相同的本地安装菜单 |
| `pnpm --dir packages/codex test` | 运行 Codex package-local tests |
| `pnpm --dir packages/deepseek test` | 运行 DeepSeek package-local tests |

`validate-repository.sh` 检查工具链、冻结依赖安装、版本权威、whitespace、Go formatting、
package contracts、Host Adapter tests、deterministic journeys 和 release tooling contracts。它不
调用真实发布入口。

## 本地安装测试

下面一条命令会构建 WebUI 和 bundled Core，在仓库外的临时目录生成 `@imotong/dev-flow`、
`dev-flow-codex` 与 `dev-flow-deepseek` tarball，再从本地 tarball 启动统一安装菜单：

```bash
pnpm run dev-flow:local
```

也可以转发现有非交互参数：

```bash
pnpm run dev-flow:local -- reinstall --host codex --yes
```

本地模式会真实替换所选 Host 的 Adapter，即使 manifest 版本与已安装版本相同；安装计划、确认、
注册、receipt 和就绪回读仍由现有 `dev-flow` 生命周期负责。脚本退出时删除临时制品，不调用
`npm publish`，也不创建 Tag 或 GitHub Release。它不能替代发布后的 npm registry 字节回读和
Release 附件检查。

`dev-flow:local` 的 Node orchestrator 可在 macOS arm64 和 Windows 10/11 x64 运行，并同时构建、
校验、暂存 `darwin-arm64/dev-flow` 与 `win32-x64/dev-flow.exe`。Windows 开发机需要可用的 Go、
Node.js、npm 和 pnpm；不要求 Bash 来启动这个入口。

## Source-local 构建

- `build-webui.mjs`：跨平台构建并同步嵌入式 WebUI；`build-webui.sh` 是 Unix 包装层；
- `build-codex-local.sh`：构建 Codex source-local tarball，以及 darwin-arm64 和 windows-amd64 Core；
- `build-deepseek-runtime.sh`：构建 DeepSeek package tests 使用的两个 Core runtime；
- `build-codex-release.sh`、`build-deepseek-release.sh`：为 standalone release 准备确定性制品。

最终制品和 evidence 必须写入仓库外、由操作者选择的目录。

## 发布入口

推荐在 GitHub Actions 手工运行 `publish-npm` 工作流。三个 npm 包分别把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；运行时只选择产品、channel 和目标版本。工作流使用固定的发布检查，通过 OIDC
获取短期 npm 发布凭据，使用
`macos-15` ARM64、Go `1.26.5`、Node.js `24.18.0` 和 pnpm `11.24.0`，按产品串行执行，并交叉构建、
校验 macOS arm64 与 Windows amd64 Core 后调用下列现有入口。发布 runner 的操作系统只是构建基础设施，
不缩小制品运行时范围。npm 发布不创建依赖 `NODE_AUTH_TOKEN` 的 registry 认证配置。
版本提交、Tag 和 GitHub Release 使用安装到当前仓库、加入 `main` ruleset bypass list 的专用
GitHub App 短期 token；仓库变量 `RELEASE_APP_CLIENT_ID` 和 secret `RELEASE_APP_PRIVATE_KEY`
分别提供 App Client ID 与完整 PEM 私钥。

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>"
```

`stable` 为默认 channel，只接受稳定 SemVer，并要求 `main` 与 `origin/main` 一致。`beta` 只接受
`MAJOR.MINOR.PATCH-beta.N`，允许任意干净的命名分支，version commit 推回当前分支；npm 固定使用
`beta` dist-tag，GitHub Release 固定为 prerelease，稳定版 `latest` 保持不变。

两个一键发布命令只更新 package manifest、Plugin mirror 和 `release/public-versions.json` 等机器
可读版本文件，不读取或改写 Markdown。

发布命令使用一套固定检查。只有上述 exact-confirmation 入口可以修改产品版本、commit/push、Tag、
npm、GitHub Release 与 assets。

两个 channel 共用同一个 Publisher。Publisher 使用仓库外的 `release-manifest.json` 绑定 source、
版本和 artifact digest；重跑时回读并复用匹配的远端状态。
Publisher 最多等待十分钟并重试真正的 `npm pack <package>@<version>` tarball 回读；只对
`ETARGET`、`E404` 这类 registry 传播延迟继续等待，认证失败和字节不一致立即停止。

Actions 会在成功或失败后上传 runner 临时发布目录；用同一组 workflow 输入重跑时，publisher 会先回读 npm、Tag 和 GitHub Release，不会盲目重复
不可逆操作。临时目录本身不会跨 workflow run 自动复用。

精确操作合同见 [Release Ownership](../release/README.md)。
