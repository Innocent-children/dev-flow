import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as ownership from "../lib/ownership.mjs";
import { listProfileReceipts, removeProfileReceipt, validateProfileReceipt, writeProfileReceipt } from "../lib/hosts/deepseek-receipts.mjs";

test("DeepSeek owns the current receipt format and creates its directory only when writing", async t => {
  const home = await realpath(await mkdtemp(join(tmpdir(), "taskbelay-profile-records-")));
  t.after(() => rm(home, { recursive: true, force: true }));
  const paths = await ownership.resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
  const profiles = join(paths.managerRoot, "profiles");
  await ownership.ensureManagerDirectories(paths);
  assert.equal(paths.profilesDirectory, undefined);
  assert.equal(ownership.writeProfileReceipt, undefined);
  assert.equal(ownership.validateProfileReceipt, undefined);
  assert.deepEqual(await listProfileReceipts(paths), []);
  await removeProfileReceipt(paths, "web");
  await assert.rejects(stat(profiles), { code: "ENOENT" });
  const receipt = { profile: "web", package_name: "taskbelay-deepseek", installed_version: "0.8.0", origin: "installed",
    dsh_version: "0.1.2-rc.1", created_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z" };
  await writeProfileReceipt(paths, receipt);
  assert.deepEqual(await listProfileReceipts(paths), [receipt]);
  const name = (await readdir(profiles))[0];
  assert.match(name, /^[a-f0-9]{64}\.json$/);
  assert.deepEqual(JSON.parse(await readFile(join(profiles, name), "utf8")), receipt);
  for (const invalid of [{ ...receipt, extra: true }, { ...receipt, package_name: "taskbelay-codex" }, { ...receipt, installed_version: "latest" }]) {
    assert.throws(() => validateProfileReceipt(invalid), /invalid/);
  }
  await writeFile(join(profiles, name), JSON.stringify({ ...receipt, extra: true }));
  await assert.rejects(listProfileReceipts(paths), /fields are invalid/);
  await removeProfileReceipt(paths, "web");
  assert.deepEqual(await listProfileReceipts(paths), []);
});

test("DeepSeek does not follow a linked Profile record directory", async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "taskbelay-profile-link-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = { managerRoot: join(root, "manager") };
  await mkdir(paths.managerRoot);
  const outside = join(root, "outside");
  await mkdir(outside);
  await symlink(outside, join(paths.managerRoot, "profiles"), process.platform === "win32" ? "junction" : undefined);
  await assert.rejects(listProfileReceipts(paths), /regular directory/);
  await assert.rejects(removeProfileReceipt(paths, "web"), /regular directory/);
});
