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

Install or update Spec Kit to the latest stable release, then initialize before copying this document package:

```bash
uv tool install specify-cli
specify self check
# 若 check 报告存在更新：
specify self upgrade
specify init --here --integration codex --script sh
```

Select the pre-authored feature before launching Codex:

```bash
export SPECIFY_FEATURE_DIRECTORY="specs/001-bootstrap-monorepo"
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

Expected bounded commands after implementation:

```bash
go test ./...
pnpm install --frozen-lockfile
pnpm run validate
```

The validation command must not install a host plugin, create a release, launch Codex/DeepSeek, or
publish a package.

## Verify negative repository contracts

Run the targeted contract cases that use isolated fixtures, for example:

```bash
go test ./tests/contract -run 'TestRepositoryLayoutRejects|TestPackageManifestRejects'
```

The fixtures should cover a nested Go module and a forbidden product lifecycle script without
modifying the real repository tree.

## Completion review

Run:

```text
$speckit-converge
```

Completion requires no product behavior beyond the documented help/version placeholder.
