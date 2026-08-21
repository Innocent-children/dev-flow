#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*)){2}(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export async function checkVersions(root = repositoryRoot()) {
  const coreVersion = await readVersionFile(join(root, "CORE_VERSION"), "Core version");
  const [rootPackage, codexPackage, codexPlugin, deepseekPackage, serverInfo, codexFixture] = await Promise.all([
    readJSON(join(root, "package.json")),
    readJSON(join(root, "packages/codex/package.json")),
    readJSON(join(root, "packages/codex/plugin/.codex-plugin/plugin.json")),
    readJSON(join(root, "packages/deepseek/package.json")),
    readJSON(join(root, "protocol/fixtures/graph-server-info.json")),
    readJSON(join(root, "packages/codex/tests/fixtures/graph-method-profiles.json")),
  ]);

  if (rootPackage.name !== "dev-flow" || rootPackage.private !== true || Object.hasOwn(rootPackage, "version")) {
    throw new Error("root package must be private and must not declare a version");
  }
  const codexVersion = packageVersion(codexPackage, "dev-flow-codex", "Codex package");
  const pluginVersion = packageVersion(codexPlugin, "dev-flow-codex", "Codex plugin");
  const deepseekVersion = packageVersion(deepseekPackage, "dev-flow-deepseek", "DeepSeek package");
  if (pluginVersion !== codexVersion) throw new Error("Codex plugin version must equal Codex package version");
  for (const [label, value] of [
    ["Core server-info fixture", serverInfo.version],
    ["Codex simulated Core fixture", codexFixture.server_info?.version],
  ]) {
    if (value !== coreVersion) throw new Error(`${label} must equal CORE_VERSION`);
  }
  return Object.freeze({ core: coreVersion, codex: codexVersion, deepseek: deepseekVersion });
}

async function readVersionFile(path, label) {
  const raw = await readFile(path, "utf8");
  const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  if (value.includes("\n") || !SEMVER.test(value)) throw new Error(`${label} must be valid SemVer`);
  return value;
}

function packageVersion(manifest, expectedName, label) {
  if (manifest?.name !== expectedName || !SEMVER.test(manifest.version ?? "")) {
    throw new Error(`${label} identity/version is invalid`);
  }
  return manifest.version;
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function repositoryRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const versions = await checkVersions();
    process.stdout.write(`Core ${versions.core}\nCodex ${versions.codex}\nDeepSeek ${versions.deepseek}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
