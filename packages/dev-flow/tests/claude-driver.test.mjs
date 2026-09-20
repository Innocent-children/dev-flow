import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createClaudeDriver } from "../lib/hosts/claude.mjs";
async function orphanFixture(t, foreign = false) {
  const root = await mkdtemp(join(tmpdir(), "claude-orphan-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = { productRoot: join(root, "dev-flow"), homeDirectory: root };
  const receiptPath = join(paths.productRoot, "registrations", "claude.json");
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  const packageRoot = join(root, "removed-package");
  await writeFile(receiptPath, JSON.stringify({ product: { name: "dev-flow-claude" }, paths: { package_root: packageRoot, receipt_path: receiptPath, config_root: join(root, ".claude") } }));
  const effects = [];
  const run = async (exe, args) => {
    if (exe === "dev-flow-claude") throw new Error("package missing");
    if (exe === "npm") return { stdout: '{"dependencies":{}}' };
    if (args[0] === "--version") return { stdout: "2.1.270 (Claude Code)" };
    if (args[1] === "list") return { stdout: JSON.stringify([{ id: "dev-flow-claude@dev-flow-claude-local", scope: "user" }]) };
    if (args[1] === "marketplace" && args[2] === "list") return { stdout: JSON.stringify([{ name: "dev-flow-claude-local", source: "directory", path: foreign ? join(root, "foreign") : packageRoot }]) };
    effects.push([exe, ...args]); return { stdout: '{"outcome":"ok"}' };
  };
  return { driver: createClaudeDriver({ paths, environment: {}, run }), receiptPath, effects };
}
test("Claude orphan removal verifies ownership and does not need the missing package executable", async t => {
  const f = await orphanFixture(t);
  const observed = await f.driver.observe();
  assert.equal(observed.orphanedRegistration, true); assert.equal(observed.state, "partial");
  await f.driver.execute("uninstall", { observed });
  await assert.rejects(readFile(f.receiptPath), { code: "ENOENT" });
  assert.equal(f.effects.length, 2);
  assert.ok(f.effects.every(args => args[0] === "claude"));
});
test("Claude orphan removal refuses a replacement marketplace without mutation", async t => {
  const f = await orphanFixture(t, true);
  await assert.rejects(f.driver.execute("uninstall", { observed: await f.driver.observe() }), /ownership changed/);
  assert.equal(f.effects.length, 0); assert.ok(await readFile(f.receiptPath));
});

test("Claude reset includes the owned user plugin cache Core before uninstall", async t => {
  const root = await mkdtemp(join(tmpdir(), "claude-reset-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = { productRoot: join(root, "dev-flow"), homeDirectory: root, runtimeDirectory: "darwin-arm64", runtimeExecutable: "dev-flow" };
  const npmRoot = join(root, "npm"), packageRoot = join(npmRoot, "dev-flow-claude");
  const cachedRoot = join(root, "claude-cache", "dev-flow-claude");
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  await mkdir(join(packageRoot, "runtime", "darwin-arm64"), { recursive: true });
  await writeFile(runtimePath, "fixture");
  await mkdir(join(paths.productRoot, "registrations"), { recursive: true });
  await writeFile(join(paths.productRoot, "registrations", "claude.json"), JSON.stringify({ paths: { package_root: packageRoot, runtime_path: runtimePath } }));
  let marketplacePath = packageRoot, scope = "user", installPath = cachedRoot;
  const calls = [];
  const run = async (exe, args) => {
    calls.push([exe, ...args]);
    if (exe === "npm") { assert.deepEqual(args, ["root", "--global"]); return { stdout: npmRoot }; }
    assert.equal(exe, "claude");
    if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "dev-flow-claude-local", source: "directory", path: marketplacePath }]) };
    assert.deepEqual(args, ["plugin", "list", "--json"]);
    return { stdout: JSON.stringify([{ id: "dev-flow-claude@dev-flow-claude-local", scope, installPath }]) };
  };
  const driver = createClaudeDriver({ paths, environment: {}, run });
  const observed = { packageInstalled: true, receipt: true };
  const replacement = await driver.maintenanceTargets({ observed, operation: "upgrade" });
  assert.deepEqual(replacement.registeredCorePaths, [runtimePath]);
  assert.equal(calls.length, 1);
  const reset = await driver.maintenanceTargets({ observed, operation: "factory-reset" });
  assert.deepEqual(reset.registeredCorePaths, [runtimePath, join(cachedRoot, "runtime", "darwin-arm64", "dev-flow")]);
  assert.equal(reset.installedRuntime.runtimePath, runtimePath);
  marketplacePath = join(root, "foreign-source");
  await assert.rejects(driver.maintenanceTargets({ observed, operation: "factory-reset" }), /ownership changed/);
  marketplacePath = packageRoot;
  scope = "project";
  await assert.rejects(driver.maintenanceTargets({ observed, operation: "factory-reset" }), /Other plugin scopes/);
  scope = "user"; installPath = "relative-cache";
  await assert.rejects(driver.maintenanceTargets({ observed, operation: "factory-reset" }), /path is unavailable/);
});
