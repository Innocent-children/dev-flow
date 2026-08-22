# Dev Flow Documentation Internationalization

[中文](I18N.md) | [English](I18N_en.md)

## Scope

This policy governs human-readable repository documentation; it does not define runtime product
locales. Source code, machine-readable schemas, artifact manifests, and executable tests remain the
product-behavior authority. Translations present the same facts in different languages.

## Maintained locales

The root README family maintains these nine locales:

| Locale | Language | File | Role |
| --- | --- | --- | --- |
| `zh-CN` | Simplified Chinese | `README.md` | Repository default entry and Chinese version |
| `en` | English | `README_en.md` | English version and source text for other non-Chinese translations |
| `zh-TW` | Traditional Chinese | `README_zh-TW.md` | Fully maintained |
| `ja` | Japanese | `README_ja.md` | Fully maintained |
| `ko` | Korean | `README_ko.md` | Fully maintained |
| `es` | Spanish | `README_es.md` | Fully maintained |
| `fr` | French | `README_fr.md` | Fully maintained |
| `de` | German | `README_de.md` | Fully maintained |
| `pt-BR` | Brazilian Portuguese | `README_pt-BR.md` | Fully maintained |

A new locale requires a complete initial translation, a language-navigation entry, and an ongoing
maintenance commitment. Do not add empty files, placeholder links, or title-only translations.

## Selection principles

The maintained set places a fixed boundary between reach and long-term synchronization cost:

- `zh-CN` and `en` are the primary languages for product and technical documentation;
- `zh-TW`, `ja`, and `ko` cover major East Asian developer communities;
- `es`, `fr`, `de`, and `pt-BR` cover commonly maintained large open-source developer locales;
- the root README receives broader localization, while precise technical references remain focused on
  Simplified Chinese and English;
- a locale without clear maintenance ownership is not added, to prevent version, installation, and
  support claims from drifting over time.

This set is not a runtime language catalog and does not exclude future translations. A new locale must
first satisfy the complete-translation and ongoing-synchronization requirements.

## Documentation coverage matrix

| Document family | Maintained coverage |
| --- | --- |
| Root `README*` | All nine locales above; structure and product facts must remain aligned |
| `docs/PRODUCT*`, `docs/ARCHITECTURE*`, `docs/ROADMAP*`, `docs/SUPPORT-MATRIX*`, and `MANIFEST*` | Simplified Chinese and English |
| Codex / DeepSeek user and installation documentation | The currently paired Simplified Chinese and English files |
| `CONTRIBUTING*` and the I18n policy | Simplified Chinese and English |
| Constitution, `AGENTS.md`, Feature, release, and maintainer contracts | Maintained in their authoritative language; they are not copied into all nine locales unless an explicit pair already exists |

Coverage is an explicit contract rather than an inference from directory names. Once a document
family lists multiple locales, every factual change must update every maintained file in that family.

## Synchronization contract

Every Product Feature that changes user-visible behavior must, in the same pull request:

1. update all nine root README files;
2. update both `docs/PRODUCT.md` and `docs/PRODUCT_en.md`;
3. update Architecture, Support Matrix, Roadmap, host-package README, installation, or invocation
   documentation according to the affected surface;
4. list every documentation path in `tasks.md` and in the pull-request validation summary.

A release that changes public versions, bundled Core identities, platforms, host compatibility,
installation commands, or release evidence must also synchronize every root README plus the affected
support and package documentation before publication.

A documentation-only correction must update every maintained locale containing the same incorrect
statement. A Product Feature, documentation change, or release must not be reported as merge-ready,
Complete, or ready to publish while a maintained translation remains stale.

## Translation invariants

Every locale must preserve:

- commands, selectors, tool names, environment variables, paths, and filenames;
- product versions, bundled Core identities, platforms, and host compatibility;
- nodes, transitions, error codes, schemas, Recovery classifications, and technical identifiers;
- table-row correspondence and factual values;
- command code blocks, Mermaid topology, node IDs, and support claims;
- the meaning of capabilities, non-goals, limitations, and verification evidence.

Narrative prose, headings, and diagram annotations may be adapted to the target language. Links must
preserve the same meaning and may point to the corresponding localized file. Keep identifiers in
English when no stable localized term exists, and do not invent locale-specific product terminology or
additional promises. A translation must not broaden, narrow, or reinterpret product behavior.

## Review requirements

A documentation or product pull request must at least confirm that:

- every file in the language navigation exists and links back to the other locales;
- added, removed, or moved sections are aligned across all root README files;
- versions, commands, platforms, and Support Matrix claims have not drifted;
- non-English README files contain no placeholder text or whole-section English fallback;
- paired Chinese and English technical references express the same facts.
