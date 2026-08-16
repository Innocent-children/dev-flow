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
const forbiddenFixtureKey = /(?:^|_)(?:prompt|source|path|environment|env|token|secret)(?:_|$)/iu;
const privatePath = /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u;

export function parseCodexJSONL(text) {
  if (typeof text !== "string") throw new TypeError("Codex JSONL must be text");
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");
  if (lines.length === 0) throw new Error("Codex JSONL is empty");

  const events = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Codex JSONL line ${index + 1} is invalid JSON: ${error.message}`);
    }
  });

  const first = events[0];
  if (first?.type !== "thread.started" || typeof first.thread_id !== "string" || first.thread_id.length === 0) {
    throw new Error("Codex JSONL must begin with thread.started and a nonempty thread_id");
  }
  if (events.slice(1).some((event) => event?.type === "thread.started")) {
    throw new Error("Codex JSONL must contain exactly one thread.started event");
  }

  const calls = [];
  for (const event of events.slice(1)) {
    if (event?.type !== "item.completed") continue;
    const item = event.item;
    if (item?.type !== "mcp_tool_call" || item.server !== "dev-flow") continue;
    calls.push(parseTerminalCall(item));
  }

  return {
    threadId: first.thread_id,
    eventCount: events.length,
    calls,
  };
}

export function validateCodexFixture(text, expectedShape) {
  const parsed = parseCodexJSONL(text);
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
  if (item.status === "failed" && item.error === null && isPlainObject(item.result)) {
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
      status: item.status,
      shape: "transport_error",
      resultPresent: false,
      structuredContent: null,
      error: structuredClone(item.error),
    };
  }
  throw new Error("Dev Flow terminal item does not match a supported Codex 0.147 result shape");
}

function resultCall(item, shape) {
  const structured = item.result.structured_content;
  const textBlocks = Array.isArray(item.result.content)
    ? item.result.content.filter((block) => block?.type === "text" && typeof block.text === "string")
    : [];
  if (!isPlainObject(structured) || textBlocks.length !== 1) {
    throw new Error("complete Dev Flow result requires one text block and structured content");
  }
  let textResult;
  try {
    textResult = JSON.parse(textBlocks[0].text);
  } catch (error) {
    throw new Error(`Dev Flow text result is not complete JSON: ${error.message}`);
  }
  if (!isDeepStrictEqual(textResult, structured)) {
    throw new Error("Dev Flow text and structured results differ");
  }
  return {
    itemId: item.id,
    tool: item.tool,
    status: item.status,
    shape,
    resultPresent: true,
    structuredContent: structuredClone(structured),
    error: null,
  };
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
