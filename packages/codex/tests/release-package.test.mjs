import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const buildScript = join(repositoryRoot, "scripts", "build-codex-local.sh");
const fakeCodexPath = join(packageRoot, "tests", "fixtures", "fake-codex.mjs");
const supportedMachine = process.platform === "darwin" && process.arch === "arm64";

test("source-free global tarball install, explicit lifecycle, uninstall, and retained task reopen", {
  skip: supportedMachine ? false : "darwin-arm64 source-free package checkpoint only",
  timeout: 180_000,
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-release-package-")));
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.dispose()));
    await rm(root, { recursive: true, force: true });
  });

  const artifactDirectory = join(root, "artifacts");
  const firstPrefix = join(root, "global-prefix-one");
  const firstCache = join(root, "npm-cache-one");
  const secondPrefix = join(root, "global-prefix-two");
  const secondCache = join(root, "npm-cache-two");
  const isolatedHome = join(root, "home");
  const stateRoot = join(root, "state");
  const dataDirectory = join(stateRoot, "data");
  const targetRepository = join(root, "workspace");
  const hostBin = join(root, "host-bin");
  const processTemp = join(root, "process-temp");
  const logs = join(root, "logs");
  const fakeState = join(root, "fake-codex", "state.json");
  const fakeTrace = join(root, "fake-codex", "trace.jsonl");
  const receiptPath = join(
    isolatedHome,
    "Library",
    "Application Support",
    "dev-flow",
    "registrations",
    "codex.json",
  );
  await Promise.all([
    mkdir(artifactDirectory, { recursive: true }),
    mkdir(firstPrefix, { recursive: true }),
    mkdir(firstCache, { recursive: true }),
    mkdir(secondPrefix, { recursive: true }),
    mkdir(secondCache, { recursive: true }),
    mkdir(isolatedHome, { recursive: true }),
    mkdir(dataDirectory, { recursive: true }),
    mkdir(hostBin, { recursive: true }),
    mkdir(processTemp, { recursive: true }),
    mkdir(logs, { recursive: true }),
    initializeRepository(targetRepository),
  ]);
  await symlink(fakeCodexPath, join(hostBin, "codex"));

  const repositoryBefore = await directoryManifest(targetRepository);
  const homeBeforeInstall = await directoryManifest(isolatedHome);
  const dataBeforeInstall = await directoryManifest(dataDirectory);
  const { stdout: buildOutput } = await execFile(buildScript, ["--output", artifactDirectory], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const build = JSON.parse(buildOutput);
  assert.equal(build.final_artifact, false);
  assert.equal(build.package_version, "0.1.0");
  assert.equal(build.core_version, build.package_version);
  assert.equal(build.platform, "darwin-arm64");
  assert.match(build.artifact_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(await sha256(readFile(build.artifact_path)), build.artifact_sha256);

  await installGlobalTarball(build.artifact_path, firstPrefix, firstCache);
  const firstInstallation = await installedProduct(firstPrefix);
  assert.equal(firstInstallation.packageRoot.startsWith(firstPrefix), true);
  assert.equal(firstInstallation.executable, join(firstPrefix, "bin", "dev-flow-codex"));
  assert.equal(
    await realpath(firstInstallation.executable),
    join(firstInstallation.packageRoot, "bin", "dev-flow-codex.mjs"),
  );
  assert.deepEqual(await directoryManifest(isolatedHome), homeBeforeInstall);
  assert.deepEqual(await directoryManifest(dataDirectory), dataBeforeInstall);
  assert.deepEqual(await directoryManifest(targetRepository), repositoryBefore);
  await assert.rejects(stat(receiptPath), { code: "ENOENT" });
  await assert.rejects(stat(fakeState), { code: "ENOENT" });
  await assert.rejects(stat(join(dataDirectory, "dev-flow.db")), { code: "ENOENT" });
  for (const profile of [".profile", ".zprofile", ".zshrc", ".bash_profile", ".bashrc"]) {
    await assert.rejects(stat(join(isolatedHome, profile)), { code: "ENOENT" });
  }

  let productEnvironment = makeProductEnvironment({
    prefix: firstPrefix,
    home: isolatedHome,
    dataDirectory,
    hostBin,
    processTemp,
    fakeState,
    fakeTrace,
  });
  assert.equal("NODE_PATH" in productEnvironment, false);
  assert.equal(productEnvironment.PATH.includes(repositoryRoot), false);
  await assert.rejects(execFile("go", ["version"], { env: productEnvironment }), { code: "ENOENT" });

  const version = await execFile(firstInstallation.executable, ["--version"], {
    cwd: targetRepository,
    env: productEnvironment,
    encoding: "utf8",
  });
  assert.equal(version.stdout, "dev-flow-codex 0.1.0 (core 0.1.0)\n");
  assert.equal(version.stderr, "");

  const setup = await runLifecycle(firstInstallation.executable, "setup", productEnvironment, targetRepository);
  assert.deepEqual(setup, {
    operation: "setup",
    status: "installed",
    changed: true,
    receipt_path: receiptPath,
  });
  const repeatedSetup = await runLifecycle(firstInstallation.executable, "setup", productEnvironment, targetRepository);
  assert.equal(repeatedSetup.status, "already-installed");
  assert.equal(repeatedSetup.changed, false);

  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.paths.package_root, firstInstallation.packageRoot);
  assert.equal(receipt.paths.runtime_path, join(firstInstallation.packageRoot, "runtime", "darwin-arm64", "dev-flow"));
  assert.equal(receipt.product.version, build.package_version);
  assert.equal(receipt.product.core_version, build.core_version);
  const fakeRegistration = JSON.parse(await readFile(fakeState, "utf8"));
  assert.equal(fakeRegistration.marketplaces.length, 1);
  assert.equal(fakeRegistration.plugins.length, 1);
  assert.equal(fakeRegistration.marketplaces[0].root, firstInstallation.packageRoot);
  assert.equal(fakeRegistration.plugins[0].source.path, join(firstInstallation.packageRoot, "plugin"));

  const installedManifest = JSON.parse(await readFile(join(firstInstallation.packageRoot, "package.json"), "utf8"));
  assert.equal(installedManifest.private, false);
  assert.deepEqual(installedManifest.os, ["darwin"]);
  assert.deepEqual(installedManifest.cpu, ["arm64"]);
  assert.deepEqual(await readdir(join(firstInstallation.packageRoot, "plugin", "skills")), ["dev-flow"]);
  const installedMCP = JSON.parse(await readFile(join(firstInstallation.packageRoot, "plugin", ".mcp.json"), "utf8"));
  assert.deepEqual(Object.keys(installedMCP.mcpServers), ["dev-flow"]);

  const firstCore = await ReleaseCoreClient.start(
    join(firstInstallation.packageRoot, "runtime", "darwin-arm64", "dev-flow"),
    dataDirectory,
    targetRepository,
    productEnvironment,
  );
  clients.push(firstCore);
  const info = await firstCore.callTool("dev_flow_server_info", {});
  assert.equal(info.result.version, build.core_version);
  assert.equal(info.result.tools.length, 6);
  const opened = await firstCore.callTool("dev_flow_open_task", {
    host: "codex",
    repository_path: targetRepository,
    new_task: {
      goal: "Prove a source-free package retains task data after uninstall",
      scope: ["one isolated repository", "one packaged Core"],
      out_of_scope: ["public registry", "real Codex host", "repository mutation"],
      acceptance_criteria: ["The same task identity is read by a reinstalled packaged Core."],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 1,
        allow_full_suite: false,
        allow_manual_handoff: true,
      },
    },
  });
  assert.equal(opened.ok, true);
  const taskBefore = taskIdentity(opened.result.task);
  await firstCore.close();

  const dataBeforeRemoval = await directoryManifest(dataDirectory);
  assert.equal(dataBeforeRemoval.files.some((entry) => entry.path === "dev-flow.db"), true);
  const unknownDataAdjacent = join(stateRoot, "user-owned-adjacent.txt");
  const unknownCodexAdjacent = join(dirname(fakeState), "user-owned-codex-state.txt");
  await writeFile(unknownDataAdjacent, "preserve data-adjacent state\n");
  await writeFile(unknownCodexAdjacent, "preserve Codex-adjacent state\n");

  await uninstallGlobalPackage(firstPrefix, firstCache);
  await assert.rejects(stat(firstInstallation.packageRoot), { code: "ENOENT" });
  assert.notEqual(await optionalContents(receiptPath), null, "npm uninstall must not run explicit remove");
  const registrationAfterUninstall = JSON.parse(await readFile(fakeState, "utf8"));
  assert.equal(registrationAfterUninstall.marketplaces.length, 1);
  assert.equal(registrationAfterUninstall.plugins.length, 1);
  assert.deepEqual(await directoryManifest(dataDirectory), dataBeforeRemoval);
  assert.deepEqual(await directoryManifest(targetRepository), repositoryBefore);

  await installGlobalTarball(build.artifact_path, firstPrefix, firstCache);
  const reinstalledFirst = await installedProduct(firstPrefix);
  const removed = await runLifecycle(reinstalledFirst.executable, "remove", productEnvironment, targetRepository);
  assert.equal(removed.operation, "remove");
  assert.equal(removed.status, "removed");
  assert.equal(removed.changed, true);
  assert.match(removed.next_step, /npm uninstall dev-flow-codex separately/u);
  await assert.rejects(stat(receiptPath), { code: "ENOENT" });
  const registrationAfterRemove = JSON.parse(await readFile(fakeState, "utf8"));
  assert.deepEqual(registrationAfterRemove, { marketplaces: [], plugins: [] });
  await uninstallGlobalPackage(firstPrefix, firstCache);
  await assert.rejects(stat(reinstalledFirst.packageRoot), { code: "ENOENT" });

  assert.deepEqual(await directoryManifest(dataDirectory), dataBeforeRemoval);
  assert.equal(await readFile(unknownDataAdjacent, "utf8"), "preserve data-adjacent state\n");
  assert.equal(await readFile(unknownCodexAdjacent, "utf8"), "preserve Codex-adjacent state\n");
  assert.deepEqual(await directoryManifest(targetRepository), repositoryBefore);

  await installGlobalTarball(build.artifact_path, secondPrefix, secondCache);
  const secondInstallation = await installedProduct(secondPrefix);
  assert.notEqual(secondInstallation.packageRoot, firstInstallation.packageRoot);
  productEnvironment = makeProductEnvironment({
    prefix: secondPrefix,
    home: isolatedHome,
    dataDirectory,
    hostBin,
    processTemp,
    fakeState,
    fakeTrace,
  });
  const dataBeforeReadback = await directoryManifest(dataDirectory);
  const secondCore = await ReleaseCoreClient.start(
    join(secondInstallation.packageRoot, "runtime", "darwin-arm64", "dev-flow"),
    dataDirectory,
    targetRepository,
    productEnvironment,
  );
  clients.push(secondCore);
  const reopened = await secondCore.callTool("dev_flow_get_task", {
    host: "codex",
    task_id: taskBefore.task_id,
  });
  assert.deepEqual(taskIdentity(reopened.result.task), taskBefore);
  const repeatedRead = await secondCore.callTool("dev_flow_get_task", {
    host: "codex",
    task_id: taskBefore.task_id,
  });
  assert.deepEqual(taskIdentity(repeatedRead.result.task), taskBefore);
  await secondCore.close();
  assert.deepEqual(await directoryManifest(dataDirectory), dataBeforeReadback);
  assert.deepEqual(await directoryManifest(targetRepository), repositoryBefore);
  assert.equal(await readFile(unknownDataAdjacent, "utf8"), "preserve data-adjacent state\n");
  assert.equal(await readFile(unknownCodexAdjacent, "utf8"), "preserve Codex-adjacent state\n");
  t.diagnostic(
    `retained task ${taskBefore.task_id}: revision=${taskBefore.revision} phase=${taskBefore.phase} ` +
      `action=${taskBefore.current_action?.kind ?? "none"} outcome=${taskBefore.outcome ?? "null"}`,
  );

  await uninstallGlobalPackage(secondPrefix, secondCache);
  await assert.rejects(stat(secondInstallation.packageRoot), { code: "ENOENT" });
  await writeFile(join(logs, "summary.json"), `${JSON.stringify({
    evidence: "source-free local tarball installation",
    lifecycle: "fake-Codex",
    task: taskBefore,
    public_registry: false,
  })}\n`);
});

class ReleaseCoreClient {
  static async start(runtimePath, dataDirectory, repositoryPath, environment) {
    const client = new ReleaseCoreClient(runtimePath, dataDirectory, repositoryPath, environment);
    await client.initialize();
    return client;
  }

  constructor(runtimePath, dataDirectory, repositoryPath, environment) {
    this.nextID = 1;
    this.pending = new Map();
    this.stderr = "";
    this.exited = false;
    this.child = spawn(runtimePath, ["mcp", "--stdio"], {
      cwd: repositoryPath,
      env: { ...environment, DEV_FLOW_DATA_DIR: dataDirectory },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.exitPromise = new Promise((resolve) => {
      this.child.once("exit", (code, signal) => {
        this.exited = true;
        const error = new Error(`packaged Core exited (${code ?? signal})${this.stderr ? `: ${this.stderr.trim()}` : ""}`);
        for (const { reject, timer } of this.pending.values()) {
          clearTimeout(timer);
          reject(error);
        }
        this.pending.clear();
        resolve({ code, signal });
      });
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      const response = JSON.parse(line);
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      pending.resolve(response);
    });
  }

  async initialize() {
    const response = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-release-package-test", version: "0.1.0" },
    });
    assert.equal(response.result.serverInfo.name, "dev-flow");
    this.notify("notifications/initialized", {});
  }

  async callTool(name, arguments_) {
    const response = await this.request("tools/call", { name, arguments: arguments_ });
    if (response.error) throw new Error(`Core RPC error ${response.error.code}: ${response.error.message}`);
    const result = response.result;
    assert.ok(result?.structuredContent, `tool ${name} returned no complete structured result`);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    return result.structuredContent;
  }

  request(method, params) {
    const id = this.nextID;
    this.nextID += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`packaged Core request timed out: ${method}${this.stderr ? `: ${this.stderr.trim()}` : ""}`));
      }, 5_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async close() {
    if (!this.exited) this.child.stdin.end();
    const result = await Promise.race([
      this.exitPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("packaged Core did not stop after EOF")), 5_000)),
    ]);
    assert.deepEqual(result, { code: 0, signal: null }, this.stderr);
  }

  async dispose() {
    if (this.exited) return;
    this.child.stdin.end();
    const stopped = await Promise.race([
      this.exitPromise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 1_000)),
    ]);
    if (!stopped) {
      this.child.kill("SIGTERM");
      await this.exitPromise;
    }
  }
}

async function installGlobalTarball(tarball, prefix, cache) {
  await execFile("npm", [
    "install",
    "--global",
    "--prefix",
    prefix,
    "--cache",
    cache,
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball,
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

async function uninstallGlobalPackage(prefix, cache) {
  await execFile("npm", [
    "uninstall",
    "--global",
    "--prefix",
    prefix,
    "--cache",
    cache,
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "dev-flow-codex",
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

async function installedProduct(prefix) {
  const { stdout } = await execFile("npm", ["root", "--global", "--prefix", prefix], {
    encoding: "utf8",
  });
  const productRoot = await realpath(join(stdout.trim(), "dev-flow-codex"));
  return {
    packageRoot: productRoot,
    executable: join(prefix, "bin", "dev-flow-codex"),
  };
}

function makeProductEnvironment({ prefix, home, dataDirectory, hostBin, processTemp, fakeState, fakeTrace }) {
  return {
    HOME: home,
    PATH: [join(prefix, "bin"), hostBin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    TMPDIR: processTemp,
    LANG: "C",
    DEV_FLOW_DATA_DIR: dataDirectory,
    FAKE_CODEX_STATE: fakeState,
    FAKE_CODEX_TRACE: fakeTrace,
    FAKE_CODEX_VERSION: "0.147.0",
  };
}

async function runLifecycle(executable, operation, environment, currentDirectory) {
  const { stdout, stderr } = await execFile(executable, [operation, "--json"], {
    cwd: currentDirectory,
    env: environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(stderr, "");
  return JSON.parse(stdout);
}

function taskIdentity(task) {
  return {
    task_id: task.task_id,
    revision: task.revision,
    phase: task.phase,
    current_action: task.current_action === null ? null : {
      action_id: task.current_action.action_id,
      kind: task.current_action.kind,
      revision: task.current_action.revision,
    },
    outcome: task.outcome,
  };
}

async function initializeRepository(path) {
  await mkdir(path, { recursive: true });
  await execFile("git", ["init", "--initial-branch=main"], { cwd: path });
  await execFile("git", ["config", "user.name", "Dev Flow Package Test"], { cwd: path });
  await execFile("git", ["config", "user.email", "package-test@example.invalid"], { cwd: path });
  await writeFile(join(path, "README.md"), "source-free package fixture\n");
  await execFile("git", ["add", "README.md"], { cwd: path });
  await execFile("git", ["commit", "-m", "package fixture baseline"], { cwd: path });
}

async function directoryManifest(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else {
        files.push({
          path: relative(root, absolute).split("\\").join("/"),
          sha256: await sha256(readFile(absolute)),
        });
      }
    }
  }
  await visit(root);
  const canonical = files.map((entry) => `${entry.sha256}  ${entry.path}\n`).join("");
  return { files, sha256: createHash("sha256").update(canonical).digest("hex") };
}

async function sha256(value) {
  return createHash("sha256").update(await value).digest("hex");
}

async function optionalContents(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
