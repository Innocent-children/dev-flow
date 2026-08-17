# 分阶段产品发布策略

> **文档状态**：本文定义 Feature 006 及后续 DeepSeek 发布 Feature 的目标策略。当前 `main`
> 在 003 合并前仍不具备公开发布能力。

## 发布顺序

Dev Flow 最终维护两个独立产品：

```text
dev-flow-codex
dev-flow-deepseek
```

当前批准的首发顺序是：

1. `dev-flow-codex`：Feature 006，macOS arm64；
2. `dev-flow-deepseek`：Feature 004 完成后，由新的发布 Feature 处理。

首个 Codex-only `0.x` Release 不宣称 DeepSeek 已实现或受支持。`1.0.0` 仍要求两个产品。

## 0.x 版本策略

所有在同一 Release 中包含的组件使用根 `VERSION`：

```text
Git tag                 v${VERSION}
Go Core                 ${VERSION}
included host package   ${VERSION}
```

当某一版本只发布 Codex 时，不生成或发布同版本 DeepSeek 包。未来 DeepSeek 首发从当时根版本
构建，并通过自己的兼容与真实宿主证据。

## Codex 首版制品

初始公开支持只有 macOS arm64，因此一个 npm 包直接携带一个 Runtime：

```text
dev-flow-codex-<VERSION>.tgz
└── runtime/darwin-arm64/dev-flow
```

首版不建立平台 Runtime npm 子包，不在首次启动下载二进制，也不要求用户安装 Go。

包元数据限定 `darwin`/`arm64`，setup 再次核验实际平台、Runtime、package/Core version 与
Codex 兼容范围。

## 安装与宿主变更边界

```bash
npm install -g dev-flow-codex
dev-flow-codex setup
```

- npm 只安装或删除 package-manager-owned 文件；
- setup/remove 才修改已证明归属的 Codex 注册；
- 禁止 `postinstall`、`preuninstall` 或 shell profile 修改；
- 删除注册与 npm uninstall 默认保留任务数据库；
- 数据清理必须是独立、显式、后续定义的操作。

## 构建一致性

每个 Release 从一个干净 `main` commit/tree 构建两次：

- Go Runtime 字节必须一致；
- npm tarball 解包后的路径、字节、mode 和 metadata 必须一致；
- 原始 `.tgz` 字节一致时记录，但不永久绑定包工具内部 metadata；
- package/Core/plugin/Tag/manifest 使用同一版本与 source identity；
- 生成 `SHA256SUMS`、`release-manifest.json` 和 `publication-record.json`。

Generated release output 不提交到源码树。

## 发布权限与执行位置

发布由明确的本地 operator 命令执行，使用标准 `npm` 与 `gh` 登录状态。

Pull Request CI：

- 不持有 npm/GitHub 发布凭证；
- 不创建 Tag、Release 或 npm version；
- 只运行 schema、package、dry preparation 与普通 repository validation。

未来自动化发布工作流需要独立规格，不从 Feature 006 顺带引入。

## 发布门禁与顺序

1. 003、005 已合并；
2. clean `main` source 与 strict SemVer；
3. npm 包名权限、GitHub 权限和远端冲突预检；
4. 两个 clean worktree 构建/比较；
5. package allowlist、mode、identity、secret/path 扫描；
6. package/lifecycle/Skill/Core/parser 与 release contracts 通过；
7. 生成并验证 manifest/checksum/publication record；
8. operator 精确确认 `v${VERSION}`；
9. 创建或复用精确 Tag 与 GitHub Draft Release；
10. 发布 npm tarball 一次；
11. 从 public registry 下载并验证；
12. 使用 registry package 完成真实 Codex install/setup/create/restart/resume/DONE/remove/
    uninstall/retained-reopen journey；
13. 生成最终 support entry、release manifest 与 `SHA256SUMS`；
14. 上传 GitHub assets；
15. 从官方 asset 路径下载并验证；
16. 全部门禁通过后发布 GitHub Release；
17. 回读最终 Tag/Release identity 并完成本地 publication record。

## 不可变性与失败恢复

- npm 同名同版本不覆盖、不自动 unpublish；
- Tag 不移动；
- 冲突 asset 不覆盖；
- 已完成远端步骤必须先 read-back 再复用；
- 失败记录实际已发布和未发布组件；
- publication record 给出 safe next action；
- 无法安全继续时由维护者决定新 patch version，不伪造事务回滚。

## 支持声明

第一个公开支持表只包含：

- macOS；
- arm64；
- registry package digest；
- bundled Core digest/version；
- 实际最终 journey 的 Codex version；
- Feature 003 定义并再次验证的兼容范围；
- 最终 journey 结果。

Linux、Windows、Intel Mac、DeepSeek 或其他 Host/平台均标记 `UNVERIFIED`。

## DeepSeek 后续发布

Feature 004 恢复并完成后，新的发布 Feature 必须：

- 基于当时 `main` 和已发布 Core；
- 重新验证官方 Harness stable；
- 构建并回读 DeepSeek package；
- 完成独立最终 Harness journey；
- 证明不会破坏已安装 Codex 和共享数据；
- 更新支持表而不篡改历史 Codex Release。

不要回写或重开已经完成的 Feature 006 来发布第二个产品。
