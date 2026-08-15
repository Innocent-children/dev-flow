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
└── runtime/darwin-arm64/dev-flow       # temporary build staging only
```

The planning compatibility baseline is Codex CLI `>=0.147.0 <0.148.0`. The exact latest stable
compatible build and every plugin, Skill, MCP, marketplace, setup/readback, and removal command are
revalidated immediately before final validation. The final evidence records the selected range and
exact tested build; the planning baseline is not a permanent compatibility promise.

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
the one Skill and MCP resource, and `dev-flow-codex` discovery on `PATH` before its first registry
write. It registers `dev-flow-local` and `dev-flow-codex@dev-flow-local` through Codex JSON commands,
requires exact readback, and only then writes the ownership receipt at
`~/Library/Application Support/dev-flow/registrations/codex.json`. Matching repeated setup is a
no-op; malformed, incomplete, or conflicting state fails closed. Restart or open a fresh Codex
session after setup so the host refreshes plugin, Skill, and MCP discovery.

Without `DEV_FLOW_DATA_DIR`, `dev-flow-codex mcp` creates only
`~/Library/Application Support/dev-flow/data` with restrictive permissions. A nonempty override
must already be an absolute, canonical, usable directory. Runtime selection is always relative to
the installed package; it never falls back to a Core binary in the current repository.

## Explicit invocation boundary

The only workflow selector is a standalone `$dev-flow` in the current user turn. An ordinary prompt
does not activate Dev Flow. `$dev-flow` with no substantive requirement, a conversational request,
a non-Git directory, or work spanning more than one repository stops before any Dev Flow tool call.
For an admitted request, the Skill resolves one canonical current worktree and calls
`dev_flow_server_info({})` first; an incomplete or incompatible six-tool catalog stops the request.

Setup, version reporting, and removal are package/user-state operations and behave the same from
any working directory. They do not add configuration, databases, instructions, or generated files
to the target repository and never mutate Git.

The `>=0.147.0 <0.148.0` line is the implementation planning range, not an indefinite promise. The
latest official stable Codex CLI and the exact plugin, Skill, MCP, marketplace, and JSON readback
contracts are revalidated together immediately before final validation. If that review selects a
different bounded range, every compatibility-bearing contract, test, and guide is updated before a
final artifact is built.

User-story checkpoints are deterministic only. Run targeted checks such as:

```bash
pnpm --dir packages/codex test:package
pnpm --dir packages/codex test:lifecycle
pnpm --dir packages/codex test:journey-harness
pnpm --dir packages/codex pack:dry
```

The fake-host journey is the only checkpoint command before final validation:

```bash
./scripts/run-codex-real-journey.sh --fake-host --through setup
./scripts/run-codex-real-journey.sh --fake-host --through done
./scripts/run-codex-real-journey.sh --fake-host --through remove
```

Those runs must not start Codex or write native evidence. Feature 003 permits exactly one real Codex
CLI journey, on macOS arm64, after compatibility revalidation, all targeted checks, root validation,
a read-only audit, source freeze, and creation of one final artifact. A source change invalidates
that artifact. Public npm publication, GitHub releases, tags, Windows/Linux claims, IDE support, and
additional Codex surfaces remain out of scope.

The setup checkpoint builds and installs a temporary non-final artifact into isolated paths, puts
the test-only Codex double first on `PATH`, performs supported JSON registration/readback, compares
the repository fingerprint, and emits a `classification=simulated` JSON record with
`real_codex_started=false` and `native_evidence_written=false`. Calling the harness without
`--fake-host` is rejected during the user-story phases.
