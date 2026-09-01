import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runLifecycle } from "../lib/lifecycle.mjs";
import { resolveManagerPaths } from "../lib/ownership.mjs";

test("ordinary all-Host uninstall removes Adapters and retains shared user data", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-uninstall-"));
  const home = join(root, "home");
  await mkdir(home);
  const paths = await resolveManagerPaths({ homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64" });
  await mkdir(paths.configurationDirectory);
  await mkdir(paths.defaultDataDirectory, { recursive: true });
  await writeFile(paths.configurationPath, "preserve-config\n");
  await writeFile(join(paths.defaultDataDirectory, "dev-flow.db"), "preserve-task\n");
  const states = { codex: "ready", deepseek: "ready" };
  const codexDriver = driver("codex", null, states);
  const deepseekDriver = driver("deepseek", "web", states);
  deepseekDriver.knownProfiles = async () => ["web"];
  const result = await runLifecycle(request(), { homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64", codexDriver, deepseekDriver, confirmPlan: async () => true });
  assert.equal(result.result.status, "absent");
  assert.equal(await readFile(paths.configurationPath, "utf8"), "preserve-config\n");
  assert.equal(await readFile(join(paths.defaultDataDirectory, "dev-flow.db"), "utf8"), "preserve-task\n");
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
});

function driver(host, profile, states) {
  return {
    knownProfiles: async () => [], resolveTargetVersion: async () => "0.8.0",
    observe: async () => ({ host, profile, hostAvailable: true, state: states[host], packageVersion: states[host] === "ready" ? "0.8.0" : null, coreVersion: null, receipt: states[host] === "ready" ? {} : null }),
    execute: async () => { states[host] = "absent"; return { changed: true, completedSteps: [`${host}.uninstall`] }; },
  };
}

function request() {
  return { operation: "uninstall", host: "all", profiles: ["web"], targetVersion: "latest", allKnownProfiles: true, adopt: false, reinstallAfterReset: false, permanent: false, yes: true, confirmationToken: null, permanentToken: null, downgradeToken: null, confirmedExplicitData: [], outputMode: "json" };
}
