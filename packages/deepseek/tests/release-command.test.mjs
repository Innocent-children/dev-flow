import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { parseReleaseArguments, quickModeBlockingPaths, runReleaseCommand } from "../../../scripts/release-deepseek.mjs";

const execFile = promisify(execFileCallback);
const baseVersion = "1.2.3";
const targetVersion = "1.2.4";
const betaVersion = "1.3.0-beta.1";
const coreVersion = "0.5.0";
const codexVersion = "3.4.5";

test("release command requires mode/version/confirmation and explicit normal comprehension", () => {
  assert.deepEqual(parseReleaseArguments([
    "--mode", "normal", "--version", targetVersion,
    "--output", "/tmp/dev-flow-release-v1.2.4",
    "--confirm", `deepseek-v${targetVersion}`, "--confirm-comprehension",
  ]), {
    channel: "stable",
    mode: "normal",
    targetVersion,
    outputDirectory: "/tmp/dev-flow-release-v1.2.4",
    confirmation: `deepseek-v${targetVersion}`,
    comprehensionConfirmed: true,
  });
  assert.deepEqual(parseReleaseArguments([
    "--mode", "quick", "--version", targetVersion, "--confirm", `deepseek-v${targetVersion}`,
  ]).mode, "quick");
  assert.equal(parseReleaseArguments([
    "--channel", "beta", "--mode", "normal", "--version", betaVersion,
    "--confirm", `deepseek-v${betaVersion}`, "--confirm-comprehension",
  ]).channel, "beta");
  for (const arguments_ of [
    [],
    ["--mode", "normal", "--version", targetVersion],
    ["--mode", "quick", "--version", targetVersion, "--confirm", `deepseek-v${targetVersion}`, "--unknown"],
  ]) assert.throws(() => parseReleaseArguments(arguments_), /usage|unknown argument/u);
});

test("beta channel releases a prerelease from an arbitrary clean branch without changing stable public versions", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  await git(scenario.repository, ["checkout", "-b", "preview/multi-repository"]);
  const output = join(scenario.root, `deepseek-v${betaVersion}`);
  const calls = [];
  const result = await runReleaseCommand({
    channel: "beta",
    mode: "normal",
    targetVersion: betaVersion,
    outputDirectory: output,
    confirmation: `deepseek-v${betaVersion}`,
    comprehensionConfirmed: true,
    repositoryRoot: scenario.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output, version: betaVersion, mode: "normal" }),
  });

  assert.equal(result.release_channel, "beta");
  assert.equal(JSON.parse(await readFile(join(scenario.repository, "packages/deepseek/package.json"), "utf8")).version, betaVersion);
  assert.equal(JSON.parse(await readFile(join(scenario.repository, "release/public-versions.json"), "utf8")).deepseek.version, baseVersion);
  assert.equal(calls[0].options.env.DEV_FLOW_RELEASE_CHANNEL, "beta");
  const head = (await git(scenario.repository, ["rev-parse", "HEAD"])).trim();
  const remote = (await git(scenario.repository, ["ls-remote", "--heads", "origin", "refs/heads/preview/multi-repository"])).trim().split(/\s+/u)[0];
  assert.equal(remote, head);
});

test("quick eligibility rejects product surfaces and accepts release-only paths", () => {
  assert.deepEqual(quickModeBlockingPaths([
    "README.md", "docs/PRODUCT.md", "scripts/release-deepseek.mjs", "tests/contract/release_contract_test.go",
  ]), []);
  assert.deepEqual(quickModeBlockingPaths([
    "internal/mcp/server.go", "packages/deepseek/lib/runtime.mjs", "go.mod",
  ]), ["go.mod", "internal/mcp/server.go", "packages/deepseek/lib/runtime.mjs"]);
});

test("normal mode bumps versions, commits, pushes, prepares, verifies, and publishes", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  const output = join(scenario.root, `deepseek-v${targetVersion}`);
  const calls = [];
  const result = await runReleaseCommand({
    mode: "normal",
    targetVersion,
    outputDirectory: output,
    confirmation: `deepseek-v${targetVersion}`,
    comprehensionConfirmed: true,
    repositoryRoot: scenario.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output, version: targetVersion, mode: "normal" }),
  });

  assert.equal(result.version, targetVersion);
  assert.equal(result.verification_mode, "normal");
  assert.equal(result.based_on_release, "v0.5.0");
  assert.deepEqual(calls.map((call) => call.label), ["normal-validation", "prepare", "verify", "publish"]);
  assert.equal((await readFile(join(scenario.repository, "CORE_VERSION"), "utf8")).trim(), coreVersion);
  assert.equal(JSON.parse(await readFile(join(scenario.repository, "packages/deepseek/package.json"), "utf8")).version, targetVersion);
  assert.equal(JSON.parse(await readFile(join(scenario.repository, "packages/codex/package.json"), "utf8")).version, codexVersion);
  assert.equal((await git(scenario.repository, ["log", "-1", "--format=%s"])).trim(), `release(deepseek): v${targetVersion}`);
  assert.equal((await git(scenario.repository, ["rev-parse", "HEAD"])).trim(), (await git(scenario.repository, ["rev-parse", "origin/main"])).trim());

  const resumed = [];
  const resume = await runReleaseCommand({
    mode: "normal",
    targetVersion,
    outputDirectory: output,
    confirmation: `deepseek-v${targetVersion}`,
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
  const output = join(quick.root, `deepseek-v${targetVersion}`);
  const calls = [];
  const result = await runReleaseCommand({
    mode: "quick",
    targetVersion,
    outputDirectory: output,
    confirmation: `deepseek-v${targetVersion}`,
    repositoryRoot: quick.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner(calls, { prepareOutput: output, version: targetVersion, mode: "quick", basedOnRelease: "v0.5.0" }),
  });
  assert.equal(result.based_on_release, "v0.5.0");
  assert.deepEqual(calls.map((call) => call.label), ["quick-contracts", "quick-journey-contract", "prepare", "verify", "publish"]);
  assert.equal(calls[0].options.env.DEV_FLOW_RELEASE_MODE, "quick");
  assert.equal(calls[0].options.env.DEV_FLOW_BASED_ON_RELEASE, "v0.5.0");

  const subsequent = await createScenario(t, { changedPath: "docs/change.md" });
  await git(subsequent.repository, ["tag", `deepseek-v${baseVersion}`]);
  await git(subsequent.repository, ["push", "origin", `deepseek-v${baseVersion}`]);
  const subsequentOutput = join(subsequent.root, `deepseek-v${targetVersion}`);
  const subsequentResult = await runReleaseCommand({
    mode: "normal",
    targetVersion,
    outputDirectory: subsequentOutput,
    confirmation: `deepseek-v${targetVersion}`,
    comprehensionConfirmed: true,
    repositoryRoot: subsequent.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: recordingRunner([], { prepareOutput: subsequentOutput, version: targetVersion, mode: "normal", basedOnRelease: `deepseek-v${baseVersion}` }),
  });
  assert.equal(subsequentResult.based_on_release, `deepseek-v${baseVersion}`);

  const blocked = await createScenario(t, { changedPath: "internal/domain/change.go" });
  await assert.rejects(runReleaseCommand({
    mode: "quick",
    targetVersion,
    outputDirectory: join(blocked.root, "blocked"),
    confirmation: `deepseek-v${targetVersion}`,
    repositoryRoot: blocked.repository,
    platform: "darwin",
    architecture: "arm64",
    runProcess: async () => assert.fail("quick rejection must precede child commands"),
  }), /quick mode is not eligible[\s\S]*internal\/domain\/change.go/u);
  assert.equal((await readFile(join(blocked.repository, "CORE_VERSION"), "utf8")).trim(), coreVersion);
});

test("resume automatically publishes from the prepared frozen source after tooling advances", async (t) => {
  const scenario = await createScenario(t, { changedPath: "docs/change.md" });
  const output = join(scenario.root, `deepseek-v${targetVersion}`);
  await runReleaseCommand({
    mode: "normal", targetVersion, outputDirectory: output, confirmation: `deepseek-v${targetVersion}`,
    comprehensionConfirmed: true, repositoryRoot: scenario.repository, platform: "darwin", architecture: "arm64",
    runProcess: recordingRunner([], { prepareOutput: output, version: targetVersion, mode: "normal" }),
  });
  const prepared = JSON.parse(await readFile(join(output, "release-manifest.json"), "utf8"));
  await writeFile(join(scenario.repository, "scripts", "release-deepseek.mjs"), "new release tooling\n");
  for (const path of ["packages/deepseek/package.json"]) {
    const manifest = JSON.parse(await readFile(join(scenario.repository, path), "utf8"));
    manifest.version = "1.2.5";
    await writeJSON(join(scenario.repository, path), manifest);
  }
  await git(scenario.repository, ["add", "scripts/release-deepseek.mjs", "packages/deepseek/package.json"]);
  await git(scenario.repository, ["commit", "-m", "chore: advance release tooling"]);
  await git(scenario.repository, ["push", "origin", "main"]);

  const calls = [];
  const result = await runReleaseCommand({
    mode: "normal", targetVersion, outputDirectory: output, confirmation: `deepseek-v${targetVersion}`,
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
    ["version", { targetVersion: "1.2.2", confirmation: "deepseek-v1.2.2" }, /must be greater/u],
  ]) {
    await t.test(name, async () => {
      await assert.rejects(runReleaseCommand({
        mode: "normal", targetVersion, confirmation: `deepseek-v${targetVersion}`, comprehensionConfirmed: true,
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
    mkdir(join(repository, "packages", "codex"), { recursive: true }),
    mkdir(join(repository, "packages", "deepseek", "tests", "fixtures"), { recursive: true }),
    mkdir(join(repository, "packages", "deepseek"), { recursive: true }),
    mkdir(join(repository, "protocol", "fixtures"), { recursive: true }),
    mkdir(join(repository, "scripts"), { recursive: true }),
  ]);
  await writeVersionAuthorities(repository, baseVersion);
  await writePublicVersions(repository, { core: coreVersion, codex: codexVersion, deepseek: baseVersion });
  for (const name of ["build-deepseek-release.sh", "verify-deepseek-release.mjs", "publish-deepseek-release.mjs"]) {
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
  await git(repository, ["tag", "v0.5.0"]);
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
  await writeFile(join(repository, "CORE_VERSION"), `${coreVersion}\n`);
  await writeJSON(join(repository, "package.json"), { name: "dev-flow", private: true });
  await writeJSON(join(repository, "packages", "deepseek", "package.json"), { name: "dev-flow-deepseek", version, private: false });
  await writeJSON(join(repository, "packages", "codex", "package.json"), { name: "dev-flow-codex", version: codexVersion, private: false });
  await writeJSON(join(repository, "protocol", "fixtures", "graph-server-info.json"), { product: "dev-flow", version: coreVersion });
  await writeJSON(join(repository, "packages", "deepseek", "tests", "fixtures", "graph-method-profiles.json"), { server_info: { version: coreVersion } });
  await writeFile(join(repository, "packages", "deepseek", "tests", "fixtures", "fake-core.mjs"), `const first = "${coreVersion}";\nconst second = "${coreVersion}";\n`);
}

async function writePublicVersions(repository, versions) {
  await mkdir(join(repository, "release"), { recursive: true });
  await writeJSON(join(repository, "release", "public-versions.json"), {
    core_version: versions.core,
    codex: { version: versions.codex, core_version: versions.core },
    deepseek: { version: versions.deepseek, core_version: versions.core },
  });
}

function recordingRunner(calls, { prepareOutput = null, version = targetVersion, mode = "normal", basedOnRelease = null } = {}) {
  return async (executable, arguments_, options) => {
    const name = executable.split("/").at(-1);
    const label = name === "pnpm" ? "normal-validation"
      : name === "go" ? "quick-contracts"
        : name === "build-deepseek-release.sh" ? "prepare"
          : arguments_[0] === "--test" ? "quick-journey-contract"
            : arguments_[0]?.endsWith("verify-deepseek-release.mjs") ? "verify"
              : "publish";
    calls.push({ label, executable, arguments: [...arguments_], options });
    if (label === "prepare") {
      const sourceCommit = (await git(options.cwd, ["rev-parse", "HEAD"])).trim();
      const sourceTree = (await git(options.cwd, ["rev-parse", "HEAD^{tree}"])).trim();
      await writeReleaseFiles(prepareOutput, { version, coreVersion, mode, basedOnRelease: basedOnRelease ?? "v0.5.0", sourceCommit, sourceTree });
    }
  };
}

async function writeReleaseFiles(directory, { version, coreVersion, mode, basedOnRelease, sourceCommit, sourceTree }) {
  await Promise.all([
    writeFile(join(directory, "SHA256SUMS"), "checksums\n"),
    writeFile(join(directory, `dev-flow-core-${coreVersion}-darwin-arm64`), "core\n"),
    writeFile(join(directory, `dev-flow-deepseek-${version}.tgz`), "package\n"),
    writeFile(join(directory, "publication-record.json"), "{}\n"),
    writeJSON(join(directory, "release-manifest.json"), {
      release: {
        product: "deepseek",
        version,
        core_version: coreVersion,
        tag: `deepseek-v${version}`,
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
