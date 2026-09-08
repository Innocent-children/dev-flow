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

test("install and repair keep the installed version offline; reinstall deliberately repeats", async t => {
  const fixture = await maintenanceFixture(t);
  let executed = 0;
  const codexDriver = {
    ...fixture.dependencies.codexDriver,
    resolveTargetVersion: async () => { throw new Error('must not query registry'); },
    execute: async (_operation, { targetVersion }) => {
      assert.equal(targetVersion, '0.7.0');
      executed += 1;
      return { changed: true, completedSteps: ['codex.install_package'] };
    },
  };
  for (const operation of ['install', 'repair']) {
    const result = await runLifecycle({ ...request(operation), targetVersion: null }, { ...fixture.dependencies, codexDriver });
    assert.equal(result.result.changed, false);
  }
  for (let i = 0; i < 2; i++) await runLifecycle({ ...request('reinstall'), targetVersion: null }, { ...fixture.dependencies, codexDriver });
  assert.equal(executed, 2);
});

test("status keeps missing targets and doctor reports unhealthy installations", async t => {
  const fixture = await maintenanceFixture(t);
  const codexDriver = { observe: async () => ({ host: 'codex', profile: null, state: 'absent', hostAvailable: false, packageVersion: null }) };
  const deps = { ...fixture.dependencies, codexDriver };
  const status = await runLifecycle(request('status'), deps);
  assert.equal(status.result.status, 'absent');
  assert.equal(status.result.targets.length, 1);
  assert.equal(status.code, 0);
  const doctor = await runLifecycle(request('doctor'), deps);
  assert.equal(doctor.code, 1);
  assert.equal(doctor.result.checks.some(check => check.status === 'failed'), true);
});

test("plan is visible before confirmation and JSON errors retain cause and operation", async t => {
  const { runMain } = await import('../lib/lifecycle.mjs');
  const fixture = await maintenanceFixture(t);
  let text = '';
  const output = { write: value => { text += value; } };
  let confirmed = false;
  await runMain(['upgrade', '--host', 'codex', '--plain'], {
    ...fixture.dependencies, output, errorOutput: output, isTTY: false,
    confirmPlan: async () => {
      assert.match(text, /0.7.0 → 0.8.0/u);
      assert.equal(fixture.events.length, 0);
      confirmed = true;
      return false;
    },
  });
  assert.equal(confirmed, true);
  assert.match(text, /dev-flow upgrade --host codex --yes/u);
  text = '';
  const codexDriver = { ...fixture.dependencies.codexDriver,
    execute: async () => { throw Object.assign(new Error('setup failed'), {
      stderr: 'permission denied in registration', completedSteps: ['codex.install_package'], changed: true,
    }); },
  };
  const failed = await runMain(['repair', '--host', 'codex', '--version', '0.8.0', '--yes', '--json'], {
    ...fixture.dependencies, codexDriver, output, errorOutput: output, isTTY: false,
  });
  const result = JSON.parse(text);
  assert.equal(failed.code, 5);
  assert.equal(result.error.detail, 'permission denied in registration');
  assert.equal(result.failed_action, 'codex.default.repair');
  assert.equal(typeof result.operation_id, 'string');
  assert.equal(result.changed, true);
  assert.match(result.next_step, /--version 0.8.0 --yes/u);
});

test("one interactive session can inspect state and return to the menu", async t => {
  const { runMain } = await import('../lib/lifecycle.mjs');
  const { Readable } = await import('node:stream');
  const fixture = await maintenanceFixture(t);
  let text = '';
  const output = { write: value => { text += value; } };
  const result = await runMain([], { ...fixture.dependencies, input: Readable.from(['4\n1\n1\n0\n']), output, errorOutput: output, isTTY: true });
  assert.equal(result.code, 0);
  assert.equal(fixture.events.length, 0);
  assert.equal(text.split('Dev Flow Lifecycle Manager').length >= 3, true);
});

test("ordinary confirmation with explicit data returns a valid maintenance command", async t => {
  const { parseArguments } = await import('../lib/cli.mjs');
  const fixture = await maintenanceFixture(t);
  const result = await runLifecycle(request('upgrade'), {
    ...fixture.dependencies, environment: { DEV_FLOW_DATA_DIR: fixture.paths.defaultDataDirectory }, confirmPlan: async () => false,
  });
  assert.doesNotMatch(result.result.next_step, /confirm-explicit-data/u);
  const parsed = parseArguments(result.result.next_step.split(' ').slice(1), { isTTY: false });
  assert.equal(parsed.operation, 'upgrade');
  assert.equal(parsed.yes, true);
  assert.equal(result.result.confirmation.actions[0].targetVersion, '0.8.0');
});

test("all-Host diagnostics do not classify an unused absent Adapter as a broken install", async t => {
  const fixture = await maintenanceFixture(t);
  await writeFile(fixture.paths.configurationPath, '{}\n');
  const result = await runLifecycle({ ...request('doctor'), host: 'all', profiles: ['web'] }, {
    ...fixture.dependencies,
    deepseekDriver: { knownProfiles: async () => [], observe: async () => ({ host: 'deepseek', profile: 'web', hostAvailable: false, state: 'absent', packageVersion: null,
      issues: [{ code: 'host_missing', message: 'DSH missing', command: 'dsh --version' }] }) },
  });
  assert.equal(result.code, 0);
  assert.equal(result.result.status, 'ready');
  assert.equal(result.result.next_step, null);
  assert.equal(result.result.checks.find(check => check.name === 'deepseek/web').status, 'not_installed');
});
