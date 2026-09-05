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

<!-- 列出本 PR 同步的 locale。规则见 docs/I18N.md。 -->

## Checklist

- [ ] 变更基于最新 `main`，范围可独立审查。
- [ ] 用户可见行为变化已同步全部根 README locale、`docs/PRODUCT*` 和受影响的技术文档，或本项不适用。
- [ ] 文档内容已同步到对应的所有维护语言，没有占位翻译或过期版本说明。
- [ ] 面向用户的 npm 安装示例使用 `@latest`，Support Matrix 与 Release 验证记录继续保留精确版本。
- [ ] 新增或修改的命令已对照 package manifest、CLI parser、DSH lifecycle、Core parser 或 MCP catalog，并同步 `docs/COMMANDS*`。
- [ ] 检查范围与实际改动、验收条件或已知风险直接相关。
- [ ] 没有扩大 Support Matrix 中的平台、Host 或安装包支持范围。
- [ ] 没有在普通功能或文档 PR 中提升版本、创建 Tag、发布 npm 或操作 GitHub Release。
