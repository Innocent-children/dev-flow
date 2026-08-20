#!/usr/bin/env node

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline";

const statePath = requiredIsolatedPath("FAKE_CORE_STATE");
const tracePath = requiredIsolatedPath("FAKE_CORE_TRACE");
const selectedCase = process.env.FAKE_CORE_CASE ?? "success";
const session = process.env.FAKE_CORE_SESSION ?? "session-1";
const state = await readState();
const tools = toolDefinitions();
const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (line.trim() === "") continue;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    writeMessage({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    continue;
  }
  await handleMessage(request);
}

async function handleMessage(request) {
  if (request?.jsonrpc !== "2.0" || typeof request.method !== "string") {
    writeMessage({ jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32600, message: "Invalid Request" } });
    return;
  }
  await appendTrace({ method: request.method, id: request.id ?? null, params: request.params ?? null });
  if (!("id" in request)) return;
  if (request.method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "dev-flow-fake-core", version: "0.5.0" },
        instructions: "Test-only Core Contract 0.2 fixture server.",
      },
    });
    return;
  }
  if (request.method === "tools/list") {
    writeMessage({ jsonrpc: "2.0", id: request.id, result: { tools } });
    return;
  }
  if (request.method !== "tools/call") {
    writeMessage({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } });
    return;
  }
  const params = request.params;
  if (!isPlainObject(params) || !hasExactKeys(params, ["name", "arguments"]) || !toolByName.has(params.name)) {
    writeMessage({ jsonrpc: "2.0", id: request.id, error: { code: -32602, message: "Invalid tool call" } });
    return;
  }
  const validationError = validateTopLevelArguments(params.arguments, toolByName.get(params.name).inputSchema);
  if (validationError) {
    writeMessage({ jsonrpc: "2.0", id: request.id, error: { code: -32602, message: validationError } });
    return;
  }
  state.calls.push({ number: state.calls.length + 1, session, name: params.name, arguments: structuredClone(params.arguments) });
  await writeState();
  if (params.name === "dev_flow_apply_action") {
    await handleApply(request.id, params.arguments);
    return;
  }
  writeToolResult(request.id, await envelopeFor(params.name, params.arguments));
}

async function handleApply(id, arguments_) {
  state.operationId = arguments_.request_id;
  state.actionId = arguments_.action_id;
  if (!["domain-error", "budget"].includes(selectedCase)) state.applyCount += 1;
  if (selectedCase === "loss") {
    state.responseLost = true;
    await writeState();
    process.exit(75);
  }
  if (selectedCase === "truncation") {
    state.responseLost = true;
    await writeState();
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: '{"schema_version":2,"ok":true' }], isError: false },
    });
    return;
  }
  await writeState();
  writeToolResult(id, await envelopeFor("dev_flow_apply_action", arguments_));
}

async function envelopeFor(tool, arguments_) {
  if (tool === "dev_flow_server_info") {
    return success(tool, {
      product: "dev-flow",
      version: "0.5.0",
      schema_version: 2,
      core_limits_version: "0.2",
      transport: "stdio",
      health: "ready",
      supported_hosts: ["codex", "deepseek"],
      supported_processes: [{ process_id: "standard-development", process_version: 1, definition_digest: digest(), new_task_supported: true }],
      method_profiles: ["plain", "spec-kit", "openspec"],
      tools: tools.map((toolDefinition) => toolDefinition.name),
    });
  }
  if (tool === "dev_flow_open_task") {
    if (selectedCase === "conflict") return failure(tool, "ACTIVE_TASK_CONFLICT");
    if (selectedCase === "host-conflict") return failure(tool, "HOST_OWNERSHIP_CONFLICT");
    const created = state.opened !== true;
    state.opened = true;
    await writeState();
    return success(tool, { created, task: currentTask(), recovery_assessment: null });
  }
  if (tool === "dev_flow_get_task") {
    return success(tool, { task: currentTask(), recovery_assessment: recoveryAssessment() });
  }
  if (tool === "dev_flow_get_next_action") {
    const task = currentTask();
    return success(tool, {
      task_id: task.task_id,
      snapshot_version: 2,
      process: processReference(),
      current_cursor: task.current_cursor,
      revision: task.revision,
      method_profile: task.intent.method_profile,
      blocker: task.blocker,
      action: task.current_action,
      outcome: task.outcome,
      recovery_assessment: recoveryAssessment(),
    });
  }
  if (tool === "dev_flow_cancel_task") {
    state.cancelled = true;
    await writeState();
    return success(tool, { task: currentTask(), claim_released: true });
  }
  if (tool === "dev_flow_apply_action") {
    if (selectedCase === "domain-error") return failure(tool, "ACTION_STALE", arguments_.request_id);
    if (selectedCase === "budget") return failure(tool, "VERIFICATION_BUDGET_EXCEEDED", arguments_.request_id);
    if (selectedCase === "blocker") state.blocked = true;
    if (selectedCase === "terminal") state.done = true;
    await writeState();
    return success(tool, { task: currentTask(), recovery_assessment: null }, arguments_.request_id);
  }
  throw new Error(`unsupported tool ${tool}`);
}

function currentTask() {
  const terminal = state.done || state.cancelled;
  const currentCursor = state.cancelled ? "CANCELLED" : state.done ? "DONE" : state.blocked ? "BLOCKED" : state.applyCount > 0 ? "DESIGN" : "REQUIREMENTS";
  const revision = state.cancelled || state.done || state.blocked ? 2 : state.applyCount > 0 ? 2 : 1;
  return {
    task_id: "task-graph-0001",
    origin_host: "codex",
    snapshot_version: 2,
    process_id: "standard-development",
    process_version: 1,
    process_definition_digest: digest(),
    intent: {
      request: "Define one bounded graph requirement.",
      initial_scope: ["one repository"],
      initial_out_of_scope: ["real host"],
      known_acceptance_criteria: [],
      verification_budget: { level: "targeted", max_automatic_commands: 2, allow_full_suite: false, allow_manual_handoff: true },
      method_profile: "plain",
    },
    current_cursor: currentCursor,
    resume_cursor: state.blocked ? "REQUIREMENTS" : null,
    repository: { digest: digest() },
    baselines: { requirements: state.applyCount > 0 ? { revision: 1, digest: digest() } : null, design: null, task_plan: null, history: [] },
    implementation: null,
    test: null,
    comprehension: null,
    current_action: terminal ? null : state.blocked ? blockerAction(revision) : state.applyCount > 0 ? designAction(revision) : requirementsAction(revision),
    blocker: state.blocked ? { blocker_id: "blocker-graph-0001", code: "TASK_BLOCKED", resume_node: "REQUIREMENTS" } : null,
    last_operation: state.operationId ? { operation_id: state.operationId } : null,
    evidence: [],
    outcome: state.cancelled ? { status: "cancelled", summary: "Cancelled by the user." } : state.done ? { status: "completed", summary: "Completed by the fixture." } : null,
    revision,
  };
}

function requirementsAction(revision) {
  return action(revision, "COMPLETE_REQUIREMENTS", "REQUIREMENTS", "requirements-result@1", [
    transition("requirements_ready", "DESIGN", false),
  ]);
}

function designAction(revision) {
  return action(revision, "COMPLETE_DESIGN", "DESIGN", "design-result@1", [
    transition("design_ready", "TASKS", false),
    transition("design_requires_requirements", "REQUIREMENTS", true),
  ]);
}

function blockerAction(revision) {
  return action(revision, "RESOLVE_BLOCKER", "BLOCKED", "blocker-resolution@1", []);
}

function action(revision, kind, node, payloadContract, availableTransitions) {
  return {
    action_id: `action-${node.toLowerCase()}-${revision}`,
    kind,
    task_id: "task-graph-0001",
    revision,
    process: processReference(),
    current_node: node,
    repository_binding_digest: digest(),
    payload_contract: payloadContract,
    available_transitions: availableTransitions,
    method_profile: "plain",
  };
}

function transition(transitionId, destination, reasonRequired) {
  return { transition_id: transitionId, destination, guard_id: `${transitionId}_guard`, when: "Fixture guard is satisfied.", reason_required: reasonRequired };
}

function recoveryAssessment() {
  if (!state.responseLost) return null;
  return {
    classification: "completed_and_recorded",
    operation: {
      operation_id: state.operationId,
      process_id: "standard-development",
      process_version: 1,
      process_definition_digest: digest(),
      source_cursor: "REQUIREMENTS",
      expected_revision: 1,
      action_id: state.actionId,
      action_kind: "COMPLETE_REQUIREMENTS",
    },
    task_revision: 2,
    action_retry_safe: false,
    next_advice: "Read the current action.",
  };
}

function processReference() {
  return { process_id: "standard-development", process_version: 1, definition_digest: digest() };
}

function success(tool, result, requestId = null) {
  return { schema_version: 2, ok: true, tool, request_id: requestId, result, error: null };
}

function failure(tool, code, requestId = null) {
  return {
    schema_version: 2,
    ok: false,
    tool,
    request_id: requestId,
    result: null,
    error: { code, message: code, recovery: { retry_safe: false, action: "read_task", message: "Read Core authority." } },
  };
}

function writeToolResult(id, envelope) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
      structuredContent: envelope,
      isError: envelope.ok !== true,
    },
  });
}

function toolDefinitions() {
  const metadata = [
    ["dev_flow_server_info", [], [] , true, false, true],
    ["dev_flow_open_task", ["host", "repository_path"], ["host", "repository_path", "new_task"], false, false, false],
    ["dev_flow_get_task", ["host", "task_id"], ["host", "task_id", "operation_probe"], true, false, true],
    ["dev_flow_get_next_action", ["host", "task_id"], ["host", "task_id", "operation_probe"], true, false, true],
    ["dev_flow_apply_action", ["request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_version", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload"], ["request_id", "host", "task_id", "revision", "action_id", "action_kind", "process_id", "process_version", "process_definition_digest", "source_cursor", "repository_binding_digest", "payload", "recovery_apply"], false, false, false],
    ["dev_flow_cancel_task", ["request_id", "host", "task_id", "revision", "reason"], ["request_id", "host", "task_id", "revision", "reason"], false, true, false],
  ];
  return metadata.map(([name, required, properties, readOnlyHint, destructiveHint, idempotentHint]) => ({
    name,
    title: name,
    description: `${name} Core Contract 0.2 fixture definition.`,
    inputSchema: closedSchema(required, properties),
    annotations: { title: name, readOnlyHint, destructiveHint, idempotentHint, openWorldHint: false },
  }));
}

function closedSchema(required, properties) {
  return { type: "object", additionalProperties: false, required, properties: Object.fromEntries(properties.map((name) => [name, {}])) };
}

function validateTopLevelArguments(arguments_, schema) {
  if (!isPlainObject(arguments_)) return "tool arguments must be an object";
  for (const required of schema.required) {
    if (!Object.hasOwn(arguments_, required)) return `tool arguments missing ${required}`;
  }
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(arguments_)) {
    if (!allowed.has(key)) return `tool arguments contain unexpected field ${key}`;
  }
  return null;
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { calls: [], opened: false, applyCount: 0, responseLost: false, blocked: false, done: false, cancelled: false, operationId: null, actionId: null };
  }
}

async function writeState() {
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporaryPath, statePath);
}

async function appendTrace(value) {
  await mkdir(dirname(tracePath), { recursive: true });
  await appendFile(tracePath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

function requiredIsolatedPath(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return resolve(value);
}

function writeMessage(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function hasExactKeys(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function digest() {
  return "5265db6c44ce12ea55d9fdb072b4dcb2345f6e2a1e89b016644c2819e320f2c1";
}
