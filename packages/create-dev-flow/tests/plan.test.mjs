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

function request(operation, host) {
  return { operation, host, profiles: host === "codex" ? [] : ["web"], targetVersion: "latest", allKnownProfiles: false, adopt: false, reinstallAfterReset: false, permanent: false };
}

function observed({ codexState = "absent", codexVersion = null, deepseekState = "absent", known = ["web"] } = {}) {
  return {
    codex: { host: "codex", profile: null, state: codexState, packageVersion: codexVersion, receipt: codexState !== "absent" },
    deepseek: [{ host: "deepseek", profile: "web", state: deepseekState, packageVersion: deepseekState === "ready" ? "1.2.3" : null, receipt: deepseekState !== "absent" ? {} : null }],
    knownDeepSeekProfiles: known,
    resources: {
      configuration: { label: "configuration", path: "/tmp/config", exists: false, identity: null },
      defaultData: { label: "default-data", path: "/tmp/data", exists: false, identity: null },
      explicitData: null,
    },
  };
}
