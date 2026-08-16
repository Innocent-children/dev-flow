# Research: Codex Explicit Dev Flow

## Outcome

Feature 003 uses Core Contract 0.1, a private Codex package, the exact installed Skill selector
`$dev-flow-codex:dev-flow`, and one direct STDIO MCP server. Verification is deliberately limited
to product contracts, three Codex 0.147 terminal event shapes, repeatable smoke, and one final
pre-merge acceptance journey.

## Decision 1 — Reuse Core Contract 0.1

The existing six tools and complete structured result envelope are authoritative. Codex-specific
code forwards calls and follows fresh Core results; it does not copy domain state or workflow rules.

## Decision 2 — Use the Codex 0.147 plugin/Skill surface

The implementation baseline was reconciled against official Codex 0.147 package, plugin, Skill, and
non-interactive JSONL behavior. The installed Skill identity is the plugin namespace plus base Skill
name:

```text
plugin: dev-flow-codex
skill base: dev-flow
explicit selector: $dev-flow-codex:dev-flow
```

Bare `$dev-flow`, a wrong namespace/base, and missing/implicit selection do not load the installed
Skill.

## Decision 3 — Package one private artifact

The package remains private and contains the marketplace metadata, launcher/lifecycle/path helpers,
plugin/Skill/MCP resources, and one compatible Core runtime. No install hook mutates host or
repository state.

## Decision 4 — Keep setup and removal receipt-owned

Setup is explicit and reports success only after readback. Removal uses the receipt as its ownership
boundary and preserves task data and repository content.

## Decision 5 — Verify three real host terminal shapes

Codex 0.147 non-interactive output and source establish these terminal MCP item forms:

1. completed call with a complete result;
2. failed call with a complete Core error result;
3. failed call with no complete result and a typed host transport error.

The checked-in fixtures are sanitized equivalents of those shapes. Tests do not invent alternate
selector or status semantics.

## Decision 6 — Separate Core-loop proof from host-shape proof

The fake Core owns deterministic create/apply/restart/resume/DONE and read-before-retry scenarios.
The JSONL parser owns only Codex event shape. Native smoke owns process wiring and repeatability.
Duplicating the entire workflow in each layer created thousands of lines without additional product
confidence.

## Decision 7 — Make development smoke repeatable

Development smoke does not use a permanent attempt ledger, frozen-chain identity, canonical
evidence path, or create-no-replace publication. A failure can be inspected and the smoke can be
rerun after correction. Output is an ephemeral observation, never a release/support claim.

## Decision 8 — Defer release provenance

Immutable attempt consumption, pass-lock, multi-report digest chains, crash transactions, diagnostic
version compatibility, fsync/inode/TOCTOU gates, large-stream digest matrices, and release-grade
provenance solve a future publication problem. They are not necessary to establish the first Codex
product journey and are deferred to a dedicated release/supply-chain feature.

## Decision 9 — Close the four native HIGH cases minimally

The simplification preserved one follow-up test for each native HIGH:

- diagnostic precedence;
- Core envelope closure;
- failed-event/recovery binding;
- aggregate/session MCP fact parity.

T074–T077 subsequently closed those cases with one minimum regression each. Their tests remain
required; the separate final acceptance journey is now the only unmet Feature 003 acceptance gate.

## Decision 10 — Accept Codex 0.147 MCP visibility and verify effects

`policy.allow_implicit_invocation: false` controls Skill injection only. Codex 0.147 registers a
plugin's MCP server independently, so its tools remain visible without exact Skill activation.
Feature 003 therefore verifies negative sessions by outcome and state isolation: ordinary remains
zero-call, while bare/wrong/missing selectors must not activate the Skill, complete a task-bearing
operation, change task/event/claim state, or change the target repository. Host-exposed read-only
and Core-rejected calls remain visible in acceptance observations. This is presentation hardening,
not selector-bound authorization, and Feature 003 does not wait for an unavailable Host capability.

## Official Source Basis

The fixture shapes and selector semantics were confirmed against the official Codex 0.147 source
and non-interactive JSONL documentation during implementation. This checkpoint does not perform a
new network/version revalidation and does not claim a newer host.

## Gate

The selected design adds no product abstraction, no schema version, and no public contract. It
reduces Feature 003 verification to requirements that directly establish package, lifecycle,
explicit invocation, Core governance, parser fidelity, removal retention, repeatable smoke, and
final acceptance.
