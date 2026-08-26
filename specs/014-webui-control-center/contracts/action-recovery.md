# Action and Recovery Contract

## Current Action

The current Action read returns one identity-bound model containing:

- Task revision, Action ID/kind, process ID/digest, source node and repository binding digest;
- purpose, conditions, allowed effects, required Evidence and method steps;
- legal transitions;
- exact payload schema for the current Action.

Workflow owns the payload schema used by Core validation. MCP applies its existing Host projection; WebUI uses the exact
current schema to build the form. A Task revision change invalidates the browser model.

## Submit

Action submission requires request ID, the complete current identity, payload and local-session protection. It cannot
provide a destination, next node, Guard result, Recovery class or repository facts. Core validates and derives the result.

## Error and correction

A zero-write field or Guard error returns:

- stable error code and safe message;
- field paths and rule details that may be shown to the user;
- Core-provided correction or recovery action;
- whether submitting a corrected current Action is safe.

The user may correct the current form while its identity remains current. WebUI does not impose an additional retry count.

## Uncertain mutation and Recovery

WebUI retains only the original operation reference and payload required by Core in page memory and calls existing Core
Recovery assessment before another write. The Recovery request uses the current page-session protection once; it does not
retain or resend the original request's browser-session credential. WebUI performs only the action returned by Core,
including retrying the current Action, applying recovery, reading the next Action, resolving a Blocker or stopping for
repository drift.

If the page no longer has the original operation reference, the user must return to the current Task state and cannot
fabricate a recovery request.

## Blocker

A `BLOCKED` Task exposes only the current blocker-resolution contract. A successful submission uses the resume node
returned by Core.

## Parity

- MCP keeps six tools and existing wire requests.
- One table-driven Workflow contract suite covers every Action kind once against Core validation and both projections.
- HTTP tests cover only projection and error-envelope mapping. UI form rendering and visual behavior are accepted manually
  by the product owner and are outside the automated test budget.
