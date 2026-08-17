import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
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

test("release preparation uses two clean worktrees and verifies one canonical five-file set", {
  skip: supportedMachine ? false : "darwin-arm64 deterministic release preparation only",
  timeout: 180_000,
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-release-prepare-")));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixtureRoot = join(root, "source-fixture");
  const output = join(root, "release-output");
  await copyRepositoryFixture(fixtureRoot);
  await initializeMainFixture(fixtureRoot);
  await mkdir(output);

  const { stdout, stderr } = await execFile(join(fixtureRoot, "scripts", "build-codex-release.sh"), [
    "--output",
    output,
  ], {
    cwd: fixtureRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 150_000,
  });
  assert.equal(stderr, "");
  const prepared = JSON.parse(stdout);
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.build_count, 2);
  assert.match(prepared.runtime_sha256, /^[0-9a-f]{64}$/u);
  assert.match(prepared.normalized_package_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(typeof prepared.raw_tgz_equal, "boolean");
  assert.deepEqual(await readdir(output), [
    "SHA256SUMS",
    "dev-flow-0.1.0-darwin-arm64",
    "dev-flow-codex-0.1.0.tgz",
    "publication-record.json",
    "release-manifest.json",
  ]);

  const verification = await execFile(join(fixtureRoot, "scripts", "verify-codex-release.mjs"), [
    "--directory",
    output,
  ], {
    cwd: fixtureRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  });
  assert.equal(verification.stderr, "");
  assert.equal(JSON.parse(verification.stdout).status, "verified");

  const manifest = JSON.parse(await readFile(join(output, "release-manifest.json"), "utf8"));
  const publication = JSON.parse(await readFile(join(output, "publication-record.json"), "utf8"));
  assert.equal(manifest.validations.find((item) => item.name === "double-build").status, "passed");
  assert.match(manifest.validations.find((item) => item.name === "double-build").summary, /raw tgz bytes (?:matched|differed)/u);
  assert.equal(publication.overall_status, "prepared");
  assert.equal(publication.steps[0].status, "complete");
  assert.equal(publication.steps.slice(1).every((step) => step.status === "pending"), true);
  assert.equal(publication.github.draft, false);
  assert.equal(publication.github.assets.length, 0);
  assert.equal(publication.final_journey.status, "pending");
  assert.equal((await stat(join(output, "publication-record.json"))).mode & 0o777, 0o600);

  assert.equal((await execFile("git", ["status", "--porcelain"], { cwd: fixtureRoot, encoding: "utf8" })).stdout, "");
  assert.equal((await execFile("git", ["tag", "--list"], { cwd: fixtureRoot, encoding: "utf8" })).stdout, "");
  const worktrees = (await execFile("git", ["worktree", "list", "--porcelain"], {
    cwd: fixtureRoot,
    encoding: "utf8",
  })).stdout.match(/^worktree /gmu) ?? [];
  assert.equal(worktrees.length, 1, "prepare must clean both temporary worktrees");
  assert.equal((await walkPaths(output)).some((path) => /(?:build-[ab]|worktree|\.git|\.db|receipt)/u.test(path)), false);

  await assertPrepareRejects(fixtureRoot, ["--output", "relative-output"], /output directory must be absolute/);
  await assertPrepareRejects(fixtureRoot, ["--unknown"], /usage:/);
  const nonemptyOutput = join(root, "nonempty-output");
  await mkdir(nonemptyOutput);
  await writeFile(join(nonemptyOutput, "existing.txt"), "existing\n");
  await assertPrepareRejects(fixtureRoot, ["--output", nonemptyOutput], /must be empty/);
  const linkedTarget = join(root, "linked-target");
  const linkedOutput = join(root, "linked-output");
  await mkdir(linkedTarget);
  await symlink(linkedTarget, linkedOutput);
  await assertPrepareRejects(fixtureRoot, ["--output", linkedOutput], /must not be a symbolic link/);
  const insideOutput = join(fixtureRoot, "inside-output");
  await mkdir(insideOutput);
  await assertPrepareRejects(fixtureRoot, ["--output", insideOutput], /outside the source repository/);
  await rm(insideOutput, { recursive: true });
  const dirtyOutput = join(root, "dirty-output");
  await mkdir(dirtyOutput);
  await writeFile(join(fixtureRoot, "dirty-fixture.txt"), "dirty\n");
  await assertPrepareRejects(fixtureRoot, ["--output", dirtyOutput], /clean checkout/);
  await rm(join(fixtureRoot, "dirty-fixture.txt"));
  await execFile("git", ["switch", "-c", "fixture-feature"], { cwd: fixtureRoot });
  const branchOutput = join(root, "branch-output");
  await mkdir(branchOutput);
  await assertPrepareRejects(fixtureRoot, ["--output", branchOutput], /branch main/);
  await execFile("git", ["switch", "main"], { cwd: fixtureRoot });

  const extraOutput = await clonePreparedDirectory(root, output, "negative-extra");
  await writeFile(join(extraOutput, "unexpected.log"), "bounded negative fixture\n");
  await assertVerifierRejects(fixtureRoot, extraOutput, /approved five-file set/);

  const forbiddenOutput = await clonePreparedDirectory(root, output, "negative-forbidden");
  const forbiddenRecordPath = join(forbiddenOutput, "publication-record.json");
  const forbiddenRecord = JSON.parse(await readFile(forbiddenRecordPath, "utf8"));
  forbiddenRecord.safe_next_action = "authorization: bearer example-public-marker";
  await writeFile(forbiddenRecordPath, `${JSON.stringify(forbiddenRecord, null, 2)}\n`, { mode: 0o600 });
  await assertVerifierRejects(fixtureRoot, forbiddenOutput, /forbidden release content marker/);

  const tokenOutput = await clonePreparedDirectory(root, output, "negative-token");
  const tokenRecordPath = join(tokenOutput, "publication-record.json");
  const tokenRecord = JSON.parse(await readFile(tokenRecordPath, "utf8"));
  tokenRecord.safe_next_action = "example-token-marker";
  await writeFile(tokenRecordPath, `${JSON.stringify(tokenRecord, null, 2)}\n`, { mode: 0o600 });
  await assertVerifierRejects(fixtureRoot, tokenOutput, /forbidden release content marker/);

  const rawOutput = await clonePreparedDirectory(root, output, "negative-raw-output");
  const rawRecordPath = join(rawOutput, "publication-record.json");
  const rawRecord = JSON.parse(await readFile(rawRecordPath, "utf8"));
  rawRecord.raw_stderr = "bounded raw stderr fixture";
  await writeFile(rawRecordPath, `${JSON.stringify(rawRecord, null, 2)}\n`, { mode: 0o600 });
  await assertVerifierRejects(fixtureRoot, rawOutput, /fields do not match the closed contract/);

  const machinePathOutput = await clonePreparedDirectory(root, output, "negative-machine-path");
  const machineManifestPath = join(machinePathOutput, "release-manifest.json");
  const machineManifest = JSON.parse(await readFile(machineManifestPath, "utf8"));
  machineManifest.validations[0].summary = "/private/var/folders/example-release-output";
  await writeFile(machineManifestPath, `${JSON.stringify(machineManifest, null, 2)}\n`);
  const machineRecordPath = join(machinePathOutput, "publication-record.json");
  const machineRecord = JSON.parse(await readFile(machineRecordPath, "utf8"));
  machineRecord.manifest_sha256 = await sha256(readFile(machineManifestPath));
  await writeFile(machineRecordPath, `${JSON.stringify(machineRecord, null, 2)}\n`, { mode: 0o600 });
  await assertVerifierRejects(fixtureRoot, machinePathOutput, /machine path or environment value/);

  const longOutput = await clonePreparedDirectory(root, output, "negative-long-summary");
  const longManifestPath = join(longOutput, "release-manifest.json");
  const longManifest = JSON.parse(await readFile(longManifestPath, "utf8"));
  longManifest.validations[0].summary = "x".repeat(1001);
  await writeFile(longManifestPath, `${JSON.stringify(longManifest, null, 2)}\n`);
  await assertVerifierRejects(fixtureRoot, longOutput, /invalid or unbounded/);

  const sourceOutput = await clonePreparedDirectory(root, output, "negative-source");
  const sourceManifestPath = join(sourceOutput, "release-manifest.json");
  const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
  sourceManifest.artifacts[0].source_commit = "f".repeat(40);
  await writeFile(sourceManifestPath, `${JSON.stringify(sourceManifest, null, 2)}\n`);
  await assertVerifierRejects(fixtureRoot, sourceOutput, /identity\/mode differs/);
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

async function copyRepositoryFixture(destination) {
  await cp(repositoryRoot, destination, {
    recursive: true,
    filter(source) {
      const path = relative(repositoryRoot, source).split("\\").join("/");
      return path === "" || ![".git", "node_modules", ".codebase-memory"].some(
        (excluded) => path === excluded || path.startsWith(`${excluded}/`),
      );
    },
  });
}

async function initializeMainFixture(path) {
  await execFile("git", ["init", "--initial-branch=main"], { cwd: path });
  await execFile("git", ["config", "user.name", "Dev Flow Release Test"], { cwd: path });
  await execFile("git", ["config", "user.email", "release-test@example.invalid"], { cwd: path });
  await execFile("git", ["add", "."], { cwd: path, maxBuffer: 20 * 1024 * 1024 });
  await execFile("git", ["commit", "-m", "release fixture source"], { cwd: path, maxBuffer: 20 * 1024 * 1024 });
}

async function clonePreparedDirectory(root, source, name) {
  const destination = join(root, name);
  await cp(source, destination, { recursive: true });
  return destination;
}

async function assertVerifierRejects(repository, directory, pattern) {
  await assert.rejects(
    execFile(join(repository, "scripts", "verify-codex-release.mjs"), ["--directory", directory], {
      cwd: repository,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    }),
    (error) => {
      assert.match(error.stderr, pattern);
      return true;
    },
  );
}

async function assertPrepareRejects(repository, arguments_, pattern) {
  await assert.rejects(
    execFile(join(repository, "scripts", "build-codex-release.sh"), arguments_, {
      cwd: repository,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
    }),
    (error) => {
      assert.match(error.stderr, pattern);
      return true;
    },
  );
}

async function walkPaths(root) {
  const paths = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).split("\\").join("/");
      paths.push(path);
      if (entry.isDirectory()) await visit(absolute);
    }
  };
  await visit(root);
  return paths.sort();
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
