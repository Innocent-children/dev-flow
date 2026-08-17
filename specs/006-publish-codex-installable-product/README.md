# 006 Publish the Codex Installable Product

Feature 006 publishes the first public Dev Flow product: `dev-flow-codex` for macOS arm64.

Feature 004 remains deferred. Feature 006 does not publish `dev-flow-deepseek`, does not modify its
package, and does not claim DeepSeek Harness support. A later feature may complete and publish that
product from the same Monorepo and shared Core.

This directory is a complete Spec Kit package:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/codex-public-package.md`
- `contracts/release-process.md`
- `contracts/release-manifest.schema.json`
- `contracts/publication-record.schema.json`
- `quickstart.md`
- `checklists/requirements.md`
- `tasks.md`

## Entry gate

Implementation starts only after:

1. Feature 003 is merged and the local Codex package journey remains green;
2. Feature 005 is complete and merged;
3. the intended npm package name `dev-flow-codex` is verified as publishable by the authorized
   maintainer account;
4. the current Codex compatibility contract is copied from the merged Feature 003 artifacts;
5. the release operator has working npm and GitHub authentication.

Package-name ownership is a preflight, not a fallback naming algorithm. If the authorized account
cannot publish `dev-flow-codex`, stop and amend the specification rather than silently choosing a
different public identity.

## First-release boundary

The first release contains one npm package with one bundled `darwin-arm64` Go runtime. It does not
introduce platform-runtime subpackages, postinstall downloads, background updates, a release daemon,
or a second host product.

Preparation and verification may run repeatedly. Irreversible publication happens only through an
explicit operator command with the exact version confirmation. Pull-request CI never receives npm
or GitHub release credentials.
