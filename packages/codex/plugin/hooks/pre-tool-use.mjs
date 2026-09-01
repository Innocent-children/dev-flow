#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 1024 * 1024;
const PATCH_HEADERS = ["*** Add File: ", "*** Update File: ", "*** Delete File: ", "*** Move to: "];
const HOST_CHECK_COMMAND = "dev-flow-codex";

export function preparedWriteFromHook(value) {
  if (!isObject(value) || value.hook_event_name !== "PreToolUse" || value.tool_name !== "apply_patch" ||
      typeof value.cwd !== "string" || !isAbsolute(value.cwd) || !isObject(value.tool_input) ||
      typeof value.tool_input.command !== "string") {
    return undefined;
  }
  const command = value.tool_input.command;
  const paths = [];
  let parseComplete = command.startsWith("*** Begin Patch\n") && command.trimEnd().endsWith("*** End Patch");
  for (const line of command.split("\n")) {
    const header = PATCH_HEADERS.find((candidate) => line.startsWith(candidate));
    if (header === undefined) continue;
    const rawPath = line.slice(header.length);
    if (rawPath === "" || rawPath.includes("\0") || rawPath !== rawPath.trim()) {
      parseComplete = false;
      continue;
    }
    paths.push(resolve(value.cwd, rawPath));
  }
  if (paths.length === 0) parseComplete = false;
  const uniquePaths = [...new Set(paths)].sort();
  const intentDigest = createHash("sha256")
    .update(JSON.stringify({ tool_name: "apply_patch", tool_input: { command } }))
    .digest("hex");
  return {
    host: "codex",
    repository_path: value.cwd,
    tool_name: "apply_patch",
    paths: uniquePaths,
    intent_digest: intentDigest,
    path_parse_complete: parseComplete,
  };
}

export function hookDecision(result) {
  if (!isObject(result) || (result.decision !== "allow" && result.decision !== "deny")) return undefined;
  if (result.decision === "allow") return null;
  const reason = typeof result.reason === "string" && result.reason.trim() !== ""
    ? result.reason
    : "Dev Flow stopped this write before execution.";
  return {
    systemMessage: reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

export function runHook({
  output = process.stdout,
  error = process.stderr,
  environment = process.env,
  spawn = spawnSync,
  readInput = () => readFileSync(0, "utf8"),
} = {}) {
  let raw;
  try {
    raw = readInput();
    if (typeof raw !== "string" || Buffer.byteLength(raw) > MAX_INPUT_BYTES) throw new Error("invalid input");
  } catch {
    error.write("Dev Flow could not read the Codex PreToolUse event.\n");
    return 2;
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    error.write("Dev Flow received an invalid Codex PreToolUse event.\n");
    return 2;
  }
  const request = preparedWriteFromHook(event);
  if (request === undefined) return 0;
  const homeDirectory = environment.HOME || homedir();
  const dataDirectory = environment.DEV_FLOW_DATA_DIR || join(homeDirectory, "Library", "Application Support", "dev-flow", "data");
  if (!existsSync(dataDirectory)) return 0;
  const child = spawn(HOST_CHECK_COMMAND, ["host-check", "pre-file-write"], {
    cwd: request.repository_path,
    env: { ...environment, DEV_FLOW_DATA_DIR: dataDirectory },
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  if (child.status !== 0 || child.error !== undefined) {
    error.write("Dev Flow file-scope check was unavailable; the write was stopped.\n");
    return 2;
  }
  let result;
  try {
    result = JSON.parse(child.stdout);
  } catch {
    error.write("Dev Flow file-scope check returned an invalid result; the write was stopped.\n");
    return 2;
  }
  const decision = hookDecision(result);
  if (decision === undefined) {
    error.write("Dev Flow file-scope check returned an unknown decision; the write was stopped.\n");
    return 2;
  }
  if (decision !== null) output.write(`${JSON.stringify(decision)}\n`);
  return 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runHook();
}
