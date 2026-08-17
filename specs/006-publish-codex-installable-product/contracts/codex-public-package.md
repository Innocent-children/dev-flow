# Contract: Public `dev-flow-codex` Package

## Identity

| Property | Required value |
|---|---|
| npm name | `dev-flow-codex` |
| version | exact root `VERSION` |
| license | Apache-2.0 |
| access | public |
| OS | `darwin` |
| CPU | `arm64` |
| Node engine | repository-supported `>=24` range |
| executable | `dev-flow-codex` |
| bundled Core | `runtime/darwin-arm64/dev-flow` |
| host product count | one Codex product |
| MCP server count | one local STDIO server |
| MCP tool count | exactly six |

The authenticated publisher must prove permission for the fixed npm name before publication.

## Closed Package Layout

```text
package/
├── package.json
├── README.md
├── LICENSE
├── .agents/
│   └── plugins/
│       └── marketplace.json
├── bin/
│   └── dev-flow-codex.mjs
├── lib/
│   ├── lifecycle.mjs
│   └── paths.mjs
├── plugin/
│   ├── .codex-plugin/
│   │   └── plugin.json
│   ├── .mcp.json
│   └── skills/
│       └── dev-flow/
│           ├── SKILL.md
│           └── agents/
│               └── openai.yaml
└── runtime/
    └── darwin-arm64/
        └── dev-flow
```

No other file is permitted without a specification amendment.

## Package Metadata Rules

- `private` is absent or `false` only for this package.
- `os` is exactly `["darwin"]`.
- `cpu` is exactly `["arm64"]`.
- `publishConfig.access` is `public`.
- `publishConfig.registry` is the approved public npm registry.
- package/plugin/Core versions equal root `VERSION`.
- repository and license metadata are present.
- production dependency count remains zero unless separately approved.
- no install, preinstall, postinstall, prepare, preuninstall, or uninstall lifecycle script exists.
- scripts used only for repository tests/build are not invoked by package installation.

## Runtime Rules

The runtime:

- is a regular executable file, not a symlink;
- is built from the recorded source commit;
- reports the release version;
- has the SHA-256 recorded in the release manifest;
- is the same byte sequence uploaded as the standalone GitHub asset;
- launches only local STDIO MCP through the existing package executable;
- does not download, compile, or discover another runtime.

## Lifecycle Rules

`npm install` and `npm uninstall` modify package-manager-owned files only.

Host mutation occurs only through:

```text
dev-flow-codex setup
dev-flow-codex remove
```

Setup and removal retain the Feature 003 ownership/read-back behavior. Task data is outside the npm
package and is preserved by default.

## Verification Rules

Before publication:

1. `npm pack --dry-run --json` matches the closed allowlist.
2. Two clean builds have identical runtime bytes.
3. Unpacked tarball paths, bytes, modes, and package metadata match.
4. Package/Skill/lifecycle/Core-loop/parser tests pass.
5. No forbidden content or DeepSeek resource appears.
6. The tarball digest and normalized inventory are recorded.

After publication, the public registry tarball must pass the same checks without using local package
files.
