# Release Ownership

`release/` owns reviewed release contracts, operator guidance, and bounded test fixtures. Generated
release output is never committed here or elsewhere in the repository.

## Repository-owned content

```text
release/
├── README.md
├── codex/README.md
├── schemas/
│   ├── release-manifest.schema.json
│   └── publication-record.schema.json
└── testdata/
    ├── valid-release-manifest.json
    ├── valid-publication-record.json
    └── invalid-release-fixtures.json
```

The schemas under `specs/006-publish-codex-installable-product/contracts/` remain the planning
authority. The copies under `release/schemas/` are byte-identical implementation inputs, guarded by
Go contract tests. Test fixtures contain only fictional public identities and bounded summaries.

## Generated output boundary

The operator explicitly selects a temporary/output directory for each preparation. That directory
contains generated artifacts and stays outside Git. Release tooling must not infer an output
directory from a user home, the repository, or ambient environment values.

The generated payload roles are:

- `dev-flow-codex-<VERSION>.tgz`: the closed public npm package payload;
- `dev-flow-<VERSION>-darwin-arm64`: the same Core bytes bundled in the tarball, exposed as a
  standalone release asset;
- `release-manifest.json`: immutable source, package, Core, toolchain, inventory, digest, and
  support identity;
- `SHA256SUMS`: digests for the tarball, standalone Core, and final manifest; it does not hash
  itself;
- `publication-record.json`: mutable operator state describing remote observations, completed
  steps, failures, and the safe next action.

The publication record is not a GitHub Release asset. It changes as remote state is observed, while
the tarball, standalone Core, final manifest, and checksum file are immutable release payloads.

## Command boundary

The root package exposes the final command names now so the operator interface is stable:

```text
release:codex:prepare
release:codex:verify
release:codex:publish
```

Tasks T019, T020, and T025 implement their respective script targets. Until then the entries are
declared interfaces, not successful no-op implementations, and neither CI nor ordinary repository
validation invokes them.

Pull-request CI runs preparation-safe schema, fixture, repository, and package contract checks. It
does not read npm/GitHub authentication, prepare real output, publish npm, create a tag, create or
upload a GitHub Release, or run a real Codex Host journey.

Feature 006 has not produced a public release. It covers only `dev-flow-codex` for macOS arm64;
`dev-flow-deepseek`, other platforms, signing, notarization, and publication are outside the current
User Story 1 checkpoint.
