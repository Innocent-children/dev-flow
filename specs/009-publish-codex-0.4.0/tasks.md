# Tasks: Publish Codex 0.4.0

**Input**: Complete feature package from `specs/009-publish-codex-0.4.0/`

**Organization rule**: Tasks are grouped by contract foundation, one-command publication, public
graph-release evidence, and final source/publication gates.

## Phase 1: Governance and Contract Freeze

**Goal**: Make the Release Feature implementation-ready without changing production files.

- [x] T001 Review all markers in `specs/009-publish-codex-0.4.0/checklists/requirements.md` and `specs/009-publish-codex-0.4.0/checklists/release.md`; require zero unchecked items per Constitution X.
- [x] T002 Freeze `specs/009-publish-codex-0.4.0/spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/`; run JSON parsing and `git diff --check -- specs/009-publish-codex-0.4.0` per FR-001–FR-016.
- [x] T003 Run `$speckit-analyze` over `specs/009-publish-codex-0.4.0/spec.md`, `plan.md`, and `tasks.md`; resolve every CRITICAL/HIGH and acceptance-impacting MEDIUM finding per Constitution Development Workflow.

**Checkpoint**: Feature 009 is `Ready`; no production file has changed.

---

## Phase 2: Release Identity and Manifest Foundation

**Goal**: Align current source identity to `0.4.0` and replace obsolete current release metadata with
the closed graph-release identity.

- [x] T004 [P] Update current version authorities in `VERSION`, `package.json`, `packages/codex/package.json`, `packages/codex/plugin/.codex-plugin/plugin.json`, and `packages/deepseek/package.json`; update current-version assertions and graph fixtures in `tests/contract/package_manifest_test.go`, `internal/mcp/phase5d_hardening_test.go`, `packages/codex/tests/package-contract.test.mjs`, `protocol/fixtures/graph-server-info.json`, `packages/codex/tests/fixtures/fake-core.mjs`, and `packages/codex/tests/fixtures/graph-method-profiles.json` while preserving historical literals per FR-001–FR-003, FR-013, and SC-002.
- [x] T005 [P] Mirror `specs/009-publish-codex-0.4.0/contracts/release-manifest.schema.json` into `release/schemas/release-manifest.schema.json` and update `tests/contract/release_contract_test.go` for the current Schema 2 authority while leaving `specs/006-publish-codex-installable-product/contracts/` and `release/testdata/` frozen at their historical identities per FR-011 and FR-013.
- [x] T006 Update manifest construction and validation in `scripts/verify-codex-release.mjs` to bind Feature 008 commit `872cdcfc2d40dd06fa7e85109d5f69e08de4ceda`, Core Contract 0.2, Schema 2, snapshot v2, and `standard-development@1`; update affected release tests in `packages/codex/tests/package-contract.test.mjs`, `release-package.test.mjs`, and `release-publication.test.mjs` per FR-003, FR-011, and SC-003–SC-004.
- [x] T007 Run `go test ./tests/contract`, `node --test packages/codex/tests/package-contract.test.mjs packages/codex/tests/release-package.test.mjs packages/codex/tests/release-publication.test.mjs`, JSON parsing, Node syntax checks, and `git diff --check`; record the foundation checkpoint in `specs/009-publish-codex-0.4.0/tasks.md` per SC-002–SC-004.

**Checkpoint**: Current identities and release manifest report `0.4.0` graph truth; no remote release
operation has run.

### Foundation Evidence — 2026-08-20

- Five current workspace authorities and current graph fixtures report `0.4.0`; frozen Feature 006
  Schema 1 contracts and `release/testdata/` remain unchanged.
- The current planning and implementation release-manifest schemas are byte-identical Schema 2 and
  bind Feature 008 commit, Contract 0.2, Schema 2, snapshot v2, and `standard-development@1` digest.
- `go test ./tests/contract` passed. The three targeted Node files passed 30/30 tests, including two
  clean-worktree preparation and the complete fake-remote publication state machine.
- JSON parsing, verifier syntax, and `git diff --check` passed. No npm, Tag, GitHub, or Host mutation
  ran.

---

## Phase 3: User Story 1 - Publish from one command (Priority: P1)

**Goal**: Start or resume the complete release with one root command.

**Independent Test**: Isolated command tests prove exact argument/source/path gates, missing/empty
preparation, exact five-file resume, child-command order, confirmation forwarding, and failure
preservation without real npm or GitHub mutation.

- [x] T008 [US1] Add command-contract tests in `packages/codex/tests/release-command.test.mjs` covering required flags, strict confirmation, clean pushed `main`, version-authority mismatch, output-state routing, exact child order, and bounded errors per FR-004–FR-007 and SC-001.
- [x] T009 [US1] Implement the thin orchestrator in `scripts/release-codex.mjs` with Node.js standard library only; delegate preparation, verification, and production publication to their existing owners per `contracts/one-command-release.md`, FR-004–FR-010, and SC-006.
- [x] T010 [US1] Add root `release:codex` and preparation-safe syntax/test coverage in `package.json`, `scripts/validate-repository.sh`, and `tests/contract/release_contract_test.go`; keep CI free of publisher execution per FR-015.
- [x] T011 [US1] Replace multi-command operator guidance with the one-command contract in `release/README.md`, `release/codex/README.md`, and `docs/RELEASE-STRATEGY.md` per FR-004, FR-014, and SC-001.
- [x] T012 [US1] Run `node --test packages/codex/tests/release-command.test.mjs packages/codex/tests/release-publication.test.mjs`, `go test ./tests/contract`, `node --check scripts/release-codex.mjs`, and `git diff --check`; record the User Story 1 checkpoint in `specs/009-publish-codex-0.4.0/tasks.md` per SC-001 and SC-006.

**Checkpoint**: One command safely prepares or resumes the release in deterministic tests; no real
publication has run.

### User Story 1 Evidence — 2026-08-20

- `release:codex` accepts exactly one absolute output and exact Tag confirmation, validates aligned
  versions and clean pushed `main`, prepares missing/empty output, and resumes only an exact five-file
  directory before delegating to the existing publisher.
- New command tests passed 10/10. The combined command/publisher suite passed 28/28, including
  publish-once, delayed registry visibility, record loss, exact resume, immutable conflicts, Journey
  gate, four-asset read-back, and finalization recovery.
- `go test ./tests/contract`, Node syntax, and `git diff --check` passed after registering the new
  script/test/package key in all three exact repository allowlists.
- CI and ordinary validation syntax-check and test the injected command path but never execute the
  production entrypoint. No real remote or Host mutation ran.

---

## Phase 4: User Story 2 - Install the verified graph release (Priority: P2)

**Goal**: Make the `0.4.0` source package and final registry Journey accurately represent Feature 008
graph behavior and the supported installer boundary.

**Independent Test**: Package/Journey harness tests prove current `0.4.0` package/Core identity,
closed contents, dynamic final-registry version checks, fresh Schema 2 graph completion, uninstall,
and retained reopen without claiming public evidence before publication.

- [x] T013 [P] [US2] Update current public product and installation statements in `README.md`, `MANIFEST.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `packages/codex/README.md`; distinguish public `0.4.0` graph availability from frozen `0.3.0` history and retain the Schema 1 safe-stop per FR-012–FR-014 and FR-S001–FR-S003.
- [x] T014 [US2] Add or update current-version final-registry and package evidence coverage in `packages/codex/tests/journey-harness.test.mjs`, `packages/codex/tests/release-package.test.mjs`, and `packages/codex/tests/package-contract.test.mjs`; preserve Feature 008 final-local `0.3.0` evidence literals per FR-003, FR-008, FR-013, and SC-004–SC-005.
- [x] T015 [US2] Run `node --test packages/codex/tests/package-contract.test.mjs packages/codex/tests/release-package.test.mjs packages/codex/tests/journey-harness.test.mjs`, `go test ./tests/contract ./tests/journeys`, one `pnpm --dir packages/codex run build:local --output ABSOLUTE_EMPTY_EXTERNAL_DIRECTORY`, and `git diff --check`; record the User Story 2 source checkpoint in `specs/009-publish-codex-0.4.0/tasks.md` per SC-002, SC-004, and SC-005.

**Checkpoint**: The source-built `0.4.0` package is release-ready; registry/native/public evidence
remains pending.

### User Story 2 Source Evidence — 2026-08-20

- Current public/product/architecture/roadmap/package docs describe `0.4.0`, Codex-only macOS arm64,
  standard registry installation, and Feature 008's unchanged Schema 1 zero-write safe-stop.
- Package, release-package, and Journey harness checks passed 47/47. `go test ./tests/contract
  ./tests/journeys` passed, including current graph contracts and deterministic process journeys.
- The first local build command exposed a literal pnpm `--` argument unsupported by the shell
  builder. The operator command and current package README were corrected to `run build:local
  --output`; only that failed gate was rerun.
- The corrected external non-final build produced `dev-flow-codex-0.4.0.tgz`, SHA-256
  `4a4f3714db55e3534adfae6891f1b4bf0f30903c5aeb009e26630afced41e84b`, with package/Core `0.4.0`,
  source-dirty test label, and no remote or Host mutation. `git diff --check` passed.

---

## Phase 5: Final Source and Public Release Gate

**Goal**: Freeze one verified clean source, publish it once through the one-command entrypoint, and
record exact public evidence.

- [x] T016 Run the initial `pnpm run validate`; after its recorded literal-current-version fixture failure, run `go test ./internal/mcp`, then run the one authorized `pnpm run validate` retry and record toolchain and both outcomes in `specs/009-publish-codex-0.4.0/tasks.md` per FR-016 and SC-007.
- [x] T017 Run `$speckit-converge` against the implemented source; append only concrete missing work and require a zero-gap result before publication per Constitution Development Workflow.
- [x] T018 Update `specs/009-publish-codex-0.4.0/README.md`, `spec.md`, and `tasks.md` to the clean-source checkpoint; commit all source changes directly on `main`, push the exact commit to `origin/main`, and require `HEAD == origin/main` with an empty worktree per FR-003, FR-016, and SC-007.
- [ ] T019 Execute `pnpm run release:codex -- --output /Users/innocent-children/dev-flow-releases/v0.4.0 --confirm v0.4.0` exactly once from the clean source; preserve the directory and stop truthfully on failure per FR-004–FR-010.
- [ ] T020 Verify npm `dev-flow-codex@0.4.0`, Tag `v0.4.0`, final registry-package Journey, final manifest/checksums, four GitHub asset read-backs, public GitHub Release, complete nine-step `publication-record.json`, unchanged historical `v0.3.0`, and a clean repository per FR-008–FR-013 and SC-003–SC-007.
- [ ] T021 Record bounded public identities, digests, timestamps, support, and completion in `specs/009-publish-codex-0.4.0/README.md` and `tasks.md`; update `MANIFEST.md` and current public docs if observed facts require it; mark Feature 009 `Complete`, commit the evidence-only changes on `main`, and push without moving Tag `v0.4.0` per FR-013–FR-014 and SC-003–SC-007.

**Checkpoint**: `dev-flow-codex@0.4.0` and GitHub Release `v0.4.0` are public, verified, and bound to
one frozen source commit; Feature 009 is complete.

### Repository Validation Evidence — 2026-08-20

- Initial `pnpm run validate` passed whitespace, formatting, source/script allowlists, release syntax,
  release contracts, package contract 9/9, one-command contract 10/10, Go inventory, and vet. Its
  `go test ./...` stage found one current ServerInfo test still constructing literal `0.3.0` while the
  approved current fixture reported `0.4.0`.
- The failure had no remote or Host effect. `internal/mcp/phase5d_hardening_test.go` now reads root
  `VERSION`; `go test ./internal/mcp` passed before the authorized retry.
- The one authorized `pnpm run validate` retry passed completely on Go 1.26.6 darwin/arm64, Node
  24.18.0, and pnpm 11.21.0. It included `go vet ./...`, `go test ./...`, frozen workspace install,
  workspace inventory at `0.4.0`, and both package dry-packs.

## Dependencies and Execution Order

```text
Contract freeze
      ↓
Release identity and manifest
      ↓
One-command publication
      ↓
Graph package source readiness
      ↓
One full validation + converge
      ↓
Clean main commit/push
      ↓
One-command public release
      ↓
Evidence-only completion commit
```

- Phase 2 must finish before the command can prepare a truthful `0.4.0` manifest.
- User Story 1 must finish before the real operator command exists.
- User Story 2 source evidence must finish before the source is frozen.
- T019–T020 are the only tasks authorized to create or observe irreversible public `0.4.0` state.
- T021 records evidence and cannot change the frozen Tag or published bytes.

## Test Budget

| Scope | Maximum / Rule |
| --- | --- |
| Targeted package checks | One run per implementation checkpoint; rerun only after a recorded fix |
| Repository-wide validation | Exactly one before the release source commit |
| Production real-host journeys | Exactly one, invoked by the confirmed publisher |
| Unsupported platform/Host matrices | Excluded |

## Notes

- A checked task means its exact result and required evidence are complete.
- Checklist markers are requirements-quality review state, not implementation progress.
- Generated release output and publication records remain outside Git.
- Historical Feature 001–008 and release evidence are not rewritten.
