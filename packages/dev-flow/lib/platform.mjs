import { join } from "node:path";

const runtimeDescriptors = Object.freeze({
  "darwin-arm64": Object.freeze({ platform: "darwin", arch: "arm64", runtimeKey: "darwin-arm64", runtimeDirectory: "darwin-arm64", runtimeExecutable: "dev-flow" }),
  "win32-x64": Object.freeze({ platform: "win32", arch: "x64", runtimeKey: "win32-x64", runtimeDirectory: "win32-x64", runtimeExecutable: "dev-flow.exe" }),
});

const dataPathPolicies = Object.freeze({
  "darwin-arm64": Object.freeze({
    applicationData({ homeDirectory }) {
      return Object.freeze({ path: join(homeDirectory, "Library", "Application Support"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "application support directory" });
    },
  }),
  "win32-x64": Object.freeze({
    applicationData({ homeDirectory, environment }) {
      const configured = environment?.LOCALAPPDATA;
      if (typeof configured === "string" && configured !== "") {
        return Object.freeze({ path: configured, inspectionRoot: configured, canonicalizeRoot: true, label: "LOCALAPPDATA" });
      }
      return Object.freeze({ path: join(homeDirectory, "AppData", "Local"), inspectionRoot: homeDirectory, canonicalizeRoot: false, label: "local application data directory" });
    },
  }),
});

const permissionPolicies = Object.freeze({
  "darwin-arm64": Object.freeze({ enforcePrivateModes: true, requireExecutableMode: true }),
  "win32-x64": Object.freeze({ enforcePrivateModes: false, requireExecutableMode: false }),
});

const signalPolicies = Object.freeze({
  "darwin-arm64": Object.freeze({ forwardedSignals: Object.freeze(["SIGINT", "SIGTERM", "SIGHUP"]) }),
  "win32-x64": Object.freeze({ forwardedSignals: Object.freeze(["SIGINT", "SIGTERM"]) }),
});

const cleanupPolicies = Object.freeze({
  "darwin-arm64": Object.freeze({
    recoverableCleanupDescription: "Move confirmed data to macOS Trash",
    trash({ homeDirectory }) {
      return Object.freeze({ path: join(homeDirectory, ".Trash"), inspectionRoot: homeDirectory });
    },
  }),
  "win32-x64": Object.freeze({
    recoverableCleanupDescription: "Move confirmed data to the Dev Flow recovery directory",
    trash({ managerRoot, inspectionRoot }) {
      return Object.freeze({ path: join(managerRoot, "trash"), inspectionRoot });
    },
  }),
});

export const SUPPORTED_RUNTIME_KEYS = Object.freeze(Object.keys(runtimeDescriptors));

// The desktop component is a macOS arm64 native application bundled with the
// unified launcher. Every other supported runtime keeps its existing commands
// unchanged and offers no desktop pet entry.
export const DESKTOP_PET_RUNTIME_KEY = "darwin-arm64";

export const supportsDesktopPet = (platform, arch) => `${platform}-${arch}` === DESKTOP_PET_RUNTIME_KEY;

export const runtimeDescriptor = (platform, arch) => selectPlatformValue(runtimeDescriptors, platform, arch);
export const dataPathPolicy = (platform, arch) => selectPlatformValue(dataPathPolicies, platform, arch);
export const permissionPolicy = (platform, arch) => selectPlatformValue(permissionPolicies, platform, arch);
export const signalPolicy = (platform, arch) => selectPlatformValue(signalPolicies, platform, arch);
export const cleanupPolicy = (platform, arch) => selectPlatformValue(cleanupPolicies, platform, arch);

function selectPlatformValue(values, platform, arch) {
  const runtimeKey = `${platform}-${arch}`;
  const value = values[runtimeKey];
  if (value === undefined) {
    throw new Error(`unsupported platform ${runtimeKey}; supported runtimes: ${SUPPORTED_RUNTIME_KEYS.join(", ")}`);
  }
  return value;
}
