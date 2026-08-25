# Research: Unified Adapter Lifecycle Manager

## Decision 1: Independent `create-dev-flow` package

**Decision**: Add a dedicated npm create package with one executable and an independent product identity.

**Rationale**: It must run before either Adapter is installed and manage both products symmetrically. npm create
maps `npm create dev-flow` to `create-dev-flow`, while `npx create-dev-flow` uses the same package.

**Alternatives considered**: Extend `dev-flow-codex`; add a shell script to README; embed commands in Core.

**Why alternatives were rejected**: A Codex-owned package cannot bootstrap or remove itself reliably while also
serving DeepSeek; README shell preserves the orchestration burden; Core cannot own Host or Git mutations.

**Consequences**: The manager has an independent manifest, package tests and future release authority.

## Decision 2: Zero third-party runtime dependencies

**Decision**: Use Node.js built-ins for parsing, prompts, subprocesses, JSON, hashing and filesystem operations.

**Rationale**: The bootstrap surface should stay small, deterministic and runnable before Adapter dependencies exist.

**Alternatives considered**: Prompt/UI frameworks and lifecycle orchestration libraries.

**Why alternatives were rejected**: They enlarge install bytes, supply-chain surface and runtime compatibility without
removing domain-specific ownership or recovery logic.

**Consequences**: Rich presentation is intentionally bounded; parser and prompts are explicit code.

## Decision 3: Host-specific drivers behind a fixed coordinator

**Decision**: Keep two concrete drivers selected by the closed `codex|deepseek` enum.

**Rationale**: Codex owns a package CLI and registration receipt; DeepSeek owns Profile bundle lifecycle. Their
commands, readbacks and recovery ordering are materially different.

**Alternatives considered**: Generic provider registry or adapter plugin API.

**Why alternatives were rejected**: Only two fixed Hosts are authorized, so a provider abstraction would add
configuration and indirect control flow without user value.

**Consequences**: Shared planning depends on a small normalized observed-state contract; driver code remains direct.

## Decision 4: Add read-only Codex status authority

**Decision**: Extend `dev-flow-codex` with `status [--json]` implemented through its existing receipt and Codex
registration validators.

**Rationale**: Manager status, doctor and planning require a non-mutating observation. Calling setup can write, while
parsing Codex configuration in the manager would duplicate ownership rules.

**Alternatives considered**: Call setup as status; inspect `$HOME/.codex` directly; trust manager state.

**Why alternatives were rejected**: Setup is a mutation entry, direct config parsing bypasses lifecycle authority,
and manager state cannot prove current Host registration.

**Consequences**: Codex CLI tests and command documentation gain one read-only public lifecycle command.

## Decision 5: Manager receipts only for DeepSeek Profiles

**Decision**: Persist closed receipts for manager-installed or explicitly adopted DeepSeek Profiles.

**Rationale**: DSH lacks a stable complete Profile enumeration command. Receipts provide a closed “all known” scope
without scanning internal DSH directories.

**Alternatives considered**: Scan `$HOME/.dsh`; require Profile every time; infer from process config files.

**Why alternatives were rejected**: Scanning or internal parsing crosses DSH ownership; repeated manual input cannot
safely implement all-known uninstall/reset.

**Consequences**: Pre-existing manual installations need explicit Profile selection and adoption confirmation.

## Decision 6: Journal effects, not workflow state

**Decision**: Persist lifecycle operation identity, confirmed plan digest, completed external effects and next step.

**Rationale**: npm and Host lifecycle mutations are not transactional; restart-safe recovery needs evidence of which
external boundary completed.

**Alternatives considered**: In-memory execution; a general state machine; reuse Core Task storage.

**Why alternatives were rejected**: In-memory execution cannot recover interruption; a new state engine is excess
complexity; Core Task storage does not own product installation.

**Consequences**: Re-observation remains authoritative. Journal entries never select a Core or Host transition.

## Decision 7: Recoverable reset by default

**Decision**: Factory reset moves confirmed data to a unique macOS Trash root; permanent removal requires a second
confirmation bound to the saved plan.

**Rationale**: Task data deletion is material and existing product roots can contain shared Host state. Recoverable
removal satisfies a clean active installation while retaining a bounded recovery option.

**Alternatives considered**: Immediate recursive delete; automatic archive beside active data; never support reset.

**Why alternatives were rejected**: Immediate delete has no recovery, adjacent archive can be rediscovered as active
or confuse ownership, and reset is an explicit required lifecycle operation.

**Consequences**: Cross-volume moves safe-stop; permanent mode is deliberately more difficult than `--yes`.

## Decision 8: Host executables remain prerequisites

**Decision**: Manage Dev Flow Adapters and product data only. Codex and DSH installation/removal stay user-owned.

**Rationale**: Host packages own unrelated configuration, sessions, plugins and compatibility policy.

**Alternatives considered**: Automatically install/uninstall Codex or DSH.

**Why alternatives were rejected**: That would broaden the cleanup authority and couple Dev Flow lifecycle to Host
distribution choices.

**Consequences**: A missing/incompatible Host fails before mutation with one copyable next step.
