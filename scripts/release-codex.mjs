#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { homedir } from "node:os";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { releaseOutputNames } from "./verify-codex-release.mjs";

const execFile = promisify(execFileCallback);
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const RELEASE_MODES = Object.freeze(["quick", "normal"]);
const VERSION_AUTHORITY_PATHS = Object.freeze([
  "VERSION",
  "package.json",
  "packages/codex/package.json",
  "packages/codex/plugin/.codex-plugin/plugin.json",
  "packages/deepseek/package.json",
  "protocol/fixtures/graph-server-info.json",
  "packages/codex/tests/fixtures/fake-core.mjs",
  "packages/codex/tests/fixtures/graph-method-profiles.json",
]);
const QUICK_BLOCKED_PATHS = Object.freeze([
  "go.mod",
  "go.sum",
  "scripts/build-codex-local.sh",
]);
const QUICK_BLOCKED_PREFIXES = Object.freeze([
  "cmd/",
  "internal/",
  "protocol/",
  "packages/codex/bin/",
  "packages/codex/lib/",
  "packages/codex/plugin/",
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
    throw new Error("usage: release-codex.mjs --mode quick|normal --version VERSION [--output ABSOLUTE_DIRECTORY] --confirm vVERSION [--confirm-comprehension]");
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
    || path === "packages/codex/package.json"
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

  let currentVersion = await validateVersionAuthorities(root);
  let source = await validateSource(root);
  let basedOnRelease = mode === "quick" ? currentVersion : null;

  if (currentVersion !== targetVersion) {
    if (compareSemVer(targetVersion, currentVersion) <= 0) {
      throw new Error(`target version ${targetVersion} must be greater than current version ${currentVersion}`);
    }
    const changedPaths = await changedPathsSinceTag(root, currentVersion);
    if (mode === "quick") {
      const blocked = quickModeBlockingPaths(changedPaths);
      if (blocked.length !== 0) throw new Error(`quick mode is not eligible; product-affecting paths: ${blocked.join(", ")}`);
    }
    await updateVersionAuthorities(root, currentVersion, targetVersion);
    currentVersion = await validateVersionAuthorities(root);
    await commitAndPushVersion(root, targetVersion);
    source = await validateSource(root);
  } else if (mode === "quick") {
    basedOnRelease = await previousReleaseVersion(root, targetVersion);
  }

  const output = await resolveOutputDirectory(root, outputDirectory ?? defaultOutputDirectory(targetVersion));
  const expectedNames = releaseOutputNames(targetVersion);
  const initialNames = await releaseDirectoryNames(output);
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
    await runModeValidation(root, mode, releaseEnvironment, runProcess);
    await runProcess(join(root, "scripts", "build-codex-release.sh"), ["--output", output], { cwd: root, env: releaseEnvironment });
    await requireExactReleaseFiles(output, expectedNames);
    await runProcess(process.execPath, [join(root, "scripts", "verify-codex-release.mjs"), "--directory", output], { cwd: root, env: releaseEnvironment });
    executionMode = "prepared-and-published";
  } else {
    await requireExactReleaseFiles(output, expectedNames);
    const prepared = await requireMatchingPreparedMode(output, { mode, targetVersion, basedOnRelease });
    if (prepared.release.source_commit !== source.commit || prepared.release.source_tree !== source.tree) {
      publicationRoot = await ensureFrozenSourceCheckout(root, output, prepared.release.source_commit);
      publicationSource = await validateFrozenSource(publicationRoot, prepared.release);
    }
    executionMode = "resumed-and-published";
  }

  const publisherArguments = [
    join(root, "scripts", "publish-codex-release.mjs"),
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
    tag: `v${targetVersion}`,
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
  await runProcess(process.execPath, ["--test", "packages/codex/tests/release-command.test.mjs", "packages/codex/tests/journey-harness.test.mjs"], {
    cwd: root,
    env: environment,
  });
}

function validateReleaseSelection({ mode, targetVersion, confirmation, comprehensionConfirmed }) {
  if (!RELEASE_MODES.includes(mode)) throw new Error("release mode must equal quick or normal");
  if (!SEMVER_PATTERN.test(targetVersion ?? "")) throw new Error("target version must be strict MAJOR.MINOR.PATCH");
  if (confirmation !== `v${targetVersion}`) throw new Error(`confirmation must equal v${targetVersion}`);
  if (mode === "normal" && comprehensionConfirmed !== true) {
    throw new Error("normal mode requires --confirm-comprehension");
  }
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

async function updateVersionAuthorities(root, currentVersion, targetVersion) {
  await writeFile(join(root, "VERSION"), `${targetVersion}\n`);
  for (const relativePath of [
    "package.json",
    "packages/codex/package.json",
    "packages/codex/plugin/.codex-plugin/plugin.json",
    "packages/deepseek/package.json",
  ]) {
    const path = join(root, relativePath);
    const manifest = await readJSON(path);
    if (manifest.version !== currentVersion) throw new Error(`${relativePath} version changed during release preparation`);
    manifest.version = targetVersion;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  for (const relativePath of [
    "protocol/fixtures/graph-server-info.json",
    "packages/codex/tests/fixtures/graph-method-profiles.json",
  ]) {
    const path = join(root, relativePath);
    const fixture = await readJSON(path);
    const authority = relativePath.startsWith("protocol/") ? fixture : fixture.server_info;
    if (authority.version !== currentVersion) throw new Error(`${relativePath} version changed during release preparation`);
    authority.version = targetVersion;
    const indentation = relativePath.startsWith("protocol/") ? 0 : 2;
    await writeFile(path, `${JSON.stringify(fixture, null, indentation)}\n`);
  }
  const fakeCorePath = join(root, "packages", "codex", "tests", "fixtures", "fake-core.mjs");
  const fakeCore = await readFile(fakeCorePath, "utf8");
  const marker = `\"${currentVersion}\"`;
  const occurrences = fakeCore.split(marker).length - 1;
  if (occurrences !== 2) throw new Error("fake Core current-version markers are not exact");
  await writeFile(fakeCorePath, fakeCore.replaceAll(marker, `\"${targetVersion}\"`));
}

async function commitAndPushVersion(root, version) {
  await runText("git", ["add", "--", ...VERSION_AUTHORITY_PATHS], { cwd: root });
  await runText("git", ["diff", "--cached", "--check"], { cwd: root });
  await runText("git", ["commit", "-m", `release: bump Codex to v${version}`], { cwd: root });
  await runText("git", ["push", "origin", "main"], { cwd: root, timeout: 120_000 });
}

async function changedPathsSinceTag(root, version) {
  const tag = `v${version}`;
  await runText("git", ["rev-parse", "--verify", `refs/tags/${tag}`], { cwd: root });
  const output = await runText("git", ["diff", "--name-only", `${tag}...HEAD`], { cwd: root });
  return output === "" ? [] : output.split("\n").filter(Boolean);
}

async function previousReleaseVersion(root, targetVersion) {
  const output = await runText("git", ["tag", "--list", "v*", "--sort=-version:refname"], { cwd: root });
  const version = output.split("\n").map((tag) => tag.replace(/^v/u, ""))
    .find((candidate) => SEMVER_PATTERN.test(candidate) && compareSemVer(candidate, targetVersion) < 0);
  if (!version) throw new Error(`quick mode cannot find a previous release before ${targetVersion}`);
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
    release.version !== expected.targetVersion
    || release.verification_mode !== expected.mode
    || (release.based_on_release ?? null) !== (expected.basedOnRelease ?? null)
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
  return join(homedir(), "dev-flow-releases", `v${version}`);
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
    process.stderr.write(`release-codex: ${boundedMessage(error)}\n`);
    process.exitCode = 1;
  }
}
