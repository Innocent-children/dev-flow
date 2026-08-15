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

test("fake Core serves the exact six schemas and complete structured results", async (t) => {
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
  assert.deepEqual(tools[4].inputSchema.required, [
    "request_id",
    "host",
    "task_id",
    "revision",
    "action_id",
    "action_kind",
    "repository_binding_digest",
    "payload",
  ]);

  const info = await client.callTool("dev_flow_server_info", {});
  assert.equal(info.ok, true);
  assert.equal(info.result.product, "dev-flow");
  assert.deepEqual(info.result.tools, exactTools);
  await client.close();
});

test("driver creates once, resumes by omitting the contract, and surfaces Core conflicts", async (t) => {
  const fixture = await makeFixture(t, "resume");
  const first = await fixture.client({ session: "session-create" });
  const opened = await first.callTool("dev_flow_open_task", newTaskArguments());
  assert.equal(opened.result.created, true);
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

  const calls = await fixture.toolCalls();
  assert.deepEqual(Object.keys(calls[0].arguments).sort(), ["host", "new_task", "repository_path"]);
  assert.deepEqual(Object.keys(calls[1].arguments).sort(), ["host", "repository_path"]);

  const conflictFixture = await makeFixture(t, "conflict");
  const conflictClient = await conflictFixture.client({ selectedCase: "conflict" });
  const conflict = await conflictClient.callTool("dev_flow_open_task", newTaskArguments());
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, "ACTIVE_TASK_CONFLICT");
  await conflictClient.close();

  const hostFixture = await makeFixture(t, "host-conflict");
  const hostClient = await hostFixture.client({ selectedCase: "host-conflict" });
  const hostConflict = await hostClient.callTool("dev_flow_open_task", newTaskArguments());
  assert.equal(hostConflict.ok, false);
  assert.equal(hostConflict.error.code, "HOST_OWNERSHIP_CONFLICT");
  await hostClient.close();
});

test("driver forwards one closed action identity and continues from the complete success result", async (t) => {
  const fixture = await makeFixture(t, "success");
  const client = await fixture.client();
  const opened = await client.callTool("dev_flow_open_task", newTaskArguments());
  const action = opened.result.task.current_action;
  const payload = assessmentPayload();
  const requestId = "request-driver-apply-0001";
  const arguments_ = applyArguments(action, payload, requestId);
  const applied = await client.callTool("dev_flow_apply_action", arguments_);

  assert.equal(applied.ok, true);
  assert.equal(applied.request_id, requestId);
  assert.equal(applied.result.task.revision, 4);
  assert.equal(applied.result.task.current_action.action_id, "action-verify-0004");
  assert.equal(applied.result.task.current_action.kind, "VERIFY_CHANGE");
  const calls = await fixture.toolCalls();
  const forwarded = calls.find((call) => call.name === "dev_flow_apply_action").arguments;
  assert.deepEqual(forwarded, arguments_);
  assert.deepEqual(Object.keys(forwarded).sort(), [
    "action_id",
    "action_kind",
    "host",
    "payload",
    "repository_binding_digest",
    "request_id",
    "revision",
    "task_id",
  ]);
  await client.close();
});

test("lost and truncated mutations force task and next-action reads before any retry", async (t) => {
  for (const selectedCase of ["loss", "truncation"]) {
    await t.test(selectedCase, async () => {
      const fixture = await makeFixture(t, `uncertain-${selectedCase}`);
      const mutating = await fixture.client({ selectedCase, session: "session-uncertain" });
      const opened = await mutating.callTool("dev_flow_open_task", newTaskArguments());
      const action = opened.result.task.current_action;
      const requestId = `request-${selectedCase}-0001`;
      const submitted = applyArguments(action, assessmentPayload(), requestId);
      await assert.rejects(
        mutating.callTool("dev_flow_apply_action", submitted),
        (error) => error.uncertain === true,
      );
      await mutating.close();

      const recovering = await fixture.client({ session: "session-recovery" });
      const operationProbe = {
        operation_id: requestId,
        source_phase: "INTAKE",
        expected_revision: action.revision,
        action_id: action.action_id,
        action_kind: action.kind,
        repository_binding_digest: action.repository_binding_digest,
        payload: submitted.payload,
      };
      const task = await recovering.callTool("dev_flow_get_task", {
        host: "codex",
        task_id: action.task_id,
        operation_probe: operationProbe,
      });
      const next = await recovering.callTool("dev_flow_get_next_action", {
        host: "codex",
        task_id: action.task_id,
        operation_probe: operationProbe,
      });
      assert.equal(task.result.recovery_assessment.classification, "completed_and_recorded");
      assert.equal(task.result.recovery_assessment.operation.operation_id, requestId);
      assert.equal(next.result.revision, 4);
      await recovering.close();

      const calls = await fixture.toolCalls();
      assert.deepEqual(
        calls.map((call) => call.name),
        [
          "dev_flow_open_task",
          "dev_flow_apply_action",
          "dev_flow_get_task",
          "dev_flow_get_next_action",
        ],
      );
      assert.equal(calls.filter((call) => call.name === "dev_flow_apply_action").length, 1);
    });
  }
});

test("driver preserves budget, blocker, cancellation, and Core terminal outcomes", async (t) => {
  const domainFixture = await makeFixture(t, "domain-error");
  const domainClient = await domainFixture.client({ selectedCase: "domain-error" });
  const domainOpen = await domainClient.callTool("dev_flow_open_task", newTaskArguments());
  const domainError = await domainClient.callTool(
    "dev_flow_apply_action",
    applyArguments(domainOpen.result.task.current_action, assessmentPayload(), "request-domain-0001"),
  );
  assert.equal(domainError.ok, false);
  assert.equal(domainError.error.code, "ACTION_STALE");
  await domainClient.close();
  assert.equal((await domainFixture.journeyState()).apply_count, 0);

  const budgetFixture = await makeFixture(t, "budget");
  const budgetClient = await budgetFixture.client({ selectedCase: "budget" });
  const budgetOpen = await budgetClient.callTool("dev_flow_open_task", newTaskArguments());
  assert.equal(budgetOpen.result.task.contract.verification_budget.max_automatic_commands, 2);
  const budget = await budgetClient.callTool(
    "dev_flow_apply_action",
    applyArguments(budgetOpen.result.task.current_action, assessmentPayload(), "request-budget-0001"),
  );
  assert.equal(budget.ok, false);
  assert.equal(budget.error.code, "VERIFICATION_BUDGET_EXCEEDED");
  await budgetClient.close();
  assert.equal((await budgetFixture.journeyState()).apply_count, 0);

  const blockerFixture = await makeFixture(t, "blocker");
  const blockerClient = await blockerFixture.client({ selectedCase: "blocker" });
  const blockerOpen = await blockerClient.callTool("dev_flow_open_task", newTaskArguments());
  const blocker = await blockerClient.callTool(
    "dev_flow_apply_action",
    applyArguments(blockerOpen.result.task.current_action, assessmentPayload(), "request-blocker-0001"),
  );
  assert.equal(blocker.result.task.phase, "BLOCKED");
  assert.equal(blocker.result.task.blocker.code, "TASK_BLOCKED");
  await blockerClient.close();

  const terminalFixture = await makeFixture(t, "terminal");
  const terminalClient = await terminalFixture.client({ selectedCase: "terminal" });
  const terminalOpen = await terminalClient.callTool("dev_flow_open_task", newTaskArguments());
  const terminal = await terminalClient.callTool(
    "dev_flow_apply_action",
    applyArguments(terminalOpen.result.task.current_action, assessmentPayload(), "request-terminal-0001"),
  );
  assert.equal(terminal.result.task.phase, "DONE");
  assert.equal(terminal.result.task.outcome.status, "completed");
  await terminalClient.close();

  const cancelFixture = await makeFixture(t, "cancel");
  const cancelClient = await cancelFixture.client({ selectedCase: "cancellation" });
  const cancelled = await cancelClient.callTool("dev_flow_cancel_task", {
    host: "codex",
    task_id: "task-00000002",
    revision: 4,
    reason: "User explicitly requested cancellation.",
  });
  assert.equal(cancelled.result.task.phase, "CANCELLED");
  assert.equal(cancelled.result.task.outcome.status, "cancelled");
  await cancelClient.close();
});

test("fake Core rejects unknown argument members before dispatch", async (t) => {
  const fixture = await makeFixture(t, "closed");
  const client = await fixture.client();
  await assert.rejects(
    client.callTool("dev_flow_server_info", { alias: "forbidden" }),
    (error) => error.rpcCode === -32602 && /unexpected field alias/.test(error.message),
  );
  await client.close();
});

function newTaskArguments() {
  return {
    host: "codex",
    repository_path: "/workspace/example",
    new_task: {
      goal: "Complete one bounded fake-Core contract task",
      scope: ["one repository"],
      out_of_scope: ["real host"],
      acceptance_criteria: ["Core returns its terminal outcome."],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 2,
        allow_full_suite: false,
        allow_manual_handoff: true,
      },
    },
  };
}

function assessmentPayload() {
  return {
    result: "succeeded",
    summary: "Assessed the bounded fake task.",
    constraints: ["no real host"],
    risks: [],
    intended_changed_surface: ["temporary fixture"],
    verification_budget_acknowledged: true,
  };
}

function applyArguments(action, payload, requestId) {
  return {
    request_id: requestId,
    host: "codex",
    task_id: action.task_id,
    revision: action.revision,
    action_id: action.action_id,
    action_kind: action.kind,
    repository_binding_digest: action.repository_binding_digest,
    payload,
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
    root,
    statePath,
    tracePath,
    async client({ selectedCase = "success", session = "session-1", lossOnApply = 0 } = {}) {
      const client = await FakeCoreClient.start({ statePath, tracePath, selectedCase, session, lossOnApply });
      clients.push(client);
      return client;
    },
    async toolCalls() {
      const state = JSON.parse(await readFile(statePath, "utf8"));
      return state.calls;
    },
    async journeyState() {
      const state = JSON.parse(await readFile(statePath, "utf8"));
      return state.journey;
    },
  };
}

class FakeCoreClient {
  static async start(options) {
    const client = new FakeCoreClient(options);
    await client.initialize();
    return client;
  }

  constructor({ statePath, tracePath, selectedCase, session, lossOnApply }) {
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = "";
    this.exited = false;
    this.child = spawn(fakeCorePath, [], {
      env: {
        ...process.env,
        FAKE_CORE_STATE: statePath,
        FAKE_CORE_TRACE: tracePath,
        FAKE_CORE_CASE: selectedCase,
        FAKE_CORE_SESSION: session,
        FAKE_CORE_LOSS_ON_APPLY: String(lossOnApply),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.exitPromise = once(this.child, "exit").then(([code, signal]) => {
      this.exited = true;
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
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      const response = JSON.parse(line);
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      pending.resolve(response);
    });
  }

  async initialize() {
    const response = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-fake-driver", version: "0.1.0" },
    });
    assert.equal(response.result.serverInfo.name, "dev-flow-fake-core");
    this.notify("notifications/initialized", {});
  }

  async listTools() {
    const response = await this.request("tools/list", {});
    return response.result.tools;
  }

  async callTool(name, arguments_) {
    const response = await this.request("tools/call", { name, arguments: arguments_ });
    if (response.error) {
      const error = new Error(response.error.message);
      error.rpcCode = response.error.code;
      throw error;
    }
    const result = response.result;
    if (!result || !isObject(result.structuredContent)) {
      const error = new Error(`tool ${name} returned no complete structured result`);
      error.uncertain = true;
      throw error;
    }
    assert.equal(result.content.length, 1);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    return result.structuredContent;
  }

  request(method, params) {
    if (this.exited) {
      const error = new Error("fake Core is already closed");
      error.uncertain = true;
      return Promise.reject(error);
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(`fake Core request timed out: ${method}`);
        error.uncertain = true;
        reject(error);
      }, 3_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async close() {
    if (!this.exited) this.child.stdin.end();
    await this.exitPromise;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
