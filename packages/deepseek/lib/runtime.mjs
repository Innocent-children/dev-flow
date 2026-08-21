import { execFile as execFileCallback } from "node:child_process";
import { lstat, realpath, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { containedPath, packageRootFromModule } from "./paths.mjs";

export const SUPPORTED_RUNTIME_KEY = "darwin-arm64";

const execFile = promisify(execFileCallback);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export async function selectPackagedRuntime({
  packageRoot = packageRootFromModule(import.meta.url),
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const runtimeKey = `${platform}-${arch}`;
  if (runtimeKey !== SUPPORTED_RUNTIME_KEY) {
    throw new Error(`unsupported platform ${runtimeKey}; dev-flow-deepseek supports ${SUPPORTED_RUNTIME_KEY}`);
  }

  const canonicalPackageRoot = await canonicalPackageDirectory(packageRoot);
  return Object.freeze({
    packageRoot: canonicalPackageRoot,
    runtimeKey,
    runtimePath: containedPath(
      canonicalPackageRoot,
      join(canonicalPackageRoot, "runtime", runtimeKey, "dev-flow"),
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
  if (!selection || selection.runtimeKey !== SUPPORTED_RUNTIME_KEY) {
    throw new Error("packaged Core selection must use darwin-arm64");
  }
  const expectedRuntimePath = containedPath(
    selection.packageRoot,
    join(selection.packageRoot, "runtime", SUPPORTED_RUNTIME_KEY, "dev-flow"),
    "packaged Core runtime",
  );
  if (selection.runtimePath !== expectedRuntimePath) {
    throw new Error("packaged Core must use the exact package-relative runtime path");
  }
  await assertRegularExecutableFile(selection.runtimePath);

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

async function assertRegularExecutableFile(path) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    throw new Error("packaged Core must be a regular executable file", { cause: error });
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error("packaged Core must be a regular executable file");
  }
  if ((info.mode & 0o111) === 0) {
    throw new Error("packaged Core must have executable mode");
  }
  const canonical = await realpath(path);
  if (canonical !== path) {
    throw new Error("packaged Core must use a canonical package-relative runtime path");
  }
}
