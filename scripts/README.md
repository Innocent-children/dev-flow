# Repository Scripts

Repository-local development validation and source-package build helpers live here.
`validate-repository.sh` runs the bounded checks shared by local development and pull-request CI.
`build-deepseek-runtime.sh` builds the source-local darwin-arm64 Core used by DeepSeek package tests.

These scripts do not install host products, launch Codex or DeepSeek, modify user configuration,
build DeepSeek release assets, or publish anything.
