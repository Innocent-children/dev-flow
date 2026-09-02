import assert from "node:assert/strict";
import { mkdir, readFile, realpath, stat, symlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import test from "node:test";

import {
  ensureDefaultDataDirectory,
  packageRootFromModule,
  resolveProductPaths,
} from "../lib/paths.mjs";

test("resolves the runtime and resources relative to the installed package", async (t) => {
  const root = await makePackage(t, "package with spaces-插件");
  const home = join(t.testRoot, "home");
  await mkdir(home, { recursive: true });

  const paths = await resolveProductPaths({
    packageRoot: root,
    homeDirectory: home,
    platform: "darwin",
    arch: "arm64",
    environment: {},
  });

  assert.equal(paths.packageRoot, root);
  assert.equal(paths.runtimePath, join(root, "runtime", "darwin-arm64", "dev-flow"));
  assert.equal(paths.pluginRoot, join(root, "plugin"));
  assert.equal(paths.marketplaceRoot, root);
  assert.equal(paths.configurationDirectory, join(home, ".dev-flow"));
  assert.equal(paths.configurationPath, join(home, ".dev-flow", "config.json"));
  assert.equal(paths.usesDefaultDataDirectory, true);
});

test("packageRootFromModule handles encoded spaces and Unicode", async (t) => {
  const root = await makePackage(t, "encoded space-工具");
  const modulePath = join(root, "lib", "paths.mjs");
  assert.equal(packageRootFromModule(pathToFileURL(modulePath).href), root);
});

test("accepts only an existing canonical absolute explicit data directory", async (t) => {
  const root = await makePackage(t, "explicit-package");
  const home = join(t.testRoot, "home");
  const explicit = join(t.testRoot, "data with spaces-数据");
  await mkdir(home, { recursive: true });
  await mkdir(explicit, { recursive: true });

  const paths = await resolveProductPaths({
    packageRoot: root,
    homeDirectory: home,
    platform: "darwin",
    arch: "arm64",
    environment: { DEV_FLOW_DATA_DIR: explicit },
  });
  assert.equal(paths.dataDirectory, explicit);
  assert.equal(paths.usesDefaultDataDirectory, false);

  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "darwin",
      arch: "arm64",
      environment: { DEV_FLOW_DATA_DIR: "relative/data" },
    }),
    /absolute/,
  );
  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "darwin",
      arch: "arm64",
      environment: { DEV_FLOW_DATA_DIR: join(t.testRoot, "missing") },
    }),
    /existing directory/,
  );

  const link = join(t.testRoot, "data-link");
  await symlink(explicit, link, process.platform === "win32" ? "junction" : undefined);
  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "darwin",
      arch: "arm64",
      environment: { DEV_FLOW_DATA_DIR: link },
    }),
    /canonical/,
  );
});

test("owns only the exact default data directory under macOS Application Support", async (t) => {
  const root = await makePackage(t, "default-package");
  const home = join(t.testRoot, "home");
  await mkdir(home, { recursive: true });
  const adjacent = join(home, "Library", "Application Support", "dev-flow", "user-note.txt");
  await mkdir(join(adjacent, ".."), { recursive: true });
  await writeFile(adjacent, "preserve me\n");

  const paths = await resolveProductPaths({
    packageRoot: root,
    homeDirectory: home,
    platform: "darwin",
    arch: "arm64",
    environment: {},
  });
  assert.equal(paths.dataDirectory, join(home, "Library", "Application Support", "dev-flow", "data"));
  assert.equal(
    paths.receiptPath,
    join(home, "Library", "Application Support", "dev-flow", "registrations", "codex.json"),
  );

  await ensureDefaultDataDirectory(paths);
  assert.equal((await stat(paths.dataDirectory)).isDirectory(), true);
  assert.equal(await readFile(adjacent, "utf8"), "preserve me\n");
  await assert.rejects(stat(paths.receiptPath), { code: "ENOENT" });
});

test("rejects unsupported runtime platforms", async (t) => {
  const root = await makePackage(t, "unsupported-package");
  const home = join(t.testRoot, "home");
  await mkdir(home, { recursive: true });
  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "linux",
      arch: "x64",
      environment: {},
    }),
    /unsupported platform linux-x64/,
  );
});

test("rejects a default product root that escapes through a symlink", async (t) => {
  const root = await makePackage(t, "symlink-package");
  const home = join(t.testRoot, "home");
  const outside = join(t.testRoot, "outside");
  await mkdir(join(home, "Library", "Application Support"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await symlink(
    outside,
    join(home, "Library", "Application Support", "dev-flow"),
    process.platform === "win32" ? "junction" : undefined,
  );

  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "darwin",
      arch: "arm64",
      environment: {},
    }),
    /symbolic link/,
  );
});

test("rejects a macOS application-data symlink before creating product files", async (t) => {
  const root = await makePackage(t, "application-data-symlink-package");
  const home = join(t.testRoot, "home");
  const outside = join(t.testRoot, "outside");
  await mkdir(home, { recursive: true });
  await mkdir(outside, { recursive: true });
  await symlink(outside, join(home, "Library"), process.platform === "win32" ? "junction" : undefined);

  await assert.rejects(
    resolveProductPaths({
      packageRoot: root,
      homeDirectory: home,
      platform: "darwin",
      arch: "arm64",
      environment: {},
    }),
    /symbolic link/,
  );
  await assert.rejects(stat(join(outside, "Application Support", "dev-flow")), { code: "ENOENT" });
});

test("never falls back to a runtime in the current repository", async (t) => {
  const root = await makePackage(t, "installed-package");
  const repository = join(t.testRoot, "target-repository");
  const home = join(t.testRoot, "home");
  await mkdir(join(repository, "runtime", "darwin-arm64"), { recursive: true });
  await writeFile(join(repository, "runtime", "darwin-arm64", "dev-flow"), "wrong runtime\n");
  await mkdir(home, { recursive: true });

  const paths = await resolveProductPaths({
    packageRoot: root,
    homeDirectory: home,
    platform: "darwin",
    arch: "arm64",
    environment: {},
    currentDirectory: repository,
  });
  assert.equal(paths.runtimePath, join(root, "runtime", "darwin-arm64", "dev-flow"));
  assert.notEqual(paths.runtimePath, join(repository, "runtime", "darwin-arm64", "dev-flow"));
});

async function makePackage(t, name) {
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const base = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-paths-")));
  t.testRoot = base;
  const root = join(base, name);
  await mkdir(join(root, "lib"), { recursive: true });
  return root;
}
