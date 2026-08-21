import {
  isDevFlowNamespaceTool,
  isExpectedDevFlowTool,
} from "./tool-names.mjs";

export const DENIAL_CODES = Object.freeze({
  SELECTOR_REQUIRED: "DEV_FLOW_SELECTOR_REQUIRED",
  UNEXPECTED_TOOL: "DEV_FLOW_UNEXPECTED_TOOL",
  NO_AGENT: "DEV_FLOW_NO_AGENT",
  NO_OPEN_TURN: "DEV_FLOW_NO_OPEN_TURN",
});

const selectorPattern = /(^|\s)\/dev-flow(?=\s|$)/u;
const selectorInstruction = "include a whitespace-bounded /dev-flow in the current direct user turn";

export function hasDirectUserSelector(message) {
  if (message?.source?.kind !== "user" || !Array.isArray(message.content)) return false;
  return message.content.some(
    (block) => block?.type === "text"
      && typeof block.text === "string"
      && selectorPattern.test(block.text),
  );
}

export function deriveCurrentTurn(execution) {
  try {
    const agent = execution?.agent;
    if (agent?.status !== "running" || !Array.isArray(agent.session?.events)) return undefined;
    const events = agent.session.events;
    const matchingCalls = events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event?.type === "tool/call"
        && String(event.data?.callId) === String(execution.callId));

    if (matchingCalls.length === 1) {
      return deriveDurableCallTurn(execution, events, matchingCalls[0]);
    }
    if (matchingCalls.length > 1 || execution.parent === undefined) return undefined;
    return deriveNestedTurn(events);
  } catch {
    return undefined;
  }
}

export function authorizeDevFlowExecution(execution) {
  if (!isDevFlowNamespaceTool(execution?.name)) return undefined;
  if (!isExpectedDevFlowTool(execution.name)) {
    return `${DENIAL_CODES.UNEXPECTED_TOOL}: the Dev Flow namespace permits only the six contracted tools.`;
  }
  if (execution.agent === undefined) {
    return `${DENIAL_CODES.NO_AGENT}: ${selectorInstruction}.`;
  }

  const turn = deriveCurrentTurn(execution);
  if (turn === undefined) {
    return `${DENIAL_CODES.NO_OPEN_TURN}: ${selectorInstruction}.`;
  }
  if (!turn.selectorPresent) {
    return `${DENIAL_CODES.SELECTOR_REQUIRED}: ${selectorInstruction}.`;
  }
  return undefined;
}

export function registerDevFlowGuard(ctx) {
  return ctx.tools.guard(authorizeDevFlowExecution);
}

function deriveDurableCallTurn(execution, events, matchingCall) {
  const { event: callEvent, index: callIndex } = matchingCall;
  if (callEvent.data?.name !== execution.name) return undefined;
  const turn = callEvent.data?.turn;
  if (!Number.isInteger(turn)) return undefined;

  const starts = events
    .slice(0, callIndex + 1)
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event?.type === "turn/start" && event.data?.turn === turn);
  if (starts.length !== 1) return undefined;
  const start = starts[0];

  for (let index = start.index + 1; index < events.length; index += 1) {
    const event = events[index];
    if (event?.type === "turn/start") return undefined;
    if (event?.type === "turn/end" && event.data?.turn === turn) return undefined;
  }
  return projectTurn(events, start, callIndex, turn, callEvent.seq);
}

function deriveNestedTurn(events) {
  let open;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event?.type === "turn/start") {
      if (open !== undefined || !Number.isInteger(event.data?.turn)) return undefined;
      open = { event, index };
    } else if (event?.type === "turn/end") {
      if (open === undefined || event.data?.turn !== open.event.data?.turn) return undefined;
      open = undefined;
    }
  }
  if (open === undefined) return undefined;
  return projectTurn(events, open, events.length, open.event.data.turn, undefined);
}

function projectTurn(events, start, endIndex, turn, callSeq) {
  const messages = events
    .slice(start.index + 1, endIndex)
    .filter((event) => event?.type === "user/message" && event.data?.source?.kind === "user")
    .map((event) => event.data);
  return Object.freeze({
    turn,
    startSeq: start.event.seq,
    ...(callSeq === undefined ? {} : { callSeq }),
    directUserMessageIds: Object.freeze(messages.map((message) => message.id)),
    selectorPresent: messages.some(hasDirectUserSelector),
  });
}
