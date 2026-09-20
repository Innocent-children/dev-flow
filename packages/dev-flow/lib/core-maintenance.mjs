import { lstat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { execPortableCommand } from "./command.mjs";
import { adapterCoreRuntimePath, inspectMaintainedCore } from "./core-runtime.mjs";
import { ensureManagerDirectories, readOwnedJSON, writeOwnedJSON } from "./ownership.mjs";

/**
 * Keep pre-uninstall Core locations across failed resets until data cleanup succeeds.
 * WebUI owns its runtime receipt; platform implementations own process identity and signals.
 */
export async function stopManagedCores({ targets, dataDirectories, paths, environment, processes, run = execPortableCommand }) {
  const retained = await readResetRecord(paths);
  const candidates = new Map();
  for (const target of targets) {
    if (target.installedRuntime) candidates.set(target.installedRuntime.runtimePath, target.installedRuntime);
    for (const runtimePath of target.registeredCorePaths) {
      if (!candidates.has(runtimePath)) candidates.set(runtimePath, {
        runtimePath, packageRoot: dirname(dirname(dirname(runtimePath))), packageName: `dev-flow-${target.host}`,
      });
    }
  }
  const runtimes = [];
  for (const candidate of candidates.values()) {
    const runtime = await inspectMaintainedCore(candidate, paths);
    if (runtime) runtimes.push(runtime);
  }
  const runtimePaths = [...new Set([...(retained?.runtime_paths ?? []), ...candidates.keys()])].sort();
  const verifiedPaths = new Set(runtimes.map(runtime => runtime.runtimePath));
  const directories = [...new Set(dataDirectories.map(path => resolve(path)))];
  const processOptions = { environment };
  if (runtimePaths.length) {
    const record = { runtime_paths: runtimePaths };
    if (Buffer.byteLength(`${JSON.stringify(record, null, 2)}\n`) > 64 * 1024) throw new Error("Reset Core maintenance record exceeds 64 KiB");
    await ensureManagerDirectories(paths);
    await writeOwnedJSON(resetRecordPath(paths), record, {
      root: paths.managerRoot, enforcePrivateModes: paths.enforcePrivateModes,
    });
  }
  // Retained paths may outlive their package. They can block cleanup, but cannot authorize a signal.
  await processes.assertManagedCoresStopped(runtimePaths.filter(path => !verifiedPaths.has(path)), processOptions);
  await processes.stopStdioCores(runtimes.map(runtime => runtime.runtimePath), processOptions);
  for (const directory of directories) await stopWebUI(directory, runtimes, { environment, run });
  const verifyStopped = async () => {
    await processes.assertManagedCoresStopped(runtimePaths, processOptions);
    for (const directory of directories) {
      if (await hasWebUIReceipt(directory)) throw new Error("A WebUI runtime record appeared after shutdown; close its Host session before resetting");
    }
  };
  await verifyStopped();
  const completeCleanup = async () => {
    const current = await readResetRecord(paths);
    if (current === null) return;
    if (JSON.stringify(current.runtime_paths) !== JSON.stringify(runtimePaths)) throw new Error("Reset Core maintenance record changed during cleanup");
    await unlink(resetRecordPath(paths)).catch(error => { if (error.code !== "ENOENT") throw error; });
  };
  return { verifyStopped, completeCleanup };
}

function resetRecordPath(paths) {
  return join(paths.managerRoot, "reset-core-maintenance.json");
}

async function readResetRecord(paths) {
  const path = resetRecordPath(paths);
  try {
    const info = await lstat(path);
    if (paths.enforcePrivateModes && (info.mode & 0o077) !== 0) throw new Error("Reset Core maintenance record permissions are unsafe");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  return readOwnedJSON(path, { root: paths.managerRoot, validate: value => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1 ||
        !Array.isArray(value.runtime_paths) || value.runtime_paths.length === 0 ||
        new Set(value.runtime_paths).size !== value.runtime_paths.length || value.runtime_paths.some(runtimePath =>
          typeof runtimePath !== "string" || runtimePath.includes("\0") || !isAbsolute(runtimePath) || resolve(runtimePath) !== runtimePath ||
          runtimePath !== adapterCoreRuntimePath(dirname(dirname(dirname(runtimePath))), paths))) {
      throw new Error("Reset Core maintenance record is invalid");
    }
    return { runtime_paths: [...value.runtime_paths].sort() };
  } });
}

async function stopWebUI(directory, runtimes, { environment, run }) {
  if (!await hasWebUIReceipt(directory)) return;
  let detail = "no managed Core executable is available";
  for (const runtime of runtimes) {
    const options = { env: { ...environment, DEV_FLOW_DATA_DIR: directory }, cwd: runtime.packageRoot,
      encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024, windowsHide: true };
    let state;
    try { state = JSON.parse((await run(runtime.runtimePath, ["webui", "status", "--json"], options)).stdout); }
    catch (error) { detail = error.message; continue; }
    if (!await hasWebUIReceipt(directory)) return;
    if (state.readiness !== "ready" || !Number.isInteger(state.pid) || state.pid <= 0) {
      detail = `managed WebUI is ${state.readiness ?? "unknown"}`;
      continue;
    }
    const stopped = JSON.parse((await run(runtime.runtimePath, ["webui", "stop", "--json"], options)).stdout);
    if (stopped.readiness !== "unavailable" || await hasWebUIReceipt(directory)) throw new Error("The managed WebUI did not stop");
    return;
  }
  throw new Error(`Cannot safely stop the WebUI before resetting ${directory}: ${detail}`);
}

async function hasWebUIReceipt(directory) {
  try {
    const info = await lstat(join(directory, "webui-runtime.json"));
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("WebUI runtime record must be a regular file");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
