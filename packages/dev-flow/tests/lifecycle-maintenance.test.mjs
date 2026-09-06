import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runLifecycle } from "../lib/lifecycle.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";

test("upgrade and forced reinstall preserve configuration and Task bytes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-maintenance-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
  await mkdir(paths.configurationDirectory);
  await mkdir(paths.defaultDataDirectory, { recursive: true });
  await writeFile(paths.configurationPath, "config-bytes\n");
  await writeFile(join(paths.defaultDataDirectory, "dev-flow.db"), "task-bytes\n");
  let version = "0.7.0";
  const codexDriver = {
    observe: async () => ({ host: "codex", profile: null, hostAvailable: true, state: "ready", packageVersion: version, coreVersion: "0.6.0", receipt: true }),
    resolveTargetVersion: async () => "0.8.0",
    execute: async () => { version = "0.8.0"; return { changed: true, completedSteps: ["codex.maintenance"] }; },
  };
  const deepseekDriver = { knownProfiles: async () => [], observe: async () => { throw new Error("unused"); }, resolveTargetVersion: async () => "0.8.0" };
  const base = { homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64", codexDriver, deepseekDriver, confirmPlan: async () => true };
  await runLifecycle(request("upgrade"), base);
  await runLifecycle(request("reinstall"), base);
  assert.equal(await readFile(paths.configurationPath, "utf8"), "config-bytes\n");
  assert.equal(await readFile(join(paths.defaultDataDirectory, "dev-flow.db"), "utf8"), "task-bytes\n");
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

test("confirmed Adapter maintenance stops the pet running that Core before the Adapter changes", async (t) => {
  const fixture = await maintenanceFixture(t);
  const result = await runLifecycle(request("upgrade"), {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    listAdapterCoreRuntimes: async () => [{ host: "codex", profile: null, runtimePath: fixture.codexRuntime }],
  });
  assert.equal(result.code, 0);
  assert.deepEqual(fixture.events, [`pet.stop:${fixture.codexRuntime}`, "codex.execute"]);
});

test("a pet that does not stop prevents the confirmed Adapter change", async (t) => {
  const fixture = await maintenanceFixture(t);
  await assert.rejects(runLifecycle(request("upgrade"), {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    listAdapterCoreRuntimes: async () => [{ host: "codex", profile: null, runtimePath: fixture.codexRuntime }],
    stopPetForCore: async () => { throw new Error("the pet did not stop"); },
  }), /the pet did not stop/u);
  assert.deepEqual(fixture.events, []);
  assert.equal(fixture.version, "0.7.0");
});

test("read-only, unconfirmed, and other-Adapter maintenance leave a running pet alone", async (t) => {
  const fixture = await maintenanceFixture(t);
  const deepseekRuntime = join(fixture.root, "deepseek", "runtime", "darwin-arm64", "dev-flow");
  const codexRuntimes = async () => [{ host: "codex", profile: null, runtimePath: fixture.codexRuntime }];

  await runLifecycle(request("status"), { ...fixture.dependencies, listAdapterCoreRuntimes: codexRuntimes });
  assert.deepEqual(fixture.events, []);

  const unconfirmed = await runLifecycle(request("upgrade"), {
    ...fixture.dependencies,
    confirmPlan: async () => false,
    listAdapterCoreRuntimes: codexRuntimes,
  });
  assert.equal(unconfirmed.code, 3);
  assert.deepEqual(fixture.events, []);

  // The maintained Codex Adapter changes, but only a DeepSeek Core is recorded,
  // so no running pet uses a Core this operation replaces.
  const other = await runLifecycle(request("upgrade"), {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    listAdapterCoreRuntimes: async () => [{ host: "deepseek", profile: "web", runtimePath: deepseekRuntime }],
  });
  assert.equal(other.code, 0);
  assert.deepEqual(fixture.events, ["codex.execute"]);
  assert.equal(fixture.version, "0.8.0");
});

async function maintenanceFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-pet-maintenance-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
  await mkdir(paths.configurationDirectory);
  await mkdir(paths.defaultDataDirectory, { recursive: true });
  await writeFile(paths.configurationPath, "config-bytes\n");
  await writeFile(join(paths.defaultDataDirectory, "dev-flow.db"), "task-bytes\n");
  const events = [];
  const state = { version: "0.7.0" };
  const codexDriver = {
    observe: async () => ({ host: "codex", profile: null, hostAvailable: true, state: "ready", packageVersion: state.version, coreVersion: "0.6.0", receipt: true }),
    resolveTargetVersion: async () => "0.8.0",
    execute: async () => {
      events.push("codex.execute");
      state.version = "0.8.0";
      return { changed: true, completedSteps: ["codex.maintenance"] };
    },
  };
  const deepseekDriver = { knownProfiles: async () => [], observe: async () => { throw new Error("unused"); }, resolveTargetVersion: async () => "0.8.0" };
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  return {
    root,
    paths,
    events,
    codexRuntime: join(root, "codex", "runtime", "darwin-arm64", "dev-flow"),
    get version() { return state.version; },
    dependencies: {
      homeDirectory: home,
      environment: {},
      platform: "darwin",
      arch: "arm64",
      codexDriver,
      deepseekDriver,
      confirmPlan: async () => true,
      stopPetForCore: async (options) => {
        events.push(`pet.stop:${options.corePath}`);
        return { stopped: true, reason: null };
      },
    },
  };
}

function request(operation) {
  return { operation, host: "codex", profiles: [], targetVersion: "latest", allKnownProfiles: false, adopt: false, reinstallAfterReset: false, permanent: false, yes: true, confirmationToken: null, permanentToken: null, downgradeToken: null, confirmedExplicitData: [], outputMode: "json" };
}
