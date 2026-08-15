# Requirements Quality Checklist: DeepSeek Explicit Dev Flow

**Purpose**: Assess whether the DeepSeek package, evolving Harness contract, explicit Skill, direct
Core authority, recovery, lifecycle, and evidence requirements are complete, bounded, and ready for
implementation planning.
**Created**: 2026-08-15
**Feature**: [spec.md](../spec.md)

**Review Ownership**: Reviewer-owned requirements artifact. `[x]` means the requirements-quality
criterion is satisfied by the current specification/planning package; it does not mean implementation
exists or has passed.

## Product Boundary

- [x] CHK001 The product identity is exactly `dev-flow-deepseek`, while public scope and publication identity are deferred explicitly.
- [x] CHK002 One private local artifact, one Harness bundle layer, one explicit Skill, one local STDIO MCP integration, and one packaged Core runtime form the complete product boundary.
- [x] CHK003 The product is self-contained on its declared macOS arm64 evidence platform and does not depend on a separately installed Core.
- [x] CHK004 The DeepSeek adapter is limited to bundle/Skill registration, complete direct result use, lifecycle launch, and package-specific verification.
- [x] CHK005 Core Contract 0.1 remains the sole workflow authority and its exact six-tool surface is closed.
- [x] CHK006 A projection proxy is absent from the current plan and can be considered only after observed direct-client failure plus a reviewed amendment.
- [x] CHK007 Generic shell/HTTP MCP, target-repository setup, other platforms, publication, automatic updates, multiple repositories, and cross-host takeover are excluded explicitly.

## Harness Package and Lifecycle

- [x] CHK008 The minimum engineering version, provisional compatible range, exact-version evidence rule, and latest-stable final-journey gate are distinct and unambiguous.
- [x] CHK009 The official profile bundle manifest/patch relationship and profile add/remove commands are documented from first-party sources.
- [x] CHK010 Installation is separated from source build, data mutation, repository mutation, downloads, and publication lifecycle hooks.
- [x] CHK011 Bundle composition is bounded to exactly one Skill provider and one native local STDIO MCP integration.
- [x] CHK012 Host restart and resolved-profile observation are required after both add and remove, without inventing a cache-purge command.
- [x] CHK013 Removal by product identity preserves the shared data root, target repository, unrelated profiles, and an installed Codex product.
- [x] CHK014 Missing, incompatible, non-executable, and early-exit Core behavior has a bounded non-secret failure contract tied to observed host capability.

## Runtime and Environment

- [x] CHK015 The macOS arm64 package-relative Core runtime and CGo-free repository-side build are explicit.
- [x] CHK016 The shared Feature 003-owned link-time `buildVersion` seam, source-tree fallback, single ownership, and Feature 004 final-build dependency are documented.
- [x] CHK017 Product, repository, Core binary, package, and shared fixture identities have reproducible version/digest rules.
- [x] CHK018 The fixture aggregate algorithm is bytewise path sorting plus canonical `<sha256><two spaces><path>\n` manifest hashing.
- [x] CHK019 The lifecycle launcher has a closed six-key environment, package-relative runtime selection, shell-free spawn, raw STDIO, zero listener/network, signal/EOF propagation, and deterministic child cleanup.
- [x] CHK020 Explicit `DEV_FLOW_DATA_DIR` precedence and the host-neutral macOS default are separate from profile removal ownership and target-repository paths.

## Explicit Skill and Core Authority

- [x] CHK021 The sole `dev-flow` Skill is explicitly user-invocable and not model-invocable under the evidenced official Harness policy.
- [x] CHK022 Empty/conversational invocation, ordinary prompts, non-Git input, and multi-repository scope stop before task creation.
- [x] CHK023 Exactly one current Git worktree is resolved without granting Core or adapter Git mutation authority.
- [x] CHK024 `dev_flow_server_info` precedes discovery/mutation and checks compatible schema, host, transport, health, and exact raw catalog.
- [x] CHK025 Same-host resume, exact-contract resume, different-contract conflict, and other-host conflict remain Core-defined behaviors.
- [x] CHK026 Every governed action uses complete fresh Core identity, binding, allowed effects, evidence, payload schema, recovery, blocker, and outcome fields.
- [x] CHK027 The Skill contains no local state machine, action catalog, transition table, repository claim rule, recovery classifier, error taxonomy, or completion predicate.

## Complete Results and Recovery

- [x] CHK028 Core text/structured result identity and Harness inline/spill/prune transformations are separated explicitly.
- [x] CHK029 Complete-result requirements cover inline success, domain error, near-spill, spilled, pruned, truncated, malformed, and near-Core-limit results.
- [x] CHK030 Gate B requires exact recovered bytes/digests and complete envelope fields before authority use or user-story implementation.
- [x] CHK031 Failed direct consumption stops for amendment and does not automatically authorize a projection proxy.
- [x] CHK032 Lost/uncertain mutations retain their original request identity and require a fresh Core operation probe before retry.
- [x] CHK033 Recovery assessment, retry safety, explicit recovery apply, blocker, and terminal outcome stay live Core results rather than adapter inference.
- [x] CHK034 Transport cancellation is distinguished from explicit user-authorized `dev_flow_cancel_task`.

## Evidence and Measurability

- [x] CHK035 Fake/package, direct-host spike, pre-release host, and final stable real-host evidence are labeled as distinct strengths.
- [x] CHK036 The fake Core suite has bounded composition, allowlist, complete-result, cancellation, startup-failure, and read-before-retry coverage.
- [x] CHK037 Each of the three user stories has an independent observable acceptance journey.
- [x] CHK038 The final journey uses the exact packed artifact, crosses at least two Core-committed actions, restarts/resumes the same lineage, respects budget, reaches Core `DONE`, and removes by identity.
- [x] CHK039 The journey evidence records exact Harness package/build, profile, OS/architecture, package/Core/source/fixture digests, proxy presence, skips, retained data, and Codex non-interference evidence.
- [x] CHK040 Every success criterion has an objective observation, digest, catalog, call trace, task identity, Core outcome, or explicit evidence boundary.

## Dependencies and Simplicity

- [x] CHK041 Feature 002 completion, Core Contract 0.1, the existing six tools, shared fixtures, and envelope size limit are documented as delivered dependencies.
- [x] CHK042 Current official DeepSeek repository and registry sources are linked with an access date and an explicit source-to-rc.6 identity gap.
- [x] CHK043 The lack of an official stable Harness is a visible stop gate rather than an unsupported stability claim.
- [x] CHK044 Direct official MCP plus one transport-transparent launcher is justified as the minimum host design; no generic integration framework is implied.
- [x] CHK045 The Constitution Check passes before and after design with no hidden complexity-budget exception.
- [x] CHK046 No unresolved clarification marker, template placeholder, invented Harness field/command, proxy assumption, Core contract change, or unsupported platform claim remains in the planning package.

## Notes

- This built-in checklist records specification quality only; it makes no assertion that product
  code, tests, packed artifacts, stable Harness, or native-host evidence already exist.
- Reopen an item if later edits make the cited requirement ambiguous, inconsistent, unmeasurable,
  or incomplete.
- Custom PR review criteria remain separately unchecked in `deepseek-host-readiness.md`.
