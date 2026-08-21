# Version Governance

Dev Flow maintains exactly three product versions:

```text
Core      -> CORE_VERSION
Codex     -> packages/codex/package.json.version
DeepSeek  -> packages/deepseek/package.json.version
```

The Codex plugin manifest mirrors the Codex package version; it is not another authority. Root
`package.json` is private monorepo tooling and has no version.

Products evolve independently. Releasing one product changes only that product's authority and
required mirror. Codex and DeepSeek may package a different Core version; builds and release evidence
read it from the actual Core executable.

Internal protocols, limits, SQLite layouts, snapshots, process definitions, payload contracts,
receipts, build reports, release manifests, and publication records do not have maintained version
numbers. Current capabilities, closed schemas/catalogs, content digests, artifact digests, and
runtime behavior establish compatibility. Unsupported old data or release directories fail closed
without migration or remote mutation.

New public Tags use `core-vX.Y.Z`, `codex-vX.Y.Z`, or `deepseek-vX.Y.Z`. Historical unprefixed Tags
remain frozen; the first new Codex Tag uses `v0.5.0` as its previous release.
