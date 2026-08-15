# Implementation Plan: Codex Explicit Dev Flow

**Branch**: `003-codex-explicit-dev-flow`  
**Date**: 2026-08-15  
**Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-codex-explicit-dev-flow/spec.md`

## Summary

Deliver one private, locally packed `dev-flow-codex` artifact containing exactly one Codex plugin,
one explicitly selected `$dev-flow` Skill, one local STDIO MCP registration, one packaged macOS
arm64 Go Core executable, and small Node.js standard-library lifecycle/launch glue.

The Go Core remains the sole authority for task state, transitions, repository claims, recovery,
verification budgets, and terminal outcomes. The Codex layer owns only package composition,
explicit registration/removal, process launch, invocation guidance, and evidence presentation.

Feature 003 uses deterministic package, fake-Codex, fake-Core, and harness-contract checks during
story implementation. It completes **exactly one passing real Codex host journey**. Only T058 may
start Codex, each immutable source/validation/artifact chain permits at most one launch, and every
launch occurs only after deterministic checks and root validation pass and one final artifact is
built from frozen source. Failed or blocked attempts remain counted but never establish support;
intermediate user-story checkpoints never start a real Codex host or create native support evidence.

## Technical Context

**Core language/toolchain**: Go 1.26 or the repository-pinned compatible toolchain  
**Host glue**: Node.js `>=24`, ECMAScript modules, Node standard library only  
**Package manager**: pnpm `>=11 <12`; npm-compatible local `.tgz` installation  
**Core dependencies**: existing `github.com/modelcontextprotocol/go-sdk` and `modernc.org/sqlite`  
**Storage**: Core-owned SQLite under explicit `DEV_FLOW_DATA_DIR`, otherwise
`~/Library/Application Support/dev-flow/data` on macOS  
**Registration receipt**:
`~/Library/Application Support/dev-flow/registrations/codex.json`  
**Transport**: local STDIO only  
**Target evidence platform**: macOS arm64, Codex CLI only  
**Host compatibility**: Codex CLI `>=0.147.0 <0.148.0`; exact final host `0.147.0`, selected by
implementation-time revalidation on 2026-08-15 rather than frozen into the product specification
**Publication**: prohibited in Feature 003

## Constitution Check

| Principle | Result | Design evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | One bounded Codex package and one install-to-remove capability. |
| II. Single Workflow Authority | PASS | Core alone owns task, action, recovery, claim, and outcome semantics. |
| III. One State Machine, Bounded Surface | PASS | Exactly the six Core Contract 0.1 tools; no aliases or secondary catalog. |
| IV. Thin Host Adapters | PASS | Node code is limited to lifecycle, paths, launch, and evidence glue. |
| V. Recovery Before Retry | PASS | Uncertain mutations require authoritative task/next-action reads. |
| VI. Read-Only Repository Boundary | PASS | Setup/removal write only product-owned user locations; Core does not mutate Git. |
| VII. Evidence-Bounded Testing | PASS | Deterministic checks per story and one final real-host journey only. |
| VIII. Proven Simplicity | PASS | No runtime dependency, proxy, generic framework, listener, or polling loop. |
| IX. Vertical-Slice Specifications | PASS | US1, US2, and US3 remain independently testable without repeated native journeys. |
| X. Two-Host Contract Parity | PASS | Shared Core fixtures are consumed in place and public Core contracts stay unchanged. |

No constitutional exception is requested.

## Host Compatibility Revalidation

Codex plugin, Skill, MCP, marketplace, setup, removal, and JSON readback contracts are volatile
external inputs. Before final validation, one serialized compatibility task must:

1. inspect the then-current official Codex documentation and exact stable CLI artifact;
2. select a minimum supported version and a bounded compatible range;
3. record the exact version used for native evidence;
4. update every compatibility-bearing artifact together when the selected range or official
   behavior differs from the planning baseline:
   - `README.md` and `spec.md`;
   - `research.md`;
   - this `plan.md`;
   - `contracts/codex-plugin.md`;
   - `contracts/dev-flow-skill.md`;
   - `contracts/registration-receipt.schema.json`;
   - `contracts/journey-evidence.schema.json`;
   - `data-model.md`;
   - `quickstart.md`;
   - `tasks.md`;
   - affected package documentation, manifests, plugin resources, lifecycle/fake implementation,
     and package/Skill/lifecycle tests under `packages/codex/`;
   - affected local-build, fake-journey, root-validation, and shared contract gates;
5. rerun analyze/checklist review if the official contract changes product behavior rather than
   only field names, commands, or the compatible range.

T052 selected exact stable CLI `0.147.0` and retained the bounded range
`>=0.147.0 <0.148.0`. Official 0.147 source review changed behavior-bearing implementation details:

- explicit-only Skill selection is declared by
  `skills/dev-flow/agents/openai.yaml` at `policy.allow_implicit_invocation`, not by `SKILL.md`
  frontmatter;
- `.mcp.json` uses the intersection accepted by both 0.147 plugin parsers: the Agent Plugins v1
  `$schema`, camelCase `mcpServers`, and a `type: stdio` server;
- marketplace/plugin JSON commands return top-level objects with camelCase fields, so lifecycle
  reconciliation validates those official objects and then compares the one owned entry;
- the receipt digests the Skill metadata policy in addition to the Skill and MCP resources.

This revalidation is not parallel with final test hardening, root validation, or artifact creation.

## Project Structure

### Documentation

```text
specs/003-codex-explicit-dev-flow/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── codex-plugin.md
│   ├── dev-flow-skill.md
│   ├── artifact-report.schema.json
│   ├── journey-evidence.schema.json
│   ├── native-attempt-diagnostic.schema.json
│   ├── native-attempt-ledger.schema.json
│   ├── validation-report.schema.json
│   └── registration-receipt.schema.json
├── checklists/
│   ├── requirements.md
│   └── codex-product-quality.md
└── tasks.md
```

### Planned source and verification changes

```text
internal/version/
├── version.go
└── version_test.go

packages/codex/
├── package.json
├── README.md
├── .agents/plugins/marketplace.json
├── bin/dev-flow-codex.mjs
├── lib/lifecycle.mjs
├── lib/paths.mjs
├── plugin/.codex-plugin/plugin.json
├── plugin/.mcp.json
├── plugin/skills/dev-flow/SKILL.md
├── plugin/skills/dev-flow/agents/openai.yaml
└── tests/
    ├── fixtures/fake-codex.mjs
    ├── fixtures/fake-core.mjs
    ├── fixtures/fake-native-tool.mjs
    ├── fake-core-contract.test.mjs
    ├── journey-evidence.test.mjs
    ├── journey-harness.test.mjs
    ├── launcher.test.mjs
    ├── lifecycle.test.mjs
    ├── package-contract.test.mjs
    ├── paths.test.mjs
    ├── removal-retention.test.mjs
    └── skill-contract.test.mjs

scripts/
├── build-codex-local.sh
├── run-codex-real-journey.sh
├── write-codex-journey-evidence.mjs
├── validate-codex-journey-evidence.mjs
└── validate-repository.sh

tests/
├── contract/
│   ├── fixture_contract_test.go
│   ├── package_manifest_test.go
│   └── repository_layout_test.go
└── journeys/evidence/codex-macos-arm64.json
```

The prebuilt executable and `.tgz` exist only in temporary staging. They are never committed.

## Product Design

### Package and runtime

The artifact contains one executable entry, `dev-flow-codex`. Production commands are limited to:

- `setup [--json]`;
- `remove [--json]`;
- `mcp`;
- `--version`.

`mcp` resolves only the package-local Core executable, validates the supported platform and data
root, and inherits stdin/stdout/stderr. It does not parse or project MCP messages.

The shared `internal/version` seam permits a detached binary to report repository `VERSION` through
link-time injection while preserving source-tree fallback behavior. It changes no public Core
contract.

### Explicit setup and removal

npm installation runs with lifecycle scripts disabled and does not register anything. Explicit
setup reads current Codex marketplace/plugin state, validates package resources and compatibility,
performs supported Codex mutations, reads state back, and writes an ownership receipt only after
success.

The selected CLI contract uses `{marketplaces: [...]}` and `{installed: [...], available: [...]}`
readback objects plus camelCase add/remove result objects. Only the owned local marketplace and
installed plugin are reconciled; unrelated entries remain untouched.

Removal reads the receipt and Codex state before mutation, removes only matching product-owned
plugin/marketplace registration, verifies absence, deletes only the exact receipt, and preserves
task data, the npm package, adjacent user files, Codex cache/config internals, and repositories.

### Skill authority

The sole Skill is excluded from implicit injection by its official `agents/openai.yaml` policy and
also begins with an exact current-turn `$dev-flow` guard. It rejects empty,
conversational, non-Git, and multi-repository requests before opening a task. It calls
`dev_flow_server_info` first and accepts only Core Contract 0.1 with the exact six tools.

For each action it follows live Core identity, schema, allowed effects, evidence requirements,
recovery assessment, blocker, and outcome. It does not contain a state machine, action catalog,
error reinterpretation, recovery classifier, or completion predicate.

## Verification Design

### Deterministic evidence layers

1. **Static/package contracts**: artifact allowlist, one plugin/Skill/MCP server, no lifecycle
   mutation, version parity, no embedded workflow authority, and no copied Core fixtures.
2. **Fake Codex lifecycle**: exact setup/remove argv, exact total readback cardinality, idempotency,
   conflicts, rollback ownership under a concurrent already-added result, and adjacent-file
   preservation.
3. **Fake Core contract**: exact six-tool mapping, closed argument forwarding, full results,
   verification budgets, terminal outcomes, and read-before-retry ordering.
4. **Journey harness contract**: stage ordering, artifact digest propagation, source identity,
   session boundary, repository/data fingerprints, and evidence classification without starting
   Codex.
5. **Packaged-Core retention integration**: real packaged Core against a temporary data directory,
   but no real Codex host.
6. **Native-runner contract**: argument/preflight gates, frozen artifact and validation identity,
   exact Codex `exec --json`/`command_execution` parsing, MCP call/result extraction, session
   separation, direct-Core fail-closed framing, and exclusive atomic evidence creation are
   exercised through the production default helpers with deterministic fake npm/Codex/Core child
   processes; this layer cannot emit `native-host` evidence, build the final artifact, or start
   Codex.

US1, US2, and US3 checkpoints use only these deterministic layers.

### Exactly one passing native journey

After compatibility revalidation, all targeted tests, root validation, and a read-only pre-final
diff audit pass, the source tree is frozen and one final artifact is built for the current chain.
That exact artifact may be launched once and the single passing journey covers:

1. install with scripts disabled;
2. explicit setup and readback;
3. ordinary prompt proving zero Dev Flow tool calls/tasks;
4. invalid explicit invocations;
5. a substantive `$dev-flow` task;
6. at least two Core-confirmed workflow action commits;
7. Codex close/restart;
8. same-task resume and continuing revision lineage;
9. verification-budget compliance;
10. Core-owned `DONE`;
11. explicit deregistration;
12. retained task-data digest and direct task reopen;
13. npm uninstall and compatible reinstall;
14. repository and adjacent-file comparison.

No earlier task may start a real Codex host or write native support evidence.

### Frozen-source native runner

Before root validation and source freeze, the repository implements the native mode of
`scripts/run-codex-real-journey.sh` plus the bounded
`scripts/write-codex-journey-evidence.mjs` writer. Native mode accepts only the unmodified T057
final-artifact report, the machine-generated T055 validation report, and an absolute exact 0.147.0
Codex executable, plus a machine-maintained native-attempt ledger stored outside the repository.
Both reports bind to the same frozen source commit; the runner recomputes both report digests and
artifact identity, derives one chain ID from those immutable identities, and rejects missing,
open-shaped, mismatched, substituted, or time-inverted inputs, an already-attempted chain, any
source commit already present in the ledger, an existing passing attempt, any unresolved reserved
entry, or a pre-existing evidence file before launching Codex. Evidence/ledger recovery is a
separate no-host admission path and cannot fall through to native mode.

The runner installs the private artifact into isolated package/data/home paths, performs supported
setup/readback, and uses official `codex exec --json` sessions. JSONL `thread.started` and complete
`item.completed` MCP and `command_execution` events are the host observation boundary; truncated
previews and free-form agent prose are never promoted into Core evidence. Command output contents
are discarded after hashing. Separate processes cover ordinary and invalid invocation checks, the
substantive task, and an explicit new-session resume; all four thread IDs are nonempty and pairwise
distinct. After the substantive process is deliberately closed, the resume process must call
`dev_flow_get_task` and then `dev_flow_get_next_action` before any later mutation. The runner derives
the verification budget and terminal phase from complete Core task/action results, reconciles every
completed command with the automated evidence submitted to and retained by Core, requires Core
`phase=DONE`, and checks raw revision observations for non-regression before adjacent duplicates are
collapsed. Setup and reinstall readback require exactly one owned marketplace, one installed plugin,
and zero available entries. The runner then performs removal/readback, bounded fail-closed direct
Core task reopen, separate npm uninstall, compatible reinstall, and repository/task-data/adjacent
comparisons. Direct reopen rejects any non-JSON line, unknown or duplicate response ID, or output
limit breach.

The evidence writer consumes only those bounded observations and validates the closed schema-facing
shape. After a successful host run it create-exclusively persists immutable observed facts outside
the repository, fixes every timestamp, and prepares/fsyncs the exact final `pass` ledger candidate
and exact final evidence candidate. The evidence binds the observed-facts digest, exact final ledger
digest, and `evidence-create-before-ledger-finalize-v1` protocol. It first publishes the evidence at
`tests/journeys/evidence/codex-macos-arm64.json` with a same-filesystem atomic create-no-replace
operation only after the exact evidence/final-ledger candidates pass the complete structural and
semantic validators together with both retained reports and the artifact. It then atomically
replaces the reserved external ledger with only the precomputed final bytes. T054 tests the
runner/writer and every recovery boundary with non-native inputs; T058 is the only task that may
enter native mode or start Codex.

The same writer has one non-native T055 operation that creates a temporary validation report
outside the repository from the exact targeted/root commands, pass results, completion times, and
source commit. Because the calendar date crossed after T052, T055 first rereads the official
`@openai/codex` `latest` dist-tag, requires it still resolve to selected `0.147.0`, and records the
exact UTC query time/range in that report; any change returns to T052 and checklist/analyze before
the frozen chain. That report is not journey evidence and cannot write the native evidence path.
The exact ordered targeted command set is `go test ./internal/version ./tests/contract` followed by
`node --test packages/codex/tests/*.test.mjs`; semantic validation rejects omissions, additions,
duplicates, or reordering before the separate exact `pnpm run validate` observation.

The T055 validation report, T057 artifact report, and external attempt ledger each use a closed JSON
Schema. The artifact report records `built_at`; the evidence records both report SHA-256 values,
the artifact build time, the current chain ID, stable ledger ID, and the ledger's actual attempt
count. One durable external ledger path/ID is initialized before the first T055 chain and reused by
every failed/recovery/new chain; the runner rejects a report bound to a different ledger identity.
The ID is SHA-256 over the domain-separated canonical absolute path, so moving or copying the bytes
to another path cannot preserve admission identity; initialization and later access reject a
symlinked ledger leaf or noncanonical parent.
Every admission first performs full ledger schema and semantic validation: attempt numbers are
exactly `1..N`; chain IDs and source commits are unique; finalized statuses have the required
completion/facts fields; at most one `pass` exists and it is final; at most one `reserved` entry
exists and it is final; and no entry follows either a pass or unresolved reservation. Reservation
repeats those checks while holding an exclusive closed owner lock that binds ledger ID, owner token,
PID, creation time, operation, and expected ledger-byte digest. A stale lock is recoverable only
when its shape/identity is valid and its PID is definitely dead; a live, permission-ambiguous, or
malformed owner blocks. Every reservation or finalization re-reads and compares the expected ledger
bytes inside that same lock immediately before atomic replacement. After every preflight succeeds
and immediately before spawning Codex, the writer atomically reserves the next attempt and
permanently consumes that chain/source. A `reserved` entry never permits host launch.
Before evidence publication, interrupted recovery may only finalize the attempt as failed/blocked
from durable facts or leave it reserved; it cannot declare pass. Once valid passing evidence is
published it is the immediate admission pass-lock even if the ledger is still reserved. Recovery
may then only validate the evidence and idempotently install the precomputed exact final ledger
bytes; if the ledger was already finalized it only validates both files. A later T058 attempt is
allowed only after a source correction and a wholly new T055 validation report, T056 freeze, and
T057 artifact/report for a ledger with no unresolved reservation or pass. Support derives only from
the one passing evidence/ledger pair, and no launch is allowed after evidence publication.
The canonical repository evidence path and `journey-evidence.schema.json` are pass-only.
Failed/blocked diagnostics use the independent closed
`native-attempt-diagnostic.schema.json` contract with schema version 1 and
`external-failure-record-v1` under the external recovery directory; the writer validates each
diagnostic before its atomic write. They never claim journey-evidence schema version 3 or occupy the
canonical path; the durable ledger remains the attempt authority. A post-publication integrity
failure is a terminal blocked recovery condition, not permission to delete evidence or start a new
chain.

## Journey Evidence Contract

`journey-evidence.schema.json` validates the canonical passing record only.
`native-attempt-diagnostic.schema.json` separately validates honest `failed` and `blocked` records
containing only observations available before the failure; those records never fabricate task
lineage or completed lifecycle fields.

JSON Schema cannot compare values or prove ordering. Therefore
`scripts/validate-codex-journey-evidence.mjs` performs required semantic checks for a passing record:

- package version equals Core version and repository `VERSION`;
- the exact Codex version satisfies the recorded compatible range;
- evidence source commit equals the frozen source commit used to build the artifact;
- validation/artifact report digests equal the retained input reports and all three source commits
  match;
- the validation report contains the exact two ordered targeted commands once, the exact root
  command once, and the same stable ledger ID as evidence and the external ledger;
- every targeted/root observation uses that source commit and completes no later than the validation
  report's `completed_at`;
- the official dist-tag query precedes every command completion, and evidence validation observations
  equal the validation report observations exactly;
- `validation.completed_at <= artifact.built_at < evidence.recorded_at`;
- the attempt ledger contains no duplicate chain or source commit, its count equals the evidence
  count, and exactly one entry—the current attempt—is passing;
- evidence and its pass ledger entry bind the same durable observed-facts digest, exact final ledger
  digest, chain, attempt number, and commit protocol;
- the exact four Codex thread IDs are nonempty and pairwise distinct;
- raw task revisions never regress, and their adjacent-deduplicated lineage is strictly increasing;
- committed-action revisions belong to the recorded lineage;
- task IDs before and after restart are equal;
- at least two action commits are present;
- `core_call_count <= scenario_call_budget`;
- the complete Core-derived verification budget equals the evidence projection, every completed
  official command execution is represented by command/exit/status/output digest, those commands
  equal the automated evidence submitted to and retained by Core, the count stays within budget,
  and a full-suite observation is rejected when `allow_full_suite=false`;
- after the restart boundary, `dev_flow_get_task` then `dev_flow_get_next_action` precede any later
  `apply_action`;
- terminal task phase and outcome are both `DONE`/completed;
- setup and reinstall observations each contain exactly one owned marketplace, one installed owned
  plugin, and zero available plugins;
- retained data uses the closed non-secret descriptor and its path digest matches durable observed
  facts without exposing the absolute path;
- task-data manifests/digests before and after removal are equal;
- repository digest after completion equals repository digest after removal;
- unexpected changed paths are empty;
- setup, restart/resume, removal, retention, and task-reopen flags are true;
- the recorded targeted checks and root `pnpm run validate` passed before artifact creation.

The bound `validate:evidence` command loads and validates the evidence, validation report, artifact
report, attempt ledger, artifact bytes, and root version, then runs the same complete passing
semantics used before publication. Post-publication recovery additionally checks the already
prepared exact bytes and identities; it never weakens the public validator into digest-only
acceptance. Neither validator modifies evidence.

## Root Validation Ownership

Feature 003 owns the first expansion of `scripts/validate-repository.sh` from skeleton dry-pack
rules to the delivered Codex package boundary. The script must:

- preserve root toolchain, formatting, vet, Go test, and frozen workspace checks;
- validate the exact Codex source/dry-pack allowlist expected by this feature;
- retain the DeepSeek skeleton rule until Feature 004 is merged;
- run no real host, network publication, package installation into user state, or release action.

Feature 004 may later extend this validator only from the merged Feature 003 baseline.

## Final Artifact and Evidence Order

The final chain is strictly serialized:

1. compatibility revalidation;
2. documentation/contract reconciliation;
3. all targeted Go/Node/package/fake checks;
4. root `pnpm run validate`;
5. after any source fix, rerun the complete ordered deterministic set and root gate from the new
   clean commit;
6. read-only pre-final scope/diff audit;
7. freeze the source commit;
8. build exactly one final artifact and closed artifact report for the current chain;
9. verify artifact allowlist, versions, executable, source identity, and digest;
10. reserve the chain, run its sole native attempt, durably prepare and completely validate exact
    candidates, publish evidence create-no-replace, then finalize the ledger with the precomputed
    bytes;
11. rerun byte/identity validation of the already prevalidated evidence/ledger pair or the bounded
    no-host recovery path;
12. run a final read-only diff audit.

After step 8, no source or evidence-producing code may be changed without discarding the artifact and
restarting from step 3. After a native launch begins, that chain may never launch again. A failed or
blocked artifact/external-diagnostic pair is discarded as a whole while its attempt-ledger entry is
retained; another launch requires a source correction and new steps 3–8 with the same ledger.
Canonical evidence is pass-only and is never edited or repaired. A published passing record ends
native execution immediately, including during recovery from an interrupted ledger finalize; any
later integrity failure is terminal blocked recovery rather than retry authority.

## Complexity Tracking

No constitutional exception is required. The build-version seam, registration receipt, semantic
evidence validator, and product-specific root allowlist each solve a concrete packaging,
ownership, or evidence-integrity requirement. None creates workflow authority or a generic host
framework.

## Delivery Boundary

Feature 003 is complete only when:

- reviewer-owned requirement checklists are approved;
- deterministic package/fake/integration checks pass;
- root validation passes;
- one frozen-source artifact is built;
- exactly one real Codex journey passes, with at most one launch per immutable chain and every
  failed/blocked native attempt honestly counted;
- its evidence passes both structural and semantic validation; and
- the final diff remains within the approved Feature 003 scope.

Public publication, release automation, signatures, automatic updates, Windows/Linux packages,
other Codex surfaces, DeepSeek implementation, and Core Contract changes remain out of scope.
