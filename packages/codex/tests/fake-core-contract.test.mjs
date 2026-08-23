import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";

const fakeCorePath = fileURLToPath(new URL("./fixtures/fake-core.mjs", import.meta.url));
const exactTools = [
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
];

test("fake Core serves the current six-tool catalog and complete structured results", async (t) => {
  const fixture = await makeFixture(t, "catalog");
  const client = await fixture.client();
  const tools = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name), exactTools);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.annotations.openWorldHint, false);
  }
  assert.deepEqual(tools[0].inputSchema.required, []);
  assert.deepEqual(tools[1].inputSchema.required, ["host", "repository_path"]);
  assert.equal(tools[1].inputSchema.properties.additional_repositories.maxItems, 7);
  assert.equal(tools[1].inputSchema.properties.additional_repositories.items.additionalProperties, false);
  assert.deepEqual(tools[1].inputSchema.properties.additional_repositories.items.required, ["key", "repository_path"]);
  assert.deepEqual(tools[4].inputSchema.required, [
    "request_id",
    "host",
    "task_id",
    "revision",
    "action_id",
    "action_kind",
    "process_id",
    "process_definition_digest",
    "source_cursor",
    "repository_binding_digest",
    "payload",
  ]);
  const info = await client.callTool("dev_flow_server_info", {});
  assert.deepEqual(info.result.method_profiles, ["plain", "spec-kit", "openspec"]);
  assert.deepEqual(info.result.host_preferences, {
    codex: { codebase_memory: false },
    deepseek: { codebase_memory: true },
  });
  assert.deepEqual(info.result.tools, exactTools);
});

test("fake Core projects one multi-repository task, Action, revision, and digest", async (t) => {
  const fixture = await makeFixture(t, "multi-repository");
  const client = await fixture.client();
  const opened = await client.callTool("dev_flow_open_task", {
    ...openArguments(),
    repository_path: "/workspace/core",
    primary_repository_key: "core",
    additional_repositories: [{ key: "docs", repository_path: "/workspace/docs" }],
  });
  assert.equal(opened.result.task.primary_repository_key, "core");
  assert.equal(opened.result.task.repository.canonical_root, "/workspace/core");
  assert.deepEqual(opened.result.task.additional_repositories.map(({ key, repository }) => ({
    key, root: repository.canonical_root,
  })), [{ key: "docs", root: "/workspace/docs" }]);
  assert.equal(opened.result.task.revision, 1);
  assert.equal(typeof opened.result.task.current_action.repository_binding_digest, "string");
  assert.equal(Object.hasOwn(opened.result.task.current_action, "repository_scope_digest"), false);

  const calls = await fixture.toolCalls();
  assert.deepEqual(calls.find((call) => call.name === "dev_flow_open_task").arguments.additional_repositories, [
    { key: "docs", repository_path: "/workspace/docs" },
  ]);
});

test("driver creates and resumes one graph task while surfacing Core conflicts", async (t) => {
  const fixture = await makeFixture(t, "resume");
  const first = await fixture.client({ session: "session-create" });
  const opened = await first.callTool("dev_flow_open_task", openArguments());
  assert.equal(opened.result.created, true);
  assert.equal(opened.result.task.current_cursor, "REQUIREMENTS");
  assert.equal(opened.result.task.primary_repository_key, "primary");
  assert.deepEqual(opened.result.task.additional_repositories, []);
  const taskId = opened.result.task.task_id;
  await first.close();

  const resumedClient = await fixture.client({ session: "session-resume" });
  const resumed = await resumedClient.callTool("dev_flow_open_task", {
    host: "codex",
    repository_path: "/workspace/example",
  });
  assert.equal(resumed.result.created, false);
  assert.equal(resumed.result.task.task_id, taskId);
  await resumedClient.close();

  const conflictFixture = await makeFixture(t, "conflict");
  const conflictClient = await conflictFixture.client({ selectedCase: "conflict" });
  assert.equal((await conflictClient.callTool("dev_flow_open_task", openArguments())).error.code, "ACTIVE_TASK_CONFLICT");

  const hostFixture = await makeFixture(t, "host-conflict");
  const hostClient = await hostFixture.client({ selectedCase: "host-conflict" });
  assert.equal((await hostClient.callTool("dev_flow_open_task", openArguments())).error.code, "HOST_OWNERSHIP_CONFLICT");
});

test("driver forwards one closed graph action identity and continues from Core result", async (t) => {
  const fixture = await makeFixture(t, "success");
  const client = await fixture.client();
  const opened = await client.callTool("dev_flow_open_task", openArguments());
  const action = opened.result.task.current_action;
  const requestId = "request-graph-apply-0001";
  const submitted = applyArguments(action, requestId);
  const applied = await client.callTool("dev_flow_apply_action", submitted);
  assert.equal(applied.result.task.current_cursor, "DESIGN");
  assert.deepEqual(applied.result.task.current_action.available_transitions.map((edge) => edge.transition_id), [
    "design_ready",
    "design_requires_requirements",
  ]);
  const calls = await fixture.toolCalls();
  assert.deepEqual(calls.find((call) => call.name === "dev_flow_apply_action").arguments, submitted);
});

test("lost and truncated graph mutations force exact reads before retry", async (t) => {
  for (const selectedCase of ["loss", "truncation"]) {
    await t.test(selectedCase, async () => {
      const fixture = await makeFixture(t, selectedCase);
      const mutating = await fixture.client({ selectedCase, session: "session-uncertain" });
      const opened = await mutating.callTool("dev_flow_open_task", openArguments());
      const action = opened.result.task.current_action;
      const requestId = `request-${selectedCase}-0001`;
      const submitted = applyArguments(action, requestId);
      await assert.rejects(mutating.callTool("dev_flow_apply_action", submitted), (error) => error.uncertain === true);
      await mutating.close();

      const probe = {
        operation_id: requestId,
        process_id: action.process.process_id,
        process_definition_digest: action.process.definition_digest,
        source_cursor: action.current_node,
        expected_revision: action.revision,
        action_id: action.action_id,
        action_kind: action.kind,
        repository_binding_digest: action.repository_binding_digest,
        payload: submitted.payload,
      };
      const recovering = await fixture.client({ session: "session-recovery" });
      const task = await recovering.callTool("dev_flow_get_task", { host: "codex", task_id: action.task_id, operation_probe: probe });
      const next = await recovering.callTool("dev_flow_get_next_action", { host: "codex", task_id: action.task_id, operation_probe: probe });
      assert.equal(task.result.recovery_assessment.classification, "completed_and_recorded");
      assert.equal(task.result.recovery_assessment.operation.source_cursor, "REQUIREMENTS");
      assert.equal(next.result.current_cursor, "DESIGN");
      const calls = await fixture.toolCalls();
      assert.equal(calls.filter((call) => call.name === "dev_flow_apply_action").length, 1);
    });
  }
});

test("driver preserves graph errors, blocker, cancellation, and terminal outcomes", async (t) => {
  for (const [selectedCase, code] of [["domain-error", "ACTION_STALE"], ["budget", "VERIFICATION_BUDGET_EXCEEDED"]]) {
    const fixture = await makeFixture(t, selectedCase);
    const client = await fixture.client({ selectedCase });
    const opened = await client.callTool("dev_flow_open_task", openArguments());
    const result = await client.callTool("dev_flow_apply_action", applyArguments(opened.result.task.current_action, `request-${selectedCase}`));
    assert.equal(result.error.code, code);
  }

  const blockerFixture = await makeFixture(t, "blocker");
  const blockerClient = await blockerFixture.client({ selectedCase: "blocker" });
  const blockerOpen = await blockerClient.callTool("dev_flow_open_task", openArguments());
  const blocked = await blockerClient.callTool("dev_flow_apply_action", applyArguments(blockerOpen.result.task.current_action, "request-blocker"));
  assert.equal(blocked.result.task.current_cursor, "BLOCKED");
  assert.equal(blocked.result.task.resume_cursor, "REQUIREMENTS");

  const terminalFixture = await makeFixture(t, "terminal");
  const terminalClient = await terminalFixture.client({ selectedCase: "terminal" });
  const terminalOpen = await terminalClient.callTool("dev_flow_open_task", openArguments());
  const terminal = await terminalClient.callTool("dev_flow_apply_action", applyArguments(terminalOpen.result.task.current_action, "request-terminal"));
  assert.equal(terminal.result.task.current_cursor, "DONE");
  assert.equal(terminal.result.task.outcome.status, "completed");

  const cancelFixture = await makeFixture(t, "cancel");
  const cancelClient = await cancelFixture.client();
  const cancelled = await cancelClient.callTool("dev_flow_cancel_task", {
    request_id: "request-cancel",
    host: "codex",
    task_id: "task-graph-0001",
    revision: 1,
    reason: "User explicitly requested cancellation.",
  });
  assert.equal(cancelled.result.task.current_cursor, "CANCELLED");
  assert.equal(cancelled.result.task.outcome.status, "cancelled");
});

test("fake Core rejects unknown argument members before dispatch", async (t) => {
  const fixture = await makeFixture(t, "closed");
  const client = await fixture.client();
  await assert.rejects(
    client.callTool("dev_flow_server_info", { alias: "forbidden" }),
    (error) => error.rpcCode === -32602 && /unexpected field alias/.test(error.message),
  );
});

function openArguments() {
  return {
    host: "codex",
    repository_path: "/workspace/example",
    new_task: {
      request: "Define one bounded graph requirement.",
      initial_scope: ["one repository"],
      initial_out_of_scope: ["real host"],
      known_acceptance_criteria: [],
      verification_budget: { level: "targeted", max_automatic_commands: 2, allow_full_suite: false, allow_manual_handoff: true },
      method_profile: "plain",
    },
  };
}

function applyArguments(action, requestId) {
  return {
    request_id: requestId,
    host: "codex",
    task_id: action.task_id,
    revision: action.revision,
    action_id: action.action_id,
    action_kind: action.kind,
    process_id: action.process.process_id,
    process_definition_digest: action.process.definition_digest,
    source_cursor: action.current_node,
    repository_binding_digest: action.repository_binding_digest,
    payload: {
      transition_id: "requirements_ready",
      summary: "Requirements are bounded and testable.",
      reason: "",
      artifacts: [],
      method_evidence: [
        { step_id: "requirements.capture", status: "plain_fallback", capability: "", summary: "Captured requirements." },
        { step_id: "requirements.clarify", status: "plain_fallback", capability: "", summary: "Resolved material questions." },
        { step_id: "requirements.validate", status: "plain_fallback", capability: "", summary: "Validated requirements." },
      ],
      node_result: {
        problem_class: "none",
        baseline: {
          goal: "Define one bounded graph requirement.",
          scope: ["one repository"],
          out_of_scope: ["real host"],
          acceptance_criteria: ["The graph task reaches DESIGN."],
          constraints: [],
          assumptions: [],
        },
        unresolved_questions: [],
      },
    },
  };
}

async function makeFixture(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), `dev-flow-fake-core-${name}-`)));
  const statePath = join(root, "state.json");
  const tracePath = join(root, "trace.jsonl");
  const clients = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await rm(root, { recursive: true, force: true });
  });
  return {
    async client({ selectedCase = "success", session = "session-1" } = {}) {
      const client = await FakeCoreClient.start({ statePath, tracePath, selectedCase, session });
      clients.push(client);
      return client;
    },
    async toolCalls() {
      return JSON.parse(await readFile(statePath, "utf8")).calls;
    },
  };
}

class FakeCoreClient {
  static async start(options) {
    const client = new FakeCoreClient(options);
    await client.initialize();
    return client;
  }

  constructor({ statePath, tracePath, selectedCase, session }) {
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = "";
    this.closed = false;
    this.child = spawn(fakeCorePath, [], {
      env: { ...process.env, FAKE_CORE_STATE: statePath, FAKE_CORE_TRACE: tracePath, FAKE_CORE_CASE: selectedCase, FAKE_CORE_SESSION: session },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.exitPromise = once(this.child, "exit").then(([code, signal]) => {
      const error = new Error(`fake Core exited before a complete result (${code ?? signal})${this.stderr ? `: ${this.stderr.trim()}` : ""}`);
      error.uncertain = true;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(error);
      }
      this.pending.clear();
      return { code, signal };
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    createInterface({ input: this.child.stdout, crlfDelay: Infinity }).on("line", (line) => {
      const response = JSON.parse(line);
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      pending.resolve(response);
    });
  }

  async initialize() {
    const response = await this.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake-driver", version: "0.2.0" } });
    assert.equal(response.result.serverInfo.name, "dev-flow-fake-core");
    this.notify("notifications/initialized", {});
  }

  async listTools() {
    return (await this.request("tools/list", {})).result.tools;
  }

  async callTool(name, arguments_) {
    const response = await this.request("tools/call", { name, arguments: arguments_ });
    if (response.error) {
      const error = new Error(response.error.message);
      error.rpcCode = response.error.code;
      throw error;
    }
    const result = response.result;
    let decoded;
    try {
      decoded = JSON.parse(result.content[0].text);
    } catch (cause) {
      const error = new Error(`fake Core returned an incomplete result for ${name}`, { cause });
      error.uncertain = true;
      throw error;
    }
    assert.deepEqual(decoded, result.structuredContent);
    return decoded;
  }

  request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`fake Core request timed out: ${method}`));
      }, 5_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.stdin.end();
    await this.exitPromise;
  }
}
