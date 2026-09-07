# Windows adaptation report

[中文](WINDOWS-ADAPTATION.md) | [English](WINDOWS-ADAPTATION_en.md)

## Scope and conclusion

This change completes existing Windows 10/11 desktop x64 behavior for ordinary Intel and AMD x86-64 PCs. It excludes 32-bit x86, Windows ARM64, Server and special Windows environments.

Windows command encoding and Codex executable checks are fixed, intertwined Host platform logic is separated, and native Windows checks pass. Task state, nodes, transitions, Schema and the read-only Git boundary retain their existing design. No workflow, compatibility layer, migration or fallback reader is added.

No macOS tests were performed. Complete unified-entry packaging cross-compiles Mac Core through the existing target catalog without executing it. Existing macOS paths, permissions, signals, command invocation and pet installation logic were moved into separate implementations without changing their intended behavior; existing native macOS components were not edited. Structural review establishes separation, not a macOS runtime regression result.

## Problem and design basis

All three Node packages mixed both platforms' policies in one file, while Host path, permission and lifecycle consumers still contained concrete operating-system branches. Codex version and status commands omitted the Windows executable policy during Core preflight. Windows PowerShell encoded redirected output in the local code page and corrupted Chinese text. Core Git observation from desktop hosts did not explicitly hide child consoles.

Previously, Windows users depended on partial path handling or had to bypass failing entry points and run Core directly. This work repairs existing interfaces while preserving macOS behavior. Decisions are grounded in current source, manifests, parsers, temporary Git worktrees and actual Windows process results, rather than Host completion narratives.

Platform mechanisms belong to their respective implementations; Core retains sole Task authority. A false rejection blocks a valid Windows Core, while a false allowance may hide a missing file. The implementation therefore retains file existence, type, path and execution checks, and omits only POSIX executable-bit requirements on Windows. Runtime selection still accepts exactly the existing two pairs.

## Responsibilities and implementation

| Responsibility | Current result |
| --- | --- |
| Platform-neutral Core | Domain, Workflow, Application and Recovery contain no operating-system decisions; process digest and Schema are unchanged |
| Core process implementation | Git observation calls a platform configuration function; Windows sets HideWindow and darwin performs no operation, preserving its previous behavior |
| Host platform selection | Each lib/platform.mjs selects an implementation; runtime, path, permission, signal and cleanup policies reside in platform/windows/ and platform/macos/ |
| Host paths | Codex/DeepSeek paths and manager ownership consume the selected policy, preserving Windows LocalAppData and macOS home-directory rules |
| Host commands | Codex and the unified launcher isolate command discovery and Windows npm shim invocation; Windows PowerShell uses UTF-8, literal encoded arguments and preserved exit status |
| Codex entry points | --version and status pass requireExecutableMode into preflight; Windows checks the file and actual execution without requiring POSIX executable bits |
| DeepSeek receipts | Permission checks consume permissionPolicy instead of branching on the operating system |
| macOS pet | Codex installation moves into platform/macos/pet-installer.mjs; the manager selects the installer through the platform capability, and Windows does not enter it |
| Build and package contents | Three manifests, Codex staging inventory, archive checks and package tests include the new platform modules |
| Core version | CORE_VERSION receives a PATCH increment and its two checked machine fixtures are synchronized; npm versions and public release metadata remain unchanged |

Four files were already modified at the start: packages/codex/lib/platform.mjs, packages/codex/lib/task-admission.mjs, packages/codex/tests/task-admission.test.mjs and packages/deepseek/tests/workspace-coordinator.test.mjs. Their Windows Git path normalization, Chinese-path coverage and fixture line-ending setting are preserved. Path normalization moved into the Windows implementation during separation.

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

Mouse dragging and actual system sleep/wake have not completed manual interaction verification; their Windows event handlers are implemented. Windows 10, AMD hardware and complete Codex/DeepSeek Task sessions remain unverified. No macOS test or build was performed, and public stable support claims remain unchanged.

## Actual unified-entry acceptance

The earlier Adapter-only installation and manual registration repair are not the final delivery of this pass. The current distribution contains both complete Adapter packages and the Windows desktop, all managed by the unified entry.

Using isolated npm, CODEX_HOME, DSH_HOME and product-data directories with real Codex, DSH and dev-flow commands, checks covered install, pet start, repeated start, reinstall while the pet was running, doctor, uninstall and install again. No registration was written manually. Retained preferences were checked after uninstall. First pet startup returned in about 1.25 seconds and repeated startup in about 0.69 seconds, fixing the earlier timeout-dependent return.

The machine configuration then followed the same npm launcher bootstrap, dev-flow install --host all --profile web --yes, status and pet start. Codex and DeepSeek web are ready and the pet is running. Windows installer code identifies file-holding MCP instances by the target package image, command and creation time; no manual process-stop step is required.

Complete packages no longer omit Mac Core. Cross-compilation and package checks do not execute Mac programs or Mac tests. No npm publication or public stable-version change was performed.

## Changed paths

Actual changed paths follow; no commit or publication was performed.

- `CORE_VERSION`
- `README.md`
- `README_de.md`
- `README_es.md`
- `README_fr.md`
- `README_ja.md`
- `README_ko.md`
- `README_pt-BR.md`
- `README_zh-CN.md`
- `README_zh-TW.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_en.md`
- `docs/CODEX_en.md`
- `docs/COMMANDS.md`
- `docs/COMMANDS_en.md`
- `docs/DEEPSEEK_en.md`
- `docs/DESKTOP-PETS.md`
- `docs/DESKTOP-PETS_en.md`
- `docs/PRODUCT.md`
- `docs/PRODUCT_en.md`
- `docs/SUPPORT-MATRIX.md`
- `docs/SUPPORT-MATRIX_en.md`
- `docs/TOOLCHAIN-BASELINES.md`
- `docs/WEBUI.md`
- `docs/WEBUI_en.md`
- `docs/WINDOWS-ADAPTATION.md`
- `docs/WINDOWS-ADAPTATION_en.md`
- `docs/WINDOWS-PARITY.md`
- `docs/WINDOWS-PARITY_en.md`
- `internal/README.md`
- `internal/README_en.md`
- `internal/repository/git_observer.go`
- `internal/repository/process_darwin.go`
- `internal/repository/process_windows.go`
- `internal/repository/process_windows_test.go`
- `internal/webui/assets/generated/assets/index-C550w0rZ.js`
- `internal/webui/assets/generated/assets/index-D4HxSYuq.css`
- `internal/webui/assets/generated/index.html`
- `internal/webui/assets/generated/manifest.json`
- `internal/webui/runtime_windows.go`
- `packages/codex/README.md`
- `packages/codex/bin/dev-flow-codex.mjs`
- `packages/codex/lib/command.mjs`
- `packages/codex/lib/lifecycle.mjs`
- `packages/codex/lib/paths.mjs`
- `packages/codex/lib/platform.mjs`
- `packages/codex/lib/platform/macos/command.mjs`
- `packages/codex/lib/platform/macos/pet-installer.mjs`
- `packages/codex/lib/platform/macos/policies.mjs`
- `packages/codex/lib/platform/windows/command.mjs`
- `packages/codex/lib/platform/windows/policies.mjs`
- `packages/codex/lib/task-admission.mjs`
- `packages/codex/package.json`
- `packages/codex/tests/fixtures/graph-method-profiles.json`
- `packages/codex/tests/package-contract.test.mjs`
- `packages/codex/tests/task-admission.test.mjs`
- `packages/codex/tests/task-launch.test.mjs`
- `packages/codex/tests/windows-command.test.mjs`
- `packages/codex/tests/windows-package.test.mjs`
- `packages/codex/tests/windows-webui.test.mjs`
- `packages/deepseek/README.md`
- `packages/deepseek/lib/paths.mjs`
- `packages/deepseek/lib/platform.mjs`
- `packages/deepseek/lib/platform/macos/policies.mjs`
- `packages/deepseek/lib/platform/windows/policies.mjs`
- `packages/deepseek/lib/provisioning-receipt.mjs`
- `packages/deepseek/package.json`
- `packages/deepseek/tests/package-contract.test.mjs`
- `packages/deepseek/tests/workspace-coordinator.test.mjs`
- `packages/desktop-pet/windows/appearance.cjs`
- `packages/desktop-pet/windows/decode.html`
- `packages/desktop-pet/windows/main.cjs`
- `packages/desktop-pet/windows/observation.cjs`
- `packages/desktop-pet/windows/package-lock.json`
- `packages/desktop-pet/windows/package.json`
- `packages/desktop-pet/windows/preload.cjs`
- `packages/desktop-pet/windows/storage.cjs`
- `packages/desktop-pet/windows/tests/contracts.test.cjs`
- `packages/desktop-pet/windows/tests/native.cjs`
- `packages/desktop-pet/windows/view.css`
- `packages/desktop-pet/windows/view.html`
- `packages/desktop-pet/windows/view.js`
- `packages/dev-flow/README.md`
- `packages/dev-flow/lib/cli.mjs`
- `packages/dev-flow/lib/command.mjs`
- `packages/dev-flow/lib/hosts/codex.mjs`
- `packages/dev-flow/lib/lifecycle.mjs`
- `packages/dev-flow/lib/local-packages.mjs`
- `packages/dev-flow/lib/ownership.mjs`
- `packages/dev-flow/lib/pet.mjs`
- `packages/dev-flow/lib/plan.mjs`
- `packages/dev-flow/lib/platform.mjs`
- `packages/dev-flow/lib/platform/macos/command.mjs`
- `packages/dev-flow/lib/platform/macos/maintenance.mjs`
- `packages/dev-flow/lib/platform/macos/policies.mjs`
- `packages/dev-flow/lib/platform/windows/command.mjs`
- `packages/dev-flow/lib/platform/windows/maintenance.mjs`
- `packages/dev-flow/lib/platform/windows/pet-installer.mjs`
- `packages/dev-flow/lib/platform/windows/pet.mjs`
- `packages/dev-flow/lib/platform/windows/policies.mjs`
- `packages/dev-flow/lib/presentation.mjs`
- `packages/dev-flow/package.json`
- `packages/dev-flow/tests/cli.test.mjs`
- `packages/dev-flow/tests/codex-driver.test.mjs`
- `packages/dev-flow/tests/local-packages.test.mjs`
- `packages/dev-flow/tests/package-contract.test.mjs`
- `packages/dev-flow/tests/pet.test.mjs`
- `packages/dev-flow/tests/windows-pet.test.mjs`
- `protocol/fixtures/graph-server-info.json`
- `scripts/README.md`
- `scripts/README_en.md`
- `scripts/build-codex-local.sh`
- `scripts/build-desktop-pet-windows.mjs`
- `scripts/validate-repository.sh`
- `tests/contract/platform_boundary_test.go`
