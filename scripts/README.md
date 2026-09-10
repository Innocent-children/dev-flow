# Repository Scripts

[中文](README.md) | [English](README_en.md)

`scripts/` 保存本仓库的开发检查、源码安装包构建和独立发布工具。开发入口与
发布入口严格分离：普通验证不会安装真实 Host 产品，也不会创建 npm、Tag 或 GitHub Release。

## 日常开发

| 命令 | 用途 |
| --- | --- |
| `pnpm run validate` | 运行仓库规定的检查 |
| `pnpm run validate:contracts` | 只运行公开接口规范测试 |
| `pnpm run versions:check` | 检查 Core、Codex、DeepSeek 版本文件与同步副本 |
| `pnpm run dev-flow:local` | 从当前源码打包三个产品并进入与 `dev-flow` 相同的本地安装菜单 |
| `pnpm --dir packages/codex test` | 运行 Codex package-local tests |
| `pnpm --dir packages/deepseek test` | 运行 DeepSeek package-local tests |

`validate-repository.sh` 检查工具链、按锁定版本安装依赖、版本文件、空白字符、Go 格式、安装包
约定、Host Adapter、可重复的完整流程测试和发布工具约定。该脚本不执行实际发布。

## 平台定向检查

测试按实际依赖的运行环境分开：

| 检查 | 环境与预期结果 |
| --- | --- |
| `node --test packages/deepseek/tests/macos-paths.test.mjs` | 仅 macOS arm64：临时包包含两套平台模块，macOS shell 样例通过预检，POSIX 权限和符号链接规则通过；其他平台跳过。 |
| `node --test packages/deepseek/tests/windows-support.test.mjs` | 仅 Windows x64，须设置 `DEV_FLOW_WINDOWS_CORE` 为实际构建的 Core：移出源码目录的包能加载模块并运行 `.exe` 预检；环境不满足时跳过。 |
| `node --test packages/deepseek/tests/paths.test.mjs packages/dev-flow/tests/local-packages.test.mjs` | 跨平台：检查包路径选择与本地包摘要；路径比较使用实际路径，不执行其他平台的程序。 |
| `node --test packages/desktop-pet/windows/tests/renderer.test.cjs` | 跨平台模拟 DOM、IPC 和时钟：普通轮询保留散步；缩放取消散步并能安排后续活动；工作和庆祝动画保持进度。此检查已接入 Mac、Windows CI，不代表原生窗口测试。 |

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
注册、receipt 和就绪状态检查仍由现有 `dev-flow` 生命周期负责。脚本退出时删除临时构建文件，不调用
`npm publish`，也不创建 Tag 或 GitHub Release。发布后仍需从 npm 下载并逐字节核对安装包，同时检查 Release 附件。

`dev-flow:local` 的 Node orchestrator 可在 macOS arm64 和 Windows 10/11 x64 运行，并同时构建、
校验、暂存 `darwin-arm64/dev-flow` 与 `win32-x64/dev-flow.exe`。Windows 开发机需要可用的 Go、
Node.js、npm 和 pnpm；不要求 Bash 来启动这个入口。

## 本地源码构建

- `build-webui.mjs`：跨平台构建并同步嵌入式 WebUI；`build-webui.sh` 是 Unix 包装层；
- `build-core-runtimes.mjs`：唯一的双 Core runtime 构建入口，输出按 runtime key 命名的 JSON 报告；
- `build-codex-local.sh`：使用统一 runtime 报告构建 Codex 源码 tarball；
- `build-deepseek-local.mjs`：在系统临时 staging 中使用统一 runtime 报告构建 DeepSeek 源码 tarball；
- `build-codex-release.sh`、`build-deepseek-release.sh`：为 standalone release 准备确定性构建产物。

Codex 与 DeepSeek 的源码 package 都不保存预编译 Core。两者的 `package.json` 仍声明最终 npm 包内的
两个 runtime 路径；本地构建和 release staging 现场生成这些文件后再打包。

最终安装包和测试记录必须写入仓库外、由操作者选择的目录。

## 发布入口

推荐在 GitHub Actions 手工运行 `publish-npm` 工作流。三个 npm 包分别把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；运行时只选择产品、channel 和目标版本。工作流使用固定的发布检查，通过 OIDC
获取短期 npm 发布凭据，使用
`macos-15` ARM64、Go `1.26.5`、Node.js `24.18.0` 和 pnpm `11.24.0`，按产品串行执行，并交叉构建、
校验 macOS arm64 与 Windows amd64 Core 后调用下列现有入口。发布 runner 的操作系统只是构建基础设施，
不缩小构建产物运行时范围。npm 发布不创建依赖 `NODE_AUTH_TOKEN` 的 registry 认证配置。
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
版本和安装包摘要；重跑时回读并复用匹配的远端状态。
Publisher 最多等待十分钟并重试真正的 `npm pack <package>@<version>` tarball 下载与内容核对；只对
`ETARGET`、`E404` 这类 registry 传播延迟继续等待，认证失败和字节不一致立即停止。

Actions 会在成功或失败后上传 runner 临时发布目录；用同一组 workflow 输入重跑时，publisher 会先回读 npm、Tag 和 GitHub Release，不会盲目重复
不可逆操作。临时目录本身不会跨 workflow run 自动复用。

具体操作要求见 [Release Ownership](../release/README.md)。

## 桌面宠物本地构建

`node scripts/build-desktop-pet.mjs --output "/absolute/pet-build"` 在 macOS arm64 上编译 Swift、装配已有
素材和语言资源、ad-hoc 签名并生成本地统一入口 tarball。源码包的 JS 清单和加入原生应用的 staging
清单分别检查；现有 USTAR 工具保留包内原生执行权限，解包后再核对签名。此入口不重编 Core、不修改
Adapter 安装、不发布 npm。安装、确认运行路径和替换已有应用的步骤见[桌面宠物指南](../docs/DESKTOP-PETS.md#本地构建与安装)。
`dev-flow:local` 仍使用临时 lifecycle 管理器；桌面宠物使用这里生成并安装的持久 package。

构建通过 `scripts/desktop-pet-artwork.mjs` 从 `packages/desktop-pet/default-appearance/` 复制默认 SVG 形象，并逐文件核对内容；该素材包包含九类动作、312 帧。构建结果的 `frames` 和 `asset_bytes` 记录默认动画帧数与素材文件大小。鲸鱼娘等自定义形象通过外部素材包导入。生成的应用包和外部素材目录不纳入 Git 跟踪。

Windows 桌面包由 `build-desktop-pet-windows.mjs` 构建；在仓库根目录先执行 `npm ci --prefix packages/desktop-pet/windows`，再执行 `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"`。输出必须在仓库外。该入口装配 Windows 桌面应用、统一入口及两个 Adapter 安装包；复用 Core 构建目标表，不运行 Mac 程序或测试，也不执行发布。

Windows 桌面开发包现在同时携带完整的 Codex 与 DeepSeek 安装包；构建复用 buildCoreRuntimes 和 stageAndPack，不生成缺少另一平台 Core 的临时特制 Adapter 包。安装统一入口后，两个插件与桌面应用由 dev-flow install --host all --yes 完成。

WebUI 的语义提交和恢复回归使用 `pnpm --dir packages/webui test`，运行当前组件与 HTTP 客户端的模拟检查，覆盖网络异常、待恢复页面重开和仅按 Action ID 恢复。这不是原生浏览器验证。

## 共享 Skill 引用

Core 通用说明和示例只在 `skills/dev-flow/core/` 编辑。执行 `node scripts/sync-skill-references.mjs` 生成 Codex 与 DeepSeek 包内副本；副本供源码阅读和本地加载，文件头标明来源。`node scripts/sync-skill-references.mjs --check` 检查副本是否与共享源一致。Codex 本地构建和 `stageAndPack` 都在临时 staging 中重新生成引用，安装包不依赖仓库外的共享目录。共享说明只替换 `host` 值，Host 操作说明分别维护。校验还覆盖两边 MCP Schema、当前节点转移、DSH 确认文本及实际包内文件。

完整响应示例由定向测试维护。修改共享请求后先同步包内引用。更新 Core 示例运行 `DEV_FLOW_UPDATE_SKILL_EXAMPLES=1 go test ./internal/mcp -run TestSkillSuccessExamplesMatchExecution -count=1`，再运行共享引用同步命令。更新 Host 示例运行 `DEV_FLOW_UPDATE_SKILL_EXAMPLES=1 node --test packages/codex/tests/skill-success-examples.test.mjs packages/deepseek/tests/skill-success-examples.test.mjs`。正常测试不写文件，而是逐字段比较已保存的请求和响应；修改示例字段时须检查差异，新增文件时同步包清单与 staging 清单。Node 测试的读取、稳定值替换和比较辅助函数位于 `tests/skills/executed-examples.mjs`。
