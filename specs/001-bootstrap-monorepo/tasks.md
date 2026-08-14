---
description: "Task list for bootstrapping the Dev Flow Monorepo"
---

# Tasks: Bootstrap Monorepo

**Input**: Design documents from `/specs/001-bootstrap-monorepo/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Only the bounded repository, package, layout, and documentation checks required by the
specification are included.

**Organization**: Tasks are grouped by independently testable user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no unmet dependency.
- **[Story]**: Maps the task to a user story.
- Every task names the exact path to change.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish repository metadata and toolchain roots without product behavior.

- [x] T001 Create root `LICENSE` with Apache-2.0 text.
- [x] T002 Create root `VERSION` with one valid initial pre-1.0 SemVer, and ensure validation reads the current file rather than asserting a permanent literal.
- [x] T003 Create root `go.mod` with the approved module path and `go 1.26` language floor; do not add an exact patch-level `toolchain` directive.
- [x] T004 Create private root `package.json` with `engines.node: >=24` and `engines.pnpm: >=11 <12`; do not require one exact pnpm patch through `packageManager`.
- [x] T005 Create `pnpm-workspace.yaml` including only `packages/*`.
- [x] T006 Create root `.gitignore` for Go, Node, editor, build, package, and local Spec Kit runtime
  artifacts without ignoring specifications or lockfiles.
- [x] T007 Verify `.specify/memory/constitution.md` and generated
  `.agents/skills/speckit-*` are present; do not edit generated Skills.
- [x] T008 Select `specs/001-bootstrap-monorepo` through `SPECIFY_FEATURE_DIRECTORY` for the
  implementation session; do not handcraft Spec Kit-managed feature state.

**Checkpoint**: Toolchain and Spec Kit roots exist; no product source package exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish ownership areas and repository-contract validation shared by all stories.

- [x] T009 Create ownership directories and explanatory README files under `internal/`,
  `protocol/fixtures/`, `tests/contract/`, `release/`, and `scripts/`.
- [x] T010 Create `scripts/validate-repository.sh` that orchestrates Go, pnpm, package,
  repository-contract, and documentation checks without installation or publication.
- [x] T011 [P] Create `tests/contract/repository_layout_test.go` for required paths, ownership rules,
  nested `.specify/`, nested `go.mod`, extra host source, and executable-root constraints.
- [x] T012 [P] Create `tests/contract/package_manifest_test.go` for private-package, lifecycle-script,
  `bin`, runtime-dependency, and root-publishability constraints, with every violation naming its
  manifest path and field.
- [x] T013 [P] Create `tests/contract/markdown_links_test.go` for repository-relative links in root,
  `docs/`, and active specification documents.
- [x] T014 Create root validation scripts in `package.json` that call repository-owned commands and
  do not add a task-runner framework.
- [x] T015 Create `.github/workflows/ci.yml` for pull requests using the current stable Go compatible with the `go 1.26` floor, current Node LTS `>=24`, and current pnpm 11.x.
- [x] T016 Ensure `.github/workflows/ci.yml` has read-only repository permission and no release or
  npm credentials.

**Checkpoint**: Repository contracts can fail before user-story implementation begins.

---

## Phase 3: User Story 1 - Initialize a governed repository (Priority: P1) 🎯 MVP

**Goal**: A contributor can identify product boundaries, ownership, and Spec Kit governance from the
repository itself.

**Independent Test**: Run repository-layout and Markdown-link contract tests against the project and
isolated invalid fixtures.

### Tests for User Story 1

- [x] T017 [P] [US1] Add positive required-path and ownership cases to
  `tests/contract/repository_layout_test.go`.
- [x] T018 [P] [US1] Add fixture descriptors under
  `tests/contract/testdata/repository-layout/` for isolated temporary repositories containing a
  nested `.specify/`, nested `go.mod`, extra executable root, or unexpected host source; do not
  check forbidden paths into the valid repository tree.
- [x] T019 [US1] Verify in `tests/contract/repository_layout_test.go` that each invalid fixture under
  `tests/contract/testdata/repository-layout/` reports the exact path and violated contract.

### Implementation for User Story 1

- [x] T020 [US1] Finalize root `README.md` with product definition, setup, feature selection,
  validation commands, and document index.
- [x] T021 [P] [US1] Finalize root `AGENTS.md` with authority, requirement-scope, Git, test-budget,
  and Spec Kit rules.
- [x] T022 [P] [US1] Finalize directory ownership and dependency direction in
  `docs/ARCHITECTURE.md`.
- [x] T023 [US1] Run the synthetic positive and isolated negative cases in
  `tests/contract/repository_layout_test.go` together with
  `tests/contract/markdown_links_test.go`; full-checkout required paths remain the Phase 5 checkpoint
  after `cmd/dev-flow` and both product packages exist.

**Checkpoint**: User Story 1 is independently complete; repository governance and ownership are
self-contained.

---

## Phase 4: User Story 2 - Establish one core and two product packages (Priority: P2)

**Goal**: The tree proves one future core and two thin products without claiming runtime behavior.

**Independent Test**: Build/test the placeholder Go command and dry-pack both private packages.

### Tests for User Story 2

- [x] T024 [P] [US2] Create `internal/version/version_test.go` for strict SemVer parsing and dynamic use of the current root `VERSION`, with no hard-coded product-version literal.
- [x] T025 [P] [US2] Create `cmd/dev-flow/main_test.go` verifying help/version output and
  nonfunctional messaging.
- [x] T026 [P] [US2] Add positive and negative product-manifest fixtures to
  `tests/contract/package_manifest_test.go`, including lifecycle, `bin`, and runtime dependency
  cases that assert the manifest path and violated field.

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement `internal/version/version.go` to read the current root `VERSION`
  directly from the repository checkout, with no duplicated Go version literal or release framework.
- [x] T028 [US2] Implement `cmd/dev-flow/main.go` with only help and `version`; task and MCP
  invocations must report that the capability is not implemented.
- [x] T029 [P] [US2] Create private `packages/codex/package.json` and
  `packages/codex/README.md`.
- [x] T030 [P] [US2] Create private `packages/deepseek/package.json` and
  `packages/deepseek/README.md`.
- [x] T031 [US2] Generate and commit `pnpm-lock.yaml` using any supported pnpm 11.x release; record the actual version in validation output without making it a compatibility equality check.
- [x] T032 [US2] Verify through `scripts/validate-repository.sh` that dry-run output for
  `packages/codex/package.json` and `packages/deepseek/package.json` contains only `package.json`,
  `README.md`, and pnpm's automatically included root `LICENSE`, with no executable or lifecycle
  entry.

**Checkpoint**: User Story 2 is independently complete; one core boundary and two product
boundaries are executable/packable but not installable.

---

## Phase 5: User Story 3 - Run bounded baseline validation (Priority: P3)

**Goal**: Local and pull-request checks are identical and intentionally small.

**Independent Test**: Run `pnpm run validate` locally and compare it with the CI invocation.

### Tests for User Story 3

- [x] T033 [P] [US3] Add a contract test in `tests/contract/repository_layout_test.go` ensuring
  `.github/workflows/ci.yml` invokes `scripts/validate-repository.sh` rather than duplicating a
  broader matrix.
- [x] T034 [P] [US3] Add a contract test in `tests/contract/repository_layout_test.go` ensuring
  pull-request jobs in `.github/workflows/ci.yml` contain no publication command or release-secret
  reference, real Codex/DeepSeek launch, or user-configuration mutation.
- [x] T035 [P] [US3] Add contract cases in `tests/contract/package_manifest_test.go` ensuring root
  `package.json`, `packages/codex/package.json`, and `packages/deepseek/package.json` retain the
  bootstrap boundaries and each manifest version matches the current root `VERSION`.

### Implementation for User Story 3

- [x] T036 [US3] Finalize `scripts/validate-repository.sh` command ordering and fail-fast output.
- [x] T037 [US3] Make the `validate` script in root `package.json` invoke the exact bounded local
  validation at `scripts/validate-repository.sh`.
- [x] T038 [US3] Make `.github/workflows/ci.yml` invoke the same validation entry point.
- [x] T039 [US3] Document check ownership and explicit exclusions in `README.md`.
- [x] T040 [US3] Run `scripts/validate-repository.sh` once from the valid repository checkout.

**Checkpoint**: All three user stories are independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T041 [P] Check all Markdown relative links in `README.md`, `docs/`, and
  `specs/001-bootstrap-monorepo/`.
- [x] T042 Verify `README.md`, `AGENTS.md`, `docs/*.md`, and
  `specs/001-bootstrap-monorepo/*.md` are complete, with no unresolved template variables,
  unintended placeholder text, or unsupported claims.
- [x] T043 Review the final tree against
  `specs/001-bootstrap-monorepo/contracts/repository-layout.md`.
- [x] T044 Run `$speckit-converge` against `specs/001-bootstrap-monorepo/tasks.md` and append only
  concrete acceptance gaps there.
- [x] T045 Record unsupported product behavior and platform status in `README.md` and mirror it
  honestly in the final completion report.

---

## Phase 7: Audit Hardening

**Purpose**: Close the Feature 001 bounded-validation gaps found during audit without adding product
behavior.

- [x] T046 Amend `specs/001-bootstrap-monorepo/spec.md`,
  `specs/001-bootstrap-monorepo/contracts/repository-layout.md`, and
  `specs/001-bootstrap-monorepo/checklists/requirements.md` so product packages have no non-empty
  scripts and bounded install/dry-pack commands disable lifecycle scripts.
- [x] T047 Reject the entire non-empty product `scripts` field while preserving root validation
  scripts in `tests/contract/package_manifest_test.go`.
- [x] T048 Add `prepack`, `postpack`, and custom-script negative fixtures under
  `tests/contract/testdata/package-manifest/` and assert manifest-path plus `scripts` diagnostics.
- [x] T049 Configure pnpm `ignore-scripts` for product dry-packs in
  `scripts/validate-repository.sh` without changing the allowed packed-file set.
- [x] T050 Add `--ignore-scripts` to workspace installation in `scripts/validate-repository.sh`,
  `README.md`, and `specs/001-bootstrap-monorepo/quickstart.md`.
- [x] T051 Add `go list ./...` and accurately name the working-tree whitespace check in
  `scripts/validate-repository.sh`.
- [x] T052 Update `.github/workflows/ci.yml` to the execution-time latest stable major tags for the
  four official setup Actions while preserving the bounded pull-request-only workflow.
- [x] T053 Run the targeted contract checks and the complete `pnpm run validate` Feature 001
  validation from the repository root.
- [ ] T054 Commit and push `codex/001-bootstrap-monorepo`, create or reuse its Draft PR, and record a
  passing real `pull_request` CI result without merging.

## Dependencies & Execution Order

- Phase 1 has no implementation dependency.
- Phase 2 depends on Phase 1 and blocks all user stories.
- User Story 1 should complete before accepting product package implementation.
- User Story 2 depends only on Phase 2 and can overlap with documentation tasks from User Story 1
  when files do not conflict.
- User Story 3 depends on the validation targets delivered by User Stories 1 and 2.
- Phase 6 depends on all selected user stories.

## Parallel Opportunities

- T011–T013 can run in parallel.
- T017–T018 can run in parallel.
- T021–T022 can run in parallel.
- T024–T027 can run in parallel where files do not overlap.
- T029–T030 can run in parallel.
- T033–T035 can run in parallel.

## Implementation Strategy

1. Complete Setup and Foundational.
2. Deliver User Story 1 and stop for governance/ownership review.
3. Deliver User Story 2 and stop for package-boundary review.
4. Deliver User Story 3 and stop for CI review.
5. Run one final bounded validation and converge pass.
