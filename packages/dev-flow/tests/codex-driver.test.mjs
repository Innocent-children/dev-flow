import assert from "node:assert/strict";
import test from "node:test";

import { createCodexDriver } from "../lib/hosts/codex.mjs";

test("local replacement removes an owned registration before changing package bytes", async () => {
  const calls = [];
  const driver = createCodexDriver({
    localPackage: { path: "C:/local/codex.tgz", version: "1.2.3" },
    run: async (command, args) => {
      calls.push([command, args[0]]);
      return { stdout: args[0] === "status" ? JSON.stringify({ status: "ready", package_version: "1.2.3" }) : "{}", stderr: "" };
    },
  });
  const result = await driver.execute("install", { targetVersion: "1.2.3", observed: { hostAvailable: true, state: "ready", receipt: true, packageVersion: "1.2.3" } });
  assert.deepEqual(calls, [["dev-flow-codex", "remove"], ["npm", "install"], ["dev-flow-codex", "setup"], ["dev-flow-codex", "status"]]);
  assert.equal(result.completedSteps[0], "codex.remove_registration");
});

test("Codex driver observes through read-only Host authorities", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    if (executable === "codex") return { stdout: "codex-cli 0.149.0\n", stderr: "" };
    return { stdout: `${JSON.stringify({ status: "ready", package_version: "0.7.0", core_version: "0.6.0", registration: { receipt: true } })}\n`, stderr: "" };
  } });
  const state = await driver.observe();
  assert.equal(state.state, "ready");
  assert.equal(state.packageInstalled, true);
  assert.equal(state.packageVersion, "0.7.0");
  assert.deepEqual(calls, [
    ["codex", ["--version"]],
    ["dev-flow-codex", ["status", "--json"]],
  ]);
});

test("Codex install and uninstall use exact package then lifecycle order", async () => {
  const calls = [];
  const progress = [];
  const run = async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    if (arguments_[0] === "status") return { stdout: `${JSON.stringify({ status: "ready", package_version: "0.8.0", core_version: "0.6.0", registration: { receipt: true } })}\n`, stderr: "" };
    return { stdout: "{}\n", stderr: "" };
  };
  const driver = createCodexDriver({ run });
  const installed = await driver.execute("install", {
    targetVersion: "0.8.0",
    observed: { hostAvailable: true, state: "absent", packageVersion: null },
    onProgress: (step) => progress.push(step),
  });
  assert.equal(installed.changed, true);
  assert.deepEqual(calls.slice(0, 3), [
    ["npm", ["install", "--global", "dev-flow-codex@0.8.0"]],
    ["dev-flow-codex", ["setup", "--json"]],
    ["dev-flow-codex", ["status", "--json"]],
  ]);
  assert.deepEqual(progress, ["codex.install_package", "codex.setup_registration", "codex.verify_ready"]);
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

test("Codex local package bypasses registry lookup and installs the exact tarball", async () => {
  const calls = [];
  const artifact = "/tmp/dev-flow-codex-local.tgz";
  const driver = createCodexDriver({
    localPackage: { path: artifact, version: "0.8.2" },
    run: async (executable, arguments_) => {
      calls.push([executable, arguments_]);
      if (arguments_[0] === "status") return { stdout: `${JSON.stringify({ status: "ready", package_version: "0.8.2", core_version: "0.6.4", registration: { receipt: true } })}\n`, stderr: "" };
      return { stdout: "{}\n", stderr: "" };
    },
  });
  assert.equal(await driver.resolveTargetVersion("latest"), "0.8.2");
  await driver.execute("install", { targetVersion: "0.8.2", observed: { hostAvailable: true, state: "ready", packageVersion: "0.8.2" } });
  assert.deepEqual(calls[0], ["npm", ["install", "--global", artifact]]);
  assert.equal(calls.some(([executable, arguments_]) => executable === "npm" && arguments_[0] === "view"), false);
});

test("Codex uninstall removes a global package after its registration is already absent", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    return { stdout: "{}\n", stderr: "" };
  } });

  const result = await driver.execute("uninstall", {
    targetVersion: null,
    observed: { hostAvailable: true, state: "absent", packageInstalled: true, packageVersion: "0.7.3" },
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.completedSteps, ["codex.remove_registration", "codex.uninstall_package"]);
  assert.deepEqual(calls, [
    ["dev-flow-codex", ["remove", "--json"]],
    ["npm", ["uninstall", "--global", "dev-flow-codex"]],
  ]);
});

test("Codex uninstall keeps the package when remove fails", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (executable, arguments_) => {
    calls.push([executable, arguments_]);
    if (executable === "dev-flow-codex") throw new Error("WebUI did not stop");
    return { stdout: "{}\n", stderr: "" };
  } });

  await assert.rejects(() => driver.execute("uninstall", {
    targetVersion: null,
    observed: { hostAvailable: true, state: "ready", packageInstalled: true, packageVersion: "0.8.0" },
  }), (error) => {
    assert.equal(error.message, "WebUI did not stop");
    assert.deepEqual(error.completedSteps, []);
    assert.equal(error.nextStep, "dev-flow repair --host codex --yes");
    return true;
  });

  assert.deepEqual(calls, [
    ["dev-flow-codex", ["remove", "--json"]],
  ]);
});

test("broken Core self-check preserves npm version and remains repairable", async () => {
  let repaired = false;
  const calls = [];
  const driver = createCodexDriver({ run: async (command, args) => {
    calls.push([command, ...args]);
    if (command === 'codex') return { stdout: 'codex-cli 1.0.0' };
    if (args[0] === 'list') return { stdout: JSON.stringify({ dependencies: { 'dev-flow-codex': { version: '1.2.3' } } }) };
    if (args[0] === 'status') {
      if (!repaired) throw Object.assign(new Error('Adapter check failed'), { code: 1, stderr: 'Core executable missing' });
      return { stdout: JSON.stringify({ status: 'ready', package_version: '1.2.3', core_version: '1.0.0', registration: { receipt: true } }) };
    }
    if (args[0] === 'setup') repaired = true;
    return { stdout: '{}' };
  } });
  const observed = await driver.observe();
  assert.equal(observed.state, 'partial');
  assert.equal(observed.packageVersion, '1.2.3');
  assert.equal(observed.issues[0].detail, 'Core executable missing');
  await driver.execute('repair', { targetVersion: observed.packageVersion, observed });
  assert.equal((await driver.observe()).state, 'ready');
  assert.equal(calls.some(call => call.includes('dev-flow-codex@1.2.3')), true);
});

test("same-version repair restores package files then rebuilds the owned registration", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (_command, args) => {
    calls.push(args[0]);
    return { stdout: args[0] === 'status' ? JSON.stringify({ status: 'ready', package_version: '1.2.3' }) : '{}' };
  } });
  await driver.execute('repair', { targetVersion: '1.2.3', observed: { hostAvailable: true, packageVersion: '1.2.3', state: 'partial', receipt: true } });
  assert.deepEqual(calls, ['install', 'remove', 'setup', 'status']);
});

test("an authorized downgrade removes the old owned registration before replacement", async () => {
  const calls = [];
  const driver = createCodexDriver({ run: async (_command, args) => {
    calls.push(args[0]);
    return { stdout: args[0] === 'status' ? JSON.stringify({ status: 'ready', package_version: '1.0.0' }) : '{}' };
  } });
  await driver.execute('upgrade', { targetVersion: '1.0.0', observed: { hostAvailable: true, packageVersion: '2.0.0', state: 'ready', receipt: true } });
  assert.deepEqual(calls, ['remove', 'install', 'setup', 'status']);
});

test("npm empty global list with exit 1 is an absent Adapter, not a failed check", async () => {
  const driver = createCodexDriver({ run: async (command) => {
    if (command === "codex") return { stdout: "codex-cli 1.0.0" };
    if (command === "dev-flow-codex") throw Object.assign(new Error("not installed"), { code: "ENOENT" });
    throw Object.assign(new Error("npm list failed"), { code: 1, stdout: '{"name":"lib"}\n' });
  } });
  const state = await driver.observe();
  assert.equal(state.state, "absent");
  assert.equal(state.packageInstalled, false);
  assert.equal(state.issues.some(issue => issue.code === "package_check_failed"), false);
});
