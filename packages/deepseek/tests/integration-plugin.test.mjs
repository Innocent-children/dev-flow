import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  activateDeepSeekIntegration,
  apply,
  inject,
  name,
} from "../lib/index.mjs";
import {
  DEV_FLOW_QUALIFIED_TOOL_NAMES,
  DEV_FLOW_TOOL_NAMESPACE_PREFIX,
  assertQualifiedToolCatalog,
} from "../lib/tool-names.mjs";

test("plugin identity and injection surface are fixed", () => {
  assert.equal(name, "dev-flow-deepseek");
  assert.deepEqual(inject, ["skills", "tools"]);
  assert.equal(typeof apply, "function");
  assert.equal(DEV_FLOW_TOOL_NAMESPACE_PREFIX, "mcp__dev_flow__");
  assert.deepEqual(DEV_FLOW_QUALIFIED_TOOL_NAMES, [
    "mcp__dev_flow__dev_flow_server_info",
    "mcp__dev_flow__dev_flow_open_task",
    "mcp__dev_flow__dev_flow_get_task",
    "mcp__dev_flow__dev_flow_get_next_action",
    "mcp__dev_flow__dev_flow_apply_action",
    "mcp__dev_flow__dev_flow_cancel_task",
  ]);
});

test("registers one user-only Skill, one guard, and the official MCP child config", async (t) => {
  const dataDirectory = await temporaryDirectory(t, "data");
  const fake = createFakeContext({ initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });

  await activateDeepSeekIntegration(fake.ctx, {
    environment: { DEV_FLOW_DATA_DIR: dataDirectory },
  });

  assert.equal(fake.skills.length, 1);
  assert.deepEqual(fake.skills[0].invocation, {
    modelInvocable: false,
    userInvocable: true,
  });
  assert.equal(fake.skills[0].name, "dev-flow");
  assert.equal(fake.skills[0].provider, "dev-flow-deepseek");
  assert.equal(fake.skills[0].resourceBase.kind, "directory");
  assert.match(fake.skills[0].content, /# Dev Flow/u);
  assert.equal(fake.guards.length, 1);
  assert.equal(fake.children.length, 1);
  assert.equal(fake.children[0].plugin.name, "mcp-client");
  assert.deepEqual(fake.children[0].config, {
    transport: "stdio",
    serverName: "dev_flow",
    command: join(fake.packageRoot, "runtime", "darwin-arm64", "dev-flow"),
    args: ["mcp", "--stdio"],
    env: { DEV_FLOW_DATA_DIR: dataDirectory },
    cwd: fake.packageRoot,
    toolCallTimeoutMs: 60_000,
    failOnStartupError: false,
    reconnect: {
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 30_000,
      maxAttempts: 10,
    },
  });
  assert.deepEqual(assertQualifiedToolCatalog(fake.toolNames()), DEV_FLOW_QUALIFIED_TOOL_NAMES);

  await fake.dispose();
  assert.equal(fake.skills.length, 0);
  assert.equal(fake.guards.length, 0);
  assert.equal(fake.toolNames().some((toolName) => toolName.startsWith("mcp__dev_flow__")), false);
  assert.equal(fake.children[0].disposed, true);
});

test("ordinary host tools remain executable and reconnect restores the exact catalog", async (t) => {
  const dataDirectory = await temporaryDirectory(t, "reconnect-data");
  const fake = createFakeContext({ initialToolNames: [], unrelatedToolNames: ["read_file"] });
  await activateDeepSeekIntegration(fake.ctx, {
    environment: { DEV_FLOW_DATA_DIR: dataDirectory },
  });

  let unrelatedDispatches = 0;
  const unrelatedDenial = fake.guards
    .map((guard) => guard({ name: "read_file" }))
    .find((reason) => reason !== undefined);
  if (unrelatedDenial === undefined) unrelatedDispatches += 1;
  assert.equal(unrelatedDispatches, 1);

  fake.replaceMcpCatalog(DEV_FLOW_QUALIFIED_TOOL_NAMES);
  await nextMicrotask();
  assert.deepEqual(assertQualifiedToolCatalog(fake.toolNames()), DEV_FLOW_QUALIFIED_TOOL_NAMES);
  assert.equal(fake.children[0].disposed, false);
});

test("missing or extra connected namespace tools fail compatibility and dispose the MCP child", async (t) => {
  const dataDirectory = await temporaryDirectory(t, "catalog-data");
  const fake = createFakeContext({ initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });
  await activateDeepSeekIntegration(fake.ctx, {
    environment: { DEV_FLOW_DATA_DIR: dataDirectory },
  });

  fake.replaceMcpCatalog(DEV_FLOW_QUALIFIED_TOOL_NAMES.slice(0, 5));
  await nextMicrotask();
  assert.equal(fake.children[0].disposed, true);
  assert.equal(fake.toolNames().some((toolName) => toolName.startsWith(DEV_FLOW_TOOL_NAMESPACE_PREFIX)), false);
  assert.equal(fake.errors.some((message) => message.includes("catalog mismatch")), true);

  assert.throws(
    () => assertQualifiedToolCatalog([...DEV_FLOW_QUALIFIED_TOOL_NAMES, "mcp__dev_flow__future_tool"]),
    /catalog mismatch/,
  );
});

test("preflight failure contributes no Skill, guard, or MCP child", async (t) => {
  const dataDirectory = await temporaryDirectory(t, "unsupported-data");
  const fake = createFakeContext({ initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });
  await assert.rejects(
    activateDeepSeekIntegration(fake.ctx, {
      environment: { DEV_FLOW_DATA_DIR: dataDirectory },
      platform: "linux",
      arch: "arm64",
    }),
    /unsupported platform/,
  );
  assert.equal(fake.skills.length, 0);
  assert.equal(fake.guards.length, 0);
  assert.equal(fake.children.length, 0);
});

function createFakeContext({ initialToolNames, unrelatedToolNames = [] }) {
  const skills = [];
  const guards = [];
  const listeners = [];
  const effects = [];
  const children = [];
  const errors = [];
  const definitions = new Set(unrelatedToolNames);
  let mcpNames = new Set();
  const packageRoot = new URL("..", import.meta.url).pathname.replace(/\/$/u, "");

  const emitToolsChange = () => {
    for (const listener of [...listeners]) listener();
  };
  const replaceMcpCatalog = (names) => {
    for (const toolName of mcpNames) definitions.delete(toolName);
    mcpNames = new Set(names);
    for (const toolName of mcpNames) definitions.add(toolName);
    emitToolsChange();
  };

  const ctx = {
    skills: {
      register(skill) {
        skills.push(skill);
        const dispose = () => {
          const index = skills.indexOf(skill);
          if (index >= 0) skills.splice(index, 1);
        };
        effects.push(dispose);
        return dispose;
      },
    },
    tools: {
      guard(guard) {
        guards.push(guard);
        const dispose = () => {
          const index = guards.indexOf(guard);
          if (index >= 0) guards.splice(index, 1);
        };
        effects.push(dispose);
        return dispose;
      },
      schemas() {
        return [...definitions].map((toolName) => ({ name: toolName }));
      },
    },
    on(eventName, listener) {
      assert.equal(eventName, "tools/change");
      listeners.push(listener);
      const dispose = () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
      effects.push(dispose);
      return dispose;
    },
    async plugin(plugin, config) {
      const child = {
        plugin,
        config,
        disposed: false,
        async dispose() {
          if (child.disposed) return;
          child.disposed = true;
          replaceMcpCatalog([]);
        },
      };
      children.push(child);
      effects.push(() => child.dispose());
      replaceMcpCatalog(initialToolNames);
      return child;
    },
    logger: {
      error(message) { errors.push(String(message)); },
    },
  };

  return {
    ctx,
    packageRoot,
    skills,
    guards,
    children,
    errors,
    replaceMcpCatalog,
    toolNames: () => [...definitions],
    async dispose() {
      for (const dispose of effects.reverse()) await dispose();
    },
  };
}

async function temporaryDirectory(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-integration-")));
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  return directory;
}

async function nextMicrotask() {
  await new Promise((resolve) => setImmediate(resolve));
}
