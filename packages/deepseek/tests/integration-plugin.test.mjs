import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

const sourcePackageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(sourcePackageRoot));
const currentVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();

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
    "mcp__dev_flow__dev_flow_submit_requirements",
    "mcp__dev_flow__dev_flow_submit_design",
    "mcp__dev_flow__dev_flow_submit_tasks",
    "mcp__dev_flow__dev_flow_submit_implementation",
    "mcp__dev_flow__dev_flow_submit_test",
    "mcp__dev_flow__dev_flow_submit_comprehension",
    "mcp__dev_flow__dev_flow_submit_refactor",
    "mcp__dev_flow__dev_flow_submit_delivery",
    "mcp__dev_flow__dev_flow_resolve_blocker",
    "mcp__dev_flow__dev_flow_recover_action",
    "mcp__dev_flow__dev_flow_cancel_task",
  ]);
});

test("registers one user-only Skill, one guard, and the official MCP child config", async (t) => {
  const dataDirectory = await temporaryDirectory(t, "data");
  const packageRoot = await temporaryPackage(t, "integration package-工具");
  const fake = createFakeContext({ packageRoot, initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });

  await activateDeepSeekIntegration(fake.ctx, {
    packageRoot,
    platform: "darwin",
    arch: "arm64",
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
  const packageRoot = await temporaryPackage(t, "reconnect-package");
  const fake = createFakeContext({ packageRoot, initialToolNames: [], unrelatedToolNames: ["read_file"] });
  await activateDeepSeekIntegration(fake.ctx, {
    packageRoot,
    platform: "darwin",
    arch: "arm64",
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
  const packageRoot = await temporaryPackage(t, "catalog-package");
  const fake = createFakeContext({ packageRoot, initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });
  await activateDeepSeekIntegration(fake.ctx, {
    packageRoot,
    platform: "darwin",
    arch: "arm64",
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
  const packageRoot = await temporaryPackage(t, "unsupported-package");
  const fake = createFakeContext({ packageRoot, initialToolNames: DEV_FLOW_QUALIFIED_TOOL_NAMES });
  await assert.rejects(
    activateDeepSeekIntegration(fake.ctx, {
      packageRoot,
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

function createFakeContext({ packageRoot, initialToolNames, unrelatedToolNames = [] }) {
  const skills = [];
  const guards = [];
  const listeners = [];
  const effects = [];
  const children = [];
  const errors = [];
  const definitions = new Set(unrelatedToolNames);
  let mcpNames = new Set();
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

async function temporaryPackage(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-package-")));
  const packageRoot = join(root, name);
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const skillRoot = join(packageRoot, "skills", "dev-flow");
  await mkdir(dirname(runtimePath), { recursive: true });
  await mkdir(join(skillRoot, "references"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), `${JSON.stringify({
    name: "dev-flow-deepseek",
    version: currentVersion,
  })}\n`);
  await copyFile(join(sourcePackageRoot, "skills", "dev-flow", "SKILL.md"), join(skillRoot, "SKILL.md"));
  for (const reference of ["method-profiles.md", "node-payloads.md"]) {
    await copyFile(
      join(sourcePackageRoot, "skills", "dev-flow", "references", reference),
      join(skillRoot, "references", reference),
    );
  }
  await writeFile(runtimePath, [
    "#!/bin/sh",
    "if [ \"$1\" = \"version\" ]; then",
    `  printf 'dev-flow ${currentVersion}\\n'`,
    "  exit 0",
    "fi",
    "exit 1",
    "",
  ].join("\n"));
  await chmod(runtimePath, 0o755);
  t.after(() => rm(root, { recursive: true, force: true }));
  return packageRoot;
}

async function nextMicrotask() {
  await new Promise((resolve) => setImmediate(resolve));
}
