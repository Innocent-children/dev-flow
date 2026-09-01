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

import { releaseOutputNames } from "../../../release/prepare.mjs";
import { execPortableCommand, findCommandPath } from "../lib/command.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const execFile = promisify(execFileCallback);
const currentVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();

const expectedPackageFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "bin/dev-flow-codex.mjs",
  "lib/command.mjs",
  "lib/install-experience.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/hooks/hooks.json",
  "plugin/hooks/pre-tool-use.mjs",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
];

const expectedPackedFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/command.mjs",
  "lib/install-experience.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/hooks/hooks.json",
  "plugin/hooks/pre-tool-use.mjs",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
].sort();

test("source package declares one public macOS arm64 and Windows x64 Codex product", async () => {
  const [coreVersion, manifest, plugin, marketplace, mcp] = await Promise.all([
    readFile(join(repositoryRoot, "CORE_VERSION"), "utf8").then((value) => value.trim()),
    readJSON(join(packageRoot, "package.json")),
    readJSON(join(pluginRoot, ".codex-plugin", "plugin.json")),
    readJSON(join(packageRoot, ".agents", "plugins", "marketplace.json")),
    readJSON(join(pluginRoot, ".mcp.json")),
  ]);

  assert.equal(manifest.name, "dev-flow-codex");
  assert.match(coreVersion, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u);
  assert.equal(manifest.private, false);
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.os, ["darwin", "win32"]);
  assert.deepEqual(manifest.cpu, ["arm64", "x64"]);
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
  assert.equal(plugin.version, manifest.version);
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.hooks, "./hooks/hooks.json");
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
    normalizeNewlines(await readFile(join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"), "utf8")),
    "policy:\n  allow_implicit_invocation: true\n",
  );
});

test("package metadata closes source, artifact, and development command surfaces", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  assert.deepEqual([...manifest.files].sort(), [...expectedPackageFiles].sort());
  assert.equal(manifest.files.includes("plugin/skills/dev-flow/references/method-profiles.md"), true);
  assert.equal(manifest.files.includes("plugin/skills/dev-flow/references/node-payloads.md"), true);
  assert.equal(manifest.files.some((path) => /[*?[\]{}]/u.test(path)), false);
  assert.deepEqual(manifest.bin, { "dev-flow-codex": "bin/dev-flow-codex.mjs" });
  assert.deepEqual(manifest.scripts, {
    test: "node --test tests/*.test.mjs",
    "test:package": "node --test tests/package-contract.test.mjs",
    "test:lifecycle": "node --test tests/lifecycle.test.mjs",
    "pack:dry": "pnpm pack --dry-run --json",
    "build:webui": "node ../../scripts/build-webui.mjs",
    "build:local": "../../scripts/build-codex-local.sh",
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

});

test("method-profile reference is one closed dependency-free packaged resource", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const referencePath = "plugin/skills/dev-flow/references/method-profiles.md";
  const reference = await readFile(join(packageRoot, referencePath), "utf8");

  assert.equal(manifest.files.filter((path) => path === referencePath).length, 1);
  assert.equal((await stat(join(packageRoot, referencePath))).isFile(), true);
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(field in manifest, false, field);
  }
  assert.doesNotMatch(reference, /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u);
  assert.doesNotMatch(reference, /(?:node_modules|tests?\/fixtures?|\.tmp|\.sqlite|\.db)(?:\/|\b)/iu);
  assert.doesNotMatch(reference, /(?:process\.env|environment variable|token log|command log)/iu);
});

test("node-payload reference is one explicit closed packaged resource", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const referencePath = "plugin/skills/dev-flow/references/node-payloads.md";
  const reference = await readFile(join(packageRoot, referencePath), "utf8");
  assert.equal(manifest.files.filter((path) => path === referencePath).length, 1);
  assert.equal((await stat(join(packageRoot, referencePath))).isFile(), true);
  assert.match(reference, /`dev_flow_submit_requirements`/u);
  assert.match(reference, /`dev_flow_resolve_blocker`/u);
  assert.match(reference, /Core fills revision[\s\S]*Action kind[\s\S]*payload envelope/u);
  assert.match(reference, /Do not send `request_id`[\s\S]*`method_evidence`[\s\S]*artifact `role`/u);
  assert.match(reference, /Completed developer-run verification is a `source="user"` check with `command_count=0`/u);
  assert.match(reference, /only work nobody has run yet in `manual_handoff_items`/u);
  assert.doesNotMatch(reference, /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u);
  assert.doesNotMatch(reference, /(?:node_modules|tests?\/fixtures?|\.tmp|\.sqlite|\.db)(?:\/|\b)/iu);
});

test("npm compatibility metadata rejects an unsupported OS and CPU", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const npmManifestPath = process.platform === "win32"
    ? join(dirname(await findCommandPath("npm")), "node_modules", "npm", "package.json")
    : join((await execPortableCommand("npm", ["root", "--global"], { encoding: "utf8" })).stdout.trim(), "npm", "package.json");
  const npmRequire = createRequire(npmManifestPath);
  const { checkPlatform } = npmRequire("npm-install-checks");

  assert.doesNotThrow(() => checkPlatform(manifest, false, { os: "darwin", cpu: "arm64" }));
  assert.doesNotThrow(() => checkPlatform(manifest, false, { os: "win32", cpu: "x64" }));
  assert.throws(
    () => checkPlatform(manifest, false, { os: "linux", cpu: "x64", libc: "glibc" }),
    (error) => {
      assert.equal(error.code, "EBADPLATFORM");
      assert.deepEqual(error.required.os, ["darwin", "win32"]);
      assert.deepEqual(error.required.cpu, ["arm64", "x64"]);
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

test("packaged Skill publishes the exact current Core contract new-task value types and vocabulary", async () => {
  const skill = normalizeNewlines(await readFile(join(pluginRoot, "skills", "dev-flow", "SKILL.md"), "utf8"));

  assert.match(
    skill,
    /`initial_scope`,\s+`initial_out_of_scope`, and\s+`known_acceptance_criteria` are JSON arrays of strings/u,
  );
  assert.match(skill, /exactly `minimal`,\s+`targeted`, or `full`/u);

  const example = skill.match(/<!-- new-task-example:start -->\n```json\n([\s\S]*?)\n```\n<!-- new-task-example:end -->/u);
  assert.notEqual(example, null);
  assert.deepEqual(JSON.parse(example[1]), {
    request: "Return the requested field from the bounded endpoint.",
    initial_scope: ["Update the endpoint response"],
    initial_out_of_scope: ["Change unrelated endpoints"],
    known_acceptance_criteria: ["The response contains the requested field"],
    verification_budget: {
      level: "targeted",
      max_automatic_commands: 4,
      allow_full_suite: false,
      allow_manual_handoff: true,
    },
    method_profile: "plain",
  });
});

test("release output names derive from Codex and Core versions", () => {
  assert.deepEqual(releaseOutputNames("codex", currentVersion, currentVersion), [
    "SHA256SUMS",
    `dev-flow-core-${currentVersion}-darwin-arm64`,
    `dev-flow-core-${currentVersion}-windows-amd64.exe`,
    `dev-flow-codex-${currentVersion}.tgz`,
    "release-manifest.json",
  ].sort());
});

test("local package builder stages one exact non-final artifact in a temporary directory", {
  skip: process.platform === "win32" ? "the Unix builder is covered on Unix; Windows uses scripts/dev-flow-local.mjs" : false,
}, async () => {
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
  assert.deepEqual(packedManifest.os, ["darwin", "win32"]);
  assert.deepEqual(packedManifest.cpu, ["arm64", "x64"]);

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
    const { stdout: help } = await execFile(runtime, ["help"], { cwd: extractDirectory, encoding: "utf8" });
    for (const command of ["webui start", "webui open", "webui status", "webui stop", "webui reset"]) {
      assert.match(help, new RegExp(command, "u"));
    }
  }
});

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeNewlines(value) {
  return value.replaceAll("\r\n", "\n");
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
