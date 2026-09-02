#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { execPortableCommand } from "../packages/dev-flow/lib/command.mjs";
import { buildCoreRuntimes } from "./build-core-runtimes.mjs";
import { stageAndPack } from "./dev-flow-local.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = resolve(dirname(scriptPath), "..");

export async function buildDeepSeekLocal({
  repositoryRoot = defaultRepositoryRoot,
  outputDirectory,
  environment = process.env,
  run = runCommand,
} = {}) {
  const root = await realpath(resolve(repositoryRoot));
  const output = await resolveExternalOutput(root, outputDirectory);
  const manifest = JSON.parse(await readFile(join(root, "packages", "deepseek", "package.json"), "utf8"));
  if (manifest.name !== "dev-flow-deepseek" || typeof manifest.version !== "string") {
    throw new Error("DeepSeek package manifest identity is invalid");
  }

  const artifactPath = join(output, `dev-flow-deepseek-${manifest.version}.tgz`);
  await assertMissing(artifactPath);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "dev-flow-deepseek-build-"));
  try {
    const stageRoot = join(temporaryRoot, "stages");
    const temporaryOutput = join(temporaryRoot, "artifacts");
    await Promise.all([
      mkdir(stageRoot, { recursive: true, mode: 0o755 }),
      mkdir(temporaryOutput, { recursive: true, mode: 0o755 }),
    ]);

    const runtimeReport = await buildCoreRuntimes({
      repositoryRoot: root,
      outputRoot: join(temporaryRoot, "runtimes"),
      environment,
      run,
    });
    const coreArtifacts = new Map(
      Object.values(runtimeReport.runtimes).map((runtime) => [runtime.relativePath, runtime]),
    );
    const staged = await stageAndPack("deepseek", {
      root,
      stageRoot,
      outputRoot: temporaryOutput,
      coreArtifacts,
      run,
    });
    await copyFile(staged.path, artifactPath, constants.COPYFILE_EXCL);

    const [sourceCommitResult, sourceStatusResult] = await Promise.all([
      run("git", ["rev-parse", "HEAD"], { cwd: root, environment }),
      run("git", ["status", "--porcelain"], { cwd: root, environment }),
    ]);
    const sourceCommit = sourceCommitResult.stdout.trim();
    if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error("could not resolve the source commit");
    const artifact = await realpath(artifactPath);
    if (!(await stat(artifact)).isFile()) throw new Error("DeepSeek package artifact is missing");

    return Object.freeze({
      artifact_path: artifact,
      artifact_sha256: sha256(await readFile(artifact)),
      package_version: manifest.version,
      core_version: runtimeReport.coreVersion,
      source_commit: sourceCommit,
      source_dirty: sourceStatusResult.stdout.trim() !== "",
      platforms: Object.keys(runtimeReport.runtimes).sort(),
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function parseArguments(arguments_) {
  if (arguments_.length !== 2 || arguments_[0] !== "--output" || !isAbsolute(arguments_[1])) {
    throw new Error("usage: build-deepseek-local.mjs --output ABSOLUTE_DIRECTORY");
  }
  return { outputDirectory: arguments_[1] };
}

async function resolveExternalOutput(root, path) {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error("output directory must be absolute");
  }
  const output = await realpath(path);
  if (!(await stat(output)).isDirectory()) throw new Error("output path must be a directory");
  const relativeOutput = relative(root, output);
  if (
    relativeOutput === "" ||
    (!isAbsolute(relativeOutput) && relativeOutput !== ".." && !relativeOutput.startsWith(`..${sep}`))
  ) {
    throw new Error("output directory must be outside the source repository");
  }
  return output;
}

async function assertMissing(path) {
  try {
    await lstat(path);
    throw new Error(`output already exists: ${basename(path)}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function runCommand(executable, arguments_, {
  cwd,
  environment = process.env,
} = {}) {
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

if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => "") === await realpath(scriptPath)) {
  buildDeepSeekLocal(parseArguments(process.argv.slice(2))).then(
    (report) => process.stdout.write(`${JSON.stringify(report)}\n`),
    (error) => {
      process.stderr.write(`build-deepseek-local: ${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
