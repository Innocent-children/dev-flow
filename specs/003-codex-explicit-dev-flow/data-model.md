# Data Model: Codex Explicit Dev Flow

## Boundary

Feature 003 adds product packaging, registration ownership, and evidence records. It does not add a
second workflow model. Core Contract 0.1 remains the sole authority for Task, Action,
RepositoryBinding, RecoveryAssessment, Evidence, verification budget, and Outcome.

The Codex product may retain opaque Core identifiers only in test/native evidence. It may not
persist a task projection, state table, transition map, recovery decision, or completion rule.

## 1. Codex Product Artifact

One private local `.tgz` used for deterministic package checks or, after source freeze, the current
immutable chain's sole final-artifact candidate. Failed/blocked chains may be discarded; only the
unique passing chain establishes support.

| Field | Type | Rules |
|---|---|---|
| `name` | string | Exactly `dev-flow-codex`. |
| `version` | semver | Equals repository `VERSION`, plugin version, and embedded Core version. |
| `private` | boolean | Exactly `true`. |
| `platform` | string | `darwin-arm64` for Feature 003 evidence. |
| `source_commit` | Git SHA | Exact frozen source used to build the artifact. |
| `artifact_sha256` | digest | SHA-256 of the exact `.tgz`. |
| `core_version` | semver | Equals `version`. |
| `codex_compatibility` | range string | Implementation-time selected bounded range. |
| `codex_actual` | semver | Exact stable CLI used for native evidence. |
| `plugin_count` | integer | Exactly `1`. |
| `skill_count` | integer | Exactly `1`. |
| `mcp_server_count` | integer | Exactly `1`. |
| `runtime_path` | package-relative path | Inside the artifact and executable. |
| `final_artifact` | boolean | True only for the one artifact built for its frozen source/validation chain. |

### Validation

- Revalidation selected exact stable `0.147.0` within `>=0.147.0 <0.148.0`; those values are
  implementation evidence, not permanent product-schema constants.
- Compatibility is revalidated before final checks; every compatibility-bearing document/test is
  updated as one serialized change.
- A final artifact is built only after targeted checks and root validation pass.
- Any source change after final artifact creation invalidates that artifact.
- The packed allowlist excludes source checkout data, shared fixture copies, test fakes, evidence,
  task data, receipts, and a second platform runtime.

## 2. Codex Plugin Bundle

| Field | Type | Rules |
|---|---|---|
| `plugin_name` | string | Exactly `dev-flow-codex`. |
| `plugin_version` | semver | Equals product/Core version. |
| `manifest_path` | path | `plugin/.codex-plugin/plugin.json`. |
| `skill_name` | string | Resource/frontmatter base name exactly `dev-flow`. |
| `skill_full_name` | string | Exactly `dev-flow-codex:dev-flow`, derived as `plugin_name + ":" + skill_name`. |
| `explicit_selector` | string | Exactly `$dev-flow-codex:dev-flow`, derived as `"$" + skill_full_name`; bare `$dev-flow` is not an alias. |
| `skill_path` | path | `plugin/skills/dev-flow/SKILL.md`. |
| `skill_metadata_path` | path | `plugin/skills/dev-flow/agents/openai.yaml`; disables implicit invocation. |
| `mcp_path` | path | `plugin/.mcp.json`. |
| `mcp_schema` | URI | `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`. |
| `mcp_server_count` | integer | Exactly `1`. |
| `tool_names` | set | Exactly the six Core Contract 0.1 raw names. |
| `launcher_command` | argv | `dev-flow-codex mcp`, without shell interpolation. |

The bundle contains no protocol proxy, task state, action catalog, transition rules, recovery
classifier, error taxonomy, completion predicate, shell MCP, listener, or remote transport.

## 3. Registration Receipt

The serialized contract is
[contracts/registration-receipt.schema.json](./contracts/registration-receipt.schema.json).

| Group | Required contents | Invariant |
|---|---|---|
| `product` | name, product/Core versions, selected Codex range | Package/Core versions match; range is the implementation-time range. |
| `host` | surface, exact Codex version, OS, architecture | `codex-cli`, a version satisfying the selected range, `darwin`, `arm64`. |
| `registration` | marketplace name/root, plugin name/selector/root | Equals the owned identity in official camelCase Codex JSON readback. Marketplace root is `marketplaces[].root`; plugin root is `installed[].source.path`. |
| `paths` | package root, runtime path, data root, receipt path | Canonical absolute paths; data root is never removal-owned. |
| `resource_digests` | plugin manifest, Skill, Skill metadata, MCP configuration | Lowercase SHA-256 values. |
| `installed_at` | timestamp | Written only after successful readback. |

### Ownership

- Receipt path:
  `~/Library/Application Support/dev-flow/registrations/codex.json`.
- Default Core data path:
  `~/Library/Application Support/dev-flow/data`.
- Explicit `DEV_FLOW_DATA_DIR` takes precedence and must be an existing usable directory.
- Codex owns its config/cache; npm owns the package; Core owns task data; the product receipt owns
  only the recorded registration identity.
- Removal may invoke supported Codex commands and delete the exact receipt. It may not recursively
  delete parents, package roots, Codex cache/config, Core data, repositories, or adjacent user files.

### Registration observations

Codex CLI 0.147 readback is modeled without adapter aliases:

- marketplace list: `{marketplaces: [{name, root, marketplaceSource}]}`;
- plugin list: `{installed: [{pluginId, name, marketplaceName, version, installed, enabled, source,
  marketplaceSource, installPolicy, authPolicy}], available: []}` when `--available` is omitted;
- add/remove outputs use the exact documented camelCase result fields.

The plugin add result's `installedPath` is a Codex-owned cache observation. It is validated during
setup but is not a product deletion target and is not needed for absence readback.

```text
ABSENT
  -- validated setup + supported mutation + exact readback -->
REGISTERED

REGISTERED
  -- matching repeated setup -->
REGISTERED (no-op)

REGISTERED
  -- validated removal + absence readback -->
ABSENT

any state
  -- ownership/readback conflict -->
UNCHANGED (fail closed)
```

These are registration observations, not Core workflow states.

## 4. Deterministic Journey Checkpoint

A test-only record produced by fake-Codex/fake-Core/journey-harness checks.

| Field | Type | Rules |
|---|---|---|
| `classification` | enum | `static`, `simulated`, or `integration`; never `native-host`. |
| `through_stage` | enum | `setup`, `done`, or `remove`. |
| `real_codex_started` | boolean | Exactly `false`. |
| `native_evidence_written` | boolean | Exactly `false`. |
| `fixture_identity` | digest | Shared fixture aggregate used by the fake Core. |
| `observations` | list | Ordered calls, fingerprints, task lineage, budgets, or lifecycle facts. |

T030, T043, and T051 may produce these checkpoints only. They cannot satisfy native success
criteria.

## 5. Frozen-Chain Reports and Native Attempt Ledger

### T055 Validation Report

The closed contract is
[contracts/validation-report.schema.json](./contracts/validation-report.schema.json). It is created
outside the repository only after the complete targeted set and root validation pass.

| Field | Rules |
|---|---|
| `schema_version` / `report_type` | Exactly `1` / `dev-flow-codex-validation`. |
| `source_commit` / `source_dirty` | Clean source identity validated by every command observation / exactly `false`. |
| `attempt_ledger_id` | Stable path-bound identity of the one durable external ledger reused by every native attempt/recovery chain. |
| `codex_revalidation` | Official `@openai/codex` `latest` dist-tag result, selected range, and exact UTC query time immediately before the final deterministic chain. |
| `completed_at` | Completion of the entire T055 gate; not earlier than any command observation. |
| `targeted_checks` | Non-empty ordered list of every exact targeted command, `pass`, same source commit, and completion time. |
| `root_validation` | Exact `pnpm run validate`, `pass`, same source commit, completion time. |

### T057 Final Artifact Report

The closed contract is
[contracts/artifact-report.schema.json](./contracts/artifact-report.schema.json). The final builder
creates it once outside the repository alongside exactly one `.tgz`.

| Field | Rules |
|---|---|
| `schema_version` / `report_type` | Exactly `1` / `dev-flow-codex-final-artifact`. |
| `artifact_path` / `artifact_sha256` | Absolute exact `.tgz` and digest recomputed by the runner. |
| `package_version` / `core_version` | Equal repository `VERSION`. |
| `codex_compatibility` | Exact selected bounded range. |
| `source_commit` / `source_dirty` | Same as validation/frozen HEAD / exactly `false`. |
| `final_artifact` / `platform` | Exactly `true` / `darwin-arm64`. |
| `package_allowlist_verified` | Exactly `true`; the final tarball matched the closed product allowlist. |
| `runtime_executable_verified` | Exactly `true`; the packaged detached Core had executable mode and reported the bound version. |
| `built_at` | Artifact/report completion; not earlier than validation and earlier than evidence. |

Both report SHA-256 values are over the exact retained report bytes. Missing/extra fields, digest
drift, replacement, source mismatch, or time inversion fails before a native host launch.
The writer itself performs the official dist-tag query. Semantic validation requires
`codex_revalidation.queried_at <= each targeted/root completed_at <= completed_at` and requires the
evidence validation observations to equal the report observations exactly.

### Native Attempt Ledger

The closed external operational contract is
[contracts/native-attempt-ledger.schema.json](./contracts/native-attempt-ledger.schema.json). It is
machine-maintained outside the repository and retained when a failed artifact/evidence pair is
discarded. Its root `ledger_id` is created once before the first T055 chain, recorded into every
validation report and final evidence, and the same absolute path/identity is reused for all later
chains and recovery; replacing it with an empty ledger is forbidden.

The ID is `sha256("dev-flow-codex-native-ledger-v1\n" + canonical_absolute_path + "\n")`.
Initialization requires an absolute path with an existing canonical parent and a non-symlink leaf;
every later operation recomputes the ID from the supplied path before reading or locking the ledger.
A byte copy at another path therefore cannot become the same ledger.

Each entry records a sequential attempt number, chain ID, source commit, both exact report digests,
artifact digest, reservation time, status, and—for finalized entries—completion time. `status` is
`reserved|pass|failed|blocked`; `reserved` has no completion/facts digest, while `pass` also binds
the exact durable observed-facts digest. After all preflight checks pass and immediately before host
spawn, the writer atomically reserves the next number/chain. Interruption therefore consumes the
chain. The chain ID is SHA-256 of canonical UTF-8 JSON containing exactly
`source_commit`, `validation_report_sha256`, `artifact_report_sha256`, and `artifact_sha256`, with
keys sorted bytewise and no insignificant whitespace. Chain IDs and source commits are unique; one
chain can launch at most once, and regenerating reports for an already-attempted source commit does
not create retry authority. After any passing entry no later launch is permitted. A failed/blocked
entry requires a source fix and new validation/freeze/artifact reports before another T058 attempt.

Schema validation is followed by ledger semantics both before admission and again under the
mutation lock: attempt numbers are exactly `1..N`; chain IDs and source commits are unique; a
finalized entry has `completed_at`; a passing entry also has `observed_facts_sha256`; at most one
pass exists and no entry follows it; at most one reservation exists and it is the final entry; and
an unresolved reservation blocks every launch. The sibling lock file is a closed JSON object with
exactly `schema_version=1`, `ledger_id`, random `owner_token`, positive `pid`, `created_at`,
`operation=reserve|finalize-pass|finalize-failure`, and `expected_ledger_sha256`. Recovery may unlink
it only after validating every field and proving the recorded PID is dead; live, `EPERM`, malformed,
wrong-ledger, or otherwise ambiguous locks fail closed. Every atomic ledger replacement re-reads the
ledger and compares `expected_ledger_sha256` while the same owner lock is held.

### Passing Commit and Crash Recovery

After the host finishes successfully, the writer create-exclusively persists immutable observed
facts outside the repository. It fixes `recorded_at`, hashes those exact bytes, derives the exact
final `pass` ledger bytes, hashes that ledger candidate, then derives the exact final evidence bytes
that bind both digests and `commit_protocol=evidence-create-before-ledger-finalize-v1`. The observed
facts and both candidates are fsynced under a chain-ID recovery directory before either authoritative
file changes. Before publication, the structural validator checks all four closed documents and the
semantic validator checks the exact candidates together with the unchanged reports, artifact, and
durable ledger identity. Publication is forbidden unless this complete candidate validation passes.

The only pass commit order is:

1. publish the exact evidence candidate at
   `tests/journeys/evidence/codex-macos-arm64.json` with a same-filesystem atomic,
   create-no-replace operation;
2. atomically replace the external reserved ledger with the exact precomputed final ledger bytes;
3. read and byte/identity-validate both authoritative files without changing them.

Any pre-existing evidence path blocks host launch. A structurally and semantically valid passing
record is the admission pass-lock even while its matching ledger entry remains `reserved`. If a
crash occurs after evidence publication, recovery verifies the published bytes against the durable
facts/candidate and may only idempotently install the exact precomputed final ledger bytes; it never
starts Codex. If the ledger was already finalized, recovery only validates the two files. If a crash
occurs before evidence publication, the reservation still forbids another launch and cannot become
`pass`; durable facts may support finalizing it as `failed`/`blocked`, otherwise it stays reserved and
blocks later attempts until conservatively finalized. No recovery path edits or regenerates the
published evidence. Because candidate validation precedes publication, a post-publication integrity
failure is a terminal blocked recovery condition and cannot authorize another native chain.

The repository path `tests/journeys/evidence/codex-macos-arm64.json` and its schema are pass-only. A
failed or blocked diagnostic uses the independent closed
[contracts/native-attempt-diagnostic.schema.json](./contracts/native-attempt-diagnostic.schema.json),
`report_type=dev-flow-codex-native-attempt-diagnostic`. The schema conditionally accepts immutable
attempt-1 `schema_version=1` / `commit_protocol=external-failure-record-v1` history and attempt-2
`schema_version=2` / `commit_protocol=external-failure-record-v2` history plus the immutable
attempt-3 `schema_version=3` / `commit_protocol=external-failure-record-v3` history byte-unchanged.
Every record after attempt 3 uses `schema_version=4` / `commit_protocol=external-failure-record-v4`.
Structural validation requires exact v1/v2/v3 attempt and total counts 1/2/3, and v4 counts of at
least 4. Semantic validation binds the version, identity, and facts digest to the exact
durable-ledger entry and rejects v1/v2/v3 for any later attempt. The digest-bound immutable v1 text is a legacy-only exception and cannot
be used as a new-record template. All versions record
status, time, classification, versions, chain/ledger/report/artifact identity, validation projection,
the consumed attempt, observed failure, and honest skips only. When a v2/v3/v4 failure is attributable
to a completed command event, `failure_kind=command_event` requires `failure_context` as the closed
safe projection `{session_role,event_type,command_sha256,output_sha256,status,exit_code}`. It contains
no raw command, output, environment, or path. `failure_kind=non_command` prohibits that context.
Version-2/3/4 failure and skip observations are closed `{phase_code,reason_code,detail_sha256}` values,
so their only unbounded diagnostic detail is represented by a digest.

Version 4 retains those command rules and adds `failure_kind=mcp_event` with a separate closed
`mcp_failure_context`:

| Field | Meaning |
|---|---|
| `session_role` | One of `ordinary`, `invalid`, `substantive`, or `resume`. |
| `event_type` | Exactly `mcp_tool_call`. |
| `event_index` | Zero-based order among events after the initial `thread.started`. |
| `tool` | Exactly one of the six Core Contract 0.1 tool names. |
| `status` | Exactly `failed`. |
| `result_kind` | `tool_error_result` for a complete Core/MCP is-error result whose structured envelope is `ok=false`, or `transport_error` when no Core result exists. |
| `result_sha256` | SHA-256 of recursively key-sorted compact UTF-8 JSON for the complete result; required only for `tool_error_result`, otherwise null. |
| `error_sha256` | SHA-256 of recursively key-sorted compact UTF-8 JSON for the typed error; required only for `transport_error`, otherwise null. |

No arguments, result, error, JSONL, tool preview, thread ID, repository path, environment value, or
secret is serialized. `command_event` requires only the existing command context, `mcp_event`
requires only the MCP context, and `non_command` prohibits both. Version-4 failure and skip
observations remain the closed `{phase_code,reason_code,detail_sha256}` shape.

For a v4 `mcp_event`, semantic validation binds the context to its fixed-role observation: that
observation has `failure_stage=mcp_failed`, at least one completed MCP item, at least one failed and
one Dev Flow MCP count, and `0 <= event_index < event_counts.total - 1` after its valid initial
`thread.started`. The failure is exactly `{phase_code:"codex-session",
reason_code:"mcp-event-failed",detail_sha256}`. The writer attaches context only to the error thrown
from that exact failed item; an earlier recovered failed item cannot supply context for an unrelated
later failure.

Versions 3 and 4 additionally require `session_observations` as an ordered four-element array. The role at
each index is fixed to `ordinary`, `invalid`, `substantive`, then `resume`; unstarted roles remain
explicit rather than disappearing. Each closed role projection contains:

| Field | Meaning |
|---|---|
| `session_role` | One fixed role from the ordered four-role sequence. |
| `failure_stage` | One of `not_started`, `spawn_failed`, `capture_failed`, `process_exited`, `parse_failed`, `mcp_failed`, `completed`, or `stop_marker_missing`. |
| `exit_code` / `signal` | Observed process termination; each is nullable when not available. |
| `thread_present` | Whether at least one structurally valid `thread.started` event with a nonempty thread ID was observed; no thread ID is retained. |
| `stdout_bytes` / `stderr_bytes` | Captured byte counts, each bounded to 64 MiB. |
| `stdout_sha256` / `stderr_sha256` | SHA-256 of the exact bounded streams; no stream text is retained. |
| `event_counts` | Closed counts for total, invalid JSON, thread-started, item-started, item-completed, turn-completed, error, and other events. |
| `item_counts` | Closed completed-item counts for total, agent message, command execution, MCP tool call, and other. |
| `mcp_status_counts` | Closed MCP counts for total, Dev Flow, completed, failed, and other statuses. |

Semantic validation requires a `not_started` observation to have null exit/signal, false thread
presence, zero byte/count fields, and the SHA-256 of empty stdout/stderr. Every role that reached
process close has at least an exit code or signal. `event_counts.thread_started` counts only valid
nonempty-ID thread events; malformed thread events enter `other` and require `parse_failed`, while
multiple valid thread events remain counted and also require `parse_failed`. `thread_present` is true
exactly when `event_counts.thread_started > 0`; named event buckets plus invalid/other equal total; named item
buckets equal item total and do not exceed completed-item events; MCP status buckets equal MCP total,
`dev_flow <= total`, and MCP total does not exceed completed MCP items. The four role observations
must match the failure-observed-facts projection exactly.

The external `failure-observed-facts.json` is the closed subset
`{schema_version,failure_kind,failure,failure_context?,mcp_failure_context?,session_observations}`.
Its four observations
must equal the diagnostic projection exactly, and its exact bytes are bound by the ledger
`observed_facts_sha256`. The writer schema-validates the diagnostic and checks that equality before
atomic writes under the external chain recovery directory and before deleting the isolated host
workspace. Neither file claims the canonical passing journey-evidence contract or creates the
canonical evidence leaf. The durable ledger, not the diagnostic, is the cross-chain attempt
authority.

## 6. Codex Native Journey Evidence

The serialized structural contract is
[contracts/journey-evidence.schema.json](./contracts/journey-evidence.schema.json). It supports only
the unique canonical `pass` record; failed and blocked attempts use the independent diagnostic
contract above.

### Common fields

| Group | Contents |
|---|---|
| `classification` | Native Codex CLI, macOS arm64, final artifact. |
| `versions` | Exact Codex version, selected compatible range, package/Core versions, Core Contract 0.1. |
| `identity` | Frozen source commit, artifact/report digests, artifact build time, shared fixture digest. |
| `validation` | Validation-report digest/completion and its targeted/root observations from the same source commit. |
| `native_attempt` | Chain ID, stable ledger ID, sequential attempt number, actual total attempt count, final ledger digest, commit protocol, and durable observed-facts digest. |
| `failures` / `skips` | Empty for the canonical passing record. |

### Passing journey fields

| Group | Required contents |
|---|---|
| `task_lineage` | Four distinct thread IDs, task ID before/after restart, raw non-regressing revisions, adjacent-deduplicated strictly increasing lineage, at least two Core-confirmed actions, terminal Core phase/outcome. |
| `invocation` | Exact installed-plugin selector `$dev-flow-codex:dev-flow`, Core call count/scenario budget, zero implicit calls, ordered restart recovery reads, every complete recoverable failed MCP item plus its Core-directed recovery references, complete Core verification budget, every official completed command execution as a role-scoped safe fact, the Core-bound verification subset, and reconciled submitted/retained automated evidence counts. |
| `lifecycle` | Setup/readback, restart/resume, removal/readback, data retention, task reopen, compatible reinstall, and exact setup/reinstall registry cardinalities. |
| `repository` | Target path, before/after/removal digests, intended and unexpected paths. |
| `task_data` | Canonical file lists and manifest digests before/after removal plus a non-secret retained-data descriptor `{kind:"isolated-explicit-data-directory", workspace_relative_path:"data", canonical_path_sha256}`; no absolute data path. |

The ledger-bound passing observed facts retain a closed `mcp_call_facts` projection for every Dev
Flow terminal item: role, event index, one of the six tools, argument/result digests, status,
`success_result|tool_error_result`, nullable task ID/revision/outcome, and nullable bounded Core error
code plus retry-safe/action values. Failed apply facts also retain the safe request task ID and
expected revision. Successful results have null error/recovery fields; complete Core errors have the
exact safe error/recovery projection; transport errors are not eligible for a pass.
No raw argument, result, error message, recovery message, JSONL, thread ID, or path is retained.

## 7. Semantic Evidence Validation

JSON Schema validates shape only. The planned
`scripts/validate-codex-journey-evidence.mjs` validates cross-field semantics for `status=pass`:

1. package version equals Core version and repository `VERSION`;
2. exact Codex version satisfies the recorded range;
3. validation/artifact report bytes match their evidence digests and closed schemas, and the exact
   ordered targeted commands appear once with no omission or duplicate;
4. report/evidence source commits and artifact identity match;
5. `validation.completed_at <= artifact.built_at < evidence.recorded_at`;
6. stable ledger ID, chain ID derivation, ledger digest/count, unique chain/source IDs, and the
   single passing attempt match;
7. all four thread IDs are nonempty/distinct; raw revisions are monotonic before only adjacent
   duplicates are collapsed, and the resulting lineage is strictly increasing;
8. committed-action revisions appear in the lineage and action IDs are unique;
9. task ID before restart equals task ID after restart;
10. action count is at least two;
11. Core call count does not exceed the scenario budget, and restart recovery observes
    `dev_flow_get_task` then `dev_flow_get_next_action` before any later mutation;
12. `recoverable_mcp_failure_facts` is the exact ordered safe projection of every complete
    `status=failed` Dev Flow item that the Core allows the passing chain to recover from, bounded by
    the existing 64-call scenario budget rather than an unrelated smaller limit. Each fact
    contains only role/event index, exact `dev_flow_apply_action`, canonical request task ID/expected
    revision, failed status, `tool_error_result`, whole-result digest,
    bounded Core error code, `recovery.retry_safe=false`, `recovery.action` in
    `read_task|read_next_action`, and safe role/index/tool/result-digest/task-ID/revision references
    to the later `get_task`, `get_next_action`, and next `apply_action`. References match durable `mcp_call_facts` and are
    strictly ordered failed item < get-task < get-next-action < next mutation across the fixed role
    order and per-role event indexes; all three references bind complete successful call facts, and
    the failed request and all references use the canonical journey task ID, and its expected
    revision belongs to raw lineage. The two read revisions are equal; the completed
    `success_result` apply revision is greater, occurs in `raw_revisions`, and matches one
    `committed_actions` entry. Transport failures, raw result/error/messages, missing or
    duplicate facts/references, and an earlier mutation fail closed. The
    `read_before_retry_observations` count equals the distinct fact-referenced recovery reads plus
    the fixed restart pair, deduplicated by role/event index when one pair serves both purposes;
13. `session_command_facts` is the exact bounded projection of every official `item.completed`
    `command_execution` across the four sessions, ordered within each role and containing only role,
    event index/type, item/command/output digests, status, exit code, and classification; the raw
    command/output/path values never enter durable evidence;
14. ordinary and invalid facts are all `nonverification` and those sessions have zero Dev Flow
    calls/tasks; substantive/resume repository inspection and implementation facts may also be
    `nonverification`; the only `verification` fact is a successful exact controlled Codex 0.147
    macOS rendering of logical proof `git hash-object native-proof.txt`;
15. each `verification_commands` entry matches exactly one `verification` session fact by role,
    event index and digests, uses the logical proof name rather than raw rendered text, and matches
    one submitted and one retained Core automated check; duplicates and unbound proof renderings
    fail closed, as does any rendered command containing a closed literal marker `go test`,
    `pnpm test`, `pnpm run test`, `pnpm run validate`, or `node --test`; only this subset counts
    against the complete Core-derived budget and `allow_full_suite`;
16. authoritative terminal task phase is `DONE` and the Core outcome is completed;
17. task-data file lists and manifest digests are equal before/after removal, and the non-secret
    retained-data descriptor matches durable observed facts without exposing an absolute path;
18. repository digest after completion equals digest after removal;
19. unexpected changed paths are empty;
20. every required lifecycle boolean is true, and setup/reinstall readback each has exactly one
    owned marketplace, one installed owned plugin, and zero available plugins;
21. targeted checks and root validation passed before artifact creation;
22. passing failures/skips arrays are empty.

Candidate validation is read-only. A failure before publication consumes the reserved attempt,
retains its external diagnostic/ledger history, and permits a fresh deterministic/final-artifact/
native-journey chain only after a source fix. Published passing evidence was already fully validated;
post-publication validation only rechecks its exact bytes and bound identities. A failure then is a
terminal blocked recovery condition and never authorizes deletion, repair, ledger switching, or a
new host launch.

## 8. Final Artifact Lifecycle

```text
compatibility revalidation
  -> deterministic tests
  -> root validation + closed T055 validation report
  -> pre-final read-only audit
  -> frozen source commit
  -> exactly one final artifact + closed T057 artifact report for that chain
  -> at most one native launch for that immutable chain
  -> attempt-ledger reservation before spawn
  -> durable observed facts + exact evidence/final-ledger candidates
  -> complete structural + semantic candidate validation
  -> create-no-replace evidence publish
  -> exact ledger finalize
  -> post-publication byte + identity revalidation/recovery
  -> final read-only audit
```

Any source change after artifact creation invalidates the artifact. Any native or pre-publication
candidate failure invalidates that chain's artifact and external diagnostic but retains its attempt
entry. A replacement attempt requires a source fix and new T055–T057 identities using the same
ledger; the same chain is never relaunched. Once passing evidence is published, it is never
invalidated into retry authority. Only the unique passing attempt establishes support.

## Relationships

```text
Codex Product Artifact
  ├── contains one Codex Plugin Bundle
  ├── contains one Core executable
  └── produces one Registration Receipt after setup

Deterministic package/fake inputs
  └── produce Deterministic Journey Checkpoints (never native)

Frozen source + closed validation report + one final artifact/report
  └── derive one immutable chain ID
        └── permits at most one native launch and appends one attempt-ledger entry
              └── the unique passing attempt produces Codex Native Journey Evidence
                    └── binds both report digests, artifact build time, and opaque Core task/action IDs
```

No record in this document becomes a second persistence location for Core workflow truth.
