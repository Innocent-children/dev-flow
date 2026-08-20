# Quickstart: Implement and Validate Feature 010

This quickstart is for repository contributors. It does not describe a public release.

## 1. Establish the Baseline

```bash
git switch main
git pull --ff-only
git rev-parse HEAD
```

Expected planning baseline:

```text
70726d0ba59ead5496657e445b25494152e6d8f8
```

Create the implementation branch from the actual current `main`. If `main` has moved, update the
Feature baseline and rerun analyze before code changes.

## 2. Activate the Feature Package

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/010-deepseek-explicit-graph-host"
```

Run the normal clarify/checklist/analyze gates. Do not regenerate the prepared package.

## 3. Install Repository Dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

Use the repository's declared Node and pnpm versions. Do not install DSH into the target repository as
a production dependency; native evidence uses isolated host state.

## 4. Implement in Bounded Areas

Primary product paths:

```text
packages/deepseek/
tests/journeys/deepseek/
```

Bounded shared updates:

```text
MANIFEST.md
README.md
docs/FEATURE-DEPENDENCIES.md
docs/ROADMAP.md
docs/SUPPORT-MATRIX.md
scripts/validate-repository.sh
specs/004-deepseek-explicit-dev-flow/README.md
```

Core source is out of scope unless a verified Contract 0.2 defect blocks the product and a reviewed
amendment authorizes it.

## 5. Run Targeted Checkpoints

Examples; final command names are established by the implementation tasks:

```bash
node --test packages/deepseek/tests/package-contract.test.mjs
node --test packages/deepseek/tests/authorization.test.mjs
node --test packages/deepseek/tests/integration-plugin.test.mjs
node --test packages/deepseek/tests/skill-contract.test.mjs
node --test tests/journeys/deepseek/simulated-graph-journey.test.mjs
```

Do not repeatedly run the full repository validator during implementation.

## 6. Build One Source-Local Artifact

The package build must:

- build the CGo-free darwin-arm64 Core using the repository's existing version injection seam;
- copy only the binary and declared package files;
- verify `dev-flow version`;
- verify `dev-flow mcp --stdio` through the package path;
- run `pnpm pack --dry-run`;
- create one retained local `.tgz`;
- record package and Core digests.

No artifact is published.

## 7. Install into an Isolated DSH Profile

Use the exact accepted DSH artifact and an isolated profile name:

```bash
dsh plugin --profile dev-flow-acceptance add /absolute/path/to/dev-flow-deepseek-<version>.tgz
```

Restart DSH after profile mutation:

```bash
dsh --profile dev-flow-acceptance
```

DSH owns the profile path and package metadata. Tests may inspect official readback but must not edit
the profile directly.

## 8. Exercise Explicit Invocation

A Dev Flow-capable turn contains the selector:

```text
/dev-flow Implement the bounded task described here.
```

Any later user turn expected to dispatch a Dev Flow tool contains `/dev-flow` again, for example:

```text
/dev-flow I confirm the comprehension review.
```

Ordinary input without the selector must not reach Core, even if the model attempts a registered
Dev Flow MCP tool.

## 9. Restart and Resume

Stop DSH after a committed action, start the same profile again, and explicitly invoke `/dev-flow`.
The Skill must read current Core state and resume the same `host=deepseek` task.

Do not treat DSH reconnect or a missing mutation response as permission to replay. Read task and next
action first.

## 10. Remove and Reinstall

Stop the profile, then use the official package-manager path:

```bash
dsh plugin --profile dev-flow-acceptance remove dev-flow-deepseek
```

Restart and verify the Skill and `mcp__dev_flow__...` namespace are absent.

Verify:

- shared Dev Flow data unchanged;
- target repository unchanged except the intended governed task work;
- Codex package and configuration unchanged.

Reinstall the exact same tarball, restart, and reopen the same task.

## 11. Final Gates

After all targeted checkpoints pass and source is frozen:

1. run the one direct-result compatibility gate;
2. run the one official add/remove/reinstall lifecycle;
3. run the one real DSH graph journey;
4. write sanitized evidence;
5. run `pnpm validate` once;
6. run final `$speckit-analyze`;
7. run final `$speckit-converge`.

A native failure is retained and classified. Do not edit evidence or silently rerun to replace it.

## 12. Stop at Feature Completion

Feature completion does not publish, tag, create a GitHub Release, or choose the first public
DeepSeek version.
