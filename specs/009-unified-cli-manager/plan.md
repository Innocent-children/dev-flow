# Implementation Plan: Unified CLI Manager

## Technical Approach

We will create a new package `packages/cli` in the monorepo.
This package will export a `bin` entry in its `package.json` named `dev-flow-cli`.
It will be built using modern Node.js CLI tools like `commander` (for arguments parsing) and `inquirer` or `@clack/prompts` for the TUI (interactive mode).

### Architecture

1. **CLI Entrypoint (`packages/cli/bin/dev-flow-cli.mjs`)**: Detects arguments. If no args, launch TUI. Otherwise, run commander commands.
2. **Commands Module**:
   - `install`: Spawns `npm install -g dev-flow-codex@latest && dev-flow-codex setup` or handles DSH tarball logic.
   - `uninstall`: Spawns respective removal commands.
   - `upgrade`: Reinstalls adapters.
   - `clean`: Prompts for confirmation and `rm -rf` the `$HOME/Library/Application Support/dev-flow` path.
   - `status`: Checks versions.

### Core Constitution Check

This feature adheres to the Constitution:
- **I. Go Core Single Authority**: Does not modify Core logic.
- **VII. Product Features and Releases Are Separate**: Only builds the package, does not publish it.

## Verification

We will add a local integration test for the CLI `status` and `install` dummy commands.

## Checkpoints
- Tasks 1-2: Setup CLI package
- Tasks 3-5: Implement commands
