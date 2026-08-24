# Dev Flow Roadmap

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

Dev Flow advances through user value and verifiable outcomes. Dates are not commitments. Every
product capability requires an independent specification, explicit boundaries, and reproducible
evidence.

## Current: a reliable local development graph

Delivered capabilities:

- `standard-development` with Go Core as the sole process authority;
- eight working nodes, `DONE`, two exceptional nodes, and 29 controlled transitions;
- requirements/design/task-plan baselines and downstream authority invalidation;
- the `TEST → COMPREHENSION_REVIEW → REFACTOR → TEST` maintainability loop;
- `plain`, `spec-kit`, and `openspec` method profiles;
- six-tool local STDIO MCP with closed payloads;
- local SQLite, revision CAS, restart/resume, and retained terminal data;
- five-class Recovery, read-before-retry, and Core-owned blocker/resume;
- bounded read-only Git observation;
- an immutable Repository Scope with one primary and up to seven explicit additional repositories,
  all sharing one Task authority;
- host-specific optional code-index preferences from fixed read-only user configuration, with
  built-in search fallback when the index is unavailable;
- Codex setup configuration creation, exact configuration/receipt change summaries, and a
  degradable Simplified Chinese or English installation screen;
- explicit Codex and DeepSeek Host Adapters.

## Current public products

| Product | Version | Status |
| --- | --- | --- |
| Core | `0.5.1` | Independent bundled runtime in both Host packages |
| Codex | `0.5.3` | npm and `codex-v0.5.3` published; macOS arm64 registry lifecycle passed |
| DeepSeek | `0.5.2` | npm and `deepseek-v0.5.2` published; macOS arm64 native registry journey passed |

See the [Support Matrix](SUPPORT-MATRIX_en.md) for exact supported Host versions, artifact digests,
and evidence entrypoints.

## Next: lower the cost of daily use

These directions improve visibility and diagnosis around the current graph:

- a read-only doctor for installation, Core handshake, data directory, and Task state;
- a concise Task inspection view for current node, blocker, remaining verification budget, and
  available transitions;
- direct recovery guidance that turns the five-class assessment into short, actionable instructions;
- artifacts for additional platforms after independent final-artifact evidence is complete.

Each capability preserves one Core authority, read-only Git, and read-before-retry.

## Later candidate: controlled collaboration

After real cross-host use establishes value, Dev Flow may evaluate:

- user-authorized Codex ↔ DeepSeek handoff;
- a verifiable Task export reference or handoff receipt;
- a read-only shared view for team review;
- more granular but still bounded verification budgets.

Cross-host behavior must retain a single Task authority and cannot introduce an Adapter-owned
process cursor.

## Research directions

Longer-term research includes:

- reproducible artifacts for additional OS/CPU combinations;
- supply-chain signing, notarization, and transparency evidence;
- measuring the effect of the comprehension gate in real projects;
- improving the built-in graph while keeping it direct and bounded.

## Continuing boundary

The current roadmap does not include user-defined graphs, a workflow DSL, Web UI, remote MCP,
generic shell, Core Git mutation, automatic discovery or dynamic expansion of Repository Scope,
automatic multi-repository orchestration, repository-level process state, or automatic historical
Task migration. A proposal that changes these boundaries requires an independent product
specification and Constitution review.
