import assert from "node:assert/strict";
import test from "node:test";

import {
  DENIAL_CODES,
  authorizeDevFlowExecution,
  deriveCurrentTurn,
  hasDirectUserSelector,
  registerDevFlowGuard,
} from "../lib/authorization.mjs";
import {
  DEV_FLOW_QUALIFIED_TOOL_NAMES,
  DEV_FLOW_TOOL_NAMESPACE_PREFIX,
} from "../lib/tool-names.mjs";

const expectedTool = DEV_FLOW_QUALIFIED_TOOL_NAMES[0];

test("selector matcher accepts only the whitespace-bounded token", () => {
  for (const text of [
    "/dev-flow",
    "/dev-flow do the task",
    "please /dev-flow continue",
    "line one\n/dev-flow\nline three",
    "```\n/dev-flow\n```",
  ]) {
    assert.equal(hasDirectUserSelector(directUserMessage(text)), true, text);
  }
  for (const text of [
    "",
    "/dev-flow, continue",
    "/dev-flowx",
    "//dev-flow",
    "path/dev-flow",
  ]) {
    assert.equal(hasDirectUserSelector(directUserMessage(text)), false, text);
  }
  assert.equal(hasDirectUserSelector(injectedMessage("/dev-flow", "plugin")), false);
  assert.equal(hasDirectUserSelector(injectedMessage("/dev-flow", "skill-invocation")), false);
  assert.equal(hasDirectUserSelector({ ...directUserMessage("/dev-flow"), content: [{ type: "image" }] }), false);
});

test("derives a direct call from its durable tool/call and current turn only", () => {
  const events = [
    event(0, "turn/start", { turn: 1 }),
    event(1, "user/message", directUserMessage("/dev-flow historical", "old")),
    event(2, "turn/end", { turn: 1, reason: "completed" }),
    event(3, "turn/start", { turn: 2 }),
    event(4, "user/message", directUserMessage("ordinary current request", "current")),
    event(5, "tool/call", { turn: 2, step: 1, callId: "call-2", name: expectedTool, arguments: "{}" }),
  ];
  const execution = makeExecution({ events, callId: "call-2" });

  assert.deepEqual(deriveCurrentTurn(execution), {
    turn: 2,
    startSeq: 3,
    callSeq: 5,
    directUserMessageIds: ["current"],
    selectorPresent: false,
  });
  assert.match(authorizeDevFlowExecution(execution), new RegExp(DENIAL_CODES.SELECTOR_REQUIRED));
});

test("allows an expected tool only for an exact current direct-user selector", () => {
  const events = [
    event(0, "turn/start", { turn: 4 }),
    event(1, "user/message", injectedMessage("/dev-flow injected", "plugin", "plugin")),
    event(2, "user/message", directUserMessage("please /dev-flow continue", "direct")),
    event(3, "tool/call", { turn: 4, step: 1, callId: "call-4", name: expectedTool, arguments: "{}" }),
  ];
  const execution = makeExecution({ events, callId: "call-4" });

  assert.equal(authorizeDevFlowExecution(execution), undefined);
  assert.deepEqual(deriveCurrentTurn(execution)?.directUserMessageIds, ["direct"]);
});

test("nested Code Mode calls use the latest single open turn without a durable sub-call", () => {
  const allowed = makeExecution({
    events: [
      event(0, "turn/start", { turn: 7 }),
      event(1, "user/message", directUserMessage("/dev-flow nested", "nested-user")),
      event(2, "tool/call", { turn: 7, step: 1, callId: "outer", name: "run_code", arguments: "{}" }),
    ],
    callId: "outer:code:1",
    parent: Symbol("outer"),
  });
  assert.equal(authorizeDevFlowExecution(allowed), undefined);
  assert.equal(deriveCurrentTurn(allowed)?.callSeq, undefined);

  const denied = makeExecution({
    events: [
      event(0, "turn/start", { turn: 8 }),
      event(1, "user/message", directUserMessage("ordinary nested", "nested-user")),
    ],
    callId: "outer:code:2",
    parent: Symbol("outer"),
  });
  assert.match(authorizeDevFlowExecution(denied), new RegExp(DENIAL_CODES.SELECTOR_REQUIRED));
});

test("fails closed for unexpected tools and missing execution context", () => {
  const unexpected = makeExecution({
    name: `${DEV_FLOW_TOOL_NAMESPACE_PREFIX}future_tool`,
    events: openSelectedTurn("future-call", `${DEV_FLOW_TOOL_NAMESPACE_PREFIX}future_tool`),
    callId: "future-call",
  });
  assert.match(authorizeDevFlowExecution(unexpected), new RegExp(DENIAL_CODES.UNEXPECTED_TOOL));

  assert.match(
    authorizeDevFlowExecution({ ...unexpected, name: expectedTool, agent: undefined }),
    new RegExp(DENIAL_CODES.NO_AGENT),
  );
  assert.match(
    authorizeDevFlowExecution(makeExecution({ events: [], callId: "missing" })),
    new RegExp(DENIAL_CODES.NO_OPEN_TURN),
  );
  assert.match(
    authorizeDevFlowExecution(makeExecution({
      events: [...openSelectedTurn("closed", expectedTool), event(3, "turn/end", { turn: 1, reason: "completed" })],
      callId: "closed",
    })),
    new RegExp(DENIAL_CODES.NO_OPEN_TURN),
  );
  assert.match(
    authorizeDevFlowExecution(makeExecution({
      events: [event(0, "turn/start", { turn: 1 }), event(1, "turn/start", { turn: 2 })],
      callId: "nested",
      parent: Symbol("outer"),
    })),
    new RegExp(DENIAL_CODES.NO_OPEN_TURN),
  );
});

test("plain-context guard denies before dispatch with zero Core writes", () => {
  const guards = [];
  const ctx = { tools: { guard: (guard) => { guards.push(guard); return () => guards.splice(guards.indexOf(guard), 1); } } };
  const dispose = registerDevFlowGuard(ctx);
  let dispatches = 0;
  let coreWrites = 0;
  const execution = makeExecution({
    events: [
      event(0, "turn/start", { turn: 9 }),
      event(1, "user/message", directUserMessage("ordinary request", "ordinary")),
      event(2, "tool/call", { turn: 9, step: 1, callId: "denied", name: expectedTool, arguments: "{}" }),
    ],
    callId: "denied",
  });

  const preExecuteDecision = undefined;
  const denial = preExecuteDecision ?? guards.map((guard) => guard(execution)).find((reason) => reason !== undefined);
  if (denial === undefined) {
    dispatches += 1;
    coreWrites += 1;
  }
  assert.match(denial, new RegExp(DENIAL_CODES.SELECTOR_REQUIRED));
  assert.equal(dispatches, 0);
  assert.equal(coreWrites, 0);

  assert.equal(authorizeDevFlowExecution({ ...execution, name: "unrelated_tool" }), undefined);
  dispose();
  assert.equal(guards.length, 0);
});

function openSelectedTurn(callId, name) {
  return [
    event(0, "turn/start", { turn: 1 }),
    event(1, "user/message", directUserMessage("/dev-flow selected", "selected")),
    event(2, "tool/call", { turn: 1, step: 1, callId, name, arguments: "{}" }),
  ];
}

function makeExecution({ events, callId, name = expectedTool, parent, status = "running" }) {
  return Object.freeze({
    callId,
    rootCallId: callId,
    name,
    arguments: {},
    signal: new AbortController().signal,
    token: Symbol("execution"),
    ...(parent === undefined ? {} : { parent }),
    agent: Object.freeze({ status, session: Object.freeze({ events: Object.freeze(events) }) }),
  });
}

function event(seq, type, data) {
  return Object.freeze({ seq, time: seq, type, data: Object.freeze(data) });
}

function directUserMessage(text, id = "user") {
  return Object.freeze({
    id,
    role: "user",
    source: Object.freeze({ kind: "user" }),
    content: Object.freeze([{ type: "text", text }]),
  });
}

function injectedMessage(text, kind, id = kind) {
  return Object.freeze({
    id,
    role: "user",
    source: Object.freeze({ kind }),
    content: Object.freeze([{ type: "text", text }]),
  });
}
