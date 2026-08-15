# Data Model: Codex Explicit Dev Flow

## Boundary

Feature 003 adds product packaging, registration ownership, and evidence records. It does not add a
second workflow model. Core Contract 0.1 remains the sole authority for Task, Action,
RepositoryBinding, RecoveryAssessment, Evidence, verification budget, and Outcome.

The Codex product may retain opaque Core identifiers only in test/native evidence. It may not
persist a task projection, state table, transition map, recovery decision, or completion rule.

## 1. Codex Product Artifact

One private local `.tgz` used for deterministic package checks or, after source freeze, the sole
final native journey.

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
| `final_artifact` | boolean | True only for the one artifact built after source freeze. |

### Validation

- Planning-time `0.147.x` is research history, not a permanent schema constant.
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
| `skill_path` | path | `plugin/skills/dev-flow/SKILL.md`. |
| `mcp_path` | path | `plugin/.mcp.json`. |
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
| `registration` | marketplace name/root, plugin name/selector/root | Equals supported Codex JSON readback. |
| `paths` | package root, runtime path, data root, receipt path | Canonical absolute paths; data root is never removal-owned. |
| `resource_digests` | plugin manifest, Skill, MCP configuration | Lowercase SHA-256 values. |
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

## 5. Codex Native Journey Evidence

The serialized structural contract is
[contracts/journey-evidence.schema.json](./contracts/journey-evidence.schema.json). It supports
honest `pass`, `failed`, and `blocked` records.

### Common fields

| Group | Contents |
|---|---|
| `classification` | Native Codex CLI, macOS arm64, final artifact. |
| `versions` | Exact Codex version, selected compatible range, package/Core versions, Core Contract 0.1. |
| `identity` | Frozen source commit, artifact digest, shared fixture digest. |
| `validation` | Targeted check and root `pnpm run validate` observations from the same source commit. |
| `failures` / `skips` | Every observed failure, blocker, or unexecuted required check. |

A `failed` or `blocked` record may stop before task creation, restart, or removal. It is not required
to fabricate unavailable lineage or lifecycle fields.

### Passing journey fields

| Group | Required contents |
|---|---|
| `task_lineage` | Task ID before/after restart, revisions, at least two Core-confirmed actions, terminal outcome. |
| `invocation` | `$dev-flow`, Core call count, scenario budget, zero implicit calls, read-before-retry observations. |
| `lifecycle` | Setup/readback, restart/resume, removal/readback, data retention, task reopen, compatible reinstall. |
| `repository` | Target path, before/after/removal digests, intended and unexpected paths. |
| `task_data` | Canonical file lists and manifest digests before/after removal. |

## 6. Semantic Evidence Validation

JSON Schema validates shape only. The planned
`scripts/validate-codex-journey-evidence.mjs` validates cross-field semantics for `status=pass`:

1. package version equals Core version and repository `VERSION`;
2. exact Codex version satisfies the recorded range;
3. targeted/root validation source commit equals evidence source commit;
4. artifact metadata identifies the artifact built from that source;
5. revisions are strictly increasing;
6. committed-action revisions appear in the lineage and action IDs are unique;
7. task ID before restart equals task ID after restart;
8. action count is at least two;
9. Core call count does not exceed the scenario budget;
10. terminal outcome is exactly `DONE`;
11. task-data file lists and manifest digests are equal before/after removal;
12. repository digest after completion equals digest after removal;
13. unexpected changed paths are empty;
14. every required lifecycle boolean is true;
15. targeted checks and root validation passed before artifact creation;
16. passing failures/skips arrays are empty.

The validator is read-only. Evidence validation failure causes a fresh deterministic/final-artifact/
native-journey chain; evidence is not manually patched into compliance.

## 7. Final Artifact Lifecycle

```text
compatibility revalidation
  -> deterministic tests
  -> root validation
  -> pre-final read-only audit
  -> frozen source commit
  -> exactly one final artifact
  -> exactly one real Codex journey
  -> one evidence write
  -> structural validation
  -> semantic validation
  -> final read-only audit
```

Any source change after artifact creation invalidates the artifact. Any evidence-generation failure
invalidates the native record; a replacement record comes only from a rerun against a newly accepted
artifact.

## Relationships

```text
Codex Product Artifact
  ├── contains one Codex Plugin Bundle
  ├── contains one Core executable
  └── produces one Registration Receipt after setup

Deterministic package/fake inputs
  └── produce Deterministic Journey Checkpoints (never native)

Frozen source + one final artifact + one real Codex session
  └── produce Codex Native Journey Evidence
        └── references opaque Core task/action IDs
```

No record in this document becomes a second persistence location for Core workflow truth.
