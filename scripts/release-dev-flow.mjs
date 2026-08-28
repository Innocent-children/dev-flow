#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { publishRelease } from "../release/publish.mjs";

const execFile = promisify(execFileCallback);
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function parseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values = new Map();
  for (let index = 0; index < normalized.length; index += 2) {
    const flag = normalized[index];
    if (!["--version", "--output", "--confirm"].includes(flag) || normalized[index + 1] === undefined || values.has(flag)) {
      throw new Error(`invalid ${flag}`);
    }
    values.set(flag, normalized[index + 1]);
  }
  const version = values.get("--version");
  const output = values.get("--output");
  if (!versionPattern.test(version ?? "") || !isAbsolute(output ?? "") || values.get("--confirm") !== `dev-flow-v${version}`) {
    throw new Error("exact dev-flow release selection required");
  }
  return { version, output: resolve(output) };
}

async function run(command, arguments_) {
  const { stdout } = await execFile(command, arguments_, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 120_000,
    shell: false,
  });
  return stdout.trim();
}

async function ensureCleanSynchronizedMain() {
  if (
    await run("git", ["branch", "--show-current"]) !== "main"
    || await run("git", ["status", "--porcelain"]) !== ""
    || await run("git", ["rev-parse", "HEAD"]) !== await run("git", ["rev-parse", "origin/main"])
  ) throw new Error("clean synchronized main required");
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

async function alignVersion(targetVersion) {
  const manifestPath = join(root, "packages/dev-flow/package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!versionPattern.test(manifest.version ?? "")) throw new Error("Dev Flow CLI package version is invalid");
  if (manifest.version === targetVersion) return;
  if (compareVersions(targetVersion, manifest.version) <= 0) throw new Error("target version must be greater than current version");
  manifest.version = targetVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await run("git", ["add", "packages/dev-flow/package.json"]);
  await run("git", ["commit", "-m", `release(dev-flow): v${targetVersion}`]);
  await run("git", ["push", "origin", "main"]);
  await ensureCleanSynchronizedMain();
}

async function prepare(selection) {
  const sourceCommit = await run("git", ["rev-parse", "HEAD"]);
  await mkdir(selection.output, { recursive: true, mode: 0o700 });
  await run("pnpm", ["--dir", "packages/dev-flow", "pack", "--pack-destination", selection.output]);
  const tarball = join(selection.output, `imotong-dev-flow-${selection.version}.tgz`);
  if (!(await stat(tarball)).isFile()) throw new Error("dev-flow tarball is missing");
  const sha256 = createHash("sha256").update(await readFile(tarball)).digest("hex");
  await writeFile(join(selection.output, "SHA256SUMS"), `${sha256}  ${basename(tarball)}\n`);
  await writeFile(join(selection.output, "release-manifest.json"), `${JSON.stringify({
    release: { product: "dev-flow", version: selection.version, source_commit: sourceCommit },
    artifacts: [{ kind: "npm_tarball", relative_path: basename(tarball), sha256 }],
  }, null, 2)}\n`);
  return sourceCommit;
}

async function main(selection) {
  await ensureCleanSynchronizedMain();
  await run(process.execPath, ["--test", "packages/dev-flow/tests/package-contract.test.mjs"]);
  await alignVersion(selection.version);
  const sourceCommit = await prepare(selection);
  return publishRelease({ product: "dev-flow", version: selection.version, directory: selection.output, sourceCommit });
}

main(parseArguments(process.argv.slice(2))).then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    process.stderr.write(`release-dev-flow: ${error.message}\n`);
    process.exitCode = 1;
  },
);
