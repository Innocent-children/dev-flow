# Dev Flow Product Support Matrix

This file records current public support separately from source capability and active Feature plans.

| Product surface | Version or contract | Platform / host | Status | Authority |
| --- | --- | --- | --- | --- |
| Go Core | `0.5.0`, current Core contract, current SQLite format, bounded Core limits, `standard-development` | local STDIO | Current source and published Codex runtime | `internal/`, `CORE_VERSION` |
| `dev-flow-codex` | `0.5.0` | macOS arm64, Node.js `>=24` | Publicly supported | npm `dev-flow-codex@0.5.0`, Tag and GitHub Release `v0.5.0` |
| `dev-flow-deepseek` | `0.5.0` publishable source package | exact DSH `0.1.0-rc.8`, macOS arm64 | Source-local acceptance complete; unpublished and not publicly supported until the independent release gate passes | `packages/deepseek/package.json`, `tests/journeys/deepseek/evidence/native-acceptance.json` |

Core, Codex, and DeepSeek product versions are independent identities. Internal compatibility has no
separate version number. A source package version, Core recognition of `host=deepseek`, or successful
deterministic test does not create a DeepSeek support claim.

Feature 010 may produce one source-local unpublished acceptance artifact. Selecting a public
DeepSeek version, publishing npm, creating a Tag or GitHub Release, and adding public support require
a later standalone Release Change with the maintainer's explicit mode and version confirmation.
