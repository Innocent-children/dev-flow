# Windows adaptation report

[中文](WINDOWS-ADAPTATION.md) | [English](WINDOWS-ADAPTATION_en.md)

## Scope and conclusion

This report preserves checks recorded for the Windows adaptation on 2026-09-07 and its local desktop distribution. It is not a current implementation plan or a new verification run. Current architecture is described in [Architecture](ARCHITECTURE_en.md), and installation in the [desktop pet guide](DESKTOP-PETS_en.md).

This change completes existing Windows 10/11 desktop x64 behavior for ordinary Intel and AMD x86-64 PCs. It excludes 32-bit x86, Windows ARM64, Server and special Windows environments.

Windows command encoding and Codex executable checks are fixed, intertwined Host platform logic is separated, and native Windows checks pass. Task state, nodes, transitions, Schema and the read-only Git boundary retain their existing design. No workflow, compatibility layer, migration or fallback reader is added.

No macOS tests were performed. Complete unified-entry packaging cross-compiles Mac Core through the existing target catalog without executing it. Existing macOS paths, permissions, signals, command invocation and pet installation logic were moved into separate implementations without changing their intended behavior; existing native macOS components were not edited. Structural review establishes separation, not a macOS runtime regression result.

## Native environment

- Date: 2026-09-07.
- System: Microsoft Windows 11 Pro, 10.0.26200, 64-bit.
- CPU: 13th Gen Intel Core i5-13600K.
- Tools: local Go 1.27.0, Node.js 24.18.0, Git for Windows, system Windows PowerShell and cmd.
- Core: native windows/amd64 build from the current workspace, CGO_ENABLED=0, version injected from CORE_VERSION, output outside the repository.

## Acceptance results

| Check | Actual coverage and result |
| --- | --- |
| Windows/Host targeted tests | 20 pass, 0 fail, 0 skipped; Chinese-path assessment, real temporary Git repositories, worktree preparation, failed fetch, one-shot dispatch receipts, Codex CLI argument parsing, native Core preflight for both Adapters, cmd/PowerShell hooks and recoverable cleanup |
| Native Windows WebUI | 1 pass; Chinese and spaced data path, start, PID reuse on repeated start, HTTP status, status, stop and reopening SQLite |
| Windows verification archives | 1 pass; all three packages staged, archived, extracted and compared byte-for-byte, platform modules loaded, Codex/manager version commands and DeepSeek Core preflight executed |
| Targeted Go packages | internal/repository, internal/webui, cmd/dev-flow, internal/store, internal/mcp and internal/version pass on native Windows |
| Platform structure | 3 pass; no OS decisions in Core semantics, Host consumers use policies, platform directories do not import each other or select an OS again |
| Package metadata | Codex closed manifest inventory, DeepSeek closed manifest inventory and source archive inventory pass |
| Tools and versions | npm --version succeeds through the actual Windows launcher; version synchronization passes |
| Documentation and formatting | 294 local links in 35 changed documents checked; Go formatting and git diff --check pass |

The verification archives contain only Windows Core. They test assembly and native execution and are not publishable dual-runtime packages. No fake macOS binary was used, and the standalone release flow was not invoked.

## Reproduction

Build the current Windows Core outside the repository, add Go to the PowerShell PATH and point DEV_FLOW_WINDOWS_CORE at that executable.

~~~powershell
$env:DEV_FLOW_WINDOWS_CORE = "C:\verification\dev-flow.exe"
node --test packages/codex/tests/windows-support.test.mjs packages/codex/tests/windows-command.test.mjs packages/codex/tests/task-admission.test.mjs packages/codex/tests/task-launch.test.mjs packages/deepseek/tests/windows-support.test.mjs packages/deepseek/tests/workspace-coordinator.test.mjs packages/dev-flow/tests/windows-support.test.mjs
node --test packages/codex/tests/windows-webui.test.mjs packages/codex/tests/windows-package.test.mjs
go test ./internal/repository ./internal/webui ./cmd/dev-flow ./internal/store ./internal/mcp ./internal/version
go test ./tests/contract -run 'TestCoreSemanticPackagesContainNoOperatingSystemDecision|TestNodeConsumersUseClosedPlatformImplementations|TestHostPlatformImplementationsRemainSeparate'
node scripts/check-versions.mjs
~~~

Tests use temporary directories and repositories. Worktree/branch creation, fetch and cleanup run only inside fixtures and do not change the project's Git branch, commits, Tags or remotes. The actual Codex CLI check only parses help arguments and does not create a session.

## Limits and non-goals

Windows 10 and AMD processors are implementation targets but were not available for native verification. No macOS tests, complete Codex/DeepSeek user Task sessions, npm publication, Git Tag or Release operations were performed. Complete packages include cross-compiled Mac Core; machine installation and isolated uninstall/reinstall were verified. Stable support claims remain unchanged.

This adaptation covers Windows Core, Codex/DeepSeek Adapters, the unified lifecycle entry, WebUI and the Windows desktop pet described below. The affected platform responsibilities are separated, but future shared-code changes still require regression checks on each platform; file separation cannot guarantee the absence of regressions.

## Windows desktop feature parity

The adaptation now includes a separate Windows desktop pet covering the macOS user-facing features: paginated task selection, status and retained disconnected records, separate task-update and last-sync times, WebUI navigation, tray/context menus, static and native animated PNG/SVG artwork, Codex format 1/2 PNG/WebP atlases and high-resolution extensions, nine actions, six scales, dragging, hide/restore, system sleep handling and independent start/stop.

The Windows implementation lives in packages/desktop-pet/windows, with its runtime dependencies maintained in that directory's lockfile. macOS Swift/AppKit and its existing build entry remain unchanged. Both desktops share artwork and read-only Core interfaces, not OS windows, process control or installation implementations. This desktop addition makes no further Core, graph, Schema or product-version changes.

| Check | Actual result |
| --- | --- |
| Targeted Windows desktop checks | 6 new checks pass; combined with the earlier 22, all 28 targeted checks pass: Core display/disconnection, default 9 clips/312 frames, restricted SVG and failed-reimport retention, concurrent preferences, Windows menu/architecture selection and preserving installed apps/settings; the installer unit check uses an explicitly labeled file fixture |
| Native Windows desktop | Actual window and transparent capture, Chinese bubble, six scales, hide/restore and the real Core/WebUI empty task list pass; constructed display inputs exercise nine artwork clips and are not represented as actual Task completion records |
| Native atlas import | Format 1 PNG, format 2 WebP and high-resolution PNG import and switch successfully, preserving nine actions, 57 frames, source resolution and per-frame timing |
| Native instance/shutdown | ready and restored acknowledgments pass; a stop filtered to a different Core retains the current process; normal stop preserves WebUI, preferences and imported artwork |
| Local package | Windows-only assembly, runtime inclusion, byte-checked default artwork, archive/extraction and actual desktop execution pass; no publication or global installation replacement |

The source entry is scripts/build-desktop-pet-windows.mjs; see the [desktop pet guide](DESKTOP-PETS_en.md#windows-local-build-and-installation). desktop-pet-build.json records the package and digest in the output directory; desktop.png, native-result.json, lifecycle-result.json and cli-result.json retain the native observations.

Mouse dragging and actual system sleep/wake have not completed manual interaction verification; their Windows event handlers are implemented. Windows 10, AMD hardware and complete Codex/DeepSeek Task sessions remain unverified. The desktop-specific checks performed no macOS build or test; subsequent unified-distribution checks included Mac Core cross-compilation. None of these results expanded public stable support claims.

## Actual unified-entry acceptance

Unified-entry checks used a local distribution containing both complete Adapter packages and the Windows desktop.

Using isolated npm, CODEX_HOME, DSH_HOME and product-data directories with real Codex, DSH and dev-flow commands, checks covered install, pet start, repeated start, reinstall while the pet was running, doctor, uninstall and install again. No registration was written manually. Retained preferences were checked after uninstall. First pet startup returned in about 1.25 seconds and repeated startup in about 0.69 seconds, fixing the earlier timeout-dependent return.

The machine configuration then followed the same npm launcher bootstrap, dev-flow install --host all --profile web --yes, status and pet start. At the recorded check, Codex and DeepSeek web were ready and the pet was running. Windows installer code identifies file-holding MCP instances by the target package image, command and creation time; no manual process-stop step is required.

Complete packages no longer omit Mac Core. Cross-compilation and package checks do not execute Mac programs or Mac tests. No npm publication or public stable-version change was performed.
