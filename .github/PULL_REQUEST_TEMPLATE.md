## 问题 / Problem

<!-- 当前行为、合同或文档哪里不正确，影响是什么？ -->

## 修改 / Changes

<!-- 只列出本 PR 实际完成的内容。 -->

## 范围外 / Explicit non-goals

<!-- 明确未修改的表面，便于 reviewer 检查 scope drift。 -->

## 验证 / Validation

<!-- 列出定向检查、人工检查及结果；未运行的检查说明原因。 -->

## 合同与文档引用 / Contract and documentation references

<!-- Product Feature 填写 Feature、FR/SC、合同、任务，以及受影响的文档族；普通修正可写 N/A。 -->

## I18n

<!-- 列出本 PR 同步的 locale。规则见 docs/I18N.md。 -->

## Checklist

- [ ] 变更基于最新 `main`，范围可独立审查。
- [ ] Product Feature 已同步全部根 README locale、`docs/PRODUCT*` 和受影响的技术文档，或本项不适用。
- [ ] 文档事实变更已同步该文档族的所有维护 locale，没有占位翻译或 stale version。
- [ ] 面向用户的 npm 安装示例使用 `@latest`，Support Matrix 与 Release 证据继续保留精确版本。
- [ ] 新增或修改的命令已对照 package manifest、CLI parser、DSH lifecycle、Core parser 或 MCP catalog，并同步 `docs/COMMANDS*`。
- [ ] 验证强度与改动表面、验收条件或已知风险直接相关。
- [ ] 没有扩大 Support Matrix 中的平台、Host 或制品声明。
- [ ] 没有在普通功能或文档 PR 中提升版本、创建 Tag、发布 npm 或操作 GitHub Release。
