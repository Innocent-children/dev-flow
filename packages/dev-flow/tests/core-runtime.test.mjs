import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { inspectCoreRuntime } from "../lib/core-runtime.mjs";

test("shared Core validation rejects changed package identity and Core version before selection", async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-core-identity-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimePath = join(root, "runtime", "test", "core");
  await mkdir(join(root, "runtime", "test"), { recursive: true });
  await writeFile(runtimePath, "test executable");
  await chmod(runtimePath, 0o755);
  const candidate = { source: "test-host", packageRoot: root, runtimePath,
    packageName: "test-adapter", packageVersion: "1.2.3", expectedCoreVersion: "2.0.0" };
  const manifest = join(root, "package.json");
  let executions = 0;
  const exec = async () => { executions++; return { stdout: "dev-flow 2.0.0\n" }; };
  for (const value of [{ name: "other-adapter", version: "1.2.3" }, { name: "test-adapter", version: "1.2.4" }]) {
    await writeFile(manifest, JSON.stringify(value));
    await assert.rejects(inspectCoreRuntime(candidate, { exec }), /package identity differs/);
  }
  assert.equal(executions, 0);
  await writeFile(manifest, JSON.stringify({ name: "test-adapter", version: "1.2.3" }));
  const selected = await inspectCoreRuntime(candidate, { exec });
  assert.equal(selected.version, "2.0.0");
  await assert.rejects(inspectCoreRuntime(candidate, { exec: async () => ({ stdout: "dev-flow 2.0.1\n" }) }), /Core identity differs/);
  await assert.rejects(inspectCoreRuntime(candidate, { exec: async () => ({ stdout: "not a Core\n" }) }), /Core identity differs/);
});

test("shared Core validation rejects a substituted executable without starting it", async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-core-path-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "test-adapter", version: "1.0.0" }));
  const target = join(root, "other-core");
  await writeFile(target, "untrusted executable");
  await chmod(target, 0o755);
  const runtimePath = join(root, "core");
  await symlink(target, runtimePath);
  await assert.rejects(inspectCoreRuntime({ source: "test-host", packageRoot: root, runtimePath,
    packageName: "test-adapter", packageVersion: "1.0.0" }, {
    exec: async () => { throw new Error("must not execute substituted Core"); },
  }), /regular executable file/);
});
