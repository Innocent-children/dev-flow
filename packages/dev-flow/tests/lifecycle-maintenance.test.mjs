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
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {} });
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
  const base = { homeDirectory: home, environment: {}, codexDriver, deepseekDriver, confirmPlan: async () => true };
  await runLifecycle(request("upgrade"), base);
  await runLifecycle(request("reinstall"), base);
  assert.equal(await readFile(paths.configurationPath, "utf8"), "config-bytes\n");
  assert.equal(await readFile(join(paths.defaultDataDirectory, "dev-flow.db"), "utf8"), "task-bytes\n");
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

function request(operation) {
  return { operation, host: "codex", profiles: [], targetVersion: "latest", allKnownProfiles: false, adopt: false, reinstallAfterReset: false, permanent: false, yes: true, confirmationToken: null, permanentToken: null, downgradeToken: null, confirmedExplicitData: [], outputMode: "json" };
}
