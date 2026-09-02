import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { chmod, mkdir, mkdtemp, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveManagerPaths, writeProfileReceipt } from "../lib/ownership.mjs";
import { resolveCoreRuntime, runDevFlow } from "../lib/runtime.mjs";

test("public launcher selects the newest compatible Core from Codex or DeepSeek receipts", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-runtime-selection-")));
  const home = join(root, "home");
  const dshHome = join(root, "dsh");
  await mkdir(home);
  const platform = process.platform === "win32" ? "win32" : "darwin";
  const arch = process.platform === "win32" ? "x64" : "arm64";
  const environment = { DSH_HOME: dshHome };
  if (platform === "win32") {
    environment.LOCALAPPDATA = join(home, "AppData", "Local");
    await mkdir(environment.LOCALAPPDATA, { recursive: true });
  }
  const paths = await resolveManagerPaths({ homeDirectory: home, environment, platform, arch });

  const codexRoot = join(root, "codex");
  const codexRuntime = await packageFixture(codexRoot, "dev-flow-codex", "0.8.0", "0.6.2");
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  await writeFile(join(paths.productRoot, "registrations", "codex.json"), `${JSON.stringify({
    product: { name: "dev-flow-codex", version: "0.8.0", core_version: "0.6.2", codex_compatibility: ">=0.147.0" },
    host: { surface: "codex-cli", version: "0.147.0", os: platform, arch },
    paths: { package_root: codexRoot, runtime_path: codexRuntime, data_dir: paths.defaultDataDirectory, receipt_path: join(paths.productRoot, "registrations", "codex.json") },
  })}\n`);

  const deepseekRoot = join(dshHome, "profiles", "web", "node_modules", "dev-flow-deepseek");
  await packageFixture(deepseekRoot, "dev-flow-deepseek", "0.8.0", "0.6.3");
  await writeProfileReceipt(paths, {
    profile: "web", package_name: "dev-flow-deepseek", installed_version: "0.8.0", origin: "installed",
    dsh_version: "0.1.0-rc.8", created_at: "2026-08-28T00:00:00Z", updated_at: "2026-08-28T00:00:00Z",
  });

  const selected = await resolveCoreRuntime({
    homeDirectory: home,
    environment,
    platform,
    arch,
    exec: async (runtimePath) => ({ stdout: `dev-flow ${runtimePath === codexRuntime ? "0.6.2" : "0.6.3"}\n` }),
    initializeDefaultData: true,
  });
  assert.equal(selected.source, "deepseek/web");
  assert.equal(selected.version, "0.6.3");
  assert.equal(selected.dataDirectory, paths.defaultDataDirectory);
  if (process.platform !== "win32") assert.equal((await stat(paths.defaultDataDirectory)).mode & 0o777, 0o700);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("public launcher forwards only the WebUI command surface to the selected Core", async () => {
  const calls = [];
  const selections = [];
  const child = new EventEmitter();
  child.kill = () => true;
  const signalSource = new EventEmitter();
  const pending = runDevFlow(["webui", "start", "--no-open"], {
    environment: { LANG: "en_US.UTF-8" },
    resolveCoreRuntime: async (options) => { selections.push(options); return { runtimePath: "/runtime/dev-flow", packageRoot: "/package", dataDirectory: "/data", version: "0.6.3", source: "codex", forwardedSignals: ["SIGINT", "SIGTERM", "SIGHUP"] }; },
    spawnImpl: (executable, arguments_, options) => { calls.push({ executable, arguments_, options }); return child; },
    signalSource,
  });
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  child.emit("exit", 0, null);
  assert.deepEqual(await pending, { code: 0, signal: null });
  assert.equal(calls[0].executable, "/runtime/dev-flow");
  assert.deepEqual(calls[0].arguments_, ["webui", "start", "--no-open"]);
  assert.equal(calls[0].options.env.DEV_FLOW_DATA_DIR, "/data");
  assert.equal(selections[0].initializeDefaultData, true);

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

test("non-start WebUI commands never initialize the default data directory", async () => {
  let selectionOptions;
  const result = await runDevFlow(["webui", "status", "--json"], {
    resolveCoreRuntime: async (options) => { selectionOptions = options; throw new Error("data directory is unavailable"); },
    stderr: capture(),
  });
  assert.equal(result.code, 1);
  assert.equal(selectionOptions.initializeDefaultData, false);
});

async function packageFixture(root, name, version, coreVersion) {
  const runtimeKey = process.platform === "win32" ? "win32-x64" : "darwin-arm64";
  const executable = process.platform === "win32" ? "dev-flow.exe" : "dev-flow";
  const runtime = join(root, "runtime", runtimeKey, executable);
  await mkdir(join(root, "runtime", runtimeKey), { recursive: true });
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name, version })}\n`);
  await writeFile(runtime, `#!/bin/sh\nprintf 'dev-flow ${coreVersion}\\n'\n`);
  await chmod(runtime, 0o755);
  return runtime;
}

function capture() {
  let text = "";
  return { write(value) { text += value; }, get text() { return text; } };
}
