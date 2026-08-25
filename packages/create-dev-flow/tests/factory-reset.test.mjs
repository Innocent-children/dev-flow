import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runLifecycle } from "../lib/lifecycle.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";

test("factory reset requires all Hosts and moves exact shared data to Trash", async (t) => {
  const fixture = await resetFixture(t);
  const result = await runLifecycle(request({ reinstallAfterReset: false }), {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    now: () => new Date("2026-08-25T00:00:00Z"),
    random: () => "fixture",
  });
  assert.equal(result.result.data.policy, "trash_reset");
  assert.match(result.result.data.trash_root, /create-dev-flow-/u);
  await assert.rejects(stat(fixture.paths.configurationPath), { code: "ENOENT" });
  await assert.rejects(stat(fixture.paths.defaultDataDirectory), { code: "ENOENT" });
  assert.equal(fixture.states.codex, "absent");
  assert.equal(fixture.states.deepseek, "absent");
});

test("clean reinstall creates fresh active data after reset and never restores old bytes", async (t) => {
  const fixture = await resetFixture(t);
  const result = await runLifecycle(request({ reinstallAfterReset: true }), {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    now: () => new Date("2026-08-25T00:00:00Z"),
    random: () => "fixture-reinstall",
  });
  assert.equal(result.result.status, "ready");
  assert.deepEqual(JSON.parse(await readFile(fixture.paths.configurationPath, "utf8")), {
    codex: { codebase_memory: false }, deepseek: { codebase_memory: false },
  });
  await assert.rejects(readFile(join(fixture.paths.defaultDataDirectory, "dev-flow.db")), { code: "ENOENT" });
  assert.equal(fixture.states.codex, "ready");
  assert.equal(fixture.states.deepseek, "ready");
});

test("explicit data is blocked until its exact canonical path is confirmed", async (t) => {
  const fixture = await resetFixture(t, { explicit: true });
  await assert.rejects(runLifecycle(request({ reinstallAfterReset: false }), {
    ...fixture.dependencies, confirmPlan: async () => true,
  }), /confirm-explicit-data/u);
  assert.equal(await readFile(join(fixture.paths.explicitDataDirectory, "dev-flow.db"), "utf8"), "explicit-task\n");
});

async function resetFixture(t, { explicit = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-reset-"));
  const home = join(root, "home");
  let explicitData = join(root, "explicit-data");
  await mkdir(home);
  if (explicit) {
    await mkdir(explicitData);
    explicitData = await realpath(explicitData);
  }
  const environment = explicit ? { DEV_FLOW_DATA_DIR: explicitData } : {};
  const paths = await resolveManagerPaths({ homeDirectory: home, environment });
  await mkdir(paths.configurationDirectory);
  await mkdir(paths.defaultDataDirectory, { recursive: true });
  await writeFile(paths.configurationPath, "old-config\n");
  await writeFile(join(paths.defaultDataDirectory, "dev-flow.db"), "old-task\n");
  if (explicit) await writeFile(join(explicitData, "dev-flow.db"), "explicit-task\n");
  const states = { codex: "ready", deepseek: "ready" };
  const codexDriver = driver("codex", null, states);
  const deepseekDriver = driver("deepseek", "web", states);
  deepseekDriver.knownProfiles = async () => ["web"];
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  return { paths, states, dependencies: { homeDirectory: home, environment, codexDriver, deepseekDriver } };
}

function driver(host, profile, states) {
  return {
    knownProfiles: async () => [], resolveTargetVersion: async () => "0.8.0",
    observe: async () => ({ host, profile, hostAvailable: true, hostVersion: "1.0.0", state: states[host], packageVersion: states[host] === "ready" ? "0.8.0" : null, coreVersion: null, receipt: states[host] === "ready" ? {} : null }),
    execute: async (operation) => { states[host] = operation === "uninstall" ? "absent" : "ready"; return { changed: true, completedSteps: [`${host}.${operation}`] }; },
  };
}

function request({ reinstallAfterReset }) {
  return { operation: "factory-reset", host: "all", profiles: ["web"], targetVersion: "latest", allKnownProfiles: true, adopt: false, reinstallAfterReset, permanent: false, yes: true, confirmationToken: "test", permanentToken: null, downgradeToken: null, confirmedExplicitData: [], outputMode: "json" };
}
