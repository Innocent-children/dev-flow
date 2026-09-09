# DeepSeek artifacts and file-write gate

## Artifact command transport

Implementation: `packages/deepseek/skills/dev-flow/scripts/artifacts.mjs` — `runArtifactCommand`;
`packages/deepseek/lib/runtime.mjs` — `selectPackagedRuntime`;
`packages/deepseek/lib/paths.mjs` — `resolveDataDirectory`;
`cmd/dev-flow/artifacts.go` — `runArtifacts`.

Use the script shipped with this Skill. Its absolute path is derived from the current DSH Skill
resourceBase directory, registered by `activateDeepSeekIntegration` in `packages/deepseek/lib/index.mjs`.
The script resolves this package's Core and the same data directory policy used by the MCP child.
It supports only collect and prepare, forwards raw JSON to the existing Core commands and creates no
store. Use host deepseek in input. It is not a new DSH tool or a dev-flow-deepseek executable.

Example argv after resolving the actual Skill directory:

```text
command: node
arguments: ["<actual Skill directory>/scripts/artifacts.mjs", "collect"]
stdin: {"host":"deepseek","task_id":"<current Task ID>","action_id":"<same current Action ID>"}
```

The complete JSON samples and return types are in [Core artifact preparation](artifact-contract.md).
Use the same fresh identity as the upcoming node submission. Help is read-only and opens no runtime:

```text
command: node
arguments: ["<actual Skill directory>/scripts/artifacts.mjs", "prepare", "--help"]
```

Save complete input/output in private scratch files within permitted Host locations outside the Task's
Git-visible changes. Use process argv and stdin, not a reconstructed shell command string. Success
has exit 0 and {ok:true,result}; Core failures have exit 1 and {ok:false,error}. Helper launch/input
failures use stderr and a nonzero code; invalid operation arguments exit 2. They are not MCP recovery
envelopes. An inaccessible helper/runtime/data path stops submission; no manual guessed manifest or
second MCP server substitutes for it. Observe current DSH authorization and Workspace Root throughout.

## Collect and prepare

Follow the shared [collection/classification/preparation procedure](artifact-contract.md). Keep every
observed entry and edit only slot/summary; use the prepared result directly as artifacts. This covers
confirmed carried contents using full Task current_changed_paths, separately from current Action delta.

## Content after implementation

Use the shared [content timing rule](artifact-contract.md#content-after-implementation): process files
also affect Core content digests. Finish appropriate file writes before final verification; afterward
reconcile read-only or return through a current legal remediation edge and re-establish verification.

## Confirmed carried content

Use [shared preservation planning](artifact-contract.md#confirmed-carried-content) with the snapshot
retained by `createWorkspaceCoordinator` in `packages/deepseek/lib/workspace-coordinator.mjs`.

## Verification

Follow the shared [verification plan, budget and actual results](verification.md). A comprehension
answer or other Core mutation in a new DSH user turn must include the current /dev-flow selector.

## DSH file-write gate

Implementation: `packages/deepseek/lib/file-scope.mjs` — `registerFileScopeGate`, `preparedWrite`;
`packages/deepseek/lib/authorization.mjs` — `deriveCurrentTurn`.

For a turn with the selector, the tools/pre-execute gate covers write, edit and str_replace_editor.
The view command is read-only and passes through. It uses file_path for write/edit and path for
str_replace_editor, resolves against the current Workspace Root and hashes the exact normalized
arguments. Example supported call:

<!-- example:dsh-write edit sample -->
```json
{"name":"edit","arguments":{"file_path":"src/endpoint.js","old_string":"oldValue","new_string":"newValue"}}
```

The gate constructs this Core host-check shape from that actual call:

```json
{"host":"deepseek","repository_path":"/work/tasks/project/src","tool_name":"edit","paths":["/work/tasks/project/src/endpoint.js"],"intent_digest":"<computed digest>","path_parse_complete":true}
```

Core returns allow/deny. Allowed writes continue to the original DSH tool. A denial becomes
{kind:"deny",reason:"<actual Core reason>"}; unavailable/invalid checks also deny the write. Follow the
shared [file-scope blocker inputs](tool-results.md#resolve-blockers) after the actual user choice.
The same prepared write intent may be allowed once; a different patch cannot reuse that permission.
This gate does not cover Bash, unrelated tools or turns without the selector; do not describe it as a
filesystem sandbox. Later Core observation still checks Git-visible changes.
