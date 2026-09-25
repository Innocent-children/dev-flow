#!/usr/bin/env node

import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { execPortableCommand } from "../packages/taskbelay/lib/command.mjs";
import { readHostVersion } from "../release/host-versions.mjs";
import { prepareRelease } from "../release/prepare.mjs";
import { HOST_PRODUCTS, releaseProducts } from "../release/products.mjs";
import { isStableVersion, RELEASE_CHANNELS, validateChannelVersion } from "./release-channel.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = resolve(dirname(scriptPath), "..");

export async function buildHostRelease({
  product,
  repositoryRoot = defaultRepositoryRoot,
  outputDirectory,
  environment = process.env,
  run = runCommand,
  signal,
} = {}) {
  if (!HOST_PRODUCTS.includes(product)) throw new Error("release product must be codex, deepseek, claude, or zcode");
  const root = await realpath(repositoryRoot);
  const output = await resolveOutput(root, outputDirectory);
  const execute = (executable, args, cwd = root, env = environment) => run(executable, args, {
    cwd, environment: env, signal,
  });
  const git = async (args, cwd = root) => (await execute("git", args, cwd)).stdout.trim();
  const channel = environment.TASKBELAY_RELEASE_CHANNEL ?? "stable";
  if (!RELEASE_CHANNELS.includes(channel)) throw new Error("release channel must equal stable or beta");
  const branch = await git(["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => "");
  if (!branch) throw new Error("release preparation requires a named branch");
  if (channel === "stable" && branch !== "main") throw new Error("stable release preparation requires branch main");
  if (await git(["status", "--porcelain"])) throw new Error("release preparation requires a clean checkout");
  const operatingSystem = (await execute("uname", ["-s"])).stdout.trim();
  const architecture = (await execute("uname", ["-m"])).stdout.trim();
  if (operatingSystem !== "Darwin" || architecture !== "arm64") throw new Error("release preparation requires darwin-arm64");

  const sourceCommit = await git(["rev-parse", "HEAD"]);
  const sourceTree = await git(["rev-parse", "HEAD^{tree}"]);
  if (![sourceCommit, sourceTree].every(value => /^[0-9a-f]{40}$/u.test(value))) {
    throw new Error("source commit/tree must be complete lowercase Git identities");
  }
  const version = await readHostVersion(root, product);
  const coreVersion = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
  validateChannelVersion(channel, version);
  if (!isStableVersion(coreVersion)) throw new Error("Core must be MAJOR.MINOR.PATCH");
  const packageName = releaseProducts[product].packageName;
  assertPublicPackage(JSON.parse(await readFile(join(root, "packages", product, "package.json"), "utf8")), packageName, version);

  const temporaryRoot = await realpath(await mkdtemp(join(tmpdir(), `taskbelay-${product}-release-`)));
  let result;
  try {
    const sources = [];
    const tarballs = [];
    for (const label of ["a", "b"]) {
      const source = join(temporaryRoot, `source-${label}`);
      const buildOutput = join(temporaryRoot, `build-${label}`);
      const buildTemporary = join(temporaryRoot, `temporary-${label}`);
      await execute("git", ["clone", "--no-hardlinks", "--no-checkout", "--quiet", root, source]);
      await git(["checkout", "--detach", "--quiet", sourceCommit], source);
      await assertSource(source);
      await mkdir(buildOutput);
      await mkdir(buildTemporary);
      const buildEnvironment = { ...environment, TMPDIR: buildTemporary, TMP: buildTemporary, TEMP: buildTemporary };
      const builder = join(source, "scripts", product === "codex" ? "build-codex-local.sh" : `build-${product}-local.mjs`);
      const command = product === "codex" ? "sh" : process.execPath;
      const report = JSON.parse((await execute(command, [builder, "--output", buildOutput], source, buildEnvironment)).stdout);
      await assertSource(source);
      const artifact = product === "codex" || product === "deepseek" ? report.artifact_path : report.path;
      const reportedVersion = product === "codex" || product === "deepseek" ? report.package_version : report.version;
      if (reportedVersion !== version || ((product === "codex" || product === "deepseek") && (
        report.source_dirty !== false || report.source_commit !== sourceCommit || report.core_version !== coreVersion
      ))) throw new Error(`${product} build source or version mismatch`);
      const expectedArtifact = join(buildOutput, `${packageName}-${version}.tgz`);
      if (artifact !== expectedArtifact || !(await lstat(artifact)).isFile()) throw new Error(`${product} build artifact path is invalid`);
      const packedManifest = JSON.parse((await execute("tar", ["-xOf", artifact, "package/package.json"], source)).stdout);
      assertPublicPackage(packedManifest, packageName, version);
      sources.push(source);
      tarballs.push(artifact);
    }
    signal?.throwIfAborted();
    result = await prepareRelease({
      product,
      repositoryRoot: sources[0],
      sourceCommit,
      sourceTree,
      firstTarball: tarballs[0],
      secondTarball: tarballs[1],
      outputDirectory: output,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  signal?.throwIfAborted();
  return result;

  async function assertSource(source) {
    if (await git(["rev-parse", "HEAD"], source) !== sourceCommit ||
        await git(["rev-parse", "HEAD^{tree}"], source) !== sourceTree ||
        await git(["status", "--porcelain"], source) !== "" ||
        await readHostVersion(source, product) !== version ||
        (await readFile(join(source, "CORE_VERSION"), "utf8")).trim() !== coreVersion) {
      throw new Error("frozen build source or version mismatch");
    }
  }
}

function assertPublicPackage(manifest, name, version) {
  if (manifest.name !== name || manifest.version !== version ||
      (Object.hasOwn(manifest, "private") && manifest.private !== false) ||
      manifest.license !== "Apache-2.0" ||
      JSON.stringify(manifest.os) !== JSON.stringify(["darwin", "win32"]) ||
      JSON.stringify(manifest.cpu) !== JSON.stringify(["arm64", "x64"]) ||
      manifest.publishConfig?.access !== "public" ||
      manifest.publishConfig?.registry !== "https://registry.npmjs.org/") {
    throw new Error("Host package identity or fixed public contract does not match");
  }
}

async function resolveOutput(root, directory) {
  if (typeof directory !== "string" || !isAbsolute(directory)) throw new Error("output directory must be absolute");
  if (!(await lstat(directory)).isDirectory()) throw new Error("output directory must be a non-symbolic-link directory");
  const output = await realpath(directory);
  const relativeOutput = relative(root, output);
  if (relativeOutput === "" || (!isAbsolute(relativeOutput) && relativeOutput !== ".." && !relativeOutput.startsWith(`..${sep}`))) {
    throw new Error("output directory must be outside the source repository");
  }
  if ((await readdir(output)).length) throw new Error("output directory must be empty");
  return output;
}

export function parseArguments(args) {
  const arguments_ = args[0] === "--" ? args.slice(1) : args;
  const options = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const field = { "--product": "product", "--output": "outputDirectory" }[arguments_[index]];
    if (!field || options[field] !== undefined || !arguments_[index + 1]) throw new Error("usage: build-host-release.mjs --product codex|deepseek|claude|zcode --output ABSOLUTE_EMPTY_DIRECTORY");
    options[field] = arguments_[index + 1];
  }
  if (!HOST_PRODUCTS.includes(options.product) || !options.outputDirectory) throw new Error("usage: build-host-release.mjs --product codex|deepseek|claude|zcode --output ABSOLUTE_EMPTY_DIRECTORY");
  return options;
}

async function runCommand(executable, args, { cwd, environment, signal }) {
  return execPortableCommand(executable, args, {
    cwd, env: environment, signal, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    shell: false, windowsHide: true,
  });
}

if (process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => "") === await realpath(scriptPath)) {
  const controller = new AbortController();
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  const abort = () => controller.abort();
  for (const signal of signals) process.once(signal, abort);
  try {
    const report = await buildHostRelease({ ...parseArguments(process.argv.slice(2)), signal: controller.signal });
    controller.signal.throwIfAborted();
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } catch (error) {
    process.stderr.write(`build-host-release: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    for (const signal of signals) process.removeListener(signal, abort);
  }
}
