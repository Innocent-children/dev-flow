# Quickstart: Build and Verify DeepSeek Explicit Dev Flow

This runbook is an implementation/verification procedure, not proof that Feature 004 already works.
Keep profiles, packages, data, evidence, and test repositories outside the target repository. Do not
publish, tag, release, or use a normal user profile.

## 1. Verify the merged Feature 003 baseline

Feature 004 starts only after Feature 003 is implemented and merged to `main`. Record the exact
merge commit and verify the delivered `internal/version` seam/tests, Codex-aware shared manifest/
layout contracts, root validator, root `VERSION`, Core source, and fixture aggregate.

Do not continue from a sibling branch, depend on Feature 003 task numbers, edit/duplicate the shared
version seam, or weaken Codex validation.

## 2. Revalidate official Harness evidence

Inspect official registry/repository evidence and record:

- stable and pre-release artifacts;
- exact package version/build/integrity/source relationship;
- bounded compatible range;
- bundle/profile, Skill, native MCP result, add/remove/restart, and stale-metadata contracts.

Planning found only a release candidate. When no stable artifact exists, one provisional direct-
result spike may run and every observation is labelled `pre-release-native`. It never establishes
support.

## 3. Run deterministic foundation checks

After the corresponding tasks exist, run bounded checks such as:

```text
node --test packages/deepseek/tests/bundle.test.mjs
node --test packages/deepseek/tests/launch-core.test.mjs
node --test packages/deepseek/tests/fake-core.test.mjs
node --test packages/deepseek/tests/direct-consumption.test.mjs
node --test packages/deepseek/tests/skill.test.mjs
go test ./tests/contract
```

These checks prove package shape, closed launch, fake results/recovery, explicit admission, shared
contract preservation, and evidence validation. They do not prove real Harness behavior.

## 4. Execute Gate B

The direct-result gate uses an isolated profile and test-only fake Core and covers:

1. inline success;
2. complete domain error / `isError`;
3. near-spill;
4. spilled;
5. pruned/compacted;
6. near the Core envelope limit.

For each case record exact Harness identity, expected/recovered byte counts and SHA-256, host
representation, marker detection, official retrieval method, and complete parse.

When stable is unavailable, an RC spike may provisionally unblock deterministic host-specific work.
Before final support, complete evidence must exist for the exact selected stable artifact. A same-
artifact stable gate can be revalidated/reused; RC or different-artifact evidence must be rerun.
Any failure stops for reviewed amendment and does not authorize a proxy.

## 5. Check User Story 1 without a real Harness journey

```text
./scripts/run-deepseek-real-journey.sh --fake-host --through explicit-invocation
```

Verify one Skill/six tools, ordinary zero-task behavior, explicit/invalid invocation, bounded startup
failure, package/runtime identity, and repository cleanliness. Assert no real `dsh` process and no
native evidence.

## 6. Check User Story 2 without a real Harness journey

```text
./scripts/run-deepseek-real-journey.sh --fake-host --through done
```

Verify create/resume/conflicts, complete fresh authority, two fake Core action commits, restart
lineage, read-before-retry, budget accounting, blockers/cancellation, and Core `DONE`. Start no real
Harness.

## 7. Check User Story 3 without a real Harness journey

```text
./scripts/run-deepseek-real-journey.sh --fake-host --through remove
```

Verify product-identity removal, restart/absence readback, retained data/repository, compatible
reinstall, repeated removal, stale-metadata stop, and Codex-comparison logic. Start no real Harness
and do not claim Codex non-interference.

## 8. Select the final stable Harness and ensure stable Gate B

Immediately before finalization, select the latest official stable compatible Harness and revalidate
all volatile contracts. Ensure the complete six-case gate exists for that exact artifact. Reuse
prior evidence only when it is from the same stable artifact and the contract/integrity remain
unchanged.

If no stable artifact exists, if any stable case fails, or if complete content cannot be recovered,
stop. Do not build the final artifact or add a proxy.

## 9. Run all deterministic checks and root validation

Run the complete Feature 004 test set, affected shared Go contracts, dry-pack/build checks, then:

```text
pnpm run validate
```

The merged root validator must preserve every Codex rule while adding bounded DeepSeek checks. It
must not start Harness, mutate profiles, download/publish, or write native evidence.

Fix failures now and rerun affected checks. Record exact commands/results and source commit. Do not
build the final artifact yet.

## 10. Audit and freeze source

Read-only audit:

```text
packages/deepseek/
scripts/build-deepseek-package.sh
scripts/run-deepseek-real-journey.sh
scripts/validate-deepseek-journey-evidence.mjs
scripts/validate-repository.sh
pnpm-lock.yaml
tests/contract/
specs/004-deepseek-explicit-dev-flow/
```

Confirm no Feature 003/Core regression, proxy, Git/repository mutation, shell/listener/network,
publication, future framework, unsupported platform claim, or secret/generated artifact. Freeze the
source commit. A later source change returns to deterministic validation.

## 11. Build exactly one final product artifact

```text
./scripts/build-deepseek-package.sh <absolute-output-directory>
```

Verify package/Core/root version equality, stable range metadata, exact allowlist, executable mode,
frozen source, Core/fixture/package digests, and moved Core CLI/server-info identity. A defect
discards the artifact and returns to step 9.

## 12. Establish a real co-installed Codex baseline

Install/read back the delivered Feature 003 Codex product in the isolated test environment and
record package selection, registration resources, runtime digest, and shared data digest. If this
cannot be established, final evidence is blocked; do not record a passing Codex skip.

## 13. Run the sole final stable journey

Use the exact stable Harness that passed stable Gate B and the exact final product artifact:

```text
./scripts/run-deepseek-real-journey.sh \
  --artifact <absolute-final-tarball> \
  --stable-harness <exact-version-build> \
  --source-commit <frozen-commit>
```

The journey performs add/restart, ordinary zero-task prompt, explicit invalid inputs, one substantive
`/dev-flow` task, at least two Core commits, Harness restart/resume, budgeted `DONE`, product remove/
restart, retained data/task reopen, compatible reinstall, repository comparison, and real Codex
before/after comparison.

Write only observed facts to
`specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md`. If any required step, especially
Codex comparison, is unavailable, status is blocked/failed.

## 14. Validate evidence read-only

Run the planned validator:

```text
node scripts/validate-deepseek-journey-evidence.mjs \
  specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md
```

It verifies merged baseline, exact stable Gate B/final host identity, source/artifact identity, six
complete gate cases, task/revision/action lineage, budget, `DONE`, removal/data/repository equality,
reinstall, real Codex equality, proxy absence, prior validation, and bounded support claims.

Do not edit evidence to make validation pass. Return to deterministic checks/build/journey as
required.

## 15. Final read-only audit

Confirm no source changed after freeze and only the final evidence record was added after artifact
creation. Do not rebuild, rerun a host, edit evidence, publish, tag, release, or perform further
repository mutations.
