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

const execFile = promisify(execFileCallback);
const runnerPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(dirname(dirname(runnerPath))));
const EVIDENCE_KIND = "feature-001-multi-repository-deepseek-journey";
const PROFILE = "headless";
const TURN_TIMEOUT_MS = 300_000;
const APPLY_RULES = [
  "Before every apply, bind the latest complete Core Action and its current input schema.",
  "Use exactly the returned transition_id, current revision, action identity, process identity, and repository binding digest.",
  "The payload top level must contain exactly transition_id, summary, reason, artifacts, method_evidence, and node_result.",
  "Use artifacts=[] and one plain_fallback MethodEvidence item with capability empty for every current method step in Action order.",
  "For a forward ready, passed, or completed transition use problem_class=none and findings=[].",
  "Use a non-none problem_class and nonempty findings only for the exact corrective transition whose condition they establish.",
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
  throw new Error("usage: multi-repository-runner.mjs self-test|preflight|run --dsh-executable ABS --source-commit SHA --result-file ABS.json --credentials ABS --settings ABS");
}

async function execute(selectedMode, options) {
  let root;
  let stage = "preflight";
  let dshStarted = false;
  let lastExit = null;
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
    const sessionRoot = join(config.dshHome, "sessions");

    stage = "substantive-session";
    dshStarted = true;
    const first = await runTurn(config, substantivePrompt(config), stage);
    lastExit = first.exit;
    const firstSession = await readNewSession(sessionRoot, first.beforeSessions);

    stage = "resume-session";
    const second = await runTurn(config, resumePrompt(config), stage);
    lastExit = second.exit;
    const secondSession = await readNewSession(sessionRoot, second.beforeSessions);

    stage = "evidence-validation";
    const evidence = await buildEvidence(config, product, [firstSession, secondSession]);
    assertSafeEvidence(evidence);
    await writeFile(options.resultFile, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    process.stdout.write(JSON.stringify(evidence) + "\n");
  } catch (error) {
    if (selectedMode === "run" && !(await exists(options.resultFile))) {
      const failure = await failureEvidence(options, root, stage, dshStarted, lastExit, error);
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
    else throw new Error("unknown argument " + key);
  }
  for (const key of ["dshExecutable", "sourceCommit", "resultFile", "credentials", "settings"]) {
    if (!values[key]) throw new Error("missing DeepSeek multi-repository option " + key);
  }
  for (const key of ["dshExecutable", "resultFile", "credentials", "settings"]) {
    if (!isAbsolute(values[key])) throw new Error(key + " must be absolute");
  }
  if (!/^[0-9a-f]{40}$/u.test(values.sourceCommit)) throw new Error("sourceCommit must be a full Git SHA");
  if (!values.resultFile.endsWith(".json")) throw new Error("resultFile must end in .json");
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
    if (relativePath === "runtime/darwin-arm64/dev-flow") continue;
    const source = relativePath === "LICENSE" ? join(repositoryRoot, "LICENSE") : join(packageRoot, relativePath);
    const destination = join(config.packageStage, relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o755 });
    await cp(source, destination, { recursive: true });
  }
  const corePath = join(config.packageStage, "runtime", "darwin-arm64", "dev-flow");
  await mkdir(dirname(corePath), { recursive: true, mode: 0o755 });
  const coreVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();
  await execFile("go", [
    "build", "-mod=readonly", "-trimpath", "-buildvcs=false",
    "-ldflags", "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=" + coreVersion,
    "-o", corePath, "./cmd/dev-flow",
  ], {
    cwd: repositoryRoot,
    env: { ...process.env, CGO_ENABLED: "0", GOOS: "darwin", GOARCH: "arm64" },
    timeout: 120_000,
  });
  await chmod(corePath, 0o755);
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
  for (const [path, name] of [[config.primaryRepository, "core"], [config.additionalRepository, "docs"]]) {
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1" };
    await execFile("git", ["init", "-q"], { cwd: path, env });
    await execFile("git", ["config", "user.email", "journey@example.invalid"], { cwd: path, env });
    await execFile("git", ["config", "user.name", "DeepSeek Journey"], { cwd: path, env });
    await writeFile(join(path, "README.md"), "# " + name + "\n");
    await execFile("git", ["add", "README.md"], { cwd: path, env });
    await execFile("git", ["commit", "-q", "-m", "initial fixture"], { cwd: path, env });
  }
  await writeFile(join(config.workspaceRoot, "verify.mjs"), [
    'import assert from "node:assert/strict";',
    'import { readFile } from "node:fs/promises";',
    'assert.equal(await readFile("core/core-proof.txt", "utf8"), "core proof\\n");',
    'assert.equal(await readFile("docs/docs-proof.txt", "utf8"), "docs proof\\n");',
    "",
  ].join("\n"));
  const rootGit = await execFile("git", ["rev-parse", "--show-toplevel"], {
    cwd: config.workspaceRoot, encoding: "utf8",
  }).then(() => true, () => false);
  assert.equal(rootGit, false, "Workspace Root must not be a Git repository");
}

function substantivePrompt(config) {
  return [
    "/dev-flow", APPLY_RULES,
    "Create exactly one host=deepseek Task.",
    "Use repository_path=" + JSON.stringify(config.primaryRepository) + ", primary_repository_key=core, and additional_repositories=[{\"key\":\"docs\",\"repository_path\":" + JSON.stringify(config.additionalRepository) + "}].",
    "Use method_profile=plain and verification_budget level=targeted, max_automatic_commands=1, allow_full_suite=false, allow_manual_handoff=true.",
    "The task is to create core::core-proof.txt with exact UTF-8 bytes core proof followed by one newline and docs::docs-proof.txt with exact UTF-8 bytes docs proof followed by one newline.",
    "Use those two scoped paths in every multi-repository expected_paths and changed_paths field.",
    "Advance through REQUIREMENTS, DESIGN, and TASKS from complete returned Actions.",
    "At IMPLEMENT create only those two files, submit implementation_ready_for_test with problem_class=none and findings=[], then stop while the Task remains at TEST.",
    "Do not run a verification command, resume the Task, or create another Task in this session.",
  ].join(" ");
}

function resumePrompt(config) {
  return [
    "/dev-flow", APPLY_RULES,
    "I explicitly confirm that I can explain and maintain this bounded two-file implementation and its verification path.",
    "Resume the existing host=deepseek Task by calling open_task with repository_path=" + JSON.stringify(config.additionalRepository) + ", new_task=null, and no Scope creation fields.",
    "After open succeeds call get_task and get_next_action before any apply, and preserve the returned Task, revision, Action, digest, primary repository, and ordered Scope.",
    "Run exactly one verification command at TEST: node verify.mjs.",
    "Submit tests_passed, use my explicit confirmation for comprehension_passed, then complete DELIVERY using only IDs read from the current Task.",
    "Stop only when Core reports DONE with outcome completed. Do not modify files or create another Task.",
  ].join(" ");
}

async function runTurn(config, prompt, stage) {
  const sessionRoot = join(config.dshHome, "sessions");
  const beforeSessions = new Set(await sessionFiles(sessionRoot));
  const child = spawn(config.dshExecutable, ["--profile", PROFILE, prompt], {
    cwd: config.workspaceRoot,
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

async function buildEvidence(config, product, sessions) {
  assert.equal(sessions.length, 2);
  const callSets = sessions.map(callsFromSession);
  for (const calls of callSets) {
    assert.equal(calls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
    assert.equal(calls[0]?.envelope?.ok, true);
    assert.equal(calls[0]?.envelope?.result?.tools?.length, 6);
  }
  const opens = callSets.flatMap((calls) => calls.filter((call) => call.name === "mcp__dev_flow__dev_flow_open_task"));
  assert.equal(opens.length, 2);
  const create = opens.find((call) => call.arguments.new_task !== null && call.arguments.new_task !== undefined);
  const resume = opens.find((call) => call.arguments.new_task === null || call.arguments.new_task === undefined);
  assert.notEqual(create, undefined);
  assert.notEqual(resume, undefined);
  assert.equal(create.arguments.host, "deepseek");
  assert.equal(create.arguments.repository_path, config.primaryRepository);
  assert.equal(create.arguments.primary_repository_key, "core");
  assert.deepEqual(create.arguments.additional_repositories, [{ key: "docs", repository_path: config.additionalRepository }]);
  assert.equal(resume.arguments.host, "deepseek");
  assert.equal(resume.arguments.repository_path, config.additionalRepository);
  assert.equal("primary_repository_key" in resume.arguments, false);
  assert.equal("additional_repositories" in resume.arguments, false);
  const successfulApplies = callSets.flatMap((calls) => calls.filter((call) =>
    call.name === "mcp__dev_flow__dev_flow_apply_action" && call.envelope?.ok === true
  ));
  assert.ok(successfulApplies.length >= 4);
  const before = successfulApplies.filter((call) => callSets[0].includes(call)).at(-1)?.envelope?.result;
  const resumed = resume.envelope?.result?.task;
  assert.notEqual(before, undefined);
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
    journey_budget: "1/1",
    dsh_version: product.dshVersion,
    setup_readback_passed: true,
    workspace_root_non_git: true,
    dsh_session_count: 2,
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
    tool_catalog_size: 6,
    codebase_memory_preference: callSets[0][0].envelope.result.host_preferences.deepseek.codebase_memory,
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

async function failureEvidence(options, root, stage, dshStarted, exit, error) {
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
    journey_budget: "1/1",
    failure_stage: stage,
    failure_classification: error?.code ?? (error instanceof assert.AssertionError ? "acceptance_assertion" : "runner_error"),
    dsh_started: dshStarted,
    exit_code: exit?.code ?? error?.exit?.code ?? null,
    stdout_sha256: sha256(exit?.stdout ?? error?.exit?.stdout ?? ""),
    stderr_sha256: sha256(exit?.stderr ?? error?.exit?.stderr ?? ""),
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
  assert.match(APPLY_RULES, /If any apply returns an error, stop immediately/u);
  const parsed = parseArguments([
    "--dsh-executable", "/opt/dsh",
    "--source-commit", "a".repeat(40),
    "--result-file", "/tmp/evidence.json",
    "--credentials", "/tmp/credentials",
    "--settings", "/tmp/settings",
  ]);
  assert.equal(parsed.sourceCommit, "a".repeat(40));
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
