# Implementation Tasks: Unified CLI Manager

- [x] **T001**: Create `packages/cli` directory and `package.json` with `bin` field for `dev-flow-cli`.
- [x] **T002**: Implement basic interactive TUI shell using `readline` or minimal prompts in `packages/cli/bin/dev-flow-cli.mjs`.
- [x] **T003**: Implement `install` command logic for Codex (spawns npm install and setup).
- [x] **T004**: Implement `install` command logic for DeepSeek (spawns npm pack and dsh add).
- [x] **T005**: Implement `clean`, `uninstall`, and `status` commands.
- [x] **T006**: Write tests in `packages/cli/test/` to verify argument parsing and process spawning logic.
- [x] **T007**: Update `docs/COMMANDS.md` and `docs/COMMANDS_en.md` to document the new `dev-flow-cli` entrypoint.
- [x] **T008**: Update root `README.md` and other locales to reflect the new unified installation method.
