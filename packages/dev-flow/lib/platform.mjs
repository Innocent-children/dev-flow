import { join } from "node:path";

const adapters = Object.freeze({
  "darwin-arm64": Object.freeze({
    platform: "darwin",
    arch: "arm64",
    runtimeKey: "darwin-arm64",
    runtimeDirectory: "darwin-arm64",
    runtimeExecutable: "dev-flow",
    enforcePrivateModes: true,
    requireExecutableMode: true,
    forwardedSignals: Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]),
    recoverableCleanupDescription: "Move confirmed data to macOS Trash",
    applicationData({ homeDirectory }) {
      return Object.freeze({
        path: join(homeDirectory, "Library", "Application Support"),
        inspectionRoot: homeDirectory,
        canonicalizeRoot: false,
        label: "application support directory",
      });
    },
    trash({ homeDirectory }) {
      return Object.freeze({ path: join(homeDirectory, ".Trash"), inspectionRoot: homeDirectory });
    },
  }),
  "win32-x64": Object.freeze({
    platform: "win32",
    arch: "x64",
    runtimeKey: "win32-x64",
    runtimeDirectory: "win32-x64",
    runtimeExecutable: "dev-flow.exe",
    enforcePrivateModes: false,
    requireExecutableMode: false,
    forwardedSignals: Object.freeze(["SIGINT", "SIGTERM"]),
    recoverableCleanupDescription: "Move confirmed data to the Dev Flow recovery directory",
    applicationData({ homeDirectory, environment }) {
      const configured = environment?.LOCALAPPDATA;
      if (typeof configured === "string" && configured !== "") {
        return Object.freeze({
          path: configured,
          inspectionRoot: configured,
          canonicalizeRoot: true,
          label: "LOCALAPPDATA",
        });
      }
      return Object.freeze({
        path: join(homeDirectory, "AppData", "Local"),
        inspectionRoot: homeDirectory,
        canonicalizeRoot: false,
        label: "local application data directory",
      });
    },
    trash({ managerRoot, inspectionRoot }) {
      return Object.freeze({ path: join(managerRoot, "trash"), inspectionRoot });
    },
  }),
});

export const SUPPORTED_RUNTIME_KEYS = Object.freeze(Object.keys(adapters));

export function platformAdapter(platform, arch) {
  const runtimeKey = `${platform}-${arch}`;
  const adapter = adapters[runtimeKey];
  if (adapter === undefined) {
    throw new Error(`unsupported platform ${runtimeKey}; supported runtimes: ${SUPPORTED_RUNTIME_KEYS.join(", ")}`);
  }
  return adapter;
}
