import { join } from "node:path";

export const runtime = Object.freeze({ platform: "darwin", arch: "arm64", runtimeKey: "darwin-arm64", runtimeDirectory: "darwin-arm64", runtimeExecutable: "taskbelay" });

export const dataPaths = Object.freeze({
  productRoot(anchor) { return anchor; },
  applicationData({ homeDirectory }) {
    return Object.freeze({ path: join(homeDirectory, ".taskbelay"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "user data directory" });
  },
});

export const permissions = Object.freeze({ enforcePrivateModes: true, requireExecutableMode: true });

