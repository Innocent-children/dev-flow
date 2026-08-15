# Quickstart: Build and Validate the Local Codex Product

This is the acceptance procedure Feature 003 must make runnable. It exercises the private final artifact only; it does not publish a package or claim support beyond Codex CLI 0.147.x on macOS arm64.

## 1. Verify prerequisites

From the repository root:

```bash
uname -s
uname -m
codex --version
go version
node --version
pnpm --version
```

Expected planning baseline:

- `Darwin`
- `arm64`
- Codex CLI `>=0.147.0 <0.148.0`
- Go 1.26 or the repository-pinned compatible toolchain
- Node.js 24.x
- pnpm `>=11 <12`

The Codex CLI 0.146.0 currently present on the planning machine is below the supported range. Do not record it as final journey evidence. Use the latest stable 0.147.x available at implementation time and record the exact version.

## 2. Run targeted pre-pack checks

Run only the feature-local and affected contract checks:

```bash
go test ./internal/version ./tests/contract
node --test packages/codex/tests/*.test.mjs
```

These checks must prove:

- the Core build-version seam preserves source builds and supplies detached binary identity;
- the package contains one plugin, one Skill, one MCP server, and no install mutation hook;
- the plugin exposes the exact six Core Contract 0.1 tools;
- shared fixtures are consumed from `protocol/fixtures/`, not copied;
- lifecycle reconciliation/removal is bounded under a fake Codex CLI;
- fake-Core scenarios cover explicit invocation, closed forwarding, complete result handling, and read-before-retry without being labelled native evidence.

## 3. Build the final local artifact

Use the repository build entry point, which stages into a temporary directory and leaves no runtime binary in the source tree:

```bash
CODEX_ARTIFACT_DIR="$(mktemp -d -t dev-flow-codex-artifact.XXXXXX)"
./scripts/build-codex-local.sh --output "$CODEX_ARTIFACT_DIR"
```

The command must print one absolute `.tgz` path and its SHA-256 digest. Inspect the tarball before installation:

```bash
CODEX_ARTIFACT_PATH="$CODEX_ARTIFACT_DIR/dev-flow-codex-0.1.0.tgz"
tar -tzf "$CODEX_ARTIFACT_PATH"
shasum -a 256 "$CODEX_ARTIFACT_PATH"
```

The listing must match the allowlist in [contracts/codex-plugin.md](./contracts/codex-plugin.md). In particular, it must contain `runtime/darwin-arm64/dev-flow` and must not contain Core source, test fakes, shared fixture copies, or repository metadata.

## 4. Install with lifecycle scripts disabled

Install the tarball into an isolated prefix and expose only that prefix's executable directory to the current shell:

```bash
CODEX_INSTALL_PREFIX="$(mktemp -d -t dev-flow-codex-install.XXXXXX)"
npm install --ignore-scripts --prefix "$CODEX_INSTALL_PREFIX" "$CODEX_ARTIFACT_PATH"
export PATH="$CODEX_INSTALL_PREFIX/node_modules/.bin:$PATH"
dev-flow-codex --version
```

Installation alone must not change Codex registration, a target repository, or Core task data.

## 5. Run explicit setup and readback

```bash
dev-flow-codex setup --json
codex plugin marketplace list --json
codex plugin list --marketplace dev-flow-local --available --json
```

Confirm that:

- the setup result names the exact Codex, package, and Core versions;
- marketplace `dev-flow-local` resolves to the installed artifact root;
- plugin `dev-flow-codex@dev-flow-local` is installed;
- package preflight found exactly one `dev-flow` Skill and one STDIO MCP server, while Codex JSON readback reports the expected installed/enabled plugin identity, source, and version;
- the receipt exists at `~/Library/Application Support/dev-flow/registrations/codex.json`;
- the target repository has not been touched.

Run setup a second time. It must report an already matching registration and make no additional registration change.

Start a new Codex session after plugin installation so the host refreshes plugin resources.

## 6. Prove explicit-only activation

Use the disposable repository prepared by the real-journey script or create an equivalent small committed fixture. In a fresh Codex session, send one ordinary coding request that does not contain `$dev-flow`.

The evidence harness must verify that the prompt caused no call to the six Dev Flow tools and created no Dev Flow task; host MCP initialization/tool-list discovery is not counted as a tool call. Then try these explicit invalid invocations:

```text
$dev-flow hello
```

from a non-Git directory, and:

```text
$dev-flow
```

without a substantive requirement or explicit resume intent. Each must stop before task creation with the missing precondition.

## 7. Run the governed restart/resume journey

The bounded orchestrator prepares a disposable Git repository, fingerprints it and the task-data location, installs the exact tarball, and prints or dispatches the fixed substantive scenario:

```bash
./scripts/run-codex-real-journey.sh --artifact "$CODEX_ARTIFACT_PATH"
```

The native Codex portion must perform this observable sequence:

1. Open a new Codex CLI session in the disposable repository.
2. Explicitly invoke `$dev-flow` with the script's substantive one-repository change.
3. Allow Core to confirm at least two workflow-action commits; these are Core state commits, not Git commits performed by the adapter.
4. Stop the Codex session before the Core-owned terminal outcome.
5. Open a new Codex CLI session in the same repository.
6. Invoke `$dev-flow resume the compatible active task for this repository`.
7. Confirm that Core returns the same opaque task ID with a continuing revision lineage.
8. Complete only the current Core actions, honor the task's automatic verification-command budget, and reach Core's `DONE` outcome.

The script must preserve complete structured results for the evidence record. A missing/truncated mutation result triggers task and next-action reads before any retry. It must not treat a static check, fake Core, or user assertion as native automated evidence.

## 8. Remove registration and prove retained data

After the completed Codex session and packaged Core process have exited, the journey harness records
the task ID plus a canonical digest of the complete data-directory file set. It sorts data-relative
paths bytewise, writes `<file-sha256><two spaces><data-relative-path>\n` for each file, and hashes the
complete manifest. Then run:

```bash
dev-flow-codex remove --json
codex plugin marketplace list --json
codex plugin list --json
npm uninstall --ignore-scripts --prefix "$CODEX_INSTALL_PREFIX" dev-flow-codex
```

Required results:

- plugin and marketplace readback show the recorded registration is absent;
- the receipt is absent;
- unknown adjacent files are unchanged;
- the Core data-directory file set and canonical digest remain present and unchanged before the subsequent direct read;
- a direct Core test read can retrieve the recorded task after deregistration;
- the disposable repository has no lifecycle-generated file and only the intended substantive source change;
- repeated removal is a no-op rather than a recursive cleanup.

Removal of the npm package is intentionally separate from `dev-flow-codex remove`. Never delete the shared data directory as part of this procedure.

## 9. Review the evidence record

The completed journey writes:

```text
tests/journeys/evidence/codex-macos-arm64.json
```

Validate it against [contracts/journey-evidence.schema.json](./contracts/journey-evidence.schema.json) and review these facts:

- `status` is `pass`, with empty `failures` and `skips`;
- exact Codex/package/Core versions and artifact/fixture digests are present;
- native surface is Codex CLI on macOS arm64;
- at least two Core-confirmed actions and strictly advancing revisions are recorded;
- pre/post-restart task identity is the same;
- observed Core calls do not exceed the recorded scenario budget;
- implicit invocation made zero Core calls;
- setup, resume, terminal outcome, removal, data retention, and task reopen checkpoints passed;
- `unexpected_changed_paths` is empty.

If the exact supported host cannot be run, record a structured blocked/failed observation with the real reason. Do not convert it into a passing native record or broaden the support claim.

## Troubleshooting boundaries

- **Codex version rejected**: use an exact 0.147.x CLI; do not bypass the range check for final evidence.
- **Plugin visible but unavailable**: start a new Codex session and capture the exact role/policy observation if it remains unavailable.
- **Runtime missing/not executable**: rebuild the final tarball; do not fall back to a separately installed Core.
- **Unexpected stdout before MCP initialization**: fail the launcher/package test; stdout belongs exclusively to Core protocol traffic.
- **Registration conflicts**: preserve both the receipt and observed Codex state and follow the bounded diagnostic; do not overwrite config/cache manually.
- **Uncertain mutation**: read Core task and next-action state before considering retry.
- **Unsupported OS/architecture or host surface**: stop and record the boundary; Feature 003 supplies no support claim there.
