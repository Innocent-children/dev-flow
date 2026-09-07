import * as macos from "./platform/macos/policies.mjs";
import * as windows from "./platform/windows/policies.mjs";

const implementations = Object.freeze({ "darwin-arm64": macos, "win32-x64": windows });
export const SUPPORTED_RUNTIME_KEYS = Object.freeze(Object.keys(implementations));

export const runtimeDescriptor = (platform, arch) => selectPlatform(platform, arch).runtime;
export const dataPathPolicy = (platform, arch) => selectPlatform(platform, arch).dataPaths;
export const permissionPolicy = (platform, arch) => selectPlatform(platform, arch).permissions;
export const signalPolicy = (platform, arch) => selectPlatform(platform, arch).signals;
export const cleanupPolicy = (platform, arch) => selectPlatform(platform, arch).cleanup;

const desktopPlatforms = Object.freeze({
  "darwin-arm64": { runtime: () => import("./platform/macos/pet.mjs"), installer: () => import("./platform/macos/pet-installer.mjs") },
  "win32-x64": { runtime: () => import("./platform/windows/pet.mjs"), installer: () => import("./platform/windows/pet-installer.mjs") },
});
export const supportsDesktopPet = (platform, arch) => Object.hasOwn(desktopPlatforms, `${platform}-${arch}`);
export const loadPetPlatform = (platform, arch) => desktopPlatforms[`${platform}-${arch}`].runtime();
export const loadPetInstaller = (platform, arch) => desktopPlatforms[`${platform}-${arch}`].installer();
const maintenancePlatforms = Object.freeze({
  "darwin-arm64": () => import("./platform/macos/maintenance.mjs"),
  "win32-x64": () => import("./platform/windows/maintenance.mjs"),
});
export const loadMaintenancePlatform = (platform, arch) => maintenancePlatforms[`${platform}-${arch}`]();

function selectPlatform(platform, arch) {
  const runtimeKey = `${platform}-${arch}`;
  const value = implementations[runtimeKey];
  if (value === undefined) {
    throw new Error(`unsupported platform ${runtimeKey}; supported runtimes: ${SUPPORTED_RUNTIME_KEYS.join(", ")}`);
  }
  return value;
}
