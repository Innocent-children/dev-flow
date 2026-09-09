# Codex artifacts and Hook

## Artifact command transport

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runCLI`.
Implementation: `cmd/dev-flow/artifacts.go` — `runArtifacts`.

Before every ordinary Action submission use the packaged read-only artifact helper. It reads the
existing Task store and observes Git; it creates no Task, operation, blocker or workflow cursor.
Both commands receive one closed UTF-8 JSON object on stdin (at most 1 MiB), write `{ok:true,result}`
or `{ok:false,error}` on stdout, and exit 0/1. This differs from the direct Host-launch result.

```sh
dev-flow-codex artifacts --help
dev-flow-codex artifacts collect --help
dev-flow-codex artifacts prepare --help
dev-flow-codex artifacts collect < /private/tmp/collect-input.json > /private/tmp/collect-output.json
```

Save complete inputs/results privately outside all Task worktrees. Parse the original output file,
not a shortened display. Help reads no stdin and opens no runtime. Missing commands are reported as
unavailable; hand-written file lists cannot replace Core collection.

## PreToolUse Hook

Implementation: `packages/codex/plugin/hooks/pre-tool-use.mjs` — `preparedWriteFromHook, runHook, hookDecision`.
Implementation: `cmd/dev-flow/main.go` — `runPreFileWriteCheck`.

The installed `hooks/hooks.json` matches apply_patch and invokes `dev-flow-codex hook pre-tool-use`.
The Hook must be trusted/enabled in the actual Host. It handles the Host event, rather than asking
Codex to manufacture a separate write-intent call. Example incoming event:

<!-- example:hook pre-tool-use patch -->
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "apply_patch",
  "cwd": "/work/tasks/endpoint-field",
  "tool_input": {
    "command": "*** Begin Patch\n*** Add File: src/extra.js\n+export const extra = true;\n*** End Patch"
  }
}
```

The Hook resolves absolute paths, hashes the exact prepared tool input and calls the package-owned
`dev-flow-codex host-check pre-file-write` entry with this shape:

<!-- example:host-check pre-file-write intent -->
```json
{
  "host": "codex",
  "repository_path": "/work/tasks/endpoint-field",
  "tool_name": "apply_patch",
  "paths": [
    "/work/tasks/endpoint-field/src/extra.js"
  ],
  "intent_digest": "ad6f5248878d29da25a128d0c9b812537c284b08d7ab28fef86f20b22046b6c9",
  "path_parse_complete": true
}
```

Core compares paths with the active Task Plan and returns allow/deny. Allowed writes produce no Hook
JSON output. A denial is translated to this Host message shape:

<!-- example:hook-output pre-tool-use deny -->
```json
{
  "systemMessage": "The write includes a path outside the Task Plan.",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "The write includes a path outside the Task Plan."
  }
}
```

Stop and follow [file-scope blocker resolution](tool-results.md#resolve-blockers), using actual retained
paths and the developer's choice/reason. The same prepared intent may be allowed once; a different
patch needs its own decision. A failed/invalid internal check exits 2 and stops the supported write.
Nonmatching events and a missing default data store are skipped by the Hook. Do not claim interception
when the Hook is disabled/untrusted/unavailable. Host policy stops the supported write in that case.
Bash, external programs and specialized tools are outside this parser; Core can discover their
Git-visible changes later. Additional authorized repositories use repository-qualified paths.


## Collect and prepare

Use the complete [Core collection, classification and preparation examples](artifact-contract.md).
The command transport above produces exactly those inputs and results.

## Content after implementation

Follow the shared [content timing rule](artifact-contract.md#content-after-implementation).

## Confirmed carried content

Use the shared [carried-content planning](artifact-contract.md#confirmed-carried-content) with the
snapshot retained by `prepareTaskLaunch` in `packages/codex/lib/task-launch.mjs`.

## Verification

Follow the shared [verification plan and accounting](verification.md).
