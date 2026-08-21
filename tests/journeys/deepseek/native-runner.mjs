import assert from "node:assert/strict";
import { spawn, execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, stat, writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { arch, homedir, platform } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { zstdCompressSync, zstdDecompressSync } from "node:zlib";

const execFile = promisify(execFileCallback);
const runnerPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(dirname(dirname(runnerPath))));
const evidenceDirectory = join(repositoryRoot, "tests", "journeys", "deepseek", "evidence");
const successEvidencePath = join(evidenceDirectory, "native-evidence.json");
const historicalFailureEvidencePath = join(evidenceDirectory, "native-attempt-1-failed.json");
const failureEvidencePath = join(evidenceDirectory, "native-attempt-2-failed.json");
const schemaPath = join(repositoryRoot, "tests", "journeys", "deepseek", "evidence-schema.json");
const exactTestCommand = "node --test test/proof-writer.test.mjs";
const nativeAttempt = 2;
const dshIntegrity = "sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==";
const dshSourceCommit = "141eb6fef83422698aef7a981029e843e8161534";

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
  const config = loadConfig();
  try {
    const evidence = await runNative(config);
    await validateEvidence(evidence);
    await writeFile(successEvidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ status: "passed", task_id: evidence.task.task_id, revision: evidence.task.terminal_revision })}\n`);
  } catch (error) {
    const failure = sanitizedFailure(error, loadConfig());
    await writeFile(failureEvidencePath, `${JSON.stringify(failure, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    throw error;
  }
}

function loadConfig() {
  const required = [
    "DEV_FLOW_DSH_CLI", "DEV_FLOW_NATIVE_ARTIFACT", "DEV_FLOW_NATIVE_ROOT",
    "DEV_FLOW_DSH_CREDENTIALS", "DEV_FLOW_DSH_SETTINGS", "DEV_FLOW_DSH_LOCKFILE",
    "DEV_FLOW_FROZEN_SOURCE_COMMIT", "DEV_FLOW_NATIVE_ARTIFACT_SHA256",
    "DEV_FLOW_NATIVE_CORE_SHA256",
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
    sourceCommit: process.env.DEV_FLOW_FROZEN_SOURCE_COMMIT,
    artifactSha256: process.env.DEV_FLOW_NATIVE_ARTIFACT_SHA256,
    coreSha256: process.env.DEV_FLOW_NATIVE_CORE_SHA256,
    dshHome: join(process.env.DEV_FLOW_NATIVE_ROOT, "dsh-home"),
    isolatedHome: join(process.env.DEV_FLOW_NATIVE_ROOT, "home"),
    temporaryDirectory: join(process.env.DEV_FLOW_NATIVE_ROOT, "tmp"),
    data: join(process.env.DEV_FLOW_NATIVE_ROOT, "data"),
    workspace: join(process.env.DEV_FLOW_NATIVE_ROOT, "workspace"),
    readback: join(process.env.DEV_FLOW_NATIVE_ROOT, "artifact-readback"),
    preflightMarker: join(process.env.DEV_FLOW_NATIVE_ROOT, "preflight.json"),
    profile: "headless",
  };
}

async function preflight(config) {
  assert.equal(platform(), "darwin");
  assert.equal(arch(), "arm64");
  assert.match(process.version, /^v24\./u);
  assert.match((await execFile("pnpm", ["--version"])).stdout.trim(), /^11\./u);
  assert.equal(await exists(successEvidencePath), false, "native success evidence already exists");
  assert.equal(await exists(historicalFailureEvidencePath), true, "native attempt 1 failure history is missing");
  assert.equal(await exists(failureEvidencePath), false, "native attempt 2 failure evidence already exists");
  await assertFile(config.dshCli);
  await assertFile(config.credentials);
  await assertFile(config.settings);
  await assertFile(config.dshLockfile);
  assert.match(config.sourceCommit, /^[0-9a-f]{40}$/u);
  assert.match(config.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.match(config.coreSha256, /^[0-9a-f]{64}$/u);
  const credentialText = await readFile(config.credentials, "utf8");
  assert.equal(hasYamlKey(credentialText, "DEEPSEEK_API_KEY"), true, "DeepSeek credential is unavailable");
  const root = await realpath(config.root);
  assert.equal(root, config.root, "native root must be canonical");
  assert.equal((await readdir(root)).length, 0, "native root must start empty");
  const artifact = await fileIdentity(await realpath(config.artifact));
  assert.equal(artifact.sha256, config.artifactSha256);
  assert.equal((await execFile(config.dshCli, ["--version"])).stdout.trim(), "0.1.0-rc.8");
  const lockfile = await readFile(config.dshLockfile, "utf8");
  assert.ok(lockfile.includes(`'@deepseek-ai/dsh@0.1.0-rc.8':\n    resolution: {integrity: ${dshIntegrity}}`), "DSH lockfile identity mismatch");
  await execFile("git", ["cat-file", "-e", `${config.sourceCommit}^{commit}`], { cwd: repositoryRoot });
  await execFile("git", ["diff", "--quiet", config.sourceCommit, "--", "LICENSE", "packages/deepseek"], { cwd: repositoryRoot });
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
  await execFile("tar", ["-xzf", config.artifact, "-C", config.readback]);
  const extractedCorePath = join(config.readback, "package", "runtime", "darwin-arm64", "dev-flow");
  const core = await fileIdentity(extractedCorePath);
  assert.equal(core.sha256, config.coreSha256);
  assert.ok((await stat(extractedCorePath)).mode & 0o111);
  assert.equal((await execFile(extractedCorePath, ["version"])).stdout.trim(), "dev-flow 0.5.0");
  const env = dshEnvironment(config);
  await runCommand(config.dshCli, ["plugin", "--profile", config.profile, "add", config.artifact], { cwd: config.workspace, env, timeout: 120_000 });
  const dump = await runCommand(config.dshCli, ["--profile", config.profile, "--dump-config"], { cwd: config.workspace, env, timeout: 30_000 });
  assert.equal(countOccurrences(dump.stdout, "id: dev-flow-deepseek"), 1);
  const installedCore = await fileIdentity(await realpath(join(config.dshHome, "profiles", config.profile, "node_modules", "dev-flow-deepseek", "runtime", "darwin-arm64", "dev-flow")));
  assert.deepEqual(installedCore, core);
  const marker = {
    artifact_sha256: artifact.sha256,
    core_sha256: core.sha256,
    artifact_source_commit: config.sourceCommit,
    runner_repository_commit: (await execFile("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot })).stdout.trim(),
    workspace_head: (await execFile("git", ["rev-parse", "HEAD"], { cwd: config.workspace })).stdout.trim(),
    codex_identity_sha256: await treeDigest(join(repositoryRoot, "packages", "codex")),
  };
  await writeFile(config.preflightMarker, `${JSON.stringify(marker)}\n`, { flag: "wx", mode: 0o600 });
  return { status: "ready", artifact_sha256: artifact.sha256, core_sha256: core.sha256 };
}

async function runNative(config) {
  const marker = JSON.parse(await readFile(config.preflightMarker, "utf8"));
  assert.equal(marker.artifact_sha256, config.artifactSha256);
  assert.equal(marker.core_sha256, config.coreSha256);
  assert.equal(marker.artifact_source_commit, config.sourceCommit);
  assert.equal(await exists(successEvidencePath), false);
  assert.equal(await exists(failureEvidencePath), false);
  const env = dshEnvironment(config);
  const sessionRoot = join(config.dshHome, "sessions");
  const adapterProbe = await runNativeAdapterProbe(config);
  assert.equal(adapterProbe.ordinary_zero_dispatch, true);
  assert.equal(adapterProbe.selector_guard, true);
  assert.equal(adapterProbe.six_tool_handshake, true);

  const ordinary = await runTurn(config, env,
    "Inspect this repository without changing files. Reply with one short sentence. Do not invoke Dev Flow.");
  const ordinarySession = await readNewSession(sessionRoot, ordinary.beforeSessions);
  const ordinarySummary = summarizeSession(ordinarySession.rows);
  assert.equal(ordinarySummary.devFlowCalls.length, 0);
  assert.equal(await coreTaskCount(config.data), 0);

  const initialPrompt = [
    "/dev-flow Implement the bounded plain-profile task in this repository.",
    "Create only src/proof-writer.mjs exporting writeProof() that returns the exact string deepseek-native-proof.",
    `The only authorized automated test command is exactly: ${exactTestCommand}`,
    "Run that exact command at most twice across the whole task. Do not modify package.json, README.md, or test files.",
    "Follow fresh Core actions and payload schemas. At comprehension, wait for an explicit user verdict and never self-confirm.",
  ].join(" ");
  const interrupted = await startTurn(config, env, initialPrompt);
  await waitForRevisionOrExit(config.data, interrupted.child, 2, 180_000);
  process.kill(-interrupted.child.pid, "SIGKILL");
  const interruptedExit = await interrupted.completion;
  assert.equal(interruptedExit.signal, "SIGKILL");
  const interruptedSession = await readNewSession(sessionRoot, interrupted.beforeSessions);
  const interruptedSummary = summarizeSession(interruptedSession.rows);
  assert.equal(interruptedSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assert.ok(interruptedSummary.devFlowCalls.some((call) => call.name === "mcp__dev_flow__dev_flow_apply_action"));
  const interruptedTask = await currentTask(config.data);
  const openResult = firstSuccessfulToolResult(
    interruptedSession.rows,
    "mcp__dev_flow__dev_flow_open_task",
  );
  assert.equal(openResult?.task?.task_id, interruptedTask.task_id);
  const initialRevision = openResult.task.revision;
  const interruptionClassification = interruptedSummary.unansweredDevFlowCallIds.length > 0
    ? "result_unanswered"
    : "result_recorded_before_interrupt";

  const recovery = await runTurn(config, env, [
    "/dev-flow Resume the active DeepSeek task after the prior Host interruption.",
    "The prior mutation result may or may not have been recorded: after handshake and task discovery, read get_task then get_next_action before any apply.",
    "Continue the implementation and exact targeted verification from fresh Core authority.",
    "At comprehension, explain the result and wait for an explicit user verdict.",
  ].join(" "));
  assert.equal(recovery.exit.code, 0);
  const recoverySession = await readNewSession(sessionRoot, recovery.beforeSessions);
  const recoverySummary = summarizeSession(recoverySession.rows);
  assert.equal(recoverySummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  const firstApply = recoverySummary.devFlowCalls.findIndex((call) => call.name === "mcp__dev_flow__dev_flow_apply_action");
  const getTask = recoverySummary.devFlowCalls.findIndex((call) => call.name === "mcp__dev_flow__dev_flow_get_task");
  const getNext = recoverySummary.devFlowCalls.findIndex((call) => call.name === "mcp__dev_flow__dev_flow_get_next_action");
  assert.ok(getTask >= 0 && getNext > getTask && firstApply > getNext);
  assertMutationIdentities(recoverySummary.devFlowCalls);

  const beforeRefactor = await currentTask(config.data);
  assert.equal(beforeRefactor.current_node, "COMPREHENSION_REVIEW");
  assert.equal(beforeRefactor.task_id, interruptedTask.task_id);

  const refactor = await runTurn(config, env, [
    "/dev-flow I cannot yet maintain this implementation because the returned proof string is unexplained.",
    "Use the current developer verdict and a fresh Core action to enter REFACTOR.",
    "Refactor only src/proof-writer.mjs by naming the proof value clearly, run the one authorized test command,",
    "return through TEST, and stop again at COMPREHENSION_REVIEW for a new verdict.",
  ].join(" "));
  assert.equal(refactor.exit.code, 0);
  const refactorSession = await readNewSession(sessionRoot, refactor.beforeSessions);
  const refactorSummary = summarizeSession(refactorSession.rows);
  assert.equal(refactorSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assertMutationIdentities(refactorSummary.devFlowCalls);
  const afterRefactor = await currentTask(config.data);
  assert.equal(afterRefactor.current_node, "COMPREHENSION_REVIEW");
  assert.ok(afterRefactor.revision > beforeRefactor.revision);

  const confirmation = await runTurn(config, env, [
    "/dev-flow Resume the active task. I explicitly confirm that I can explain and maintain the implementation, guard boundary, and targeted test.",
    "Use that current user verdict only with fresh Core transitions, then complete delivery if Core permits it.",
  ].join(" "));
  assert.equal(confirmation.exit.code, 0);
  const confirmationSession = await readNewSession(sessionRoot, confirmation.beforeSessions);
  const confirmationSummary = summarizeSession(confirmationSession.rows);
  assert.equal(confirmationSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assertMutationIdentities(confirmationSummary.devFlowCalls);

  const task = await currentTask(config.data);
  assert.equal(task.current_node, "DONE");
  assert.equal(task.origin_host, "deepseek");
  assert.equal(task.task_id, interruptedTask.task_id);
  const allSummaries = [ordinarySummary, interruptedSummary, recoverySummary, refactorSummary, confirmationSummary];
  const devFlowNames = allSummaries.flatMap((summary) => summary.devFlowCalls.map((call) => call.name));
  assert.ok(devFlowNames.every((name) => exactDevFlowNames().has(name)));
  const commands = allSummaries.flatMap((summary) => summary.bashCommands);
  const testLike = commands.filter((command) => command.includes("node --test"));
  assert.ok(testLike.length >= 1 && testLike.length <= 2);
  assert.ok(testLike.every((command) => command === exactTestCommand));
  const changed = await gitChangedPaths(config.workspace);
  assert.deepEqual(changed, ["src/proof-writer.mjs"]);
  assert.match(await readFile(join(config.workspace, "src", "proof-writer.mjs"), "utf8"), /deepseek-native-proof/u);
  const info = await readServerInfoFromSessions(allSummaries);
  assert.equal(info.schema_version, 2);
  assert.equal(info.core_limits_version, "0.2");
  assert.equal(info.process_id, "standard-development");
  assert.equal(info.process_version, 1);
  assert.deepEqual(info.qualified_tools, [...exactDevFlowNames()]);

  const beforeLifecycle = await retainedIdentity(config, task.task_id);
  assert.equal(beforeLifecycle.codex, marker.codex_identity_sha256);
  await runCommand(config.dshCli, ["plugin", "--profile", config.profile, "remove", "dev-flow-deepseek"], {
    cwd: config.workspace, env, timeout: 120_000,
  });
  const removedDump = await runCommand(config.dshCli, ["--profile", config.profile, "--dump-config"], {
    cwd: config.workspace, env, timeout: 30_000,
  });
  assert.equal(removedDump.stdout.includes("id: dev-flow-deepseek"), false);
  assert.equal(await exists(installedPackageRoot(config)), false);
  const repeatedRemoval = await runCommandAllowFailure(
    config.dshCli,
    ["plugin", "--profile", config.profile, "remove", "dev-flow-deepseek"],
    { cwd: config.workspace, env, timeout: 120_000 },
  );
  assert.ok(Number.isInteger(repeatedRemoval.code));
  assert.deepEqual(await retainedIdentity(config, task.task_id), beforeLifecycle);

  await runCommand(config.dshCli, ["plugin", "--profile", config.profile, "add", config.artifact], {
    cwd: config.workspace, env, timeout: 120_000,
  });
  const reinstalledDump = await runCommand(config.dshCli, ["--profile", config.profile, "--dump-config"], {
    cwd: config.workspace, env, timeout: 30_000,
  });
  assert.equal(countOccurrences(reinstalledDump.stdout, "id: dev-flow-deepseek"), 1);
  const reinstalledCore = await fileIdentity(await realpath(join(installedPackageRoot(config), "runtime", "darwin-arm64", "dev-flow")));
  assert.equal(reinstalledCore.sha256, config.coreSha256);

  const reopen = await runTurn(config, env, [
    "/dev-flow Reopen the compatible terminal task read-only after exact-artifact reinstall.",
    "Perform the server-info handshake and fresh task/action reads, report the existing Core DONE result, and do not mutate it.",
  ].join(" "));
  assert.equal(reopen.exit.code, 0);
  const reopenSession = await readNewSession(sessionRoot, reopen.beforeSessions);
  const reopenSummary = summarizeSession(reopenSession.rows);
  assert.equal(reopenSummary.devFlowCalls[0]?.name, "mcp__dev_flow__dev_flow_server_info");
  assert.equal(reopenSummary.devFlowCalls.some((call) => call.name === "mcp__dev_flow__dev_flow_apply_action"), false);
  assert.equal(reopenSummary.devFlowCalls.some((call) => call.name === "mcp__dev_flow__dev_flow_cancel_task"), false);
  const reopenedTask = await currentTask(config.data);
  assert.equal(reopenedTask.task_id, task.task_id);
  assert.equal(reopenedTask.revision, task.revision);
  assert.equal(reopenedTask.current_node, "DONE");
  assert.deepEqual(await retainedIdentity(config, task.task_id), beforeLifecycle);

  const artifact = await fileIdentity(config.artifact);
  const corePath = join(config.readback, "package", "runtime", "darwin-arm64", "dev-flow");
  const core = await fileIdentity(corePath);
  return {
    evidence_class: "final_native_graph_acceptance",
    status: "passed",
    native_attempt: nativeAttempt,
    source_commit: config.sourceCommit,
    artifact: {
      filename: basename(config.artifact), size: artifact.size, sha256: artifact.sha256,
    },
    embedded_core: {
      filename: "runtime/darwin-arm64/dev-flow", size: core.size, sha256: core.sha256,
      reported_version: (await execFile(corePath, ["version"])).stdout.trim(),
    },
    dsh: { version: "0.1.0-rc.8", integrity: dshIntegrity, source_commit: dshSourceCommit },
    runtime: {
      node: process.version,
      pnpm: (await execFile("pnpm", ["--version"])).stdout.trim(),
      os: platform(), architecture: arch(),
      profile_identity_sha256: sha256(`${await realpath(config.dshHome)}/${config.profile}`),
    },
    core_contract: info,
    task: {
      task_id: task.task_id,
      initial_revision: initialRevision,
      resumed_revision: beforeRefactor.revision,
      terminal_revision: task.revision,
      terminal_state: task.current_node,
    },
    outcomes: {
      ordinary_zero_dispatch: "passed",
      selector_guard: "passed",
      six_tool_handshake: "passed",
      graph_progression: "passed",
      restart_resume: "passed",
      uncertain_mutation_recovery: interruptionClassification === "result_unanswered" || interruptionClassification === "result_recorded_before_interrupt" ? "passed" : "failed",
      comprehension: "passed",
      refactor_retest: "passed",
      core_done: "passed",
      remove_readback: "passed",
      data_retention: "passed",
      repository_retention: "passed",
      codex_non_interference: "passed",
      exact_reinstall: "passed",
      same_task_reopen: "passed",
    },
    release_effects: { npm_publish: false, git_tag: false, github_release: false, version_change: false },
  };
}

async function runNativeAdapterProbe(config) {
  const installedPackage = await realpath(installedPackageRoot(config));
  const packageRequire = createRequire(join(installedPackage, "package.json"));
  const toolsRequire = createRequire(packageRequire.resolve("@deepseek-ai/dsh-tools"));
  const [cordis, systemPrompt, tools, skills, integration] = await Promise.all([
    importResolved(packageRequire, "@deepseek-ai/cordis"),
    importResolved(toolsRequire, "@deepseek-ai/dsh-system-prompt"),
    importResolved(packageRequire, "@deepseek-ai/dsh-tools"),
    importResolved(packageRequire, "@deepseek-ai/dsh-skill"),
    import(pathToFileURL(join(installedPackage, "lib", "index.mjs")).href),
  ]);
  const ctx = new cordis.Context();
  const fibers = [];
  fibers.push(await ctx.plugin(systemPrompt.default));
  fibers.push(await ctx.plugin(tools.default));
  fibers.push(await ctx.plugin(skills.default));
  const previousDataDirectory = process.env.DEV_FLOW_DATA_DIR;
  process.env.DEV_FLOW_DATA_DIR = config.data;
  try {
    fibers.push(await ctx.plugin(integration));
  } finally {
    if (previousDataDirectory === undefined) delete process.env.DEV_FLOW_DATA_DIR;
    else process.env.DEV_FLOW_DATA_DIR = previousDataDirectory;
  }

  try {
    await waitForQualifiedTools(ctx);
    const toolNames = ctx.tools.schemas()
      .map((schema) => schema.name)
      .filter((name) => name.startsWith("mcp__dev_flow__"))
      .sort();
    assert.deepEqual(toolNames, [...exactDevFlowNames()].sort());
    const skill = (await ctx.skills.list()).find((candidate) => candidate.name === "dev-flow");
    assert.notEqual(skill, undefined);
    assert.deepEqual(skill.invocation, { modelInvocable: false, userInvocable: true });
    const beforeTasks = await coreTaskCount(config.data);
    assert.equal(beforeTasks, 0);

    const serverInfoTool = "mcp__dev_flow__dev_flow_server_info";
    const denialCases = [
      { label: "no-agent", agent: undefined, expected: /DEV_FLOW_NO_AGENT/u },
      { label: "ordinary", agent: (callId) => probeAgent("ordinary text", callId, ctx), expected: /DEV_FLOW_SELECTOR_REQUIRED/u },
      { label: "malformed", agent: (callId) => probeAgent("/dev-flow, /dev-flowx //dev-flow path/dev-flow", callId, ctx), expected: /DEV_FLOW_SELECTOR_REQUIRED/u },
      { label: "previous-turn", agent: (callId) => previousTurnProbeAgent(callId, ctx), expected: /DEV_FLOW_SELECTOR_REQUIRED/u },
      { label: "plugin-injection", agent: (callId) => injectedSelectorProbeAgent("plugin", callId, ctx), expected: /DEV_FLOW_SELECTOR_REQUIRED/u },
      { label: "skill-injection", agent: (callId) => injectedSelectorProbeAgent("skill-invocation", callId, ctx), expected: /DEV_FLOW_SELECTOR_REQUIRED/u },
    ];
    for (const denial of denialCases) {
      const callId = `probe-${denial.label}`;
      const result = await ctx.tools.execute({
        callId,
        name: serverInfoTool,
        arguments: {},
        ...(denial.agent === undefined ? {} : { agent: denial.agent(callId) }),
        signal: new AbortController().signal,
      });
      assert.equal(result.isError, true, denial.label);
      assert.match(textResult(result), denial.expected, denial.label);
    }
    assert.equal(await coreTaskCount(config.data), beforeTasks);

    const authorized = await ctx.tools.execute({
      callId: "probe-authorized",
      name: serverInfoTool,
      arguments: {},
      agent: probeAgent("/dev-flow probe", "probe-authorized", ctx),
      signal: new AbortController().signal,
    });
    const envelope = JSON.parse(textResult(authorized));
    assert.equal(authorized.isError, false);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.result.schema_version, 2);
    assert.equal(await coreTaskCount(config.data), beforeTasks);
    return {
      ordinary_zero_dispatch: true,
      selector_guard: true,
      six_tool_handshake: true,
    };
  } finally {
    for (const fiber of [...fibers].reverse()) await fiber.dispose();
  }
}

function probeAgent(text, callId, ctx) {
  const events = [
    { seq: 0, time: 0, type: "turn/start", data: { turn: 1 } },
    { seq: 1, time: 1, type: "user/message", data: {
      id: `user-${callId}`, role: "user", source: { kind: "user" },
      content: [{ type: "text", text }],
    } },
    { seq: 2, time: 2, type: "tool/call", data: {
      turn: 1, step: 1, callId, name: "mcp__dev_flow__dev_flow_server_info", arguments: "{}",
    } },
  ];
  return { status: "running", session: { events }, ctx };
}

function previousTurnProbeAgent(callId, ctx) {
  return { status: "running", session: { events: [
    { seq: 0, time: 0, type: "turn/start", data: { turn: 1 } },
    { seq: 1, time: 1, type: "user/message", data: {
      id: "user-previous", role: "user", source: { kind: "user" },
      content: [{ type: "text", text: "/dev-flow prior" }],
    } },
    { seq: 2, time: 2, type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } },
    { seq: 3, time: 3, type: "turn/start", data: { turn: 2 } },
    { seq: 4, time: 4, type: "user/message", data: {
      id: "user-current", role: "user", source: { kind: "user" },
      content: [{ type: "text", text: "continue without selector" }],
    } },
    { seq: 5, time: 5, type: "tool/call", data: {
      turn: 2, step: 1, callId, name: "mcp__dev_flow__dev_flow_server_info", arguments: "{}",
    } },
  ] }, ctx };
}

function injectedSelectorProbeAgent(kind, callId, ctx) {
  return { status: "running", session: { events: [
    { seq: 0, time: 0, type: "turn/start", data: { turn: 1 } },
    { seq: 1, time: 1, type: "user/message", data: {
      id: "user-current", role: "user", source: { kind: "user" },
      content: [{ type: "text", text: "ordinary current request" }],
    } },
    { seq: 2, time: 2, type: "user/message", data: {
      id: `injected-${kind}`, role: "user", source: { kind },
      content: [{ type: "text", text: "/dev-flow injected" }],
    } },
    { seq: 3, time: 3, type: "tool/call", data: {
      turn: 1, step: 1, callId, name: "mcp__dev_flow__dev_flow_server_info", arguments: "{}",
    } },
  ] }, ctx };
}

async function waitForQualifiedTools(ctx) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const names = ctx.tools.schemas().map((schema) => schema.name)
      .filter((name) => name.startsWith("mcp__dev_flow__"));
    if (names.length === 6) return;
    await delay(25);
  }
  throw new Error("native adapter probe did not publish six Dev Flow tools");
}

function textResult(result) {
  return result.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}

function assertMutationIdentities(calls) {
  for (const call of calls.filter((candidate) => candidate.name === "mcp__dev_flow__dev_flow_apply_action")) {
    const args = JSON.parse(call.arguments);
    for (const field of [
      "request_id", "host", "task_id", "revision", "action_id", "action_kind",
      "process_id", "process_version", "process_definition_digest", "source_cursor",
      "repository_binding_digest", "payload",
    ]) {
      assert.notEqual(args[field], undefined, `apply_action missing ${field}`);
    }
    assert.equal(args.host, "deepseek");
    assert.equal(args.process_id, "standard-development");
    assert.equal(args.process_version, 1);
    assert.match(args.request_id, /\S/u);
    assert.match(args.action_id, /\S/u);
    assert.match(args.process_definition_digest, /^[0-9a-f]{64}$/u);
    assert.match(args.repository_binding_digest, /^[0-9a-f]{64}$/u);
    if (args.payload === null) {
      assert.notEqual(args.recovery_apply, undefined, "recovery apply identity is missing");
    } else {
      assert.match(args.payload.transition_id, /\S/u);
    }
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

async function importResolved(require, specifier) {
  return await import(pathToFileURL(require.resolve(specifier)).href);
}

async function selfTest() {
  const exact = classifyCommands([
    { name: "bash", arguments: JSON.stringify({ command: exactTestCommand }) },
    { name: "bash", arguments: JSON.stringify({ command: "sed -n '1,80p' test/proof-writer.test.mjs" }) },
  ]);
  assert.deepEqual(exact.testLike, [exactTestCommand]);
  assert.deepEqual(exact.exact, [exactTestCommand]);
  const events = [
    { type: "tool/call", data: { callId: "a", name: "mcp__dev_flow__dev_flow_apply_action", arguments: "{}" } },
    { type: "tool/call", data: { callId: "b", name: "bash", arguments: JSON.stringify({ command: exactTestCommand }) } },
    { type: "tool/result", data: { message: { content: [{ type: "tool-result", toolCallId: "b", content: [] }] } } },
  ];
  const summary = summarizeEvents(events);
  assert.deepEqual(summary.unansweredDevFlowCallIds, ["a"]);
  assert.deepEqual(summary.bashCommands, [exactTestCommand]);
  const frames = Buffer.concat([zstdCompressSync(Buffer.from("one\n")), zstdCompressSync(Buffer.from("two\n"))]);
  assert.equal(decompressZstdFrames(frames), "one\ntwo\n");
  const historicalFailure = JSON.parse(await readFile(historicalFailureEvidencePath, "utf8"));
  assertClosedKeys(historicalFailure, [
    "evidence_class", "status", "native_attempt", "failure_class",
    "bounded_diagnostic", "artifact_sha256", "publication_effects",
  ]);
  assert.equal(historicalFailure.status, "failed");
  assert.equal(historicalFailure.native_attempt, 1);
  assert.equal(historicalFailure.bounded_diagnostic, "interrupted mutation result was already recorded");
  assert.match(historicalFailure.artifact_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(historicalFailure.publication_effects, false);
  assert.equal(JSON.stringify(historicalFailure).includes(homedir()), false);
  assert.throws(() => assertEvidenceShape({}), /Expected values to be strictly deep-equal/u);
}

async function startTurn(config, env, prompt) {
  const beforeSessions = new Set(await sessionFiles(join(config.dshHome, "sessions")));
  const child = spawn(config.dshCli, ["--profile", config.profile, prompt], {
    cwd: config.workspace, env, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = boundedCollector(child.stdout, 1_048_576);
  const stderr = boundedCollector(child.stderr, 1_048_576);
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signalName) => resolve({ code, signal: signalName, stdout: stdout.text(), stderr: stderr.text() }));
  });
  return { child, completion, beforeSessions };
}

async function runTurn(config, env, prompt) {
  const running = await startTurn(config, env, prompt);
  let exit;
  try {
    exit = await withTimeout(running.completion, 240_000, "DSH headless turn timed out");
  } catch (error) {
    await terminateTurn(running);
    throw error;
  }
  if (exit.code !== 0) throw new Error(`DSH_HEADLESS_FAILED: ${exit.stderr.slice(0, 500)}`);
  return { ...running, exit };
}

async function terminateTurn(running) {
  if (running.child.exitCode !== null || running.child.signalCode !== null) return;
  try {
    process.kill(-running.child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
  await Promise.race([running.completion, delay(1_000)]);
  if (running.child.exitCode === null && running.child.signalCode === null) {
    try {
      process.kill(-running.child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    await withTimeout(running.completion, 5_000, "timed-out DSH process group did not terminate");
  }
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

async function waitForRevisionOrExit(dataDirectory, child, revision, timeoutMs) {
  const databasePath = join(dataDirectory, "dev-flow.db");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("DSH exited before the interruption checkpoint");
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(databasePath, { readOnly: true });
      const row = db.prepare("SELECT MAX(revision) AS revision FROM tasks").get();
      db.close();
      if (Number(row.revision ?? 0) >= revision) return;
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
  };
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
    "dev_flow_get_next_action", "dev_flow_apply_action", "dev_flow_cancel_task",
  ];
  assert.deepEqual(info.tools, rawTools);
  assert.deepEqual(info.method_profiles, ["plain", "spec-kit", "openspec"]);
  return {
    schema_version: info.schema_version,
    core_limits_version: info.core_limits_version,
    process_id: info.supported_processes[0].process_id,
    process_version: info.supported_processes[0].process_version,
    process_definition_digest: info.supported_processes[0].definition_digest,
    qualified_tools: [...exactDevFlowNames()],
  };
}

function classifyCommands(calls) {
  const commands = calls.filter((call) => call.name === "bash").map((call) => JSON.parse(call.arguments).command);
  return { testLike: commands.filter((command) => command.includes("node --test")), exact: commands.filter((command) => command === exactTestCommand) };
}

function exactDevFlowNames() {
  return new Set([
    "mcp__dev_flow__dev_flow_server_info", "mcp__dev_flow__dev_flow_open_task",
    "mcp__dev_flow__dev_flow_get_task", "mcp__dev_flow__dev_flow_get_next_action",
    "mcp__dev_flow__dev_flow_apply_action", "mcp__dev_flow__dev_flow_cancel_task",
  ]);
}

async function validateEvidence(evidence) {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(schema.oneOf.length, 2);
  assertEvidenceShape(evidence);
  const encoded = JSON.stringify(evidence);
  for (const forbidden of [configuredPrivatePrefix(), repositoryRoot, homedir(), "DEEPSEEK_API_KEY", "BEGIN PRIVATE KEY"]) {
    assert.equal(encoded.includes(forbidden), false, `evidence contains forbidden value ${forbidden}`);
  }
}

function assertEvidenceShape(evidence) {
  assertClosedKeys(evidence, [
    "evidence_class", "status", "native_attempt", "source_commit", "artifact",
    "embedded_core", "dsh", "runtime", "core_contract", "task", "outcomes", "release_effects",
  ]);
  assert.equal(evidence.evidence_class, "final_native_graph_acceptance");
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.native_attempt, nativeAttempt);
  assert.match(evidence.source_commit, /^[0-9a-f]{40}$/u);
  assertClosedKeys(evidence.artifact, ["filename", "size", "sha256"]);
  assert.equal(basename(evidence.artifact.filename), evidence.artifact.filename);
  assert.ok(evidence.artifact.size > 0);
  assert.match(evidence.artifact.sha256, /^[0-9a-f]{64}$/u);
  assertClosedKeys(evidence.embedded_core, ["filename", "size", "sha256", "reported_version"]);
  assert.equal(evidence.embedded_core.filename, "runtime/darwin-arm64/dev-flow");
  assert.ok(evidence.embedded_core.size > 0);
  assert.match(evidence.embedded_core.sha256, /^[0-9a-f]{64}$/u);
  assert.equal(evidence.embedded_core.reported_version, "dev-flow 0.5.0");
  assert.deepEqual(evidence.dsh, {
    version: "0.1.0-rc.8", integrity: dshIntegrity, source_commit: dshSourceCommit,
  });
  assertClosedKeys(evidence.runtime, ["node", "pnpm", "os", "architecture", "profile_identity_sha256"]);
  assert.match(evidence.runtime.node, /^v24\./u);
  assert.match(evidence.runtime.pnpm, /^11\./u);
  assert.equal(evidence.runtime.os, "darwin");
  assert.equal(evidence.runtime.architecture, "arm64");
  assert.match(evidence.runtime.profile_identity_sha256, /^[0-9a-f]{64}$/u);
  assertClosedKeys(evidence.core_contract, [
    "schema_version", "core_limits_version", "process_id", "process_version",
    "process_definition_digest", "qualified_tools",
  ]);
  assert.equal(evidence.core_contract.schema_version, 2);
  assert.equal(evidence.core_contract.core_limits_version, "0.2");
  assert.equal(evidence.core_contract.process_id, "standard-development");
  assert.equal(evidence.core_contract.process_version, 1);
  assert.match(evidence.core_contract.process_definition_digest, /^[0-9a-f]{64}$/u);
  assert.deepEqual(evidence.core_contract.qualified_tools, [...exactDevFlowNames()]);
  assertClosedKeys(evidence.task, ["task_id", "initial_revision", "resumed_revision", "terminal_revision", "terminal_state"]);
  assert.match(evidence.task.task_id, /^task-[0-9a-f]+$/u);
  assert.ok(evidence.task.initial_revision >= 1);
  assert.ok(evidence.task.resumed_revision >= evidence.task.initial_revision);
  assert.ok(evidence.task.terminal_revision >= evidence.task.resumed_revision);
  assert.equal(evidence.task.terminal_state, "DONE");
  assertClosedKeys(evidence.outcomes, [
    "ordinary_zero_dispatch", "selector_guard", "six_tool_handshake", "graph_progression",
    "restart_resume", "uncertain_mutation_recovery", "comprehension", "refactor_retest",
    "core_done", "remove_readback", "data_retention", "repository_retention",
    "codex_non_interference", "exact_reinstall", "same_task_reopen",
  ]);
  assert.ok(Object.values(evidence.outcomes).every((value) => value === "passed"));
  assert.deepEqual(evidence.release_effects, {
    npm_publish: false, git_tag: false, github_release: false, version_change: false,
  });
}

function assertClosedKeys(value, expected) {
  assert.equal(value !== null && typeof value === "object" && !Array.isArray(value), true);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}

function configuredPrivatePrefix() {
  return process.env.DEV_FLOW_NATIVE_ROOT ?? "/private-path-not-configured";
}

function sanitizedFailure(error, config) {
  let message = error instanceof Error ? error.message : String(error);
  for (const path of [
    config.root, config.dshHome, config.data, config.workspace, config.artifact,
    config.credentials, config.settings, config.dshLockfile, repositoryRoot, homedir(),
  ]) {
    message = message.replaceAll(path, "<private-path>");
  }
  return {
    evidence_class: "native_deepseek_graph_journey",
    status: "failed",
    native_attempt: nativeAttempt,
    failure_class: error instanceof assert.AssertionError ? "acceptance_assertion" : "native_runner_error",
    bounded_diagnostic: message.slice(0, 500),
    artifact_sha256: config.artifactSha256,
    publication_effects: false,
  };
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

async function runCommandAllowFailure(command, args, options) {
  try {
    return { code: 0, ...await runCommand(command, args, options) };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

function hasYamlKey(text, key) { return text.split("\n").some((line) => line.includes(":" ) && line.split(":", 1)[0].trim() === key); }
function countOccurrences(text, pattern) { return text.split(pattern).length - 1; }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function fileIdentity(path) { const bytes = await readFile(path); return { size: bytes.length, sha256: sha256(bytes) }; }
async function assertFile(path) { assert.equal((await stat(path)).isFile(), true, path); }
async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function withTimeout(promise, ms, message) { return Promise.race([promise, delay(ms).then(() => { throw new Error(message); })]); }
