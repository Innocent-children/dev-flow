import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureDefaultDataDirectory, resolveDataDirectory } from "../lib/paths.mjs";
import { preflightPackagedCore, selectPackagedRuntime } from "../lib/runtime.mjs";

const windowsCore = process.env.DEV_FLOW_WINDOWS_CORE;
const nativeWindows = process.platform === "win32" && process.arch === "x64";

test("DeepSeek selects and preflights only the Windows x64 packaged Core", {
  skip: nativeWindows && windowsCore ? false : "set DEV_FLOW_WINDOWS_CORE on Windows x64",
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-windows-")));
  const packageRoot = join(root, "package");
  const runtimePath = join(packageRoot, "runtime", "win32-x64", "dev-flow.exe");
  const home = join(root, "home");
  const localAppData = join(home, "AppData", "Local");
  await Promise.all([mkdir(join(packageRoot, "runtime", "win32-x64"), { recursive: true }), mkdir(localAppData, { recursive: true })]);
  await copyFile(windowsCore, runtimePath);
  t.after(() => rm(root, { recursive: true, force: true }));

  const selection = await selectPackagedRuntime({ packageRoot, platform: "win32", arch: "x64" });
  assert.equal(selection.runtimePath, runtimePath);
  const runtime = await preflightPackagedCore(selection);
  const expectedVersion = (await readFile(new URL("../../../CORE_VERSION", import.meta.url), "utf8")).trim();
  assert.equal(runtime.version, expectedVersion);

  const data = await resolveDataDirectory({
    homeDirectory: home,
    platform: "win32",
    environment: { LOCALAPPDATA: localAppData },
  });
  assert.equal(data.dataDirectory, join(localAppData, "dev-flow", "data"));
  assert.equal(await ensureDefaultDataDirectory(data), data.dataDirectory);
  await assert.rejects(
    selectPackagedRuntime({ packageRoot, platform: "win32", arch: "arm64" }),
    /unsupported platform win32-arm64/u,
  );
});
