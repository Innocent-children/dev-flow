# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-sentence position

> Dev Flow resumes long-running AI coding tasks from durable state while keeping scope, verification
> budget, and delivery conditions explicit.

It is a local process-control and recovery layer for long-running AI coding tasks: it retains progress
outside chat history, limits what a Task may do and how much verification remains, decides whether
existing results still apply to the current implementation, and returns a legal next step, Recovery
assessment, or explicit blocker after interruption, repository drift, or an uncertain result.

## Target users

Dev Flow is for developers who use Codex or DeepSeek in real repositories and whose work may span
several sessions or days. They want to see what is complete and what remains before continuing,
rather than maintain context through increasingly long prompts or chat history.

## The job users need to complete

Users need to move a bounded code change from request to delivery while being able to:

- continue the same Task after an interruption;
- retain the original goal, acceptance criteria, and out-of-scope work;
- limit automatic verification-command count and permission for full suites or manual handoff;
- know which old test and comprehension records became stale after implementation changes;
- check whether an uncertain operation took effect before choosing recovery or retry;
- confirm before delivery that the implementation is both tested and understandable.

## Primary failure scenario

A long-running coding task loses trustworthy progress after a session interruption, context
compaction, or Host restart. The next session can only infer what was completed and what remains from
partial chat history and the current repository. That can repeat work, skip remaining verification,
or reuse stale results.

Dev Flow primarily addresses this failure. It persists the Task locally, then uses the current Task
to report the stage, recovery judgment, and legal next step.

## Supporting failure scenarios

The same durable state also helps with:

1. a local change gradually expanding into unrequested modules or future capabilities;
2. targeted verification growing into a full regression, platform matrix, or open-ended testing;
3. the same check, failure, or test-and-implementation loop repeating without a new result;
4. old verification records remaining in use after the implementation changes;
5. a lost write response being replayed immediately;
6. tests passing while the implementation remains unnecessarily complex or difficult to explain.

## How the product intervenes

Codex or DeepSeek still reads the repository, edits files, and runs commands. Dev Flow maintains one
local Task around that work and performs four jobs:

| Action | Product behavior |
| --- | --- |
| Remember | Retain the original request, current stage, completed verification, blockers, and outcome |
| Limit | Retain Repository Scope, Task Plan file scope, and verification budget; ask before supported unplanned writes and pause after a third exact test repetition |
| Decide | Use requirements, design, task plan, implementation, and repository state to invalidate test or comprehension records that no longer apply |
| Recover | Apply read-before-retry to an uncertain Action and decide whether to continue, record completion, block, or retry safely |

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

1. Does it directly improve trustworthy continuation after a long task is interrupted?
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

- time required to recover a trustworthy current state after interruption;
- rate of completed work repeated because progress was unclear;
- false-allow and false-block rates in automatic-brake and Recovery decisions;
- rate at which a verification budget expands without a stated reason;
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
