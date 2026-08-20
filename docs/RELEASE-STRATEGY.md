# 分阶段产品发布策略

> **文档状态**：Feature 009 已完成。`dev-flow-codex@0.4.0`、Tag、四个 assets 和 GitHub Release
> 已公开并回读验证；最终 registry-package Journey 已通过。

## 发布顺序

Dev Flow 最终维护两个独立产品：

```text
dev-flow-codex
dev-flow-deepseek
```

当前批准顺序是：

1. `dev-flow-codex`：Feature 006，macOS arm64；
2. `dev-flow-deepseek`：Feature 004 完成后，由新的发布 Feature 处理。

首个 Codex-only `0.x` Release 不宣称 DeepSeek 已实现或受支持。`1.0.0` 仍要求两个产品均可
公开安装，并各自具有真实宿主最终制品证据。

## 当前 `0.4.0` 证据状态

- Feature 008 已完成 Contract 0.2、Schema 2、`standard-development@1`、恢复、方法画像和
  source-local Codex 验收；
- 两工作树 preparation、normalized verifier、fake npm/gh publication、resume/conflict、
  finalization 和 registry-only Journey contract 已有确定性覆盖；
- Feature 009 的当前 source validation 通过后，公开 npm、registry read-back、真实 final
  Journey、GitHub assets 与 Release 由一条命令完成。

fake 或本地证据不会生成 public support claim。

## 0.x 版本与身份策略

同一 Release 中包含的组件使用根 `VERSION`：

```text
Git tag                 v${VERSION}
Go Core                 ${VERSION}
included host package   ${VERSION}
GitHub Release          v${VERSION}
```

首版 package、bundled Runtime、Tag、manifest、publication record 与 GitHub Release 必须绑定同一
clean `main` commit/tree。npm version 只发布一次；Tag、npm bytes 和 GitHub assets 均不可覆盖、
移动或伪造回滚。

只发布 Codex 的版本不生成同版本 DeepSeek 包。未来 DeepSeek 首发从当时根版本构建并取得自己
的兼容与真实宿主证据。

## Codex 首版制品

初始公开支持只有 macOS arm64，一个 npm package 直接携带一个 Runtime：

```text
dev-flow-codex-<VERSION>.tgz
└── runtime/darwin-arm64/dev-flow
```

首版不建立平台 Runtime npm 子包，不首次启动下载二进制，也不要求用户安装 Go。package metadata
限定 `darwin`/`arm64`，setup 再核验实际平台、Runtime、package/Core version 与 Codex 兼容范围。

## 安装与宿主变更边界

最终发布后的标准入口是：

```bash
npm install -g dev-flow-codex
dev-flow-codex setup
```

历史 `0.3.0` registry package 已冻结；`0.4.0` graph package 在 Feature 009 完成前保持 pending。
对于当前发布包：

- npm 只安装或删除 package-manager-owned 文件；
- setup/remove 才修改已证明归属的 Codex 注册；
- 禁止 install/uninstall lifecycle host mutation 与 shell profile 修改；
- explicit remove 与 npm uninstall 默认保留任务数据库和未知相邻文件。

## 构建与五文件输出

每个 Release 从一个 reviewed clean `main` commit/tree 的两个独立 clean worktree 构建：

- Go Runtime 字节一致；
- npm tarball 的 normalized 路径、字节、mode 与 metadata 一致；
- raw `.tgz` equality 可记录为观察，不成为永久规则；
- package/Core/plugin/Tag/manifest 使用同一版本与 source identity；
- 输出恰好为 tarball、standalone Core、`SHA256SUMS`、`release-manifest.json`、
  `publication-record.json`。

publication record 是可变 operator state，不进入 SQLite、不上传为 Release asset；其他四个文件
是最终 immutable payload/metadata。Generated output 不提交到源码树。

## 发布权限与执行位置

真实发布从已验证、干净且已推送的 `main` commit 执行，使用一个 durable release directory 和
精确 `v${VERSION}` confirmation。根命令负责 preparation、verification 和 publisher 调用。

Pull Request CI：

- 不持有 npm/GitHub 发布凭证；
- 不调用 publisher，不创建 Tag/Release/npm version；
- 不运行真实 Codex 或 final registry-package Journey；
- 只执行 preparation-safe contracts、syntax、package 和 repository validation。

## 发布门禁与顺序

1. Features 003/005 已合并，Phase 6 review gate 通过；
2. freeze 一个 reviewed clean `main` source commit/tree；
3. 两个 clean worktree build/compare，生成并验证一次 frozen release directory；
4. npm ownership、GitHub permission、Tag/Draft/npm conflict read-only preflight；
5. operator 精确确认 `v${VERSION}`；
6. 创建或复用精确 Tag 与 GitHub Draft Release；
7. 发布 verified npm tarball 一次；
8. 从 public registry 下载并验证 metadata、tarball、tree、mode 与 Runtime；
9. 只使用 registry package 完成真实 Codex install/setup/create/restart/resume/`DONE`/remove/
   uninstall/retained-reopen Journey；
10. 生成 native passed support entry、最终 manifest 与 checksums；
11. 上传 tarball、standalone Core、manifest、checksums，并从官方 asset path 回读；
12. 全部门禁通过后 finalize GitHub Release；
13. 最终回读 Tag/Release identity，将本地 publication record 标为 `complete`。

## 失败与恢复

- 每次 mutation 前重新读取远端；
- 精确匹配的已完成步骤可复用；
- npm 同名同版本不重发；
- Tag 不移动，冲突 asset 不覆盖；
- 失败记录真实已完成/未完成步骤和 safe next action；
- 冲突进入 manual resolution，不删除远端状态或伪造事务回滚。

## 支持声明

首个 public support table 只能在 native final Journey 后包含 macOS、arm64、registry package
digest、bundled Core digest/version、实际 Codex version、Feature 003 compatible range 和 passed
result。Linux、Windows、Intel Mac、DeepSeek 以及所有 fixture/simulated 环境均不产生 public
passed support。

## DeepSeek 与 1.0.0

DeepSeek 仍由延期的 Feature 004 与未来独立发布 Feature 负责。Feature 006 不修改、构建、测试
或发布 `packages/deepseek/`。`1.0.0` 仍要求 Codex 与 DeepSeek 两个可公开安装的产品、两个真实
宿主 Journey，以及稳定的共享 Core/MCP/Recovery/SQLite 合同。
