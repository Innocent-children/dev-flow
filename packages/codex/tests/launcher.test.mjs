import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  launchPackagedCore,
  runCLI,
  stopPackagedWebUI,
} from "../bin/dev-flow-codex.mjs";
import { CODEX_MCP_INSTRUCTIONS } from "../lib/lifecycle.mjs";
import { resolveProductPaths } from "../lib/paths.mjs";

const execFile = promisify(execFileCallback);
const launcherPath = fileURLToPath(new URL("../bin/dev-flow-codex.mjs", import.meta.url));

test("mcp selects only the package-local Core and inherits protocol stdio", async (t) => {
  const paths = await makePaths(t, { usesDefaultDataDirectory: true });
  const signalSource = new EventEmitter();
  const calls = [];
  let defaultDirectoryEnsured = false;
  const spawnImpl = (executable, arguments_, options) => {
    calls.push({ executable, arguments_, options });
    const child = new EventEmitter();
    child.kill = () => true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return child;
  };

  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runCLI(["mcp"], {
    environment: {
      SAFE_PARENT_VALUE: "preserved",
      DEV_FLOW_CODEX_MCP_INSTRUCTIONS: "parent value must not override product guidance",
    },
    stdout,
    stderr,
    resolvePaths: async () => paths,
    ensureDefaultDataDirectory: async (actual) => {
      assert.equal(actual, paths);
      defaultDirectoryEnsured = true;
    },
    spawnImpl,
    signalSource,
  });

  assert.deepEqual(result, { code: 0, signal: null });
  assert.equal(defaultDirectoryEnsured, true);
  assert.equal(stdout.text, "", "the launcher must not contaminate MCP stdout");
  assert.equal(stderr.text, "");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, paths.runtimePath);
  assert.deepEqual(calls[0].arguments_, ["mcp", "--stdio"]);
  assert.equal(calls[0].options.stdio, "inherit");
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.env.DEV_FLOW_DATA_DIR, paths.dataDirectory);
  assert.equal(calls[0].options.env.SAFE_PARENT_VALUE, "preserved");
  assert.equal(
    calls[0].options.env.DEV_FLOW_CODEX_MCP_INSTRUCTIONS,
    CODEX_MCP_INSTRUCTIONS,
  );
  assert.equal(calls[0].arguments_.includes("--add-dir"), false);
  assert.equal(calls[0].arguments_.includes("--sandbox"), false);
});

test("mcp preserves an explicit data root without creating it", async (t) => {
  const paths = await makePaths(t, { usesDefaultDataDirectory: false });
  let createAttempted = false;
  const result = await runCLI(["mcp"], {
    environment: {},
    stdout: captureStream(),
    stderr: captureStream(),
    resolvePaths: async () => paths,
    ensureDefaultDataDirectory: async () => {
      createAttempted = true;
    },
    spawnImpl: successfulSpawn(),
    signalSource: new EventEmitter(),
  });

  assert.deepEqual(result, { code: 0, signal: null });
  assert.equal(createAttempted, false);
});

test("host-check forwards the closed pre-file-write command to the package-local Core", async (t) => {
  const paths = await makePaths(t, { usesDefaultDataDirectory: false });
  const calls = [];
  let createAttempted = false;
  const result = await runCLI(["host-check", "pre-file-write"], {
    environment: { SAFE_PARENT_VALUE: "preserved" },
    stdout: captureStream(),
    stderr: captureStream(),
    resolvePaths: async () => paths,
    ensureDefaultDataDirectory: async () => {
      createAttempted = true;
    },
    spawnImpl: (executable, arguments_, options) => {
      calls.push({ executable, arguments_, options });
      const child = new EventEmitter();
      child.kill = () => true;
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    },
    signalSource: new EventEmitter(),
  });

  assert.deepEqual(result, { code: 0, signal: null });
  assert.equal(createAttempted, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, paths.runtimePath);
  assert.deepEqual(calls[0].arguments_, ["host-check", "pre-file-write"]);
  assert.equal(calls[0].options.stdio, "inherit");
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.env.DEV_FLOW_DATA_DIR, paths.dataDirectory);
  assert.equal(calls[0].options.env.SAFE_PARENT_VALUE, "preserved");
});

test("host-launch accepts only closed JSON on the fixed internal operation surface", async (t) => {
  const paths = await makePaths(t, { usesDefaultDataDirectory: false });
  const stdout = captureStream();
  assert.deepEqual(await runCLI(["host-launch", "cleanup-decision"], {
    stdout,
    stderr: captureStream(),
    resolvePaths: async () => paths,
    readInput: async () => JSON.stringify({
      lifecycle: "DONE",
      surface: "cli_worktree",
      clean: true,
      pushed: true,
      stateCertain: true,
    }),
  }), { code: 0, signal: null });
  assert.deepEqual(JSON.parse(stdout.text), {
    automatic_cleanup: false,
    worktree_cleanup: "separate_authorization_required",
    branch_cleanup: "separate_authorization_required",
  });

  const invalidError = captureStream();
  assert.deepEqual(await runCLI(["host-launch", "cleanup-decision"], {
    stdout: captureStream(),
    stderr: invalidError,
    resolvePaths: async () => paths,
    readInput: async () => "[]",
  }), { code: 1, signal: null });
  assert.match(invalidError.text, /one JSON object/u);

  const duplicateError = captureStream();
  assert.deepEqual(await runCLI(["host-launch", "cleanup-decision"], {
    stdout: captureStream(),
    stderr: duplicateError,
    resolvePaths: async () => paths,
    readInput: async () => '{"lifecycle":"DONE","lifecycle":"CANCELLED","surface":"cli_worktree","clean":true,"pushed":true,"stateCertain":true}',
  }), { code: 1, signal: null });
  assert.match(duplicateError.text, /duplicate field lifecycle/u);
});

test("hook dispatches the package-owned PreToolUse implementation without resolving product paths", async () => {
  let resolved = false;
  let invoked = false;
  const result = await runCLI(["hook", "pre-tool-use"], {
    environment: { SAFE_PARENT_VALUE: "preserved" },
    stdout: captureStream(),
    stderr: captureStream(),
    resolvePaths: async () => {
      resolved = true;
    },
    runPreToolUseHook: async () => {
      invoked = true;
      return 0;
    },
  });
  assert.deepEqual(result, { code: 0, signal: null });
  assert.equal(invoked, true);
  assert.equal(resolved, false);
});

test("launcher fails before spawn for unsupported platforms and non-executable runtimes", async (t) => {
  const stdout = captureStream();
  const stderr = captureStream();
  let spawned = false;
  const dependencies = {
    stdout,
    stderr,
    resolvePaths: async () => {
      throw new Error("unsupported platform linux-x64; supported runtimes: darwin-arm64, win32-x64");
    },
    spawnImpl: () => {
      spawned = true;
    },
  };
  assert.deepEqual(await runCLI(["mcp"], dependencies), { code: 1, signal: null });
  assert.equal(spawned, false);
  assert.match(stderr.text, /unsupported platform linux-x64/);

  const paths = await makePaths(t, { executable: false });
  const secondError = captureStream();
  assert.deepEqual(
    await runCLI(["mcp"], {
      stdout: captureStream(),
      stderr: secondError,
      resolvePaths: async () => paths,
      spawnImpl: () => {
        spawned = true;
      },
      signalSource: new EventEmitter(),
    }),
    { code: 1, signal: null },
  );
  assert.match(secondError.text, /packaged Core.*executable/);
  assert.equal(spawned, false);
});

test("unsupported setup stops before every host, repository, data, receipt, and Core mutation", async (t) => {
  const { mkdtemp } = await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "dev-flow-codex-unsupported-"));
  const packageRoot = join(root, "installed-package");
  const homeDirectory = join(root, "home");
  const repository = join(root, "repository");
  const repositoryFile = join(repository, "owned.txt");
  const taskData = join(root, "task-data");
  await Promise.all([
    mkdir(packageRoot, { recursive: true }),
    mkdir(homeDirectory, { recursive: true }),
    mkdir(repository, { recursive: true }),
  ]);
  await writeFile(repositoryFile, "unchanged\n");

  let setupCalled = false;
  let spawned = false;
  let coreInspected = false;
  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runCLI(["setup", "--json"], {
    stdout,
    stderr,
    resolvePaths: () => resolveProductPaths({
      packageRoot,
      homeDirectory,
      platform: "linux",
      arch: "x64",
      environment: {},
    }),
    readPackageVersion: async () => {
      throw new Error("package version read must not run");
    },
    inspectCoreVersion: async () => {
      coreInspected = true;
    },
    setupRegistration: async () => {
      setupCalled = true;
    },
    spawnImpl: () => {
      spawned = true;
    },
  });

  assert.deepEqual(result, { code: 1, signal: null });
  assert.equal(stdout.text, "");
  assert.match(stderr.text, /unsupported platform linux-x64/);
  assert.equal(stderr.text.includes(root), false, "diagnostic must not disclose private fixture paths");
  assert.ok(stderr.text.length < 200, "unsupported-platform diagnostic must remain bounded");
  assert.equal(setupCalled, false);
  assert.equal(spawned, false);
  assert.equal(coreInspected, false);
  assert.equal(await readFile(repositoryFile, "utf8"), "unchanged\n");
  assert.deepEqual(await readdir(repository), ["owned.txt"]);
  await assert.rejects(stat(taskData), { code: "ENOENT" });
  await assert.rejects(
    stat(join(homeDirectory, "Library", "Application Support", "dev-flow")),
    { code: "ENOENT" },
  );
});

test("launcher returns the Core exit status and forwards termination signals", async (t) => {
  const paths = await makePaths(t);
  const exitChild = new EventEmitter();
  exitChild.kill = () => true;
  assert.deepEqual(
    await launchPackagedCore(paths, ["mcp", "--stdio"], {
      environment: {},
      spawnImpl: () => {
        queueMicrotask(() => exitChild.emit("exit", 23, null));
        return exitChild;
      },
      signalSource: new EventEmitter(),
    }),
    { code: 23, signal: null },
  );

  const signalSource = new EventEmitter();
  const signalChild = new EventEmitter();
  const forwarded = [];
  let markSpawned;
  const spawned = new Promise((resolve) => {
    markSpawned = resolve;
  });
  signalChild.kill = (signal) => {
    forwarded.push(signal);
    queueMicrotask(() => signalChild.emit("exit", null, signal));
    return true;
  };
  const pending = launchPackagedCore(paths, ["mcp", "--stdio"], {
    environment: {},
    spawnImpl: () => {
      markSpawned();
      return signalChild;
    },
    signalSource,
  });
  await spawned;
  signalSource.emit("SIGTERM");
  assert.deepEqual(await pending, { code: null, signal: "SIGTERM" });
  assert.deepEqual(forwarded, ["SIGTERM"]);
  assert.equal(signalSource.listenerCount("SIGTERM"), 0);
});

test("--version reports package and detached Core identity on one stable line", async (t) => {
  const paths = await makePaths(t);
  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runCLI(["--version"], {
    stdout,
    stderr,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    inspectCoreVersion: async (actual) => {
      assert.equal(actual, paths.runtimePath);
      return "0.1.0";
    },
  });

  assert.deepEqual(result, { code: 0, signal: null });
  assert.equal(stdout.text, "dev-flow-codex 0.1.0 (core 0.1.0)\n");
  assert.equal(stderr.text, "");
});

test("status is read-only and projects package, Core, receipt, marketplace, and Plugin state", async (t) => {
  const paths = await makePaths(t);
  paths.receiptPath = join(paths.packageRoot, "registrations", "codex.json");
  const stdout = captureStream();
  const result = await runCLI(["status", "--json"], {
    stdout,
    stderr: captureStream(),
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.7.0",
    inspectCoreVersion: async () => "0.6.0",
    inspectRegistrationStatus: async () => ({
      status: "ready", changed: false, receipt: true, marketplace: true, plugin: true,
    }),
  });
  assert.deepEqual(result, { code: 0, signal: null });
  assert.deepEqual(JSON.parse(stdout.text), {
    operation: "status",
    status: "ready",
    changed: false,
    package_version: "0.7.0",
    core_version: "0.6.0",
    receipt_path: paths.receiptPath,
    registration: { receipt: true, marketplace: true, plugin: true },
  });
});

test("setup emits success only after verified lifecycle completion and fails on stderr", async (t) => {
  const paths = await makePaths(t);
  paths.receiptPath = join(paths.packageRoot, "registrations", "codex.json");
  const stdout = captureStream();
  const stderr = captureStream();
  const result = await runCLI(["setup", "--json"], {
    stdout,
    stderr,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    setupRegistration: async ({ paths: actual, packageVersion }) => {
      assert.equal(stdout.text, "", "setup must not report success before lifecycle readback");
      assert.equal(actual, paths);
      assert.equal(packageVersion, "0.1.0");
      return { status: "installed", changed: true };
    },
  });
  assert.deepEqual(result, { code: 0, signal: null });
  assert.deepEqual(JSON.parse(stdout.text), {
    operation: "setup",
    status: "installed",
    changed: true,
    receipt_path: paths.receiptPath,
    configuration_path: paths.configurationPath,
    file_changes: [{ path: paths.configurationPath, change: "created" }],
    next_step: "Review and trust the Dev Flow hook with /hooks, then use $dev-flow-codex:dev-flow <task description> to assess the request",
  });
  assert.equal(stderr.text, "");

  const failedOutput = captureStream();
  const failedError = captureStream();
  const failed = await runCLI(["setup"], {
    stdout: failedOutput,
    stderr: failedError,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => ({
      configurationPath: paths.configurationPath,
      fileChange: null,
    }),
    setupRegistration: async () => {
      throw new Error("readback mismatch");
    },
  });
  assert.deepEqual(failed, { code: 1, signal: null });
  assert.equal(failedOutput.text, "");
  assert.equal(failedError.text, "dev-flow-codex: readback mismatch\n");
});

test("setup prepares configuration before registration and reports completed configuration on later failure", async (t) => {
  const paths = await makePaths(t);
  paths.receiptPath = join(paths.packageRoot, "registrations", "codex.json");
  let registrationCalls = 0;
  const invalidError = captureStream();
  const invalid = await runCLI(["setup"], {
    stdout: captureStream(),
    stderr: invalidError,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => {
      throw new Error("user configuration is invalid");
    },
    setupRegistration: async () => { registrationCalls += 1; },
  });
  assert.deepEqual(invalid, { code: 1, signal: null });
  assert.equal(registrationCalls, 0);
  assert.equal(invalidError.text, "dev-flow-codex: user configuration is invalid\n");

  const partialError = captureStream();
  const partial = await runCLI(["setup"], {
    stdout: captureStream(),
    stderr: partialError,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => ({
      configurationPath: paths.configurationPath,
      fileChange: { path: paths.configurationPath, change: "created" },
    }),
    setupRegistration: async () => {
      registrationCalls += 1;
      throw new Error("registration readback failed");
    },
  });
  assert.deepEqual(partial, { code: 1, signal: null });
  assert.equal(registrationCalls, 1);
  assert.match(partialError.text, /created .*config\.json/);
  assert.match(partialError.text, /registration is incomplete/);
  assert.match(partialError.text, /run dev-flow-codex setup again/);
});

test("interactive setup selects rich localized output, repeats compactly, and degrades renderer failures", async (t) => {
  const paths = await makePaths(t);
  paths.receiptPath = join(paths.packageRoot, "registrations", "codex.json");
  const configuration = {
    configurationPath: paths.configurationPath,
    fileChange: { path: paths.configurationPath, change: "created" },
  };
  const richOutput = captureStream({ isTTY: true, columns: 100 });
  assert.deepEqual(await runCLI(["setup"], {
    stdout: richOutput,
    stderr: captureStream(),
    environment: { TERM: "xterm-256color", LANG: "zh_CN.UTF-8" },
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => configuration,
    setupRegistration: async () => ({
      status: "installed",
      changed: true,
      fileChanges: [{ path: paths.receiptPath, change: "created" }],
    }),
  }), { code: 0, signal: null });
  assert.match(richOutput.text, /DEV FLOW · CODEX/);
  assert.match(richOutput.text, /设置完成/);

  const repeatedOutput = captureStream({ isTTY: true, columns: 100 });
  assert.deepEqual(await runCLI(["setup"], {
    stdout: repeatedOutput,
    stderr: captureStream(),
    environment: { TERM: "xterm", LANG: "en_US.UTF-8" },
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => ({ configurationPath: paths.configurationPath, fileChange: null }),
    setupRegistration: async () => ({ status: "already-installed", changed: false, fileChanges: [] }),
  }), { code: 0, signal: null });
  assert.match(repeatedOutput.text, /file changes: none/);
  assert.doesNotMatch(repeatedOutput.text, /╭/u);

  const fallbackOutput = captureStream({ isTTY: true, columns: 100 });
  assert.deepEqual(await runCLI(["setup"], {
    stdout: fallbackOutput,
    stderr: captureStream(),
    environment: { TERM: "xterm", LANG: "en_US.UTF-8" },
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    ensureUserConfiguration: async () => configuration,
    setupRegistration: async () => ({ status: "installed", changed: true, fileChanges: [] }),
    renderSetup: () => { throw new Error("terminal rendering unavailable"); },
  }), { code: 0, signal: null });
  assert.match(fallbackOutput.text, /dev-flow-codex setup: installed/);
  assert.doesNotMatch(fallbackOutput.text, /\u001b\[|╭/u);
});

test("remove reports deregistration before a separate npm-uninstall handoff", async (t) => {
  const paths = await makePaths(t);
  paths.receiptPath = join(paths.packageRoot, "registrations", "codex.json");
  const stdout = captureStream();
  const stderr = captureStream();
  const steps = [];
  const result = await runCLI(["remove", "--json"], {
    stdout,
    stderr,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    stopPackagedWebUI: async (actual) => {
      assert.equal(actual, paths);
      steps.push("stop");
    },
    removeRegistration: async ({ paths: actual, packageVersion }) => {
      steps.push("remove");
      assert.equal(stdout.text, "", "remove must not report success before absence readback");
      assert.equal(actual, paths);
      assert.equal(packageVersion, "0.1.0");
      return { status: "removed", changed: true };
    },
  });
  assert.deepEqual(result, { code: 0, signal: null });
  assert.deepEqual(JSON.parse(stdout.text), {
    operation: "remove",
    status: "removed",
    changed: true,
    receipt_path: paths.receiptPath,
    next_step: "Run npm uninstall -g dev-flow-codex separately after deregistration.",
  });
  assert.equal(stderr.text, "");
  assert.deepEqual(steps, ["stop", "remove"]);

  const humanOutput = captureStream();
  assert.deepEqual(await runCLI(["remove"], {
    stdout: humanOutput,
    stderr: captureStream(),
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    stopPackagedWebUI: async () => {},
    removeRegistration: async () => ({ status: "already-absent", changed: false }),
  }), { code: 0, signal: null });
  assert.match(humanOutput.text, /remove: already-absent/);
  assert.match(humanOutput.text, /npm uninstall -g dev-flow-codex.*separately/i);

  const failedOutput = captureStream();
  const failedError = captureStream();
  assert.deepEqual(await runCLI(["remove"], {
    stdout: failedOutput,
    stderr: failedError,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    stopPackagedWebUI: async () => {},
    removeRegistration: async () => {
      throw new Error("removal readback conflict");
    },
  }), { code: 1, signal: null });
  assert.equal(failedOutput.text, "");
  assert.equal(failedError.text, "dev-flow-codex: removal readback conflict\n");
});

test("remove keeps registration when WebUI stop fails", async (t) => {
  const paths = await makePaths(t);
  let removeCalled = false;
  const stdout = captureStream();
  const stderr = captureStream();

  assert.deepEqual(await runCLI(["remove", "--json"], {
    stdout,
    stderr,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    stopPackagedWebUI: async () => { throw new Error("stop packaged WebUI"); },
    removeRegistration: async () => { removeCalled = true; },
  }), { code: 1, signal: null });

  assert.equal(removeCalled, false);
  assert.equal(stdout.text, "");
  assert.equal(stderr.text, "dev-flow-codex: stop packaged WebUI\n");
});

test("packaged WebUI stop uses the current runtime and treats a missing default data directory as stopped", async (t) => {
  const paths = await makePaths(t);
  const calls = [];
  await stopPackagedWebUI(paths, {
    environment: { SAFE_PARENT_VALUE: "preserved" },
    exec: async (executable, arguments_, options) => calls.push({ executable, arguments_, options }),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, paths.runtimePath);
  assert.deepEqual(calls[0].arguments_, ["webui", "stop", "--json"]);
  assert.equal(calls[0].options.cwd, paths.packageRoot);
  assert.equal(calls[0].options.env.DEV_FLOW_DATA_DIR, paths.dataDirectory);

  const missingDefault = { ...paths, dataDirectory: join(paths.packageRoot, "missing-data"), usesDefaultDataDirectory: true };
  await stopPackagedWebUI(missingDefault, {
    exec: async () => { throw new Error("must not execute Core"); },
  });
});

test("unknown launcher commands fail without dispatch", async () => {
  let resolved = false;
  const stderr = captureStream();
  const result = await runCLI(["surprise"], {
    stdout: captureStream(),
    stderr,
    resolvePaths: async () => {
      resolved = true;
    },
  });
  assert.deepEqual(result, { code: 2, signal: null });
  assert.equal(resolved, false);
  assert.match(stderr.text, /invalid arguments/);
});

test("launcher exposes no repository or sandbox configuration command", async () => {
  for (const arguments_ of [
    ["mcp", "--add-dir", "/workspace/docs"],
    ["mcp", "--sandbox", "danger-full-access"],
    ["host-check"],
    ["host-check", "future"],
    ["host-check", "pre-file-write", "extra"],
    ["host-launch", "future"],
    ["hook"],
    ["hook", "future"],
    ["hook", "pre-tool-use", "extra"],
    ["configure-codebase-memory"],
    ["add-repository", "/workspace/docs"],
  ]) {
    let dispatched = false;
    const result = await runCLI(arguments_, {
      stderr: captureStream(), stdout: captureStream(),
      resolvePaths: async () => { dispatched = true; return {}; },
    });
    assert.equal(result.code, 2);
    assert.equal(dispatched, false);
  }
});

test("installed bin symlinks still execute the launcher entry point", {
  skip: process.platform === "win32" ? "ordinary Windows cannot create unprivileged file symlinks" : false,
}, async (t) => {
  const root = (await makePaths(t)).packageRoot;
  const link = join(root, "dev-flow-codex");
  await symlink(launcherPath, link);
  await assert.rejects(
    execFile(link, ["surprise"], { encoding: "utf8" }),
    (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stdout, "");
      assert.match(error.stderr, /invalid arguments/);
      return true;
    },
  );
});

async function makePaths(t, { usesDefaultDataDirectory = false, executable = true } = {}) {
  const { mkdtemp } = await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "dev-flow-codex-launcher-"));
  const runtimePath = join(root, "runtime", "darwin-arm64", "dev-flow");
  const dataDirectory = join(root, "data");
  const homeDirectory = join(root, "home");
  const configurationDirectory = join(homeDirectory, ".dev-flow");
  await mkdir(join(runtimePath, ".."), { recursive: true });
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(homeDirectory, { recursive: true });
  await writeFile(runtimePath, "fixture\n", { mode: executable ? 0o700 : 0o600 });
  assert.equal((await stat(runtimePath)).isFile(), true);
  return {
    packageRoot: root,
    platform: executable ? process.platform : "darwin",
    requireExecutableMode: true,
    enforcePrivateModes: true,
    forwardedSignals: ["SIGINT", "SIGTERM", "SIGHUP"],
    runtimePath,
    dataDirectory,
    usesDefaultDataDirectory,
    homeDirectory,
    productSupportRoot: join(root, "product support"),
    configurationDirectory,
    configurationPath: join(configurationDirectory, "config.json"),
  };
}

function successfulSpawn() {
  return () => {
    const child = new EventEmitter();
    child.kill = () => true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return child;
  };
}

function captureStream({ isTTY = false, columns } = {}) {
  return {
    text: "",
    isTTY,
    columns,
    write(chunk) {
      this.text += String(chunk);
      return true;
    },
  };
}
