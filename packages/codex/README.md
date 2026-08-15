# dev-flow-codex

`dev-flow-codex` is the private, local Codex CLI product for Dev Flow. It packages one Codex plugin,
one explicitly selected `dev-flow` Skill, one bundled STDIO MCP server definition, and one
`darwin-arm64` Dev Flow Core executable. The package is never published by Feature 003.

The production source layout is deliberately closed:

```text
packages/codex/
├── .agents/plugins/marketplace.json
├── bin/dev-flow-codex.mjs
├── lib/{lifecycle,paths}.mjs
├── plugin/.codex-plugin/plugin.json
├── plugin/.mcp.json
├── plugin/skills/dev-flow/SKILL.md
└── runtime/darwin-arm64/dev-flow       # temporary build staging only
```

The planning compatibility baseline is Codex CLI `>=0.147.0 <0.148.0`. The exact latest stable
compatible build and every plugin, Skill, MCP, marketplace, setup/readback, and removal command are
revalidated immediately before final validation. The final evidence records the selected range and
exact tested build; the planning baseline is not a permanent compatibility promise.

Development requires Node.js `>=24`, pnpm `>=11 <12`, and the repository-pinned Go toolchain. The
package has no production npm dependency and no install, publication, download, or release hook.
Installation and explicit Codex registration are separate operations, and neither setup nor removal
may edit the current repository or delete Core-owned task data.

User-story checkpoints are deterministic only. Run targeted checks such as:

```bash
pnpm --dir packages/codex test:package
pnpm --dir packages/codex test:lifecycle
pnpm --dir packages/codex test:journey-harness
pnpm --dir packages/codex pack:dry
```

The fake-host journey is the only checkpoint command before final validation:

```bash
./scripts/run-codex-real-journey.sh --fake-host --through setup
./scripts/run-codex-real-journey.sh --fake-host --through done
./scripts/run-codex-real-journey.sh --fake-host --through remove
```

Those runs must not start Codex or write native evidence. Feature 003 permits exactly one real Codex
CLI journey, on macOS arm64, after compatibility revalidation, all targeted checks, root validation,
a read-only audit, source freeze, and creation of one final artifact. A source change invalidates
that artifact. Public npm publication, GitHub releases, tags, Windows/Linux claims, IDE support, and
additional Codex surfaces remain out of scope.
