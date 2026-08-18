# Research: Publish the Codex Installable Product

## Decision 1 — Release Codex before DeepSeek

**Decision**: Publish a Codex-only `0.x` release after Features 003 and 005. Keep Feature 004
deferred and publish DeepSeek through a later feature.

**Rationale**: The Codex product already has a complete local package and real-host journey. A
host-specific release does not change shared Core semantics, so it need not wait for an unavailable
Harness capability.

**Alternatives considered**:

- Keep the original dual-product release gate: rejected because it makes the working product wait
  indefinitely.
- Remove DeepSeek from the product roadmap: rejected; it remains a deferred second product.
- Publish an unfinished DeepSeek package: rejected because it would create unsupported claims.

## Decision 2 — One npm package with one bundled runtime

**Decision**: The first public package contains the existing `darwin-arm64` Core runtime directly.

**Rationale**: Only one platform is claimed. A single package is easier to inspect, publish, install,
read back, and remove than host plus platform dependency packages.

**Alternatives considered**:

- Optional per-platform npm packages: deferred until at least two supported platforms require them.
- First-run download: rejected because install would depend on network code and mutable remote
  assets.
- Require users to install Go/Core separately: rejected because the product must be self-contained.

## Decision 3 — Use npm OS/CPU compatibility metadata

**Decision**: Declare only macOS and arm64 in package metadata and preserve a runtime check in setup.

**Rationale**: Package-manager rejection prevents unsupported installation from reaching host
mutation, while setup still verifies the actual packaged runtime and platform.

**Alternatives considered**:

- Install everywhere and fail on launch: rejected because it creates a misleading installed
  product.
- Publish under a platform-specific package name: rejected for the first single-platform release.
- Infer Rosetta support: rejected because it is not a tested native support claim.

## Decision 4 — No npm lifecycle mutation

**Decision**: Keep setup/remove explicit and define no install lifecycle script.

**Rationale**: Users must see and authorize host configuration mutation. It also keeps package
installation reproducible when scripts are disabled.

**Alternatives considered**:

- `postinstall` setup: rejected as hidden host mutation.
- `preuninstall` removal: rejected because uninstall interruption could make ownership unsafe.
- PATH/profile editing: rejected; npm's normal bin linking is sufficient.

## Decision 5 — Local explicit publication, not PR CI

**Decision**: Implement an authenticated local publisher using standard `npm` and `gh` CLIs.

**Rationale**: It minimizes permanent secret-bearing infrastructure and cleanly separates ordinary
CI from irreversible release actions.

**Alternatives considered**:

- Pull-request publication: prohibited.
- Automatic publish on merge/tag: deferred until release frequency and operational need justify it.
- Manual web-only publication: rejected because read-back, checksums, and partial-state recording
  need one repeatable workflow.

## Decision 6 — Normalize package comparison

**Decision**: Require byte-identical Go runtimes and normalized unpacked tarball equality. Record raw
tarball equality when available but do not make it the compatibility rule.

**Rationale**: User-visible package contents and modes are the contract. Archive metadata can vary
with tool versions even when installed bytes are identical.

**Alternatives considered**:

- Compare only package.json: rejected as too weak.
- Require raw `.tgz` equality forever: rejected as unnecessarily coupled to packaging internals.
- Skip double build: rejected because one-source consistency is a release promise.

## Decision 7 — Use a draft GitHub Release and remote read-back

**Decision**: Create the exact tag and draft release, publish/read back npm, run the
registry-package journey, finalize the manifest/checksums, upload/read back assets, then finalize the
release.

**Rationale**: A draft exposes a stable upload target without publicly declaring success before
remote bytes and user journey are verified.

**Alternatives considered**:

- Publish GitHub Release first: rejected because it may advertise a broken/missing registry package.
- Publish npm last: rejected because final journey must use the registry package.
- Trust upload responses without download: rejected because remote bytes are the release.

## Decision 8 — Preserve partial publication instead of rolling it back

**Decision**: Persist a bounded publication record after every remote observation/mutation and
resume only exact matching state.

**Rationale**: npm versions and release/tag identities are immutable distribution facts. Automatic
rollback claims would be false or destructive.

**Alternatives considered**:

- Unpublish npm on failure: rejected as unreliable, destructive, and not equivalent to rollback.
- Delete/recreate tags and releases: rejected because it obscures provenance.
- Start a new version immediately: allowed only after the current partial state is truthfully
  recorded and a maintainer decides it cannot complete.

## Decision 9 — Fix the public name and stop on ownership failure

**Decision**: Use `dev-flow-codex`. Preflight proves the authenticated account can publish it.

**Rationale**: Package identity is a product decision. A release script must not invent aliases.

**Alternatives considered**:

- Automatically add an npm scope: rejected because it changes installation identity.
- Choose the first available similar name: rejected as nondeterministic.
- Leave the name unresolved: rejected; implementation has a fixed contract and a clear stop rule.

## Implementation-Time Baseline Record

The bounded implementation baseline was observed on 2026-08-17 before product or release-contract
edits. The release source remains the updated `main` identity below; the implementation branch was
created directly from it.

| Item | Recorded value |
|---|---|
| Feature 003 merge commit | `a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7` (`Merge branch 'codex/feature-003-codex-explicit-dev-flow'`) |
| Feature 005 merge commit | `850dd4a4ee07bf50af5d9a36b24373c6b09fdd28` (`Merge pull request #4 from Innocent-children/codex/feature-005-recover-uncertain-actions-and-drift`) |
| Updated `main` commit | `850dd4a4ee07bf50af5d9a36b24373c6b09fdd28` |
| Updated `main` tree | `f9b1621688a34b0c4ffb1041bcdccc76eb2d9052` |
| Root/package/plugin/Core version | `0.1.0` / `0.1.0` / `0.1.0` / `0.1.0` |
| Core fixture aggregate digest | `sha256:8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7`, using the existing contract-tested 22-fixture aggregate algorithm in `tests/contract/fixture_contract_test.go` |
| Codex minimum/range | `0.147.0` / `>=0.147.0 <0.148.0` from merged Feature 003 |
| Actual validated Codex version | `0.147.0` from the merged Feature 003 final real-host acceptance |
| Current local Codex observation | `0.146.0`; outside the supported range and not used as support or User Story 1 evidence |
| Platform | `darwin-arm64` (`Darwin`, `arm64`; Node reports `darwin`, `arm64`) |
| Go | `go1.26.6 darwin/arm64` |
| Node.js | `v24.18.0` |
| pnpm | `11.21.0` |
| npm | `11.16.0` |
| git | `2.55.0` |
| GitHub CLI | `2.97.0` |
| Intended release version | `0.1.0`, unchanged from root `VERSION` |

The authenticated publisher and remote permission observations are recorded separately in the
Feature README because npm authentication is an implementation entry gate, not release identity.

## User Story 1 Bounded Build-Script Amendment

The first T015 source-free tarball test failed at the existing local builder's Feature 003
`private: true` assertion before any runtime build or install step. The user explicitly authorized
`scripts/build-codex-local.sh` as an additional User Story 1 path solely to replace that assertion
with the already approved fixed public package contract.

The amendment preserves the local builder's inputs, clean/final-source rules, Go build flags,
runtime path, package allowlist, normalized tar format, digest calculation, report schema, and
final-artifact behavior. It adds no network, authentication, publication, Tag, GitHub Release, or
shared Core behavior.

After that correction, the same T015 test progressed to explicit setup and failed at the equivalent
Feature 003 private-package assertion in `packages/codex/lib/lifecycle.mjs`. The already conditional
T017 authorization covered the matching fixed public package preflight there. No launcher or path
change was required, and the existing setup/remove ownership, receipt, compatibility, Skill, and MCP
checks remain intact.

## User Story 2 Implementation Decisions

Deterministic preparation uses two independent detached worktrees at one admitted clean `main`
commit. Runtime bytes must match exactly; package equality is the sorted path/size/SHA-256/mode
inventory. Raw tgz equality is recorded as a fact and remains outside the permanent contract.

The verifier and publisher use only Node standard-library code plus the existing local
`git`/`tar`/`npm`/`pnpm`/`gh` executables. Preparation records the T001 GitHub CLI version rather than
invoking `gh`. Publisher tests resolve npm/gh to bounded temporary fakes, use temporary state and a
bare Git remote, and retain call-order evidence without environment or credential snapshots.

Registry visibility uses four bounded observations with a fixed 250 ms interval. Retry always
rereads remote state; an exact npm version is downloaded and verified before it is considered
reusable. npm publish and asset upload record-loss cases therefore resume without repeating the
immutable mutation. Asset conflicts block without clobber. At the User Story 2 checkpoint the
Release intentionally remained draft; User Story 3 added the final Journey and finalization gates.

## User Story 3 Implementation Conclusions

Compatible upgrade is an explicit lifecycle action: npm update alone leaves registration and task
data unchanged, setup verifies the new package/plugin/Core/Codex identities, and a compatible
packaged Core resumes the same active Task. Downgrade refuses before mutation. A future SQLite
Schema marker uses the existing Core safe-stop and required no shared persistence or MCP change.

Removal and uninstall retain the task database, unknown adjacent data, unrelated Codex state, and
repository bytes. Only receipt and registration paths with exact product ownership are removed.

The production final Journey contract accepts only `dev-flow-codex@VERSION` from
`https://registry.npmjs.org/`, uses a clean isolated environment, rejects local package/Core
substitution, and validates setup, ordinary zero-trigger, restart/resume, `DONE`, removal,
uninstall, and retained reopen. Native evidence alone can generate the public passed support entry.

The publisher finalization gate rereads the exact Tag, npm tarball, four GitHub assets, native
journey, support entry, manifest, and checksums before making the draft public. Fake npm/gh and a
fixture-simulated journey test resume/conflict/finalization mechanics only; they are not native or
public evidence.

T001–T041 produced no real npm publication, registry read-back, Git Tag, GitHub Draft/Release/asset,
or final registry-package Journey. Final release source commit, final artifact digests, registry
integrity, native Journey result, and public Release identity can be recorded only by T047–T050.

## Decision 10 — Recover the lost volatile operator directory once

**Decision**: Permit one recovery preparation from the frozen source into the durable external
directory `/Users/innocent-children/dev-flow-releases/v0.1.0-recovery`. Require the already reviewed
npm tarball and Core digests, then reconstruct mutable publication truth through read-only remote
observation using the fixed publisher tooling commit.

**Rationale**: The exact Tag and GitHub Draft are remotely preserved, npm `0.1.0` and assets remain
absent, and the lost files were local operator state rather than published public payloads. A
digest-locked reconstruction preserves release identity while allowing truthful recovery from the
observed volatile-directory failure.

**Alternatives considered**:

- Abandon `0.1.0`: rejected because the exact Tag/Draft and reviewed payload identity remain valid.
- Reuse a development fixture or copy an arbitrary matching tarball: rejected because it would not
  provide one clean recovery preparation and complete local provenance.
- Recreate the old publication record manually: rejected because remote truth must be observed by
  the production publisher rather than asserted from memory.
- Continue using a system temporary root: rejected because operator evidence must remain available
  across authentication and recovery turns.

## Decision 11 — Use ten npm read-back observations at two-second intervals

**Decision**: Expand only the npm registry replication window from four observations at 250 ms to
ten observations at two-second intervals. Keep the final failure code and publish-once recovery
behavior unchanged.

**Rationale**: The first real npm publication succeeded but became publicly visible only after the
original sub-second bounded window expired. A maximum eighteen-second inter-observation wait covers
ordinary registry propagation while remaining bounded and operationally small.

**Alternatives considered**:

- Retry the publisher immediately after every timeout: rejected because each confirmed invocation
  is an explicit operator action and must first preserve/read remote truth.
- Poll indefinitely: rejected because the publisher requires bounded execution and diagnostics.
- Add a fixed sleep before the first read: rejected because immediate visibility should still
  complete without unnecessary delay.
