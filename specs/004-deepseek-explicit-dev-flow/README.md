# 004 DeepSeek Explicit Dev Flow

This directory intentionally contains only `spec.md`.

Do not generate implementation artifacts until:

1. `002` is complete and Core Contract 0.1 is frozen.
2. The then-current DeepSeek Harness bundle/profile, Skill provider, MCP client, result handling,
   package add/remove, and cache behavior are revalidated.
3. Direct Core MCP consumption has been tested before authorizing any projection proxy.
4. A minimum Harness version, compatible range, profile, and real-evidence platform are selected; the latest stable compatible Harness is used for the journey.

Then activate this feature and run:

```text
$speckit-clarify
$speckit-plan
$speckit-checklist
$speckit-tasks
$speckit-analyze
```

The plan may use observed current host behavior as evidence. It must keep the Skill and optional
proxy thin and must not add host-independent workflow, persistence, or recovery logic outside the
shared Core.
