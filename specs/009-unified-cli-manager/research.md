# Research: Unified CLI Manager

## Decision: Choice of CLI Framework
**Rationale**: We need both interactive and non-interactive modes.
**Alternatives considered**: 
- `commander` + `@clack/prompts`: Modern, lightweight.
- `yargs` + `inquirer`: Heavier but standard.
- Custom arg parsing.
**Consequences**: We will use `commander` for simple routing and a minimal prompt library to keep the package small and dependency-light.

## Decision: DSH Installation Method
**Rationale**: DSH requires a local tarball via `npm pack`.
**Alternatives considered**:
- Asking user to do it (status quo).
- Spawning `npm pack` in a temporary `os.tmpdir()` location, running `dsh plugin add`, then deleting it.
**Consequences**: The CLI will handle the tarball lifecycle silently in a temp folder.
