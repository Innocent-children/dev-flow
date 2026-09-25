import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup, status, remove } from "../lib/lifecycle.mjs";
import { paths } from "../lib/runtime.mjs";

async function fixture(t) {
  const home = await realpath(await mkdtemp(join(tmpdir(), "zcode lifecycle 空格 ")));
  t.after(() => rm(home, { recursive: true, force: true }));
  const packageRoot = join(home, "package");
  await mkdir(join(packageRoot, ".zcode-plugin"), { recursive: true });
  const manifest = { name: "taskbelay-zcode", version: "0.1.0", files: [".zcode-plugin/plugin.json", "marketplace.json", "payload.txt"] };
  await writeFile(join(packageRoot, "package.json"), JSON.stringify(manifest));
  await writeFile(join(packageRoot, ".zcode-plugin", "plugin.json"), JSON.stringify({ name: manifest.name, version: manifest.version }));
  await writeFile(join(packageRoot, "marketplace.json"), JSON.stringify({ name: "taskbelay-zcode-local", plugins: [{ name: manifest.name, version: manifest.version, source: "./" }] }));
  await writeFile(join(packageRoot, "payload.txt"), "package payload");
  const options = { packageRoot, environment: { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: join(home, "appdata"), TASKBELAY_DATA_DIR: "" },
    core: async args => { assert.deepEqual(args, ["version"]); return { stdout: "taskbelay 0.18.0\n" }; } };
  return { options, home, p: await paths(options.environment, options) };
}

test("local setup is idempotent and does not pretend to register or load a ZCode plugin", async t => {
  const { options, home, p } = await fixture(t);
  assert.equal((await status(options)).status, "partial");
  const initial = await setup(options);
  assert.equal(initial.status, "action_required");
  assert.equal(initial.changed, true);
  assert.deepEqual(initial.registration, { receipt: true, package: true, host: "unverified", phase: "prepared" });
  assert.match(initial.next_steps.join("\n"), /Settings > Plugins/);
  assert.match(initial.next_steps.join("\n"), /version is unchanged/);
  const receipt = JSON.parse(await readFile(p.receiptPath, "utf8"));
  assert.equal(receipt.host.surface, "zcode-ui");
  assert.equal(receipt.paths.marketplace_path, join(options.packageRoot, "marketplace.json"));
  assert.match(receipt.package_digest, /^[a-f0-9]{64}$/);
  assert.equal((await setup(options)).changed, false);
  assert.equal((await status(options)).status, "action_required");
  await assert.rejects(readFile(join(home, ".zcode", "cli", "config.json")), { code: "ENOENT" });
  await assert.rejects(readFile(join(p.dataDirectory, "state.db")), { code: "ENOENT" });
});

test("changed local package content invalidates preparation even at the same version", async t => {
  const { options, p } = await fixture(t);
  await setup(options);
  const before = await readFile(p.receiptPath, "utf8");
  await writeFile(join(options.packageRoot, "payload.txt"), "updated without a version change");
  assert.equal((await status(options)).status, "partial");
  assert.equal((await setup(options)).changed, true);
  assert.notEqual(await readFile(p.receiptPath, "utf8"), before);
  await rm(join(options.packageRoot, "payload.txt"));
  const broken = await status(options);
  assert.equal(broken.status, "partial");
  assert.equal(broken.registration.package, false);
  await assert.rejects(setup(options), /ENOENT/);
});

test("normal removal preserves data and pending UI work until explicit human confirmation", async t => {
  const { options, home, p } = await fixture(t);
  await setup(options);
  await mkdir(p.dataDirectory, { recursive: true });
  await writeFile(join(p.dataDirectory, "task.txt"), "retained task");
  await mkdir(join(home, ".zcode"));
  await writeFile(join(home, ".zcode", "unrelated.json"), "keep");
  const removed = await remove(options);
  assert.equal(removed.status, "action_required");
  assert.equal(removed.registration.phase, "removal_required");
  assert.match(removed.next_steps.join("\n"), /After the user confirms.*taskbelay-zcode remove --confirm-host-removed --json/);
  assert.equal((await remove(options)).changed, false);
  assert.equal((await status(options)).status, "action_required");
  assert.equal(await readFile(join(p.dataDirectory, "task.txt"), "utf8"), "retained task");
  assert.equal(await readFile(join(home, ".zcode", "unrelated.json"), "utf8"), "keep");
  const confirmed = await remove({ ...options, hostRemoved: true });
  assert.equal(confirmed.status, "absent");
  assert.equal(confirmed.registration.host, "user_confirmed_removed");
  await assert.rejects(readFile(p.receiptPath), { code: "ENOENT" });
  assert.equal((await remove({ ...options, hostRemoved: true })).changed, false);
  assert.equal(await readFile(join(p.dataDirectory, "task.txt"), "utf8"), "retained task");
});

test("ownership and marketplace conflicts are rejected without overwriting the receipt", async t => {
  const { options, p } = await fixture(t);
  await setup(options);
  const receipt = JSON.parse(await readFile(p.receiptPath, "utf8"));
  receipt.paths.package_root = join(options.packageRoot, "other");
  const raw = JSON.stringify(receipt);
  await writeFile(p.receiptPath, raw);
  await assert.rejects(setup(options), /another package/);
  await assert.rejects(remove({ ...options, hostRemoved: true }), /another package/);
  assert.equal(await readFile(p.receiptPath, "utf8"), raw);
  await rm(p.receiptPath);
  await writeFile(p.marketplacePath, JSON.stringify({ name: "other", plugins: [] }));
  await assert.rejects(setup(options), /identities must agree/);
});

test("removal remains available when the Core cannot run", async t => {
  const { options } = await fixture(t);
  const unavailable = { ...options, core: async () => { throw new Error("runtime unavailable"); } };
  assert.equal((await status(unavailable)).status, "partial");
  const result = await remove(unavailable);
  assert.equal(result.status, "action_required");
  assert.equal(result.core_version, null);
  assert.equal((await remove({ ...unavailable, hostRemoved: true })).status, "absent");
});
