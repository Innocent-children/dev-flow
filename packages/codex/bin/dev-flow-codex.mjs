#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants, realpathSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  inspectCoreVersion,
  removeRegistration,
  setupRegistration,
} from "../lib/lifecycle.mjs";
import {
  buildSetupSuccessResult,
  ensureUserConfiguration,
  renderSetup,
  renderSetupPlain,
  resolveSetupLanguage,
  selectSetupPresentationMode,
} from "../lib/install-experience.mjs";
import {
  ensureDefaultDataDirectory,
  resolveProductPaths,
} from "../lib/paths.mjs";

const FORWARDED_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
const NPM_UNINSTALL_HANDOFF = "Run npm uninstall -g dev-flow-codex separately after deregistration.";
const CODEX_MCP_INSTRUCTIONS_ENVIRONMENT = "DEV_FLOW_CODEX_MCP_INSTRUCTIONS";
const CODEX_MCP_INSTRUCTIONS = [
  "Dev Flow for Codex is explicit-only.",
  "Do not call tools from this server unless the current user turn contains the exact selector `$dev-flow-codex:dev-flow`.",
  "Bare `$dev-flow`, wrong or missing selectors, and implicit matches are not activation.",
  "After valid selection, `dev_flow_server_info` must be the first Dev Flow call.",
  "Read `host_preferences.codex.codebase_memory` from that handshake without installing or configuring codebase-memory.",
  "Call `dev_flow_open_task` only after exact `$dev-flow-codex:dev-flow` selection and a successful `dev_flow_server_info` handshake.",
  "Use the current Git worktree as primary and only user-declared additional repositories already authorized as writable roots; never scan repositories or change Codex sandbox permissions.",
].join(" ");

export async function runCLI(arguments_, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const environment = dependencies.environment ?? process.env;
  const resolvePaths = dependencies.resolvePaths ?? (() => resolveProductPaths({ environment }));
  const readPackageVersion = dependencies.readPackageVersion ?? readInstalledPackageVersion;
  const inspectVersion = dependencies.inspectCoreVersion ?? inspectCoreVersion;
  const ensureDataDirectory = dependencies.ensureDefaultDataDirectory ?? ensureDefaultDataDirectory;
  const setup = dependencies.setupRegistration ?? setupRegistration;
  const ensureConfiguration = dependencies.ensureUserConfiguration ?? ensureUserConfiguration;
  const renderSetupResult = dependencies.renderSetup ?? renderSetup;
  let completedSetupChanges = [];
  let setupAttempted = false;

  if (!isProductionCommand(arguments_)) {
    stderr.write("dev-flow-codex: invalid arguments; expected setup [--json], remove [--json], mcp, or --version\n");
    return { code: 2, signal: null };
  }

  try {
    const paths = await resolvePaths();
    if (arguments_.length === 1 && arguments_[0] === "mcp") {
      if (paths.usesDefaultDataDirectory) await ensureDataDirectory(paths);
      return await launchPackagedCore(paths, ["mcp", "--stdio"], {
        environment,
        spawnImpl: dependencies.spawnImpl ?? spawn,
        signalSource: dependencies.signalSource ?? process,
      });
    }

    const packageVersion = await readPackageVersion(paths.packageRoot);
    if (arguments_.length === 1 && arguments_[0] === "--version") {
      const coreVersion = await inspectVersion(paths.runtimePath, {
        environment,
        currentDirectory: paths.packageRoot,
      });
      stdout.write(`dev-flow-codex ${packageVersion} (core ${coreVersion})\n`);
      return { code: 0, signal: null };
    }

    const json = arguments_.at(-1) === "--json";
    if (arguments_[0] === "setup") {
      setupAttempted = true;
      const configuration = await ensureConfiguration(paths);
      if (configuration.fileChange) completedSetupChanges = [configuration.fileChange];
      const result = await setup({
        paths,
        packageVersion,
        codexExecutable: dependencies.codexExecutable ?? "codex",
        environment,
        now: dependencies.now,
      });
      const setupResult = buildSetupSuccessResult(result, configuration, paths.receiptPath);
      writeSetupSuccess(stdout, setupResult, json, {
        environment,
        renderSetupResult,
      });
      return { code: 0, signal: null };
    }

    const remove = dependencies.removeRegistration ?? removeRegistration;
    const result = await remove({
      paths,
      packageVersion,
      codexExecutable: dependencies.codexExecutable ?? "codex",
      environment,
    });
    writeLifecycleSuccess(stdout, "remove", result, paths.receiptPath, json);
    return { code: 0, signal: null };
  } catch (error) {
    if (setupAttempted && completedSetupChanges.length > 0) {
      stderr.write(
        `dev-flow-codex: ${error.message}; created ${completedSetupChanges[0].path}; ` +
        "Codex registration is incomplete; run dev-flow-codex setup again\n",
      );
    } else {
      stderr.write(`dev-flow-codex: ${error.message}\n`);
    }
    return { code: 1, signal: null };
  }
}

export async function launchPackagedCore(
  paths,
  arguments_,
  {
    environment = process.env,
    spawnImpl = spawn,
    signalSource = process,
  } = {},
) {
  await assertExecutableRuntime(paths.runtimePath);
  let child;
  try {
    child = spawnImpl(paths.runtimePath, arguments_, {
      cwd: paths.packageRoot,
      env: {
        ...environment,
        DEV_FLOW_DATA_DIR: paths.dataDirectory,
        [CODEX_MCP_INSTRUCTIONS_ENVIRONMENT]: CODEX_MCP_INSTRUCTIONS,
      },
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
  } catch (error) {
    throw new Error("start packaged Core", { cause: error });
  }

  const handlers = new Map();
  for (const signal of FORWARDED_SIGNALS) {
    const handler = () => child.kill(signal);
    handlers.set(signal, handler);
    signalSource.on(signal, handler);
  }
  const cleanup = () => {
    for (const [signal, handler] of handlers) signalSource.off(signal, handler);
  };

  return await new Promise((resolve, reject) => {
    child.once("error", (error) => {
      cleanup();
      reject(new Error("packaged Core process failed to start", { cause: error }));
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}

async function readInstalledPackageVersion(packageRoot) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(new URL("../package.json", pathToFileURL(`${packageRoot}/bin/`)), "utf8"));
  } catch (error) {
    throw new Error("read installed package identity", { cause: error });
  }
  if (manifest.name !== "dev-flow-codex" || typeof manifest.version !== "string") {
    throw new Error("installed package identity is invalid");
  }
  return manifest.version;
}

async function assertExecutableRuntime(runtimePath) {
  let info;
  try {
    info = await stat(runtimePath);
    await access(runtimePath, fsConstants.X_OK);
  } catch (error) {
    throw new Error("packaged Core must exist and be executable", { cause: error });
  }
  if (!info.isFile() || (info.mode & 0o111) === 0) {
    throw new Error("packaged Core must exist and be executable");
  }
}

function writeLifecycleSuccess(stdout, operation, result, receiptPath, json) {
  if (json) {
    const output = {
      operation,
      status: result.status,
      changed: result.changed,
      receipt_path: receiptPath,
    };
    if (operation === "remove") output.next_step = NPM_UNINSTALL_HANDOFF;
    stdout.write(`${JSON.stringify(output)}\n`);
    return;
  }
  stdout.write(`dev-flow-codex ${operation}: ${result.status}\n`);
  if (operation === "remove") stdout.write(`${NPM_UNINSTALL_HANDOFF}\n`);
}

function writeSetupSuccess(stdout, result, json, { environment, renderSetupResult }) {
  if (json) {
    stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const language = resolveSetupLanguage(environment);
  const mode = selectSetupPresentationMode(stdout, environment);
  try {
    stdout.write(renderSetupResult(result, { language, mode }));
  } catch {
    stdout.write(renderSetupPlain(result, language));
  }
}

function isProductionCommand(arguments_) {
  if (!Array.isArray(arguments_)) return false;
  if (arguments_.length === 1 && ["mcp", "--version"].includes(arguments_[0])) return true;
  return (
    (arguments_.length === 1 || arguments_.length === 2 && arguments_[1] === "--json") &&
    ["setup", "remove"].includes(arguments_[0])
  );
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const result = await runCLI(process.argv.slice(2));
  if (result.signal) {
    try {
      process.kill(process.pid, result.signal);
    } catch {
      process.exitCode = 1;
    }
  } else {
    process.exitCode = result.code ?? 1;
  }
}
