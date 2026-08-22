# Codex One-Command Release Contract

## Invocation

```bash
pnpm run release:codex -- \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

The command remains Codex-specific.

## Version commit

Only these files may change:

```text
packages/codex/package.json
packages/codex/plugin/.codex-plugin/plugin.json
```

Commit: `release(codex): v<CODEX_VERSION>`

Tag: `codex-v<CODEX_VERSION>`

Core, DeepSeek, root package, and Core fixtures remain unchanged.

## Artifact names

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
```

## Manifest identity

```json
{
  "release": {
    "product": "codex",
    "version": "2.3.5",
    "core_version": "1.2.3",
    "tag": "codex-v2.3.5",
    "source_commit": "<40 lowercase hex>",
    "source_tree": "<40 lowercase hex>",
    "verification_mode": "quick",
    "based_on_release": "codex-v2.3.4",
    "created_at": "<RFC3339>"
  }
}
```

The complete manifest also carries bounded toolchains, exactly two artifacts, the closed package
inventory, support evidence, and validations. It has no top-level format number or internal
compatibility-number fields.

Artifact rows do not repeat `core_version`; `release.core_version`, the Core artifact/runtime digest,
and executable readback form the single closed Core identity.

## Baseline selection

1. If no eligible `codex-v*` exists, the previous Codex release is frozen `v0.5.0`.
2. Otherwise use the latest lower eligible `codex-v*`.
3. Both modes record the full previous Tag; only quick uses it for changed-path eligibility.
4. Never create `codex-v0.5.0`.

## Quick ownership

Core/shared/Codex runtime, package, Skill, lifecycle, layout, platform, or support paths require
normal. Documentation, specifications, tests, repository configuration, release tooling, and
approved Codex version metadata may retain current quick behavior. A diff confined to
`packages/deepseek/**` does not block Codex quick unless a shared contract is also changed.

## Resume

Before any remote mutation, current tooling requires a current-format record bound to:

- product `codex`;
- Codex and Core versions;
- Tag and previous Codex release;
- source commit and tree;
- verification mode;
- artifact/manifest digests.

A mismatched or historical-format directory fails closed. A matching directory may resume from its
frozen source even when the current checkout later contains other product versions.
