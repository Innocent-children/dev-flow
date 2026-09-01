import assert from "node:assert/strict";
import test from "node:test";

import { createLifecyclePlan } from "../lib/plan.mjs";

test("ready repeated install is an idempotent zero-action plan", () => {
  const plan = createLifecyclePlan(request("install", "codex"), observed({ codexState: "ready", codexVersion: "1.2.3" }), {
    targetVersions: { "codex:default": "1.2.3" },
    now: () => new Date("2026-08-25T00:00:00Z"),
  });
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.confirmationClass, "none");
});

test("downgrade and reset use stable plan-bound confirmations", () => {
  const downgrade = createLifecyclePlan(request("upgrade", "codex"), observed({ codexState: "ready", codexVersion: "2.0.0" }), {
    targetVersions: { "codex:default": "1.9.0" },
  });
  assert.equal(downgrade.confirmationClass, "downgrade");
  assert.match(downgrade.downgradeToken, /^DOWNGRADE-/u);

  const resetRequest = { ...request("factory-reset", "all"), allKnownProfiles: true };
  const first = createLifecyclePlan(resetRequest, observed({ codexState: "ready", deepseekState: "ready" }));
  const second = createLifecyclePlan(resetRequest, observed({ codexState: "ready", deepseekState: "ready" }));
  assert.equal(first.planId, second.planId);
  assert.equal(first.confirmationToken, second.confirmationToken);
  assert.equal(first.actions.at(-1).operation, "cleanup");
});

test("factory reset blocks a partial Host selection and unknown manager Profile", () => {
  assert.throws(() => createLifecyclePlan(request("factory-reset", "codex"), observed({})), /requires --host all/u);
  const reset = { ...request("factory-reset", "all"), profiles: ["web"], allKnownProfiles: false };
  assert.throws(() => createLifecyclePlan(reset, observed({ known: ["web", "other"] })), /every manager-owned/u);
});

test("uninstall and factory reset retain an installed Codex package after registration loss", () => {
  const current = observed({ codexState: "absent", codexVersion: "0.7.3", codexPackageInstalled: true });
  const uninstall = createLifecyclePlan(request("uninstall", "codex"), current);
  assert.deepEqual(uninstall.actions.map((action) => action.actionId), ["codex.default.uninstall"]);

  const reset = createLifecyclePlan({ ...request("factory-reset", "all"), allKnownProfiles: true }, current);
  assert.deepEqual(reset.actions.map((action) => action.actionId), ["codex.default.uninstall", "manager.cleanup"]);
  assert.deepEqual(reset.impacts, [
    "factory-reset codex Adapter",
    "Remove every installed Adapter before shared data cleanup",
  ]);
});

test("factory reset reports one exact no-op impact when Adapters and data are absent", () => {
  const plan = createLifecyclePlan({ ...request("factory-reset", "all"), allKnownProfiles: true }, observed());
  assert.deepEqual(plan.actions.map((action) => action.actionId), ["manager.cleanup"]);
  assert.deepEqual(plan.impacts, ["No installed Adapter or active Dev Flow data was found"]);
});

test("Windows factory reset previews the product recovery directory instead of macOS Trash", () => {
  const current = observed();
  current.resources.defaultData = {
    label: "default-data",
    path: "C:\\Users\\ordinary\\AppData\\Local\\dev-flow\\data",
    exists: true,
    identity: "volume:file:directory:0:0",
  };
  const plan = createLifecyclePlan(
    { ...request("factory-reset", "all"), allKnownProfiles: true },
    current,
    { platform: "win32" },
  );
  assert.equal(plan.impacts.includes("Move confirmed data to the Dev Flow recovery directory"), true);
  assert.equal(plan.impacts.some((impact) => impact.includes("macOS Trash")), false);
});

function request(operation, host) {
  return { operation, host, profiles: host === "codex" ? [] : ["web"], targetVersion: "latest", allKnownProfiles: false, adopt: false, reinstallAfterReset: false, permanent: false };
}

function observed({ codexState = "absent", codexVersion = null, codexPackageInstalled = false, deepseekState = "absent", known = ["web"] } = {}) {
  return {
    codex: { host: "codex", profile: null, state: codexState, packageInstalled: codexPackageInstalled, packageVersion: codexVersion, receipt: codexState !== "absent" },
    deepseek: [{ host: "deepseek", profile: "web", state: deepseekState, packageVersion: deepseekState === "ready" ? "1.2.3" : null, receipt: deepseekState !== "absent" ? {} : null }],
    knownDeepSeekProfiles: known,
    resources: {
      configuration: { label: "configuration", path: "/tmp/config", exists: false, identity: null },
      defaultData: { label: "default-data", path: "/tmp/data", exists: false, identity: null },
      explicitData: null,
    },
  };
}
