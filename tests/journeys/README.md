# Core Journeys

This directory owns process-level journeys for the shared Dev Flow Core. Feature 002 adds the
restart journey only after the application and MCP slices exist; Phase 1–2 reserve this boundary and
do not create a fake adapter or in-process substitute for restart evidence.

Journey fixtures must use temporary repositories and data directories, report simulated or
user-performed evidence honestly, and leave no database or repository state behind.
