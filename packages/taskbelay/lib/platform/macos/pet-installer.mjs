import { randomUUID } from "node:crypto";
import { chmod, cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  PET_APPLICATION_NAME,
  PET_EXECUTABLE_RELATIVE_PATH,
  PET_RUNTIME_DIRECTORY,
  isBundledPetApplicationAvailable,
} from "./pet.mjs";

export function installedPetExecutable(petDirectory) {
  return join(resolve(petDirectory), PET_APPLICATION_NAME, PET_EXECUTABLE_RELATIVE_PATH);
}

export async function ensurePetInstalled({
  petDirectory,
  sourcePackageRoots = [],
  enforcePrivateModes = true,
  replaceExisting = false,
} = {}) {
  if (!petDirectory) return { installed: false, reason: "missing_pet_directory" };

  const targetApp = join(resolve(petDirectory), PET_APPLICATION_NAME);
  const targetExecutable = join(targetApp, PET_EXECUTABLE_RELATIVE_PATH);

  const existing = await lstat(targetApp).catch(error => { if (error.code !== "ENOENT") throw error; });
  if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) throw new Error("desktop application path must be a regular directory");
  if (!replaceExisting && await isBundledPetApplicationAvailable(targetExecutable)) {
    return { installed: true, targetApp, targetExecutable, newlyInstalled: false };
  }

  let sourceApp = null;
  for (const root of sourcePackageRoots) {
    if (!root) continue;
    const candidate = join(resolve(root), "runtime", PET_RUNTIME_DIRECTORY, PET_APPLICATION_NAME);
    const candidateExecutable = join(candidate, PET_EXECUTABLE_RELATIVE_PATH);
    if (await isBundledPetApplicationAvailable(candidateExecutable)) {
      sourceApp = candidate;
      break;
    }
  }

  if (!sourceApp) {
    return { installed: false, reason: "source_pet_not_found" };
  }

  await mkdir(petDirectory, { recursive: true, mode: 0o700 });
  const stage = join(resolve(petDirectory), `.install-${randomUUID()}`);
  try {
    await cp(sourceApp, stage, { recursive: true, dereference: false, filter: async source => {
      if ((await lstat(source)).isSymbolicLink()) throw new Error("desktop package cannot contain links");
      return true;
    } });
    await chmod(join(stage, PET_EXECUTABLE_RELATIVE_PATH), 0o755);
    if (enforcePrivateModes) await chmod(petDirectory, 0o700);
    const previous = existing ? join(resolve(petDirectory), `.previous-${randomUUID()}`) : null;
    if (previous) await rename(targetApp, previous);
    try { await rename(stage, targetApp); }
    catch (error) { if (previous) await rename(previous, targetApp); throw error; }
    if (previous) await rm(previous, { recursive: true, force: true });
  } finally { await rm(stage, { recursive: true, force: true }); }

  return { installed: true, targetApp, targetExecutable, newlyInstalled: true };
}
