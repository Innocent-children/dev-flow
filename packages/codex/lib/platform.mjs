import * as macos from "./platform/macos/policies.mjs";
import * as windows from "./platform/windows/policies.mjs";

const implementations = Object.freeze({ "darwin-arm64": macos, "win32-x64": windows });
export const SUPPORTED_RUNTIME_KEYS = Object.freeze(Object.keys(implementations));

export const runtimeDescriptor = (platform, arch) => selectPlatform(platform, arch).runtime;
export const dataPathPolicy = (platform, arch) => selectPlatform(platform, arch).dataPaths;
export const permissionPolicy = (platform, arch) => selectPlatform(platform, arch).permissions;
export const registrationPolicy = (platform = process.platform, arch = process.arch) => selectPlatform(platform, arch).registration;
export const signalPolicy = (platform, arch) => selectPlatform(platform, arch).signals;

export const nativeGitPath = (path, platform = process.platform, arch = process.arch) => selectPlatform(platform, arch).nativeGitPath(path);
export async function ensureCodexPetInstalled(paths) {
  if (`${paths?.platform}-${paths?.arch}` !== "darwin-arm64") return;
  return (await import("./platform/macos/pet-installer.mjs")).ensureCodexPetInstalled(paths);
}

function selectPlatform(platform, arch) {
  const runtimeKey = `${platform}-${arch}`;
  const value = implementations[runtimeKey];
  if (value === undefined) {
    throw new Error(`unsupported platform ${runtimeKey}; supported runtimes: ${SUPPORTED_RUNTIME_KEYS.join(", ")}`);
  }
  return value;
}
