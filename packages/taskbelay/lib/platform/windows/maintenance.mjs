import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { adapterCoreRuntimePath } from "../../core-runtime.mjs";
import { execPortableCommand } from "../../command.mjs";
import { stopStdioCores } from "./core-processes.mjs";
export { stopStdioCores, assertManagedCoresStopped } from "./core-processes.mjs";

/**
 * Resolve Windows filesystem aliases after a confirmed installation creates its directories.
 */
export async function prepareInstallation(paths) {
  await mkdir(paths.productRoot, { recursive: true });
  await mkdir(paths.managerRoot, { recursive: true });
  return true;
}

/**
 * Windows cannot replace a running executable. Stop only processes using the maintained Core.
 */
export async function prepareReplacement({ runtime, paths, environment, run = execPortableCommand }) {
  const dataDirectory = paths.explicitDataDirectory ?? paths.defaultDataDirectory;
  try { await lstat(dataDirectory); await lstat(runtime.runtimePath); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  const executable = await realpath(runtime.runtimePath);
  const packageRoot = await realpath(runtime.packageRoot);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (manifest.name !== runtime.packageName || executable !== adapterCoreRuntimePath(packageRoot, paths)) {
    throw new Error("maintained Core must belong to its Adapter package");
  }
  const options = { env: { ...environment, TASKBELAY_DATA_DIR: dataDirectory }, encoding: "utf8", timeout: 10000, windowsHide: true };
  const powershell = join(environment.SystemRoot ?? environment.SYSTEMROOT ?? process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  await stopStdioCores([executable], { environment, run });
  const state = JSON.parse((await run(executable, ["webui", "status", "--json"], options)).stdout);
  if (!Number.isInteger(state.pid) || state.pid <= 0) return;
  const image = (await run(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
    `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); (Get-Process -Id ${state.pid} -ErrorAction SilentlyContinue).Path`,
  ], options)).stdout.trim();
  if (!image || resolve(image).toLowerCase() !== resolve(executable).toLowerCase()) return;
  if (state.readiness !== "ready") throw new Error("the maintained WebUI cannot be stopped safely");
  const stopped = JSON.parse((await run(executable, ["webui", "stop", "--json"], options)).stdout);
  if (stopped.readiness !== "unavailable") throw new Error("the maintained WebUI did not stop");
}
