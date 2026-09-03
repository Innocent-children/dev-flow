# Dev Flow Documentation Internationalization

[中文](I18N.md) | [English](I18N_en.md)

## Scope

This policy governs human-readable repository documentation; it does not define runtime product
locales. Source code, machine-readable schemas, package manifests, CLI parsers, and executable tests
still define runtime behavior.

## Maintained languages

All nine root README locales are continuously synchronized. Detailed technical documentation keeps
paired English and Simplified Chinese files, including:

- `docs/PRODUCT*`, `docs/DEMO*`, `docs/ROADMAP*`, and `docs/PROJECT-STATUS*`;
- `docs/ARCHITECTURE*`, `docs/COMMANDS*`, `docs/WEBUI*`, and `docs/SUPPORT-MATRIX*`;
- `MANIFEST*`, `CONTRIBUTING*`, and this I18n policy;
- the existing Chinese and English Codex and DeepSeek Host guides.

The English and Simplified Chinese technical documents synchronize product position, current
capability, future direction, commands, platforms, Hosts, and security boundaries.

## Root README locales

The root README family retains these nine locales:

| Locale | Language | File | Maintenance role |
| --- | --- | --- | --- |
| `en` | English | `README.md` | Continuously synchronized default product entry |
| `zh-CN` | Simplified Chinese | `README_zh-CN.md` | Continuously synchronized Simplified Chinese product entry |
| `zh-TW` | Traditional Chinese | `README_zh-TW.md` | Continuously synchronized root README |
| `ja` | Japanese | `README_ja.md` | Continuously synchronized root README |
| `ko` | Korean | `README_ko.md` | Continuously synchronized root README |
| `es` | Spanish | `README_es.md` | Continuously synchronized root README |
| `fr` | French | `README_fr.md` | Continuously synchronized root README |
| `de` | German | `README_de.md` | Continuously synchronized root README |
| `pt-BR` | Brazilian Portuguese | `README_pt-BR.md` | Continuously synchronized root README |

## Synchronization rules

When user-visible behavior or product position changes:

1. synchronize all nine root README locales when product position, capability, commands, selectors,
   platforms, support, or security boundaries change;
2. synchronize the affected paired English and Simplified Chinese technical-document family;
3. update every affected technical reference and Host guide;
4. list every updated locale and technical-document path in the pull-request validation summary.

Other languages cannot add capabilities, platforms, or support claims absent from the current Chinese
and English documents. Commands, selectors, package names, paths, version identities, and Support
Matrix facts do not change in translation.

## Installation commands and version identities

Public installation examples use npm's stable channel:

```text
@imotong/dev-flow@latest
dev-flow-codex@latest
dev-flow-deepseek@latest
```

Exact Core, Codex, DeepSeek, and Dev Flow CLI product versions remain only in machine-readable version
files, package metadata, Release Tags, artifact digests, and release records. Human-readable documents
do not contain exact product versions.

Command documentation must be checked against implementation:

- package names, `bin` entries, and platform constraints come from the relevant `package.json`;
- Codex commands come from `packages/codex/bin/dev-flow-codex.mjs`;
- unified lifecycle commands come from `packages/dev-flow/lib/cli.mjs`;
- DeepSeek installation and removal forms come from DSH lifecycle tests;
- packaged Core commands come from `cmd/dev-flow/main.go`;
- MCP tools come from the closed catalog under `internal/mcp/`.

## Translation invariants

Every locale preserves:

- Dev Flow's primary position and failure scenario;
- the distinction between current capability and future direction;
- commands, selectors, tool names, environment variables, paths, and filenames;
- package, bundled Core, platform, and Host compatibility facts;
- the meaning of capabilities, non-goals, security boundaries, and support claims;
- links to current Simplified Chinese or English technical references.

Narrative prose may be natural for the target language. Identifiers without a stable translation stay
in English; translations do not invent additional product terminology or commitments.

## Review requirements

Documentation changes must at least confirm that:

- every file in the language navigation exists;
- all nine root README files express the same position, capability, commands, support, and boundaries;
- paired Chinese and English technical-document families express the same product facts;
- ordinary installation examples use `@latest`;
- non-English files contain no placeholder translation or whole-section English fallback;
- `docs/COMMANDS*` matches current parsers, lifecycle tests, and the MCP catalog.
