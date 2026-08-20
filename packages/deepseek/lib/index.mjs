import * as mcpClientPlugin from "@deepseek-ai/dsh-mcp-client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { registerDevFlowGuard } from "./authorization.mjs";
import {
  ensureDefaultDataDirectory,
  packageRootFromModule,
  resolveDataDirectory,
} from "./paths.mjs";
import { preflightPackagedCore, selectPackagedRuntime } from "./runtime.mjs";
import {
  DEV_FLOW_SERVER_NAME,
  assertQualifiedToolCatalog,
} from "./tool-names.mjs";

export const name = "dev-flow-deepseek";
export const inject = ["skills", "tools"];

export async function apply(ctx) {
  await activateDeepSeekIntegration(ctx);
}

export async function activateDeepSeekIntegration(ctx, {
  packageRoot = packageRootFromModule(import.meta.url),
  homeDirectory,
  environment = process.env,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const manifest = await readPackageManifest(packageRoot);
  const runtimeSelection = await selectPackagedRuntime({ packageRoot, platform, arch });
  const dataSelection = await resolveDataDirectory({ homeDirectory, environment });
  if (dataSelection.usesDefaultDataDirectory) {
    await ensureDefaultDataDirectory(dataSelection);
  }
  const runtime = await preflightPackagedCore(runtimeSelection, {
    expectedVersion: manifest.version,
    environment,
  });

  const skillDirectory = join(runtime.packageRoot, "skills", "dev-flow");
  const skillPath = join(skillDirectory, "SKILL.md");
  const skillContent = await readFile(skillPath, "utf8");

  ctx.skills.register(Object.freeze({
    name: "dev-flow",
    description: "Use the Dev Flow graph Core for the current explicit development request.",
    whenToUse: "Use only for a current direct user turn containing /dev-flow.",
    invocation: Object.freeze({
      modelInvocable: false,
      userInvocable: true,
    }),
    source: "bundled",
    provider: name,
    resourceBase: Object.freeze({ kind: "directory", path: skillDirectory }),
    content: skillContent,
    path: skillPath,
  }));
  registerDevFlowGuard(ctx);

  let mcpFiber;
  let catalogCheckQueued = false;
  let catalogFailed = false;
  ctx.on("tools/change", () => {
    if (catalogCheckQueued || catalogFailed) return;
    catalogCheckQueued = true;
    queueMicrotask(() => {
      catalogCheckQueued = false;
      if (catalogFailed) return;
      try {
        verifyCurrentCatalog(ctx, { allowUnavailable: true });
      } catch (error) {
        catalogFailed = true;
        ctx.logger.error(`${name}: ${error.message}`);
        if (mcpFiber !== undefined) {
          void mcpFiber.dispose().catch((disposeError) => {
            ctx.logger.error(`${name}: failed to dispose incompatible MCP child: ${disposeError.message}`);
          });
        }
      }
    });
  });

  mcpFiber = await ctx.plugin(mcpClientPlugin, {
    transport: "stdio",
    serverName: DEV_FLOW_SERVER_NAME,
    command: runtime.runtimePath,
    args: ["mcp", "--stdio"],
    env: { DEV_FLOW_DATA_DIR: dataSelection.dataDirectory },
    cwd: runtime.packageRoot,
    toolCallTimeoutMs: 60_000,
    failOnStartupError: false,
    reconnect: {
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 30_000,
      maxAttempts: 10,
    },
  });
  verifyCurrentCatalog(ctx, { allowUnavailable: true });
}

function verifyCurrentCatalog(ctx, options) {
  const toolNames = ctx.tools.schemas().map((schema) => schema.name);
  return assertQualifiedToolCatalog(toolNames, options);
}

async function readPackageManifest(packageRoot) {
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (manifest.name !== name || typeof manifest.version !== "string") {
    throw new Error("DeepSeek package manifest identity is invalid");
  }
  return manifest;
}
