# Feature Specification: Unified CLI Manager

**Feature Branch**: `feat/unified-cli-manager`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "I need a single command to manage the full lifecycle of Codex and DeepSeek plugins, including install, uninstall, reinstall, clean plugin data, and upgrade. All user-facing functions should be included. Mode A (TUI) and Mode B (CLI arguments) should be supported."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive Installation Wizard (Mode A) (Priority: P1)

Users running the CLI without arguments are presented with an interactive menu to guide them through the lifecycle actions.

**Why this priority**: Solves the immediate pain point of users having to read long READMEs and assemble complex commands for installation.
**Independent Test**: Can be fully tested by running `npx @dev-flow/cli` with no arguments, navigating the TUI to install the Codex or DeepSeek adapter, and verifying the adapter is successfully installed.

**Acceptance Scenarios**:
1. **Given** a fresh system without Dev Flow adapters, **When** the user runs `npx @dev-flow/cli`, **Then** they see a menu with options like "Install", "Uninstall", "Clean", "Status".
2. **Given** the user selects "Install" and then "DeepSeek", **Then** the CLI automatically executes the necessary npm pack and dsh plugin add commands in the background and reports success.

---

### User Story 2 - Headless Command Execution (Mode B) (Priority: P1)

Advanced users or CI/CD pipelines can execute lifecycle commands directly by passing arguments.

**Why this priority**: Essential for users who know what they want and for automation.
**Independent Test**: Can be tested by running `npx @dev-flow/cli install codex` and verifying installation happens silently without interactive prompts.

**Acceptance Scenarios**:
1. **Given** the user runs `npx @dev-flow/cli install deepseek --profile web`, **When** the command executes, **Then** the DeepSeek adapter is installed to the "web" profile without interactive prompts.
2. **Given** the user runs `npx @dev-flow/cli status`, **When** the command executes, **Then** the current installation status of both Codex and DeepSeek adapters is printed to stdout.

---

### User Story 3 - Full Lifecycle Management (Priority: P2)

Users can upgrade, uninstall, and completely clean up adapter data using the unified CLI.

**Why this priority**: Ensures users can cleanly remove or update the software without manually digging into hidden directories or multiple npm commands.
**Independent Test**: Can be tested by running the uninstall and clean commands sequentially and verifying no Dev Flow traces remain.

**Acceptance Scenarios**:
1. **Given** an installed adapter, **When** the user runs the `upgrade` command, **Then** the CLI cleanly replaces the old adapter with the latest version.
2. **Given** existing SQLite tasks data, **When** the user runs `clean`, **Then** the CLI prompts for confirmation (if in TUI) or requires a `--force` flag (if headless), and then removes the Dev Flow data directory.

### Edge Cases

- What happens when Node.js or npm versions are below requirements? The CLI should gracefully exit with a clear error message.
- How does the system handle missing DSH CLI when the user attempts to install DeepSeek? It should detect the absence of DSH and instruct the user to install it first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI MUST support an interactive mode (TUI) when invoked without subcommands.
- **FR-002**: The CLI MUST support a headless mode when invoked with subcommands and arguments.
- **FR-003**: The CLI MUST provide an `install` command supporting `codex` and `deepseek` targets.
- **FR-004**: The CLI MUST provide an `uninstall` command to remove installed adapters.
- **FR-005**: The CLI MUST provide a `status` command to report the current installation footprint.
- **FR-006**: The CLI MUST provide an `upgrade` command to update installed adapters to the latest version.
- **FR-007**: The CLI MUST provide a `clean` command to safely remove Dev Flow data directories (with confirmation).
- **FR-008**: The CLI MUST abstract away intermediate steps like `npm pack` and temporary tarball management for DeepSeek.

### Key Entities

- **Adapter**: Represents the target integration (Codex or DeepSeek).
- **Environment State**: Represents the current system's Node, NPM, and DSH availability and versions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can install either Codex or DeepSeek adapter successfully using exactly one `npx` command.
- **SC-002**: The DeepSeek installation no longer requires the user to manually run `npm pack` or manage tarball files.
- **SC-003**: Users can uninstall and clean up all Dev Flow data using the CLI without manual `rm -rf` commands.

## Assumptions

- Users have a working Node.js and npm environment configured on their system.
- The CLI tool will be published as an npm package (e.g., `@dev-flow/cli` or similar) that can be executed via `npx`.
- DSH profiles behave as expected and `dsh plugin add/remove` commands work as documented in their CLI.
