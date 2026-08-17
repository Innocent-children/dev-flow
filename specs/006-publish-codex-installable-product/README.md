# 006 Publish the Codex Installable Product

**Status**: Deterministic implementation complete — T001–T046 passed. Irreversible real release
T047–T050 remains pending.

Feature 006 defines and implements the first public Dev Flow product contract:
`dev-flow-codex` for macOS arm64. The package and release machinery exist, but no public npm or
GitHub release has been executed.

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

## Entry gate record

Implementation required the following gates, all of which were satisfied before T003:

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

## Deterministic implementation checkpoint — 2026-08-17

T001–T041 are complete across all three user stories:

- User Story 1 establishes the fixed public package, source-free local tgz install, explicit
  setup/remove, unsupported-platform refusal, uninstall separation, and retained task reopen.
- User Story 2 establishes two-clean-worktree preparation, normalized verification, the five-file
  output, exact-confirmation publisher, publish-once, remote reread, atomic record, exact resume,
  and conflict blocking.
- User Story 3 establishes compatible explicit upgrade, downgrade refusal, future SQLite Schema
  safe-stop, unrelated-state retention, registry-only final Journey contract, finalization gate,
  and native-only support-matrix generation.

No real npm publication, Git Tag creation/push, GitHub Draft/Release/asset mutation, registry
read-back, final registry-package Codex journey, or Release finalization has occurred. T001–T046
passed the deterministic merge gate; T047–T050 remain the irreversible operator tasks.

## Evidence labels

- **Real host evidence**: Feature 003 real Codex create/restart/resume/`DONE`/remove acceptance.
- **Deterministic evidence**: Feature 005 recovery tests; Feature 006 local tgz/lifecycle/upgrade;
  fake npm/gh publication/resume/conflict; simulated finalization; final Journey harness contract.
- **Pending real release evidence**: public npm metadata/tarball read-back, native registry-package
  Journey, GitHub asset read-back, public Release, and complete publication record.

Fixture/simulated evidence cannot produce native public support. The mutable publication record is
an operator artifact, is not stored in SQLite, and is not a GitHub Release asset.

## First-release boundary

The first release contains one npm package with one bundled `darwin-arm64` Go runtime. It does not
introduce platform-runtime subpackages, postinstall downloads, background updates, a release daemon,
or a second host product.

Preparation and verification may run repeatedly. Irreversible publication happens only through an
explicit operator command with the exact version confirmation. Pull-request CI never receives npm
or GitHub release credentials.
