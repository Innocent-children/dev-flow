#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod, copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile,
} from "node:fs/promises";
import { arch, homedir, platform, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { zstdDecompressSync } from "node:zlib";

import { buildCoreRuntimes } from "../../../scripts/build-core-runtimes.mjs";
import { createWorkspaceCoordinator } from "../../../packages/deepseek/lib/workspace-coordinator.mjs";

const execFile = promisify(execFileCallback);
const runnerPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(dirname(dirname(runnerPath))));
const EVIDENCE_KIND = "feature-001-multi-repository-deepseek-journey";
const PROFILE = "headless";
const TURN_TIMEOUT_MS = 300_000;
const APPLY_RULES = [
  "Before every submission, bind the latest complete Core Action, its submission_tool, and that tool's live input schema.",
  "Use exactly host, task_id, action_id, one returned transition_id, summary, reason, artifacts, method_results, and node_result.",
  "Do not send payload, method_evidence, revision, Action kind, process identity, source cursor, repository binding, artifact roles, or recovery fields.",
  "Set reason to the empty string whenever the selected transition has reason_required=false; use a nonempty reason only when reason_required=true.",
  "Use the live artifacts object and one method_results entry with capability empty for every current method step ID.",
  "For a forward ready, passed, or completed transition use problem_class=none and findings=[].",
  "Use a non-none problem_class and nonempty findings only for the exact corrective transition whose condition they establish.",
  "Never send changed_paths or no_file_changes; Core computes file effects from the dedicated worktrees.",
  "For REQUIREMENTS, node_result contains exactly problem_class, baseline, and unresolved_questions; unresolved_questions is a sibling of baseline and baseline contains exactly goal, scope, out_of_scope, acceptance_criteria, constraints, and assumptions.",
  "If any apply returns an error, stop immediately without retrying.",
].join(" ");

const mode = process.argv[2];
if (mode === "self-test") {
  selfTest();
  process.stdout.write("multi-repository-runner self-test passed\n");
} else if (mode === "preflight" || mode === "run") {
  const options = parseArguments(process.argv.slice(3));
  await execute(mode, options);
} else {
  throw new Error("usage: multi-repository-runner.mjs self-test|preflight|run --dsh-executable ABS --source-commit SHA --result-file ABS.json --credentials ABS --settings ABS --journey-budget N/N");
}

async function execute(selectedMode, options) {
  let root;
  let stage = "preflight";
  let dshStarted = false;
  let lastExit = null;
  const observedSessions = [];
  try {
    await validatePreflight(options);
    root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-multi-repository-")));
    const config = layout(root, options);
    await prepareDirectories(config);
    const product = await buildSourcePackage(config);
    await prepareDsh(config);
    await installAndReadBack(config, product);
    if (selectedMode === "preflight") {
      process.stdout.write(JSON.stringify({
        status: "ready",
        source_commit: options.sourceCommit,
        dsh_version: product.dshVersion,
        package_sha256: product.artifactSha256,
        core_sha256: product.coreSha256,
        session_count: 0,
        core_task_count: 0,
      }) + "\n");
      return;
    }

    stage = "workspace";
    await initializeWorkspace(config);
    const provisioned = await createWorkspaceCoordinator({ dataDirectory: config.dataDirectory, workspaceRoot: config.workspaceRoot }).provision({
      request: "Create exactly one bounded multi-repository Task.",
      profile: PROFILE,
      repositories: [
        { repository_key: "core", source_repository_path: config.primaryRepository, remote_name: "origin", base_branch: "main", target_branch: "feature/core-proof" },
        { repository_key: "docs", source_repository_path: config.additionalRepository, remote_name: "origin", base_branch: "main", target_branch: "feature/docs-proof" },
      ],
    });
    const consumed = await createWorkspaceCoordinator({ dataDirectory: config.dataDirectory, workspaceRoot: provisioned.workspace_root }).consume({ launchID: provisioned.launch_id });
    config.sourcePrimaryRepository = config.primaryRepository;
    config.sourceAdditionalRepository = config.additionalRepository;
    config.taskWorkspace = consumed.workspace_root;
    config.primaryRepository = consumed.open_task.repository_path;
    config.additionalRepository = consumed.open_task.additional_repositories[0].repository_path;
    config.openTask = consumed.open_task;
    await writeVerificationScript(config);
    const sessionRoot = join(config.dshHome, "sessions");

    let previousTask = null;
    let beforeAdditionalResume = null;
    for (const checkpoint of checkpoints(config)) {
      stage = checkpoint.id;
      dshStarted = true;
      const turn = await runTurn(config, checkpoint.prompt, stage);
      lastExit = turn.exit;
      const session = await readNewSession(sessionRoot, turn.beforeSessions);
      await persistRawSession(options.resultFile, checkpoint.id, session.rows);
      observedSessions.push({ id: checkpoint.id, ...session });
      const task = await assertCheckpoint(config, checkpoint, previousTask);
      previousTask = task;
      if (checkpoint.id === "implement-to-test") beforeAdditionalResume = task;
    }

    stage = "evidence-validation";
    const evidence = await buildEvidence(config, product, observedSessions, beforeAdditionalResume);
    assertSafeEvidence(evidence);
    await mkdir(dirname(options.resultFile), { recursive: true, mode: 0o700 });
    await writeFile(options.resultFile, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    process.stdout.write(JSON.stringify(evidence) + "\n");
  } catch (error) {
    if (selectedMode === "run" && root !== undefined && error?.beforeSessions !== undefined
      && !observedSessions.some((session) => session.id === stage)) {
      try {
        const session = await readNewSession(join(root, "dsh-home", "sessions"), error.beforeSessions);
        await persistRawSession(options.resultFile, stage, session.rows);
        observedSessions.push({ id: stage, ...session });
      } catch {}
    }
    if (selectedMode === "run" && !(await exists(options.resultFile))) {
      const failure = await failureEvidence(options, root, stage, dshStarted, lastExit, error, observedSessions);
      assertSafeEvidence(failure);
      await mkdir(dirname(options.resultFile), { recursive: true, mode: 0o700 });
      await writeFile(options.resultFile, JSON.stringify(failure, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    }
    throw error;
  } finally {
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  }
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new Error("missing value for " + key);
    if (key === "--dsh-executable") values.dshExecutable = value;
    else if (key === "--source-commit") values.sourceCommit = value;
    else if (key === "--result-file") values.resultFile = value;
    else if (key === "--credentials") values.credentials = value;
    else if (key === "--settings") values.settings = value;
    else if (key === "--journey-budget") values.journeyBudget = value;
    else throw new Error("unknown argument " + key);
  }
  for (const key of ["dshExecutable", "sourceCommit", "resultFile", "credentials", "settings", "journeyBudget"]) {
    if (!values[key]) throw new Error("missing DeepSeek multi-repository option " + key);
  }
  for (const key of ["dshExecutable", "resultFile", "credentials", "settings"]) {
    if (!isAbsolute(values[key])) throw new Error(key + " must be absolute");
  }
  if (!/^[0-9a-f]{40}$/u.test(values.sourceCommit)) throw new Error("sourceCommit must be a full Git SHA");
  if (!values.resultFile.endsWith(".json")) throw new Error("resultFile must end in .json");
  if (!/^\d+\/\d+$/u.test(values.journeyBudget)) throw new Error("journeyBudget must use N/N form");
  return Object.freeze(values);
}

async function validatePreflight(options) {
  assert.equal(platform(), "darwin");
  assert.equal(arch(), "arm64");
  assert.match(process.version, /^v24\./u);
  assert.match((await execFile("pnpm", ["--version"], { encoding: "utf8" })).stdout.trim(), /^11\./u);
  for (const path of [options.dshExecutable, options.credentials, options.settings]) {
    assert.equal((await stat(path)).isFile(), true, path);
  }
  assert.ok((await stat(options.dshExecutable)).mode & 0o111);
  assert.ok((await stat(options.credentials)).mode & 0o600);
  assert.equal(await exists(options.resultFile), false, "T035 evidence already exists");
  for (const id of ["create-task", "requirements-to-design", "implement-to-test", "additional-resume-to-comprehension", "accept-to-delivery", "deliver-to-done"]) {
    assert.equal(await exists(rawSessionPath(options.resultFile, id)), false, "T035 raw transcript already exists");
  }
  assert.equal((await execFile("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" })).stdout.trim(), options.sourceCommit);
  assert.equal((await execFile("git", ["status", "--short"], { cwd: repositoryRoot, encoding: "utf8" })).stdout, "");
  const dshVersion = (await execFile(options.dshExecutable, ["--version"], { encoding: "utf8" })).stdout.trim();
  assert.equal(versionAtLeast(dshVersion, "0.1.0-rc.6"), true, "DSH version is below 0.1.0-rc.6");
}

function layout(root, options) {
  return {
    ...options,
    root,
    dshHome: join(root, "dsh-home"),
    home: join(root, "home"),
    temporaryDirectory: join(root, "tmp"),
    dataDirectory: join(root, "data"),
    workspaceRoot: join(root, "workspace"),
    primaryRepository: join(root, "workspace", "core"),
    additionalRepository: join(root, "workspace", "docs"),
    primaryRemote: join(root, "core.git"),
    additionalRemote: join(root, "docs.git"),
    packageStage: join(root, "source-package"),
    artifactDirectory: join(root, "artifact"),
  };
}

async function prepareDirectories(config) {
  for (const path of [
    config.dshHome, config.home, config.temporaryDirectory, config.dataDirectory,
    config.workspaceRoot, config.packageStage, config.artifactDirectory,
  ]) await mkdir(path, { recursive: true, mode: 0o700 });
  await copyFile(config.credentials, join(config.dshHome, ".credentials.yaml"));
  await copyFile(config.settings, join(config.dshHome, "settings.yaml"));
  await chmod(join(config.dshHome, ".credentials.yaml"), 0o600);
  await chmod(join(config.dshHome, "settings.yaml"), 0o600);
}

async function buildSourcePackage(config) {
  const packageRoot = join(repositoryRoot, "packages", "deepseek");
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const paths = ["package.json", ...manifest.files].filter((value, index, values) => values.indexOf(value) === index);
  for (const relativePath of paths) {
    if (relativePath.startsWith("runtime/")) continue;
    const source = relativePath === "LICENSE" ? join(repositoryRoot, "LICENSE") : join(packageRoot, relativePath);
    const destination = join(config.packageStage, relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o755 });
    await cp(source, destination, { recursive: true });
  }
  const runtimeReport = await buildCoreRuntimes({
    repositoryRoot,
    outputRoot: join(config.packageStage, "runtime"),
  });
  const corePath = runtimeReport.runtimes["darwin-arm64"].path;
  const coreVersion = runtimeReport.coreVersion;
  assert.equal((await execFile(corePath, ["version"], { encoding: "utf8" })).stdout.trim(), "dev-flow " + coreVersion);
  const packed = JSON.parse((await execFile("npm", [
    "pack", config.packageStage, "--json", "--pack-destination", config.artifactDirectory,
  ], { cwd: repositoryRoot, encoding: "utf8", timeout: 120_000 })).stdout);
  assert.equal(packed.length, 1);
  const artifact = join(config.artifactDirectory, packed[0].filename);
  return {
    artifact,
    artifactSha256: await fileSha256(artifact),
    coreSha256: await fileSha256(corePath),
    coreVersion,
    packageVersion: manifest.version,
    dshVersion: (await execFile(config.dshExecutable, ["--version"], { encoding: "utf8" })).stdout.trim(),
  };
}

function dshEnvironment(config) {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    HOME: config.home,
    TMPDIR: config.temporaryDirectory,
    DSH_HOME: config.dshHome,
    DEV_FLOW_DATA_DIR: config.dataDirectory,
    DSH_TOOLS_MODE: "native",
    DSH_TELEMETRY_DISABLED: "1",
  };
}

async function prepareDsh(config) {
  await execFile(config.dshExecutable, ["--profile", PROFILE, "--dump-default-config"], {
    cwd: config.workspaceRoot, env: dshEnvironment(config), encoding: "utf8", timeout: 60_000,
  });
  assert.equal((await sessionFiles(join(config.dshHome, "sessions"))).length, 0);
  assert.equal(await coreTaskCount(config.dataDirectory), 0);
}

async function installAndReadBack(config, product) {
  await execFile(config.dshExecutable, ["plugin", "--profile", PROFILE, "add", product.artifact], {
    cwd: config.workspaceRoot, env: dshEnvironment(config), encoding: "utf8", timeout: 120_000,
  });
  const installedRoot = join(config.dshHome, "profiles", PROFILE, "node_modules", "dev-flow-deepseek");
  const installedCore = await realpath(join(installedRoot, "runtime", "darwin-arm64", "dev-flow"));
  assert.equal(await fileSha256(installedCore), product.coreSha256);
  assert.equal((await execFile(installedCore, ["version"], { encoding: "utf8" })).stdout.trim(), "dev-flow " + product.coreVersion);
  const installedManifest = JSON.parse(await readFile(join(installedRoot, "package.json"), "utf8"));
  assert.equal(installedManifest.version, product.packageVersion);
  assert.equal((await sessionFiles(join(config.dshHome, "sessions"))).length, 0);
  assert.equal(await coreTaskCount(config.dataDirectory), 0);
}

async function initializeWorkspace(config) {
  await mkdir(config.primaryRepository);
  await mkdir(config.additionalRepository);
  for (const [path, remote, name] of [[config.primaryRepository, config.primaryRemote, "core"], [config.additionalRepository, config.additionalRemote, "docs"]]) {
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1" };
    await execFile("git", ["init", "--bare", "--initial-branch=main", remote], { env });
    await execFile("git", ["init", "-q", "--initial-branch=main"], { cwd: path, env });
    await execFile("git", ["config", "user.email", "journey@example.invalid"], { cwd: path, env });
    await execFile("git", ["config", "user.name", "DeepSeek Journey"], { cwd: path, env });
    await writeFile(join(path, "README.md"), "# " + name + "\n");
    await execFile("git", ["add", "README.md"], { cwd: path, env });
    await execFile("git", ["commit", "-q", "-m", "initial fixture"], { cwd: path, env });
    await execFile("git", ["remote", "add", "origin", remote], { cwd: path, env });
    await execFile("git", ["push", "-u", "origin", "main"], { cwd: path, env });
  }
}

async function writeVerificationScript(config) {
  await writeFile(join(config.taskWorkspace, "verify.mjs"), [
    'import assert from "node:assert/strict";',
    'import { readFile } from "node:fs/promises";',
    'assert.equal(await readFile("core/core-proof.txt", "utf8"), "core proof\\n");',
    'assert.equal(await readFile("docs/docs-proof.txt", "utf8"), "docs proof\\n");',
    "",
  ].join("\n"));
  const rootGit = await execFile("git", ["rev-parse", "--show-toplevel"], {
    cwd: config.taskWorkspace, encoding: "utf8",
  }).then(() => true, () => false);
  assert.equal(rootGit, false, "Workspace Root must not be a Git repository");
}

function checkpoints(config) {
  const createInput = "Use this consumed provisioning descriptor exactly for repository_path, primary_repository_key, workspace_origin, and additional_repositories: "
    + JSON.stringify(config.openTask) + ".";
  const primaryResume = "Resume the existing host=deepseek Task with repository_path="
    + JSON.stringify(config.primaryRepository) + ", new_task=null, and no Scope creation fields.";
  const additionalResume = "Resume the existing host=deepseek Task from the additional repository with repository_path="
    + JSON.stringify(config.additionalRepository) + ", new_task=null, and no Scope creation fields.";
  return [
    checkpoint("create-task", "REQUIREMENTS", [
      "/dev-flow Create exactly one bounded multi-repository Task.",
      createInput,
      "Use method_profile=plain and verification_budget level=targeted, max_automatic_commands=1, allow_full_suite=false, allow_manual_handoff=true.",
      "The complete task is to create core::core-proof.txt with exact UTF-8 bytes core proof followed by one newline and docs::docs-proof.txt with exact UTF-8 bytes docs proof followed by one newline.",
      "Use those two scoped paths as the complete expected path set.",
      "Stop immediately after Core creates the Task at REQUIREMENTS. Do not apply the current Action or edit files.",
    ]),
    checkpoint("requirements-to-design", "DESIGN", [
      "/dev-flow Complete only the REQUIREMENTS action for the active bounded multi-repository Task.", primaryResume,
      "Perform the server-info handshake and fresh Task and Action reads.", APPLY_RULES,
      "Use both scoped paths, no unresolved questions, and the exact closed REQUIREMENTS node_result shape stated above.",
      "Stop immediately when Core reports DESIGN. Do not edit files or advance DESIGN.",
    ]),
    checkpoint("implement-to-test", "TEST", [
      "/dev-flow Continue the active bounded multi-repository Task from fresh Core authority.", primaryResume,
      "Perform the server-info handshake, then read the Task and current Action.",
      "Complete DESIGN and TASKS using both scoped paths. At IMPLEMENT create only core/core-proof.txt and docs/docs-proof.txt with their requested exact bytes.",
      "Use core::core-proof.txt and docs::docs-proof.txt as the multi-repository expected_paths set.", APPLY_RULES,
      "Submit implementation_ready_for_test and stop immediately when Core reports TEST. Do not run any verification command.",
    ]),
    checkpoint("additional-resume-to-comprehension", "COMPREHENSION_REVIEW", [
      "/dev-flow Resume the post-mutation Task from its additional repository and perform the targeted test.", additionalResume,
      "After open succeeds call get_task and get_next_action before any apply, preserving the returned Task identity, revision, Action, digest, primary repository, and ordered Scope.",
      "Run exactly one verification command: node verify.mjs.", APPLY_RULES,
      "Submit tests_passed and stop immediately when Core reports COMPREHENSION_REVIEW. Ask for the user's explicit verdict and do not self-confirm it.",
      "Do not modify files or create another Task.",
    ]),
    checkpoint("accept-to-delivery", "DELIVERY", [
      "/dev-flow I explicitly confirm that I can explain and maintain this bounded two-file implementation and its verification path.",
      additionalResume,
      "Perform the server-info handshake and fresh Task and Action reads.", APPLY_RULES,
      "Submit comprehension_passed using my explicit verdict and stop immediately when Core reports DELIVERY.",
      "Do not modify files, run commands, or create another Task.",
    ]),
    checkpoint("deliver-to-done", "DONE", [
      "/dev-flow Complete only the DELIVERY action for the active bounded multi-repository Task.", additionalResume,
      "Perform the server-info handshake and fresh Task and Action reads.", APPLY_RULES,
      "Use only the current submission_tool contract, submit delivery_complete, confirm Core reports DONE with outcome completed, and stop.",
      "Do not modify files, run commands, or create another Task.",
    ]),
  ];
}

function checkpoint(id, toNode, promptParts) {
  return Object.freeze({ id, toNode, prompt: promptParts.join(" ") });
}

async function runTurn(config, prompt, stage) {
  const sessionRoot = join(config.dshHome, "sessions");
  const beforeSessions = new Set(await sessionFiles(sessionRoot));
  const child = spawn(config.dshExecutable, ["--profile", PROFILE, prompt], {
    cwd: config.taskWorkspace ?? config.workspaceRoot,
    env: dshEnvironment(config),
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = collect(child.stdout);
  const stderr = collect(child.stderr);
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stdout: stdout(), stderr: stderr() }));
  });
  let exit;
  try {
    exit = await withTimeout(completion, TURN_TIMEOUT_MS, Object.assign(new Error("DSH_STAGE_TIMEOUT:" + stage), { code: "DSH_STAGE_TIMEOUT" }));
  } catch (error) {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    await Promise.race([completion, delay(2_000)]);
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
      await completion;
    }
    error.beforeSessions = beforeSessions;
    error.exit = await completion;
    throw error;
  }
  if (exit.code !== 0) {
    const error = new Error("DSH_HEADLESS_FAILED:" + stage + ":" + exit.stderr.slice(0, 500));
    error.code = "DSH_HEADLESS_FAILED";
    error.exit = exit;
    throw error;
  }
  return { beforeSessions, exit };
}

function collect(stream) {
  const chunks = [];
  let size = 0;
  stream.on("data", (chunk) => {
    size += chunk.length;
    if (size <= 1_048_576) chunks.push(chunk);
  });
  return () => Buffer.concat(chunks).toString("utf8");
}

async function readNewSession(root, before) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = await sessionFiles(root);
    const added = files.filter((path) => !before.has(path));
    if (added.length === 1) return { path: added[0], rows: await readSession(added[0]) };
    if (added.length > 1) throw new Error("unexpected DSH session count " + added.length);
    await delay(20);
  }
  throw new Error("DSH session artifact was not materialized");
}

async function persistRawSession(resultFile, stageId, rows) {
  const path = rawSessionPath(resultFile, stageId);
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  await chmod(path, 0o600);
}

function rawSessionPath(resultFile, stageId) {
  return resultFile.replace(/\.json$/u, "." + stageId + ".raw.jsonl");
}

async function assertCheckpoint(config, checkpointDefinition, previousTask) {
  assert.equal(await coreTaskCount(config.dataDirectory), 1, checkpointDefinition.id + " must retain one Core Task");
  const task = await currentTask(config.dataDirectory);
  assert.equal(task.origin_host, "deepseek");
  assert.equal(task.current_node, checkpointDefinition.toNode, checkpointDefinition.id + " did not reach " + checkpointDefinition.toNode);
  if (previousTask !== null) {
    assert.equal(task.task_id, previousTask.task_id, checkpointDefinition.id + " changed Task identity");
    assert.ok(task.revision > previousTask.revision, checkpointDefinition.id + " did not advance revision");
  }
  if (checkpointDefinition.toNode === "DONE") assert.equal(task.outcome?.status, "completed");
  return task;
}

async function sessionFiles(root) {
  if (!await exists(root)) return [];
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === "session.jsonl" || entry.name === "session.jsonl.zstd") files.push(path);
    }
  }
  await walk(root);
  return files.sort();
}

async function readSession(path) {
  const bytes = await readFile(path);
  const text = path.endsWith(".zstd") ? decompressZstdFrames(bytes) : bytes.toString("utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function decompressZstdFrames(bytes) {
  const plaintext = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    if (bytes.length - offset < 5 || bytes.readUInt32LE(offset) !== 0xFD2FB528) break;
    offset += 4;
    const descriptor = bytes.readUInt8(offset);
    offset += 1;
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 0x20) !== 0;
    const checksum = (descriptor & 0x04) !== 0;
    const dictionaryFlag = descriptor & 0x03;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const headerBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (bytes.length - offset < headerBytes) break;
    offset += headerBytes;
    let complete = false;
    while (bytes.length - offset >= 3) {
      const blockHeader = bytes.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 0x03;
      const blockSize = blockHeader >>> 3;
      if (blockType === 0x03) throw new Error("corrupt Zstandard session frame");
      const payloadBytes = blockType === 0x01 ? 1 : blockSize;
      if (bytes.length - offset < payloadBytes) break;
      offset += payloadBytes;
      if (lastBlock) { complete = true; break; }
    }
    if (!complete || (checksum && bytes.length - offset < 4)) break;
    if (checksum) offset += 4;
    plaintext.push(zstdDecompressSync(bytes.subarray(start, offset)));
  }
  return Buffer.concat(plaintext).toString("utf8");
}

function callsFromSession(session) {
  const events = session.rows.filter((row) => !["session", "text-chunks", "reasoning-chunks", "tool-call-chunks"].includes(row.type));
  return events.filter((event) => event.type === "tool/call").map((event) => {
    const call = event.data;
    let argumentsValue = {};
    try { argumentsValue = JSON.parse(call.arguments); } catch {}
    return {
      name: call.name,
      arguments: argumentsValue,
      envelope: toolResultEnvelope(events, call.callId),
    };
  });
}

function toolResultEnvelope(events, callId) {
  const event = events.find((row) => row.type === "tool/result" && row.data?.message?.content?.[0]?.toolCallId === callId);
  const blocks = event?.data?.message?.content?.[0]?.content ?? [];
  const text = blocks.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  const start = text.indexOf("{");
  if (start < 0) return null;
  try { return JSON.parse(text.slice(start)); } catch { return null; }
}

async function buildEvidence(config, product, sessions, beforeAdditionalResume) {
  assert.equal(sessions.length, 6);
  assert.notEqual(beforeAdditionalResume, null);
  const callSets = new Map(sessions.map((session) => [session.id, callsFromSession(session)]));
  for (const [stageId, calls] of callSets) {
    const devFlowCalls = calls.filter((call) => call.name.startsWith("mcp__dev_flow__"));
    const serverInfo = devFlowCalls[0];
    assert.equal(serverInfo?.name, "mcp__dev_flow__dev_flow_server_info", stageId + " must start Dev Flow with server-info");
    assert.equal(serverInfo?.envelope?.ok, true);
    assert.equal(serverInfo?.envelope?.result?.tools?.length, 17);
  }
  const createCalls = callSets.get("create-task");
  const create = createCalls.find((call) => call.name === "mcp__dev_flow__dev_flow_open_task");
  const resumeCalls = callSets.get("additional-resume-to-comprehension");
  const resume = resumeCalls.find((call) => call.name === "mcp__dev_flow__dev_flow_open_task");
  assert.notEqual(create, undefined);
  assert.notEqual(resume, undefined);
  assert.equal(create.arguments.host, "deepseek");
  assert.equal(create.arguments.repository_path, config.primaryRepository);
  assert.equal(create.arguments.primary_repository_key, "core");
  assert.deepEqual(create.arguments.workspace_origin, config.openTask.workspace_origin);
  assert.deepEqual(create.arguments.additional_repositories, config.openTask.additional_repositories);
  assert.equal(resume.arguments.host, "deepseek");
  assert.equal(resume.arguments.repository_path, config.additionalRepository);
  assert.equal("primary_repository_key" in resume.arguments, false);
  assert.equal("additional_repositories" in resume.arguments, false);
  const successfulApplies = [...callSets.values()].flatMap((calls) => calls.filter((call) =>
    call.name.startsWith("mcp__dev_flow__dev_flow_submit_") && call.envelope?.ok === true
  ));
  assert.ok(successfulApplies.length >= 7);
  const before = beforeAdditionalResume;
  const resumed = resume.envelope?.result?.task;
  assert.notEqual(resumed, undefined);
  assert.equal(before.task_id, resumed.task_id);
  assert.equal(before.revision, resumed.revision);
  assert.equal(before.current_action?.action_id, resumed.current_action?.action_id);
  assert.equal(before.current_action?.repository_binding_digest, resumed.current_action?.repository_binding_digest);
  assert.equal(resumed.primary_repository_key, "core");
  assert.deepEqual(resumed.additional_repositories.map((entry) => entry.key), ["docs"]);
  const finalTask = await currentTask(config.dataDirectory);
  assert.equal(await coreTaskCount(config.dataDirectory), 1);
  assert.equal(finalTask.task_id, resumed.task_id);
  assert.equal(finalTask.origin_host, "deepseek");
  assert.equal(finalTask.current_node, "DONE");
  assert.equal(finalTask.workspace_origin.mode, "dedicated_worktree");
  assert.equal(finalTask.workspace_origin.canonical_worktree_root, config.primaryRepository);
  assert.equal(finalTask.outcome?.status, "completed");
  assert.equal(finalTask.current_action, null);
  assert.equal(await readFile(join(config.primaryRepository, "core-proof.txt"), "utf8"), "core proof\n");
  assert.equal(await readFile(join(config.additionalRepository, "docs-proof.txt"), "utf8"), "docs proof\n");
  const bashCommands = sessions.flatMap((session) => {
    const events = session.rows.filter((row) => row.type === "tool/call" && row.data?.name === "bash");
    return events.map((event) => {
      try { return JSON.parse(event.data.arguments).command?.trim(); } catch { return null; }
    }).filter(Boolean);
  });
  assert.equal(bashCommands.filter((command) => command === "node verify.mjs").length, 1);
  return {
    evidence_kind: EVIDENCE_KIND,
    status: "passed",
    source_commit: config.sourceCommit,
    host: "deepseek",
    runner_mode: "multi-repository",
    journey_budget: config.journeyBudget,
    dsh_version: product.dshVersion,
    setup_readback_passed: true,
    workspace_root_non_git: true,
    dsh_session_count: 6,
    task_id: finalTask.task_id,
    primary_repository_key: "core",
    additional_repository_keys: ["docs"],
    repository_count: 2,
    revision_before_resume: before.revision,
    revision_after_resume: resumed.revision,
    action_id_before_resume: before.current_action.action_id,
    action_id_after_resume: resumed.current_action.action_id,
    repository_binding_digest_before_resume: before.current_action.repository_binding_digest,
    repository_binding_digest_after_resume: resumed.current_action.repository_binding_digest,
    resumed_from_additional_repository: true,
    one_core_task: true,
    terminal_state: "DONE",
    terminal_revision: finalTask.revision,
    scoped_paths: ["core::core-proof.txt", "docs::docs-proof.txt"],
    successful_action_count: successfulApplies.length,
    verification_command_count: 1,
    tool_catalog_size: 17,
    codebase_memory_preference: callSets.get("create-task")
      .find((call) => call.name === "mcp__dev_flow__dev_flow_server_info")
      .envelope.result.host_preferences.deepseek.codebase_memory,
    observed_at: new Date().toISOString(),
  };
}

async function currentTask(dataDirectory) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(join(dataDirectory, "dev-flow.db"), { readOnly: true });
  const row = db.prepare("SELECT task_id,origin_host,current_node,revision,snapshot FROM tasks ORDER BY updated_at DESC LIMIT 1").get();
  db.close();
  assert.notEqual(row, undefined, "Core Task is absent");
  return { ...JSON.parse(Buffer.from(row.snapshot).toString("utf8")), task_id: row.task_id, origin_host: row.origin_host, current_node: row.current_node, revision: row.revision };
}

async function coreTaskCount(dataDirectory) {
  const path = join(dataDirectory, "dev-flow.db");
  if (!await exists(path)) return 0;
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path, { readOnly: true });
  const count = Number(db.prepare("SELECT COUNT(*) AS count FROM tasks").get().count);
  db.close();
  return count;
}

async function failureEvidence(options, root, stage, dshStarted, exit, error, observedSessions) {
  let finalTask = null;
  if (root !== undefined) {
    try {
      const task = await currentTask(join(root, "data"));
      finalTask = { task_id: task.task_id, current_node: task.current_node, revision: task.revision, origin_host: task.origin_host };
    } catch {}
  }
  return {
    evidence_kind: EVIDENCE_KIND,
    status: "failed",
    source_commit: options.sourceCommit,
    host: "deepseek",
    runner_mode: "multi-repository",
    journey_budget: options.journeyBudget,
    failure_stage: stage,
    failure_classification: error?.code ?? (error instanceof assert.AssertionError ? "acceptance_assertion" : "runner_error"),
    dsh_started: dshStarted,
    exit_code: exit?.code ?? error?.exit?.code ?? null,
    stdout_sha256: sha256(exit?.stdout ?? error?.exit?.stdout ?? ""),
    stderr_sha256: sha256(exit?.stderr ?? error?.exit?.stderr ?? ""),
    raw_transcript_stages: observedSessions.map((session) => session.id),
    final_task: finalTask,
    observed_at: new Date().toISOString(),
  };
}

function assertSafeEvidence(evidence) {
  const text = JSON.stringify(evidence);
  for (const forbidden of [repositoryRoot, homedir(), "/private/", "DEEPSEEK_API_KEY", "BEGIN PRIVATE KEY"]) {
    assert.equal(text.includes(forbidden), false, "evidence contains private data");
  }
}

function selfTest() {
  assert.equal(versionAtLeast("0.1.1-rc.2", "0.1.0-rc.6"), true);
  assert.equal(versionAtLeast("0.1.0-rc.5", "0.1.0-rc.6"), false);
  assert.match(APPLY_RULES, /problem_class=none and findings=\[\]/u);
  assert.match(APPLY_RULES, /reason_required=false/u);
  assert.match(APPLY_RULES, /unresolved_questions is a sibling of baseline/u);
  assert.match(APPLY_RULES, /If any apply returns an error, stop immediately/u);
  const parsed = parseArguments([
    "--dsh-executable", "/opt/dsh",
    "--source-commit", "a".repeat(40),
    "--result-file", "/tmp/evidence.json",
    "--credentials", "/tmp/credentials",
    "--settings", "/tmp/settings",
    "--journey-budget", "2/2",
  ]);
  assert.equal(parsed.sourceCommit, "a".repeat(40));
  assert.equal(parsed.journeyBudget, "2/2");
  const definitions = checkpoints({ primaryRepository: "/tmp/core", additionalRepository: "/tmp/docs", openTask: { repository_path: "/tmp/core", primary_repository_key: "core", workspace_origin: {}, additional_repositories: [] } });
  assert.deepEqual(definitions.map((item) => item.toNode), ["REQUIREMENTS", "DESIGN", "TEST", "COMPREHENSION_REVIEW", "DELIVERY", "DONE"]);
  assert.match(definitions[1].prompt, /exact closed REQUIREMENTS node_result shape/u);
  assert.match(definitions[3].prompt, /additional repository/u);
  assert.match(definitions[4].prompt, /explicitly confirm/u);
  assert.match(definitions[5].prompt, /delivery_complete/u);
  assert.throws(() => assertSafeEvidence({ path: "/private/secret" }));
}

function versionAtLeast(actual, minimum) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/u.exec(value);
    if (!match) throw new Error("invalid DSH version " + value);
    return match.slice(1).map((item, index) => index === 3 && item === undefined ? Number.MAX_SAFE_INTEGER : Number(item));
  };
  const left = parse(actual);
  const right = parse(minimum);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

async function fileSha256(path) { return sha256(await readFile(path)); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function withTimeout(promise, ms, error) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(error), ms))]);
}
