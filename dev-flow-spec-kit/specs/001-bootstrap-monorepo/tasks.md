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

- [ ] T001 Create root `LICENSE` with Apache-2.0 text.
- [ ] T002 Create root `VERSION` containing exactly `0.1.0`.
- [ ] T003 Create root `go.mod` with the approved module path and Go 1.26.6 baseline.
- [ ] T004 Create private root `package.json` with `packageManager` pinned to `pnpm@11.17.0`.
- [ ] T005 Create `pnpm-workspace.yaml` including only `packages/*`.
- [ ] T006 Create root `.gitignore` for Go, Node, editor, build, package, and local Spec Kit runtime
  artifacts without ignoring specifications or lockfiles.
- [ ] T007 Verify `.specify/memory/constitution.md` and generated
  `.agents/skills/speckit-*` are present; do not edit generated Skills.
- [ ] T008 Select `specs/001-bootstrap-monorepo` through `SPECIFY_FEATURE_DIRECTORY` for the
  implementation session; do not handcraft Spec Kit-managed feature state.

**Checkpoint**: Toolchain and Spec Kit roots exist; no product source package exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish ownership areas and repository-contract validation shared by all stories.

- [ ] T009 Create ownership directories and explanatory README files under `internal/`,
  `protocol/fixtures/`, `tests/contract/`, `release/`, and `scripts/`.
- [ ] T010 Create `scripts/validate-repository.sh` that orchestrates Go, pnpm, package,
  repository-contract, and documentation checks without installation or publication.
- [ ] T011 [P] Create `tests/contract/repository_layout_test.go` for required paths, ownership rules,
  nested `.specify/`, nested `go.mod`, and executable-root constraints.
- [ ] T012 [P] Create `tests/contract/package_manifest_test.go` for private-package, lifecycle-script,
  `bin`, runtime-dependency, and root-publishability constraints.
- [ ] T013 [P] Create `tests/contract/markdown_links_test.go` for repository-relative links in root,
  `docs/`, and active specification documents.
- [ ] T014 Create root validation scripts in `package.json` that call repository-owned commands and
  do not add a task-runner framework.
- [ ] T015 Create `.github/workflows/ci.yml` for pull requests using Go 1.26.6, Node 24 LTS, and
  pnpm 11.17.0.
- [ ] T016 Ensure CI has read-only repository permission and no release or npm credentials.

**Checkpoint**: Repository contracts can fail before user-story implementation begins.

---

## Phase 3: User Story 1 - Initialize a governed repository (Priority: P1) 🎯 MVP

**Goal**: A contributor can identify product boundaries, ownership, and Spec Kit governance from the
repository itself.

**Independent Test**: Run repository-layout and Markdown-link contract tests against the project and
isolated invalid fixtures.

### Tests for User Story 1

- [ ] T017 [P] [US1] Add positive required-path and ownership cases to
  `tests/contract/repository_layout_test.go`.
- [ ] T018 [P] [US1] Add isolated nested `.specify/`, nested `go.mod`, and extra executable-root
  fixtures under `tests/contract/testdata/repository-layout/`.
- [ ] T019 [US1] Verify each invalid fixture reports the exact path and violated contract.

### Implementation for User Story 1

- [ ] T020 [US1] Finalize root `README.md` with product definition, setup, feature selection,
  validation commands, and document index.
- [ ] T021 [P] [US1] Finalize root `AGENTS.md` with authority, requirement-scope, Git, test-budget,
  and Spec Kit rules.
- [ ] T022 [P] [US1] Finalize directory ownership and dependency direction in
  `docs/ARCHITECTURE.md`.
- [ ] T023 [US1] Run repository-layout and Markdown-link checks and resolve every project-tree
  violation.

**Checkpoint**: User Story 1 is independently complete; repository governance and ownership are
self-contained.

---

## Phase 4: User Story 2 - Establish one core and two product packages (Priority: P2)

**Goal**: The tree proves one future core and two thin products without claiming runtime behavior.

**Independent Test**: Build/test the placeholder Go command and dry-pack both private packages.

### Tests for User Story 2

- [ ] T024 [P] [US2] Create `internal/version/version_test.go` for exact SemVer parsing and the
  initial version value.
- [ ] T025 [P] [US2] Create `cmd/dev-flow/main_test.go` verifying help/version output and
  nonfunctional messaging.
- [ ] T026 [P] [US2] Add positive and negative product-manifest fixtures to
  `tests/contract/package_manifest_test.go`.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Implement `internal/version/version.go` with one build-time version source and
  no release framework.
- [ ] T028 [US2] Implement `cmd/dev-flow/main.go` with only help and `version`; task and MCP
  invocations must report that the capability is not implemented.
- [ ] T029 [P] [US2] Create private `packages/codex/package.json` and
  `packages/codex/README.md`.
- [ ] T030 [P] [US2] Create private `packages/deepseek/package.json` and
  `packages/deepseek/README.md`.
- [ ] T031 [US2] Generate and commit `pnpm-lock.yaml` using pnpm 11.17.0.
- [ ] T032 [US2] Verify package dry-run output contains only the manifest-declared bootstrap files
  and no executable or lifecycle entry.

**Checkpoint**: User Story 2 is independently complete; one core boundary and two product
boundaries are executable/packable but not installable.

---

## Phase 5: User Story 3 - Run bounded baseline validation (Priority: P3)

**Goal**: Local and pull-request checks are identical and intentionally small.

**Independent Test**: Run `pnpm run validate` locally and compare it with the CI invocation.

### Tests for User Story 3

- [ ] T033 [P] [US3] Add a contract test ensuring CI invokes the repository validation entry rather
  than duplicating a broader matrix.
- [ ] T034 [P] [US3] Add a contract test ensuring pull-request jobs contain no publication command or
  release-secret reference.
- [ ] T035 [P] [US3] Add a contract test ensuring root and product package manifests retain the
  bootstrap boundaries.

### Implementation for User Story 3

- [ ] T036 [US3] Finalize `scripts/validate-repository.sh` command ordering and fail-fast output.
- [ ] T037 [US3] Make root `pnpm run validate` invoke the exact bounded local validation.
- [ ] T038 [US3] Make `.github/workflows/ci.yml` invoke the same validation entry point.
- [ ] T039 [US3] Document check ownership and explicit exclusions in `README.md`.
- [ ] T040 [US3] Run the complete bootstrap validation once from a valid checkout.

**Checkpoint**: All three user stories are independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Check all Markdown relative links in `README.md`, `docs/`, and
  `specs/001-bootstrap-monorepo/`.
- [ ] T042 Verify all repository documents are complete, with no unresolved template
  variables, placeholder text, or unsupported claims.
- [ ] T043 Review the final tree against `contracts/repository-layout.md`.
- [ ] T044 Run `$speckit-converge` and append only concrete acceptance gaps.
- [ ] T045 Record unsupported product behavior and platform status honestly in the completion
  report.

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
