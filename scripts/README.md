# Repository Scripts

Repository-local development validation and source-package build helpers live here.
`validate-repository.sh` runs the bounded checks shared by local development and pull-request CI.
`build-deepseek-runtime.sh` builds the source-local darwin-arm64 Core used by DeepSeek package tests.
`release-deepseek.mjs` is the DeepSeek one-command release entrypoint; its prepare, verifier,
publisher and registry lifecycle runner mirror the Codex operator interface while retaining DSH-
specific installation and validation.

Development validation does not install Host products or publish anything. The explicitly confirmed
release entrypoints are the only scripts authorized to build release assets, mutate Tag/npm/GitHub
state, and run isolated final Host lifecycle gates.
