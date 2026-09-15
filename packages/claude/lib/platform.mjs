import * as windows from "./platform/windows.mjs";
import * as macos from "./platform/macos.mjs";
const platforms = { "win32-x64": windows, "darwin-arm64": macos };
export function platformPolicy(platform = process.platform, arch = process.arch) {
  const policy = platforms[platform + "-" + arch];
  if (!policy) throw new Error("Unsupported Claude Adapter platform: " + platform + "-" + arch);
  return policy;
}
export const nativeGitPath = value => platformPolicy().nativeGitPath(value);

