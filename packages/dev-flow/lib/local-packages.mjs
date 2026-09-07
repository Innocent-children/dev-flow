import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const installedPackageRoot = fileURLToPath(new URL("../", import.meta.url));

// A development distribution declares its artifact source in package metadata.
// Missing or altered declared artifacts are errors; they never select npm instead.
export async function readLocalPackages(packageRoot = installedPackageRoot) {
  const root = await realpath(packageRoot);
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (!Object.hasOwn(manifest, "devFlowLocalPackages")) return null;
  const entries = manifest.devFlowLocalPackages;
  if (!entries || JSON.stringify(Object.keys(entries).sort()) !== JSON.stringify(["codex", "deepseek"])) {
    throw new Error("local package metadata must declare Codex and DeepSeek artifacts");
  }
  const result = {};
  for (const product of ["codex", "deepseek"]) {
    const entry = entries[product];
    if (!entry || JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(["path", "sha256", "version"]) ||
        entry.path !== `local-packages/${product}.tgz` || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.version) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`invalid local ${product} artifact metadata`);
    const path = join(root, entry.path);
    for (const target of [dirname(path), path]) {
      if ((await lstat(target)).isSymbolicLink() || await realpath(target) !== resolve(target)) throw new Error("local artifacts must use canonical package-owned paths");
    }
    if (!(await lstat(path)).isFile()) throw new Error(`local ${product} artifact is not a file`);
    const digest = createHash("sha256").update(await readFile(path)).digest("hex");
    if (digest !== entry.sha256) throw new Error(`local ${product} artifact digest mismatch`);
    result[product] = Object.freeze({ path, version: entry.version });
  }
  return Object.freeze(result);
}
