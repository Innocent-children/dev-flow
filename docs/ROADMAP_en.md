# Dev Flow Roadmap

[中文](ROADMAP.md) | [English](ROADMAP_en.md)

This roadmap describes user outcomes still needing improvement and their relative priority, without promising dates. See [Project Status](PROJECT-STATUS_en.md) for delivered capabilities and the [Support Matrix](SUPPORT-MATRIX_en.md) for stable support. The directions below require further design and validation; they are not existing feature commitments.

## First priority: understanding a resumed task

Help developers quickly understand what is complete, what remains, why work stopped and who needs to act next.

- Organize retained records into a shorter, clearer resume summary highlighting remaining work, blocker reasons and an actionable next step.
- Make it easier to distinguish checks that still apply to current code from results requiring renewed confirmation.
- Evaluate how to retain consequential failed approaches and rejection reasons, reducing repeated proposals of excluded approaches.
- Evaluate how to present new requirements during an active Task so users can distinguish changing this Task, scheduling later work and ending the current Task.

New summaries or records should reuse the one Core Task and reduce interpretation effort. They must not add another process state or let a Host decide completion.

## Continued calibration: verification and completion

- Use real feedback to evaluate initial verification plans and capacity increases, reducing unnecessary checks and false blocks.
- Improve request-assessment explanations and misclassification feedback so users can decide whether the full process is useful.
- Provide public fault-injection demonstrations for uncertain operations, showing what was retained and when recovery is permitted.
- Improve the consolidated completion view so missing acceptance items and their remedies are easier to find.
- Reduce the number of user operations while retaining necessary confirmation and recovery checks.

Validate these improvements through actual Codex or DeepSeek scenarios, distinguishing test results, user feedback and unverified inferences.

## Longer-term candidates: collaboration and transfer

These directions rank below resume experience and verification judgment and need independent requirements and complete designs:

- Task takeover between Codex and DeepSeek;
- Cross-machine Task transfer with verifiable export and import;
- Read-only PR / CI verification summaries and shared read-only Task views;
- Simpler OpenSpec / Spec Kit document integration.

Takeover and transfer must retain the one Core Task state, existing results, remaining work and authorization boundaries. Copying a Host's stage cannot substitute for that state.

## Not planned

General agents, shell or filesystem security sandboxes, automatic Git publication, arbitrary workflow DSLs, custom state machines, automatic discovery and admission of neighboring repositories, and cloud project-management platforms are not planned.

A new platform, Host or interface should enter implementation planning only when it solves a specific long-running-task problem and has a repeatable acceptance method.
