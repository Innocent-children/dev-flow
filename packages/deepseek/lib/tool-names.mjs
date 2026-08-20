export const DEV_FLOW_SERVER_NAME = "dev_flow";
export const DEV_FLOW_TOOL_NAMESPACE_PREFIX = `mcp__${DEV_FLOW_SERVER_NAME}__`;

export const DEV_FLOW_RAW_TOOL_NAMES = Object.freeze([
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
]);

export const DEV_FLOW_QUALIFIED_TOOL_NAMES = Object.freeze(
  DEV_FLOW_RAW_TOOL_NAMES.map((rawName) => `${DEV_FLOW_TOOL_NAMESPACE_PREFIX}${rawName}`),
);

const expectedQualifiedTools = new Set(DEV_FLOW_QUALIFIED_TOOL_NAMES);

export function isDevFlowNamespaceTool(name) {
  return typeof name === "string" && name.startsWith(DEV_FLOW_TOOL_NAMESPACE_PREFIX);
}

export function isExpectedDevFlowTool(name) {
  return expectedQualifiedTools.has(name);
}

export function assertQualifiedToolCatalog(toolNames, { allowUnavailable = false } = {}) {
  const namespaceTools = [...toolNames]
    .filter(isDevFlowNamespaceTool)
    .sort();
  if (allowUnavailable && namespaceTools.length === 0) return Object.freeze([]);

  const expected = [...DEV_FLOW_QUALIFIED_TOOL_NAMES].sort();
  if (
    namespaceTools.length !== expected.length
    || namespaceTools.some((name, index) => name !== expected[index])
  ) {
    throw new Error(
      `Dev Flow tool catalog mismatch: received ${JSON.stringify(namespaceTools)}; expected ${JSON.stringify(expected)}`,
    );
  }
  return DEV_FLOW_QUALIFIED_TOOL_NAMES;
}
