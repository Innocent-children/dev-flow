#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendFile, chmod, copyFile, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, isAbsolute, join, resolve } from "node:path";

const [role, ...argv] = process.argv.slice(2);
const statePath = requiredPath("FAKE_NATIVE_STATE");
const tracePath = requiredPath("FAKE_NATIVE_TRACE");
const toolPath = requiredPath("FAKE_NATIVE_TOOL_PATH");
const sourcePackageRoot = dirname(dirname(dirname(toolPath)));
const packageVersion = process.env.FAKE_NATIVE_PACKAGE_VERSION ?? "0.1.0";
const nativeVerificationCommand = "git hash-object native-proof.txt";
const nativeVerificationRenderedCommand = "/bin/zsh -lc 'git hash-object native-proof.txt'";

await trace({ role, argv, cwd: process.cwd() });

switch (role) {
  case "npm":
    await runNpm(argv);
    break;
  case "launcher":
    await runLauncher(argv);
    break;
  case "codex":
    await runCodex(argv);
    break;
  case "core":
    await runCore(argv);
    break;
  default:
    fail(`unsupported fake native role: ${role ?? "<missing>"}`);
}

async function runNpm(arguments_) {
  const operation = arguments_[0];
  const prefixIndex = arguments_.indexOf("--prefix");
  const prefix = prefixIndex >= 0 ? resolve(arguments_[prefixIndex + 1]) : null;
  if (!prefix) fail("fake npm requires --prefix ABS");
  const packageRoot = join(prefix, "node_modules", "dev-flow-codex");
  const binRoot = join(prefix, "node_modules", ".bin");
  const launcher = join(binRoot, "dev-flow-codex");
  if (operation === "install") {
    const state = await readState();
    state.installGeneration = (state.installGeneration ?? 0) + 1;
    state.packageRoot = packageRoot;
    await writeState(state);
    await mkdir(join(packageRoot, "runtime", "darwin-arm64"), { recursive: true, mode: 0o700 });
    await mkdir(join(packageRoot, "plugin", ".codex-plugin"), { recursive: true, mode: 0o700 });
    await mkdir(join(packageRoot, "plugin", "skills", "dev-flow"), { recursive: true, mode: 0o700 });
    await mkdir(binRoot, { recursive: true, mode: 0o700 });
    await Promise.all([
      copyFile(
        join(sourcePackageRoot, "plugin", ".codex-plugin", "plugin.json"),
        join(packageRoot, "plugin", ".codex-plugin", "plugin.json"),
      ),
      copyFile(
        join(sourcePackageRoot, "plugin", "skills", "dev-flow", "SKILL.md"),
        join(packageRoot, "plugin", "skills", "dev-flow", "SKILL.md"),
      ),
    ]);
    await writeWrapper(launcher, "launcher", { FAKE_NATIVE_PACKAGE_ROOT: packageRoot });
    await writeWrapper(join(packageRoot, "runtime", "darwin-arm64", "dev-flow"), "core");
    process.exit(0);
  }
  if (operation === "uninstall") {
    await rm(packageRoot, { recursive: true, force: true });
    await unlink(launcher).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    process.exit(0);
  }
  fail(`unsupported fake npm operation: ${operation}`);
}

async function runLauncher(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "--version") {
    process.stdout.write(`dev-flow-codex ${packageVersion} (core ${packageVersion})\n`);
    return;
  }
  const operation = arguments_[0];
  if (!['setup', 'remove'].includes(operation) || arguments_[1] !== "--json") {
    fail(`unsupported fake launcher command: ${arguments_.join(" ")}`);
  }
  const state = await readState();
  const receiptPath = join(
    requiredPath("HOME"),
    "Library",
    "Application Support",
    "dev-flow",
    "registrations",
    "codex.json",
  );
  if (operation === "setup") {
    if (state.registrationActive) {
      process.stdout.write(`${JSON.stringify({ operation, status: "already-installed", changed: false })}\n`);
      return;
    }
    const packageRoot = requiredPath("FAKE_NATIVE_PACKAGE_ROOT");
    state.registrationActive = true;
    state.packageRoot = packageRoot;
    await writeState(state);
    await mkdir(dirname(receiptPath), { recursive: true, mode: 0o700 });
    await writeFile(receiptPath, `${JSON.stringify({
      schema_version: 3,
      product: { name: "dev-flow-codex", version: packageVersion },
      registration: { marketplace_name: "dev-flow-local", plugin_selector: "dev-flow-codex@dev-flow-local" },
    })}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ operation, status: "installed", changed: true })}\n`);
    return;
  }
  if (!state.registrationActive) {
    process.stdout.write(`${JSON.stringify({ operation, status: "already-absent", changed: false })}\n`);
    return;
  }
  state.registrationActive = false;
  await writeState(state);
  await unlink(receiptPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  process.stdout.write(`${JSON.stringify({ operation, status: "removed", changed: true })}\n`);
}

async function runCodex(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "--version") {
    process.stdout.write("codex-cli 0.147.0\n");
    return;
  }
  if (arguments_[0] === "plugin") {
    await runCodexPlugin(arguments_.slice(1));
    return;
  }
  if (arguments_[0] !== "exec" || arguments_[1] !== "--json") {
    fail(`unsupported fake Codex command: ${arguments_.join(" ")}`);
  }
  await runCodexExec(arguments_.at(-1));
}

async function runCodexPlugin(arguments_) {
  const state = await readState();
  const injection = process.env.FAKE_NATIVE_EXTRA_REGISTRATION ?? "";
  const stage = (state.installGeneration ?? 0) > 1 ? "reinstall" : "setup";
  const packageRoot = state.packageRoot;
  const marketplace = {
    name: "dev-flow-local",
    root: packageRoot,
    marketplaceSource: { sourceType: "local", source: packageRoot },
  };
  const plugin = {
    pluginId: "dev-flow-codex@dev-flow-local",
    name: "dev-flow-codex",
    marketplaceName: "dev-flow-local",
    version: packageVersion,
    installed: true,
    enabled: true,
    source: { source: "local", path: join(packageRoot, "plugin") },
    marketplaceSource: { sourceType: "local", source: packageRoot },
    installPolicy: "AVAILABLE",
    authPolicy: "ON_INSTALL",
  };
  if (arguments_[0] === "marketplace" && arguments_[1] === "list" && arguments_.includes("--json")) {
    const marketplaces = state.registrationActive ? [marketplace] : [];
    if (injection === `${stage}-marketplace`) {
      marketplaces.push({ ...marketplace, name: "unexpected-marketplace" });
    }
    process.stdout.write(`${JSON.stringify({ marketplaces })}\n`);
    return;
  }
  if (arguments_[0] === "list" && arguments_.includes("--json")) {
    const installed = state.registrationActive ? [plugin] : [];
    const available = [];
    if (injection === `${stage}-installed`) {
      installed.push({ ...plugin, pluginId: "unexpected@dev-flow-local", name: "unexpected" });
    }
    if (injection === `${stage}-available`) {
      available.push({ ...plugin, installed: false, enabled: false });
    }
    process.stdout.write(`${JSON.stringify({ installed, available })}\n`);
    return;
  }
  fail(`unsupported fake Codex plugin command: ${arguments_.join(" ")}`);
}

async function runCodexExec(prompt) {
  let roleName;
  if (/^Reply with one short sentence/u.test(prompt)) roleName = "ordinary";
  else if (/cannot run outside a Git worktree/u.test(prompt)) roleName = "invalid";
  else if (/create native-proof\.txt/u.test(prompt)) roleName = "substantive";
  else if (/Resume the existing compatible/u.test(prompt)) roleName = "resume";
  else fail("fake Codex received an unknown native prompt");

  const identity = await installedSkillIdentity();
  const selected = prompt.split(/\s+/u).includes(identity.explicitSelector);
  await trace({ role: "native-skill-resolution", ...identity, selected });

  process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: `thread-${roleName}` })}\n`);
  if (roleName === "ordinary") {
    await emitProcessCommand({
      traceRole: "native-ordinary-ambient-command",
      itemId: "command-ordinary-ambient",
      renderedCommand: "/bin/zsh -lc pwd",
      executable: "/bin/zsh",
      arguments_: ["-lc", "pwd"],
    });
    return;
  }
  if (roleName === "invalid") {
    await emitProcessCommand({
      traceRole: "native-invalid-git-probe",
      itemId: "command-invalid-git-probe",
      renderedCommand: "/bin/zsh -lc 'git rev-parse --show-toplevel'",
      executable: "git",
      arguments_: ["rev-parse", "--show-toplevel"],
    });
    return;
  }
  if (!selected) return;
  if (roleName === "substantive") {
    await writeFile(join(process.cwd(), "native-proof.txt"), "Dev Flow Codex native journey passed.\n", { mode: 0o600 });
    await mkdir(requiredPath("DEV_FLOW_DATA_DIR"), { recursive: true, mode: 0o700 });
    await writeFile(join(requiredPath("DEV_FLOW_DATA_DIR"), "dev-flow.db"), "fake retained Core data\n", { mode: 0o600 });
    await emitProcessCommand({
      traceRole: "native-substantive-repository-command",
      itemId: "command-substantive-repository",
      renderedCommand: "/bin/zsh -lc 'git status --short'",
      executable: "git",
      arguments_: ["status", "--short"],
    });
    if (process.env.FAKE_NATIVE_SESSION_MODE === "substantive-no-apply") return;
    await emitMCP("dev_flow_apply_action", coreEnvelope(4, "action-implement", false));
    return;
  }
  await emitMCP("dev_flow_get_task", coreEnvelope(4, "action-read-task", false, "dev_flow_get_task"));
  await emitMCP("dev_flow_get_next_action", coreEnvelope(4, "action-read-next", false, "dev_flow_get_next_action"));
  const sessionMode = process.env.FAKE_NATIVE_SESSION_MODE ?? "normal";
  if (sessionMode === "recoverable-core-error") {
    await emitMCP("dev_flow_apply_action", recoverableCoreErrorEnvelope(), {
      arguments_: recoverableApplyArguments(),
      status: "failed",
      traceRole: "native-recoverable-mcp-result",
    });
    const recoveryTask = coreEnvelope(4, "action-recovery-task", false, "dev_flow_get_task");
    const recoveryNext = coreEnvelope(4, "action-recovery-next", false, "dev_flow_get_next_action");
    await emitMCP("dev_flow_get_task", recoveryTask);
    await emitMCP("dev_flow_get_next_action", recoveryNext);
  } else if (sessionMode === "transport-error") {
    await emitTransportMCPFailure("dev_flow_apply_action", transportMCPError(), recoverableApplyArguments());
    return;
  }
  const objectFormatResult = await captureProcessResult("git", ["rev-parse", "--show-object-format"], {
    cwd: process.cwd(),
  });
  await trace({
    role: "native-target-object-format",
    executable: "git",
    argv: ["rev-parse", "--show-object-format"],
    cwd: process.cwd(),
    processResult: objectFormatResult,
  });
  await emitProcessCommand({
    traceRole: "native-proof-command",
    itemId: "command-targeted",
    renderedCommand: nativeVerificationRenderedCommand,
    executable: "git",
    arguments_: ["hash-object", "native-proof.txt"],
    logicalCommand: nativeVerificationCommand,
  });
  await emitMCP("dev_flow_apply_action", coreEnvelope(8, "action-handoff", true));
}

async function installedSkillIdentity() {
  const state = await readState();
  const packageRoot = state.packageRoot;
  if (!packageRoot || !isAbsolute(packageRoot)) fail("fake Codex requires one installed package root");
  const manifest = JSON.parse(await readFile(join(packageRoot, "plugin", ".codex-plugin", "plugin.json"), "utf8"));
  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    fail("fake installed plugin manifest requires one name");
  }
  const skill = await readFile(join(packageRoot, "plugin", "skills", "dev-flow", "SKILL.md"), "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(skill)?.[1] ?? "";
  const names = [...frontmatter.matchAll(/^name:\s*([^\s]+)\s*$/gmu)].map((match) => match[1]);
  if (names.length !== 1) fail("fake installed Skill requires one frontmatter name");
  const pluginName = manifest.name;
  const skillName = names[0];
  const fullName = `${pluginName}:${skillName}`;
  return {
    pluginName,
    skillName,
    fullName,
    explicitSelector: `$${fullName}`,
  };
}

async function emitProcessCommand({
  traceRole,
  itemId,
  renderedCommand,
  executable,
  arguments_,
  logicalCommand,
}) {
  const processResult = await captureProcessResult(executable, arguments_, { cwd: process.cwd() });
  const event = {
    type: "item.completed",
    item: {
      id: itemId,
      type: "command_execution",
      command: renderedCommand,
      aggregated_output: processResult.aggregatedOutput,
      exit_code: processResult.exitCode,
      status: processResult.exitCode === 0 ? "completed" : "failed",
    },
  };
  await trace({
    role: traceRole,
    ...(logicalCommand ? { logicalCommand } : {}),
    renderedCommand,
    executable,
    argv: arguments_,
    cwd: process.cwd(),
    processResult,
    event,
  });
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function captureProcessResult(executable, arguments_, { cwd }) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(executable, arguments_, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let aggregatedOutput = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      aggregatedOutput += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      aggregatedOutput += chunk;
    });
    child.once("error", rejectResult);
    child.once("close", (exitCode, signal) => {
      if (!Number.isInteger(exitCode) || signal !== null) {
        rejectResult(new Error(`fake native proof command terminated by ${signal ?? "unknown status"}`));
        return;
      }
      resolveResult({ exitCode, stdout, stderr, aggregatedOutput });
    });
  });
}

async function emitMCP(tool, envelope, {
  arguments_ = { request_id: envelope.request_id },
  status = "completed",
  traceRole,
  } = {}) {
  if (tool === "dev_flow_apply_action" && envelope.result?.task?.phase === "DONE") {
    arguments_.task_id = "task-00000001";
    arguments_.expected_revision = 4;
    arguments_.payload = { checks: [automatedEvidenceInput()] };
  }
  const event = {
    type: "item.completed",
    item: {
      id: `item-${envelope.request_id}-${tool}`,
      type: "mcp_tool_call",
      server: "dev-flow",
      tool,
      arguments: arguments_,
      result: {
        content: [{ type: "text", text: JSON.stringify(envelope) }],
        structured_content: envelope,
      },
      error: null,
      status,
    },
  };
  if (traceRole) await trace({ role: traceRole, event });
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function emitTransportMCPFailure(tool, error, arguments_) {
  const event = {
    type: "item.completed",
    item: {
      id: "item-transport-failed-apply",
      type: "mcp_tool_call",
      server: "dev-flow",
      tool,
      arguments: arguments_,
      result: null,
      error,
      status: "failed",
    },
  };
  await trace({ role: "native-transport-mcp-error", event });
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function recoverableCoreErrorEnvelope() {
  return {
    schema_version: 1,
    ok: false,
    request_id: "request-recoverable-failed-apply",
    tool: "dev_flow_apply_action",
    error: {
      code: "REVISION_CONFLICT",
      message: "The submitted task revision is stale.",
    },
    recovery: {
      retry_safe: false,
      action: "read_task",
      message: "Read the authoritative task before another mutation.",
    },
  };
}

function recoverableApplyArguments() {
  return {
    request_id: "request-recoverable-failed-apply",
    task_id: "task-00000001",
    expected_revision: 4,
    action_id: "action-handoff",
    payload: {
      result: "succeeded",
      summary: "bounded deterministic recovery fixture",
      changed_paths: ["native-proof.txt"],
      no_file_changes: false,
      deviations: [],
      scope_confirmed: true,
    },
  };
}

function transportMCPError() {
  return {
    code: -32000,
    message: "MCP transport disconnected before a result",
  };
}

function coreEnvelope(revision, actionId, terminal, tool = "dev_flow_apply_action") {
  const task = {
    task_id: "task-00000001",
    revision,
    phase: terminal ? "DONE" : "IMPLEMENT",
    last_operation: {
      kind: tool === "dev_flow_apply_action" ? "apply_action" : "read",
      action_id: actionId,
      to_revision: revision,
    },
    outcome: terminal ? { status: "completed" } : null,
  };
  task.contract = { verification_budget: verificationBudget() };
  if (terminal) {
    task.evidence = [{
      evidence_id: "evidence-targeted",
      source: "automated",
      name: nativeVerificationCommand,
      status: "passed",
      summary: "one targeted command passed",
      digest: "a".repeat(64),
      command_count: 1,
      full_suite: false,
      recorded_at: "2026-08-16T00:00:00Z",
    }];
  }
  const envelope = {
    schema_version: 1,
    ok: true,
    request_id: `request-${revision}`,
    tool,
    result: { task },
  };
  if (tool === "dev_flow_get_next_action") envelope.result = task;
  return envelope;
}

function verificationBudget() {
  return {
    level: "targeted",
    max_automatic_commands: 1,
    allow_full_suite: false,
    allow_manual_handoff: true,
  };
}

function automatedEvidenceInput() {
  return {
    source: "automated",
    name: nativeVerificationCommand,
    status: "passed",
    summary: "one targeted command passed",
    command_count: 1,
    full_suite: false,
  };
}

async function runCore(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "version") {
    process.stdout.write(`dev-flow ${packageVersion}\n`);
    return;
  }
  if (arguments_[0] !== "mcp" || arguments_[1] !== "--stdio") {
    fail(`unsupported fake Core command: ${arguments_.join(" ")}`);
  }
  const mode = process.env.FAKE_NATIVE_CORE_MODE ?? "normal";
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let injected = false;
  for await (const line of lines) {
    await trace({ role: "core-stdin", line });
    const request = JSON.parse(line);
    if (request.id === undefined) continue;
    const response = coreResponse(request);
    if (!injected) {
      injected = true;
      if (mode === "non-json") process.stdout.write("protocol contamination\n");
      if (mode === "unknown-id") process.stdout.write(`${JSON.stringify({ ...response, id: 999_999 })}\n`);
      if (mode === "stdout-bound") process.stdout.write(`${"x".repeat(2 * 1024 * 1024)}\n`);
      if (mode === "stderr-bound") process.stderr.write("x".repeat(2 * 1024 * 1024));
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
    if (mode === "duplicate-id" && request.id === 1) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  }
}

function coreResponse(request) {
  if (request.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "dev-flow", version: packageVersion } },
    };
  }
  if (request.method === "tools/call" && request.params?.name === "dev_flow_server_info") {
    return structuredResponse(request.id, {
      schema_version: 1,
      ok: true,
      request_id: "request-server-info",
      tool: "dev_flow_server_info",
      result: { product: "dev-flow", version: packageVersion },
    });
  }
  if (request.method === "tools/call" && request.params?.name === "dev_flow_get_task") {
    return structuredResponse(request.id, coreEnvelope(8, "action-handoff", true, "dev_flow_get_task"));
  }
  return { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "unknown fake Core method" } };
}

function structuredResponse(id, envelope) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
      structuredContent: envelope,
    },
  };
}

async function writeWrapper(path, wrapperRole, extraEnvironment = {}) {
  const exports = Object.entries(extraEnvironment)
    .map(([name, value]) => `export ${name}=${shellQuote(value)}\n`)
    .join("");
  await writeFile(
    path,
    `#!/bin/sh\n${exports}exec ${shellQuote(process.execPath)} ${shellQuote(toolPath)} ${shellQuote(wrapperRole)} "$@"\n`,
    { mode: 0o700 },
  );
  await chmod(path, 0o700);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function requiredPath(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value)) fail(`${name} must name an absolute fake-only path`);
  return resolve(value);
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function writeState(state) {
  await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
  await writeFile(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
}

async function trace(entry) {
  await mkdir(dirname(tracePath), { recursive: true, mode: 0o700 });
  await appendFile(tracePath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

function fail(message, code = 64) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
