# Quickstart: Bootstrap Monorepo

## Prerequisites

```text
Git
Go >= 1.26
Node.js >= 24 on a supported release line
pnpm >= 11 and < 12
Latest stable Spec Kit
Codex CLI
```

## Prepare the repository

Run from the root of the current Monorepo checkout. Do not create another repository or copy this
feature package into a different project:

```bash
cd "$(git rev-parse --show-toplevel)"
```

Install Spec Kit only when it is not already available, then check the installed stable release:

```bash
command -v specify >/dev/null 2>&1 || uv tool install specify-cli
specify self check
# 若 check 报告存在更新：
specify self upgrade
```

Keep the existing root initialization when `.specify/scripts/`, `.specify/templates/`, and at least
one `.agents/skills/speckit-*/SKILL.md` are present. Only when one of those generated asset groups is
missing, initialize the current checkout while preserving the existing repository documents:

```bash
specify init --here --integration codex --script sh
```

Select the pre-authored feature before launching Codex:

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/001-bootstrap-monorepo"
```

Do not handcraft `.specify/feature.json`; Spec Kit owns that state when a feature is created through
`$speckit-specify`.

## Review gates

Inside Codex:

```text
$speckit-clarify
$speckit-checklist
$speckit-analyze
```

Resolve every blocking finding before implementation.

## Implement in slices

First:

```text
$speckit-implement
Implement only Phase 1: Setup. Do not start Phase 2. Run only Phase 1 validation and stop.
```

Then implement Foundational and each user story separately.

## Validate locally

The local and pull-request bounded validation entry point is:

```bash
pnpm install --frozen-lockfile
pnpm run validate
```

The validation command must not install a host plugin, create a release, launch Codex/DeepSeek, or
publish a package.

## Verify negative repository contracts

Run the targeted contract cases that use isolated fixtures:

```bash
go test ./tests/contract -run '^TestRepositoryLayoutRejects/(nested_\.specify|nested_go\.mod)$'
go test ./tests/contract -run '^TestProductManifestFixtures/(lifecycle_script|runtime_dependency)$'
go test ./tests/contract -run '^TestRepositoryRelativeMarkdownLinks$'
```

These tests pass only when the isolated nested `.specify`, nested `go.mod`, product lifecycle
script, and product runtime dependency fixtures are rejected. They do not modify the real
repository tree.

## Final Feature 001 verification

At the final Feature 001 checkpoint, run each required check once from the repository root:

```bash
git diff --check
go vet ./...
go test ./...
pnpm install --frozen-lockfile
pnpm run validate
go run ./cmd/dev-flow --help
go run ./cmd/dev-flow version
```

The two `go run` commands must show only the Feature 001 help/version placeholder and must state
that task and MCP functionality is not implemented.

## Completion review

Run:

```text
$speckit-converge
```

Completion requires no product behavior beyond the documented help/version placeholder.
