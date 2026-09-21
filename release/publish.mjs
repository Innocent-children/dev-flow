#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { validateReleaseArtifacts } from "./artifacts.mjs";
import { releaseProducts } from "./products.mjs";

const execFile = promisify(execFileCallback);
const registry = "https://registry.npmjs.org/";
const repository = "Innocent-children/dev-flow";
const npmVisibilityTimeoutMs = 600_000;
const npmVisibilityPollMs = 5_000;

export async function publishRelease({ product, version, directory, sourceCommit, environment = process.env, runProcess = run } = {}) {
  const config = Object.hasOwn(releaseProducts, product) ? releaseProducts[product] : null;
  if (!config) throw new Error(`product must equal ${Object.keys(releaseProducts).join(", ")}`);
  const prepared = await validateReleaseArtifacts({ product, version, directory, sourceCommit });
  const tag = `${config.tagPrefix}${version}`;
  const presentation = releasePresentation(product, version, prepared.manifest);
  const prerelease = version.includes("-beta.");

  await ensureTag(tag, sourceCommit, environment, runProcess);
  await ensureDraft(tag, sourceCommit, presentation, prerelease, environment, runProcess);
  const existing = await npmVersion(config.packageName, version, environment, runProcess);
  if (!existing) await runProcess("npm", ["publish", prepared.tarball.path, "--access", "public", `--registry=${registry}`, ...(prerelease ? ["--tag", "beta"] : [])], environment);
  await verifyRegistryBytes(config.packageName, version, prepared.tarball.sha256, environment, { runProcess });
  await ensureAssets(tag, prepared.assets, environment, runProcess);
  await runProcess("gh", ["release", "edit", tag, "--repo", repository, "--draft=false", `--prerelease=${prerelease}`], environment);
  return { product, version, tag, source_commit: sourceCommit, status: "complete" };
}

export function releasePresentation(product, version, manifest) {
  const config = Object.hasOwn(releaseProducts, product) ? releaseProducts[product] : null;
  const coreVersion = manifest?.release?.core_version;
  const sourceCommit = manifest?.release?.source_commit;
  if (!config || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/u.test(version ?? "")) {
    throw new Error("invalid release presentation identity");
  }
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit ?? "")) {
    throw new Error("release presentation metadata is incomplete");
  }
  if (config.bundlesCore && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(coreVersion ?? "")) {
    throw new Error("release presentation Core metadata is incomplete");
  }
  if (!config.bundlesCore && coreVersion !== undefined) throw new Error("release presentation Core metadata conflicts with product");

  const sourceRoot = `https://github.com/${repository}/blob/${sourceCommit}`;
  const packageIdentity = `${config.packageName}@${version}`;
  const packageURL = `https://www.npmjs.com/package/${encodeURIComponent(config.packageName)}/v/${encodeURIComponent(version)}`;
  const summary = config.bundlesCore
    ? `This release publishes [\`${packageIdentity}\`](${packageURL}) with Dev Flow Core \`${coreVersion}\`.`
    : `This release publishes [\`${packageIdentity}\`](${packageURL}).`;
  const verification = config.bundlesCore
    ? "Use `SHA256SUMS` from this Release to verify the npm package and standalone Core binaries before installation."
    : "Use `SHA256SUMS` from this Release to verify the npm package before installation.";
  return {
    title: `${config.releaseName} v${version}`,
    notes: [
      summary,
      "",
      "## Start here",
      "",
      `- [${config.guideName}](${sourceRoot}/${config.guidePath})`,
      `- [Supported platforms and Hosts](${sourceRoot}/docs/SUPPORT-MATRIX_en.md)`,
      `- Source commit: [\`${sourceCommit}\`](https://github.com/${repository}/tree/${sourceCommit})`,
      "",
      "## Verify downloads",
      "",
      verification,
    ].join("\n"),
  };
}

async function ensureTag(tag, sourceCommit, environment, runProcess) {
  const observed = await allow("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], environment, runProcess);
  if (observed.ok && observed.stdout) {
    if (observed.stdout.split(/\s+/u)[0] !== sourceCommit) throw new Error("existing Tag points to another commit");
    return;
  }
  await runProcess("git", ["tag", tag, sourceCommit], environment);
  await runProcess("git", ["push", "origin", `refs/tags/${tag}:refs/tags/${tag}`], environment);
}

async function ensureDraft(tag, sourceCommit, presentation, prerelease, environment, runProcess) {
  const observed = await allow("gh", ["release", "view", tag, "--repo", repository, "--json", "tagName,targetCommitish,isDraft,isPrerelease"], environment, runProcess);
  if (observed.ok) {
    const release = JSON.parse(observed.stdout);
    if (release.tagName !== tag || release.targetCommitish !== sourceCommit) throw new Error("existing GitHub Release identity mismatch");
    if (release.isPrerelease !== prerelease) throw new Error("existing GitHub Release prerelease status mismatch");
    return;
  }
  await runProcess("gh", ["release", "create", tag, "--repo", repository, "--draft", `--prerelease=${prerelease}`, "--title", presentation.title, "--notes", presentation.notes, "--target", sourceCommit], environment);
}

async function npmVersion(packageName, version, environment, runProcess) {
  const observed = await allow("npm", ["view", `${packageName}@${version}`, "version", "--json", `--registry=${registry}`], environment, runProcess);
  if (!observed.ok) return false;
  return JSON.parse(observed.stdout) === version;
}

export async function verifyRegistryBytes(packageName, version, expectedSHA, environment, options = {}) {
  const timeoutMs = options.timeoutMs ?? npmVisibilityTimeoutMs;
  const pollMs = options.pollMs ?? npmVisibilityPollMs;
  const runProcess = options.runProcess ?? run;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)));
  const attempts = Math.max(1, Math.ceil(timeoutMs / pollMs));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const directory = await mkdtemp(join(tmpdir(), "dev-flow-npm-readback-"));
    try {
      let output;
      try {
        output = await runProcess("npm", ["pack", `${packageName}@${version}`, "--pack-destination", directory, "--ignore-scripts", "--json", `--registry=${registry}`], environment);
      } catch (error) {
        if (!npmTarballPending(error)) throw error;
        if (attempt + 1 === attempts) throw new Error("npm tarball did not become readable within the bounded read-back window");
        await wait(pollMs);
        continue;
      }
      const filename = JSON.parse(output)?.[0]?.filename;
      if (!filename || await sha256(join(directory, filename)) !== expectedSHA) throw new Error("npm tarball read-back differs from local artifact");
      return;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

function npmTarballPending(error) {
  return /(?:\bETARGET\b|\bE404\b|404 Not Found|No matching version found|npm error notarget)/iu.test(
    `${error?.message ?? ""}\n${error?.stdout ?? ""}\n${error?.stderr ?? ""}`,
  );
}

async function ensureAssets(tag, assets, environment, runProcess) {
  const observed = JSON.parse(await runProcess("gh", ["release", "view", tag, "--repo", repository, "--json", "assets,isDraft"], environment));
  const existing = new Set(observed.assets.map((asset) => asset.name));
  for (const asset of assets) {
    if (!existing.has(asset.name)) await runProcess("gh", ["release", "upload", tag, asset.path, "--repo", repository], environment);
  }
  const download = await mkdtemp(join(tmpdir(), "dev-flow-release-readback-"));
  try {
    for (const asset of assets) {
      await runProcess("gh", ["release", "download", tag, "--repo", repository, "--pattern", asset.name, "--dir", download], environment);
      if (await sha256(join(download, asset.name)) !== asset.sha256) throw new Error(`GitHub asset ${asset.name} differs from prepared artifact`);
    }
  } finally {
    await rm(download, { recursive: true, force: true });
  }
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function run(command, arguments_, environment) {
  const { stdout } = await execFile(command, arguments_, { env: environment, encoding: "utf8", maxBuffer: 4e6, timeout: 120_000, shell: false });
  return stdout.trim();
}

async function allow(command, arguments_, environment, runProcess) {
  try {
    return { ok: true, stdout: await runProcess(command, arguments_, environment) };
  } catch (error) {
    return { ok: false, stdout: String(error.stdout ?? "").trim() };
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const values = Object.fromEntries(process.argv.slice(2).reduce((entries, value, index, all) => index % 2 === 0 ? [...entries, [value.replace(/^--/u, ""), all[index + 1]]] : entries, []));
  publishRelease({ product: values.product, version: values.version, directory: values.directory, sourceCommit: values.source }).then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => { process.stderr.write(`publish: ${error.message}\n`); process.exitCode = 1; },
  );
}
