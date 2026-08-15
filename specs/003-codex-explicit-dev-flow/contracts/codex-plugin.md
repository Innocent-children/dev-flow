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
| Compatibility | A minimum version and bounded range selected from the then-current official stable Codex contract during implementation |
| Planning baseline | Codex CLI `0.147.x`; research history only, not a permanent runtime/schema constant |
| Native evidence | macOS arm64 only |
| Publication | Prohibited in Feature 003 |
| Plugin count | Exactly one |
| User-facing Skill count | Exactly one, named `dev-flow` |
| MCP server count | Exactly one, local STDIO |
| Core MCP tool count | Exactly six |
| Real-host journey count | Exactly one, after deterministic/root validation and final artifact creation |

The exact compatible range, Codex version, artifact digest, frozen source commit, and Core version
are recorded by final evidence.

## Compatibility Revalidation

Before final deterministic validation, implementation must revalidate official Codex plugin, Skill,
MCP, marketplace, setup/readback, and removal behavior. When the selected compatible range differs
from planning, update together:

- this contract;
- `research.md` and `plan.md`;
- both Feature 003 JSON Schemas;
- `data-model.md`, `quickstart.md`, and `tasks.md`;
- package, lifecycle, Skill, and evidence-validator tests.

Setup verifies that the installed Codex version satisfies the selected range. The registration
receipt and journey evidence store the range as data rather than hard-coding a planning-time minor
line in JSON Schema. Range membership is enforced by implementation/semantic tests.

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
│           └── SKILL.md
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
- The plugin contains exactly one Skill and one MCP resource using the implementation-time official
  format.
- The MCP resource invokes exactly `dev-flow-codex mcp`.
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
5. one marketplace, one plugin, one Skill, and one MCP server are present;
6. `dev-flow-codex` is discoverable by the Codex process;
7. receipt parents do not escape the product user-data root through symlinks.

Failure performs no registration.

### Reconciliation

1. Read and schema-validate the receipt when present.
2. Read marketplace/plugin state through supported Codex JSON commands.
3. Return idempotent success only when receipt and readback match.
4. Fail closed on conflicting ownership or malformed/incomplete readback.
5. Add the marketplace only when absent.
6. Install the product plugin through the supported command.
7. Read marketplace/plugin state again and require expected root, identity, source, version,
   installed state, and enabled state.
8. Atomically write the receipt only after successful readback.

Rollback removes only a marketplace created by this attempt and only after confirming it did not
pre-exist. Adjacent/ambiguous state is preserved.

## Explicit Removal

1. Read and schema-validate the exact receipt.
2. Read current marketplace/plugin state.
3. Fail closed on conflict.
4. Remove the matching plugin through the supported command.
5. Verify plugin absence.
6. Remove the matching marketplace only when it still resolves to the receipt root.
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
pass, one frozen-source artifact is built and used for exactly one real Codex journey covering
setup, explicit activation, task execution, restart/resume, `DONE`, removal, retained data, and
compatible reinstall.

`journey-evidence.schema.json` validates structure. The planned semantic validator separately
checks range membership, version/source/artifact identity, strict revisions, task-ID equality, call
budget, `DONE`, data/repository digest equality, lifecycle booleans, and prior root validation.
Failed/blocked evidence records may contain only observations actually reached.
