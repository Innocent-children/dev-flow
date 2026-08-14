# Contract: Repository Layout

## Required Root Paths

```text
.github/workflows/
.specify/memory/
.agents/skills/
cmd/dev-flow/
internal/
packages/codex/
packages/deepseek/
protocol/fixtures/
tests/contract/
release/
scripts/
docs/
specs/
```

`.specify/scripts/`, `.specify/templates/`, and `.agents/skills/` are Spec Kit managed assets.
Their exact generated file list is not part of the product contract.

## Ownership Rules

- `cmd/dev-flow` contains the only executable entry point in this feature.
- `internal` contains shared Go code and must not import host packages.
- `packages/codex` and `packages/deepseek` contain only their own package metadata and bootstrap
  documentation.
- `protocol/fixtures` reserves shared public-contract ownership but contains no product schema yet.
- `tests/contract` owns repository and package boundary tests.
- `release` contains documentation only; it performs no release action in this feature.
- `scripts` contains repository-development validation only.

## Invalid Layout Conditions

Repository validation must reject:

- any nested `.specify/` directory below the root project;
- any nested `go.mod`;
- an executable source root other than `cmd/dev-flow`;
- host package source that imports or embeds shared core implementation during this feature;
- a host package `postinstall`, `preinstall`, `install`, or `prepare` lifecycle script;
- a host package `bin` entry;
- a host package production/runtime dependency;
- a publishable root package;
- a host package that is not private;
- a CI workflow that invokes publication or uses release credentials in pull-request jobs.

Each violation must identify the affected path or manifest field.

## Go Contract

- one `go.mod` at repository root;
- module path selected by repository owner;
- no nested `go.mod`;
- `cmd/dev-flow` is the only executable;
- `internal/version` reads the root version through an explicit build-time mechanism;
- no MCP or SQLite dependency.

## pnpm Contract

Root `pnpm-workspace.yaml` includes:

```yaml
packages:
  - packages/*
```

Root `package.json`:

- `private: true`;
- `engines.node` accepts supported Node.js `>=24`;
- `engines.pnpm` accepts `>=11 <12`;
- no contract requires an exact pnpm patch version;
- scripts limited to repository-development validation;
- no production dependency.

Each host-product package:

- `private: true`;
- no lifecycle install/build script;
- no `bin` entry;
- no runtime dependency;
- package name identifies the product boundary;
- README states that the package is not yet installable.

## CI Contract

Pull-request CI may:

- checkout source;
- install Go and Node/pnpm;
- restore dependency caches;
- run repository validation.

It may not:

- publish npm;
- create GitHub releases or tags;
- execute host applications;
- modify user configuration;
- use release credentials.
