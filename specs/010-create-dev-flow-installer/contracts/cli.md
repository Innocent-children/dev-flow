# Contract: `create-dev-flow` CLI

## Entrypoints

```text
npx create-dev-flow@latest [operation] [options]
npm create dev-flow@latest -- [operation] [options]
```

The package exposes exactly one bin named `create-dev-flow`.

## Operations

```text
status | doctor | install | upgrade | repair | reinstall | uninstall | factory-reset
```

No operation in a real TTY opens an installation-first home screen with exactly Codex, DeepSeek, both, and manage
existing installation. The first three choices create an install request directly. Manage opens the complete
lifecycle operation and Host menus. No operation in a non-TTY is invalid.

## Options

| Option | Value | Applies to |
| --- | --- | --- |
| `--host` | `codex|deepseek|all` | all; required for non-TTY mutations |
| `--profile` | safe name; repeatable | DeepSeek; defaults to `web` |
| `--all-known-profiles` | none | DeepSeek; manager receipt set only |
| `--version` | `latest` or stable semver | install/upgrade/repair/reinstall |
| `--adopt` | none | explicit DeepSeek Profile with matching readback |
| `--reinstall` | none | factory-reset only |
| `--permanent` | none | factory-reset only |
| `--yes` | none | ordinary mutation confirmation |
| `--confirm-reset` | token | reset confirmation |
| `--confirm-permanent` | token | permanent reset confirmation |
| `--confirm-downgrade` | token | explicit downgrade confirmation |
| `--confirm-explicit-data` | canonical absolute path | factory-reset; repeatable |
| `--plain` | none | human plain output |
| `--json` | none | one machine result object |

Unknown, duplicated singleton, conflicting or operation-inapplicable arguments exit 2 before observation-driven
mutation. Profile rejects empty, `.`, `..`, slash, backslash, NUL and path semantics.

## Confirmation

- `status` and `doctor` require no confirmation.
- Ordinary mutations require an interactive yes/no or `--yes`.
- Downgrade requires a downgrade-specific interactive confirmation or `--confirm-downgrade` token.
- Factory reset requires the token emitted from the current plan. `--yes` has no reset authority.
- Permanent reset requires both reset and permanent tokens bound to the same plan.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | desired state verified or idempotent no-change |
| 1 | completed domain/preflight/Host failure with bounded next step |
| 2 | invalid CLI request |
| 3 | confirmation required or declined with zero mutation |
| 4 | ownership/plan conflict with zero force change |
| 5 | partial external effects recorded; resume/repair required |

Signals are forwarded to the active child. Manager records completed boundaries and exits using conventional signal
semantics when possible.

## Output

Rich and plain show the same facts: operation, targets, observed status, planned or completed actions, data policy,
restart requirements and one next step. JSON stdout is exactly one object matching `result.md`; progress and child
diagnostics cannot add stdout records.
