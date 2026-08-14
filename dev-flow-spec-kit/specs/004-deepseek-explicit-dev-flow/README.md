# 004 DeepSeek Explicit Dev Flow

This directory intentionally contains only `spec.md`.

Do not generate implementation artifacts until:

1. `002` is complete and Core Contract 0.1 is frozen.
2. The then-current DeepSeek Harness bundle/profile, Skill provider, MCP client, result handling,
   package add/remove, and cache behavior are revalidated.
3. Direct Core MCP consumption has been tested before authorizing any projection proxy.
4. One exact Harness baseline, profile, and platform are selected for real-host evidence.

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
