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

async function currentDomainJSONL() {
  const events = parseJSONL(await readFile(fixtures.coreDomainError.path, "utf8"));
  for (const event of events) {
    const result = event?.item?.result;
    if (!result) continue;
    if (result.structured_content) delete result.structured_content.schema_version;
    for (const block of result.content ?? []) {
      if (block.type !== "text") continue;
      const envelope = JSON.parse(block.text);
      delete envelope.schema_version;
      block.text = JSON.stringify(envelope);
    }
  }
  return encodeJSONL(events);
}

async function currentDomainEvents() {
  return parseJSONL(await currentDomainJSONL());
}

async function currentSuccessEvents() {
  const events = parseJSONL(await readFile(fixtures.success.path, "utf8"));
  const result = events[1]?.item?.result;
  delete result.structured_content.schema_version;
  const envelope = JSON.parse(result.content[0].text);
  delete envelope.schema_version;
  result.content[0].text = JSON.stringify(envelope);
  return events;
}

test("Codex 0.147 numbered success fixture is frozen and current-incompatible", async () => {
  await assert.rejects(parseCodexFixtureFile(fixtures.success.path, fixtures.success.shape), /unexpected field schema_version/u);
});

test("current Core contract native parser accepts one complete text-only Core result", () => {
  const envelope = {
    ok: true,
    request_id: "request-contract-0-2-server-info",
    tool: "dev_flow_server_info",
    result: {
      product: "dev-flow",
      version: "0.3.0",
      tools: DEV_FLOW_TOOLS,
    },
  };
  const parsed = parseCodexJSONL([
    JSON.stringify({ type: "thread.started", thread_id: "thread-contract-0-2-text-only" }),
    JSON.stringify({
      type: "item.completed",
      item: {
        id: "item-contract-0-2-server-info",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_server_info",
        arguments: {},
        status: "completed",
        error: null,
        result: { content: [{ type: "text", text: JSON.stringify(envelope) }] },
      },
    }),
  ].join("\n"));
  assert.deepEqual(parsed.calls[0].arguments, {});
});

test("current Core contract RequestBinding uses caller operation identity for success and domain error", () => {
  const callerRequestID = "request-contract-0-2-apply";
  const arguments_ = { request_id: callerRequestID, task_id: "task-contract-0-2" };
  const successEnvelope = {
    ok: true,
    request_id: callerRequestID,
    tool: "dev_flow_apply_action",
    result: {
      task_id: "task-contract-0-2",
      last_operation: { operation_id: callerRequestID },
    },
  };
  const success = parseCodexJSONL(encodeJSONL([
    { type: "thread.started", thread_id: "thread-contract-0-2-success" },
    {
      type: "item.completed",
      item: {
        id: "item-contract-0-2-success",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_apply_action",
        arguments: arguments_,
        status: "completed",
        error: null,
        result: { content: [{ type: "text", text: JSON.stringify(successEnvelope) }] },
      },
    },
  ]));
  assert.equal(success.calls[0].requestBinding, "matched");
  assert.equal(success.calls[0].structuredContent.result.last_operation.operation_id, callerRequestID);

  const errorEnvelope = {
    ok: false,
    request_id: callerRequestID,
    tool: "dev_flow_apply_action",
    error: { code: "INVALID_ARGUMENT", message: "The request does not match the closed Core contract." },
    recovery: { retry_safe: false, action: "none", message: "Correct the request before submitting it again." },
  };
  const domainError = parseCodexJSONL(encodeJSONL([
    { type: "thread.started", thread_id: "thread-contract-0-2-error" },
    {
      type: "item.completed",
      item: {
        id: "item-contract-0-2-error",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_apply_action",
        arguments: arguments_,
        status: "failed",
        error: null,
        result: { content: [{ type: "text", text: JSON.stringify(errorEnvelope) }] },
      },
    },
  ]));
  assert.equal(domainError.calls[0].requestBinding, "matched");
  assert.equal(domainError.calls[0].shape, "core_domain_error");

  const transport = parseCodexJSONL(encodeJSONL([
    { type: "thread.started", thread_id: "thread-contract-0-2-transport" },
    {
      type: "item.completed",
      item: {
        id: "item-contract-0-2-transport",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_apply_action",
        arguments: arguments_,
        status: "failed",
        error: { message: "transport ended before a complete Core result" },
        result: null,
      },
    },
  ]));
  assert.equal(transport.calls[0].shape, "transport_error");
  assert.equal(transport.calls[0].requestId, callerRequestID);
});

test("current Action submission accepts the Core-generated operation identity", () => {
  const operationID = "request-core-generated-submission";
  const envelope = {
    ok: true,
    request_id: operationID,
    tool: "dev_flow_submit_requirements",
    result: { task_id: "task-current-submission", last_operation: { operation_id: operationID } },
  };
  const parsed = parseCodexJSONL(encodeJSONL([
    { type: "thread.started", thread_id: "thread-current-submission" },
    {
      type: "item.completed",
      item: {
        id: "item-current-submission",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_submit_requirements",
        arguments: { host: "codex", task_id: "task-current-submission", action_id: "action-current" },
        status: "completed",
        error: null,
        result: { content: [{ type: "text", text: JSON.stringify(envelope) }] },
      },
    },
  ]));
  assert.equal(parsed.calls[0].requestBinding, null);
});

test("current domain error preserves Core authority", async () => {
  const parsed = parseCodexJSONL(await currentDomainJSONL());
  const [call] = parsed.calls;

  assert.equal(call.status, "failed");
  assert.equal(call.tool, "dev_flow_apply_action");
  assert.equal(call.resultPresent, true);
  assert.equal(call.structuredContent.ok, false);
  assert.equal(call.requestBinding, "matched");
  assert.equal(call.structuredContent.error.code, "REVISION_CONFLICT");
  assert.deepEqual(call.structuredContent.recovery, {
    retry_safe: false,
    action: "read_task",
    message: "Read the authoritative task before another mutation.",
  });
});

test("real acceptance Core rejection preserves a missing caller request binding diagnostic", async () => {
  const envelope = {
    ok: false,
    request_id: "request-redacted-core",
    tool: "dev_flow_apply_action",
    error: { code: "INVALID_ARGUMENT", message: "The request does not match the closed Core contract." },
    recovery: { retry_safe: false, action: "none", message: "Correct the request before submitting it again." },
  };
  const stdout = encodeJSONL([
    { type: "thread.started", thread_id: "thread-redacted-acceptance" },
    {
      type: "item.completed",
      item: {
        id: "item-redacted-acceptance-apply",
        type: "mcp_tool_call",
        server: "dev-flow",
        tool: "dev_flow_apply_action",
        arguments: {
          action_kind: "ASSESS_TASK",
          payload: {
            request_id: "request-redacted-caller",
            host: "codex",
            task_id: "task-redacted-acceptance",
            revision: 1,
            action_id: "action-redacted-assess",
            action_kind: "ASSESS_TASK",
            repository_binding_digest: "a".repeat(64),
            payload: {
              result: "succeeded",
              summary: "Assessed the bounded task.",
              constraints: [],
              risks: [],
              intended_changed_surface: ["acceptance-proof.txt"],
              verification_budget_acknowledged: true,
            },
          },
        },
        result: {
          content: [{ type: "text", text: JSON.stringify(envelope) }],
          structured_content: envelope,
        },
        error: null,
        status: "failed",
      },
    },
  ]);

  const parsed = parseCodexJSONL(stdout);
  assert.equal(parsed.calls[0].shape, "core_domain_error");
  assert.equal(parsed.calls[0].structuredContent.error.code, "INVALID_ARGUMENT");
  assert.equal(parsed.calls[0].requestBinding, "missing");

  const classified = sessionRuntime.classifyCodexSessionResult({ exitCode: 0, stdout, stderr: "" });
  assert.equal(classified.classification, "core-domain-error");
  assert.equal(classified.call.requestBinding, "missing");
  assert.equal(classified.acceptance, "failed");

  const error = await captureSessionFailure({ exitCode: 0, stdout, stderr: "" });
  assert.equal(error.classification, "core-domain-error");
  assert.equal(error.requestBinding, "missing");
  assert.equal(
    error.message,
    "test Codex session returned Core domain error INVALID_ARGUMENT; caller request binding is missing",
  );
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
  const domainEvents = await currentDomainEvents();
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
  const domainJSONL = await currentDomainJSONL();
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
  const domainJSONL = await currentDomainJSONL();
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
test("HIGH-2 Core envelope closure: only a closed Core frozen linear contract result is authoritative", async () => {
  const success = await currentSuccessEvents();
  const domainError = await currentDomainEvents();
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
  const domainError = await currentDomainEvents();
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
test("Feature 013 error authority accepts bounded correction and guard shapes", async () => {
  const domainError = await currentDomainEvents();
  const path = "payload.node_result.checks[3].command_count";
  const correctable = mutateEnvelope(domainError, (envelope) => {
    envelope.error = {
      code: "INVALID_ARGUMENT",
      message: "The request does not match the closed Core contract.",
      details: [{
        path,
        rule: "non_automated_command_count_zero",
        message: "command_count must equal 0 when source is user, static or host_observed",
      }],
    };
    envelope.recovery = {
      retry_safe: true,
      action: "correct_current_action",
      message: "Correct only the listed members of this same action and resubmit once with a new request_id.",
      allowed_paths: [path],
    };
  });
  assert.doesNotThrow(() => parseCodexJSONL(encodeJSONL(correctable)));

  const guardPath = "payload.node_result.findings";
  const guard = mutateEnvelope(domainError, (envelope) => {
    envelope.error = {
      code: "TRANSITION_NOT_ALLOWED",
      message: "The transition guard was not satisfied.",
      guard: {
        guard_id: "implementation_report_complete",
        failures: [{
          path: guardPath,
          rule: "forward_findings_empty",
          message: "findings must be empty when problem_class is none",
        }],
      },
    };
    envelope.recovery = {
      retry_safe: true,
      action: "correct_current_action",
      message: "Correct only the listed members of this same action and resubmit once with a new request_id.",
      allowed_paths: [guardPath],
    };
  });
  assert.doesNotThrow(() => parseCodexJSONL(encodeJSONL(guard)));

  for (const candidate of [
    mutateEnvelope(correctable, (envelope) => {
      envelope.recovery.allowed_paths = ["payload.summary"];
    }),
    mutateEnvelope(correctable, (envelope) => {
      envelope.error.details[0].raw = "forbidden";
    }),
    mutateEnvelope(correctable, (envelope) => {
      envelope.recovery.extra = true;
    }),
  ]) {
    assert.throws(() => parseCodexJSONL(encodeJSONL(candidate)));
  }
});
test("HIGH-3 failed event binding: authority remains attached to one session item", async () => {
  assert.equal(typeof sessionRuntime.summarizeCodexSession, "function");
  const domainError = await currentDomainEvents();
  const parsed = parseCodexJSONL(encodeJSONL(domainError));
  const summary = sessionRuntime.summarizeCodexSession("substantive", parsed);
  assert.deepEqual(summary.dev_flow_calls[0], {
    session_role: "substantive",
    item_id: "item-redacted-core-error",
    tool: "dev_flow_apply_action",
    request_id: "request-redacted-core-error",
    arguments: parsed.calls[0].arguments,
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
  assert.throws(
    () => parseCodexJSONL(encodeJSONL(crossItemResult)),
    /request_id does not match/u,
  );
  const crossItemFailure = await captureSessionFailure({
    exitCode: 0,
    stdout: encodeJSONL(crossItemResult),
    stderr: "",
  });
  assert.equal(crossItemFailure.classification, "parser-error");
  assert.equal(crossItemFailure.requestBinding, null);
  assert.equal(crossItemFailure.acceptance, "failed");
  const toolMismatch = mutateEnvelope(domainError, (envelope) => {
    envelope.tool = "dev_flow_get_task";
  });
  const nonApplyRequestMismatch = mutateEnvelope(domainError, (envelope, item) => {
    envelope.tool = "dev_flow_get_task";
    item.tool = "dev_flow_get_task";
    item.arguments = {
      request_id: "request-redacted-other",
      host: "codex",
      task_id: "task-redacted-core-error",
    };
  });
  const duplicateItem = structuredClone(domainError);
  duplicateItem.push(structuredClone(duplicateItem[1]));
  const cases = [
    ["item and envelope tool must match", toolMismatch],
    ["non-apply caller request_id must match the Core envelope", nonApplyRequestMismatch],
    ["item IDs are unique within one session", duplicateItem],
  ];
  for (const [name, events] of cases) {
    assert.throws(() => parseCodexJSONL(encodeJSONL(events)), Error, name);
  }
});
test("HIGH-4 aggregate parity: top-level MCP facts equal four session projections", async () => {
  assert.equal(typeof sessionRuntime.aggregateSessionFacts, "function");
  assert.equal(typeof sessionRuntime.validateSessionAggregate, "function");
  const success = await currentSuccessEvents();
  const domainError = await currentDomainEvents();
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
