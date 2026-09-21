import { execFile as execFileCallback, spawn } from "node:child_process";
import { homedir } from "node:os";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compareReleaseVersions, validateChannelVersion } from "../scripts/release-channel.mjs";
import { syncPublicReleaseVersions } from "../scripts/sync-public-release-versions.mjs";
import { validateReleaseArtifacts } from "./artifacts.mjs";
import { readHostVersion, writeHostVersion } from "./host-versions.mjs";
import { HOST_PRODUCTS, releaseProducts } from "./products.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const gitIdentity = /^[0-9a-f]{40}$/u;
const coreVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function parseHostReleaseArguments(product, arguments_) {
  requireHostProduct(product);
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values = new Map();
  for (let index = 0; index < normalized.length; index += 2) {
    const flag = normalized[index];
    if (!["--channel", "--version", "--output", "--confirm"].includes(flag)) throw new Error(`unknown argument ${flag}`);
    if (values.has(flag)) throw new Error(`${flag} may be supplied only once`);
    const value = normalized[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    values.set(flag, value);
  }
  if (!["--version", "--confirm"].every(flag => values.has(flag))) {
    throw new Error(`usage: release-${product}.mjs [--channel stable|beta] --version VERSION [--output ABSOLUTE_DIRECTORY] --confirm ${product}-vVERSION`);
  }
  return {
    channel: values.get("--channel") ?? "stable",
    targetVersion: values.get("--version"),
    outputDirectory: values.get("--output") ?? null,
    confirmation: values.get("--confirm"),
  };
}

export async function runHostReleaseCommand({
  product, channel = "stable", targetVersion, confirmation,
  outputDirectory = null, repositoryRoot: requestedRoot = repositoryRoot,
  platform = process.platform, architecture = process.arch,
  environment = process.env, runProcess = spawnProcess,
} = {}) {
  requireHostProduct(product);
  validateChannelVersion(channel, targetVersion);
  const tag = `${releaseProducts[product].tagPrefix}${targetVersion}`;
  if (confirmation !== tag) throw new Error(`confirmation must equal ${tag}`);
  if (platform !== "darwin" || architecture !== "arm64") throw new Error("release command requires darwin-arm64");
  const root = await realpath(requestedRoot);
  let source = await validateSource(root, channel);
  const output = await resolveOutputDirectory(root, outputDirectory ?? join(homedir(), "dev-flow-releases", tag));
  const resuming = (await readdir(output)).length !== 0;
  const releaseEnvironment = { ...environment, DEV_FLOW_RELEASE_CHANNEL: channel };
  let prepared;

  if (resuming) {
    const manifest = JSON.parse(await readFile(join(output, "release-manifest.json"), "utf8"));
    prepared = await validateReleaseArtifacts({ product, version: targetVersion, directory: output, sourceCommit: manifest.release?.source_commit });
    const saved = prepared.manifest.release;
    const commit = await git(root, ["rev-parse", "--verify", `${saved.source_commit}^{commit}`]);
    const tree = await git(root, ["rev-parse", "--verify", `${saved.source_commit}^{tree}`]);
    if (commit !== saved.source_commit || tree !== saved.source_tree) throw new Error("prepared source differs from its saved Git identity");
    source = { ...source, commit, tree };
  } else {
    const currentVersion = await readHostVersion(root, product);
    if (targetVersion !== currentVersion && compareReleaseVersions(targetVersion, currentVersion) <= 0) {
      throw new Error(`target version ${targetVersion} must be greater than current version ${currentVersion}`);
    }
    const coreVersion = (await readFile(join(root, "CORE_VERSION"), "utf8")).trim();
    if (!coreVersionPattern.test(coreVersion)) throw new Error("CORE_VERSION must be strict MAJOR.MINOR.PATCH");

    await runProcess(process.execPath, ["--test", ...releaseChecks(product)], { cwd: root, env: releaseEnvironment });
    const afterChecks = await validateSource(root, channel);
    if (afterChecks.commit !== source.commit) throw new Error("release source changed during validation");
    const changedPaths = [];
    if (currentVersion !== targetVersion) changedPaths.push(...await writeHostVersion(root, product, currentVersion, targetVersion));
    if (channel === "stable") {
      const metadata = JSON.parse(await readFile(join(root, "release/public-versions.json"), "utf8"));
      if (metadata.core_version !== coreVersion || metadata[product]?.version !== targetVersion || metadata[product]?.core_version !== coreVersion) {
        const result = await syncPublicReleaseVersions(root, { product, version: targetVersion, coreVersion });
        changedPaths.push(...result.changedPaths);
      }
    }
    if (changedPaths.length > 0) {
      await git(root, ["add", "--", ...changedPaths]);
      await git(root, ["diff", "--cached", "--check"]);
      await git(root, ["commit", "-m", `release(${product}): v${targetVersion}`, "-m",
        `- Align the ${product} release identity for the ${channel} channel.\n- Update the selected version files: ${changedPaths.join(", ")}.`]);
      await git(root, ["push", "origin", `HEAD:refs/heads/${source.branch}`], { timeout: 120_000 });
      source = await validateSource(root, channel, { requireRemoteMatch: true });
    }
    await runProcess(process.execPath, [join(root, "scripts/build-host-release.mjs"), "--product", product, "--output", output],
      { cwd: root, env: releaseEnvironment });
    prepared = await validateReleaseArtifacts({ product, version: targetVersion, directory: output, sourceCommit: source.commit });
    if (prepared.manifest.release.source_tree !== source.tree || prepared.manifest.release.core_version !== coreVersion) {
      throw new Error("prepared source tree or Core version differs from the selected source");
    }
  }

  await runProcess(process.execPath, [join(root, "release/publish.mjs"), "--product", product,
    "--version", targetVersion, "--directory", output, "--source", source.commit], { cwd: root, env: releaseEnvironment });
  return {
    status: "complete", mode: resuming ? "resumed-and-published" : "prepared-and-published",
    verification_mode: "release", release_channel: channel, product, version: targetVersion,
    core_version: prepared.manifest.release.core_version, tag, source_commit: source.commit, source_tree: source.tree,
    output_files: prepared.assets.map(asset => asset.name).sort(),
  };
}

function releaseChecks(product) {
  return ["tests/release_workflow.test.mjs", "tests/host-release-command.test.mjs", "tests/host-release-prepare.test.mjs",
    "tests/version-governance.test.mjs", "release/publish.test.mjs",
    `packages/${product}/tests/${["codex", "deepseek"].includes(product) ? "package-contract" : "package"}.test.mjs`];
}

async function validateSource(root, channel, { requireRemoteMatch = false } = {}) {
  const branch = await git(root, ["symbolic-ref", "--short", "HEAD"]);
  if (channel === "stable" && branch !== "main") throw new Error("stable release command requires branch main");
  if (await git(root, ["status", "--porcelain"]) !== "") throw new Error("release command requires a clean source checkout");
  const [commit, tree] = await Promise.all([git(root, ["rev-parse", "HEAD"]), git(root, ["rev-parse", "HEAD^{tree}"])]);
  if (![commit, tree].every(value => gitIdentity.test(value))) throw new Error("release source identities must be complete lowercase Git SHAs");
  if (channel === "stable" && commit !== await git(root, ["rev-parse", "origin/main"])) {
    throw new Error("stable release command HEAD must equal origin/main");
  }
  if (requireRemoteMatch) {
    const output = await git(root, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
    const [remoteCommit, remoteRef, extra] = output.split(/\s+/u);
    if (extra !== undefined || remoteCommit !== commit || remoteRef !== `refs/heads/${branch}`) {
      throw new Error("release command HEAD must equal the pushed source branch");
    }
  }
  return { branch, commit, tree };
}

async function resolveOutputDirectory(root, directory) {
  if (typeof directory !== "string" || !isAbsolute(directory)) throw new Error("release output must be an absolute path");
  let output;
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("release output must be a non-symbolic-link directory");
    output = await realpath(directory);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const parent = await realpath(dirname(directory));
    output = join(parent, basename(directory));
    requireOutsideRoot(root, output);
    await mkdir(output, { mode: 0o700 });
  }
  requireOutsideRoot(root, output);
  return output;
}

function requireOutsideRoot(root, output) {
  const offset = relative(root, output);
  if (offset === "" || offset !== ".." && !offset.startsWith("../") && !isAbsolute(offset)) {
    throw new Error("release output must remain outside the source repository");
  }
}

function requireHostProduct(product) {
  if (!HOST_PRODUCTS.includes(product)) throw new Error("invalid Host release product");
}

async function git(root, args, options = {}) {
  const result = await execFile("git", args, { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 256 * 1024, ...options });
  return result.stdout.trim();
}

async function spawnProcess(executable, args, options) {
  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(executable, args, { ...options, stdio: "inherit", shell: false });
    child.once("error", rejectProcess);
    child.once("exit", (code, signal) => code === 0 ? resolveProcess()
      : rejectProcess(new Error(`${executable} failed with ${signal ?? `exit ${code}`}`)));
  });
}

export async function runHostReleaseCLI(product) {
  try {
    await runHostReleaseCommand({ product, ...parseHostReleaseArguments(product, process.argv.slice(2)) });
  } catch (error) {
    const message = String(error?.message ?? error).replace(/[\r\n]+/gu, " ")
      .replace(/\/(?:Users|home|private\/var|var\/folders)\/[^\s:]+/gu, "<machine-path>").slice(0, 500);
    process.stderr.write(`release-${product}: ${message}\n`);
    process.exitCode = 1;
  }
}
