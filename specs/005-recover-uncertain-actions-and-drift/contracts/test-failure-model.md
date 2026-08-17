# Contract: Deterministic Test Failure Model

## Goal

Prove recovery boundaries without adding production fault-injection behavior.

**Status**: Implementation complete through T038; final root validation and Spec Kit gates pending.

## Allowed Techniques

### Test-local dependency wrapper

A `_test.go` wrapper may return a chosen error before delegating to an existing Store or observer
method. It must not be exported from production code.

### Discarded application result

A test may call the real application mutation, verify that it returned successfully only inside the
test harness, deliberately discard that result from the simulated caller, close all objects, and
perform authoritative read-back.

### Failing response writer

A test-local writer may accept at most `N` bytes and then return a deterministic error. The test
must not parse the accepted prefix as success.

### Subprocess restart

The existing self-reexec/subprocess pattern may open the real SQLite database in one process, commit
or stop at a named point, exit, and reopen it in another process.

### Temporary repository fixtures

Tests may use normal Git commands to construct fixture repositories. Those commands are test setup,
not Core behavior. Assertions must prove Core code did not invoke Git mutation.

## Prohibited Techniques

- production CLI flags;
- MCP request fields;
- environment variables consumed by production code;
- persisted failure plans;
- process-global mutable hooks;
- timers or sleeps used as the primary race proof;
- randomized failure loops;
- monkey-patching or unsafe memory mutation;
- changing stable errors solely to simplify tests.

## Evidence Labels

Use a boundary label that states only what the evidence proves:

| Evidence label | Proven boundary |
|---|---|
| test-local pre-commit failure | A `_test.go` dependency fails before the real Store commit. |
| post-commit discarded result | The real application mutation commits and the simulated caller discards its return. |
| pre-serialization discard | The application commits before MCP result encoding. |
| bounded partial writer | A test writer accepts a fixed prefix and fails; the prefix is not a result. |
| SQLite close/reopen | Real persisted state is read after Store/Application recreation. |
| two-handle deterministic race | Two real handles synchronize one action; at most one commits. |
| temporary Git fixture mutation | Test setup changes an isolated repository while Core remains Git-read-only. |
| Codex Skill static contract | Node assertions inspect the Skill's closed caller contract; no host executes. |
| root repository validation | The repository's authoritative validator runs once at the final gate. |

These labels do not upgrade deterministic evidence to a real Codex crash, operating-system power
loss, network interruption, DeepSeek evidence, or release-artifact evidence.

## Cleanup

All databases, repositories, sockets/pipes, and response buffers are created under test-owned
temporary directories and cleaned by the test framework. No test writes a permanent evidence
ledger or modifies user configuration.

## Delivered Failure-Model Result — 2026-08-17

All Feature 005 helpers remain in `_test.go`; no production failpoint, environment variable, CLI or
MCP parameter, build tag, dependency, or persisted failure plan was added. T001–T033 passed without
Core, Application, Recovery, Repository, Store, or MCP Go production changes. The Codex check is
static contract evidence only. No extra real Codex Host Journey or DeepSeek Harness was run, and
`packages/deepseek/` remains unchanged.
