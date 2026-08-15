#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  link,
  lstat,
  mkdtemp,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_ROOT_VALIDATION_COMMAND,
  EXPECTED_TARGETED_COMMANDS,
  validateAttemptLedgerSemantics,
  validateDocumentStructure,
  validateEvidenceCandidate,
  validatePublishedEvidence,
} from "./validate-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(scriptPath));
const ledgerDomain = "dev-flow-codex-native-ledger-v1\n";
const selectedCodexVersion = "0.147.0";
const selectedCodexRange = ">=0.147.0 <0.148.0";
const targetedCommands = Object.freeze([
  "go test ./internal/version ./tests/contract",
  "node --test packages/codex/tests/*.test.mjs",
]);
const rootValidationCommand = "pnpm run validate";
const contractsRoot = join(repositoryRoot, "specs", "003-codex-explicit-dev-flow", "contracts");
const contractSchemaPaths = Object.freeze({
  validationReport: join(contractsRoot, "validation-report.schema.json"),
  artifactReport: join(contractsRoot, "artifact-report.schema.json"),
  nativeAttemptDiagnostic: join(contractsRoot, "native-attempt-diagnostic.schema.json"),
  nativeAttemptLedger: join(contractsRoot, "native-attempt-ledger.schema.json"),
  journeyEvidence: join(contractsRoot, "journey-evidence.schema.json"),
});
const nativeAttemptLedgerSchema = JSON.parse(
  await readFile(contractSchemaPaths.nativeAttemptLedger, "utf8"),
);
const recoveryFiles = Object.freeze({
  observedFacts: "observed-facts.json",
  reservedLedger: "reserved-ledger.json",
  finalLedger: "final-ledger-candidate.json",
  evidence: "evidence-candidate.json",
});
const canonicalNativeEvidencePath = join(
  repositoryRoot,
  "tests",
  "journeys",
  "evidence",
  "codex-macos-arm64.json",
);
const sharedFixturesSha256 = "8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7";
const nativeCoreCallBudget = 64;
const nativeProofPath = "native-proof.txt";
const nativeProofContent = "Dev Flow Codex native journey passed.\n";
const nativeProofGitBlobSha1 = createHash("sha1")
  .update(`blob ${Buffer.byteLength(nativeProofContent)}\0${nativeProofContent}`)
  .digest("hex");
const nativeProofCommand = `git hash-object ${nativeProofPath}`;
const nativeProofRenderedCommand = `/bin/zsh -lc '${nativeProofCommand}'`;
const retiredNativeProofCommand = `git diff --check -- ${nativeProofPath}`;
const nativeProofCommandOutput = `${nativeProofGitBlobSha1}\n`;
const nativeProofCommandOutputSha256 = createHash("sha256").update(nativeProofCommandOutput).digest("hex");
const nativeSessionRoles = Object.freeze(["ordinary", "invalid", "substantive", "resume"]);
const knownTestCommandMarkers = Object.freeze([
  "go test",
  "pnpm test",
  "pnpm run test",
  "pnpm run validate",
  "node --test",
]);
const nativePrompts = Object.freeze({
  ordinary: "Reply with one short sentence describing this repository. Do not use any named skill or MCP tool.",
  invalid: "$dev-flow Explain briefly that this request cannot run outside a Git worktree; do not create or resume a task.",
  substantive: [
    "$dev-flow",
    "In this one current Git repository, create native-proof.txt with exactly the line: Dev Flow Codex native journey passed.",
    "Change no other repository path. Open the task with a targeted verification budget of exactly one automatic command, no full suite, and manual handoff allowed.",
    `Use repository editing tools for the change. The only permitted verification command is exactly: ${nativeProofCommand}`,
    "Repository inspection and implementation commands are non-verification facts; do not run a test or full-suite command.",
  ].join("\n"),
  resume: [
    "$dev-flow",
    "Resume the existing compatible Codex-owned task in this repository. Treat the stopped process as an uncertain boundary: before any apply_action, call dev_flow_get_task and then dev_flow_get_next_action.",
    `Continue until the Core returns DONE. Run exactly this one targeted verification command: ${nativeProofCommand}`,
    "Record that exact command string as the automated evidence name with command_count=1 and full_suite=false, and run no full suite.",
    "Repository inspection and implementation commands remain non-verification facts.",
    "Do not create another task, broaden scope, or change any path other than native-proof.txt.",
  ].join("\n"),
});

export async function initializeAttemptLedger(ledgerPath) {
  const identity = await resolveLedgerIdentity(ledgerPath);
  const document = {
    schema_version: 1,
    ledger_id: identity.ledgerId,
    attempts: [],
  };
  const bytes = jsonBytes(document);

  try {
    await writeExclusiveDurable(identity.path, bytes, 0o600);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readLedger(identity.path, identity.ledgerId);
    return { ledgerPath: identity.path, ledgerId: existing.ledger_id, created: false };
  }
  return { ledgerPath: identity.path, ledgerId: identity.ledgerId, created: true };
}

export async function deriveLedgerId(ledgerPath) {
  return (await resolveLedgerIdentity(ledgerPath)).ledgerId;
}

export async function preflightNativeInputs({
  validationReportPath,
  artifactReportPath,
  codexExecutable,
  ledgerPath,
} = {}) {
  for (const [label, path] of Object.entries({
    "validation report": validationReportPath,
    "artifact report": artifactReportPath,
    "Codex executable": codexExecutable,
    "attempt ledger": ledgerPath,
  })) {
    if (!isAbsolutePath(path)) throw new Error(`${label} path must be absolute`);
  }
  const canonicalCodexExecutable = await realpath(codexExecutable);
  const executableInfo = await stat(canonicalCodexExecutable);
  await access(canonicalCodexExecutable, fsConstants.X_OK);
  if (!executableInfo.isFile() || (executableInfo.mode & 0o111) === 0) {
    throw new Error("Codex executable must be an executable regular file");
  }
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  const [validationText, artifactText, ledgerText] = await Promise.all([
    readFile(validationReportPath, "utf8"),
    readFile(artifactReportPath, "utf8"),
    readFile(ledgerIdentity.path, "utf8"),
  ]);
  const validation = parseJSONDocument(validationText, "validation report");
  const artifact = parseJSONDocument(artifactText, "artifact report");
  const ledger = parseLedger(ledgerText, ledgerIdentity.ledgerId);
  const schemas = await loadContractSchemas();
  const structuralErrors = [
    ...validateDocumentStructure(validation, schemas.validationReport).map((error) => `validation report: ${error}`),
    ...validateDocumentStructure(artifact, schemas.artifactReport).map((error) => `artifact report: ${error}`),
    ...validateDocumentStructure(ledger, schemas.nativeAttemptLedger).map((error) => `attempt ledger: ${error}`),
  ];
  if (structuralErrors.length !== 0) {
    throw new Error(`closed input schema validation failed: ${structuralErrors.join("; ")}`);
  }
  if (validation.attempt_ledger_id !== ledgerIdentity.ledgerId) {
    throw new Error("validation report attempt ledger identity does not match the supplied durable path");
  }
  if (validation.source_commit !== artifact.source_commit) {
    throw new Error("validation and artifact reports do not bind the same frozen source commit");
  }
  if (!equalArrays(validation.targeted_checks.map(({ command }) => command), EXPECTED_TARGETED_COMMANDS)) {
    throw new Error("validation report does not contain the exact ordered targeted command set");
  }
  if (validation.root_validation.command !== EXPECTED_ROOT_VALIDATION_COMMAND) {
    throw new Error("validation report does not contain the exact root validation command");
  }
  const queryTime = Date.parse(validation.codex_revalidation.queried_at);
  const validationCompletion = Date.parse(validation.completed_at);
  for (const observation of [...validation.targeted_checks, validation.root_validation]) {
    const completion = Date.parse(observation.completed_at);
    if (
      observation.source_commit !== validation.source_commit
      || observation.result !== "pass"
      || queryTime > completion
      || completion > validationCompletion
    ) {
      throw new Error("validation report command observations do not bind one ordered passing source timeline");
    }
  }
  if (
    validation.codex_revalidation.resolved_version !== selectedCodexVersion
    || validation.codex_revalidation.compatible_range !== selectedCodexRange
    || artifact.codex_compatibility !== selectedCodexRange
  ) {
    throw new Error("validation/artifact Codex compatibility identity does not match the selected stable contract");
  }
  if (validationCompletion > Date.parse(artifact.built_at)) {
    throw new Error("validation completion must not follow artifact build time");
  }
  if (artifact.package_version !== artifact.core_version) {
    throw new Error("artifact package and Core versions must be equal");
  }
  const rootVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();
  if (artifact.package_version !== rootVersion) {
    throw new Error("artifact package/Core versions must equal repository VERSION");
  }
  if (!isAbsolutePath(artifact.artifact_path)) throw new Error("artifact report path must be absolute");
  const artifactInfo = await lstat(artifact.artifact_path);
  if (!artifactInfo.isFile() || artifactInfo.isSymbolicLink()) {
    throw new Error("final artifact must be an unmodified regular file");
  }
  const artifactBytes = await readFile(artifact.artifact_path);
  const actualArtifactSha256 = sha256(artifactBytes);
  if (actualArtifactSha256 !== artifact.artifact_sha256) {
    throw new Error("final artifact SHA-256 does not match the retained artifact report");
  }
  const codexVersion = await inspectNativeCodexVersion(canonicalCodexExecutable);
  if (codexVersion !== selectedCodexVersion) {
    throw new Error(`native Codex executable must be exact selected stable ${selectedCodexVersion}`);
  }
  return {
    validation,
    validationText,
    artifact,
    artifactText,
    artifactBytes,
    ledger,
    ledgerText,
    ledgerId: ledgerIdentity.ledgerId,
    schemas,
    rootVersion,
    codexVersion,
    canonicalCodexExecutable,
    identity: {
      source_commit: validation.source_commit,
      validation_report_sha256: sha256(validationText),
      artifact_report_sha256: sha256(artifactText),
      artifact_sha256: actualArtifactSha256,
    },
  };
}

export async function createValidationReport({
  outputPath,
  ledgerPath,
  sourceCommit,
  repositoryRoot: sourceRoot = repositoryRoot,
} = {}, dependencies = {}) {
  if (!isAbsolutePath(outputPath) || !isAbsolutePath(sourceRoot)) {
    throw new Error("validation report output and repository root must be absolute");
  }
  if (!hex(sourceCommit, 40)) throw new Error("validation report source commit must be lowercase Git SHA-1");
  if (await readOptional(outputPath) !== null) {
    throw new Error("validation report already exists; create-no-replace forbids replacement");
  }
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  await readLedger(ledgerIdentity.path, ledgerIdentity.ledgerId);

  const queryLatestCodex = dependencies.queryLatestCodex ?? defaultQueryLatestCodex;
  const runCommand = dependencies.runCommand ?? defaultRunCommand;
  const readSourceIdentity = dependencies.readSourceIdentity ?? defaultReadSourceIdentity;
  const now = dependencies.now ?? (() => new Date().toISOString());

  await assertCleanSource(readSourceIdentity, sourceRoot, sourceCommit);
  const resolvedCodex = await queryLatestCodex();
  const queriedAt = now();
  if (resolvedCodex !== selectedCodexVersion) {
    throw new Error(
      `official @openai/codex latest changed from ${selectedCodexVersion} to ${resolvedCodex}; return to compatibility reconciliation`,
    );
  }

  const targetedChecks = [];
  for (const command of targetedCommands) {
    await runCommand(command, { cwd: sourceRoot });
    const completedAt = now();
    await assertCleanSource(readSourceIdentity, sourceRoot, sourceCommit);
    targetedChecks.push({
      command,
      result: "pass",
      source_commit: sourceCommit,
      completed_at: completedAt,
    });
  }
  await runCommand(rootValidationCommand, { cwd: sourceRoot });
  const rootCompletedAt = now();
  await assertCleanSource(readSourceIdentity, sourceRoot, sourceCommit);
  const completedAt = now();

  const report = {
    schema_version: 1,
    report_type: "dev-flow-codex-validation",
    source_commit: sourceCommit,
    source_dirty: false,
    attempt_ledger_id: ledgerIdentity.ledgerId,
    codex_revalidation: {
      package: "@openai/codex",
      dist_tag: "latest",
      resolved_version: resolvedCodex,
      compatible_range: selectedCodexRange,
      queried_at: queriedAt,
    },
    completed_at: completedAt,
    targeted_checks: targetedChecks,
    root_validation: {
      command: rootValidationCommand,
      result: "pass",
      source_commit: sourceCommit,
      completed_at: rootCompletedAt,
    },
  };
  await writeExclusiveDurable(outputPath, jsonBytes(report), 0o600);
  return { outputPath, report };
}

export function deriveChainId(identity) {
  validateIdentity(identity);
  return sha256(JSON.stringify({
    artifact_report_sha256: identity.artifact_report_sha256,
    artifact_sha256: identity.artifact_sha256,
    source_commit: identity.source_commit,
    validation_report_sha256: identity.validation_report_sha256,
  }));
}

export function parseCodexExecJSONL(text, { sessionRole = "resume" } = {}) {
  if (typeof text !== "string") throw new TypeError("Codex exec JSONL must be text");
  if (!nativeSessionRoles.includes(sessionRole)) {
    throw new TypeError("Codex exec JSONL requires one known native session role");
  }
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");
  const events = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Codex exec JSONL line ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
  if (events.length === 0 || events[0]?.type !== "thread.started") {
    throw new Error("Codex exec JSONL must contain thread.started as its first event");
  }
  if (typeof events[0].thread_id !== "string" || events[0].thread_id.length === 0) {
    throw new Error("Codex exec thread.started must contain a nonempty thread_id");
  }
  if (events.slice(1).some((event) => event?.type === "thread.started")) {
    throw new Error("Codex exec JSONL must contain exactly one thread.started event");
  }

  const devFlowCalls = [];
  const commandExecutions = [];
  const commandItemIDs = new Set();
  let ignoredPreviewCount = 0;
  let ignoredProseCount = 0;
  for (const [eventIndex, event] of events.slice(1).entries()) {
    if (event?.type === "item.started") {
      ignoredPreviewCount += 1;
      continue;
    }
    if (event?.type !== "item.completed") continue;
    const item = event.item;
    if (item?.type === "command_execution") {
      if (
        typeof item.id !== "string"
        || item.id.length === 0
        || typeof item.command !== "string"
        || item.command.length === 0
        || typeof item.aggregated_output !== "string"
        || !(Number.isInteger(item.exit_code) || item.exit_code === null)
        || typeof item.status !== "string"
        || !["completed", "failed", "declined"].includes(item.status)
      ) {
        throw new Error("completed command_execution requires closed command, status, exit, and output facts");
      }
      const commandFact = {
        sessionRole,
        eventIndex,
        eventType: "command_execution",
        itemIdSha256: sha256(item.id),
        commandSha256: sha256(item.command),
        outputSha256: sha256(item.aggregated_output),
        status: item.status,
        exitCode: item.exit_code,
        classification: "nonverification",
      };
      if (commandItemIDs.has(item.id)) {
        throw commandEventError("completed command_execution item IDs must be unique", commandFact);
      }
      commandItemIDs.add(item.id);
      const deniedMarker = knownTestCommandMarkers.find((marker) => item.command.includes(marker));
      if (deniedMarker) {
        throw commandEventError(
          `completed command_execution contains known test/full-suite marker ${deniedMarker}`,
          commandFact,
        );
      }
      if (item.command === nativeProofRenderedCommand) {
        if (!["substantive", "resume"].includes(sessionRole)) {
          throw commandEventError(
            `${sessionRole} session proof command is unbound to Core verification evidence`,
            commandFact,
          );
        }
        if (
          item.exit_code !== 0
          || item.status !== "completed"
          || commandFact.outputSha256 !== nativeProofCommandOutputSha256
        ) {
          throw commandEventError(
          "native proof command output digest must equal the SHA-1 Git blob hash output for the required exact native-proof.txt bytes",
            commandFact,
          );
        }
        commandFact.classification = "verification";
      } else if (
        (item.command.includes("hash-object") && item.command.includes(nativeProofPath))
        || item.command.includes(retiredNativeProofCommand)
      ) {
        throw commandEventError(
          "native proof rendering is unbound because it does not equal the exact Codex 0.147 macOS rendering",
          commandFact,
        );
      }
      commandExecutions.push(commandFact);
      continue;
    }
    if (item?.type === "agent_message") {
      ignoredProseCount += 1;
      continue;
    }
    if (item?.type !== "mcp_tool_call" || item.server !== "dev-flow") continue;
    if (
      item.status !== "completed"
      || item.error !== null
      || !isPlainObject(item.result)
      || !isPlainObject(item.result.structured_content)
    ) {
      throw new Error("completed Dev Flow MCP calls require a complete structured result without error");
    }
    const textBlocks = Array.isArray(item.result.content)
      ? item.result.content.filter((block) => block?.type === "text" && typeof block.text === "string")
      : [];
    if (textBlocks.length !== 1) {
      throw new Error("completed Dev Flow MCP calls require exactly one text result beside structured content");
    }
    let textResult;
    try {
      textResult = JSON.parse(textBlocks[0].text);
    } catch (error) {
      throw new Error(`Dev Flow MCP text result must contain complete JSON: ${error.message}`);
    }
    if (!deepEqualJSON(textResult, item.result.structured_content)) {
      throw new Error("Dev Flow MCP text and structured results must be deeply equal");
    }
    if (typeof item.tool !== "string" || !item.tool.startsWith("dev_flow_")) {
      throw new Error("Dev Flow MCP call must identify one dev_flow tool");
    }
    devFlowCalls.push({
      itemId: item.id,
      tool: item.tool,
      arguments: structuredClone(item.arguments ?? {}),
      result: structuredClone(item.result.structured_content),
    });
  }
  return {
    threadId: events[0].thread_id,
    devFlowCalls,
    commandExecutions,
    ignoredPreviewCount,
    ignoredProseCount,
  };
}

export function summarizeRecordedSessions({ ordinary, invalid, substantive, resume } = {}) {
  for (const [label, session] of Object.entries({ ordinary, invalid, substantive, resume })) {
    if (
      !isPlainObject(session)
      || !Array.isArray(session.devFlowCalls)
      || !Array.isArray(session.commandExecutions)
      || typeof session.threadId !== "string"
      || session.threadId.length === 0
    ) {
      throw new Error(`${label} session is not parsed Codex exec JSONL`);
    }
  }
  if (ordinary.devFlowCalls.length !== 0 || invalid.devFlowCalls.length !== 0) {
    throw new Error("ordinary and invalid explicit-invocation sessions must make zero Dev Flow calls");
  }
  if ([...ordinary.commandExecutions, ...invalid.commandExecutions].some(
    ({ classification }) => classification !== "nonverification",
  )) {
    throw new Error("ordinary and invalid session commands must remain nonverification facts");
  }
  const threadIds = [ordinary.threadId, invalid.threadId, substantive.threadId, resume.threadId];
  if (new Set(threadIds).size !== 4) {
    throw new Error("all four Codex thread IDs must be nonempty and pairwise distinct");
  }
  const observed = [...substantive.devFlowCalls, ...resume.devFlowCalls];
  if (observed.length === 0) throw new Error("substantive/resume sessions contain no Dev Flow calls");
  if (observed.length > nativeCoreCallBudget) {
    throw new Error(`recorded native sessions exceeded the ${nativeCoreCallBudget}-call scenario budget`);
  }
  const substantiveTasks = substantive.devFlowCalls
    .map(taskProjectionFromCall)
    .filter(isPlainObject);
  const resumeTasks = resume.devFlowCalls
    .map(taskProjectionFromCall)
    .filter(isPlainObject);
  if (
    substantiveTasks.length === 0
    || substantiveTasks.at(-1).outcome?.status === "completed"
    || resumeTasks.length === 0
  ) {
    throw new Error("native restart boundary requires a nonterminal substantive task and terminal resume observations");
  }
  const taskObservations = observed
    .map((call) => ({ call, task: taskProjectionFromCall(call) }))
    .filter(({ task }) => isPlainObject(task));
  if (taskObservations.length === 0) throw new Error("complete Core task results are required");
  const taskIDs = new Set(taskObservations.map(({ task }) => task.task_id));
  if (taskIDs.size !== 1 || [...taskIDs][0] === undefined) {
    throw new Error("substantive and resume sessions must preserve one Core task ID");
  }
  const rawRevisions = taskObservations.map(({ task }) => task.revision);
  if (
    !rawRevisions.every(Number.isInteger)
    || rawRevisions.some((revision, index) => index > 0 && revision < rawRevisions[index - 1])
  ) {
    throw new Error("raw complete Core task revisions must be non-regressing before deduplication");
  }
  const revisions = rawRevisions.filter((revision, index) => index === 0 || revision !== rawRevisions[index - 1]);
  if (!strictlyIncreasing(revisions)) {
    throw new Error("adjacent-deduplicated Core task revisions must be strictly increasing");
  }
  const committedActions = taskObservations
    .filter(({ call, task }) => call.tool === "dev_flow_apply_action" && task.last_operation?.kind === "apply_action")
    .map(({ task }) => ({
      action_id: task.last_operation.action_id,
      revision: task.revision,
    }));
  if (committedActions.length < 2) throw new Error("recorded native sessions require at least two Core action commits");
  const resumeApplyIndex = resume.devFlowCalls.findIndex((call) => call.tool === "dev_flow_apply_action");
  const priorResumeTools = resumeApplyIndex < 0
    ? []
    : resume.devFlowCalls.slice(0, resumeApplyIndex).map((call) => call.tool);
  const getTaskIndex = priorResumeTools.indexOf("dev_flow_get_task");
  const getNextActionIndex = priorResumeTools.indexOf("dev_flow_get_next_action", getTaskIndex + 1);
  if (resumeApplyIndex < 0 || getTaskIndex < 0 || getNextActionIndex < 0) {
    throw new Error("restart recovery requires get_task then get_next_action before a later apply mutation");
  }

  const budgets = taskObservations
    .map(({ task }) => task.contract?.verification_budget)
    .filter(isPlainObject);
  if (budgets.length === 0 || budgets.some((budget) => !deepEqualJSON(budget, budgets[0]))) {
    throw new Error("complete Core task results must provide one stable verification budget");
  }
  const budget = structuredClone(budgets[0]);
  requireVerificationBudget(budget);

  const sessionCommandFacts = [ordinary, invalid, substantive, resume]
    .flatMap(({ commandExecutions }) => commandExecutions);
  const proofFacts = sessionCommandFacts.filter(({ classification }) => classification === "verification");
  if (proofFacts.length !== 1) {
    const fact = proofFacts[1] ?? proofFacts[0];
    throw commandEventError("native verification proof must occur exactly once; duplicate or missing proof is rejected", fact);
  }
  const commandExecutions = proofFacts.map((fact) => ({
    sessionRole: fact.sessionRole,
    eventIndex: fact.eventIndex,
    itemIdSha256: fact.itemIdSha256,
    logicalProofName: nativeProofCommand,
    renderedCommandSha256: fact.commandSha256,
    exitCode: fact.exitCode,
    status: fact.status,
    outputSha256: fact.outputSha256,
    fullSuite: false,
  }));
  const submittedAutomatedChecks = observed.flatMap((call) =>
    normalizeAutomatedChecks(call.arguments?.payload?.checks, "submitted"));
  const terminalTask = taskObservations.at(-1).task;
  const retainedAutomatedChecks = normalizeAutomatedChecks(terminalTask.evidence, "retained");
  assertVerificationParity({ commandExecutions, submittedAutomatedChecks, retainedAutomatedChecks, budget });

  const terminal = terminalTask.outcome?.status;
  if (terminalTask.phase !== "DONE" || terminal !== "completed") {
    throw new Error("recorded native sessions must end in authoritative Core phase DONE and completed outcome");
  }
  return {
    ordinaryCoreCalls: ordinary.devFlowCalls.length,
    invalidCoreCalls: invalid.devFlowCalls.length,
    threadIds,
    substantiveThreadId: substantive.threadId,
    resumeThreadId: resume.threadId,
    taskId: [...taskIDs][0],
    rawRevisions,
    revisions,
    committedActions,
    terminalPhase: terminalTask.phase,
    terminalOutcome: "DONE",
    coreCallCount: observed.length,
    restartRecoveryReads: ["dev_flow_get_task", "dev_flow_get_next_action"],
    budget,
    sessionCommandFacts: structuredClone(sessionCommandFacts),
    commandExecutions: structuredClone(commandExecutions),
    submittedAutomatedChecks,
    retainedAutomatedChecks,
    terminalTask: structuredClone(terminalTask),
  };
}

function taskProjectionFromCall(call) {
  const result = call?.result?.result;
  if (!isPlainObject(result)) return null;
  if (isPlainObject(result.task)) return result.task;
  if (
    call.tool === "dev_flow_get_next_action"
    && typeof result.task_id === "string"
    && Number.isInteger(result.revision)
    && typeof result.phase === "string"
  ) {
    return result;
  }
  return null;
}

function requireVerificationBudget(budget) {
  const expectedKeys = ["allow_full_suite", "allow_manual_handoff", "level", "max_automatic_commands"];
  if (
    !isPlainObject(budget)
    || !equalArrays(Object.keys(budget).sort(), expectedKeys)
    || !["minimal", "targeted", "full"].includes(budget.level)
    || !Number.isInteger(budget.max_automatic_commands)
    || budget.max_automatic_commands < 0
    || budget.max_automatic_commands > 20
    || typeof budget.allow_full_suite !== "boolean"
    || typeof budget.allow_manual_handoff !== "boolean"
  ) {
    throw new Error("complete Core verification budget is missing or malformed");
  }
}

function normalizeAutomatedChecks(checks, label) {
  if (checks === undefined) return [];
  if (!Array.isArray(checks)) throw new Error(`${label} Core evidence checks must be an array`);
  return checks
    .filter((check) => check?.source === "automated")
    .map((check) => {
      if (
        !isPlainObject(check)
        || typeof check.name !== "string"
        || check.name.length === 0
        || check.status !== "passed"
        || check.command_count !== 1
        || typeof check.full_suite !== "boolean"
      ) {
        throw new Error(`${label} automated Core evidence must identify one passing command exactly`);
      }
      return {
        name: check.name,
        commandCount: check.command_count,
        fullSuite: check.full_suite,
      };
    });
}

function assertVerificationParity({ commandExecutions, submittedAutomatedChecks, retainedAutomatedChecks, budget }) {
  if (
    commandExecutions.length !== submittedAutomatedChecks.length
    || commandExecutions.length !== retainedAutomatedChecks.length
  ) {
    throw commandEventError(
      "native proof is unbound: actual verification and submitted/retained automated Core evidence counts must match",
      commandExecutions[0],
    );
  }
  for (let index = 0; index < commandExecutions.length; index += 1) {
    const execution = commandExecutions[index];
    const submitted = submittedAutomatedChecks[index];
    const retained = retainedAutomatedChecks[index];
    if (
      execution.logicalProofName !== submitted.name
      || execution.logicalProofName !== retained.name
      || execution.fullSuite !== submitted.fullSuite
      || execution.fullSuite !== retained.fullSuite
      || submitted.commandCount !== 1
      || retained.commandCount !== 1
    ) {
      throw commandEventError(
        "native proof is unbound: logical proof identity/full-suite facts must equal submitted and retained automated Core evidence",
        execution,
      );
    }
  }
  if (commandExecutions.length > budget.max_automatic_commands) {
    throw commandEventError(
      "actual automatic command executions exceeded the Core verification budget",
      commandExecutions[budget.max_automatic_commands] ?? commandExecutions.at(-1),
    );
  }
  if (!budget.allow_full_suite && commandExecutions.some(({ fullSuite }) => fullSuite)) {
    throw commandEventError(
      "actual command executions include a full suite forbidden by the Core verification budget",
      commandExecutions.find(({ fullSuite }) => fullSuite),
    );
  }
}

function commandEventError(message, fact) {
  const error = new Error(message);
  if (isPlainObject(fact)) {
    error.failureContext = {
      session_role: fact.sessionRole,
      event_type: "command_execution",
      command_sha256: fact.commandSha256 ?? fact.renderedCommandSha256,
      output_sha256: fact.outputSha256,
      status: fact.status,
      exit_code: fact.exitCode,
    };
  }
  return error;
}

export async function runRecordedNativeSessions({ spawnSession } = {}) {
  if (typeof spawnSession !== "function") throw new Error("native session driver requires a spawnSession function");
  const parsed = {};
  for (const [role, stopAfterFirstApply] of [
    ["ordinary", false],
    ["invalid", false],
    ["substantive", true],
    ["resume", false],
  ]) {
    const stream = await spawnSession({ role, stopAfterFirstApply });
    parsed[role] = parseCodexExecJSONL(stream, { sessionRole: role });
  }
  return { sessions: parsed, summary: summarizeRecordedSessions(parsed) };
}

export async function prepareCanonicalEvidenceParent(options = {}, dependencies = {}) {
  if (!isPlainObject(options)) {
    throw new Error("canonical evidence parent options must be an object");
  }
  if (!isPlainObject(dependencies)) {
    throw new Error("canonical evidence parent dependencies must be an object");
  }
  const allowedKeys = ["evidencePath", "repositoryRoot"];
  if (!Object.keys(options).every((key) => allowedKeys.includes(key))) {
    throw new Error("canonical evidence parent options contain an unexpected field");
  }
  if (!Object.keys(dependencies).every((key) => key === "fsyncParent")) {
    throw new Error("canonical evidence parent dependencies contain an unexpected field");
  }
  const fsyncParent = dependencies.fsyncParent ?? fsyncDirectory;
  if (typeof fsyncParent !== "function") {
    throw new Error("canonical evidence parent fsync dependency must be a function");
  }
  const sourceRoot = options.repositoryRoot ?? repositoryRoot;
  const evidencePath = options.evidencePath ?? canonicalNativeEvidencePath;
  if (!isAbsolutePath(sourceRoot) || resolve(sourceRoot) !== sourceRoot) {
    throw new Error("canonical evidence repository root must be an exact absolute path");
  }
  if (!isAbsolutePath(evidencePath) || resolve(evidencePath) !== evidencePath) {
    throw new Error("canonical evidence path must be an exact absolute path");
  }
  const expectedEvidencePath = join(
    sourceRoot,
    "tests",
    "journeys",
    "evidence",
    "codex-macos-arm64.json",
  );
  if (evidencePath !== expectedEvidencePath) {
    throw new Error("native evidence path is outside the exact canonical repository path");
  }

  const rootInfo = await lstat(sourceRoot);
  if (rootInfo.isSymbolicLink()) {
    throw new Error("canonical evidence repository root must not be a symbolic link");
  }
  if (!rootInfo.isDirectory()) {
    throw new Error("canonical evidence repository root must be a directory");
  }
  if (await realpath(sourceRoot) !== sourceRoot) {
    throw new Error("canonical evidence repository root resolves through a symbolic link");
  }

  let current = sourceRoot;
  for (const segment of ["tests", "journeys", "evidence"]) {
    current = join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw new Error(
          `canonical evidence parent preparation failed at ${current}: ${error?.code ?? "unknown"}: ${error?.message ?? error}`,
          { cause: error },
        );
      }
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError?.code !== "EEXIST") {
          throw new Error(
            `canonical evidence parent creation failed at ${current}: ${mkdirError?.code ?? "unknown"}: ${mkdirError?.message ?? mkdirError}`,
            { cause: mkdirError },
          );
        }
      }
      await fsyncParent(dirname(current));
      info = await lstat(current);
    }
    if (info.isSymbolicLink()) {
      throw new Error(`canonical evidence parent must not be a symbolic link: ${current}`);
    }
    if (!info.isDirectory()) {
      throw new Error(`canonical evidence parent must be a directory: ${current}`);
    }
    if (await realpath(current) !== current) {
      throw new Error(`canonical evidence parent resolves through a symbolic link: ${current}`);
    }
  }

  return captureCanonicalEvidencePathIdentity({
    repositoryRoot: sourceRoot,
    evidencePath,
  });
}

async function captureCanonicalEvidencePathIdentity({ repositoryRoot: sourceRoot, evidencePath }) {
  const parentPath = dirname(evidencePath);
  let parentInfo;
  try {
    parentInfo = await lstat(parentPath);
  } catch (error) {
    throw new Error(
      `canonical evidence parent identity is unavailable: ${error?.code ?? "unknown"}: ${error?.message ?? error}`,
      { cause: error },
    );
  }
  if (parentInfo.isSymbolicLink()) {
    throw new Error("canonical evidence parent must not be a symbolic link");
  }
  if (!parentInfo.isDirectory()) {
    throw new Error("canonical evidence parent must be a directory");
  }
  const parentRealpath = await realpath(parentPath);
  if (parentRealpath !== parentPath) {
    throw new Error("canonical evidence parent resolves through a symbolic link");
  }

  let leafInfo = null;
  try {
    leafInfo = await lstat(evidencePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(
        `canonical evidence leaf identity is unavailable: ${error?.code ?? "unknown"}: ${error?.message ?? error}`,
        { cause: error },
      );
    }
  }
  if (leafInfo?.isSymbolicLink()) {
    throw new Error("canonical evidence leaf must not be a symbolic link");
  }
  if (leafInfo !== null && !leafInfo.isFile()) {
    throw new Error("canonical evidence leaf must be absent or a regular file");
  }
  if (leafInfo !== null && await realpath(evidencePath) !== evidencePath) {
    throw new Error("canonical evidence leaf resolves through a symbolic link");
  }

  return Object.freeze({
    repositoryRoot: sourceRoot,
    evidencePath,
    parentPath,
    parentRealpath,
    parentDevice: parentInfo.dev,
    parentInode: parentInfo.ino,
    leaf: leafInfo === null
      ? Object.freeze({ state: "absent" })
      : Object.freeze({
        state: "regular",
        device: leafInfo.dev,
        inode: leafInfo.ino,
        size: leafInfo.size,
        mtimeMs: leafInfo.mtimeMs,
        ctimeMs: leafInfo.ctimeMs,
      }),
  });
}

async function revalidateCanonicalEvidencePathIdentity(identity, leafExpectation = "same") {
  if (
    !isPlainObject(identity)
    || !isAbsolutePath(identity.repositoryRoot)
    || !isAbsolutePath(identity.evidencePath)
    || !isAbsolutePath(identity.parentPath)
    || !["absent", "regular"].includes(identity.leaf?.state)
  ) {
    throw new Error("canonical evidence path identity token is invalid");
  }
  const expectedEvidencePath = join(
    identity.repositoryRoot,
    "tests",
    "journeys",
    "evidence",
    "codex-macos-arm64.json",
  );
  if (
    resolve(identity.repositoryRoot) !== identity.repositoryRoot
    || identity.evidencePath !== expectedEvidencePath
    || identity.parentPath !== dirname(expectedEvidencePath)
    || identity.parentRealpath !== identity.parentPath
  ) {
    throw new Error("canonical evidence path identity does not bind the exact repository path");
  }
  if (!new Set(["same", "absent", "regular", "safe-current"]).has(leafExpectation)) {
    throw new Error("canonical evidence leaf expectation is invalid");
  }
  const observed = await captureCanonicalEvidencePathIdentity({
    repositoryRoot: identity.repositoryRoot,
    evidencePath: identity.evidencePath,
  });
  if (
    observed.parentPath !== identity.parentPath
    || observed.parentRealpath !== identity.parentRealpath
    || observed.parentDevice !== identity.parentDevice
    || observed.parentInode !== identity.parentInode
  ) {
    throw new Error("canonical evidence parent identity changed");
  }
  if (leafExpectation === "absent" && observed.leaf.state !== "absent") {
    throw new Error("canonical evidence leaf identity changed from absent");
  }
  if (leafExpectation === "regular" && observed.leaf.state !== "regular") {
    throw new Error("canonical evidence leaf is not a regular file");
  }
  if (leafExpectation === "same" && !deepEqualJSON(observed.leaf, identity.leaf)) {
    throw new Error("canonical evidence leaf identity changed");
  }
  return observed;
}

async function withCanonicalEvidencePathRead(identity, operation) {
  await revalidateCanonicalEvidencePathIdentity(identity);
  try {
    return await operation();
  } finally {
    await revalidateCanonicalEvidencePathIdentity(identity);
  }
}

export async function executeNativeJourney(inputs = {}, dependencies = {}) {
  const expectedInputKeys = [
    "artifactReportPath",
    "codexExecutable",
    "ledgerPath",
    "validationReportPath",
  ];
  if (!isPlainObject(inputs) || !equalArrays(Object.keys(inputs).sort(), expectedInputKeys)) {
    throw new Error("native journey requires exactly four final input paths");
  }
  const evidencePath = dependencies.evidencePath ?? canonicalNativeEvidencePath;
  const evidenceRepositoryRoot = dependencies.evidenceRepositoryRoot ?? repositoryRoot;
  const recoveryRoot = dependencies.recoveryRoot ?? `${inputs.ledgerPath}.recovery`;
  if (!isAbsolutePath(evidencePath) || !isAbsolutePath(recoveryRoot)) {
    throw new Error("native evidence and recovery roots must be absolute");
  }
  const platform = dependencies.platform ?? process.platform;
  const arch = dependencies.arch ?? process.arch;

  const preflight = dependencies.preflight ?? preflightNativeInputs;
  const assertFrozenSource = dependencies.assertFrozenSource ?? assertFrozenRepositoryIdentity;
  const prepareEvidenceParent = dependencies.prepareEvidenceParent ?? prepareCanonicalEvidenceParent;
  const prepareHost = dependencies.prepareHost ?? prepareNativeHost;
  const finishHost = dependencies.finishHost ?? finishNativeHost;
  const cleanupHost = dependencies.cleanupHost ?? cleanupNativeHost;
  const spawnSession = dependencies.spawnSession ?? spawnNativeCodexSession;
  const validateCandidate = dependencies.validateCandidate ?? validateEvidenceCandidate;
  const validatePublished = dependencies.validatePublished ?? validatePublishedEvidence;
  const now = dependencies.now ?? (() => new Date().toISOString());

  const firstPreflight = await preflight(inputs);
  if (platform !== "darwin" || arch !== "arm64") {
    throw new Error("native Codex journey requires darwin-arm64");
  }
  await assertFrozenSource(firstPreflight.identity.source_commit);
  const evidencePathIdentity = await prepareEvidenceParent({
    repositoryRoot: evidenceRepositoryRoot,
    evidencePath,
  });
  const firstAdmission = await withCanonicalEvidencePathRead(
    evidencePathIdentity,
    () => inspectNativeAdmission({
      ledgerPath: inputs.ledgerPath,
      evidencePath,
      identity: firstPreflight.identity,
    }),
  );
  if (!firstAdmission.allowed) {
    return withCanonicalEvidencePathRead(
      evidencePathIdentity,
      () => recoverOrRejectNativeAdmission({
        decision: firstAdmission,
        preflight: firstPreflight,
        ledgerPath: inputs.ledgerPath,
        evidencePath,
        evidencePathIdentity,
        recoveryRoot,
        validatePublished,
      }),
    );
  }

  let hostContext;
  let reservation;
  let prepared;
  try {
    hostContext = await prepareHost({ ...inputs, preflight: firstPreflight });
    const finalPreflight = await preflight(inputs);
    await assertFrozenSource(finalPreflight.identity.source_commit);
    assertSameNativePreflight(firstPreflight, finalPreflight);

    reservation = await reserveNativeAttempt({
      ledgerPath: inputs.ledgerPath,
      evidencePath,
      evidencePathIdentity,
      identity: finalPreflight.identity,
      reservedAt: now(),
    });
    const recoveryDirectory = join(recoveryRoot, reservation.chainId);
    const sessionResult = await runRecordedNativeSessions({
      spawnSession: (session) => spawnSession({
        ...session,
        context: hostContext,
        codexExecutable: inputs.codexExecutable,
      }),
    });
    const completed = await finishHost({
      context: hostContext,
      sessionResult,
      codexExecutable: inputs.codexExecutable,
      preflight: finalPreflight,
    });
    if (!isPlainObject(completed?.journey) || !isPlainObject(completed?.observedFacts)) {
      throw new Error("native host completion must return closed journey and observed facts");
    }

    const completedAt = now();
    const recordedAt = now();
    const evidence = passingEvidenceBase({
      preflight: finalPreflight,
      journey: completed.journey,
      recordedAt,
    });
    prepared = preparePassingAttempt({
      reservation,
      observedFacts: completed.observedFacts,
      completedAt,
      evidence,
    });
    await commitPassingAttempt({
      ledgerPath: inputs.ledgerPath,
      evidencePath,
      evidencePathIdentity,
      recoveryDirectory,
      reservation,
      prepared,
      validateCandidates: ({ evidenceBytes, finalLedgerBytes, observedFactsBytes }) =>
        validateCandidate({
          evidenceText: evidenceBytes,
          validationReportText: finalPreflight.validationText,
          artifactReportText: finalPreflight.artifactText,
          attemptLedgerText: finalLedgerBytes,
          observedFactsText: observedFactsBytes,
          artifactSha256: finalPreflight.identity.artifact_sha256,
          artifactPath: finalPreflight.artifact.artifact_path,
          attemptLedgerPath: inputs.ledgerPath,
          evidencePath,
          canonicalEvidencePath: evidencePath,
          rootVersion: finalPreflight.rootVersion,
          schemas: finalPreflight.schemas,
        }),
      onStage: dependencies.onCommitStage,
    });
    const published = validatePublished({
      evidenceText: await readFile(evidencePath, "utf8"),
      expectedEvidenceText: prepared.evidenceBytes,
      attemptLedgerText: await readFile(inputs.ledgerPath, "utf8"),
      expectedAttemptLedgerText: prepared.finalLedgerBytes,
      attemptLedgerPath: inputs.ledgerPath,
      expectedLedgerId: reservation.ledgerId,
    });
    if (!published?.valid) {
      throw new Error(`published native evidence integrity failed: ${(published?.errors ?? []).join("; ")}`);
    }
    return {
      status: "committed",
      chainId: reservation.chainId,
      attemptNumber: reservation.attemptNumber,
      evidencePath,
      ledgerPath: inputs.ledgerPath,
    };
  } catch (error) {
    if (!reservation) throw error;
    const recoveryDirectory = join(recoveryRoot, reservation.chainId);
    let currentEvidenceIdentity;
    try {
      currentEvidenceIdentity = await revalidateCanonicalEvidencePathIdentity(
        evidencePathIdentity,
        "safe-current",
      );
    } catch (identityError) {
      throw new Error(
        `canonical evidence path identity changed after reservation; native attempt remains reserved: ${identityError.message}`,
        { cause: error },
      );
    }
    if (currentEvidenceIdentity.leaf.state === "regular") {
      try {
        const recovery = await recoverPassingAttempt({
          ledgerPath: inputs.ledgerPath,
          evidencePath,
          evidencePathIdentity: currentEvidenceIdentity,
          recoveryDirectory,
        });
        const published = validatePublished({
          evidenceText: await readFile(evidencePath, "utf8"),
          expectedEvidenceText: prepared.evidenceBytes,
          attemptLedgerText: await readFile(inputs.ledgerPath, "utf8"),
          expectedAttemptLedgerText: prepared.finalLedgerBytes,
          attemptLedgerPath: inputs.ledgerPath,
          expectedLedgerId: reservation.ledgerId,
        });
        if (!published?.valid) {
          throw new Error(`published recovery integrity failed: ${(published?.errors ?? []).join("; ")}`);
        }
        return { ...recovery, chainId: reservation.chainId, evidencePath };
      } catch (recoveryError) {
        throw new Error(
          `published passing evidence requires terminal no-host recovery: ${recoveryError.message}`,
          { cause: error },
        );
      }
    }
    const completedAt = now();
    const recordedAt = now();
    const safeFailure = failureProjection(error);
    const failure = await finalizeFailedAttempt({
      ledgerPath: inputs.ledgerPath,
      evidencePath,
      evidencePathIdentity: currentEvidenceIdentity,
      recoveryDirectory,
      reservation,
      status: "failed",
      completedAt,
      observedFacts: { schema_version: 2, ...structuredClone(safeFailure) },
      diagnosticBase: failureDiagnosticBase({
        preflight: firstPreflight,
        recordedAt,
        ...safeFailure,
      }),
    });
    throw new Error(
      `${error.message}; native attempt was consumed and retained in external diagnostic ${failure.diagnosticPath}`,
      { cause: error },
    );
  } finally {
    if (hostContext) await cleanupHost(hostContext);
  }
}

async function recoverOrRejectNativeAdmission({
  decision,
  preflight,
  ledgerPath,
  evidencePath,
  evidencePathIdentity,
  recoveryRoot,
  validatePublished,
}) {
  if (!decision.recoveryRequired || await readOptional(evidencePath) === null) {
    throw new Error(`native launch rejected before host spawn: ${decision.reason}`);
  }
  const chainId = deriveChainId(preflight.identity);
  const recoveryDirectory = join(recoveryRoot, chainId);
  const recovery = await recoverPassingAttempt({
    ledgerPath,
    evidencePath,
    evidencePathIdentity,
    recoveryDirectory,
  });
  const [expectedEvidenceText, expectedAttemptLedgerText, evidenceText, attemptLedgerText] = await Promise.all([
    readFile(join(recoveryDirectory, recoveryFiles.evidence), "utf8"),
    readFile(join(recoveryDirectory, recoveryFiles.finalLedger), "utf8"),
    readFile(evidencePath, "utf8"),
    readFile(ledgerPath, "utf8"),
  ]);
  const result = validatePublished({
    evidenceText,
    expectedEvidenceText,
    attemptLedgerText,
    expectedAttemptLedgerText,
    attemptLedgerPath: ledgerPath,
    expectedLedgerId: preflight.ledgerId,
  });
  if (!result?.valid) {
    throw new Error(`published native evidence recovery failed: ${(result?.errors ?? []).join("; ")}`);
  }
  return { ...recovery, chainId, evidencePath };
}

function assertSameNativePreflight(first, second) {
  if (
    first.validationText !== second.validationText
    || first.artifactText !== second.artifactText
    || first.ledgerId !== second.ledgerId
    || !deepEqualJSON(first.identity, second.identity)
  ) {
    throw new Error("frozen native inputs changed between setup and attempt reservation");
  }
}

function passingEvidenceBase({ preflight, journey, recordedAt }) {
  requireTimestamp(recordedAt, "recordedAt");
  return {
    schema_version: 3,
    status: "pass",
    recorded_at: recordedAt,
    classification: {
      evidence_type: "native-host",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: selectedCodexVersion,
      codex_compatibility: selectedCodexRange,
      package: preflight.artifact.package_version,
      core: preflight.artifact.core_version,
      core_contract: "0.1",
    },
    identity: {
      source_commit: preflight.identity.source_commit,
      artifact_sha256: preflight.identity.artifact_sha256,
      artifact_report_sha256: preflight.identity.artifact_report_sha256,
      artifact_built_at: preflight.artifact.built_at,
      shared_fixtures_sha256: sharedFixturesSha256,
    },
    validation: {
      report_sha256: preflight.identity.validation_report_sha256,
      completed_at: preflight.validation.completed_at,
      targeted_checks: structuredClone(preflight.validation.targeted_checks),
      root_validation: structuredClone(preflight.validation.root_validation),
    },
    journey: structuredClone(journey),
    failures: [],
    skips: [],
  };
}

function failureDiagnosticBase({ preflight, recordedAt, failure_kind, failure, failure_context }) {
  requireTimestamp(recordedAt, "recordedAt");
  return {
    schema_version: 2,
    report_type: "dev-flow-codex-native-attempt-diagnostic",
    recorded_at: recordedAt,
    classification: {
      evidence_type: "native-attempt-diagnostic",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: selectedCodexVersion,
      codex_compatibility: selectedCodexRange,
      package: preflight.artifact.package_version,
      core: preflight.artifact.core_version,
      core_contract: "0.1",
    },
    identity: {
      source_commit: preflight.identity.source_commit,
      artifact_sha256: preflight.identity.artifact_sha256,
      artifact_report_sha256: preflight.identity.artifact_report_sha256,
      artifact_built_at: preflight.artifact.built_at,
    },
    validation: {
      report_sha256: preflight.identity.validation_report_sha256,
      completed_at: preflight.validation.completed_at,
      targeted_checks: structuredClone(preflight.validation.targeted_checks),
      root_validation: structuredClone(preflight.validation.root_validation),
    },
    failure_kind,
    failure: structuredClone(failure),
    ...(failure_context ? { failure_context: structuredClone(failure_context) } : {}),
    skips: [],
  };
}

function failureProjection(error) {
  const failureContext = error?.failureContext;
  const hasCommandContext = isPlainObject(failureContext)
    && nativeSessionRoles.includes(failureContext.session_role)
    && failureContext.event_type === "command_execution"
    && hex(failureContext.command_sha256, 64)
    && hex(failureContext.output_sha256, 64)
    && ["completed", "failed", "declined"].includes(failureContext.status)
    && (Number.isInteger(failureContext.exit_code) || failureContext.exit_code === null);
  return {
    failure_kind: hasCommandContext ? "command_event" : "non_command",
    failure: {
      phase_code: hasCommandContext ? "codex-session" : "native-journey",
      reason_code: hasCommandContext ? "command-event-rejected" : "unexpected-failure",
      detail_sha256: sha256(String(error?.message ?? "native attempt failed")),
    },
    ...(hasCommandContext ? { failure_context: structuredClone(failureContext) } : {}),
  };
}

async function assertFrozenRepositoryIdentity(sourceCommit) {
  const identity = await defaultReadSourceIdentity(repositoryRoot);
  if (identity.commit !== sourceCommit || identity.dirty !== false) {
    throw new Error("native journey source checkout is not the clean frozen report commit");
  }
}

async function prepareNativeHost({ codexExecutable, preflight }) {
  const workspace = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-native-")));
  try {
  const installPrefix = join(workspace, "install");
  const isolatedHome = join(workspace, "home");
  const isolatedCodexHome = join(workspace, "codex-home");
  const dataDirectory = join(workspace, "data");
  const aliasDirectory = join(workspace, "exact-codex-bin");
  const targetPath = join(workspace, "target-repository");
  const invalidPath = join(workspace, "non-git-input");
  await Promise.all([
    mkdir(installPrefix, { recursive: true, mode: 0o700 }),
    mkdir(isolatedHome, { recursive: true, mode: 0o700 }),
    mkdir(isolatedCodexHome, { recursive: true, mode: 0o700 }),
    mkdir(dataDirectory, { recursive: true, mode: 0o700 }),
    mkdir(aliasDirectory, { recursive: true, mode: 0o700 }),
    mkdir(targetPath, { recursive: true, mode: 0o700 }),
    mkdir(invalidPath, { recursive: true, mode: 0o700 }),
  ]);

  const canonicalCodexExecutable = preflight.canonicalCodexExecutable
    ?? await realpath(codexExecutable);
  const codexAlias = join(aliasDirectory, "codex");
  await symlink(canonicalCodexExecutable, codexAlias);
  await copyNativeAuthentication(isolatedCodexHome);
  await initializeNativeTargetRepository(targetPath);
  await writeFile(join(invalidPath, "README.txt"), "non-Git explicit-invocation boundary\n", { mode: 0o600 });
  await installNativeArtifact(preflight.artifact.artifact_path, installPrefix);

  const installedPackage = join(installPrefix, "node_modules", "dev-flow-codex");
  const launcher = join(installPrefix, "node_modules", ".bin", "dev-flow-codex");
  const runtimePath = join(installedPackage, "runtime", "darwin-arm64", "dev-flow");
  await Promise.all([
    assertExecutable(launcher, "installed dev-flow-codex launcher"),
    assertExecutable(runtimePath, "installed packaged Core"),
  ]);
  const environment = {
    ...process.env,
    HOME: isolatedHome,
    CODEX_HOME: isolatedCodexHome,
    DEV_FLOW_DATA_DIR: dataDirectory,
    PATH: [aliasDirectory, join(installPrefix, "node_modules", ".bin"), process.env.PATH ?? ""].join(delimiter),
  };
  delete environment.NODE_TEST_CONTEXT;

  const repositoryDigestBefore = await directoryDigest(targetPath, { excludeGit: true });
  const versionLine = (await execText(launcher, ["--version"], { cwd: targetPath, env: environment })).trim();
  if (versionLine !== `dev-flow-codex ${preflight.rootVersion} (core ${preflight.rootVersion})`) {
    throw new Error("installed launcher package/Core version identity is invalid");
  }
  const setup = await execJSON(launcher, ["setup", "--json"], { cwd: targetPath, env: environment });
  if (setup.operation !== "setup" || setup.status !== "installed" || setup.changed !== true) {
    throw new Error("isolated native setup did not install exactly one registration");
  }
  const marketplaceReadback = await execJSON(codexAlias, ["plugin", "marketplace", "list", "--json"], {
    cwd: targetPath,
    env: environment,
  });
  const pluginReadback = await execJSON(codexAlias, ["plugin", "list", "--json"], {
    cwd: targetPath,
    env: environment,
  });
  const setupRegistry = assertOwnedRegistrationReadback(marketplaceReadback, pluginReadback, {
    marketplaceRoot: installedPackage,
    pluginRoot: join(installedPackage, "plugin"),
    version: preflight.rootVersion,
  });
  const repeatedSetup = await execJSON(launcher, ["setup", "--json"], { cwd: targetPath, env: environment });
  if (repeatedSetup.operation !== "setup" || repeatedSetup.status !== "already-installed" || repeatedSetup.changed !== false) {
    throw new Error("matching native setup is not an idempotent no-op");
  }
  if (await directoryDigest(targetPath, { excludeGit: true }) !== repositoryDigestBefore) {
    throw new Error("native setup/readback changed the target repository");
  }
  const receiptPath = join(
    isolatedHome,
    "Library",
    "Application Support",
    "dev-flow",
    "registrations",
    "codex.json",
  );
  const receipt = parseJSONDocument(await readFile(receiptPath, "utf8"), "native registration receipt");

  return {
    workspace,
    installPrefix,
    installedPackage,
    launcher,
    runtimePath,
    isolatedHome,
    isolatedCodexHome,
    dataDirectory,
    codexAlias,
    targetPath,
    invalidPath,
    environment,
    artifactPath: preflight.artifact.artifact_path,
    repositoryDigestBefore,
    receiptPath,
    setup,
    repeatedSetup,
    receipt,
    marketplaceReadback,
    pluginReadback,
    setupRegistry,
    registrationActive: true,
    packageInstalled: true,
  };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

async function finishNativeHost({ context, sessionResult, preflight }) {
  const { summary, sessions } = sessionResult;
  const repositoryDigestAfterCompletion = await directoryDigest(context.targetPath, { excludeGit: true });
  const changedPaths = await gitChangedPaths(context.targetPath);
  if (!changedPaths.includes(nativeProofPath)) {
    throw new Error(`native journey did not create required ${nativeProofPath}`);
  }
  const unexpectedChangedPaths = changedPaths.filter((path) => path !== nativeProofPath);
  if (unexpectedChangedPaths.length !== 0) {
    throw new Error(`native journey changed unexpected repository paths: ${unexpectedChangedPaths.join(", ")}`);
  }
  const proof = await readFile(join(context.targetPath, nativeProofPath), "utf8");
  if (proof !== nativeProofContent) {
    throw new Error(`${nativeProofPath} does not contain the exact bounded proof line`);
  }

  const taskDataBefore = await directoryManifest(context.dataDirectory);
  const adjacentPath = join(dirname(context.receiptPath), "user-owned-adjacent.txt");
  await writeFile(adjacentPath, "preserve adjacent registration data\n", { mode: 0o600 });
  const remove = await execJSON(context.launcher, ["remove", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  context.registrationActive = false;
  if (remove.operation !== "remove" || remove.status !== "removed" || remove.changed !== true) {
    throw new Error("native removal did not deregister the owned Codex product");
  }
  if (await readOptional(context.receiptPath) !== null) {
    throw new Error("native removal left its exact registration receipt present");
  }
  if (await readFile(adjacentPath, "utf8") !== "preserve adjacent registration data\n") {
    throw new Error("native removal changed adjacent user-owned registration data");
  }
  const marketplaceAfterRemove = await execJSON(
    context.codexAlias,
    ["plugin", "marketplace", "list", "--json"],
    { cwd: context.targetPath, env: context.environment },
  );
  const pluginsAfterRemove = await execJSON(context.codexAlias, ["plugin", "list", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  assertRegistrationAbsentReadback(marketplaceAfterRemove, pluginsAfterRemove);
  const repeatedRemove = await execJSON(context.launcher, ["remove", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  if (repeatedRemove.status !== "already-absent" || repeatedRemove.changed !== false) {
    throw new Error("repeated native removal is not an idempotent no-op");
  }

  const taskDataAfter = await directoryManifest(context.dataDirectory);
  if (!deepEqualJSON(taskDataBefore, taskDataAfter)) {
    throw new Error("native removal changed retained Core task data");
  }
  const reopenedTask = await directCoreTaskReopen({
    runtimePath: context.runtimePath,
    dataDirectory: context.dataDirectory,
    repositoryPath: context.targetPath,
    environment: context.environment,
    taskId: summary.taskId,
  });
  if (
    reopenedTask.task_id !== summary.taskId
    || reopenedTask.revision !== summary.revisions.at(-1)
    || reopenedTask.outcome?.status !== "completed"
  ) {
    throw new Error("direct packaged-Core reopen did not return the retained terminal task");
  }

  await uninstallNativePackage(context.installPrefix);
  context.packageInstalled = false;
  if (await pathExists(context.installedPackage)) {
    throw new Error("separate npm uninstall left the Codex package installed");
  }
  await installNativeArtifact(context.artifactPath, context.installPrefix);
  context.packageInstalled = true;
  await assertExecutable(context.launcher, "compatibly reinstalled launcher");
  const reinstall = await execJSON(context.launcher, ["setup", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  context.registrationActive = true;
  if (reinstall.status !== "installed" || reinstall.changed !== true) {
    throw new Error("compatible artifact reinstall did not restore the registration");
  }
  const reinstallMarketplaces = await execJSON(
    context.codexAlias,
    ["plugin", "marketplace", "list", "--json"],
    { cwd: context.targetPath, env: context.environment },
  );
  const reinstallPlugins = await execJSON(context.codexAlias, ["plugin", "list", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  const reinstallRegistry = assertOwnedRegistrationReadback(reinstallMarketplaces, reinstallPlugins, {
    marketplaceRoot: context.installedPackage,
    pluginRoot: join(context.installedPackage, "plugin"),
    version: preflight.rootVersion,
  });

  const finalRemove = await execJSON(context.launcher, ["remove", "--json"], {
    cwd: context.targetPath,
    env: context.environment,
  });
  context.registrationActive = false;
  if (!['removed', 'already-absent'].includes(finalRemove.status)) {
    throw new Error("compatible reinstall cleanup did not remove the registration");
  }
  await uninstallNativePackage(context.installPrefix);
  context.packageInstalled = false;

  const repositoryDigestAfterRemoval = await directoryDigest(context.targetPath, { excludeGit: true });
  if (repositoryDigestAfterRemoval !== repositoryDigestAfterCompletion) {
    throw new Error("native removal changed the target repository");
  }

  const coreCalls = [...sessions.substantive.devFlowCalls, ...sessions.resume.devFlowCalls];
  const committedActions = coreCalls
    .filter((call) => call.tool === "dev_flow_apply_action" && call.result?.result?.task?.last_operation?.kind === "apply_action")
    .map((call) => ({
      action_id: call.result.result.task.last_operation.action_id,
      revision: call.result.result.task.revision,
      arguments_sha256: sha256(jsonBytes(call.arguments)),
      result_sha256: sha256(jsonBytes(call.result)),
    }));
  const readBeforeRetryObservations = sessions.resume.devFlowCalls.filter(
    (call) => ["dev_flow_get_task", "dev_flow_get_next_action"].includes(call.tool),
  ).length;
  const verification = nativeVerificationProjection(summary);
  const submittedAutomatedCommandCount = verification.submitted_automated_checks
    .reduce((total, check) => total + check.command_count, 0);
  const retainedAutomatedCommandCount = verification.retained_automated_checks
    .reduce((total, check) => total + check.command_count, 0);
  const journey = {
    task_lineage: {
      thread_ids: summary.threadIds,
      task_id_before_restart: summary.taskId,
      task_id_after_restart: reopenedTask.task_id,
      raw_revisions: summary.rawRevisions,
      revisions: summary.revisions,
      committed_actions: committedActions,
      terminal_phase: summary.terminalPhase,
      terminal_outcome: summary.terminalOutcome,
    },
    invocation: {
      explicit_selector: "$dev-flow",
      core_call_count: summary.coreCallCount,
      scenario_call_budget: nativeCoreCallBudget,
      implicit_invocation_core_calls: summary.ordinaryCoreCalls,
      read_before_retry_observations: readBeforeRetryObservations,
      restart_recovery_reads: summary.restartRecoveryReads,
      verification_budget: verification.budget,
      session_command_facts: verification.session_command_facts,
      verification_commands: verification.command_executions,
      submitted_automated_command_count: submittedAutomatedCommandCount,
      retained_automated_command_count: retainedAutomatedCommandCount,
      submitted_full_suite: verification.submitted_automated_checks.some((check) => check.full_suite),
      retained_full_suite: verification.retained_automated_checks.some((check) => check.full_suite),
    },
    lifecycle: {
      setup_readback_passed: true,
      setup_registry: context.setupRegistry,
      restart_resume_passed: summary.substantiveThreadId !== summary.resumeThreadId,
      remove_readback_passed: true,
      task_data_retained: true,
      task_reopened_after_removal: true,
      compatible_reinstall_passed: true,
      reinstall_registry: reinstallRegistry,
    },
    repository: {
      target_path: context.targetPath,
      digest_before: context.repositoryDigestBefore,
      digest_after_completion: repositoryDigestAfterCompletion,
      digest_after_removal: repositoryDigestAfterRemoval,
      intended_changed_paths: [nativeProofPath],
      unexpected_changed_paths: [],
    },
    task_data: {
      manifest_before_removal_sha256: taskDataBefore.sha256,
      manifest_after_removal_sha256: taskDataAfter.sha256,
      files_before_removal: taskDataBefore.files.map(({ path }) => path),
      files_after_removal: taskDataAfter.files.map(({ path }) => path),
      retained_data_location: {
        kind: "isolated-explicit-data-directory",
        workspace_relative_path: "data",
        canonical_path_sha256: sha256(context.dataDirectory),
      },
    },
  };
  const observedFacts = {
    schema_version: 1,
    classification: "native-codex-cli",
    source_commit: preflight.identity.source_commit,
    setup: {
      first: context.setup,
      repeated: context.repeatedSetup,
      marketplace_count: context.marketplaceReadback.marketplaces.length,
      plugin_count: context.pluginReadback.installed.length,
    },
    sessions: {
      ordinary: sessionFact(sessions.ordinary),
      invalid: sessionFact(sessions.invalid),
      substantive: sessionFact(sessions.substantive),
      resume: sessionFact(sessions.resume),
      summary,
    },
    verification: structuredClone(verification),
    terminal_task: structuredClone(summary.terminalTask),
    removal: {
      first: remove,
      repeated: repeatedRemove,
      direct_reopen_task_id: reopenedTask.task_id,
      direct_reopen_revision: reopenedTask.revision,
      compatible_reinstall: reinstall,
      adjacent_preserved: true,
    },
    repository: journey.repository,
    task_data: journey.task_data,
    journey: structuredClone(journey),
  };
  return { journey, observedFacts };
}

async function cleanupNativeHost(context) {
  if (!isPlainObject(context) || !isAbsolutePath(context.workspace)) return;
  if (context.registrationActive && await pathExists(context.launcher)) {
    await execText(context.launcher, ["remove", "--json"], {
      cwd: context.targetPath,
      env: context.environment,
    }).catch(() => {});
  }
  if (context.packageInstalled) {
    await uninstallNativePackage(context.installPrefix).catch(() => {});
  }
  await rm(context.workspace, { recursive: true, force: true });
}

async function spawnNativeCodexSession({ role, stopAfterFirstApply, context, codexExecutable }) {
  const invocation = nativeSessionInvocation(role, context, codexExecutable);
  return captureCodexJSONL(invocation.executable, invocation.arguments, {
    cwd: invocation.cwd,
    env: invocation.env,
    stopAfterFirstApply,
  });
}

export function nativeSessionInvocation(role, context, codexExecutable) {
  if (!Object.hasOwn(nativePrompts, role)) throw new Error(`unsupported native session role ${role}`);
  if (!isPlainObject(context) || !isPlainObject(context.environment)) {
    throw new Error("native session context must contain one isolated environment");
  }
  const arguments_ = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox"];
  if (role === "invalid") arguments_.push("--skip-git-repo-check");
  arguments_.push(nativePrompts[role]);
  return {
    executable: context.codexAlias ?? codexExecutable,
    arguments: arguments_,
    cwd: role === "invalid" ? context.invalidPath : context.targetPath,
    env: context.environment,
  };
}

async function inspectNativeCodexVersion(codexExecutable) {
  const stdout = await execText(codexExecutable, ["--version"], {
    cwd: repositoryRoot,
    env: process.env,
  });
  const match = /^codex(?:-cli)? (\S+)\n?$/u.exec(stdout);
  if (!match) throw new Error("native Codex executable returned an invalid version line");
  return match[1];
}

async function copyNativeAuthentication(destinationCodexHome) {
  const sourceCodexHome = process.env.CODEX_HOME
    ?? (process.env.HOME ? join(process.env.HOME, ".codex") : null);
  if (!sourceCodexHome) return;
  const sourceAuth = join(sourceCodexHome, "auth.json");
  try {
    const info = await lstat(sourceAuth);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error("Codex authentication source must be a regular file");
    }
    const destinationAuth = join(destinationCodexHome, "auth.json");
    await copyFile(sourceAuth, destinationAuth, fsConstants.COPYFILE_EXCL);
    await chmod(destinationAuth, 0o600);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function initializeNativeTargetRepository(targetPath) {
  await execText("git", ["init", "--object-format=sha1", "--initial-branch=main", "--quiet"], {
    cwd: targetPath,
    env: process.env,
  });
  await writeFile(join(targetPath, "README.md"), "Dev Flow native journey target\n", { mode: 0o600 });
  await execText("git", ["add", "README.md"], { cwd: targetPath, env: process.env });
  await execText(
    "git",
    [
      "-c", "user.name=Dev Flow Native Journey",
      "-c", "user.email=dev-flow-native@example.invalid",
      "commit", "--quiet", "-m", "native journey baseline",
    ],
    { cwd: targetPath, env: process.env },
  );
}

async function installNativeArtifact(artifactPath, installPrefix) {
  await execText("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--prefix",
    installPrefix,
    artifactPath,
  ], { cwd: installPrefix, env: process.env });
}

async function uninstallNativePackage(installPrefix) {
  await execText("npm", [
    "uninstall",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--prefix",
    installPrefix,
    "dev-flow-codex",
  ], { cwd: installPrefix, env: process.env });
}

async function execText(executable, arguments_, { cwd, env }) {
  try {
    const { stdout } = await execFile(executable, arguments_, {
      cwd,
      env,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    const stderr = String(error?.stderr ?? "").trim();
    throw new Error(
      `command failed: ${basename(executable)} ${arguments_.slice(0, 3).join(" ")}${stderr ? `: ${stderr.slice(0, 4000)}` : ""}`,
      { cause: error },
    );
  }
}

async function execJSON(executable, arguments_, options) {
  return parseJSONDocument(
    await execText(executable, arguments_, options),
    `${basename(executable)} ${arguments_.join(" ")} output`,
  );
}

async function assertExecutable(path, label) {
  const canonical = await realpath(path);
  const info = await stat(canonical);
  await access(canonical, fsConstants.X_OK);
  if (!info.isFile() || (info.mode & 0o111) === 0) {
    throw new Error(`${label} must be an executable regular file`);
  }
  return canonical;
}

function assertOwnedRegistrationReadback(marketplaceReadback, pluginReadback, {
  marketplaceRoot,
  pluginRoot,
  version,
}) {
  if (!isPlainObject(marketplaceReadback) || !isPlainObject(pluginReadback)) {
    throw new Error("native Codex registry readback must use the official closed object shape");
  }
  requireExactKeys(marketplaceReadback, ["marketplaces"], "native marketplace readback");
  requireExactKeys(pluginReadback, ["installed", "available"], "native plugin readback");
  const marketplaces = marketplaceReadback?.marketplaces;
  const installed = pluginReadback?.installed;
  const available = pluginReadback?.available;
  if (!Array.isArray(marketplaces) || !Array.isArray(installed) || !Array.isArray(available)) {
    throw new Error("native Codex setup readback is not the official closed JSON shape");
  }
  if (marketplaces.length !== 1 || installed.length !== 1 || available.length !== 0) {
    throw new Error(
      "native Codex registry cardinality requires exactly one marketplace, exactly one installed plugin, and zero available plugins",
    );
  }
  const marketplace = marketplaces[0];
  requireExactKeys(marketplace, ["marketplaceSource", "name", "root"], "native marketplace identity");
  if (!isPlainObject(marketplace.marketplaceSource)) {
    throw new Error("native Codex marketplace identity lacks its local source");
  }
  requireExactKeys(
    marketplace.marketplaceSource,
    ["source", "sourceType"],
    "native marketplace source identity",
  );
  if (
    marketplace.name !== "dev-flow-local"
    || marketplace.root !== marketplaceRoot
    || marketplace.marketplaceSource.sourceType !== "local"
    || marketplace.marketplaceSource.source !== marketplaceRoot
  ) {
    throw new Error("native Codex registry readback contains an unexpected marketplace identity");
  }
  const plugin = installed[0];
  requireExactKeys(plugin, [
    "authPolicy",
    "enabled",
    "installPolicy",
    "installed",
    "marketplaceName",
    "marketplaceSource",
    "name",
    "pluginId",
    "source",
    "version",
  ], "native installed plugin identity");
  if (!isPlainObject(plugin.source) || !isPlainObject(plugin.marketplaceSource)) {
    throw new Error("native Codex installed plugin identity lacks its local sources");
  }
  requireExactKeys(plugin.source, ["path", "source"], "native installed plugin source");
  requireExactKeys(
    plugin.marketplaceSource,
    ["source", "sourceType"],
    "native installed plugin marketplace source",
  );
  if (
    plugin.pluginId !== "dev-flow-codex@dev-flow-local"
    || plugin.name !== "dev-flow-codex"
    || plugin.marketplaceName !== "dev-flow-local"
    || plugin.version !== version
    || plugin.installed !== true
    || plugin.enabled !== true
    || plugin.source.source !== "local"
    || plugin.source.path !== pluginRoot
    || plugin.marketplaceSource.sourceType !== "local"
    || plugin.marketplaceSource.source !== marketplaceRoot
    || plugin.installPolicy !== "AVAILABLE"
    || plugin.authPolicy !== "ON_INSTALL"
  ) {
    throw new Error("native Codex registry readback contains an unexpected installed plugin identity");
  }
  return {
    marketplaces_total: marketplaces.length,
    installed_total: installed.length,
    available_total: available.length,
    marketplace_name: marketplace.name,
    plugin_id: plugin.pluginId,
    plugin_version: plugin.version,
  };
}

function assertRegistrationAbsentReadback(marketplaceReadback, pluginReadback) {
  const marketplaces = marketplaceReadback?.marketplaces;
  const installed = pluginReadback?.installed;
  const available = pluginReadback?.available;
  if (!Array.isArray(marketplaces) || !Array.isArray(installed) || !Array.isArray(available)) {
    throw new Error("native Codex removal readback is not the official closed JSON shape");
  }
  if (
    marketplaces.some((entry) => entry?.name === "dev-flow-local")
    || installed.some((entry) => entry?.pluginId === "dev-flow-codex@dev-flow-local")
  ) {
    throw new Error("native Codex removal readback still contains the owned registration");
  }
}

async function gitChangedPaths(repositoryPath) {
  const stdout = await execText(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repositoryPath, env: process.env },
  );
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

async function directoryDigest(root, { excludeGit = false } = {}) {
  const entries = await walkDirectory(root, { excludeGit, includeModes: true });
  return sha256(entries.map((entry) => `${entry.type}:${entry.path}:${entry.mode}:${entry.sha256}\n`).join(""));
}

async function directoryManifest(root) {
  const entries = await walkDirectory(root, { excludeGit: false, includeModes: false });
  const files = entries.map(({ path, sha256: digest }) => ({ path, sha256: digest }));
  if (files.length === 0) throw new Error("retained Core task-data directory is empty");
  return {
    files,
    sha256: sha256(files.map((entry) => `${entry.sha256}  ${entry.path}\n`).join("")),
  };
}

async function walkDirectory(root, { excludeGit, includeModes }) {
  const result = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      if (excludeGit && prefix === "" && entry.name === ".git") continue;
      const absolute = join(directory, entry.name);
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const info = await lstat(absolute);
      if (entry.isDirectory()) {
        if (includeModes) {
          result.push({ type: "directory", path, mode: info.mode & 0o777, sha256: sha256("") });
        }
        await visit(absolute, path);
      } else if (entry.isSymbolicLink()) {
        throw new Error(`native observation directory contains unsupported symbolic link ${path}`);
      } else if (entry.isFile()) {
        result.push({
          type: "file",
          path,
          mode: includeModes ? info.mode & 0o777 : 0,
          sha256: sha256(await readFile(absolute)),
        });
      } else {
        throw new Error(`native observation directory contains unsupported entry ${path}`);
      }
    }
  }
  await visit(root);
  return result;
}

export async function directCoreTaskReopen({
  runtimePath,
  dataDirectory,
  repositoryPath,
  environment,
  taskId,
}) {
  const outputLimitBytes = 1024 * 1024;
  const child = spawn(runtimePath, ["mcp", "--stdio"], {
    cwd: repositoryPath,
    env: { ...environment, DEV_FLOW_DATA_DIR: dataDirectory },
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });
  let stderr = "";
  let stderrBytes = 0;
  let stdoutBytes = 0;
  let nextID = 1;
  let protocolError = null;
  let exited = false;
  const pending = new Map();
  const completedResponseIDs = new Set();
  let resolveProtocolFailure;
  const protocolFailure = new Promise((resolveFailure) => {
    resolveProtocolFailure = resolveFailure;
  });
  const failProtocol = (error) => {
    if (protocolError) return;
    protocolError = error;
    for (const { timer, reject } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
    resolveProtocolFailure(error);
    if (!exited) child.kill("SIGTERM");
  };
  child.stdout.on("data", (chunk) => {
    stdoutBytes += Buffer.byteLength(chunk);
    if (stdoutBytes > outputLimitBytes) {
      failProtocol(new Error("direct packaged Core stdout exceeded the bounded output limit"));
    }
  });
  child.stderr.on("data", (chunk) => {
    stderrBytes += Buffer.byteLength(chunk);
    if (stderrBytes > outputLimitBytes) {
      failProtocol(new Error("direct packaged Core stderr exceeded the bounded output limit"));
      return;
    }
    stderr += chunk.toString("utf8");
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (protocolError) return;
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      failProtocol(new Error("direct packaged Core emitted non-JSON protocol contamination"));
      return;
    }
    if (!isPlainObject(response) || response.jsonrpc !== "2.0" || !Object.hasOwn(response, "id")) {
      failProtocol(new Error("direct packaged Core emitted a response with an unknown response ID"));
      return;
    }
    if (completedResponseIDs.has(response.id)) {
      failProtocol(new Error(`direct packaged Core emitted duplicate response ID ${response.id}`));
      return;
    }
    const request = pending.get(response.id);
    if (!request) {
      failProtocol(new Error(`direct packaged Core emitted unknown response ID ${response.id}`));
      return;
    }
    clearTimeout(request.timer);
    pending.delete(response.id);
    completedResponseIDs.add(response.id);
    request.resolve(response);
  });
  const exitPromise = new Promise((resolveExit) => child.once("close", (code, signal) => {
    exited = true;
    if (pending.size !== 0 && !protocolError) {
      failProtocol(new Error("direct packaged Core closed with a pending response ID"));
    }
    resolveExit({ code, signal });
  }));
  child.once("error", (error) => {
    failProtocol(new Error(`direct packaged Core failed to start: ${error.message}`));
  });
  const request = (method, params) => new Promise((resolveRequest, rejectRequest) => {
    if (protocolError) {
      rejectRequest(protocolError);
      return;
    }
    const id = nextID;
    nextID += 1;
    const timer = setTimeout(() => {
      pending.delete(id);
      rejectRequest(new Error(`packaged Core request timed out: ${method}`));
    }, 10_000);
    pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      (error) => {
        if (error) failProtocol(new Error(`direct packaged Core stdin write failed: ${error.message}`));
      },
    );
  });
  const callTool = async (name, arguments_) => {
    const response = await request("tools/call", { name, arguments: arguments_ });
    if (response.error) throw new Error(`packaged Core tool ${name} failed: ${response.error.message}`);
    const result = response.result;
    if (!isPlainObject(result?.structuredContent)) {
      throw new Error(`packaged Core tool ${name} returned no complete structured result`);
    }
    const textBlocks = Array.isArray(result.content)
      ? result.content.filter((block) => block?.type === "text" && typeof block.text === "string")
      : [];
    if (textBlocks.length !== 1 || !deepEqualJSON(JSON.parse(textBlocks[0].text), result.structuredContent)) {
      throw new Error(`packaged Core tool ${name} text and structured results differ`);
    }
    return result.structuredContent;
  };
  try {
    const initialized = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-native-retention", version: "0.1.0" },
    });
    if (initialized.result?.serverInfo?.name !== "dev-flow") {
      throw new Error("direct packaged Core returned an unexpected server identity");
    }
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    await callTool("dev_flow_server_info", {});
    const envelope = await callTool("dev_flow_get_task", { host: "codex", task_id: taskId });
    child.stdin.end();
    let stopTimer;
    let exit;
    try {
      exit = await Promise.race([
        exitPromise,
        protocolFailure.then((error) => Promise.reject(error)),
        new Promise((_, reject) => {
          stopTimer = setTimeout(
            () => reject(new Error("packaged Core did not stop after EOF")),
            10_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(stopTimer);
    }
    if (protocolError) throw protocolError;
    if (exit.code !== 0 || exit.signal !== null) {
      throw new Error(`packaged Core exited ${exit.code ?? exit.signal}: ${stderr.trim().slice(0, 4000)}`);
    }
    return envelope.result?.task;
  } catch (error) {
    if (!exited) child.kill("SIGTERM");
    let killTimer;
    try {
      await Promise.race([
        exitPromise,
        new Promise((resolveWait) => {
          killTimer = setTimeout(resolveWait, 1_000);
        }),
      ]);
    } finally {
      clearTimeout(killTimer);
    }
    throw protocolError ?? error;
  } finally {
    for (const { timer } of pending.values()) {
      clearTimeout(timer);
    }
    pending.clear();
    lines.close();
  }
}

function sessionFact(session) {
  return {
    thread_id: session.threadId,
    ignored_preview_count: session.ignoredPreviewCount,
    ignored_prose_count: session.ignoredProseCount,
    calls: session.devFlowCalls.map((call) => {
      const task = taskProjectionFromCall(call);
      return {
        tool: call.tool,
        arguments_sha256: sha256(jsonBytes(call.arguments)),
        result_sha256: sha256(jsonBytes(call.result)),
        task_id: task?.task_id ?? null,
        revision: task?.revision ?? null,
        outcome: task?.outcome?.status ?? null,
      };
    }),
  };
}

function nativeVerificationProjection(summary) {
  const automatedCheck = (check) => ({
    name: check.name,
    command_count: check.commandCount,
    full_suite: check.fullSuite,
  });
  return {
    budget: structuredClone(summary.budget),
    session_command_facts: summary.sessionCommandFacts.map((fact) => ({
      session_role: fact.sessionRole,
      event_index: fact.eventIndex,
      event_type: fact.eventType,
      item_id_sha256: fact.itemIdSha256,
      command_sha256: fact.commandSha256,
      output_sha256: fact.outputSha256,
      status: fact.status,
      exit_code: fact.exitCode,
      classification: fact.classification,
    })),
    command_executions: summary.commandExecutions.map((execution) => ({
      session_role: execution.sessionRole,
      event_index: execution.eventIndex,
      item_id_sha256: execution.itemIdSha256,
      logical_proof_name: execution.logicalProofName,
      rendered_command_sha256: execution.renderedCommandSha256,
      exit_code: execution.exitCode,
      status: execution.status,
      output_sha256: execution.outputSha256,
      full_suite: execution.fullSuite,
    })),
    submitted_automated_checks: summary.submittedAutomatedChecks.map(automatedCheck),
    retained_automated_checks: summary.retainedAutomatedChecks.map(automatedCheck),
  };
}

async function captureCodexJSONL(executable, arguments_, { cwd, env, stopAfterFirstApply }) {
  return new Promise((resolveCapture, rejectCapture) => {
    const child = spawn(executable, arguments_, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let stopObserved = false;
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      settle(new Error("native Codex exec session exceeded the bounded timeout"));
    }, 20 * 60 * 1000);
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) rejectCapture(error);
      else resolveCapture(stdout);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > 64 * 1024 * 1024) {
        child.kill("SIGTERM");
        settle(new Error("native Codex exec JSONL exceeded the bounded output limit"));
        return;
      }
      lineBuffer += chunk;
      const lines = lineBuffer.split(/\r?\n/u);
      lineBuffer = lines.pop() ?? "";
      if (!stopAfterFirstApply || stopObserved) return;
      for (const line of lines) {
        if (isCompletedDevFlowApply(line)) {
          stopObserved = true;
          child.kill("SIGTERM");
          break;
        }
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => settle(new Error(`native Codex exec failed to start: ${error.message}`)));
    child.once("close", (code, signal) => {
      if (settled) return;
      if (stopAfterFirstApply && !stopObserved) {
        settle(new Error(`substantive Codex session ended before the first Core action commit (${code ?? signal})`));
      } else if (!stopAfterFirstApply && (code !== 0 || signal !== null)) {
        settle(new Error(`native Codex exec exited ${code ?? signal}: ${stderr.trim().slice(0, 4000)}`));
      } else {
        settle();
      }
    });
  });
}

function isCompletedDevFlowApply(line) {
  try {
    const event = JSON.parse(line);
    return event?.type === "item.completed"
      && event.item?.type === "mcp_tool_call"
      && event.item?.server === "dev-flow"
      && event.item?.tool === "dev_flow_apply_action"
      && event.item?.status === "completed"
      && event.item?.error === null;
  } catch {
    return false;
  }
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function inspectNativeAdmission({ ledgerPath, evidencePath, identity } = {}) {
  if (!isAbsolutePath(evidencePath)) throw new Error("native evidence path must be absolute");
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);

  const evidenceText = await readOptional(evidencePath);
  if (evidenceText !== null) {
    let evidence;
    try {
      evidence = JSON.parse(evidenceText);
    } catch {
      return { allowed: false, reason: "pre-existing-evidence", recoveryRequired: true };
    }
    if (
      evidence?.status === "pass"
      && evidence?.native_attempt?.ledger_id === ledgerIdentity.ledgerId
    ) {
      return { allowed: false, reason: "passing-evidence-lock", recoveryRequired: true };
    }
    return { allowed: false, reason: "pre-existing-evidence", recoveryRequired: true };
  }

  const ledger = await readLedger(ledgerIdentity.path, ledgerIdentity.ledgerId);
  if (ledger.attempts.some((attempt) => attempt.status === "pass")) {
    return { allowed: false, reason: "passing-attempt-lock", recoveryRequired: false };
  }
  if (ledger.attempts.some((attempt) => attempt.status === "reserved")) {
    return { allowed: false, reason: "unresolved-reservation", recoveryRequired: true };
  }
  if (identity) {
    const chainId = deriveChainId(identity);
    if (ledger.attempts.some((attempt) => attempt.chain_id === chainId)) {
      return { allowed: false, reason: "chain-already-consumed", recoveryRequired: false };
    }
    if (ledger.attempts.some((attempt) => attempt.source_commit === identity.source_commit)) {
      return { allowed: false, reason: "source-already-consumed", recoveryRequired: false };
    }
  }
  return { allowed: true, reason: "admitted", recoveryRequired: false };
}

export async function reserveNativeAttempt({
  ledgerPath,
  evidencePath,
  evidencePathIdentity,
  identity,
  reservedAt,
  beforeLockedRead,
} = {}) {
  validateIdentity(identity);
  requireTimestamp(reservedAt, "reservedAt");
  if (beforeLockedRead !== undefined && typeof beforeLockedRead !== "function") {
    throw new TypeError("beforeLockedRead must be a function when supplied");
  }
  if (evidencePathIdentity !== undefined && evidencePathIdentity.evidencePath !== evidencePath) {
    throw new Error("canonical evidence path identity does not match the reservation path");
  }
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  const expectedLedgerBytes = await readFile(ledgerIdentity.path, "utf8");
  parseLedger(expectedLedgerBytes, ledgerIdentity.ledgerId);

  return withLedgerMutationLock({
    ledgerIdentity,
    operation: "reserve",
    expectedLedgerBytes,
    beforeLockedRead,
  }, async ({ ledger, replaceLedger }) => {
    const inspectAdmission = () => inspectNativeAdmission({ ledgerPath, evidencePath, identity });
    const decision = evidencePathIdentity === undefined
      ? await inspectAdmission()
      : await withCanonicalEvidencePathRead(evidencePathIdentity, inspectAdmission);
    if (!decision.allowed) {
      throw new Error(
        decision.reason === "unresolved-reservation"
          ? "native launch is blocked by an unresolved reservation"
          : `native chain is already consumed: ${decision.reason}`,
      );
    }

    const chainId = deriveChainId(identity);
    const attemptNumber = ledger.attempts.length + 1;
    ledger.attempts.push({
      attempt_number: attemptNumber,
      chain_id: chainId,
      source_commit: identity.source_commit,
      validation_report_sha256: identity.validation_report_sha256,
      artifact_report_sha256: identity.artifact_report_sha256,
      artifact_sha256: identity.artifact_sha256,
      reserved_at: reservedAt,
      status: "reserved",
    });
    const reservedLedgerBytes = jsonBytes(ledger);
    if (evidencePathIdentity !== undefined) {
      await revalidateCanonicalEvidencePathIdentity(evidencePathIdentity, "absent");
    }
    await replaceLedger(reservedLedgerBytes);
    return {
      ledgerPath: ledgerIdentity.path,
      ledgerId: ledgerIdentity.ledgerId,
      chainId,
      attemptNumber,
      identity: { ...identity },
      reservedAt,
      reservedLedgerBytes,
    };
  });
}

export function preparePassingAttempt({
  reservation,
  observedFacts,
  completedAt,
  evidence,
} = {}) {
  requireReservation(reservation);
  requireTimestamp(completedAt, "completedAt");
  if (!isPlainObject(observedFacts)) throw new Error("observedFacts must be an object");
  if (!isPlainObject(evidence) || evidence.status !== "pass") {
    throw new Error("passing evidence base must be an object with status=pass");
  }

  const reservedLedger = parseLedger(reservation.reservedLedgerBytes, reservation.ledgerId);
  const entry = reservedLedger.attempts.at(-1);
  if (
    entry?.status !== "reserved"
    || entry.chain_id !== reservation.chainId
    || entry.attempt_number !== reservation.attemptNumber
  ) {
    throw new Error("reservation does not identify the final reserved ledger entry");
  }

  const observedFactsBytes = jsonBytes(observedFacts);
  const observedFactsSha256 = sha256(observedFactsBytes);
  const finalLedger = structuredClone(reservedLedger);
  finalLedger.attempts[finalLedger.attempts.length - 1] = {
    ...entry,
    completed_at: completedAt,
    status: "pass",
    observed_facts_sha256: observedFactsSha256,
  };
  const finalLedgerBytes = jsonBytes(finalLedger);
  const evidenceDocument = {
    ...evidence,
    native_attempt: {
      chain_id: reservation.chainId,
      ledger_id: reservation.ledgerId,
      attempt_number: reservation.attemptNumber,
      total_attempts: finalLedger.attempts.length,
      ledger_sha256: sha256(finalLedgerBytes),
      commit_protocol: "evidence-create-before-ledger-finalize-v1",
      observed_facts_sha256: observedFactsSha256,
    },
  };
  const evidenceBytes = jsonBytes(evidenceDocument);
  return {
    observedFactsBytes,
    observedFactsSha256,
    finalLedgerBytes,
    finalLedgerSha256: sha256(finalLedgerBytes),
    evidenceBytes,
  };
}

export async function commitPassingAttempt({
  ledgerPath,
  evidencePath,
  evidencePathIdentity,
  recoveryDirectory,
  reservation,
  prepared,
  validateCandidates,
  beforePublish,
  onStage,
} = {}) {
  requireReservation(reservation);
  requirePrepared(prepared);
  if (typeof validateCandidates !== "function") {
    throw new Error("complete candidate validation is required before evidence publication");
  }
  if (!isAbsolutePath(evidencePath) || !isAbsolutePath(recoveryDirectory)) {
    throw new Error("evidence and recovery paths must be absolute");
  }
  if (evidencePathIdentity?.evidencePath !== evidencePath) {
    throw new Error("canonical evidence path identity is required for pass commit");
  }
  await revalidateCanonicalEvidencePathIdentity(evidencePathIdentity, "absent");
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  if (ledgerIdentity.path !== reservation.ledgerPath || ledgerIdentity.ledgerId !== reservation.ledgerId) {
    throw new Error("reservation ledger identity does not match the supplied durable ledger path");
  }
  const initialLedgerBytes = await readFile(ledgerIdentity.path, "utf8");
  parseLedger(initialLedgerBytes, ledgerIdentity.ledgerId);
  if (initialLedgerBytes !== reservation.reservedLedgerBytes) {
    throw new Error("reserved ledger bytes changed before pass commit");
  }

  await mkdir(recoveryDirectory, { recursive: true, mode: 0o700 });
  await Promise.all([
    writeExclusiveDurable(join(recoveryDirectory, recoveryFiles.observedFacts), prepared.observedFactsBytes, 0o600),
    writeExclusiveDurable(join(recoveryDirectory, recoveryFiles.reservedLedger), reservation.reservedLedgerBytes, 0o600),
    writeExclusiveDurable(join(recoveryDirectory, recoveryFiles.finalLedger), prepared.finalLedgerBytes, 0o600),
    writeExclusiveDurable(join(recoveryDirectory, recoveryFiles.evidence), prepared.evidenceBytes, 0o600),
  ]);
  await fsyncDirectory(recoveryDirectory);

  const validationResult = await validateCandidates({
    evidenceBytes: prepared.evidenceBytes,
    finalLedgerBytes: prepared.finalLedgerBytes,
    observedFactsBytes: prepared.observedFactsBytes,
    reservedLedgerBytes: reservation.reservedLedgerBytes,
  });
  if (validationResult?.valid !== true) {
    const details = [...(validationResult?.structuralErrors ?? []), ...(validationResult?.semanticErrors ?? [])];
    throw new Error(`candidate validation failed${details.length ? `: ${details.join("; ")}` : ": validator did not return valid=true"}`);
  }
  let publishedEvidenceIdentity;
  await withLedgerMutationLock({
    ledgerIdentity,
    operation: "finalize-pass",
    expectedLedgerBytes: reservation.reservedLedgerBytes,
  }, async ({ replaceLedger }) => {
    if (beforePublish) await beforePublish();
    await revalidateCanonicalEvidencePathIdentity(evidencePathIdentity, "absent");
    await atomicCreateNoReplaceDurable(evidencePath, prepared.evidenceBytes, 0o644);
    publishedEvidenceIdentity = await revalidateCanonicalEvidencePathIdentity(
      evidencePathIdentity,
      "regular",
    );
    if (onStage) {
      try {
        await onStage("evidence-published");
      } finally {
        await revalidateCanonicalEvidencePathIdentity(publishedEvidenceIdentity);
      }
    }
    await replaceLedger(prepared.finalLedgerBytes);
    if (onStage) {
      try {
        await onStage("ledger-finalized");
      } finally {
        await revalidateCanonicalEvidencePathIdentity(publishedEvidenceIdentity);
      }
    }
  });
  await revalidateCanonicalEvidencePathIdentity(publishedEvidenceIdentity);
  await assertAuthoritativeBytes({ ledgerPath: ledgerIdentity.path, evidencePath, prepared });
  return { status: "committed" };
}

export async function recoverPassingAttempt({
  ledgerPath,
  evidencePath,
  evidencePathIdentity,
  recoveryDirectory,
} = {}) {
  if (!isAbsolutePath(evidencePath) || !isAbsolutePath(recoveryDirectory)) {
    throw new Error("evidence and recovery paths must be absolute");
  }
  if (
    evidencePathIdentity?.evidencePath !== evidencePath
    || evidencePathIdentity?.leaf?.state !== "regular"
  ) {
    throw new Error("canonical regular evidence path identity is required for pass recovery");
  }
  return withCanonicalEvidencePathRead(evidencePathIdentity, async () => {
    const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
    const [observedFactsBytes, reservedLedgerBytes, finalLedgerBytes, evidenceBytes] = await Promise.all([
      readFile(join(recoveryDirectory, recoveryFiles.observedFacts), "utf8"),
      readFile(join(recoveryDirectory, recoveryFiles.reservedLedger), "utf8"),
      readFile(join(recoveryDirectory, recoveryFiles.finalLedger), "utf8"),
      readFile(join(recoveryDirectory, recoveryFiles.evidence), "utf8"),
    ]);
    parseLedger(reservedLedgerBytes, ledgerIdentity.ledgerId);
    parseLedger(finalLedgerBytes, ledgerIdentity.ledgerId);
    const prepared = { observedFactsBytes, reservedLedgerBytes, finalLedgerBytes, evidenceBytes };
    const publishedEvidence = await readFile(evidencePath, "utf8");
    if (publishedEvidence !== evidenceBytes) {
      throw new Error("published passing evidence does not equal the durable candidate bytes");
    }

    const currentLedger = await readFile(ledgerIdentity.path, "utf8");
    parseLedger(currentLedger, ledgerIdentity.ledgerId);
    if (currentLedger === finalLedgerBytes) {
      await assertAuthoritativeBytes({ ledgerPath: ledgerIdentity.path, evidencePath, prepared });
      return { status: "already-finalized" };
    }
    if (currentLedger !== reservedLedgerBytes) {
      throw new Error("ledger is neither the durable reserved nor final candidate");
    }
    await revalidateCanonicalEvidencePathIdentity(evidencePathIdentity);
    await withLedgerMutationLock({
      ledgerIdentity,
      operation: "finalize-pass",
      expectedLedgerBytes: reservedLedgerBytes,
    }, async ({ replaceLedger }) => replaceLedger(finalLedgerBytes));
    await assertAuthoritativeBytes({ ledgerPath: ledgerIdentity.path, evidencePath, prepared });
    return { status: "recovered-ledger-finalize" };
  });
}

export async function writeFailureDiagnostic({
  outputPath,
  canonicalEvidencePath,
  recoveryDirectory,
  diagnostic,
} = {}) {
  if (![outputPath, canonicalEvidencePath, recoveryDirectory].every(isAbsolutePath)) {
    throw new Error("failure diagnostic paths must be absolute");
  }
  if (resolve(outputPath) === resolve(canonicalEvidencePath)) {
    throw new Error("canonical native evidence is pass-only and cannot contain a failure diagnostic");
  }
  if (dirname(resolve(outputPath)) !== resolve(recoveryDirectory)) {
    throw new Error("failure diagnostic must stay directly inside the external recovery directory");
  }
  if (
    !isPlainObject(diagnostic)
    || !["failed", "blocked"].includes(diagnostic.status)
    || diagnostic.schema_version !== 2
    || diagnostic.native_attempt?.commit_protocol !== "external-failure-record-v2"
  ) {
    throw new Error("failure diagnostic must be an honest failed/blocked external record");
  }
  const schemas = await loadContractSchemas();
  const structuralErrors = validateDocumentStructure(diagnostic, schemas.nativeAttemptDiagnostic);
  if (structuralErrors.length !== 0) {
    throw new Error(`native attempt diagnostic schema validation failed: ${structuralErrors.join("; ")}`);
  }
  await mkdir(recoveryDirectory, { recursive: true, mode: 0o700 });
  await writeExclusiveDurable(outputPath, jsonBytes(diagnostic), 0o600);
  return { outputPath };
}

export async function finalizeFailedAttempt({
  ledgerPath,
  evidencePath,
  evidencePathIdentity,
  recoveryDirectory,
  reservation,
  status,
  completedAt,
  observedFacts,
  diagnosticBase,
} = {}) {
  requireReservation(reservation);
  if (!["failed", "blocked"].includes(status)) throw new Error("failed attempt status must be failed or blocked");
  requireTimestamp(completedAt, "completedAt");
  if (!isPlainObject(observedFacts) || !isPlainObject(diagnosticBase)) {
    throw new Error("failure finalization requires observed facts and a diagnostic base");
  }
  if (evidencePathIdentity !== undefined && evidencePathIdentity.evidencePath !== evidencePath) {
    throw new Error("canonical evidence path identity does not match failure finalization");
  }
  const existingEvidence = evidencePathIdentity === undefined
    ? await readOptional(evidencePath)
    : await withCanonicalEvidencePathRead(
      evidencePathIdentity,
      () => readOptional(evidencePath),
    );
  if (existingEvidence !== null) {
    throw new Error("passing evidence exists; failure finalization cannot replace the pass lock");
  }
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  if (ledgerIdentity.path !== reservation.ledgerPath || ledgerIdentity.ledgerId !== reservation.ledgerId) {
    throw new Error("failure reservation does not match the durable ledger identity");
  }
  const observedFactsBytes = jsonBytes(observedFacts);
  const observedFactsSha256 = sha256(observedFactsBytes);
  return withLedgerMutationLock({
    ledgerIdentity,
    operation: "finalize-failure",
    expectedLedgerBytes: reservation.reservedLedgerBytes,
  }, async ({ ledger, replaceLedger }) => {
    const entry = ledger.attempts.at(-1);
    if (entry?.chain_id !== reservation.chainId || entry.status !== "reserved") {
      throw new Error("failure finalization requires the matching unresolved reservation");
    }
    ledger.attempts[ledger.attempts.length - 1] = {
      ...entry,
      completed_at: completedAt,
      status,
      observed_facts_sha256: observedFactsSha256,
    };
    const finalLedgerBytes = jsonBytes(ledger);
    const diagnostic = {
      ...diagnosticBase,
      status,
      native_attempt: {
        chain_id: reservation.chainId,
        ledger_id: reservation.ledgerId,
        attempt_number: reservation.attemptNumber,
        total_attempts: ledger.attempts.length,
        ledger_sha256: sha256(finalLedgerBytes),
        commit_protocol: "external-failure-record-v2",
        observed_facts_sha256: observedFactsSha256,
      },
    };
    await mkdir(recoveryDirectory, { recursive: true, mode: 0o700 });
    await Promise.all([
      writeExclusiveDurable(join(recoveryDirectory, "failure-observed-facts.json"), observedFactsBytes, 0o600),
      writeExclusiveDurable(join(recoveryDirectory, "failure-ledger-candidate.json"), finalLedgerBytes, 0o600),
    ]);
    const diagnosticPath = join(recoveryDirectory, `${status}.json`);
    await writeFailureDiagnostic({ outputPath: diagnosticPath, canonicalEvidencePath: evidencePath, recoveryDirectory, diagnostic });
    if (evidencePathIdentity !== undefined) {
      await revalidateCanonicalEvidencePathIdentity(evidencePathIdentity, "absent");
    }
    await replaceLedger(finalLedgerBytes);
    return { status, diagnosticPath, finalLedgerBytes };
  });
}

async function resolveLedgerIdentity(ledgerPath) {
  if (!isAbsolutePath(ledgerPath)) throw new Error("attempt ledger path must be absolute");
  const normalized = resolve(ledgerPath);
  if (normalized !== ledgerPath) throw new Error("attempt ledger path must be canonical");
  const parent = dirname(normalized);
  const canonicalParent = await realpath(parent);
  if (canonicalParent !== parent) throw new Error("attempt ledger parent must be canonical");
  try {
    const info = await lstat(normalized);
    if (info.isSymbolicLink()) throw new Error("attempt ledger leaf must not be a symlink");
    if (!info.isFile()) throw new Error("attempt ledger must be a regular file");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return {
    path: normalized,
    ledgerId: sha256(`${ledgerDomain}${normalized}\n`),
  };
}

async function readLedger(path, expectedLedgerId) {
  return parseLedger(await readFile(path, "utf8"), expectedLedgerId);
}

function parseLedger(text, expectedLedgerId) {
  let ledger;
  try {
    ledger = JSON.parse(text);
  } catch (error) {
    throw new Error(`attempt ledger must contain JSON: ${error.message}`);
  }
  const structuralErrors = validateDocumentStructure(ledger, nativeAttemptLedgerSchema);
  if (structuralErrors.length !== 0) {
    throw new Error(`attempt ledger schema validation failed: ${structuralErrors.join("; ")}`);
  }
  if (ledger.ledger_id !== expectedLedgerId) {
    throw new Error("attempt ledger identity does not match its durable path");
  }
  const semanticErrors = validateAttemptLedgerSemantics(ledger);
  if (semanticErrors.length !== 0) {
    throw new Error(`attempt ledger semantic validation failed: ${semanticErrors.join("; ")}`);
  }
  return ledger;
}

function parseJSONDocument(text, label) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} must contain JSON: ${error.message}`);
  }
  if (!isPlainObject(value)) throw new Error(`${label} must be a closed object`);
  return value;
}

function requireExactKeys(value, keys, label) {
  if (!equalArrays(Object.keys(value).sort(), [...keys].sort())) {
    throw new Error(`${label} must contain every required closed field and no extra field`);
  }
}

async function loadContractSchemas() {
  const entries = await Promise.all(
    Object.entries(contractSchemaPaths).map(async ([name, path]) => [
      name,
      name === "nativeAttemptLedger"
        ? nativeAttemptLedgerSchema
        : JSON.parse(await readFile(path, "utf8")),
    ]),
  );
  return Object.fromEntries(entries);
}

async function assertCleanSource(reader, sourceRoot, sourceCommit) {
  const identity = await reader(sourceRoot);
  if (!isPlainObject(identity) || identity.commit !== sourceCommit || identity.dirty !== false) {
    throw new Error("validation command changed or did not match the clean frozen source identity");
  }
}

async function defaultReadSourceIdentity(sourceRoot) {
  const [{ stdout: commit }, { stdout: status }] = await Promise.all([
    execFile("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }),
    execFile("git", ["-C", sourceRoot, "status", "--porcelain"], { encoding: "utf8" }),
  ]);
  return { commit: commit.trim(), dirty: status.length !== 0 };
}

async function defaultQueryLatestCodex() {
  const { stdout } = await execFile(
    "npm",
    ["view", "@openai/codex", "dist-tags.latest", "--json"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    value = stdout.trim();
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("official @openai/codex latest dist-tag query returned no exact version");
  }
  return value;
}

async function defaultRunCommand(command, { cwd }) {
  await execFile("/bin/sh", ["-c", command], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function withLedgerMutationLock({
  ledgerIdentity,
  operation,
  expectedLedgerBytes,
  beforeLockedRead,
}, callback) {
  if (!isPlainObject(ledgerIdentity) || typeof expectedLedgerBytes !== "string") {
    throw new Error("attempt ledger mutation lock requires a durable identity and expected bytes");
  }
  if (!["reserve", "finalize-pass", "finalize-failure"].includes(operation)) {
    throw new Error("attempt ledger mutation lock operation is unsupported");
  }
  if (beforeLockedRead !== undefined && typeof beforeLockedRead !== "function") {
    throw new TypeError("attempt ledger beforeLockedRead hook must be a function");
  }
  const lockPath = `${ledgerIdentity.path}.lock`;
  const lockDocument = {
    schema_version: 1,
    ledger_id: ledgerIdentity.ledgerId,
    owner_token: randomBytes(32).toString("hex"),
    pid: process.pid,
    created_at: new Date().toISOString(),
    operation,
    expected_ledger_sha256: sha256(expectedLedgerBytes),
  };
  const lockBytes = jsonBytes(lockDocument);
  await acquireLedgerLock(lockPath, lockBytes, ledgerIdentity);
  try {
    if (beforeLockedRead) await beforeLockedRead({ lockPath, lockDocument: structuredClone(lockDocument) });
    const lockedLedgerBytes = await readFile(ledgerIdentity.path, "utf8");
    const ledger = parseLedger(lockedLedgerBytes, ledgerIdentity.ledgerId);
    if (lockedLedgerBytes !== expectedLedgerBytes) {
      throw new Error("attempt ledger changed before locked CAS mutation");
    }
    let replaced = false;
    const replaceLedger = async (nextLedgerBytes) => {
      if (replaced) throw new Error("attempt ledger CAS replacement may occur only once per owner lock");
      parseLedger(nextLedgerBytes, ledgerIdentity.ledgerId);
      const currentLedgerBytes = await readFile(ledgerIdentity.path, "utf8");
      parseLedger(currentLedgerBytes, ledgerIdentity.ledgerId);
      if (currentLedgerBytes !== expectedLedgerBytes) {
        throw new Error("attempt ledger changed in the locked CAS window");
      }
      await atomicReplaceDurable(ledgerIdentity.path, nextLedgerBytes, 0o600);
      replaced = true;
    };
    return await callback({ ledger, ledgerBytes: lockedLedgerBytes, replaceLedger, lockDocument });
  } finally {
    await releaseOwnedLedgerLock(lockPath, lockBytes);
  }
}

async function acquireLedgerLock(lockPath, lockBytes, ledgerIdentity) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeExclusiveDurable(lockPath, lockBytes, 0o600);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt > 0) throw new Error("attempt ledger is locked by another owner");
      await recoverDefinitelyDeadLedgerLock(lockPath, ledgerIdentity);
    }
  }
}

async function recoverDefinitelyDeadLedgerLock(lockPath, ledgerIdentity) {
  let lockBytes;
  let lock;
  try {
    lockBytes = await readFile(lockPath, "utf8");
    lock = JSON.parse(lockBytes);
  } catch {
    throw new Error("attempt ledger lock is malformed and cannot be recovered");
  }
  const expectedKeys = [
    "created_at",
    "expected_ledger_sha256",
    "ledger_id",
    "operation",
    "owner_token",
    "pid",
    "schema_version",
  ];
  if (
    !isPlainObject(lock)
    || !equalArrays(Object.keys(lock).sort(), expectedKeys)
    || lock.schema_version !== 1
    || lock.ledger_id !== ledgerIdentity.ledgerId
    || !hex(lock.owner_token, 64)
    || !Number.isInteger(lock.pid)
    || lock.pid <= 0
    || !["reserve", "finalize-pass", "finalize-failure"].includes(lock.operation)
    || !hex(lock.expected_ledger_sha256, 64)
    || !Number.isFinite(Date.parse(lock.created_at))
  ) {
    throw new Error("attempt ledger lock is malformed or belongs to another ledger");
  }
  try {
    process.kill(lock.pid, 0);
    throw new Error("attempt ledger is locked by a live owner");
  } catch (error) {
    if (error?.message === "attempt ledger is locked by a live owner") throw error;
    if (error?.code !== "ESRCH") {
      throw new Error("attempt ledger is locked by a live or permission-ambiguous owner");
    }
  }
  if (await readFile(lockPath, "utf8") !== lockBytes) {
    throw new Error("attempt ledger lock ownership changed during stale recovery");
  }
  await unlink(lockPath);
  await fsyncDirectory(dirname(lockPath));
}

async function releaseOwnedLedgerLock(lockPath, lockBytes) {
  let current;
  try {
    current = await readFile(lockPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("attempt ledger owner lock disappeared before release");
    throw error;
  }
  if (current !== lockBytes) throw new Error("attempt ledger owner lock changed before release");
  await unlink(lockPath);
  await fsyncDirectory(dirname(lockPath));
}

async function writeExclusiveDurable(path, bytes, mode) {
  const handle = await open(path, "wx", mode);
  try {
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsyncDirectory(dirname(path));
}

async function atomicReplaceDurable(path, bytes, mode) {
  const temporary = temporaryPath(path);
  await writeExclusiveDurable(temporary, bytes, mode);
  try {
    await rename(temporary, path);
    await fsyncDirectory(dirname(path));
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

async function atomicCreateNoReplaceDurable(path, bytes, mode) {
  const temporary = temporaryPath(path);
  await writeExclusiveDurable(temporary, bytes, mode);
  try {
    await link(temporary, path);
    await fsyncDirectory(dirname(path));
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("canonical native evidence already exists");
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

async function fsyncDirectory(path) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertAuthoritativeBytes({ ledgerPath, evidencePath, prepared }) {
  const ledgerIdentity = await resolveLedgerIdentity(ledgerPath);
  const [ledgerBytes, evidenceBytes] = await Promise.all([
    readFile(ledgerPath, "utf8"),
    readFile(evidencePath, "utf8"),
  ]);
  parseLedger(ledgerBytes, ledgerIdentity.ledgerId);
  if (ledgerBytes !== prepared.finalLedgerBytes || evidenceBytes !== prepared.evidenceBytes) {
    throw new Error("authoritative evidence or ledger bytes changed after pass commit");
  }
}

function requireReservation(reservation) {
  if (
    !isPlainObject(reservation)
    || !isAbsolutePath(reservation.ledgerPath)
    || !hex(reservation.ledgerId, 64)
    || !hex(reservation.chainId, 64)
    || !Number.isInteger(reservation.attemptNumber)
    || typeof reservation.reservedLedgerBytes !== "string"
  ) {
    throw new Error("invalid native attempt reservation");
  }
}

function requirePrepared(prepared) {
  if (
    !isPlainObject(prepared)
    || typeof prepared.observedFactsBytes !== "string"
    || typeof prepared.finalLedgerBytes !== "string"
    || typeof prepared.evidenceBytes !== "string"
  ) {
    throw new Error("invalid prepared passing candidates");
  }
}

function validateIdentity(identity) {
  if (!isPlainObject(identity) || !hex(identity.source_commit, 40)) {
    throw new Error("native identity source_commit must be a 40-character lowercase hex digest");
  }
  for (const field of ["validation_report_sha256", "artifact_report_sha256", "artifact_sha256"]) {
    if (!hex(identity[field], 64)) throw new Error(`native identity ${field} must be a SHA-256 digest`);
  }
  const allowed = [
    "artifact_report_sha256",
    "artifact_sha256",
    "source_commit",
    "validation_report_sha256",
  ];
  if (!equalArrays(Object.keys(identity).sort(), allowed)) {
    throw new Error("native chain identity must contain exactly four frozen fields");
  }
}

function requireTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an RFC 3339 timestamp`);
  }
}

function jsonBytes(value) {
  return `${JSON.stringify(sortValue(value))}\n`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
      .map((key) => [key, sortValue(value[key])]),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hex(value, length) {
  return typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAbsolutePath(value) {
  return typeof value === "string" && isAbsolute(value);
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function deepEqualJSON(left, right) {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function strictlyIncreasing(values) {
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}

function temporaryPath(path) {
  return join(dirname(path), `.${fileURLToPath(import.meta.url).split("/").at(-1)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function main(argv) {
  if (argv[0] === "init-ledger" && argv.length === 3 && argv[1] === "--output") {
    const result = await initializeAttemptLedger(argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (argv[0] === "native-preflight" && argv.length === 9) {
    const flags = Object.fromEntries([
      [argv[1], argv[2]],
      [argv[3], argv[4]],
      [argv[5], argv[6]],
      [argv[7], argv[8]],
    ]);
    const expected = ["--artifact-report", "--attempt-ledger", "--codex-executable", "--validation-report"];
    if (!equalArrays(Object.keys(flags).sort(), expected) || Object.keys(flags).length !== 4) {
      throw new Error("native-preflight requires exactly four final input flags");
    }
    const result = await preflightNativeInputs({
      validationReportPath: flags["--validation-report"],
      artifactReportPath: flags["--artifact-report"],
      codexExecutable: flags["--codex-executable"],
      ledgerPath: flags["--attempt-ledger"],
    });
    process.stdout.write(`${JSON.stringify({ status: "preflight-passed", ledger_id: result.ledgerId })}\n`);
    return;
  }
  if (argv[0] === "native-journey" && argv.length === 9) {
    const flags = Object.fromEntries([
      [argv[1], argv[2]],
      [argv[3], argv[4]],
      [argv[5], argv[6]],
      [argv[7], argv[8]],
    ]);
    const expected = ["--artifact-report", "--attempt-ledger", "--codex-executable", "--validation-report"];
    if (!equalArrays(Object.keys(flags).sort(), expected) || Object.keys(flags).length !== 4) {
      throw new Error("native-journey requires exactly four final input flags");
    }
    const result = await executeNativeJourney({
      validationReportPath: flags["--validation-report"],
      artifactReportPath: flags["--artifact-report"],
      codexExecutable: flags["--codex-executable"],
      ledgerPath: flags["--attempt-ledger"],
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (argv[0] === "validation-report" && argv.length === 7) {
    const flags = Object.fromEntries([
      [argv[1], argv[2]],
      [argv[3], argv[4]],
      [argv[5], argv[6]],
    ]);
    const expected = ["--attempt-ledger", "--output", "--source-commit"];
    if (!equalArrays(Object.keys(flags).sort(), expected) || Object.keys(flags).length !== 3) {
      throw new Error("validation-report requires exactly output, ledger, and source commit flags");
    }
    const result = await createValidationReport({
      outputPath: flags["--output"],
      ledgerPath: flags["--attempt-ledger"],
      sourceCommit: flags["--source-commit"],
    });
    process.stdout.write(`${JSON.stringify({ status: "valid", output_path: result.outputPath })}\n`);
    return;
  }
  throw new Error(
    "usage: write-codex-journey-evidence.mjs init-ledger --output ABSOLUTE_PATH | validation-report --output FILE --attempt-ledger FILE --source-commit SHA | native-preflight|native-journey --validation-report FILE --artifact-report FILE --codex-executable FILE --attempt-ledger FILE",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`write-codex-journey-evidence: ${error.message}\n`);
    process.exitCode = 1;
  });
}
