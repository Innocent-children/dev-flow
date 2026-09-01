import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runLifecycle } from "../lib/lifecycle.mjs";

test("one install request makes Codex and DeepSeek ready and repeated install is zero-change", async (t) => {
  const fixture = await lifecycleFixture(t);
  const request = makeRequest("install");
  const progress = [];
  const first = await runLifecycle(request, {
    ...fixture.dependencies,
    confirmPlan: async () => true,
    onProgress: (event) => progress.push(event),
  });
  assert.equal(first.result.status, "ready");
  assert.equal(first.result.changed, true);
  assert.deepEqual(progress.map((event) => `${event.type}:${event.action.actionId}`), [
    "action_start:codex.default.install",
    "action_complete:codex.default.install",
    "action_start:deepseek.web.install",
    "action_complete:deepseek.web.install",
  ]);
  const second = await runLifecycle(request, { ...fixture.dependencies, confirmPlan: async () => true });
  assert.equal(second.result.changed, false);
  assert.deepEqual(second.plan.actions, []);
});

async function lifecycleFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "create-dev-flow-install-"));
  const home = join(root, "home");
  await mkdir(home);
  const states = { codex: "absent", deepseek: "absent" };
  const codexDriver = fakeDriver("codex", states, null);
  const deepseekDriver = fakeDriver("deepseek", states, "web");
  deepseekDriver.knownProfiles = async () => ["web"];
  t.after(async () => { const { rm } = await import("node:fs/promises"); await rm(root, { recursive: true, force: true }); });
  return { dependencies: { homeDirectory: home, environment: {}, platform: "darwin", arch: "arm64", codexDriver, deepseekDriver } };
}

function fakeDriver(host, states, profile) {
  return {
    knownProfiles: async () => [],
    resolveTargetVersion: async () => "0.8.0",
    observe: async () => ({ host, profile, hostAvailable: true, hostVersion: "1.0.0", state: states[host], packageVersion: states[host] === "ready" ? "0.8.0" : null, coreVersion: host === "codex" && states[host] === "ready" ? "0.6.0" : null, receipt: states[host] === "ready" ? {} : null }),
    execute: async (operation) => { states[host] = operation === "uninstall" ? "absent" : "ready"; return { changed: true, completedSteps: [`${host}.${operation}`] }; },
  };
}

function makeRequest(operation) {
  return { operation, host: "all", profiles: ["web"], targetVersion: "latest", allKnownProfiles: true, adopt: false, reinstallAfterReset: false, permanent: false, yes: true, confirmationToken: null, permanentToken: null, downgradeToken: null, confirmedExplicitData: [], outputMode: "json" };
}
