# 006 Publish the Codex Installable Product

Feature 006 publishes the first public Dev Flow product: `dev-flow-codex` for macOS arm64.

Feature 004 remains deferred. Feature 006 does not publish `dev-flow-deepseek`, does not modify its
package, and does not claim DeepSeek Harness support. A later feature may complete and publish that
product from the same Monorepo and shared Core.

This directory is a complete Spec Kit package:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/codex-public-package.md`
- `contracts/release-process.md`
- `contracts/release-manifest.schema.json`
- `contracts/publication-record.schema.json`
- `quickstart.md`
- `checklists/requirements.md`
- `tasks.md`

## Entry gate

Implementation starts only after:

1. Feature 003 is merged and the local Codex package journey remains green;
2. Feature 005 is complete and merged;
3. the intended npm package name `dev-flow-codex` is verified as publishable by the authorized
   maintainer account;
4. the current Codex compatibility contract is copied from the merged Feature 003 artifacts;
5. the release operator has working npm and GitHub authentication.

Package-name ownership is a preflight, not a fallback naming algorithm. If the authorized account
cannot publish `dev-flow-codex`, stop and amend the specification rather than silently choosing a
different public identity.

## T002 Read-Only Permission Preflight — 2026-08-17

Initially checked at `2026-08-17T04:46:57Z` and rerun after operator authentication at
`2026-08-17T04:53:49Z`, using only read-only npm, Git, and GitHub CLI operations. No credential,
authentication header, email, npm configuration file, or raw authentication output was recorded.

| Check | Result | Bounded observation |
|---|---|---|
| npm registry | PASS | Every registry query explicitly used `https://registry.npmjs.org/`; the active npm registry setting also identified the official registry. |
| npm reachability | PASS | The official registry responded to the bounded ping. |
| npm account | PASS | `npm whoami` identified account `imotong` after the operator authenticated outside the implementation session. |
| Fixed package name | PASS | `dev-flow-codex` returned explicit `E404` and was unoccupied at both check times. The authenticated account may claim the unowned fixed package name through the later explicitly authorized publication task. |
| Exact version | PASS for absence | `dev-flow-codex@0.1.0` returned explicit `E404`; no immutable version conflict was observed. |
| GitHub account | PASS | GitHub CLI was authenticated as `Innocent-children`. |
| Repository permission | PASS | The repository reported `push=true`, `maintain=true`, and `admin=true`; no administrative override was used. |
| Tag observation | PASS for absence | `v0.1.0` was absent from the remote tag namespace. |
| Release observation | PASS for absence | GitHub Release `v0.1.0` was not found. |

Overall T002 result: **PASS**. The first attempt stopped before T003 because npm authentication was
absent. The authenticated rerun passed without changing npm, Git tag, or GitHub Release state.

## First-release boundary

The first release contains one npm package with one bundled `darwin-arm64` Go runtime. It does not
introduce platform-runtime subpackages, postinstall downloads, background updates, a release daemon,
or a second host product.

Preparation and verification may run repeatedly. Irreversible publication happens only through an
explicit operator command with the exact version confirmation. Pull-request CI never receives npm
or GitHub release credentials.
