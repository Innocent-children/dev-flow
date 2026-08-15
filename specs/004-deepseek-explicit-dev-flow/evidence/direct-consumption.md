# Direct Consumption Evidence

**Feature**: `004-deepseek-explicit-dev-flow`
**Observation time**: 2026-08-15T13:57:25Z
**Classification**: contract research only; no native Harness process was started
**Support claim**: none

## Merge baseline — pending at the 003 merge barrier

Feature 003 is not yet merged into `main`. The merge commit, shared version seam, Codex-aware
contracts, root validator, repository `VERSION`, Core source identity, and fixture aggregate required
by T001/T007 are intentionally absent. No Feature 003 sibling-branch content was read or copied.
This section must be completed from merged `main` after a history-preserving merge and a clean
follow-up analysis.

## Official registry observation

The following read-only commands were run against the official npm registry:

```sh
npm view @deepseek-ai/dsh dist-tags versions repository dist --json
npm view @deepseek-ai/dsh-mcp-client@0.1.0-rc.6 \
  version repository dist dependencies peerDependencies --json
```

Registry result:

| Field | Observed value |
|---|---|
| `@deepseek-ai/dsh` `latest` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh` `next` | `0.1.0-rc.6` |
| All published `dsh` versions | `0.0.1-rc.1`, `0.0.1-rc.2`, `0.0.1-rc.5`, `0.1.0-rc.2`, `0.1.0-rc.3`, `0.1.0-rc.6` |
| Stable versions | none |
| `dsh@0.1.0-rc.6` integrity | `sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==` |
| `dsh@0.1.0-rc.6` SHA-1 | `de9fbf39056c7f4e658a3e284cb1d66ebc86d040` |
| downloaded `dsh` tarball SHA-256 | `1b8a9a0ad3c7feaece47926e0bd37ca151c7ccfa997953afa5fd01261784eadc` |
| `dsh-mcp-client@0.1.0-rc.6` integrity | `sha512-seBl0SLn308CbPwGVSm2BM3HECaNln3mbpcdHtw4DjnI5mZRILxC6wgKXAtYcNWKxMY1FaiwFWcgQ2+HHCQ7PQ==` |
| `dsh-mcp-client@0.1.0-rc.6` SHA-1 | `a743d7ad9d7d1899630df7f5f1b9fb22637c3fab` |
| downloaded MCP-client tarball SHA-256 | `88c3829e30b2bb2bcda7e9715c44f90863be45fc7efe8f52f1dac2227c87935b` |

Primary registry records:

- [`@deepseek-ai/dsh` registry metadata](https://registry.npmjs.org/@deepseek-ai/dsh)
- [`dsh@0.1.0-rc.6` official tarball](https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.0-rc.6.tgz)
- [`dsh-mcp-client@0.1.0-rc.6` official tarball](https://registry.npmjs.org/@deepseek-ai/dsh-mcp-client/-/dsh-mcp-client-0.1.0-rc.6.tgz)

The package's reviewed provisional dependency range is
`@deepseek-ai/dsh-mcp-client: ^0.1.0-rc.6`. It is bounded below `0.2.0`; it does not declare a final
Harness support range. The exact stable range remains a post-barrier Gate B decision.

## Exact artifact inspection

The downloaded artifacts were unpacked read-only. Exact RC6 file identities used for contract
inspection were:

| Artifact file | SHA-256 |
|---|---|
| `dsh/package.json` | `3736cbf834f99298c644da821dbb08878223065bdf19242d6c64768ac9e97fe2` |
| `dsh/lib/plugin-9h8shc4d.js` | `6f4459da44f0e5bdb3c72471f4be0ee1929913be352baf8b0da7b700afc1804c` |
| `dsh/lib/profile-boot-BnJoK_kl.js` | `778c5b338674d986a49972be920c965d28b2c8cac85364ae77f8587070397663` |
| `dsh-mcp-client/package.json` | `9fca063873462f4384bc2e87e27b563439e1f63a059f56dd9de168951f0750fb` |
| `dsh-mcp-client/lib/index.js` | `50ff18e787527a84bdaa569de9cbf68d2322941a870767030b52717b9c3322f1` |

Exact artifact observations:

- a bundle declares `dsh.bundle.patch` and contributes a patch layer;
- `dsh plugin --profile <name> <pnpm arguments...>` initializes an isolated profile, runs pnpm in
  that profile, and reconciles dependency packages that declare `dsh.bundle` into
  `dsh.profile.bundles`; consequently `add <artifact>` and `remove dev-flow-deepseek` are the
  supported add/remove shapes for this artifact;
- relative package specs are anchored to the invoking directory before pnpm runs;
- bundle layers compose before the profile patch, so add/remove must be followed by Harness
  stop/restart and resolved-profile readback;
- Skill invocation policy has independent `modelInvocable` and `userInvocable` booleans;
- the filesystem frontmatter spelling is exactly `disable-model-invocation` and `user-invocable`;
- STDIO MCP configuration uses `serverName`, `transport`, `command`, `args`, `env`, `cwd`,
  `toolCallTimeoutMs`, `failOnStartupError`, and `reconnect.enabled`;
- public names are `mcp__<serverName>__<rawName>`, while raw names are retained for wire calls;
- canonical MCP results retain content blocks and optional `structuredContent`; Native rendering
  joins text blocks, and MCP `isError` enters the registry error path;
- reconnect defaults enabled, so this feature sets `reconnect.enabled: false` explicitly.

### RC6 explicit-invocation capability gap

The exact `dsh-mcp-client@0.1.0-rc.6` artifact performs initial `tools/list` synchronization and
registers every derived public tool name directly with `ctx.tools.register(definition)` before the
first turn. Its exact configuration schema contains transport, server name, command/URL, timeout,
startup-failure, and reconnect controls, but no Skill-invocation visibility or authorization field.
The official MCP-client documentation likewise describes registration on the Harness tool runtime
before the first turn. The independent Skill policy controls whether Skill content may be selected
by the model/user; no first-party evidence connects that policy to the separately registered MCP
tools.

Consequently, the reviewed RC6 artifact cannot prove that ordinary or invalid prompts stop before
every Core call. Package-local Skill scans and fake-profile zero-call counters remain deterministic
logic evidence only and do not satisfy FR-015/FR-016 or SC-002. This finding is limited to exact RC6;
it is not extrapolated to a future stable artifact. The selected exact stable artifact must expose
and pass a first-party Host-enforced invocation-scope gate. Until then explicit-only integration is
blocked without a proxy or Core-contract workaround.

## Official repository observation and source-linkage gap

The official repository was cloned read-only at commit
[`47f943859bef60e4160492346772ded9b24f765a`](https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a).
Relevant file identities at that commit were:

| Official source | SHA-256 |
|---|---|
| `apps/cli/src/plugin.ts` | `263ca9cd68d6caa0fe637c0de4350503154565ef57b19331fedee388c9dc68e3` |
| `apps/cli/src/profile-boot.ts` | `4a89a793d0a793e7573d7b275d9682459fa2e211edc6814d23b90c75588fa663` |
| `packages/skill/skill-badge/src/index.ts` | `64f4636a21909bde14f58e45cbae2d8e0d4c6d5fd0b053452bff13ce7c993c86` |
| `packages/skill/skill-filesystem/src/index.ts` | `c4efa1969d630e5e4755f9866c5d49e4e071d923cf445156bd3eeb2a7072cc52` |
| `packages/mcp/mcp-client/src/index.ts` | `823220ce9d41e6645076e123b4bfbfcffc84afaeecd0c3f991cb4e48683b32af` |
| `packages/mcp/mcp-client/src/tools.ts` | `17a108175b4f5bbf8cb387c501b281d943829fb246c9f259aa26172c84669203` |
| `packages/mcp/mcp-client/src/connection.ts` | `95b1b4eb67047a81ad4cca6b8d3e673425a39726f5d15d5b85972ea6e5a1f870` |
| `packages/spill/spill-policy/src/index.ts` | `11855cef756f1bb686e643e85b8bfe0bfa865c75865702bee30edd4043e6848e` |
| `packages/spill/spill-local/src/index.ts` | `517691ce9bbc4a84516fd15d3c48012272d19d65063c6a9b51685f0b9c811000` |
| `packages/compaction/compaction-basic/src/index.ts` | `d902d83329a1eda4ed7e29aa459c1a9663a19d5b7d95c76af118cb2c510a2edd` |

Primary source paths:

- [profile plugin management](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/src/plugin.ts)
- [profile bundle composition](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/apps/cli/src/profile-boot.ts)
- [bundled Skill provider example](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/skill/skill-badge/src/index.ts)
- [MCP client configuration](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/src/index.ts)
- [MCP name/result bridge](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/mcp/mcp-client/src/tools.ts)
- [spill notice policy](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill-policy/src/index.ts)
- [local spill retrieval hint](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/spill/spill-local/src/index.ts)

The registry manifest has no `gitHead`, and the official repository currently exposes no tags.
Therefore no exact first-party statement connects `0.1.0-rc.6` to repository commit
`47f943859bef60e4160492346772ded9b24f765a`. Artifact-level findings above are exact; repository
source findings are current official contract context only. This source-linkage gap must be
revalidated for the selected stable artifact and must never be filled by inference.

## Spill, pruning, and direct-result consequence

The official spill notice has the form
`(Omitted <bytes> bytes. Full formatted result stored at: <locator>. <retrievalHint>)`; the local
spill service's hint instructs the agent to use read with offset/limit or grep. Compaction can
replace visible history. The MCP client also converts `isError` to the Harness error path and uses a
text projection for Native rendering even though the programmatic value preserves blocks.

These facts establish an incomplete-representation detector and deterministic six-case model, not
native completeness. An optional RC spike was not run. Final authority use still requires byte-for-
byte recovered canonical content, equal SHA-256, and a complete parse in all six cases on the exact
stable Harness used by the final journey. No stable artifact currently exists, so T018/T019 and the
stable Gate B/final journey remain pending; no projection layer or support claim is authorized.

## Research conclusion

- T002 contract research is complete for the 2026-08-15 observation.
- RC6 is sufficient for bounded deterministic implementation and no more.
- There is no external blocker for package-local/fake-host work independent of Host tool scoping.
- RC6's global tool registration blocks completion of explicit-only Host admission evidence; the
  exact selected stable artifact must be revalidated rather than assumed equivalent.
- Absence of a stable artifact is an external blocker for stable Gate B, the final artifact/journey,
  and any stable support or Feature 004 completion claim.
