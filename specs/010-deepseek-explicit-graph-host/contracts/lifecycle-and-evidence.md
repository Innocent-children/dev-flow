# Contract: Runtime, Lifecycle, and Evidence

## Runtime Selection

Initial supported tuple:

```text
operating system: darwin
architecture: arm64
runtime path: runtime/darwin-arm64/dev-flow
```

The path is resolved from the installed package. The product does not use:

- repository-relative Core source;
- `PATH` lookup;
- install-time compilation;
- first-use download;
- network fallback;
- another product's runtime.

Before MCP composition, verify the binary exists, is a regular executable file, and reports the
expected product version.

## Data Directory

Resolution order:

1. valid explicit `DEV_FLOW_DATA_DIR`;
2. shared default `~/Library/Application Support/dev-flow/data`.

Rules:

- final path is absolute and canonical under the package's path policy;
- default may be created recursively with restrictive permissions;
- explicit path must already exist as an absolute canonical non-symlink directory; the adapter never
  creates an explicit path;
- Core receives the exact selected path;
- no package lifecycle action deletes or migrates the path.

## MCP Child Configuration

```text
transport: stdio
serverName: dev_flow
command: absolute packaged Core
args: mcp --stdio
env.DEV_FLOW_DATA_DIR: selected data path
cwd: stable absolute directory
toolCallTimeoutMs: 60000
failOnStartupError: false
reconnect.enabled: true
reconnect.initialDelayMs: 500
reconnect.maxDelayMs: 30000
reconnect.maxAttempts: 10
```

No shell interpolation is used. No listener or outbound network request is opened by the product.

## Startup and Reconnect

- successful initial connection publishes exactly six guarded tools;
- failed initial connection leaves unrelated DSH usable and enters bounded reconnect;
- tools are absent/unavailable while disconnected;
- reconnect republishes the same exact names;
- a changed/missing/extra catalog fails compatibility;
- reconnect does not replay any Core operation;
- the Skill reports Core unavailable rather than manufacturing state.

## Official Profile Lifecycle

### Add

1. DSH process stopped.
2. Official `dsh plugin --profile ... add <spec>` succeeds.
3. DSH process restarted.
4. Resolved profile contains one bundle.
5. Runtime contributions pass readback.

### Remove

1. DSH process stopped.
2. Official `dsh plugin --profile ... remove dev-flow-deepseek` runs.
3. DSH process restarted.
4. Bundle, Skill, guard, MCP connection, and namespace are absent.
5. Shared data and Codex ownership are unchanged.

### Reinstall

1. Add the exact previously accepted tarball.
2. Restart.
3. Re-establish exact contributions.
4. Open the same data directory.
5. Re-read the same compatible task lineage.

## Codex Non-Interference

Before and after DeepSeek lifecycle, record bounded identities for:

- Codex package manifest/version;
- Codex Skill tree digest;
- Codex MCP registration/readback;
- Codex packaged runtime digest;
- shared data directory contents needed for task identity.

DeepSeek add/remove may change none of the Codex-owned identities.

Do not record credentials or full user configuration.

## Acceptance Identities

Product Source Identity covers:

- root `LICENSE`;
- `packages/deepseek/package.json`;
- `packages/deepseek/README.md`;
- `packages/deepseek/cordis.patch.yml`;
- `packages/deepseek/lib/`;
- `packages/deepseek/skills/`;
- `packages/deepseek/runtime/`.

Acceptance Harness Identity covers the native Runner, Evidence validation, Feature documents, and
the exact acceptance commit. A Harness-only change does not require rebuilding byte-identical
Product Source.

## Repeatable Non-Model Preflight

Each invocation creates a fresh Runner-owned temporary root. Preflight calls no model, creates no
business Task, mutates no target repository, and does not consume the native Journey budget.

Preflight verifies:

- darwin arm64 plus required Node and pnpm major versions;
- one external consumer installation whose manifest name/version/bin, CLI realpath/version, and
  lockfile package block/integrity identify `@deepseek-ai/dsh@0.1.0-rc.8`;
- retained Artifact and embedded Core digests, Core executable mode, and reported version;
- Product Source and Acceptance commit identities;
- initialized `headless` Profile manifest bundles equal
  `@deepseek-ai/dsh-base` and `@deepseek-ai/dsh-headless`;
- Headless one-shot `--help` exits successfully;
- zero Session, zero Core Task, and no installed Dev Flow Artifact before native execution.

Isolation checks cover only Runner-owned business paths. Runtime caches under the temporary root do
not fail Preflight.

## Acceptance Evidence

Required fields:

```text
product source commit
acceptance commit
package filename, size, sha256
embedded Core sha256 and reported version
DSH package version and integrity
Node and pnpm versions
OS and architecture
task ID, initial/resumed/terminal revisions, and terminal state
ordinary dispatch, selector guard, six-tool, restart/resume, read-before-retry,
comprehension/refactor/retest, terminal, lifecycle, retention, and read-only reopen outcomes
publication effects
```

## Evidence Classes

- `static_contract`
- `deterministic_integration`
- `official_profile_lifecycle`
- `native_deepseek_graph_journey`

No lower class may be described as a higher class.

## Sanitization

Never retain:

- prompt text;
- model reasoning;
- API keys, tokens, cookies, credentials;
- complete environment;
- absolute home/profile/database paths;
- raw SQLite database;
- unbounded stdout/stderr;
- unrelated repository content;
- user identity.

Paths are reduced to package-relative names or hashes. Errors retain stable class/code and bounded
message only.

## Native Acceptance Policy

- Current success is written to `native-acceptance.json`.
- Current failure is written to `native-acceptance-failed.json`.
- Historical Attempt 1–3 files remain retained history and are outside current Runner control.
- The Journey uses one ordinary control Turn and at most six `/dev-flow` Turns with one shared bounded
  timeout.
- Checkpoints verify stable Task identity, monotonic revision, progress after mutation checkpoints,
  read-only recovery ordering, required graph outcomes, and final Core `DONE`.
- One official remove/reinstall lifecycle uses the same Artifact.
- A native failure writes sanitized failure evidence and ends the current run without automatic
  retry.
- Product Source changes invalidate the Artifact; Harness-only changes retain a matching Artifact.

## Release Exclusion

Evidence proves local Feature acceptance only. It authorizes no registry publication, Tag, GitHub
Release, public support matrix entry, or official URL.
