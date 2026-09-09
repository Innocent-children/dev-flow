#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectPackagedRuntime } from "../../../lib/runtime.mjs";
import { resolveDataDirectory } from "../../../lib/paths.mjs";

async function readInput(input) {
  const chunks = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 1024 * 1024) throw new Error("artifact input exceeds 1 MiB");
    chunks.push(bytes);
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
}

// The Skill helper selects the installed runtime and data directory. Core owns
// closed input validation, repository observation and artifact preparation.
export async function runArtifactCommand(args, {
  input = process.stdin, output = process.stdout, error = process.stderr,
  environment = process.env, selectRuntime = selectPackagedRuntime,
  resolveData = resolveDataDirectory, spawnImpl = spawn,
} = {}) {
  if (args.length === 1 && args[0] === "--help" || args.length === 2 && ["collect", "prepare"].includes(args[0]) && args[1] === "--help") {
    output.write("Usage: node <skill-directory>/scripts/artifacts.mjs collect|prepare [--help]\nSend one closed UTF-8 JSON object on stdin with host=deepseek (at most 1 MiB).\nCore returns {ok:true,result} or {ok:false,error}; exit 0/1. Read references/artifact-contract.md for complete inputs and outputs.\n");
    return 0;
  }
  if (args.length !== 1 || !["collect", "prepare"].includes(args[0])) {
    error.write("DeepSeek artifact helper: expected collect, prepare, or --help\n");
    return 2;
  }
  try {
    const raw = await readInput(input);
    let request;
    try { request = JSON.parse(raw); }
    catch { throw new Error("artifact input must be one valid JSON object"); }
    if (request?.host !== "deepseek") throw new Error("artifact input must use host=deepseek");
    const [runtime, data] = await Promise.all([selectRuntime(), resolveData({ environment })]);
    const child = spawnImpl(runtime.runtimePath, ["artifacts", args[0]], {
      env: { ...environment, DEV_FLOW_DATA_DIR: data.dataDirectory },
      stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true,
    });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(error, { end: false });
    return await new Promise((resolveCode, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolveCode(code ?? 1));
      child.stdin.on("error", reject);
      child.stdin.end(raw);
    });
  } catch (failure) {
    error.write(`DeepSeek artifact helper: ${failure.message}\n`);
    return 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runArtifactCommand(process.argv.slice(2));
}
