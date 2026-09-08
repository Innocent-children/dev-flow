import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { packageRootFromModule } from "../lib/paths.mjs";
import { selectPackagedRuntime } from "../lib/runtime.mjs";

test("packageRootFromModule handles encoded spaces and Unicode", async (t) => {
  const root = await makeDirectory(t, "encoded space-工具");
  const modulePath = join(root, "lib", "paths.mjs");
  assert.equal(packageRootFromModule(pathToFileURL(modulePath).href), root);
});

test("selects exact supported package paths without executing a runtime", async (t) => {
  const packageDirectory = await makeDirectory(t, "runtime-selection-package");
  for (const [platform, arch, executable] of [["darwin", "arm64", "dev-flow"], ["win32", "x64", "dev-flow.exe"]]) {
    const selected = await selectPackagedRuntime({ packageRoot: packageDirectory, platform, arch });
    assert.equal(selected.runtimeKey, `${platform}-${arch}`);
    assert.equal(selected.runtimePath, join(packageDirectory, "runtime", `${platform}-${arch}`, executable));
  }

  await assert.rejects(
    selectPackagedRuntime({ packageRoot: packageDirectory, platform: "linux", arch: "arm64" }),
    /unsupported platform linux-arm64/,
  );
  await assert.rejects(
    selectPackagedRuntime({ packageRoot: packageDirectory, platform: "darwin", arch: "x64" }),
    /unsupported platform darwin-x64/,
  );
});

async function makeDirectory(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-paths-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  return directory;
}
