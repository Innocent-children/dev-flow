# Codex worktree-first journeys

`simulated-worktree-first.test.mjs` uses a real temporary remote, checkout, managed-style linked
worktree, commit, push, and receipt files. Codex task creation, Core progression, and Handoff are
explicit simulated adapters. Its result is deterministic simulated Host evidence, not native Codex
App evidence.

The Codex App task and Handoff APIs are not exposed as a repository-local command. A separately run
native macOS Codex App journey records the closed event list accepted by `native-runner.mjs`. Validate
that result only with explicit inputs:

```bash
DEV_FLOW_CODEX_NATIVE_CONFIRM=worktree-first-native \
DEV_FLOW_CODEX_NATIVE_EVIDENCE=/absolute/path/to/native-evidence.json \
node tests/journeys/codex/native-runner.mjs
```

Without the exact confirmation the runner reports `skipped`. It validates evidence; it does not
create a Codex task, fetch a developer repository, perform Handoff, or turn simulated results into
native results.
