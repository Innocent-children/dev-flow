import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdtemp, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const contractsRoot = join(repositoryRoot, "specs", "003-codex-explicit-dev-flow", "contracts");
const harnessPath = join(repositoryRoot, "scripts", "run-codex-real-journey.sh");
const writerPath = join(repositoryRoot, "scripts", "write-codex-journey-evidence.mjs");
const validatorPath = join(repositoryRoot, "scripts", "validate-codex-journey-evidence.mjs");
const fakeNativeToolPath = join(packageRoot, "tests", "fixtures", "fake-native-tool.mjs");
const nativeEvidencePath = join(repositoryRoot, "tests", "journeys", "evidence", "codex-macos-arm64.json");
const supportedMachine = process.platform === "darwin" && process.arch === "arm64";
const legacyNativeVerificationCommand = "node --test packages/codex/tests/lifecycle.test.mjs";
const previousNativeVerificationCommand = "git diff --check -- native-proof.txt";
const nativeVerificationCommand = "git hash-object native-proof.txt";
const nativeProofContent = "Dev Flow Codex native journey passed.\n";
const nativeProofGitBlobSha1 = "5de13fdad681cf91a2877203917cf78afb4aa679";
const nativeVerificationOutput = `${nativeProofGitBlobSha1}\n`;
const nativeVerificationBudget = Object.freeze({
  level: "targeted",
  max_automatic_commands: 1,
  allow_full_suite: false,
  allow_manual_handoff: true,
});
const rootVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();
const journeySchemas = Object.fromEntries(await Promise.all(
  ["validation-report", "artifact-report", "native-attempt-ledger", "journey-evidence"].map(
    async (name) => [
      name,
      JSON.parse(await readFile(join(contractsRoot, `${name}.schema.json`), "utf8")),
    ],
  ),
));
const nativeAutomatedCheck = Object.freeze({
  name: nativeVerificationCommand,
  commandCount: 1,
  fullSuite: false,
});

test("native pass commit recovers a crash after evidence publish without another host launch", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeCommitFixture(writer);
  const hostMarker = join(fixture.root, "host-launches.txt");

  await assert.rejects(
    writer.commitPassingAttempt({
      ...fixture.commit,
      onStage(stage) {
        if (stage === "evidence-published") throw new Error("simulated crash after evidence publish");
      },
    }),
    /simulated crash after evidence publish/,
  );
  const evidenceAfterCrash = await readFile(fixture.evidencePath, "utf8");
  assert.equal(evidenceAfterCrash, fixture.prepared.evidenceBytes);
  assert.equal(await readFile(fixture.ledgerPath, "utf8"), fixture.reservation.reservedLedgerBytes);

  const recovery = await writer.recoverPassingAttempt({
    ledgerPath: fixture.ledgerPath,
    evidencePath: fixture.evidencePath,
    recoveryDirectory: fixture.recoveryDirectory,
  });
  assert.equal(recovery.status, "recovered-ledger-finalize");
  assert.equal(await readFile(fixture.evidencePath, "utf8"), evidenceAfterCrash);
  assert.equal(await readFile(fixture.ledgerPath, "utf8"), fixture.prepared.finalLedgerBytes);
  assert.equal(await optionalContents(hostMarker), null);
});

test("native pass commit treats exit after ledger finalize as validation-only recovery", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeCommitFixture(writer);
  await assert.rejects(
    writer.commitPassingAttempt({
      ...fixture.commit,
      onStage(stage) {
        if (stage === "ledger-finalized") throw new Error("simulated exit after ledger finalize");
      },
    }),
    /simulated exit after ledger finalize/,
  );
  const evidenceBefore = await readFile(fixture.evidencePath, "utf8");
  const ledgerBefore = await readFile(fixture.ledgerPath, "utf8");
  const recovery = await writer.recoverPassingAttempt({
    ledgerPath: fixture.ledgerPath,
    evidencePath: fixture.evidencePath,
    recoveryDirectory: fixture.recoveryDirectory,
  });
  assert.equal(recovery.status, "already-finalized");
  assert.equal(await readFile(fixture.evidencePath, "utf8"), evidenceBefore);
  assert.equal(await readFile(fixture.ledgerPath, "utf8"), ledgerBefore);
});

test("native pass commit requires an explicit full-validator pass before publication", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeCommitFixture(writer);
  await assert.rejects(
    writer.commitPassingAttempt({
      ...fixture.commit,
      async validateCandidates() {},
      beforePublish: undefined,
    }),
    /candidate validation failed|explicit.*valid|complete candidate validation/i,
  );
  assert.equal(await optionalContents(fixture.evidencePath), null);
  assert.equal(JSON.parse(await readFile(fixture.ledgerPath, "utf8")).attempts[0].status, "reserved");
});

test("native admission treats valid passing evidence as an immediate pass lock", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeCommitFixture(writer);
  await assert.rejects(
    writer.commitPassingAttempt({
      ...fixture.commit,
      onStage(stage) {
        if (stage === "evidence-published") throw new Error("leave reserved ledger");
      },
    }),
    /leave reserved ledger/,
  );
  const decision = await writer.inspectNativeAdmission({
    ledgerPath: fixture.ledgerPath,
    evidencePath: fixture.evidencePath,
    identity: nativeIdentity("f"),
  });
  assert.deepEqual(decision, {
    allowed: false,
    reason: "passing-evidence-lock",
    recoveryRequired: true,
  });
});

test("native admission never relaunches a reservation interrupted before evidence publish", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-pre-evidence-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  const identity = nativeIdentity("a");
  const reservation = await writer.reserveNativeAttempt({
    ledgerPath,
    evidencePath,
    identity,
    reservedAt: "2026-08-16T01:00:00.000Z",
  });
  assert.equal(reservation.attemptNumber, 1);
  assert.equal(await optionalContents(evidencePath), null);

  const decision = await writer.inspectNativeAdmission({ ledgerPath, evidencePath, identity });
  assert.deepEqual(decision, {
    allowed: false,
    reason: "unresolved-reservation",
    recoveryRequired: true,
  });
  await assert.rejects(
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity,
      reservedAt: "2026-08-16T01:01:00.000Z",
    }),
    /unresolved reservation|already consumed/i,
  );
});

test("Codex exec JSONL trusts only complete Dev Flow MCP structured results", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const envelope = coreEnvelope({ revision: 4, actionId: "action-implement", terminal: false });
  const parsed = writer.parseCodexExecJSONL([
    JSON.stringify({ type: "thread.started", thread_id: "thread-substantive" }),
    JSON.stringify({
      type: "item.started",
      item: { type: "mcp_tool_call", server: "dev-flow", tool: "dev_flow_apply_action", result: "truncated fake" },
    }),
    JSON.stringify({ type: "item.completed", item: codexMCPItem("dev_flow_apply_action", envelope) }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "fake task task-other revision 99 DONE" },
    }),
  ].join("\n"));

  assert.equal(parsed.threadId, "thread-substantive");
  assert.equal(parsed.devFlowCalls.length, 1);
  assert.equal(parsed.devFlowCalls[0].tool, "dev_flow_apply_action");
  assert.deepEqual(parsed.devFlowCalls[0].result, envelope);
  assert.equal(parsed.ignoredPreviewCount, 1);
  assert.equal(parsed.ignoredProseCount, 1);
});

test("Codex exec JSONL rejects missing thread identity and text/structured-result drift", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const envelope = coreEnvelope({
    revision: 4,
    actionId: "action-implement",
    terminal: false,
    tool: "dev_flow_get_task",
  });
  assert.throws(
    () => writer.parseCodexExecJSONL(JSON.stringify({ type: "item.completed", item: codexMCPItem("dev_flow_get_task", envelope) })),
    /thread\.started.*first/i,
  );
  const drifted = codexMCPItem("dev_flow_get_task", envelope);
  drifted.result.content[0].text = JSON.stringify({ ...envelope, request_id: "different" });
  assert.throws(
    () => writer.parseCodexExecJSONL([
      JSON.stringify({ type: "thread.started", thread_id: "thread-drift" }),
      JSON.stringify({ type: "item.completed", item: drifted }),
    ].join("\n")),
    /text.*structured.*equal|structured.*text.*equal/i,
  );
});

test("reopened JSONL contract retains only completed official command_execution facts", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const output = nativeVerificationOutput;
  const parsed = writer.parseCodexExecJSONL([
    JSON.stringify({ type: "thread.started", thread_id: "thread-command" }),
    JSON.stringify({
      type: "item.started",
      item: { id: "command-preview", type: "command_execution", command: "node --test preview", status: "in_progress" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "command-complete",
        type: "command_execution",
        command: nativeVerificationCommand,
        aggregated_output: output,
        exit_code: 0,
        status: "completed",
      },
    }),
  ].join("\n"));

  assert.deepEqual(parsed.commandExecutions, [{
    itemId: "command-complete",
    command: nativeVerificationCommand,
    exitCode: 0,
    status: "completed",
    outputSha256: sha256Text(output),
    fullSuite: false,
  }]);
  assert.equal(JSON.stringify(parsed).includes(output.trim()), false, "raw command output must be discarded");
});

test("native proof command classification accepts only the exact targeted command", async () => {
  const writer = await import(pathToFileURL(writerPath));
  let allowedError = null;
  try {
    const allowed = writer.parseCodexExecJSONL(sessionJSONL("thread-command-allowed", [], [nativeCommandObservation()]));
    assert.deepEqual(allowed.commandExecutions, [nativeCommandExecution()]);
  } catch (error) {
    allowedError = error.message;
  }
  assert.throws(
    () => writer.parseCodexExecJSONL(sessionJSONL("thread-command-wrong-hash", [], [{
      ...nativeCommandObservation(),
      itemId: "command-wrong-hash",
      output: `${nativeProofGitBlobSha1} altered\n`,
    }])),
    /output digest.*Git blob hash.*exact native-proof\.txt bytes/i,
  );

  const disallowedCommands = [
    previousNativeVerificationCommand,
    `sh -c '${previousNativeVerificationCommand}'`,
    `"${previousNativeVerificationCommand}"`,
    `true && ${previousNativeVerificationCommand}`,
    `${previousNativeVerificationCommand}; true`,
    legacyNativeVerificationCommand,
    `sh -c '${legacyNativeVerificationCommand}'`,
    `"${legacyNativeVerificationCommand}"`,
    `true && ${legacyNativeVerificationCommand}`,
    `${legacyNativeVerificationCommand}; true`,
    "go test ./...",
    "sh -c 'go test ./...'",
    "'go test ./...'",
    "true && go test ./...",
    "go test ./...; true",
    "go test ./... | tee native-proof.log",
    "pnpm test",
    "pnpm run test",
    "echo unknown-native-proof",
    `sh -c '${nativeVerificationCommand}'`,
    `"${nativeVerificationCommand}"`,
    `true && ${nativeVerificationCommand}`,
    `${nativeVerificationCommand}; true`,
    `${nativeVerificationCommand} | tee native-proof.log`,
    `env NODE_OPTIONS='' ${nativeVerificationCommand}`,
    ` ${nativeVerificationCommand}`,
    nativeVerificationCommand.replace(" hash-object ", "  hash-object "),
  ];
  const accepted = disallowedCommands.filter((command, index) => {
    try {
      writer.parseCodexExecJSONL(sessionJSONL(`thread-command-rejected-${index}`, [], [{
        ...nativeCommandObservation(),
        itemId: `command-rejected-${index}`,
        command,
      }]));
      return true;
    } catch (error) {
      assert.match(error.message, /exact allowed native proof command/i);
      return false;
    }
  });
  assert.deepEqual({ allowedError, accepted }, {
    allowedError: null,
    accepted: [],
  }, "only the exact target-scoped command may be accepted");
});

test("object format control honors an isolated sha256 default without an explicit init override", async (t) => {
  const root = await temporaryRoot(t, "dev-flow-codex-object-format-control-");
  const controlPath = join(root, "control-repository");
  const isolatedHome = join(root, "home");
  const isolatedConfig = join(root, "config");
  await Promise.all([
    mkdir(controlPath, { recursive: true, mode: 0o700 }),
    mkdir(isolatedHome, { recursive: true, mode: 0o700 }),
    mkdir(isolatedConfig, { recursive: true, mode: 0o700 }),
  ]);
  const environment = {
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: isolatedConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "init.defaultObjectFormat",
    GIT_CONFIG_VALUE_0: "sha256",
  };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"]) delete environment[name];

  await execFile("git", ["init", "--initial-branch=main", "--quiet"], {
    cwd: controlPath,
    env: environment,
  });
  const format = await execFileOutcome("git", ["rev-parse", "--show-object-format"], {
    cwd: controlPath,
    env: environment,
  });
  assert.deepEqual(format, {
    exitCode: 0,
    stdout: "sha256\n",
    stderr: "",
    aggregatedOutput: "sha256\n",
  });
});

test("native proof command fails before creation and hashes the exact changed target bytes", async (t) => {
  const root = await temporaryRoot(t, "dev-flow-codex-native-command-");
  const targetPath = join(root, "target-repository");
  await mkdir(targetPath, { recursive: true, mode: 0o700 });
  await execFile("git", ["init", "--object-format=sha1", "--initial-branch=main", "--quiet"], {
    cwd: targetPath,
  });
  await writeFile(join(targetPath, "README.md"), "native target\n", { mode: 0o600 });
  await execFile("git", ["add", "README.md"], { cwd: targetPath });
  await execFile("git", [
    "-c", "user.name=Dev Flow Native Test",
    "-c", "user.email=dev-flow-native-test@example.invalid",
    "commit", "--quiet", "-m", "baseline",
  ], { cwd: targetPath });
  const legacy = await execFileOutcome(process.execPath, [
    "--test",
    "packages/codex/tests/lifecycle.test.mjs",
  ], { cwd: targetPath });
  assert.notEqual(legacy.exitCode, 0, "the package-local test must not be claimed from an isolated target cwd");

  const absent = await execFileOutcome("git", ["hash-object", "native-proof.txt"], {
    cwd: targetPath,
  });
  assert.notEqual(absent.exitCode, 0, "the native proof command must fail before the task creates its file");

  await writeFile(join(targetPath, "native-proof.txt"), nativeProofContent, { mode: 0o600 });
  const targeted = await execFileOutcome("git", ["hash-object", "native-proof.txt"], {
    cwd: targetPath,
  });
  assert.deepEqual(targeted, {
    exitCode: 0,
    stdout: nativeVerificationOutput,
    stderr: "",
    aggregatedOutput: nativeVerificationOutput,
  });
  assert.equal(
    createHash("sha1").update(`blob ${Buffer.byteLength(nativeProofContent)}\0${nativeProofContent}`).digest("hex"),
    nativeProofGitBlobSha1,
    "the expected command output must bind the exact Git blob bytes",
  );
});

test("native proof command is stated exactly in both task prompts", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const context = {
    codexAlias: "/exact/bin/codex",
    targetPath: "/isolated/target",
    invalidPath: "/isolated/non-git",
    environment: { HOME: "/isolated/home" },
  };
  for (const role of ["substantive", "resume"]) {
    const prompt = writer.nativeSessionInvocation(role, context, "/ignored/codex").arguments.at(-1);
    assert.equal(
      prompt.split(nativeVerificationCommand).length - 1,
      1,
      `${role} prompt must state the one exact allowed verification command once`,
    );
  }
});

test("reopened session contract requires all four Codex thread IDs to be pairwise distinct", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const sessions = parsedRecordedSessions(writer);
  sessions.ordinary.threadId = sessions.substantive.threadId;
  assert.throws(
    () => writer.summarizeRecordedSessions(sessions),
    /four.*thread.*distinct|thread.*pairwise distinct/i,
  );
});

test("reopened session contract rejects raw revision regression before adjacent deduplication", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const sessions = parsedRecordedSessions(writer, {
    substantive: [
      actionObservation(4, "action-implement", false),
      taskObservation("dev_flow_get_task", 5, false),
    ],
    resume: [
      taskObservation("dev_flow_get_task", 4, false),
      taskObservation("dev_flow_get_next_action", 4, false),
      actionObservation(8, "action-handoff", true),
    ],
  });
  assert.throws(
    () => writer.summarizeRecordedSessions(sessions),
    /raw.*revision.*regress|revision.*non-regress/i,
  );
});

test("reopened session contract preserves raw revisions and deduplicates only adjacent equals", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const summary = writer.summarizeRecordedSessions(parsedRecordedSessions(writer, {
    substantive: [
      actionObservation(4, "action-implement", false),
      taskObservation("dev_flow_get_task", 4, false),
    ],
    resume: [
      taskObservation("dev_flow_get_task", 4, false),
      taskObservation("dev_flow_get_next_action", 4, false),
      actionObservation(8, "action-handoff", true),
    ],
  }));
  assert.deepEqual(summary.rawRevisions, [4, 4, 4, 4, 8]);
  assert.deepEqual(summary.revisions, [4, 8]);
  assert.deepEqual(summary.threadIds, [
    "thread-ordinary",
    "thread-invalid",
    "thread-substantive",
    "thread-resume",
  ]);
});

test("reopened resume contract requires get_task then get_next_action before a later apply", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const sessions = parsedRecordedSessions(writer, {
    substantive: [actionObservation(4, "action-implement", false)],
    resume: [
      actionObservation(8, "action-handoff", true),
      taskObservation("dev_flow_get_task", 8, true),
      taskObservation("dev_flow_get_next_action", 8, true),
    ],
  });
  assert.throws(
    () => writer.summarizeRecordedSessions(sessions),
    /get_task.*get_next_action.*before.*apply|restart.*read.*before.*mutation/i,
  );
});

test("reopened session summary derives Core budget, command facts, evidence parity, and terminal DONE", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const budget = {
    level: "targeted",
    max_automatic_commands: 1,
    allow_full_suite: false,
    allow_manual_handoff: true,
  };
  const check = { name: nativeVerificationCommand, commandCount: 1, fullSuite: false };
  const sessions = parsedRecordedSessions(writer, {
    substantive: [actionObservation(4, "action-implement", false, { budget })],
    resume: [
      taskObservation("dev_flow_get_task", 4, false, { budget }),
      taskObservation("dev_flow_get_next_action", 4, false, { budget }),
      actionObservation(8, "action-handoff", true, {
        budget,
        arguments_: {
          request_id: "request-8",
          payload: {
            checks: [{
              source: "automated",
              name: check.name,
              status: "passed",
              summary: "one targeted command passed",
              command_count: check.commandCount,
              full_suite: check.fullSuite,
            }],
          },
        },
        evidence: [{
          evidence_id: "evidence-targeted",
          source: "automated",
          name: check.name,
          status: "passed",
          summary: "one targeted command passed",
          digest: "a".repeat(64),
          command_count: check.commandCount,
          full_suite: check.fullSuite,
          recorded_at: "2026-08-16T00:00:00Z",
        }],
      }),
    ],
    resumeCommands: [{
      itemId: "command-targeted",
      command: nativeVerificationCommand,
      output: nativeVerificationOutput,
      exitCode: 0,
      status: "completed",
    }],
  });
  const summary = writer.summarizeRecordedSessions(sessions);
  assert.equal(summary.terminalPhase, "DONE");
  assert.deepEqual(summary.restartRecoveryReads, ["dev_flow_get_task", "dev_flow_get_next_action"]);
  assert.deepEqual(summary.budget, budget);
  assert.deepEqual(summary.commandExecutions, [{
    itemId: "command-targeted",
    command: nativeVerificationCommand,
    exitCode: 0,
    status: "completed",
    outputSha256: sha256Text(nativeVerificationOutput),
    fullSuite: false,
  }]);
  assert.deepEqual(summary.submittedAutomatedChecks, [check]);
  assert.deepEqual(summary.retainedAutomatedChecks, [check]);
});

test("recorded native sessions prove zero implicit calls and one resumed Core lineage", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const { ordinary, invalid, substantive, resume } = parsedRecordedSessions(writer);

  assert.deepEqual(writer.summarizeRecordedSessions({ ordinary, invalid, substantive, resume }), {
    ordinaryCoreCalls: 0,
    invalidCoreCalls: 0,
    substantiveThreadId: "thread-substantive",
    resumeThreadId: "thread-resume",
    threadIds: ["thread-ordinary", "thread-invalid", "thread-substantive", "thread-resume"],
    taskId: "task-00000001",
    rawRevisions: [4, 4, 4, 8],
    revisions: [4, 8],
    committedActions: [
      { action_id: "action-implement", revision: 4 },
      { action_id: "action-handoff", revision: 8 },
    ],
    terminalPhase: "DONE",
    terminalOutcome: "DONE",
    coreCallCount: 4,
    restartRecoveryReads: ["dev_flow_get_task", "dev_flow_get_next_action"],
    budget: nativeVerificationBudget,
    commandExecutions: [nativeCommandExecution()],
    submittedAutomatedChecks: [nativeAutomatedCheck],
    retainedAutomatedChecks: [nativeAutomatedCheck],
    terminalTask: nativeTerminalTask(),
  });
});

test("native runner accepts only four final inputs and rejects them before executable spawn", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-native-preflight-")));
  const validationReport = join(root, "validation-report.json");
  const artifactReport = join(root, "artifact-report.json");
  const ledgerPath = join(root, "attempt-ledger.json");
  const executable = join(root, "codex-marker.sh");
  const marker = join(root, "host-started.txt");
  await Promise.all([
    writeFile(validationReport, "{}\n"),
    writeFile(artifactReport, "{}\n"),
    writeFile(executable, `#!/bin/sh\nprintf started >${JSON.stringify(marker)}\nexit 99\n`),
    writer.initializeAttemptLedger(ledgerPath),
  ]);
  await chmod(executable, 0o755);
  await assert.rejects(
    execHarness([
      "--validation-report", validationReport,
      "--artifact-report", artifactReport,
      "--codex-executable", executable,
      "--attempt-ledger", ledgerPath,
    ]),
    /validation report.*(closed|required|schema)|schema.*validation report/i,
  );
  assert.equal(await optionalContents(marker), null);
  await assert.rejects(
    execHarness([
      "--validation-report", validationReport,
      "--artifact-report", artifactReport,
      "--codex-executable", executable,
      "--attempt-ledger", ledgerPath,
      "--unexpected", "value",
    ]),
    /usage:/i,
  );
  assert.equal(await optionalContents(marker), null);
});

test("native CLI delegates the exact four inputs and session plans preserve argv/env boundaries", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const harness = await readFile(harnessPath, "utf8");
  assert.match(harness, /write-codex-journey-evidence\.mjs" native-journey/);
  assert.doesNotMatch(harness, /native execution is reserved for the sole frozen-chain T058 invocation/);

  const environment = { HOME: "/isolated/home", CODEX_HOME: "/isolated/codex", PATH: "/isolated/bin" };
  const context = {
    codexAlias: "/exact/bin/codex",
    targetPath: "/isolated/target",
    invalidPath: "/isolated/non-git",
    environment,
  };
  const ordinary = writer.nativeSessionInvocation("ordinary", context, "/ignored/codex");
  assert.equal(ordinary.executable, "/exact/bin/codex");
  assert.equal(ordinary.cwd, context.targetPath);
  assert.equal(ordinary.env, environment);
  assert.deepEqual(ordinary.arguments.slice(0, 3), [
    "exec",
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
  ]);
  assert.equal(ordinary.arguments.includes("--skip-git-repo-check"), false);

  const invalid = writer.nativeSessionInvocation("invalid", context, "/ignored/codex");
  assert.equal(invalid.cwd, context.invalidPath);
  assert.equal(invalid.arguments.includes("--skip-git-repo-check"), true);
  assert.match(invalid.arguments.at(-1), /^\$dev-flow\b/);
  const substantive = writer.nativeSessionInvocation("substantive", context, "/ignored/codex");
  const resume = writer.nativeSessionInvocation("resume", context, "/ignored/codex");
  assert.match(substantive.arguments.at(-1), /native-proof\.txt/);
  assert.match(resume.arguments.at(-1), /Resume the existing compatible Codex-owned task/);
});

test("native ledger identity rejects switched paths and concurrent reservations", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-ledger-identity-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const copiedLedgerPath = join(root, "copied-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  await copyFile(ledgerPath, copiedLedgerPath);
  assert.notEqual(await writer.deriveLedgerId(ledgerPath), await writer.deriveLedgerId(copiedLedgerPath));
  await assert.rejects(
    writer.inspectNativeAdmission({ ledgerPath: copiedLedgerPath, evidencePath, identity: nativeIdentity("c") }),
    /ledger identity.*durable path|identity.*match/i,
  );

  const attempts = await Promise.allSettled([
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity: nativeIdentity("d"),
      reservedAt: "2026-08-16T03:00:00.000Z",
    }),
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity: nativeIdentity("e"),
      reservedAt: "2026-08-16T03:00:00.001Z",
    }),
  ]);
  assert.equal(attempts.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(attempts.filter(({ status }) => status === "rejected").length, 1);
  assert.match(attempts.find(({ status }) => status === "rejected").reason.message, /locked|reservation/i);
  assert.equal(JSON.parse(await readFile(ledgerPath, "utf8")).attempts.length, 1);
});

test("native chain ID uses the validator's compact canonical identity bytes", async () => {
  const [writer, validator] = await Promise.all([
    import(pathToFileURL(writerPath)),
    import(pathToFileURL(validatorPath)),
  ]);
  const identity = nativeIdentity("5");
  assert.equal(writer.deriveChainId(identity), validator.deriveNativeChainId(identity));
});

test("reopened admission rejects semantically invalid ledger history before host work", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-ledger-prehost-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  ledger.attempts.push(semanticLedgerAttempt({ attemptNumber: 2, seed: "a", status: "failed" }));
  await writeFile(ledgerPath, `${JSON.stringify(ledger)}\n`);

  await assert.rejects(
    writer.inspectNativeAdmission({ ledgerPath, evidencePath, identity: nativeIdentity("b") }),
    /attempt.*sequential|ledger.*semantic/i,
  );
});

test("reopened admission validates every ledger entry against the checked-in closed schema", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-ledger-admission-schema-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  ledger.attempts.push({
    ...semanticLedgerAttempt({ attemptNumber: 1, seed: "a", status: "failed" }),
    unreviewed: true,
  });
  await writeFile(ledgerPath, `${JSON.stringify(ledger)}\n`);

  await assert.rejects(
    writer.inspectNativeAdmission({ ledgerPath, evidencePath, identity: nativeIdentity("b") }),
    /ledger.*schema.*unreviewed|unreviewed.*not allowed/i,
  );
});

test("reopened reservation repeats full ledger semantics while holding the mutation lock", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-ledger-reserve-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  assert.equal((await writer.inspectNativeAdmission({
    ledgerPath,
    evidencePath,
    identity: nativeIdentity("c"),
  })).allowed, true);
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  ledger.attempts.push(semanticLedgerAttempt({ attemptNumber: 7, seed: "d", status: "failed" }));
  await writeFile(ledgerPath, `${JSON.stringify(ledger)}\n`);

  await assert.rejects(
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity: nativeIdentity("c"),
      reservedAt: "2026-08-16T03:30:00.000Z",
    }),
    /attempt.*sequential|ledger.*semantic/i,
  );
});

test("reopened reservation schema-validates drifted bytes inside the owner lock before CAS", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-ledger-reserve-schema-drift-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);

  await assert.rejects(
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity: nativeIdentity("c"),
      reservedAt: "2026-08-16T03:35:00.000Z",
      async beforeLockedRead({ lockPath }) {
        assert.notEqual(await optionalContents(lockPath), null);
        const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
        ledger.attempts.push({
          ...semanticLedgerAttempt({ attemptNumber: 1, seed: "d", status: "failed" }),
          unreviewed: true,
        });
        await writeFile(ledgerPath, `${JSON.stringify(ledger)}\n`);
      },
    }),
    /ledger.*schema.*unreviewed|unreviewed.*not allowed/i,
  );
  assert.equal(await optionalContents(`${ledgerPath}.lock`), null);
});

test("reopened ledger lock fails closed for a live owner with a closed identity", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await ledgerLockFixture(t, writer, "live", process.pid);
  await assert.rejects(
    writer.reserveNativeAttempt(fixture.reservation),
    /live.*owner|owner.*live/i,
  );
  assert.notEqual(await optionalContents(fixture.lockPath), null);
});

test("reopened ledger lock fails closed for malformed owner state", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-ledger-malformed-lock-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  await writer.initializeAttemptLedger(ledgerPath);
  const lockPath = `${ledgerPath}.lock`;
  await writeFile(lockPath, "{not-json\n", { mode: 0o600 });
  await assert.rejects(
    writer.reserveNativeAttempt({
      ledgerPath,
      evidencePath,
      identity: nativeIdentity("e"),
      reservedAt: "2026-08-16T03:40:00.000Z",
    }),
    /malformed.*lock|lock.*malformed/i,
  );
  assert.equal(await readFile(lockPath, "utf8"), "{not-json\n");
});

test("reopened ledger lock recovers only a valid definitely-dead owner", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await ledgerLockFixture(t, writer, "dead", 2_147_483_647);
  const reservation = await writer.reserveNativeAttempt(fixture.reservation);
  assert.equal(reservation.attemptNumber, 1);
  assert.equal(await optionalContents(fixture.lockPath), null);
});

test("reopened pass finalization holds one owner lock and rejects ledger mutation in the CAS window", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeCommitFixture(writer);
  let observedLock = null;
  await assert.rejects(
    writer.commitPassingAttempt({
      ...fixture.commit,
      async onStage(stage) {
        if (stage !== "evidence-published") return;
        observedLock = await optionalContents(`${fixture.ledgerPath}.lock`);
        await writeFile(fixture.ledgerPath, `${JSON.stringify({ mutated: true })}\n`);
      },
    }),
    /ledger.*schema|schema.*ledger/i,
  );
  assert.notEqual(observedLock, null, "the finalize-pass owner lock must span evidence publish and ledger CAS");
  const lock = JSON.parse(observedLock);
  assert.equal(lock.operation, "finalize-pass");
  assert.equal(lock.ledger_id, fixture.reservation.ledgerId);
  assert.equal(lock.expected_ledger_sha256, sha256Text(fixture.reservation.reservedLedgerBytes));
});

test("failed and blocked diagnostics can never occupy the canonical passing evidence path", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-failure-diagnostic-")));
  const canonicalEvidencePath = join(root, "codex-macos-arm64.json");
  const recoveryDirectory = join(root, "recovery");
  const diagnostic = nativeDiagnostic();
  await assert.rejects(
    writer.writeFailureDiagnostic({
      outputPath: canonicalEvidencePath,
      canonicalEvidencePath,
      recoveryDirectory,
      diagnostic,
    }),
    /canonical.*pass-only/i,
  );
  assert.equal(await optionalContents(canonicalEvidencePath), null);
  const outputPath = join(recoveryDirectory, "failed.json");
  await writer.writeFailureDiagnostic({
    outputPath,
    canonicalEvidencePath,
    recoveryDirectory,
    diagnostic,
  });
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), diagnostic);
  assert.equal(await optionalContents(canonicalEvidencePath), null);
});

test("reopened failed diagnostics use the independent closed v1 schema", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-diagnostic-schema-");
  const canonicalEvidencePath = join(root, "canonical.json");
  const recoveryDirectory = join(root, "recovery");
  const legacyJourneyEvidence = {
    schema_version: 3,
    status: "failed",
    native_attempt: { commit_protocol: "external-failure-record-v1" },
    failures: [{ phase: "host", reason: "exit", observed: "exit 1" }],
    skips: [],
  };
  await assert.rejects(
    writer.writeFailureDiagnostic({
      outputPath: join(recoveryDirectory, "legacy.json"),
      canonicalEvidencePath,
      recoveryDirectory,
      diagnostic: legacyJourneyEvidence,
    }),
    /diagnostic.*schema|schema.*diagnostic/i,
  );
});

test("reopened failed diagnostic rejects every extra top-level field", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-diagnostic-closed-");
  const canonicalEvidencePath = join(root, "canonical.json");
  const recoveryDirectory = join(root, "recovery");
  await assert.rejects(
    writer.writeFailureDiagnostic({
      outputPath: join(recoveryDirectory, "extra.json"),
      canonicalEvidencePath,
      recoveryDirectory,
      diagnostic: { ...nativeDiagnostic(), journey: { unsupported: true } },
    }),
    /unexpected.*journey|closed.*journey|diagnostic.*schema/i,
  );
});

test("validation-report writer owns compatibility query and exact ordered deterministic commands", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-validation-report-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const outputPath = join(root, "validation-report.json");
  const sourceCommit = "a".repeat(40);
  const events = [];
  const times = [
    "2026-08-16T04:00:00.000Z",
    "2026-08-16T04:01:00.000Z",
    "2026-08-16T04:02:00.000Z",
    "2026-08-16T04:03:00.000Z",
    "2026-08-16T04:04:00.000Z",
  ];
  await writer.initializeAttemptLedger(ledgerPath);
  const result = await writer.createValidationReport({
    outputPath,
    ledgerPath,
    sourceCommit,
    repositoryRoot: root,
  }, {
    async queryLatestCodex() {
      events.push("query:@openai/codex:latest");
      return "0.147.0";
    },
    async runCommand(command) {
      events.push(`run:${command}`);
    },
    async readSourceIdentity() {
      return { commit: sourceCommit, dirty: false };
    },
    now() {
      return times.shift();
    },
  });
  assert.deepEqual(events, [
    "query:@openai/codex:latest",
    "run:go test ./internal/version ./tests/contract",
    "run:node --test packages/codex/tests/*.test.mjs",
    "run:pnpm run validate",
  ]);
  const report = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(report.codex_revalidation.queried_at, "2026-08-16T04:00:00.000Z");
  assert.deepEqual(report.targeted_checks.map(({ command }) => command), [
    "go test ./internal/version ./tests/contract",
    "node --test packages/codex/tests/*.test.mjs",
  ]);
  assert.equal(report.root_validation.command, "pnpm run validate");
  assert.equal(report.completed_at, "2026-08-16T04:04:00.000Z");
  assert.equal(result.outputPath, outputPath);
  await assert.rejects(
    writer.createValidationReport({ outputPath, ledgerPath, sourceCommit, repositoryRoot: root }, {}),
    /already exists|create.*replace/i,
  );
});

test("native recorded driver spawns four ordered sessions and derives only complete Core results", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const evidenceBefore = await optionalContents(nativeEvidencePath);
  const roles = [];
  const streams = recordedSessionStreams();
  const result = await writer.runRecordedNativeSessions({
    async spawnSession({ role, stopAfterFirstApply }) {
      roles.push({ role, stopAfterFirstApply });
      return streams[role];
    },
  });
  assert.deepEqual(roles, [
    { role: "ordinary", stopAfterFirstApply: false },
    { role: "invalid", stopAfterFirstApply: false },
    { role: "substantive", stopAfterFirstApply: true },
    { role: "resume", stopAfterFirstApply: false },
  ]);
  assert.equal(result.summary.taskId, "task-00000001");
  assert.equal(result.summary.terminalOutcome, "DONE");
  assert.equal(await optionalContents(nativeEvidencePath), evidenceBefore);
});

test("default native helpers execute the native proof command from target cwd and complete lifecycle subprocesses", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeSubprocessFixture(t, writer, "default-chain");
  const canonicalBefore = await optionalContents(nativeEvidencePath);
  const result = await writer.executeNativeJourney(fixture.inputs, fixture.dependencies);
  const observedFacts = JSON.parse(await readFile(
    join(fixture.recoveryRoot, result.chainId, "observed-facts.json"),
    "utf8",
  ));

  assert.equal(result.status, "committed");
  assert.equal(await optionalContents(nativeEvidencePath), canonicalBefore);
  assert.deepEqual(observedFacts.journey.task_lineage.thread_ids, [
    "thread-ordinary",
    "thread-invalid",
    "thread-substantive",
    "thread-resume",
  ]);
  assert.deepEqual(observedFacts.verification, {
    budget: nativeVerificationBudget,
    command_executions: [nativeCommandFact()],
    submitted_automated_checks: [nativeAutomatedCheckFact()],
    retained_automated_checks: [nativeAutomatedCheckFact()],
  });
  assert.deepEqual(observedFacts.terminal_task, nativeTerminalTask());
  assert.equal(
    observedFacts.sessions.resume.calls.find(({ tool }) => tool === "dev_flow_get_next_action").revision,
    4,
  );
  const nativeWorkspace = dirname(observedFacts.journey.repository.target_path);
  assert.deepEqual(observedFacts.journey.task_data.retained_data_location, {
    kind: "isolated-explicit-data-directory",
    workspace_relative_path: "data",
    canonical_path_sha256: sha256Text(join(nativeWorkspace, "data")),
  });
  assert.equal(JSON.stringify(observedFacts.journey.task_data).includes(nativeWorkspace), false);

  const trace = await readJSONL(fixture.tracePath);
  const objectFormatTrace = trace.find((entry) => entry.role === "native-target-object-format");
  assert.deepEqual(objectFormatTrace, {
    role: "native-target-object-format",
    executable: "git",
    argv: ["rev-parse", "--show-object-format"],
    cwd: observedFacts.journey.repository.target_path,
    processResult: {
      exitCode: 0,
      stdout: "sha1\n",
      stderr: "",
      aggregatedOutput: "sha1\n",
    },
  });
  const commandTrace = trace.find((entry) => entry.role === "native-proof-command");
  assert.equal(commandTrace.command, nativeVerificationCommand);
  assert.equal(commandTrace.cwd, observedFacts.journey.repository.target_path);
  assert.deepEqual(commandTrace.argv, ["hash-object", "native-proof.txt"]);
  assert.equal(commandTrace.event.item.exit_code, commandTrace.processResult.exitCode);
  assert.equal(
    commandTrace.event.item.status,
    commandTrace.processResult.exitCode === 0 ? "completed" : "failed",
  );
  assert.equal(commandTrace.event.item.aggregated_output, commandTrace.processResult.aggregatedOutput);
  assert.equal(
    commandTrace.processResult.aggregatedOutput,
    `${commandTrace.processResult.stdout}${commandTrace.processResult.stderr}`,
  );
  assert.deepEqual(commandTrace.processResult, {
    exitCode: 0,
    stdout: nativeVerificationOutput,
    stderr: "",
    aggregatedOutput: nativeVerificationOutput,
  });
  assert.match(commandTrace.processResult.stdout, /^[0-9a-f]{40}\n$/u);
  assert.equal(
    trace.filter((entry) => entry.event?.item?.type === "command_execution").length,
    1,
    "the object-format read must not become a second official Codex verification command",
  );
  assert.equal(trace.filter((entry) => entry.role === "npm" && entry.argv[0] === "install").length, 2);
  assert.equal(trace.filter((entry) => entry.role === "npm" && entry.argv[0] === "uninstall").length, 2);
  assert.deepEqual(
    trace.filter((entry) => entry.role === "codex" && entry.argv[0] === "exec").map((entry) => entry.argv.at(-1).split("\n")[0]),
    [
      "Reply with one short sentence describing this repository. Do not use any named skill or MCP tool.",
      "$dev-flow Explain briefly that this request cannot run outside a Git worktree; do not create or resume a task.",
      "$dev-flow",
      "$dev-flow",
    ],
  );
  assert.equal(trace.some((entry) => entry.role === "core" && entry.argv.join(" ") === "mcp --stdio"), true);
  await assert.rejects(stat(nativeWorkspace), { code: "ENOENT" });
});

test("default native setup and reinstall readback reject every extra registry cardinality", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const stage of ["setup", "reinstall"]) {
    for (const kind of ["marketplace", "installed", "available"]) {
      await t.test(`${stage}-${kind}`, async (t) => {
        const fixture = await nativeSubprocessFixture(t, writer, `${stage}-${kind}`, {
          extraRegistration: `${stage}-${kind}`,
        });
        await assert.rejects(
          writer.executeNativeJourney(fixture.inputs, fixture.dependencies),
          /registry.*cardinality|exactly one.*(?:marketplace|installed)|zero available|extra.*(?:marketplace|installed|available)/i,
        );
        assert.equal(await optionalContents(nativeEvidencePath), fixture.canonicalBefore);
      });
    }
  }
});

test("direct Core reopen rejects non-JSON, unknown, duplicate, stdout, and stderr protocol contamination", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const [mode, expected] of [
    ["non-json", /non-JSON|protocol.*contamination/i],
    ["unknown-id", /unknown.*response.*ID/i],
    ["duplicate-id", /duplicate.*response.*ID/i],
    ["stdout-bound", /stdout.*(?:limit|bound)|bounded.*stdout/i],
    ["stderr-bound", /stderr.*(?:limit|bound)|bounded.*stderr/i],
  ]) {
    await t.test(mode, async (t) => {
      const fixture = await directCoreFixture(t, mode);
      await assert.rejects(writer.directCoreTaskReopen(fixture), expected);
    });
  }
});

test("failed native attempt finalizes only external diagnostic and durable ledger history", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-failed-attempt-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "canonical-evidence.json");
  const recoveryDirectory = join(root, "recovery");
  await writer.initializeAttemptLedger(ledgerPath);
  const reservation = await writer.reserveNativeAttempt({
    ledgerPath,
    evidencePath,
    identity: nativeIdentity("9"),
    reservedAt: "2026-08-16T05:00:00.000Z",
  });
  const result = await writer.finalizeFailedAttempt({
    ledgerPath,
    evidencePath,
    recoveryDirectory,
    reservation,
    status: "failed",
    completedAt: "2026-08-16T05:01:00.000Z",
    observedFacts: { phase: "host", observed: "Codex exited 1" },
    diagnosticBase: nativeDiagnosticBase({
      recordedAt: "2026-08-16T05:01:01.000Z",
      failure: { phase: "host", reason: "exit", observed: "Codex exited 1" },
    }),
  });
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.attempts[0].status, "failed");
  assert.equal(await optionalContents(evidencePath), null);
  assert.equal(result.diagnosticPath.startsWith(`${recoveryDirectory}/`), true);
  const diagnostic = JSON.parse(await readFile(result.diagnosticPath, "utf8"));
  assert.equal(diagnostic.status, "failed");
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v1");
});

test("native orchestration reserves immediately before four sessions and validates before publish", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-native-orchestration-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "canonical", "codex-macos-arm64.json");
  const recoveryRoot = join(root, "recovery");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writer.initializeAttemptLedger(ledgerPath);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  const streams = recordedSessionStreams();
  const events = [];
  const times = [
    "2026-08-16T06:00:00.000Z",
    "2026-08-16T06:10:00.000Z",
    "2026-08-16T06:11:00.000Z",
  ];

  const result = await writer.executeNativeJourney({
    validationReportPath: "/external/validation-report.json",
    artifactReportPath: "/external/artifact-report.json",
    codexExecutable: "/external/codex-0.147.0",
    ledgerPath,
  }, {
    evidencePath,
    recoveryRoot,
    platform: "darwin",
    arch: "arm64",
    now: () => times.shift(),
    async preflight() {
      events.push("preflight");
      return structuredClone(preflight);
    },
    async assertFrozenSource() {
      events.push("source-clean");
    },
    async prepareHost() {
      events.push("setup-readback");
      return { targetPath: "/tmp/dev-flow-native-target", opaque: true };
    },
    async spawnSession({ role, stopAfterFirstApply }) {
      const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
      assert.equal(ledger.attempts.at(-1).status, "reserved", "spawn requires durable reservation");
      events.push(`spawn:${role}:${stopAfterFirstApply}`);
      return streams[role];
    },
    async finishHost({ sessionResult }) {
      events.push("remove-reopen-reinstall");
      assert.equal(sessionResult.summary.terminalOutcome, "DONE");
      return {
        journey: passingNativeJourney(),
        observedFacts: { classification: "native", sessions: sessionResult.summary },
      };
    },
    validateCandidate(candidate) {
      events.push("validate-full-candidate");
      assert.equal(candidate.validationReportText, preflight.validationText);
      assert.equal(candidate.artifactReportText, preflight.artifactText);
      assert.match(candidate.attemptLedgerText, /\"status\":\"pass\"/);
      assert.match(candidate.observedFactsText, /\"classification\":\"native\"/);
      assert.equal(candidate.artifactSha256, preflight.identity.artifact_sha256);
      return { valid: true, structuralErrors: [], semanticErrors: [] };
    },
    onCommitStage(stage) {
      events.push(stage);
    },
    async cleanupHost() {
      events.push("cleanup");
    },
  });

  assert.equal(result.status, "committed");
  assert.deepEqual(events, [
    "preflight",
    "source-clean",
    "setup-readback",
    "preflight",
    "source-clean",
    "spawn:ordinary:false",
    "spawn:invalid:false",
    "spawn:substantive:true",
    "spawn:resume:false",
    "remove-reopen-reinstall",
    "validate-full-candidate",
    "evidence-published",
    "ledger-finalized",
    "cleanup",
  ]);
  assert.equal(JSON.parse(await readFile(ledgerPath, "utf8")).attempts[0].status, "pass");
  assert.equal(JSON.parse(await readFile(evidencePath, "utf8")).status, "pass");
});

test("native orchestration records a failed host externally and never publishes canonical evidence", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-native-orchestration-failure-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "canonical", "codex-macos-arm64.json");
  const recoveryRoot = join(root, "recovery");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writer.initializeAttemptLedger(ledgerPath);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  const times = [
    "2026-08-16T07:00:00.000Z",
    "2026-08-16T07:01:00.000Z",
    "2026-08-16T07:02:00.000Z",
  ];

  await assert.rejects(
    writer.executeNativeJourney({
      validationReportPath: "/external/validation-report.json",
      artifactReportPath: "/external/artifact-report.json",
      codexExecutable: "/external/codex-0.147.0",
      ledgerPath,
    }, {
      evidencePath,
      recoveryRoot,
      platform: "darwin",
      arch: "arm64",
      now: () => times.shift(),
      async preflight() { return structuredClone(preflight); },
      async assertFrozenSource() {},
      async prepareHost() { return { targetPath: "/tmp/dev-flow-native-target" }; },
      async spawnSession() { throw new Error("recorded host exit 1"); },
      async cleanupHost() {},
    }),
    /recorded host exit 1.*external diagnostic|external diagnostic.*recorded host exit 1/i,
  );
  assert.equal(await optionalContents(evidencePath), null);
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.attempts[0].status, "failed");
  const diagnostic = JSON.parse(await readFile(join(recoveryRoot, ledger.attempts[0].chain_id, "failed.json"), "utf8"));
  assert.equal(diagnostic.status, "failed");
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v1");
});

test("fake journey rejects real-host and out-of-slice stage attempts before host launch", async () => {
  await assert.rejects(
    execHarness(["--through", "done"]),
    /real Codex is disabled before the frozen-artifact native journey/,
  );
  await assert.rejects(
    execHarness(["--fake-host", "--through", "unknown"]),
    /supports only|unsupported.*stage/i,
  );
});

test("operator guide documents governed create, resume, recovery, and terminal boundaries", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  for (const expectation of [
    /## Core-governed create and resume/,
    /omit(?:s)? `new_task`/i,
    /fresh Core action/i,
    /read\s+before retry/i,
    /verification.*budget/i,
    /manual handoff/i,
    /restart.*same task ID/is,
    /blocker.*conflict/is,
    /Core.*`DONE`/i,
  ]) {
    assert.match(readme, expectation);
  }
});

test("operator guide documents bounded removal, retention, and compatible reinstall", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  for (const expectation of [
    /## Explicit removal and retained task data/,
    /deregister[\s\S]*before[\s\S]*npm uninstall/i,
    /receipt-first|read.*receipt.*first/i,
    /interrupted[\s\S]*resume/i,
    /conflict[\s\S]*fail.*closed/i,
    /adjacent[\s\S]*preserv/i,
    /task data[\s\S]*reopen/i,
    /repeated removal[\s\S]*(?:no-op|idempotent)/i,
    /compatible reinstall/i,
  ]) {
    assert.match(readme, expectation);
  }
});

test("fake through-done journey preserves build identity and reaches one recovered Core lineage", {
  skip: supportedMachine ? false : "darwin-arm64 deterministic package execution only",
}, async () => {
  const evidenceBefore = await optionalContents(nativeEvidencePath);
  const { stdout, stderr } = await execHarness(["--fake-host", "--through", "done"]);
  assert.equal(stderr, "");
  const checkpoint = JSON.parse(stdout);

  assert.equal(checkpoint.checkpoint_version, 1);
  assert.equal(checkpoint.classification, "simulated");
  assert.equal(checkpoint.through_stage, "done");
  assert.equal(checkpoint.real_codex_started, false);
  assert.equal(checkpoint.native_evidence_written, false);
  assert.equal(checkpoint.artifact_final, false);
  assert.match(checkpoint.source_commit, /^[0-9a-f]{40}$/);
  assert.match(checkpoint.artifact_sha256, /^[0-9a-f]{64}$/);
  assert.equal(checkpoint.build_identity.source_commit, checkpoint.source_commit);
  assert.equal(checkpoint.build_identity.artifact_sha256, checkpoint.artifact_sha256);

  assert.equal(checkpoint.repository.before_sha256, checkpoint.repository.after_setup_sha256);
  assert.equal(checkpoint.repository.before_sha256, checkpoint.repository.after_completion_sha256);
  assert.equal(checkpoint.repository.unchanged, true);
  assert.match(checkpoint.task_data.before_restart_sha256, /^[0-9a-f]{64}$/);
  assert.match(checkpoint.task_data.after_done_sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(checkpoint.task_data.before_restart_sha256, checkpoint.task_data.after_done_sha256);
  assert.equal(checkpoint.task_data.persisted_across_sessions, true);

  assert.deepEqual(checkpoint.session_markers, [
    "create-session-open",
    "create-session-closed",
    "resume-session-open",
    "uncertain-response-observed",
    "resume-session-closed",
    "recovery-session-open",
    "recovery-session-closed",
  ]);
  assert.equal(checkpoint.task_lineage.task_id_before_restart, checkpoint.task_lineage.task_id_after_restart);
  assert.deepEqual(checkpoint.task_lineage.revisions, [1, 4, 8]);
  assert.equal(checkpoint.task_lineage.committed_actions.length, 2);
  assert.equal(new Set(checkpoint.task_lineage.committed_actions.map((action) => action.action_id)).size, 2);
  assert.equal(checkpoint.task_lineage.committed_actions[1].response, "uncertain_then_read_back");
  assert.equal(checkpoint.task_lineage.recovery_classification, "completed_and_recorded");
  assert.equal(checkpoint.task_lineage.terminal_outcome, "DONE");

  assert.ok(checkpoint.budget.verification_commands_used <= checkpoint.budget.max_automatic_commands);
  assert.ok(checkpoint.budget.core_call_count <= checkpoint.budget.scenario_call_budget);
  assert.equal(checkpoint.budget.full_suite_run, false);
  assert.equal(checkpoint.recovery.apply_calls, 2);
  assert.deepEqual(checkpoint.recovery.calls_after_uncertainty, [
    "dev_flow_get_task",
    "dev_flow_get_next_action",
  ]);
  assert.equal(await optionalContents(nativeEvidencePath), evidenceBefore);
});

test("fake through-remove journey preserves task data and separates uninstall from compatible reinstall", {
  skip: supportedMachine ? false : "darwin-arm64 deterministic package execution only",
}, async () => {
  const evidenceBefore = await optionalContents(nativeEvidencePath);
  const { stdout, stderr } = await execHarness(["--fake-host", "--through", "remove"]);
  assert.equal(stderr, "");
  const checkpoint = JSON.parse(stdout);

  assert.equal(checkpoint.classification, "simulated");
  assert.equal(checkpoint.through_stage, "remove");
  assert.equal(checkpoint.real_codex_started, false);
  assert.equal(checkpoint.native_evidence_written, false);
  assert.equal(checkpoint.task_lineage.terminal_outcome, "DONE");
  assert.equal(checkpoint.removal.process_stopped_before_remove, true);
  assert.equal(checkpoint.removal.remove_status, "removed");
  assert.equal(checkpoint.removal.repeat_status, "already-absent");
  assert.equal(checkpoint.removal.plugin_absent, true);
  assert.equal(checkpoint.removal.marketplace_absent, true);
  assert.equal(checkpoint.removal.receipt_absent, true);
  assert.equal(checkpoint.removal.adjacent_preserved, true);
  assert.equal(checkpoint.removal.npm_uninstalled_separately, true);
  assert.equal(checkpoint.removal.compatible_reinstall_status, "installed");
  assert.equal(checkpoint.removal.reinstall_plugin_count, 1);
  assert.equal(checkpoint.removal.reinstall_marketplace_count, 1);

  assert.deepEqual(
    checkpoint.task_data_removal.files_before_removal,
    checkpoint.task_data_removal.files_after_removal,
  );
  assert.equal(
    checkpoint.task_data_removal.manifest_before_removal_sha256,
    checkpoint.task_data_removal.manifest_after_removal_sha256,
  );
  assert.equal(checkpoint.task_data_removal.direct_reopen_task_id, checkpoint.task_lineage.task_id_after_restart);
  assert.equal(checkpoint.task_data_removal.direct_reopen_revision, 8);
  assert.equal(checkpoint.repository.after_completion_sha256, checkpoint.repository.after_removal_sha256);
  assert.equal(checkpoint.repository.unchanged, true);
  assert.equal(checkpoint.session_markers.includes("process-stop-before-remove"), true);
  assert.equal(checkpoint.session_markers.includes("direct-reopen-after-remove"), true);
  assert.equal(await optionalContents(nativeEvidencePath), evidenceBefore);
});

function execHarness(arguments_) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  return execFile(harnessPath, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
}

async function optionalContents(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function execFileOutcome(executable, arguments_, options) {
  try {
    const { stdout = "", stderr = "" } = await execFile(executable, arguments_, {
      ...options,
      encoding: "utf8",
    });
    return {
      exitCode: 0,
      stdout,
      stderr,
      aggregatedOutput: `${stdout}${stderr}`,
    };
  } catch (error) {
    const stdout = String(error?.stdout ?? "");
    const stderr = String(error?.stderr ?? "");
    return {
      exitCode: Number.isInteger(error?.code) ? error.code : -1,
      stdout,
      stderr,
      aggregatedOutput: `${stdout}${stderr}`,
    };
  }
}

async function temporaryRoot(t, prefix) {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function semanticLedgerAttempt({ attemptNumber, seed, status }) {
  const attempt = {
    attempt_number: attemptNumber,
    chain_id: seed.repeat(64),
    source_commit: seed.repeat(40),
    validation_report_sha256: "1".repeat(64),
    artifact_report_sha256: "2".repeat(64),
    artifact_sha256: "3".repeat(64),
    reserved_at: "2026-08-16T03:00:00.000Z",
    status,
  };
  if (status !== "reserved") {
    attempt.completed_at = "2026-08-16T03:01:00.000Z";
    attempt.observed_facts_sha256 = "4".repeat(64);
  }
  return attempt;
}

async function ledgerLockFixture(t, writer, label, pid) {
  const root = await temporaryRoot(t, `dev-flow-codex-ledger-${label}-lock-`);
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "evidence.json");
  const initialized = await writer.initializeAttemptLedger(ledgerPath);
  const ledgerBytes = await readFile(ledgerPath, "utf8");
  const lockPath = `${ledgerPath}.lock`;
  await writeFile(lockPath, `${JSON.stringify({
    schema_version: 1,
    ledger_id: initialized.ledgerId,
    owner_token: "f".repeat(64),
    pid,
    created_at: "2026-08-16T03:00:00.000Z",
    operation: "reserve",
    expected_ledger_sha256: sha256Text(ledgerBytes),
  })}\n`, { mode: 0o600 });
  return {
    lockPath,
    ledgerPath,
    reservation: {
      ledgerPath,
      evidencePath,
      identity: nativeIdentity(label === "live" ? "6" : "7"),
      reservedAt: "2026-08-16T03:45:00.000Z",
    },
  };
}

function nativeDiagnostic() {
  const sourceCommit = "a".repeat(40);
  const digest = "b".repeat(64);
  const observation = {
    command: "node --test packages/codex/tests/journey-harness.test.mjs",
    result: "pass",
    source_commit: sourceCommit,
    completed_at: "2026-08-16T02:00:00.000Z",
  };
  return {
    schema_version: 1,
    report_type: "dev-flow-codex-native-attempt-diagnostic",
    status: "failed",
    recorded_at: "2026-08-16T03:00:00.000Z",
    classification: {
      evidence_type: "native-attempt-diagnostic",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: "0.147.0",
      codex_compatibility: ">=0.147.0 <0.148.0",
      package: "0.1.0",
      core: "0.1.0",
      core_contract: "0.1",
    },
    identity: {
      source_commit: sourceCommit,
      artifact_sha256: digest,
      artifact_report_sha256: "c".repeat(64),
      artifact_built_at: "2026-08-16T02:30:00.000Z",
    },
    validation: {
      report_sha256: "d".repeat(64),
      completed_at: "2026-08-16T02:10:00.000Z",
      targeted_checks: [observation],
      root_validation: observation,
    },
    native_attempt: {
      chain_id: "e".repeat(64),
      ledger_id: "f".repeat(64),
      attempt_number: 1,
      total_attempts: 1,
      ledger_sha256: "1".repeat(64),
      commit_protocol: "external-failure-record-v1",
      observed_facts_sha256: "2".repeat(64),
    },
    failure: { phase: "host", reason: "exit", observed: "exit 1" },
    skips: [],
  };
}

function nativeDiagnosticBase({
  recordedAt = "2026-08-16T03:00:00.000Z",
  failure = { phase: "host", reason: "exit", observed: "exit 1" },
} = {}) {
  const diagnostic = nativeDiagnostic();
  diagnostic.recorded_at = recordedAt;
  diagnostic.failure = failure;
  delete diagnostic.status;
  delete diagnostic.native_attempt;
  return diagnostic;
}

function parsedRecordedSessions(writer, {
  substantive = [actionObservation(4, "action-implement", false)],
  resume = [
    taskObservation("dev_flow_get_task", 4, false),
    taskObservation("dev_flow_get_next_action", 4, false),
    actionObservation(8, "action-handoff", true),
  ],
  resumeCommands = [nativeCommandObservation()],
} = {}) {
  return {
    ordinary: writer.parseCodexExecJSONL(JSON.stringify({
      type: "thread.started",
      thread_id: "thread-ordinary",
    })),
    invalid: writer.parseCodexExecJSONL(JSON.stringify({
      type: "thread.started",
      thread_id: "thread-invalid",
    })),
    substantive: writer.parseCodexExecJSONL(sessionJSONL("thread-substantive", substantive)),
    resume: writer.parseCodexExecJSONL(sessionJSONL("thread-resume", resume, resumeCommands)),
  };
}

function sessionJSONL(threadId, observations, commands = []) {
  return [
    JSON.stringify({ type: "thread.started", thread_id: threadId }),
    ...observations.map(({ tool, envelope, arguments_ }) => JSON.stringify({
      type: "item.completed",
      item: codexMCPItem(tool, envelope, arguments_),
    })),
    ...commands.map((command) => JSON.stringify({
      type: "item.completed",
      item: {
        id: command.itemId,
        type: "command_execution",
        command: command.command,
        aggregated_output: command.output,
        exit_code: command.exitCode,
        status: command.status,
      },
    })),
  ].join("\n");
}

function actionObservation(revision, actionId, terminal, options = {}) {
  return taskObservation("dev_flow_apply_action", revision, terminal, { ...options, actionId });
}

function taskObservation(tool, revision, terminal, {
  actionId = `action-${revision}`,
  budget = nativeVerificationBudget,
  evidence = terminal ? [nativeRetainedEvidence()] : undefined,
  arguments_,
} = {}) {
  return {
    tool,
    arguments_,
    envelope: coreEnvelope({ revision, actionId, terminal, tool, budget, evidence }),
  };
}

async function nativeSubprocessFixture(t, writer, label, { extraRegistration } = {}) {
  const root = await temporaryRoot(t, `dev-flow-codex-native-subprocess-${label}-`);
  const fakeBin = join(root, "fake-bin");
  const statePath = join(root, "fake-state.json");
  const tracePath = join(root, "fake-trace.jsonl");
  const artifactPath = join(root, "dev-flow-codex-0.1.0.tgz");
  const codexExecutable = join(fakeBin, "codex-0.147.0");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "candidate-evidence.json");
  const recoveryRoot = join(root, "recovery");
  const isolatedAuthHome = join(root, "source-codex-home");
  await Promise.all([
    mkdir(fakeBin, { recursive: true, mode: 0o700 }),
    mkdir(isolatedAuthHome, { recursive: true, mode: 0o700 }),
    writeFile(artifactPath, "deterministic fake artifact bytes\n", { mode: 0o600 }),
  ]);
  await Promise.all([
    writeNativeWrapper(join(fakeBin, "npm"), "npm"),
    writeNativeWrapper(codexExecutable, "codex"),
  ]);
  const initialized = await writer.initializeAttemptLedger(ledgerPath);
  const artifactBytes = "deterministic fake artifact bytes\n";
  const preflight = validatingOrchestrationPreflight(
    initialized.ledgerId,
    artifactPath,
    artifactBytes,
  );
  preflight.canonicalCodexExecutable = await realpath(codexExecutable);

  const environmentNames = [
    "PATH",
    "CODEX_HOME",
    "FAKE_NATIVE_STATE",
    "FAKE_NATIVE_TRACE",
    "FAKE_NATIVE_TOOL_PATH",
    "FAKE_NATIVE_PACKAGE_VERSION",
    "FAKE_NATIVE_EXTRA_REGISTRATION",
    "FAKE_NATIVE_CORE_MODE",
  ];
  const previousEnvironment = Object.fromEntries(
    environmentNames.map((name) => [name, process.env[name]]),
  );
  process.env.PATH = `${fakeBin}${delimiter}${previousEnvironment.PATH ?? ""}`;
  process.env.CODEX_HOME = isolatedAuthHome;
  process.env.FAKE_NATIVE_STATE = statePath;
  process.env.FAKE_NATIVE_TRACE = tracePath;
  process.env.FAKE_NATIVE_TOOL_PATH = fakeNativeToolPath;
  process.env.FAKE_NATIVE_PACKAGE_VERSION = "0.1.0";
  if (extraRegistration) process.env.FAKE_NATIVE_EXTRA_REGISTRATION = extraRegistration;
  else delete process.env.FAKE_NATIVE_EXTRA_REGISTRATION;
  delete process.env.FAKE_NATIVE_CORE_MODE;
  t.after(() => {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  let tick = 0;
  const dependencies = {
    evidencePath,
    recoveryRoot,
    platform: "darwin",
    arch: "arm64",
    async preflight() { return structuredClone(preflight); },
    async assertFrozenSource() {},
    now() {
      const value = new Date(Date.parse("2026-08-16T06:00:00.000Z") + tick * 60_000).toISOString();
      tick += 1;
      return value;
    },
  };
  return {
    root,
    tracePath,
    recoveryRoot,
    canonicalBefore: await optionalContents(nativeEvidencePath),
    inputs: {
      validationReportPath: join(root, "validation-report.json"),
      artifactReportPath: join(root, "artifact-report.json"),
      codexExecutable,
      ledgerPath,
    },
    dependencies,
  };
}

function validatingOrchestrationPreflight(ledgerId, artifactPath, artifactBytes) {
  const sourceCommit = "7".repeat(40);
  const observation = (command, completedAt) => ({
    command,
    result: "pass",
    source_commit: sourceCommit,
    completed_at: completedAt,
  });
  const validation = {
    schema_version: 1,
    report_type: "dev-flow-codex-validation",
    source_commit: sourceCommit,
    source_dirty: false,
    attempt_ledger_id: ledgerId,
    codex_revalidation: {
      package: "@openai/codex",
      dist_tag: "latest",
      resolved_version: "0.147.0",
      compatible_range: ">=0.147.0 <0.148.0",
      queried_at: "2026-08-16T04:00:00.000Z",
    },
    completed_at: "2026-08-16T05:00:00.000Z",
    targeted_checks: [
      observation("go test ./internal/version ./tests/contract", "2026-08-16T04:10:00.000Z"),
      observation("node --test packages/codex/tests/*.test.mjs", "2026-08-16T04:20:00.000Z"),
    ],
    root_validation: observation("pnpm run validate", "2026-08-16T04:30:00.000Z"),
  };
  const validationText = `${JSON.stringify(validation)}\n`;
  const artifact = {
    schema_version: 1,
    report_type: "dev-flow-codex-final-artifact",
    artifact_path: artifactPath,
    artifact_sha256: sha256Text(artifactBytes),
    package_version: rootVersion,
    core_version: rootVersion,
    codex_compatibility: ">=0.147.0 <0.148.0",
    source_commit: sourceCommit,
    source_dirty: false,
    final_artifact: true,
    platform: "darwin-arm64",
    package_allowlist_verified: true,
    runtime_executable_verified: true,
    built_at: "2026-08-16T05:30:00.000Z",
  };
  const artifactText = `${JSON.stringify(artifact)}\n`;
  return {
    validation,
    validationText,
    artifact,
    artifactText,
    artifactBytes,
    ledgerId,
    schemas: journeySchemas,
    rootVersion,
    identity: {
      source_commit: sourceCommit,
      validation_report_sha256: sha256Text(validationText),
      artifact_report_sha256: sha256Text(artifactText),
      artifact_sha256: artifact.artifact_sha256,
    },
  };
}

async function directCoreFixture(t, mode) {
  const root = await temporaryRoot(t, `dev-flow-codex-direct-core-${mode}-`);
  const runtimePath = join(root, "dev-flow");
  const dataDirectory = join(root, "data");
  const repositoryPath = join(root, "repository");
  const tracePath = join(root, "trace.jsonl");
  await Promise.all([
    mkdir(dataDirectory, { recursive: true, mode: 0o700 }),
    mkdir(repositoryPath, { recursive: true, mode: 0o700 }),
    writeNativeWrapper(runtimePath, "core"),
  ]);
  await writeFile(join(dataDirectory, "dev-flow.db"), "fake retained data\n", { mode: 0o600 });
  return {
    runtimePath,
    dataDirectory,
    repositoryPath,
    taskId: "task-00000001",
    environment: {
      ...process.env,
      FAKE_NATIVE_STATE: join(root, "state.json"),
      FAKE_NATIVE_TRACE: tracePath,
      FAKE_NATIVE_TOOL_PATH: fakeNativeToolPath,
      FAKE_NATIVE_PACKAGE_VERSION: "0.1.0",
      FAKE_NATIVE_CORE_MODE: mode,
    },
  };
}

async function writeNativeWrapper(path, role) {
  await writeFile(
    path,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(fakeNativeToolPath)} ${shellQuote(role)} "$@"\n`,
    { mode: 0o700 },
  );
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

async function readJSONL(path) {
  return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
}

async function nativeCommitFixture(writer) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-pass-commit-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = join(root, "canonical", "codex-macos-arm64.json");
  const recoveryDirectory = join(root, "recovery");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writer.initializeAttemptLedger(ledgerPath);
  const identity = nativeIdentity("b");
  const reservation = await writer.reserveNativeAttempt({
    ledgerPath,
    evidencePath,
    identity,
    reservedAt: "2026-08-16T02:00:00.000Z",
  });
  const prepared = writer.preparePassingAttempt({
    reservation,
    observedFacts: { host: "codex-cli", task_id: "task-1", terminal_outcome: "DONE" },
    completedAt: "2026-08-16T02:10:00.000Z",
    evidence: {
      schema_version: 3,
      status: "pass",
      recorded_at: "2026-08-16T02:11:00.000Z",
      classification: "recorded-test-candidate",
    },
  });
  let validated = false;
  const commit = {
    ledgerPath,
    evidencePath,
    recoveryDirectory,
    reservation,
    prepared,
    async validateCandidates(candidate) {
      assert.equal(candidate.evidenceBytes, prepared.evidenceBytes);
      assert.equal(candidate.finalLedgerBytes, prepared.finalLedgerBytes);
      assert.equal(candidate.observedFactsBytes, prepared.observedFactsBytes);
      validated = true;
      return { valid: true, structuralErrors: [], semanticErrors: [] };
    },
    beforePublish() {
      assert.equal(validated, true, "candidate validation must precede evidence publication");
    },
  };
  return { root, ledgerPath, evidencePath, recoveryDirectory, reservation, prepared, commit };
}

function nativeIdentity(seed) {
  return {
    source_commit: seed.repeat(40),
    validation_report_sha256: "1".repeat(64),
    artifact_report_sha256: "2".repeat(64),
    artifact_sha256: "3".repeat(64),
  };
}

function orchestrationPreflight(ledgerId) {
  const identity = nativeIdentity("7");
  const observation = (command, completedAt) => ({
    command,
    result: "pass",
    source_commit: identity.source_commit,
    completed_at: completedAt,
  });
  return {
    validation: {
      source_commit: identity.source_commit,
      completed_at: "2026-08-16T05:00:00.000Z",
      targeted_checks: [
        observation("go test ./internal/version ./tests/contract", "2026-08-16T04:10:00.000Z"),
        observation("node --test packages/codex/tests/*.test.mjs", "2026-08-16T04:20:00.000Z"),
      ],
      root_validation: observation("pnpm run validate", "2026-08-16T04:30:00.000Z"),
    },
    validationText: "validation-report-bytes\n",
    artifact: {
      artifact_path: "/external/dev-flow-codex.tgz",
      artifact_sha256: identity.artifact_sha256,
      artifact_report_sha256: identity.artifact_report_sha256,
      built_at: "2026-08-16T05:30:00.000Z",
      package_version: "0.1.0",
      core_version: "0.1.0",
    },
    artifactText: "artifact-report-bytes\n",
    artifactBytes: "artifact-bytes",
    ledgerId,
    schemas: {},
    rootVersion: "0.1.0",
    identity,
  };
}

function recordedSessionStreams() {
  return {
    ordinary: JSON.stringify({ type: "thread.started", thread_id: "thread-ordinary" }),
    invalid: JSON.stringify({ type: "thread.started", thread_id: "thread-invalid" }),
    substantive: sessionJSONL("thread-substantive", [
      actionObservation(4, "action-implement", false),
    ]),
    resume: sessionJSONL("thread-resume", [
      taskObservation("dev_flow_get_task", 4, false),
      taskObservation("dev_flow_get_next_action", 4, false),
      actionObservation(8, "action-handoff", true),
    ], [nativeCommandObservation()]),
  };
}

function passingNativeJourney() {
  return {
    task_lineage: {
      task_id_before_restart: "task-00000001",
      task_id_after_restart: "task-00000001",
      revisions: [4, 8],
      committed_actions: [
        { action_id: "action-implement", revision: 4, arguments_sha256: "1".repeat(64), result_sha256: "2".repeat(64) },
        { action_id: "action-handoff", revision: 8, arguments_sha256: "3".repeat(64), result_sha256: "4".repeat(64) },
      ],
      terminal_outcome: "DONE",
    },
    invocation: {
      explicit_selector: "$dev-flow",
      core_call_count: 2,
      scenario_call_budget: 64,
      implicit_invocation_core_calls: 0,
      read_before_retry_observations: 0,
    },
    lifecycle: {
      setup_readback_passed: true,
      restart_resume_passed: true,
      remove_readback_passed: true,
      task_data_retained: true,
      task_reopened_after_removal: true,
      compatible_reinstall_passed: true,
    },
    repository: {
      target_path: "/tmp/dev-flow-native-target",
      digest_before: "5".repeat(64),
      digest_after_completion: "6".repeat(64),
      digest_after_removal: "6".repeat(64),
      intended_changed_paths: ["native-proof.txt"],
      unexpected_changed_paths: [],
    },
    task_data: {
      manifest_before_removal_sha256: "8".repeat(64),
      manifest_after_removal_sha256: "8".repeat(64),
      files_before_removal: ["dev-flow.db"],
      files_after_removal: ["dev-flow.db"],
    },
  };
}

function coreEnvelope({
  revision,
  actionId,
  terminal,
  tool = "dev_flow_apply_action",
  budget = nativeVerificationBudget,
  evidence = terminal ? [nativeRetainedEvidence()] : undefined,
}) {
  const task = {
    task_id: "task-00000001",
    revision,
    phase: terminal ? "DONE" : "IMPLEMENT",
    last_operation: {
      kind: tool === "dev_flow_apply_action" ? "apply_action" : "read",
      action_id: actionId,
      to_revision: revision,
    },
    outcome: terminal ? { status: "completed" } : null,
  };
  if (budget) task.contract = { verification_budget: structuredClone(budget) };
  if (evidence) task.evidence = structuredClone(evidence);
  const envelope = {
    schema_version: 1,
    ok: true,
    request_id: `request-${revision}`,
    tool,
    result: { task },
  };
  if (tool === "dev_flow_get_next_action") envelope.result = task;
  return envelope;
}

function codexMCPItem(tool, envelope, arguments_ = defaultMCPArguments(tool, envelope)) {
  return {
    id: `item-${envelope.request_id}`,
    type: "mcp_tool_call",
    server: "dev-flow",
    tool,
    arguments: arguments_,
    result: {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
      structured_content: envelope,
    },
    error: null,
    status: "completed",
  };
}

function defaultMCPArguments(tool, envelope) {
  const arguments_ = { request_id: envelope.request_id };
  if (tool === "dev_flow_apply_action" && envelope.result?.task?.phase === "DONE") {
    arguments_.payload = {
      checks: [{
        source: "automated",
        name: nativeAutomatedCheck.name,
        status: "passed",
        summary: "one targeted command passed",
        command_count: nativeAutomatedCheck.commandCount,
        full_suite: nativeAutomatedCheck.fullSuite,
      }],
    };
  }
  return arguments_;
}

function nativeRetainedEvidence() {
  return {
    evidence_id: "evidence-targeted",
    source: "automated",
    name: nativeAutomatedCheck.name,
    status: "passed",
    summary: "one targeted command passed",
    digest: "a".repeat(64),
    command_count: nativeAutomatedCheck.commandCount,
    full_suite: nativeAutomatedCheck.fullSuite,
    recorded_at: "2026-08-16T00:00:00Z",
  };
}

function nativeCommandObservation() {
  return {
    itemId: "command-targeted",
    command: nativeVerificationCommand,
    output: nativeVerificationOutput,
    exitCode: 0,
    status: "completed",
  };
}

function nativeCommandExecution() {
  return {
    itemId: "command-targeted",
    command: nativeVerificationCommand,
    exitCode: 0,
    status: "completed",
    outputSha256: sha256Text(nativeVerificationOutput),
    fullSuite: false,
  };
}

function nativeCommandFact() {
  const execution = nativeCommandExecution();
  return {
    item_id: execution.itemId,
    command: execution.command,
    exit_code: execution.exitCode,
    status: execution.status,
    output_sha256: execution.outputSha256,
    full_suite: execution.fullSuite,
  };
}

function nativeAutomatedCheckFact() {
  return {
    name: nativeAutomatedCheck.name,
    command_count: nativeAutomatedCheck.commandCount,
    full_suite: nativeAutomatedCheck.fullSuite,
  };
}

function nativeTerminalTask() {
  return coreEnvelope({
    revision: 8,
    actionId: "action-handoff",
    terminal: true,
    tool: "dev_flow_apply_action",
  }).result.task;
}
