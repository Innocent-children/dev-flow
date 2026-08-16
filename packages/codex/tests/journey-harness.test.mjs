import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdtemp, mkdir, readFile, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
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
const nativeVerificationRenderedCommand = "/bin/zsh -lc 'git hash-object native-proof.txt'";
const nativeSkillSelector = "$dev-flow-codex:dev-flow";
const nativeSessionRoles = ["ordinary", "invalid", "substantive", "resume"];
const ordinaryAmbientCommand = "/bin/zsh -lc pwd";
const invalidGitProbeCommand = "/bin/zsh -lc 'git rev-parse --show-toplevel'";
const substantiveRepositoryCommand = "/bin/zsh -lc 'git status --short'";
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
  const evidencePathIdentity = await writer.prepareCanonicalEvidenceParent({
    repositoryRoot: fixture.root,
    evidencePath: fixture.evidencePath,
  });

  const recovery = await writer.recoverPassingAttempt({
    ledgerPath: fixture.ledgerPath,
    evidencePath: fixture.evidencePath,
    evidencePathIdentity,
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
  const evidencePathIdentity = await writer.prepareCanonicalEvidenceParent({
    repositoryRoot: fixture.root,
    evidencePath: fixture.evidencePath,
  });
  const recovery = await writer.recoverPassingAttempt({
    ledgerPath: fixture.ledgerPath,
    evidencePath: fixture.evidencePath,
    evidencePathIdentity,
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

test("Codex 0.147 failed MCP complete Core error remains an authoritative tool_error_result", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const envelope = recoverableCoreErrorEnvelope();
  const item = failedCoreMCPItem("dev_flow_apply_action", envelope, recoverableApplyArguments());
  const parsed = writer.parseCodexExecJSONL(mcpItemSessionJSONL("thread-failed-core-result", [item]), {
    sessionRole: "resume",
  });

  assert.equal(parsed.devFlowCalls.length, 1);
  assert.deepEqual(parsed.devFlowCalls[0], {
    itemId: item.id,
    eventIndex: 0,
    tool: "dev_flow_apply_action",
    arguments: recoverableApplyArguments(),
    result: envelope,
    status: "failed",
    resultKind: "tool_error_result",
    resultSha256: canonicalJSONSha256(item.result),
  });
});

test("Codex 0.147 failed MCP transport error stops fail-closed with only safe attributable context", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const typedError = transportMCPError();
  const item = failedTransportMCPItem("dev_flow_apply_action", typedError, recoverableApplyArguments());

  assert.throws(
    () => writer.parseCodexExecJSONL(mcpItemSessionJSONL("thread-transport-error", [item]), {
      sessionRole: "resume",
    }),
    (error) => {
      assert.match(error.message, /transport.*(?:without|no).*Core|Core.*transport.*fail.*closed/i);
      assert.equal(error.failureStage, "mcp_failed");
      assert.deepEqual(error.mcpFailureContext, {
        session_role: "resume",
        event_type: "mcp_tool_call",
        event_index: 0,
        tool: "dev_flow_apply_action",
        status: "failed",
        result_kind: "transport_error",
        result_sha256: null,
        error_sha256: canonicalJSONSha256(typedError),
      });
      assert.equal(JSON.stringify(error.mcpFailureContext).includes(typedError.message), false);
      return true;
    },
  );
});

test("malformed completed and inconsistent failed MCP shapes remain protocol parse failures", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const successEnvelope = coreEnvelope({
    revision: 4,
    actionId: "action-implement",
    terminal: false,
  });
  const malformedCompleted = codexMCPItem("dev_flow_apply_action", successEnvelope);
  malformedCompleted.result.content = [];
  const mixedFailed = failedCoreMCPItem(
    "dev_flow_apply_action",
    recoverableCoreErrorEnvelope(),
    recoverableApplyArguments(),
  );
  mixedFailed.error = transportMCPError();
  const failedSuccess = failedCoreMCPItem(
    "dev_flow_apply_action",
    successEnvelope,
    recoverableApplyArguments(),
  );

  for (const [label, item] of [
    ["completed-truncated", malformedCompleted],
    ["failed-mixed-result-and-error", mixedFailed],
    ["failed-complete-ok-true", failedSuccess],
  ]) {
    await t.test(label, () => {
      let observed;
      assert.throws(
        () => writer.parseCodexExecJSONL(mcpItemSessionJSONL(`thread-${label}`, [item]), {
          sessionRole: "resume",
        }),
        (error) => {
          observed = error;
          return /protocol|complete|structured|inconsistent|ok=false/i.test(error.message);
        },
      );
      assert.equal(observed.failureStage, undefined);
      assert.equal(observed.mcpFailureContext, undefined);
    });
  }
});

test("authoritative Core envelopes are closed and bound to the outer MCP tool", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const success = coreEnvelope({
    revision: 4,
    actionId: "action-implement",
    terminal: false,
  });
  const failure = recoverableCoreErrorEnvelope();
  const cases = [
    ["success-wrong-schema-version", "completed", { ...success, schema_version: 2 }],
    ["success-empty-request-id", "completed", { ...success, request_id: "" }],
    ["success-wrong-envelope-tool", "completed", { ...success, tool: "dev_flow_get_task" }],
    ["success-missing-result", "completed", (() => {
      const envelope = structuredClone(success);
      delete envelope.result;
      return envelope;
    })()],
    ["success-extra-field", "completed", { ...success, debug: true }],
    ["success-with-error", "completed", {
      ...success,
      error: structuredClone(failure.error),
    }],
    ["failure-missing-error-message", "failed", (() => {
      const envelope = structuredClone(failure);
      delete envelope.error.message;
      return envelope;
    })()],
    ["failure-missing-recovery-message", "failed", (() => {
      const envelope = structuredClone(failure);
      delete envelope.recovery.message;
      return envelope;
    })()],
    ["failure-extra-envelope-field", "failed", { ...failure, debug: true }],
    ["failure-extra-error-field", "failed", {
      ...failure,
      error: { ...failure.error, raw: "must not pass" },
    }],
    ["failure-extra-recovery-field", "failed", {
      ...failure,
      recovery: { ...failure.recovery, retry_after_ms: 1 },
    }],
    ["failure-with-result", "failed", { ...failure, result: {} }],
  ];

  for (const [label, status, envelope] of cases) {
    await t.test(label, () => {
      const item = status === "failed"
        ? failedCoreMCPItem("dev_flow_apply_action", envelope, recoverableApplyArguments())
        : codexMCPItem("dev_flow_apply_action", envelope, recoverableApplyArguments());
      assert.throws(
        () => writer.parseCodexExecJSONL(mcpItemSessionJSONL(`thread-${label}`, [item]), {
          sessionRole: "resume",
        }),
        /Core envelope|schema.version|request.id|envelope.tool|closed|exclusive|error|recovery|result/i,
      );
    });
  }

  for (const [label, item] of [
    ["success-mismatched-request-id", codexMCPItem(
      "dev_flow_apply_action",
      success,
      { ...recoverableApplyArguments(), request_id: "request-outer" },
    )],
    ["failure-mismatched-request-id", failedCoreMCPItem(
      "dev_flow_apply_action",
      failure,
      { ...recoverableApplyArguments(), request_id: "request-outer" },
    )],
  ]) {
    await t.test(label, () => {
      assert.throws(
        () => writer.parseCodexExecJSONL(mcpItemSessionJSONL(`thread-${label}`, [item]), {
          sessionRole: "resume",
        }),
        /request.id|identity|correlation/i,
      );
    });
  }
});

test("recoverable failed apply follows exact Core-directed reads before the next mutation", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const recovery = recoverableResumeItems();
  const sessions = {
    ordinary: writer.parseCodexExecJSONL(mcpItemSessionJSONL("thread-ordinary", []), { sessionRole: "ordinary" }),
    invalid: writer.parseCodexExecJSONL(mcpItemSessionJSONL("thread-invalid", []), { sessionRole: "invalid" }),
    substantive: writer.parseCodexExecJSONL(sessionJSONL("thread-substantive", [
      actionObservation(4, "action-implement", false),
    ]), { sessionRole: "substantive" }),
    resume: writer.parseCodexExecJSONL(recovery.jsonl, {
      sessionRole: "resume",
    }),
  };
  const summary = writer.summarizeRecordedSessions(sessions);

  assert.equal(summary.terminalOutcome, "DONE");
  assert.equal(summary.coreCallCount, 7);
  assert.equal(summary.readBeforeRetryObservations, 4);
  assert.deepEqual(summary.recoverableMCPFailureFacts, [recovery.fact]);
  assert.equal(summary.mcpCallFacts.length, 7);
  assert.deepEqual(
    summary.mcpCallFacts.map(({ session_role, event_index, tool, status, result_kind }) => ({
      session_role,
      event_index,
      tool,
      status,
      result_kind,
    })),
    recovery.expectedCallOrder,
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
        command: nativeVerificationRenderedCommand,
        aggregated_output: output,
        exit_code: 0,
        status: "completed",
      },
    }),
  ].join("\n"));

  assert.deepEqual(parsed.commandExecutions, [sessionCommandFact({
    role: "resume",
    eventIndex: 1,
    itemId: "command-complete",
    command: nativeVerificationRenderedCommand,
    output,
    classification: "verification",
  })]);
  assert.equal(JSON.stringify(parsed).includes(output.trim()), false, "raw command output must be discarded");
  assert.equal(JSON.stringify(parsed).includes(nativeVerificationRenderedCommand), false, "raw rendered command must be discarded");
});

test("native proof command classification accepts only the exact official rendered command", async () => {
  const writer = await import(pathToFileURL(writerPath));
  let allowedError = null;
  try {
    const allowed = writer.parseCodexExecJSONL(sessionJSONL("thread-command-allowed", [], [nativeCommandObservation()]));
    assert.deepEqual(allowed.commandExecutions, [sessionCommandFact({
      role: "resume",
      eventIndex: 0,
      itemId: "command-targeted",
      command: nativeVerificationRenderedCommand,
      output: nativeVerificationOutput,
      classification: "verification",
    })]);
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

  const disallowedProofRenderings = [
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
    `sh -c '${nativeVerificationCommand}'`,
    `"${nativeVerificationCommand}"`,
    `true && ${nativeVerificationCommand}`,
    `${nativeVerificationCommand}; true`,
    `${nativeVerificationCommand} | tee native-proof.log`,
    `env NODE_OPTIONS='' ${nativeVerificationCommand}`,
    ` ${nativeVerificationCommand}`,
    nativeVerificationCommand.replace(" hash-object ", "  hash-object "),
    `git hash-object "native-proof.txt"`,
    `git hash-object -- native-proof.txt`,
  ];
  const accepted = disallowedProofRenderings.filter((command, index) => {
    try {
      writer.parseCodexExecJSONL(sessionJSONL(`thread-command-rejected-${index}`, [], [{
        ...nativeCommandObservation(),
        itemId: `command-rejected-${index}`,
        command,
      }]));
      return true;
    } catch (error) {
      assert.match(error.message, /proof rendering.*unbound|unbound.*proof rendering|known test.*full-suite/i);
      return false;
    }
  });
  assert.deepEqual({ allowedError, accepted }, {
    allowedError: null,
    accepted: [],
  }, "only the exact official rendered proof may be accepted");
});

test("session-aware native command facts retain ambient and invalid probes without charging verification", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const ordinaryOutput = "/isolated/target\n";
  const invalidOutput = "fatal: not a git repository\n";
  const repositoryOutput = "?? native-proof.txt\n";
  const sessions = parsedRecordedSessions(writer, {
    ordinaryCommands: [commandObservation({
      itemId: "command-ordinary-ambient",
      command: ordinaryAmbientCommand,
      output: ordinaryOutput,
    })],
    invalidCommands: [commandObservation({
      itemId: "command-invalid-git-probe",
      command: invalidGitProbeCommand,
      output: invalidOutput,
      exitCode: 128,
      status: "failed",
    })],
    substantiveCommands: [commandObservation({
      itemId: "command-substantive-repository",
      command: substantiveRepositoryCommand,
      output: repositoryOutput,
    })],
    resumeCommands: [nativeCommandObservation()],
  });
  const summary = writer.summarizeRecordedSessions(sessions);

  assert.deepEqual(summary.sessionCommandFacts, [
    sessionCommandFact({
      role: "ordinary",
      eventIndex: 0,
      itemId: "command-ordinary-ambient",
      command: ordinaryAmbientCommand,
      output: ordinaryOutput,
    }),
    sessionCommandFact({
      role: "invalid",
      eventIndex: 0,
      itemId: "command-invalid-git-probe",
      command: invalidGitProbeCommand,
      output: invalidOutput,
      exitCode: 128,
      status: "failed",
    }),
    sessionCommandFact({
      role: "substantive",
      eventIndex: 1,
      itemId: "command-substantive-repository",
      command: substantiveRepositoryCommand,
      output: repositoryOutput,
    }),
    sessionCommandFact({
      role: "resume",
      eventIndex: 3,
      itemId: "command-targeted",
      command: nativeVerificationRenderedCommand,
      output: nativeVerificationOutput,
      classification: "verification",
    }),
  ]);
  assert.deepEqual(summary.commandExecutions, [nativeCommandExecution({ eventIndex: 3 })]);
  const safeFacts = JSON.stringify(summary.sessionCommandFacts);
  for (const raw of [ordinaryAmbientCommand, ordinaryOutput.trim(), invalidGitProbeCommand, invalidOutput.trim(), substantiveRepositoryCommand, repositoryOutput.trim()]) {
    assert.equal(safeFacts.includes(raw), false, `safe command facts must not retain raw value: ${raw}`);
  }
});

test("session-aware proof binding rejects ordinary, unbound, and duplicate rendered proof events", async () => {
  const writer = await import(pathToFileURL(writerPath));
  assert.throws(
    () => parsedRecordedSessions(writer, {
      ordinaryCommands: [nativeCommandObservation({ itemId: "command-ordinary-proof" })],
      resumeCommands: [],
    }),
    /ordinary.*proof.*unbound|proof.*ordinary.*unbound/i,
  );
  assert.throws(
    () => writer.summarizeRecordedSessions(parsedRecordedSessions(writer, {
      resumeCommands: [
        nativeCommandObservation({ itemId: "command-proof-first" }),
        nativeCommandObservation({ itemId: "command-proof-duplicate" }),
      ],
    })),
    /duplicate.*proof|proof.*exactly once/i,
  );
  assert.throws(
    () => writer.summarizeRecordedSessions(parsedRecordedSessions(writer, {
      resume: [
        taskObservation("dev_flow_get_task", 4, false),
        taskObservation("dev_flow_get_next_action", 4, false),
        actionObservation(8, "action-handoff", true, { evidence: [] }),
      ],
    })),
    /unbound.*proof|proof.*submitted.*retained/i,
  );
});

test("session-aware command classification rejects every known test and root full-suite marker", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const commands = [
    "/bin/zsh -lc 'go test ./...'",
    "/bin/zsh -lc 'pnpm test'",
    "/bin/zsh -lc 'pnpm run test'",
    "/bin/zsh -lc 'pnpm run validate'",
    "/bin/zsh -lc 'node --test packages/codex/tests/*.test.mjs'",
  ];
  for (const [index, command] of commands.entries()) {
    assert.throws(
      () => writer.parseCodexExecJSONL(sessionJSONL(`thread-denied-${index}`, [], [commandObservation({
        itemId: `command-denied-${index}`,
        command,
        output: "unexpected test output\n",
      })]), { sessionRole: "substantive" }),
      /known test.*full-suite|full-suite.*marker/i,
      command,
    );
  }
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
      command: nativeVerificationRenderedCommand,
      output: nativeVerificationOutput,
      exitCode: 0,
      status: "completed",
    }],
  });
  const summary = writer.summarizeRecordedSessions(sessions);
  assert.equal(summary.terminalPhase, "DONE");
  assert.deepEqual(summary.restartRecoveryReads, ["dev_flow_get_task", "dev_flow_get_next_action"]);
  assert.deepEqual(summary.budget, budget);
  assert.deepEqual(summary.commandExecutions, [nativeCommandExecution({ eventIndex: 3 })]);
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
    readBeforeRetryObservations: 2,
    mcpCallFacts: [
      successfulMCPCallFact("substantive", 0, actionObservation(4, "action-implement", false)),
      successfulMCPCallFact("resume", 0, taskObservation("dev_flow_get_task", 4, false)),
      successfulMCPCallFact("resume", 1, taskObservation("dev_flow_get_next_action", 4, false)),
      successfulMCPCallFact("resume", 2, actionObservation(8, "action-handoff", true)),
    ],
    recoverableMCPFailureFacts: [],
    budget: nativeVerificationBudget,
    sessionCommandFacts: [sessionCommandFact({
      role: "resume",
      eventIndex: 3,
      itemId: "command-targeted",
      command: nativeVerificationRenderedCommand,
      output: nativeVerificationOutput,
      classification: "verification",
    })],
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
  assert.match(invalid.arguments.at(-1), /^\$dev-flow-codex:dev-flow\b/);
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
  const diagnostic = nativeDiagnosticV3();
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

test("reopened failed diagnostics reject journey-shaped failure records outside the closed diagnostic schema", async (t) => {
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
    /diagnostic.*schema|schema.*diagnostic|honest.*external record/i,
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
      diagnostic: { ...nativeDiagnosticV3(), journey: { unsupported: true } },
    }),
    /unexpected.*journey|closed.*journey|diagnostic.*schema/i,
  );
});

test("command-event diagnostics use v3 safe context and reject every raw leak", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-diagnostic-v3-");
  const canonicalEvidencePath = join(root, "canonical.json");
  const recoveryDirectory = join(root, "recovery");
  const diagnostic = nativeDiagnosticV3();
  const outputPath = join(recoveryDirectory, "failed.json");

  await writer.writeFailureDiagnostic({
    outputPath,
    canonicalEvidencePath,
    recoveryDirectory,
    diagnostic,
  });
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), diagnostic);
  const diagnosticText = await readFile(outputPath, "utf8");
  for (const raw of [nativeVerificationRenderedCommand, nativeVerificationOutput.trim(), "/private/target/native-proof.txt"]) {
    assert.equal(diagnosticText.includes(raw), false, `diagnostic must not retain raw value: ${raw}`);
  }

  const cases = [
    ["required.*failure_context|failure_context.*required", (candidate) => { delete candidate.failure_context; }],
    ["raw_command.*not allowed|failure.*exactly one", (candidate) => { candidate.failure.raw_command = nativeVerificationRenderedCommand; }],
    ["raw_output.*not allowed|failure.*exactly one", (candidate) => { candidate.failure.raw_output = nativeVerificationOutput; }],
    ["target_path.*not allowed|failure.*exactly one", (candidate) => { candidate.failure.target_path = "/private/target"; }],
    ["must not satisfy.*forbidden|failure_context", (candidate) => { candidate.failure_kind = "non_command"; }],
  ];
  for (const [expected, mutate] of cases) {
    const candidate = nativeDiagnosticV3();
    mutate(candidate);
    await assert.rejects(
      writer.writeFailureDiagnostic({
        outputPath: join(recoveryDirectory, `${sha256Text(expected)}.json`),
        canonicalEvidencePath,
        recoveryDirectory,
        diagnostic: candidate,
      }),
      new RegExp(expected, "i"),
    );
  }
});

test("duplicate completed command item IDs retain v3 command-event context", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const duplicateItemId = "command-duplicate";
  const duplicateCommand = "/bin/zsh -lc 'git status --short'";
  const duplicateOutput = " M native-proof.txt\n";
  const streams = recordedSessionStreams();
  streams.ordinary = sessionJSONL("thread-ordinary", [], [
    commandObservation({
      itemId: duplicateItemId,
      command: ordinaryAmbientCommand,
      output: "/tmp/dev-flow-native-target\n",
    }),
    commandObservation({
      itemId: duplicateItemId,
      command: duplicateCommand,
      output: duplicateOutput,
    }),
  ]);

  await assertCommandEventFailureDiagnostic(t, writer, {
    label: "duplicate-command-item-id",
    streams,
    expectedContext: {
      session_role: "ordinary",
      event_type: "command_execution",
      command_sha256: sha256Text(duplicateCommand),
      output_sha256: sha256Text(duplicateOutput),
      status: "completed",
      exit_code: 0,
    },
    forbiddenRawValues: [duplicateCommand, duplicateOutput.trim(), "/tmp/dev-flow-native-target"],
  });
});

test("Core zero-command budget rejection retains v3 command-event context", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const zeroCommandBudget = { ...nativeVerificationBudget, max_automatic_commands: 0 };
  const streams = recordedSessionStreams();
  streams.substantive = sessionJSONL("thread-substantive", [
    actionObservation(4, "action-implement", false, { budget: zeroCommandBudget }),
  ]);
  streams.resume = sessionJSONL("thread-resume", [
    taskObservation("dev_flow_get_task", 4, false, { budget: zeroCommandBudget }),
    taskObservation("dev_flow_get_next_action", 4, false, { budget: zeroCommandBudget }),
    actionObservation(8, "action-handoff", true, { budget: zeroCommandBudget }),
  ], [nativeCommandObservation()]);

  await assertCommandEventFailureDiagnostic(t, writer, {
    label: "zero-command-budget",
    streams,
    expectedContext: {
      session_role: "resume",
      event_type: "command_execution",
      command_sha256: sha256Text(nativeVerificationRenderedCommand),
      output_sha256: sha256Text(nativeVerificationOutput),
      status: "completed",
      exit_code: 0,
    },
    forbiddenRawValues: [nativeVerificationRenderedCommand, nativeVerificationOutput.trim(), "/tmp/dev-flow-native-target"],
  });
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

test("native prompts and the default fake resolve only the exact installed Skill full name", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const cases = [
    ["exact", `${nativeSkillSelector}\nIn this one current Git repository, create native-proof.txt with exactly the required line.`, 1, true],
    ["bare", "$dev-flow\nIn this one current Git repository, create native-proof.txt with exactly the required line.", 0, false],
    ["wrong-namespace", "$other:dev-flow\nIn this one current Git repository, create native-proof.txt with exactly the required line.", 0, false],
    ["wrong-base", "$dev-flow-codex:other\nIn this one current Git repository, create native-proof.txt with exactly the required line.", 0, false],
    ["missing", "In this one current Git repository, create native-proof.txt with exactly the required line.", 0, false],
  ];
  for (const [label, prompt, expectedCalls, selected] of cases) {
    await t.test(label, async (t) => {
      const result = await runFakeCodexPrompt(t, prompt, label);
      const parsed = writer.parseCodexExecJSONL(result.stdout, { sessionRole: "substantive" });
      assert.equal(parsed.devFlowCalls.length, expectedCalls);
      assert.equal(await optionalContents(join(result.targetPath, "native-proof.txt")) !== null, selected);
      const resolution = (await readJSONL(result.tracePath)).find(({ role }) => role === "native-skill-resolution");
      assert.deepEqual(resolution, {
        role: "native-skill-resolution",
        pluginName: "dev-flow-codex",
        skillName: "dev-flow",
        fullName: "dev-flow-codex:dev-flow",
        explicitSelector: nativeSkillSelector,
        selected,
      });
    });
  }

  const context = {
    targetPath: "/tmp/dev-flow-native-target",
    invalidPath: "/tmp/dev-flow-native-invalid",
    environment: {},
  };
  const ordinaryPrompt = writer.nativeSessionInvocation("ordinary", context, "/external/codex").arguments.at(-1);
  assert.equal(ordinaryPrompt.includes("$dev-flow"), false);
  for (const role of ["invalid", "substantive", "resume"]) {
    assert.equal(
      writer.nativeSessionInvocation(role, context, "/external/codex").arguments.at(-1).startsWith(nativeSkillSelector),
      true,
      `${role} must use the exact installed Skill selector`,
    );
  }
});

test("default fake subprocess emits both official failed MCP variants only for the exact selector", async (t) => {
  const resumePrompt = `${nativeSkillSelector}\nResume the existing compatible Codex-owned task for this repository and continue only from fresh Core results.`;
  const recoverable = await runFakeCodexPrompt(t, resumePrompt, "recoverable-core-error-shape", {
    sessionMode: "recoverable-core-error",
    seedNativeProof: true,
  });
  const recoverableEvents = parseJSONLText(recoverable.stdout);
  const recoverableCalls = recoverableEvents
    .filter(({ type, item }) => type === "item.completed" && item?.type === "mcp_tool_call")
    .map(({ item }) => item);
  assert.deepEqual(recoverableCalls.map(({ tool, status }) => [tool, status]), [
    ["dev_flow_get_task", "completed"],
    ["dev_flow_get_next_action", "completed"],
    ["dev_flow_apply_action", "failed"],
    ["dev_flow_get_task", "completed"],
    ["dev_flow_get_next_action", "completed"],
    ["dev_flow_apply_action", "completed"],
  ]);
  const completeFailure = recoverableCalls[2];
  assert.equal(completeFailure.error, null);
  assert.equal(completeFailure.result.structured_content.ok, false);
  assert.deepEqual(JSON.parse(completeFailure.result.content[0].text), completeFailure.result.structured_content);

  const transport = await runFakeCodexPrompt(t, resumePrompt, "transport-error-shape", {
    sessionMode: "transport-error",
  });
  const transportCalls = parseJSONLText(transport.stdout)
    .filter(({ type, item }) => type === "item.completed" && item?.type === "mcp_tool_call")
    .map(({ item }) => item);
  assert.deepEqual(transportCalls.map(({ tool, status }) => [tool, status]), [
    ["dev_flow_get_task", "completed"],
    ["dev_flow_get_next_action", "completed"],
    ["dev_flow_apply_action", "failed"],
  ]);
  assert.equal(transportCalls[2].result, null);
  assert.deepEqual(transportCalls[2].error, transportMCPError());

  const unselected = await runFakeCodexPrompt(
    t,
    "$dev-flow\nResume the existing compatible Codex-owned task for this repository and continue only from fresh Core results.",
    "recoverable-core-error-unselected",
    { sessionMode: "recoverable-core-error", seedNativeProof: true },
  );
  assert.equal(
    parseJSONLText(unselected.stdout).some(({ item }) => item?.server === "dev-flow"),
    false,
    "role text and failure mode must not synthesize calls without the full selector",
  );
  const resolution = (await readJSONL(unselected.tracePath)).find(({ role }) => role === "native-skill-resolution");
  assert.equal(resolution.selected, false);
});

test("native session failures retain four ordered bounded safe observations", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const success = (role) => ({
    stdout: recordedSessionStreams()[role],
    stderr: "",
    exitCode: 0,
    signal: null,
  });
  const captureError = (message, failureStage, capture) => Object.assign(new Error(message), {
    failureStage,
    sessionCapture: capture,
  });
  const malformedMCP = [
    JSON.stringify({ type: "thread.started", thread_id: "thread-substantive" }),
    JSON.stringify({ type: "item.completed", item: { type: "mcp_tool_call", server: "dev-flow", status: "completed" } }),
  ].join("\n");
  const cases = [
    ["spawn", "ordinary", () => { throw captureError("spawn", "spawn_failed", { stdout: "", stderr: "", exitCode: null, signal: null }); }, "spawn_failed", false],
    ["capture", "ordinary", () => { throw captureError("limit", "capture_failed", { stdout: "partial", stderr: "bounded", exitCode: null, signal: "SIGTERM" }); }, "capture_failed", false],
    ["nonzero", "invalid", () => { throw captureError("exit", "process_exited", { stdout: JSON.stringify({ type: "thread.started", thread_id: "thread-invalid" }), stderr: "safe digest only", exitCode: 7, signal: null }); }, "process_exited", true],
    ["signal", "invalid", () => { throw captureError("signal", "process_exited", { stdout: JSON.stringify({ type: "thread.started", thread_id: "thread-invalid" }), stderr: "", exitCode: null, signal: "SIGTERM" }); }, "process_exited", true],
    ["invalid-json", "substantive", () => ({ stdout: "not-json\n", stderr: "", exitCode: 0, signal: null }), "parse_failed", false],
    ["empty-thread", "substantive", () => ({ stdout: JSON.stringify({ type: "thread.started", thread_id: "" }), stderr: "", exitCode: 0, signal: null }), "parse_failed", false],
    ["missing-thread", "substantive", () => ({ stdout: JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "bounded" } }), stderr: "", exitCode: 0, signal: null }), "parse_failed", false],
    ["malformed-mcp", "substantive", () => ({ stdout: malformedMCP, stderr: "", exitCode: 0, signal: null }), "parse_failed", true],
    ["duplicate-thread", "substantive", () => ({ stdout: [JSON.stringify({ type: "thread.started", thread_id: "thread-a" }), JSON.stringify({ type: "thread.started", thread_id: "thread-b" })].join("\n"), stderr: "", exitCode: 0, signal: null }), "parse_failed", true],
    ["missing-stop", "substantive", () => { throw captureError("stop", "stop_marker_missing", { stdout: JSON.stringify({ type: "thread.started", thread_id: "thread-substantive" }), stderr: "", exitCode: 0, signal: null }); }, "stop_marker_missing", true],
  ];

  for (const [label, failedRole, failure, expectedStage, threadPresent] of cases) {
    await t.test(label, async () => {
      let observedError;
      await assert.rejects(
        writer.runRecordedNativeSessions({
          async spawnSession({ role }) {
            if (role === failedRole) return failure();
            return success(role);
          },
        }),
        (error) => {
          observedError = error;
          return true;
        },
      );
      const observations = observedError.sessionObservations;
      assert.deepEqual(observations.map(({ session_role }) => session_role), ["ordinary", "invalid", "substantive", "resume"]);
      const failed = observations.find(({ session_role }) => session_role === failedRole);
      assert.equal(failed.failure_stage, expectedStage);
      assert.equal(failed.thread_present, threadPresent);
      if (label === "empty-thread") {
        assert.equal(failed.event_counts.thread_started, 0);
        assert.equal(failed.event_counts.other, 1);
      }
      assert.deepEqual(
        Object.keys(failed).sort(),
        ["event_counts", "exit_code", "failure_stage", "item_counts", "mcp_status_counts", "session_role", "signal", "stderr_bytes", "stderr_sha256", "stdout_bytes", "stdout_sha256", "thread_present"].sort(),
      );
      for (const role of nativeSessionRolesAfter(failedRole)) {
        assert.deepEqual(observations.find(({ session_role }) => session_role === role), emptySessionObservation(role));
      }
      assert.equal(JSON.stringify(observations).includes("safe digest only"), false);
      assert.equal(JSON.stringify(observations).includes("thread-invalid"), false);
    });
  }
});

test("native capture retains exact raw stream facts and uses a strict cross-chunk UTF-8 view", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-native-raw-capture-");
  const capture = (source) => writer.captureCodexJSONL(process.execPath, ["-e", source], {
    cwd: root,
    env: process.env,
    stopAfterFirstApply: false,
  });

  await t.test("invalid-byte", async () => {
    const raw = Buffer.from([0x7b, 0xff, 0x7d, 0x0a]);
    await assert.rejects(
      () => capture(`process.stdout.write(Buffer.from(${JSON.stringify(raw.toString("base64"))}, "base64"));`),
      (error) => {
        assert.equal(error.failureStage, "parse_failed");
        assert.equal(error.sessionCapture.stdoutBytes, raw.length);
        assert.equal(error.sessionCapture.stdoutSha256, sha256Text(raw));
        assert.equal(error.sessionCapture.stdoutInvalidUtf8, true);
        return true;
      },
    );
  });

  await t.test("exact-64-mib-boundary", async () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    const hash = createHash("sha256");
    for (let index = 0; index < 64; index += 1) hash.update(chunk);
    const result = await capture([
      "const chunk = Buffer.alloc(1024 * 1024, 0x61);",
      "for (let index = 0; index < 64; index += 1) process.stderr.write(chunk);",
    ].join("\n"));
    assert.equal(result.stderrBytes, 64 * 1024 * 1024);
    assert.equal(result.stderrSha256, hash.digest("hex"));
  });

  const cappedStreamDigest = () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    const hash = createHash("sha256");
    for (let index = 0; index < 64; index += 1) hash.update(chunk);
    return hash.digest("hex");
  };

  await t.test("stdout-over-64-mib-boundary", async () => {
    await assert.rejects(
      () => capture("process.stdout.write(Buffer.alloc(64 * 1024 * 1024 - 1, 0x61), () => "
        + "setTimeout(() => process.stdout.end(Buffer.from([0x61, 0x62])), 50));"),
      (error) => {
        assert.equal(error.failureStage, "capture_failed");
        assert.match(error.message, /bounded stdout limit/i);
        assert.equal(error.sessionCapture.stdoutBytes, 64 * 1024 * 1024);
        assert.equal(error.sessionCapture.stdoutSha256, cappedStreamDigest());
        return true;
      },
    );
  });

  await t.test("stderr-over-64-mib-boundary", async () => {
    await assert.rejects(
      () => capture("process.stderr.write(Buffer.alloc(64 * 1024 * 1024 - 1, 0x61), () => "
        + "setTimeout(() => process.stderr.end(Buffer.from([0x61, 0x62])), 50));"),
      (error) => {
        assert.equal(error.failureStage, "capture_failed");
        assert.match(error.message, /bounded stderr limit/i);
        assert.equal(error.sessionCapture.stderrBytes, 64 * 1024 * 1024);
        assert.equal(error.sessionCapture.stderrSha256, cappedStreamDigest());
        return true;
      },
    );
  });

  await t.test("split-multibyte", async () => {
    const expected = `${JSON.stringify({ type: "thread.started", thread_id: "thread-😀" })}\n`;
    const raw = Buffer.from(expected);
    const emoji = Buffer.from("😀");
    const emojiOffset = raw.indexOf(emoji);
    const first = raw.subarray(0, emojiOffset + 2);
    const second = raw.subarray(emojiOffset + 2);
    const result = await capture([
      `process.stdout.write(Buffer.from(${JSON.stringify(first.toString("base64"))}, "base64"));`,
      `setTimeout(() => process.stdout.end(Buffer.from(${JSON.stringify(second.toString("base64"))}, "base64")), 20);`,
    ].join("\n"));
    assert.equal(result.stdout, expected);
    assert.equal(result.stdoutBytes, raw.length);
    assert.equal(result.stdoutSha256, sha256Text(raw));
    assert.equal(result.stdoutInvalidUtf8, false);
  });
});

test("native orchestration prepares the missing exact canonical evidence parent before host work", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-canonical-parent-success-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
  await writer.initializeAttemptLedger(ledgerPath);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  const streams = recordedSessionStreams();
  const times = [
    "2026-08-16T09:00:00.000Z",
    "2026-08-16T09:01:00.000Z",
    "2026-08-16T09:02:00.000Z",
  ];
  await assert.rejects(stat(dirname(evidencePath)), { code: "ENOENT" });

  const result = await writer.executeNativeJourney({
    validationReportPath: "/external/validation-report.json",
    artifactReportPath: "/external/artifact-report.json",
    codexExecutable: "/external/codex-0.147.0",
    ledgerPath,
  }, {
    evidencePath,
    evidenceRepositoryRoot: root,
    recoveryRoot,
    platform: "darwin",
    arch: "arm64",
    now: () => times.shift(),
    async preflight() { return structuredClone(preflight); },
    async assertFrozenSource() {},
    async prepareHost() {
      assert.equal((await stat(dirname(evidencePath))).isDirectory(), true);
      assert.deepEqual(JSON.parse(await readFile(ledgerPath, "utf8")).attempts, []);
      return { targetPath: "/tmp/dev-flow-native-target" };
    },
    async spawnSession({ role }) { return streams[role]; },
    async finishHost() {
      return { journey: passingNativeJourney(), observedFacts: { classification: "native" } };
    },
    validateCandidate() { return { valid: true, structuralErrors: [], semanticErrors: [] }; },
    async cleanupHost() {},
  });

  assert.equal(result.status, "committed");
  assert.equal(JSON.parse(await readFile(evidencePath, "utf8")).status, "pass");
});

test("canonical evidence parent rejects escapes, symlinks, and non-directories", async (t) => {
  const writer = await import(pathToFileURL(writerPath));

  await t.test("escape", async (t) => {
    const root = await temporaryRoot(t, "dev-flow-codex-canonical-parent-escape-");
    await assert.rejects(
      writer.prepareCanonicalEvidenceParent({
        repositoryRoot: root,
        evidencePath: join(root, "outside.json"),
      }),
      /exact canonical.*path|containment|outside/i,
    );
  });

  await t.test("symlink", async (t) => {
    const root = await temporaryRoot(t, "dev-flow-codex-canonical-parent-symlink-");
    const outside = await temporaryRoot(t, "dev-flow-codex-canonical-parent-outside-");
    await mkdir(join(root, "tests"));
    await symlink(outside, join(root, "tests", "journeys"));
    await assert.rejects(
      writer.prepareCanonicalEvidenceParent({
        repositoryRoot: root,
        evidencePath: canonicalEvidencePathForRoot(root),
      }),
      /symlink|symbolic link/i,
    );
  });

  await t.test("non-directory", async (t) => {
    const root = await temporaryRoot(t, "dev-flow-codex-canonical-parent-file-");
    await mkdir(join(root, "tests"));
    await writeFile(join(root, "tests", "journeys"), "not a directory\n");
    await assert.rejects(
      writer.prepareCanonicalEvidenceParent({
        repositoryRoot: root,
        evidencePath: canonicalEvidencePathForRoot(root),
      }),
      /not a directory|must be a directory/i,
    );
  });
});

test("canonical evidence parent failures precede ledger reservation and all host work", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const kind of ["symlink", "permission"]) {
    await t.test(kind, async (t) => {
      const root = await temporaryRoot(t, `dev-flow-codex-canonical-parent-prehost-${kind}-`);
      const ledgerPath = join(root, "attempt-ledger.json");
      const evidencePath = canonicalEvidencePathForRoot(root);
      const recoveryRoot = join(root, "recovery");
      const testsPath = join(root, "tests");
      await writer.initializeAttemptLedger(ledgerPath);
      const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
      await mkdir(testsPath);
      if (kind === "symlink") {
        const outside = await temporaryRoot(t, "dev-flow-codex-canonical-parent-prehost-outside-");
        await symlink(outside, join(testsPath, "journeys"));
      } else {
        await chmod(testsPath, 0o500);
      }
      let prepareHostCalls = 0;
      let spawnCalls = 0;
      const times = [
        "2026-08-16T09:10:00.000Z",
        "2026-08-16T09:11:00.000Z",
        "2026-08-16T09:12:00.000Z",
      ];
      try {
        await assert.rejects(
          writer.executeNativeJourney({
            validationReportPath: "/external/validation-report.json",
            artifactReportPath: "/external/artifact-report.json",
            codexExecutable: "/external/codex-0.147.0",
            ledgerPath,
          }, {
            evidencePath,
            evidenceRepositoryRoot: root,
            recoveryRoot,
            platform: "darwin",
            arch: "arm64",
            now: () => times.shift(),
            async preflight() { return structuredClone(preflight); },
            async assertFrozenSource() {},
            async prepareHost() {
              prepareHostCalls += 1;
              return { targetPath: "/tmp/dev-flow-native-target" };
            },
            async spawnSession() {
              spawnCalls += 1;
              throw new Error("host work must not start");
            },
            async cleanupHost() {},
          }),
          kind === "symlink" ? /symlink|symbolic link/i : /permission|EACCES|operation not permitted/i,
        );
      } finally {
        if (kind === "permission") await chmod(testsPath, 0o700);
      }
      assert.equal(prepareHostCalls, 0);
      assert.equal(spawnCalls, 0);
      assert.deepEqual(JSON.parse(await readFile(ledgerPath, "utf8")).attempts, []);
      assert.equal(await optionalContents(`${ledgerPath}.lock`), null);
    });
  }
});

test("canonical evidence path rejects symlinked leaf and recovery aliases before admission", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const kind of ["dangling-leaf", "passing-leaf", "passing-parent"]) {
    await t.test(kind, async (t) => {
      const root = await temporaryRoot(t, `dev-flow-codex-canonical-pre-admission-${kind}-`);
      const outside = await temporaryRoot(t, `dev-flow-codex-canonical-pre-admission-outside-${kind}-`);
      const ledgerPath = join(root, "attempt-ledger.json");
      const evidencePath = canonicalEvidencePathForRoot(root);
      const recoveryRoot = join(root, "recovery");
      const ledger = await writer.initializeAttemptLedger(ledgerPath);
      const preflight = orchestrationPreflight(ledger.ledgerId);
      await mkdir(dirname(evidencePath), { recursive: true });
      const passText = `${JSON.stringify({
        status: "pass",
        native_attempt: { ledger_id: ledger.ledgerId },
      })}\n`;
      if (kind === "dangling-leaf") {
        await symlink(join(outside, "missing.json"), evidencePath);
      } else if (kind === "passing-leaf") {
        const outsideEvidence = join(outside, "passing.json");
        await writeFile(outsideEvidence, passText);
        await symlink(outsideEvidence, evidencePath);
      } else {
        await rm(dirname(evidencePath), { recursive: true });
        await writeFile(join(outside, "codex-macos-arm64.json"), passText);
        await symlink(outside, dirname(evidencePath));
      }
      let prepareHostCalls = 0;
      let spawnCalls = 0;

      await assert.rejects(
        writer.executeNativeJourney({
          validationReportPath: "/external/validation-report.json",
          artifactReportPath: "/external/artifact-report.json",
          codexExecutable: "/external/codex-0.147.0",
          ledgerPath,
        }, {
          evidencePath,
          evidenceRepositoryRoot: root,
          recoveryRoot,
          platform: "darwin",
          arch: "arm64",
          async preflight() { return structuredClone(preflight); },
          async assertFrozenSource() {},
          async prepareHost() {
            prepareHostCalls += 1;
            return { targetPath: "/tmp/dev-flow-native-target" };
          },
          async spawnSession() {
            spawnCalls += 1;
            throw new Error("symlinked canonical evidence must reject before session spawn");
          },
          async cleanupHost() {},
        }),
        /canonical.*(?:symbolic link|symlink)|symbolic link/i,
      );
      assert.equal(prepareHostCalls, 0);
      assert.equal(spawnCalls, 0);
      assert.deepEqual(JSON.parse(await readFile(ledgerPath, "utf8")).attempts, []);
      assert.equal(await optionalContents(`${ledgerPath}.lock`), null);
    });
  }
});

test("canonical evidence publication rejects parent and leaf swaps inside the pass lock", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const kind of ["parent", "leaf"]) {
    await t.test(kind, async (t) => {
      const root = await temporaryRoot(t, `dev-flow-codex-canonical-publish-swap-${kind}-`);
      const outside = await temporaryRoot(t, `dev-flow-codex-canonical-publish-outside-${kind}-`);
      const ledgerPath = join(root, "attempt-ledger.json");
      const evidencePath = canonicalEvidencePathForRoot(root);
      const recoveryDirectory = join(root, "recovery");
      const evidenceIdentity = await writer.prepareCanonicalEvidenceParent({
        repositoryRoot: root,
        evidencePath,
      });
      await writer.initializeAttemptLedger(ledgerPath);
      const reservation = await writer.reserveNativeAttempt({
        ledgerPath,
        evidencePath,
        identity: nativeIdentity(kind === "parent" ? "8" : "9"),
        reservedAt: "2026-08-16T09:20:00.000Z",
      });
      const prepared = writer.preparePassingAttempt({
        reservation,
        observedFacts: { classification: "native" },
        completedAt: "2026-08-16T09:21:00.000Z",
        evidence: {
          schema_version: 3,
          status: "pass",
          recorded_at: "2026-08-16T09:22:00.000Z",
          classification: "recorded-test-candidate",
        },
      });
      const outsideEvidence = join(outside, "codex-macos-arm64.json");
      const leafTarget = join(outside, "leaf-target.json");
      if (kind === "leaf") await writeFile(leafTarget, "unchanged\n");

      await assert.rejects(
        writer.commitPassingAttempt({
          ledgerPath,
          evidencePath,
          evidencePathIdentity: evidenceIdentity,
          recoveryDirectory,
          reservation,
          prepared,
          async validateCandidates() {
            return { valid: true, structuralErrors: [], semanticErrors: [] };
          },
          async beforePublish() {
            if (kind === "parent") {
              await rename(dirname(evidencePath), join(root, "original-evidence-parent"));
              await symlink(outside, dirname(evidencePath));
            } else {
              await symlink(leafTarget, evidencePath);
            }
          },
        }),
        /canonical.*(?:identity|symbolic link|symlink)|evidence.*(?:identity|symbolic link|symlink)/i,
      );
      assert.equal(await optionalContents(outsideEvidence), null);
      if (kind === "leaf") assert.equal(await readFile(leafTarget, "utf8"), "unchanged\n");
      assert.equal(JSON.parse(await readFile(ledgerPath, "utf8")).attempts[0].status, "reserved");
    });
  }
});

test("canonical evidence parent durably syncs each newly created directory entry in order", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-canonical-parent-fsync-");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const syncedParents = [];

  await writer.prepareCanonicalEvidenceParent({
    repositoryRoot: root,
    evidencePath,
  }, {
    async fsyncParent(path) {
      syncedParents.push(path);
    },
  });

  assert.deepEqual(syncedParents, [
    root,
    join(root, "tests"),
    join(root, "tests", "journeys"),
  ]);
  assert.equal((await stat(dirname(evidencePath))).isDirectory(), true);
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
  assert.deepEqual(observedFacts.verification.budget, nativeVerificationBudget);
  assert.deepEqual(observedFacts.verification.command_executions, [nativeCommandFact({ eventIndex: 2 })]);
  assert.deepEqual(observedFacts.verification.submitted_automated_checks, [nativeAutomatedCheckFact()]);
  assert.deepEqual(observedFacts.verification.retained_automated_checks, [nativeAutomatedCheckFact()]);
  assert.deepEqual(observedFacts.terminal_task, nativeTerminalTask());
  assert.equal(
    observedFacts.sessions.resume.calls.find(({ tool }) => tool === "dev_flow_get_next_action").revision,
    4,
  );
  for (const role of ["substantive", "resume"]) {
    assert.deepEqual(
      observedFacts.sessions[role].calls,
      observedFacts.mcp_call_facts
        .filter(({ session_role }) => session_role === role)
        .map(({
          tool,
          arguments_sha256,
          result_sha256,
          task_id,
          revision,
          outcome,
        }) => ({
          tool,
          arguments_sha256,
          result_sha256,
          task_id,
          revision,
          outcome,
        })),
      `${role} session calls must reuse top-level canonical MCP digest identities`,
    );
  }
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
  assert.equal(commandTrace.logicalCommand, nativeVerificationCommand);
  assert.equal(commandTrace.renderedCommand, nativeVerificationRenderedCommand);
  assert.equal(commandTrace.event.item.command, nativeVerificationRenderedCommand);
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
  const commandTraces = trace.filter((entry) => entry.event?.item?.type === "command_execution");
  assert.equal(
    commandTraces.length,
    4,
    `all four role-scoped command facts must cross the official event boundary: ${JSON.stringify(commandTraces.map(({ role }) => role))}`,
  );
  const ordinaryCommandTrace = commandTraces.find(({ role }) => role === "native-ordinary-ambient-command");
  assert.equal(ordinaryCommandTrace.executable, "/bin/zsh");
  assert.deepEqual(ordinaryCommandTrace.argv, ["-lc", "pwd"]);
  assert.equal(ordinaryCommandTrace.renderedCommand, "/bin/zsh -lc pwd");
  assert.equal(ordinaryCommandTrace.event.item.command, ordinaryCommandTrace.renderedCommand);
  assert.equal(ordinaryCommandTrace.event.item.exit_code, ordinaryCommandTrace.processResult.exitCode);
  assert.equal(ordinaryCommandTrace.event.item.aggregated_output, ordinaryCommandTrace.processResult.aggregatedOutput);
  const traceRoles = {
    "native-ordinary-ambient-command": ["ordinary", 0, "nonverification"],
    "native-invalid-git-probe": ["invalid", 0, "nonverification"],
    "native-substantive-repository-command": ["substantive", 0, "nonverification"],
    "native-proof-command": ["resume", 2, "verification"],
  };
  assert.deepEqual(observedFacts.verification.session_command_facts, commandTraces.map((entry) => {
    const [role, eventIndex, classification] = traceRoles[entry.role];
    return {
      session_role: role,
      event_index: eventIndex,
      event_type: "command_execution",
      item_id_sha256: sha256Text(entry.event.item.id),
      command_sha256: sha256Text(entry.event.item.command),
      output_sha256: sha256Text(entry.event.item.aggregated_output),
      status: entry.event.item.status,
      exit_code: entry.event.item.exit_code,
      classification,
    };
  }));
  assert.equal(commandTraces.find(({ role }) => role === "native-ordinary-ambient-command").processResult.exitCode, 0);
  assert.notEqual(commandTraces.find(({ role }) => role === "native-invalid-git-probe").processResult.exitCode, 0);
  assert.equal(commandTraces.find(({ role }) => role === "native-substantive-repository-command").processResult.exitCode, 0);
  assert.equal(trace.filter((entry) => entry.role === "npm" && entry.argv[0] === "install").length, 2);
  assert.equal(trace.filter((entry) => entry.role === "npm" && entry.argv[0] === "uninstall").length, 2);
  assert.deepEqual(
    trace.filter((entry) => entry.role === "codex" && entry.argv[0] === "exec").map((entry) => entry.argv.at(-1).split("\n")[0]),
    [
      "Reply with one short sentence describing this repository. Do not use any named skill or MCP tool.",
      "$dev-flow-codex:dev-flow Explain briefly that this request cannot run outside a Git worktree; do not create or resume a task.",
      "$dev-flow-codex:dev-flow",
      "$dev-flow-codex:dev-flow",
    ],
  );
  assert.equal(trace.some((entry) => entry.role === "core" && entry.argv.join(" ") === "mcp --stdio"), true);
  await assert.rejects(stat(nativeWorkspace), { code: "ENOENT" });
});

test("default fake subprocess carries a recoverable failed MCP result through the real candidate boundary", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeSubprocessFixture(t, writer, "recoverable-failed-mcp", {
    failedHistory: 3,
    sessionMode: "recoverable-core-error",
  });
  const result = await writer.executeNativeJourney(fixture.inputs, fixture.dependencies);
  const recoveryDirectory = join(fixture.recoveryRoot, result.chainId);
  const observedFacts = JSON.parse(await readFile(join(recoveryDirectory, "observed-facts.json"), "utf8"));
  const evidence = JSON.parse(await readFile(fixture.dependencies.evidencePath, "utf8"));

  assert.equal(result.status, "committed");
  assert.equal(result.attemptNumber, 4);
  assert.deepEqual(
    evidence.journey.invocation.recoverable_mcp_failure_facts,
    observedFacts.recoverable_mcp_failure_facts,
  );
  assert.equal(observedFacts.recoverable_mcp_failure_facts.length, 1);
  assert.equal(observedFacts.mcp_call_facts.length, 7);
  assert.deepEqual(observedFacts.recoverable_mcp_failure_facts[0], recoverableResumeItems().fact);
  const retained = JSON.stringify({
    facts: observedFacts.recoverable_mcp_failure_facts,
    calls: observedFacts.mcp_call_facts,
  });
  for (const forbidden of [
    "The submitted task revision is stale.",
    "Read the authoritative task before another mutation.",
    "native-proof.txt",
    "thread-resume",
    fixture.root,
  ]) {
    assert.equal(retained.includes(forbidden), false, `safe passing facts leaked ${forbidden}`);
  }

  const trace = await readJSONL(fixture.tracePath);
  const failedItem = trace.find(({ role }) => role === "native-recoverable-mcp-result")?.event?.item;
  assert.equal(failedItem?.status, "failed");
  assert.equal(failedItem?.error, null);
  assert.equal(failedItem?.result?.structured_content?.ok, false);
  assert.equal(trace.some(({ role }) => role === "native-skill-resolution"), true);
});

test("default fake subprocess transport failure persists only a v4 safe MCP diagnostic", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeSubprocessFixture(t, writer, "transport-failed-mcp", {
    failedHistory: 3,
    sessionMode: "transport-error",
  });

  await assert.rejects(
    writer.executeNativeJourney(fixture.inputs, fixture.dependencies),
    /transport.*Core|mcp.*failed|external diagnostic/i,
  );
  assert.equal(await optionalContents(fixture.dependencies.evidencePath), null);
  const ledger = JSON.parse(await readFile(fixture.inputs.ledgerPath, "utf8"));
  assert.equal(ledger.attempts.length, 4);
  assert.equal(ledger.attempts[3].status, "failed");
  const recoveryDirectory = join(fixture.recoveryRoot, ledger.attempts[3].chain_id);
  const diagnosticText = await readFile(join(recoveryDirectory, "failed.json"), "utf8");
  const factsText = await readFile(join(recoveryDirectory, "failure-observed-facts.json"), "utf8");
  const diagnostic = JSON.parse(diagnosticText);
  const facts = JSON.parse(factsText);
  const typedError = transportMCPError();
  const expectedContext = {
    session_role: "resume",
    event_type: "mcp_tool_call",
    event_index: 2,
    tool: "dev_flow_apply_action",
    status: "failed",
    result_kind: "transport_error",
    result_sha256: null,
    error_sha256: canonicalJSONSha256(typedError),
  };

  assert.equal(diagnostic.schema_version, 4);
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v4");
  assert.equal(diagnostic.failure_kind, "mcp_event");
  assert.deepEqual(diagnostic.failure, {
    phase_code: "codex-session",
    reason_code: "mcp-event-failed",
    detail_sha256: diagnostic.failure.detail_sha256,
  });
  assert.deepEqual(diagnostic.mcp_failure_context, expectedContext);
  assert.deepEqual(facts, {
    schema_version: 4,
    failure_kind: "mcp_event",
    failure: diagnostic.failure,
    mcp_failure_context: expectedContext,
    session_observations: diagnostic.session_observations,
  });
  const resume = diagnostic.session_observations.find(({ session_role }) => session_role === "resume");
  assert.equal(resume.failure_stage, "mcp_failed");
  assert.equal(resume.mcp_status_counts.failed, 1);
  assert.equal(resume.mcp_status_counts.dev_flow >= 1, true);
  assert.equal(resume.item_counts.mcp_tool_call >= 1, true);
  assert.equal(resume.event_counts.item_completed > expectedContext.event_index, true);
  assert.equal(sha256Text(factsText), ledger.attempts[3].observed_facts_sha256);
  for (const forbidden of [
    typedError.message,
    JSON.stringify(typedError),
    nativeSkillSelector,
    "thread-resume",
    fixture.root,
    "arguments",
    "structured_content",
  ]) {
    assert.equal(`${diagnosticText}${factsText}`.includes(forbidden), false, `v4 MCP diagnostic leaked ${forbidden}`);
  }
});

test("unrecovered complete Core failure outranks generic summary gates in real orchestration", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeSubprocessFixture(t, writer, "unrecovered-complete-core-error", {
    failedHistory: 3,
  });
  const failedEnvelope = recoverableCoreErrorEnvelope();
  const failedApply = failedCoreMCPItem(
    "dev_flow_apply_action",
    failedEnvelope,
    recoverableApplyArguments(),
  );
  const streams = {
    ordinary: mcpItemSessionJSONL("thread-ordinary", []),
    invalid: mcpItemSessionJSONL("thread-invalid", []),
    substantive: sessionJSONL("thread-substantive", [
      actionObservation(4, "action-implement", false),
    ]),
    resume: mcpItemSessionJSONL("thread-resume", [failedApply]),
  };

  await assert.rejects(
    writer.executeNativeJourney(fixture.inputs, {
      ...fixture.dependencies,
      async prepareHost() { return {}; },
      async spawnSession({ role }) { return streams[role]; },
      async cleanupHost() {},
    }),
    /external diagnostic/i,
  );

  const ledger = JSON.parse(await readFile(fixture.inputs.ledgerPath, "utf8"));
  const attempt = ledger.attempts[3];
  const recoveryDirectory = join(fixture.recoveryRoot, attempt.chain_id);
  const diagnosticText = await readFile(join(recoveryDirectory, "failed.json"), "utf8");
  const factsText = await readFile(join(recoveryDirectory, "failure-observed-facts.json"), "utf8");
  const diagnostic = JSON.parse(diagnosticText);
  const facts = JSON.parse(factsText);
  const expectedContext = {
    session_role: "resume",
    event_type: "mcp_tool_call",
    event_index: 0,
    tool: "dev_flow_apply_action",
    status: "failed",
    result_kind: "tool_error_result",
    result_sha256: canonicalJSONSha256(failedApply.result),
    error_sha256: null,
  };

  assert.equal(attempt.status, "failed");
  assert.equal(diagnostic.schema_version, 4);
  assert.equal(diagnostic.failure_kind, "mcp_event");
  assert.deepEqual(diagnostic.mcp_failure_context, expectedContext);
  assert.deepEqual(facts.mcp_failure_context, expectedContext);
  assert.equal(facts.failure_kind, "mcp_event");
  assert.equal(
    diagnostic.session_observations.find(({ session_role }) => session_role === "resume").failure_stage,
    "mcp_failed",
  );
  assert.equal(diagnostic.failure.phase_code, "codex-session");
  assert.equal(diagnostic.failure.reason_code, "mcp-event-failed");
  for (const forbidden of [
    failedEnvelope.error.message,
    failedEnvelope.recovery.message,
    "thread-resume",
    "arguments",
    "structured_content",
    fixture.root,
  ]) {
    assert.equal(`${diagnosticText}${factsText}`.includes(forbidden), false);
  }
});

test("default native exit-zero no-apply failure durably records v3 safe session observations", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const fixture = await nativeSubprocessFixture(t, writer, "v3-no-apply", {
    failedHistory: 2,
    sessionMode: "substantive-no-apply",
  });
  await assert.rejects(
    writer.executeNativeJourney(fixture.inputs, fixture.dependencies),
    /substantive.*first Core action|native attempt.*consumed.*external diagnostic/i,
  );

  const ledger = JSON.parse(await readFile(fixture.inputs.ledgerPath, "utf8"));
  assert.equal(ledger.attempts.length, 3);
  assert.equal(ledger.attempts[2].attempt_number, 3);
  assert.equal(ledger.attempts[2].status, "failed");
  const recoveryDirectory = join(fixture.recoveryRoot, ledger.attempts[2].chain_id);
  const diagnosticText = await readFile(join(recoveryDirectory, "failed.json"), "utf8");
  const observedFactsText = await readFile(join(recoveryDirectory, "failure-observed-facts.json"), "utf8");
  const diagnostic = JSON.parse(diagnosticText);
  const observedFacts = JSON.parse(observedFactsText);

  assert.equal(diagnostic.schema_version, 3);
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v3");
  assert.equal(diagnostic.native_attempt.attempt_number, 3);
  assert.equal(diagnostic.native_attempt.total_attempts, 3);
  assert.equal(diagnostic.failure_kind, "non_command");
  assert.deepEqual(observedFacts, {
    schema_version: 3,
    failure_kind: diagnostic.failure_kind,
    failure: diagnostic.failure,
    session_observations: diagnostic.session_observations,
  });
  assert.deepEqual(diagnostic.session_observations.map(({ session_role, failure_stage }) => [session_role, failure_stage]), [
    ["ordinary", "completed"],
    ["invalid", "completed"],
    ["substantive", "stop_marker_missing"],
    ["resume", "not_started"],
  ]);
  assert.equal(diagnostic.session_observations[0].thread_present, true);
  assert.equal(diagnostic.session_observations[1].thread_present, true);
  assert.equal(diagnostic.session_observations[2].thread_present, true);
  assert.deepEqual(diagnostic.session_observations[3], emptySessionObservation("resume"));
  assert.equal(sha256Text(observedFactsText), ledger.attempts[2].observed_facts_sha256);
  for (const forbidden of [
    nativeSkillSelector,
    "$dev-flow",
    nativeVerificationRenderedCommand,
    nativeProofContent.trim(),
    "thread-substantive",
    fixture.root,
    "substantive Codex session ended before the first Core action commit",
  ]) {
    assert.equal(`${diagnosticText}${observedFactsText}`.includes(forbidden), false, `failure record leaked ${forbidden}`);
  }
  assert.equal(await optionalContents(fixture.dependencies.evidencePath), null);
});

test("pre-reservation host preparation failure consumes no attempt and starts no session", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-pre-reservation-host-failure-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
  await writer.initializeAttemptLedger(ledgerPath);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  let spawnCount = 0;

  await assert.rejects(
    writer.executeNativeJourney({
      validationReportPath: "/external/validation-report.json",
      artifactReportPath: "/external/artifact-report.json",
      codexExecutable: "/external/codex-0.147.0",
      ledgerPath,
    }, {
      evidencePath,
      evidenceRepositoryRoot: root,
      recoveryRoot,
      platform: "darwin",
      arch: "arm64",
      async preflight() { return structuredClone(preflight); },
      async assertFrozenSource() {},
      async prepareHost() { throw new Error("setup readback failed before reservation"); },
      async spawnSession() { spawnCount += 1; },
    }),
    /setup readback failed before reservation/,
  );
  assert.deepEqual(JSON.parse(await readFile(ledgerPath, "utf8")).attempts, []);
  assert.equal(spawnCount, 0);
  assert.equal(await optionalContents(recoveryRoot), null);
  assert.equal(await optionalContents(evidencePath), null);
});

test("final preflight failure consumes no attempt and starts no session", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await temporaryRoot(t, "dev-flow-codex-final-preflight-failure-");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
  await writer.initializeAttemptLedger(ledgerPath);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  let preflightCount = 0;
  let spawnCount = 0;

  await assert.rejects(
    writer.executeNativeJourney({
      validationReportPath: "/external/validation-report.json",
      artifactReportPath: "/external/artifact-report.json",
      codexExecutable: "/external/codex-0.147.0",
      ledgerPath,
    }, {
      evidencePath,
      evidenceRepositoryRoot: root,
      recoveryRoot,
      platform: "darwin",
      arch: "arm64",
      async preflight() {
        preflightCount += 1;
        if (preflightCount === 2) throw new Error("final immutable preflight failed before reservation");
        return structuredClone(preflight);
      },
      async assertFrozenSource() {},
      async prepareHost() { return { targetPath: "/tmp/dev-flow-native-target" }; },
      async spawnSession() { spawnCount += 1; },
      async cleanupHost() {},
    }),
    /final immutable preflight failed before reservation/,
  );
  assert.equal(preflightCount, 2);
  assert.equal(spawnCount, 0);
  assert.deepEqual(JSON.parse(await readFile(ledgerPath, "utf8")).attempts, []);
  assert.equal(await optionalContents(recoveryRoot), null);
  assert.equal(await optionalContents(evidencePath), null);
});

test("default native setup and reinstall readback reject every extra registry cardinality", async (t) => {
  const writer = await import(pathToFileURL(writerPath));
  for (const stage of ["setup", "reinstall"]) {
    for (const kind of ["marketplace", "installed", "available"]) {
      await t.test(`${stage}-${kind}`, async (t) => {
        const fixture = await nativeSubprocessFixture(t, writer, `${stage}-${kind}`, {
          extraRegistration: `${stage}-${kind}`,
          failedHistory: stage === "reinstall" ? 2 : 0,
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
  const initialized = await writer.initializeAttemptLedger(ledgerPath);
  await seedFailedLedgerHistory(ledgerPath, initialized.ledgerId, 2);
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
    observedFacts: {
      schema_version: 3,
      failure_kind: "non_command",
      failure: {
        phase_code: "native-journey",
        reason_code: "host-process-failed",
        detail_sha256: sha256Text("Codex exited 1"),
      },
      session_observations: nativeSessionRoles.map(emptySessionObservation),
    },
    diagnosticBase: nativeDiagnosticBase({
      recordedAt: "2026-08-16T05:01:01.000Z",
      failure: {
        phase_code: "native-journey",
        reason_code: "host-process-failed",
        detail_sha256: sha256Text("Codex exited 1"),
      },
    }),
  });
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.attempts[2].status, "failed");
  assert.equal(await optionalContents(evidencePath), null);
  assert.equal(result.diagnosticPath.startsWith(`${recoveryDirectory}/`), true);
  const diagnostic = JSON.parse(await readFile(result.diagnosticPath, "utf8"));
  assert.equal(diagnostic.status, "failed");
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v3");
});

test("native orchestration reserves immediately before four sessions and validates before publish", async () => {
  const writer = await import(pathToFileURL(writerPath));
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-native-orchestration-")));
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
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
    evidenceRepositoryRoot: root,
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
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
  const initialized = await writer.initializeAttemptLedger(ledgerPath);
  await seedFailedLedgerHistory(ledgerPath, initialized.ledgerId, 2);
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
      evidenceRepositoryRoot: root,
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
  assert.equal(ledger.attempts[2].status, "failed");
  const diagnostic = JSON.parse(await readFile(join(recoveryRoot, ledger.attempts[2].chain_id, "failed.json"), "utf8"));
  assert.equal(diagnostic.status, "failed");
  assert.equal(diagnostic.native_attempt.commit_protocol, "external-failure-record-v3");
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
    /attempt(?:s)? numbered 3 or later|attempt\s*>=\s*3/i,
    /version-3\s+diagnostic|schema version 3/i,
    /attempt-1[^\n]*version-1[^\n]*attempt-2[^\n]*version-2[^\n]*byte-unchanged/i,
    /four[^\n]*role[^\n]*session observations/i,
  ]) {
    assert.match(readme, expectation);
  }
  assert.doesNotMatch(readme, /New command-event failures use the closed version-2 diagnostic/i);
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

function nativeDiagnosticV2() {
  const diagnostic = nativeDiagnostic();
  diagnostic.schema_version = 2;
  diagnostic.failure_kind = "command_event";
  diagnostic.native_attempt.commit_protocol = "external-failure-record-v2";
  diagnostic.failure = {
    phase_code: "codex-session",
    reason_code: "command-event-rejected",
    detail_sha256: sha256Text("bounded failure detail"),
  };
  diagnostic.failure_context = {
    session_role: "ordinary",
    event_type: "command_execution",
    command_sha256: sha256Text(nativeVerificationRenderedCommand),
    output_sha256: sha256Text(nativeVerificationOutput),
    status: "completed",
    exit_code: 0,
  };
  return diagnostic;
}

function nativeDiagnosticV3() {
  const diagnostic = nativeDiagnosticV2();
  diagnostic.schema_version = 3;
  diagnostic.native_attempt.attempt_number = 3;
  diagnostic.native_attempt.total_attempts = 3;
  diagnostic.native_attempt.commit_protocol = "external-failure-record-v3";
  diagnostic.session_observations = nativeSessionRoles.map(emptySessionObservation);
  return diagnostic;
}

function nativeDiagnosticBase({
  recordedAt = "2026-08-16T03:00:00.000Z",
  identity = nativeIdentity("9"),
  failure = {
    phase_code: "native-journey",
    reason_code: "unexpected-failure",
    detail_sha256: sha256Text("exit 1"),
  },
} = {}) {
  const diagnostic = nativeDiagnosticV3();
  diagnostic.recorded_at = recordedAt;
  diagnostic.identity.source_commit = identity.source_commit;
  diagnostic.identity.artifact_sha256 = identity.artifact_sha256;
  diagnostic.identity.artifact_report_sha256 = identity.artifact_report_sha256;
  diagnostic.validation.report_sha256 = identity.validation_report_sha256;
  for (const observation of [...diagnostic.validation.targeted_checks, diagnostic.validation.root_validation]) {
    observation.source_commit = identity.source_commit;
  }
  diagnostic.failure_kind = "non_command";
  diagnostic.failure = failure;
  delete diagnostic.failure_context;
  delete diagnostic.status;
  delete diagnostic.native_attempt;
  return diagnostic;
}

function parsedRecordedSessions(writer, {
  ordinaryCommands = [],
  invalidCommands = [],
  substantive = [actionObservation(4, "action-implement", false)],
  substantiveCommands = [],
  resume = [
    taskObservation("dev_flow_get_task", 4, false),
    taskObservation("dev_flow_get_next_action", 4, false),
    actionObservation(8, "action-handoff", true),
  ],
  resumeCommands = [nativeCommandObservation()],
} = {}) {
  return {
    ordinary: writer.parseCodexExecJSONL(sessionJSONL("thread-ordinary", [], ordinaryCommands), { sessionRole: "ordinary" }),
    invalid: writer.parseCodexExecJSONL(sessionJSONL("thread-invalid", [], invalidCommands), { sessionRole: "invalid" }),
    substantive: writer.parseCodexExecJSONL(sessionJSONL("thread-substantive", substantive, substantiveCommands), { sessionRole: "substantive" }),
    resume: writer.parseCodexExecJSONL(sessionJSONL("thread-resume", resume, resumeCommands), { sessionRole: "resume" }),
  };
}

async function runFakeCodexPrompt(t, prompt, label, {
  seedNativeProof = false,
  sessionMode,
} = {}) {
  const root = await temporaryRoot(t, `dev-flow-codex-skill-resolution-${label}-`);
  const targetPath = join(root, "target");
  const dataPath = join(root, "data");
  const packagePath = join(root, "installed", "dev-flow-codex");
  const statePath = join(root, "state.json");
  const tracePath = join(root, "trace.jsonl");
  await Promise.all([
    mkdir(targetPath, { recursive: true, mode: 0o700 }),
    mkdir(dataPath, { recursive: true, mode: 0o700 }),
    mkdir(join(packagePath, "plugin", ".codex-plugin"), { recursive: true, mode: 0o700 }),
    mkdir(join(packagePath, "plugin", "skills", "dev-flow"), { recursive: true, mode: 0o700 }),
  ]);
  await execFile("git", ["init", "--object-format=sha1", "--initial-branch=main"], { cwd: targetPath });
  if (seedNativeProof) {
    await writeFile(join(targetPath, "native-proof.txt"), nativeProofContent, { mode: 0o600 });
  }
  await Promise.all([
    copyFile(join(packageRoot, "plugin", ".codex-plugin", "plugin.json"), join(packagePath, "plugin", ".codex-plugin", "plugin.json")),
    copyFile(join(packageRoot, "plugin", "skills", "dev-flow", "SKILL.md"), join(packagePath, "plugin", "skills", "dev-flow", "SKILL.md")),
    writeFile(statePath, `${JSON.stringify({ packageRoot: packagePath, registrationActive: true })}\n`, { mode: 0o600 }),
  ]);
  const { stdout } = await execFile(process.execPath, [
    fakeNativeToolPath,
    "codex",
    "exec",
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
    prompt,
  ], {
    cwd: targetPath,
    env: {
      ...process.env,
      DEV_FLOW_DATA_DIR: dataPath,
      FAKE_NATIVE_STATE: statePath,
      FAKE_NATIVE_TRACE: tracePath,
      FAKE_NATIVE_TOOL_PATH: fakeNativeToolPath,
      FAKE_NATIVE_PACKAGE_VERSION: "0.1.0",
      ...(sessionMode ? { FAKE_NATIVE_SESSION_MODE: sessionMode } : {}),
    },
  });
  return { stdout, targetPath, tracePath };
}

function parseJSONLText(text) {
  return text.trim().split("\n").filter(Boolean).map(JSON.parse);
}

function nativeSessionRolesAfter(role) {
  const roles = ["ordinary", "invalid", "substantive", "resume"];
  return roles.slice(roles.indexOf(role) + 1);
}

function emptySessionObservation(role) {
  return {
    session_role: role,
    failure_stage: "not_started",
    exit_code: null,
    signal: null,
    thread_present: false,
    stdout_bytes: 0,
    stderr_bytes: 0,
    stdout_sha256: sha256Text(""),
    stderr_sha256: sha256Text(""),
    event_counts: {
      total: 0,
      invalid_json: 0,
      thread_started: 0,
      item_started: 0,
      item_completed: 0,
      turn_completed: 0,
      error: 0,
      other: 0,
    },
    item_counts: {
      total: 0,
      agent_message: 0,
      command_execution: 0,
      mcp_tool_call: 0,
      other: 0,
    },
    mcp_status_counts: {
      total: 0,
      dev_flow: 0,
      completed: 0,
      failed: 0,
      other: 0,
    },
  };
}

async function assertCommandEventFailureDiagnostic(t, writer, {
  label,
  streams,
  expectedContext,
  forbiddenRawValues,
}) {
  const root = await temporaryRoot(t, `dev-flow-codex-${label}-`);
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryRoot = join(root, "recovery");
  const initialized = await writer.initializeAttemptLedger(ledgerPath);
  await seedFailedLedgerHistory(ledgerPath, initialized.ledgerId, 2);
  const preflight = orchestrationPreflight(await writer.deriveLedgerId(ledgerPath));
  const times = [
    "2026-08-16T08:00:00.000Z",
    "2026-08-16T08:01:00.000Z",
    "2026-08-16T08:02:00.000Z",
  ];

  await assert.rejects(
    writer.executeNativeJourney({
      validationReportPath: "/external/validation-report.json",
      artifactReportPath: "/external/artifact-report.json",
      codexExecutable: "/external/codex-0.147.0",
      ledgerPath,
    }, {
      evidencePath,
      evidenceRepositoryRoot: root,
      recoveryRoot,
      platform: "darwin",
      arch: "arm64",
      now: () => times.shift(),
      async preflight() { return structuredClone(preflight); },
      async assertFrozenSource() {},
      async prepareHost() { return { targetPath: "/tmp/dev-flow-native-target" }; },
      async spawnSession({ role }) { return streams[role]; },
      async cleanupHost() {},
    }),
    /external diagnostic/i,
  );

  assert.equal(await optionalContents(evidencePath), null);
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.attempts[2].status, "failed");
  const recoveryDirectory = join(recoveryRoot, ledger.attempts[2].chain_id);
  const diagnosticText = await readFile(join(recoveryDirectory, "failed.json"), "utf8");
  const observedFactsText = await readFile(join(recoveryDirectory, "failure-observed-facts.json"), "utf8");
  const diagnostic = JSON.parse(diagnosticText);
  assert.equal(diagnostic.schema_version, 3);
  assert.equal(diagnostic.failure_kind, "command_event");
  assert.deepEqual(
    Object.keys(diagnostic.failure_context).sort(),
    ["command_sha256", "event_type", "exit_code", "output_sha256", "session_role", "status"],
  );
  assert.deepEqual(diagnostic.failure_context, expectedContext);
  for (const raw of forbiddenRawValues) {
    assert.equal(`${diagnosticText}${observedFactsText}`.includes(raw), false, `failure record must not retain raw value: ${raw}`);
  }
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

async function nativeSubprocessFixture(t, writer, label, {
  extraRegistration,
  failedHistory = 0,
  sessionMode,
} = {}) {
  const root = await temporaryRoot(t, `dev-flow-codex-native-subprocess-${label}-`);
  const fakeBin = join(root, "fake-bin");
  const statePath = join(root, "fake-state.json");
  const tracePath = join(root, "fake-trace.jsonl");
  const artifactPath = join(root, "dev-flow-codex-0.1.0.tgz");
  const codexExecutable = join(fakeBin, "codex-0.147.0");
  const ledgerPath = join(root, "attempt-ledger.json");
  const evidencePath = canonicalEvidencePathForRoot(root);
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
  if (failedHistory > 0) {
    await seedFailedLedgerHistory(ledgerPath, initialized.ledgerId, failedHistory);
  }
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
    "FAKE_NATIVE_SESSION_MODE",
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
  if (sessionMode) process.env.FAKE_NATIVE_SESSION_MODE = sessionMode;
  else delete process.env.FAKE_NATIVE_SESSION_MODE;
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
    evidenceRepositoryRoot: root,
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

async function seedFailedLedgerHistory(ledgerPath, ledgerId, count) {
  const attempts = Array.from({ length: count }, (_, index) => {
    const attempt = index + 1;
    const digit = String(attempt);
    return {
      attempt_number: attempt,
      chain_id: digit.repeat(64),
      source_commit: digit.repeat(40),
      validation_report_sha256: (attempt + 2).toString(16).repeat(64),
      artifact_report_sha256: (attempt + 4).toString(16).repeat(64),
      artifact_sha256: (attempt + 6).toString(16).repeat(64),
      reserved_at: `2026-08-16T0${attempt}:00:00.000Z`,
      completed_at: `2026-08-16T0${attempt}:01:00.000Z`,
      status: "failed",
      observed_facts_sha256: (attempt + 8).toString(16).repeat(64),
    };
  });
  await writeFile(ledgerPath, `${JSON.stringify({ schema_version: 1, ledger_id: ledgerId, attempts })}\n`, { mode: 0o600 });
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
  const evidencePath = canonicalEvidencePathForRoot(root);
  const recoveryDirectory = join(root, "recovery");
  const evidencePathIdentity = await writer.prepareCanonicalEvidenceParent({
    repositoryRoot: root,
    evidencePath,
  });
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
    evidencePathIdentity,
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
  return { root, ledgerPath, evidencePath, evidencePathIdentity, recoveryDirectory, reservation, prepared, commit };
}

function nativeIdentity(seed) {
  return {
    source_commit: seed.repeat(40),
    validation_report_sha256: "1".repeat(64),
    artifact_report_sha256: "2".repeat(64),
    artifact_sha256: "3".repeat(64),
  };
}

function canonicalEvidencePathForRoot(root) {
  return join(root, "tests", "journeys", "evidence", "codex-macos-arm64.json");
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
      explicit_selector: nativeSkillSelector,
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

function recoverableCoreErrorEnvelope() {
  return {
    schema_version: 1,
    ok: false,
    request_id: "request-recoverable-failed-apply",
    tool: "dev_flow_apply_action",
    error: {
      code: "REVISION_CONFLICT",
      message: "The submitted task revision is stale.",
    },
    recovery: {
      retry_safe: false,
      action: "read_task",
      message: "Read the authoritative task before another mutation.",
    },
  };
}

function recoverableApplyArguments() {
  return {
    request_id: "request-recoverable-failed-apply",
    task_id: "task-00000001",
    expected_revision: 4,
    action_id: "action-handoff",
    payload: {
      result: "succeeded",
      summary: "bounded deterministic recovery fixture",
      changed_paths: ["native-proof.txt"],
      no_file_changes: false,
      deviations: [],
      scope_confirmed: true,
    },
  };
}

function transportMCPError() {
  return {
    code: -32000,
    message: "MCP transport disconnected before a result",
  };
}

function failedCoreMCPItem(tool, envelope, arguments_) {
  return {
    ...codexMCPItem(tool, envelope, arguments_),
    status: "failed",
  };
}

function failedTransportMCPItem(tool, error, arguments_) {
  return {
    id: "item-transport-failed-apply",
    type: "mcp_tool_call",
    server: "dev-flow",
    tool,
    arguments: structuredClone(arguments_),
    result: null,
    error: structuredClone(error),
    status: "failed",
  };
}

function mcpItemSessionJSONL(threadId, items, commands = []) {
  return [
    { type: "thread.started", thread_id: threadId },
    ...items.map((item) => ({ type: "item.completed", item })),
    ...commands.map((command) => ({
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
  ].map(JSON.stringify).join("\n");
}

function recoverableResumeItems() {
  const initialGetTask = codexMCPItem(
    "dev_flow_get_task",
    coreEnvelope({ revision: 4, actionId: "action-restart-task", terminal: false, tool: "dev_flow_get_task" }),
  );
  const initialGetNext = codexMCPItem(
    "dev_flow_get_next_action",
    coreEnvelope({ revision: 4, actionId: "action-restart-next", terminal: false, tool: "dev_flow_get_next_action" }),
  );
  const failedApply = failedCoreMCPItem(
    "dev_flow_apply_action",
    recoverableCoreErrorEnvelope(),
    recoverableApplyArguments(),
  );
  const recoveryGetTask = codexMCPItem(
    "dev_flow_get_task",
    coreEnvelope({ revision: 4, actionId: "action-recovery-task", terminal: false, tool: "dev_flow_get_task" }),
  );
  const recoveryGetNext = codexMCPItem(
    "dev_flow_get_next_action",
    coreEnvelope({ revision: 4, actionId: "action-recovery-next", terminal: false, tool: "dev_flow_get_next_action" }),
  );
  const nextMutation = codexMCPItem(
    "dev_flow_apply_action",
    coreEnvelope({ revision: 8, actionId: "action-handoff", terminal: true }),
  );
  const proof = nativeCommandObservation();
  const events = [
    { type: "thread.started", thread_id: "thread-resume" },
    ...[initialGetTask, initialGetNext, failedApply, recoveryGetTask, recoveryGetNext]
      .map((item) => ({ type: "item.completed", item })),
    {
      type: "item.completed",
      item: {
        id: proof.itemId,
        type: "command_execution",
        command: proof.command,
        aggregated_output: proof.output,
        exit_code: proof.exitCode,
        status: proof.status,
      },
    },
    { type: "item.completed", item: nextMutation },
  ];
  const reference = (item, eventIndex, revision) => ({
    session_role: "resume",
    event_index: eventIndex,
    tool: item.tool,
    result_sha256: canonicalJSONSha256(item.result),
    task_id: "task-00000001",
    revision,
  });
  return {
    jsonl: events.map(JSON.stringify).join("\n"),
    items: [initialGetTask, initialGetNext, failedApply, recoveryGetTask, recoveryGetNext, nextMutation],
    fact: {
      session_role: "resume",
      event_index: 2,
      tool: "dev_flow_apply_action",
      status: "failed",
      result_kind: "tool_error_result",
      task_id: "task-00000001",
      expected_revision: 4,
      result_sha256: canonicalJSONSha256(failedApply.result),
      core_error_code: "REVISION_CONFLICT",
      recovery_retry_safe: false,
      recovery_action: "read_task",
      get_task: reference(recoveryGetTask, 3, 4),
      get_next_action: reference(recoveryGetNext, 4, 4),
      next_mutation: reference(nextMutation, 6, 8),
    },
    expectedCallOrder: [
      { session_role: "substantive", event_index: 0, tool: "dev_flow_apply_action", status: "completed", result_kind: "success_result" },
      { session_role: "resume", event_index: 0, tool: "dev_flow_get_task", status: "completed", result_kind: "success_result" },
      { session_role: "resume", event_index: 1, tool: "dev_flow_get_next_action", status: "completed", result_kind: "success_result" },
      { session_role: "resume", event_index: 2, tool: "dev_flow_apply_action", status: "failed", result_kind: "tool_error_result" },
      { session_role: "resume", event_index: 3, tool: "dev_flow_get_task", status: "completed", result_kind: "success_result" },
      { session_role: "resume", event_index: 4, tool: "dev_flow_get_next_action", status: "completed", result_kind: "success_result" },
      { session_role: "resume", event_index: 6, tool: "dev_flow_apply_action", status: "completed", result_kind: "success_result" },
    ],
  };
}

function successfulMCPCallFact(sessionRole, eventIndex, { tool, envelope, arguments_ }) {
  const callArguments = arguments_ ?? defaultMCPArguments(tool, envelope);
  const completeResult = codexMCPItem(tool, envelope, callArguments).result;
  const task = envelope.result?.task ?? envelope.result;
  return {
    session_role: sessionRole,
    event_index: eventIndex,
    tool,
    arguments_sha256: canonicalJSONSha256(callArguments),
    result_sha256: canonicalJSONSha256(completeResult),
    status: "completed",
    result_kind: "success_result",
    task_id: task.task_id,
    revision: task.revision,
    outcome: task.outcome?.status ?? null,
    request_task_id: callArguments.task_id ?? null,
    expected_revision: Number.isInteger(callArguments.expected_revision)
      ? callArguments.expected_revision
      : null,
    core_error_code: null,
    recovery_retry_safe: null,
    recovery_action: null,
  };
}

function canonicalJSONSha256(value) {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input !== null && typeof input === "object") {
      return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize(input[key])]));
    }
    return input;
  };
  return sha256Text(JSON.stringify(normalize(value)));
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
    arguments_.task_id = "task-00000001";
    arguments_.expected_revision = 4;
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

function commandObservation({
  itemId,
  command,
  output,
  exitCode = 0,
  status = "completed",
}) {
  return {
    itemId,
    command,
    output,
    exitCode,
    status,
  };
}

function nativeCommandObservation({ itemId = "command-targeted" } = {}) {
  return commandObservation({
    itemId,
    command: nativeVerificationRenderedCommand,
    output: nativeVerificationOutput,
  });
}

function nativeCommandExecution({ eventIndex = 3, itemId = "command-targeted" } = {}) {
  return {
    sessionRole: "resume",
    eventIndex,
    itemIdSha256: sha256Text(itemId),
    logicalProofName: nativeVerificationCommand,
    renderedCommandSha256: sha256Text(nativeVerificationRenderedCommand),
    exitCode: 0,
    status: "completed",
    outputSha256: sha256Text(nativeVerificationOutput),
    fullSuite: false,
  };
}

function sessionCommandFact({
  role,
  eventIndex,
  itemId,
  command,
  output,
  exitCode = 0,
  status = "completed",
  classification = "nonverification",
}) {
  return {
    sessionRole: role,
    eventIndex,
    eventType: "command_execution",
    itemIdSha256: sha256Text(itemId),
    commandSha256: sha256Text(command),
    outputSha256: sha256Text(output),
    status,
    exitCode,
    classification,
  };
}

function nativeCommandFact(options) {
  const execution = nativeCommandExecution(options);
  return {
    session_role: execution.sessionRole,
    event_index: execution.eventIndex,
    item_id_sha256: execution.itemIdSha256,
    logical_proof_name: execution.logicalProofName,
    rendered_command_sha256: execution.renderedCommandSha256,
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
