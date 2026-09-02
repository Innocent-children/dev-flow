import { execFile as execFileCallback } from "node:child_process";
import { lstat, realpath, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { containedPath, packageRootFromModule } from "./paths.mjs";
import { permissionPolicy, runtimeDescriptor } from "./platform.mjs";

const execFile = promisify(execFileCallback);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export async function selectPackagedRuntime({
  packageRoot = packageRootFromModule(import.meta.url),
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const runtime = runtimeDescriptor(platform, arch);
  const permissions = permissionPolicy(platform, arch);

  const canonicalPackageRoot = await canonicalPackageDirectory(packageRoot);
  return Object.freeze({
    packageRoot: canonicalPackageRoot,
    platform: runtime.platform,
    arch: runtime.arch,
    runtimeKey: runtime.runtimeKey,
    requireExecutableMode: permissions.requireExecutableMode,
    runtimePath: containedPath(
      canonicalPackageRoot,
      join(canonicalPackageRoot, "runtime", runtime.runtimeDirectory, runtime.runtimeExecutable),
      "packaged Core runtime",
    ),
  });
}

export async function preflightPackagedCore(
  selection,
  {
    environment = process.env,
    currentDirectory = dirname(selection?.runtimePath ?? "."),
  } = {},
) {
  if (!selection) {
    throw new Error("packaged Core selection is required");
  }
  const runtime = runtimeDescriptor(
    selection.platform ?? selection.runtimeKey.split("-")[0],
    selection.arch ?? selection.runtimeKey.split("-")[1],
  );
  const permissions = permissionPolicy(runtime.platform, runtime.arch);
  if (selection.runtimeKey !== runtime.runtimeKey) {
    throw new Error("packaged Core selection does not match its platform");
  }
  const expectedRuntimePath = containedPath(
    selection.packageRoot,
    join(selection.packageRoot, "runtime", runtime.runtimeDirectory, runtime.runtimeExecutable),
    "packaged Core runtime",
  );
  if (selection.runtimePath !== expectedRuntimePath) {
    throw new Error("packaged Core must use the exact package-relative runtime path");
  }
  await assertRegularExecutableFile(
    selection.runtimePath,
    selection.requireExecutableMode ?? permissions.requireExecutableMode,
  );

  let stdout;
  try {
    ({ stdout } = await execFile(selection.runtimePath, ["version"], {
      cwd: currentDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    throw new Error("packaged Core version preflight failed", { cause: error });
  }

  const match = /^dev-flow (\S+)\n?$/u.exec(stdout);
  if (!match || !semverPattern.test(match[1])) {
    throw new Error("packaged Core returned an invalid version line");
  }
  return Object.freeze({ ...selection, version: match[1] });
}

async function canonicalPackageDirectory(path) {
  try {
    const canonical = await realpath(path);
    const info = await stat(canonical);
    if (!info.isDirectory()) throw new Error("not a directory");
    return canonical;
  } catch (error) {
    throw new Error("package root must name an existing directory", { cause: error });
  }
}

async function assertRegularExecutableFile(path, requireExecutableMode) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    throw new Error("packaged Core must be a regular executable file", { cause: error });
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("packaged Core must be a regular executable file");
  }
  if (requireExecutableMode && (info.mode & 0o111) === 0) {
    throw new Error("packaged Core must have executable mode");
  }
  const canonical = await realpath(path);
  if (canonical !== path) {
    throw new Error("packaged Core must use a canonical package-relative runtime path");
  }
}
