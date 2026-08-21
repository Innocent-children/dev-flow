# Contract: DeepSeek Skill and MCP Projection

## Skill Identity

```text
name: dev-flow
provider: dev-flow-deepseek
modelInvocable: false
userInvocable: true
```

The Skill is registered from packaged content. It is not copied into a repository or user directory.

## Qualified Tool Mapping

| Core raw name | DSH public name |
| --- | --- |
| `dev_flow_server_info` | `mcp__dev_flow__dev_flow_server_info` |
| `dev_flow_open_task` | `mcp__dev_flow__dev_flow_open_task` |
| `dev_flow_get_task` | `mcp__dev_flow__dev_flow_get_task` |
| `dev_flow_get_next_action` | `mcp__dev_flow__dev_flow_get_next_action` |
| `dev_flow_apply_action` | `mcp__dev_flow__dev_flow_apply_action` |
| `dev_flow_cancel_task` | `mcp__dev_flow__dev_flow_cancel_task` |

No alias or seventh tool is supported.

## Handshake

On each newly activated adapter session, before task discovery or mutation, the Skill calls:

```text
mcp__dev_flow__dev_flow_server_info
```

It verifies:

- product `dev-flow`;
- exact current repository product version embedded in the source-local package and Core;
- Schema 2;
- Core Limits 0.2;
- transport `stdio`;
- health ready;
- supported host `deepseek`;
- exact six raw tools in order;
- process `standard-development@1`;
- current process-definition digest;
- method profiles `plain`, `spec-kit`, `openspec`.

A mismatch stops. The adapter does not downgrade, translate, or guess.

## Admission

After handshake:

1. require a substantive bounded request;
2. resolve one canonical current Git worktree;
3. reject work requiring another repository;
4. preserve repository instructions and user authority;
5. discover a compatible active task;
6. open only when none exists;
7. use `host=deepseek`.

Empty or conversational invocation performs no task mutation.

## Core Loop

For each iteration:

1. read or retain a fresh authoritative Task;
2. call `get_next_action`;
3. render current node contract;
4. perform only allowed host work;
5. collect actual required evidence;
6. choose one Core-returned transition;
7. submit the exact payload contract;
8. use current action/revision/request identity;
9. continue from the mutation result or one fresh read;
10. stop on terminal/blocker.

The Skill does not contain an independent graph.

## Method Profiles

The Skill supports:

- `plain`;
- `spec-kit`;
- `openspec`.

Core determines the current method profile and method steps. Packaged references explain host work but
do not select or persist the profile.

## Node Payload Guidance

The package includes current host-neutral payload templates for every normal node and blocker
resolution. Contract tests ensure:

- marked JSON examples parse;
- names/fields match current MCP schemas;
- templates cover the acceptance path;
- DeepSeek and Codex host-neutral reference sections remain in parity.

The Skill always prefers live Core schemas/results over packaged examples.

## Comprehension

At `COMPREHENSION_REVIEW`, the Skill:

- explains current behavior and code paths;
- identifies unnecessary complexity and maintenance risk;
- reports current verification;
- waits for an explicit developer verdict;
- uses only the transition selected from current Core output.

A later developer response that may dispatch a Dev Flow tool includes `/dev-flow` again.

## Recovery

After a missing, cancelled, malformed, truncated, or uncertain mutation result:

1. call `get_task`;
2. call `get_next_action`;
3. compare current revision/action/last operation;
4. classify using current Core recovery data;
5. only then decide whether another mutation is legal.

DSH reconnect only restores transport. It never skips this sequence.

## Result Compatibility Gate

The direct MCP path must demonstrate:

| Case | Required proof |
| --- | --- |
| ordinary success | complete canonical value and parse |
| Core domain error | error remains distinguishable from transport failure |
| near spill | no silent truncation |
| spill | official locator/retrieval reproduces exact bytes/JSON |
| near Core envelope | complete bounded handling |
| restart/compaction | authoritative state can be freshly re-read |

Where bytes are reconstructed, record expected/recovered length and SHA-256.

## Forbidden Skill Content

Contract tests reject instructions that tell the adapter to:

- infer a transition not returned by Core;
- mark a task complete locally;
- persist workflow state;
- auto-retry a mutation after reconnect;
- run a generic Core shell/Git command;
- transfer ownership across hosts;
- ignore repository/user instructions;
- claim unsupported DSH/platform versions.
