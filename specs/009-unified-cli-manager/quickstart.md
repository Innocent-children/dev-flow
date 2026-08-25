# Quickstart: Unified CLI Manager

## Initial Condition
User has Node.js and NPM installed.

## Scenario 1: Interactive Install
1. Run `npx dev-flow-cli`
2. Select "Install Adapter" -> "Codex"
3. Wait for success message.
4. Run `dev-flow-cli status` to confirm.

## Scenario 2: Clean Data
1. Run `npx dev-flow-cli clean --force`
2. Verify `$HOME/Library/Application Support/dev-flow` is removed.
