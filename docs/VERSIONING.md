# Product Versions

Dev Flow maintains three product versions:

```text
Core      -> CORE_VERSION
Codex     -> packages/codex/package.json.version
DeepSeek  -> packages/deepseek/package.json.version
```

The Codex plugin manifest copies the Codex package version; it does not define a separate version. Root
`package.json` is private monorepo tooling and has no version.

Products evolve independently. Releasing one product changes only its version file and
the copies that must match it. Codex and DeepSeek may package a different Core version; build and release checks
read it from the actual Core executable.

SQLite additionally has one Core-owned database Schema version, currently `0.5.0`. It identifies
the one supported persisted layout and changes with that current layout.

Internal protocols, limits, snapshots, process definitions, payload contracts,
receipts, build reports, release manifests, and publication records do not have maintained version
numbers. Current capabilities, allowed fields and tools, content digests, artifact digests, and
runtime behavior define the supported interfaces and rules.

New public Tags use `core-vX.Y.Z`, `codex-vX.Y.Z`, or `deepseek-vX.Y.Z`. Historical unprefixed Tags
remain frozen and are not used to determine current product versions.
