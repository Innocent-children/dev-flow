import { join } from "node:path";

export const runtime = Object.freeze({ platform: "darwin", arch: "arm64", runtimeKey: "darwin-arm64", runtimeDirectory: "darwin-arm64", runtimeExecutable: "dev-flow" });

export const dataPaths = Object.freeze({
  productRoot(anchor) { return anchor; },
  homeDirectory({ environment, fallback }) { return environment?.HOME || fallback; },
  applicationData({ homeDirectory }) {
    return Object.freeze({ path: join(homeDirectory, ".dev-flow"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "user data directory" });
  },
});

export const permissions = Object.freeze({ enforcePrivateModes: true, requireExecutableMode: true });

export const signals = Object.freeze({ forwardedSignals: Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]) });

export const nativeGitPath = path => path;

export const registration = Object.freeze({
  marketplaceFields: ["name", "root", "marketplaceSource"],
  requiresMarketplaceSource: true,
  path(value) { return value; },
});
