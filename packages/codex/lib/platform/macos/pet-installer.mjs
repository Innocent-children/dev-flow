import { chmod, cp, lstat, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

export async function ensureCodexPetInstalled(paths) {
  const sourceApp = join(paths.packageRoot, "runtime", "darwin-arm64", "DevFlowPet.app");
  const petDirectory = paths.petDirectory ?? join(paths.productSupportRoot, "pet");
  const targetApp = join(petDirectory, "DevFlowPet.app");
  const targetExecutable = join(targetApp, "Contents", "MacOS", "DevFlowPet");

  try {
    const info = await lstat(targetExecutable);
    if (info.isFile() && !info.isSymbolicLink()) return;
  } catch {
    // proceed with install
  }

  try {
    const sourceExecutable = join(sourceApp, "Contents", "MacOS", "DevFlowPet");
    const sourceInfo = await lstat(sourceExecutable);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) return;
    await mkdir(petDirectory, { recursive: true, mode: 0o700 });
    await rm(targetApp, { recursive: true, force: true });
    await cp(sourceApp, targetApp, { recursive: true });
    await chmod(targetExecutable, 0o755);
    if (paths.enforcePrivateModes) {
      await chmod(petDirectory, 0o700);
    }
  } catch {
    // Ignore if source not present
  }
}

