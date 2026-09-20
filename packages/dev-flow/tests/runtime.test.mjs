import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { chmod, mkdir, mkdtemp, realpath, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createHostDrivers } from "../lib/hosts/index.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";
import { writeProfileReceipt } from "../lib/hosts/deepseek-receipts.mjs";
import { resolveCoreRuntime, runDevFlow } from "../lib/runtime.mjs";

test("public launcher selects the newest compatible Core from all three Host receipts", async (t) => {
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

  const claudeRoot = join(root, "claude");
  const claudeRuntime = await packageFixture(claudeRoot, "dev-flow-claude", "0.1.0", "0.6.4");
  const claudeReceiptPath = join(paths.productRoot, "registrations", "claude.json");
  await writeFile(claudeReceiptPath, JSON.stringify({
    product: { name: "dev-flow-claude", version: "0.1.0", core_version: "0.6.4" },
    host: { surface: "claude-cli", version: "2.1.270", os: platform, arch },
    paths: { package_root: claudeRoot, runtime_path: claudeRuntime, data_dir: paths.defaultDataDirectory,
      receipt_path: claudeReceiptPath, config_root: join(home, ".claude") },
  }));

  const selected = await resolveCoreRuntime({
    homeDirectory: home,
    environment,
    platform,
    arch,
    exec: async (runtimePath) => ({ stdout: `dev-flow ${runtimePath === codexRuntime ? "0.6.2" : runtimePath === claudeRuntime ? "0.6.4" : "0.6.3"}\n` }),
    initializeDefaultData: true,
  });
  assert.equal(selected.source, "claude");
  assert.equal(selected.version, "0.6.4");
  assert.equal(selected.dataDirectory, paths.defaultDataDirectory);
  if (process.platform !== "win32") assert.equal((await stat(paths.defaultDataDirectory)).mode & 0o777, 0o700);
  await writeFile(join(paths.productRoot, "registrations", "codex.json"), "invalid unrelated receipt");
  const selectedOnly = { host: "claude", homeDirectory: home, environment, platform, arch, requireData: false,
    exec: async executable => {
      assert.equal(executable, claudeRuntime);
      return { stdout: "dev-flow 0.6.4\n" };
    } };
  assert.equal((await resolveCoreRuntime(selectedOnly)).source, "claude");
  await assert.rejects(resolveCoreRuntime({ ...selectedOnly, host: "all" }), /Codex receipt is invalid/);

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
  assert.equal(invalid.code, 2);
  assert.equal(resolved, false);
  assert.match(stderr.text, /invalid WebUI arguments/u);
});

test("non-start WebUI commands never initialize the default data directory", async () => {
  let selectionOptions;
  const result = await runDevFlow(["webui", "status", "--json"], {
    resolveCoreRuntime: async (options) => { selectionOptions = options; throw new Error("data directory is unavailable"); },
    stderr: capture(), stdout: capture(),
  });
  assert.equal(result.code, 1);
  assert.equal(selectionOptions.initializeDefaultData, false);
});

test("Host drivers name only their own recorded Core without executing Core", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-runtime-maintenance-")));
  const home = join(root, "home");
  const dshHome = join(root, "dsh");
  await mkdir(home);
  const environment = { DSH_HOME: dshHome };
  const paths = await resolveManagerPaths({ homeDirectory: home, environment, platform: "darwin", arch: "arm64" });
  const codexRuntime = join(root, "codex", "runtime", "darwin-arm64", "dev-flow");
  const deepseekRuntime = join(dshHome, "profiles", "web", "node_modules", "dev-flow-deepseek", "runtime", "darwin-arm64", "dev-flow");
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  const registration = join(paths.productRoot, "registrations", "codex.json");
  await writeFile(registration, `${JSON.stringify({
    product: { name: "dev-flow-codex", version: "0.8.0", core_version: "0.6.2", codex_compatibility: ">=0.147.0" },
    host: { surface: "codex-cli", version: "0.147.0", os: "darwin", arch: "arm64" },
    paths: { package_root: join(root, "codex"), runtime_path: codexRuntime, data_dir: paths.defaultDataDirectory, receipt_path: registration },
  })}\n`);
  await writeProfileReceipt(paths, {
    profile: "web", package_name: "dev-flow-deepseek", installed_version: "0.8.0", origin: "installed",
    dsh_version: "0.1.0-rc.8", created_at: "2026-08-28T00:00:00Z", updated_at: "2026-08-28T00:00:00Z",
  });

  const drivers = createHostDrivers({ paths, environment });
  const codexTargets = () => drivers.codex.maintenanceTargets({ observed: { packageInstalled: false } });
  assert.deepEqual((await codexTargets()).registeredCorePaths, [codexRuntime]);
  assert.deepEqual((await drivers.deepseek.maintenanceTargets({ profile: "web", observed: { receipt: true } })).registeredCorePaths, [deepseekRuntime]);

  await unlink(registration);
  assert.deepEqual((await codexTargets()).registeredCorePaths, []);
  await writeFile(registration, "not-json\n");
  assert.deepEqual((await codexTargets()).registeredCorePaths, []);
  await assert.rejects(drivers.codex.runtimeCandidates(), /Codex receipt is invalid/);
  assert.deepEqual((await drivers.deepseek.maintenanceTargets({ profile: "web", observed: { receipt: true } })).registeredCorePaths, [deepseekRuntime]);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
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

test("invalid WebUI options and unavailable runtime produce one JSON error", async () => {
  for (const args of [['webui', 'start', '--json', '--plain'], ['webui', 'stop', '--no-open', '--json'], ['webui', 'status', '--json']]) {
    const stdout = capture(); const stderr = capture();
    let selected = false;
    const result = await runDevFlow(args, { stdout, stderr, resolveCoreRuntime: async () => { selected = true; throw new Error('Core executable missing'); } });
    assert.equal(result.code, args[1] === 'status' ? 1 : 2);
    assert.equal(selected, args[1] === 'status');
    assert.equal(JSON.parse(stdout.text).status, 'failed');
    assert.equal(stderr.text, '');
  }
});
