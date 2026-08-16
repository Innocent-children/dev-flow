# dev-flow-codex

`dev-flow-codex` is the private, local Codex CLI product for Dev Flow. It packages one Codex plugin,
one explicitly selected `dev-flow` Skill, one bundled STDIO MCP server definition, and one
`darwin-arm64` Dev Flow Core executable. The package is never published by Feature 003.

The production source layout is deliberately closed:

```text
packages/codex/
├── .agents/plugins/marketplace.json
├── bin/dev-flow-codex.mjs
├── lib/{lifecycle,paths}.mjs
├── plugin/.codex-plugin/plugin.json
├── plugin/.mcp.json
├── plugin/skills/dev-flow/SKILL.md
├── plugin/skills/dev-flow/agents/openai.yaml
└── runtime/darwin-arm64/dev-flow       # temporary build staging only
```

The implementation baseline is Codex CLI `0.147.x` on macOS arm64. Sanitized fixtures and the
development smoke target that host contract. The final pre-merge acceptance report records the
actual Codex, package, and Core versions exercised; it is a product acceptance record, not an
indefinite compatibility promise.

Development requires Node.js `>=24`, pnpm `>=11 <12`, and the repository-pinned Go toolchain. The
package has no production npm dependency and no install, publication, download, or release hook.
Installation and explicit Codex registration are separate operations, and neither setup nor removal
may edit the current repository or delete Core-owned task data.

## Local artifact and explicit setup

Create a temporary, non-final development artifact and install it with lifecycle scripts disabled:

```bash
CODEX_ARTIFACT_DIR="$(mktemp -d -t dev-flow-codex-local.XXXXXX)"
./scripts/build-codex-local.sh --output "$CODEX_ARTIFACT_DIR"

CODEX_INSTALL_PREFIX="$(mktemp -d -t dev-flow-codex-install.XXXXXX)"
npm install --ignore-scripts --no-audit --no-fund \
  --prefix "$CODEX_INSTALL_PREFIX" \
  "$CODEX_ARTIFACT_DIR/dev-flow-codex-0.1.0.tgz"
export PATH="$CODEX_INSTALL_PREFIX/node_modules/.bin:$PATH"
```

Installation alone makes no Codex registration and runs no product lifecycle hook. Verify the
detached package/Core identity, then perform the separately authorized setup:

```bash
dev-flow-codex --version
dev-flow-codex setup --json
codex plugin marketplace list --json
codex plugin list --json
```

Setup supports only macOS arm64 in this feature. It verifies the installed Codex version against
the selected bounded range, the package/plugin/Core version identity, the package-local executable,
the one Skill, its explicit-only `agents/openai.yaml` policy, the typed MCP resource, and
`dev-flow-codex` discovery on `PATH` before its first registry write. It registers
`dev-flow-local` and `dev-flow-codex@dev-flow-local` through Codex JSON commands, validates the
official camelCase mutation results, and requires exact `{marketplaces: [...]}` plus
`{installed: [...], available: [...]}` readback before writing the ownership receipt at
`~/Library/Application Support/dev-flow/registrations/codex.json`. Matching repeated setup is a
no-op; malformed, incomplete, or conflicting state fails closed. Restart or open a fresh Codex
session after setup so the host refreshes plugin, Skill, and MCP discovery.

Without `DEV_FLOW_DATA_DIR`, `dev-flow-codex mcp` creates only
`~/Library/Application Support/dev-flow/data` with restrictive permissions. A nonempty override
must already be an absolute, canonical, usable directory. Runtime selection is always relative to
the installed package; it never falls back to a Core binary in the current repository.

## Explicit invocation boundary

The official Skill metadata sets `policy.allow_implicit_invocation: false`. The Skill resource/base name is `dev-flow`;
the installed Skill full name is `dev-flow-codex:dev-flow`. The only exact explicit selector is `$dev-flow-codex:dev-flow`.
Bare `$dev-flow` is not an alias and does not select this installed Skill. A wrong plugin namespace,
a wrong Skill base name, or a missing selector also does not select it.
All negative paths make zero Dev Flow tool calls and create zero Dev Flow tasks; there is no implicit fallback.
An ordinary prompt therefore does not activate Dev Flow. `$dev-flow-codex:dev-flow` with no substantive
requirement, a conversational request, a non-Git directory, or work spanning more than one repository
stops before any Dev Flow tool call.
For an admitted request, the Skill resolves one canonical current worktree and calls
`dev_flow_server_info({})` first; an incomplete or incompatible six-tool catalog stops the request.

## Core-governed create and resume

After the handshake, a new invocation opens one `host=codex` task using only the bounded user
request, repository instructions, acceptance criteria, exclusions, and verification authority. An
explicit resume omits `new_task`; Core must return the compatible active task. A restart/resume must
preserve the same task ID and continue its advancing revision lineage. An ownership or contract
conflict stops the invocation without choosing, merging, or replacing task records.

Every iteration consumes one complete fresh Core action. Its task/revision/action identity,
repository binding, allowed effects, required evidence, payload schema, blocker, and outcome stay
together. Codex performs only the allowed effect, constructs the returned closed payload, retains a
request ID, and submits exactly one mutation. A complete success continues only from the returned
next action or a fresh Core read; Codex does not infer transitions or completion.

If a mutation result is missing, cancelled, malformed, truncated, or otherwise uncertain, read
before retry: retain the exact original operation, call `dev_flow_get_task` and
`dev_flow_get_next_action`, and follow only Core's recovery assessment. Never reconstruct a missing
operation probe or repeat a mutation because its response was lost.

Every completed host command event is retained only as role-scoped status, exit code, and safe
command/output hashes. Ambient commands in the ordinary or invalid sessions and repository
inspection or implementation commands in active sessions are non-verification facts. Only the one
Core-submitted and retained logical proof, rendered by Codex 0.147 on macOS as the closed supported
command, counts against the verification budget. An unbound or duplicate proof and any known test
or full-suite command fail closed. Do not run a forbidden full suite; when automatic capacity is
exhausted, report an honest manual handoff.
Static, simulated, user-performed, and native evidence keep distinct labels. A Core blocker,
ownership/contract conflict, `CANCELLED`, or Core-owned `DONE` outcome stops repository work and is
reported without reinterpretation.

## Explicit removal and retained task data

Deregister before running npm uninstall:

```bash
dev-flow-codex remove --json
npm uninstall --ignore-scripts dev-flow-codex
```

Removal is receipt-first. It reads and validates the exact ownership receipt, reads current Codex
marketplace/plugin state, and fails closed on an identity, root, or readback conflict before any
mutation. It removes the matching plugin, verifies absence, removes the matching marketplace,
verifies absence again, and deletes only the exact receipt. An interrupted removal keeps the
receipt, so the next explicit call can resume from fresh readback. Repeated removal after complete
absence is an idempotent no-op.

The command does not delete the npm package, Core task data, repository, Codex config/cache, receipt
parents, or unknown adjacent resources. Stop Core before comparing task-data manifests; after
deregistration, directly reopen the recorded task with Core to prove retention. Perform npm
uninstall separately only after successful absence readback. A later artifact within the selected
compatible range may be installed and explicitly set up again against the retained data.

Setup, version reporting, and removal are package/user-state operations and behave the same from
any working directory. They do not add configuration, databases, instructions, or generated files
to the target repository and never mutate Git.

The `>=0.147.0 <0.148.0` line and exact `0.147.0` host were selected on 2026-08-15, not promised
indefinitely. The selected MCP file uses Agent Plugins v1 `$schema`, camelCase `mcpServers`, and one
`type: stdio` entry, a shape accepted by both 0.147 plugin parsers. A future changed official
contract requires every compatibility-bearing contract, test, and guide to be updated before a
final artifact is built.

## Deterministic validation

Run the product-bearing package layers directly:

```bash
pnpm --dir packages/codex test:package
pnpm --dir packages/codex test:lifecycle
pnpm --dir packages/codex test:parser
pnpm --dir packages/codex test:native-smoke
pnpm --dir packages/codex pack:dry
```

The checked-in Codex 0.147 fixtures cover three mutually exclusive terminal shapes without starting
Codex: completed success with text/structured parity, failed Core-domain result with the same parity,
and failed transport with no complete Core result. They contain no prompt, source, user path,
environment, token, or secret.

```bash
./scripts/run-codex-real-journey.sh --fixture success
./scripts/run-codex-real-journey.sh --fixture core-domain-error
./scripts/run-codex-real-journey.sh --fixture transport-error
```

## Repeatable development smoke

After deterministic checks are green, run the full isolated chain twice with fresh empty result
directories and labels `A` then `B`:

```bash
./scripts/run-codex-real-journey.sh \
  --development-smoke \
  --run-label A \
  --codex-executable "$CODEX_EXECUTABLE" \
  --result-directory "$CODEX_SMOKE_RESULT_DIRECTORY"
```

Each invocation builds and installs a non-final package in one new temporary root, performs setup,
four fresh Codex 0.147 sessions, removal, and a direct packaged-Core retention read, then deletes the
temporary root. The external `smoke-result.json` is a development result, not final acceptance or a
formal support statement; failures add only a bounded, hashed diagnostic.

## Final pre-merge acceptance

Run one final real-host acceptance only after development smoke is stable and the four pending HIGH
regressions are closed. The real-host entry point records ephemeral session observations:

```bash
./scripts/run-codex-real-journey.sh \
  --acceptance \
  --codex-executable "$CODEX_EXECUTABLE" \
  --workspace "$CODEX_ACCEPTANCE_WORKTREE"
```

The observation itself does not claim acceptance. A single simplified JSON report must then record
the reviewed source and artifact identities, Codex/package/Core versions, setup readback, zero Core
calls for the ordinary prompt, the exact selector, the same task ID across restart, at least two
committed actions, Core `DONE`, successful removal readback, retained and reopened task data, and an
empty unexpected-repository-path list. Package and Core versions must match. Validate that closed
object without creating any additional report files:

```bash
node scripts/write-codex-journey-evidence.mjs \
  acceptance-report \
  --report "$CODEX_ACCEPTANCE_REPORT"
```

Feature 003 uses this one acceptance report only as a pre-merge product gate. It does not implement
a release or supply-chain proof system. Public npm publication, GitHub releases, tags,
Windows/Linux claims, IDE support, and additional Codex surfaces remain out of scope.
