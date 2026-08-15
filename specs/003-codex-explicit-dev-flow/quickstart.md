# Quickstart: Build and Validate the Local Codex Product

This runbook defines the Feature 003 acceptance procedure. It distinguishes deterministic
user-story checkpoints from the **single allowed real Codex journey**. It never publishes a package
or claims support beyond the exact compatibility range and macOS arm64 surface recorded during
implementation.

## 1. Review and revalidate prerequisites

Before implementation:

1. confirm Feature 002/Core Contract 0.1 and shared fixtures are present;
2. complete reviewer-owned requirement checklists;
3. record the repository commit being evaluated;
4. revalidate the then-current official stable Codex CLI, plugin, Skill, MCP, marketplace,
   setup/readback, and removal contracts;
5. select a minimum version, bounded compatible range, and exact stable version for native evidence.

The planning baseline was Codex CLI `0.147.x`, but the implementation does not silently preserve
that range if the official stable contract has moved. A changed range must be updated consistently
in the plan, contracts, both JSON Schemas, data model, quickstart, tasks, and tests before final
validation.

Expected platform/toolchain boundary:

```bash
uname -s
uname -m
codex --version
go version
node --version
pnpm --version
```

Feature 003 native evidence is macOS arm64 and Codex CLI only.

## 2. Run deterministic foundation checks

Run only the checks required by the active task, for example:

```bash
go test ./internal/version ./tests/contract
node --test packages/codex/tests/paths.test.mjs
node --test packages/codex/tests/lifecycle.test.mjs
```

Foundation checks prove:

- detached Core version injection and source-tree fallback;
- exact six-tool/shared-fixture parity;
- safe runtime/data/receipt paths;
- receipt validation and ownership;
- Codex-aware root dry-pack rules;
- preservation of the DeepSeek skeleton boundary.

They do not prove native Codex behavior.

## 3. Implement and check User Story 1 without starting Codex

After US1 package, launcher, plugin, Skill, and setup behavior exist:

```bash
node --test packages/codex/tests/package-contract.test.mjs
node --test packages/codex/tests/launcher.test.mjs
node --test packages/codex/tests/lifecycle.test.mjs
node --test packages/codex/tests/skill-contract.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through setup
```

The checkpoint must use the fake Codex CLI and isolated temporary roots. It proves package shape,
supported setup/readback ordering, explicit-only admission, invalid-input rejection, and repository
fingerprints. It must assert that no real `codex` process starts and that no native evidence file is
written.

A non-final `.tgz` may be built for tarball-contract testing. It is not the final artifact and does
not authorize a real host run.

## 4. Implement and check User Story 2 without starting Codex

```bash
node --test packages/codex/tests/fake-core-contract.test.mjs
node --test packages/codex/tests/skill-contract.test.mjs
node --test packages/codex/tests/journey-evidence.test.mjs
node --test packages/codex/tests/journey-harness.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through done
```

The fake Core/harness must prove:

- exact six-tool mapping and complete results;
- new task, exact resume, same-host conflict, and other-host conflict;
- fresh action/revision identity and closed payload forwarding;
- successful mutation continuation;
- lost/truncated mutation read-before-retry ordering;
- verification-command budget accounting and evidence labels;
- restart boundary with the same fake task lineage;
- Core-owned blocker/cancel/`DONE`;
- no native-evidence promotion.

No real Codex session is allowed in this step.

## 5. Implement and check User Story 3 without starting Codex

```bash
node --test packages/codex/tests/lifecycle.test.mjs
node --test packages/codex/tests/removal-retention.test.mjs
./scripts/run-codex-real-journey.sh --fake-host --through remove
```

This checkpoint proves:

- receipt-first removal reconciliation;
- plugin/marketplace absence readback through the fake host;
- adjacent-file preservation;
- no direct Codex config/cache deletion;
- task-data and repository manifest preservation;
- direct Core task reopen;
- separate npm uninstall and compatible reinstall;
- repeated removal as a no-op;
- zero real Codex processes and zero native evidence.

## 6. Reconcile the final host contract

Immediately before final hardening, repeat the official compatibility review. Update all affected
documents/contracts/tests together if the selected range or command/resource contract changed.

Do not continue when an official change alters product behavior, ownership, or result semantics
without updating the feature and rerunning checklist/analyze review.

## 7. Run all deterministic checks and root validation

Run the complete targeted Feature 003 set, then the root gate:

```bash
go test ./internal/version ./tests/contract
node --test packages/codex/tests/*.test.mjs
pnpm run validate
```

The root validator must use the delivered Codex source/dry-pack allowlist and retain the DeepSeek
skeleton rule. It must not start Codex, install into real user state, publish, or perform a native
journey.

Fix failures now. After fixes, rerun the affected targeted checks and root gate. Record:

- exact commands;
- pass/fail result;
- completion time;
- current source commit.

These facts are later copied into native evidence. Do not build the final artifact until this phase
passes.

## 8. Perform the pre-final read-only audit and freeze source

Audit the complete allowed Feature 003 scope:

```text
internal/version/
packages/codex/
scripts/build-codex-local.sh
scripts/run-codex-real-journey.sh
scripts/validate-codex-journey-evidence.mjs
scripts/validate-repository.sh
tests/contract/
tests/journeys/evidence/
specs/003-codex-explicit-dev-flow/
```

Confirm:

- no Core Contract/state/transition/recovery change;
- no Git mutation or generic shell MCP;
- no publication/release action;
- no copied shared fixtures;
- no unexpected binary/data/receipt artifact;
- no unsupported platform/surface claim;
- no second host framework.

Record and freeze the source commit. Any later source change returns the workflow to step 7.

## 9. Build exactly one final artifact

```bash
CODEX_ARTIFACT_DIR="$(mktemp -d -t dev-flow-codex-final.XXXXXX)"
./scripts/build-codex-local.sh --output "$CODEX_ARTIFACT_DIR"
```

The build must emit one absolute `.tgz` path and digest and verify:

- package/plugin/Core/root version equality;
- compatibility metadata matches the selected range;
- the packaged Core reports its version outside the checkout;
- exact tarball allowlist;
- executable mode;
- frozen source identity;
- no Core source, fixtures, fakes, evidence, repository metadata, or second platform runtime.

A defect discards this artifact and returns to step 7. Do not patch the final tarball.

## 10. Execute the only real Codex journey

Use the exact final artifact and exact selected stable Codex CLI:

```bash
./scripts/run-codex-real-journey.sh \
  --artifact "$CODEX_ARTIFACT_PATH" \
  --source-commit "$FROZEN_SOURCE_COMMIT"
```

This is the only Feature 003 task permitted to start Codex. The journey must run continuously through
all required checkpoints:

1. install the tarball into an isolated prefix with scripts disabled;
2. run explicit setup and exact marketplace/plugin readback;
3. repeat matching setup as an idempotent no-op;
4. start a fresh Codex session;
5. send an ordinary request and prove zero calls to the six Dev Flow tools and zero tasks;
6. exercise empty/conversational and non-Git explicit invocations;
7. invoke `$dev-flow` with one substantive single-repository change;
8. commit at least two Core workflow actions;
9. close Codex before terminal outcome;
10. start a new Codex session in the same repository;
11. explicitly resume and prove the same task ID with advancing revisions;
12. stay within the automatic verification-command budget;
13. reach authoritative Core `DONE`;
14. stop Codex/Core;
15. record repository and complete task-data manifests;
16. run explicit deregistration and absence readback;
17. prove receipt removal and adjacent-file preservation;
18. prove task-data manifest equality and direct task reopen;
19. uninstall the npm package separately;
20. repeat removal as a no-op and perform a compatible reinstall check;
21. prove repository digest is unchanged by removal.

The script writes `tests/journeys/evidence/codex-macos-arm64.json` once. It includes the root
validation result from step 7, frozen source commit, and final artifact digest. Do not manually edit
the record.

When the journey cannot finish, write an honest `failed` or `blocked` record with only observed
fields. Do not fabricate task lineage or completed lifecycle data.

## 11. Validate evidence without modifying it

Run structural and semantic validation:

```bash
node ./scripts/validate-codex-journey-evidence.mjs \
  tests/journeys/evidence/codex-macos-arm64.json
```

The validator first applies
`contracts/journey-evidence.schema.json`, then checks:

- package/Core/root version equality;
- Codex range membership;
- source/validation/artifact identity;
- strictly increasing revisions;
- equal pre/post-restart task IDs;
- at least two committed actions;
- Core call count within budget;
- terminal outcome `DONE`;
- equal task-data manifests;
- repository-after equals repository-after-removal;
- empty unexpected paths;
- all lifecycle flags true;
- deterministic/root validation passed before final build.

Validation is read-only. A failure returns to deterministic checks/final build/native journey as
appropriate; do not patch evidence.

## 12. Final read-only audit

Confirm that no file changed after source freeze except the single evidence record and that the
final diff remains within the complete allowed Feature 003 scope. Do not rebuild, rerun the host,
publish, tag, release, or mutate evidence after this audit.
