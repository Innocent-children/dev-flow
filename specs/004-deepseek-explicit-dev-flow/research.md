# Phase 0 Research: DeepSeek Explicit Dev Flow

**Feature**: `004-deepseek-explicit-dev-flow`  
**Research date**: 2026-08-15  
**Evidence rule**: Use first-party DeepSeek repository and official npm registry evidence only;
revalidate every volatile host contract against the exact artifact used by a gate or final journey.

## Outcome

Planning found a developer-preview Harness and a release-candidate npm artifact, but no stable
support artifact. Release-candidate facts therefore support only provisional engineering evidence.
Stable support requires the exact final stable Harness to pass the complete result gate and the
final journey.

Feature 004 also consumes capabilities delivered by Feature 003. That dependency is satisfied only
by an exact merge commit on `main`, never by Feature 003 task numbers or an unmerged sibling branch.

## Decision 1 — Consume the merged Feature 003 baseline

Before implementation record:

- Feature 003 merge commit;
- merged `internal/version` source/test identities;
- merged Codex-aware manifest/layout contracts;
- merged Codex-aware root validator;
- root `VERSION`, Core source identity, and shared fixture aggregate;
- targeted verification result from that exact commit.

Feature 004 verifies and consumes these capabilities. It does not edit/duplicate the shared version
seam or weaken Codex checks. A shared gap is fixed in its owning Feature 003/Core specification.

## Decision 2 — Separate provisional and stable Harness evidence

Planning-time evidence exposed `@deepseek-ai/dsh@0.1.0-rc.6` and described Harness as a developer
preview. A reviewed release candidate may be used for one bounded direct-result spike only when no
stable artifact exists. Its classification is `pre-release-native`; it establishes no support.

Before final evidence:

1. select the latest official stable compatible Harness;
2. record exact version/build/integrity/source evidence and bounded range;
3. revalidate bundle/profile, Skill, MCP result, add/remove/restart, and stale-metadata behavior;
4. ensure all six direct-result cases have complete evidence from that exact stable artifact;
5. use that same exact stable artifact for the final journey.

When Phase 2 already ran the full gate on the same stable artifact and the final revalidation proves
its identity/contract are unchanged, that evidence may be reused. RC or different-artifact evidence
never substitutes. With no stable artifact, Feature 004 may remain provisional but cannot complete.

First-party source families:

- official DeepSeek Harness repository;
- official npm metadata for `@deepseek-ai/dsh`;
- official CLI/profile bundle references;
- official Skill, MCP client, spill, compaction, and subprocess packages.

## Decision 3 — Use the official profile bundle mechanism

Package one private `dev-flow-deepseek` bundle. Add/remove uses the implementation-time official
profile commands and an isolated profile. Harness is stopped/restarted after each operation before
resolved-profile inspection.

No direct copying into repository/user integration directories and no invented cache-purge command
is authorized. Stale metadata after the supported restart stops for amendment.

## Decision 4 — Register one explicit-only Skill

Expose one `dev-flow` Skill with the official equivalent of user-invocable true, model-invocable
false, and explicit `/dev-flow` selection. Ordinary, empty/conversational, non-Git, and
multi-repository inputs create no task.

## Decision 5 — Prefer direct native MCP and prove complete results

Mount the packaged Core through the official local STDIO MCP client and expose exactly the six Core
Contract 0.1 tools.

The gate covers:

1. inline success;
2. complete domain error / MCP `isError`;
3. near-spill;
4. spilled;
5. pruned/compacted;
6. near the Core 1,048,576-byte envelope limit.

Each case records the exact Harness artifact, host representation, incomplete marker, official
retrieval method, expected/recovered byte counts, expected/recovered SHA-256, and complete parse.
Display text that looks sufficient is not proof.

A failed gate does not authorize a proxy. It requires a reviewed specification, plan, contract,
test, and Constitution amendment describing the observed limitation and minimum transformation.

## Decision 6 — Use one transport-transparent launcher

A small JavaScript launcher resolves only package-relative Core, constructs a closed child
environment, spawns without a shell, forwards raw STDIO, propagates EOF/signals/cancellation,
waits/reaps, opens no listener, and makes no network request.

Allowed present environment keys are:

- `DEV_FLOW_DATA_DIR`
- `HOME`
- `PATH`
- `LANG`
- `LC_ALL`
- `TMPDIR`

The launcher never parses task/MCP results, persists state, retries workflow operations, or decides
recovery/completion.

## Decision 7 — Package one macOS arm64 Core runtime

Using the merged Feature 003 seam, build one CGo-free macOS arm64 Core with repository `VERSION`
injected. Verify CLI and `dev_flow_server_info` after moving the binary outside the checkout.

No install-time build, first-use download, unrelated `PATH` runtime, publication, or Windows/Linux
claim is authorized.

## Decision 8 — Keep profile, data, repository, and Codex ownership separate

An explicit existing `DEV_FLOW_DATA_DIR` takes precedence; otherwise only the documented macOS
default is created with restrictive permissions. Profile add/remove never owns task data.

Passing final removal evidence proves the DeepSeek profile layer is absent, Core data/repository are
preserved, compatible reinstall works, and a real co-installed Codex package, registration,
runtime selection, and shared data are unchanged. Codex absence blocks pass.

## Decision 9 — Bound native execution and final ordering

Story checkpoints are deterministic/fake/integration only. Native execution is limited to an
optional provisional Gate B, one complete stable Gate B for the final artifact selection, and one
final stable journey.

The product artifact is built only after stable Gate B, deterministic/root validation, a read-only
scope audit, and source freeze. A source change invalidates the artifact; evidence failures are not
repaired by manual editing.
