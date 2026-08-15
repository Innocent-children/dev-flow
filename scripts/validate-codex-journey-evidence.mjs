#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { versionSatisfiesRange } from "../packages/codex/lib/lifecycle.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = dirname(dirname(scriptPath));
const contractsRoot = join(repositoryRoot, "specs", "003-codex-explicit-dev-flow", "contracts");
const canonicalEvidencePath = join(
  repositoryRoot,
  "tests",
  "journeys",
  "evidence",
  "codex-macos-arm64.json",
);

export const EXPECTED_TARGETED_COMMANDS = Object.freeze([
  "go test ./internal/version ./tests/contract",
  "node --test packages/codex/tests/*.test.mjs",
]);
export const EXPECTED_ROOT_VALIDATION_COMMAND = "pnpm run validate";
export const PASS_COMMIT_PROTOCOL = "evidence-create-before-ledger-finalize-v1";
export const FAILURE_COMMIT_PROTOCOL = "external-failure-record-v1";

const defaultSchemaPaths = Object.freeze({
  "validation-report": join(contractsRoot, "validation-report.schema.json"),
  "artifact-report": join(contractsRoot, "artifact-report.schema.json"),
  "native-attempt-ledger": join(contractsRoot, "native-attempt-ledger.schema.json"),
  "journey-evidence": join(contractsRoot, "journey-evidence.schema.json"),
});

export function validateDocumentStructure(document, schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("document schema must be an object");
  }
  return validateSchemaValue(document, schema, schema, "$", []);
}

export function validateEvidenceStructure(evidence, schema) {
  return validateDocumentStructure(evidence, schema);
}

export function deriveAttemptLedgerId(canonicalAbsolutePath) {
  if (typeof canonicalAbsolutePath !== "string" || !isAbsolute(canonicalAbsolutePath)) {
    throw new TypeError("attempt ledger path must be absolute");
  }
  const canonical = normalize(canonicalAbsolutePath);
  if (canonical !== canonicalAbsolutePath) {
    throw new TypeError("attempt ledger path must already be canonical");
  }
  return sha256(`dev-flow-codex-native-ledger-v1\n${canonical}\n`);
}

export const deriveLedgerId = deriveAttemptLedgerId;

export function deriveNativeChainId({
  source_commit,
  validation_report_sha256,
  artifact_report_sha256,
  artifact_sha256,
}) {
  return sha256(JSON.stringify({
    artifact_report_sha256,
    artifact_sha256,
    source_commit,
    validation_report_sha256,
  }));
}

export function validateEvidenceSemantics(evidence, options = {}) {
  if (!isObject(evidence)) return ["evidence must be an object"];

  const errors = [];
  const versions = evidence.versions ?? {};
  const identity = evidence.identity ?? {};
  const validation = evidence.validation ?? {};
  const nativeAttempt = evidence.native_attempt ?? {};
  const journey = evidence.journey ?? {};
  const lineage = journey.task_lineage ?? {};
  const invocation = journey.invocation ?? {};
  const lifecycle = journey.lifecycle ?? {};
  const repository = journey.repository ?? {};
  const taskData = journey.task_data ?? {};

  validateVersionIdentity(versions, options.rootVersion, errors);

  const hasBoundInputs = options.validationReport
    || options.artifactReport
    || options.attemptLedger
    || options.validationReportText
    || options.artifactReportText
    || options.attemptLedgerText;
  if (hasBoundInputs || options.requireBoundInputs) {
    validateBoundInputs(evidence, options, errors);
  }

  if (options.evidencePath && options.canonicalEvidencePath) {
    const evidencePath = normalizeAbsolutePath(options.evidencePath);
    const canonicalPath = normalizeAbsolutePath(options.canonicalEvidencePath);
    if (evidencePath === canonicalPath && evidence.status !== "pass") {
      errors.push("canonical evidence path is pass-only; failed/blocked diagnostics must remain external");
    }
  }

  if (evidence.status !== "pass") return errors;

  const threadIDs = Array.isArray(lineage.thread_ids) ? lineage.thread_ids : [];
  if (
    threadIDs.length !== 4
    || threadIDs.some((threadID) => typeof threadID !== "string" || threadID.length === 0)
    || new Set(threadIDs).size !== 4
  ) {
    errors.push("exactly four nonempty, pairwise-distinct Codex thread IDs are required");
  }

  const rawRevisions = Array.isArray(lineage.raw_revisions) ? lineage.raw_revisions : [];
  if (!nondecreasingIntegers(rawRevisions)) {
    errors.push("raw task revisions must never regress across the restart boundary");
  }
  const revisions = Array.isArray(lineage.revisions) ? lineage.revisions : [];
  if (!strictlyIncreasing(revisions)) {
    errors.push("task revisions must be strictly increasing");
  }
  if (!deepEqual(revisions, adjacentDeduplicate(rawRevisions))) {
    errors.push("task revisions must equal the strictly increasing adjacent-deduplicated raw lineage");
  }

  const actions = Array.isArray(lineage.committed_actions) ? lineage.committed_actions : [];
  if (actions.length < 2) {
    errors.push("at least two committed Core actions are required");
  }
  const revisionSet = new Set(revisions);
  if (actions.some((action) => !revisionSet.has(action?.revision))) {
    errors.push("every committed-action revision must appear in the task lineage");
  }
  const actionIDs = actions.map((action) => action?.action_id);
  if (new Set(actionIDs).size !== actionIDs.length) {
    errors.push("committed actions must have unique action IDs");
  }
  if (lineage.task_id_before_restart !== lineage.task_id_after_restart) {
    errors.push("restart/resume must preserve the same task ID");
  }
  if (
    !Number.isInteger(invocation.core_call_count)
    || !Number.isInteger(invocation.scenario_call_budget)
    || invocation.core_call_count > invocation.scenario_call_budget
  ) {
    errors.push("Core call count must remain within the scenario call budget");
  }
  if (lineage.terminal_outcome !== "DONE") {
    errors.push("terminal outcome must be exactly DONE");
  }
  if (lineage.terminal_phase !== "DONE") {
    errors.push("terminal phase must be exactly DONE");
  }

  if (!equalStringArrays(
    invocation.restart_recovery_reads,
    ["dev_flow_get_task", "dev_flow_get_next_action"],
  )) {
    errors.push("restart recovery reads must be dev_flow_get_task then dev_flow_get_next_action");
  }
  if (!Number.isInteger(invocation.read_before_retry_observations) || invocation.read_before_retry_observations < 2) {
    errors.push("restart recovery must record both read-before-retry observations");
  }
  validateVerificationSemantics(invocation, errors);

  if (!equalStringArrays(taskData.files_before_removal, taskData.files_after_removal)) {
    errors.push("task-data file lists must be equal before and after removal");
  }
  if (taskData.manifest_before_removal_sha256 !== taskData.manifest_after_removal_sha256) {
    errors.push("task-data manifest digests must be equal before and after removal");
  }
  if (repository.digest_after_completion !== repository.digest_after_removal) {
    errors.push("repository digest after completion must equal repository digest after removal");
  }
  if (!Array.isArray(repository.unexpected_changed_paths) || repository.unexpected_changed_paths.length !== 0) {
    errors.push("unexpected changed paths must be empty");
  }

  for (const field of [
    "setup_readback_passed",
    "restart_resume_passed",
    "remove_readback_passed",
    "task_data_retained",
    "task_reopened_after_removal",
    "compatible_reinstall_passed",
  ]) {
    if (lifecycle[field] !== true) errors.push(`lifecycle.${field} must be true`);
  }
  validateRegistryReadback(lifecycle.setup_registry, "setup registry", versions.package, errors);
  validateRegistryReadback(lifecycle.reinstall_registry, "reinstall registry", versions.package, errors);
  validateRetainedDataDescriptor(taskData.retained_data_location, errors);

  if (!Array.isArray(evidence.failures) || evidence.failures.length !== 0) {
    errors.push("passing evidence failures must be empty");
  }
  if (!Array.isArray(evidence.skips) || evidence.skips.length !== 0) {
    errors.push("passing evidence skips must be empty");
  }
  if (nativeAttempt.commit_protocol !== PASS_COMMIT_PROTOCOL) {
    errors.push(`passing evidence commit protocol must be ${PASS_COMMIT_PROTOCOL}`);
  }

  return errors;
}

export function validateEvidenceCandidate({
  evidenceText,
  validationReportText,
  artifactReportText,
  attemptLedgerText,
  observedFactsText,
  artifactSha256,
  artifactPath,
  attemptLedgerPath,
  evidencePath,
  canonicalEvidencePath: expectedCanonicalEvidencePath = canonicalEvidencePath,
  rootVersion,
  schemas,
} = {}) {
  const structuralErrors = [];
  const documents = {
    "validation-report": parseDocument(validationReportText, "validation report", structuralErrors),
    "artifact-report": parseDocument(artifactReportText, "artifact report", structuralErrors),
    "native-attempt-ledger": parseDocument(attemptLedgerText, "native attempt ledger", structuralErrors),
    "journey-evidence": parseDocument(evidenceText, "journey evidence", structuralErrors),
  };
  const observedFacts = parseDocument(observedFactsText, "observed facts", structuralErrors);

  const normalizedSchemas = normalizeSchemas(schemas);
  for (const [name, document] of Object.entries(documents)) {
    const schema = normalizedSchemas[name];
    if (!schema) {
      structuralErrors.push(`${name} schema is required`);
      continue;
    }
    if (document !== undefined) {
      structuralErrors.push(
        ...validateDocumentStructure(document, schema).map((message) => `${name}: ${message}`),
      );
    }
  }

  const evidence = documents["journey-evidence"];
  const semanticErrors = evidence === undefined
    ? []
    : validateEvidenceSemantics(evidence, {
      rootVersion,
      validationReport: documents["validation-report"],
      validationReportText,
      artifactReport: documents["artifact-report"],
      artifactReportText,
      attemptLedger: documents["native-attempt-ledger"],
      attemptLedgerText,
      observedFacts,
      observedFactsText,
      artifactSha256,
      artifactPath,
      attemptLedgerPath,
      evidencePath,
      canonicalEvidencePath: expectedCanonicalEvidencePath,
      requireBoundInputs: true,
    });

  return {
    valid: structuralErrors.length === 0 && semanticErrors.length === 0,
    structuralErrors,
    semanticErrors,
  };
}

export function validatePublishedEvidence({
  evidenceText,
  expectedEvidenceText,
  attemptLedgerText,
  expectedAttemptLedgerText,
  attemptLedgerPath,
  expectedLedgerId,
} = {}) {
  const errors = [];
  if (typeof evidenceText !== "string" || typeof expectedEvidenceText !== "string") {
    errors.push("published evidence bytes and expected evidence bytes are required");
  } else if (evidenceText !== expectedEvidenceText) {
    errors.push("published evidence bytes do not equal the prevalidated candidate bytes");
  }
  if (typeof attemptLedgerText !== "string" || typeof expectedAttemptLedgerText !== "string") {
    errors.push("published ledger bytes and expected ledger bytes are required");
  } else if (attemptLedgerText !== expectedAttemptLedgerText) {
    errors.push("published ledger bytes do not equal the prevalidated candidate bytes");
  }

  let pathLedgerId;
  try {
    pathLedgerId = deriveAttemptLedgerId(attemptLedgerPath);
  } catch (error) {
    errors.push(`ledger path identity is invalid: ${error.message}`);
  }
  if (pathLedgerId && pathLedgerId !== expectedLedgerId) {
    errors.push("ledger path identity does not equal the prevalidated ledger ID");
  }

  for (const [label, text] of [["published evidence", evidenceText], ["published ledger", attemptLedgerText]]) {
    if (typeof text !== "string") continue;
    try {
      const document = JSON.parse(text);
      if (label === "published evidence" && document.native_attempt?.ledger_id !== expectedLedgerId) {
        errors.push("published evidence ledger identity does not equal the prevalidated ledger ID");
      }
      if (label === "published ledger" && document.ledger_id !== expectedLedgerId) {
        errors.push("published ledger identity does not equal the prevalidated ledger ID");
      }
    } catch (error) {
      errors.push(`${label} is not valid JSON: ${error.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidence(evidence, { schema, rootVersion, ...options } = {}) {
  const structuralErrors = validateEvidenceStructure(evidence, schema);
  const semanticErrors = validateEvidenceSemantics(evidence, { rootVersion, ...options });
  return {
    valid: structuralErrors.length === 0 && semanticErrors.length === 0,
    structuralErrors,
    semanticErrors,
  };
}

export async function validateEvidenceFile(
  evidencePath,
  {
    schemaPath = defaultSchemaPaths["journey-evidence"],
    versionPath = join(repositoryRoot, "VERSION"),
    validationReportPath,
    artifactReportPath,
    attemptLedgerPath,
    observedFactsPath,
    canonicalEvidencePath: expectedCanonicalEvidencePath = canonicalEvidencePath,
    schemas,
  } = {},
) {
  if (!validationReportPath && !artifactReportPath && !attemptLedgerPath) {
    const [evidenceText, schemaText, rootVersionText] = await Promise.all([
      readFile(evidencePath, "utf8"),
      readFile(schemaPath, "utf8"),
      readFile(versionPath, "utf8"),
    ]);
    return validateEvidence(JSON.parse(evidenceText), {
      schema: JSON.parse(schemaText),
      rootVersion: rootVersionText.trim(),
    });
  }
  if (!validationReportPath || !artifactReportPath || !attemptLedgerPath) {
    throw new Error("validation, artifact, and attempt-ledger reports must be supplied together");
  }

  const [
    evidenceText,
    validationReportText,
    artifactReportText,
    attemptLedgerText,
    rootVersionText,
    loadedSchemas,
  ] = await Promise.all([
    readFile(evidencePath, "utf8"),
    readFile(validationReportPath, "utf8"),
    readFile(artifactReportPath, "utf8"),
    readFile(attemptLedgerPath, "utf8"),
    readFile(versionPath, "utf8"),
    schemas ? Promise.resolve(schemas) : loadDefaultSchemas(),
  ]);
  const preliminaryErrors = [];
  const preliminaryDocuments = {
    "validation-report": parseDocument(validationReportText, "validation report", preliminaryErrors),
    "artifact-report": parseDocument(artifactReportText, "artifact report", preliminaryErrors),
    "native-attempt-ledger": parseDocument(attemptLedgerText, "native attempt ledger", preliminaryErrors),
    "journey-evidence": parseDocument(evidenceText, "journey evidence", preliminaryErrors),
  };
  const normalizedSchemas = normalizeSchemas(loadedSchemas);
  for (const [name, document] of Object.entries(preliminaryDocuments)) {
    if (!normalizedSchemas[name]) {
      preliminaryErrors.push(`${name} schema is required`);
    } else if (document !== undefined) {
      preliminaryErrors.push(
        ...validateDocumentStructure(document, normalizedSchemas[name]).map((message) => `${name}: ${message}`),
      );
    }
  }
  if (preliminaryErrors.length > 0) {
    return { valid: false, structuralErrors: preliminaryErrors, semanticErrors: [] };
  }

  const evidence = preliminaryDocuments["journey-evidence"];
  const artifactReport = preliminaryDocuments["artifact-report"];
  const durableFactsPath = observedFactsPath ?? join(
    `${attemptLedgerPath}.recovery`,
    evidence.native_attempt?.chain_id ?? "missing-chain-id",
    "observed-facts.json",
  );
  const [artifactBytes, observedFactsText] = await Promise.all([
    readFile(artifactReport.artifact_path),
    readFile(durableFactsPath, "utf8"),
  ]);
  return validateEvidenceCandidate({
    evidenceText,
    validationReportText,
    artifactReportText,
    attemptLedgerText,
    observedFactsText,
    artifactSha256: sha256(artifactBytes),
    artifactPath: artifactReport.artifact_path,
    attemptLedgerPath,
    evidencePath,
    canonicalEvidencePath: expectedCanonicalEvidencePath,
    rootVersion: rootVersionText.trim(),
    schemas: loadedSchemas,
  });
}

function validateVersionIdentity(versions, rootVersion, errors) {
  if (versions.package !== versions.core) {
    errors.push("package/Core versions must be equal");
  }
  if (typeof rootVersion !== "string" || rootVersion.length === 0) {
    errors.push("repository VERSION is required for semantic validation");
  } else if (versions.package !== rootVersion || versions.core !== rootVersion) {
    errors.push("package and Core versions must equal repository VERSION");
  }

  try {
    if (!versionSatisfiesRange(versions.codex, versions.codex_compatibility)) {
      errors.push("Codex version must satisfy the recorded Codex compatibility range");
    }
  } catch (error) {
    errors.push(`Codex compatibility range is invalid: ${error.message}`);
  }
}

function validateBoundInputs(evidence, options, errors) {
  const validationReport = options.validationReport;
  const artifactReport = options.artifactReport;
  const attemptLedger = options.attemptLedger;
  const validation = evidence.validation ?? {};
  const identity = evidence.identity ?? {};
  const nativeAttempt = evidence.native_attempt ?? {};
  const versions = evidence.versions ?? {};

  for (const [label, value] of [
    ["validation report", validationReport],
    ["artifact report", artifactReport],
    ["native attempt ledger", attemptLedger],
  ]) {
    if (!isObject(value)) errors.push(`${label} is required for candidate semantic validation`);
  }
  if (!isObject(validationReport) || !isObject(artifactReport) || !isObject(attemptLedger)) return;

  const validationReportDigest = digestText(options.validationReportText, "validation report", errors);
  const artifactReportDigest = digestText(options.artifactReportText, "artifact report", errors);
  const attemptLedgerDigest = digestText(options.attemptLedgerText, "attempt ledger", errors);
  const observedFactsDigest = digestText(options.observedFactsText, "observed facts", errors);

  if (validationReportDigest && validation.report_sha256 !== validationReportDigest) {
    errors.push("validation report exact-byte digest must equal evidence.validation.report_sha256");
  }
  if (artifactReportDigest && identity.artifact_report_sha256 !== artifactReportDigest) {
    errors.push("artifact report exact-byte digest must equal evidence.identity.artifact_report_sha256");
  }
  if (attemptLedgerDigest && nativeAttempt.ledger_sha256 !== attemptLedgerDigest) {
    errors.push("attempt ledger exact-byte digest must equal evidence.native_attempt.ledger_sha256");
  }
  if (observedFactsDigest && nativeAttempt.observed_facts_sha256 !== observedFactsDigest) {
    errors.push("observed facts exact-byte digest must equal evidence.native_attempt.observed_facts_sha256");
  }

  if (validationReport.source_commit !== identity.source_commit) {
    errors.push("validation report source commit must equal evidence source commit");
  }
  if (artifactReport.source_commit !== identity.source_commit) {
    errors.push("artifact report source commit must equal evidence source commit");
  }
  if (validationReport.source_dirty !== false || artifactReport.source_dirty !== false) {
    errors.push("validation and artifact reports must bind a clean source");
  }

  for (const [label, observation] of [
    ...asArray(validationReport.targeted_checks).map((value, index) => [`targeted check ${index + 1}`, value]),
    ["root validation", validationReport.root_validation],
  ]) {
    if (observation?.source_commit !== identity.source_commit) {
      errors.push(`${label} source commit must equal evidence source commit`);
    }
    if (observation?.result !== "pass") {
      errors.push(`${label} must record pass`);
    }
  }

  if (!equalStringArrays(
    asArray(validationReport.targeted_checks).map((entry) => entry?.command),
    EXPECTED_TARGETED_COMMANDS,
  )) {
    errors.push(`validation report must contain the exact ordered targeted commands: ${EXPECTED_TARGETED_COMMANDS.join(" then ")}`);
  }
  if (validationReport.root_validation?.command !== EXPECTED_ROOT_VALIDATION_COMMAND) {
    errors.push(`root validation command must be exactly ${EXPECTED_ROOT_VALIDATION_COMMAND}`);
  }

  if (validation.completed_at !== validationReport.completed_at) {
    errors.push("validation completed_at projection must exactly equal the validation report");
  }
  if (!deepEqual(validation.targeted_checks, validationReport.targeted_checks)) {
    errors.push("targeted-check projection must exactly equal validation report observations");
  }
  if (!deepEqual(validation.root_validation, validationReport.root_validation)) {
    errors.push("root-validation projection must exactly equal the validation report observation");
  }

  const revalidation = validationReport.codex_revalidation ?? {};
  if (revalidation.resolved_version !== versions.codex) {
    errors.push("writer-resolved Codex version must equal the evidence Codex version");
  }
  if (
    revalidation.compatible_range !== versions.codex_compatibility
    || revalidation.compatible_range !== artifactReport.codex_compatibility
  ) {
    errors.push("writer compatibility range must equal evidence and artifact report compatibility ranges");
  }
  try {
    if (!versionSatisfiesRange(revalidation.resolved_version, revalidation.compatible_range)) {
      errors.push("writer-resolved Codex version must satisfy the writer compatibility range");
    }
  } catch (error) {
    errors.push(`writer compatibility range is invalid: ${error.message}`);
  }

  const queryTime = timestampValue(revalidation.queried_at);
  const targetedCompletions = [];
  for (const observation of asArray(validationReport.targeted_checks)) {
    const completion = timestampValue(observation?.completed_at);
    targetedCompletions.push(completion);
    if (queryTime !== undefined && completion !== undefined && queryTime > completion) {
      errors.push("compatibility query must precede every targeted check completion");
    }
    validateCommandCompletionBeforeReport("targeted check", completion, validationReport.completed_at, errors);
  }
  if (targetedCompletions.some((completion, index) => (
    index > 0
    && completion !== undefined
    && targetedCompletions[index - 1] !== undefined
    && completion < targetedCompletions[index - 1]
  ))) {
    errors.push("targeted command completion order must match the exact targeted command order");
  }
  const rootCompletion = timestampValue(validationReport.root_validation?.completed_at);
  if (queryTime !== undefined && rootCompletion !== undefined && queryTime > rootCompletion) {
    errors.push("compatibility query must precede root validation completion");
  }
  validateCommandCompletionBeforeReport("root validation", rootCompletion, validationReport.completed_at, errors);
  const finalTargetedCompletion = targetedCompletions.at(-1);
  if (
    rootCompletion !== undefined
    && finalTargetedCompletion !== undefined
    && rootCompletion < finalTargetedCompletion
  ) {
    errors.push("root validation must complete after the exact targeted command set");
  }

  const validationCompletion = timestampValue(validationReport.completed_at);
  const artifactBuild = timestampValue(artifactReport.built_at);
  const evidenceRecording = timestampValue(evidence.recorded_at);
  if (validationCompletion !== undefined && artifactBuild !== undefined && validationCompletion > artifactBuild) {
    errors.push("validation completion must not follow artifact build");
  }
  if (artifactBuild !== undefined && evidenceRecording !== undefined && artifactBuild >= evidenceRecording) {
    errors.push("artifact build must strictly precede evidence recording");
  }
  if (identity.artifact_built_at !== artifactReport.built_at) {
    errors.push("artifact built_at identity must exactly equal the artifact report");
  }

  if (artifactReport.package_version !== versions.package || artifactReport.core_version !== versions.core) {
    errors.push("artifact report package/Core versions must equal evidence versions");
  }
  if (artifactReport.artifact_sha256 !== identity.artifact_sha256) {
    errors.push("artifact report SHA-256 must equal evidence artifact SHA-256");
  }
  if (typeof options.artifactSha256 !== "string" || options.artifactSha256 !== artifactReport.artifact_sha256) {
    errors.push("actual artifact SHA-256 must equal the artifact report and evidence");
  }
  if (typeof options.artifactPath !== "string" || options.artifactPath !== artifactReport.artifact_path) {
    errors.push("artifact path identity must equal the closed artifact report");
  }

  validateLedger(evidence, {
    validationReport,
    artifactReport,
    attemptLedger,
    validationReportDigest,
    artifactReportDigest,
    observedFactsDigest,
    attemptLedgerPath: options.attemptLedgerPath,
  }, errors);
  validateObservedFacts(evidence, options.observedFacts, errors);
}

export function validateAttemptLedgerSemantics(ledger) {
  if (!isObject(ledger)) return ["native attempt ledger must be an object"];
  if (!Array.isArray(ledger.attempts)) return ["native attempt ledger attempts must be an array"];

  const errors = [];
  const attempts = ledger.attempts;
  if (!attempts.every((entry, index) => entry?.attempt_number === index + 1)) {
    errors.push("ledger must contain sequential attempt numbers starting at one");
  }
  const chainIDs = attempts.map((entry) => entry?.chain_id);
  if (new Set(chainIDs).size !== chainIDs.length) {
    errors.push("ledger attempts must have unique chain IDs");
  }
  const sourceCommits = attempts.map((entry) => entry?.source_commit);
  if (new Set(sourceCommits).size !== sourceCommits.length) {
    errors.push("ledger attempts must have unique source commits");
  }

  for (const [index, entry] of attempts.entries()) {
    const label = `ledger attempt ${index + 1}`;
    if (!isObject(entry) || !["reserved", "pass", "failed", "blocked"].includes(entry.status)) {
      errors.push(`${label} must have a recognized status`);
      continue;
    }
    if (entry.status === "reserved") {
      if (Object.hasOwn(entry, "completed_at")) {
        errors.push("reserved attempt must not be finalized with completed_at");
      }
      if (Object.hasOwn(entry, "observed_facts_sha256")) {
        errors.push("reserved attempt must not have observed facts");
      }
    } else {
      if (!Object.hasOwn(entry, "completed_at")) {
        errors.push("finalized attempt requires completed_at");
      }
      if (!Object.hasOwn(entry, "observed_facts_sha256")) {
        errors.push("finalized attempt requires observed facts");
      }
    }
  }

  const passingIndexes = attempts
    .map((entry, index) => entry?.status === "pass" ? index : -1)
    .filter((index) => index >= 0);
  if (passingIndexes.length > 1) errors.push("ledger permits at most one passing attempt");
  if (passingIndexes.length === 1 && passingIndexes[0] !== attempts.length - 1) {
    errors.push("passing attempt must be final; no ledger entry may follow it");
  }
  const reservedIndexes = attempts
    .map((entry, index) => entry?.status === "reserved" ? index : -1)
    .filter((index) => index >= 0);
  if (reservedIndexes.length > 1) errors.push("ledger permits at most one reserved attempt");
  if (reservedIndexes.length === 1 && reservedIndexes[0] !== attempts.length - 1) {
    errors.push("reserved attempt must be final and unresolved before admission can continue");
  }
  return errors;
}

function validateLedger(evidence, context, errors) {
  const identity = evidence.identity ?? {};
  const nativeAttempt = evidence.native_attempt ?? {};
  const ledger = context.attemptLedger;
  const attempts = asArray(ledger.attempts);
  errors.push(...validateAttemptLedgerSemantics(ledger));

  let derivedLedgerId;
  try {
    derivedLedgerId = deriveAttemptLedgerId(context.attemptLedgerPath);
  } catch (error) {
    errors.push(`ledger path identity is invalid: ${error.message}`);
  }
  if (
    derivedLedgerId
    && (ledger.ledger_id !== derivedLedgerId
      || nativeAttempt.ledger_id !== derivedLedgerId
      || context.validationReport.attempt_ledger_id !== derivedLedgerId)
  ) {
    errors.push("ledger path identity must equal the validation report, ledger, and evidence ledger IDs");
  }

  if (nativeAttempt.total_attempts !== attempts.length) {
    errors.push("evidence total attempt count must equal the durable ledger attempt count");
  }
  const passingAttempts = attempts.filter((entry) => entry?.status === "pass");
  if (evidence.status === "pass" && passingAttempts.length !== 1) {
    errors.push("passing evidence requires exactly one passing attempt in the durable ledger");
  }
  if (evidence.status !== "pass" && passingAttempts.length !== 0) {
    errors.push("failed/blocked evidence cannot coexist with a passing ledger attempt");
  }

  const attemptIndex = Number.isInteger(nativeAttempt.attempt_number)
    ? nativeAttempt.attempt_number - 1
    : -1;
  const matchingAttempt = attempts[attemptIndex];
  if (!matchingAttempt) {
    errors.push("evidence attempt number must identify an existing ledger entry");
    return;
  }
  if (matchingAttempt.attempt_number !== nativeAttempt.attempt_number) {
    errors.push("evidence attempt number must equal the matching ledger entry");
  }
  if (matchingAttempt.status !== evidence.status) {
    errors.push("evidence status must equal the matching ledger attempt status");
  }

  const expectedChainID = deriveNativeChainId({
    source_commit: identity.source_commit,
    validation_report_sha256: context.validationReportDigest,
    artifact_report_sha256: context.artifactReportDigest,
    artifact_sha256: identity.artifact_sha256,
  });
  if (nativeAttempt.chain_id !== expectedChainID || matchingAttempt.chain_id !== expectedChainID) {
    errors.push("native chain ID derivation must bind the exact source, reports, and artifact");
  }

  for (const [field, expected] of [
    ["source_commit", identity.source_commit],
    ["validation_report_sha256", context.validationReportDigest],
    ["artifact_report_sha256", context.artifactReportDigest],
    ["artifact_sha256", identity.artifact_sha256],
  ]) {
    if (matchingAttempt[field] !== expected) {
      errors.push(`matching ledger attempt ${field} must equal the evidence chain identity`);
    }
  }

  if (
    matchingAttempt.observed_facts_sha256 !== nativeAttempt.observed_facts_sha256
    || matchingAttempt.observed_facts_sha256 !== context.observedFactsDigest
  ) {
    errors.push("observed facts digest must match the evidence, ledger, and exact durable facts bytes");
  }

  if (evidence.status === "pass") {
    if (nativeAttempt.commit_protocol !== PASS_COMMIT_PROTOCOL) {
      errors.push(`passing commit protocol must be exactly ${PASS_COMMIT_PROTOCOL}`);
    }
    if (passingAttempts[0] !== matchingAttempt) {
      errors.push("evidence must identify the ledger's single passing attempt");
    }
    if (attempts.indexOf(matchingAttempt) !== attempts.length - 1) {
      errors.push("no ledger attempt may follow the passing attempt");
    }
  } else if (nativeAttempt.commit_protocol !== FAILURE_COMMIT_PROTOCOL) {
    errors.push(`failed/blocked commit protocol must be exactly ${FAILURE_COMMIT_PROTOCOL}`);
  }
}

function validateVerificationSemantics(invocation, errors) {
  const budget = invocation.verification_budget;
  const commands = asArray(invocation.verification_commands);
  if (!isObject(budget)) {
    errors.push("complete Core verification budget is required");
    return;
  }

  const itemIDs = commands.map((command) => command?.item_id);
  if (new Set(itemIDs).size !== itemIDs.length) {
    errors.push("verification command executions must have unique item IDs");
  }
  for (const command of commands) {
    if (
      !isObject(command)
      || typeof command.command !== "string"
      || command.command.length === 0
      || command.exit_code !== 0
      || command.status !== "completed"
      || typeof command.output_sha256 !== "string"
      || typeof command.full_suite !== "boolean"
    ) {
      errors.push("every verification command execution must be completed successfully with a command and output digest");
    }
  }
  if (
    !Number.isInteger(invocation.submitted_automated_command_count)
    || !Number.isInteger(invocation.retained_automated_command_count)
    || invocation.submitted_automated_command_count !== commands.length
    || invocation.retained_automated_command_count !== commands.length
  ) {
    errors.push("verification command count must match actual, submitted, and retained automated evidence");
  }
  if (!Number.isInteger(budget.max_automatic_commands) || commands.length > budget.max_automatic_commands) {
    errors.push("verification commands must remain within the complete Core verification budget");
  }

  const actualFullSuite = commands.some((command) => command?.full_suite === true);
  if (
    invocation.submitted_full_suite !== actualFullSuite
    || invocation.retained_full_suite !== actualFullSuite
  ) {
    errors.push("full-suite classification must match actual, submitted, and retained automated evidence");
  }
  if (actualFullSuite && budget.allow_full_suite !== true) {
    errors.push("full-suite verification is forbidden by the complete Core verification budget");
  }
}

function validateRegistryReadback(registry, label, packageVersion, errors) {
  if (
    !isObject(registry)
    || registry.marketplaces_total !== 1
    || registry.installed_total !== 1
    || registry.available_total !== 0
    || registry.marketplace_name !== "dev-flow-local"
    || registry.plugin_id !== "dev-flow-codex@dev-flow-local"
    || registry.plugin_version !== packageVersion
  ) {
    errors.push(`${label} must contain exactly one owned marketplace, one installed owned plugin, zero available plugins, and the package version`);
  }
}

function validateRetainedDataDescriptor(descriptor, errors) {
  if (
    !isObject(descriptor)
    || !equalStringArrays(Object.keys(descriptor).sort(), [
      "canonical_path_sha256",
      "kind",
      "workspace_relative_path",
    ])
    || descriptor.kind !== "isolated-explicit-data-directory"
    || descriptor.workspace_relative_path !== "data"
    || typeof descriptor.canonical_path_sha256 !== "string"
    || !/^[0-9a-f]{64}$/u.test(descriptor.canonical_path_sha256)
  ) {
    errors.push("retained-data descriptor must be closed, non-secret, workspace-relative, and path-digest bound");
  }
}

function validateObservedFacts(evidence, observedFacts, errors) {
  if (!isObject(observedFacts)) {
    errors.push("durable observed facts must be a JSON object");
    return;
  }
  if (!deepEqual(observedFacts.journey, evidence.journey)) {
    errors.push("durable observed journey must exactly equal the evidence journey projection");
  }

  const lineage = evidence.journey?.task_lineage ?? {};
  const invocation = evidence.journey?.invocation ?? {};
  const roles = ["ordinary", "invalid", "substantive", "resume"];
  const observedThreadIDs = roles.map((role) => observedFacts.sessions?.[role]?.thread_id);
  if (
    observedThreadIDs.length !== 4
    || observedThreadIDs.some((threadID) => typeof threadID !== "string" || threadID.length === 0)
    || new Set(observedThreadIDs).size !== 4
    || !deepEqual(observedThreadIDs, lineage.thread_ids)
  ) {
    errors.push("durable facts must bind the same four nonempty, pairwise-distinct Codex thread IDs");
  }

  const observedRawRevisions = ["substantive", "resume"]
    .flatMap((role) => asArray(observedFacts.sessions?.[role]?.calls))
    .map((call) => call?.revision)
    .filter(Number.isInteger);
  if (!deepEqual(observedRawRevisions, lineage.raw_revisions)) {
    errors.push("raw task revision projection must exactly equal complete Core task observations before deduplication");
  }

  const resumeTools = asArray(observedFacts.sessions?.resume?.calls).map((call) => call?.tool);
  const firstMutation = resumeTools.indexOf("dev_flow_apply_action");
  const getTask = resumeTools.indexOf("dev_flow_get_task");
  const getNextAction = resumeTools.indexOf("dev_flow_get_next_action");
  if (
    firstMutation < 0
    || getTask < 0
    || getNextAction < 0
    || getTask >= getNextAction
    || getNextAction >= firstMutation
    || !equalStringArrays(invocation.restart_recovery_reads, [resumeTools[getTask], resumeTools[getNextAction]])
  ) {
    errors.push("restart recovery must record dev_flow_get_task then dev_flow_get_next_action before a later apply_action");
  }

  const verification = observedFacts.verification;
  if (!isObject(verification)) {
    errors.push("durable facts must contain complete Core verification observations");
  } else {
    if (!deepEqual(verification.budget, invocation.verification_budget)) {
      errors.push("verification budget projection must equal the complete Core-derived budget");
    }
    if (!deepEqual(verification.command_executions, invocation.verification_commands)) {
      errors.push("command execution projection must equal official completed command_execution facts");
    }
    validateAutomatedChecks(
      verification.submitted_automated_checks,
      invocation.verification_commands,
      "submitted automated checks",
      errors,
    );
    validateAutomatedChecks(
      verification.retained_automated_checks,
      invocation.verification_commands,
      "retained automated checks",
      errors,
    );
  }

  if (observedFacts.terminal_task?.phase !== "DONE") {
    errors.push("authoritative terminal task phase must be DONE");
  }
  if (observedFacts.terminal_task?.outcome?.status !== "completed") {
    errors.push("authoritative terminal task outcome must be completed");
  }
  if (!deepEqual(observedFacts.task_data, evidence.journey?.task_data)) {
    errors.push("retained-data descriptor and task-data projection must match durable observed facts");
  }
}

function validateAutomatedChecks(checks, commands, label, errors) {
  const normalizedChecks = asArray(checks);
  if (normalizedChecks.length !== asArray(commands).length) {
    errors.push(`${label} must map one-to-one to completed command executions`);
    return;
  }
  for (const [index, check] of normalizedChecks.entries()) {
    const command = commands[index];
    if (
      !isObject(check)
      || !equalStringArrays(Object.keys(check).sort(), ["command_count", "full_suite", "name"])
      || check.name !== command?.command
      || check.command_count !== 1
      || check.full_suite !== command?.full_suite
    ) {
      errors.push(`${label} must map one-to-one in order by name, command_count=1, and full_suite`);
      return;
    }
  }
}

function validatePublishedEvidenceIdentity({
  evidenceText,
  validationReportText,
  artifactReportText,
  attemptLedgerText,
  artifactSha256,
  artifactPath,
  attemptLedgerPath,
  evidencePath,
}) {
  const structuralErrors = [];
  const evidence = parseDocument(evidenceText, "journey evidence", structuralErrors);
  const validationReport = parseDocument(validationReportText, "validation report", structuralErrors);
  const artifactReport = parseDocument(artifactReportText, "artifact report", structuralErrors);
  const attemptLedger = parseDocument(attemptLedgerText, "native attempt ledger", structuralErrors);

  const semanticErrors = [];
  if (isObject(evidence) && isObject(validationReport) && isObject(artifactReport) && isObject(attemptLedger)) {
    const validationDigest = sha256(validationReportText);
    const artifactReportDigest = sha256(artifactReportText);
    const ledgerDigest = sha256(attemptLedgerText);
    if (evidence.validation?.report_sha256 !== validationDigest) {
      semanticErrors.push("published validation report bytes no longer match the evidence identity");
    }
    if (evidence.identity?.artifact_report_sha256 !== artifactReportDigest) {
      semanticErrors.push("published artifact report bytes no longer match the evidence identity");
    }
    if (evidence.native_attempt?.ledger_sha256 !== ledgerDigest) {
      semanticErrors.push("published attempt ledger bytes no longer match the evidence identity");
    }
    if (evidence.identity?.artifact_sha256 !== artifactSha256 || artifactReport.artifact_sha256 !== artifactSha256) {
      semanticErrors.push("published artifact bytes no longer match the artifact/evidence identity");
    }
    if (artifactReport.artifact_path !== artifactPath) {
      semanticErrors.push("published artifact path no longer matches its report identity");
    }
    if (
      validationReport.source_commit !== evidence.identity?.source_commit
      || artifactReport.source_commit !== evidence.identity?.source_commit
    ) {
      semanticErrors.push("published report source identities no longer match the evidence source identity");
    }
    if (
      artifactReport.built_at !== evidence.identity?.artifact_built_at
      || artifactReport.package_version !== evidence.versions?.package
      || artifactReport.core_version !== evidence.versions?.core
    ) {
      semanticErrors.push("published artifact report identity no longer matches the evidence identity");
    }
    let ledgerId;
    try {
      ledgerId = deriveAttemptLedgerId(attemptLedgerPath);
    } catch (error) {
      semanticErrors.push(`published ledger path identity is invalid: ${error.message}`);
    }
    if (
      ledgerId
      && (ledgerId !== attemptLedger.ledger_id
        || ledgerId !== validationReport.attempt_ledger_id
        || ledgerId !== evidence.native_attempt?.ledger_id)
    ) {
      semanticErrors.push("published ledger path identity no longer matches the bound ledger ID");
    }
    if (normalizeAbsolutePath(evidencePath) !== normalizeAbsolutePath(canonicalEvidencePath)) {
      semanticErrors.push("published evidence must be read from the canonical pass-only path");
    }
    if (evidence.status !== "pass") {
      semanticErrors.push("canonical published evidence status must remain pass");
    }
    const entry = asArray(attemptLedger.attempts)[(evidence.native_attempt?.attempt_number ?? 0) - 1];
    if (
      !entry
      || entry.status !== "pass"
      || entry.chain_id !== evidence.native_attempt?.chain_id
      || entry.source_commit !== evidence.identity?.source_commit
      || entry.validation_report_sha256 !== validationDigest
      || entry.artifact_report_sha256 !== artifactReportDigest
      || entry.artifact_sha256 !== artifactSha256
      || entry.observed_facts_sha256 !== evidence.native_attempt?.observed_facts_sha256
    ) {
      semanticErrors.push("published evidence identity no longer matches its passing ledger entry");
    }
  }

  return {
    valid: structuralErrors.length === 0 && semanticErrors.length === 0,
    structuralErrors,
    semanticErrors,
  };
}

function validateCommandCompletionBeforeReport(label, completion, reportCompletedAt, errors) {
  const reportCompletion = timestampValue(reportCompletedAt);
  if (completion !== undefined && reportCompletion !== undefined && completion > reportCompletion) {
    errors.push(`${label} completion must not follow validation report completion`);
  }
}

function digestText(value, label, errors) {
  if (typeof value !== "string") {
    errors.push(`${label} exact bytes are required for candidate semantic validation`);
    return undefined;
  }
  return sha256(value);
}

function parseDocument(text, label, errors) {
  if (typeof text !== "string") {
    errors.push(`${label} exact bytes are required`);
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return undefined;
  }
}

function normalizeSchemas(schemas) {
  if (!isObject(schemas)) return {};
  return {
    "validation-report": schemas["validation-report"] ?? schemas.validationReport,
    "artifact-report": schemas["artifact-report"] ?? schemas.artifactReport,
    "native-attempt-ledger": schemas["native-attempt-ledger"] ?? schemas.nativeAttemptLedger,
    "journey-evidence": schemas["journey-evidence"] ?? schemas.journeyEvidence,
  };
}

async function loadDefaultSchemas() {
  return Object.fromEntries(await Promise.all(
    Object.entries(defaultSchemaPaths).map(async ([name, path]) => [name, JSON.parse(await readFile(path, "utf8"))]),
  ));
}

function validateSchemaValue(value, schema, rootSchema, path, errors) {
  if (schema === true) return errors;
  if (schema === false) {
    errors.push(`${path} is forbidden by schema`);
    return errors;
  }
  if (!isObject(schema)) throw new TypeError(`${path} schema must be an object or boolean`);

  if (schema.$ref) {
    const target = resolveReference(rootSchema, schema.$ref);
    validateSchemaValue(value, target, rootSchema, path, errors);
  }
  if (Array.isArray(schema.allOf)) {
    for (const member of schema.allOf) validateSchemaValue(value, member, rootSchema, path, errors);
  }
  if (Array.isArray(schema.anyOf)) {
    const valid = schema.anyOf.some((member) => validateSchemaValue(value, member, rootSchema, path, []).length === 0);
    if (!valid) errors.push(`${path} must satisfy at least one anyOf branch`);
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((member) => validateSchemaValue(value, member, rootSchema, path, []).length === 0);
    if (matches.length !== 1) errors.push(`${path} must satisfy exactly one oneOf branch`);
  }
  if (schema.not) {
    const forbiddenMatches = validateSchemaValue(value, schema.not, rootSchema, path, []).length === 0;
    if (forbiddenMatches) errors.push(`${path} must not satisfy the forbidden schema`);
  }
  if (schema.if) {
    const conditionMatches = validateSchemaValue(value, schema.if, rootSchema, path, []).length === 0;
    if (conditionMatches && schema.then) validateSchemaValue(value, schema.then, rootSchema, path, errors);
    if (!conditionMatches && schema.else) validateSchemaValue(value, schema.else, rootSchema, path, errors);
  }

  if (Object.hasOwn(schema, "const") && !deepEqual(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(`${path} must equal one of ${JSON.stringify(schema.enum)}`);
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must have type ${schema.type}`);
    return errors;
  }

  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(`${path} must have length >= ${schema.minLength}`);
    }
    if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength) {
      errors.push(`${path} must have length <= ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} must match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time" && !validTimestamp(value)) {
      errors.push(`${path} must be a valid date-time`);
    }
  }

  if (typeof value === "number") {
    if (Number.isFinite(schema.minimum) && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (Number.isFinite(schema.maximum) && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${path} must contain at least ${schema.minItems} items`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      errors.push(`${path} must contain at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems && new Set(value.map(stableValue)).size !== value.length) {
      errors.push(`${path} must contain unique items`);
    }
    const prefixLength = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((itemSchema, index) => {
        if (index < value.length) {
          validateSchemaValue(value[index], itemSchema, rootSchema, `${path}[${index}]`, errors);
        }
      });
    }
    if (Object.hasOwn(schema, "items")) {
      value.slice(prefixLength).forEach((item, offset) => {
        const index = prefixLength + offset;
        validateSchemaValue(item, schema.items, rootSchema, `${path}[${index}]`, errors);
      });
    }
  }

  if (isObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!Object.hasOwn(value, field)) errors.push(`${path}.${field} is required`);
      }
    }
    if (isObject(schema.properties)) {
      for (const [field, childSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(value, field)) {
          validateSchemaValue(value[field], childSchema, rootSchema, `${path}.${field}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false && isObject(schema.properties)) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const field of Object.keys(value)) {
        if (!allowed.has(field)) errors.push(`${path}.${field} is not allowed`);
      }
    }
  }

  return errors;
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) throw new Error(`unsupported schema reference ${reference}`);
  let current = rootSchema;
  for (const encoded of reference.slice(2).split("/")) {
    const member = encoded.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !Object.hasOwn(current, member)) {
      throw new Error(`unresolved schema reference ${reference}`);
    }
    current = current[member];
  }
  return current;
}

function matchesType(value, type) {
  if (type === "object") return isObject(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "null") return value === null;
  throw new Error(`unsupported schema type ${type}`);
}

function normalizeAbsolutePath(value) {
  if (typeof value !== "string" || !isAbsolute(value)) return undefined;
  return normalize(value);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  return stableValue(left) === stableValue(right);
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function strictlyIncreasing(values) {
  if (!Array.isArray(values) || values.length < 2) return false;
  return values.every((value, index) => Number.isInteger(value) && (index === 0 || value > values[index - 1]));
}

function nondecreasingIntegers(values) {
  return Array.isArray(values)
    && values.length >= 2
    && values.every((value, index) => (
      Number.isInteger(value)
      && (index === 0 || value >= values[index - 1])
    ));
}

function adjacentDeduplicate(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}

function equalStringArrays(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function timestampValue(value) {
  return validTimestamp(value) ? Date.parse(value) : undefined;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseCLIArguments(argv) {
  if (argv.length < 1 || argv[0].startsWith("--")) {
    throw new Error(
      "usage: validate-codex-journey-evidence.mjs <evidence.json> --validation-report <path> --artifact-report <path> --attempt-ledger <path>",
    );
  }
  const result = { evidencePath: resolve(argv[0]) };
  const names = new Map([
    ["--validation-report", "validationReportPath"],
    ["--artifact-report", "artifactReportPath"],
    ["--attempt-ledger", "attemptLedgerPath"],
  ]);
  for (let index = 1; index < argv.length; index += 2) {
    const field = names.get(argv[index]);
    const value = argv[index + 1];
    if (!field || !value || value.startsWith("--")) {
      throw new Error(`unsupported or incomplete argument ${argv[index] ?? "<missing>"}`);
    }
    if (Object.hasOwn(result, field)) throw new Error(`duplicate argument ${argv[index]}`);
    result[field] = resolve(value);
  }
  for (const field of names.values()) {
    if (!result[field]) throw new Error(`missing required ${field}`);
  }
  return result;
}

async function main() {
  const options = parseCLIArguments(process.argv.slice(2));
  const result = await validateEvidenceFile(options.evidencePath, options);
  if (!result.valid) {
    for (const message of [...result.structuralErrors, ...result.semanticErrors]) {
      process.stderr.write(`evidence validation failed: ${message}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({ status: "valid", evidence_path: options.evidencePath })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`evidence validation failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
