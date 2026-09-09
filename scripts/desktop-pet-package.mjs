import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const desktopApplications = Object.freeze([
  "runtime/darwin-arm64/DevFlowPet.app",
  "runtime/win32-x64/DevFlowPet",
]);

// Source files and generated application directories have separate build owners.
export function desktopSourceFiles(manifest) {
  return manifest.files.filter(file => !desktopApplications.includes(file));
}

export async function stageDesktopPackage(repositoryRoot, stage, applications) {
  const source = join(repositoryRoot, "packages", "dev-flow");
  const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  for (const file of desktopSourceFiles(manifest)) {
    await mkdir(dirname(join(stage, file)), { recursive: true });
    await copyFile(join(source, file), join(stage, file));
  }
  await chmod(join(stage, "bin", "dev-flow.mjs"), 0o755);
  await copyFile(join(repositoryRoot, "LICENSE"), join(stage, "LICENSE"));
  const delivered = { ...manifest, files: [...desktopSourceFiles(manifest), ...applications] };
  await writeFile(join(stage, "package.json"), `${JSON.stringify(delivered, null, 2)}\n`);
  return delivered;
}
