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

## Acceptance Artifact Evidence

Required fields:

```text
repository commit
package filename, size, sha256
package manifest version label
embedded Core size, sha256, reported version
DSH package version and integrity
DSH upstream commit
Node and pnpm versions
OS and architecture
hashed/opaque profile identity
Core schema and limits versions
process ID/version/digest
exact qualified tool list
task ID and revision lineage
restart/resume result
terminal result
removal/reinstall result
Codex non-interference result
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

## Attempt Policy

- attempt 1 remains the immutable historical artifact-mode-loss failure;
- attempt 2 remains the immutable historical recovery-Turn-timeout failure bound to frozen source
  `3747aa0e34c9f0aafa744edcd4abc96523e394b5`;
- Post-Freeze Amendment A1 authorizes one native attempt 3 after a new pushed, Ubuntu-validated source
  freeze and a newly built source-local artifact;
- attempt 3 uses fresh isolated host, profile, data, repository, task, session, artifact-path, and
  evidence identities;
- Post-Freeze Amendment A2 retains attempt 3 as an immutable Profile-composition failure and
  authorizes attempt 4 exactly once after a new pushed, Ubuntu-validated source freeze;
- attempt 4 uses the shipped Profile name `headless` inside fresh isolated `DSH_HOME`, `HOME`, and
  `TMPDIR`; its non-model preflight requires the `@deepseek-ai/dsh-base` and
  `@deepseek-ai/dsh-headless` manifest layers plus exact `headless-startup` and `headless-runner`
  composition before Artifact installation;
- the preflight runs Headless `--help` with zero Session and Core Task creation and does not consume
  attempt 4;
- attempt 4 has no automatic retry, and attempt 5 is not authorized;
- one official lifecycle against the same artifact;
- no silent replacement of a failed record;
- a failure blocks completion until classified and the source or contract is amended;
- a source change invalidates the artifact and requires a newly identified gate;
- a passed native gate is not rerun merely for confidence.

## Release Exclusion

Evidence proves local Feature acceptance only. It authorizes no registry publication, Tag, GitHub
Release, public support matrix entry, or official URL.
