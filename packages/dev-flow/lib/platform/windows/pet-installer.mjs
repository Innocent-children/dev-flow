import { cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { PET_APPLICATION_NAME, PET_EXECUTABLE_RELATIVE_PATH, PET_RUNTIME_DIRECTORY, isBundledPetApplicationAvailable } from "./pet.mjs";

export async function ensurePetInstalled({ petDirectory, sourcePackageRoots = [], replaceExisting = false } = {}) {
  if (!petDirectory) return { installed: false, reason: "missing_pet_directory" };
  const parent = resolve(petDirectory), targetApp = join(parent, PET_APPLICATION_NAME);
  const targetExecutable = join(targetApp, PET_EXECUTABLE_RELATIVE_PATH);
  const existing = await lstat(targetApp).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error("desktop application path must be a regular directory");
    if (!replaceExisting) return { installed: await isBundledPetApplicationAvailable(targetExecutable), targetApp, targetExecutable, newlyInstalled: false };
  }
  for (const root of sourcePackageRoots.filter(Boolean)) {
    const sourceApp = join(resolve(root), "runtime", PET_RUNTIME_DIRECTORY, PET_APPLICATION_NAME);
    if (!await isBundledPetApplicationAvailable(join(sourceApp, PET_EXECUTABLE_RELATIVE_PATH))) continue;
    await mkdir(parent, { recursive: true });
    const stage = join(parent, `.install-${randomUUID()}`);
    try {
      await cp(sourceApp, stage, { recursive: true, dereference: false, filter: async source => {
        if ((await lstat(source)).isSymbolicLink()) throw new Error("desktop package cannot contain links"); return true;
      } });
      const previous = existing ? join(parent, `.previous-${randomUUID()}`) : null;
      if (previous) await rename(targetApp, previous);
      try { await rename(stage, targetApp); }
      catch (error) { if (previous) await rename(previous, targetApp); throw error; }
      if (previous) await rm(previous, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      return { installed: true, targetApp, targetExecutable, newlyInstalled: true };
    } finally { await rm(stage, { recursive: true, force: true }); }
  }
  return { installed: false, reason: "source_pet_not_found" };
}
