import { chmod, cp, mkdir, rm } from "node:fs/promises";
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
} = {}) {
  if (!petDirectory) return { installed: false, reason: "missing_pet_directory" };

  const targetApp = join(resolve(petDirectory), PET_APPLICATION_NAME);
  const targetExecutable = join(targetApp, PET_EXECUTABLE_RELATIVE_PATH);

  if (await isBundledPetApplicationAvailable(targetExecutable)) {
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
  await rm(targetApp, { recursive: true, force: true });
  await cp(sourceApp, targetApp, { recursive: true });
  await chmod(targetExecutable, 0o755);
  if (enforcePrivateModes) {
    await chmod(petDirectory, 0o700);
  }

  return { installed: true, targetApp, targetExecutable, newlyInstalled: true };
}
