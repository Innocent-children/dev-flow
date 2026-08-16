#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

import { DEV_FLOW_TOOLS, parseCodexJSONL } from "./validate-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);

export const EXPLICIT_SELECTOR = "$dev-flow-codex:dev-flow";
export const ordinaryPrompt =
  "Reply with one short sentence describing this repository. Do not invoke Dev Flow.";
export const invalidPrompt =
  "$dev-flow Complete the bounded acceptance task in this repository.";
export const smokePrompt =
  `${EXPLICIT_SELECTOR} Inspect the current repository and report the authoritative Dev Flow task status.`;
export const acceptancePrompt =
  `${EXPLICIT_SELECTOR} Complete the bounded acceptance task in this repository and stop only at the Core outcome.`;
export const resumePrompt =
  `${EXPLICIT_SELECTOR} Resume the existing compatible Dev Flow task and continue to the Core outcome.`;

const ACCEPTANCE_REPORT_FIELDS = Object.freeze([
  "status",
  "source_commit",
  "artifact_sha256",
  "codex_version",
  "package_version",
  "core_version",
  "setup_readback_passed",
  "ordinary_prompt_core_call_count",
  "explicit_selector",
  "task_id_before_restart",
  "task_id_after_restart",
  "committed_action_count",
  "terminal_outcome",
  "remove_readback_passed",
  "task_data_retained",
  "task_reopened_after_removal",
  "unexpected_repository_paths",
]);

export function buildCodexExecArgs(prompt) {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new TypeError("Codex prompt must be nonempty");
  }
  return ["exec", "--json", prompt];
}

export async function runCodexSession({
  codexExecutable,
  workspace,
  role,
  prompt,
  runProcess = defaultRunProcess,
  includeCallFacts = false,
}) {
  requireAbsolute(codexExecutable, "Codex executable");
  requireAbsolute(workspace, "workspace");
  const result = await runProcess(codexExecutable, buildCodexExecArgs(prompt), { cwd: workspace });
  const classified = classifyCodexSessionResult(result);
  if (classified.classification !== "success") {
    const error = new Error(sessionFailureMessage(role, classified));
    error.classification = classified.classification;
    error.call = classified.call ?? null;
    error.transcriptIntegrity = classified.transcriptIntegrity;
    error.acceptance = classified.acceptance;
    throw error;
  }
  return includeCallFacts
    ? summarizeCodexSession(role, classified.parsed)
    : summarizeSession(role, classified.parsed);
}

export function classifyCodexSessionResult({ exitCode, stdout, stderr }) {
  let parsed = null;
  let parserError = null;
  try {
    parsed = parseCodexJSONL(stdout);
  } catch (error) {
    parserError = error;
  }

  const transcriptIntegrity = parsed?.transcriptIntegrity
    ?? (parserError === null ? null : "malformed");
  if (parsed !== null) {
    const domainError = parsed.calls.find((call) => call.shape === "core_domain_error");
    if (domainError) {
      return {
        classification: "core-domain-error",
        call: domainError,
        parsed,
        transcriptIntegrity,
        acceptance: "failed",
      };
    }
    const transportError = parsed.calls.find((call) => call.shape === "transport_error");
    if (transportError) {
      return {
        classification: "transport-error",
        call: transportError,
        parsed,
        transcriptIntegrity,
        acceptance: "failed",
      };
    }
  }
  if (exitCode !== 0) {
    return {
      classification: "session-error",
      exitCode,
      stderr: typeof stderr === "string" ? stderr : "",
      transcriptIntegrity,
      acceptance: "failed",
    };
  }
  if (parserError !== null || transcriptIntegrity !== null) {
    return {
      classification: "parser-error",
      error: parserError,
      parsed,
      transcriptIntegrity,
      acceptance: "failed",
    };
  }
  return {
    classification: "success",
    parsed,
    transcriptIntegrity: null,
    acceptance: "pass",
  };
}

function sessionFailureMessage(role, classified) {
  switch (classified.classification) {
    case "core-domain-error":
      return `${role} Codex session returned Core domain error ${classified.call.structuredContent.error.code}`;
    case "transport-error":
      return `${role} Codex session returned an MCP transport failure`;
    case "session-error":
      return `${role} Codex session exited with ${classified.exitCode}: ${classified.stderr.trim()}`;
    case "parser-error":
      return `${role} Codex session returned invalid JSONL: transcript is malformed`;
    default:
      throw new TypeError("Codex session failure classification is unsupported");
  }
}

export async function runDevelopmentSmoke(options) {
  const ordinary = await runCodexSession({
    ...options,
    role: "ordinary",
    prompt: ordinaryPrompt,
  });
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary Codex smoke must make zero Dev Flow calls");
  }
  const explicit = await runCodexSession({
    ...options,
    role: "explicit",
    prompt: smokePrompt,
  });
  if (explicit.dev_flow_call_count === 0) {
    throw new Error("explicit Codex smoke must observe at least one Dev Flow call");
  }
  return {
    mode: "smoke",
    host: "codex-0.147",
    sessions: [ordinary, explicit],
    persistent_attempt_state: false,
    status: "pass",
  };
}

export async function runAcceptanceJourney(options) {
  const ordinary = await runCodexSession({
    ...options,
    role: "ordinary",
    prompt: ordinaryPrompt,
    includeCallFacts: true,
  });
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary acceptance session must make zero Dev Flow calls");
  }
  const invalid = await runCodexSession({
    ...options,
    role: "invalid",
    prompt: invalidPrompt,
    includeCallFacts: true,
  });
  if (invalid.dev_flow_call_count !== 0) {
    throw new Error("invalid acceptance session must make zero Dev Flow calls");
  }
  const substantive = await runCodexSession({
    ...options,
    role: "substantive",
    prompt: acceptancePrompt,
    includeCallFacts: true,
  });
  const resume = await runCodexSession({
    ...options,
    role: "resume",
    prompt: resumePrompt,
    includeCallFacts: true,
  });
  const tools = new Set([...substantive.tools, ...resume.tools]);
  if (!tools.has("dev_flow_server_info") || !tools.has("dev_flow_open_task")) {
    throw new Error("acceptance sessions must observe the handshake and task open/resume calls");
  }
  if (!resume.core_done) {
    throw new Error("acceptance resume session must end at authoritative Core DONE");
  }
  const sessions = [ordinary, invalid, substantive, resume];
  return {
    mode: "acceptance",
    host: "codex-0.147",
    sessions,
    mcp_summary: aggregateSessionFacts(sessions),
    persistent_attempt_state: false,
    lifecycle_check_required: true,
    acceptance_report_required: true,
    status: "observed",
  };
}

export function validateAcceptanceReport(report) {
  if (!isPlainObject(report)) {
    throw new TypeError("acceptance report must be a plain object");
  }
  for (const field of ACCEPTANCE_REPORT_FIELDS) {
    if (!Object.hasOwn(report, field)) {
      throw new Error(`acceptance report requires required field ${field}`);
    }
  }
  for (const field of Object.keys(report)) {
    if (!ACCEPTANCE_REPORT_FIELDS.includes(field)) {
      throw new Error(`acceptance report has unexpected field ${field}`);
    }
  }

  if (report.status !== "pass") {
    throw new Error("acceptance report status must be pass");
  }
  if (typeof report.source_commit !== "string" || !/^[0-9a-f]{40}$/u.test(report.source_commit)) {
    throw new Error("acceptance report source_commit must be a full lowercase Git commit");
  }
  if (typeof report.artifact_sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(report.artifact_sha256)) {
    throw new Error("acceptance report artifact_sha256 must be a lowercase SHA-256 digest");
  }
  for (const field of ["codex_version", "package_version", "core_version"]) {
    if (typeof report[field] !== "string" || report[field].trim() === "") {
      throw new Error(`acceptance report ${field} must be a nonempty string`);
    }
  }
  if (report.package_version !== report.core_version) {
    throw new Error("acceptance report package_version must equal core_version");
  }
  requireTrue(report, "setup_readback_passed");
  if (!Number.isInteger(report.ordinary_prompt_core_call_count) || report.ordinary_prompt_core_call_count !== 0) {
    throw new Error("acceptance report ordinary_prompt_core_call_count must equal 0");
  }
  if (report.explicit_selector !== EXPLICIT_SELECTOR) {
    throw new Error(`acceptance report explicit_selector must equal ${EXPLICIT_SELECTOR}`);
  }
  for (const field of ["task_id_before_restart", "task_id_after_restart"]) {
    if (typeof report[field] !== "string" || report[field].trim() === "") {
      throw new Error(`acceptance report ${field} must be a nonempty string`);
    }
  }
  if (report.task_id_before_restart !== report.task_id_after_restart) {
    throw new Error("acceptance report task_id_before_restart must equal task_id_after_restart");
  }
  if (!Number.isInteger(report.committed_action_count) || report.committed_action_count < 2) {
    throw new Error("acceptance report committed_action_count must be at least 2");
  }
  if (report.terminal_outcome !== "DONE") {
    throw new Error("acceptance report terminal_outcome must equal DONE");
  }
  requireTrue(report, "remove_readback_passed");
  requireTrue(report, "task_data_retained");
  requireTrue(report, "task_reopened_after_removal");
  if (!Array.isArray(report.unexpected_repository_paths) || report.unexpected_repository_paths.length !== 0) {
    throw new Error("acceptance report unexpected_repository_paths must be an empty array");
  }

  return structuredClone(report);
}

function requireTrue(report, field) {
  if (report[field] !== true) {
    throw new Error(`acceptance report ${field} must equal true`);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function summarizeSession(role, parsed) {
  const fact = summarizeCodexSession(role, parsed);
  return {
    role: fact.role,
    thread_started: fact.thread_started,
    dev_flow_call_count: fact.dev_flow_call_count,
    tools: fact.tools,
    terminal_shapes: fact.terminal_shapes,
    core_done: fact.core_done,
  };
}

export function summarizeCodexSession(role, parsed) {
  if (typeof role !== "string" || role.length === 0 || !Array.isArray(parsed?.calls) || !Array.isArray(parsed?.mcpCalls)) {
    throw new TypeError("session summary requires one role and parsed Codex JSONL");
  }
  return {
    role,
    thread_started: true,
    dev_flow_call_count: parsed.calls.length,
    tools: parsed.calls.map((call) => call.tool),
    terminal_shapes: parsed.calls.map((call) => call.shape),
    core_done: parsed.calls.some((call) => containsDone(call.structuredContent)),
    mcp_calls: parsed.mcpCalls.map((call) => ({
      item_id: call.itemId,
      server: call.server,
      tool: call.tool,
      status: call.status,
      classification: call.shape === null ? "other-mcp" : displayShape(call.shape),
    })),
    dev_flow_calls: parsed.calls.map((call) => ({
      session_role: role,
      item_id: call.itemId,
      tool: call.tool,
      request_id: call.requestId,
      status: call.status,
      classification: displayShape(call.shape),
      core_result: call.resultPresent ? structuredClone(call.structuredContent) : null,
      host_error: call.error === null ? null : structuredClone(call.error),
      error: call.shape === "core_domain_error" ? structuredClone(call.structuredContent.error) : null,
      recovery: call.shape === "core_domain_error" ? structuredClone(call.structuredContent.recovery) : null,
    })),
  };
}

const ACCEPTANCE_SESSION_ROLES = Object.freeze([
  "ordinary",
  "invalid",
  "substantive",
  "resume",
]);

export function aggregateSessionFacts(sessions) {
  if (!Array.isArray(sessions) || sessions.length !== ACCEPTANCE_SESSION_ROLES.length) {
    throw new Error("MCP aggregate requires ordinary, invalid, substantive, and resume sessions");
  }

  const aggregate = {
    total_mcp_calls: 0,
    dev_flow_mcp_calls: 0,
    completed_count: 0,
    failed_count: 0,
    per_tool_count: {},
    core_domain_error_count: 0,
    transport_error_count: 0,
    session_dev_flow_call_count: {},
  };

  for (let index = 0; index < ACCEPTANCE_SESSION_ROLES.length; index += 1) {
    const role = ACCEPTANCE_SESSION_ROLES[index];
    const session = sessions[index];
    if (!isPlainObject(session) || session.role !== role) {
      throw new Error(`MCP aggregate session ${index + 1} must be ${role}`);
    }
    if (!Array.isArray(session.mcp_calls) || !Array.isArray(session.dev_flow_calls)) {
      throw new Error(`${role} session must carry MCP and Dev Flow call facts`);
    }

    const itemIDs = new Set();
    for (const call of session.mcp_calls) {
      validateMCPCallFact(call, role);
      if (itemIDs.has(call.item_id)) {
        throw new Error(`${role} session contains duplicate MCP item ${call.item_id}`);
      }
      itemIDs.add(call.item_id);
      aggregate.total_mcp_calls += 1;
      if (call.status === "completed") aggregate.completed_count += 1;
      else aggregate.failed_count += 1;
    }

    const projected = session.mcp_calls
      .filter((call) => call.server === "dev-flow")
      .map(({ item_id, tool, status, classification }) => ({
        item_id,
        tool,
        status,
        classification,
      }));
    const claimed = session.dev_flow_calls.map((call) => ({
      item_id: call.item_id,
      tool: call.tool,
      status: call.status,
      classification: call.classification,
    }));
    if (!isDeepStrictEqual(claimed, projected)) {
      throw new Error(`${role} Dev Flow call facts do not equal its MCP projection`);
    }
    if (
      session.dev_flow_call_count !== projected.length
      || !isDeepStrictEqual(session.tools, projected.map((call) => call.tool))
      || !isDeepStrictEqual(
        session.terminal_shapes,
        projected.map((call) => call.classification.replaceAll("-", "_")),
      )
    ) {
      throw new Error(`${role} session summary does not equal its Dev Flow call facts`);
    }
    if (["ordinary", "invalid"].includes(role) && projected.length !== 0) {
      throw new Error(`${role} session must make zero Dev Flow calls`);
    }

    aggregate.session_dev_flow_call_count[role] = projected.length;
    aggregate.dev_flow_mcp_calls += projected.length;
    for (const call of projected) {
      validateDevFlowClassification(call, role);
      aggregate.per_tool_count[call.tool] = (aggregate.per_tool_count[call.tool] ?? 0) + 1;
      if (call.classification === "core-domain-error") aggregate.core_domain_error_count += 1;
      if (call.classification === "transport-error") aggregate.transport_error_count += 1;
    }
  }

  aggregate.per_tool_count = Object.fromEntries(
    Object.entries(aggregate.per_tool_count).sort(([left], [right]) => left.localeCompare(right)),
  );
  const perToolTotal = Object.values(aggregate.per_tool_count)
    .reduce((total, count) => total + count, 0);
  if (perToolTotal !== aggregate.dev_flow_mcp_calls) {
    throw new Error("per-tool MCP counts do not equal the Dev Flow call total");
  }
  if (
    aggregate.session_dev_flow_call_count.substantive
      + aggregate.session_dev_flow_call_count.resume
    !== aggregate.dev_flow_mcp_calls
  ) {
    throw new Error("active-session Dev Flow calls do not equal the aggregate total");
  }
  return aggregate;
}

export function validateSessionAggregate(sessions, claimed, acceptanceReport) {
  const aggregate = aggregateSessionFacts(sessions);
  if (!isDeepStrictEqual(claimed, aggregate)) {
    throw new Error("top-level MCP aggregate does not equal the four session projections");
  }
  if (
    !isPlainObject(acceptanceReport)
    || acceptanceReport.ordinary_prompt_core_call_count
      !== aggregate.session_dev_flow_call_count.ordinary
  ) {
    throw new Error("acceptance report ordinary call count does not equal the session projection");
  }
  return structuredClone(aggregate);
}

function validateMCPCallFact(call, role) {
  if (
    !isPlainObject(call)
    || typeof call.item_id !== "string"
    || call.item_id.length === 0
    || typeof call.server !== "string"
    || call.server.length === 0
    || typeof call.tool !== "string"
    || call.tool.length === 0
    || !["completed", "failed"].includes(call.status)
    || typeof call.classification !== "string"
    || call.classification.length === 0
  ) {
    throw new Error(`${role} session contains an invalid MCP call fact`);
  }
}

function validateDevFlowClassification(call, role) {
  if (
    (call.classification === "success" && call.status === "completed")
    || (["core-domain-error", "transport-error"].includes(call.classification)
      && call.status === "failed")
  ) {
    return;
  }
  throw new Error(`${role} session contains a non-exclusive Dev Flow terminal classification`);
}

function displayShape(shape) {
  return shape.replaceAll("_", "-");
}

function containsDone(value) {
  if (Array.isArray(value)) return value.some(containsDone);
  if (value === null || typeof value !== "object") return false;
  if (value.phase === "DONE" || value.outcome?.status === "completed") return true;
  return Object.values(value).some(containsDone);
}

async function defaultRunProcess(executable, args, { cwd }) {
  try {
    const { stdout, stderr } = await execFile(executable, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : String(error?.message ?? error),
    };
  }
}

function requireAbsolute(value, label) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
}

function parseCLI(argv) {
  const mode = argv.shift();
  if (mode === "acceptance-report") {
    if (argv.length !== 2 || argv[0] !== "--report") {
      throw new Error("acceptance-report requires --report ABS");
    }
    requireAbsolute(argv[1], "acceptance report");
    return { mode, reportPath: argv[1] };
  }
  if (!["smoke", "acceptance"].includes(mode)) {
    throw new Error("mode must be smoke, acceptance, or acceptance-report");
  }
  const values = {};
  while (argv.length > 0) {
    const flag = argv.shift();
    if (!["--codex-executable", "--workspace"].includes(flag) || flag in values || argv.length === 0) {
      throw new Error("real smoke requires each exact path flag once");
    }
    values[flag] = argv.shift();
  }
  if (!values["--codex-executable"] || !values["--workspace"]) {
    throw new Error("real smoke requires --codex-executable ABS --workspace ABS");
  }
  return {
    mode,
    codexExecutable: values["--codex-executable"],
    workspace: values["--workspace"],
  };
}

async function main(argv) {
  const options = parseCLI([...argv]);
  if (options.mode === "acceptance-report") {
    const report = validateAcceptanceReport(JSON.parse(await readFile(options.reportPath, "utf8")));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  const summary = options.mode === "smoke"
    ? await runDevelopmentSmoke(options)
    : await runAcceptanceJourney(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`codex-native-smoke: ${error.message}\n`);
    process.exitCode = 1;
  });
}
