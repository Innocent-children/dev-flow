# Contract: Codex Product Plugin 0.1

## Purpose

This contract defines the locally packed Codex product boundary and its explicit setup/removal
interface. It does not redefine Core MCP inputs, results, workflow states, transitions, repository
claims, recovery classifications, verification budgets, or terminal outcomes. Those remain owned
by Core Contract 0.1.

## Supported Surface

| Property | Contract |
|---|---|
| Product | `dev-flow-codex` |
| Artifact | One private local npm `.tgz` |
| Host | Codex CLI |
| Compatibility | Codex CLI `>=0.147.0 <0.148.0`, selected from the official stable contract on 2026-08-15 |
| Exact native version | Codex CLI `0.147.0` |
| Native evidence | macOS arm64 only |
| Publication | Prohibited in Feature 003 |
| Plugin count | Exactly one |
| User-facing Skill count | Exactly one, named `dev-flow` |
| MCP server count | Exactly one, local STDIO |
| Core MCP tool count | Exactly six |
| Passing real-host journey count | Exactly one; only T058 may launch, each immutable chain may launch at most once, and every attempt is counted |

The exact compatible range, Codex version, artifact digest, frozen source commit, and Core version
are recorded by final evidence. The version/range remain implementation evidence rather than a
permanent product-specification constant.

## Compatibility Revalidation

Before final deterministic validation, implementation must revalidate official Codex plugin, Skill,
MCP, marketplace, setup/readback, and removal behavior. When the selected compatible range differs
from planning, update together:

- this contract;
- `research.md` and `plan.md`;
- `registration-receipt.schema.json`;
- `validation-report.schema.json`;
- `artifact-report.schema.json`;
- `native-attempt-diagnostic.schema.json`;
- `native-attempt-ledger.schema.json`;
- `journey-evidence.schema.json`;
- `data-model.md`, `quickstart.md`, and `tasks.md`;
- package, lifecycle, Skill, and evidence-validator tests.

Setup verifies that the installed Codex version satisfies the selected range. The registration
receipt and journey evidence store the range as data rather than hard-coding a planning-time minor
line in JSON Schema. Range membership is enforced by implementation/semantic tests.

The 2026-08-15 revalidation selected exact stable `0.147.0`, retained
`>=0.147.0 <0.148.0`, and fixed three behavior-bearing boundaries: official Skill policy metadata,
the MCP shape accepted by both 0.147 parsers, and official top-level-object/camelCase CLI JSON.

## Packed Artifact Layout

```text
package/
├── package.json
├── README.md
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── bin/
│   └── dev-flow-codex.mjs
├── lib/
│   ├── lifecycle.mjs
│   └── paths.mjs
├── plugin/
│   ├── .codex-plugin/
│   │   └── plugin.json
│   ├── .mcp.json
│   └── skills/
│       └── dev-flow/
│           ├── SKILL.md
│           └── agents/
│               └── openai.yaml
└── runtime/
    └── darwin-arm64/
        └── dev-flow
```

No Core source, repository metadata, shared fixture copy, test fake, evidence record, database,
receipt, second platform runtime, or second host product is present. Package construction uses an
exact allowlist and rejects unexpected paths.

## Manifest and Marketplace Invariants

- `package.json.name` is `dev-flow-codex`, `private` is `true`, and version equals repository
  `VERSION`, plugin version, and embedded Core version.
- One executable named `dev-flow-codex` is exposed.
- No `preinstall`, `install`, `postinstall`, `prepare`, publication, release, or download hook is
  present.
- Production npm dependencies are empty; new Node glue uses the standard library.
- The local marketplace contains exactly one in-root plugin entry.
- The plugin contains exactly one Skill, its official Codex metadata, and one MCP resource using the
  selected 0.147 contract.
- `agents/openai.yaml` contains exactly `policy.allow_implicit_invocation: false`; `SKILL.md`
  frontmatter contains only supported Skill identity/description fields and does not carry that
  policy.
- `.mcp.json` contains Agent Plugins v1 `$schema`, camelCase `mcpServers`, and one typed stdio
  server invoking exactly `dev-flow-codex mcp`. This is accepted by both 0.147 plugin parsers.
- No shell, network, Git, filesystem, proxy, or generic forwarding MCP server is added.
- Volatile official field names are revalidated rather than supported through invented aliases.

## Product Executable

Production commands are limited to:

| Command | Purpose | Stdout contract |
|---|---|---|
| `dev-flow-codex setup [--json]` | Validate and explicitly register this artifact | Human result or one JSON object |
| `dev-flow-codex remove [--json]` | Explicitly remove the recorded registration | Human result or one JSON object |
| `dev-flow-codex mcp` | Start packaged Core over STDIO | Reserved entirely for Core MCP output |
| `dev-flow-codex --version` | Report package/Core identity | One stable version line |

Unknown commands fail without modifying Codex state, task data, or the current repository.
Diagnostics go to stderr.

`mcp` resolves `runtime/darwin-arm64/dev-flow` relative to the installed package. A nonempty
explicit `DEV_FLOW_DATA_DIR` must be absolute, canonical, and already usable. Without an override,
the launcher creates only `~/Library/Application Support/dev-flow/data` with restrictive
permissions when absent. It launches Core in STDIO mode with inherited protocol streams and does not
parse, buffer, project, log, or retry MCP payloads.

## Explicit Setup

### Preconditions

All preconditions are validated before the first mutation:

1. platform is `darwin-arm64`;
2. exact Codex CLI version satisfies the selected compatible range;
3. package/plugin/Core/repository version identity matches;
4. packaged Core exists, is executable, and reports the expected version outside the source tree;
5. one marketplace, one plugin, one Skill, its explicit-only Codex policy, and one MCP server are
   present;
6. `dev-flow-codex` is discoverable by the Codex process;
7. receipt parents do not escape the product user-data root through symlinks.

Failure performs no registration.

### Reconciliation

1. Read and schema-validate the receipt when present.
2. Read marketplace/plugin state through supported Codex JSON commands. Require the exact
   top-level shapes `{marketplaces: [...]}` and `{installed: [...], available: [...]}`; the latter
   has an empty `available` array when `--available` was not requested.
3. Return idempotent success only when receipt and readback match.
4. Fail closed on conflicting ownership or malformed/incomplete readback.
5. Add the marketplace only when absent and validate the camelCase add result
   (`marketplaceName`, `installedRoot`, `alreadyAdded`).
6. Install the product plugin through the supported command and validate the camelCase add result
   (`pluginId`, `name`, `marketplaceName`, `version`, `installedPath`, `authPolicy`). The returned
   cache path is observed but remains Codex-owned and is never deleted directly.
7. Read marketplace/plugin state again and require the owned marketplace's `marketplaceSource`,
   root, and name plus the installed plugin's `pluginId`, source, marketplace source, version,
   install/auth policies, installed state, and enabled state.
8. Atomically write the receipt only after successful readback. Resource digests cover the plugin
   manifest, Skill, Skill metadata policy, and MCP configuration.

Rollback removes only a marketplace created by this attempt and only after confirming it did not
pre-exist. Adjacent/ambiguous state is preserved.

## Explicit Removal

1. Read and schema-validate the exact receipt.
2. Read current marketplace/plugin state.
3. Fail closed on conflict.
4. Remove the matching plugin through the supported command and validate its camelCase result.
5. Verify plugin absence.
6. Remove the matching marketplace only when it still resolves to the receipt root, then validate
   its camelCase result (`marketplaceName`, nullable `installedRoot`).
7. Verify marketplace absence.
8. Delete only the exact receipt and optionally its now-empty product-owned directory.

Unknown adjacent entries are preserved and reported by path without reading their contents.

Removal never deletes:

- the npm package;
- Core data;
- a repository;
- Codex config/cache directly;
- unknown adjacent resources.

Repeated absence is a no-op success. Interrupted removal rereads both receipt and Codex state before
the next mutation.

## Core Connection

The actual Go Core owns the MCP connection and exposes exactly:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

The Codex package may verify this catalog but may not implement, alias, proxy, or augment it.
Schemas and results are validated against shared Feature 002 fixtures in place.

## Repository Boundary

Setup/removal behave identically from any working directory and create no file in the current/target
repository. Neither lifecycle command mutates Git. The Skill may use ordinary Codex repository tools
only after Core returns a live action whose allowed effects and current user authority permit the
work.

## Evidence Rules

User-story implementation uses static/package, fake-Codex, fake-Core, packaged-Core retention, and
fake journey-harness evidence only. Those layers never claim native behavior.

After compatibility revalidation, targeted checks, root validation, and a read-only source audit
pass, one artifact/report is built for an immutable frozen-source/validation/artifact chain. Only
T058 may start Codex and that chain may launch at most once. Exactly one passing attempt must cover
setup, explicit activation, task execution, restart/resume, `DONE`, removal, retained data, and
compatible reinstall. A failed or blocked attempt consumes its chain, remains counted in the
external attempt ledger, cannot establish support, and requires a source correction plus a wholly
new T055–T057 chain before another T058 launch. A source commit already present in the ledger cannot
be retried merely by regenerating report bytes. A passing entry prohibits every later launch.

Pass publication uses the single `evidence-create-before-ledger-finalize-v1` protocol. The runner
uses one stable external ledger path/ID across every chain, reserves the chain under an exclusive
reservation lock before spawn, durably prepares observed facts and exact evidence/final-ledger bytes
after host success, completely validates those exact candidates against unchanged reports/artifact
and observed facts, atomically publishes only passing evidence create-no-replace, and only then
atomically finalizes the ledger. Valid passing evidence is an immediate no-host admission lock. A
crash after evidence publication permits only validation and idempotent installation of the
precomputed ledger bytes; a crash before publication consumes the attempt and can never be recovered
as pass or rerun. Switching to another/empty ledger or racing a concurrent reservation is rejected.
The ledger ID is SHA-256 over a domain separator plus its canonical absolute path; every operation
recomputes it, so copied bytes at a different path cannot preserve the ledger identity.

Admission and reservation both reject a ledger unless attempts are sequential from 1, chain/source
identities are unique, finalized fields match status, no entry follows a pass, and no entry follows
an unresolved final reservation. Every mutation owns a closed lock binding ledger ID, owner token,
PID, creation time, operation, and expected ledger digest; it rechecks that digest under the same
lock immediately before atomic replacement. A stale lock is removed only when its closed identity
is valid and its PID is definitely dead. Live, permission-ambiguous, malformed, or wrong-ledger
locks fail closed.

`validation-report.schema.json` and `artifact-report.schema.json` close the two retained machine
reports. Their exact byte digests, the artifact `built_at`, current chain identity, ledger digest,
and actual attempt count are recorded in `journey-evidence.schema.json`. The planned semantic
candidate validator rereads the unchanged reports and ledger, rejects replacement or digest drift,
requires the exact ordered targeted commands and exact root command once each, exact validation
projection, one source/artifact chain and
`validation.completed_at <= artifact.built_at < evidence.recorded_at`, and separately checks range
membership, durable-facts/final-ledger digest and commit-protocol identity, raw revision
non-regression plus strict adjacent-deduplicated lineage,
task-ID equality, four unique thread IDs, raw revision monotonicity, ordered restart recovery reads,
complete Core-derived verification budget and official command facts reconciled to Core evidence,
Core `DONE`, exact setup/reinstall registry cardinality, a non-secret retained-data descriptor,
data/repository digest equality, lifecycle booleans, and prior root validation. It also requires the
compatibility query to precede every validation observation. Direct Core reopen rejects non-JSON,
unknown/duplicate response IDs, and bounded-output violations. The bound public validator runs all
four closed schemas and complete pass semantics; recovery additionally validates the precomputed
exact bytes/identities. The canonical repository path and journey-evidence schema contain only the
unique passing record. Failed/blocked diagnostics conform to the independent closed
`native-attempt-diagnostic.schema.json`, may contain only observations actually reached, remain
outside the repository, and are invalidated with their chain while their ledger entries are
retained. Any post-publication integrity failure is terminal blocked recovery and cannot authorize
another host launch.

Deterministic T054 coverage runs the production default install/setup/readback/four-session/
remove/direct-reopen/reinstall/cleanup helpers against fake npm, Codex 0.147 JSONL, and Core child
processes. It does not replace the whole orchestration with injected callbacks, start a real Codex
host, build the final artifact, or write canonical evidence. Concurrent setup treats
`alreadyAdded=true` as unowned state and never rolls it back. Setup and reinstall accept only a
top-level object containing exactly one owned marketplace, one installed owned plugin, and zero
available plugins.
