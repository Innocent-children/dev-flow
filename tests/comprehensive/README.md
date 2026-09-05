# Comprehensive automated tests

This directory is the large-change test suite for cross-layer Dev Flow contracts. It reads the current
Core process, MCP catalog, package manifests, platform implementations, build scripts, and workflow
definitions instead of maintaining another workflow or runtime catalog.

## Default checks

```bash
go test ./tests/comprehensive
node --test tests/comprehensive/*.test.mjs
```

The Go suite covers the generated process topology, every legal and illegal node/transition pair,
process-definition digest validation, terminal and blocked actions, the fixed MCP tool list and schemas,
redacted MCP errors, repository test-surface inventory, Core platform/Git boundaries, WebUI loopback
and session markers, package definitions, and release isolation.

The Node suite executes package/runtime selector checks, unsupported-platform rejection, package test
entrypoints, WebUI build/typecheck contracts, repository validation entrypoints, and manual publication
boundaries.

Run the deterministic large-change qualification locally with:

```bash
DEV_FLOW_RUN_LOCAL_QUALIFICATION=1 node --test tests/comprehensive/qualification.test.mjs
```

It runs the uncached complete Go suite, all three public package suites, and the WebUI typecheck/build.

## External qualification

Real Host, Windows, browser, race, fuzz, mutation, or long-running checks require the matching
environment. Supply commands as arrays so the runner never invokes a shell:

```bash
export DEV_FLOW_QUALIFICATION_COMMANDS='{
  "codex":["node","path/to/codex-qualification.mjs"],
  "deepseek":["node","path/to/deepseek-qualification.mjs"],
  "windows":["pwsh","-File","path/to/windows-qualification.ps1"],
  "webui":["node","path/to/webui-browser-qualification.mjs"],
  "nightly":["sh","path/to/nightly-checks.sh"]
}'
node --test tests/comprehensive/qualification.test.mjs
```

An absent command is reported as skipped with its exact environment requirement. A skipped external
qualification is not a native Host, Windows, browser, or nightly pass.

## Case groups

| Group | Automated here | Existing detailed suites consumed by the repository |
| --- | --- | --- |
| GRAPH / PAYLOAD | Generated topology, response data, illegal pairs, and digest validation | `internal/workflow`, `internal/application`, `tests/journeys` |
| MCP | Catalog, annotations, allowed schema fields, lifecycle input rejection, redaction | `internal/mcp`, `tests/contract` |
| STORE / RECOVERY / SCOPE | Required executable-suite inventory and Core responsibilities | `internal/store`, `internal/recovery`, `internal/repository`, `tests/journeys` |
| CODEX / DEEPSEEK / MANAGER | Package test entrypoints and runtime parity | `packages/*/tests` |
| WEBUI | Loopback/session/revision source boundary and build contract | `internal/webui`; browser qualification is external |
| PACKAGE / PLATFORM / RELEASE | Runtime selectors, manifests, build and publication separation | `scripts`, `release`, package contract suites |
| ROBUST | Explicit qualification command contract | race/fuzz/mutation/soak commands supplied by nightly environment |
