import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { chmod, mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveManagerPaths, writeProfileReceipt } from "../lib/ownership.mjs";
import { NoRuntimeError, resolveCoreRuntime, runDevFlow } from "../lib/runtime.mjs";

test("public launcher selects the newest compatible Core from Codex or DeepSeek receipts", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-runtime-selection-")));
  const home = join(root, "home");
  const dshHome = join(root, "dsh");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: { DSH_HOME: dshHome } });
  await mkdir(paths.defaultDataDirectory, { recursive: true });

  const codexRoot = join(root, "codex");
  const codexRuntime = await packageFixture(codexRoot, "dev-flow-codex", "0.8.0", "0.6.2");
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  await writeFile(join(paths.productRoot, "registrations", "codex.json"), `${JSON.stringify({
    product: { name: "dev-flow-codex", version: "0.8.0", core_version: "0.6.2", codex_compatibility: ">=0.147.0" },
    paths: { package_root: codexRoot, runtime_path: codexRuntime, data_dir: paths.defaultDataDirectory, receipt_path: join(paths.productRoot, "registrations", "codex.json") },
  })}\n`);

  const deepseekRoot = join(dshHome, "profiles", "web", "node_modules", "dev-flow-deepseek");
  await packageFixture(deepseekRoot, "dev-flow-deepseek", "0.8.0", "0.6.3");
  await writeProfileReceipt(paths, {
    profile: "web", package_name: "dev-flow-deepseek", installed_version: "0.8.0", origin: "installed",
    dsh_version: "0.1.0-rc.8", created_at: "2026-08-28T00:00:00Z", updated_at: "2026-08-28T00:00:00Z",
  });

  const selected = await resolveCoreRuntime({ homeDirectory: home, environment: { DSH_HOME: dshHome } });
  assert.equal(selected.source, "deepseek/web");
  assert.equal(selected.version, "0.6.3");
  assert.equal(selected.dataDirectory, paths.defaultDataDirectory);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("public launcher forwards only the WebUI command surface to the selected Core", async () => {
  const calls = [];
  const child = new EventEmitter();
  child.kill = () => true;
  const signalSource = new EventEmitter();
  const pending = runDevFlow(["webui", "start", "--no-open"], {
    environment: { LANG: "en_US.UTF-8" },
    resolveCoreRuntime: async () => ({ runtimePath: "/runtime/dev-flow", packageRoot: "/package", dataDirectory: "/data", version: "0.6.3", source: "codex" }),
    spawnImpl: (executable, arguments_, options) => { calls.push({ executable, arguments_, options }); return child; },
    signalSource,
  });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  child.emit("exit", 0, null);
  assert.deepEqual(await pending, { code: 0, signal: null });
  assert.equal(calls[0].executable, "/runtime/dev-flow");
  assert.deepEqual(calls[0].arguments_, ["webui", "start", "--no-open"]);
  assert.equal(calls[0].options.env.DEV_FLOW_DATA_DIR, "/data");

  let resolved = false;
  const stderr = capture();
  const invalid = await runDevFlow(["webui", "serve"], {
    stderr,
    resolveCoreRuntime: async () => { resolved = true; throw new Error("unexpected"); },
  });
  assert.equal(invalid.code, 1);
  assert.equal(resolved, false);
  assert.match(stderr.text, /invalid arguments/u);
});

test("version remains available when no Adapter currently provides Core", async () => {
  const stdout = capture();
  const result = await runDevFlow(["version"], {
    stdout,
    resolveCoreRuntime: async () => { throw new NoRuntimeError("absent"); },
  });
  assert.equal(result.code, 0);
  assert.equal(stdout.text, "dev-flow 0.1.0 (core unavailable)\n");
});

async function packageFixture(root, name, version, coreVersion) {
  const runtime = join(root, "runtime", "darwin-arm64", "dev-flow");
  await mkdir(join(root, "runtime", "darwin-arm64"), { recursive: true });
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name, version })}\n`);
  await writeFile(runtime, `#!/bin/sh\nprintf 'dev-flow ${coreVersion}\\n'\n`);
  await chmod(runtime, 0o755);
  return runtime;
}

function capture() {
  let text = "";
  return { write(value) { text += value; }, get text() { return text; } };
}
