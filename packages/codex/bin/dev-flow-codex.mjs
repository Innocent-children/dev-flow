#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { constants as fsConstants, realpathSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  CODEX_MCP_INSTRUCTIONS,
  inspectRegistrationStatus,
  inspectCoreVersion,
  removeRegistration,
  setupRegistration,
} from "../lib/lifecycle.mjs";
import {
  assertNoDuplicateJSONMembers,
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
import { runHook } from "../plugin/hooks/pre-tool-use.mjs";
import { inspectAdmissionAnchor } from "../lib/task-admission.mjs";
import {
  beginManagedTaskDispatch,
  beginTaskHandoff,
  bootstrapManagedTask,
  cleanupCliTaskWorktree,
  cleanupTaskBranch,
  prepareTaskLaunch,
  provisionCliTask,
  recordManagedTaskDispatch,
  recordTaskHandoff,
  recordTaskHandoffStatus,
} from "../lib/task-launch.mjs";
import { provisioningReceiptPath, readProvisioningReceipt } from "../lib/provisioning-receipt.mjs";
import { terminalCleanupDecision } from "../lib/worktree-lifecycle.mjs";

const execFile = promisify(execFileCallback);
const NPM_UNINSTALL_HANDOFF = "Run npm uninstall -g dev-flow-codex separately after deregistration.";
const CODEX_MCP_INSTRUCTIONS_ENVIRONMENT = "DEV_FLOW_CODEX_MCP_INSTRUCTIONS";

export async function runCLI(arguments_, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const environment = dependencies.environment ?? process.env;
  const resolvePaths = dependencies.resolvePaths ?? (() => resolveProductPaths({ environment }));
  const readPackageVersion = dependencies.readPackageVersion ?? readInstalledPackageVersion;
  const inspectVersion = dependencies.inspectCoreVersion ?? inspectCoreVersion;
  const inspectStatus = dependencies.inspectRegistrationStatus ?? inspectRegistrationStatus;
  const ensureDataDirectory = dependencies.ensureDefaultDataDirectory ?? ensureDefaultDataDirectory;
  const setup = dependencies.setupRegistration ?? setupRegistration;
  const ensureConfiguration = dependencies.ensureUserConfiguration ?? ensureUserConfiguration;
  const renderSetupResult = dependencies.renderSetup ?? renderSetup;
  let completedSetupChanges = [];
  let setupAttempted = false;

  if (!isProductionCommand(arguments_)) {
    stderr.write("dev-flow-codex: invalid arguments; expected status [--json], setup [--json], remove [--json], mcp, hook pre-tool-use, host-check pre-file-write, host-launch <operation>, or --version\n");
    return { code: 2, signal: null };
  }

  try {
    if (arguments_.length === 2 && arguments_[0] === "hook" && arguments_[1] === "pre-tool-use") {
      const invokeHook = dependencies.runPreToolUseHook ?? (() => runHook({
        output: stdout,
        error: stderr,
        environment,
      }));
      return { code: await invokeHook(), signal: null };
    }
    const paths = await resolvePaths();
    if (arguments_.length === 1 && arguments_[0] === "mcp") {
      if (paths.usesDefaultDataDirectory) await ensureDataDirectory(paths);
      return await launchPackagedCore(paths, ["mcp", "--stdio"], {
        environment,
        spawnImpl: dependencies.spawnImpl ?? spawn,
        signalSource: dependencies.signalSource ?? process,
      });
    }
    if (arguments_.length === 2 && arguments_[0] === "host-check" && arguments_[1] === "pre-file-write") {
      return await launchPackagedCore(paths, ["host-check", "pre-file-write"], {
        environment,
        spawnImpl: dependencies.spawnImpl ?? spawn,
        signalSource: dependencies.signalSource ?? process,
      });
    }
    if (arguments_.length === 2 && arguments_[0] === "host-launch") {
      const input = await readClosedStandardInput(dependencies.readInput);
      const result = await runHostLaunchCommand(arguments_[1], input, paths, dependencies);
      stdout.write(`${JSON.stringify(result)}\n`);
      return { code: 0, signal: null };
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
    if (arguments_[0] === "status") {
      const coreVersion = await inspectVersion(paths.runtimePath, {
        environment,
        currentDirectory: paths.packageRoot,
      });
      const result = await inspectStatus({
        paths,
        packageVersion,
        codexExecutable: dependencies.codexExecutable ?? "codex",
        environment,
      });
      writeStatusSuccess(stdout, result, {
        packageVersion,
        coreVersion,
        receiptPath: paths.receiptPath,
        json,
      });
      return { code: 0, signal: null };
    }
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

    const stopWebUI = dependencies.stopPackagedWebUI ?? stopPackagedWebUI;
    await stopWebUI(paths, { environment });
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

export async function stopPackagedWebUI(
  paths,
  { environment = process.env, exec = execFile } = {},
) {
  try {
    if (!(await stat(paths.dataDirectory)).isDirectory()) throw new Error("data path is not a directory");
  } catch (error) {
    if (error?.code === "ENOENT" && paths.usesDefaultDataDirectory) return;
    throw new Error("inspect packaged WebUI data directory", { cause: error });
  }
  await assertExecutableRuntime(paths.runtimePath, paths.requireExecutableMode);
  try {
    await exec(paths.runtimePath, ["webui", "stop", "--json"], {
      cwd: paths.packageRoot,
      env: { ...environment, DEV_FLOW_DATA_DIR: paths.dataDirectory },
      encoding: "utf8",
      maxBuffer: 64 * 1024,
    });
  } catch (error) {
    throw new Error("stop packaged WebUI", { cause: error });
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
  await assertExecutableRuntime(paths.runtimePath, paths.requireExecutableMode);
  if (!Array.isArray(paths.forwardedSignals) || paths.forwardedSignals.length === 0) {
    throw new Error("platform signal contract is unavailable");
  }
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
  for (const signal of paths.forwardedSignals) {
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

async function assertExecutableRuntime(runtimePath, requireExecutableMode = true) {
  let info;
  try {
    info = await stat(runtimePath);
    await access(runtimePath, requireExecutableMode ? fsConstants.X_OK : fsConstants.F_OK);
  } catch (error) {
    throw new Error("packaged Core must exist and be executable", { cause: error });
  }
  if (!info.isFile() || requireExecutableMode && (info.mode & 0o111) === 0) {
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

function writeStatusSuccess(stdout, result, { packageVersion, coreVersion, receiptPath, json }) {
  const output = {
    operation: "status",
    status: result.status,
    changed: false,
    package_version: packageVersion,
    core_version: coreVersion,
    receipt_path: receiptPath,
    registration: {
      receipt: result.receipt,
      marketplace: result.marketplace,
      plugin: result.plugin,
    },
  };
  if (json) {
    stdout.write(`${JSON.stringify(output)}\n`);
    return;
  }
  stdout.write(`dev-flow-codex status: ${result.status}\n`);
  stdout.write(`Package ${packageVersion} · Core ${coreVersion}\n`);
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
  if (arguments_.length === 2 && arguments_[0] === "hook" && arguments_[1] === "pre-tool-use") return true;
  if (arguments_.length === 2 && arguments_[0] === "host-check" && arguments_[1] === "pre-file-write") return true;
  if (arguments_.length === 2 && arguments_[0] === "host-launch" && [
    "inspect",
    "prepare",
    "status",
    "dispatch-start",
    "dispatch-result",
    "bootstrap",
    "cli-provision",
    "handoff-start",
    "handoff-result",
    "handoff-status",
    "cleanup-decision",
    "cleanup-worktree",
    "cleanup-branch",
  ].includes(arguments_[1])) return true;
  return (
    (arguments_.length === 1 || arguments_.length === 2 && arguments_[1] === "--json") &&
    ["status", "setup", "remove"].includes(arguments_[0])
  );
}

async function runHostLaunchCommand(operation, input, paths, dependencies) {
  const common = {
    productSupportRoot: paths.productSupportRoot,
    enforcePrivateModes: paths.enforcePrivateModes,
    runGit: dependencies.runGit,
  };
  if (operation === "inspect") {
    assertClosedObject(input, ["request", "repositories"], "host-launch inspect input");
    return await inspectAdmissionAnchor({ ...input, runGit: dependencies.runGit });
  }
  if (operation === "prepare") {
    return await prepareTaskLaunch(input, {
      ...common,
      now: dependencies.now,
      createLaunchId: dependencies.createLaunchId,
    });
  }
  if (operation === "status") {
    assertClosedObject(input, ["launch_id", "repository_key"], "host-launch status input");
    const receiptPath = provisioningReceiptPath(paths.productSupportRoot, input.launch_id, input.repository_key);
    return {
      receipt_path: receiptPath,
      receipt: await readProvisioningReceipt(receiptPath, { productSupportRoot: paths.productSupportRoot }),
    };
  }
  if (operation === "dispatch-start") return await beginManagedTaskDispatch(input, common);
  if (operation === "dispatch-result") return await recordManagedTaskDispatch(input, common);
  if (operation === "handoff-start") return await beginTaskHandoff(input, common);
  if (operation === "handoff-result") return await recordTaskHandoff(input, common);
  if (operation === "handoff-status") return await recordTaskHandoffStatus(input, common);
  if (operation === "cleanup-decision") {
    assertClosedObject(input, ["lifecycle", "surface", "clean", "pushed", "stateCertain"], "cleanup decision input");
    return terminalCleanupDecision(input);
  }
  if (operation === "bootstrap") return await bootstrapManagedTask(input, common);

  const sourceRepositoryPath = input?.source_repository_path;
  if (typeof sourceRepositoryPath !== "string") throw new Error(`${operation} requires source_repository_path`);
  const operationInput = { ...input };
  delete operationInput.source_repository_path;
  const repositoryOptions = { ...common, sourceRepositoryPath };
  if (operation === "cli-provision") return await provisionCliTask(operationInput, repositoryOptions);
  if (operation === "cleanup-worktree") return await cleanupCliTaskWorktree(operationInput, repositoryOptions);
  if (operation === "cleanup-branch") return await cleanupTaskBranch(operationInput, repositoryOptions);
  throw new Error(`unsupported host-launch operation ${operation}`);
}

async function readClosedStandardInput(readInput = () => readFile(0, "utf8")) {
  const raw = await readInput();
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 1024 * 1024) {
    throw new Error("host-launch input must be UTF-8 JSON no larger than 1 MiB");
  }
  let value;
  try {
    assertNoDuplicateJSONMembers(raw);
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`host-launch input must be one JSON object: ${error.message}`, { cause: error });
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("host-launch input must be one JSON object");
  }
  return value;
}

function assertClosedObject(value, keys, label) {
  const actual = Object.keys(value ?? {}).sort();
  const expected = [...keys].sort();
  if (value === null || typeof value !== "object" || Array.isArray(value) || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has an invalid closed shape`);
  }
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
