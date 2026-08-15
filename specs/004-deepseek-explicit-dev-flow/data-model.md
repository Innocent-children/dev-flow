# Data Model: DeepSeek Explicit Dev Flow

This feature adds no host-owned workflow state. The Go Core's Task, Action, RepositoryBinding,
RecoveryAssessment, Evidence, and Outcome remain the only workflow entities and are consumed as
opaque Contract 0.1 results. The records below describe package composition, one transient launch,
profile membership, and verification evidence only.

## 1. DeepSeekProductPackage

One locally packed Harness bundle.

| Field | Type | Rules |
|---|---|---|
| `identity` | string | Exactly `dev-flow-deepseek`. |
| `product_version` | semver | Equals repository `VERSION` and packaged Core product version during `0.x`. |
| `artifact_path` | path | Local packed tarball outside the target repository; never a public registry requirement. |
| `artifact_sha256` | digest | SHA-256 of the exact artifact used for evidence. |
| `harness_range` | semver range | Implementation-time evidenced compatible range; never exact-patch-only. |
| `harness_actual` | version/build identity | Exact artifact used by a spike or final journey. |
| `platform` | platform tuple | Exactly macOS arm64 for this feature's runtime/evidence. |
| `bundle_patch` | package-relative path | Exactly one package-owned Harness patch. |
| `skill_count` | integer | Exactly `1`. |
| `mcp_integration_count` | integer | Exactly `1`. |
| `proxy_presence` | enum | `none` for this plan. Any other value requires a reviewed amendment. |
| `core_source_identity` | Git object ID | Source identity used to build the runtime. |
| `core_binary_path` | package-relative path | Resolved inside the staged package, never through an unrelated executable on `PATH`. |
| `core_binary_sha256` | digest | SHA-256 of the staged runtime. |
| `fixture_aggregate_sha256` | digest | Aggregate identity for `protocol/fixtures/*.json`, computed by the canonical manifest algorithm below. |

### Validation

- The packed file list contains the bundle patch, provider entry, one Skill resource, launcher, and
  one executable macOS arm64 Core runtime.
- It contains no source build hook, publication hook/configuration, database, target-repository
  file, or second Skill/MCP integration.
- The package may declare only the official Harness dependencies required by the revalidated bundle
  contract; exact resolutions are recorded by the repository lockfile/evidence.
- `proxy_presence=none` is mandatory unless Gate B first fails and a new reviewed plan authorizes a
  proxy.

The canonical fixture manifest sorts repository-relative JSON paths bytewise and renders exactly
`<file-sha256><two spaces><repository-relative-path>\n` for each file. SHA-256 of all manifest bytes
is the aggregate. The planning baseline contains 22 JSON files and has value
`8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7`.

## 2. HarnessProfileInstallation

An observed profile dependency and resolved bundle layer; it is not adapter persistence.

| Field | Type | Rules |
|---|---|---|
| `profile_name` | string | Dedicated isolated test/journey profile. |
| `profile_root` | absolute path | Outside the target Git repository. |
| `package_spec` | local package reference | Points to the exact packed artifact under test. |
| `package_identity` | string | `dev-flow-deepseek`. |
| `resolved_package_version` | semver | Matches `DeepSeekProductPackage.product_version`. |
| `bundle_membership` | observed boolean | True only after official profile add/reconciliation. |
| `skill_names` | set | Exactly `{dev-flow}` while installed, empty after restart following removal. |
| `raw_core_tools` | set | Exactly the six Contract 0.1 raw names while installed. |
| `data_root` | absolute path | Existing explicit override or the macOS default; never owned by profile removal. |
| `lifecycle_observation` | enum | `installed`, `removed`; an evidence observation, not a runtime state machine. |

### Lifecycle observations

```text
packed artifact
  -> official profile add
  -> host restart and installed observation
  -> explicit journey/spike
  -> official profile remove
  -> host restart and removed observation
```

No product code persists this lifecycle. The test/journey report records observations made through
the official profile mechanism.

## 3. SkillDescriptor

The package's only user-facing Skill resource.

| Field | Type | Rules |
|---|---|---|
| `name` | string | Exactly `dev-flow`. |
| `model_invocable` | boolean | Exactly `false`. |
| `user_invocable` | boolean | Exactly `true`. |
| `instructions_path` | package-relative path | `skills/dev-flow/SKILL.md`. |
| `activation_token` | string | `/dev-flow`, using the implementation-time official explicit invocation contract. |

The descriptor stores no active flag, task ID, repository claim, transition, or terminal decision.

## 4. MCPIntegrationDescriptor

One native local STDIO integration mounted by the bundle.

| Field | Type | Rules |
|---|---|---|
| `server_name` | string | Stable bundle-local server identifier; the raw Core names below remain unchanged. |
| `transport` | enum | Exactly `stdio`. |
| `command` | package-relative entry | The lifecycle launcher, not a generic shell. |
| `raw_tool_names` | ordered set | Exactly the six Contract 0.1 tool names. |
| `host_tool_names` | observed set | Official Harness-native names derived from `server_name` and raw names; recorded by the direct spike. |
| `result_mode` | enum | `direct_complete`; no adapter projection in this plan. |
| `network_enabled` | boolean | Exactly `false`. |

The six raw names are:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

## 5. CoreLaunchSpec

A transient child-process launch description constructed for each MCP process.

| Field | Type | Rules |
|---|---|---|
| `runtime_path` | absolute path | Derived only from the package location and selected supported platform. |
| `arguments` | list | Fixed Core STDIO mode arguments required by the existing executable; no user shell text. |
| `working_directory` | absolute path | Current single Git worktree selected by the host invocation. |
| `stdio` | tuple | stdin/stdout forwarded byte-for-byte; stderr used only for bounded diagnostics. |
| `shell` | boolean | Exactly `false`. |
| `environment` | map | Only allowed keys below, with values copied without logging. |
| `listener_count` | integer | Exactly `0`. |
| `outbound_request_count` | integer | Exactly `0`. |

Allowed child environment keys, only when present:

- `DEV_FLOW_DATA_DIR`
- `HOME`
- `PATH`
- `LANG`
- `LC_ALL`
- `TMPDIR`

The launcher preserves explicit `DEV_FLOW_DATA_DIR` and requires it to name an existing usable
directory. When absent on macOS it derives `~/Library/Application Support/dev-flow/data` and creates
that default with user-only permissions on first Core launch, never during profile installation and
never inside the target repository. The Core remains responsible for validating the resulting data
root and exclusively owns the database/task state within it.

The staged binary's version is injected through the single Feature 003 T005/T006 shared
`internal/version.buildVersion` seam. Feature 004 contains no second version field or fallback; it
verifies that the binary reports repository `VERSION` without a source checkout and that ordinary
source runs retain the existing file fallback.

## 6. DirectResultObservation

A test-only observation proving whether the official Harness caller can obtain a full Core result.

| Field | Type | Rules |
|---|---|---|
| `case` | enum | `inline_success`, `domain_error`, `near_spill`, `spilled`, `pruned`, `near_core_limit`. |
| `core_bytes` | integer | UTF-8 byte count of the canonical Core JSON. |
| `mcp_is_error` | boolean | Preserves the upstream MCP semantic. |
| `host_representation` | enum | Observed `inline`, `spill_reference`, `pruned_preview`, or other exact host form. |
| `marker_detected` | boolean | Whether incomplete/indirect display is recognized before authority use. |
| `retrieval_method` | string | Exact official mechanism used to recover canonical content; never an invented command. |
| `recovered_sha256` | digest | Digest of bytes recovered by the programmatic caller. |
| `expected_sha256` | digest | Digest produced by the fake/real Core source. |
| `complete` | boolean | True only when digests match and every expected authority field parses. |

All six required cases must be complete before Gate B passes. This record is evidence only and is
never consulted by the runtime workflow.

## 7. DeepSeekJourneyEvidence

The immutable report of the final packed-artifact journey.

| Field | Type | Rules |
|---|---|---|
| `executed_at` | timestamp | Time of actual journey. |
| `harness_version_build` | string | Exact latest stable compatible artifact exercised. |
| `profile_name_root` | string/path | Isolated profile identity and location. |
| `os_arch` | tuple | Actual platform, expected macOS arm64. |
| `package_sha256` | digest | Matches `DeepSeekProductPackage.artifact_sha256`. |
| `core_version_source_digest` | record | Core product version, source identity, and binary SHA-256. |
| `fixture_aggregate_sha256` | digest | Shared contract baseline used for the build. |
| `proxy_presence` | enum | Expected `none`. |
| `repository_path` | path | Temporary journey repository; may contain spaces/Unicode/symlink case. |
| `task_id` | Core ID | Same task lineage before and after restart. |
| `committed_action_count` | integer | At least `2`. |
| `terminal_outcome` | Core outcome | Exactly the observed authoritative `DONE` outcome. |
| `verification_budget_result` | record | Commands/full-suite/manual evidence classified exactly as Core records it. |
| `removal_observation` | record | Profile dependency, Skill, and tools absent after remove/restart. |
| `retained_data_observation` | record | Shared task data remains present and resumable after reinstall when exercised. |
| `codex_non_interference` | record | Observed when Codex is installed; otherwise an explicit skip, never simulated evidence. |
| `skips` | list | Every unexecuted check and reason. |

## Relationships and Authority Boundary

```text
DeepSeekProductPackage
  ├── owns exactly one SkillDescriptor
  ├── owns exactly one MCPIntegrationDescriptor
  ├── contains one supported Core runtime
  └── is referenced by one isolated HarnessProfileInstallation

HarnessProfileInstallation
  └── starts transient CoreLaunchSpec

MCPIntegrationDescriptor
  └── carries opaque Core Contract 0.1 results

DirectResultObservation + DeepSeekJourneyEvidence
  └── prove behavior; they do not control behavior
```

Forbidden adapter entities include `AdapterTask`, `AdapterPhase`, `AdapterTransition`,
`AdapterClaim`, `AdapterRecoveryDecision`, and `AdapterOutcome`. If implementation needs any such
model, stop: the proposed design violates the Core authority boundary.
