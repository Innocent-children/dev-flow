# dev-flow-deepseek

`dev-flow-deepseek` remains a private engineering skeleton through Feature 002. It reserves the DeepSeek
product boundary in the Monorepo; it is not an installable or runnable product and provides no
DeepSeek host behavior.

This bootstrap package contains only its manifest and this documentation. In particular, it has:

- no copy of the shared Go Core source;
- no DeepSeek Skill, proxy, or host integration;
- no install, preinstall, postinstall, or other lifecycle script;
- no runtime or production dependency; and
- no `bin` executable entry.

Feature 002 implements only the shared Core Contract 0.1. DeepSeek host functionality, real-host
validation, installation, and distribution remain unimplemented.
