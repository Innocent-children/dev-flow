import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const signal = new AbortController().signal;
const exactGateModules = process.env.DEV_FLOW_DSH_GATE_NODE_MODULES;

test("official MCP client preserves complete Core success and distinguishes domain from transport failure", async (t) => {
  const root = await temporaryRoot(t, "core");
  const stack = await loadStack();
  const fixturePath = await writeFixtureServer(root, stack.require);
  const first = await mountMcp(stack, fixtureConfig(fixturePath, root, "gate_core"));

  const serverInfo = await execute(first.ctx, "mcp__gate_core__dev_flow_server_info", {});
  assert.equal(serverInfo.isError, false);
  const firstEnvelope = parseSingleTextEnvelope(serverInfo);
  assert.equal(firstEnvelope.ok, true);
  assert.equal(firstEnvelope.result.product, "dev-flow");

  const getTaskName = "mcp__gate_core__dev_flow_get_task";
  const definition = first.ctx.tools.get(getTaskName);
  assert.notEqual(definition, undefined);
  const domain = await execute(first.ctx, getTaskName, { host: "deepseek", task_id: "missing-task" });
  assert.equal(domain.isError, true);
  const domainEnvelope = parseErrorEnvelope(domain);
  assert.equal(domainEnvelope.ok, false);
  assert.equal(domainEnvelope.error.code, "TASK_NOT_FOUND");
  assert.equal(domainEnvelope.recovery.retry_safe, false);

  await first.disposeMcp();
  await assert.rejects(
    definition.execute(
      { host: "deepseek", task_id: "missing-task" },
      executionContext("transport-after-dispose"),
    ),
    (error) => {
      assert.equal(tryParseEnvelope(error.message), undefined);
      assert.match(error.message, /closed|transport|connection|not connected/i);
      return true;
    },
  );
  await first.dispose();

  const second = await mountMcp(stack, fixtureConfig(fixturePath, root, "gate_core"));
  const reread = await execute(second.ctx, "mcp__gate_core__dev_flow_server_info", {});
  const rereadEnvelope = parseSingleTextEnvelope(reread);
  assert.deepEqual(rereadEnvelope.result, firstEnvelope.result);
  t.diagnostic(JSON.stringify({
    case: "core_restart_fresh_read",
    first_sha256: sha256(JSON.stringify(firstEnvelope.result)),
    reread_sha256: sha256(JSON.stringify(rereadEnvelope.result)),
  }));
  await second.dispose();
});

test("official MCP client preserves canonical JSON from ordinary size through the Core envelope boundary", async (t) => {
  const root = await temporaryRoot(t, "fixture");
  const stack = await loadStack();
  const fixturePath = await writeFixtureServer(root, stack.require);
  const mounted = await mountMcp(stack, fixtureConfig(fixturePath, root, "gate_direct"));

  for (const bytes of [1_024, 1_000_000]) {
    const result = await execute(mounted.ctx, "mcp__gate_direct__envelope", { bytes });
    assert.equal(result.isError, false);
    const expected = fixtureEnvelope(bytes);
    assert.deepEqual(result.value.structuredContent, expected);
    const rendered = singleText(result.content);
    assert.equal(rendered, JSON.stringify(expected));
    t.diagnostic(JSON.stringify({
      case: bytes < 10_000 ? "ordinary_success" : "near_core_envelope",
      expected_bytes: Buffer.byteLength(JSON.stringify(expected)),
      recovered_bytes: Buffer.byteLength(rendered),
      expected_sha256: sha256(JSON.stringify(expected)),
      recovered_sha256: sha256(rendered),
    }));
  }
  await mounted.dispose();
});

test("exact rc.8 spill stack retains canonical values and retrieves byte-identical full results", {
  skip: exactGateModules === undefined ? "set DEV_FLOW_DSH_GATE_NODE_MODULES for the one exact spill gate" : false,
}, async (t) => {
  const root = await temporaryRoot(t, "spill");
  const spillRoot = join(root, "spill-store");
  await mkdir(spillRoot, { mode: 0o700 });
  const stack = await loadStack(exactGateModules);
  await assertExactRc8(stack.require);
  const fixturePath = await writeFixtureServer(root, stack.require);
  const mounted = await mountMcp(stack, fixtureConfig(fixturePath, root, "gate_spill"), {
    spillRoot,
    maxInlineBytes: 50_000,
  });

  const nearSpill = fixtureEnvelope(48_000);
  const nearResult = await execute(mounted.ctx, "mcp__gate_spill__envelope", { bytes: 48_000 }, spillAgent());
  assert.equal(nearResult.isError, false);
  assert.deepEqual(nearResult.value.structuredContent, nearSpill);
  assert.equal(singleText(nearResult.content), JSON.stringify(nearSpill));

  const spilled = fixtureEnvelope(100_000);
  const spillResult = await execute(mounted.ctx, "mcp__gate_spill__envelope", { bytes: 100_000 }, spillAgent());
  assert.equal(spillResult.isError, false);
  assert.deepEqual(spillResult.value.structuredContent, spilled);
  const preview = singleText(spillResult.content);
  assert.ok(Buffer.byteLength(preview) <= 50_000);
  assert.match(preview, /Full formatted result stored at:/u);
  const locator = /stored at: (.+?)\. Use read with offset\/limit/u.exec(preview)?.[1];
  assert.notEqual(locator, undefined);
  const recovered = await readFile(locator, "utf8");
  const expected = JSON.stringify(spilled);
  assert.equal(recovered, expected);
  assert.equal((await stat(locator)).mode & 0o777, 0o600);
  t.diagnostic(JSON.stringify({
    case: "official_spill_retrieval",
    dsh_version: "0.1.0-rc.8",
    max_inline_bytes: 50_000,
    expected_bytes: Buffer.byteLength(expected),
    preview_bytes: Buffer.byteLength(preview),
    recovered_bytes: Buffer.byteLength(recovered),
    expected_sha256: sha256(expected),
    recovered_sha256: sha256(recovered),
  }));

  await mounted.dispose();
});

async function loadStack(moduleRoot) {
  let require;
  if (moduleRoot !== undefined) {
    require = createRequire(join(moduleRoot, "package.json"));
  } else {
    const toolsEntry = import.meta.resolve("@deepseek-ai/dsh-tools");
    require = createRequire(toolsEntry);
  }
  const [cordis, systemPrompt, tools, mcpClient] = await Promise.all([
    importResolved(require, "@deepseek-ai/cordis"),
    importResolved(require, "@deepseek-ai/dsh-system-prompt"),
    importResolved(require, "@deepseek-ai/dsh-tools"),
    moduleRoot === undefined
      ? import("@deepseek-ai/dsh-mcp-client")
      : importResolved(require, "@deepseek-ai/dsh-mcp-client"),
  ]);
  return {
    Context: cordis.Context,
    SystemPrompt: systemPrompt.default,
    ToolRuntime: tools.default,
    mcpClient,
    require,
  };
}

async function mountMcp(stack, config, spill) {
  const ctx = new stack.Context();
  const fibers = [];
  fibers.push(await ctx.plugin(stack.SystemPrompt));
  fibers.push(await ctx.plugin(stack.ToolRuntime));
  if (spill !== undefined) {
    const [localSpill, spillPolicy] = await Promise.all([
      importResolved(stack.require, "@deepseek-ai/dsh-spill-local"),
      importResolved(stack.require, "@deepseek-ai/dsh-spill-policy"),
    ]);
    fibers.push(await ctx.plugin(localSpill.default, { root: spill.spillRoot }));
    fibers.push(await ctx.plugin(spillPolicy, { maxInlineBytes: spill.maxInlineBytes }));
  }
  const mcpFiber = await ctx.plugin(stack.mcpClient, config);
  fibers.push(mcpFiber);
  let mcpDisposed = false;
  return {
    ctx,
    async disposeMcp() {
      if (mcpDisposed) return;
      mcpDisposed = true;
      await mcpFiber.dispose();
    },
    async dispose() {
      for (const fiber of [...fibers].reverse()) await fiber.dispose();
    },
  };
}

function fixtureConfig(fixturePath, cwd, serverName) {
  return {
    transport: "stdio",
    serverName,
    command: process.execPath,
    args: [fixturePath],
    env: {},
    cwd,
    toolCallTimeoutMs: 15_000,
    failOnStartupError: true,
    reconnect: reconnectDisabled(),
  };
}

function reconnectDisabled() {
  return { enabled: false, initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 1 };
}

async function execute(ctx, name, args, agent) {
  return await ctx.tools.execute({
    callId: `gate-${name}-${Date.now()}-${Math.random()}`,
    name,
    arguments: args,
    ...(agent === undefined ? {} : { agent }),
    signal,
  });
}

function executionContext(callId) {
  return Object.freeze({
    callId,
    rootCallId: callId,
    name: "mcp__gate_core__dev_flow_get_task",
    arguments: Object.freeze({ host: "deepseek", task_id: "missing-task" }),
    signal,
    token: Symbol(callId),
    deferContext() {},
    concludeTurn() {},
  });
}

function spillAgent() {
  return { session: { header: { id: "dev-flow-result-gate" } } };
}

function parseSingleTextEnvelope(result) {
  assert.equal(result.isError, false);
  return JSON.parse(singleText(result.content));
}

function parseErrorEnvelope(result) {
  assert.equal(result.isError, true);
  const text = singleText(result.content);
  const envelope = tryParseEnvelope(text);
  assert.notEqual(envelope, undefined, text);
  return envelope;
}

function tryParseEnvelope(text) {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return undefined;
  }
}

function singleText(content) {
  assert.equal(content.length, 1);
  assert.equal(content[0].type, "text");
  return content[0].text;
}

function fixtureEnvelope(bytes) {
  return {
    ok: true,
    request_id: `fixture-${bytes}`,
    tool: "envelope",
    result: { blob: "x".repeat(bytes) },
  };
}

async function writeFixtureServer(root, require) {
  const mcpClientRequire = createRequire(require.resolve("@deepseek-ai/dsh-mcp-client"));
  const mcpUrl = pathToFileURL(mcpClientRequire.resolve("@modelcontextprotocol/sdk/server/mcp.js")).href;
  const stdioUrl = pathToFileURL(mcpClientRequire.resolve("@modelcontextprotocol/sdk/server/stdio.js")).href;
  const zodUrl = pathToFileURL(mcpClientRequire.resolve("zod")).href;
  const fixturePath = join(root, "fixture-server.mjs");
  const source = `
import { McpServer } from ${JSON.stringify(mcpUrl)};
import { StdioServerTransport } from ${JSON.stringify(stdioUrl)};
import { z } from ${JSON.stringify(zodUrl)};
const server = new McpServer({ name: "dev-flow-result-gate", version: "1.0.0" });
server.registerTool("dev_flow_server_info", {
  description: "Returns the bounded Core handshake envelope used by the direct bridge gate.",
  inputSchema: {},
}, async () => {
  const structuredContent = {
    ok: true,
    request_id: "fixture-server-info",
    tool: "dev_flow_server_info",
    result: {
      product: "dev-flow",
    },
  };
  return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
});
server.registerTool("dev_flow_get_task", {
  description: "Returns a stable Core-style domain error for a missing task.",
  inputSchema: { host: z.string(), task_id: z.string() },
}, async () => {
  const domainError = {
    ok: false,
    request_id: "fixture-missing-task",
    tool: "dev_flow_get_task",
    error: { code: "TASK_NOT_FOUND", message: "task not found", details: {} },
    recovery: { retry_safe: false },
  };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(domainError) }] };
});
server.registerTool("envelope", {
  description: "Returns a complete bounded JSON envelope.",
  inputSchema: { bytes: z.number().int().min(0).max(1000000) },
}, async ({ bytes }) => {
  const structuredContent = {
    ok: true,
    request_id: \`fixture-\${bytes}\`,
    tool: "envelope",
    result: { blob: "x".repeat(bytes) },
  };
  return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
});
await server.connect(new StdioServerTransport());
`;
  await writeFile(fixturePath, source, { mode: 0o700 });
  await chmod(fixturePath, 0o700);
  return fixturePath;
}

async function assertExactRc8(require) {
  for (const packageName of [
    "@deepseek-ai/dsh",
    "@deepseek-ai/dsh-mcp-client",
    "@deepseek-ai/dsh-spill-local",
    "@deepseek-ai/dsh-spill-policy",
    "@deepseek-ai/dsh-tools",
    "@deepseek-ai/dsh-system-prompt",
  ]) {
    const manifestPath = require.resolve(`${packageName}/package.json`);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(manifest.version, "0.1.0-rc.8", packageName);
  }
}

async function importResolved(require, specifier) {
  return await import(pathToFileURL(require.resolve(specifier)).href);
}

async function temporaryRoot(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), `dev-flow-${name}-gate-`)));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
