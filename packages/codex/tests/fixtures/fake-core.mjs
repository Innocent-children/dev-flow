#!/usr/bin/env node

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const fixtureRoot = join(repositoryRoot, "protocol", "fixtures");
const schemaSourcePath = join(repositoryRoot, "internal", "mcp", "schemas.go");
const version = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();
const statePath = requiredIsolatedPath("FAKE_CORE_STATE");
const tracePath = requiredIsolatedPath("FAKE_CORE_TRACE");
const selectedCase = process.env.FAKE_CORE_CASE ?? "success";
const session = process.env.FAKE_CORE_SESSION ?? "session-1";
const lossOnApply = Number(process.env.FAKE_CORE_LOSS_ON_APPLY ?? "0");
const toolDefinitions = await loadExactToolDefinitions();
const toolByName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
const state = await readState();

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
        serverInfo: { name: "dev-flow-fake-core", version },
        instructions: "Test-only exact Core Contract 0.1 fixture server.",
      },
    });
    return;
  }
  if (request.method === "tools/list") {
    writeMessage({ jsonrpc: "2.0", id: request.id, result: { tools: toolDefinitions } });
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
  const schema = toolByName.get(params.name).inputSchema;
  const validationError = validateTopLevelArguments(params.arguments, schema);
  if (validationError) {
    writeMessage({ jsonrpc: "2.0", id: request.id, error: { code: -32602, message: validationError } });
    return;
  }

  const callNumber = state.calls.length + 1;
  state.calls.push({ number: callNumber, session, name: params.name, arguments: structuredClone(params.arguments) });
  if (params.name === "dev_flow_open_task" && !["conflict", "host-conflict"].includes(selectedCase)) {
    state.journey.last_open_created = state.journey.opened !== true;
    state.journey.opened = true;
  }
  await writeState();
  if (params.name === "dev_flow_apply_action") {
    await handleApply(request.id, params.arguments);
    return;
  }
  const envelope = await envelopeFor(params.name, params.arguments);
  writeToolResult(request.id, envelope);
}

async function handleApply(id, arguments_) {
  state.journey.last_request_id = arguments_.request_id;
  state.journey.last_action_id = arguments_.action_id;
  const rejected = ["domain-error", "conflict", "budget"].includes(selectedCase);
  if (!rejected) state.journey.apply_count += 1;
  if (selectedCase === "terminal" || state.journey.apply_count >= 2) state.journey.done = true;
  await writeState();

  const shouldLose = !rejected && (selectedCase === "loss" || lossOnApply === state.journey.apply_count);
  if (shouldLose) {
    state.journey.last_response_lost = true;
    await writeState();
    process.exit(75);
  }
  if (selectedCase === "truncation") {
    state.journey.last_response_lost = true;
    await writeState();
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: '{"schema_version":1,"ok":true,"tool":"dev_flow_apply_action"' }],
        isError: false,
      },
    });
    return;
  }

  const envelope = await envelopeFor("dev_flow_apply_action", arguments_);
  if (typeof arguments_.request_id === "string") envelope.request_id = arguments_.request_id;
  writeToolResult(id, envelope);
}

async function envelopeFor(tool, arguments_) {
  if (tool === "dev_flow_server_info") return loadFixture("server-info.json");
  if (tool === "dev_flow_cancel_task") return loadFixture("cancelled-outcome.json");
  if (tool === "dev_flow_open_task") {
    if (selectedCase === "conflict") return loadFixture("active-task-conflict.json");
    if (selectedCase === "host-conflict") return loadFixture("host-ownership-conflict.json");
    const envelope = await loadFixture("open-task.json");
    envelope.result.created = state.journey.last_open_created === true;
    envelope.result.task = await currentJourneyTask();
    return envelope;
  }
  if (tool === "dev_flow_get_task") {
    const envelope = await loadFixture("task.json");
    envelope.result.task = await currentJourneyTask();
    envelope.result.recovery_assessment = state.journey.last_response_lost
      ? await completedAndRecordedAssessment()
      : null;
    return envelope;
  }
  if (tool === "dev_flow_get_next_action") {
    const task = await currentJourneyTask();
    const envelope = await loadFixture("next-action.json");
    envelope.result = {
      task_id: task.task_id,
      phase: task.phase,
      revision: task.revision,
      action: task.current_action,
      blocker: task.blocker,
      outcome: task.outcome,
      recovery_assessment: state.journey.last_response_lost
        ? await completedAndRecordedAssessment()
        : null,
    };
    return envelope;
  }
  if (tool === "dev_flow_apply_action") {
    if (selectedCase === "domain-error") return loadFixture("stale-action.json");
    if (selectedCase === "conflict") return loadFixture("revision-conflict.json");
    if (selectedCase === "blocker") return loadFixture("recovery-blocked.json");
    if (selectedCase === "budget") return loadFixture("verification-budget-failure.json");
    if (selectedCase === "terminal" || state.journey.apply_count >= 2) {
      return loadFixture("completed-outcome.json");
    }
    return loadFixture("apply-success.json");
  }
  throw new Error(`unsupported fake Core tool ${tool} for ${JSON.stringify(arguments_)}`);
}

async function currentJourneyTask() {
  if (state.journey.done || state.journey.apply_count >= 2) {
    return structuredClone((await loadFixture("completed-outcome.json")).result.task);
  }
  if (state.journey.apply_count === 1) {
    return structuredClone((await loadFixture("apply-success.json")).result.task);
  }
  return structuredClone((await loadFixture("open-task.json")).result.task);
}

async function completedAndRecordedAssessment() {
  const assessment = structuredClone(
    (await loadFixture("recovery-completed-and-recorded.json")).result.recovery_assessment,
  );
  assessment.task_revision = state.journey.done ? 8 : 4;
  assessment.current_action_id = state.journey.done ? null : "action-verify-0004";
  if (state.journey.last_request_id) assessment.operation.operation_id = state.journey.last_request_id;
  if (state.journey.last_action_id) assessment.operation.action_id = state.journey.last_action_id;
  return assessment;
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

function writeMessage(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function loadFixture(name) {
  const raw = await readFile(join(fixtureRoot, name), "utf8");
  return JSON.parse(raw.replaceAll("${VERSION}", version));
}

async function loadExactToolDefinitions() {
  const source = await readFile(schemaSourcePath, "utf8");
  const definitions = rawGoConstant(source, "schemaDefinitions");
  const schemas = {
    dev_flow_server_info: composedGoSchema(source, "serverInfoInputSchema", definitions),
    dev_flow_open_task: composedGoSchema(source, "openTaskInputSchema", definitions),
    dev_flow_get_task: composedGoSchema(source, "readTaskInputSchema", definitions),
    dev_flow_get_next_action: composedGoSchema(source, "readTaskInputSchema", definitions),
    dev_flow_apply_action: composedGoSchema(source, "applyActionInputSchema", definitions),
    dev_flow_cancel_task: composedGoSchema(source, "cancelTaskInputSchema", definitions),
  };
  const metadata = [
    ["dev_flow_server_info", "Report the ready local Core contract, version, supported host identities, and exact tool list.", true, false, true],
    ["dev_flow_open_task", "Create one governed repository task or resume its compatible active task.", false, false, false],
    ["dev_flow_get_task", "Read one authoritative task and optionally assess an uncertain operation without persistence.", true, false, true],
    ["dev_flow_get_next_action", "Read the exact persisted next action or terminal outcome, with optional transient recovery assessment.", true, false, true],
    ["dev_flow_apply_action", "Submit the closed payload for the exact current action or an explicit recovery apply.", false, false, false],
    ["dev_flow_cancel_task", "Explicitly cancel a host-owned task at its exact revision while retaining task history.", false, true, false],
  ];
  return metadata.map(([name, description, readOnlyHint, destructiveHint, idempotentHint]) => ({
    name,
    title: name,
    description,
    inputSchema: schemas[name],
    annotations: {
      title: name,
      readOnlyHint,
      destructiveHint,
      idempotentHint,
      openWorldHint: false,
    },
  }));
}

function rawGoConstant(source, name) {
  const match = new RegExp("const " + name + " = `([^`]*)`").exec(source);
  if (!match) throw new Error(`cannot load Core schema constant ${name}`);
  return match[1];
}

function composedGoSchema(source, name, definitions) {
  const composed = new RegExp(
    "const " + name + " = `([^`]*)`[ \\t]*\\+ schemaDefinitions \\+ `([^`]*)`",
  ).exec(source);
  const raw = composed ? `${composed[1]}${definitions}${composed[2]}` : rawGoConstant(source, name);
  return JSON.parse(raw);
}

function validateTopLevelArguments(arguments_, schema) {
  if (!isPlainObject(arguments_)) return "tool arguments must be an object";
  for (const required of schema.required ?? []) {
    if (!Object.hasOwn(arguments_, required)) return `tool arguments missing ${required}`;
  }
  const allowed = new Set(Object.keys(schema.properties ?? {}));
  for (const key of Object.keys(arguments_)) {
    if (!allowed.has(key)) return `tool arguments contain unexpected field ${key}`;
  }
  return null;
}

function hasExactKeys(value, keys) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredIsolatedPath(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) {
    process.stderr.write(`${name} must name an absolute test-only path\n`);
    process.exit(64);
  }
  return resolve(value);
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!Array.isArray(parsed.calls) || !isPlainObject(parsed.journey)) {
      throw new Error("fake Core state shape is invalid");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        schema_version: 1,
        calls: [],
        journey: {
          task_id: "task-00000001",
          opened: false,
          apply_count: 0,
          done: false,
          last_response_lost: false,
        },
      };
    }
    throw error;
  }
}

async function writeState() {
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  const temporary = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, statePath);
}

async function appendTrace(entry) {
  await mkdir(dirname(tracePath), { recursive: true, mode: 0o700 });
  await appendFile(
    tracePath,
    `${JSON.stringify({ session, at: new Date().toISOString(), ...entry })}\n`,
    { mode: 0o600 },
  );
}
