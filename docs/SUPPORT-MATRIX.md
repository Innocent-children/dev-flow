# Dev Flow Product Support Matrix

This file records current public support separately from source capability and active Feature plans.

| Product surface | Version or contract | Platform / host | Status | Authority |
| --- | --- | --- | --- | --- |
| Go Core | `0.5.0`, Core Contract 0.2, Schema 2, Core Limits 0.2, `standard-development@1` | local STDIO | Current source and published Codex runtime | `internal/`, `VERSION` |
| `dev-flow-codex` | `0.5.0` | macOS arm64, Node.js `>=24` | Publicly supported | npm `dev-flow-codex@0.5.0`, Tag and GitHub Release `v0.5.0` |
| `dev-flow-deepseek` | private source package; public version not selected | exact DSH `0.1.0-rc.8`, macOS arm64 | A1 portability CI passed; native attempt 3 timed out before any Core task write; final acceptance blocked and not publicly supported | `specs/010-deepseek-explicit-graph-host/` |

Core contract versions, Codex product versions, and a future DeepSeek public product version are
independent identities. A source package version, Core recognition of `host=deepseek`, or successful
deterministic test does not create a DeepSeek support claim.

Feature 010 may produce one source-local unpublished acceptance artifact. Selecting a public
DeepSeek version, publishing npm, creating a Tag or GitHub Release, and adding public support require
a later standalone Release Change with the maintainer's explicit mode and version confirmation.
