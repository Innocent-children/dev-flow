import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertResourceUnchanged, inspectResource, moveTargetsToTrash, resolveManagerPaths } from "../lib/ownership.mjs";

test("manager paths are fixed under canonical HOME while explicit data requires canonical identity", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-paths-"));
  const homePath = join(root, "home");
  const explicitPath = join(root, "explicit");
  await Promise.all([mkdir(homePath), mkdir(explicitPath)]);
  const home = await realpath(homePath);
  const explicit = await realpath(explicitPath);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: { DEV_FLOW_DATA_DIR: explicit } });
  assert.equal(paths.explicitDataDirectory, explicit);
  assert.equal(paths.configurationPath, join(home, ".dev-flow", "config.json"));
  assert.equal(paths.managerRoot, join(home, "Library", "Application Support", "create-dev-flow"));
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("recoverable cleanup moves only unchanged exact targets to one Trash root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-trash-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {} });
  await mkdir(paths.configurationDirectory);
  await writeFile(paths.configurationPath, "preferences\n");
  const target = await inspectResource(paths.configurationPath, "configuration");
  await assertResourceUnchanged(target);
  const moved = await moveTargetsToTrash(paths, [target], {
    now: () => new Date("2026-08-25T00:00:00Z"), random: () => "fixture",
  });
  await assert.rejects(stat(paths.configurationPath), { code: "ENOENT" });
  assert.equal(await readFile(moved.moved[0].destination, "utf8"), "preferences\n");
  assert.match(moved.trashRoot, /create-dev-flow-2026-08-25T00-00-00-000Z-fixture$/u);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});
