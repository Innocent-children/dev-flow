# Dev Flow Source Authority

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Current Dev Flow behavior is defined by source code, machine-readable schemas, artifact manifests,
and executable tests. Human-readable pages help people understand and evaluate those facts; they are
not parsed as runtime contracts.

| Responsibility | Authority or entry point |
| --- | --- |
| Human overview and evidence map | `README_en.md`, `docs/DEMO_en.md`, `docs/PROJECT-STATUS_en.md` |
| Core product version | `CORE_VERSION` |
| Codex product version | `packages/codex/package.json` |
| DeepSeek product version | `packages/deepseek/package.json` |
| Process nodes, transitions, and guards | `internal/workflow/` |
| Task aggregates and validation | `internal/domain/` |
| SQLite bootstrap, codec, and read-only preflight | `internal/store/` |
| Recovery and blocker reconciliation | `internal/recovery/`, `internal/application/` |
| MCP tools, schemas, and projections | `internal/mcp/` |
| Codex product resources | `packages/codex/` |
| DeepSeek product resources | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| Release schemas and implementation | `release/`, `scripts/release-codex.mjs`, `scripts/release-deepseek.mjs` |
| Stable product support claims | `docs/SUPPORT-MATRIX_en.md` |
| Security reporting and trust boundaries | `SECURITY.md`, `docs/THREAT-MODEL_en.md` |

Historical design and implementation records remain available through Git history. Production code,
build scripts, release scripts, and tests do not parse README files or completed Feature Markdown to
determine runtime behavior.
