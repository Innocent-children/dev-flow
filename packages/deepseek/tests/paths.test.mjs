import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ensureDefaultDataDirectory,
  packageRootFromModule,
  resolveDataDirectory,
} from "../lib/paths.mjs";
import {
  preflightPackagedCore,
  selectPackagedRuntime,
} from "../lib/runtime.mjs";
import {
  ensureDefaultDataDirectory as ensureCodexDefaultDataDirectory,
  resolveProductPaths as resolveCodexProductPaths,
} from "../../codex/lib/paths.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const currentVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();

test("resolves package root and runtime after the package is moved outside the checkout", async (t) => {
  const detachedRoot = await makeDirectory(t, "detached package with spaces-工具");
  await mkdir(join(detachedRoot, "lib"), { recursive: true });
  await mkdir(join(detachedRoot, "runtime", "darwin-arm64"), { recursive: true });
  await copyFile(join(packageRoot, "lib", "paths.mjs"), join(detachedRoot, "lib", "paths.mjs"));
  await copyFile(join(packageRoot, "lib", "runtime.mjs"), join(detachedRoot, "lib", "runtime.mjs"));
  await copyFile(
    join(packageRoot, "runtime", "darwin-arm64", "dev-flow"),
    join(detachedRoot, "runtime", "darwin-arm64", "dev-flow"),
  );
  await chmod(join(detachedRoot, "runtime", "darwin-arm64", "dev-flow"), 0o755);

  const detachedPaths = await import(pathToFileURL(join(detachedRoot, "lib", "paths.mjs")));
  const detachedRuntime = await import(pathToFileURL(join(detachedRoot, "lib", "runtime.mjs")));
  assert.equal(detachedPaths.packageRootFromModule(), detachedRoot);

  const selection = await detachedRuntime.selectPackagedRuntime();
  assert.deepEqual(selection, {
    packageRoot: detachedRoot,
    runtimeKey: "darwin-arm64",
    runtimePath: join(detachedRoot, "runtime", "darwin-arm64", "dev-flow"),
  });
  const preflight = await detachedRuntime.preflightPackagedCore(selection, {
    expectedVersion: currentVersion,
  });
  assert.equal(preflight.version, currentVersion);
});

test("packageRootFromModule handles encoded spaces and Unicode", async (t) => {
  const root = await makeDirectory(t, "encoded space-工具");
  const modulePath = join(root, "lib", "paths.mjs");
  assert.equal(packageRootFromModule(pathToFileURL(modulePath).href), root);
});

test("selects only the exact darwin-arm64 package runtime", async () => {
  const selected = await selectPackagedRuntime({ packageRoot });
  assert.equal(selected.runtimeKey, "darwin-arm64");
  assert.equal(selected.runtimePath, join(packageRoot, "runtime", "darwin-arm64", "dev-flow"));

  await assert.rejects(
    selectPackagedRuntime({ packageRoot, platform: "linux", arch: "arm64" }),
    /unsupported platform linux-arm64/,
  );
  await assert.rejects(
    selectPackagedRuntime({ packageRoot, platform: "darwin", arch: "x64" }),
    /unsupported platform darwin-x64/,
  );
});

test("preflight rejects a missing, symlinked, non-regular, or non-executable runtime", async (t) => {
  const root = await makeDirectory(t, "runtime-preflight");
  const runtimeDirectory = join(root, "runtime", "darwin-arm64");
  const runtimePath = join(runtimeDirectory, "dev-flow");
  await mkdir(runtimeDirectory, { recursive: true });
  const selection = await selectPackagedRuntime({ packageRoot: root });

  await assert.rejects(
    preflightPackagedCore(selection, { expectedVersion: currentVersion }),
    /regular executable file/,
  );

  await mkdir(runtimePath);
  await assert.rejects(
    preflightPackagedCore(selection, { expectedVersion: currentVersion }),
    /regular executable file/,
  );
  await import("node:fs/promises").then(({ rm }) => rm(runtimePath, { recursive: true }));

  await writeFile(runtimePath, "not executable\n", { mode: 0o600 });
  await assert.rejects(
    preflightPackagedCore(selection, { expectedVersion: currentVersion }),
    /executable mode/,
  );
  await chmod(runtimePath, 0o755);

  const linkTarget = join(runtimeDirectory, "linked-core");
  const { rename } = await import("node:fs/promises");
  await rename(runtimePath, linkTarget);
  await symlink(linkTarget, runtimePath);
  await assert.rejects(
    preflightPackagedCore(selection, { expectedVersion: currentVersion }),
    /regular executable file/,
  );
});

test("explicit data directory must be existing, absolute, canonical, and non-symlinked", async (t) => {
  const homeDirectory = await makeDirectory(t, "home");
  const explicit = await makeDirectory(t, "explicit data-数据");
  const selected = await resolveDataDirectory({
    homeDirectory,
    environment: { DEV_FLOW_DATA_DIR: explicit },
  });
  assert.deepEqual(selected, {
    dataDirectory: explicit,
    homeDirectory,
    productSupportRoot: join(homeDirectory, "Library", "Application Support", "dev-flow"),
    usesDefaultDataDirectory: false,
  });
  await assert.rejects(ensureDefaultDataDirectory(selected), /explicit data directory/);

  const missing = join(dirname(explicit), "missing");
  const file = join(dirname(explicit), "data-file");
  const link = join(dirname(explicit), "data-link");
  await writeFile(file, "not a directory\n");
  await symlink(explicit, link);
  for (const value of ["relative/data", missing, file, link]) {
    await assert.rejects(
      resolveDataDirectory({
        homeDirectory,
        environment: { DEV_FLOW_DATA_DIR: value },
      }),
    );
  }
});

test("default data directory is restrictive and rejects symbolic-link components", async (t) => {
  const homeDirectory = await makeDirectory(t, "default-home");
  const selected = await resolveDataDirectory({ homeDirectory, environment: {} });
  const expected = join(homeDirectory, "Library", "Application Support", "dev-flow", "data");
  assert.equal(selected.dataDirectory, expected);
  assert.equal(selected.usesDefaultDataDirectory, true);

  await ensureDefaultDataDirectory(selected);
  assert.equal((await stat(expected)).mode & 0o777, 0o700);

  const symlinkHome = await makeDirectory(t, "symlink-home");
  const outside = await makeDirectory(t, "outside");
  await mkdir(join(symlinkHome, "Library", "Application Support"), { recursive: true });
  await symlink(outside, join(symlinkHome, "Library", "Application Support", "dev-flow"));
  await assert.rejects(
    resolveDataDirectory({ homeDirectory: symlinkHome, environment: {} }),
    /symbolic link/,
  );
});

test("DeepSeek data-path cases remain externally aligned with Codex", async (t) => {
  const packageDirectory = await makeDirectory(t, "codex-package");
  const homeDirectory = await makeDirectory(t, "parity-home");
  const explicit = await makeDirectory(t, "parity-explicit");

  for (const environment of [{}, { DEV_FLOW_DATA_DIR: explicit }]) {
    const deepseek = await resolveDataDirectory({ homeDirectory, environment });
    const codex = await resolveCodexProductPaths({
      packageRoot: packageDirectory,
      homeDirectory,
      platform: "darwin",
      arch: "arm64",
      environment,
    });
    assert.equal(deepseek.dataDirectory, codex.dataDirectory);
    assert.equal(deepseek.usesDefaultDataDirectory, codex.usesDefaultDataDirectory);
    if (deepseek.usesDefaultDataDirectory) {
      await ensureDefaultDataDirectory(deepseek);
      await ensureCodexDefaultDataDirectory(codex);
      assert.equal((await lstat(deepseek.dataDirectory)).mode & 0o777, 0o700);
    }
  }
});

async function makeDirectory(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-paths-")));
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  t.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  return directory;
}
