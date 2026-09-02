#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { execPortableCommand } from "../packages/dev-flow/lib/command.mjs";
import { buildWebUI } from "./build-webui.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = resolve(dirname(scriptPath), "..");

export const CORE_RUNTIME_TARGETS = Object.freeze([
  Object.freeze({
    runtimeKey: "darwin-arm64",
    goos: "darwin",
    goarch: "arm64",
    executable: "dev-flow",
    requireExecutableMode: true,
  }),
  Object.freeze({
    runtimeKey: "win32-x64",
    goos: "windows",
    goarch: "amd64",
    executable: "dev-flow.exe",
    requireExecutableMode: false,
  }),
]);

export async function buildCoreRuntimes({
  repositoryRoot = defaultRepositoryRoot,
  outputRoot,
  environment = process.env,
  run = runCommand,
  buildAssets = true,
} = {}) {
  if (typeof outputRoot !== "string" || outputRoot === "") {
    throw new Error("runtime output root is required");
  }
  const root = resolve(repositoryRoot);
  const destinationRoot = resolve(outputRoot);
  const coreVersion = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(coreVersion)) {
    throw new Error("CORE_VERSION must be MAJOR.MINOR.PATCH");
  }
  if (buildAssets) await buildWebUI({ repositoryRoot: root, environment, run });

  const runtimes = {};
  for (const target of CORE_RUNTIME_TARGETS) {
    const directory = join(destinationRoot, target.runtimeKey);
    const runtimePath = join(directory, target.executable);
    await mkdir(directory, { recursive: true, mode: 0o755 });
    await run("go", [
      "build",
      "-mod=readonly",
      "-trimpath",
      "-buildvcs=false",
      "-ldflags",
      `-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=${coreVersion}`,
      "-o",
      runtimePath,
      "./cmd/dev-flow",
    ], {
      cwd: root,
      environment: {
        ...environment,
        CGO_ENABLED: "0",
        GOOS: target.goos,
        GOARCH: target.goarch,
      },
    });
    if (target.requireExecutableMode) await chmod(runtimePath, 0o755);
    const metadata = await run("go", ["version", "-m", runtimePath], {
      cwd: root,
      environment,
    });
    assertBuildMetadata(metadata.stdout, target);
    const contents = await readFile(runtimePath);
    runtimes[target.runtimeKey] = Object.freeze({
      runtimeKey: target.runtimeKey,
      path: runtimePath,
      relativePath: `runtime/${target.runtimeKey}/${target.executable}`,
      executable: target.executable,
      goos: target.goos,
      goarch: target.goarch,
      cgoEnabled: false,
      requireExecutableMode: target.requireExecutableMode,
      size: contents.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
    });
  }
  return Object.freeze({
    coreVersion,
    outputRoot: destinationRoot,
    runtimes: Object.freeze(runtimes),
  });
}

function assertBuildMetadata(output, target) {
  const normalized = String(output).replaceAll("\r\n", "\n");
  for (const expected of [
    `\tbuild\tGOOS=${target.goos}`,
    `\tbuild\tGOARCH=${target.goarch}`,
    "\tbuild\tCGO_ENABLED=0",
  ]) {
    if (!normalized.split("\n").includes(expected)) {
      throw new Error(`${target.runtimeKey} Core build metadata is missing ${expected.trim()}`);
    }
  }
}

async function runCommand(executable, arguments_, { cwd, environment }) {
  try {
    return await execPortableCommand(executable, arguments_, {
      cwd,
      env: environment,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 300_000,
      shell: false,
      windowsHide: true,
    });
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(`${executable} ${arguments_.join(" ")} failed${detail ? `: ${detail}` : ""}`, { cause: error });
  }
}

function parseArguments(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--output" || !isAbsolute(arguments_[1])) {
    throw new Error("usage: build-core-runtimes.mjs --output ABSOLUTE_DIRECTORY");
  }
  return { outputRoot: arguments_[1] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildCoreRuntimes(parseArguments(process.argv.slice(2))).then(
    (report) => process.stdout.write(`${JSON.stringify(report)}\n`),
    (error) => {
      process.stderr.write(`build-core-runtimes: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
