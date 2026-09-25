# ZCode Release

`packages/zcode/package.json` owns the Adapter version. Its `.zcode-plugin/plugin.json` and the `taskbelay-zcode` entry in `marketplace.json` mirror that
version. The packaged Core version is read independently from `CORE_VERSION` and checked against the
actual executable.

The manually dispatched `publish-npm` workflow accepts `product=zcode`, a channel and an exact
version. It uses the shared Host release implementation on the `macos-15` ARM64 runner and invokes:

```bash
pnpm run release:zcode -- \
  [--channel stable|beta] \
  --version "<ZCODE_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "zcode-v<ZCODE_VERSION>"
```

The default `stable` channel accepts `MAJOR.MINOR.PATCH` and requires clean `main` synchronized with
`origin/main`. It updates the selected package version and its mirrors, and adds or updates this
Host's entry in `release/public-versions.json` with the bundled Core version. A first stable release
may publish the current source package version; it still records the public identity in a version
commit. No previous release Tag is required.

`beta` accepts only `MAJOR.MINOR.PATCH-beta.N` and permits a clean named branch. When version
files change, it pushes the version commit to that branch and checks the resulting remote commit;
stable public-version metadata remains unchanged.
It uses npm dist-tag `beta` and a GitHub prerelease. Both channels use commit
`release(zcode): v<ZCODE_VERSION>` and Tag `zcode-v<ZCODE_VERSION>`.

The entrypoint alone does not establish a public npm release or verified Host support. Before the
first publication, the package maintainer must resolve the npm package ownership, initial-publication
requirements and authentication, then configure `Innocent-children/taskbelay`'s `publish-npm.yml` as
this package's GitHub Actions Trusted Publisher. The repository does not configure npm settings.
See [Release Ownership](../README.md) for the shared credentials, approval and retry requirements.

## Preparation and verification

```bash
node scripts/build-host-release.mjs --product zcode --output "<ABSOLUTE_DIRECTORY>"
```

This command prepares artifacts without publishing. Its output must be an existing empty absolute
directory outside the repository. It builds both Core runtimes from two temporary
frozen-source staging directories, verifies the package and version mirrors, and requires the two
independently built tarballs to match. The external output directory contains exactly:

```text
taskbelay-zcode-<ZCODE_VERSION>.tgz
taskbelay-core-<CORE_VERSION>-darwin-arm64
taskbelay-core-<CORE_VERSION>-windows-amd64.exe
SHA256SUMS
release-manifest.json
```

The standalone release command runs its fixed package and publication checks, then commits and
pushes any version-file changes before preparing artifacts. For both initial publication and resume,
the shared publisher verifies the local five-file set, source and product identity, recorded digests
and checksums before its Tag, npm and GitHub Release operations. Missing, extra, duplicate,
linked or altered artifacts stop publication. Matching npm, Tag and GitHub Release state is reused;
registry tarball and both standalone Core assets are read back against the saved digests.
Only npm propagation responses such as `ETARGET` or `E404` are retried for up to ten minutes.
Authentication failures, conflicting remote state and byte mismatches stop immediately.

Release checks do not operate ZCode UI or run authenticated model sessions. Installation and
maintenance still require the returned UI steps; local preparation remains `action_required`, and
removal requires Host confirmation. These behaviors and platform verification remain separate
product checks described in the [ZCode guide](../../docs/ZCODE_en.md) and
[support matrix](../../docs/SUPPORT-MATRIX_en.md).
