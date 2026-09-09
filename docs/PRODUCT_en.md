# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## Product position

Dev Flow helps developers decide whether a request needs a full development process, and preserves requirements, change scope, verification effort and progress so long-running AI coding tasks can continue after a session ends.

Codex or DeepSeek understands code, edits files and executes commands. Go Core retains the one Task state, observes the actual worktree, checks current results and decides the legal next step. A Task is a persisted development job; an Action is an operation Core issues for its current stage.

## Target users and use cases

The product serves developers using Codex or DeepSeek on real repositories over multiple sessions or days. It fits public-interface, persistence, multi-component and recovery-sensitive changes, as well as work requiring explicit file scope and verification effort.

Other changes in a shared checkout can obscure ownership. Chat history alone may not establish whether tests remain valid, an operation succeeded, or work remains after an interruption. Dev Flow gives the task a dedicated worktree and retains requirements, plans, check results, blocker reasons and recovery information.

Direct Host use is usually simpler for one-off questions, explanations, status queries and small mechanical edits. A few explicitly selected repositories may share one Task, but multi-repository work and worktree handoff are advanced capabilities, not the primary use case.

## Task creation and resume

A new request receives a read-only assessment of discovered impact, unknowns and a recommendation. The developer chooses direct work, Dev Flow or clarification; an explicit selector does not skip assessment. Before selection there is no Task creation, Git mutation or development-session dispatch.

After choosing Dev Flow, the developer confirms each repository's local or remote source, base branch, new task branch and whether to carry local content. Local preparation can work offline; remote preparation fetches the selected branch and freezes the starting commit. Confirmed carrying copies staged, unstaged and non-ignored untracked content while preserving the source checkout and staged state. Application failure retains the destination for inspection; one Task opens only after every repository is ready.

Discovery follows user instructions, applicable repository rules and Host permissions. Discovery may identify candidates; Task membership requires confirmation and becomes fixed at creation.

When Codex starts a new session, it retains relevant requirements discussion and confirmed requirements, distinguishing unaccepted suggestions and unresolved questions. Explicit choices and authorizations that remain valid are retained; only unresolved decisions or required inputs need another question.

Explicit resume returns to the original worktree instance and saved state without creating another task or selecting another worktree. The destination of a confirmed launch verifies the retained launch record before continuing initialization. A missing or replaced original worktree pauses progress; the developer can restore that instance or explicitly abandon the Task.

## Change and verification rules

| Situation | Current behavior |
| --- | --- |
| Worktree changes | Core derives actual changes from Git; later source-checkout edits are separate from the Task |
| Work leaves the plan | Supported structured tools ask before writing; later observation finds other writes, and unexplained paths cannot reach testing or delivery |
| An unplanned file needs handling | The developer chooses one-time allowance, replanning or restoration; Core retains the decision |
| Analysis completes | The task plan records checks, rationales, initial command budget, full-suite expectation and test-code expectation |
| Verification capacity is insufficient | Record a concrete new impact, risk, failure or gap and the required increase before more testing; remaining work or reruns of existing checks can also receive capacity |
| A full suite is proposed | Reassess whether focused checks suffice, what remains uncovered and current repository requirements every time; spare capacity is not a reason to widen testing |
| Testing repeats exactly | The third identical failure, result or change-and-failure loop pauses for an explicit decision |
| Code is reviewed after a change | Cover the current change, direct or indirect impact and acceptance needs; fixes receive related rechecks; explicit review stays read-only and awaits separate repair authorization |
| Content changes | Invalidate tests and comprehension based on older content; linear commits of identical content retain their results |
| Workspace history is abnormal | Branch switches, detached HEAD, rewinds, unprepared history rewrites or instance replacement trigger a blocker or unavailable state |

Carried local content belongs to the Task change scope. Codex plans preservation and new development separately; preservation checks do not certify existing behavior as tested.

Task creation does not freeze the final verification budget. Consumption belongs to the current task plan; formally rebuilding the plan starts its budget while retaining old records. Capacity increases produce no passed results, and Hosts must report the checks actually performed and their sources.

## Completion and uncertain operations

Every planned work item must complete before testing. Delivery explicitly links each acceptance criterion to corresponding completed work and passed current checks. Automated, static, Host-observed and explicit manual checks are supported; developer comprehension confirmation is retained separately and cannot replace acceptance checks.

An uncertain operation is read from Core's saved record before recovery or retry. Reopening WebUI still discovers pending submissions. Host handoff and worktree provisioning likewise use their own retained records to avoid duplicate execution.

Codex retains the complete tool response before checking `ok` and reading success data; explicit rejections follow the returned error and handling instruction, and local caching or presentation errors do not change the original response.

Same-machine handoff starts with Core retaining recovery conditions, followed by one Host handoff. Core verifies the destination and replaces repository bindings atomically. Failure retains the original bindings and claims.

DONE or CANCELLED ends the Task and releases repository claims without automatically committing, pushing, opening a PR or deleting a worktree. Worktree and branch cleanup require separate authorization. Explicit abandonment of an unavailable worktree retains the last known state and ends the Task.

## Entry points and component responsibilities

| Component | User purpose |
| --- | --- |
| Codex / DeepSeek | Assess requests, perform confirmed development and Host operations, and resume the same Core Task |
| Unified lifecycle CLI | Install, diagnose, maintain and remove Adapters, preserving Task data and configuration during ordinary maintenance |
| Local WebUI | Inspect tasks, results, blockers and recovery, and submit supported operations through Core |
| Desktop pet | Show one selected Task's saved state and open its WebUI; provide task selection, custom appearances, animation controls, resizing and independent start/stop |
| OpenSpec / Spec Kit | Optionally organize requirements, design and tasks; method-tool results do not decide Core state |

The formal `@imotong/dev-flow` npm package includes the macOS arm64 and Windows 10/11 x64 desktop apps and default artwork. A configured Adapter supplies Core. Maintenance commands refresh the app copy while preserving settings and appearances. Desktop presentation indicates neither live Host activity nor completion percentages. See the [desktop pet guide](DESKTOP-PETS_en.md) for installation and artwork.

## Product boundaries

- Core observes Git read-only; authorized Hosts perform fetch, worktree creation, branch operations, handoff and cleanup.
- Worktrees isolate source-change ownership, not processes, networks, credentials, ports, databases, containers or services.
- Core does not intercept every Host file operation or shell command; external writes may happen before observation checks them.
- The product does not automatically copy ignored files, install dependencies, expand repository scope or clean active, dirty, unpushed, unknown-owner or uncertain resources.
- General agents, arbitrary workflow DSLs, custom state machines, cross-machine transfer, remote MCP, cloud multi-user management and automatic Git publication are outside scope.

## Feature decisions and verified scope

Improvements should address actual task problems, help resume from the right state and reduce the effort needed to understand state and next steps. Decisions use Task, Action, repository observations and retained records; Core remains the sole authority for Task state. A new platform, Host or interface needs a concrete user result and repeatable acceptance method.

Source capability does not establish stable-package support. Results apply only to the actual artifacts, platforms and steps tested; simulations and static checks cannot replace real Host workflows. The project does not yet have enough external data to demonstrate lower defect rates, verification cost or recovery time.

See the [Support Matrix](SUPPORT-MATRIX_en.md) for stable support and unverified scope, and [Project Status](PROJECT-STATUS_en.md) for delivered capabilities and gaps. Protocols and implementation belong in [Architecture](ARCHITECTURE_en.md), and operation parameters in the [Command Reference](COMMANDS_en.md).


## Host interaction references

Core interaction instructions and complete examples for Codex and DeepSeek are maintained in `skills/dev-flow/core/` and rendered into each package by the build scripts. Each Host documents its actual authorization, workspace preparation and tool calls. Execution uses the current Action, installed interface and real user decisions. Node submissions, result handling, blocker recovery and verification use the same content, and both rendered example sets pass through the same Core validation.

[Codex Skill](../packages/codex/plugin/skills/dev-flow/SKILL.md) · [DeepSeek Skill](../packages/deepseek/skills/dev-flow/SKILL.md)
