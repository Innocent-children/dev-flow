# Data Model: Close the Open-Task Contract

This feature changes no persisted entity. It documents the existing admission value objects exposed to hosts.

## OpenTaskInput

| Field | Type | Required | Rules |
|---|---|---:|---|
| `host` | enum | yes | `codex` or `deepseek` |
| `repository_path` | string | yes | 1–4096 bytes in the public schema |
| `new_task` | NewTask or null | no | omitted/null resumes; object creates or matches |

## NewTask

| Field | Type | Required | Rules |
|---|---|---:|---|
| `goal` | string | yes | non-empty, maximum 8192 bytes |
| `scope` | string array | yes | maximum 64 members, 1024 bytes each |
| `out_of_scope` | string array | yes | maximum 64 members, 1024 bytes each |
| `acceptance_criteria` | string array | yes | 1–64 members, 2048 bytes each |
| `verification_budget` | VerificationBudget | yes | closed object |

Unknown and duplicate members are invalid. Existing Core normalization and aggregate validation remain authoritative.

## VerificationBudget

| Field | Type | Required | Rules |
|---|---|---:|---|
| `level` | enum | yes | `minimal`, `targeted`, or `full` |
| `max_automatic_commands` | integer | yes | 0–20 |
| `allow_full_suite` | boolean | yes | exact boolean |
| `allow_manual_handoff` | boolean | yes | exact boolean |

## State Transitions

There are no new transitions. A valid new task enters the existing `INTAKE` phase; an omitted/null new task follows existing resume selection; an invalid request creates no task state.
