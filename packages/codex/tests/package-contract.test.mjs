import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { CODEX_COMPATIBILITY_RANGE } from "../lib/lifecycle.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));

const pluginRoot = join(packageRoot, "plugin");
const pluginManifestPath = join(pluginRoot, ".codex-plugin", "plugin.json");
const marketplacePath = join(packageRoot, ".agents", "plugins", "marketplace.json");
const mcpPath = join(pluginRoot, ".mcp.json");
const execFile = promisify(execFileCallback);

const expectedPackageFiles = [
  ".agents/plugins/marketplace.json",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "runtime/darwin-arm64/dev-flow",
];

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
  "tests/fake-core-contract.test.mjs",
  "tests/fixtures/fake-codex.mjs",
  "tests/fixtures/fake-core.mjs",
  "tests/journey-evidence.test.mjs",
  "tests/journey-harness.test.mjs",
  "tests/launcher.test.mjs",
  "tests/lifecycle.test.mjs",
  "tests/package-contract.test.mjs",
  "tests/paths.test.mjs",
  "tests/removal-retention.test.mjs",
  "tests/skill-contract.test.mjs",
]);

const exactTools = [
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
];

test("source package declares one private Codex plugin, Skill, and bundled STDIO server", async () => {
  const [repositoryVersion, packageManifest, pluginManifest, marketplace, mcp] = await Promise.all([
    readFile(join(repositoryRoot, "VERSION"), "utf8").then((value) => value.trim()),
    readJSON(join(packageRoot, "package.json")),
    readJSON(pluginManifestPath),
    readJSON(marketplacePath),
    readJSON(mcpPath),
  ]);

  assert.equal(packageManifest.name, "dev-flow-codex");
  assert.equal(packageManifest.private, true);
  assert.equal(packageManifest.version, repositoryVersion);
  assert.equal(CODEX_COMPATIBILITY_RANGE, ">=0.147.0 <0.148.0");
  for (const dependencyField of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(dependencyField in packageManifest, false, `${dependencyField} is production dependency surface`);
  }

  assert.equal(pluginManifest.name, "dev-flow-codex");
  assert.equal(pluginManifest.version, packageManifest.version);
  assert.equal(pluginManifest.skills, "./skills/");
  assert.equal(pluginManifest.mcpServers, "./.mcp.json");
  assert.equal(pluginManifest.license, "Apache-2.0");
  assert.equal(pluginManifest.author?.name, "Dev Flow");
  assert.equal(pluginManifest.interface?.displayName, "Dev Flow for Codex");
  assert.equal("hooks" in pluginManifest, false);
  assert.equal("apps" in pluginManifest, false);

  assert.deepEqual(marketplace, {
    name: "dev-flow-local",
    interface: { displayName: "Dev Flow Local" },
    plugins: [
      {
        name: "dev-flow-codex",
        source: { source: "local", path: "./plugin" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity",
      },
    ],
  });

  assert.deepEqual(mcp, {
    mcpServers: {
      "dev-flow": {
        command: "dev-flow-codex",
        args: ["mcp"],
      },
    },
  });
  assert.equal(Object.keys(mcp.mcpServers).length, 1);

  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("/SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);
});

test("package metadata closes the source and staged artifact allowlists", async () => {
  const packageManifest = await readJSON(join(packageRoot, "package.json"));
  assert.deepEqual([...packageManifest.files].sort(), [...expectedPackageFiles].sort());
  assert.deepEqual(packageManifest.bin, { "dev-flow-codex": "bin/dev-flow-codex.mjs" });

  const stagedTarballFiles = ["LICENSE", "README.md", "package.json", ...packageManifest.files].sort();
  assert.deepEqual(stagedTarballFiles, [
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
    "runtime/darwin-arm64/dev-flow",
  ]);
  assert.equal(stagedTarballFiles.filter((path) => path.startsWith("runtime/")).length, 1);

  const forbiddenLifecycleScripts = [
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
  ];
  for (const name of forbiddenLifecycleScripts) {
    assert.equal(name in (packageManifest.scripts ?? {}), false, `forbidden package lifecycle script ${name}`);
  }
  assert.equal("publishConfig" in packageManifest, false);

  const sourceFiles = await walkFiles(packageRoot, { skipDirectories: new Set(["node_modules"]) });
  assert.deepEqual(sourceFiles.filter((path) => !reviewedSourceAllowlist.has(path)), []);
  for (const required of [
    ".agents/plugins/marketplace.json",
    "plugin/.codex-plugin/plugin.json",
    "plugin/.mcp.json",
    "plugin/skills/dev-flow/SKILL.md",
    "tests/package-contract.test.mjs",
    "tests/skill-contract.test.mjs",
  ]) {
    assert.equal(sourceFiles.includes(required), true, `missing reviewed source ${required}`);
  }
  assert.equal(sourceFiles.some((path) => path.startsWith("runtime/")), false, "runtime is staging-only");
  assert.equal(sourceFiles.some((path) => /\.(?:tgz|db|sqlite)$/i.test(path)), false);
  assert.equal(sourceFiles.some((path) => /(?:^|\/)codex\.json$/i.test(path)), false, "receipt is user-state only");
});

test("packaged production resources contain no copied Core fixtures, test fakes, or workflow engine", async () => {
  const packageManifest = await readJSON(join(packageRoot, "package.json"));
  const sharedFixtureRoot = join(repositoryRoot, "protocol", "fixtures");
  const fixtureFiles = (await walkFiles(sharedFixtureRoot)).filter((path) => path.endsWith(".json"));
  const fixtureNames = new Set(fixtureFiles.map((path) => path.split("/").at(-1)));
  const fixtureDigests = new Set(
    await Promise.all(fixtureFiles.map((path) => sha256(readFile(join(sharedFixtureRoot, path))))),
  );

  for (const declaredPath of packageManifest.files) {
    assert.equal(/(?:^|\/)(?:tests?|fixtures?)(?:\/|$)/i.test(declaredPath), false, declaredPath);
    assert.equal(/(?:^|\/)(?:cmd\/dev-flow|internal|protocol)(?:\/|$)/.test(declaredPath), false, declaredPath);
    assert.equal(fixtureNames.has(declaredPath.split("/").at(-1)), false, declaredPath);
  }

  const productionFiles = (await walkFiles(packageRoot, { skipDirectories: new Set(["node_modules", "tests"]) }))
    .filter((path) => !path.startsWith("runtime/"));
  for (const path of productionFiles) {
    const absolutePath = join(packageRoot, path);
    const contents = await readFile(absolutePath);
    assert.equal(fixtureNames.has(path.split("/").at(-1)), false, `copied fixture name at ${path}`);
    assert.equal(fixtureDigests.has(await sha256(contents)), false, `copied fixture content at ${path}`);

    if (/^(?:bin|lib)\/.*\.mjs$/.test(path)) {
      const source = contents.toString("utf8");
      for (const forbidden of [
        /tests\/fixtures/i,
        /fake-(?:codex|core)/i,
        /protocol\/fixtures/i,
        /\btransitionTable\b/,
        /\b(?:task|workflow)States?\b/,
        /\bnextState\b/,
        /\bpersistTask\b/,
        /\bsqlite\b/i,
      ]) {
        assert.doesNotMatch(source, forbidden, `${path} contains adapter workflow authority or test import`);
      }
    }
  }

  const serverInfoFixture = await readJSON(join(sharedFixtureRoot, "server-info.json"));
  assert.deepEqual(serverInfoFixture.result.tools, exactTools);
});

test("local builder stages the real detached Core in one exact private tarball", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-contract-"));
  const { stdout } = await execFile(join(repositoryRoot, "scripts", "build-codex-local.sh"), [
    "--output",
    outputDirectory,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  const report = JSON.parse(stdout);
  assert.equal(report.final_artifact, false);
  assert.equal(report.package_version, (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim());
  assert.match(report.source_commit, /^[0-9a-f]{40}$/);
  assert.match(report.artifact_sha256, /^[0-9a-f]{64}$/);
  assert.equal(report.artifact_path, join(outputDirectory, "dev-flow-codex-0.1.0.tgz"));
  assert.equal((await stat(report.artifact_path)).isFile(), true);
  assert.equal(await sha256(readFile(report.artifact_path)), report.artifact_sha256);

  const repeatedOutput = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-repeat-"));
  const { stdout: repeatedStdout } = await execFile(
    join(repositoryRoot, "scripts", "build-codex-local.sh"),
    ["--output", repeatedOutput],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const repeatedReport = JSON.parse(repeatedStdout);
  assert.equal(repeatedReport.artifact_sha256, report.artifact_sha256);

  const { stdout: listing } = await execFile("tar", ["-tzf", report.artifact_path], {
    encoding: "utf8",
  });
  const packedFiles = listing
    .trim()
    .split("\n")
    .filter((path) => path && !path.endsWith("/"))
    .map((path) => path.replace(/^package\//, ""))
    .sort();
  assert.deepEqual(packedFiles, [
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
    "runtime/darwin-arm64/dev-flow",
  ]);

  if (process.platform === "darwin" && process.arch === "arm64") {
    const extractDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-extract-"));
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

async function walkFiles(root, { skipDirectories = new Set() } = {}) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (skipDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(relative(root, path).split("\\").join("/"));
    }
  }
  await visit(root);
  return files.sort();
}

async function sha256(contentsPromise) {
  const contents = await contentsPromise;
  return createHash("sha256").update(contents).digest("hex");
}
