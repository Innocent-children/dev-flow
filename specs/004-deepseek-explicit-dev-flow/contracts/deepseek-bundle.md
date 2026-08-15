# Contract: DeepSeek Harness Bundle and Lifecycle

## 1. Product and Compatibility

- Package identity is exactly `dev-flow-deepseek`.
- The package remains private and locally packable; this feature performs no npm/GitHub release.
- Repository `VERSION`, package version, and embedded Core version remain aligned during `0.x`.
- Planning-time engineering evidence is `@deepseek-ai/dsh` `0.1.0-rc.6` with provisional range
  `>=0.1.0-rc.6 <0.2.0-0`.
- That pre-release range is not a stable support claim. Before the final journey, the implementer
  MUST select and record the latest official stable compatible Harness available then. If none
  exists, the final journey stops under Gate A.
- Supported platform evidence is macOS arm64 only.

## 2. Packed Product Contents

The final local tarball contains:

- one manifest with a supported `dsh.bundle.patch` reference;
- one bundle patch;
- one thin provider/registration entry;
- exactly one `dev-flow` Skill resource;
- one package-relative Core lifecycle launcher;
- one macOS arm64 Core executable built from the recorded repository identity; and
- only the first-party Harness runtime dependencies required by the revalidated stable contract.

The final tarball contains no database, target-repository file, Core source copy, projection proxy,
generic shell wrapper, second Skill, second MCP integration, generated test repository, evidence
secret, or publication credential.

The manifest MUST NOT define `preinstall`, `install`, `postinstall`, `prepare`, `prepack`, publish,
release, or download behavior. Installation never builds source, contacts a Dev Flow service, or
selects an unrelated Core executable from `PATH`.

## 3. Bundle Patch

The bundle uses the implementation-time official profile bundle contract. Its patch contributes
exactly:

1. one Skill provider whose sole user-facing Skill is `dev-flow`; and
2. one official native MCP client configured for one local STDIO server backed by the lifecycle
   launcher.

The client uses the official nonfatal startup setting (`failOnStartupError: false`) and disables
automatic reconnect (`reconnect.enabled: false`) so an unavailable Core does not reject unrelated
Harness use or create an adapter-controlled respawn loop. Recovery is an explicit host restart or
bundle reload, not an infinite background retry.

The exact plugin names, injection names, and patch keys MUST be copied from and tested against the
official stable Harness artifact selected at implementation time. Planning-time source examples are
evidence, not permission to invent a missing field. Any incompatible change stops implementation
until `research.md` and this contract are amended.

The patch MUST NOT mount an HTTP server, browser/UI, agent preset, generic shell MCP, remote
transport, second workflow service, telemetry client, or repository watcher.

## 4. Profile Add and Remove

Installation into an isolated profile uses the official command form:

```text
dsh plugin --profile <profile> add <local-package-spec>
```

Removal uses product identity:

```text
dsh plugin --profile <profile> remove dev-flow-deepseek
```

After both operations, Harness is stopped and restarted before the resolved profile is inspected.
Installed observation requires exactly one `dev-flow` Skill plus one six-tool MCP integration.
Removed observation requires the package dependency, product-owned patch layer, Skill, and tools to
be absent.

No undocumented cache-purge command is assumed. If the restarted host still exposes stale metadata,
record the exact official behavior and stop for a contract amendment rather than deleting arbitrary
cache directories.

Removal MUST preserve:

- `DEV_FLOW_DATA_DIR` or the default shared data root;
- Core task rows and repository claims/outcomes already in that root;
- the target Git repository;
- other Harness profiles and unrelated dependencies; and
- Codex package/runtime selection when present.

## 5. Core Runtime Selection and Identity

Feature 003 T005/T006 are the sole implementation owners of the shared link-time `buildVersion`
tests/seam in `internal/version/version_test.go` and `internal/version/version.go`. It retains the source-tree
`VERSION` fallback and changes no public Core contract. Feature 004 MUST verify that prerequisite,
MUST NOT duplicate it, and may not perform the final package build until its tests pass.

The repository build then stages one `CGO_ENABLED=0`, `GOOS=darwin`, `GOARCH=arm64` Core executable
with repository `VERSION` injected at link time. The lifecycle launcher resolves only that
package-relative path. Feature 004's final build waits for Feature 003 T006. The staged binary MUST
report that version through both `dev-flow version`
and `dev_flow_server_info` when run without the repository source tree. Before packing and in the
final journey, validation records:

- repository source identity;
- repository `VERSION`;
- Core-reported version and schema version;
- executable SHA-256;
- package SHA-256; and
- aggregate shared-fixture SHA-256.

The fixture aggregate sorts repository-relative JSON paths bytewise, renders every line as
`<file-sha256><two spaces><repository-relative-path>\n`, and hashes the complete manifest bytes.

`dev_flow_server_info` MUST report a compatible Contract 0.1, local STDIO transport, supported
`deepseek` host, and exactly the six raw tool names before task discovery or mutation. A mismatch is
fatal to Dev Flow startup/invocation and MUST NOT be patched around by the adapter.

## 6. Child Environment and Transport

The lifecycle launcher:

- spawns the package-relative Core without a shell;
- forwards stdin/stdout bytes without parsing, projecting, truncating, or retrying MCP messages;
- emits only bounded, non-secret startup diagnostics on stderr;
- forwards EOF and termination signals and waits for the child to exit;
- kills/reaps the child when the outward transport is cancelled or closed;
- opens no listening socket and initiates no network request; and
- never reads or writes task state itself.

The Core child receives a newly constructed environment containing only present values from:

```text
DEV_FLOW_DATA_DIR
HOME
PATH
LANG
LC_ALL
TMPDIR
```

No other host variable is forwarded. Diagnostics MUST NOT print environment values, credentials,
full user input, task payloads, source content, database paths, or raw Core output.

An explicit `DEV_FLOW_DATA_DIR` is preserved and must already name a usable directory. Otherwise
the launcher derives `~/Library/Application Support/dev-flow/data` on macOS and creates that default
with user-only permissions on first Core launch. Profile add/remove never creates or deletes the
shared directory, and the launcher never writes Core task state itself.

## 7. Repository Boundary

- Invocation accepts one current existing Git worktree only.
- Package resolution, profile writes, staged binaries, tarballs, temporary data, and evidence files
  remain outside the target repository.
- Core may inspect Git read-only under its existing contract.
- Neither bundle nor launcher creates, switches, resets, cleans, stashes, commits, pushes, tags,
  publishes, or deletes Git state.
- Development edits authorized by a fresh Core action are performed by the host's normal tools, not
  by the MCP server.

## 8. Failure Contract

Missing, incompatible, non-executable, or prematurely exiting Core runtime produces a bounded
Dev Flow startup diagnostic. It does not expose secrets, fabricate an MCP result, retry forever, or
turn into a host-specific terminal outcome. Where the selected official Harness supports nonfatal
plugin/MCP startup failure, unrelated Harness operation remains usable; the real journey records
the observed host behavior rather than claiming more.

If the direct-result gate fails, startup still does not insert a proxy. Implementation stops for a
reviewed amendment.
