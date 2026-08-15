# Contract: DeepSeek Harness Bundle and Lifecycle

## 1. Product and dependency baseline

- Product identity is exactly `dev-flow-deepseek`.
- The package is private/local; Feature 004 publishes nothing.
- Feature 004 starts from an exact `main` merge commit containing completed Feature 003.
- It consumes the merged detached-build version seam, Codex-aware shared contracts, and root
  validator without duplicate implementation or weakened Codex checks.
- Repository `VERSION`, package version, and packaged Core version remain aligned during `0.x`.
- Native support is macOS arm64 only.

## 2. Harness compatibility

A release candidate may support provisional engineering evidence only when no stable artifact
exists. Final support requires:

1. latest official stable compatible Harness selection;
2. exact version/build/integrity/source evidence and bounded range;
3. revalidated bundle/profile, Skill, MCP result, add/remove/restart contracts;
4. complete six-case Gate B evidence from that exact stable artifact;
5. the same exact stable artifact in the final journey.

A same-artifact stable gate may be revalidated/reused. RC or different-artifact evidence cannot
substitute. No stable artifact or failed stable Gate B blocks final support.

## 3. Packed contents

The final tarball contains exactly:

- one manifest and one supported bundle patch;
- one thin provider entry;
- one `dev-flow` Skill;
- one package-relative Core lifecycle launcher;
- one macOS arm64 Core executable;
- only reviewed official Harness dependencies.

It contains no database, profile, repository file, Core source, copied fixture, test fake, evidence,
proxy, generic shell wrapper, second Skill/MCP integration, second runtime, credential, or release
configuration.

No `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, download, publish, or release hook is
allowed. Installation never builds source or selects an unrelated executable from `PATH`.

## 4. Bundle patch

Use only exact field names, injection names, provider APIs, and settings verified against the
selected official artifact. The patch contributes:

1. one Skill provider whose sole user-facing Skill is `dev-flow`;
2. one official native local STDIO MCP client backed by the launcher.

Where officially supported, startup failure is nonfatal and automatic reconnect is disabled. The
patch mounts no HTTP, UI, agent preset, command family, shell MCP, remote transport, telemetry,
repository watcher, or second workflow service.

## 5. Profile add/remove

Use the implementation-time official product/profile add/remove commands in an isolated profile.
Stop/restart Harness after both operations and inspect resolved state.

Installed observation requires one `dev-flow` Skill and one six-tool integration. Removed observation
requires package dependency, product patch, Skill, and tools to be absent.

No undocumented cache purge is assumed. Stale metadata after supported restart stops for amendment.
Removal preserves:

- explicit/default Core data and tasks;
- target repository;
- unrelated profiles/dependencies;
- real co-installed Codex package selection, registration, runtime, and shared data.

Codex comparison is mandatory for final `pass`; inability to establish it produces blocked/failed
evidence.

## 6. Runtime identity

Use the merged Feature 003 version capability; do not edit/duplicate `internal/version`. Build one
CGo-free `darwin-arm64` Core with repository `VERSION` injected, stage it package-relative, and
verify CLI plus `dev_flow_server_info` outside the checkout.

Record merged Feature 003 commit/capabilities, Feature 004 source commit, product/Core versions,
Core source/binary digest, product digest, fixture aggregate, and exact stable Harness identity.
A Core contract mismatch stops; the adapter never patches around it.

## 7. Child environment and transport

The launcher:

- spawns package-relative Core without a shell;
- forwards raw stdin/stdout without parsing/projecting/truncating/retrying;
- emits bounded non-secret diagnostics on stderr;
- propagates EOF/signals/cancellation and reaps deterministically;
- opens no listener and makes no network request;
- reads/writes no task state.

Only present values from `DEV_FLOW_DATA_DIR`, `HOME`, `PATH`, `LANG`, `LC_ALL`, and `TMPDIR` are
forwarded. An explicit data root must already be usable; otherwise only the documented macOS default
is created with restrictive permissions. Profile lifecycle never owns that root.

## 8. Direct-result contract

A result is complete only when expected/recovered bytes and SHA-256 match and the complete envelope
parses. Preview, spill, prune, truncation, malformed, or inaccessible markers are detected before
authority use. Only the exact official retrieval method proven by Gate B is permitted.

Required cases are inline success, domain error, near-spill, spilled, pruned/compacted, and near-Core
limit. A failed gate stops for reviewed amendment and does not authorize a proxy.

## 9. Repository and evidence boundary

Invocation accepts one current existing Git worktree. Package/profile/build/data/evidence roots stay
outside it. Core inspects Git read-only; package/launcher/Core never create, switch, reset, clean,
stash, commit, push, tag, publish, or delete Git state.

Story checkpoints are deterministic/fake/integration and start no real Harness. Native execution is
bounded to an optional provisional gate, one complete stable gate, and one final stable journey.
The final artifact is built after stable Gate B, deterministic/root validation, audit, and source
freeze. Evidence validation is read-only.
