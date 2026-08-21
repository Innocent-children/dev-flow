# Contract: DeepSeek Profile Bundle

## Product Identity

```text
package name: dev-flow-deepseek
bundle patch: ./cordis.patch.yml
integration plugin id: dev-flow-deepseek
```

The package is independently releasable from `dev-flow-codex`. Feature 010 does not authorize a
version change or publication.

## Manifest Contract

The final manifest must include:

- ESM package type;
- one executable/runtime-compatible main entry;
- closed `files` allowlist;
- Node 24+ engine;
- `dsh.bundle.patch`;
- bounded peer compatibility for the DSH/Cordis services used;
- no install/postinstall/preuninstall mutation hook;
- no dependency on `dev-flow-codex`;
- no dependency on an externally installed Dev Flow Core.

Exact dependency syntax is frozen after the package-loader spike against the exact DSH artifact.

## Bundle Patch Contract

The patch contains one insertion:

```yaml
- insert:
    - id: dev-flow-deepseek
      name: dev-flow-deepseek
```

No base profile row is copied. No unrelated tool, provider, model, UI, persistence, command, or
network plugin is inserted.

## Integration Plugin Contract

The package main entry composes:

1. platform/runtime/data preflight;
2. one runtime Skill registration;
3. one monotonic global tool guard;
4. one official MCP-client child plugin.

It owns no task state.

Activation is atomic from the product perspective:

- unsupported platform or invalid package/data layout contributes no usable Skill or MCP namespace;
- duplicate `dev_flow` namespace is a clear configuration failure;
- disposal removes Skill, guard, MCP connection, and qualified tools;
- disposal does not remove the package from the profile or delete data.

## Supported Lifecycle

Add:

```bash
dsh plugin --profile <profile> add <package-spec>
```

Remove:

```bash
dsh plugin --profile <profile> remove dev-flow-deepseek
```

A DSH restart is required after add, remove, or update before acceptance readback.

Supported package specs are those accepted by official DSH/pnpm behavior, including an absolute local
tarball used by Feature acceptance.

## Ownership

| Resource | Owner | Removed with bundle |
| --- | --- | --- |
| DSH dependency entry | DSH/pnpm | yes |
| DSH bundle-layer entry | DSH reconciliation | yes |
| integration plugin fiber | DSH process | yes |
| Skill registration | package fiber | yes |
| selector guard | package fiber | yes |
| MCP child and tool registrations | official MCP-client fiber | yes |
| packaged Core binary | package installation | yes |
| shared Dev Flow data | Core/user | no |
| target repository | user/Core-authorized host work | no |
| Codex package/configuration | Codex product/user | no |

## Closed Artifact Allowlist

The packed artifact may contain only:

- `package.json`;
- `README.md`;
- `LICENSE`;
- `cordis.patch.yml`;
- declared `lib/` ESM modules;
- `skills/dev-flow/SKILL.md`;
- declared Skill references;
- `runtime/darwin-arm64/dev-flow`.

Tests, source maps, local evidence, repository metadata, Spec Kit documents, caches, database files,
profiles, home paths, and credentials are excluded.

## Failure Behavior

- pnpm/DSH add failure leaves official diagnostics and no support claim.
- profile reconciliation failure is not repaired by direct file editing.
- unsupported platform results in no partial product activation.
- initial Core connection failure may leave the package loaded and reconnecting, but no Dev Flow tool
  can successfully dispatch.
- removal while a DSH process is running does not mutate that process; restart is required.
