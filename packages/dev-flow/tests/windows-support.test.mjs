import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { inspectResource, moveTargetsToTrash, resolveManagerPaths } from "../lib/ownership.mjs";
import { resolveCoreRuntime } from "../lib/runtime.mjs";

const windowsCore = process.env.DEV_FLOW_WINDOWS_CORE;
const nativeWindows = process.platform === "win32" && process.arch === "x64";

test("unified CLI discovers a Windows x64 Codex Core and uses LOCALAPPDATA", {
  skip: nativeWindows && windowsCore ? false : "set DEV_FLOW_WINDOWS_CORE on Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-manager-windows-")));
  const home = join(root, "home");
  const localAppData = join(home, "AppData", "Local");
  const packageRoot = join(root, "node_modules", "dev-flow-codex");
  const runtimePath = join(packageRoot, "runtime", "win32-x64", "dev-flow.exe");
  const dataDirectory = join(localAppData, "dev-flow", "data");
  const receiptPath = join(localAppData, "dev-flow", "registrations", "codex.json");
  await Promise.all([
    mkdir(join(packageRoot, "runtime", "win32-x64"), { recursive: true }),
    mkdir(dataDirectory, { recursive: true }),
    mkdir(join(localAppData, "dev-flow", "registrations"), { recursive: true }),
  ]);
  await copyFile(windowsCore, runtimePath);
  const version = (await readFile(new URL("../../../CORE_VERSION", import.meta.url), "utf8")).trim();
  await writeFile(join(packageRoot, "package.json"), `${JSON.stringify({ name: "dev-flow-codex", version: "0.8.5" })}\n`);
  await writeFile(receiptPath, `${JSON.stringify({
    product: { name: "dev-flow-codex", version: "0.8.5", core_version: version, codex_compatibility: ">=0.147.0" },
    host: { surface: "codex-cli", version: "0.147.0", os: "win32", arch: "x64" },
    paths: { package_root: packageRoot, runtime_path: runtimePath, data_dir: dataDirectory, receipt_path: receiptPath },
  })}\n`);
  t.after(() => rm(root, { recursive: true, force: true }));

  const environment = { ...process.env, LOCALAPPDATA: localAppData };
  delete environment.DEV_FLOW_DATA_DIR;
  const paths = await resolveManagerPaths({ homeDirectory: home, environment, platform: "win32", arch: "x64" });
  assert.equal(paths.productRoot, join(localAppData, "dev-flow"));
  assert.equal(paths.managerRoot, join(localAppData, "create-dev-flow"));
  assert.equal(paths.trashDirectory, join(localAppData, "create-dev-flow", "trash"));

  const selected = await resolveCoreRuntime({ homeDirectory: home, environment, platform: "win32", arch: "x64" });
  assert.equal(selected.runtimePath, runtimePath);
  assert.equal(selected.dataDirectory, dataDirectory);
  assert.equal(selected.version, version);
});

test("Windows recoverable cleanup moves exact data into the manager quarantine", {
  skip: nativeWindows ? false : "requires Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-manager-windows-trash-")));
  const home = join(root, "home");
  const localAppData = join(home, "AppData", "Local");
  await mkdir(localAppData, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));

  const paths = await resolveManagerPaths({
    homeDirectory: home,
    environment: { LOCALAPPDATA: localAppData },
    platform: "win32",
    arch: "x64",
  });
  await mkdir(paths.defaultDataDirectory, { recursive: true });
  await writeFile(join(paths.defaultDataDirectory, "evidence.txt"), "retained\n");
  const target = await inspectResource(paths.defaultDataDirectory, "default Task data");
  const result = await moveTargetsToTrash(paths, [target], {
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    random: () => "abcdef123456",
  });

  assert.equal(result.trashRoot.startsWith(`${paths.trashDirectory}\\`), true);
  assert.equal(result.moved.length, 1);
  assert.equal(await readFile(join(result.moved[0].destination, "evidence.txt"), "utf8"), "retained\n");
  await assert.rejects(readFile(join(paths.defaultDataDirectory, "evidence.txt")), (error) => error?.code === "ENOENT");
});
