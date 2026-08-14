# 双产品发布策略

## 发布产品

Monorepo 发布两个独立产品：

```text
dev-flow-codex
dev-flow-deepseek
```

两者从同一源码提交构建共享 Go Core，但拥有独立宿主资源、安装入口、包合同和真实宿主
验收。

## 0.x 版本策略

公共合同稳定前采用同步版本：

```text
Git tag                 v${VERSION}
Go Core                 ${VERSION}
dev-flow-codex          ${VERSION}
dev-flow-deepseek       ${VERSION}
```

`${VERSION}` 始终读取根 `VERSION` 的当前合法 SemVer；文档、测试和安装器不得永久断言某个首发字面值。

同步版本减少需要验证的组合，不要求两个产品采用相同安装方式。

## 产品自包含

每个产品包携带对应平台的 Go Runtime，不要求用户预装：

- Go；
- Python；
- uv；
- 单独的 Dev Flow 后端；
- 另一个宿主产品。

首版允许两个产品包各自包含同一 Runtime。暂不发布第三个共享 Runtime npm 产品。

## Codex 安装边界

建议体验：

```bash
npm install -g dev-flow-codex
dev-flow-codex setup
```

`npm install` 只安装产品文件；`setup` 才明确注册 Codex plugin、Skill 和 MCP。禁止
`postinstall` 静默修改宿主配置。

## DeepSeek 安装边界

建议体验：

```bash
dsh plugin add dev-flow-deepseek@latest
```

DSH bundle 指向包内 Runtime，或在宿主需要时指向包内 Projection Proxy。删除插件不得
删除 Dev Flow 任务数据库；数据清理必须是单独显式操作。

## 平台支持

首个公开 `0.x` Release 只声明完成最终安装、任务创建、宿主重启、任务恢复、完成与删除 journey 的
平台。初始目标为 macOS arm64。Linux 和 Windows 通过各自规格和真实证据后加入支持表。

## 构建资产

一个版本至少生成：

```text
平台 Go Runtime
Codex npm tarball
DeepSeek npm tarball
checksums
release manifest
```

发布计划阶段再确定平台包拆分方式。所有资产必须能追溯到一个源码提交和一个产品版本。

## 发布门禁

1. 工作区无未提交变更；
2. `VERSION`、Go Runtime 与两个 package version 一致；
3. source commit 固定；
4. Runtime 从临时干净 checkout 构建；
5. 平台资产与两个 package tarball 内容闭合；
6. package contract、checksum 和启动 smoke 通过；
7. Codex 最终包真实 journey 通过；
8. DeepSeek 最终包真实 journey 通过；
9. GitHub Draft Release 创建；
10. 上传资产通过官方渠道重新下载并校验；
11. npm 包按批准顺序发布并 read-back；
12. 全部证据通过后发布 GitHub Release。

## 不可变性

- 已发布 Tag 不移动；
- npm 同名同版本不覆盖；
- 失败后使用新 patch 版本；
- 未验证资产不标记为正式；
- PR CI 不持有发布权限；
- 发布是显式 operator action。

## 升级与删除

首版升级由包管理器安装新版本并重新执行必要 setup。产品必须：

- 保留任务数据库；
- 先验证新 Runtime 可启动，再完成宿主注册切换；
- 删除产品文件时保留任务数据；
- 明确报告需要用户手工处理的宿主状态。

不要在首版建设通用后台更新、任意版本回滚或复杂事务安装平台。

## 1.0 后的版本独立

只有满足以下条件后才允许两个产品独立版本：

- Core protocol 稳定；
- product manifest 能声明兼容 Core range；
- 两个宿主存在不同 release cadence 的真实需要；
- 共享 fixture 可验证允许组合；
- 组合数量仍在可测试范围内。
