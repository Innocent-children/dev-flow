import { execFile as execFileCallback } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function adapterCoreRuntimePath(packageRoot, paths) {
  return join(packageRoot, "runtime", paths.runtimeDirectory, paths.runtimeExecutable);
}

/**
 * Locate a package even when registration was interrupted, without starting Core.
 */
export async function installedCoreRuntime(packageRoot, paths, identity) {
  const runtimePath = adapterCoreRuntimePath(packageRoot, paths);
  try { await lstat(runtimePath); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  return Object.freeze({ ...identity, packageRoot, runtimePath });
}

/**
 * Maintenance checks package ownership without requiring a working registration or starting Core.
 */
export async function inspectMaintainedCore(runtime, paths) {
  if (resolve(runtime.runtimePath) !== runtime.runtimePath ||
      runtime.runtimePath !== adapterCoreRuntimePath(runtime.packageRoot, paths)) throw new Error("maintained Core layout is invalid");
  try { await lstat(runtime.runtimePath); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  await assertCanonicalDirectory(runtime.packageRoot, "maintained Core package");
  const manifest = await readRuntimeJSON(join(runtime.packageRoot, "package.json"), "maintained Core package manifest");
  if (manifest?.name !== runtime.packageName) throw new Error("maintained Core must belong to its Adapter package");
  const runtimePath = await assertCanonicalExecutable(runtime.runtimePath, "maintained Core", paths.requireExecutableMode);
  return { ...runtime, runtimePath };
}

export async function inspectCoreRuntime(candidate, { exec = execFile, environment = process.env, requireExecutableMode = true } = {}) {
  const packageRoot = await realpath(candidate.packageRoot).catch((error) => {
    throw new Error(`${candidate.source} package root is unavailable`, { cause: error });
  });
  if (packageRoot !== resolve(candidate.packageRoot) || !(await stat(packageRoot)).isDirectory()) {
    throw new Error(`${candidate.source} package root is not canonical`);
  }
  const manifest = await readRuntimeJSON(join(packageRoot, "package.json"), `${candidate.source} package manifest`);
  if (manifest?.name !== candidate.packageName || manifest.version !== candidate.packageVersion) {
    throw new Error(`${candidate.source} package identity differs from its receipt`);
  }
  const runtimePath = await assertCanonicalExecutable(
    candidate.runtimePath,
    `${candidate.source} Core runtime`,
    requireExecutableMode,
  );
  const result = await exec(runtimePath, ["version"], { cwd: packageRoot, encoding: "utf8", maxBuffer: 64 * 1024, timeout: 15_000, env: environment });
  const match = /^dev-flow (\S+)\n?$/u.exec(result.stdout);
  if (!match || !semverPattern.test(match[1]) || candidate.expectedCoreVersion && match[1] !== candidate.expectedCoreVersion) {
    throw new Error(`${candidate.source} Core identity differs from its receipt`);
  }
  return Object.freeze({ source: candidate.source, packageRoot, runtimePath, version: match[1] });
}

export async function readRuntimeJSON(path, label) {
  let info;
  try { info = await lstat(path); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024) throw new Error(`${label} must be a bounded regular file`);
  try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { throw new Error(`${label} is invalid`, { cause: error }); }
}

export async function assertCanonicalDirectory(path, label) {
  const canonical = await realpath(path).catch((error) => { throw new Error(`${label} is unavailable`, { cause: error }); });
  if (canonical !== resolve(path) || !(await stat(canonical)).isDirectory()) throw new Error(`${label} must be a canonical directory`);
}

async function assertCanonicalExecutable(path, label, requireExecutableMode) {
  const info = await lstat(path).catch((error) => { throw new Error(`${label} is unavailable`, { cause: error }); });
  if (!info.isFile() || info.isSymbolicLink() || requireExecutableMode && (info.mode & 0o111) === 0) throw new Error(`${label} must be a regular executable file`);
  await access(path, requireExecutableMode ? fsConstants.X_OK : fsConstants.F_OK);
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error(`${label} must be canonical`);
  return canonical;
}
