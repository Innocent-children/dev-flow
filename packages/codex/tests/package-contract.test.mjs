import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
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

const evidenceValidationCommand =
  'node ../../scripts/validate-codex-journey-evidence.mjs ../../tests/journeys/evidence/codex-macos-arm64.json --validation-report "$CODEX_VALIDATION_REPORT" --artifact-report "$CODEX_ARTIFACT_REPORT" --attempt-ledger "$CODEX_ATTEMPT_LEDGER"';

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
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      "dev-flow": {
        type: "stdio",
        command: "dev-flow-codex",
        args: ["mcp"],
      },
    },
  });
  assert.equal(Object.keys(mcp.mcpServers).length, 1);

  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("/SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);
  assert.equal(
    await readFile(join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"), "utf8"),
    "policy:\n  allow_implicit_invocation: false\n",
  );
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
    "plugin/skills/dev-flow/agents/openai.yaml",
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
    "plugin/skills/dev-flow/agents/openai.yaml",
    "tests/package-contract.test.mjs",
    "tests/skill-contract.test.mjs",
  ]) {
    assert.equal(sourceFiles.includes(required), true, `missing reviewed source ${required}`);
  }
  assert.equal(sourceFiles.some((path) => path.startsWith("runtime/")), false, "runtime is staging-only");
  assert.equal(sourceFiles.some((path) => /\.(?:tgz|db|sqlite)$/i.test(path)), false);
  assert.equal(sourceFiles.some((path) => /(?:^|\/)codex\.json$/i.test(path)), false, "receipt is user-state only");
});

test("package commands require every retained native evidence input", async () => {
  const packageManifest = await readJSON(join(packageRoot, "package.json"));
  assert.equal(packageManifest.scripts?.["validate:evidence"], evidenceValidationCommand);
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
    "plugin/skills/dev-flow/agents/openai.yaml",
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

test("final builder exclusively writes one closed artifact report bound to the tarball", async () => {
  const fixture = await createCleanBuilderFixture();
  const outputDirectory = join(fixture.root, "artifact-output");
  const secondOutputDirectory = join(fixture.root, "second-artifact-output");
  const reportDirectory = join(fixture.root, "retained-chain");
  const reportPath = join(reportDirectory, "artifact-report.json");
  await Promise.all([
    mkdir(outputDirectory),
    mkdir(secondOutputDirectory),
    mkdir(reportDirectory),
  ]);

  const invocation = [
    "--output",
    outputDirectory,
    "--final",
    "--source-commit",
    fixture.sourceCommit,
    "--report",
    reportPath,
  ];
  const { stdout } = await execFile(fixture.builderPath, invocation, {
    cwd: fixture.repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, PATH: `${fixture.stubDirectory}:${process.env.PATH}` },
    maxBuffer: 4 * 1024 * 1024,
  });

  const reportBytes = await readFile(reportPath, "utf8");
  assert.equal(stdout, reportBytes, "stdout and the retained report must be the same closed bytes");
  const report = JSON.parse(reportBytes);
  assert.deepEqual(Object.keys(report).sort(), [
    "artifact_path",
    "artifact_sha256",
    "built_at",
    "codex_compatibility",
    "core_version",
    "final_artifact",
    "package_allowlist_verified",
    "package_version",
    "platform",
    "report_type",
    "runtime_executable_verified",
    "schema_version",
    "source_commit",
    "source_dirty",
  ]);
  assert.equal(report.schema_version, 1);
  assert.equal(report.report_type, "dev-flow-codex-final-artifact");
  assert.equal(report.artifact_path, join(outputDirectory, "dev-flow-codex-0.1.0.tgz"));
  assert.equal(report.package_version, "0.1.0");
  assert.equal(report.core_version, "0.1.0");
  assert.equal(report.codex_compatibility, ">=0.147.0 <0.148.0");
  assert.equal(report.source_commit, fixture.sourceCommit);
  assert.equal(report.source_dirty, false);
  assert.equal(report.final_artifact, true);
  assert.equal(report.platform, "darwin-arm64");
  assert.equal(report.package_allowlist_verified, true);
  assert.equal(report.runtime_executable_verified, true);
  assert.match(report.artifact_sha256, /^[0-9a-f]{64}$/);
  assert.equal(await sha256(readFile(report.artifact_path)), report.artifact_sha256);
  assert.equal(Number.isNaN(Date.parse(report.built_at)), false);

  await assert.rejects(
    execFile(fixture.builderPath, [
      "--output",
      secondOutputDirectory,
      "--final",
      "--source-commit",
      fixture.sourceCommit,
      "--report",
      reportPath,
    ], {
      cwd: fixture.repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fixture.stubDirectory}:${process.env.PATH}` },
      maxBuffer: 4 * 1024 * 1024,
    }),
    /artifact report already exists/,
  );
  assert.equal(await readFile(reportPath, "utf8"), reportBytes, "a later build cannot replace report bytes");
  assert.deepEqual(await readdir(secondOutputDirectory), [], "report collision fails before artifact creation");
});

async function createCleanBuilderFixture() {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-codex-final-builder-"));
  const fixtureRepositoryRoot = join(root, "repository");
  const packageFixtureRoot = join(fixtureRepositoryRoot, "packages", "codex");
  const builderPath = join(fixtureRepositoryRoot, "scripts", "build-codex-local.sh");
  const stubDirectory = join(root, "stub-bin");
  await Promise.all([
    mkdir(join(packageFixtureRoot, ".agents", "plugins"), { recursive: true }),
    mkdir(join(packageFixtureRoot, "bin"), { recursive: true }),
    mkdir(join(packageFixtureRoot, "lib"), { recursive: true }),
    mkdir(join(packageFixtureRoot, "plugin", ".codex-plugin"), { recursive: true }),
    mkdir(join(packageFixtureRoot, "plugin", "skills", "dev-flow", "agents"), { recursive: true }),
    mkdir(join(fixtureRepositoryRoot, "scripts"), { recursive: true }),
    mkdir(stubDirectory),
  ]);

  const packageFiles = [
    ".agents/plugins/marketplace.json",
    "README.md",
    "bin/dev-flow-codex.mjs",
    "lib/lifecycle.mjs",
    "lib/paths.mjs",
    "plugin/.mcp.json",
    "plugin/skills/dev-flow/SKILL.md",
    "plugin/skills/dev-flow/agents/openai.yaml",
  ];
  await Promise.all(packageFiles.map(async (path) => {
    const absolutePath = join(packageFixtureRoot, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    const contents = path === "lib/lifecycle.mjs"
      ? 'export const CODEX_COMPATIBILITY_RANGE = ">=0.147.0 <0.148.0";\n'
      : path.endsWith(".json") ? "{}\n" : `${path}\n`;
    await writeFile(absolutePath, contents);
  }));
  await Promise.all([
    writeFile(join(fixtureRepositoryRoot, "VERSION"), "0.1.0\n"),
    writeFile(join(fixtureRepositoryRoot, "LICENSE"), "fixture license\n"),
    writeFile(join(packageFixtureRoot, "package.json"), `${JSON.stringify({
      name: "dev-flow-codex",
      version: "0.1.0",
      private: true,
      files: expectedPackageFiles,
    }, null, 2)}\n`),
    writeFile(join(packageFixtureRoot, "plugin", ".codex-plugin", "plugin.json"), `${JSON.stringify({
      name: "dev-flow-codex",
      version: "0.1.0",
    })}\n`),
    copyFile(join(repositoryRoot, "scripts", "build-codex-local.sh"), builderPath),
  ]);
  await chmod(builderPath, 0o755);

  const goStubPath = join(stubDirectory, "go");
  await writeFile(goStubPath, `#!/bin/sh
set -eu
if [ "$1" = "version" ]; then
  exit 0
fi
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    output=$2
    shift 2
    continue
  fi
  shift
done
[ -n "$output" ]
printf '%s\\n' '#!/bin/sh' "printf 'dev-flow 0.1.0\\\\n'" >"$output"
chmod 0755 "$output"
`);
  await chmod(goStubPath, 0o755);

  await execFile("git", ["init", "--quiet"], { cwd: fixtureRepositoryRoot });
  await execFile("git", ["config", "user.name", "Dev Flow Test"], { cwd: fixtureRepositoryRoot });
  await execFile("git", ["config", "user.email", "dev-flow-test@example.invalid"], { cwd: fixtureRepositoryRoot });
  await execFile("git", ["add", "."], { cwd: fixtureRepositoryRoot });
  await execFile("git", ["commit", "--quiet", "-m", "fixture"], { cwd: fixtureRepositoryRoot });
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: fixtureRepositoryRoot,
    encoding: "utf8",
  });
  return {
    root,
    repositoryRoot: fixtureRepositoryRoot,
    builderPath,
    stubDirectory,
    sourceCommit: stdout.trim(),
  };
}

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
