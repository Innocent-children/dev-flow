#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const DEV_FLOW_TOOLS = Object.freeze([
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
]);

const toolNames = new Set(DEV_FLOW_TOOLS);
const coreErrorRecoveryAction = new Map(Object.entries(Object.freeze({
  INVALID_ARGUMENT: "none",
  NOT_GIT_REPOSITORY: "none",
  TASK_NOT_FOUND: "read_task",
  ACTIVE_TASK_CONFLICT: "cancel_or_finish_active_task",
  HOST_OWNERSHIP_CONFLICT: "use_origin_host",
  REVISION_CONFLICT: "read_task",
  ACTION_STALE: "read_next_action",
  TRANSITION_NOT_ALLOWED: "read_next_action",
  PROCESS_UNSUPPORTED: "repair_storage",
  RECOVERY_UNAVAILABLE: "none",
  REPOSITORY_DRIFT: "resolve_repository_drift",
  VERIFICATION_BUDGET_EXCEEDED: "read_next_action",
  TASK_BLOCKED: "read_next_action",
  TASK_TERMINAL: "read_task",
  SCHEMA_UNSUPPORTED: "repair_storage",
  STORAGE_UNAVAILABLE: "repair_storage",
  INTERNAL_ERROR: "report_internal_error",
})));
const coreUnicodeWhitespace = /\p{White_Space}/u;
const forbiddenFixtureKey = /(?:^|_)(?:prompt|source|path|environment|env|token|secret)(?:_|$)/iu;
const privatePath = /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u;

export function parseCodexJSONL(text) {
  if (typeof text !== "string") throw new TypeError("Codex JSONL must be text");
  const lines = text.split(/\r?\n/u)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim() !== "");
  if (lines.length === 0) throw new Error("Codex JSONL is empty");

  const calls = [];
  const mcpCalls = [];
  const commands = [];
  const itemIDs = new Set();
  let threadId = null;
  let eventCount = 0;
  let transcriptIntegrity = null;
  for (const { line, lineNumber } of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      transcriptIntegrity = "malformed";
      break;
    }
    eventCount += 1;
    if (threadId === null) {
      if (event?.type !== "thread.started" || !validIdentifier(event.thread_id)) {
        throw new Error(`Codex JSONL line ${lineNumber} must be thread.started with a valid thread_id`);
      }
      threadId = event.thread_id;
      continue;
    }
    if (event?.type === "thread.started") {
      throw new Error("Codex JSONL must contain exactly one thread.started event");
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
        || !(Number.isInteger(item.exit_code) || (item.status === "failed" && item.exit_code === null))
        || !["completed", "failed"].includes(item.status)
      ) {
        throw new Error("command terminal item has an invalid identity, command, result, or status");
      }
      commands.push({
        itemId: item.id,
        command: item.command,
        output: item.aggregated_output,
        exitCode: item.exit_code,
        status: item.status,
      });
      continue;
    }
    if (item?.type !== "mcp_tool_call") continue;
    if (
      typeof item.id !== "string"
      || item.id.length === 0
      || typeof item.server !== "string"
      || item.server.length === 0
      || typeof item.tool !== "string"
      || item.tool.length === 0
      || !["completed", "failed"].includes(item.status)
    ) {
      throw new Error("MCP terminal item has an invalid identity, server, tool, or status");
    }
    if (itemIDs.has(item.id)) {
      throw new Error(`MCP terminal item ID is duplicated: ${item.id}`);
    }
    itemIDs.add(item.id);
    if (item.server === "dev-flow") {
      const call = parseTerminalCall(item);
      calls.push(call);
      mcpCalls.push({
        itemId: item.id,
        server: item.server,
        tool: item.tool,
        status: item.status,
        shape: call.shape,
      });
    } else {
      mcpCalls.push({
        itemId: item.id,
        server: item.server,
        tool: item.tool,
        status: item.status,
        shape: null,
      });
    }
  }

  return {
    threadId,
    eventCount,
    calls,
    mcpCalls,
    commands,
    transcriptIntegrity,
  };
}

export function validateCodexFixture(text, expectedShape) {
  const parsed = parseCodexJSONL(text);
  if (parsed.transcriptIntegrity !== null) {
    throw new Error(`sanitized Codex fixture transcript integrity is ${parsed.transcriptIntegrity}`);
  }
  if (parsed.calls.length !== 1) {
    throw new Error(`sanitized Codex fixture must contain exactly one Dev Flow terminal call, got ${parsed.calls.length}`);
  }
  if (parsed.calls[0].shape !== expectedShape) {
    throw new Error(`Codex fixture shape is ${parsed.calls[0].shape}, expected ${expectedShape}`);
  }
  assertSanitizedFixture(text);
  return parsed;
}

export function summarizeCodexFixture(parsed, fixture = null) {
  if (!parsed || !Array.isArray(parsed.calls) || parsed.calls.length !== 1) {
    throw new TypeError("fixture summary requires one parsed Dev Flow call");
  }
  const call = parsed.calls[0];
  return {
    mode: "fixture",
    host: "codex-0.147",
    fixture,
    thread_started: true,
    dev_flow_call_count: 1,
    tool: call.tool,
    terminal_shape: call.shape,
    status: "pass",
  };
}

export async function parseCodexFixtureFile(path, expectedShape) {
  return validateCodexFixture(await readFile(path, "utf8"), expectedShape);
}

function parseTerminalCall(item) {
  if (
    typeof item.id !== "string"
    || item.id.length === 0
    || typeof item.tool !== "string"
    || !toolNames.has(item.tool)
    || !["completed", "failed"].includes(item.status)
  ) {
    throw new Error("Dev Flow terminal item has an invalid identity, tool, or status");
  }

  if (item.status === "completed" && item.error === null && isPlainObject(item.result)) {
    return resultCall(item, "success");
  }
  if (
    item.status === "failed"
    && isPlainObject(item.result)
    && (item.error === null || isCodexHostError(item.error))
  ) {
    const call = resultCall(item, "core_domain_error");
    if (call.structuredContent.ok !== false) {
      throw new Error("failed Dev Flow result must carry a Core ok=false result");
    }
    return call;
  }
  if (item.status === "failed" && item.result === null && isPlainObject(item.error)) {
    const errorKeys = Object.keys(item.error);
    if (
      errorKeys.length !== 1
      || errorKeys[0] !== "message"
      || typeof item.error.message !== "string"
      || item.error.message.length === 0
    ) {
      throw new Error("Codex 0.147 transport failure requires exactly one nonempty message");
    }
    return {
      itemId: item.id,
      tool: item.tool,
      requestId: isPlainObject(item.arguments) && validIdentifier(item.arguments.request_id)
        ? item.arguments.request_id
        : null,
      status: item.status,
      shape: "transport_error",
      arguments: isPlainObject(item.arguments) ? structuredClone(item.arguments) : null,
      resultPresent: false,
      structuredContent: null,
      error: structuredClone(item.error),
    };
  }
  throw new Error("Dev Flow terminal item does not match a supported Codex 0.147 result shape");
}

function resultCall(item, shape) {
  const content = item.result.content;
  if (
    !Array.isArray(content)
    || content.length !== 1
    || content[0]?.type !== "text"
    || typeof content[0].text !== "string"
  ) {
    throw new Error("complete Dev Flow result requires one text block and structured content");
  }
  let textResult;
  try {
    textResult = JSON.parse(content[0].text);
  } catch (error) {
    throw new Error(`Dev Flow text result is not complete JSON: ${error.message}`);
  }
  const structured = item.result.structured_content ?? textResult;
  if (!isPlainObject(structured)) {
    throw new Error("complete Dev Flow result requires a closed text or structured result");
  }
  if (item.result.structured_content !== undefined && item.result.structured_content !== null && !isDeepStrictEqual(textResult, structured)) {
    throw new Error("Dev Flow text and structured results differ");
  }
  const requestBinding = validateCoreEnvelope(structured, item, shape);
  return {
    itemId: item.id,
    tool: item.tool,
    requestId: structured.request_id,
    status: item.status,
    shape,
    arguments: isPlainObject(item.arguments) ? structuredClone(item.arguments) : null,
    requestBinding,
    resultPresent: true,
    structuredContent: structuredClone(structured),
    error: item.error === null ? null : structuredClone(item.error),
  };
}

function validateCoreEnvelope(envelope, item, shape) {
  const success = shape === "success";
  assertExactKeys(
    envelope,
    success
      ? ["ok", "request_id", "tool", "result"]
      : ["ok", "request_id", "tool", "error", "recovery"],
    "Core result envelope",
  );
  if (envelope.ok !== success) {
    throw new Error("Core result envelope has an invalid ok discriminator");
  }
  if (!validIdentifier(envelope.request_id)) {
    throw new Error("Core result envelope request_id is invalid");
  }
  if (!toolNames.has(envelope.tool) || envelope.tool !== item.tool) {
    throw new Error("Core result envelope tool does not match the MCP item");
  }
  const requestBinding = callerRequestBinding(envelope, item);
  if (item.tool === "dev_flow_apply_action" && success && requestBinding !== "matched") {
    throw new Error("dev_flow_apply_action MCP item requires its caller request_id");
  }
  if (requestBinding === "mismatched") {
    throw new Error("Core result envelope request_id does not match the MCP item");
  }

  if (success) {
    if (!isPlainObject(envelope.result)) {
      throw new Error("Core success envelope result must be an object");
    }
    return requestBinding;
  }

  assertExactKeys(envelope.error, ["code", "message", "details", "guard"], "Core error", { optional: ["details", "guard"] });
  if (!validIdentifier(envelope.error.code) || !validMessage(envelope.error.message)) {
    throw new Error("Core error code or message is invalid");
  }
  let correctionPaths = [];
  if (Object.hasOwn(envelope.error, "details")) {
    if (Array.isArray(envelope.error.details)) {
      correctionPaths = validateContractViolations(envelope.error.details, "Core error details");
    } else {
      // Retain the legacy closed reason object for existing frozen evidence.
      assertExactKeys(envelope.error.details, ["reason"], "Core error details");
      if (!validIdentifier(envelope.error.details.reason)) {
        throw new Error("Core error details reason is invalid");
      }
    }
  }
  if (Object.hasOwn(envelope.error, "guard")) {
    assertExactKeys(envelope.error.guard, ["guard_id", "failures"], "Core error guard");
    if (!validIdentifier(envelope.error.guard.guard_id)) {
      throw new Error("Core error guard_id is invalid");
    }
    correctionPaths = correctionPaths.concat(validateContractViolations(envelope.error.guard.failures, "Core error guard failures"));
  }
  assertExactKeys(envelope.recovery, ["retry_safe", "action", "message", "allowed_paths"], "Core recovery", { optional: ["allowed_paths"] });
  if (!validMessage(envelope.recovery.message)) {
    throw new Error("Core recovery guidance is invalid");
  }
  if (envelope.recovery.retry_safe === true) {
    if (
      !["INVALID_ARGUMENT", "TRANSITION_NOT_ALLOWED"].includes(envelope.error.code)
      || envelope.recovery.action !== "correct_current_action"
      || !Array.isArray(envelope.recovery.allowed_paths)
      || envelope.recovery.allowed_paths.length === 0
      || !isDeepStrictEqual(envelope.recovery.allowed_paths, [...new Set(correctionPaths)])
    ) {
      throw new Error("Core bounded correction guidance is invalid");
    }
    return requestBinding;
  }
  const expectedRecoveryAction = coreErrorRecoveryAction.get(envelope.error.code);
  if (
    expectedRecoveryAction === undefined
    || envelope.recovery.retry_safe !== false
    || envelope.recovery.action !== expectedRecoveryAction
    || Object.hasOwn(envelope.recovery, "allowed_paths")
  ) {
    throw new Error("Core recovery guidance is invalid");
  }
  return requestBinding;
}

function validateContractViolations(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  const paths = [];
  for (const [index, violation] of value.entries()) {
    assertExactKeys(violation, ["path", "rule", "message"], `${label}[${index}]`);
    if (!validViolationPath(violation.path) || !validIdentifier(violation.rule) || !validMessage(violation.message)) {
      throw new Error(`${label}[${index}] is invalid`);
    }
    paths.push(violation.path);
  }
  return paths;
}

function validViolationPath(value) {
  return typeof value === "string"
    && Buffer.byteLength(value, "utf8") <= 512
    && /^[a-z_]+(?:\[\d{1,4}\])?(?:\.[a-z_]+(?:\[\d{1,4}\])?)*$/u.test(value);
}

function callerRequestBinding(envelope, item) {
  const argumentsObject = isPlainObject(item.arguments) ? item.arguments : null;
  if (argumentsObject === null || !Object.hasOwn(argumentsObject, "request_id")) {
    return item.tool === "dev_flow_apply_action" ? "missing" : null;
  }
  if (!validIdentifier(argumentsObject.request_id)) return "invalid";
  return argumentsObject.request_id === envelope.request_id ? "matched" : "mismatched";
}

function assertExactKeys(value, allowed, label, { optional = [] } = {}) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`${label} contains unexpected field ${key}`);
  }
  for (const key of allowed) {
    if (!optional.includes(key) && !Object.hasOwn(value, key)) {
      throw new Error(`${label} is missing field ${key}`);
    }
  }
}

function validIdentifier(value) {
  if (typeof value !== "string" || value === "" || coreUnicodeWhitespace.test(value)) {
    return false;
  }
  const encoded = Buffer.from(value, "utf8");
  return encoded.length <= 128 && encoded.toString("utf8") === value;
}

function validMessage(value) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") >= 1 && Buffer.byteLength(value, "utf8") <= 4096;
}

function assertSanitizedFixture(text) {
  if (privatePath.test(text)) throw new Error("fixture contains a user path");
  const documents = text.split(/\r?\n/u).filter(Boolean).map(JSON.parse);
  walk(documents);

  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenFixtureKey.test(key)) throw new Error(`fixture contains forbidden field ${key}`);
      walk(child);
    }
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCodexHostError(value) {
  return isPlainObject(value)
    && Object.keys(value).length === 1
    && typeof value.message === "string"
    && value.message.length > 0;
}

async function main(argv) {
  if (argv.length !== 1) {
    throw new Error("usage: validate-codex-journey-evidence.mjs FIXTURE.jsonl");
  }
  const fixturePath = argv[0];
  const expectedShape = fixturePath.endsWith("/success.jsonl")
    ? "success"
    : fixturePath.endsWith("/core-domain-error.jsonl")
      ? "core_domain_error"
      : fixturePath.endsWith("/transport-error.jsonl")
        ? "transport_error"
        : null;
  if (expectedShape === null) throw new Error("fixture filename must be success, core-domain-error, or transport-error");
  const parsed = await parseCodexFixtureFile(fixturePath, expectedShape);
  process.stdout.write(`${JSON.stringify(summarizeCodexFixture(parsed, fixturePath.split("/").at(-1)))}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`codex-jsonl-parser: ${error.message}\n`);
    process.exitCode = 1;
  });
}
