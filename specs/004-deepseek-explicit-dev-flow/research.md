# Phase 0 Research: DeepSeek Explicit Dev Flow

**Feature**: `004-deepseek-explicit-dev-flow`
**Completed**: 2026-08-15
**Evidence rule**: Host behavior below is based only on DeepSeek's official repository and the
official npm registry. Because DeepSeek Harness is a developer preview, implementation MUST repeat
the named gates against the exact artifact used for the real-host journey.

## Decision 1: Treat the current Harness contract as pre-release evidence, not stable support

**Decision**: Use `@deepseek-ai/dsh` `0.1.0-rc.6` as the minimum version for the implementation
spike, with the provisional pre-release range `>=0.1.0-rc.6 <0.2.0-0`. This range authorizes
engineering validation only. The final real-host journey remains blocked until an official stable
version exists and is shown compatible; the journey MUST use the latest stable compatible version
available at execution time. Exact patch equality MUST NOT become a runtime compatibility rule.

**Rationale**: On 2026-08-15 the official registry exposed only release candidates and identified
`0.1.0-rc.6` as both `latest` and `next`. The official source repository described Harness as a
developer preview and its visible `master` revision was the `0.1.0-rc.5` release commit. The npm
metadata for `rc.6` did not expose a `gitHead`, and the official repository had no matching tag or
GitHub release, so the registry artifact cannot currently be tied to an official source commit.
Calling this artifact stable, or claiming source identity for it, would exceed the evidence.

**Alternatives considered**:

- Pin only `0.1.0-rc.6`: rejected because FR-003 forbids exact patch equality as the compatibility
  rule.
- Call `rc.6` the latest stable release: rejected because the official version is explicitly a
  release candidate.
- Guess a future stable version or broaden support to all `0.x`: rejected because neither is
  evidenced.

**Sources** (accessed 2026-08-15):

- [Official DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [Official CLI README at source revision 47f9438](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/README.md)
- [Official npm registry metadata for @deepseek-ai/dsh](https://registry.npmjs.org/%40deepseek-ai%2Fdsh)
- [Official rc.6 package tarball](https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.0-rc.6.tgz)

## Decision 2: Use the supported profile bundle mechanism

**Decision**: Package `dev-flow-deepseek` as one Harness bundle. The package manifest supplies a
`dsh.bundle.patch` entry pointing to `cordis.patch.yml`; a profile records the package in
`dsh.profile.bundles`. Install and removal verification uses the supported profile commands:

```text
dsh plugin --profile <isolated-profile> add <local-package-spec>
dsh plugin --profile <isolated-profile> remove dev-flow-deepseek
```

The real journey MUST restart Harness after add and remove and inspect the isolated profile's
resolved configuration. No undocumented cache-purge command is part of the design.

**Rationale**: The official CLI reference and architecture note identify profile bundles as the
package composition mechanism. The CLI forwards package management to pnpm in the profile,
initializes the profile when needed, and reconciles its bundle list. No first-party source found in
this research establishes a separate supported cache purge command.

**Alternatives considered**:

- Copy Skill or MCP files into user/global directories: rejected because it bypasses the bundle
  lifecycle and makes removal ownership ambiguous.
- Add an invented cache-reset command: rejected because there is no authoritative contract for it.

**Sources** (accessed 2026-08-15):

- [CLI command reference](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/reference/README.md)
- [Profile plugin bundles architecture note](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.md)
- [Official headless bundle manifest example](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/bundle/headless/package.json)

## Decision 3: Register one explicit-only Skill through the bundle

**Decision**: Register exactly one bundled Skill named `dev-flow`, with
`modelInvocable: false` and `userInvocable: true`. Its instructions require an explicit,
whitespace-bounded `/dev-flow` invocation and reject an empty/conversational request before opening
a task. Ordinary model behavior does not activate it.

**Rationale**: Official Harness Skill policy distinguishes model invocation from user invocation.
The implemented explicit-invocation behavior recognizes a claimed user message containing a
whitespace-bounded `/name` token and injects that Skill in the host pre-step. A bundled provider
keeps registration and removal profile-scoped without writing the target repository.

**Alternatives considered**:

- Leave model invocation enabled: rejected because it would permit implicit activation.
- Implement a custom command router or agent preset: rejected because the native Skill contract is
  sufficient and the feature excludes both.

**Sources** (accessed 2026-08-15):

- [Explicit Skill invocation implementation note](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/.agents/notes/implemented/feature/2026-08-08-user-explicit-skill-invocation.md)
- [Skill invocation policy note](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/.agents/notes/implemented/feature/2026-07-28-skill-invocation-policy.md)
- [Official Skill package README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill/README.md)

## Decision 4: Prefer direct native MCP consumption and make completeness an early gate

**Decision**: Mount the existing Go Core directly through the official local STDIO MCP client and
expose only the six Core tools. Before story implementation continues, run a real Harness spike
that proves the caller can recover the complete canonical Core JSON for normal, domain-error,
near-spill, spilled, and pruned results. The spike MUST cover both authoritative success and
`isError` results. No projection proxy is authorized by this plan.

If direct consumption cannot make every authority field available, stop and amend the feature plan
with the observed failure and a separately reviewed minimal projection design. A failed spike is
evidence for review, not automatic permission to add a proxy.

**Rationale**: The official MCP client natively supports STDIO, registers tools as
`mcp__<serverName>__<rawName>`, preserves canonical content and structured content for programmatic
callers, and sends MCP `isError` through the registry error path. The documented client also permits
`failOnStartupError: false` and `reconnect.enabled: false`; the bundle uses those bounded settings so
an unavailable Dev Flow child does not reject the whole host composition or enter a respawn loop.
Core already returns the same
complete compact JSON in its text block and `structuredContent`. However, official Harness packages
also document a 50,000-byte spill threshold and a compaction tool-result pruner with an 8,192
character default threshold, while Core permits envelopes up to 1,048,576 bytes. Static inspection
therefore cannot prove FR-023.

**Alternatives considered**:

- Build a proxy pre-emptively: rejected by FR-018 and the thin-adapter Constitution rule.
- Trust only small inline test results: rejected because it does not test documented spill/prune
  paths against the Core envelope limit.
- Parse a displayed preview as authority: rejected because it can omit revision, action, recovery,
  or error fields.

**Sources** (accessed 2026-08-15):

- [Official MCP client README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/README.md)
- [Official MCP transport implementation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/src/transport.ts)
- [Official spill-policy README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill-policy/README.md)
- [Official compaction result-pruner README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/compaction-tool-result-pruner/README.md)

## Decision 5: Add only a transport-transparent Core lifecycle launcher

**Decision**: Use one small JavaScript launcher between Harness and the packaged Core executable.
It resolves the package-relative runtime, spawns it without a shell, forwards STDIO bytes without
parsing MCP, opens no listener, initiates no network request, propagates EOF/signals/cancellation,
waits for child exit, and emits bounded non-secret startup diagnostics. The Core child receives only
these explicitly selected variables when present: `DEV_FLOW_DATA_DIR`, `HOME`, `PATH`, `LANG`,
`LC_ALL`, and `TMPDIR`.

The launcher is lifecycle glue required by FR-002, FR-007, FR-008, and FR-021. It is not a result
projection proxy and MUST NOT inspect task payloads, persist state, or make workflow decisions.

**Rationale**: Official Harness subprocess code scrubs credential-shaped and `DSH_*` variables but
otherwise forwards many parent variables. That is not the dedicated closed Core environment
required by FR-007. A package-relative launcher also gives deterministic missing/non-executable
runtime diagnostics without an external Core prerequisite.

**Alternatives considered**:

- Point the MCP command directly at a Core found on `PATH`: rejected because the product would no
  longer be self-contained and could select an unrelated binary.
- Forward the complete Harness environment: rejected by FR-007.
- Add an MCP projection layer to solve lifecycle only: rejected because raw transport forwarding is
  smaller and preserves direct consumption.

**Sources** (accessed 2026-08-15):

- [Official subprocess package README](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subprocess/subprocess/README.md)
- [Official subprocess environment implementation](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/subprocess/subprocess/src/index.ts)

## Decision 6: Reuse Core Contract 0.1 without an adapter contract fork

**Decision**: Keep the Core's existing STDIO MCP schemas, compact result envelope, stable error
codes, revision/action identity, recovery model, and six-tool catalog unchanged. Packaging has one
shared internal prerequisite: Feature 003 T005/T006 own the link-time `buildVersion` tests/seam in
`internal/version/version_test.go` and `internal/version/version.go`, retaining the source-tree
`VERSION` fallback while allowing a staged binary to report its embedded version without the source
checkout. Feature 004 verifies and consumes that seam but MUST NOT implement a duplicate. The
bundle mounts exactly:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

The implementation gate records the Core source identity and aggregate shared-fixture digest, then
runs the shared contract fixtures against both host paths where applicable.

**Rationale**: Feature 002 is merged on `main`. At planning time the observed source identity is
`8d6c929339f49a102d4e3bb34c11f566a950e9fb`; the aggregate of per-file SHA-256 records for
the 22 JSON files in `protocol/fixtures/` is
`8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7`. The digest algorithm sorts
repository-relative JSON paths bytewise, renders each line as
`<file-sha256><two spaces><repository-relative-path>\n`, and takes SHA-256 of the complete manifest
bytes. Core's server returns the same complete compact JSON as MCP text and structured content and
caps an envelope at 1,048,576 bytes. These facts support direct integration, while the real-host
completeness spike remains necessary because Harness may transform results after transport.

**Alternatives considered**:

- Rename or wrap tools for DeepSeek: rejected because it creates host-specific contract drift.
- Reimplement action/recovery logic in the Skill: rejected because Core is the only workflow
  authority.

**Repository evidence** (observed 2026-08-15):

- `internal/mcp/schemas.go`
- `internal/mcp/server.go`
- `internal/domain/limits.go`
- `internal/version/version.go`
- `internal/version/version_test.go`
- `protocol/fixtures/*.json`

## Decision 7: Package one macOS arm64 Core runtime without install-time builds

**Decision**: After the Feature 003 T005/T006 shared `buildVersion` seam passes its targeted tests, the
repository build creates a CGo-free macOS arm64 Core executable with the repository version injected
at link time, stages it with the JavaScript bundle, and produces a local package tarball. The
installable package has no
`install`, `preinstall`, `postinstall`, `prepare`, or publication behavior. Package tests verify the
runtime is present, executable after staging, and tied to the recorded Core source identity. Public
publication and a platform matrix remain feature 006 work.

**Rationale**: The specification requires a self-contained product and declares macOS arm64 as the
initial evidence platform. A repository-side build avoids executing source builds inside a user's
profile and keeps ordinary implementation free of release effects.

**Alternatives considered**:

- Download the runtime during installation or first use: rejected because it introduces a network
  dependency and unrecorded runtime selection.
- Claim Windows/Linux support from cross-compilation alone: rejected because no native-host journey
  supplies that evidence.
- Publish to npm as part of implementation: rejected as explicit out of scope.

## Decision 8: Share task data, but keep repository and profile writes separate

**Decision**: Preserve an explicitly supplied `DEV_FLOW_DATA_DIR`; otherwise the launcher selects
`~/Library/Application Support/dev-flow/data` on the declared macOS platform and creates that default
directory with user-only permissions on first Core launch when absent. An explicit override remains
caller-owned and must already name a usable directory. Installation and removal never create or
delete either data root, the package does not place data in the target repository, and it does not
write another host's package/profile files. The Skill supplies the one resolved existing Git
worktree to Core and uses `host=deepseek`; repository inspection and claims remain Core-owned.

**Rationale**: Core requires an existing data directory and owns repository canonicalization and
claims. A host-neutral default lets Codex and DeepSeek observe the same Core database while keeping
profile dependency removal independent from task-data retention. Preserving an explicit override
also supports isolated tests.

**Alternatives considered**:

- Store task data in the Harness profile: rejected because removal could erase shared state.
- Store task data in the repository: rejected by repository cleanliness requirements.
- Give DeepSeek its own state database or claim logic: rejected by the single-authority boundary.

## Decision 9: Separate fake/package evidence from one real-host journey

**Decision**: Use focused Node package tests plus existing Go contract/layout tests for deterministic
composition, allowlist, lifecycle, and recovery-instruction checks. Separately execute one real
macOS arm64 Harness journey with the final packed artifact, isolated profile, and temporary Git
repository. It must record exact Harness version/build, profile, OS/architecture, package digest,
Core identity, proxy presence (`none` unless a later reviewed amendment says otherwise), skips, and
retained data. It must cross at least two committed Core actions, stop/restart Harness, resume the
same task, reach Core `DONE`, remove by product identity, and verify retained task data and Codex
non-interference when Codex is installed.

**Rationale**: Fake processes can reliably exercise failure and cancellation but cannot prove native
host registration, invocation, spill behavior, restart/resume, or removal. The Constitution requires
evidence labels to reflect this distinction.

**Alternatives considered**:

- Treat static manifest inspection as real-host evidence: rejected because it does not exercise
  Harness behavior.
- Run an unbounded platform matrix: rejected because only macOS arm64 is in the current evidence
  scope.

## Resolved Unknowns and Remaining Gates

| Topic | Phase 0 conclusion | Implementation gate |
|---|---|---|
| Bundle/profile mechanism | Official bundle patch plus profile bundle dependency | Revalidate exact manifest/patch against the journey artifact before coding past Setup |
| Skill invocation | Native explicit user invocation is evidenced | Prove `/dev-flow` activates once and an ordinary prompt creates zero tasks |
| MCP integration | Native local STDIO client exists | Prove exact six-tool catalog and complete direct results across inline/spill/prune paths |
| Projection proxy | Not justified and not authorized | Stop and amend/review if the direct-consumption gate fails |
| Environment | Official scrub still forwards a broad parent environment | Test the launcher's explicit allowlist and non-secret diagnostics |
| Add/remove | Official profile add/remove commands exist | Restart and inspect profile after both operations; do not invent cache commands |
| Stable version | No official stable Harness was available on 2026-08-15 | Final journey waits for and uses the latest stable compatible version available then |
| Core contract | Contract 0.1 and fixtures exist on merged `main` | Record final source/fixture identities and run targeted parity checks |
| Packaged Core version | Current `version.Current()` needs a source-tree `VERSION` file | Wait for Feature 003 T006, verify the T005 fallback/injection tests, and do not duplicate it in Feature 004 |
