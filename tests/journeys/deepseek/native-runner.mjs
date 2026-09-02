import assert from "node:assert/strict";
import { spawn, execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile,
} from "node:fs/promises";
import { arch, homedir, platform, tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { zstdDecompressSync } from "node:zlib";

const execFile = promisify(execFileCallback);
const runnerPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(dirname(dirname(runnerPath))));
const evidenceDirectory = join(repositoryRoot, "tests", "journeys", "deepseek", "evidence");
const successEvidencePath = join(evidenceDirectory, "native-acceptance.json");
const failureEvidencePath = join(evidenceDirectory, "native-acceptance-failed.json");
const currentCoreVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();
const currentPackageVersion = JSON.parse(await readFile(join(repositoryRoot, "packages", "deepseek", "package.json"), "utf8")).version;
const exactTestCommand = "node --test test/proof-writer.test.mjs";
const TURN_TIMEOUT_MS = 300_000;
const dshIntegrity = "sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==";
const productSourcePaths = Object.freeze([
  "LICENSE",
  "packages/deepseek/package.json",
  "packages/deepseek/README.md",
  "packages/deepseek/cordis.patch.yml",
  "packages/deepseek/lib",
  "packages/deepseek/skills",
  "packages/deepseek/runtime",
]);
const activeTurns = new Set();
let activeStage = "not-started";
let activeConfig;

const nativeCheckpoints = Object.freeze([
  checkpoint("recovery-read", "DESIGN", "DESIGN", true, [
    "/dev-flow Resume the active task after the interrupted Host process for read-only recovery observation.",
    "After the server-info handshake and task discovery, call get_task and then get_next_action.",
    "Do not edit files, apply an action, cancel, or advance the graph. Stop after reporting the current DESIGN action.",
  ]),
  checkpoint("work-to-comprehension", "DESIGN", "COMPREHENSION_REVIEW", false, [
    "/dev-flow Resume the active task from fresh Core authority.",
    "Complete the bounded design, task planning, implementation, and targeted test for the single requested source file.",
    "Create only src/proof-writer.mjs exporting writeProof() that returns exactly deepseek-native-proof.",
    `Run only: ${exactTestCommand}`,
    "Follow legal Core actions until COMPREHENSION_REVIEW.",
    "At COMPREHENSION_REVIEW, explain the result, ask for the developer's explicit verdict, and stop.",
    "Do not self-confirm the comprehension verdict.",
    "Do not modify package.json, README.md, or test files.",
  ]),
  checkpoint("accept-and-deliver", "COMPREHENSION_REVIEW", "DONE", false, [
    "/dev-flow I explicitly confirm that I can explain and maintain the implementation, guard boundary, and targeted test.",
    "Use the fresh current action, complete delivery, follow only legal Core transitions, confirm Core DONE, then stop.",
    "At DELIVERY, call the current Action submission_tool with exactly host, task_id, action_id, transition_id, summary, reason, artifacts, method_results, and node_result.",
    "Do not send payload, method_evidence, revision, Action kind, process identity, source cursor, repository binding, acceptance, evidence IDs, or record IDs; Core fills those members.",
  ]),
]);

const mode = process.argv[2];
if (!new Set(["self-test", "preflight", "run"]).has(mode)) {
  throw new Error("usage: native-runner.mjs self-test|preflight|run");
}

if (mode === "self-test") {
  await selfTest();
  process.stdout.write("native-runner self-test passed\n");
} else if (mode === "preflight") {
  const config = loadConfig();
  const result = await preflight(config);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  const baseConfig = loadConfig();
  try {
    const evidence = await runNative(baseConfig);
    await validateEvidence(evidence);
    await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
    await writeFile(successEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ status: "passed", task_id: evidence.task.task_id, revision: evidence.task.terminal_revision })}\n`);
  } catch (error) {
    const processCleanup = await terminateActiveTurns();
    const failure = await sanitizedFailure(error, activeConfig ?? baseConfig, processCleanup);
    await validateFailureEvidence(failure);
    await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
    await writeFile(failureEvidencePath, `${JSON.stringify(failure, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    throw error;
  }
}

function checkpoint(id, fromNode, toNode, readOnly, promptParts) {
  return Object.freeze({
    id,
    fromNode,
    toNode,
    readOnly,
    prompt: promptParts.join(" "),
  });
}

function loadConfig() {
  const required = [
    "DEV_FLOW_DSH_CLI", "DEV_FLOW_NATIVE_ARTIFACT", "DEV_FLOW_NATIVE_ROOT",
    "DEV_FLOW_DSH_CREDENTIALS", "DEV_FLOW_DSH_SETTINGS", "DEV_FLOW_DSH_LOCKFILE",
    "DEV_FLOW_PRODUCT_SOURCE_COMMIT", "DEV_FLOW_ACCEPTANCE_COMMIT",
    "DEV_FLOW_NATIVE_ARTIFACT_SHA256", "DEV_FLOW_NATIVE_CORE_SHA256",
  ];
  for (const name of required) {
    if (!process.env[name]) throw new Error(`missing ${name}`);
  }
  return {
    dshCli: process.env.DEV_FLOW_DSH_CLI,
    artifact: process.env.DEV_FLOW_NATIVE_ARTIFACT,
    root: process.env.DEV_FLOW_NATIVE_ROOT,
    credentials: process.env.DEV_FLOW_DSH_CREDENTIALS,
    settings: process.env.DEV_FLOW_DSH_SETTINGS,
    dshLockfile: process.env.DEV_FLOW_DSH_LOCKFILE,
    productSourceCommit: process.env.DEV_FLOW_PRODUCT_SOURCE_COMMIT,
    acceptanceCommit: process.env.DEV_FLOW_ACCEPTANCE_COMMIT,
    artifactSha256: process.env.DEV_FLOW_NATIVE_ARTIFACT_SHA256,
    coreSha256: process.env.DEV_FLOW_NATIVE_CORE_SHA256,
    preflightMarker: join(process.env.DEV_FLOW_NATIVE_ROOT, "preflight.json"),
    profile: "headless",
  };
}

function withRunRoot(config, root) {
  return {
    ...config,
    root,
    dshHome: join(root, "dsh-home"),
    isolatedHome: join(root, "home"),
    temporaryDirectory: join(root, "tmp"),
    data: join(root, "data"),
    workspace: join(root, "workspace"),
    readback: join(root, "artifact-readback"),
  };
}

async function preflight(baseConfig) {
  assert.equal(platform(), "darwin");
  assert.equal(arch(), "arm64");
  assert.match(process.version, /^v24\./u);
  assert.match((await execFile("pnpm", ["--version"])).stdout.trim(), /^11\./u);
  assert.equal(await exists(successEvidencePath), false, "native success evidence already exists");
  assert.equal(await exists(failureEvidencePath), false, "native failure evidence already exists");

  const rootParent = await realpath(baseConfig.root);
  assert.equal(rootParent, baseConfig.root, "native root must be canonical");
  const config = withRunRoot(baseConfig, await mkdtemp(join(rootParent, "native-")));
  activeConfig = config;
  await assertOwnedPathsAbsent(config);
  await assertFile(config.dshCli);
  await assertPrivateFile(config.credentials);
  await assertFile(config.settings);
  await assertFile(config.dshLockfile);
  assert.match(config.productSourceCommit, /^[0-9a-f]{40}$/u);
  assert.match(config.acceptanceCommit, /^[0-9a-f]{40}$/u);
  assert.match(config.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.match(config.coreSha256, /^[0-9a-f]{64}$/u);
  assert.equal(basename(config.artifact), `dev-flow-deepseek-${currentPackageVersion}.tgz`);
  const artifact = await fileIdentity(await realpath(config.artifact));
  assert.equal(artifact.sha256, config.artifactSha256);
  const dsh = await validateDshConsumer(config);
  await execFile("git", ["cat-file", "-e", `${config.productSourceCommit}^{commit}`], { cwd: repositoryRoot });
  await execFile("git", ["cat-file", "-e", `${config.acceptanceCommit}^{commit}`], { cwd: repositoryRoot });
  assert.equal((await execFile("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot })).stdout.trim(), config.acceptanceCommit);
  assert.equal((await execFile("git", ["status", "--short"], { cwd: repositoryRoot })).stdout, "");
  await execFile("git", ["diff", "--quiet", config.productSourceCommit, config.acceptanceCommit, "--", ...productSourcePaths], { cwd: repositoryRoot });
  await mkdir(config.dshHome, { mode: 0o700 });
  await mkdir(config.isolatedHome, { mode: 0o700 });
  await mkdir(config.temporaryDirectory, { mode: 0o700 });
  await mkdir(config.data, { mode: 0o700 });
  await mkdir(config.workspace);
  await mkdir(config.readback);
  await copyFile(config.credentials, join(config.dshHome, ".credentials.yaml"));
  await copyFile(config.settings, join(config.dshHome, "settings.yaml"));
  await chmod(join(config.dshHome, ".credentials.yaml"), 0o600);
  await chmod(join(config.dshHome, "settings.yaml"), 0o600);
  await initializeWorkspace(config.workspace);

  await runIsolatedDsh(config, ["--profile", config.profile, "--dump-default-config"], {
    cwd: config.workspace, timeout: 30_000,
  });
  const profileBundles = await readProfileBundles(config);
  const help = await runIsolatedDsh(config, ["--profile", config.profile, "--help"], {
    cwd: config.workspace, timeout: 10_000,
  });
  assert.match(help.stdout, /Answer one task, print the final assistant message, and exit\./u);
  assert.match(help.stdout, /dsh --profile headless/u);
  assert.equal((await sessionFiles(join(config.dshHome, "sessions"))).length, 0, "headless help created a Session");
  assert.equal(await coreTaskCount(config.data), 0, "headless help created a Core task");
  await execFile("tar", ["-xzf", config.artifact, "-C", config.readback]);
  const extractedCorePath = join(config.readback, "package", "runtime", "darwin-arm64", "dev-flow");
  const core = await fileIdentity(extractedCorePath);
  assert.equal(core.sha256, config.coreSha256);
  assert.ok((await stat(extractedCorePath)).mode & 0o111);
  assert.equal((await execFile(extractedCorePath, ["version"])).stdout.trim(), `dev-flow ${currentCoreVersion}`);
  assert.equal(await exists(installedPackageRoot(config)), false, "Artifact must not be installed during Preflight");
  const marker = {
    run_root: config.root,
    profile: config.profile,
    default_bundles: profileBundles,
    help_exit_code: 0,
    session_count: 0,
    core_task_count: 0,
    artifact_sha256: artifact.sha256,
    core_sha256: core.sha256,
    product_source_commit: config.productSourceCommit,
    acceptance_commit: config.acceptanceCommit,
    dsh_version: dsh.version,
    dsh_integrity: dsh.integrity,
    codex_identity_sha256: await treeDigest(join(repositoryRoot, "packages", "codex")),
  };
  await writeFile(config.preflightMarker, `${JSON.stringify(marker)}\n`, { mode: 0o600 });
  return {
    status: "ready",
    profile: config.profile,
    default_bundles: profileBundles,
    help_exit_code: 0,
    session_count: 0,
    core_task_count: 0,
    artifact_sha256: artifact.sha256,
    core_sha256: core.sha256,
    product_source_commit: config.productSourceCommit,
    acceptance_commit: config.acceptanceCommit,
  };
}

async function runNative(baseConfig) {
  activeStage = "install";
  const marker = JSON.parse(await readFile(baseConfig.preflightMarker, "utf8"));
  const runRoot = await realpath(marker.run_root);
  assertWithinRoot(baseConfig.root, runRoot, "Preflight run root");
  const config = withRunRoot(baseConfig, runRoot);
  activeConfig = config;
  assert.equal(marker.artifact_sha256, config.artifactSha256);
  assert.equal(marker.core_sha256, config.coreSha256);
  assert.equal(marker.product_source_commit, config.productSourceCommit);
  assert.equal(marker.acceptance_commit, config.acceptanceCommit);
  assert.equal(marker.dsh_version, "0.1.0-rc.8");
  assert.equal(marker.dsh_integrity, dshIntegrity);
  assert.equal(marker.profile, "headless");
  assert.deepEqual(marker.default_bundles, ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless"]);
  assert.equal(marker.help_exit_code, 0);
  assert.equal(marker.session_count, 0);
  assert.equal(marker.core_task_count, 0);
  assert.equal(await exists(successEvidencePath), false);
  assert.equal(await exists(failureEvidencePath), false);
  const sessionRoot = join(config.dshHome, "sessions");

  await runIsolatedDsh(config, ["plugin", "--profile", config.profile, "add", config.artifact], {
    cwd: config.workspace, timeout: 120_000,
  });
  await readProfileBundles(config, ["dev-flow-deepseek"]);
  const installedCore = await fileIdentity(await realpath(join(
    installedPackageRoot(config), "runtime", "darwin-arm64", "dev-flow",
  )));
  assert.equal(installedCore.sha256, config.coreSha256);

  process.stdout.write("NATIVE_ACCEPTANCE_START\n");
  activeStage = "ordinary-turn";
  const ordinary = await runTurn(
    config,
    "Inspect this repository without changing files. Reply with one short sentence. Do not invoke Dev Flow.",
    { stageId: activeStage, timeoutMs: TURN_TIMEOUT_MS },
  );
  const ordinarySession = await readNewSession(sessionRoot, ordinary.beforeSessions);
  const ordinarySummary = summarizeSession(ordinarySession.rows);
  assertCompletedTurn(ordinarySummary);
  assert.equal(ordinarySummary.devFlowCalls.length, 0);
  assert.equal(await coreTaskCount(config.data), 0);

  const initialPrompt = [
    "/dev-flow Implement the bounded plain-profile task in this repository.",
    "Create only src/proof-writer.mjs exporting writeProof() that returns the exact string deepseek-native-proof.",
    `The only authorized automated test command is exactly: ${exactTestCommand}`,
    "Run that exact test once before comprehension. Do not modify package.json, README.md, or test files.",
    "Follow fresh Core actions and payload schemas. At comprehension, wait for an explicit user verdict and never self-confirm.",
  ].join(" ");
  activeStage = "interruption";
  const interrupted = await startTurn(config, initialPrompt);
  await waitForNodeOrExit(config.data, interrupted.child, "DESIGN", TURN_TIMEOUT_MS);
  killProcessGroup(interrupted.child.pid, "SIGKILL");
  const interruptedExit = await interrupted.completion;
  assert.equal(interruptedExit.signal, "SIGKILL");
  const interruptedSession = await readNewSession(sessionRoot, interrupted.beforeSessions);
  const interruptedSummary = summarizeSession(interruptedSession.rows);
  assert.deepEqual(interruptedSummary.turnEndKinds, []);
  assert.equal(interruptedSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assert.ok(interruptedSummary.devFlowCalls.some((call) => isActionMutationName(call.name)));
  const interruptedTask = await currentTask(config.data);
  const openResult = firstSuccessfulToolResult(
    interruptedSession.rows,
    "mcp__dev_flow__dev_flow_open_task",
  );
  assert.equal(openResult?.task?.task_id, interruptedTask.task_id);
  const initialRevision = openResult.task.revision;
  assert.equal(interruptedTask.current_node, "DESIGN");
  assert.ok(interruptedTask.revision >= initialRevision);

  let progress = await taskProgressSnapshot(config.data);
  const checkpointSummaries = new Map();
  for (const definition of nativeCheckpoints) {
    const result = await runNativeCheckpoint(
      config,
      sessionRoot,
      definition,
      progress,
      interruptedTask.task_id,
    );
    checkpointSummaries.set(definition.id, result.summary);
    progress = result.after;
  }

  const task = await currentTask(config.data);
  assert.equal(task.current_node, "DONE");
  assert.equal(task.origin_host, "deepseek");
  assert.equal(task.task_id, interruptedTask.task_id);
  const allSummaries = [ordinarySummary, interruptedSummary, ...checkpointSummaries.values()];
  const devFlowNames = allSummaries.flatMap((summary) => summary.devFlowCalls.map((call) => call.name));
  assert.ok(devFlowNames.every((name) => exactDevFlowNames().has(name)));
  const commands = allSummaries.flatMap((summary) => summary.bashCommands);
  const testLike = commands.filter(isTestExecutionCommand);
  assert.ok(testLike.every((command) => command === exactTestCommand));
  assert.equal(testLike.length, 1);
  assert.ok(checkpointSummaries.get("work-to-comprehension").bashCommands.includes(exactTestCommand));
  const changed = await gitChangedPaths(config.workspace);
  assert.deepEqual(changed, ["src/proof-writer.mjs"]);
  assert.match(await readFile(join(config.workspace, "src", "proof-writer.mjs"), "utf8"), /deepseek-native-proof/u);
  const info = await readServerInfoFromSessions(allSummaries);
  assert.equal(info.process_id, "standard-development");
  assert.deepEqual(info.qualified_tools, [...exactDevFlowNames()]);

  const beforeLifecycle = await retainedIdentity(config, task.task_id);
  assert.equal(beforeLifecycle.codex, marker.codex_identity_sha256);
  await runIsolatedDsh(config, ["plugin", "--profile", config.profile, "remove", "dev-flow-deepseek"], {
    cwd: config.workspace, timeout: 120_000,
  });
  await readProfileBundles(config);
  assert.equal(await exists(installedPackageRoot(config)), false);
  assert.deepEqual(await retainedIdentity(config, task.task_id), beforeLifecycle);

  await runIsolatedDsh(config, ["plugin", "--profile", config.profile, "add", config.artifact], {
    cwd: config.workspace, timeout: 120_000,
  });
  await readProfileBundles(config, ["dev-flow-deepseek"]);
  const reinstalledCore = await fileIdentity(await realpath(join(installedPackageRoot(config), "runtime", "darwin-arm64", "dev-flow")));
  assert.equal(reinstalledCore.sha256, config.coreSha256);

  activeStage = "read-only-reopen";
  const reopen = await runTurn(config, [
    "/dev-flow Reopen the compatible terminal task read-only after exact-artifact reinstall.",
    "Perform the server-info handshake and fresh task/action reads, report the existing Core DONE result, and do not mutate it.",
  ].join(" "), { stageId: activeStage, timeoutMs: TURN_TIMEOUT_MS });
  assert.equal(reopen.exit.code, 0);
  const reopenSession = await readNewSession(sessionRoot, reopen.beforeSessions);
  const reopenSummary = summarizeSession(reopenSession.rows);
  assertCompletedTurn(reopenSummary);
  assert.equal(reopenSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assert.equal(reopenSummary.devFlowCalls.some((call) => isActionMutationName(call.name)), false);
  assert.equal(reopenSummary.devFlowCalls.some((call) => call.name === "mcp__dev_flow__dev_flow_cancel_task"), false);
  const reopenedTask = await currentTask(config.data);
  assert.equal(reopenedTask.task_id, task.task_id);
  assert.equal(reopenedTask.revision, task.revision);
  assert.equal(reopenedTask.current_node, "DONE");
  assert.deepEqual(await retainedIdentity(config, task.task_id), beforeLifecycle);

  const artifact = await fileIdentity(config.artifact);
  const corePath = join(config.readback, "package", "runtime", "darwin-arm64", "dev-flow");
  const core = await fileIdentity(corePath);
  const recoveredTask = checkpointSummaries.get("recovery-read");
  assert.notEqual(recoveredTask, undefined);
  activeStage = "complete";
  return {
    status: "passed",
    product_source_commit: config.productSourceCommit,
    acceptance_commit: config.acceptanceCommit,
    artifact: {
      filename: basename(config.artifact), size: artifact.size, sha256: artifact.sha256,
    },
    core: {
      sha256: core.sha256,
      reported_version: (await execFile(corePath, ["version"])).stdout.trim(),
    },
    dsh: { version: "0.1.0-rc.8", integrity: dshIntegrity },
    platform: {
      node: process.version,
      pnpm: (await execFile("pnpm", ["--version"])).stdout.trim(),
      os: platform(), arch: arch(),
    },
    task: {
      task_id: task.task_id,
      initial_revision: initialRevision,
      resumed_revision: interruptedTask.revision,
      terminal_revision: task.revision,
      terminal_state: task.current_node,
    },
    outcomes: {
      ordinary_zero_dispatch: true,
      selector_guard: true,
      fifteen_tools: info.qualified_tools.length === 15,
      restart_resume: true,
      read_before_retry: recoveryReadBeforeRetry(recoveredTask.devFlowCalls),
      comprehension: true,
      core_done: true,
      remove_reinstall: true,
      data_retained: true,
      repository_retained: true,
      codex_unchanged: true,
      read_only_reopen: true,
    },
    publication_effects: false,
  };
}

async function runNativeCheckpoint(config, sessionRoot, definition, before, taskID) {
  activeStage = definition.id;
  assert.equal(before.task_id, taskID);
  assert.equal(before.current_node, definition.fromNode);
  const turn = await runTurn(config, definition.prompt, {
    stageId: definition.id,
    timeoutMs: TURN_TIMEOUT_MS,
  });
  const session = await readNewSession(sessionRoot, turn.beforeSessions);
  const summary = summarizeSession(session.rows);
  assertCompletedTurn(summary);
  assert.equal(summary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assert.ok(summary.devFlowCalls.every((call) => exactDevFlowNames().has(call.name)));
  assertMutationIdentities(summary.devFlowCalls);
  const after = await taskProgressSnapshot(config.data);
  const assessment = assessCheckpointProgress(definition, before, after, summary);
  if (assessment.status !== "passed") {
    throw Object.assign(new Error(`DSH_STAGE_NO_PROGRESS:${definition.id}:${assessment.reason}`), {
      code: "DSH_STAGE_NO_PROGRESS",
    });
  }
  return {
    after,
    summary,
  };
}

function assessCheckpointProgress(definition, before, after, summary) {
  if (after.task_id !== before.task_id) return failedProgress("task identity changed");
  if (before.current_node !== definition.fromNode) return failedProgress("unexpected starting node");
  if (after.current_node !== definition.toNode) return failedProgress("stage did not stop at its target node");
  if (after.revision < before.revision) return failedProgress("task revision moved backward");

  const calls = summary.devFlowCalls;
  const mutations = calls.filter((call) => isActionMutationName(call.name) || call.name === "mcp__dev_flow__dev_flow_cancel_task");
  if (definition.readOnly) {
    if (!recoveryReadBeforeRetry(calls)) return failedProgress("required recovery read sequence is absent");
    if (mutations.length !== 0) return failedProgress("recovery observation mutated Core");
    if (after.revision !== before.revision) return failedProgress("recovery observation changed task revision");
    return { status: "passed", progress: "read_before_retry_observed", reason: "" };
  }
  if (after.revision <= before.revision) return failedProgress("mutation checkpoint made no revision progress");
  if (!mutations.some((call) => isActionMutationName(call.name))) {
    return failedProgress("mutation checkpoint did not apply a Core action");
  }
  if (definition.toNode === "DONE") {
    if (after.action_id !== null || after.terminal_status !== "DONE") {
      return failedProgress("terminal stage lacks Core DONE readback");
    }
  } else if (after.action_node !== definition.toNode) {
    return failedProgress("fresh current action does not match the target state");
  }
  return { status: "passed", progress: "revision_advanced", reason: "" };
}

function recoveryReadBeforeRetry(calls) {
  const getTask = calls.findIndex((call) => call.name === "mcp__dev_flow__dev_flow_get_task");
  const getNext = calls.findIndex((call) => call.name === "mcp__dev_flow__dev_flow_get_next_action");
  const firstMutation = calls.findIndex((call) => isActionMutationName(call.name) || call.name === "mcp__dev_flow__dev_flow_cancel_task");
  return getTask >= 0 && getNext > getTask && firstMutation === -1;
}

function failedProgress(reason) {
  return { status: "failed", progress: "none", reason };
}

function assertMutationIdentities(calls) {
  for (const call of calls.filter((candidate) => isActionMutationName(candidate.name))) {
    const args = JSON.parse(call.arguments);
    const fields = ["host", "task_id", "action_id", "transition_id", "summary", "reason", "artifacts", "method_results", "node_result"];
    assert.deepEqual(Object.keys(args).sort(), [...fields].sort(), "Action submission must match the current top-level contract");
    assert.equal(args.host, "deepseek");
    assert.match(args.action_id, /\S/u);
    assert.match(args.transition_id, /\S/u);
  }
}

function firstSuccessfulToolResult(events, name) {
  const call = events.find((event) => event.type === "tool/call" && event.data?.name === name)?.data;
  if (call === undefined) return undefined;
  const envelope = toolResultEnvelope(events, call.callId);
  return envelope?.ok === true ? envelope.result : undefined;
}

function installedPackageRoot(config) {
  return join(config.dshHome, "profiles", config.profile, "node_modules", "dev-flow-deepseek");
}

async function retainedIdentity(config, taskID) {
  return {
    data: await taskPersistenceIdentity(config.data, taskID),
    repository: await treeDigest(config.workspace, new Set([".git"])),
    codex: await treeDigest(join(repositoryRoot, "packages", "codex")),
  };
}

async function taskPersistenceIdentity(dataDirectory, taskID) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(join(dataDirectory, "dev-flow.db"), { readOnly: true });
  const task = db.prepare("SELECT task_id,current_node,revision,snapshot FROM tasks WHERE task_id=?").get(taskID);
  const eventCount = Number(db.prepare("SELECT COUNT(*) AS count FROM task_events WHERE task_id=?").get(taskID).count);
  const claimCount = Number(db.prepare("SELECT COUNT(*) AS count FROM repository_claims WHERE task_id=?").get(taskID).count);
  db.close();
  assert.notEqual(task, undefined);
  return {
    task_id: task.task_id,
    current_node: task.current_node,
    revision: task.revision,
    snapshot_sha256: sha256(Buffer.from(task.snapshot)),
    event_count: eventCount,
    claim_count: claimCount,
  };
}

async function treeDigest(root, ignoredNames = new Set()) {
  const entries = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignoredNames.has(entry.name)) continue;
      const path = join(directory, entry.name);
      const name = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await walk(path, name);
      else {
        const info = await lstat(path);
        const bytes = await readFile(path);
        entries.push(`${name}\0${info.mode & 0o777}\0${sha256(bytes)}`);
      }
    }
  }
  await walk(root);
  return sha256(entries.sort().join("\n"));
}

async function selfTest() {
  assert.equal(basename(successEvidencePath), "native-acceptance.json");
  assert.equal(basename(failureEvidencePath), "native-acceptance-failed.json");
  assert.equal(TURN_TIMEOUT_MS, 300_000);
  assert.deepEqual(nativeCheckpoints.map((definition) => definition.id), [
    "recovery-read", "work-to-comprehension", "accept-and-deliver",
  ]);
  assert.ok(nativeCheckpoints.every((definition) => definition.prompt.includes("/dev-flow")));
  const deliveryPrompt = nativeCheckpoints.find((definition) => definition.id === "accept-and-deliver").prompt;
  assert.match(deliveryPrompt, /exactly host, task_id, action_id, transition_id, summary, reason, artifacts, method_results, and node_result/u);
  assert.match(deliveryPrompt, /Do not send payload, method_evidence, revision/u);
  const currentSubmission = {
    host: "deepseek",
    task_id: "task-current",
    action_id: "action-current",
    transition_id: "delivery_complete",
    summary: "Delivery completed.",
    reason: "",
    artifacts: { other_process: [] },
    method_results: { "delivery.prepare_summary": { capability: "", summary: "Prepared delivery." } },
    node_result: { problem_class: "none", unverified_items: [], risks: [], findings: [], changed_paths: [], no_file_changes: true },
  };
  assertMutationIdentities([{
    name: "mcp__dev_flow__dev_flow_submit_delivery",
    arguments: JSON.stringify(currentSubmission),
  }]);
  const legacySubmission = { ...currentSubmission, payload: { transition_id: "delivery_complete" } };
  delete legacySubmission.transition_id;
  assert.throws(() => assertMutationIdentities([{
    name: "mcp__dev_flow__dev_flow_submit_delivery",
    arguments: JSON.stringify(legacySubmission),
  }]), /current top-level contract/u);
  assertCompletedTurn(summarizeEvents([
    { type: "turn/end", data: { reason: { kind: "completed" } } },
  ]));

  const root = await mkdtemp(join(tmpdir(), "dev-flow-native-self-test-"));
  try {
    const config = withRunRoot({ root, profile: "headless" }, join(root, "run"));
    await mkdir(config.root);
    await mkdir(config.temporaryDirectory, { recursive: true });
    await writeFile(join(config.temporaryDirectory, "node-compile-cache"), "cache\n");
    const credentialPath = join(root, "credential.yaml");
    await writeFile(credentialPath, "credential-content-is-not-inspected\n", { mode: 0o600 });
    await assertPrivateFile(credentialPath);
    await chmod(credentialPath, 0o644);
    await assert.rejects(assertPrivateFile(credentialPath), /private permissions/u);
    await assertOwnedPathsAbsent(config);
    await mkdir(config.data);
    await writeFile(join(config.data, "dev-flow.db"), "state\n");
    await assert.rejects(assertOwnedPathsAbsent(config), /Runner-owned path/u);

    const block = [
      "packages:",
      "  '@deepseek-ai/dsh@0.1.0-rc.8':",
      `    resolution: { integrity: '${dshIntegrity}' }`,
      "  '@deepseek-ai/other@1.0.0':",
      "    resolution: {integrity: sha512-other}",
    ].join("\n");
    assert.equal(dshIntegrityFromConsumerLockfile(block), dshIntegrity);
    assert.equal(dshIntegrityFromConsumerLockfile(block.replaceAll("'", '"')), dshIntegrity);
    assert.throws(() => dshIntegrityFromConsumerLockfile(block.replace(dshIntegrity, "sha512-wrong")), /integrity/u);

    const recoveryCalls = [
      { name: "mcp__dev_flow__dev_flow_server_info" },
      { name: "mcp__dev_flow__dev_flow_get_task" },
      { name: "mcp__dev_flow__dev_flow_get_next_action" },
    ];
    assert.equal(recoveryReadBeforeRetry(recoveryCalls), true);
    assert.equal(recoveryReadBeforeRetry([...recoveryCalls, { name: "mcp__dev_flow__dev_flow_submit_test" }]), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const cleanupChild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const cleanupCompletion = new Promise((resolve, reject) => {
    cleanupChild.once("error", reject);
    cleanupChild.once("exit", (code, signalName) => resolve({ code, signal: signalName, stdout: "", stderr: "" }));
  });
  await terminateTurn({ child: cleanupChild, completion: cleanupCompletion });
  const cleanupExit = await withTimeout(cleanupCompletion, 5_000, new Error("self-test child cleanup timed out"));
  assert.ok(cleanupExit.signal === "SIGTERM" || cleanupExit.signal === "SIGKILL");

  const privateRoot = join(tmpdir(), "private-native-root");
  const isolatedConfig = withRunRoot({ root: privateRoot, profile: "headless" }, privateRoot);
  const isolatedEnv = isolatedDshEnvironment(isolatedConfig, ["--profile", "headless", "--help"]);
  assert.equal(isolatedEnv.DSH_HOME, isolatedConfig.dshHome);
  assert.equal(isolatedEnv.HOME, isolatedConfig.isolatedHome);
  assert.equal(isolatedEnv.TMPDIR, isolatedConfig.temporaryDirectory);
  const failure = await sanitizedFailure(
    Object.assign(new Error(`DSH_STAGE_TIMEOUT:${privateRoot}`), { code: "DSH_STAGE_TIMEOUT" }),
    {
      ...isolatedConfig,
      data: join(privateRoot, "missing-data"),
      workspace: join(privateRoot, "workspace"),
      artifact: join(privateRoot, "artifact.tgz"),
      credentials: join(privateRoot, "credentials"),
      settings: join(privateRoot, "settings"),
      dshLockfile: join(privateRoot, "lockfile"),
      artifactSha256: "a".repeat(64),
    },
    "passed",
  );
  await validateFailureEvidence(failure);
  assert.equal(failure.status, "failed");
  assert.equal(failure.stage, activeStage);
  assert.equal(failure.process_cleanup, "passed");
  assert.equal(failure.final_task, null);
  assert.equal(JSON.stringify(failure).includes(privateRoot), false);
  assert.equal(JSON.stringify(failure).includes(homedir()), false);

  const taskRoot = await mkdtemp(join(tmpdir(), "dev-flow-native-task-self-test-"));
  try {
    const taskData = join(taskRoot, "data");
    await mkdir(taskData);
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(join(taskData, "dev-flow.db"));
    db.exec("CREATE TABLE tasks (task_id TEXT, origin_host TEXT, current_node TEXT, revision INTEGER, snapshot BLOB, updated_at TEXT)");
    db.prepare("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)").run(
      "task-deadbeef", "deepseek", "IMPLEMENT", 4, Buffer.from("{}"), "2026-08-21T00:00:00Z",
    );
    db.close();
    const taskFailure = await sanitizedFailure(
      Object.assign(new Error("DSH_STAGE_TIMEOUT:work-to-comprehension"), { code: "DSH_STAGE_TIMEOUT" }),
      { ...isolatedConfig, data: taskData },
      "passed",
    );
    await validateFailureEvidence(taskFailure);
    assert.deepEqual(taskFailure.final_task, {
      task_id: "task-deadbeef",
      current_node: "IMPLEMENT",
      revision: 4,
      origin_host: "deepseek",
    });
  } finally {
    await rm(taskRoot, { recursive: true, force: true });
  }
  assert.throws(() => assertEvidenceShape({}), /Expected values to be strictly deep-equal/u);
}

async function startTurn(config, prompt) {
  const beforeSessions = new Set(await sessionFiles(join(config.dshHome, "sessions")));
  const child = spawnIsolatedDsh(config, ["--profile", config.profile, prompt], {
    cwd: config.workspace, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = boundedCollector(child.stdout, 1_048_576);
  const stderr = boundedCollector(child.stderr, 1_048_576);
  const rawCompletion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signalName) => resolve({ code, signal: signalName, stdout: stdout.text(), stderr: stderr.text() }));
  });
  const running = { child, completion: undefined, beforeSessions };
  running.completion = rawCompletion.finally(() => activeTurns.delete(running));
  activeTurns.add(running);
  return running;
}

async function runTurn(config, prompt, { stageId, timeoutMs }) {
  const running = await startTurn(config, prompt);
  let exit;
  try {
    exit = await withTimeout(
      running.completion,
      timeoutMs,
      Object.assign(new Error(`DSH_STAGE_TIMEOUT:${stageId}`), { code: "DSH_STAGE_TIMEOUT" }),
    );
  } catch (error) {
    await terminateTurn(running);
    throw error;
  }
  if (exit.code !== 0) {
    throw Object.assign(new Error(`DSH_HEADLESS_FAILED:${stageId}:${exit.stderr.slice(0, 500)}`), {
      code: "DSH_HEADLESS_FAILED",
    });
  }
  return { ...running, exit };
}

async function terminateTurn(running) {
  if (running.child.exitCode !== null || running.child.signalCode !== null) return;
  try {
    killProcessGroup(running.child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  await Promise.race([running.completion, delay(1_000)]);
  if (running.child.exitCode === null && running.child.signalCode === null) {
    try {
      killProcessGroup(running.child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await withTimeout(running.completion, 5_000, new Error("timed-out DSH process group did not terminate"));
  }
}

function killProcessGroup(pid, signalName) {
  process.kill(-pid, signalName);
}

async function terminateActiveTurns() {
  let passed = true;
  for (const running of [...activeTurns]) {
    try {
      await terminateTurn(running);
    } catch {
      passed = false;
    }
  }
  return passed ? "passed" : "failed";
}

function boundedCollector(stream, maxBytes) {
  const chunks = [];
  let bytes = 0;
  stream.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes <= maxBytes) chunks.push(chunk);
  });
  return { text: () => Buffer.concat(chunks).toString("utf8") };
}

async function waitForNodeOrExit(dataDirectory, child, node, timeoutMs) {
  const databasePath = join(dataDirectory, "dev-flow.db");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("DSH exited before the interruption checkpoint");
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(databasePath, { readOnly: true });
      const row = db.prepare("SELECT current_node FROM tasks ORDER BY updated_at DESC LIMIT 1").get();
      db.close();
      if (row?.current_node === node) return;
    } catch {}
    await delay(5);
  }
  throw new Error("native interruption checkpoint timed out");
}

async function currentTask(dataDirectory) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(join(dataDirectory, "dev-flow.db"), { readOnly: true });
  const row = db.prepare("SELECT task_id,origin_host,current_node,revision,snapshot FROM tasks ORDER BY updated_at DESC LIMIT 1").get();
  db.close();
  assert.notEqual(row, undefined, "Core task is absent");
  const snapshot = JSON.parse(Buffer.from(row.snapshot).toString("utf8"));
  return { task_id: row.task_id, origin_host: row.origin_host, current_node: row.current_node, revision: row.revision, ...snapshot };
}

async function taskProgressSnapshot(dataDirectory) {
  const task = await currentTask(dataDirectory);
  return {
    task_id: task.task_id,
    current_node: task.current_node,
    revision: task.revision,
    action_id: task.current_action?.action_id ?? null,
    action_node: task.current_action?.current_node ?? null,
    terminal_status: new Set(["DONE", "BLOCKED", "CANCELLED"]).has(task.current_node)
      ? task.current_node
      : null,
  };
}

async function coreTaskCount(dataDirectory) {
  const databasePath = join(dataDirectory, "dev-flow.db");
  if (!await exists(databasePath)) return 0;
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(databasePath, { readOnly: true });
  const count = Number(db.prepare("SELECT COUNT(*) AS count FROM tasks").get().count);
  db.close();
  return count;
}

async function readNewSession(root, before) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = await sessionFiles(root);
    const added = files.filter((path) => !before.has(path));
    if (added.length === 1) return { path: added[0], rows: await readSession(added[0]) };
    if (added.length > 1) throw new Error(`unexpected session count ${added.length}`);
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

function summarizeSession(rows) {
  const events = rows.filter((row) => row.type !== "session" && row.type !== "text-chunks" && row.type !== "reasoning-chunks" && row.type !== "tool-call-chunks");
  const summary = summarizeEvents(events);
  const infoCall = summary.devFlowCalls.find((call) => call.name === "mcp__dev_flow__dev_flow_server_info");
  if (infoCall) {
    const result = toolResultEnvelope(events, infoCall.callId);
    if (result?.ok) summary.serverInfo = result.result;
  }
  return summary;
}

function summarizeEvents(events) {
  const calls = events.filter((event) => event.type === "tool/call").map((event) => event.data);
  const resultIds = new Set(events.filter((event) => event.type === "tool/result")
    .map((event) => event.data?.message?.content?.[0]?.toolCallId).filter(Boolean));
  const devFlowCalls = calls.filter((call) => call.name.startsWith("mcp__dev_flow__"));
  const bashCommands = calls.filter((call) => call.name === "bash").map((call) => {
    try { return JSON.parse(call.arguments).command; } catch { return undefined; }
  }).filter((value) => typeof value === "string");
  return {
    devFlowCalls,
    bashCommands,
    unansweredDevFlowCallIds: devFlowCalls.map((call) => call.callId).filter((id) => !resultIds.has(id)),
    turnEndKinds: events.filter((event) => event.type === "turn/end")
      .map((event) => event.data?.reason?.kind ?? null),
  };
}

function assertCompletedTurn(summary) {
  assert.deepEqual(summary.turnEndKinds, ["completed"]);
}

function toolResultEnvelope(events, callId) {
  const result = events.find((event) => event.type === "tool/result" && event.data?.message?.content?.[0]?.toolCallId === callId);
  const blocks = result?.data?.message?.content?.[0]?.content ?? [];
  const text = blocks.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  try { return JSON.parse(text.slice(start)); } catch { return undefined; }
}

async function readServerInfoFromSessions(summaries) {
  const info = summaries.map((summary) => summary.serverInfo).find(Boolean);
  assert.notEqual(info, undefined, "server-info envelope was not retained");
  const rawTools = [
    "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task",
    "dev_flow_get_next_action", "dev_flow_submit_requirements", "dev_flow_submit_design",
    "dev_flow_submit_tasks", "dev_flow_submit_implementation", "dev_flow_submit_test",
    "dev_flow_submit_comprehension", "dev_flow_submit_refactor", "dev_flow_submit_delivery",
    "dev_flow_resolve_blocker", "dev_flow_recover_action", "dev_flow_cancel_task",
  ];
  assert.deepEqual(info.tools, rawTools);
  assert.deepEqual(info.method_profiles, ["plain", "spec-kit", "openspec"]);
  return {
    process_id: info.supported_processes[0].process_id,
    process_definition_digest: info.supported_processes[0].definition_digest,
    qualified_tools: [...exactDevFlowNames()],
  };
}

function isTestExecutionCommand(command) {
  return /^node\s+--test(?:\s|$)/u.test(command.trim());
}

function exactDevFlowNames() {
  return new Set([
    "mcp__dev_flow__dev_flow_server_info", "mcp__dev_flow__dev_flow_open_task",
    "mcp__dev_flow__dev_flow_get_task", "mcp__dev_flow__dev_flow_get_next_action",
    "mcp__dev_flow__dev_flow_submit_requirements", "mcp__dev_flow__dev_flow_submit_design",
    "mcp__dev_flow__dev_flow_submit_tasks", "mcp__dev_flow__dev_flow_submit_implementation",
    "mcp__dev_flow__dev_flow_submit_test", "mcp__dev_flow__dev_flow_submit_comprehension",
    "mcp__dev_flow__dev_flow_submit_refactor", "mcp__dev_flow__dev_flow_submit_delivery",
    "mcp__dev_flow__dev_flow_resolve_blocker", "mcp__dev_flow__dev_flow_recover_action",
    "mcp__dev_flow__dev_flow_cancel_task",
  ]);
}

function isActionMutationName(name) {
  return typeof name === "string" && name.startsWith("mcp__dev_flow__dev_flow_submit_");
}

async function validateEvidence(evidence) {
  assertEvidenceShape(evidence);
  assertEvidenceSafe(evidence);
}

async function validateFailureEvidence(evidence) {
  assertFailureEvidenceShape(evidence);
  assertEvidenceSafe(evidence);
}

function assertFailureEvidenceShape(evidence) {
  assertClosedKeys(evidence, [
    "status", "stage", "diagnostic", "final_task", "process_cleanup", "publication_effects",
  ]);
  assert.equal(evidence.status, "failed");
  assert.match(evidence.stage, /\S/u);
  assert.match(evidence.diagnostic, /\S/u);
  assert.ok(evidence.diagnostic.length <= 500);
  if (evidence.final_task !== null) {
    assertClosedKeys(evidence.final_task, ["task_id", "current_node", "revision", "origin_host"]);
    assert.match(evidence.final_task.task_id, /^task-[0-9a-f]+$/u);
    assert.match(evidence.final_task.current_node, /\S/u);
    assert.ok(Number.isInteger(evidence.final_task.revision));
    assert.equal(evidence.final_task.origin_host, "deepseek");
  }
  assert.ok(new Set(["passed", "failed"]).has(evidence.process_cleanup));
  assert.equal(evidence.publication_effects, false);
}

function assertEvidenceShape(evidence) {
  assertClosedKeys(evidence, [
    "status", "product_source_commit", "acceptance_commit", "artifact", "core", "dsh",
    "platform", "task", "outcomes", "publication_effects",
  ]);
  assert.equal(evidence.status, "passed");
  assert.match(evidence.product_source_commit, /^[0-9a-f]{40}$/u);
  assert.match(evidence.acceptance_commit, /^[0-9a-f]{40}$/u);
  assertClosedKeys(evidence.artifact, ["filename", "size", "sha256"]);
  assert.equal(basename(evidence.artifact.filename), evidence.artifact.filename);
  assert.ok(evidence.artifact.size > 0);
  assert.match(evidence.artifact.sha256, /^[0-9a-f]{64}$/u);
  assertClosedKeys(evidence.core, ["sha256", "reported_version"]);
  assert.match(evidence.core.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(evidence.core.reported_version, `dev-flow ${currentCoreVersion}`);
  assert.deepEqual(evidence.dsh, { version: "0.1.0-rc.8", integrity: dshIntegrity });
  assertClosedKeys(evidence.platform, ["node", "pnpm", "os", "arch"]);
  assert.match(evidence.platform.node, /^v24\./u);
  assert.match(evidence.platform.pnpm, /^11\./u);
  assert.equal(evidence.platform.os, "darwin");
  assert.equal(evidence.platform.arch, "arm64");
  assertClosedKeys(evidence.task, ["task_id", "initial_revision", "resumed_revision", "terminal_revision", "terminal_state"]);
  assert.match(evidence.task.task_id, /^task-[0-9a-f]+$/u);
  assert.ok(evidence.task.initial_revision >= 1);
  assert.ok(evidence.task.resumed_revision >= evidence.task.initial_revision);
  assert.ok(evidence.task.terminal_revision > evidence.task.resumed_revision);
  assert.equal(evidence.task.terminal_state, "DONE");
  assertClosedKeys(evidence.outcomes, [
    "ordinary_zero_dispatch", "selector_guard", "fifteen_tools", "restart_resume",
    "read_before_retry", "comprehension", "core_done",
    "remove_reinstall", "data_retained", "repository_retained", "codex_unchanged",
    "read_only_reopen",
  ]);
  assert.ok(Object.values(evidence.outcomes).every((value) => value === true));
  assert.equal(evidence.publication_effects, false);
}

function assertClosedKeys(value, expected) {
  assert.equal(value !== null && typeof value === "object" && !Array.isArray(value), true);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function configuredPrivatePrefix() {
  return process.env.DEV_FLOW_NATIVE_ROOT ?? "/private-path-not-configured";
}

function assertEvidenceSafe(evidence) {
  const encoded = JSON.stringify(evidence);
  for (const forbidden of [
    configuredPrivatePrefix(), activeConfig?.root, repositoryRoot, homedir(),
    "DEEPSEEK_API_KEY", "BEGIN PRIVATE KEY",
  ].filter(Boolean)) {
    assert.equal(encoded.includes(forbidden), false, `Evidence contains forbidden value ${forbidden}`);
  }
}

async function sanitizedFailure(error, config, processCleanup) {
  let message = error instanceof Error ? error.message : String(error);
  for (const path of [
    config.root, config.dshHome, config.data, config.workspace, config.artifact,
    config.credentials, config.settings, config.dshLockfile, repositoryRoot, homedir(),
  ].filter(Boolean)) {
    message = message.replaceAll(path, "<private-path>");
  }
  return {
    status: "failed",
    stage: activeStage,
    diagnostic: `${classifyRunnerFailure(error)}:${message}`.slice(0, 500),
    final_task: await boundedFinalTaskState(config.data),
    process_cleanup: processCleanup,
    publication_effects: false,
  };
}

async function boundedFinalTaskState(dataDirectory) {
  try {
    const task = await currentTask(dataDirectory);
    return {
      task_id: task.task_id,
      current_node: task.current_node,
      revision: task.revision,
      origin_host: task.origin_host,
    };
  } catch {
    return null;
  }
}

function classifyRunnerFailure(error) {
  if (error?.code === "DSH_STAGE_TIMEOUT") return "stage_timeout";
  if (error?.code === "DSH_STAGE_NO_PROGRESS") return "stage_no_progress";
  if (error?.code === "DSH_HEADLESS_FAILED") return "headless_failure";
  return error instanceof assert.AssertionError ? "acceptance_assertion" : "native_runner_error";
}

function dshEnvironment(config) {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    HOME: config.isolatedHome,
    TMPDIR: config.temporaryDirectory,
    DSH_HOME: config.dshHome,
    DEV_FLOW_DATA_DIR: config.data,
    DSH_TOOLS_MODE: "native",
    DSH_TELEMETRY_DISABLED: "1",
  };
}

function isolatedDshEnvironment(config, args) {
  assert.equal(config.profile, "headless", "only the shipped headless Profile is authorized");
  const profileIndex = args.indexOf("--profile");
  assert.notEqual(profileIndex, -1, "isolated DSH command is missing --profile");
  assert.equal(args.filter((argument) => argument === "--profile").length, 1, "isolated DSH command has ambiguous Profiles");
  assert.equal(args[profileIndex + 1], config.profile, "isolated DSH command selected another Profile");
  const env = dshEnvironment(config);
  assert.equal(env.DSH_HOME, config.dshHome);
  assert.equal(env.HOME, config.isolatedHome);
  assert.equal(env.TMPDIR, config.temporaryDirectory);
  for (const path of [config.dshHome, config.isolatedHome, config.temporaryDirectory]) {
    assert.ok(path.startsWith(`${config.root}${sep}`), "isolated DSH path escapes the native root");
  }
  return env;
}

async function runIsolatedDsh(config, args, options) {
  return await runCommand(config.dshCli, args, {
    ...options,
    env: isolatedDshEnvironment(config, args),
  });
}

function spawnIsolatedDsh(config, args, options) {
  return spawn(config.dshCli, args, {
    ...options,
    env: isolatedDshEnvironment(config, args),
  });
}

async function assertOwnedPathsAbsent(config) {
  const ownedPaths = [
    join(config.dshHome, "profiles", config.profile),
    join(config.dshHome, "sessions"),
    join(config.data, "dev-flow.db"),
    join(config.workspace, ".git"),
    config.readback,
  ];
  for (const path of ownedPaths) {
    assert.equal(await exists(path), false, `Runner-owned path already exists: ${basename(path)}`);
  }
}

async function validateDshConsumer(config) {
  const lockfile = await realpath(config.dshLockfile);
  const consumerRoot = dirname(lockfile);
  const cli = await realpath(config.dshCli);
  assertWithinRoot(consumerRoot, cli, "DSH CLI");

  const manifestPath = await realpath(join(consumerRoot, "node_modules", "@deepseek-ai", "dsh", "package.json"));
  const packageRoot = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.name, "@deepseek-ai/dsh");
  assert.equal(manifest.version, "0.1.0-rc.8");
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.dsh;
  assert.equal(bin?.replace(/^\.\//u, ""), "lib/bin.js");
  const binTarget = await realpath(join(packageRoot, bin));
  assertWithinRoot(consumerRoot, binTarget, "DSH package bin target");
  await assertFile(binTarget);
  assert.equal((await execFile(config.dshCli, ["--version"])).stdout.trim(), manifest.version);

  const integrity = dshIntegrityFromConsumerLockfile(await readFile(lockfile, "utf8"));
  return { version: manifest.version, integrity };
}

function dshIntegrityFromConsumerLockfile(text) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const headerPattern = /^(\s*)['"]?@deepseek-ai\/dsh@0\.1\.0-rc\.8['"]?:\s*$/u;
  const headerIndex = lines.findIndex((line) => headerPattern.test(line));
  assert.notEqual(headerIndex, -1, "DSH package block is missing from consumer lockfile");
  const baseIndent = headerPattern.exec(lines[headerIndex])[1].length;
  let integrity;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const indent = /^(\s*)/u.exec(line)[1].length;
    if (indent <= baseIndent) break;
    const match = /\bintegrity:\s*['"]?([^,'"}\s]+)['"]?/u.exec(line);
    if (match) integrity = match[1];
  }
  assert.equal(integrity, dshIntegrity, "DSH consumer lockfile integrity mismatch");
  return integrity;
}

function assertWithinRoot(root, path, label) {
  const remainder = relative(root, path);
  assert.equal(remainder === "" || (!remainder.startsWith(`..${sep}`) && remainder !== ".."), true, `${label} escapes its root`);
}

async function readProfileBundles(config, additional = []) {
  const manifestPath = join(config.dshHome, "profiles", config.profile, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bundles = manifest?.dsh?.profile?.bundles;
  assert.deepEqual(bundles, ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-headless", ...additional]);
  return bundles;
}

async function initializeWorkspace(workspace) {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1" };
  await execFile("git", ["init", "-q"], { cwd: workspace, env });
  await execFile("git", ["config", "user.email", "native@example.invalid"], { cwd: workspace, env });
  await execFile("git", ["config", "user.name", "Native Journey"], { cwd: workspace, env });
  await mkdir(join(workspace, "test"));
  await writeFile(join(workspace, "README.md"), "# Native fixture\n");
  await writeFile(join(workspace, "package.json"), `${JSON.stringify({ name: "deepseek-native-fixture", private: true, type: "module" }, null, 2)}\n`);
  await writeFile(join(workspace, "test", "proof-writer.test.mjs"), [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    'import { writeProof } from "../src/proof-writer.mjs";',
    'test("writes the native proof", () => { assert.equal(writeProof(), "deepseek-native-proof"); });',
    "",
  ].join("\n"));
  await execFile("git", ["add", "README.md", "package.json", "test/proof-writer.test.mjs"], { cwd: workspace, env });
  await execFile("git", ["commit", "-q", "-m", "initial fixture"], { cwd: workspace, env });
}

async function gitChangedPaths(workspace) {
  const { stdout } = await execFile("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: workspace });
  return stdout.split("\n").filter(Boolean).map((line) => line.slice(3)).sort();
}

async function runCommand(command, args, options) {
  return await execFile(command, args, {
    ...options, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function fileIdentity(path) { const bytes = await readFile(path); return { size: bytes.length, sha256: sha256(bytes) }; }
async function assertFile(path) { assert.equal((await stat(path)).isFile(), true, path); }
async function assertPrivateFile(path) {
  const info = await lstat(path);
  assert.equal(info.isFile(), true, "credential source must be a regular file");
  assert.equal(info.mode & 0o077, 0, "credential source must use private permissions");
}
async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function withTimeout(promise, ms, timeoutError) {
  return Promise.race([promise, delay(ms).then(() => { throw timeoutError; })]);
}
