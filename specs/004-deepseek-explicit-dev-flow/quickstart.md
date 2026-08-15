# Quickstart: Build and Verify DeepSeek Explicit Dev Flow

This is an implementation/verification runbook, not proof that the feature already works. Commands
are run only after the matching task is implemented. Keep all profile, package, data, and journey
artifacts outside the target test repository.

## 1. Preconditions

- macOS arm64 host;
- Go 1.26;
- Node.js `>=24` and pnpm `>=11 <12`;
- repository source at the identity being evaluated;
- official npm registry access for Harness contract/version revalidation; and
- a separate temporary root for an isolated Harness profile, Core data, packed artifact, and test
  repository.

Do not publish a package or release. Do not install into a user's ordinary profile.

For isolated checks, set an explicit `DEV_FLOW_DATA_DIR` and create it before starting Harness. The
product creates only its documented default data directory on first launch when no override is
supplied; profile installation/removal never owns that directory.

## 2. Revalidate Gate A Before Implementation

Inspect the official registry and official DeepSeek repository, recording direct URLs, access time,
dist-tags, selected version/build, integrity/digest, and the exact bundle/profile, Skill, MCP, result,
and add/remove contract used.

Planning found only `@deepseek-ai/dsh@0.1.0-rc.6`. It may be used for the bounded engineering spike,
but MUST NOT be labeled stable. If a stable artifact is now available, select the latest stable
version compatible with the current design and use a compatible range rather than exact-patch-only
rejection. If no stable artifact exists, final journey work stops; FR-003 requires an explicit spec
decision before accepting a release candidate instead.

If the official patch/import/configuration contract differs from
[contracts/deepseek-bundle.md](./contracts/deepseek-bundle.md), amend planning artifacts before
writing adapter code. Never guess plugin names, manifest fields, cache commands, or result APIs.

## 3. Verify the Shared Packaged-Version Foundation

Feature 003 T005 owns the shared injected/source-fallback tests in
`internal/version/version_test.go`; Feature 003 T006 owns the one link-time `buildVersion` seam in
`internal/version/version.go`. Before Feature 004's final Core build, wait for T006 and verify that
T005's targeted tests pass, ordinary source-tree execution still reads root
`VERSION`, and a binary built with link-time injection reports that value after being moved outside
the source checkout. Do not add a DeepSeek-specific copy or concurrently edit the shared files.

Host-specific bundle, Skill, launcher, and fake-Core work may proceed before this gate; final
package construction waits for it.

## 4. Record Core Baseline

Before building, record:

- repository Git object ID;
- repository `VERSION`;
- aggregate SHA-256 for `protocol/fixtures/*.json`, computed by sorting repository-relative paths
  bytewise, rendering every line as
  `<file-sha256><two spaces><repository-relative-path>\n`, and hashing the complete manifest bytes;
- `go.mod` Core/toolchain dependencies; and
- targeted Core Contract 0.1 test results.

Planning observed source
`8d6c929339f49a102d4e3bb34c11f566a950e9fb` and fixture aggregate
`8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7`; implementation records the
then-current values rather than assuming they remain unchanged.

## 5. Run Targeted Deterministic Checks

After the package tests exist, run only the bounded checks required by the active task, for example:

```text
node --test packages/deepseek/tests/bundle.test.mjs
node --test packages/deepseek/tests/direct-consumption.test.mjs
node --test packages/deepseek/tests/skill.test.mjs
node --test packages/deepseek/tests/launch-core.test.mjs
node --test packages/deepseek/tests/fake-core.test.mjs
go test ./tests/contract
```

These checks may prove manifest composition, exact allowlists, launcher environment/lifecycle,
fake-result completeness, and recovery call ordering. They do not prove real Harness behavior.

## 6. Build the Local Artifact

Run the repository build script after reviewing its destination and after the shared version seam
gate passes. It must stage outside the target repository, build a CGo-free `darwin/arm64` Core with
repository `VERSION` injected at link time, prove the moved binary reports that version without a
source checkout, and pack a local tarball without publication:

```text
./scripts/build-deepseek-package.sh <absolute-output-directory>
```

Record the packed file list, package SHA-256, Core executable SHA-256, Core source identity, fixture
aggregate, and absence of install/build/download/publication hooks. Do not commit the binary or
tarball.

## 7. Pass Gate B: Direct-Consumption Spike

Use `@deepseek-ai/dsh@0.1.0-rc.6` or a later officially selected compatible artifact in an isolated
profile. `scripts/run-deepseek-real-journey.sh --through direct-consumption` may orchestrate this
bounded spike after its task is implemented; review every resolved path before running it. Install
the exact local tarball through the official profile command and restart Harness:

```text
dsh plugin --profile <isolated-profile> add <absolute-local-tarball>
```

Record results in `evidence/direct-consumption.md`. The spike must show:

- exactly one `dev-flow` Skill and one-to-one exposure of all six raw Core tools;
- ordinary prompts do not activate the Skill;
- complete canonical JSON for inline success and `isError` domain error;
- complete canonical JSON immediately below and above the observed spill boundary;
- complete canonical JSON through observed compaction/prune behavior;
- a complete envelope near Core's 1,048,576-byte cap; and
- expected/recovered byte counts and SHA-256 digests plus the exact official retrieval mechanism.

The evidence must distinguish host display preview from programmatic complete content. If any case
cannot recover the complete result, stop. Do not create a projection proxy or continue to the user
stories until a reviewed amendment authorizes a concrete response to the observed limitation.

## 8. Independent Story Checks

### User Story 1 — Install and invoke

With Gate B passed, install the final local artifact into a clean profile, restart, and verify one
Skill plus the exact six tools. An ordinary prompt creates zero tasks. Explicit `/dev-flow` with a
substantive requirement opens `host=deepseek`; empty/conversational and non-Git invocations do not.
Inspect the target repository to prove no package, database, Skill, profile, or generated artifact
was copied there. Exercise missing/non-executable runtime behavior separately and label it simulated
unless the real host actually performed it.

### User Story 2 — Govern and resume

In a temporary Git repository, invoke `/dev-flow` for one bounded real source change. Follow only
fresh Core actions and their live payload schemas. Commit at least two Core actions through
`dev_flow_apply_action`, stop Harness, restart it, invoke `/dev-flow` again without a different task
contract, and prove the same Core task ID/repository lineage resumes. Finish within the Core's
verification budget and report completion only from the complete Core `DONE` outcome.

When a mutation response is intentionally made uncertain in a bounded safe check, retain its
request ID, perform the Contract 0.1 task/next-action probe, and follow the complete Core recovery
assessment before retry. If this cannot be safely reproduced in the real host, keep the fake-Core
evidence labeled as such and record the real-host skip.

### User Story 3 — Remove and retain data

Remove by identity and restart Harness:

```text
dsh plugin --profile <isolated-profile> remove dev-flow-deepseek
```

Verify the isolated profile no longer exposes the package layer, Skill, or tools. Verify the shared
data root and task remain. Reinstall the same compatible artifact when needed to demonstrate the
retained same-host task can resume. If Codex is installed, verify its files/runtime selection and
the shared data root are unchanged; otherwise record an explicit skip rather than simulated proof.

## 9. Final Real-Host Evidence

The final journey is allowed only with the latest official stable compatible Harness available at
execution time. Write `evidence/real-journey.md` with:

- timestamp and direct official version sources;
- exact Harness package version/build/integrity and compatible range;
- isolated profile name/root;
- actual OS and architecture;
- repository source, fixture aggregate, Core version/binary digest, package digest, and packed file
  list;
- proxy presence (`none` for this plan);
- six-tool and one-Skill observation;
- ordinary-prompt zero-task observation;
- task ID before/after restart and at least two committed actions;
- verification-budget accounting and evidence classifications;
- complete Core terminal outcome;
- removal/restart observation and retained task data;
- Codex non-interference or an explicit skip; and
- every failure, deviation, unsupported claim, and unexecuted check.

Never promote fake, static, different-host, user-reported, or pre-release evidence into the final
stable real-host claim.

## 10. Final Repository Check

Run the shared repository validation once at the feature checkpoint, inspect the changed scope, and
confirm that no binary, tarball, profile, database, temporary repository, credential, or target
repository artifact is tracked. Do not publish, tag, push, or create a release as part of this
quickstart.
