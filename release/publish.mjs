#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const registry = "https://registry.npmjs.org/";
const repository = "Innocent-children/dev-flow";
const npmVisibilityTimeoutMs = 600_000;
const npmVisibilityPollMs = 5_000;
const products = Object.freeze({
  codex: { packageName: "dev-flow-codex", tagPrefix: "codex-v", tarballPrefix: "dev-flow-codex-" },
  deepseek: { packageName: "dev-flow-deepseek", tagPrefix: "deepseek-v", tarballPrefix: "dev-flow-deepseek-" },
  "dev-flow": { packageName: "@imotong/dev-flow", tagPrefix: "dev-flow-v", tarballPrefix: "imotong-dev-flow-" },
});

export async function publishRelease({ product, version, directory, sourceCommit, environment = process.env } = {}) {
  const config = products[product];
  if (!config) throw new Error("product must equal codex or deepseek");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/u.test(version ?? "")) throw new Error("invalid release version");
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit ?? "")) throw new Error("invalid source commit");
  const root = resolve(directory);
  const tag = `${config.tagPrefix}${version}`;
  const tarball = join(root, `${config.tarballPrefix}${version}.tgz`);
  const manifest = JSON.parse(await readFile(join(root, "release-manifest.json"), "utf8"));
  if (manifest.release?.product !== product || manifest.release?.version !== version || manifest.release?.source_commit !== sourceCommit) {
    throw new Error("release manifest identity mismatch");
  }
  const localSHA = await sha256(tarball);

  await ensureTag(tag, sourceCommit, environment);
  await ensureDraft(tag, sourceCommit, environment);
  const existing = await npmVersion(config.packageName, version, environment);
  if (!existing) await run("npm", ["publish", tarball, "--access", "public", `--registry=${registry}`, ...(version.includes("-beta.") ? ["--tag", "beta"] : [])], environment);
  await verifyRegistryBytes(config.packageName, version, localSHA, environment);
  const core = manifest.artifacts.find((item) => item.kind === "core_binary")?.relative_path;
  await ensureAssets(tag, root, [basename(tarball), ...(core ? [basename(core)] : []), "release-manifest.json", "SHA256SUMS"], environment);
  await run("gh", ["release", "edit", tag, "--repo", repository, "--draft=false"], environment);
  return { product, version, tag, source_commit: sourceCommit, status: "complete" };
}

async function ensureTag(tag, sourceCommit, environment) {
  const observed = await allow("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], environment);
  if (observed.ok && observed.stdout) {
    if (observed.stdout.split(/\s+/u)[0] !== sourceCommit) throw new Error("existing Tag points to another commit");
    return;
  }
  await run("git", ["tag", tag, sourceCommit], environment);
  await run("git", ["push", "origin", `refs/tags/${tag}:refs/tags/${tag}`], environment);
}

async function ensureDraft(tag, sourceCommit, environment) {
  const observed = await allow("gh", ["release", "view", tag, "--repo", repository, "--json", "tagName,targetCommitish,isDraft"], environment);
  if (observed.ok) {
    const release = JSON.parse(observed.stdout);
    if (release.tagName !== tag || release.targetCommitish !== sourceCommit) throw new Error("existing GitHub Release identity mismatch");
    return;
  }
  await run("gh", ["release", "create", tag, "--repo", repository, "--draft", "--title", `Dev Flow ${tag}`, "--notes", "Prepared release.", "--target", sourceCommit], environment);
}

async function npmVersion(packageName, version, environment) {
  const observed = await allow("npm", ["view", `${packageName}@${version}`, "version", "--json", `--registry=${registry}`], environment);
  if (!observed.ok) return false;
  return JSON.parse(observed.stdout) === version;
}

async function verifyRegistryBytes(packageName, version, expectedSHA, environment) {
  const attempts = Math.ceil(npmVisibilityTimeoutMs / npmVisibilityPollMs);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await npmVersion(packageName, version, environment)) break;
    if (attempt + 1 === attempts) throw new Error("npm version did not become visible within 600 seconds");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, npmVisibilityPollMs));
  }
  const directory = await mkdtemp(join(tmpdir(), "dev-flow-npm-readback-"));
  try {
    const output = await run("npm", ["pack", `${packageName}@${version}`, "--pack-destination", directory, "--ignore-scripts", "--json", `--registry=${registry}`], environment);
    const filename = JSON.parse(output)?.[0]?.filename;
    if (!filename || await sha256(join(directory, filename)) !== expectedSHA) throw new Error("npm tarball read-back differs from local artifact");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function ensureAssets(tag, directory, names, environment) {
  if (names.some((name) => !name)) throw new Error("release asset inventory is incomplete");
  const observed = JSON.parse(await run("gh", ["release", "view", tag, "--repo", repository, "--json", "assets,isDraft"], environment));
  const existing = new Set(observed.assets.map((asset) => asset.name));
  for (const name of names) {
    if (!existing.has(name)) await run("gh", ["release", "upload", tag, join(directory, name), "--repo", repository], environment);
  }
  const download = await mkdtemp(join(tmpdir(), "dev-flow-release-readback-"));
  try {
    for (const name of names) {
      await run("gh", ["release", "download", tag, "--repo", repository, "--pattern", name, "--dir", download], environment);
      if (await sha256(join(download, name)) !== await sha256(join(directory, name))) throw new Error(`GitHub asset ${name} differs from local artifact`);
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

async function allow(command, arguments_, environment) {
  try {
    return { ok: true, stdout: await run(command, arguments_, environment) };
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
