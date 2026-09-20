import * as windows from "./platform/windows/policies.mjs";
import * as macos from "./platform/macos/policies.mjs";

const platforms = { "win32-x64": windows, "darwin-arm64": macos };

export function platformPolicy(platform = process.platform, arch = process.arch) {
  const policy = platforms[`${platform}-${arch}`];
  if (!policy) throw new Error(`Unsupported ZCode Adapter platform: ${platform}-${arch}`);
  return policy;
}

export const nativeGitPath = value => platformPolicy().nativeGitPath(value);
