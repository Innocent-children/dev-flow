# dev-flow-codex

`dev-flow-codex` is a private Feature 001 engineering skeleton. It reserves the Codex product
boundary in the Monorepo; it is not an installable or runnable product and provides no Codex host
behavior.

This bootstrap package contains only its manifest and this documentation. In particular, it has:

- no copy of the shared Go Core source;
- no Codex Skill, proxy, or host integration;
- no install, preinstall, postinstall, or other lifecycle script;
- no runtime or production dependency; and
- no `bin` executable entry.

Host functionality and distribution remain outside Feature 001.
