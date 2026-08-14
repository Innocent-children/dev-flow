# Shared Go Core

`internal/` owns the host-independent Go implementation used by the `dev-flow` command.

Feature 001 contains only the minimal version helper needed by the placeholder command. Task state,
workflow transitions, SQLite, MCP, Git observation, recovery, and host behavior are not implemented.
