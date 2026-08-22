#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { homedir } from "node:os";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { releaseOutputNames } from "./verify-deepseek-release.mjs";

const execFile = promisify(execFileCallback);
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const RELEASE_MODES = Object.freeze(["quick", "normal"]);
const VERSION_AUTHORITY_PATHS = Object.freeze([
  "packages/deepseek/package.json",
]);
const QUICK_BLOCKED_PATHS = Object.freeze([
  "CORE_VERSION",
  "go.mod",
  "go.sum",
  "scripts/build-deepseek-runtime.sh",
  "packages/deepseek/tests/build-artifact.mjs",
]);
const QUICK_BLOCKED_PREFIXES = Object.freeze([
  "cmd/",
  "internal/",
  "protocol/",
  "packages/deepseek/",
]);

export function parseReleaseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values = new Map();
  let comprehensionConfirmed = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === "--confirm-comprehension") {
      if (comprehensionConfirmed) throw new Error("--confirm-comprehension may be supplied only once");
      comprehensionConfirmed = true;
      continue;
    }
    if (!["--mode", "--version", "--output", "--confirm"].includes(argument)) {
      throw new Error(`unknown argument ${argument}`);
    }
    if (values.has(argument)) throw new Error(`${argument} may be supplied only once`);
    if (index + 1 >= normalized.length) throw new Error(`missing value for ${argument}`);
    values.set(argument, normalized[index + 1]);
    index += 1;
  }
  if (!["--mode", "--version", "--confirm"].every((flag) => values.has(flag))) {
    throw new Error("usage: release-deepseek.mjs --mode quick|normal --version DEEPSEEK_VERSION [--output ABSOLUTE_DIRECTORY] --confirm deepseek-vDEEPSEEK_VERSION [--confirm-comprehension]");
  }
  return {
    mode: values.get("--mode"),
    targetVersion: values.get("--version"),
    outputDirectory: values.get("--output") ?? null,
    confirmation: values.get("--confirm"),
    comprehensionConfirmed,
  };
}

export function quickModeBlockingPaths(changedPaths) {
  return [...new Set(changedPaths.filter((path) => (
    QUICK_BLOCKED_PATHS.includes(path)
    || QUICK_BLOCKED_PREFIXES.some((prefix) => path.startsWith(prefix))
    || path === "packages/deepseek/package.json"
  )))].sort();
}

export async function runReleaseCommand({
  mode,
  targetVersion,
  outputDirectory = null,
  confirmation,
  comprehensionConfirmed = false,
  repositoryRoot = repositoryRootFromModule(),
  platform = process.platform,
  architecture = process.arch,
  environment = process.env,
  runProcess = spawnProcess,
} = {}) {
  const root = await canonicalDirectory(repositoryRoot, "repository root");
  validateReleaseSelection({ mode, targetVersion, confirmation, comprehensionConfirmed });
  if (platform !== "darwin" || architecture !== "arm64") throw new Error("release command requires darwin-arm64");

  let source = await validateSource(root);
  const output = await resolveOutputDirectory(root, outputDirectory ?? defaultOutputDirectory(targetVersion));
  const initialNames = await releaseDirectoryNames(output);
  let coreVersion;
  let basedOnRelease;
  let prepared = null;
  if (initialNames.length === 0) {
    let currentVersion = await validateDeepSeekAuthorities(root);
    coreVersion = await readCoreVersion(root);
    basedOnRelease = await previousDeepSeekRelease(root, targetVersion);
    if (currentVersion !== targetVersion) {
      if (compareSemVer(targetVersion, currentVersion) <= 0) {
        throw new Error(`target version ${targetVersion} must be greater than current version ${currentVersion}`);
      }
      const changedPaths = await changedPathsSinceTag(root, basedOnRelease);
      if (mode === "quick") {
        const blocked = quickModeBlockingPaths(changedPaths);
        if (blocked.length !== 0) throw new Error(`quick mode is not eligible; product-affecting paths: ${blocked.join(", ")}`);
      }
      await updateDeepSeekVersion(root, currentVersion, targetVersion);
      currentVersion = await validateDeepSeekAuthorities(root);
      await commitAndPushVersion(root, targetVersion);
      source = await validateSource(root);
    }
  } else {
    prepared = await requireMatchingPreparedMode(output, { mode, targetVersion });
    coreVersion = prepared.release.core_version;
    basedOnRelease = prepared.release.based_on_release;
  }

  const releaseEnvironment = {
    ...environment,
    DEV_FLOW_RELEASE_MODE: mode,
    DEV_FLOW_BASED_ON_RELEASE: basedOnRelease ?? "",
    DEV_FLOW_RELEASE_COMPREHENSION_CONFIRMED: comprehensionConfirmed ? "true" : "false",
  };
  let executionMode;
  let publicationRoot = root;
  let publicationSource = source;

  if (initialNames.length === 0) {
    const expectedNames = releaseOutputNames(targetVersion, coreVersion);
    await runModeValidation(root, mode, releaseEnvironment, runProcess);
    await runProcess(join(root, "scripts", "build-deepseek-release.sh"), ["--output", output], { cwd: root, env: releaseEnvironment });
    await requireExactReleaseFiles(output, expectedNames);
    await runProcess(process.execPath, [join(root, "scripts", "verify-deepseek-release.mjs"), "--directory", output], { cwd: root, env: releaseEnvironment });
    executionMode = "prepared-and-published";
  } else {
    const expectedNames = releaseOutputNames(targetVersion, coreVersion);
    await requireExactReleaseFiles(output, expectedNames);
    if (prepared.release.source_commit !== source.commit || prepared.release.source_tree !== source.tree) {
      publicationRoot = await ensureFrozenSourceCheckout(root, output, prepared.release.source_commit);
      publicationSource = await validateFrozenSource(publicationRoot, prepared.release);
    }
    executionMode = "resumed-and-published";
  }

  const expectedNames = releaseOutputNames(targetVersion, coreVersion);

  const publisherArguments = [
    join(root, "scripts", "publish-deepseek-release.mjs"),
    "--directory", output,
    "--confirm", confirmation,
  ];
  if (publicationRoot !== root) publisherArguments.push("--source-root", publicationRoot);
  await runProcess(process.execPath, publisherArguments, { cwd: root, env: releaseEnvironment });

  return {
    status: "complete",
    mode: executionMode,
    verification_mode: mode,
    based_on_release: basedOnRelease,
    version: targetVersion,
    core_version: coreVersion,
    tag: `deepseek-v${targetVersion}`,
    source_commit: publicationSource.commit,
    source_tree: publicationSource.tree,
    output_files: expectedNames,
  };
}

async function runModeValidation(root, mode, environment, runProcess) {
  if (mode === "normal") {
    await runProcess("pnpm", ["run", "validate"], { cwd: root, env: environment });
    return;
  }
  await runProcess("go", ["test", "./tests/contract"], { cwd: root, env: environment });
  await runProcess(process.execPath, ["--test", "packages/deepseek/tests/release-command.test.mjs"], {
    cwd: root,
    env: environment,
  });
}

function validateReleaseSelection({ mode, targetVersion, confirmation, comprehensionConfirmed }) {
  if (!RELEASE_MODES.includes(mode)) throw new Error("release mode must equal quick or normal");
  if (!SEMVER_PATTERN.test(targetVersion ?? "")) throw new Error("target version must be strict MAJOR.MINOR.PATCH");
  if (confirmation !== `deepseek-v${targetVersion}`) throw new Error(`confirmation must equal deepseek-v${targetVersion}`);
  if (mode === "normal" && comprehensionConfirmed !== true) {
    throw new Error("normal mode requires --confirm-comprehension");
  }
}

async function validateDeepSeekAuthorities(root) {
  const manifest = await readJSON(join(root, "packages", "deepseek", "package.json"));
  const version = manifest?.version;
  if (!SEMVER_PATTERN.test(version ?? "") || manifest.name !== "dev-flow-deepseek") throw new Error("DeepSeek package version authority is invalid");
  return version;
}

async function readCoreVersion(root) {
  const version = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
  if (!SEMVER_PATTERN.test(version)) throw new Error("CORE_VERSION must be strict MAJOR.MINOR.PATCH");
  return version;
}

async function updateDeepSeekVersion(root, currentVersion, targetVersion) {
  for (const relativePath of ["packages/deepseek/package.json"]) {
    const path = join(root, relativePath);
    const manifest = await readJSON(path);
    if (manifest.version !== currentVersion) throw new Error(`${relativePath} version changed during release preparation`);
    manifest.version = targetVersion;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

async function commitAndPushVersion(root, version) {
  await runText("git", ["add", "--", ...VERSION_AUTHORITY_PATHS], { cwd: root });
  await runText("git", ["diff", "--cached", "--check"], { cwd: root });
  await runText("git", ["commit", "-m", `release(deepseek): v${version}`], { cwd: root });
  await runText("git", ["push", "origin", "main"], { cwd: root, timeout: 120_000 });
}

async function changedPathsSinceTag(root, tag) {
  await runText("git", ["rev-parse", "--verify", `refs/tags/${tag}`], { cwd: root });
  const output = await runText("git", ["diff", "--name-only", `${tag}...HEAD`], { cwd: root });
  return output === "" ? [] : output.split("\n").filter(Boolean);
}

async function previousDeepSeekRelease(root, targetVersion) {
  const output = await runText("git", ["tag", "--list", "deepseek-v*", "--sort=-version:refname"], { cwd: root });
  const tag = output.split("\n").find((candidate) => {
    const version = candidate.replace(/^deepseek-v/u, "");
    return SEMVER_PATTERN.test(version) && compareSemVer(version, targetVersion) < 0;
  });
  if (tag) return tag;
  await runText("git", ["rev-parse", "--verify", "refs/tags/v0.5.0"], { cwd: root });
  if (compareSemVer("0.5.0", targetVersion) >= 0) throw new Error(`cannot find a previous DeepSeek release before ${targetVersion}`);
  return "v0.5.0";
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
  if (typeof outputDirectory !== "string" || !isAbsolute(outputDirectory)) throw new Error("release output must be an absolute path");
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

async function requireMatchingPreparedMode(directory, expected) {
  const manifest = await readJSON(join(directory, "release-manifest.json"));
  const release = manifest.release ?? {};
  if (
    release.product !== "deepseek"
    || release.version !== expected.targetVersion
    || release.tag !== `deepseek-v${expected.targetVersion}`
    || !SEMVER_PATTERN.test(release.core_version ?? "")
    || release.verification_mode !== expected.mode
    || (expected.basedOnRelease !== undefined && release.based_on_release !== expected.basedOnRelease)
  ) throw new Error("prepared release mode/version differs from the requested resume");
  return manifest;
}

async function ensureFrozenSourceCheckout(toolingRoot, outputDirectory, sourceCommit) {
  if (!GIT_SHA_PATTERN.test(sourceCommit)) throw new Error("prepared frozen source commit is invalid");
  const checkout = join(dirname(outputDirectory), `${basename(outputDirectory)}-source-${sourceCommit.slice(0, 7)}`);
  try {
    const info = await lstat(checkout);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("frozen source checkout must be a real directory");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await runText("git", ["clone", "--no-checkout", toolingRoot, checkout], { cwd: dirname(outputDirectory), timeout: 120_000 });
    await runText("git", ["checkout", "-B", "main", sourceCommit], { cwd: checkout });
  }
  return canonicalDirectory(checkout, "frozen source checkout");
}

async function validateFrozenSource(root, expectedRelease) {
  const branch = await runText("git", ["symbolic-ref", "--short", "HEAD"], { cwd: root });
  const status = await runText("git", ["status", "--porcelain"], { cwd: root });
  const commit = await runText("git", ["rev-parse", "HEAD"], { cwd: root });
  const tree = await runText("git", ["rev-parse", "HEAD^{tree}"], { cwd: root });
  if (branch !== "main" || status !== "" || commit !== expectedRelease.source_commit || tree !== expectedRelease.source_tree) {
    throw new Error("frozen source checkout differs from the prepared release identity");
  }
  return { commit, tree };
}

async function requireExactReleaseFiles(directory, expectedNames) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) throw new Error("release output must contain the exact five-file set");
  for (const entry of entries) {
    const info = await lstat(join(directory, entry.name));
    if (!entry.isFile() || entry.isSymbolicLink() || !info.isFile() || info.isSymbolicLink()) {
      throw new Error(`release output ${entry.name} must be a regular file`);
    }
  }
}

function compareSemVer(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function defaultOutputDirectory(version) {
  return join(homedir(), "dev-flow-releases", `deepseek-v${version}`);
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
    maxBuffer: 256 * 1024,
    timeout: options.timeout ?? 60_000,
    windowsHide: true,
    shell: false,
  });
  return stdout.trim();
}

async function spawnProcess(executable, arguments_, options) {
  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(executable, arguments_, { ...options, stdio: "inherit", shell: false });
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
    await runReleaseCommand(parseReleaseArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`release-deepseek: ${boundedMessage(error)}\n`);
    process.exitCode = 1;
  }
}
