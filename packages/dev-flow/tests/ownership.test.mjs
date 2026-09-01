import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertResourceUnchanged, ensureDefaultDataDirectory, inspectResource, moveTargetsToTrash, resolveManagerPaths } from "../lib/ownership.mjs";

test("manager paths are fixed under canonical HOME while explicit data requires canonical identity", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-paths-"));
  const homePath = join(root, "home");
  const explicitPath = join(root, "explicit");
  await Promise.all([mkdir(homePath), mkdir(explicitPath)]);
  const home = await realpath(homePath);
  const explicit = await realpath(explicitPath);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: { DEV_FLOW_DATA_DIR: explicit }, platform: "darwin", arch: "arm64" });
  assert.equal(paths.explicitDataDirectory, explicit);
  assert.equal(paths.configurationPath, join(home, ".dev-flow", "config.json"));
  assert.equal(paths.managerRoot, join(home, "Library", "Application Support", "create-dev-flow"));
  const missingExplicit = join(root, "missing-explicit");
  await assert.rejects(
    resolveManagerPaths({ homeDirectory: home, environment: { DEV_FLOW_DATA_DIR: missingExplicit }, platform: "darwin", arch: "arm64" }),
    /must name an existing directory/u,
  );
  await assert.rejects(stat(missingExplicit), { code: "ENOENT" });
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("recoverable cleanup moves only unchanged exact targets to one Trash root", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-trash-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
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

test("default data creation is restrictive and rejects a symbolic-link product root", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-default-data-")));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
  assert.equal(await ensureDefaultDataDirectory(paths), paths.defaultDataDirectory);
  if (process.platform !== "win32") assert.equal((await stat(paths.defaultDataDirectory)).mode & 0o777, 0o700);

  const linkedHome = join(root, "linked-home");
  const linkedTarget = join(root, "linked-target");
  await Promise.all([mkdir(linkedHome), mkdir(linkedTarget)]);
  await mkdir(join(linkedHome, "Library", "Application Support"), { recursive: true });
  const { symlink } = await import("node:fs/promises");
  await symlink(
    linkedTarget,
    join(linkedHome, "Library", "Application Support", "dev-flow"),
    process.platform === "win32" ? "junction" : undefined,
  );
  const linkedPaths = await resolveManagerPaths({ homeDirectory: linkedHome, environment: {}, platform: "darwin", arch: "arm64" });
  await assert.rejects(ensureDefaultDataDirectory(linkedPaths), /symbolic link/u);
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});
