# Dev Flow Documentation Internationalization

[中文](I18N.md) | [English](I18N_en.md)

## Scope

This policy governs human-readable repository documentation; it does not define runtime product
locales. Source code, machine-readable schemas, package manifests, CLI parsers, and executable tests
still define runtime behavior.

## Authoritative product-document languages

English and Simplified Chinese are the continuously synchronized product-document languages. The
following families maintain both:

- root `README.md` (English default) and `README_zh-CN.md` (Simplified Chinese);
- `docs/PRODUCT*`, `docs/DEMO*`, `docs/ROADMAP*`, and `docs/PROJECT-STATUS*`;
- `docs/ARCHITECTURE*`, `docs/COMMANDS*`, `docs/WEBUI*`, and `docs/SUPPORT-MATRIX*`;
- `MANIFEST*`, `CONTRIBUTING*`, and this I18n policy;
- the existing Chinese and English Codex and DeepSeek Host guides.

These languages synchronize product position, current capability, future direction, commands,
platforms, Hosts, and security boundaries. Technical references continue to be maintained only in
Simplified Chinese and English.

## Root README locales

The root README family retains these nine locales:

| Locale | Language | File | Maintenance role |
| --- | --- | --- | --- |
| `en` | English | `README.md` | Continuously synchronized default product entry |
| `zh-CN` | Simplified Chinese | `README_zh-CN.md` | Continuously synchronized Simplified Chinese product entry |
| `zh-TW` | Traditional Chinese | `README_zh-TW.md` | Community translation or stable documentation snapshot |
| `ja` | Japanese | `README_ja.md` | Community translation or stable documentation snapshot |
| `ko` | Korean | `README_ko.md` | Community translation or stable documentation snapshot |
| `es` | Spanish | `README_es.md` | Community translation or stable documentation snapshot |
| `fr` | French | `README_fr.md` | Community translation or stable documentation snapshot |
| `de` | German | `README_de.md` | Community translation or stable documentation snapshot |
| `pt-BR` | Brazilian Portuguese | `README_pt-BR.md` | Community translation or stable documentation snapshot |

`README_en.md` is only a compatibility pointer to `README.md`, so old external links keep working;
it is not an English authority and does not appear in locale navigation.

The other seven locales do not promise paragraph-level synchronization with every source commit.
They must accurately retain the core position, main capabilities, boundaries, recommended install
entry, selectors, stable support, and links to authoritative documents. When a translation does not
match current English and Chinese content, its top section must identify it as a stable documentation
snapshot and point readers to `README.md` or `README_zh-CN.md` for current information.

## Synchronization rules

When user-visible behavior or product position changes:

1. synchronize the paired English and Simplified Chinese document families;
2. update every affected technical reference and Host guide;
3. check that the other seven root README files still describe core position, capability, boundary,
   commands, and stable support accurately;
4. update a translation when complete synchronization is available; otherwise retain an accurate
   snapshot notice without expanding or inventing current capability;
5. list updated paths and snapshot locales in the pull-request validation summary.

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
- paired Chinese and English families express the same product facts;
- other root README files do not conflict with the current position, commands, platforms, or
  boundaries;
- snapshot files identify their status and link to current Chinese or English entry points;
- ordinary installation examples use `@latest`;
- non-English files contain no placeholder translation or whole-section English fallback;
- `docs/COMMANDS*` matches current parsers, lifecycle tests, and the MCP catalog.
