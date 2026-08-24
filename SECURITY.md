# Security Policy

## Supported versions

Security reports are evaluated against the exact stable packages and environments listed in the
[Support Matrix](docs/SUPPORT-MATRIX_en.md). Preview packages and source-only behavior are reviewed
when possible, but they do not expand the stable support claim.

## Report a vulnerability

Please do not publish exploit details, credentials, private repository content, or raw Host
transcripts in a public Issue or pull request.

Use GitHub's private vulnerability-reporting entry on this repository's **Security** tab when it is
available. If it is unavailable, open a public Issue containing only:

```text
Security contact requested
Affected product: Core | dev-flow-codex | dev-flow-deepseek
Affected version: <version>
```

A maintainer will provide a private contact path. Do not include reproduction steps or sensitive
material in that public Issue.

A useful private report includes:

- the affected product, package and bundled Core versions, Host version, OS, and CPU;
- minimal reproduction steps using a disposable repository;
- expected and observed behavior;
- realistic impact and required attacker capabilities;
- sanitized logs or diagnostics.

Remove tokens, credentials, personal data, private code, absolute home-directory paths, and
unredacted transcripts before sharing evidence.

## Examples of relevant reports

- access outside an explicitly authorized Repository Scope;
- duplicate state changes after a stale, replayed, or uncertain mutation;
- incompatible persisted data being written before validation;
- setup or removal deleting Task data, target-repository data, or unrelated configuration;
- a package or Release verifier accepting bytes different from the declared artifact;
- normal product behavior committing secrets or private repository content into evidence.

A user-authorized Host changing files within its granted sandbox, model output that is merely wrong,
or behavior on an unsupported platform is not by itself a Dev Flow vulnerability.

## Security boundaries

Dev Flow protects task process state; it is not a general sandbox around Codex, DeepSeek Harness, the
shell, or the operating system. See the [Threat Model](docs/THREAT-MODEL_en.md) for the trust boundary,
main mitigations, and residual risks.
