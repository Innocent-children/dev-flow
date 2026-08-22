# dev-flow-deepseek

`dev-flow-deepseek` is the independently versioned DeepSeek Harness adapter to Dev Flow's current
process graph. Its package metadata is public-release capable; actual support begins only after the
selected release command and registry lifecycle gate complete.

Its product version comes only from `package.json`. The packaged Core reports its own independently
maintained version; the adapter validates the actual executable, six-tool catalog, live schemas,
server information, process definition, and behavior without comparing the two product versions.

The package targets macOS arm64 with Node.js 24 or newer and declares compatibility with the DSH
`>=0.1.0-rc.8 <0.2.0` service family. Feature acceptance is bound to the exact
`@deepseek-ai/dsh 0.1.0-rc.8` artifact; the declared range is not a claim that later release
candidates have passed native acceptance.

## Profile lifecycle

DSH owns installation and profile reconciliation. Add a reviewed local artifact with:

```bash
dsh plugin --profile <profile> add /absolute/path/to/dev-flow-deepseek-<version>.tgz
```

Stop and restart that DSH profile before validating the resolved bundle. Remove the package with:

```bash
dsh plugin --profile <profile> remove dev-flow-deepseek
```

Restart after removal before checking that the bundle contributions are absent. Reinstallation uses
the same official add command and the exact previously reviewed artifact.

The official lifecycle owns the DSH dependency entry, bundle layer, integration process, Skill,
guard, and MCP child. Dev Flow task data, target repositories, and Codex-owned package or
configuration state remain outside package removal.

## Support boundary

The package contains one `dsh.bundle.patch` layer and is designed to contribute one integration row.
Its final Feature 010 artifact will contain one user-invocable `dev-flow` Skill, a current-turn
selector guard, the official local STDIO MCP client, and one packaged darwin-arm64 Core.

Source capability alone is not a public support claim. npm, `deepseek-v*`, GitHub Release assets and
the registry-installed DSH lifecycle must all be verified by `pnpm run release:deepseek` before the
support matrix is promoted.
