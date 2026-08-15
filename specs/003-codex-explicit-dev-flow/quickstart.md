# Quickstart: Build and Validate the Local Codex Product

This runbook defines the Feature 003 acceptance procedure. It distinguishes deterministic
user-story checkpoints from the **single passing real Codex journey**, with at most one launch per
immutable chain. It never publishes a package
or claims support beyond the exact compatibility range and macOS arm64 surface recorded during
implementation.

## 1. Review and revalidate prerequisites

Before implementation:

1. confirm Feature 002/Core Contract 0.1 and shared fixtures are present;
2. complete reviewer-owned requirement checklists;
3. record the repository commit being evaluated;
4. revalidate the then-current official stable Codex CLI, plugin, Skill, MCP, marketplace,
   setup/readback, and removal contracts;
5. select a minimum version, bounded compatible range, and exact stable version for native evidence.

The 2026-08-15 revalidation selected exact latest stable Codex CLI `0.147.0` and retained
`>=0.147.0 <0.148.0`. A later implementation must not silently preserve that range if the official
stable contract moves; it must update the plan, contracts, affected schemas, data model,
quickstart, tasks, and tests together before final validation.

Expected platform/toolchain boundary:

```bash
uname -s
uname -m
codex --version
go version
node --version
pnpm --version
```

Feature 003 native evidence is macOS arm64 and Codex CLI only.

## 2. Run deterministic foundation checks

Run only the checks required by the active task, for example:

```bash
go test ./internal/version ./tests/contract
node --test packages/codex/tests/paths.test.mjs
node --test packages/codex/tests/lifecycle.test.mjs
```

Foundation checks prove:

- detached Core version injection and source-tree fallback;
- exact six-tool/shared-fixture parity;
- safe runtime/data/receipt paths;
- receipt validation and ownership;
- Codex-aware root dry-pack rules;
- preservation of the DeepSeek skeleton boundary.

They do not prove native Codex behavior.

## 3. Implement and check User Story 1 without starting Codex

After US1 package, launcher, plugin, Skill, and setup behavior exist:

```bash
node --test packages/codex/tests/package-contract.test.mjs
node --test packages/codex/tests/launcher.test.mjs
node --test packages/codex/tests/lifecycle.test.mjs
node --test packages/codex/tests/skill-contract.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through setup
```

The checkpoint must use the fake Codex CLI and isolated temporary roots. It proves package shape,
supported setup/readback ordering, explicit-only admission, invalid-input rejection, and repository
fingerprints. It must assert that no real `codex` process starts and that no native evidence file is
written.

The fake must mirror exact 0.147 JSON boundaries: top-level `{marketplaces: [...]}` and
`{installed: [...], available: [...]}` objects, camelCase mutation results, the official Skill
policy in `agents/openai.yaml`, and the MCP shape shared by both 0.147 plugin parsers.

A non-final `.tgz` may be built for tarball-contract testing. It is not the final artifact and does
not authorize a real host run.

## 4. Implement and check User Story 2 without starting Codex

```bash
node --test packages/codex/tests/fake-core-contract.test.mjs
node --test packages/codex/tests/skill-contract.test.mjs
node --test packages/codex/tests/journey-evidence.test.mjs
node --test packages/codex/tests/journey-harness.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through done
```

The fake Core/harness must prove:

- exact six-tool mapping and complete results;
- new task, exact resume, same-host conflict, and other-host conflict;
- fresh action/revision identity and closed payload forwarding;
- successful mutation continuation;
- lost/truncated mutation read-before-retry ordering;
- verification-command budget accounting and evidence labels;
- restart boundary with the same fake task lineage;
- Core-owned blocker/cancel/`DONE`;
- no native-evidence promotion.

No real Codex session is allowed in this step.

## 5. Implement and check User Story 3 without starting Codex

```bash
node --test packages/codex/tests/lifecycle.test.mjs
node --test packages/codex/tests/removal-retention.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through remove
```

This checkpoint proves:

- receipt-first removal reconciliation;
- plugin/marketplace absence readback through the fake host;
- adjacent-file preservation;
- no direct Codex config/cache deletion;
- task-data and repository manifest preservation;
- direct Core task reopen;
- separate npm uninstall and compatible reinstall;
- repeated removal as a no-op;
- zero real Codex processes and zero native evidence.

## 6. Reconcile the final host contract

Immediately before final hardening, repeat the official compatibility review. Update all affected
documents/contracts/tests together if the selected range or command/resource contract changed.

For this implementation the selected facts are:

- exact host: `codex-cli 0.147.0`;
- compatible range: `>=0.147.0 <0.148.0`;
- Skill policy: `skills/dev-flow/agents/openai.yaml` with
  `policy.allow_implicit_invocation: false`;
- MCP config: Agent Plugins v1 `$schema`, camelCase `mcpServers`, and one `type: stdio` server;
- CLI lifecycle JSON: top-level objects and camelCase fields, with unrelated entries preserved.

Do not continue when an official change alters product behavior, ownership, or result semantics
without updating the feature and rerunning checklist/analyze review.

## 7. Run all deterministic checks and root validation

Choose one durable external ledger path before the first chain and retain that exact path for every
later failed, recovery, or replacement chain. Initialize it once; the writer validates an existing
ledger and never replaces it with an empty history. Then create an external directory for the
immutable chain and let the checked-in T055 writer operation query official compatibility, run the
complete targeted Feature 003 set followed by the root gate, and exclusively create the closed
validation report only when every command passes:

```bash
CODEX_CHAIN_DIR="$(mktemp -d -t dev-flow-codex-chain.XXXXXX)"
CODEX_ATTEMPT_LEDGER="/absolute/operator-retained/dev-flow-codex-native-attempts.json"
CODEX_VALIDATION_REPORT="$CODEX_CHAIN_DIR/validation-report.json"
node ./scripts/write-codex-journey-evidence.mjs init-ledger \
  --output "$CODEX_ATTEMPT_LEDGER"
node ./scripts/write-codex-journey-evidence.mjs validation-report \
  --output "$CODEX_VALIDATION_REPORT" \
  --attempt-ledger "$CODEX_ATTEMPT_LEDGER" \
  --source-commit "$(git rev-parse HEAD)"
```

The ledger ID is the SHA-256 of the domain-separated canonical absolute ledger path. Its parent must
already exist and be canonical, and the ledger leaf may not be a symlink. Every later writer/runner
operation recomputes that identity, so copied bytes at another path or a new empty path cannot
preserve admission authority. Reservations use a short-lived exclusive lock/CAS.

The writer itself requeries the official `@openai/codex` `latest` npm dist-tag immediately before
running validation. It must still resolve to `0.147.0` within `>=0.147.0 <0.148.0`; the writer
records the exact UTC query time and result in the report. If it changed, stop, return to
compatibility reconciliation, and rerun checklist/analyze before creating a frozen chain.

That operation runs and records exactly these ordered targeted commands once each, with no omission,
addition, duplication, or reordering:

```text
go test ./internal/version ./tests/contract
node --test packages/codex/tests/*.test.mjs
```

It then runs and records the separate exact root command `pnpm run validate` once. Every observation
contains its pass result, source commit, and completion time; the report also records the overall
`completed_at`, stable ledger ID, and compatibility query. The semantic writer enforces
`codex_revalidation.queried_at <= each targeted/root completed_at <= completed_at`, refuses a dirty
or changing source identity, and never writes the native evidence path.

The root validator must use the delivered Codex source/dry-pack allowlist and retain the DeepSeek
skeleton rule. It must not start Codex, install into real user state, publish, or perform a native
journey.

Fix failures now. Any source modification invalidates the partial run: from the new clean commit,
rerun the entire exact ordered targeted set and the root gate. Record:

- exact commands;
- pass/fail result;
- completion time;
- current source commit.

These facts are later copied into native evidence. Do not build the final artifact until this phase
passes.

## 8. Perform the pre-final read-only audit and freeze source

Audit the complete allowed Feature 003 scope:

```text
internal/version/
packages/codex/
scripts/build-codex-local.sh
scripts/run-codex-real-journey.sh
scripts/write-codex-journey-evidence.mjs
scripts/validate-codex-journey-evidence.mjs
scripts/validate-repository.sh
tests/contract/
tests/journeys/evidence/
specs/003-codex-explicit-dev-flow/
```

Confirm:

- no Core Contract/state/transition/recovery change;
- no Git mutation or generic shell MCP;
- no publication/release action;
- no copied shared fixtures;
- no unexpected binary/data/receipt artifact;
- no unsupported platform/surface claim;
- no second host framework.

Record and freeze the source commit. Any later source change returns the workflow to step 7.

## 9. Build exactly one final artifact for this chain

```bash
CODEX_ARTIFACT_DIR="$(mktemp -d -t dev-flow-codex-final.XXXXXX)"
CODEX_ARTIFACT_REPORT="$CODEX_CHAIN_DIR/artifact-report.json"
FROZEN_SOURCE_COMMIT="$(git rev-parse HEAD)"
./scripts/build-codex-local.sh \
  --output "$CODEX_ARTIFACT_DIR" \
  --final \
  --source-commit "$FROZEN_SOURCE_COMMIT" \
  --report "$CODEX_ARTIFACT_REPORT"
```

The build must emit one absolute `.tgz` path and digest and verify:

- package/plugin/Core/root version equality;
- compatibility metadata matches the selected range;
- the packaged Core reports its version outside the checkout;
- exact tarball allowlist;
- executable mode;
- frozen source identity;
- no Core source, fixtures, fakes, evidence, repository metadata, or second platform runtime.

A defect invalidates this artifact/report pair and returns to step 7. Retain invalid artifacts or
reports only as external diagnostics when needed; they are not valid inputs to a later chain. Do not
patch the final tarball or report.

## 10. Execute this chain's sole native attempt

Use the exact final artifact and exact selected stable Codex CLI:

```bash
./scripts/run-codex-real-journey.sh \
  --validation-report "$CODEX_VALIDATION_REPORT" \
  --artifact-report "$CODEX_ARTIFACT_REPORT" \
  --codex-executable "$CODEX_EXECUTABLE" \
  --attempt-ledger "$CODEX_ATTEMPT_LEDGER"
```

`CODEX_EXECUTABLE` is the absolute exact 0.147.0 executable and `CODEX_ATTEMPT_LEDGER` is the same
absolute durable path initialized in step 7. Switching to another or empty ledger is rejected.
T058 is the only Feature 003 task permitted to start Codex.
After every preflight passes, the runner atomically reserves the chain immediately before spawn;
this invocation is the chain's only launch. Any existing evidence path, passing ledger, or unresolved
reservation selects a no-host validation/recovery path and can never fall through to a launch. The
passing journey runs through all required checkpoints:

1. install the tarball into an isolated prefix with scripts disabled;
2. run explicit setup and exact marketplace/plugin readback;
3. repeat matching setup as an idempotent no-op;
4. start a fresh Codex session;
5. send an ordinary request, record any completed host command as a safe non-verification fact,
   and prove zero calls to the six Dev Flow tools and zero tasks;
6. prove that bare `$dev-flow`, a wrong plugin/Skill namespace, and a missing selector do not select
   the installed Skill; then exercise empty/conversational and non-Git invocations with exact
   `$dev-flow-codex:dev-flow`, allowing a failed read-only Git discovery command as a
   non-verification fact while still proving zero Dev Flow calls/tasks;
7. invoke the installed plugin Skill with exact selector `$dev-flow-codex:dev-flow` and one
   substantive single-repository change; bare `$dev-flow` is not that Skill's Codex 0.147 identity;
8. commit at least two Core workflow actions;
9. close Codex before terminal outcome;
10. start a new Codex session in the same repository;
11. explicitly resume and prove the same task ID with advancing revisions;
12. in the new session call `dev_flow_get_task` then `dev_flow_get_next_action` before any later
    mutation, derive the Core verification budget, and record each complete official
    `command_execution` from all four sessions as role/event/item/command/output digests plus status
    and exit code. Classify ordinary/invalid commands and substantive/resume repository work as
    non-verification. Count only the single proof bound one-to-one to submitted and retained Core
    evidence, and stay within the budget/full-suite policy;
13. reach authoritative Core `DONE`;
14. stop Codex/Core;
15. record repository and complete task-data manifests;
16. run explicit deregistration and absence readback;
17. prove receipt removal and adjacent-file preservation;
18. prove task-data manifest equality and direct task reopen;
19. uninstall the npm package separately;
20. repeat removal as a no-op and perform a compatible reinstall check;
21. prove repository digest is unchanged by removal.

The four `codex exec --json` processes must yield four distinct nonempty thread IDs. Validate the
raw task observations for revision non-regression before collapsing adjacent duplicate revisions.
The logical proof name is `git hash-object native-proof.txt`; the only accepted Codex 0.147 macOS
rendering is the byte-exact `/bin/zsh -lc 'git hash-object native-proof.txt'`. Compare that closed
rendering directly, without a generic shell parser, then persist only its SHA-256. An occurrence in
ordinary/invalid or a second/Core-unbound occurrence fails the attempt. A literal pre-hash deny
check also rejects any rendered command containing the closed marker `go test`, `pnpm test`,
`pnpm run test`, `pnpm run validate`, or `node --test`; it does not parse or normalize shell syntax. Other
substantive/resume repository commands remain safe-hashed
non-verification facts and do not consume the Core verification budget. Raw command/output/path
material is discarded after hashing.
Both setup and reinstall readback must contain exactly one owned marketplace, exactly one installed
owned plugin, and zero available plugins; extra registry entries fail the attempt. Direct Core reopen
is a bounded JSON-RPC channel: any non-JSON line, unknown or duplicate response ID, or stdout/stderr
limit breach fails closed. The evidence stores retained-data location only as isolation kind,
workspace-relative `data`, and SHA-256 of the canonical path, never the absolute path.

After host success, the script first fsyncs immutable observed facts plus exact final evidence and
ledger candidates outside the repository. Before publication it runs the complete structural and
semantic validator against those exact candidate bytes, the unchanged reports, artifact bytes,
stable ledger identity, and observed facts. Only a passing candidate may be published at
`tests/journeys/evidence/codex-macos-arm64.json` with a create-no-replace atomic operation and only
then atomically replaces the reserved ledger with the precomputed exact final bytes. Evidence
includes both exact report digests, artifact `built_at`, chain/ledger identity, actual total attempt
count, commit protocol, observed-facts digest, the root validation result from step 7, frozen source
commit, and final artifact digest. Do not manually edit the record.

When the journey cannot finish, write an honest `failed` or `blocked` diagnostic that conforms to
`contracts/native-attempt-diagnostic.schema.json` with only observed fields under the external chain
recovery directory, finalize and retain the external ledger entry,
leave the canonical repository evidence path absent, and treat that chain's artifact as invalid. Do
not fabricate task lineage, completed lifecycle data, patch the diagnostic, or relaunch the same
chain. The consumed attempt-1 v1 and attempt-2 v2 diagnostic/facts bytes remain immutable and valid.
Every later diagnostic uses version 3, `external-failure-record-v3`, and a required `failure_kind`.
A completed-command failure uses `command_event` and requires the closed safe object
`{session_role,event_type,command_sha256,output_sha256,status,exit_code}`; a `non_command` failure
prohibits that object. Version-3 failure/skip observations use only closed phase/reason codes and a
detail SHA-256.

Complete install/setup/readback and final immutable-input preflight before reserving an attempt;
failure there writes no ledger entry/diagnostic and starts no session. Immediately before reservation,
initialize ordered observations for `ordinary`, `invalid`, `substantive`, and `resume`. Persist all
four to both the failure-observed-facts file and diagnostic
before cleanup, including the closed stage, nullable exit/signal, thread presence, stdout/stderr byte
counts and SHA-256, and closed event/completed-item/MCP-status counts. Each stream is limited to
64 MiB. Unstarted roles remain zero-count `not_started` observations. The two files must carry the
same four observations, while the ledger binds the exact failure-observed-facts bytes. Never store
raw JSONL, stderr, prompt, command, output, environment, secret, thread ID, or repository path.
Accept diagnostic v1 only for the exact immutable attempt 1 and v2 only for exact immutable attempt
2; every later attempt is v3 and any v1/v2 downgrade is invalid.
Another launch requires a source correction and a
wholly new step 7–9 chain using the same durable ledger. Only the unique passing attempt supports
the product claim, and no launch is permitted after it. Regenerating reports for an
already-attempted source commit does not create a new launch allowance.

Every admission and reservation validates the complete ledger history: sequential attempt numbers,
unique source/chain identities, status/completion consistency, at most one final pass, and at most
one unresolved final reservation. Reservation and both finalization paths use a closed PID/owner
token/ledger-ID/operation/expected-digest lock and re-read the expected ledger bytes under that lock
immediately before replacement. Only a valid lock whose PID is definitely dead can be removed as
stale; live, permission-ambiguous, malformed, or wrong-ledger locks block.

Crash recovery never launches Codex. If evidence was published while the ledger remains reserved,
the evidence is already the admission pass-lock; recovery validates its exact bytes and may only
idempotently install the precomputed final ledger bytes. If the ledger is already `pass`, recovery
only validates both files. If evidence was not published, the consumed reservation cannot be
promoted to pass or relaunched; durable facts may finalize it failed/blocked, otherwise its lock
remains until conservatively finalized.

## 11. Revalidate published evidence without modifying it

Run the read-only published-record validator:

```bash
node ./scripts/validate-codex-journey-evidence.mjs \
  tests/journeys/evidence/codex-macos-arm64.json \
  --validation-report "$CODEX_VALIDATION_REPORT" \
  --artifact-report "$CODEX_ARTIFACT_REPORT" \
  --attempt-ledger "$CODEX_ATTEMPT_LEDGER"
```

Before publication, the candidate validator applied
`contracts/journey-evidence.schema.json` and checked:

- package/Core/root version equality;
- Codex range membership;
- exact validation/artifact report byte digests, closed shape, source/artifact identity, and no
  report substitution;
- the exact ordered targeted command set, exact root command, no omission/addition/duplicate, the
  compatibility-query/result ordering, and byte-for-byte evidence projection of those observations;
- `validation.completed_at <= artifact.built_at < evidence.recorded_at`;
- attempt-ledger digest, sequential count, unique chain IDs, exactly one passing attempt, and the
  evidence attempt as that passing entry;
- commit protocol and equal durable observed-facts digest in the evidence and passing ledger entry;
- strictly increasing revisions;
- equal pre/post-restart task IDs;
- four distinct nonempty Codex thread IDs, raw revision monotonicity, and strictly increasing
  adjacent-deduplicated lineage;
- at least two committed actions;
- Core call count within scenario budget, ordered restart `get_task`/`get_next_action` reads before
  another mutation, complete Core verification budget, exact completed command facts, reconciled
  submitted/retained automated evidence, and full-suite policy;
- authoritative task phase `DONE` and completed Core outcome;
- equal task-data manifests;
- repository-after equals repository-after-removal;
- empty unexpected paths;
- all lifecycle flags true plus exact setup/reinstall registry cardinality;
- retained-data non-secret descriptor and canonical-path digest equality;
- deterministic/root validation passed before final build.

The command above loads all four closed schemas, the artifact/root version, and the unchanged
reports/ledger, then reruns the complete passing semantics. The recovery-specific path additionally
proves that the published evidence and ledger are byte-for-byte the exact prevalidated candidates
and that their bound report/artifact/ledger identities remain unchanged. Neither path reinterprets
changed inputs as a new valid passing candidate. Before publication, a
candidate-validation failure retains the consumed attempt-ledger entry and
external diagnostics; after a source fix, execute a wholly new step 7–9 chain with the same ledger.
After publication, recovery mutation is limited to byte/identity/integrity revalidation and exact
ledger installation because the already prevalidated evidence is the permanent pass-lock. A
post-publication failure is terminal blocked recovery: do not patch/delete evidence, switch ledgers,
or launch another chain. The only permitted post-publication mutation is idempotent atomic
installation of the already prepared exact final ledger bytes.

## 12. Final read-only audit

Confirm that no repository file changed after source freeze except the unique passing evidence
record and that the final diff remains within the complete allowed Feature 003 scope. The reports
and complete attempt ledger remain outside the repository. Do not rebuild, rerun the host, publish,
tag, release, or mutate evidence after this audit.
