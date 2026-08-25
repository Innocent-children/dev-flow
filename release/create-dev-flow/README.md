# create-dev-flow Release

```bash
pnpm run release:create-dev-flow -- --mode normal --version 0.1.0 --output /absolute/output \
  --confirm create-dev-flow-v0.1.0 --confirm-comprehension
```

The command requires clean synchronized `main`, creates/reuses the exact Tag, npm version and GitHub draft, verifies
registry tarball bytes, installs the registry package in an isolated prefix, runs a zero-mutation CLI smoke, uploads
the tarball and checksums, and then finalizes the Release. Rerun with the same output directory to recover.
