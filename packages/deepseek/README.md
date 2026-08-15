# dev-flow-deepseek

`dev-flow-deepseek` is the private macOS arm64 bundle boundary for an explicit `/dev-flow`
integration with DeepSeek Harness. The checked-in code is deterministic preparation only: it does
not contain a Core executable, is not a final artifact, and makes no native-host or stable support
claim.

The bundle contributes one user-only `dev-flow` Skill and one official local STDIO MCP client. Its
launcher selects only `runtime/darwin-arm64/dev-flow`, starts it without a shell, passes only the six
reviewed environment keys, and forwards MCP stdin/stdout without interpreting workflow results.
Core remains the sole owner of task state, transitions, recovery classification, and outcomes.

## Current gate

As observed on 2026-08-15, the official registry exposes only Harness release candidates; both
`latest` and `next` resolve to `@deepseek-ai/dsh@0.1.0-rc.6`. That artifact can inform engineering
contracts but cannot establish stable support. Its MCP client also registers tools globally and
exposes no reviewed Skill-invocation scope, so deterministic Skill/fake checks do not prove
ordinary-prompt zero-call behavior. This is an RC6-only gap, not a stable-artifact conclusion.
Native execution, a packaged Core, explicit-only Host admission, the complete stable direct-result
gate, and the final journey remain closed until the `003 merge barrier` and all exact-artifact gates
are satisfied.

Run the package-local deterministic checks with Node.js 24 or newer:

```sh
node --test packages/deepseek/tests/bundle.test.mjs \
  packages/deepseek/tests/launch-core.test.mjs \
  packages/deepseek/tests/skill.test.mjs \
  packages/deepseek/tests/fake-core.test.mjs \
  packages/deepseek/tests/direct-consumption.test.mjs \
  packages/deepseek/tests/journey-harness.test.mjs
```

The fake-profile checkpoints never start `dsh` and never produce native evidence:

```sh
DEV_FLOW_TEST_DSH_TRIPWIRE=1 scripts/run-deepseek-real-journey.sh \
  --fake-host --through explicit-invocation
DEV_FLOW_TEST_DSH_TRIPWIRE=1 scripts/run-deepseek-real-journey.sh \
  --fake-host --through done
DEV_FLOW_TEST_DSH_TRIPWIRE=1 scripts/run-deepseek-real-journey.sh \
  --fake-host --through remove
```

## Post-barrier lifecycle contract

After the final local tarball and exact stable Harness have passed their gates, the official profile
manager is the only supported installation boundary:

```sh
dsh plugin --profile <isolated-profile> add <absolute-local-tarball>
dsh plugin --profile <isolated-profile> remove dev-flow-deepseek
```

Stop and restart Harness after add or remove, then inspect the resolved profile. Removal must make
the dependency, bundle layer, Skill, and six tools absent while leaving `DEV_FLOW_DATA_DIR`, the
repository, and unrelated profile contents unchanged. Do not delete Harness caches or Core data.
A compatible reinstall must be able to resume retained Core state. Final passing evidence also
requires a real before/after comparison of a co-installed Codex product; deterministic comparison
logic is not that evidence.

When `DEV_FLOW_DATA_DIR` is set, it must name an existing usable directory. Otherwise the launcher
creates the shared macOS default at `~/Library/Application Support/dev-flow/data` with mode `0700`.
The target Git worktree is the Core working directory; package, profile, data, and evidence roots
stay outside it.

This package has no lifecycle commands, downloads, publication configuration, credentials,
repository mutation helpers, task database, alternate transport, or second platform runtime.
