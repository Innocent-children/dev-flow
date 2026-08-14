# Protocol Fixtures

This directory owns the shared public-contract fixtures produced by the Dev Flow Core. The same
fixtures are consumed by future Codex and DeepSeek adapters; host-specific copies or alternate
workflow contracts do not belong here.

Fixtures begin when the corresponding Feature 002 application and MCP tasks are implemented; Phase
1–2 reserve this ownership boundary without adding protocol payloads. Fixtures
contain bounded public projections only: never database paths, source contents, Git diffs,
environment values, raw command output, or host-private state. Fixtures are contract evidence, not
runtime workflow authority.
