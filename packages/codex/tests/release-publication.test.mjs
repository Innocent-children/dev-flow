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

import {
  PUBLICATION_COMMAND_TIMEOUT_MS,
  runPublisher as runPublicationStateMachine,
} from "../../../scripts/publish-codex-release.mjs";
import {
  CODEX_COMPATIBILITY_RANGE,
  EXPLICIT_SELECTOR,
  FINAL_FIXTURE_EVIDENCE_KIND,
} from "../../../scripts/write-codex-journey-evidence.mjs";
import { prepareRelease } from "../../../scripts/verify-codex-release.mjs";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const supportedMachine = process.platform === "darwin" && process.arch === "arm64";

test("publisher allows sixty seconds for ordinary external commands", () => {
  assert.equal(PUBLICATION_COMMAND_TIMEOUT_MS, 60_000);
});

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
    await assertPublisherRawRejects(scenario, ["--directory", link], /non-symlink directory/u);
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
    await assertPublisherRejects(wrong, "v9.9.9", /confirmation must equal codex-v1\.2\.4/u);
    await assertRemoteMutationCount(wrong, 0);
    const wrongRecord = await readJSON(join(wrong.releaseDirectory, "publication-record.json"));
    assert.equal(wrongRecord.overall_status, "blocked");
    assert.equal(wrongRecord.steps[0].error_code, "CONFIRMATION_MISMATCH");
  });

  await t.test("successful preflight supersedes an earlier preflight failure", async () => {
    const scenario = await createScenario(root, template, "preflight-recovery");
    await assertPublisherRejects(scenario, "v9.9.9", /confirmation must equal codex-v1\.2\.4/u);

    const resumed = await runPublisher(scenario);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(resumed.mutated, false);
    assert.equal(record.steps[0].status, "complete");
    assert.equal(record.steps[0].error_code, null);
    assert.match(record.steps[0].summary, /Authenticated npm identity\/ownership/u);
  });

  await t.test("exact confirmation creates tag/draft/npm/readback once and exact resume never republishes", async () => {
    const scenario = await createScenario(root, template, "exact-and-resume", {
      npm: { delayed_reads_remaining: 2 },
    });
    const first = await runPublisher(scenario, "codex-v1.2.4");
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
    assert.deepEqual(scenario.readbackDelays, [2_000, 2_000]);
    assert.equal(calls.filter((entry) => entry.tool === "npm" && entry.argv[0] === "view" && entry.argv[2] === "version" && entry.argv[3] === "dist").length >= 1, true);
    assert.equal(calls.some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);

    const beforeResumePublishes = calls.filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length;
    const resumed = await runPublisher(scenario, "codex-v1.2.4");
    assert.equal(resumed.status, "npm_verified");
    const afterResume = await callLog(scenario);
    assert.equal(afterResume.filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length, beforeResumePublishes);
    assert.equal((await readJSON(scenario.npmStatePath)).publish_count, 1);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.deepEqual(record.steps.slice(0, 5).map((step) => step.status), ["complete", "complete", "complete", "complete", "complete"]);
    assert.equal(record.steps[5].status, "pending");
    assert.equal(record.github.published, false);
  });

  await t.test("stale local record resumes from exact immutable remote truth with bounded next-step output", async () => {
    const scenario = await createScenario(root, template, "stale-record-resume");
    assert.equal((await runPublisher(scenario, "codex-v1.2.4")).status, "npm_verified");
    const mutationsBeforeResume = remoteMutations(await callLog(scenario));
    const remoteBeforeResume = {
      tag: await remoteTagTarget(scenario),
      npm: await readJSON(scenario.npmStatePath),
      github: await readJSON(scenario.ghStatePath),
    };

    const staleRecord = await readJSON(join(template.releaseDirectory, "publication-record.json"));
    await writeJSON(join(scenario.releaseDirectory, "publication-record.json"), staleRecord);
    const resumed = await runPublisher(scenario, "codex-v1.2.4");
    assert.equal(resumed.status, "npm_verified");
    assert.equal(resumed.mutated, false);
    assert.deepEqual(resumed.reused_remote_state, ["github_draft", "npm_package", "tag"]);
    assert.equal(resumed.next_incomplete_step, "final_journey");
    assert.deepEqual(resumed.remaining_steps, [
      "final_journey",
      "github_upload",
      "github_readback",
      "github_finalize",
    ]);
    assert.match(resumed.safe_next_action, /final registry-package journey/u);
    assert.equal(resumed.github_release_draft, true);
    assert.ok(JSON.stringify(resumed).length <= 2_000);

    assert.deepEqual(remoteMutations(await callLog(scenario)), mutationsBeforeResume);
    assert.equal(await remoteTagTarget(scenario), remoteBeforeResume.tag);
    assert.deepEqual(await readJSON(scenario.npmStatePath), remoteBeforeResume.npm);
    assert.deepEqual(await readJSON(scenario.ghStatePath), remoteBeforeResume.github);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(record.overall_status, "npm_verified");
    assert.deepEqual(record.steps.slice(0, 5).map((step) => step.status), [
      "complete", "complete", "complete", "complete", "complete",
    ]);
    assert.equal(record.steps[5].status, "pending");
    assert.equal(record.github.draft, true);
    assert.equal(record.github.published, false);
  });

  await t.test("immutable conflict emits a bounded manual-resolution contract with zero new mutation", async () => {
    const scenario = await createScenario(root, template, "bounded-manual-block");
    scenario.environment.NPM_TOKEN = "private-test-token-marker";
    const otherCommit = (await execFile("git", ["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "bounded conflict fixture"], {
      cwd: scenario.repository,
      env: scenario.environment,
      encoding: "utf8",
    })).stdout.trim();
    await execFile("git", ["push", scenario.bareRemote, `${otherCommit}:refs/tags/codex-v1.2.4`], {
      cwd: scenario.repository,
      env: scenario.environment,
    });

    const failure = await publisherFailure(scenario, "codex-v1.2.4");
    assert.notEqual(failure.code, 0);
    assert.equal(failure.stdout, "");
    assert.ok(failure.stderr.length <= 600);
    assert.match(failure.stderr, /different source commit/u);
    for (const privateValue of [
      scenario.root,
      scenario.environment.HOME,
      scenario.environment.NPM_CONFIG_USERCONFIG,
      scenario.npmStatePath,
      scenario.ghStatePath,
      scenario.environment.NPM_TOKEN,
    ]) {
      assert.equal(failure.stderr.includes(privateValue), false);
    }

    const recordPath = join(scenario.releaseDirectory, "publication-record.json");
    const record = await readJSON(recordPath);
    const blockedStep = record.steps.find((step) => step.name === "tag");
    assert.equal(record.overall_status, "blocked");
    assert.equal(blockedStep.status, "blocked");
    assert.equal(blockedStep.error_code, "TAG_TARGET_CONFLICT");
    assert.ok(blockedStep.summary.length <= 500);
    assert.match(blockedStep.safe_next_action, /manually/u);
    assert.match(blockedStep.safe_next_action, /immutable remote state/u);
    assert.doesNotMatch(
      `${blockedStep.summary} ${blockedStep.safe_next_action}`,
      /delete|overwrite|move (?:the )?tag|unpublish|rename (?:the )?package/iu,
    );
    const recordContents = await readFile(recordPath, "utf8");
    for (const privateValue of [scenario.root, scenario.environment.HOME, scenario.npmStatePath, scenario.ghStatePath]) {
      assert.equal(recordContents.includes(privateValue), false);
    }
    await assertRemoteMutationCount(scenario, 0, otherCommit);
  });

  await t.test("npm commit followed by process failure is recovered without a second publish", async () => {
    const scenario = await createScenario(root, template, "npm-record-loss", {
      npm: { fail_after_publish: true },
    });
    await assertPublisherRejects(scenario, "codex-v1.2.4", /fixture process failed after immutable npm publish/u);
    let npmState = await readJSON(scenario.npmStatePath);
    assert.equal(npmState.version, "1.2.4");
    assert.equal(npmState.publish_count, 1);
    const failedRecord = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failedRecord.overall_status, "failed");
    assert.equal(failedRecord.steps[3].status, "failed");

    const resumed = await runPublisher(scenario, "codex-v1.2.4");
    assert.equal(resumed.status, "npm_verified");
    npmState = await readJSON(scenario.npmStatePath);
    assert.equal(npmState.publish_count, 1);
    assert.equal((await callLog(scenario)).filter((entry) => entry.tool === "npm" && entry.argv[0] === "publish").length, 1);
  });

  await t.test("delayed registry timeout preserves publish truth and resumes after visibility", async () => {
    const scenario = await createScenario(root, template, "delayed-timeout", {
      npm: { delayed_reads_remaining: 20 },
    });
    await assertPublisherRejects(scenario, "codex-v1.2.4", /bounded read-back window/u);
    let state = await readJSON(scenario.npmStatePath);
    assert.equal(state.publish_count, 1);
    assert.equal(state.version, "1.2.4");
    const failed = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failed.overall_status, "failed");
    assert.equal(failed.steps[4].error_code, "NPM_READBACK_TIMEOUT");
    assert.equal((await callLog(scenario)).filter((entry) => entry.result === "version-delayed").length, 10);
    assert.deepEqual(scenario.readbackDelays, Array(9).fill(2_000));
    state.delayed_reads_remaining = 0;
    await writeJSON(scenario.npmStatePath, state);
    assert.equal((await runPublisher(scenario, "codex-v1.2.4")).status, "npm_verified");
    assert.equal((await readJSON(scenario.npmStatePath)).publish_count, 1);
  });

  await t.test("tag, draft, and registry byte conflicts block without overwrite", async () => {
    const tagConflict = await createScenario(root, template, "tag-conflict");
    const otherCommit = (await execFile("git", ["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "conflicting tag fixture"], {
      cwd: tagConflict.repository,
      env: tagConflict.environment,
      encoding: "utf8",
    })).stdout.trim();
    await execFile("git", ["push", tagConflict.bareRemote, `${otherCommit}:refs/tags/codex-v1.2.4`], {
      cwd: tagConflict.repository,
      env: tagConflict.environment,
    });
    await assertPublisherRejects(tagConflict, "codex-v1.2.4", /different source commit/u);
    assert.equal((await readJSON(join(tagConflict.releaseDirectory, "publication-record.json"))).overall_status, "blocked");
    await assertRemoteMutationCount(tagConflict, 0, otherCommit);

    const draftConflict = await createScenario(root, template, "draft-conflict", {
      gh: {
        release: {
          tagName: "codex-v1.2.4",
          isDraft: true,
          isPrerelease: false,
          targetCommitish: "f".repeat(40),
          id: 701,
          url: "https://github.example.invalid/releases/conflict",
          assets: [],
        },
      },
    });
    await assertPublisherRejects(draftConflict, "codex-v1.2.4", /conflicts with the exact draft/u);
    assert.equal((await readJSON(join(draftConflict.releaseDirectory, "publication-record.json"))).overall_status, "blocked");
    assert.equal((await callLog(draftConflict)).some((entry) => entry.result === "release-create"), false);

    const publishedConflict = await createScenario(root, template, "published-release-conflict", {
      gh: {
        release: {
          tagName: "codex-v1.2.4",
          isDraft: false,
          isPrerelease: false,
          targetCommitish: template.sourceCommit,
          id: 702,
          url: "https://github.example.invalid/releases/published-conflict",
          assets: [],
        },
      },
    });
    await assertPublisherRejects(publishedConflict, "codex-v1.2.4", /public GitHub Release exists without the exact verified npm version/u);
    assert.equal((await callLog(publishedConflict)).some((entry) => entry.tool === "npm" && entry.argv[0] === "publish"), false);
    assert.equal((await callLog(publishedConflict)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);

    const registryConflict = await createScenario(root, template, "registry-conflict", {
      npm: { corrupt_readback: true },
    });
    await assertPublisherRejects(registryConflict, "codex-v1.2.4", /registry tarball differs|npm tarball contains/u);
    assert.equal((await readJSON(registryConflict.npmStatePath)).publish_count, 1);
    await assertPublisherRejects(registryConflict, "codex-v1.2.4", /registry tarball differs|npm tarball contains/u);
    assert.equal((await readJSON(registryConflict.npmStatePath)).publish_count, 1);
  });

  await t.test("asset upload record loss resumes exactly and keeps the Release draft", async () => {
    const scenario = await createScenario(root, template, "asset-record-loss");
    assert.equal((await runPublisher(scenario, "codex-v1.2.4")).status, "npm_verified");
    await markTestLocalJourneyPassed(scenario);
    const ghState = await readJSON(scenario.ghStatePath);
    ghState.fail_after_upload_name = "SHA256SUMS";
    await writeJSON(scenario.ghStatePath, ghState);

    await assertPublisherRejects(scenario, "codex-v1.2.4", /fixture process failed after immutable asset upload/u);
    let observedGH = await readJSON(scenario.ghStatePath);
    assert.equal(observedGH.release.assets.some((asset) => asset.name === "SHA256SUMS"), true);
    const failed = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(failed.steps[6].status, "failed");

    const resumed = await runPublisher(scenario, "codex-v1.2.4");
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
    await runPublisher(conflict, "codex-v1.2.4");
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
    await assertPublisherRejects(conflict, "codex-v1.2.4", /conflicting bytes/u);
    const conflictCalls = await callLog(conflict);
    assert.equal(conflictCalls.some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "upload" && entry.argv[3].endsWith("SHA256SUMS")), false);

    const readback = await createScenario(root, template, "asset-readback-conflict");
    await runPublisher(readback, "codex-v1.2.4");
    await markTestLocalJourneyPassed(readback);
    const readbackState = await readJSON(readback.ghStatePath);
    readbackState.corrupt_download_name = "SHA256SUMS";
    await writeJSON(readback.ghStatePath, readbackState);
    await assertPublisherRejects(readback, "codex-v1.2.4", /read-back differs/u);
    const blocked = await readJSON(join(readback.releaseDirectory, "publication-record.json"));
    assert.equal(blocked.overall_status, "blocked");
    assert.equal(blocked.github.published, false);
    assert.equal((await callLog(readback)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);
  });

  await t.test("missing final journey lifecycle gate blocks before GitHub finalization", async () => {
    const scenario = await createScenario(root, template, "missing-final-gate", {
      gh: { fail_finalize: false },
    });
    await markTestLocalJourneyPassed(scenario);
    scenario.finalJourneyEvidence.remove_readback_passed = false;
    scenario.stopBeforeFinalize = false;
    await assertPublisherRejects(scenario, "codex-v1.2.4", /remove_readback_passed must be true/u);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(record.overall_status, "blocked");
    assert.equal(record.steps[5].status, "blocked");
    assert.equal(record.steps[5].error_code, "FINAL_JOURNEY_INVALID");
    assert.equal((await callLog(scenario)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);
  });

  await t.test("finalization command failure leaves the exact release draft and records the failed gate", async () => {
    const scenario = await createScenario(root, template, "finalize-command-failure");
    await markTestLocalJourneyPassed(scenario);
    scenario.stopBeforeFinalize = false;
    await assertPublisherRejects(scenario, "codex-v1.2.4", /fixture finalization refused/u);
    const remote = await readJSON(scenario.ghStatePath);
    assert.equal(remote.release.isDraft, true);
    assert.equal(remote.release.assets.length, 4);
    const record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(record.overall_status, "failed");
    assert.equal(record.steps[8].status, "failed");
    assert.equal(record.github.published, false);
    const edits = (await callLog(scenario)).filter((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit");
    assert.equal(edits.length, 1);
  });

  await t.test("finalization retry reuses the passed journey and final manifest", async () => {
    const scenario = await createScenario(root, template, "finalize-reuses-journey");
    await markTestLocalJourneyPassed(scenario);
    scenario.stopBeforeFinalize = false;
    await assertPublisherRejects(scenario, "codex-v1.2.4", /fixture finalization refused/u);
    const manifestBefore = await readFile(join(scenario.releaseDirectory, "release-manifest.json"));
    assert.equal(scenario.finalJourneyRunCount, 1);

    const remote = await readJSON(scenario.ghStatePath);
    remote.fail_finalize = false;
    await writeJSON(scenario.ghStatePath, remote);
    const resumed = await runPublisher(scenario, "codex-v1.2.4");

    assert.equal(resumed.status, "complete");
    assert.equal(scenario.finalJourneyRunCount, 1);
    assert.deepEqual(
      await readFile(join(scenario.releaseDirectory, "release-manifest.json")),
      manifestBefore,
    );
  });

  await t.test("remote finalization record loss resumes from the exact public release without a second edit", async () => {
    const scenario = await createScenario(root, template, "finalize-record-loss", {
      gh: { fail_finalize: false, fail_after_finalize: true },
    });
    await markTestLocalJourneyPassed(scenario);
    scenario.stopBeforeFinalize = false;
    await assertPublisherRejects(scenario, "codex-v1.2.4", /process failed after immutable release finalization/u);
    let remote = await readJSON(scenario.ghStatePath);
    assert.equal(remote.release.isDraft, false);
    assert.equal(remote.release.assets.length, 4);
    let record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(record.overall_status, "failed");
    assert.equal(record.steps[8].status, "failed");

    const resumed = await runPublisher(scenario, "codex-v1.2.4");
    assert.equal(resumed.status, "complete");
    assert.equal(resumed.mutated, false);
    assert.equal(resumed.github_release_draft, false);
    assert.equal(resumed.next_incomplete_step, null);
    remote = await readJSON(scenario.ghStatePath);
    record = await readJSON(join(scenario.releaseDirectory, "publication-record.json"));
    assert.equal(remote.release.isDraft, false);
    assert.equal(record.overall_status, "complete");
    assert.equal(record.github.published, true);
    assert.equal(record.github.draft, false);
    assert.equal(record.steps[8].status, "complete");
    const edits = (await callLog(scenario)).filter((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit");
    assert.equal(edits.length, 1);

    remote.release.assets = remote.release.assets.filter((asset) => asset.name !== "SHA256SUMS");
    await writeJSON(scenario.ghStatePath, remote);
    await assertPublisherRejects(scenario, "codex-v1.2.4", /published GitHub Release is missing immutable asset SHA256SUMS/u);
    assert.equal((await callLog(scenario)).filter((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit").length, 1);
  });

  await t.test("public Release identity conflict blocks without finalization", async () => {
    const scenario = await createScenario(root, template, "public-identity-conflict", {
      gh: {
        fail_finalize: false,
        release: {
          tagName: "codex-v1.2.4",
          isDraft: false,
          isPrerelease: false,
          targetCommitish: "f".repeat(40),
          id: 880,
          url: "https://github.example.invalid/releases/public-conflict",
          assets: [],
        },
      },
    });
    await markTestLocalJourneyPassed(scenario);
    scenario.stopBeforeFinalize = false;
    await assertPublisherRejects(scenario, "codex-v1.2.4", /conflicts with the exact draft\/source identity/u);
    assert.equal((await callLog(scenario)).some((entry) => entry.tool === "gh" && entry.argv[0] === "release" && entry.argv[1] === "edit"), false);
  });
});

async function createPublisherTemplate(root) {
  const repository = join(root, "template-repository");
  await copyRepositoryFixture(repository);
  await updateFixtureVersion(repository, "1.2.4");
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
    verificationMode: "normal",
    basedOnRelease: "v0.5.0",
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
    expected_version: "1.2.4",
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
    fail_after_finalize: false,
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
  const readbackDelays = [];
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
    readbackDelays,
    finalJourneyEvidence: null,
    finalJourneyRunCount: 0,
    stopBeforeFinalize: true,
  };
}

async function runPublisher(scenario, confirmation = null) {
  return runPublicationStateMachine({
    directory: scenario.releaseDirectory,
    confirmation,
    repositoryRoot: scenario.repository,
    environment: scenario.environment,
    runtime: {
      stopAfterNPM: scenario.finalJourneyEvidence === null,
      stopBeforeFinalize: scenario.stopBeforeFinalize,
      allowFixtureJourney: true,
      delay: async (milliseconds) => scenario.readbackDelays.push(milliseconds),
      runFinalJourney: async (_context, _manifest, record) => {
        scenario.finalJourneyRunCount += 1;
        return {
          ...structuredClone(scenario.finalJourneyEvidence),
          npm_integrity: record.npm.integrity,
        };
      },
    },
  });
}

async function assertPublisherRejects(scenario, confirmation, pattern) {
  await assert.rejects(
    runPublisher(scenario, confirmation),
    (error) => {
      assert.match(String(error.stderr ?? error.message), pattern);
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

async function publisherFailure(scenario, confirmation) {
  try {
    await execFile(join(scenario.repository, "scripts", "publish-codex-release.mjs"), [
      "--directory", scenario.releaseDirectory,
      "--confirm", confirmation,
    ], {
      cwd: scenario.repository,
      env: scenario.environment,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
    });
    assert.fail("publisher unexpectedly succeeded");
  } catch (error) {
    if (error?.code === "ERR_ASSERTION") throw error;
    return {
      code: error.code,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? ""),
    };
  }
}

async function markTestLocalJourneyPassed(scenario) {
  const manifest = await readJSON(join(scenario.releaseDirectory, "release-manifest.json"));
  const packageArtifact = manifest.artifacts.find((artifact) => artifact.kind === "npm_tarball");
  const coreArtifact = manifest.artifacts.find((artifact) => artifact.kind === "core_binary");
  scenario.finalJourneyEvidence = {
    evidence_kind: FINAL_FIXTURE_EVIDENCE_KIND,
    status: "passed",
    package_name: "dev-flow-codex",
    package_version: manifest.release.version,
    registry: "https://registry.npmjs.org/",
    npm_tarball_sha256: packageArtifact.sha256,
    npm_integrity: `sha512-${Buffer.alloc(64, 11).toString("base64")}`,
    package_root_location: "isolated-npm-prefix",
    core_version: manifest.release.core_version,
    core_sha256: coreArtifact.sha256,
    source_commit: manifest.release.source_commit,
    codex_version: "0.147.0",
    compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
    codex_compatible: true,
    setup_readback_passed: true,
    ordinary_prompt_core_call_count: 0,
    explicit_selector: EXPLICIT_SELECTOR,
    task_id_before_restart: "task-fixture-finalization",
    task_revision_before_restart: 4,
    task_action_id_before_restart: "action-fixture-4",
    task_id_after_restart: "task-fixture-finalization",
    task_revision_after_restart: 4,
    task_action_id_after_restart: "action-fixture-4",
    committed_action_count: 4,
    terminal_outcome: "DONE",
    remove_readback_passed: true,
    npm_uninstall_passed: true,
    task_data_retained: true,
    task_reopened_after_uninstall: true,
    unexpected_repository_paths: [],
    observed_at: "2026-08-17T06:30:00.000Z",
  };
}

async function assertRemoteMutationCount(scenario, expected, expectedTagTarget = null) {
  const calls = await callLog(scenario);
  const mutations = remoteMutations(calls);
  assert.equal(mutations.length, expected);
  assert.equal(await remoteTagTarget(scenario), expectedTagTarget);
}

function remoteMutations(calls) {
  return calls.filter((entry) =>
    entry.tool === "npm" && entry.argv[0] === "publish" ||
    entry.tool === "gh" && entry.argv[0] === "release" && ["create", "upload", "edit"].includes(entry.argv[1]),
  );
}

async function remoteTagTarget(scenario) {
  const { stdout } = await execFile("git", ["ls-remote", "--tags", scenario.bareRemote, "refs/tags/codex-v1.2.4"], {
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

async function updateFixtureVersion(sourceRoot, version) {
  const manifest = JSON.parse(await readFile(join(sourceRoot, "packages/codex/package.json"), "utf8"));
  const previousVersion = manifest.version;
  for (const path of [
    "packages/codex/package.json",
    "packages/codex/plugin/.codex-plugin/plugin.json",
  ]) {
    const absolute = join(sourceRoot, path);
    const contents = await readFile(absolute, "utf8");
    const updated = contents.replace(`"version": "${previousVersion}"`, `"version": "${version}"`);
    assert.notEqual(updated, contents, `${path} fixture version did not change`);
    await writeFile(absolute, updated);
  }
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
