# Contract: Explicit Invocation and Tool Authorization

## Selector

Exact Skill name:

```text
dev-flow
```

Exact token grammar:

```regex
(^|\s)/dev-flow(?=\s|$)
```

Examples:

| Text | Authorized token |
| --- | --- |
| `/dev-flow do the task` | yes |
| `please /dev-flow continue` | yes |
| `line one\n/dev-flow\nline three` | yes |
| `/dev-flow` | yes |
| `/dev-flow, continue` | no |
| `/dev-flowx` | no |
| `//dev-flow` | no |
| `path/dev-flow` | no |
| `` `/dev-flow` `` | yes if it is direct user text; Markdown is not parsed |
| plugin-injected `/dev-flow` | no |
| Skill-injected `/dev-flow` | no |
| previous-turn `/dev-flow` | no |

## Source Boundary

Only DSH `user/message` events satisfying:

```text
event.data.source.kind == "user"
```

may provide a selector.

The following never authorize:

- model messages;
- tool results;
- plugin messages;
- Skill catalogs;
- Skill invocation injections;
- workspace/system instruction injections;
- subagent relay/recall;
- persisted Core task state;
- adapter environment variables;
- earlier closed turns.

## Covered Tools

Every name beginning:

```text
mcp__dev_flow__
```

is covered by the guard.

The six expected names may be allowed. Any other name under the namespace is denied even if an MCP
server publishes it.

Tools outside the namespace are unaffected.

## Guard Placement

Use a plain-context `ctx.tools.guard()` registration.

The guard runs after reorderable `tools/pre-execute` policy and is monotonic. Returning a reason is a
final denial before body dispatch.

Prompt text and Skill instructions are defense in depth only. The guard is the authorization
boundary.

## Current-Turn Derivation

For each covered execution:

1. require `execution.agent`;
2. require the agent to be in a live running turn;
3. inspect the immutable `execution.agent.session.events`;
4. locate the current durable `tool/call` by `execution.callId` when present;
5. use its `turn` and nearest matching prior `turn/start`;
6. for a nested execution without its own durable call, use the latest unmatched `turn/start`;
7. deny if the turn is absent, closed, or ambiguous;
8. scan events after that start and before the call/current session tail;
9. consider only direct-user messages;
10. consider only text blocks;
11. allow when at least one block matches the exact token regex.

A selector authorizes covered calls for that open turn only.

## Stable Denial Classes

Implementation may expose one stable user-facing sentence and internal test classes:

```text
DEV_FLOW_SELECTOR_REQUIRED
DEV_FLOW_UNEXPECTED_TOOL
DEV_FLOW_NO_AGENT
DEV_FLOW_NO_OPEN_TURN
```

The model-facing denial must state that the user must include a whitespace-bounded `/dev-flow` in the
current direct user turn. It must not suggest that task existence or a prior selector is sufficient.

## No Persistent Authorization

Forbidden adapter state includes:

- active/recent selector boolean;
- authorized session ID;
- authorized repository;
- authorized task ID;
- expiration timer;
- profile-level enable flag beyond package installation;
- Core claim used as a permission token.

A pure per-call derived projection or short-lived local variable is allowed.

## Acceptance Matrix

| Current direct user selector | Historical selector | Message source | Tool | Result |
| --- | --- | --- | --- | --- |
| absent | absent | user | expected Dev Flow | deny |
| absent | present | user | expected Dev Flow | deny |
| exact | any | user | expected Dev Flow | allow |
| malformed | any | user | expected Dev Flow | deny |
| exact text | any | skill-invocation | expected Dev Flow | deny |
| exact text | any | plugin | expected Dev Flow | deny |
| exact | any | user | unexpected namespace tool | deny |
| absent | any | user | unrelated tool | unaffected |
| exact | any | user | unrelated tool | unaffected |
| exact | any | user | nested expected Dev Flow call | allow only inside the same open turn |
| absent | any | user | nested expected Dev Flow call | deny |

## State Guarantees

A denied call:

- has no MCP transport dispatch;
- has no Core process request;
- has no task/event/claim write;
- has no Git observation;
- may produce a normal DSH tool-denial result in the session log;
- does not disable unrelated DSH tools.
