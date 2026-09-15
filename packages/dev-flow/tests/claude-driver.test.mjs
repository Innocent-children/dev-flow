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

