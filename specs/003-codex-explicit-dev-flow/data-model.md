# Data Model: Codex Explicit Dev Flow

## Boundary

This feature adds product packaging and registration records, not a second workflow model. Core Contract 0.1 remains the only authority for task state, revision, action schemas, recovery, repository claims, and terminal outcomes. The Codex product may retain opaque Core identifiers only as evidence; it may not persist a task projection or transition table.

## Entity 1: Codex Product Artifact

Represents the single private `.tgz` built for local validation.

| Field | Type | Validation | Purpose |
|---|---|---|---|
| `name` | string | exactly `dev-flow-codex` | Product identity |
| `version` | semver string | exactly root `VERSION` for this build | Cross-artifact identity |
| `private` | boolean | exactly `true` | Prevent accidental publication |
| `platform` | string | exactly `darwin-arm64` | Evidence boundary |
| `artifact_sha256` | lowercase hex string | 64 characters | Final-artifact identity |
| `core_version` | semver string | equals `version` | Embedded Core identity |
| `codex_compatibility` | range | `>=0.147.0 <0.148.0` | Validated host line |
| `plugin_count` | integer | exactly `1` | Closed product surface |
| `skill_count` | integer | exactly `1` | Single explicit entry point |
| `mcp_server_count` | integer | exactly `1` | Direct Core connection |
| `runtime_path` | package-relative path | inside the packed artifact and executable | Self-contained runtime |

### Validation rules

- The npm manifest, plugin manifest, embedded Core, root `VERSION`, receipt, and evidence record use the same version.
- The tarball allowlist contains no repository source tree, shared fixture copy, test-only fake, lifecycle mutation hook, or second host product.
- The runtime executable is produced in temporary pack staging; it is not committed as a repository binary.

## Entity 2: Codex Plugin Bundle

Represents the product resource discovered by Codex.

| Field | Type | Validation | Purpose |
|---|---|---|---|
| `plugin_name` | string | exactly `dev-flow-codex` | Stable registration identity |
| `plugin_version` | semver string | equals product version | Version parity |
| `manifest_path` | path | `plugin/.codex-plugin/plugin.json` | Required plugin manifest |
| `skill_path` | path | exactly `plugin/skills/dev-flow/SKILL.md` | Explicit `$dev-flow` entry |
| `mcp_path` | path | exactly `plugin/.mcp.json` | Bundled server configuration |
| `mcp_server_name` | string | exactly one product-owned name | Avoid collisions and aliases |
| `tool_names` | set of strings | exactly the six Core Contract 0.1 names | Closed tool surface |
| `launcher_command` | argv array | `dev-flow-codex mcp`, no shell interpolation | Direct inherited-stdio launch |

### Validation rules

- The Skill does not contain Core state or transition definitions.
- The MCP configuration names no proxy and declares no additional tool server.
- The launcher resolves only its package-local Core binary and never reads MCP payloads.
- The Skill refuses an invocation that lacks the exact explicit `$dev-flow` selector before making a Core call.

## Entity 3: Registration Receipt

Represents Codex registration ownership after a successful explicit setup. Its normative serialized form is [contracts/registration-receipt.schema.json](./contracts/registration-receipt.schema.json).

| Field group | Required contents | Invariant |
|---|---|---|
| `product` | name, version, Core version, Codex compatibility | Version identities match the installed package; the final tarball digest belongs to journey evidence |
| `host` | surface, exact Codex version, OS, architecture | `codex-cli`, compatible version, `darwin`, `arm64` |
| `registration` | marketplace name/root, plugin name/selector, plugin root | Values equal Codex JSON readback |
| `paths` | package root, runtime path, data directory, receipt path | Absolute canonical paths; data path is not removal-owned |
| `resource_digests` | plugin manifest, Skill, MCP configuration | Lowercase SHA-256 strings |
| `installed_at` | UTC timestamp | Written only after successful readback |

### Identity and ownership

- Canonical receipt path: `~/Library/Application Support/dev-flow/registrations/codex.json`.
- Default Core data path: `~/Library/Application Support/dev-flow/data`.
- An explicit `DEV_FLOW_DATA_DIR` overrides the default and is recorded exactly after canonicalization.
- The receipt owns only its own product registration identity. Codex owns its configuration/cache; npm owns the installed package; Core owns task data.
- Removal may invoke Codex to remove the recorded plugin and marketplace and may delete the exact receipt. It may not recursively delete a parent directory, package root, Codex cache, or Core data directory.

### Registration lifecycle

```text
ABSENT --setup + validation + Codex readback--> REGISTERED
ABSENT --setup validation/readback failure---> ABSENT
REGISTERED --matching repeated setup---------> REGISTERED (no-op)
REGISTERED --remove + absence readback-------> ABSENT
REGISTERED --conflicting readback------------> REGISTERED (fail closed)
```

`ABSENT` and `REGISTERED` describe product registration only. They are not Core workflow states. Partial or conflicting external state is not normalized into a third persisted state; the command reports the mismatch and leaves the receipt/resources available for an explicit recovery.

## Entity 4: Codex Journey Evidence

Represents one bounded native-host run against the exact final tarball. Its normative serialized form is [contracts/journey-evidence.schema.json](./contracts/journey-evidence.schema.json).

| Field group | Required contents | Invariant |
|---|---|---|
| `classification` | evidence type and supported surface | exactly native, Codex CLI, macOS arm64 |
| `versions` | Codex, package, Core, Core contract | exact observed values; package equals Core |
| `digests` | artifact, shared fixtures, repository snapshots, retained task data | SHA-256, measured from final inputs/results |
| `task_lineage` | opaque task ID, observed revisions, committed action IDs, terminal outcome | same task ID across restart; at least two committed actions |
| `invocation` | selector, Core call count, explicit rejection result, retry observations | `$dev-flow`; bounded calls; no implicit Core call |
| `lifecycle` | setup/readback, restart/resume, removal/readback, data-retained assertions | every checkpoint passed |
| `repository` | before/after/removal fingerprints, intended paths, unexpected paths | unexpected path list empty |
| `failures` / `skips` | structured observations | empty for a passing required journey; never silently omitted |

### Validation rules

- Evidence is generated only from the packed artifact that supplies `artifact_sha256`.
- A fake adapter, fake Core, static inspection, or a different operating system cannot populate a native record.
- `task_lineage.revisions` is strictly increasing at committed action checkpoints.
- `task_lineage.committed_actions` contains at least two Core-confirmed commits.
- After the Codex/Core process has exited, the task-data digest is computed from the complete data-directory file set using the same sorted `<file-sha256><two spaces><data-relative-path>\n` manifest construction before and after removal. The two digests and file sets are equal; a subsequent direct Core read can still retrieve the recorded task.
- The exact invocation count is recorded with the scenario; no general performance claim is inferred.

## Entity 5: Opaque Core Task Reference

The receipt does not contain this entity. The journey evidence may record only:

| Field | Type | Source |
|---|---|---|
| `task_id` | opaque string | Core response |
| `revision` | integer | Core response |
| `action_id` | opaque string | Core response |
| `terminal_outcome` | opaque Core result | Core response |

The Codex product performs no validation beyond structural presence required by the evidence schema. Meanings, allowed transitions, retry classifications, and completion remain defined exclusively by Core Contract 0.1 and shared fixtures.

## Relationships

```text
Codex Product Artifact
  ├─ contains exactly one ─> Codex Plugin Bundle
  ├─ embeds exactly one ───> Core executable (Contract 0.1)
  └─ produces after setup ─> Registration Receipt

Final Artifact + Registration Receipt + Native Codex session
  └─ produce ──────────────> Codex Journey Evidence
                                └─ references opaquely ─> Core task/action IDs
```

No entity in this document becomes a second persistence location for Core workflow state.
