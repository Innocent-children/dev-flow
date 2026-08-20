#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { releaseOutputNames } from "./verify-codex-release.mjs";

const execFile = promisify(execFileCallback);
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export function parseReleaseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  let outputDirectory = null;
  let confirmation = null;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument !== "--output" && argument !== "--confirm") {
      throw new Error(`unknown argument ${argument}`);
    }
    if (index + 1 >= normalized.length) throw new Error(`missing value for ${argument}`);
    const value = normalized[index + 1];
    index += 1;
    if (argument === "--output") {
      if (outputDirectory !== null) throw new Error("--output may be supplied only once");
      outputDirectory = value;
    } else {
      if (confirmation !== null) throw new Error("--confirm may be supplied only once");
      confirmation = value;
    }
  }
  if (outputDirectory === null || confirmation === null) {
    throw new Error("usage: release-codex.mjs --output ABSOLUTE_DIRECTORY --confirm vVERSION");
  }
  return { outputDirectory, confirmation };
}

export async function runReleaseCommand({
  outputDirectory,
  confirmation,
  repositoryRoot = repositoryRootFromModule(),
  platform = process.platform,
  architecture = process.arch,
  runProcess = spawnProcess,
} = {}) {
  const root = await canonicalDirectory(repositoryRoot, "repository root");
  const version = await validateVersionAuthorities(root);
  const tag = `v${version}`;
  if (confirmation !== tag) throw new Error(`confirmation must equal ${tag}`);
  if (platform !== "darwin" || architecture !== "arm64") {
    throw new Error("release command requires darwin-arm64");
  }

  const source = await validateSource(root);
  const output = await resolveOutputDirectory(root, outputDirectory);
  const expectedNames = releaseOutputNames(version);
  const initialNames = await releaseDirectoryNames(output);
  let mode;

  if (initialNames.length === 0) {
    await runProcess(join(root, "scripts", "build-codex-release.sh"), ["--output", output], { cwd: root });
    await requireExactReleaseFiles(output, expectedNames);
    await runProcess(process.execPath, [join(root, "scripts", "verify-codex-release.mjs"), "--directory", output], { cwd: root });
    mode = "prepared-and-published";
  } else {
    await requireExactReleaseFiles(output, expectedNames);
    mode = "resumed-and-published";
  }

  await runProcess(process.execPath, [
    join(root, "scripts", "publish-codex-release.mjs"),
    "--directory", output,
    "--confirm", confirmation,
  ], { cwd: root });

  return {
    status: "complete",
    mode,
    version,
    tag,
    source_commit: source.commit,
    source_tree: source.tree,
    output_files: expectedNames,
  };
}

async function validateVersionAuthorities(root) {
  const version = (await readFile(join(root, "VERSION"), "utf8")).trim();
  if (!SEMVER_PATTERN.test(version)) throw new Error("root VERSION must be strict MAJOR.MINOR.PATCH");
  const manifests = await Promise.all([
    readJSON(join(root, "package.json")),
    readJSON(join(root, "packages", "codex", "package.json")),
    readJSON(join(root, "packages", "codex", "plugin", ".codex-plugin", "plugin.json")),
    readJSON(join(root, "packages", "deepseek", "package.json")),
  ]);
  const identities = [
    [manifests[0], "dev-flow"],
    [manifests[1], "dev-flow-codex"],
    [manifests[2], "dev-flow-codex"],
    [manifests[3], "dev-flow-deepseek"],
  ];
  if (identities.some(([manifest, name]) => manifest.name !== name || manifest.version !== version)) {
    throw new Error(`version authorities must equal ${version}`);
  }
  return version;
}

async function validateSource(root) {
  const branch = await runText("git", ["symbolic-ref", "--short", "HEAD"], { cwd: root });
  if (branch !== "main") throw new Error("release command requires branch main");
  const status = await runText("git", ["status", "--porcelain"], { cwd: root });
  if (status !== "") throw new Error("release command requires a clean source checkout");
  const [commit, tree, remoteCommit] = await Promise.all([
    runText("git", ["rev-parse", "HEAD"], { cwd: root }),
    runText("git", ["rev-parse", "HEAD^{tree}"], { cwd: root }),
    runText("git", ["rev-parse", "origin/main"], { cwd: root }),
  ]);
  if (![commit, tree, remoteCommit].every((value) => GIT_SHA_PATTERN.test(value))) {
    throw new Error("release source identities must be complete lowercase Git SHAs");
  }
  if (commit !== remoteCommit) throw new Error("release command HEAD must equal origin/main");
  return { commit, tree };
}

async function resolveOutputDirectory(root, outputDirectory) {
  if (typeof outputDirectory !== "string" || !isAbsolute(outputDirectory)) {
    throw new Error("release output must be an absolute path");
  }
  let output;
  try {
    const info = await lstat(outputDirectory);
    if (info.isSymbolicLink()) throw new Error("release output must not be a symbolic link");
    if (!info.isDirectory()) throw new Error("release output must be a directory");
    output = await realpath(outputDirectory);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const parent = await canonicalDirectory(dirname(outputDirectory), "release output parent");
    output = join(parent, basename(outputDirectory));
    assertOutsideRoot(root, output);
    await mkdir(output, { mode: 0o700 });
    output = await realpath(output);
  }
  assertOutsideRoot(root, output);
  return output;
}

async function requireExactReleaseFiles(directory, expectedNames) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("release output must contain the exact five-file set");
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`release output ${entry.name} must be a regular file`);
    }
    const info = await lstat(join(directory, entry.name));
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`release output ${entry.name} must be a regular file`);
    }
  }
}

async function releaseDirectoryNames(directory) {
  return (await readdir(directory)).sort();
}

async function canonicalDirectory(path, label) {
  const canonical = await realpath(path);
  const info = await lstat(canonical);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return canonical;
}

function assertOutsideRoot(root, candidate) {
  const offset = relative(root, candidate);
  if (offset === "" || (!offset.startsWith("..") && !isAbsolute(offset))) {
    throw new Error("release output must remain outside the source repository");
  }
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function runText(executable, arguments_, options) {
  const { stdout } = await execFile(executable, arguments_, {
    ...options,
    encoding: "utf8",
    maxBuffer: 128 * 1024,
    timeout: 60_000,
    windowsHide: true,
    shell: false,
  });
  return stdout.trim();
}

async function spawnProcess(executable, arguments_, options) {
  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(executable, arguments_, {
      ...options,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", rejectProcess);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveProcess();
      else rejectProcess(new Error(`${executable} failed with ${signal === null ? `exit ${code}` : `signal ${signal}`}`));
    });
  });
}

function boundedMessage(error) {
  return String(error?.message ?? error ?? "release command failed")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\/(?:Users|home|private\/var|var\/folders)\/[^\s:]+/gu, "<machine-path>")
    .slice(0, 500);
}

function repositoryRootFromModule() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const arguments_ = parseReleaseArguments(process.argv.slice(2));
    await runReleaseCommand(arguments_);
  } catch (error) {
    process.stderr.write(`release-codex: ${boundedMessage(error)}\n`);
    process.exitCode = 1;
  }
}
