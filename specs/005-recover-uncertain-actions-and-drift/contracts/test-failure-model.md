# Contract: Deterministic Test Failure Model

## Goal

Prove recovery boundaries without adding production fault-injection behavior.

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

Every test name or failure message identifies the boundary it proves:

```text
pre_commit
post_commit_discard
pre_serialization
partial_write
restart
concurrent_apply
repository_drift
```

The label does not upgrade deterministic evidence to a real host crash.

## Cleanup

All databases, repositories, sockets/pipes, and response buffers are created under test-owned
temporary directories and cleaned by the test framework. No test writes a permanent evidence
ledger or modifies user configuration.
