import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  launchPackagedCore,
  runCLI,
} from "../bin/dev-flow-codex.mjs";

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
    environment: { SAFE_PARENT_VALUE: "preserved" },
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

test("launcher fails before spawn for unsupported platforms and non-executable runtimes", async (t) => {
  const stdout = captureStream();
  const stderr = captureStream();
  let spawned = false;
  const dependencies = {
    stdout,
    stderr,
    resolvePaths: async () => {
      throw new Error("unsupported platform linux-x64; Feature 003 supports darwin-arm64");
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
  });
  assert.equal(stderr.text, "");

  const failedOutput = captureStream();
  const failedError = captureStream();
  const failed = await runCLI(["setup"], {
    stdout: failedOutput,
    stderr: failedError,
    resolvePaths: async () => paths,
    readPackageVersion: async () => "0.1.0",
    setupRegistration: async () => {
      throw new Error("readback mismatch");
    },
  });
  assert.deepEqual(failed, { code: 1, signal: null });
  assert.equal(failedOutput.text, "");
  assert.equal(failedError.text, "dev-flow-codex: readback mismatch\n");
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

test("installed bin symlinks still execute the launcher entry point", async (t) => {
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
  await mkdir(join(runtimePath, ".."), { recursive: true });
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(runtimePath, "fixture\n", { mode: executable ? 0o700 : 0o600 });
  assert.equal((await stat(runtimePath)).isFile(), true);
  return {
    packageRoot: root,
    runtimePath,
    dataDirectory,
    usesDefaultDataDirectory,
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

function captureStream() {
  return {
    text: "",
    write(chunk) {
      this.text += String(chunk);
      return true;
    },
  };
}
