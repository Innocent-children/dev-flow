import { join } from "node:path";

export const registrationPath = value => value;

export const runtime = Object.freeze({ platform: "darwin", arch: "arm64", runtimeKey: "darwin-arm64", runtimeDirectory: "darwin-arm64", runtimeExecutable: "taskbelay" });

export const dataPaths = Object.freeze({
  productRoot(anchor) { return anchor; },
  managerRoot(anchor) { return anchor; },
  applicationData({ homeDirectory }) {
    return Object.freeze({ path: join(homeDirectory, ".taskbelay"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "user data directory" });
  },
});

export const permissions = Object.freeze({ enforcePrivateModes: true, requireExecutableMode: true });

export const signals = Object.freeze({ forwardedSignals: Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]) });

export const cleanup = Object.freeze({
  recoverableCleanupDescription: "Move confirmed data to macOS Trash",
  trash({ homeDirectory }) {
    return Object.freeze({ path: join(homeDirectory, ".Trash"), inspectionRoot: homeDirectory });
  },
});
