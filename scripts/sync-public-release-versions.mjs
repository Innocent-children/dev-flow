#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export async function syncPublicReleaseVersions(root, { product, version, coreVersion }) {
  validateSelection({ product, version, coreVersion });
  const metadataPath = join(root, "release", "public-versions.json");
  const current = JSON.parse(await readFile(metadataPath, "utf8"));
  validateMetadata(current);
  const next = structuredClone(current);
  next.core_version = coreVersion;
  next[product] = { version, core_version: coreVersion };
  const contents = `${JSON.stringify(next, null, 2)}\n`;
  if (contents === `${JSON.stringify(current, null, 2)}\n`) {
    throw new Error("public release version metadata already matches the requested identity");
  }
  await writeFile(metadataPath, contents);
  return Object.freeze({ previous: current, current: next, changedPaths: Object.freeze(["release/public-versions.json"]) });
}

function validateSelection({ product, version, coreVersion }) {
  if (!["codex", "deepseek"].includes(product)) throw new Error("product must equal codex or deepseek");
  if (!SEMVER_PATTERN.test(version ?? "") || !SEMVER_PATTERN.test(coreVersion ?? "")) {
    throw new Error("product and Core versions must be strict MAJOR.MINOR.PATCH");
  }
}

function validateMetadata(value) {
  if (!SEMVER_PATTERN.test(value?.core_version ?? "")) throw new Error("public Core version metadata is invalid");
  for (const product of ["codex", "deepseek"]) {
    if (!SEMVER_PATTERN.test(value?.[product]?.version ?? "") || !SEMVER_PATTERN.test(value?.[product]?.core_version ?? "")) {
      throw new Error(`public ${product} version metadata is invalid`);
    }
  }
}

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    if (!["--product", "--version", "--core-version"].includes(flag) || index + 1 >= arguments_.length) {
      throw new Error("usage: sync-public-release-versions.mjs --product codex|deepseek --version VERSION --core-version CORE_VERSION");
    }
    values.set(flag, arguments_[index + 1]);
  }
  return { product: values.get("--product"), version: values.get("--version"), coreVersion: values.get("--core-version") };
}

function repositoryRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncPublicReleaseVersions(repositoryRoot(), parseArguments(process.argv.slice(2)));
    process.stdout.write(`${result.changedPaths.join("\n")}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
