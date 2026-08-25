import assert from "node:assert/strict";
import test from "node:test";

import { createCodexDriver } from "../lib/hosts/codex.mjs";

test("Codex driver observes through read-only Host authorities", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    if (executable === "codex") return { stdout: "codex-cli 0.149.0\n", stderr: "" };
    return { stdout: `${JSON.stringify({ status: "ready", package_version: "0.7.0", core_version: "0.6.0", registration: { receipt: true } })}\n`, stderr: "" };
  } });
  const state = await driver.observe();
  assert.equal(state.state, "ready");
  assert.equal(state.packageVersion, "0.7.0");
  assert.deepEqual(calls, [
    ["codex", ["--version"]],
    ["dev-flow-codex", ["status", "--json"]],
  ]);
});

test("Codex install and uninstall use exact package then lifecycle order", async () => {
  const calls = [];
  const run = async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    if (arguments_[0] === "status") return { stdout: `${JSON.stringify({ status: "ready", package_version: "0.8.0", core_version: "0.6.0", registration: { receipt: true } })}\n`, stderr: "" };
    return { stdout: "{}\n", stderr: "" };
  };
  const driver = createCodexDriver({ run });
  const installed = await driver.execute("install", {
    targetVersion: "0.8.0",
    observed: { hostAvailable: true, state: "absent", packageVersion: null },
  });
  assert.equal(installed.changed, true);
  assert.deepEqual(calls.slice(0, 3), [
    ["npm", ["install", "--global", "dev-flow-codex@0.8.0"]],
    ["dev-flow-codex", ["setup", "--json"]],
    ["dev-flow-codex", ["status", "--json"]],
  ]);
  calls.length = 0;
  await driver.execute("uninstall", {
    targetVersion: null,
    observed: { hostAvailable: true, state: "ready", packageVersion: "0.8.0" },
  });
  assert.deepEqual(calls, [
    ["dev-flow-codex", ["remove", "--json"]],
    ["npm", ["uninstall", "--global", "dev-flow-codex"]],
  ]);
});
