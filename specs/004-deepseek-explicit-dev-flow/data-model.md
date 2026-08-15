# Data Model: DeepSeek Explicit Dev Flow

Feature 004 adds no host-owned workflow state. Core Contract 0.1 remains the sole authority for
Task, Action, RepositoryBinding, RecoveryAssessment, Evidence, verification budgets, and Outcome.
The records below describe merged dependencies, package/profile composition, transient launch, gate
observations, deterministic checkpoints, and final evidence only.

## 1. Feature003DeliveredBaseline

| Field | Rules |
|---|---|
| `merge_commit` | Exact `main` commit containing completed Feature 003. |
| `version_seam_source_sha256` / `version_seam_test_sha256` | Merged `internal/version` identities. |
| `codex_manifest_contract_sha256` / `codex_layout_contract_sha256` | Merged shared Codex contract identities. |
| `root_validator_sha256` | Merged Codex-aware validator identity. |
| `root_version` | Repository product version. |
| `fixture_aggregate_sha256` | Shared Core fixture identity. |
| `verification` | Command/result/source commit for this exact baseline. |

The dependency is a delivered capability, not Feature 003 task numbers. Feature 004 must not
replace, duplicate, or weaken it.

## 2. HarnessArtifactSelection

| Field | Rules |
|---|---|
| `channel` | `pre-release` or `stable`. |
| `package_version_build` | Exact official artifact identity. |
| `integrity` | Official registry digest/integrity. |
| `source_evidence` | Reproducible first-party source relationship or explicit gap. |
| `compatible_range` | Bounded range, never exact-patch-only policy. |
| `selected_at` | Observation timestamp. |
| `contract_digest` | Bundle/profile/Skill/MCP/add-remove-restart contract evidence identity. |

A pre-release selection can support provisional Gate B only. Final support uses one exact stable
selection, and the final journey host must equal that stable Gate B selection.

## 3. DeepSeekProductPackage

| Field | Rules |
|---|---|
| `identity` | Exactly `dev-flow-deepseek`. |
| `product_version` / `core_version` | Equal repository `VERSION`. |
| `source_commit` | Frozen source used for the artifact. |
| `artifact_sha256` / `core_binary_sha256` | Exact product/Core identities. |
| `harness_range` / `harness_actual` | Stable range and exact stable artifact. |
| `platform` | macOS arm64. |
| `skill_count` / `mcp_integration_count` | Exactly `1` / `1`. |
| `raw_tool_names` | Exactly six Core Contract 0.1 tools. |
| `proxy_presence` | `none` unless a later reviewed amendment changes the feature. |
| `fixture_aggregate_sha256` | Shared fixture identity. |
| `final_artifact` | True only after stable Gate B, deterministic/root validation, audit, and source freeze. |

The package contains one patch, provider, Skill, launcher, and Core runtime. It excludes databases,
profiles, repository files, Core source, copied fixtures, fakes, evidence, proxy code, second Skill/
MCP integration, and second platform runtime.

## 4. HarnessProfileInstallation

| Field | Rules |
|---|---|
| `profile_name` / `profile_root` | Isolated and outside target repository. |
| `package_spec` / `resolved_version` | Exact local product artifact/version. |
| `bundle_membership` | Observed after official add/restart. |
| `skill_names` | `{dev-flow}` while installed; empty after remove/restart. |
| `raw_core_tools` | Exact six while installed; empty after removal. |
| `data_root` | Explicit existing root or documented default; never removal-owned. |
| `lifecycle_observation` | `installed` or `removed`; evidence only. |

Product code does not persist this lifecycle state.

## 5. SkillDescriptor and MCPIntegrationDescriptor

The Skill descriptor is exactly `dev-flow`, user-invocable, not model-invocable, and selected by
`/dev-flow`. It stores no task ID, phase, claim, recovery, or outcome.

The MCP descriptor is one local STDIO integration with exactly:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

The result mode is direct-complete, network is disabled, and host-native names are observed rather
than used to fork raw schemas.

## 6. CoreLaunchSpec

| Field | Rules |
|---|---|
| `runtime_path` | Package-relative absolute path. |
| `arguments` | Fixed Core STDIO mode; no user shell text. |
| `working_directory` | Current single Git worktree. |
| `stdio` | stdin/stdout forwarded byte-for-byte; bounded diagnostic stderr. |
| `shell` | False. |
| `environment` | Only approved keys. |
| `listener_count` / `outbound_request_count` | `0` / `0`. |

Approved environment keys are `DEV_FLOW_DATA_DIR`, `HOME`, `PATH`, `LANG`, `LC_ALL`, and `TMPDIR`.
The launch spec is transient and owns no workflow state.

## 7. DirectResultObservation

| Field | Rules |
|---|---|
| `gate_kind` | `provisional` or `stable`. |
| `harness_selection` | Exact artifact for this observation. |
| `case` | `inline_success`, `domain_error`, `near_spill`, `spilled`, `pruned`, or `near_core_limit`. |
| `core_bytes` / `expected_sha256` | Canonical Core result identity. |
| `host_representation` / `marker_detected` | Observed display/storage form and incomplete marker. |
| `retrieval_method` | Exact official complete-content mechanism. |
| `recovered_bytes` / `recovered_sha256` | Retrieved canonical identity. |
| `complete_parse` / `complete` | True only when bytes/digest match and all authority fields parse. |

All six stable observations must be complete for the exact final stable Harness. A same-artifact
stable gate may be revalidated/reused; RC or different-artifact evidence cannot substitute.

## 8. DeterministicStoryCheckpoint

| Field | Rules |
|---|---|
| `through_stage` | `explicit-invocation`, `done`, or `remove`. |
| `classification` | Static/simulated/integration; never stable-native support. |
| `real_harness_started` / `native_evidence_written` | Both false. |
| `observations` | Package, calls, lineage, budgets, lifecycle, data/repository/Codex comparison logic. |

T032, T043, and T049 can produce only this record type.

## 9. CodexNonInterferenceObservation

| Field | Rules |
|---|---|
| `codex_product_version` | Exact co-installed Codex product. |
| `registration_before_sha256` / `registration_after_sha256` | Equal. |
| `runtime_before_sha256` / `runtime_after_sha256` | Equal. |
| `package_selection_before_sha256` / `package_selection_after_sha256` | Equal. |
| `shared_data_before_sha256` / `shared_data_after_sha256` | Equal. |
| `complete` | True only for a real before/after comparison. |

This record is mandatory for `status=pass`. Missing Codex produces blocked/failed evidence.

## 10. DeepSeekJourneyEvidence

Final evidence records the merged Feature 003 baseline, exact stable Harness/range/integrity, stable
Gate B identity, frozen source/final artifact identities, OS/profile, one Skill/six tools,
`proxy_presence`, task/action/revision lineage, budget, Core `DONE`, removal/data/reinstall/repository
facts, Codex non-interference, deterministic/root validation, failures, and skips.

A read-only semantic validator checks:

1. merged baseline matches `main`;
2. all stable Gate B observations and final host use the same exact stable artifact;
3. all six stable observations are complete;
4. source/validation/final artifact identities align;
5. revisions strictly increase, task ID is stable, at least two actions commit, and calls stay in budget;
6. terminal outcome is `DONE`;
7. data and repository manifests remain equal across removal;
8. compatible reinstall succeeds;
9. Codex non-interference is real and equal;
10. proxy is absent, required validation passed, and support claims are bounded.

## Relationships

```text
Feature003DeliveredBaseline -> DeepSeekProductPackage
HarnessArtifactSelection -> DirectResultObservation
DeepSeekProductPackage -> HarnessProfileInstallation -> CoreLaunchSpec
Deterministic inputs -> DeterministicStoryCheckpoint (never support evidence)
Stable Gate B + frozen product + real Harness + real Codex -> DeepSeekJourneyEvidence
```
