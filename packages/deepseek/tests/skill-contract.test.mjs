import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertSkillResources, examples, filesBelow } from "../../../tests/skills/resources.mjs";
import { checkSharedSkillReferences } from "../../../scripts/sync-skill-references.mjs";
import { authorizeDevFlowExecution } from "../lib/authorization.mjs";
import { DEV_FLOW_QUALIFIED_TOOL_NAMES } from "../lib/tool-names.mjs";
import { WORKSPACE_COORDINATOR_TOOL, authorizeWorkspaceExecution, workspaceConfirmationText, workspaceResumeText, workspaceCleanupText } from "../lib/workspace-coordinator.mjs";
import { registerWorkspaceCoordinator } from "../lib/workspace-tool.mjs";
import { preparedWrite } from "../lib/file-scope.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const skillRoot = join(packageRoot, "skills", "dev-flow");

function execution(text, name, arguments_) {
  return { name, callId: "call-example", arguments: arguments_, agent: {
    status: "running", session: { snapshotEvents: () => [
      { seq: 0, type: "turn/start", data: { turn: 1 } },
      { seq: 1, type: "user/message", data: { id: "user", source: { kind: "user" }, content: [{ type: "text", text }] } },
      { seq: 2, type: "tool/call", data: { turn: 1, callId: "call-example", name } },
    ] },
  } };
}

test("both packaged Core references match the one shared source", async () => {
  await checkSharedSkillReferences({ root: repositoryRoot });
});

test("DeepSeek references are reachable, packaged and cite existing implementation symbols", async () => {
  await assertSkillResources({ skillRoot, packageRoot, repositoryRoot });
});

test("every shared Core example uses the actual DeepSeek namespace and Host value", async () => {
  const names = new Set();
  for (const path of await filesBelow(skillRoot)) {
    if (!path.endsWith(".md")) continue;
    for (const example of examples(await readFile(path, "utf8"), "mcp")) {
      const name = `mcp__dev_flow__${example.operation}`;
      assert.ok(DEV_FLOW_QUALIFIED_TOOL_NAMES.includes(name), name);
      names.add(name);
      if (example.operation !== "dev_flow_server_info") assert.equal(example.value.host, "deepseek");
    }
  }
  assert.deepEqual([...names].sort(), [...DEV_FLOW_QUALIFIED_TOOL_NAMES].sort());
  const name = "mcp__dev_flow__dev_flow_get_task";
  const args = { host: "deepseek", task_id: "task-example" };
  assert.equal(authorizeDevFlowExecution(execution("/dev-flow continue", name, args)), undefined);
  assert.match(authorizeDevFlowExecution(execution("continue", name, args)), /SELECTOR_REQUIRED/u);
});

test("all workspace examples match registered operations and exact current-turn confirmations", async () => {
  let registered;
  registerWorkspaceCoordinator({ tools: {
    guard() { return () => {}; }, register(definition) { registered = definition; return () => {}; },
  } }, { dataDirectory: "/private/tmp/dev-flow-schema", workspaceRoot: "/work/project" });
  const seen = new Set();
  for (const path of ["admission.md", "host-lifecycle.md"]) {
    const text = await readFile(join(skillRoot, "references", path), "utf8");
    for (const example of examples(text, "workspace")) {
      const args = example.value;
      assert.equal(example.operation, WORKSPACE_COORDINATOR_TOOL);
      assert.ok(registered.parameters.properties.operation.enum.includes(args.operation));
      for (const key of Object.keys(args)) assert.ok(Object.hasOwn(registered.parameters.properties, key), key);
      const message = text.match(new RegExp(`<!-- workspace-confirmation:${args.operation} -->\\n\x60\x60\x60text\\n([\\s\\S]*?)\\n\x60\x60\x60`, "u"))?.[1];
      assert.ok(message, args.operation);
      const expected = args.operation === "provision" ? workspaceConfirmationText(args.repositories)
        : args.operation === "consume" ? workspaceResumeText(args.launch_id)
          : workspaceCleanupText(args.operation, { launchID: args.launch_id, repositoryKey: args.repository_key, taskID: args.task_id, revision: args.revision });
      assert.equal(message, expected);
      assert.doesNotThrow(() => authorizeWorkspaceExecution(execution(message, WORKSPACE_COORDINATOR_TOOL, args)));
      assert.throws(() => authorizeWorkspaceExecution(execution("/dev-flow continue", WORKSPACE_COORDINATOR_TOOL, args)), /REQUIRED/u);
      seen.add(args.operation);
    }
  }
  assert.deepEqual([...seen].sort(), [...registered.parameters.properties.operation.enum].sort());
});

test("DSH write example uses the actual prepared-write path and Host contract", async () => {
  const text = await readFile(join(skillRoot, "references", "artifacts.md"), "utf8");
  const example = examples(text, "dsh-write")[0].value;
  const prepared = preparedWrite(example, resolve("/work/tasks/project"));
  assert.equal(prepared.host, "deepseek");
  assert.equal(prepared.tool_name, "edit");
  assert.deepEqual(prepared.paths, [resolve("/work/tasks/project/src/endpoint.js")]);
  assert.equal(prepared.path_parse_complete, true);
  assert.match(prepared.intent_digest, /^[0-9a-f]{64}$/u);
});
