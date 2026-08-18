import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { CODEX_COMPATIBILITY_RANGE } from "../lib/lifecycle.mjs";
import { releaseOutputNames } from "../../../scripts/verify-codex-release.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const execFile = promisify(execFileCallback);
const currentVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();

const expectedPackageFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
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
  "tests/fake-core-contract.test.mjs",
  "tests/fixtures/fake-codex.mjs",
  "tests/fixtures/fake-core.mjs",
  "tests/fixtures/fake-native-tool.mjs",
  "tests/fixtures/fake-release-gh.mjs",
  "tests/fixtures/fake-release-npm.mjs",
  "tests/journey-evidence.test.mjs",
  "tests/journey-harness.test.mjs",
  "tests/launcher.test.mjs",
  "tests/lifecycle.test.mjs",
  "tests/package-contract.test.mjs",
  "tests/paths.test.mjs",
  "tests/removal-retention.test.mjs",
  "tests/release-package.test.mjs",
  "tests/release-publication.test.mjs",
  "tests/skill-contract.test.mjs",
]);

test("source package declares one public macOS arm64 Codex product", async () => {
  const [version, manifest, plugin, marketplace, mcp] = await Promise.all([
    readFile(join(repositoryRoot, "VERSION"), "utf8").then((value) => value.trim()),
    readJSON(join(packageRoot, "package.json")),
    readJSON(join(pluginRoot, ".codex-plugin", "plugin.json")),
    readJSON(join(packageRoot, ".agents", "plugins", "marketplace.json")),
    readJSON(join(pluginRoot, ".mcp.json")),
  ]);

  assert.equal(manifest.name, "dev-flow-codex");
  assert.equal(manifest.version, version);
  assert.equal(manifest.private, false);
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.os, ["darwin"]);
  assert.deepEqual(manifest.cpu, ["arm64"]);
  assert.deepEqual(manifest.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(manifest.repository, {
    type: "git",
    url: "git+https://github.com/Innocent-children/dev-flow.git",
    directory: "packages/codex",
  });
  assert.deepEqual(manifest.engines, { node: ">=24" });
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
    "preuninstall",
    "uninstall",
  ]) {
    assert.equal(name in manifest.scripts, false, name);
  }

  const sourceFiles = await walkFiles(packageRoot, { skipDirectories: new Set(["node_modules"]) });
  assert.deepEqual(sourceFiles.filter((path) => !reviewedSourceAllowlist.has(path)), []);
  assert.equal(sourceFiles.some((path) => path.startsWith("runtime/")), false);
  assert.equal(sourceFiles.some((path) => /\.(?:tgz|db|sqlite)$/iu.test(path)), false);
});

test("npm compatibility metadata rejects an unsupported OS and CPU", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const { stdout } = await execFile("npm", ["root", "--global"], { encoding: "utf8" });
  const npmRequire = createRequire(join(stdout.trim(), "npm", "package.json"));
  const { checkPlatform } = npmRequire("npm-install-checks");

  assert.doesNotThrow(() => checkPlatform(manifest, false, { os: "darwin", cpu: "arm64" }));
  assert.throws(
    () => checkPlatform(manifest, false, { os: "linux", cpu: "x64", libc: "glibc" }),
    (error) => {
      assert.equal(error.code, "EBADPLATFORM");
      assert.deepEqual(error.required.os, ["darwin"]);
      assert.deepEqual(error.required.cpu, ["arm64"]);
      return true;
    },
  );
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

test("packaged Skill publishes the exact new-task value types and vocabulary", async () => {
  const skill = await readFile(join(pluginRoot, "skills", "dev-flow", "SKILL.md"), "utf8");

  assert.match(
    skill,
    /`scope`, `out_of_scope`, and `acceptance_criteria` are JSON arrays of strings/u,
  );
  assert.match(skill, /exactly `minimal`,\s+`targeted`, or `full`/u);

  const example = skill.match(/<!-- new-task-example:start -->\n```json\n([\s\S]*?)\n```\n<!-- new-task-example:end -->/u);
  assert.notEqual(example, null);
  assert.deepEqual(JSON.parse(example[1]), {
    goal: "Return the requested field from the bounded endpoint.",
    scope: ["Update the endpoint response"],
    out_of_scope: ["Change unrelated endpoints"],
    acceptance_criteria: ["The response contains the requested field"],
    verification_budget: {
      level: "targeted",
      max_automatic_commands: 4,
      allow_full_suite: false,
      allow_manual_handoff: true,
    },
  });
});

test("release output names derive from the current product version", () => {
  assert.deepEqual(releaseOutputNames(currentVersion), [
    "SHA256SUMS",
    `dev-flow-${currentVersion}-darwin-arm64`,
    `dev-flow-codex-${currentVersion}.tgz`,
    "publication-record.json",
    "release-manifest.json",
  ].sort());
  assert.throws(() => releaseOutputNames("0.3"), /strict MAJOR\.MINOR\.PATCH/u);
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

  const { stdout: manifestContents } = await execFile(
    "tar",
    ["-xOzf", report.artifact_path, "package/package.json"],
    { encoding: "utf8" },
  );
  const packedManifest = JSON.parse(manifestContents);
  assert.equal(packedManifest.private, false);
  assert.deepEqual(packedManifest.os, ["darwin"]);
  assert.deepEqual(packedManifest.cpu, ["arm64"]);

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
    assert.equal(versionLine, `dev-flow ${currentVersion}\n`);
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
