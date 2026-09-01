# Dev Flow Roadmap

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

The roadmap describes user outcomes to improve, not delivery dates. Delivered capabilities and their
current status belong in [Project Status](PROJECT-STATUS_en.md); stable support remains in the
[Support Matrix](SUPPORT-MATRIX_en.md).

## North Star

> After a long-running task is interrupted, give the developer and agent a trustworthy current state
> and a next step that does not expand work, repeat effects, or broaden verification without reason.

## Now: understand the current Task

This stage improves the clarity and cost of using capabilities that already exist:

- summarize what the current Task is;
- distinguish confirmed results from results that remain uncertain;
- show which verification records still apply to the current implementation;
- explain why a Task is blocked and what must be confirmed;
- show the current legal next step directly;
- show the Task Plan, actual changed paths, file-scope decisions, and unexplained paths;
- make the current stage, remaining verification budget, and Recovery assessment easier to read in
  the Host and local WebUI.

This work does not change the current state graph or introduce a second Task state.

## Next: make completion decisions more trustworthy

The following are future directions and are not implemented, or not fully implemented, today:

- stronger binding between verification records and current implementation state;
- visible verification-budget consumption and the stated reason for expansion;
- a public fault-injection journey for an uncertain Action;
- lower process cost based on task complexity;
- different process intensity for small tasks, ordinary long tasks, and strict tasks.

Names such as Skip, Guarded, and Strict are not delivered user features. Any future naming and
behavior requires an independent product design and a real journey.

## Later: trustworthy handoff

The following are later candidates and are not implemented today:

- explicit handoff between Codex and DeepSeek;
- Task export or a handoff receipt;
- read-only PR / CI verification summaries;
- a team read-only Task view;
- thinner OpenSpec / Spec Kit artifact integration.

Handoff must continue to use one Core Task state. An Adapter cannot copy the current stage or decide
completion independently.

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
