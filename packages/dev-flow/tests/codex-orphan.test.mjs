import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createCodexDriver } from "../lib/hosts/codex.mjs";
import { inspectOrphanRegistration, removeOrphanRegistration } from "../lib/hosts/codex-orphan.mjs";

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-orphan-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const platform = process.platform === "win32" ? "win32" : "darwin";
  const paths = { productRoot: join(root, "product"), defaultDataDirectory: join(root, "product", "data"),
    platform, arch: platform === "win32" ? "x64" : "arm64",
    runtimeDirectory: platform === "win32" ? "win32-x64" : "darwin-arm64", runtimeExecutable: platform === "win32" ? "dev-flow.exe" : "dev-flow" };
  const packageRoot = join(root, "npm", "dev-flow-codex");
  const receiptPath = join(paths.productRoot, "registrations", "codex.json");
  const registration = { marketplace_name: "dev-flow-local", marketplace_root: packageRoot,
    plugin_name: "dev-flow-codex", plugin_selector: "dev-flow-codex@dev-flow-local", plugin_root: join(packageRoot, "plugin") };
  const receipt = { product: { name: "dev-flow-codex", version: "0.9.3" }, registration,
    paths: { package_root: packageRoot, runtime_path: join(packageRoot, "runtime", paths.runtimeDirectory, paths.runtimeExecutable),
      data_dir: paths.defaultDataDirectory, receipt_path: receiptPath } };
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  await mkdir(paths.defaultDataDirectory);
  await writeFile(join(paths.defaultDataDirectory, "dev-flow.db"), "preserve task data");
  await writeFile(receiptPath, JSON.stringify(receipt));
  const state = { markets: [{ name: registration.marketplace_name, root: packageRoot }],
    plugins: [{ pluginId: registration.plugin_selector, name: registration.plugin_name, marketplaceName: registration.marketplace_name,
      version: "0.10.1", installed: true, source: { source: "local", path: registration.plugin_root },
      marketplaceSource: { sourceType: "local", source: packageRoot } }] };
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, ...args]);
    const json = value => ({ stdout: JSON.stringify(value) });
    if (command === "dev-flow-codex") throw Object.assign(new Error("not installed"), { code: "ENOENT" });
    if (command === "npm" && args[0] === "list") return json({ dependencies: {} });
    if (command === "codex" && args[0] === "--version") return { stdout: "codex-cli 0.152.1" };
    if (args.join(" ") === "plugin marketplace list --json") return json({ marketplaces: state.markets });
    if (args.join(" ") === "plugin list --json") return json({ installed: state.plugins, available: [] });
    if (args[0] === "plugin" && args[1] === "remove") {
      state.plugins = [];
      return json({ pluginId: registration.plugin_selector, name: registration.plugin_name, marketplaceName: registration.marketplace_name });
    }
    if (args[0] === "plugin" && args[2] === "remove") {
      state.markets = [];
      return json({ marketplaceName: registration.marketplace_name, installedRoot: null });
    }
    throw new Error(`unexpected command ${command} ${args.join(" ")}`);
  };
  return { paths, packageRoot, receiptPath, receipt, state, calls, run, driver: createCodexDriver({ paths, run }),
    options: { run, codexExecutable: "codex", environment: {} } };
}

test("missing package remains discoverable and its registration can be uninstalled repeatedly", async t => {
  const f = await fixture(t);
  const observed = await f.driver.observe();
  assert.equal(observed.state, "partial");
  assert.equal(observed.packageInstalled, false);
  assert.equal(observed.orphanedRegistration, true);
  const result = await f.driver.execute("uninstall", { observed });
  assert.deepEqual(result.completedSteps, ["codex.remove_registration"]);
  assert.deepEqual(f.state, { markets: [], plugins: [] });
  await assert.rejects(stat(f.receiptPath), { code: "ENOENT" });
  assert.equal(await readFile(join(f.paths.defaultDataDirectory, "dev-flow.db"), "utf8"), "preserve task data");
  const absent = await f.driver.observe();
  assert.equal(absent.state, "absent");
  assert.equal((await f.driver.execute("uninstall", { observed: absent })).changed, false);
});

test("orphan cleanup rejects foreign registration before any removal", async t => {
  const f = await fixture(t);
  f.state.plugins[0].source.path = join(f.packageRoot, "foreign");
  await assert.rejects(removeOrphanRegistration(f.paths, f.options), /ownership conflict/);
  assert.equal(f.calls.some(call => call.includes("remove")), false);
  assert.ok(await stat(f.receiptPath));
});

test("orphan cleanup rejects a remaining WebUI record and a reappearing package", async t => {
  const f = await fixture(t);
  await writeFile(join(f.paths.defaultDataDirectory, "webui-runtime.json"), "{}");
  await assert.rejects(removeOrphanRegistration(f.paths, f.options), /runtime record remains/);
  assert.deepEqual(f.calls, []);
  await mkdir(f.packageRoot, { recursive: true });
  await assert.rejects(inspectOrphanRegistration(f.paths), /package still exists/);
});

test("orphan cleanup rejects a receipt copied from another data root", async t => {
  const f = await fixture(t);
  const other = join(f.paths.productRoot, "another.json");
  await writeFile(other, "{}");
  f.receipt.paths.receipt_path = other;
  await writeFile(f.receiptPath, JSON.stringify(f.receipt));
  await assert.rejects(removeOrphanRegistration(f.paths, f.options), /ownership conflict/);
  assert.deepEqual(f.calls, []);
});

test("orphan cleanup reports partial removal and resumes without the removed plugin", async t => {
  const f = await fixture(t);
  const driver = createCodexDriver({ paths: f.paths, run: async (command, args, options) => {
    if (args[1] === "marketplace" && args[2] === "remove") throw new Error("Host removal interrupted");
    return f.run(command, args, options);
  } });
  await assert.rejects(driver.execute("uninstall", { observed: await driver.observe() }), error => {
    assert.equal(error.changed, true);
    assert.equal(error.nextStep, "dev-flow uninstall --host codex --yes");
    return /interrupted/.test(error.message);
  });
  assert.deepEqual(f.state.plugins, []);
  assert.ok(await stat(f.receiptPath));
  await f.driver.execute("uninstall", { observed: await f.driver.observe() });
  assert.deepEqual(f.state, { markets: [], plugins: [] });
});
