# 006 Publish Two Installable Products

This directory intentionally contains only `spec.md`.

Do not generate release implementation artifacts until:

1. `003` and `004` have each completed a final local-package real-host journey.
2. Required recovery hardening from `005` is complete or explicitly proven unnecessary.
3. npm package scope/name ownership and publisher permissions are verified.
4. The first-release platform matrix and host minimum/compatible ranges are selected from available real environments; actual tested versions are recorded as evidence.
5. Current npm and GitHub immutable-publication behavior is revalidated.

Release planning must use the actual final package layouts delivered by `003` and `004`; it must not
redesign those products inside the release feature. Publication credentials are never added to
pull-request CI.
