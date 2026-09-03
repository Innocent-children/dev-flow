# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-sentence position

> Dev Flow keeps AI coding tasks inside an agreed change scope and verification budget, and pauses
> when the plan, tests, or recorded results no longer justify continuing.

It is a local execution-control and recovery layer for long-running AI coding tasks. Codex or
DeepSeek still reads code, edits files, and runs commands. Dev Flow retains the agreed goal, file
scope, and test budget, then pauses when the work widens, exceeds that budget, repeats an unchanged
failure, or relies on an old result. Durable local Task state also supports continuation after an
interruption and read-before-retry for an uncertain operation.

## Target users

Dev Flow is for developers who use Codex or DeepSeek in real repositories and whose work may span
several sessions or days. They want the agent to work independently without quietly touching more
files, turning a targeted check into a full regression run, or repeating the same failed attempt.
When work crosses sessions, they also need a reliable view of what is complete and what remains.

## The job users need to complete

Users need to move a bounded code change from request to delivery while being able to:

- retain the original goal, acceptance criteria, and out-of-scope work;
- list the expected changed paths and required verification for each work item;
- allow one unplanned write, revise the plan, or reject it;
- limit automatic verification-command count and permission for full suites or manual handoff;
- pause when the same failure or unchanged result repeats;
- know which old test and comprehension records became stale after implementation changes;
- check whether an uncertain operation took effect before choosing recovery or retry;
- continue the same Task after an interruption;
- confirm before delivery that the implementation is both tested and understandable.

## Primary failure scenario

A bounded task gradually loses its boundaries while it runs: changes spread into unplanned files,
targeted verification becomes a full regression run, the same paths and checks repeat after a
failure, or changed code continues using an earlier test result. The agent still produces output,
but the developer can no longer tell whether it is doing the work that was originally approved.

Dev Flow primarily addresses this failure. The Task retains the agreed file scope, verification
steps, and verification budget. Supported unplanned writes pause first, test submissions must fit
the budget, a third exact repetition blocks, and requirement or implementation changes invalidate
results that no longer apply.

## Supporting failure scenarios

The same Task state also helps with:

1. continuing the same task after session interruption, context compaction, or a Host restart;
2. deciding what to do after a write response is lost and the Host cannot tell whether it applied;
3. stopping when the repository no longer matches the retained Task state;
4. tests passing while the implementation remains unnecessarily complex or difficult to explain.

## How the product intervenes

Codex or DeepSeek still reads the repository, edits files, and runs commands. Dev Flow maintains one
local Task around that work and performs four jobs:

| Problem during the task | Product behavior |
| --- | --- |
| Changes leave the plan | Retain Repository Scope and Task Plan paths; ask before supported unplanned writes and reconcile accumulated changed paths before delivery |
| Testing widens or repeats | Retain the verification budget; reject over-budget testing and pause after the third exact repetition |
| Earlier results no longer apply | Use requirements, design, task plan, implementation, and repository state to invalidate stale test or comprehension records |
| A session stops or a result is uncertain | Retain the current Task and apply read-before-retry before continuing, recording completion, blocking, or retrying safely |

Dev Flow uses two file-scope checks. Codex `apply_patch` and structured DeepSeek file tools call Core
before writing. A path outside the union of `ExpectedPaths` in the current multi-repository Task Plan
enters `BLOCKED`. The developer can allow the exact write, return to `TASKS` to revise the plan, or
reject it. Core then checks Task-introduced `ChangedPaths` in Implementation, Refactor, and Delivery;
unexplained paths cannot reach testing or `DONE`.

This does not intercept every Host operation. Bash, external processes, and specialized tools may
write first and be discovered only by Core's later reconciliation.

## Current product commitments

The current product commits to:

- storing and resuming the same local Task;
- retaining the original request, explicit scope, current stage, verification budget, records, and
  blockers;
- retaining file-scope decisions, their Task Plan revision, and cumulative Task-introduced paths;
- checking supported structured file tools before writing and preventing unexplained paths from
  reaching testing or `DONE`;
- retaining the three most recent test attempts and pausing when the same failure, same result, or
  same changed-path and failure loop repeats exactly;
- allowing only transitions present in the current built-in process definition;
- stopping progress when repository drift or current conditions are not satisfied;
- assessing an uncertain Action and requiring a read before retry is considered;
- preventing old test or comprehension records from silently standing in for a changed repository;
- keeping Task, current-stage, Recovery, and outcome state in one Go Core;
- using the same local state through the Codex Adapter, DeepSeek Adapter, and local WebUI.

These commitments do not mean Dev Flow intercepts every Host file or shell operation, or guarantees
model output, code quality, or sufficient testing.

## Tasks that fit

Dev Flow fits:

- coding tasks that continue across sessions, days, context compaction, or Host restarts;
- changes that cross requirements, design, implementation, testing, and delivery;
- work that may require rework and must distinguish current from stale verification;
- changes that need explicit scope or verification limits;
- work that benefits from a developer comprehension check before delivery;
- advanced bounded work across a small number of explicit repositories.

## Tasks that do not fit

Using Codex or DeepSeek directly is usually simpler for:

- one-off questions, code explanations, or status queries;
- mechanical small edits that do not need durable cross-session progress;
- general project management, non-development workflows, or arbitrary orchestration;
- work that requires a security sandbox, remote execution platform, or automatic Git publication.

## Relationship to other tools

| Tool | Responsibility |
| --- | --- |
| Codex / DeepSeek | Read repositories, change code, run commands, and explain results |
| OpenSpec / Spec Kit | Help organize requirements, design, and tasks |
| Dev Flow | Retain the current Task state, scope, verification budget, recovery state, and legal next step |

OpenSpec and Spec Kit are optional method profiles, not the product's primary position. Core does not
install, execute, or parse either tool, and there is no OpenSpec / Spec Kit artifact importer today.
Thinner artifact integration appears only as a future direction in the [Roadmap](ROADMAP_en.md).

## Product capability layers

### Layer 1: durable Task state

Retain the Task, current stage, records, blockers, and outcome outside chat history. This is the
product's foundation, not its complete value.

### Layer 2: scope and verification constraints

Retain the original request, explicit scope, and verification budget. Use the union of every
WorkItem's `ExpectedPaths` in the current Task Plan as the cross-repository planned scope. Check
supported Host file tools before writing, retain `allow_once`, `expand_scope`, or `reject`, and
reconcile cumulative paths before testing and completion. Also limit automatic verification
commands, enter `BLOCKED` after the third exact test repetition, and invalidate downstream records
when upstream requirements or implementation change.

### Layer 3: interruption and uncertain-operation recovery

Retain Action identity and recovery state. Combine the current Task with read-only repository
observation after a missing, cancelled, or truncated response or repository conflict, then choose
continue, record completion, block, or safe retry.

### Layer 4: trustworthy handoff and collaboration

Explicit Codex-to-DeepSeek handoff, Task export, team read-only views, and PR/CI summaries are future
directions, not delivered product capabilities.

## Explicit non-goals

Dev Flow is not:

- another coding agent or a general task orchestrator;
- a shell, file-system, or operating-system security sandbox;
- a user-defined workflow DSL or arbitrary graph editor;
- automatic discovery of neighboring repositories or dynamic Repository Scope expansion;
- automatic commit, push, merge, rebase, tag, or publication;
- a remote multi-user project-management platform.

Core observes Git read-only. Code changes, command execution, and Git mutations remain with the
user-authorized Host.

## Product decision principles

A proposed capability should answer:

1. Does it directly improve task-scope control, verification effort, or trustworthy continuation
   after an interruption?
2. Is the decision based on Task, Action, repository observation, or retained records rather than
   only the agent's narrative?
3. Does it reduce the effort required to understand the current state and next step?
4. Can it be checked through a repeatable real-Host journey?
5. Does it preserve one Core Task state?
6. Does it add unnecessary process cost to simple work?
7. Is it merely horizontal expansion to another platform, Host, or interface without improving the
   primary failure scenario?

A proposal that cannot explain the user problem, visible result, and acceptance method should not
move directly into implementation.

## Success metrics

Future product measurement should focus on user outcomes rather than component counts:

- rate at which tasks leave planned paths or require scope expansion;
- rate of completed work repeated because progress was unclear;
- false-allow and false-block rates in automatic-brake and Recovery decisions;
- rate at which a verification budget expands without a stated reason;
- time required to recover a trustworthy current state after interruption;
- repeat use by the same developer for another long-running task.

The project does not yet have enough external usage data to present these as achieved results.

## Current evidence boundary

The project has public npm packages, source contract tests, and real Codex and DeepSeek Host journeys.
Each proves a specific package, environment, or process path. They do not combine into one run that
proves every capability, and source tests do not expand stable support by themselves.

Dev Flow remains early, with limited external adoption. It has not yet established reduced defect
rates, reduced unnecessary testing, or complete recovery from every interruption. See
[Project Status](PROJECT-STATUS_en.md) and the [Support Matrix](SUPPORT-MATRIX_en.md) for stable,
source-only, unverified, and gap status. Source code, machine-readable schemas, package manifests,
CLI parsers, and executable tests remain the final runtime reference.

Current source selects only two exact package runtime pairs: `darwin-arm64` and `win32-x64`. The
Windows product scope is Windows 10/11 desktop x64; it excludes Windows Server, 32-bit Windows, and
Windows ARM64. Native source evidence does not expand npm `@latest` stable support by itself; that
still requires an independent release and final Host journey.

Platform implementations own only local paths, permissions, processes, signals, and executable
behavior. Host Adapters select a platform outside Core, while Core Task, state-graph, data, and
decision rules remain platform-neutral. The current public local WebUI lifecycle is
`start|open|status|stop`.
