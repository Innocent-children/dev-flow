import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEV_FLOW_QUALIFIED_TOOL_NAMES,
} from "../../../packages/deepseek/lib/tool-names.mjs";

const signal = new AbortController().signal;

export class CoreEnvelopeError extends Error {
  constructor(envelope) {
    super(`${envelope.error?.code ?? "UNKNOWN"}: ${envelope.error?.message ?? "Core request failed"}`);
    this.name = "CoreEnvelopeError";
    this.envelope = envelope;
  }
}

export class DeterministicCoreHost {
  constructor({ runtimePath, dataDirectory, packageRoot }) {
    this.runtimePath = runtimePath;
    this.dataDirectory = dataDirectory;
    this.packageRoot = packageRoot;
    this.calls = [];
    this.sessions = [];
    this.currentSessionCalls = [];
  }

  async start() {
    assert.equal(this.ctx, undefined, "Core Host session is already active");
    const stack = await loadStack();
    const ctx = new stack.Context();
    const fibers = [];
    fibers.push(await ctx.plugin(stack.SystemPrompt));
    fibers.push(await ctx.plugin(stack.ToolRuntime));
    fibers.push(await ctx.plugin(stack.mcpClient, {
      transport: "stdio",
      serverName: "dev_flow",
      command: this.runtimePath,
      args: ["mcp", "--stdio"],
      env: { DEV_FLOW_DATA_DIR: this.dataDirectory },
      cwd: this.packageRoot,
      toolCallTimeoutMs: 15_000,
      failOnStartupError: true,
      reconnect: { enabled: false, initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 1 },
    }));
    try {
      assert.deepEqual(
        ctx.tools.schemas().map((schema) => schema.name).sort(),
        [...DEV_FLOW_QUALIFIED_TOOL_NAMES].sort(),
      );
    } catch (error) {
      for (const fiber of [...fibers].reverse()) await fiber.dispose();
      throw error;
    }
    this.ctx = ctx;
    this.fibers = fibers;
    this.currentSessionCalls = [];
    this.sessions.push(this.currentSessionCalls);
  }

  async stop() {
    if (this.ctx === undefined) return;
    for (const fiber of [...this.fibers].reverse()) await fiber.dispose();
    this.ctx = undefined;
    this.fibers = undefined;
  }

  async restart() {
    await this.stop();
    await this.start();
  }

  async call(name, argumentsValue) {
    assert.notEqual(this.ctx, undefined, "Core Host session is not active");
    this.calls.push(name);
    this.currentSessionCalls.push(name);
    const result = await this.ctx.tools.execute({
      callId: `deepseek-journey-${this.calls.length}`,
      name,
      arguments: argumentsValue,
      signal,
    });
    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const start = text.indexOf("{");
    assert.ok(start >= 0, `Core result for ${name} has no JSON envelope`);
    const envelope = JSON.parse(text.slice(start));
    assert.equal(envelope.schema_version, 2);
    if (!envelope.ok) throw new CoreEnvelopeError(envelope);
    return envelope;
  }
}

async function loadStack() {
  const packageManifest = fileURLToPath(new URL("../../../packages/deepseek/package.json", import.meta.url));
  const packageRequire = createRequire(packageManifest);
  const require = createRequire(packageRequire.resolve("@deepseek-ai/dsh-tools"));
  const [cordis, systemPrompt, tools, mcpClient] = await Promise.all([
    importResolved(require, "@deepseek-ai/cordis"),
    importResolved(require, "@deepseek-ai/dsh-system-prompt"),
    importResolved(require, "@deepseek-ai/dsh-tools"),
    importResolved(packageRequire, "@deepseek-ai/dsh-mcp-client"),
  ]);
  return {
    Context: cordis.Context,
    SystemPrompt: systemPrompt.default,
    ToolRuntime: tools.default,
    mcpClient,
  };
}

async function importResolved(require, specifier) {
  return await import(pathToFileURL(require.resolve(specifier)).href);
}
