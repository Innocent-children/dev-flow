#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { DEV_FLOW_TOOLS, parseCodexJSONL } from "./validate-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);

export const EXPLICIT_SELECTOR = "$dev-flow-codex:dev-flow";
export const ordinaryPrompt =
  "Reply with one short sentence describing this repository. Do not invoke Dev Flow.";
export const smokePrompt =
  `${EXPLICIT_SELECTOR} Inspect the current repository and report the authoritative Dev Flow task status.`;
export const acceptancePrompt =
  `${EXPLICIT_SELECTOR} Complete the bounded acceptance task in this repository and stop only at the Core outcome.`;
export const resumePrompt =
  `${EXPLICIT_SELECTOR} Resume the existing compatible Dev Flow task and continue to the Core outcome.`;

export function buildCodexExecArgs(prompt) {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new TypeError("Codex prompt must be nonempty");
  }
  return ["exec", "--json", prompt];
}

export async function runCodexSession({
  codexExecutable,
  workspace,
  role,
  prompt,
  runProcess = defaultRunProcess,
}) {
  requireAbsolute(codexExecutable, "Codex executable");
  requireAbsolute(workspace, "workspace");
  const result = await runProcess(codexExecutable, buildCodexExecArgs(prompt), { cwd: workspace });
  if (result.exitCode !== 0) {
    throw new Error(`${role} Codex session exited with ${result.exitCode}: ${result.stderr.trim()}`);
  }
  const parsed = parseCodexJSONL(result.stdout);
  return summarizeSession(role, parsed);
}

export async function runDevelopmentSmoke(options) {
  const ordinary = await runCodexSession({
    ...options,
    role: "ordinary",
    prompt: ordinaryPrompt,
  });
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary Codex smoke must make zero Dev Flow calls");
  }
  const explicit = await runCodexSession({
    ...options,
    role: "explicit",
    prompt: smokePrompt,
  });
  if (explicit.dev_flow_call_count === 0) {
    throw new Error("explicit Codex smoke must observe at least one Dev Flow call");
  }
  return {
    mode: "smoke",
    host: "codex-0.147",
    sessions: [ordinary, explicit],
    persistent_attempt_state: false,
    status: "pass",
  };
}

export async function runAcceptanceJourney(options) {
  const ordinary = await runCodexSession({
    ...options,
    role: "ordinary",
    prompt: ordinaryPrompt,
  });
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary acceptance session must make zero Dev Flow calls");
  }
  const substantive = await runCodexSession({
    ...options,
    role: "substantive",
    prompt: acceptancePrompt,
  });
  const resume = await runCodexSession({
    ...options,
    role: "resume",
    prompt: resumePrompt,
  });
  const tools = new Set([...substantive.tools, ...resume.tools]);
  if (!tools.has("dev_flow_server_info") || !tools.has("dev_flow_open_task")) {
    throw new Error("acceptance sessions must observe the handshake and task open/resume calls");
  }
  if (!resume.core_done) {
    throw new Error("acceptance resume session must end at authoritative Core DONE");
  }
  return {
    mode: "acceptance",
    host: "codex-0.147",
    sessions: [ordinary, substantive, resume],
    persistent_attempt_state: false,
    lifecycle_check_required: true,
    status: "pass",
  };
}

function summarizeSession(role, parsed) {
  return {
    role,
    thread_started: true,
    dev_flow_call_count: parsed.calls.length,
    tools: parsed.calls.map((call) => call.tool),
    terminal_shapes: parsed.calls.map((call) => call.shape),
    core_done: parsed.calls.some((call) => containsDone(call.structuredContent)),
  };
}

function containsDone(value) {
  if (Array.isArray(value)) return value.some(containsDone);
  if (value === null || typeof value !== "object") return false;
  if (value.phase === "DONE" || value.outcome?.status === "completed") return true;
  return Object.values(value).some(containsDone);
}

async function defaultRunProcess(executable, args, { cwd }) {
  try {
    const { stdout, stderr } = await execFile(executable, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : String(error?.message ?? error),
    };
  }
}

function requireAbsolute(value, label) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
}

function parseCLI(argv) {
  const mode = argv.shift();
  if (!["smoke", "acceptance"].includes(mode)) {
    throw new Error("mode must be smoke or acceptance");
  }
  const values = {};
  while (argv.length > 0) {
    const flag = argv.shift();
    if (!["--codex-executable", "--workspace"].includes(flag) || flag in values || argv.length === 0) {
      throw new Error("real smoke requires each exact path flag once");
    }
    values[flag] = argv.shift();
  }
  if (!values["--codex-executable"] || !values["--workspace"]) {
    throw new Error("real smoke requires --codex-executable ABS --workspace ABS");
  }
  return {
    mode,
    codexExecutable: values["--codex-executable"],
    workspace: values["--workspace"],
  };
}

async function main(argv) {
  const options = parseCLI([...argv]);
  const summary = options.mode === "smoke"
    ? await runDevelopmentSmoke(options)
    : await runAcceptanceJourney(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`codex-native-smoke: ${error.message}\n`);
    process.exitCode = 1;
  });
}
