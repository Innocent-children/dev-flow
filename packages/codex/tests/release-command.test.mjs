import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { parseReleaseArguments, quickModeBlockingPaths, runReleaseCommand } from "../../../scripts/release-codex.mjs";

const execFile = promisify(execFileCallback);
const baseVersion = "1.2.3";
const targetVersion = "1.2.4";

test("release command requires mode/version/confirmation and explicit normal comprehension", () => {
  assert.deepEqual(parseReleaseArguments([
    "--mode", "normal", "--version", targetVersion,
    "--output", "/tmp/dev-flow-release-v1.2.4",
    "--confirm", `v${targetVersion}`, "--confirm-comprehension",
  ]), {
    mode: "normal",
    targetVersion,
    outputDirectory: "/tmp/dev-flow-release-v1.2.4",
    confirmation: `v${targetVersion}`,
    comprehensionConfirmed: true,
  });
  assert.deepEqual(parseReleaseArguments([
    "--mode", "quick", "--version", targetVersion, "--confirm", `v${targetVersion}`,
  ]).mode, "quick");
  for (const arguments_ of [
    [],
    ["--mode", "normal", "--version", targetVersion],
    ["--mode", "quick", "--version", targetVersion, "--confirm", `v${targetVersion}`, "--unknown"],
  ]) assert.throws(() => parseReleaseArguments(arguments_), /usage|unknown argument/u);
});

test("quick eligibility rejects product surfaces and accepts release-only paths", () => {
  assert.deepEqual(quickModeBlockingPaths([
    "README.md", "docs/PRODUCT.md", "scripts/release-codex.mjs", "tests/contract/release_contract_test.go",
  ]), []);
  assert.deepEqual(quickModeBlockingPaths([
    "internal/mcp/server.go", "packages/codex/lib/lifecycle.mjs", "go.mod",
  ]), ["go.mod", "internal/mcp/server.go", "packages/codex/lib/lifecycle.mjs"]);
});

test("normal mode bumps versions, commits, pushes, prepares, verifies, and publishes", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  const output = join(scenario.root, `v${targetVersion}`);
  const calls = [];
  const result = await runReleaseCommand({
    mode: "normal",
    targetVersion,
    outputDirectory: output,
    confirmation: `v${targetVersion}`,
    comprehensionConfirmed: true,
    repositoryRoot: scenario.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output, version: targetVersion, mode: "normal" }),
  });

  assert.equal(result.version, targetVersion);
  assert.equal(result.verification_mode, "normal");
  assert.equal(result.based_on_release, null);
  assert.deepEqual(calls.map((call) => call.label), ["normal-validation", "prepare", "verify", "publish"]);
  assert.equal((await readFile(join(scenario.repository, "VERSION"), "utf8")).trim(), targetVersion);
  assert.equal((await git(scenario.repository, ["log", "-1", "--format=%s"])).trim(), `release: bump Codex to v${targetVersion}`);
  assert.equal((await git(scenario.repository, ["rev-parse", "HEAD"])).trim(), (await git(scenario.repository, ["rev-parse", "origin/main"])).trim());

  const resumed = [];
  const resume = await runReleaseCommand({
    mode: "normal",
    targetVersion,
    outputDirectory: output,
    confirmation: `v${targetVersion}`,
    comprehensionConfirmed: true,
    repositoryRoot: scenario.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(resumed),
  });
  assert.equal(resume.mode, "resumed-and-published");
  assert.deepEqual(resumed.map((call) => call.label), ["publish"]);
});

test("quick mode records its previous release and refuses product-affecting diffs", async (t) => {
  const quick = await createScenario(t, { changedPath: "docs/change.md" });
  const output = join(quick.root, `v${targetVersion}`);
  const calls = [];
  const result = await runReleaseCommand({
    mode: "quick",
    targetVersion,
    outputDirectory: output,
    confirmation: `v${targetVersion}`,
    repositoryRoot: quick.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output, version: targetVersion, mode: "quick", basedOnRelease: baseVersion }),
  });
  assert.equal(result.based_on_release, baseVersion);
  assert.deepEqual(calls.map((call) => call.label), ["quick-contracts", "quick-journey-contract", "prepare", "verify", "publish"]);
  assert.equal(calls[0].options.env.DEV_FLOW_RELEASE_MODE, "quick");
  assert.equal(calls[0].options.env.DEV_FLOW_BASED_ON_RELEASE, baseVersion);

  const blocked = await createScenario(t, { changedPath: "internal/domain/change.go" });
  await assert.rejects(runReleaseCommand({
    mode: "quick",
    targetVersion,
    outputDirectory: join(blocked.root, "blocked"),
    confirmation: `v${targetVersion}`,
    repositoryRoot: blocked.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: async () => assert.fail("quick rejection must precede child commands"),
  }), /quick mode is not eligible[\s\S]*internal\/domain\/change.go/u);
  assert.equal((await readFile(join(blocked.repository, "VERSION"), "utf8")).trim(), baseVersion);
});

test("resume automatically publishes from the prepared frozen source after tooling advances", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  const output = join(scenario.root, `v${targetVersion}`);
  await runReleaseCommand({
    mode: "normal", targetVersion, outputDirectory: output, confirmation: `v${targetVersion}`,
    comprehensionConfirmed: true, repositoryRoot: scenario.repository, platform: "darwin", architecture: "arm64",
    runProcess: recordingRunner([], { prepareOutput: output, version: targetVersion, mode: "normal" }),
  });
  const prepared = JSON.parse(await readFile(join(output, "release-manifest.json"), "utf8"));
  await writeFile(join(scenario.repository, "scripts", "release-codex.mjs"), "new release tooling\n");
  await git(scenario.repository, ["add", "scripts/release-codex.mjs"]);
  await git(scenario.repository, ["commit", "-m", "chore: advance release tooling"]);
  await git(scenario.repository, ["push", "origin", "main"]);

  const calls = [];
  const result = await runReleaseCommand({
    mode: "normal", targetVersion, outputDirectory: output, confirmation: `v${targetVersion}`,
    comprehensionConfirmed: true, repositoryRoot: scenario.repository, platform: "darwin", architecture: "arm64",
    runProcess: recordingRunner(calls),
  });
  assert.equal(result.mode, "resumed-and-published");
  assert.deepEqual(calls.map((call) => call.label), ["publish"]);
  const sourceRootIndex = calls[0].arguments.indexOf("--source-root");
  assert.notEqual(sourceRootIndex, -1);
  const frozenRoot = calls[0].arguments[sourceRootIndex + 1];
  assert.equal((await git(frozenRoot, ["rev-parse", "HEAD"])).trim(), prepared.release.source_commit);
  assert.equal(result.source_commit, prepared.release.source_commit);
});

test("selection, version, and source failures stop before publication children", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  for (const [name, patch, pattern] of [
    ["mode", { mode: "fast" }, /mode must equal quick or normal/u],
    ["confirmation", { confirmation: "v9.9.9" }, /confirmation must equal/u],
    ["comprehension", { comprehensionConfirmed: false }, /requires --confirm-comprehension/u],
    ["version", { targetVersion: "1.2.2", confirmation: "v1.2.2" }, /must be greater/u],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(runReleaseCommand({
        mode: "normal", targetVersion, confirmation: `v${targetVersion}`, comprehensionConfirmed: true,
        outputDirectory: join(scenario.root, `failure-${name}`), repositoryRoot: scenario.repository,
        platform: "darwin", architecture: "arm64", runProcess: async () => assert.fail("no child command expected"),
        ...patch,
      }), pattern);
    });
  }
});

async function createScenario(t, { changedPath }) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-release-command-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = join(root, "repository");
  const remote = join(root, "origin.git");
  await Promise.all([
    mkdir(join(repository, "packages", "codex", "plugin", ".codex-plugin"), { recursive: true }),
    mkdir(join(repository, "packages", "codex", "tests", "fixtures"), { recursive: true }),
    mkdir(join(repository, "packages", "deepseek"), { recursive: true }),
    mkdir(join(repository, "protocol", "fixtures"), { recursive: true }),
    mkdir(join(repository, "scripts"), { recursive: true }),
  ]);
  await writeVersionAuthorities(repository, baseVersion);
  await writeFile(join(repository, "README.md"), "release command fixture\n");
  for (const name of ["build-codex-release.sh", "verify-codex-release.mjs", "publish-codex-release.mjs"]) {
    const path = join(repository, "scripts", name);
    await writeFile(path, "fixture\n");
    await chmod(path, 0o755);
  }
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote]);
  await git(repository, ["init", "--initial-branch=main"]);
  await git(repository, ["config", "user.name", "Dev Flow Release Test"]);
  await git(repository, ["config", "user.email", "release-test@example.invalid"]);
  await git(repository, ["add", "."]);
  await git(repository, ["commit", "-m", "release baseline"]);
  await git(repository, ["tag", `v${baseVersion}`]);
  await git(repository, ["remote", "add", "origin", remote]);
  await git(repository, ["push", "-u", "origin", "main", "--tags"]);
  const path = join(repository, changedPath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, "change\n");
  await git(repository, ["add", changedPath]);
  await git(repository, ["commit", "-m", "feature change"]);
  await git(repository, ["push", "origin", "main"]);
  return { root, repository };
}

async function writeVersionAuthorities(repository, version) {
  await writeFile(join(repository, "VERSION"), `${version}\n`);
  await writeJSON(join(repository, "package.json"), { name: "dev-flow", version, private: true });
  await writeJSON(join(repository, "packages", "codex", "package.json"), { name: "dev-flow-codex", version, private: false });
  await writeJSON(join(repository, "packages", "codex", "plugin", ".codex-plugin", "plugin.json"), { name: "dev-flow-codex", version });
  await writeJSON(join(repository, "packages", "deepseek", "package.json"), { name: "dev-flow-deepseek", version, private: true });
  await writeJSON(join(repository, "protocol", "fixtures", "graph-server-info.json"), { product: "dev-flow", version });
  await writeJSON(join(repository, "packages", "codex", "tests", "fixtures", "graph-method-profiles.json"), { server_info: { version } });
  await writeFile(join(repository, "packages", "codex", "tests", "fixtures", "fake-core.mjs"), `const first = "${version}";\nconst second = "${version}";\n`);
}

function recordingRunner(calls, { prepareOutput = null, version = targetVersion, mode = "normal", basedOnRelease = null } = {}) {
  return async (executable, arguments_, options) => {
    const name = executable.split("/").at(-1);
    const label = name === "pnpm" ? "normal-validation"
      : name === "go" ? "quick-contracts"
        : name === "build-codex-release.sh" ? "prepare"
          : arguments_[0] === "--test" ? "quick-journey-contract"
            : arguments_[0]?.endsWith("verify-codex-release.mjs") ? "verify"
              : "publish";
    calls.push({ label, executable, arguments: [...arguments_], options });
    if (label === "prepare") {
      const sourceCommit = (await git(options.cwd, ["rev-parse", "HEAD"])).trim();
      const sourceTree = (await git(options.cwd, ["rev-parse", "HEAD^{tree}"])).trim();
      await writeReleaseFiles(prepareOutput, { version, mode, basedOnRelease, sourceCommit, sourceTree });
    }
  };
}

async function writeReleaseFiles(directory, { version, mode, basedOnRelease, sourceCommit, sourceTree }) {
  await Promise.all([
    writeFile(join(directory, "SHA256SUMS"), "checksums\n"),
    writeFile(join(directory, `dev-flow-${version}-darwin-arm64`), "core\n"),
    writeFile(join(directory, `dev-flow-codex-${version}.tgz`), "package\n"),
    writeFile(join(directory, "publication-record.json"), "{}\n"),
    writeJSON(join(directory, "release-manifest.json"), {
      release: {
        version,
        verification_mode: mode,
        based_on_release: basedOnRelease,
        source_commit: sourceCommit,
        source_tree: sourceTree,
      },
    }),
  ]);
}

async function writeJSON(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function git(repository, arguments_) {
  return execFile("git", arguments_, { cwd: repository }).then(({ stdout }) => stdout);
}
