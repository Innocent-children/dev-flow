import { spawn } from "node:child_process";
import { execFile as execFileCallback } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { listProfileReceipts, resolveManagerPaths } from "./ownership.mjs";

const execFile = promisify(execFileCallback);
const packageVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const forwardedSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
const help = `Dev Flow

Usage:
  dev-flow
  dev-flow status|doctor|install|upgrade|repair|reinstall|uninstall|factory-reset [options]
  dev-flow webui start [--no-open] [--plain|--json]
  dev-flow webui open|status|stop [--plain|--json]
  dev-flow webui reset [--confirm TOKEN] [--plain|--json]
  dev-flow version
`;

export async function runDevFlow(arguments_, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const environment = dependencies.environment ?? process.env;
  if (["help", "--help", "-h"].includes(arguments_[0])) {
    stdout.write(help);
    return { code: 0, signal: null };
  }
  try {
    if (arguments_[0] === "webui") assertWebUIArguments(arguments_);
    if (["version", "--version"].includes(arguments_[0])) {
      let selection;
      try {
        selection = await (dependencies.resolveCoreRuntime ?? resolveCoreRuntime)({ environment, homeDirectory: dependencies.homeDirectory, exec: dependencies.exec, requireData: false });
      } catch (error) {
        if (!(error instanceof NoRuntimeError)) throw error;
      }
      stdout.write(selection
        ? `dev-flow ${packageVersion} (core ${selection.version}, ${selection.source})\n`
        : `dev-flow ${packageVersion} (core unavailable)\n`);
      return { code: 0, signal: null };
    }
    const selection = await (dependencies.resolveCoreRuntime ?? resolveCoreRuntime)({
      environment,
      homeDirectory: dependencies.homeDirectory,
      exec: dependencies.exec,
      requireData: true,
    });
    return await launchCore(selection, arguments_, {
      environment,
      spawnImpl: dependencies.spawnImpl ?? spawn,
      signalSource: dependencies.signalSource ?? process,
    });
  } catch (error) {
    stderr.write(`dev-flow: ${error.message}\n`);
    return { code: 1, signal: null };
  }
}

export async function resolveCoreRuntime({
  environment = process.env,
  homeDirectory,
  exec = execFile,
  requireData = true,
} = {}) {
  const paths = await resolveManagerPaths({ homeDirectory, environment });
  const dataDirectory = paths.explicitDataDirectory ?? paths.defaultDataDirectory;
  const candidates = [];

  const codexReceipt = await readOptionalJSON(join(paths.productRoot, "registrations", "codex.json"), "Codex receipt");
  if (codexReceipt !== null) {
    const product = exactObject(codexReceipt.product, ["name", "version", "core_version", "codex_compatibility"], "Codex receipt product");
    const receiptPaths = exactObject(codexReceipt.paths, ["package_root", "runtime_path", "data_dir", "receipt_path"], "Codex receipt paths");
    if (product.name !== "dev-flow-codex" || !semverPattern.test(product.version) || !semverPattern.test(product.core_version)) {
      throw new Error("Codex receipt product identity is invalid");
    }
    candidates.push(await preflightCandidate({
      source: "codex",
      packageName: "dev-flow-codex",
      packageVersion: product.version,
      expectedCoreVersion: product.core_version,
      packageRoot: receiptPaths.package_root,
      runtimePath: receiptPaths.runtime_path,
    }, exec, environment));
  }

  const dshHome = resolve(environment.DSH_HOME || join(paths.homeDirectory, ".dsh"));
  for (const receipt of await listProfileReceipts(paths)) {
    const packageRoot = join(dshHome, "profiles", receipt.profile, "node_modules", "dev-flow-deepseek");
    candidates.push(await preflightCandidate({
      source: `deepseek/${receipt.profile}`,
      packageName: "dev-flow-deepseek",
      packageVersion: receipt.installed_version,
      expectedCoreVersion: null,
      packageRoot,
      runtimePath: join(packageRoot, "runtime", "darwin-arm64", "dev-flow"),
    }, exec, environment));
  }

  if (candidates.length === 0) throw new NoRuntimeError("no installed Codex or DeepSeek Adapter provides a Core runtime");
  if (requireData) await assertCanonicalDirectory(dataDirectory, "Dev Flow data directory");
  candidates.sort((left, right) => compareSemver(right.version, left.version) || left.source.localeCompare(right.source));
  return Object.freeze({ ...candidates[0], dataDirectory });
}

export class NoRuntimeError extends Error {
  constructor(message) {
    super(message);
    this.name = "NoRuntimeError";
  }
}

async function preflightCandidate(candidate, exec, environment) {
  const packageRoot = await realpath(candidate.packageRoot).catch((error) => {
    throw new Error(`${candidate.source} package root is unavailable`, { cause: error });
  });
  if (packageRoot !== resolve(candidate.packageRoot) || !(await stat(packageRoot)).isDirectory()) {
    throw new Error(`${candidate.source} package root is not canonical`);
  }
  const manifest = await readOptionalJSON(join(packageRoot, "package.json"), `${candidate.source} package manifest`);
  if (manifest?.name !== candidate.packageName || manifest.version !== candidate.packageVersion) {
    throw new Error(`${candidate.source} package identity differs from its receipt`);
  }
  const runtimePath = await assertCanonicalExecutable(candidate.runtimePath, `${candidate.source} Core runtime`);
  const result = await exec(runtimePath, ["version"], { cwd: packageRoot, encoding: "utf8", maxBuffer: 64 * 1024, env: environment });
  const match = /^dev-flow (\S+)\n?$/u.exec(result.stdout);
  if (!match || !semverPattern.test(match[1]) || candidate.expectedCoreVersion && match[1] !== candidate.expectedCoreVersion) {
    throw new Error(`${candidate.source} Core identity differs from its receipt`);
  }
  return Object.freeze({ source: candidate.source, packageRoot, runtimePath, version: match[1] });
}

function assertWebUIArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_[0] !== "webui" || !["start", "open", "status", "stop", "reset"].includes(arguments_[1]) || arguments_.some((value) => typeof value !== "string" || value.includes("\0"))) {
    throw new Error("invalid arguments; run dev-flow help");
  }
}

async function launchCore(selection, arguments_, { environment, spawnImpl, signalSource }) {
  const child = spawnImpl(selection.runtimePath, arguments_, {
    cwd: selection.packageRoot,
    env: { ...environment, DEV_FLOW_DATA_DIR: selection.dataDirectory },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  const handlers = new Map();
  for (const signal of forwardedSignals) {
    const handler = () => child.kill(signal);
    handlers.set(signal, handler);
    signalSource.on(signal, handler);
  }
  const cleanup = () => { for (const [signal, handler] of handlers) signalSource.off(signal, handler); };
  return await new Promise((resolvePromise) => {
    child.once("error", () => { cleanup(); resolvePromise({ code: 1, signal: null }); });
    child.once("exit", (code, signal) => { cleanup(); resolvePromise({ code: code ?? 1, signal }); });
  });
}

async function readOptionalJSON(path, label) {
  let info;
  try { info = await lstat(path); } catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024) throw new Error(`${label} must be a bounded regular file`);
  try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { throw new Error(`${label} is invalid`, { cause: error }); }
}

function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} fields are invalid`);
  }
  return value;
}

async function assertCanonicalDirectory(path, label) {
  const canonical = await realpath(path).catch((error) => { throw new Error(`${label} is unavailable`, { cause: error }); });
  if (canonical !== resolve(path) || !(await stat(canonical)).isDirectory()) throw new Error(`${label} must be a canonical directory`);
}

async function assertCanonicalExecutable(path, label) {
  const info = await lstat(path).catch((error) => { throw new Error(`${label} is unavailable`, { cause: error }); });
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o111) === 0) throw new Error(`${label} must be a regular executable file`);
  await access(path, fsConstants.X_OK);
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error(`${label} must be canonical`);
  return canonical;
}

function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}
