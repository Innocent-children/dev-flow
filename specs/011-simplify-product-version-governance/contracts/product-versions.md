# Product Version Contract

## Authorities

```text
Core      -> CORE_VERSION
Codex     -> packages/codex/package.json.version
DeepSeek  -> packages/deepseek/package.json.version
```

The Codex plugin manifest mirrors Codex. Root `package.json` is private and has no `version`.

## Valid independent example

```text
Core      1.2.3
Codex     2.3.4
DeepSeek  3.4.5
```

The repository passes version validation when all values are valid SemVer and the Codex mirror is
`2.3.4`. No equality is required across products.

## Read-only check

`pnpm run versions:check` validates:

1. the three authority files and expected product names;
2. Core/Codex/DeepSeek SemVer independently;
3. Codex plugin equals Codex package;
4. root package has no version;
5. current Core product-version fixtures equal `CORE_VERSION`.

The command writes no file and exposes no bump/update mode.

## Core identity output

```text
dev-flow 1.2.3
```

Codex combines its own manifest with the executable output:

```text
dev-flow-codex 2.3.4 (core 1.2.3)
```

Neither Codex nor DeepSeek stores another Core version in its package manifest.
