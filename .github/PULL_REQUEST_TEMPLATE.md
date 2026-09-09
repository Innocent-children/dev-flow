## 问题 / Problem

<!-- 当前行为、约定或文档哪里不正确，影响是什么？ -->

## 修改 / Changes

<!-- 只列出本 PR 实际完成的内容。 -->

## 范围外 / Explicit non-goals

<!-- 说明本次修改不涉及哪些内容，方便评审者确认有没有扩大范围。 -->

## 验证 / Validation

<!-- 列出定向检查、人工检查及结果；未运行的检查说明原因。 -->

## 接口与文档说明 / Interface and documentation references

<!-- 列出验收条件、对应测试或接口规范，以及受影响的文档；普通修正可写 N/A。 -->

## I18n

<!-- 列出受影响文档族及同步的语言；README 内容变化时同步 9 种语言。文档职责见 AGENTS.md，语言范围见 docs/I18N.md。 -->

## Checklist

- [ ] 变更基于最新 `main`，范围可独立审查。
- [ ] 已按职责更新受影响的使用说明、产品定义或技术参考；README 仅在项目介绍、安装、常用操作或必要限制变化时更新，并同步 9 种语言。
- [ ] 受影响文档族已同步对应的维护语言；README 中没有仓库 AI 工作规则或本次实现、验证记录。
- [ ] 面向用户的 npm 安装示例使用 `@latest`，Support Matrix 与 Release 验证记录继续保留精确版本。
- [ ] 新增或修改的命令已对照 package manifest、CLI parser、DSH lifecycle、Core parser 或 MCP catalog，并同步 `docs/COMMANDS*`。
- [ ] 检查范围与实际改动、验收条件或已知风险直接相关。
- [ ] 没有扩大 Support Matrix 中的平台、Host 或安装包支持范围。
- [ ] 没有在普通功能或文档 PR 中提升版本、创建 Tag、发布 npm 或操作 GitHub Release。
