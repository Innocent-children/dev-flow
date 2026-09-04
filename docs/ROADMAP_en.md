# Dev Flow Roadmap

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

The roadmap describes user outcomes to improve, not delivery dates. Delivered capabilities and their
current status belong in [Project Status](PROJECT-STATUS_en.md); stable support remains in the
[Support Matrix](SUPPORT-MATRIX_en.md).

## North Star

> After a long-running task is interrupted, give the developer and agent a trustworthy current state
> and a next step that does not expand work, repeat effects, or broaden verification without reason.

## Now: understand the current Task and worktree

This stage improves the clarity and cost of using capabilities that already exist:

- summarize what the current Task is;
- distinguish confirmed results from results that remain uncertain;
- show which verification records still apply to the current implementation;
- explain why a Task is blocked and what must be confirmed;
- show the current legal next step directly;
- show a read-only change assessment and recommendation before a new request creates a Task;
- show confirmed remote/base/target, the dedicated worktree, Task Plan, current changed paths,
  file-scope decisions, and unexplained paths;
- distinguish normal linear commits, content changes, history conflicts, workspace unavailability,
  and relocation;
- expose the post-analysis verification plan, current budget/usage, every increase reason, and
  Recovery assessment in the Host and local WebUI;
- keep ordinary post-change review within the diff, causal impact, and acceptance needs without
  restarting a repository-wide audit after a fix.

This work adds no process node or second Task state; budget increases reuse one TEST-to-TEST self-transition.

## Next: make completion decisions more trustworthy

The following are future directions and are not implemented, or not fully implemented, today:

- stronger binding between verification records and current implementation state;
- use real feedback to tune initial verification plans and increase decisions without false widening
  or false blocking;
- a public fault-injection journey for an uncertain Action;
- improve the explainability and feedback loop for `small|standard|large|uncertain` assessments;
- reduce confirmation and recovery steps without adding a second state machine.

Names such as Skip, Guarded, and Strict are not delivered user features. Any future naming and
behavior requires an independent product design and a real journey.

## Later: cross-machine and team collaboration

The following are later candidates and are not implemented today:

- cross-machine Task transfer with verifiable export/import;
- read-only PR / CI verification summaries;
- a team read-only Task view;
- thinner OpenSpec / Spec Kit artifact integration.

Current source supports same-machine relocation. Any future cross-machine capability must still use
one Core Task state; an Adapter cannot copy the current stage or decide completion independently.

## Not planned

Dev Flow does not currently plan to:

- become a general-purpose agent;
- make Core a shell or file-system sandbox;
- commit, merge, rebase, push, tag, or publish automatically;
- provide an arbitrary workflow DSL or user-defined state machine;
- scan neighboring repositories and expand Repository Scope automatically;
- turn the local WebUI into a cloud project-management platform.

A new platform, Host, or interface enters the roadmap only when it improves long-running task
continuation and has an independent validation method.
