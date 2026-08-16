import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEV_FLOW_TOOLS,
  parseCodexJSONL,
  parseCodexFixtureFile,
  summarizeCodexFixture,
} from "../../../scripts/validate-codex-journey-evidence.mjs";
import * as sessionRuntime from "../../../scripts/write-codex-journey-evidence.mjs";

const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const fixtureRoot = join(repositoryRoot, "tests", "contract", "testdata", "codex-0.147");

const fixtures = Object.freeze({
  success: {
    path: join(fixtureRoot, "success.jsonl"),
    shape: "success",
  },
  coreDomainError: {
    path: join(fixtureRoot, "core-domain-error.jsonl"),
    shape: "core_domain_error",
  },
  transportError: {
    path: join(fixtureRoot, "transport-error.jsonl"),
    shape: "transport_error",
  },
});

test("Codex 0.147 completed MCP item preserves complete structured/text parity", async () => {
  const parsed = await parseCodexFixtureFile(fixtures.success.path, fixtures.success.shape);
  const [call] = parsed.calls;

  assert.equal(parsed.eventCount, 2);
  assert.equal(call.status, "completed");
  assert.equal(call.tool, "dev_flow_server_info");
  assert.equal(call.resultPresent, true);
  assert.equal(call.structuredContent.ok, true);
  assert.deepEqual(call.structuredContent.result.tools, DEV_FLOW_TOOLS);
  assert.deepEqual(summarizeCodexFixture(parsed, "success.jsonl"), {
    mode: "fixture",
    host: "codex-0.147",
    fixture: "success.jsonl",
    thread_started: true,
    dev_flow_call_count: 1,
    tool: "dev_flow_server_info",
    terminal_shape: "success",
    status: "pass",
  });
});

test("Codex 0.147 failed MCP item with a complete Core result remains a domain error", async () => {
  const parsed = await parseCodexFixtureFile(
    fixtures.coreDomainError.path,
    fixtures.coreDomainError.shape,
  );
  const [call] = parsed.calls;

  assert.equal(call.status, "failed");
  assert.equal(call.tool, "dev_flow_apply_action");
  assert.equal(call.resultPresent, true);
  assert.equal(call.structuredContent.ok, false);
  assert.equal(call.structuredContent.error.code, "REVISION_CONFLICT");
  assert.deepEqual(call.structuredContent.recovery, {
    retry_safe: false,
    action: "read_task",
    message: "Read the authoritative task before another mutation.",
  });
});

test("Codex 0.147 failed MCP item without a complete result is a transport error", async () => {
  const parsed = await parseCodexFixtureFile(
    fixtures.transportError.path,
    fixtures.transportError.shape,
  );
  const [call] = parsed.calls;

  assert.equal(call.status, "failed");
  assert.equal(call.tool, "dev_flow_apply_action");
  assert.equal(call.resultPresent, false);
  assert.equal(call.structuredContent, null);
  assert.deepEqual(call.error, {
    message: "MCP transport disconnected before a result",
  });
  assert.equal(Object.hasOwn(call.error, "code"), false);
});

test("Codex host fixtures contain no prompt, source, user path, environment, token, or secret", async () => {
  for (const fixture of Object.values(fixtures)) {
    const text = await readFile(fixture.path, "utf8");
    assert.doesNotMatch(text, /(?:\/Users\/|\/home\/|[A-Za-z]:\\)/u);
    assert.doesNotMatch(text, /"(?:prompt|source|path|environment|env|token|secret)"\s*:/iu);
  }
});

test("Codex 0.147 parser retains one bounded command fact for smoke verification", () => {
  const command = "/bin/zsh -lc 'git hash-object native-proof.txt'";
  const output = "5de13fdad681cf91a2877203917cf78afb4aa679\n";
  const parsed = parseCodexJSONL([
    { type: "thread.started", thread_id: "thread-redacted-command" },
    { type: "item.completed", item: { id: "item-redacted-command", type: "command_execution", command, aggregated_output: output, exit_code: 0, status: "completed" } },
  ].map(JSON.stringify).join("\n"));
  assert.deepEqual(parsed.commands, [{
    itemId: "item-redacted-command",
    command, output,
    exitCode: 0,
    status: "completed",
  }]);
});

test("HIGH-1 diagnostic precedence: the highest-authority session failure wins", async () => {
  assert.equal(typeof sessionRuntime.classifyCodexSessionResult, "function");
  const domainEvents = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  domainEvents[1].item.error = { message: "Host also reported an MCP failure" };
  const cases = [
    {
      name: "complete Core error precedes outer Host error",
      result: { exitCode: 1, stdout: encodeJSONL(domainEvents), stderr: "host process failed" },
      expected: "core-domain-error",
    },
    {
      name: "transport error precedes subprocess failure",
      result: { exitCode: 1, stdout: await readFile(fixtures.transportError.path, "utf8"), stderr: "host process failed" },
      expected: "transport-error",
    },
    {
      name: "subprocess failure precedes no MCP failure",
      result: {
        exitCode: 7,
        stdout: '{"type":"thread.started","thread_id":"thread-redacted-exit"}\n',
        stderr: "Codex exited",
      },
      expected: "session-error",
    },
    {
      name: "malformed JSONL is a parser failure",
      result: { exitCode: 0, stdout: "{not-json}\n", stderr: "" },
      expected: "parser-error",
    },
  ];

  for (const entry of cases) {
    const classified = sessionRuntime.classifyCodexSessionResult(entry.result);
    assert.equal(classified.classification, entry.expected, entry.name);
  }
});
test("P1-1 malformed transcript preserves an earlier Core failure without accepting corruption", async () => {
  const domainJSONL = await readFile(fixtures.coreDomainError.path, "utf8");
  const cases = [
    {
      name: "complete Core failure remains primary before a malformed tail",
      result: {
        exitCode: 1,
        stdout: `${domainJSONL}{not-json}\n`,
        stderr: "Codex exited after the malformed record",
      },
      classification: "core-domain-error",
      errorCode: "REVISION_CONFLICT",
      recovery: {
        retry_safe: false,
        action: "read_task",
        message: "Read the authoritative task before another mutation.",
      },
    },
    {
      name: "malformed transcript is primary without an earlier authority failure",
      result: {
        exitCode: 0,
        stdout: '{"type":"thread.started","thread_id":"thread-redacted-malformed"}\n{not-json}\n',
        stderr: "",
      },
      classification: "parser-error",
      errorCode: null,
      recovery: null,
    },
  ];

  for (const entry of cases) {
    const classified = sessionRuntime.classifyCodexSessionResult(entry.result);
    assert.equal(classified.classification, entry.classification, entry.name);
    assert.equal(classified.transcriptIntegrity, "malformed", entry.name);
    assert.equal(classified.acceptance, "failed", entry.name);
    assert.equal(classified.call?.structuredContent.error.code ?? null, entry.errorCode, entry.name);
    assert.deepEqual(classified.call?.structuredContent.recovery ?? null, entry.recovery, entry.name);
  }
});
test("P1-A production path classifies a purely malformed transcript without a TypeError", async () => {
  const error = await captureSessionFailure({
    exitCode: 0,
    stdout: '{"type":"thread.started","thread_id":"thread-redacted-malformed"}\n{not-json}\n',
    stderr: "",
  });

  assert.notEqual(error.name, "TypeError");
  assert.equal(error.classification, "parser-error");
  assert.equal(error.transcriptIntegrity, "malformed");
  assert.equal(error.acceptance, "failed");
  assert.equal(error.message, "test Codex session returned invalid JSONL: transcript is malformed");
  assert.doesNotMatch(error.message, /not-json|\/fixture|prompt|environment|token|secret/iu);
});

test("P1-A production path keeps a Core failure primary before a malformed tail", async () => {
  const domainJSONL = await readFile(fixtures.coreDomainError.path, "utf8");
  const error = await captureSessionFailure({
    exitCode: 1,
    stdout: `${domainJSONL}{not-json}\n`,
    stderr: "Codex exited after the malformed record",
  });

  assert.notEqual(error.name, "TypeError");
  assert.equal(error.classification, "core-domain-error");
  assert.equal(error.transcriptIntegrity, "malformed");
  assert.equal(error.acceptance, "failed");
  assert.equal(error.call.structuredContent.error.code, "REVISION_CONFLICT");
  assert.deepEqual(error.call.structuredContent.recovery, {
    retry_safe: false,
    action: "read_task",
    message: "Read the authoritative task before another mutation.",
  });
});
test("HIGH-2 Core envelope closure: only a closed Core Contract 0.1 result is authoritative", async () => {
  const success = parseJSONL(await readFile(fixtures.success.path, "utf8"));
  const domainError = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  const cases = [
    ["text/structured mismatch", mutateEnvelope(success, (envelope) => {
      envelope.result.product = "not-the-text-result";
    }, { preserveText: true })],
    ["tool mismatch", mutateEnvelope(success, (envelope) => {
      envelope.tool = "dev_flow_get_task";
    })],
    ["missing request_id", mutateEnvelope(success, (envelope) => {
      delete envelope.request_id;
    })],
    ["error without recovery", mutateEnvelope(domainError, (envelope) => {
      delete envelope.recovery;
    })],
    ["mixed success and error", mutateEnvelope(success, (envelope) => {
      envelope.error = { code: "INTERNAL_ERROR", message: "must not coexist" };
    })],
    ["extra authority member", mutateEnvelope(success, (envelope) => {
      envelope.authority = "invented";
    })],
    ["unknown error details member", mutateEnvelope(domainError, (envelope) => {
      envelope.error.details = { reason: "known", raw: "forbidden" };
    })],
  ];

  for (const [name, events] of cases) {
    assert.throws(() => parseCodexJSONL(encodeJSONL(events)), Error, name);
  }
});
test("P1-2 Core error authority uses the closed code, recovery, and request identity contract", async () => {
  const domainError = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  assert.doesNotThrow(() => parseCodexJSONL(encodeJSONL(domainError)));
  for (const requestID of ["request-1", "请求-一"]) {
    const candidate = mutateEnvelope(domainError, (envelope, item) => {
      envelope.request_id = requestID;
      item.arguments.request_id = requestID;
    });
    assert.doesNotThrow(
      () => parseCodexJSONL(encodeJSONL(candidate)),
      `valid Core request ID ${requestID}`,
    );
  }

  const cases = [
    ["unknown error code", (envelope) => {
      envelope.error.code = "MADE_UP";
    }],
    ["unknown recovery action", (envelope) => {
      envelope.recovery.action = "made_up";
    }],
    ["known code with another code's recovery action", (envelope) => {
      envelope.error.code = "ACTION_STALE";
      envelope.recovery.action = "repair_storage";
    }],
    ["empty request ID", (envelope, item) => {
      envelope.request_id = "";
      item.arguments.request_id = "";
    }],
    ["space-only request ID", (envelope, item) => {
      envelope.request_id = "   ";
      item.arguments.request_id = "   ";
    }],
    ["tab request ID", (envelope, item) => {
      envelope.request_id = "\t";
      item.arguments.request_id = "\t";
    }],
    ["embedded-whitespace request ID", (envelope, item) => {
      envelope.request_id = "request 1";
      item.arguments.request_id = "request 1";
    }],
    ["leading-whitespace request ID", (envelope, item) => {
      envelope.request_id = " request-1";
      item.arguments.request_id = " request-1";
    }],
    ["trailing-whitespace request ID", (envelope, item) => {
      envelope.request_id = "request-1 ";
      item.arguments.request_id = "request-1 ";
    }],
    ["retry-safe Core error", (envelope) => {
      envelope.recovery.retry_safe = true;
    }],
  ];
  for (const [name, whitespace] of [
    ["U+0085 NEXT LINE", "\u0085"],
    ["U+00A0 NO-BREAK SPACE", "\u00a0"],
    ["U+1680 OGHAM SPACE MARK", "\u1680"],
    ["U+2003 EM SPACE", "\u2003"],
    ["U+2028 LINE SEPARATOR", "\u2028"],
    ["U+2029 PARAGRAPH SEPARATOR", "\u2029"],
    ["U+3000 IDEOGRAPHIC SPACE", "\u3000"],
  ]) {
    cases.push([name, (envelope, item) => {
      const requestID = `request${whitespace}1`;
      envelope.request_id = requestID;
      item.arguments.request_id = requestID;
    }]);
  }

  const accepted = [];
  for (const [name, mutate] of cases) {
    const candidate = mutateEnvelope(domainError, mutate);
    try {
      parseCodexJSONL(encodeJSONL(candidate));
      accepted.push(name);
    } catch {
      // Expected: every candidate is outside the closed Core error contract.
    }
  }
  assert.deepEqual(accepted, [], `unexpectedly authoritative: ${accepted.join(", ")}`);
});
test("HIGH-3 failed event binding: authority remains attached to one session item", async () => {
  assert.equal(typeof sessionRuntime.summarizeCodexSession, "function");
  const domainError = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  const parsed = parseCodexJSONL(encodeJSONL(domainError));
  const summary = sessionRuntime.summarizeCodexSession("substantive", parsed);
  assert.deepEqual(summary.dev_flow_calls[0], {
    session_role: "substantive",
    item_id: "item-redacted-core-error",
    tool: "dev_flow_apply_action",
    request_id: "request-redacted-core-error",
    status: "failed",
    classification: "core-domain-error",
    core_result: parsed.calls[0].structuredContent,
    host_error: null,
    error: parsed.calls[0].structuredContent.error,
    recovery: parsed.calls[0].structuredContent.recovery,
  });

  const crossItemResult = structuredClone(domainError);
  crossItemResult[1].item.id = "item-redacted-a";
  crossItemResult[1].item.arguments.request_id = "request-redacted-a";
  const toolMismatch = mutateEnvelope(domainError, (envelope) => {
    envelope.tool = "dev_flow_get_task";
  });
  const duplicateItem = structuredClone(domainError);
  duplicateItem.push(structuredClone(duplicateItem[1]));
  const cases = [
    ["failed item A cannot use result and recovery from request B", crossItemResult],
    ["item and envelope tool must match", toolMismatch],
    ["item IDs are unique within one session", duplicateItem],
  ];
  for (const [name, events] of cases) {
    assert.throws(() => parseCodexJSONL(encodeJSONL(events)), Error, name);
  }
});
test("HIGH-4 aggregate parity: top-level MCP facts equal four session projections", async () => {
  assert.equal(typeof sessionRuntime.aggregateSessionFacts, "function");
  assert.equal(typeof sessionRuntime.validateSessionAggregate, "function");
  const success = parseJSONL(await readFile(fixtures.success.path, "utf8"));
  const domainError = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  const emptySession = (role) => sessionRuntime.summarizeCodexSession(
    role,
    parseCodexJSONL(`{"type":"thread.started","thread_id":"thread-redacted-${role}"}\n`),
  );
  const activeSession = (role, items) => sessionRuntime.summarizeCodexSession(
    role,
    parseCodexJSONL(encodeJSONL([
      { type: "thread.started", thread_id: `thread-redacted-${role}` },
      ...items,
    ])),
  );
  const sessions = [
    emptySession("ordinary"),
    activeSession("invalid", [domainError[1]]),
    activeSession("substantive", [success[1]]),
    activeSession("resume", [success[1]]),
  ];
  const aggregate = sessionRuntime.aggregateSessionFacts(sessions);
  assert.deepEqual(aggregate, {
    total_mcp_calls: 3,
    dev_flow_mcp_calls: 3,
    completed_count: 2,
    failed_count: 1,
    per_tool_count: {
      dev_flow_apply_action: 1,
      dev_flow_server_info: 2,
    },
    core_domain_error_count: 1,
    transport_error_count: 0,
    session_dev_flow_call_count: {
      ordinary: 0,
      invalid: 1,
      substantive: 1,
      resume: 1,
    },
  });
  assert.deepEqual(
    sessionRuntime.validateSessionAggregate(
      sessions,
      aggregate,
      { ordinary_prompt_core_call_count: 0 },
    ),
    aggregate,
  );

  const cases = [
    ["top-level total is short", sessions, { ...aggregate, total_mcp_calls: 2 }],
    ["failed count differs", sessions, { ...aggregate, failed_count: 2 }],
    ["per-tool count differs", sessions, {
      ...aggregate,
      per_tool_count: { ...aggregate.per_tool_count, dev_flow_server_info: 1 },
    }],
    ["missing session", sessions.slice(1), aggregate],
  ];
  const duplicateSessions = structuredClone(sessions);
  duplicateSessions[2].mcp_calls.push(structuredClone(duplicateSessions[2].mcp_calls[0]));
  cases.push(["duplicate item is not counted twice", duplicateSessions, aggregate]);
  const ordinaryCallSessions = structuredClone(sessions);
  ordinaryCallSessions[0].mcp_calls.push(structuredClone(ordinaryCallSessions[2].mcp_calls[0]));
  cases.push(["ordinary session cannot contain Dev Flow calls", ordinaryCallSessions, aggregate]);

  for (const [name, projected, claimed] of cases) {
    assert.throws(
      () => sessionRuntime.validateSessionAggregate(
        projected,
        claimed,
        { ordinary_prompt_core_call_count: 0 },
      ),
      Error,
      name,
    );
  }
});

function parseJSONL(text) {
  return text.trim().split("\n").map(JSON.parse);
}

function encodeJSONL(events) {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function mutateEnvelope(source, mutate, { preserveText = false } = {}) {
  const events = structuredClone(source);
  const item = events[1].item;
  const envelope = item.result.structured_content;
  mutate(envelope, item);
  if (!preserveText) item.result.content[0].text = JSON.stringify(envelope);
  return events;
}

async function captureSessionFailure(result) {
  try {
    await sessionRuntime.runCodexSession({
      codexExecutable: "/fixture/codex",
      workspace: "/fixture/worktree",
      role: "test",
      prompt: "Run the bounded fixture session.",
      runProcess: async () => result,
    });
  } catch (error) {
    return error;
  }
  assert.fail("Codex session unexpectedly succeeded");
}
