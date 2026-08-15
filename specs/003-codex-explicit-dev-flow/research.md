# Phase 0 Research: Codex Explicit Dev Flow

**Feature**: 003-codex-explicit-dev-flow
**Research date**: 2026-08-15
**Authority**: Project Constitution, Feature 003 specification, delivered Feature 002 Core Contract 0.1, repository source, and current official OpenAI documentation

## Research outcome

All planning unknowns are resolved. No product-level ambiguity required a user question. The volatile Codex host details are deliberately confined to this plan and its verification work rather than frozen into the product specification.

The supported evidence surface for this feature is Codex CLI `>=0.147.0 <0.148.0` on macOS arm64.
The official npm dist-tag and changelog both identify `0.147.0` as the exact latest stable release
on 2026-08-15, so the passing native journey must use `0.147.0` and record that exact version. Only
T058 may start the host, each immutable source/validation/artifact chain may launch at most once,
and every failed or blocked attempt remains counted without supporting a compatibility claim. No
real Codex host was started during this research/revalidation.

## Decision 1: Bind to the delivered Core Contract 0.1

**Decision**: The Codex product uses the existing `cmd/dev-flow mcp --stdio` executable and exactly these six tools, with no aliases or Codex-owned schema variants:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

The Skill treats Core responses and next-action schemas as authoritative and consumes the shared fixtures directly from `protocol/fixtures/` in repository tests.

**Rationale**: Feature 002 is merged on `main`; `internal/mcp.NewServer`, the contract tests, and `specs/002-govern-and-resume-single-repository-task/contracts/mcp-tools.md` confirm the six-tool surface. Reusing it prevents the Codex adapter from acquiring workflow authority.

**Alternatives considered**:

- A Codex-specific MCP wrapper was rejected because it would duplicate protocol and result projection.
- Copying fixtures under `packages/codex/` was rejected because copies can drift from the shared contract.
- Adding convenience aliases was rejected because the Constitution closes the tool catalog.

### Baseline evidence

| Baseline | Value |
|---|---|
| Core contract version | `0.1` |
| Shared JSON fixture count | `22` |
| Shared fixture aggregate SHA-256 | `8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7` |
| Feature 002 contract-document aggregate SHA-256 | `8d4fdcfe87257b206ba3ffec07db25c4957f32af4d0e32fd8085fed2d25b6942` |

The aggregate algorithm sorts repository-relative paths bytewise, renders each manifest line as `<file-sha256><two spaces><repository-relative-path>\n`, and computes SHA-256 over the complete manifest bytes. The digests document the inputs used for planning; fixture-level verification remains authoritative and the digests do not create a runtime rejection rule.

## Decision 2: Validate one current Codex CLI minor line

**Decision**: Set the implementation compatibility range to `>=0.147.0 <0.148.0`, select exact
stable `0.147.0` for native evidence, and claim only Codex CLI on macOS arm64.

**Rationale**: The official Codex changelog and the official npm `@openai/codex` dist-tag both list
`0.147.0` as the latest stable CLI release available during revalidation. A same-minor upper bound
keeps a volatile plugin/CLI contract from being silently accepted without rerunning the journey.

**Alternatives considered**:

- Treating the locally installed 0.146.0 as final evidence was rejected because it predates the chosen compatibility baseline.
- An open-ended `>=0.147.0` range was rejected because later host minors may change plugin metadata or CLI output.
- Claiming IDE, desktop app, Windows, or Linux support was rejected because this feature provides no native evidence for them.

**Official sources**:

- [Codex changelog](https://developers.openai.com/codex/changelog) — release history and current stable CLI line (accessed 2026-08-15).
- [Codex plugins](https://developers.openai.com/codex/plugins) — current supported plugin surfaces and user workflow (accessed 2026-08-15).
- [Codex CLI 0.147.0 source](https://github.com/openai/codex/tree/rust-v0.147.0) — exact stable
  parser and CLI artifact source (accessed 2026-08-15).

## Decision 3: Package one plugin inside one private local npm artifact

**Decision**: Keep `packages/codex` private and produce a local `.tgz` in temporary staging. The artifact contains one plugin under `plugin/`, a local marketplace catalog that points only to that plugin, one executable entry, and one prebuilt `darwin-arm64` Core binary. It is installed with npm lifecycle scripts disabled and is never published by Feature 003.

The plugin has the required `.codex-plugin/plugin.json`, one `skills/dev-flow/SKILL.md`, one
`skills/dev-flow/agents/openai.yaml`, and one `.mcp.json`. Setup registers the package's marketplace
root and installs the plugin through Codex CLI commands instead of editing Codex configuration
directly.

**Rationale**: Current official plugin guidance defines a manifest-rooted plugin with optional Skill and MCP resources, and current marketplace guidance permits a local source whose entries use paths inside the marketplace root. A locally packed artifact proves the install boundary without entering Feature 006's publication scope.

**Alternatives considered**:

- Shipping loose repository files was rejected because FR-001 requires one installable product artifact.
- Publishing to npm was rejected because publication and release automation belong to Feature 006.
- An npm install hook that edits Codex state was rejected because registration must be explicit and observable.
- Multiple plugins or Skills were rejected because the requested product has one explicit entry point.

**Official sources**:

- [Package your plugin](https://developers.openai.com/plugins/build/plugins) — plugin layout, manifest, Skill, and MCP resources (accessed 2026-08-15).
- [Codex plugins](https://developers.openai.com/codex/plugins) — local marketplace, installation, update, and removal workflow (accessed 2026-08-15).

## Decision 4: Make `$dev-flow` an explicitly guarded Skill

**Decision**: The Skill is named `dev-flow`. Its official
`skills/dev-flow/agents/openai.yaml` sets `policy.allow_implicit_invocation: false`, its description
documents `$dev-flow` as the only workflow trigger, and its instructions still begin by checking
that the current turn explicitly selected that invocation. If the invocation is absent, the Skill
stops before `dev_flow_server_info` or any other Core call.

When explicitly invoked, the Skill follows only this closed interaction shape: compatibility read, task open/resume, next-action read, closed argument forwarding, result application, and full Core result presentation. On an ambiguous transport outcome it reads Core task/action state before considering a retry.

**Rationale**: Exact 0.147 source defaults implicit invocation to true unless the product-specific
`agents/openai.yaml` policy disables it. `allow_implicit_invocation` in `SKILL.md` frontmatter is not
consumed. The instruction-level guard remains a second observable admission check and does not own
state.

**Alternatives considered**:

- Relying only on the Skill description was rejected because host-side implicit selection remains possible.
- Duplicating Core's transition table in the Skill was rejected because Core owns next-action selection and recovery.
- A JavaScript workflow driver was rejected because it would become a projection proxy.

**Official source**:

- [Build skills for Codex](https://developers.openai.com/codex/build-skills) — Skill structure, progressive disclosure, and explicit/implicit invocation behavior (accessed 2026-08-15).

## Decision 5: Use one inherited-stdio launcher, not an MCP proxy

**Decision**: The plugin's `.mcp.json` uses the shape accepted by both exact 0.147 plugin parsers:
Agent Plugins v1 `$schema`, camelCase `mcpServers`, and one `type: stdio` entry invoking
`dev-flow-codex mcp`. That subcommand resolves the package-local Core binary, validates macOS
arm64, preserves an explicit `DEV_FLOW_DATA_DIR`, otherwise supplies
`~/Library/Application Support/dev-flow/data`, and launches Core with inherited stdin, stdout, and
stderr. It never parses MCP messages or task results.

Setup verifies that `dev-flow-codex` is discoverable on the PATH inherited by the Codex CLI before registration. This avoids relying on undocumented plugin-root interpolation in MCP command fields.

**Rationale**: Official MCP documentation supports local STDIO servers, environment configuration, and shared Codex MCP configuration. Direct inherited stdio keeps the adapter thin and makes the Go Core the actual server.

**Alternatives considered**:

- A Node JSON-RPC proxy was rejected because it would introduce another protocol implementation and result-mapping layer.
- Depending on an undocumented plugin-root environment variable was rejected because current official pages do not guarantee it.
- Asking the target repository to contain an MCP config was rejected because setup may not modify that repository.

**Official sources**:

- [Connect Codex to MCP servers](https://developers.openai.com/codex/extend/mcp) — local STDIO server configuration and environment support (accessed 2026-08-15).
- [Exact 0.147 Agent Plugin MCP parser](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/codex-mcp/src/agent_plugin_config.rs) — schema, camelCase wrapper, and typed stdio entry (accessed 2026-08-15).
- [Exact 0.147 legacy plugin MCP parser](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/codex-mcp/src/plugin_config.rs) — compatibility of the selected intersection shape (accessed 2026-08-15).

## Decision 6: Add only the Core version seam required by a detached binary

**Decision**: Build the package's Core executable from the repository source and inject the repository `VERSION` value into a package variable at link time. `internal/version.Current` first uses that injected value and retains its existing source-tree lookup as a development fallback. Package construction asserts exact equality between root version, npm package version, embedded executable version, plugin version, and receipt version.

**Rationale**: The current `internal/version.Current` resolves `VERSION` relative to its source file, which is unavailable to a detached executable. A single injected string fixes the self-contained artifact without changing any public command, MCP schema, tool, task state, transition, or recovery rule.

**Alternatives considered**:

- Packaging Core source and the repository `VERSION` file was rejected because the product must be self-contained and contain a prebuilt executable.
- Reimplementing `dev-flow version` in Node was rejected because the runtime identity must come from Core.
- General release metadata machinery was deferred to Feature 006.

## Decision 7: Make setup and removal receipt-owned and read-before-write

**Decision**: Explicit setup and removal use the exact 0.147 Codex CLI plugin/marketplace JSON
commands. Marketplace list returns `{marketplaces: [...]}`; plugin list returns
`{installed: [...], available: [...]}`; add/remove results and entries use camelCase fields. Setup
validates these closed response objects, reads back the exact local source/root, plugin ID, source,
version, policies, installed/enabled state, and atomically writes a schema-validated receipt at
`~/Library/Application Support/dev-flow/registrations/codex.json`. Repeated setup is a no-op only
when the receipt and official readback agree.

Removal reads both sources first, removes only the receipt's plugin and marketplace identifiers, verifies absence, and deletes only the owned receipt. It never deletes the default or overridden Core data directory. The user removes the npm artifact only after deregistration.

**Rationale**: Current Codex plugin commands provide the supported state-management boundary. A receipt makes ownership and retry behavior explicit without parsing or rewriting `~/.codex/config.toml` or cache internals.

**Alternatives considered**:

- Editing `config.toml` directly was rejected because it relies on host internals and risks adjacent configuration.
- Deleting the entire Codex plugin cache was rejected because it is shared state.
- Removing Core data with the product was rejected because FR-007, User Story 3, and SC-007 require retained task data.

**Official sources**:

- [Codex plugins](https://developers.openai.com/codex/plugins) — supported plugin installation and removal operations (accessed 2026-08-15).
- [Connect ChatGPT to your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt) — install/reload expectations for plugin resources (accessed 2026-08-15).
- [Exact 0.147 plugin JSON commands](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/cli/src/plugin_cmd.rs) — camelCase add/list/remove output contracts (accessed 2026-08-15).
- [Exact 0.147 marketplace JSON commands](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/cli/src/marketplace_cmd.rs) — top-level marketplace list and mutation output contracts (accessed 2026-08-15).

## Decision 8: Separate simulated contract evidence from native host evidence

**Decision**: Use four evidence layers:

1. repository/package shape and manifest contracts;
2. fake Codex CLI lifecycle tests;
3. fake Core tests driven by shared fixtures for exact calls, closed arguments, complete results, explicit-trigger rejection, and read-before-retry;
4. one passing final-tarball Codex CLI 0.147.0/macOS arm64 journey in a disposable Git repository,
   with at most one native launch per immutable chain.

The native evidence binds the exact retained validation/artifact report digests, artifact build time,
chain ID, external ledger digest, actual attempt count, host/package/Core versions, OS/architecture,
artifact and fixture digests, repository fingerprints, task/revision lineage, at least two committed
Core actions, host restart/resume, terminal outcome, bounded invocation evidence, removal outcome,
and retained-data digest. The semantic validator rereads the unchanged reports and ledger and proves
`validation.completed_at <= artifact.built_at < evidence.recorded_at`. Failed or blocked chains are
never relaunched and never support a claim; a later attempt requires a source fix and a new
T055–T057 chain. Passing commit reserves before spawn, durably prepares observed facts and exact
candidate bytes, publishes evidence create-no-replace before finalizing the ledger, and treats valid
passing evidence as the immediate no-host lock. Post-publication recovery may only install the exact
precomputed ledger; pre-publication interruption cannot be promoted to pass or relaunched. Simulated
tests are labelled simulated and may not support native-host claims.

**Rationale**: Static checks catch product drift cheaply; deterministic fakes cover error/retry contracts; only the real supported host can establish native plugin discovery and session-resume behavior. The evidence schema makes omissions visible to reviewers.

**Alternatives considered**:

- Treating static inspection as real-host evidence was rejected by the Constitution.
- Running a broad matrix was rejected because the feature promises only one supported surface.
- Using a development checkout instead of the packed artifact was rejected because it would not prove the user installation path.

## Decision 9: Keep target repositories and shared task data outside lifecycle ownership

**Decision**: Setup and removal are valid from any working directory but write no file to that directory. The real journey fingerprints the disposable target repository before setup, after completion, and after removal; differences must be only the substantive user-requested change and ordinary user-authorized Git state created during the journey.

The default shared Core data directory is `~/Library/Application Support/dev-flow/data`, with explicit `DEV_FLOW_DATA_DIR` taking precedence. The Codex receipt occupies a sibling product-owned path, not the data directory. Removal proves the SQLite data survives by digest and by reopening the recorded task after deregistration through a direct Core read in the test harness.

**Rationale**: Separating registration ownership from task data makes safe removal mechanically testable and lets Codex and future products resume the same Core-owned tasks without sharing adapter state.

**Alternatives considered**:

- Storing receipt metadata in the target repository was rejected because it would be an unintended repository mutation.
- Storing adapter state in the Core database was rejected because Core owns task state, not host registration.
- A Codex-specific task database was rejected because it would prevent cross-host continuity and duplicate authority.

## Official source index

All OpenAI product claims above were checked against official sources only:

- [Codex changelog](https://developers.openai.com/codex/changelog) — accessed 2026-08-15.
- [Codex plugins](https://developers.openai.com/codex/plugins) — accessed 2026-08-15.
- [Package your plugin](https://developers.openai.com/plugins/build/plugins) — accessed 2026-08-15.
- [Build skills for Codex](https://developers.openai.com/codex/build-skills) — accessed 2026-08-15.
- [Connect Codex to MCP servers](https://developers.openai.com/codex/extend/mcp) — accessed 2026-08-15.
- [Connect ChatGPT to your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt) — accessed 2026-08-15.
- [Codex CLI 0.147.0 source](https://github.com/openai/codex/tree/rust-v0.147.0) — accessed
  2026-08-15.

## Phase 0 gate

- Product ambiguity requiring clarification: **none**.
- Unresolved planning markers: **none**.
- Constitution violations: **none**.
- External blocker: **none**; obtaining an exact supported Codex CLI build is an implementation/journey task, not a planning blocker.
