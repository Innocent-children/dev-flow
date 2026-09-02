# Dev Flow Local WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> The local visualization and diagnostic entry for Dev Flow's durable Task state.

Control Center is embedded in Go Core and reads the same local Task data as the Hosts. The browser
does not retain a second process state; every read and operation goes through the current Core.

## What you can view

- the shared Task overview and filtered list across Hosts;
- current stage, scope, revision, Action, and legal next step;
- timeline, process graph, test and comprehension records, and the three most recent test attempts;
- Recovery assessment, automatic-brake Blocker, and the required recovery or continuation condition;
- Task Plan expected paths, cumulative Task-introduced paths, file-scope decisions, and unexplained paths;
- primary and additional repositories, including the advanced worktree view;
- current Core, data directory, and runtime status.

The interface supports Simplified Chinese and English. First use follows browser language, while a
manual choice remains only in the current browser and does not enter Core, Task, or account state.

After the automatic brake triggers, the page shows the exact repetition reason, retained resume
stage, and current resolution condition. It does not resolve on the developer's behalf. The developer
may explicitly allow one continuation or cancel the Task. If the next test repeats exactly, the Task
pauses again.

A file-scope blocker prefills the current blocker identity and repository observation, shows
`allow_once`, `expand_scope`, and `reject`, and requires a reason. The file-scope card also shows
ExpectedPaths count, Task-introduced paths, decision count, Host tools covered before writing, and
unexplained paths. The page distinguishes Host checks for structured tools from Core's final check
before testing and `DONE`; it does not claim to intercept Bash, external processes, or every
specialized tool.

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
directory. macOS enforces mode `0700`; Windows uses the ACL inherited from the current user's
`%LOCALAPPDATA%`. Other commands do not create directories.

An explicit data directory must already exist, canonicalize successfully, and not traverse a
symbolic link:

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
```

Windows PowerShell uses the same variable:

```powershell
$env:DEV_FLOW_DATA_DIR = "C:\absolute\existing-directory"
dev-flow webui start
```

## Local single-user boundary

The service binds only an OS-assigned `tcp4 127.0.0.1` port and exposes no remote-listen option.
Browser mutations verify exact Origin, a random session value from the current process, and the Task
revision. A stale page or changed revision invalidates an old form.

These checks protect against mistaken local requests and stale-page actions. They are not account
authentication or multi-user isolation.
macOS tightens default directories and the receipt with POSIX modes. Windows relies on the ACL
inherited from the current user profile and LocalAppData. A same-user or administrator process
remains inside the local trust boundary.

## What the runtime receipt does

A runtime receipt records the PID, process-start identity, data-root digest, and loopback URL. macOS
requires a mode-`0600` regular file. Windows requires a regular non-symlink file under the product
directory and uses process creation time to detect PID reuse. Compatible Core binaries carried by
Codex and DeepSeek use it to share one process and SQLite data instead of creating separate Task
state.

During stop or uninstall, a signal is sent only when PID, start identity, and data directory all
match the receipt. Windows first sends `CTRL_BREAK` to the separate process group; if another console
cannot deliver it or the process does not exit, only that exact matched process is terminated. A
failed identity check stops the remaining uninstall steps so an unrelated process or installation
is not removed.

## States

`status` distinguishes:

| State | Meaning |
| --- | --- |
| `ready` | Current Core and data are usable |
| `read_only` | Reads are available, but current mutations are not |
| `incompatible` | Current Core or runtime instance is incompatible |
| `unavailable` | No usable instance or status is available |

## Data and artifacts

Default Task data lives at `$HOME/Library/Application Support/dev-flow/data` on macOS and
`%LOCALAPPDATA%\dev-flow\data` on Windows. Codex and DeepSeek share it; it is not
browser cache or Host chat history. React, TypeScript, and Vite participate only in the build. HTML,
JavaScript, CSS, SVG, and the manifest are embedded in the Core binary, so runtime use needs no Node
server, CDN, external font, or separate WebUI package.
Each Host package selects macOS or Windows path, permission, process, and executable behavior through
its package-local platform implementation. WebUI and Core Task semantics contain no platform branch.

## Not currently supported

- remote access, accounts, team permissions, or cloud synchronization;
- shell, file editing, Git mutations, or publication; the page only submits Core file-scope decisions;
- user-defined graphs;
- treating the WebUI as another Task-state authority.

Consult [Project Status](PROJECT-STATUS_en.md) and the [Support Matrix](SUPPORT-MATRIX_en.md) to see
whether stable packages carry current source capability. See the
[Command Reference](COMMANDS_en.md) for exact CLI options and [Architecture](ARCHITECTURE_en.md) for
protocol design.
