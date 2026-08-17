import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { prepareRelease } from "../../../scripts/verify-codex-release.mjs";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const supportedMachine = process.platform === "darwin" && process.arch === "arm64";

test("fake npm/gh publication is confirmation-gated, publish-once, resumable, and conflict-safe", {
  skip: supportedMachine ? false : "darwin-arm64 fake publication checkpoint only",
  timeout: 240_000,
}, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-release-publication-")));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const template = await createPublisherTemplate(root);

  await t.test("publisher CLI rejects unknown, duplicate, relative, and symlink inputs before remote commands", async () => {
    const scenario = await createScenario(root, template, "closed-cli");
    await assertPublisherRawRejects(scenario, ["--unknown"], /unknown argument/u);
    await assertPublisherRawRejects(scenario, ["--directory", "relative"], /release directory must be absolute/u);
    await assertPublisherRawRejects(scenario, [
      "--directory", scenario.releaseDirectory,
      "--directory", scenario.releaseDirectory,
    ], /only once/u);
    const link = join(scenario.root, "release-link");
    await symlink(scenario.releaseDirectory, link);
    await assertPublisherRawRejects(scenario, ["--directory", link], /canonical directory/u);
    assert.equal((await callLog(scenario)).length, 0);
  });

  await t.test("missing and wrong confirmation perform read-only preflight with zero mutation", async () => {
    const missing = await createScenario(root, template, "missing-confirmation");
    const preflight = await runPublisher(missing);
    assert.equal(preflight.status, "prepared");
    assert.equal(preflight.mode, "read-only-preflight");
    assert.equal(preflight.mutated, false);
    await assertRemoteMutationCount(missing, 0);

    const wrong = await createScenario(root, template, "wrong-confirmation");
    await assertPublisherRejects(wrong, "v9.9.9", /confirmation must equal v0\.1\.0/u);
    await assertRemoteMutationCount(wrong, 0);
    const wrongRecord = await readJSON(join(wrong.releaseDirectory, "publication-record.json"));
    assert.equal(wrongRecord.overall_status, "blocked");
    assert.equal(wrongRecord.steps[0].error_code, "CONFIRMATION_MISMATCH");
  });

  await t.test("exact confirmation creates tag/draft/npm/readback once and exact resume never republishes", async () => {
    const scenario = await createScenario(root, template, "exact-and-resume", {
      npm: { delayed_reads_remaining: 2 },
    });
    const first = await runPublisher(scenario, "v0.1.0");
    assert.equal(first.status, "npm_verified");
    assert.equal(first.final_journey, "pending");
    assert.equal(first.github_release_draft, true);
    const npmState = await readJSON(scenario.npmStatePath);
    const ghState = await readJSON(scenario.ghStatePath);
    assert.equal(npmState.publish_count, 1);
    assert.equal(ghState.release.isDraft, true);
    assert.equal(ghState.release.assets.length, 0);
    assert.equal(await remoteTagTarget(scenario), template.sourceCommit);

    const calls = await callLog(scenario);
    const createIndex = calls.findIndex((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "create");
    const publishIndex = calls.findIndex((entry) => entry.tool === "npm" && entry.argv[0] === "publish");
    const packIndex = calls.findIndex((entry) => entry.tool === "npm" && entry.argv[0] === "pack");
    assert.ok(createIndex >= 0 && publishIndex > createIndex && packIndex > publishIndex);
    assert.equal(calls.filter((entry) => entry.result === "version-delayed").length, 2);
    assert.equal(calls.some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);

    const beforeResumePublishes = calls.filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length;
    const resumed = await runPublisher(scenario, "v0.1.0");
    assert.equal(resumed.status, "npm_verified");
    const afterResume = await callLog(scenario);
    assert.equal(afterResume.filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length, beforeResumePublishes);
    assert.equal((await readJSON(scenario.npmStatePath)).publish_count, 1);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.deepEqual(record.steps.slice(0, 5).map((step) => step.status), ["complete", "complete", "complete", "complete", "complete"]);
    assert.equal(record.steps[5].status, "pending");
    assert.equal(record.github.published, false);
  });

  await t.test("npm commit followed by process failure is recovered without a second publish", async () => {
    const scenario = await createScenario(root, template, "npm-record-loss", {
      npm: { fail_after_publish: true },
    });
    await assertPublisherRejects(scenario, "v0.1.0", /fixture process failed after immutable npm publish/u);
    let npmState = await readJSON(scenario.npmStatePath);
    assert.equal(npmState.version, "0.1.0");
    assert.equal(npmState.publish_count, 1);
    const failedRecord = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failedRecord.overall_status, "failed");
    assert.equal(failedRecord.steps[3].status, "failed");

    const resumed = await runPublisher(scenario, "v0.1.0");
    assert.equal(resumed.status, "npm_verified");
    npmState = await readJSON(scenario.npmStatePath);
    assert.equal(npmState.publish_count, 1);
    assert.equal((await callLog(scenario)).filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length, 1);
  });

  await t.test("delayed registry timeout preserves publish truth and resumes after visibility", async () => {
    const scenario = await createScenario(root, template, "delayed-timeout", {
      npm: { delayed_reads_remaining: 20 },
    });
    await assertPublisherRejects(scenario, "v0.1.0", /bounded read-back window/u);
    let state = await readJSON(scenario.npmStatePath);
    assert.equal(state.publish_count, 1);
    assert.equal(state.version, "0.1.0");
    const failed = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failed.overall_status, "failed");
    assert.equal(failed.steps[4].error_code, "NPM_READBACK_TIMEOUT");
    state.delayed_reads_remaining = 0;
    await writeJSON(scenario.npmStatePath, state);
    assert.equal((await runPublisher(scenario, "v0.1.0")).status, "npm_verified");
    assert.equal((await readJSON(scenario.npmStatePath)).publish_count, 1);
  });

  await t.test("tag, draft, and registry byte conflicts block without overwrite", async () => {
    const tagConflict = await createScenario(root, template, "tag-conflict");
    const otherCommit = (await execFile("git", ["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "conflicting tag fixture"], {
      cwd: tagConflict.repository,
      env: tagConflict.environment,
      encoding: "utf8",
    })).stdout.trim();
    await execFile("git", ["push", tagConflict.bareRemote, `${otherCommit}:refs/tags/v0.1.0`], {
      cwd: tagConflict.repository,
      env: tagConflict.environment,
    });
    await assertPublisherRejects(tagConflict, "v0.1.0", /different source commit/u);
    assert.equal((await readJSON(join(tagConflict.releaseDirectory, "publication-record.json"))).overall_status, "blocked");
    await assertRemoteMutationCount(tagConflict, 0, otherCommit);

    const draftConflict = await createScenario(root, template, "draft-conflict", {
      gh: {
        release: {
          tagName: "v0.1.0",
          isDraft: true,
          isPrerelease: false,
          targetCommitish: "f".repeat(40),
          id: 701,
          url: "https://github.example.invalid/releases/conflict",
          assets: [],
        },
      },
    });
    await assertPublisherRejects(draftConflict, "v0.1.0", /conflicts with the exact draft/u);
    assert.equal((await readJSON(join(draftConflict.releaseDirectory, "publication-record.json"))).overall_status, "blocked");
    assert.equal((await callLog(draftConflict)).some((entry) => entry.result === "release-create"), false);

    const publishedConflict = await createScenario(root, template, "published-release-conflict", {
      gh: {
        release: {
          tagName: "v0.1.0",
          isDraft: false,
          isPrerelease: false,
          targetCommitish: template.sourceCommit,
          id: 702,
          url: "https://github.example.invalid/releases/published-conflict",
          assets: [],
        },
      },
    });
    await assertPublisherRejects(publishedConflict, "v0.1.0", /conflicts with the exact draft/u);
    assert.equal((await callLog(publishedConflict)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);

    const registryConflict = await createScenario(root, template, "registry-conflict", {
      npm: { corrupt_readback: true },
    });
    await assertPublisherRejects(registryConflict, "v0.1.0", /registry tarball differs|npm tarball contains/u);
    assert.equal((await readJSON(registryConflict.npmStatePath)).publish_count, 1);
    await assertPublisherRejects(registryConflict, "v0.1.0", /registry tarball differs|npm tarball contains/u);
    assert.equal((await readJSON(registryConflict.npmStatePath)).publish_count, 1);
  });

  await t.test("asset upload record loss resumes exactly and keeps the Release draft", async () => {
    const scenario = await createScenario(root, template, "asset-record-loss");
    assert.equal((await runPublisher(scenario, "v0.1.0")).status, "npm_verified");
    await markTestLocalJourneyPassed(scenario);
    const ghState = await readJSON(scenario.ghStatePath);
    ghState.fail_after_upload_name = "SHA256SUMS";
    await writeJSON(scenario.ghStatePath, ghState);

    await assertPublisherRejects(scenario, "v0.1.0", /fixture process failed after immutable asset upload/u);
    let observedGH = await readJSON(scenario.ghStatePath);
    assert.equal(observedGH.release.assets.some((asset) => asset.name === "SHA256SUMS"), true);
    const failed = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failed.steps[6].status, "failed");

    const resumed = await runPublisher(scenario, "v0.1.0");
    assert.equal(resumed.status, "assets_verified");
    observedGH = await readJSON(scenario.ghStatePath);
    assert.equal(observedGH.release.isDraft, true);
    assert.equal(observedGH.release.assets.length, 4);
    const calls = await callLog(scenario);
    assert.equal(calls.filter((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "upload" && entry.argv[3].endsWith("SHA256SUMS")).length, 1);
    assert.equal(calls.some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(record.overall_status, "assets_verified");
    assert.equal(record.steps[8].status, "pending");
    assert.equal(record.github.published, false);
  });

  await t.test("asset name/digest and asset read-back conflicts block without clobber or finalization", async () => {
    const conflict = await createScenario(root, template, "asset-conflict");
    await runPublisher(conflict, "v0.1.0");
    await markTestLocalJourneyPassed(conflict);
    const ghState = await readJSON(conflict.ghStatePath);
    const badAssetPath = join(conflict.remoteRoot, "conflicting-SHA256SUMS");
    await writeFile(badAssetPath, "conflicting immutable asset\n");
    ghState.release.assets.push({
      name: "SHA256SUMS",
      id: 9001,
      url: "https://github.example.invalid/assets/9001",
      path: badAssetPath,
      sha256: "0".repeat(64),
    });
    await writeJSON(conflict.ghStatePath, ghState);
    await assertPublisherRejects(conflict, "v0.1.0", /conflicting bytes/u);
    const conflictCalls = await callLog(conflict);
    assert.equal(conflictCalls.some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "upload" && entry.argv[3].endsWith("SHA256SUMS")), false);

    const readback = await createScenario(root, template, "asset-readback-conflict");
    await runPublisher(readback, "v0.1.0");
    await markTestLocalJourneyPassed(readback);
    const readbackState = await readJSON(readback.ghStatePath);
    readbackState.corrupt_download_name = "SHA256SUMS";
    await writeJSON(readback.ghStatePath, readbackState);
    await assertPublisherRejects(readback, "v0.1.0", /read-back differs/u);
    const blocked = await readJSON(join(readback.releaseDirectory, "publication-record.json"));
    assert.equal(blocked.overall_status, "blocked");
    assert.equal(blocked.github.published, false);
    assert.equal((await callLog(readback)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);
  });
});

async function createPublisherTemplate(root) {
  const repository = join(root, "template-repository");
  await copyRepositoryFixture(repository);
  await initializeMainFixture(repository);
  const sourceCommit = await gitOutput(repository, ["rev-parse", "HEAD"]);
  const sourceTree = await gitOutput(repository, ["rev-parse", "HEAD^{tree}"]);
  const buildOutput = join(root, "publisher-fixture-build");
  const releaseDirectory = join(root, "publisher-release-template");
  await mkdir(buildOutput);
  await mkdir(releaseDirectory);
  const build = JSON.parse((await execFile(join(repository, "scripts", "build-codex-local.sh"), [
    "--output", buildOutput,
  ], { cwd: repository, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })).stdout);
  await prepareRelease({
    repositoryRoot: repository,
    sourceCommit,
    sourceTree,
    firstTarball: build.artifact_path,
    secondTarball: build.artifact_path,
    outputDirectory: releaseDirectory,
    createdAt: "2026-08-17T06:00:00Z",
  });
  return { repository, releaseDirectory, sourceCommit, sourceTree };
}

async function createScenario(root, template, name, overrides = {}) {
  const scenarioRoot = join(root, name);
  const repository = join(scenarioRoot, "repository");
  const bareRemote = join(scenarioRoot, "remote.git");
  const releaseDirectory = join(scenarioRoot, "release");
  const fakeBin = join(scenarioRoot, "bin");
  const home = join(scenarioRoot, "home");
  const processTemp = join(scenarioRoot, "tmp");
  const remoteRoot = join(scenarioRoot, "fake-remote");
  const npmStatePath = join(scenarioRoot, "npm-state.json");
  const ghStatePath = join(scenarioRoot, "gh-state.json");
  const callLogPath = join(scenarioRoot, "calls.jsonl");
  await mkdir(scenarioRoot, { recursive: true });
  await execFile("git", ["clone", "--quiet", template.repository, repository]);
  await execFile("git", ["config", "user.name", "Dev Flow Publication Scenario"], { cwd: repository });
  await execFile("git", ["config", "user.email", "scenario@example.invalid"], { cwd: repository });
  await execFile("git", ["init", "--bare", bareRemote]);
  await execFile("git", ["remote", "set-url", "origin", bareRemote], { cwd: repository });
  await cp(template.releaseDirectory, releaseDirectory, { recursive: true });
  await Promise.all([
    mkdir(fakeBin), mkdir(home), mkdir(processTemp), mkdir(remoteRoot),
  ]);
  await symlink(join(repository, "packages", "codex", "tests", "fixtures", "fake-release-npm.mjs"), join(fakeBin, "npm"));
  await symlink(join(repository, "packages", "codex", "tests", "fixtures", "fake-release-gh.mjs"), join(fakeBin, "gh"));
  await writeFile(join(home, "npm-config"), "");
  await writeFile(callLogPath, "", { mode: 0o600 });

  const npmState = {
    account: "fixture-publisher",
    package_exists: false,
    owners: ["fixture-publisher"],
    version: null,
    expected_version: "0.1.0",
    remote_root: join(remoteRoot, "npm"),
    remote_tarball: null,
    integrity: null,
    publish_count: 0,
    delayed_reads_remaining: 0,
    fail_after_publish: false,
    fail_version_view: false,
    corrupt_readback: false,
    ...(overrides.npm ?? {}),
  };
  const ghState = {
    permissions: { push: true, maintain: true, admin: true },
    release: null,
    next_release_id: 501,
    next_asset_id: 1001,
    asset_root: join(remoteRoot, "github-assets"),
    fail_after_upload_name: null,
    corrupt_download_name: null,
    fail_finalize: true,
    ...(overrides.gh ?? {}),
  };
  await writeJSON(npmStatePath, npmState);
  await writeJSON(ghStatePath, ghState);
  const environment = {
    HOME: home,
    PATH: [fakeBin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    TMPDIR: processTemp,
    LANG: "C",
    NPM_CONFIG_CACHE: join(scenarioRoot, "npm-cache"),
    NPM_CONFIG_USERCONFIG: join(home, "npm-config"),
    FAKE_RELEASE_NPM_STATE: npmStatePath,
    FAKE_RELEASE_GH_STATE: ghStatePath,
    FAKE_RELEASE_CALL_LOG: callLogPath,
  };
  assert.equal((await execFile("which", ["npm"], { env: environment, encoding: "utf8" })).stdout.trim(), join(fakeBin, "npm"));
  assert.equal((await execFile("which", ["gh"], { env: environment, encoding: "utf8" })).stdout.trim(), join(fakeBin, "gh"));
  return {
    root: scenarioRoot,
    repository,
    bareRemote,
    releaseDirectory,
    remoteRoot,
    npmStatePath,
    ghStatePath,
    callLogPath,
    environment,
  };
}

async function runPublisher(scenario, confirmation = null) {
  const arguments_ = ["--directory", scenario.releaseDirectory];
  if (confirmation !== null) arguments_.push("--confirm", confirmation);
  const { stdout, stderr } = await execFile(join(scenario.repository, "scripts", "publish-codex-release.mjs"), arguments_, {
    cwd: scenario.repository,
    env: scenario.environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 60_000,
  });
  assert.equal(stderr, "");
  return JSON.parse(stdout);
}

async function assertPublisherRejects(scenario, confirmation, pattern) {
  await assert.rejects(
    runPublisher(scenario, confirmation),
    (error) => {
      assert.match(error.stderr, pattern);
      return true;
    },
  );
}

async function assertPublisherRawRejects(scenario, arguments_, pattern) {
  await assert.rejects(
    execFile(join(scenario.repository, "scripts", "publish-codex-release.mjs"), arguments_, {
      cwd: scenario.repository,
      env: scenario.environment,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
    }),
    (error) => {
      assert.match(error.stderr, pattern);
      return true;
    },
  );
}

async function markTestLocalJourneyPassed(scenario) {
  const path = join(scenario.releaseDirectory, "publication-record.json");
  const record = await readJSON(path);
  const observedAt = "2026-08-17T06:30:00Z";
  record.final_journey = {
    status: "passed",
    actual_codex_version: "0.147.0",
    observed_at: observedAt,
    summary: "Test-local journey fixture only; not real Codex evidence.",
  };
  const step = record.steps.find((candidate) => candidate.name === "final_journey");
  step.status = "complete";
  step.started_at = observedAt;
  step.completed_at = observedAt;
  step.remote_id = "test-local-journey-fixture";
  step.error_code = null;
  step.summary = "Test-local journey fixture passed the mechanical asset gate.";
  step.safe_next_action = "Exercise mechanical asset upload/read-back while keeping the Release draft.";
  record.overall_status = "journey_passed";
  record.last_observed_at = observedAt;
  record.safe_next_action = step.safe_next_action;
  await writeJSON(path, record, 0o600);
}

async function assertRemoteMutationCount(scenario, expected, expectedTagTarget = null) {
  const calls = await callLog(scenario);
  const mutations = calls.filter((entry) =>
    entry.tool === "npm" && entry.argv[0] === "publish" ||
    entry.tool === "gh" && entry.argv[0] === "release" && ["create", "upload", "edit"].includes(entry.argv[1]),
  );
  assert.equal(mutations.length, expected);
  assert.equal(await remoteTagTarget(scenario), expectedTagTarget);
}

async function remoteTagTarget(scenario) {
  const { stdout } = await execFile("git", ["ls-remote", "--tags", scenario.bareRemote, "refs/tags/v0.1.0"], {
    cwd: scenario.repository,
    env: scenario.environment,
    encoding: "utf8",
  });
  return stdout.trim() === "" ? null : stdout.trim().split(/\s+/u)[0];
}

async function callLog(scenario) {
  const contents = await readFile(scenario.callLogPath, "utf8");
  return contents.split("\n").filter(Boolean).map(JSON.parse);
}

async function copyRepositoryFixture(destination) {
  await cp(repositoryRoot, destination, {
    recursive: true,
    filter(source) {
      const path = relative(repositoryRoot, source).split("\\").join("/");
      return path === "" || ![".git", "node_modules", ".codebase-memory"].some(
        (excluded) => path === excluded || path.startsWith(`${excluded}/`),
      );
    },
  });
}

async function initializeMainFixture(path) {
  await execFile("git", ["init", "--initial-branch=main"], { cwd: path });
  await execFile("git", ["config", "user.name", "Dev Flow Publication Test"], { cwd: path });
  await execFile("git", ["config", "user.email", "publication-test@example.invalid"], { cwd: path });
  await execFile("git", ["add", "."], { cwd: path, maxBuffer: 20 * 1024 * 1024 });
  await execFile("git", ["commit", "-m", "publication fixture source"], { cwd: path, maxBuffer: 20 * 1024 * 1024 });
}

async function gitOutput(repository, arguments_) {
  return (await execFile("git", arguments_, { cwd: repository, encoding: "utf8" })).stdout.trim();
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJSON(path, value, mode = 0o600) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
}
