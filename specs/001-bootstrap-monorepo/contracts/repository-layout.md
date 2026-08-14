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

- `.github` contains pull-request validation only and has no publication authority.
- `.specify` and `.agents` contain the single root Spec Kit project and its generated Codex
  integration assets.
- `cmd/dev-flow` contains the only executable entry point in this feature.
- `internal` contains shared Go code and must not import host packages.
- `packages/codex` and `packages/deepseek` contain only their own package metadata and bootstrap
  documentation.
- `protocol/fixtures` reserves shared public-contract ownership but contains no product schema yet.
- `tests/contract` owns repository and package boundary tests.
- `release` contains documentation only; it performs no release action in this feature.
- `scripts` contains repository-development validation only.
- `docs` contains repository-wide product and architecture documentation.
- `specs` contains the single numbered Spec Kit feature sequence.

## Invalid Layout Conditions

Repository validation must reject:

- any nested `.specify/` directory below the root project;
- any nested `go.mod`;
- an executable source root other than `cmd/dev-flow`;
- host package source that imports or embeds shared core implementation during this feature;
- any non-empty host-package `scripts` field, regardless of script name;
- a host package `bin` entry;
- a host package production/runtime dependency;
- a publishable root package;
- a host package that is not private;
- a CI workflow that invokes publication or uses release credentials in pull-request jobs.

Each violation must identify the affected path or manifest field.

Forbidden-layout contract fixtures must describe or materialize invalid paths only inside an
isolated temporary repository during the test. The valid project tree must not check in an actual
nested `.specify/` directory or nested `go.mod` merely to test their rejection.

## Go Contract

- one `go.mod` at repository root;
- module path selected by repository owner;
- no nested `go.mod`;
- `cmd/dev-flow` is the only executable;
- `internal/version` reads the root `VERSION` directly from the repository checkout for the
  Feature 001 placeholder; release-time embedding or linker injection is deferred to feature `006`;
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

Workspace installation uses `pnpm install --frozen-lockfile --ignore-scripts` so dependency
lifecycle scripts cannot run during bounded validation.

Each host-product package:

- `private: true`;
- allowed metadata includes `name`, `version`, `description`, `license`, `private`, and, when
  genuinely needed by a later change, `devDependencies`;
- no non-empty `scripts` field of any kind;
- no `bin` entry;
- no `dependencies`, `optionalDependencies`, `peerDependencies`, or `publishConfig` field;
- package name identifies the product boundary;
- README states that the package is not yet installable;
- dry-pack contains only `package.json`, `README.md`, and the root `LICENSE` automatically included
  by pnpm; no copied license file is added to the package source directory;
- dry-pack uses `pnpm --config.ignore-scripts=true --dir <package> pack --dry-run --json` so
  `prepack`, `prepare`, `postpack`, and any other package script cannot execute.

The bounded validation entry point MUST NOT execute product-package or dependency-package lifecycle
scripts during installation or package packing.

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
