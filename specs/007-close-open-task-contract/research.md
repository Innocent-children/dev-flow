# Research: Close the Open-Task Contract

## Decision 1: Preserve validation semantics

- **Decision**: Keep `decodeOpenTaskInput`, `decodeNewTaskInput`, domain limits, and public error envelopes unchanged.
- **Rationale**: Core already correctly rejects the observed malformed values. The failure is contract discoverability at the host boundary, not missing validation.
- **Alternatives considered**: Accept `focused` as an alias or coerce strings into lists. Rejected because both weaken the closed Core contract and introduce ambiguous semantics.

## Decision 2: Inline the open-task-only nested schema

- **Decision**: Publish the complete `newTask` and `verificationBudget` shapes directly in the open-task property branch while retaining structurally equal `$defs` compatibility copies.
- **Rationale**: The raw schema currently hides the shapes behind local references, while the observed Codex tool projection reports `new_task` as unconstrained. The shared definition bundle is embedded in every tool schema, so deleting entries would alter unrelated public schema identities. Equality tests keep the inline and compatibility copies under one reviewed contract.
- **Alternatives considered**: Add a host-side schema resolver, retain the current schema and update only prose, or delete the shared definitions. Rejected respectively as a new abstraction, incomplete prevention, and an unrelated public-contract change.

## Decision 3: Add exact packaged guidance

- **Decision**: State the list field types and exact verification enum in the Codex Skill and include one valid request example.
- **Rationale**: The Skill already owns admission/invocation guidance and can prevent reconstruction mistakes without owning workflow truth.
- **Alternatives considered**: Add local request normalization or retry logic. Rejected because adapters must remain thin and Core domain rejection is authoritative.

## Decision 4: Use focused parity evidence

- **Decision**: Extend existing MCP and package-contract tests rather than add an end-to-end real-host suite.
- **Rationale**: The bug is deterministic schema/guidance drift. Existing shared contract fixtures can prove both host values and non-mutation, while a real-host journey would exceed the evidence needed for this slice.
- **Alternatives considered**: Full repository validation or public-package release journey. Deferred to the feature checkpoint/release process.
