import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { CODEX_COMPATIBILITY_RANGE } from "../lib/lifecycle.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const execFile = promisify(execFileCallback);

const expectedPackageFiles = [
  ".agents/plugins/marketplace.json",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "runtime/darwin-arm64/dev-flow",
];

const expectedPackedFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "runtime/darwin-arm64/dev-flow",
].sort();

const reviewedSourceAllowlist = new Set([
  ".agents/plugins/marketplace.json",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "tests/fake-core-contract.test.mjs",
  "tests/fixtures/fake-codex.mjs",
  "tests/fixtures/fake-core.mjs",
  "tests/fixtures/fake-native-tool.mjs",
  "tests/journey-evidence.test.mjs",
  "tests/journey-harness.test.mjs",
  "tests/launcher.test.mjs",
  "tests/lifecycle.test.mjs",
  "tests/package-contract.test.mjs",
  "tests/paths.test.mjs",
  "tests/removal-retention.test.mjs",
  "tests/skill-contract.test.mjs",
]);

test("source package declares one private explicit Codex plugin and bundled STDIO Core", async () => {
  const [version, manifest, plugin, marketplace, mcp] = await Promise.all([
    readFile(join(repositoryRoot, "VERSION"), "utf8").then((value) => value.trim()),
    readJSON(join(packageRoot, "package.json")),
    readJSON(join(pluginRoot, ".codex-plugin", "plugin.json")),
    readJSON(join(packageRoot, ".agents", "plugins", "marketplace.json")),
    readJSON(join(pluginRoot, ".mcp.json")),
  ]);

  assert.equal(manifest.name, "dev-flow-codex");
  assert.equal(manifest.version, version);
  assert.equal(manifest.private, true);
  assert.equal(CODEX_COMPATIBILITY_RANGE, ">=0.147.0 <0.148.0");
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(field in manifest, false, field);
  }

  assert.equal(plugin.name, "dev-flow-codex");
  assert.equal(plugin.version, version);
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal("hooks" in plugin, false);
  assert.equal("apps" in plugin, false);
  assert.deepEqual(marketplace.plugins.map((entry) => entry.name), ["dev-flow-codex"]);
  assert.deepEqual(mcp.mcpServers, {
    "dev-flow": {
      type: "stdio",
      command: "dev-flow-codex",
      args: ["mcp"],
    },
  });
  assert.equal(
    await readFile(join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"), "utf8"),
    "policy:\n  allow_implicit_invocation: false\n",
  );
});

test("package metadata closes source, artifact, and development command surfaces", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  assert.deepEqual([...manifest.files].sort(), [...expectedPackageFiles].sort());
  assert.deepEqual(manifest.bin, { "dev-flow-codex": "bin/dev-flow-codex.mjs" });
  assert.deepEqual(manifest.scripts, {
    test: "node --test tests/*.test.mjs",
    "test:package": "node --test tests/package-contract.test.mjs",
    "test:lifecycle": "node --test tests/lifecycle.test.mjs",
    "test:parser": "node --test tests/journey-evidence.test.mjs",
    "test:native-smoke": "node --test tests/journey-harness.test.mjs",
    "pack:dry": "pnpm pack --dry-run --json",
    "build:local": "../../scripts/build-codex-local.sh",
    "smoke:fixture": "../../scripts/run-codex-real-journey.sh --fixture success",
  });

  for (const name of [
    "preinstall",
    "install",
    "postinstall",
    "prepare",
    "prepack",
    "postpack",
    "prepublish",
    "prepublishOnly",
    "publish",
    "postpublish",
  ]) {
    assert.equal(name in manifest.scripts, false, name);
  }
  assert.equal("publishConfig" in manifest, false);

  const sourceFiles = await walkFiles(packageRoot, { skipDirectories: new Set(["node_modules"]) });
  assert.deepEqual(sourceFiles.filter((path) => !reviewedSourceAllowlist.has(path)), []);
  assert.equal(sourceFiles.some((path) => path.startsWith("runtime/")), false);
  assert.equal(sourceFiles.some((path) => /\.(?:tgz|db|sqlite)$/iu.test(path)), false);
});

test("packaged resources contain no copied fixtures or workflow engine", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const sharedFixtureRoot = join(repositoryRoot, "protocol", "fixtures");
  const fixtureFiles = (await walkFiles(sharedFixtureRoot)).filter((path) => path.endsWith(".json"));
  const fixtureDigests = new Set(
    await Promise.all(fixtureFiles.map((path) => sha256(readFile(join(sharedFixtureRoot, path))))),
  );

  for (const declaredPath of manifest.files) {
    assert.equal(/(?:^|\/)(?:tests?|fixtures?)(?:\/|$)/iu.test(declaredPath), false, declaredPath);
    assert.equal(/(?:^|\/)(?:cmd\/dev-flow|internal|protocol)(?:\/|$)/u.test(declaredPath), false, declaredPath);
  }

  for (const path of (await walkFiles(packageRoot, {
    skipDirectories: new Set(["node_modules", "tests", "runtime"]),
  }))) {
    const contents = await readFile(join(packageRoot, path));
    assert.equal(fixtureDigests.has(await sha256(contents)), false, path);
    if (/^(?:bin|lib)\/.*\.mjs$/u.test(path)) {
      const source = contents.toString("utf8");
      assert.doesNotMatch(source, /transitionTable|taskStates?|nextState|persistTask|sqlite/iu, path);
      assert.doesNotMatch(source, /tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures/iu, path);
    }
  }
});

test("local package builder stages one exact non-final artifact in a temporary directory", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-contract-"));
  const { stdout } = await execFile(
    join(repositoryRoot, "scripts", "build-codex-local.sh"),
    ["--output", outputDirectory],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.final_artifact, false);
  assert.equal((await stat(report.artifact_path)).isFile(), true);
  assert.equal(await sha256(readFile(report.artifact_path)), report.artifact_sha256);

  const { stdout: listing } = await execFile("tar", ["-tzf", report.artifact_path], {
    encoding: "utf8",
  });
  const packedFiles = listing
    .trim()
    .split("\n")
    .filter((path) => path && !path.endsWith("/"))
    .map((path) => path.replace(/^package\//u, ""))
    .sort();
  assert.deepEqual(packedFiles, expectedPackedFiles);

  if (process.platform === "darwin" && process.arch === "arm64") {
    const extractDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-extract-"));
    await execFile("tar", ["-xzf", report.artifact_path, "-C", extractDirectory]);
    const runtime = join(extractDirectory, "package", "runtime", "darwin-arm64", "dev-flow");
    assert.notEqual((await stat(runtime)).mode & 0o111, 0);
    const { stdout: versionLine } = await execFile(runtime, ["version"], {
      cwd: extractDirectory,
      encoding: "utf8",
    });
    assert.equal(versionLine, "dev-flow 0.1.0\n");
  }
});

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(value) {
  const contents = await value;
  return createHash("sha256").update(contents).digest("hex");
}

async function walkFiles(root, { skipDirectories = new Set() } = {}) {
  const files = [];
  await visit(root);
  return files.sort();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const absolute = join(directory, entry.name);
      const relativePath = relative(root, absolute).split("\\").join("/");
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) await visit(absolute);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
}
