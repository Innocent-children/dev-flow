# Contract: Codex Product Plugin 0.1

## Purpose

This contract defines the locally packed Codex product boundary and its explicit setup/removal interface. It does not redefine Core MCP inputs, results, workflow states, transitions, repository claims, recovery classifications, or terminal outcomes. Those remain owned by Core Contract 0.1 in `specs/002-govern-and-resume-single-repository-task/contracts/`.

## Supported surface

| Property | Contract |
|---|---|
| Product | `dev-flow-codex` |
| Artifact | one private local npm `.tgz` |
| Host | Codex CLI |
| Codex compatibility | `>=0.147.0 <0.148.0` |
| Native evidence | macOS arm64 only |
| Publication | prohibited in Feature 003 |
| Plugin count | exactly one |
| User-facing Skill count | exactly one, named `dev-flow` |
| MCP server count | exactly one, local STDIO |
| Core MCP tool count | exactly six |

The exact Codex patch version, artifact digest, and Core version are recorded by the final journey rather than inferred from this table.

## Packed artifact layout

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

No Core source, repository `.git` data, shared fixture copy, test fake, evidence file, or second platform runtime is present in the tarball. Package construction uses an explicit allowlist and rejects unexpected paths.

## Manifest and marketplace invariants

- `package.json.name` is `dev-flow-codex`, `private` is `true`, and its version equals root `VERSION` and the embedded Core version.
- `package.json` exposes one executable named `dev-flow-codex` and defines no state-changing npm lifecycle hook, including `preinstall`, `install`, `postinstall`, or `prepare`.
- `.agents/plugins/marketplace.json` names one local marketplace, `dev-flow-local`, and contains exactly one entry whose source is the in-root `./plugin` path.
- `plugin/.codex-plugin/plugin.json` names `dev-flow-codex`, uses the product version, and points only to the bundled Skill and MCP resources required by the current official Codex format.
- `plugin/.mcp.json` configures one STDIO server whose argv is exactly `dev-flow-codex mcp`. It adds no shell, network, Git, or filesystem MCP server.
- `plugin/skills/dev-flow/SKILL.md` is the only user-facing Skill and conforms to [dev-flow-skill.md](./dev-flow-skill.md).
- Fields whose names or optional status vary with Codex releases are revalidated against the exact 0.147.x build during implementation; they are not invented as compatibility aliases.

## Product executable

The executable accepts only these production subcommands:

| Command | Purpose | Stdout contract |
|---|---|---|
| `dev-flow-codex setup [--json]` | Validate and explicitly register this artifact | Human result or one JSON result object |
| `dev-flow-codex remove [--json]` | Explicitly remove the recorded registration | Human result or one JSON result object |
| `dev-flow-codex mcp` | Start the packaged Core as the plugin's STDIO server | Reserved entirely for Core MCP protocol output |
| `dev-flow-codex --version` | Report package and embedded Core identity | One stable version line |

Unknown flags/subcommands fail without modifying Codex state, product data, or the current repository. Diagnostics go to stderr. A nonzero exit indicates failure; setup/removal never report success before readback.

`mcp` resolves `runtime/darwin-arm64/dev-flow` relative to the installed package and checks that it is executable. A nonempty explicit `DEV_FLOW_DATA_DIR` must be absolute, is canonicalized, and must already be a directory; the launcher does not create an arbitrary override. Without an override, it creates only the exact `~/Library/Application Support/dev-flow/data` default with restrictive permissions when absent. It then launches `dev-flow mcp --stdio` with inherited stdin/stdout/stderr. The Node process does not open the SQLite database or parse, buffer, rewrite, retry, or log protocol messages to stdout.

## Explicit setup contract

### Preconditions

Setup validates all preconditions before the first external mutation:

1. OS is `darwin` and architecture is `arm64`.
2. `codex --version` is within `>=0.147.0 <0.148.0`.
3. The package, plugin, root build identity, and `dev-flow version` result agree.
4. The package-local Core exists and is executable.
5. The marketplace has one in-root plugin; the plugin has one Skill and one MCP server.
6. `dev-flow-codex` is discoverable in the PATH inherited by the selected Codex CLI.
7. The receipt path and its parents are not symlinks escaping the product user-data root.

Failure reports the exact failed precondition and performs no registration.

### Reconciliation sequence

1. Read and schema-validate the receipt if present.
2. Read Codex marketplace and plugin state through the supported CLI JSON interfaces.
3. If receipt and readback identify the same installed artifact, return an idempotent success without writing.
4. If either source identifies conflicting ownership, fail closed and report both observed identities.
5. Add the artifact's marketplace root through `codex plugin marketplace add` only if absent.
6. Install `dev-flow-codex@dev-flow-local` through the supported plugin command with JSON output.
7. Read both marketplace and plugin state again and require the expected marketplace root plus plugin identity, source, version, installed flag, and enabled flag; Skill/MCP resource presence remains a separately validated package precondition because current plugin JSON readback does not enumerate those resources.
8. Atomically write [registration-receipt.schema.json](./registration-receipt.schema.json) at `~/Library/Application Support/dev-flow/registrations/codex.json` only after successful readback.

If setup creates the marketplace but plugin installation/readback fails, it may remove only that marketplace registration after confirming it was absent before this attempt. It preserves all pre-existing or ambiguous state and prints bounded recovery instructions.

### Success result

Human and JSON modes report at least:

- product and Core version;
- exact Codex CLI version/surface and platform;
- plugin selector and marketplace identity;
- canonical Core data directory;
- canonical receipt path;
- whether setup installed or found an already matching registration.

No success result contains task database contents or repository source.

## Explicit removal contract

Removal proceeds in ownership order:

1. Read and schema-validate the exact receipt.
2. Read current Codex plugin/marketplace state.
3. Fail closed if current state conflicts with the receipt; do not delete or overwrite adjacent resources.
4. Remove the recorded `dev-flow-codex@dev-flow-local` plugin through the supported Codex command if present.
5. Verify plugin absence through readback.
6. Remove only the recorded `dev-flow-local` marketplace registration if it still resolves to the receipt's marketplace root.
7. Verify marketplace absence through readback.
8. Delete only the exact receipt and, optionally, its now-empty product-owned `registrations` directory.

If the receipt directory contains unknown adjacent entries, removal leaves them in place and reports
their canonical paths as preserved without reading or reporting their contents.

The command never deletes:

- the npm package (the user uninstalls it separately after deregistration);
- `DEV_FLOW_DATA_DIR` or `~/Library/Application Support/dev-flow/data`;
- a target repository or any file below it;
- the Codex configuration file or plugin cache directly;
- unknown or user-owned adjacent files.

Repeated removal with no receipt and no matching registration is a no-op success. Interrupted removal resumes by reading both receipt and Codex state before the next mutation.

## Core connection contract

After launch, the actual Go Core owns the MCP connection. Its catalog must be exactly:

- `dev_flow_server_info`
- `dev_flow_open_task`
- `dev_flow_get_task`
- `dev_flow_get_next_action`
- `dev_flow_apply_action`
- `dev_flow_cancel_task`

The Codex product may check or expose this catalog but may not implement, alias, proxy, or augment it. All tool schemas and results are validated against the shared Feature 002 fixtures in place.

## Repository and Git boundary

Setup and removal behave identically regardless of the current working directory. They do not create a repository instruction, plugin file, MCP configuration, receipt, database, log, or temporary file in the current/target repository. Neither lifecycle command runs a Git mutation. The Skill may use ordinary Codex repository tools only after Core returns an action whose allowed effects and user authority permit that work.

## Error and evidence rules

- A malformed Codex JSON response, truncated readback, incompatible version, missing executable, resource mismatch, or ownership conflict is a failure, never a partial success.
- Commands and output used to verify setup/removal are recorded without secrets in the journey evidence.
- A fake Codex executable establishes only simulated lifecycle behavior.
- Native support requires the final artifact to pass [journey-evidence.schema.json](./journey-evidence.schema.json) on the declared host.
