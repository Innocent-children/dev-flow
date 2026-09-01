# Dev Flow Local WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> The local visualization and diagnostic entry for Dev Flow's durable Task state.

Control Center is embedded in Go Core and reads the same local Task data as the Hosts. The browser
does not retain a second process state; every read and operation goes through the current Core.

## What you can view

- the shared Task overview and filtered list across Hosts;
- current stage, scope, revision, Action, and legal next step;
- timeline, process graph, test records, and comprehension records;
- Recovery assessment, Blocker, and required recovery condition;
- primary and additional repositories, including the advanced worktree view;
- current Core, data directory, and runtime status.

The interface supports Simplified Chinese and English. First use follows browser language, while a
manual choice remains only in the current browser and does not enter Core, Task, or account state.

## Start, open, inspect, and stop

Use the unified entry:

```bash
dev-flow webui start
dev-flow webui status
dev-flow webui open
dev-flow webui stop
```

`start` opens the browser by default; `--no-open` starts only the process. Every command supports
`--plain` or `--json`. Public `dev-flow webui start` may create a missing product-default data
directory with mode `0700`; other commands do not create directories.

An explicit data directory must already exist, canonicalize successfully, and not traverse a
symbolic link:

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
```

## Local single-user boundary

The service binds only an OS-assigned `tcp4 127.0.0.1` port and exposes no remote-listen option.
Browser mutations verify exact Origin, a random session value from the current process, and the Task
revision. A stale page or changed revision invalidates an old form.

These checks protect against mistaken local requests and stale-page actions. They are not account
authentication or multi-user isolation.

## What the runtime receipt does

A mode-`0600` runtime receipt records the PID, process-start identity, data-root digest, and loopback
URL. Compatible Core binaries carried by Codex and DeepSeek use it to share one process and SQLite
data instead of creating separate Task state.

During stop or uninstall, a signal is sent only when PID, start identity, and data directory all
match the receipt. A failed check stops the remaining uninstall steps so an unrelated process or
installation is not removed.

## States

`status` distinguishes:

| State | Meaning |
| --- | --- |
| `ready` | Current Core and data are usable |
| `read_only` | Reads are available, but current mutations are not |
| `reset_required` | The data Schema is incompatible and requires a reset plan |
| `incompatible` | Current Core or runtime instance is incompatible |
| `unavailable` | No usable instance or status is available |

## Resetting old data

Incompatible or pre-graph data follows `reject-and-reset`. Ordinary startup performs zero writes and
returns `reset_required`. Reset is CLI-only; the browser has no reset operation:

```bash
dev-flow webui reset
dev-flow webui reset --confirm <TOKEN-FROM-CURRENT-PLAN>
```

The first command only lists the exact current canonical database and existing SQLite sidecars. The
token is bound to those targets. Confirmation obtains exclusive database access and rechecks every
target. Lock failure, token mismatch, or target drift deletes nothing. Success clears only confirmed
Task data and creates the current empty Schema; Host packages, registrations, user configuration,
and unrelated files remain.

## Data and artifacts

Default Task data lives in the local product data directory. Codex and DeepSeek share it; it is not
browser cache or Host chat history. React, TypeScript, and Vite participate only in the build. HTML,
JavaScript, CSS, SVG, and the manifest are embedded in the Core binary, so runtime use needs no Node
server, CDN, external font, or separate WebUI package.

## Not currently supported

- remote access, accounts, team permissions, or cloud synchronization;
- shell, file editing, Git mutations, or publication;
- browser-based reset;
- user-defined graphs or automatic historical-data migration;
- treating the WebUI as another Task-state authority.

Consult [Project Status](PROJECT-STATUS_en.md) and the [Support Matrix](SUPPORT-MATRIX_en.md) to see
whether stable packages carry current source capability. See the
[Command Reference](COMMANDS_en.md) for exact CLI options and [Architecture](ARCHITECTURE_en.md) for
protocol design.
