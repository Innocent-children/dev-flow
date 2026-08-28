#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { homedir } from "node:os";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { releaseOutputNames } from "../release/prepare.mjs";
import {
  compareReleaseVersions,
  isReleaseVersion,
  releaseChannel,
  validateChannelVersion,
} from "./release-channel.mjs";
import { syncPublicReleaseVersions } from "./sync-public-release-versions.mjs";

const execFile = promisify(execFileCallback);
const CORE_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const VERSION_AUTHORITY_PATHS = Object.freeze([
  "packages/deepseek/package.json",
  "release/public-versions.json",
]);

export function parseReleaseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values = new Map();
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (!["--channel", "--version", "--output", "--confirm"].includes(argument)) {
      throw new Error(`unknown argument ${argument}`);
    }
    if (values.has(argument)) throw new Error(`${argument} may be supplied only once`);
    if (index + 1 >= normalized.length) throw new Error(`missing value for ${argument}`);
    values.set(argument, normalized[index + 1]);
    index += 1;
  }
  if (!["--version", "--confirm"].every((flag) => values.has(flag))) {
    throw new Error("usage: release-deepseek.mjs [--channel stable|beta] --version DEEPSEEK_VERSION [--output ABSOLUTE_DIRECTORY] --confirm deepseek-vDEEPSEEK_VERSION");
  }
  return {
    channel: values.get("--channel") ?? "stable",
    targetVersion: values.get("--version"),
    outputDirectory: values.get("--output") ?? null,
    confirmation: values.get("--confirm"),
  };
}

export async function runReleaseCommand({
  channel = "stable",
  targetVersion,
  outputDirectory = null,
  confirmation,
  repositoryRoot = repositoryRootFromModule(),
  platform = process.platform,
  architecture = process.arch,
  environment = process.env,
  runProcess = spawnProcess,
} = {}) {
  const root = await canonicalDirectory(repositoryRoot, "repository root");
  validateReleaseSelection({ channel, targetVersion, confirmation });
  const mode = "release";
  if (platform !== "darwin" || architecture !== "arm64") throw new Error("release command requires darwin-arm64");

  let source = await validateSource(root, channel);
  const output = await resolveOutputDirectory(root, outputDirectory ?? defaultOutputDirectory(targetVersion));
  const initialNames = await releaseDirectoryNames(output);
  let coreVersion;
  let basedOnRelease;
  let prepared = null;
  if (initialNames.length === 0) {
    let currentVersion = await validateDeepSeekAuthorities(root);
    coreVersion = await readCoreVersion(root);
    basedOnRelease = await previousDeepSeekRelease(root, targetVersion);
    if (currentVersion !== targetVersion && compareReleaseVersions(targetVersion, currentVersion) <= 0) {
      throw new Error(`target version ${targetVersion} must be greater than current version ${currentVersion}`);
    }
    await runModeValidation(root, mode, {
      ...environment,
      DEV_FLOW_RELEASE_MODE: mode,
      DEV_FLOW_RELEASE_CHANNEL: channel,
      DEV_FLOW_BASED_ON_RELEASE: basedOnRelease ?? "",
      DEV_FLOW_RELEASE_COMPREHENSION_CONFIRMED: "true",
    }, runProcess);
    if (currentVersion !== targetVersion) {
      await updateDeepSeekVersion(root, currentVersion, targetVersion);
      if (channel === "stable") {
        await syncPublicReleaseVersions(root, { product: "deepseek", version: targetVersion, coreVersion });
      }
      currentVersion = await validateDeepSeekAuthorities(root);
      await commitAndPushVersion(root, targetVersion, channel, source.branch);
      source = await validateSource(root, channel, { requireRemoteMatch: channel === "beta" });
    }
  } else {
    prepared = await requireMatchingPreparedMode(output, { mode, targetVersion });
    coreVersion = prepared.release.core_version;
    basedOnRelease = prepared.release.based_on_release;
  }

  const releaseEnvironment = {
    ...environment,
    DEV_FLOW_RELEASE_CHANNEL: channel,
  };
  let executionMode;
  let publicationRoot = root;
  let publicationSource = source;

  if (initialNames.length === 0) {
    const expectedNames = releaseOutputNames("deepseek", targetVersion, coreVersion);
    await runProcess(join(root, "scripts", "build-deepseek-release.sh"), ["--output", output], { cwd: root, env: releaseEnvironment });
    await requireExactReleaseFiles(output, expectedNames);
    executionMode = "prepared-and-published";
  } else {
    const expectedNames = releaseOutputNames("deepseek", targetVersion, coreVersion);
    await requireExactReleaseFiles(output, expectedNames);
    if (prepared.release.source_commit !== source.commit || prepared.release.source_tree !== source.tree) {
      publicationRoot = await ensureFrozenSourceCheckout(root, output, prepared.release.source_commit);
      publicationSource = await validateFrozenSource(publicationRoot, prepared.release);
    }
    executionMode = "resumed-and-published";
  }

  const expectedNames = releaseOutputNames("deepseek", targetVersion, coreVersion);

  const publisherArguments = [
    join(root, "release", "publish.mjs"),
    "--product", "deepseek",
    "--version", targetVersion,
    "--directory", output,
    "--source", publicationSource.commit,
  ];
  await runProcess(process.execPath, publisherArguments, { cwd: root, env: releaseEnvironment });

  return {
    status: "complete",
    mode: executionMode,
    verification_mode: mode,
    release_channel: channel,
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
  await runProcess(process.execPath, ["--test",
      "tests/release_workflow.test.mjs",
      "packages/deepseek/tests/package-contract.test.mjs",
    ], { cwd: root, env: environment });
}

function validateReleaseSelection({ channel, targetVersion, confirmation }) {
  validateChannelVersion(channel, targetVersion);
  if (confirmation !== `deepseek-v${targetVersion}`) throw new Error(`confirmation must equal deepseek-v${targetVersion}`);
}

async function validateDeepSeekAuthorities(root) {
  const manifest = await readJSON(join(root, "packages", "deepseek", "package.json"));
  const version = manifest?.version;
  if (!isReleaseVersion(version) || manifest.name !== "dev-flow-deepseek") throw new Error("DeepSeek package version authority is invalid");
  return version;
}

async function readCoreVersion(root) {
  const version = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
  if (!CORE_VERSION_PATTERN.test(version)) throw new Error("CORE_VERSION must be strict MAJOR.MINOR.PATCH");
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

async function commitAndPushVersion(root, version, channel, branch) {
  const authorityPaths = channel === "stable" ? VERSION_AUTHORITY_PATHS : ["packages/deepseek/package.json"];
  await runText("git", ["add", "--", ...authorityPaths], { cwd: root });
  await runText("git", ["diff", "--cached", "--check"], { cwd: root });
  await runText("git", ["commit", "-m", `release(deepseek): v${version}`], { cwd: root });
  const destination = channel === "stable" ? "main" : `HEAD:refs/heads/${branch}`;
  await runText("git", ["push", "origin", destination], { cwd: root, timeout: 120_000 });
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
    return isReleaseVersion(version) && compareReleaseVersions(version, targetVersion) < 0;
  });
  if (tag) return tag;
  await runText("git", ["rev-parse", "--verify", "refs/tags/v0.5.0"], { cwd: root });
  if (compareReleaseVersions("0.5.0", targetVersion) >= 0) throw new Error(`cannot find a previous DeepSeek release before ${targetVersion}`);
  return "v0.5.0";
}

async function validateSource(root, channel, { requireRemoteMatch = false } = {}) {
  const branch = await runText("git", ["symbolic-ref", "--short", "HEAD"], { cwd: root });
  if (channel === "stable" && branch !== "main") throw new Error("stable release command requires branch main");
  const status = await runText("git", ["status", "--porcelain"], { cwd: root });
  if (status !== "") throw new Error("release command requires a clean source checkout");
  const [commit, tree] = await Promise.all([
    runText("git", ["rev-parse", "HEAD"], { cwd: root }),
    runText("git", ["rev-parse", "HEAD^{tree}"], { cwd: root }),
  ]);
  if (![commit, tree].every((value) => GIT_SHA_PATTERN.test(value))) {
    throw new Error("release source identities must be complete lowercase Git SHAs");
  }
  if (channel === "stable") {
    const remoteCommit = await runText("git", ["rev-parse", "origin/main"], { cwd: root });
    if (!GIT_SHA_PATTERN.test(remoteCommit) || commit !== remoteCommit) throw new Error("stable release command HEAD must equal origin/main");
  } else if (requireRemoteMatch) {
    const output = await runText("git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`], { cwd: root });
    const [remoteCommit, remoteRef, extra] = output.split(/\s+/u);
    if (extra !== undefined || remoteCommit !== commit || remoteRef !== `refs/heads/${branch}`) {
      throw new Error("beta release command HEAD must equal the pushed source branch");
    }
  }
  return { branch, commit, tree };
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
    || !CORE_VERSION_PATTERN.test(release.core_version ?? "")
    || releaseChannel(release.version) !== releaseChannel(expected.targetVersion)
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
