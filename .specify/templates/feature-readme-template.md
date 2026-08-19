# [FEATURE NAME]

## Status

- **Feature**: `[###-feature-name]`
- **Status**: [Draft | Clarifying | Planned | Ready | Implementing | Blocked | Complete | Deferred |
  Superseded | Historical]
- **Change Type**: [Governance | Product Feature | Corrective Change | Release Change]
- **Created**: [DATE]
- **Baseline**: [branch/commit/contract]
- **Release Authority**: [Not authorized | Exact release scope]

## Purpose

[Two or three sentences describing the capability and why this Feature exists.]

## Authority

Read in this order:

1. [Constitution link]
2. [Workflow standard link]
3. [`spec.md`](spec.md)
4. [`plan.md`](plan.md)
5. [`contracts/`](contracts/)
6. [`tasks.md`](tasks.md)

## Scope

- [In-scope behavior]
- [In-scope persistence transition, including explicit incompatibility/reset when applicable]
- [In-scope host surface]

## Non-Goals

- [Explicit exclusion]
- [Explicit release/platform/future abstraction exclusion]

## Dependencies and Persistence Boundary

[Predecessors, public contract baseline, persisted-data route, and deferred products.]

## Activation

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/[###-feature-name]"
```

## Workflow Gate

Before implementation:

1. run or review `$speckit-clarify`;
2. complete `checklists/requirements.md`;
3. run `$speckit-analyze`;
4. resolve all blocking findings;
5. update status to `Ready`.

Do not regenerate the prepared package without an explicit amendment decision.

## Checkpoints

| Checkpoint | Exit Condition | Status |
| --- | --- | --- |
| Contract freeze | [condition] | [pending/complete] |
| Foundation | [condition] | [pending/complete] |
| User Story 1 | [condition] | [pending/complete] |
| Final feature gate | [condition] | [pending/complete] |

## Release Boundary

[State whether version, npm, Tag, GitHub Release, and final distributed-artifact journey are
forbidden or explicitly authorized.]
