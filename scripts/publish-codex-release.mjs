#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  buildSupportMatrixFromFinalJourney,
  inspectPackageTarball,
  rewriteChecksums,
  scanStructuredContent,
  validateManifest,
  validatePublicationRecord,
  verifyReleaseDirectory,
  writeJSONAtomic,
} from "./verify-codex-release.mjs";
import {
  FINAL_FIXTURE_EVIDENCE_KIND,
  validateFinalJourneyEvidence,
  validateFinalJourneyEvidenceShape,
} from "./write-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
const REPOSITORY = "Innocent-children/dev-flow";
const COMMAND_TIMEOUT = 10_000;
const COMMAND_BUFFER = 256 * 1024;
const READBACK_ATTEMPTS = 10;
const READBACK_DELAY_MS = 2_000;
const STEP_NAMES = [
  "preflight",
  "tag",
  "github_draft",
  "npm_publish",
  "npm_readback",
  "final_journey",
  "github_upload",
  "github_readback",
  "github_finalize",
];

class PublicationError extends Error {
  constructor(code, message, { blocked = false, step = "preflight" } = {}) {
    super(message);
    this.code = code;
    this.blocked = blocked;
    this.step = step;
  }
}

export async function runPublisher({
  directory,
  confirmation = null,
  repositoryRoot = repositoryRootFromModule(),
  environment = process.env,
  runtime = null,
} = {}) {
  const execution = runtime ?? productionPublicationRuntime();
  const root = await canonicalRepositoryRoot(repositoryRoot);
  const releaseDirectory = await canonicalReleaseDirectory(directory);
  const verified = await verifyReleaseDirectory({
    directory: releaseDirectory,
    repositoryRoot: root,
    requirePrepared: false,
  });
  const manifestPath = join(releaseDirectory, "release-manifest.json");
  const recordPath = join(releaseDirectory, "publication-record.json");
  let manifest = verified.manifest;
  let record = verified.publication;
  const context = {
    root,
    releaseDirectory,
    manifestPath,
    recordPath,
    version: verified.version,
    tag: `v${verified.version}`,
    sourceCommit: verified.source_commit,
    sourceTree: verified.source_tree,
    tarballPath: join(releaseDirectory, `dev-flow-codex-${verified.version}.tgz`),
    corePath: join(releaseDirectory, `dev-flow-${verified.version}-darwin-arm64`),
    tarballSHA256: verified.tarball_sha256,
    environment,
    remoteMutated: false,
    reusedRemoteState: new Set(),
    execution,
  };

  try {
    await validateCurrentSource(context);
    const remote = await observeRemoteState(context, manifest, record);
    record.last_observed_at = now();
    record.safe_next_action = confirmation === context.tag
      ? "Continue only exact missing publication steps after rereading remote state."
      : `Rerun with exact confirmation ${context.tag} after reviewing the read-only preflight.`;
    await checkpoint(recordPath, record, manifest, context);

    if (confirmation === null) {
      return publisherSummary(record, context, { mode: "read-only-preflight" });
    }
    if (confirmation !== context.tag) {
      throw new PublicationError(
        "CONFIRMATION_MISMATCH",
        `confirmation must equal ${context.tag}`,
        { blocked: true, step: "preflight" },
      );
    }

    await ensureExactTag(context, record, remote.tagTarget);
    await ensureExactDraft(context, record);
    await ensurePublishedNPM(context, record, manifest);

    if (execution.stopAfterNPM === true) {
      record.safe_next_action = "Run the later authorized final registry-package journey; GitHub Release remains draft.";
      record.last_observed_at = now();
      await checkpoint(recordPath, record, manifest, context);
      return publisherSummary(record, context, { mode: "confirmed-fixture-publication" });
    }

    const journeyEvidence = await ensureFinalJourney(context, manifest, record);
    ({ manifest, record } = await prepareFinalManifest(context, manifest, record, journeyEvidence));
    await ensureExactAssets(context, manifest, record);
    if (execution.stopBeforeFinalize === true) {
      record.safe_next_action = "All fixture assets are verified; keep the GitHub Release draft until the later finalization gate.";
      record.last_observed_at = now();
      await checkpoint(recordPath, record, manifest, context);
      return publisherSummary(record, context, { mode: "confirmed-fixture-assets" });
    }
    await ensureExactFinalization(context, manifest, record);
    return publisherSummary(record, context, { mode: "confirmed-release-finalization" });
  } catch (error) {
    const publicationError = error instanceof PublicationError
      ? error
      : new PublicationError("PUBLICATION_STEP_FAILED", boundedMessage(error), { step: error?.step ?? "preflight" });
    const step = record.steps.find((candidate) => candidate.name === publicationError.step) ?? record.steps[0];
    step.status = publicationError.blocked ? "blocked" : "failed";
    step.error_code = publicationError.code;
    step.summary = boundedMessage(publicationError);
    step.safe_next_action = publicationError.blocked
      ? "Resolve the conflicting immutable remote state manually, then rerun read-only preflight."
      : "Rerun the publisher; it will reread remote state before any further mutation.";
    record.overall_status = publicationError.blocked ? "blocked" : "failed";
    record.last_observed_at = now();
    record.safe_next_action = step.safe_next_action;
    await checkpoint(recordPath, record, manifest, context).catch(() => {});
    throw publicationError;
  }
}

function productionPublicationRuntime() {
  return {
    stopAfterNPM: false,
    stopBeforeFinalize: false,
    allowFixtureJourney: false,
    runFinalJourney: runProductionFinalJourney,
  };
}

async function runProductionFinalJourney(context, manifest) {
  const coreArtifact = manifest.artifacts.find((artifact) => artifact.kind === "core_binary");
  if (!coreArtifact) throw new Error("final journey requires the verified Core artifact identity");
  const codexExecutable = await findExecutableInEnvironment("codex", context.environment);
  const root = await mkdtemp(join(tmpdir(), "dev-flow-publisher-final-journey-"));
  try {
    const workspace = join(root, "workspace");
    const resultDirectory = join(root, "result");
    await Promise.all([
      mkdir(workspace, { mode: 0o700 }),
      mkdir(resultDirectory, { mode: 0o700 }),
    ]);
    const runner = join(context.root, "scripts", "run-codex-real-journey.sh");
    const stdout = await runText(runner, [
      "--final-registry",
      "--package", "dev-flow-codex",
      "--version", context.version,
      "--registry", OFFICIAL_REGISTRY,
      "--tarball-sha256", context.tarballSHA256,
      "--core-sha256", coreArtifact.sha256,
      "--source-commit", context.sourceCommit,
      "--codex-executable", codexExecutable,
      "--workspace", workspace,
      "--result-directory", resultDirectory,
    ], context, { cwd: root, timeout: 30 * 60_000 });
    const names = await readdir(resultDirectory);
    if (stableJSON(names.sort()) !== stableJSON(["final-journey-evidence.json"])) {
      throw new Error("final journey result directory does not contain the exact evidence file");
    }
    const evidencePath = join(resultDirectory, "final-journey-evidence.json");
    const info = await stat(evidencePath);
    if (!info.isFile() || info.size > 64 * 1024) throw new Error("final journey evidence file is missing or unbounded");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    const emitted = JSON.parse(stdout);
    if (stableJSON(emitted) !== stableJSON(evidence)) {
      throw new Error("final journey stdout differs from the closed evidence file");
    }
    return validateFinalJourneyEvidence(evidence, {
      expected: {
        packageName: "dev-flow-codex",
        version: context.version,
        registry: OFFICIAL_REGISTRY,
        tarballSHA256: context.tarballSHA256,
        coreSHA256: coreArtifact.sha256,
        sourceCommit: context.sourceCommit,
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function findExecutableInEnvironment(name, environment) {
  for (const directory of String(environment?.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = resolve(directory, name);
    try {
      const info = await stat(candidate);
      if (info.isFile() && (info.mode & 0o111) !== 0) return realpath(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  throw new Error(`final journey requires ${name} on the closed publisher PATH`);
}

async function validateCurrentSource(context) {
  const branch = await runText("git", ["symbolic-ref", "--short", "HEAD"], context, { cwd: context.root });
  if (branch !== "main") throw new PublicationError("SOURCE_BRANCH_CONFLICT", "publisher requires branch main", { blocked: true });
  const status = await runText("git", ["status", "--porcelain"], context, { cwd: context.root });
  if (status !== "") throw new PublicationError("SOURCE_DIRTY", "publisher requires a clean source checkout", { blocked: true });
  const commit = await runText("git", ["rev-parse", "HEAD"], context, { cwd: context.root });
  const tree = await runText("git", ["rev-parse", "HEAD^{tree}"], context, { cwd: context.root });
  if (commit !== context.sourceCommit || tree !== context.sourceTree) throw new PublicationError("SOURCE_IDENTITY_CONFLICT", "current source commit/tree differs from the prepared release", { blocked: true });
}

async function observeRemoteState(context, manifest, record) {
  await runText("npm", ["--version"], context);
  const account = await runText("npm", ["whoami", `--registry=${OFFICIAL_REGISTRY}`], context);
  if (!account || account.length > 128) throw new PublicationError("NPM_IDENTITY_INVALID", "npm account identity is missing or unbounded", { blocked: true });

  const packageView = await runAllowFailure("npm", [
    "view", "dev-flow-codex", "name", "version", "maintainers", "dist-tags", "--json", `--registry=${OFFICIAL_REGISTRY}`,
  ], context);
  if (packageView.code === 0) {
    const owners = await runText("npm", ["owner", "ls", "dev-flow-codex", `--registry=${OFFICIAL_REGISTRY}`], context);
    const ownerNames = owners.split("\n").map((line) => line.trim().split(/\s+</u)[0]).filter(Boolean);
    if (!ownerNames.includes(account)) throw new PublicationError("NPM_OWNERSHIP_CONFLICT", "authenticated npm account is not an owner of the fixed package", { blocked: true });
  } else if (!isNotFound(packageView)) {
    throw commandFailure("NPM_PACKAGE_OBSERVATION_FAILED", packageView, "preflight");
  }

  await runText("gh", ["--version"], context);
  await runText("gh", ["auth", "status", "-h", "github.com"], context);
  const permissions = JSON.parse(await runText("gh", [
    "api", `repos/${REPOSITORY}`, "--jq", "{push:.permissions.push,maintain:.permissions.maintain,admin:.permissions.admin}",
  ], context));
  if (!permissions.push || (!permissions.maintain && !permissions.admin)) throw new PublicationError("GITHUB_PERMISSION_CONFLICT", "GitHub repository permissions are insufficient", { blocked: true });
  record.steps[0].summary = "Authenticated npm identity/ownership and GitHub repository permissions were observed through bounded read-only commands.";
  record.last_observed_at = now();
  await checkpoint(context.recordPath, record, manifest, context);

  const tagTarget = await observeTagTarget(context);
  if (tagTarget !== null && tagTarget !== context.sourceCommit) throw new PublicationError("TAG_TARGET_CONFLICT", "remote tag points to a different source commit", { blocked: true, step: "tag" });
  if (record.github.tag_target !== null && tagTarget === null) throw new PublicationError("TAG_DISAPPEARED", "previously recorded exact remote tag is now absent", { blocked: true, step: "tag" });
  if (record.github.tag_target !== null && tagTarget !== record.github.tag_target) throw new PublicationError("TAG_RECORD_CONFLICT", "remote tag differs from the recorded immutable target", { blocked: true, step: "tag" });
  record.github.tag_target = tagTarget;
  if (tagTarget !== null) context.reusedRemoteState.add("tag");
  record.last_observed_at = now();
  await checkpoint(context.recordPath, record, manifest, context);

  const release = await observeRelease(context);
  validateObservedRelease(context, release);
  if (record.github.release_id !== null && release === null) throw new PublicationError("GITHUB_DRAFT_DISAPPEARED", "previously recorded GitHub draft is now absent", { blocked: true, step: "github_draft" });
  if (record.github.release_id !== null && release !== null && release.id !== record.github.release_id) throw new PublicationError("GITHUB_DRAFT_RECORD_CONFLICT", "GitHub draft identity differs from the recorded release", { blocked: true, step: "github_draft" });
  if (record.github.published === true && release?.isDraft === true) {
    throw new PublicationError("GITHUB_RELEASE_STATE_CONFLICT", "previously published GitHub Release is observed as a draft", { blocked: true, step: "github_draft" });
  }
  if (release !== null) {
    context.reusedRemoteState.add(release.isDraft ? "github_draft" : "github_release");
    record.github.release_id = release.id;
    record.github.draft = release.isDraft;
    record.github.published = !release.isDraft;
  }
  record.last_observed_at = now();
  await checkpoint(context.recordPath, record, manifest, context);

  const exactNPM = await observeExactNPM(context, { delayed: false });
  const npmReadback = exactNPM === null ? null : await verifyRegistryTarball(context, exactNPM, manifest);
  if (exactNPM !== null && (tagTarget === null || release === null)) {
    throw new PublicationError("REMOTE_SEQUENCE_CONFLICT", "existing npm version lacks the required exact Tag or GitHub draft provenance", { blocked: true, step: "preflight" });
  }
  if (release !== null && !release.isDraft && exactNPM === null) {
    throw new PublicationError("PUBLIC_RELEASE_SEQUENCE_CONFLICT", "public GitHub Release exists without the exact verified npm version", { blocked: true, step: "preflight" });
  }
  if (release !== null) {
    const allowedAssets = new Set([
      `dev-flow-${context.version}-darwin-arm64`,
      `dev-flow-codex-${context.version}.tgz`,
      "release-manifest.json",
      "SHA256SUMS",
    ]);
    if (release.assets.some((asset) => !allowedAssets.has(asset.name))) {
      throw new PublicationError("GITHUB_ASSET_CONFLICT", "GitHub draft contains an unrecognized asset name", { blocked: true, step: "github_draft" });
    }
  }
  if (exactNPM !== null) {
    context.reusedRemoteState.add("npm_package");
    record.npm.published = true;
    record.npm.verified = true;
    record.npm.integrity = exactNPM.integrity;
    record.npm.tarball_sha256 = npmReadback.sha256;
  }
  record.last_observed_at = now();
  await checkpoint(context.recordPath, record, manifest, context);
  return { account, tagTarget, release, exactNPM, npmReadback };
}

async function ensureExactTag(context, record, observedTarget) {
  const step = startStep(record, "tag");
  step.summary = observedTarget === null ? "Remote tag absent; exact creation is authorized." : "Exact remote tag observed and reusable.";
  await checkpoint(context.recordPath, record, await readManifest(context.manifestPath), context);
  if (observedTarget === null) {
    const local = await runAllowFailure("git", ["rev-parse", `refs/tags/${context.tag}`], context, { cwd: context.root });
    if (local.code === 0 && local.stdout.trim() !== context.sourceCommit) throw new PublicationError("LOCAL_TAG_CONFLICT", "local tag points to another commit", { blocked: true, step: "tag" });
    if (local.code !== 0) await runText("git", ["tag", context.tag, context.sourceCommit], context, { cwd: context.root });
    await runText("git", ["push", "origin", `refs/tags/${context.tag}:refs/tags/${context.tag}`], context, { cwd: context.root });
    context.remoteMutated = true;
  }
  const target = await observeTagTarget(context);
  if (target !== context.sourceCommit) throw new PublicationError("TAG_READBACK_CONFLICT", "tag read-back does not match prepared source", { blocked: true, step: "tag" });
  record.github.tag_target = target;
  completeStep(step, { remoteID: context.tag, summary: "Exact tag target verified." });
  record.overall_status = "remote_initialized";
  await checkpoint(context.recordPath, record, await readManifest(context.manifestPath), context);
}

async function ensureExactDraft(context, record) {
  const step = startStep(record, "github_draft");
  let release = await observeRelease(context);
  validateObservedRelease(context, release);
  await checkpoint(context.recordPath, record, await readManifest(context.manifestPath), context);
  if (release === null) {
    await runText("gh", [
      "release", "create", context.tag,
      "--repo", REPOSITORY,
      "--draft",
      "--title", `Dev Flow ${context.tag}`,
      "--notes", "Prepared release; final registry-package journey remains pending.",
      "--target", context.sourceCommit,
    ], context);
    context.remoteMutated = true;
    release = await observeRelease(context);
  }
  validateObservedRelease(context, release, { required: true });
  record.github.release_id = release.id;
  record.github.draft = release.isDraft;
  record.github.published = !release.isDraft;
  completeStep(step, {
    remoteID: String(release.id),
    summary: release.isDraft
      ? "Exact GitHub draft verified and remains unpublished."
      : "Exact already-published GitHub Release verified for finalization record recovery.",
  });
  await checkpoint(context.recordPath, record, await readManifest(context.manifestPath), context);
}

async function ensurePublishedNPM(context, record, manifest) {
  const publishStep = startStep(record, "npm_publish");
  let observed = await observeExactNPM(context, { delayed: false });
  await checkpoint(context.recordPath, record, manifest, context);
  if (observed === null && !record.npm.published) {
    await runText("npm", [
      "publish", context.tarballPath,
      "--access", "public",
      `--registry=${OFFICIAL_REGISTRY}`,
    ], context);
    context.remoteMutated = true;
    record.npm.published = true;
    completeStep(publishStep, {
      remoteID: `dev-flow-codex@${context.version}`,
      observedSHA256: context.tarballSHA256,
      summary: "Verified local tarball was published once; registry read-back remains required.",
    });
    record.overall_status = "npm_published";
    await checkpoint(context.recordPath, record, manifest, context);
  } else if (observed === null) {
    completeStep(publishStep, {
      remoteID: `dev-flow-codex@${context.version}`,
      observedSHA256: context.tarballSHA256,
      summary: "Prior npm publish is recorded; registry visibility is pending and publish was not called again.",
    });
    record.overall_status = "npm_published";
    await checkpoint(context.recordPath, record, manifest, context);
  } else {
    await verifyRegistryTarball(context, observed, manifest);
    record.npm.published = true;
    completeStep(publishStep, {
      remoteID: `dev-flow-codex@${context.version}`,
      observedSHA256: context.tarballSHA256,
      summary: "Exact existing npm version was reread and reused; publish was not called.",
    });
    await checkpoint(context.recordPath, record, manifest, context);
  }

  const readbackStep = startStep(record, "npm_readback");
  observed = null;
  for (let attempt = 0; attempt < READBACK_ATTEMPTS; attempt += 1) {
    observed = await observeExactNPM(context, { delayed: true });
    record.last_observed_at = now();
    readbackStep.summary = observed === null ? `Registry read-back pending after bounded attempt ${attempt + 1}.` : "Registry version metadata observed.";
    await checkpoint(context.recordPath, record, manifest, context);
    if (observed !== null) break;
    if (attempt + 1 < READBACK_ATTEMPTS) {
      await (context.execution.delay ?? delay)(READBACK_DELAY_MS);
    }
  }
  if (observed === null) throw new PublicationError("NPM_READBACK_TIMEOUT", "registry version was not visible within the bounded read-back window", { step: "npm_readback" });
  const readback = await verifyRegistryTarball(context, observed, manifest);
  record.npm.published = true;
  record.npm.verified = true;
  record.npm.integrity = observed.integrity;
  record.npm.tarball_sha256 = readback.sha256;
  completeStep(readbackStep, {
    remoteID: `dev-flow-codex@${context.version}`,
    observedSHA256: readback.sha256,
    summary: "Registry tarball bytes and normalized package/Core identity match the prepared artifact.",
  });
  record.overall_status = "npm_verified";
  await checkpoint(context.recordPath, record, manifest, context);
}

async function verifyRegistryTarball(context, observed, manifest) {
  const downloadRoot = await mkdtemp(join(tmpdir(), "dev-flow-registry-readback-"));
  try {
    const stdout = await runText("npm", [
      "pack", `dev-flow-codex@${context.version}`,
      "--pack-destination", downloadRoot,
      "--ignore-scripts",
      "--json",
      `--registry=${OFFICIAL_REGISTRY}`,
    ], context);
    const result = JSON.parse(stdout);
    const filename = result?.[0]?.filename;
    if (typeof filename !== "string" || basename(filename) !== filename) throw new PublicationError("NPM_READBACK_INVALID", "npm pack returned an invalid filename", { blocked: true, step: "npm_readback" });
    const downloaded = join(downloadRoot, filename);
    const inspected = await inspectPackageTarball(downloaded, { repositoryRoot: context.root, version: context.version });
    if (inspected.tarballSHA256 !== context.tarballSHA256 || stableJSON(inspected.files) !== stableJSON(manifest.package_files)) throw new PublicationError("NPM_READBACK_DIGEST_CONFLICT", "registry tarball differs from the prepared bytes/tree", { blocked: true, step: "npm_readback" });
    if (observed.version !== context.version || typeof observed.integrity !== "string") throw new PublicationError("NPM_READBACK_IDENTITY_CONFLICT", "registry metadata differs from the exact version contract", { blocked: true, step: "npm_readback" });
    return { sha256: inspected.tarballSHA256 };
  } finally {
    await rm(downloadRoot, { recursive: true, force: true });
  }
}

async function ensureFinalJourney(context, manifest, record) {
  const step = startStep(record, "final_journey");
  if (!record.npm.published || !record.npm.verified || record.npm.tarball_sha256 !== context.tarballSHA256) {
    throw new PublicationError("FINAL_JOURNEY_GATE", "final registry-package journey requires exact npm read-back", { blocked: true, step: "final_journey" });
  }
  if (typeof context.execution.runFinalJourney !== "function") {
    throw new PublicationError("FINAL_JOURNEY_RUNNER_UNAVAILABLE", "final registry-package journey runner is unavailable", { blocked: true, step: "final_journey" });
  }
  const coreArtifact = manifest.artifacts.find((artifact) => artifact.kind === "core_binary");
  const expected = {
    packageName: "dev-flow-codex",
    version: context.version,
    registry: OFFICIAL_REGISTRY,
    tarballSHA256: context.tarballSHA256,
    npmIntegrity: record.npm.integrity,
    coreSHA256: coreArtifact?.sha256,
    sourceCommit: context.sourceCommit,
  };
  let observed;
  try {
    observed = await context.execution.runFinalJourney(context, manifest, record);
  } catch (error) {
    throw new PublicationError("FINAL_JOURNEY_FAILED", boundedMessage(error), { step: "final_journey" });
  }
  let evidence;
  try {
    evidence = context.execution.allowFixtureJourney === true
      ? validateFinalJourneyEvidenceShape(observed, { allowFixture: true, expected })
      : validateFinalJourneyEvidence(observed, { expected });
  } catch (error) {
    throw new PublicationError("FINAL_JOURNEY_INVALID", boundedMessage(error), { blocked: true, step: "final_journey" });
  }
  record.final_journey = {
    status: "passed",
    actual_codex_version: evidence.codex_version,
    observed_at: evidence.observed_at,
    summary: evidence.evidence_kind === FINAL_FIXTURE_EVIDENCE_KIND
      ? "Fixture-simulated journey facts passed only the fake finalization gate."
      : "Native registry-package journey passed setup, zero-trigger, restart/resume, DONE, removal, uninstall, and retained reopen.",
  };
  completeStep(step, {
    remoteID: evidence.evidence_kind,
    summary: record.final_journey.summary,
  });
  record.overall_status = "journey_passed";
  await checkpoint(context.recordPath, record, manifest, context);
  return evidence;
}

async function prepareFinalManifest(context, manifest, record, evidence) {
  const journeyStep = record.steps.find((step) => step.name === "final_journey");
  if (record.final_journey.status !== "passed" || journeyStep.status !== "complete" || !record.npm.verified) throw new PublicationError("FINAL_JOURNEY_GATE", "final manifest/assets require verified npm and a passed final journey record", { blocked: true, step: "final_journey" });
  const generatedSupport = evidence.evidence_kind === FINAL_FIXTURE_EVIDENCE_KIND
    ? [{
      os: "darwin",
      arch: "arm64",
      actual_codex_version: evidence.codex_version,
      compatible_codex_range: evidence.compatible_codex_range,
      package_sha256: evidence.npm_tarball_sha256,
      core_sha256: evidence.core_sha256,
      journey_result: "passed",
      journey_observed_at: evidence.observed_at,
      notes: "Fixture-simulated journey support exists only in isolated fake finalization tests.",
    }]
    : buildSupportMatrixFromFinalJourney({ manifest, evidence });
  const existingSupport = manifest.support[0];
  manifest.support = existingSupport.journey_result === "passed"
    && existingSupport.actual_codex_version === generatedSupport[0].actual_codex_version
    && existingSupport.package_sha256 === generatedSupport[0].package_sha256
    && existingSupport.core_sha256 === generatedSupport[0].core_sha256
    && existingSupport.notes === generatedSupport[0].notes
      ? [existingSupport]
      : generatedSupport;
  record.final_journey.actual_codex_version = manifest.support[0].actual_codex_version;
  record.final_journey.observed_at = manifest.support[0].journey_observed_at;
  const npmArtifact = manifest.artifacts.find((artifact) => artifact.kind === "npm_tarball");
  npmArtifact.npm_integrity = record.npm.integrity;
  manifest.validations = [
    ...manifest.validations.filter((validation) => validation.name !== "final-journey"),
    {
      name: "final-journey",
      status: "passed",
      summary: evidence.evidence_kind === FINAL_FIXTURE_EVIDENCE_KIND
        ? "Fixture-simulated journey passed the isolated fake finalization gate."
        : "Native registry-package journey passed every final lifecycle gate.",
    },
  ].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  validateManifest(manifest, { version: context.version, sourceCommit: context.sourceCommit, sourceTree: context.sourceTree });
  scanStructuredContent(manifest, { repositoryRoot: context.root });
  await writeJSONAtomic(context.manifestPath, manifest, 0o644);
  await rewriteChecksums(context.releaseDirectory, context.version);
  record.manifest_sha256 = await sha256File(context.manifestPath);
  record.overall_status = "journey_passed";
  record.last_observed_at = now();
  await checkpoint(context.recordPath, record, manifest, context);
  await verifyReleaseDirectory({ directory: context.releaseDirectory, repositoryRoot: context.root, requirePrepared: false });
  return { manifest, record };
}

async function ensureExactAssets(context, manifest, record) {
  const uploadStep = startStep(record, "github_upload");
  const assetNames = [
    `dev-flow-${context.version}-darwin-arm64`,
    `dev-flow-codex-${context.version}.tgz`,
    "release-manifest.json",
    "SHA256SUMS",
  ].sort();
  const expected = new Map();
  for (const name of assetNames) expected.set(name, await sha256File(join(context.releaseDirectory, name)));
  let release = await observeRelease(context);
  validateObservedRelease(context, release, { required: true });
  for (const name of assetNames) {
    const existing = release.assets.find((asset) => asset.name === name);
    if (existing) {
      const digest = await downloadAssetDigest(context, name);
      if (digest !== expected.get(name)) throw new PublicationError("GITHUB_ASSET_CONFLICT", `GitHub asset ${name} has conflicting bytes`, { blocked: true, step: "github_upload" });
      continue;
    }
    if (!release.isDraft) {
      throw new PublicationError("GITHUB_PUBLIC_ASSET_MISSING", `published GitHub Release is missing immutable asset ${name}`, { blocked: true, step: "github_upload" });
    }
    await runText("gh", ["release", "upload", context.tag, join(context.releaseDirectory, name), "--repo", REPOSITORY], context);
    context.remoteMutated = true;
    release = await observeRelease(context);
    validateObservedRelease(context, release, { required: true });
    await checkpoint(context.recordPath, record, manifest, context);
  }
  completeStep(uploadStep, { remoteID: String(release.id), summary: "All four immutable assets are present without overwrite." });
  record.overall_status = "assets_uploaded";
  await checkpoint(context.recordPath, record, manifest, context);

  const readbackStep = startStep(record, "github_readback");
  const assets = [];
  release = await observeRelease(context);
  validateObservedRelease(context, release, { required: true });
  for (const name of assetNames) {
    const remote = release.assets.find((asset) => asset.name === name);
    if (!remote) throw new PublicationError("GITHUB_ASSET_MISSING", `GitHub asset ${name} is missing after upload`, { step: "github_readback" });
    const digest = await downloadAssetDigest(context, name);
    if (digest !== expected.get(name)) throw new PublicationError("GITHUB_ASSET_READBACK_CONFLICT", `GitHub asset ${name} read-back differs`, { blocked: true, step: "github_readback" });
    assets.push({ name, asset_id: remote.id, sha256: digest, verified: true });
    record.github.assets = [...assets].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    await checkpoint(context.recordPath, record, manifest, context);
  }
  completeStep(readbackStep, { remoteID: String(release.id), summary: "All four GitHub asset downloads match their immutable local bytes." });
  record.overall_status = "assets_verified";
  record.github.draft = release.isDraft;
  record.github.published = !release.isDraft;
  await checkpoint(context.recordPath, record, manifest, context);
}

async function ensureExactFinalization(context, manifest, record) {
  const step = startStep(record, "github_finalize");
  await validateCurrentSource(context);
  const tagTarget = await observeTagTarget(context);
  if (tagTarget !== context.sourceCommit) {
    throw new PublicationError("FINALIZATION_TAG_CONFLICT", "finalization Tag read-back differs from the frozen source", { blocked: true, step: "github_finalize" });
  }
  const npmMetadata = await observeExactNPM(context, { delayed: false });
  if (npmMetadata === null) {
    throw new PublicationError("FINALIZATION_NPM_MISSING", "finalization npm read-back is missing", { blocked: true, step: "github_finalize" });
  }
  const npmReadback = await verifyRegistryTarball(context, npmMetadata, manifest);
  if (npmReadback.sha256 !== context.tarballSHA256 || npmMetadata.integrity !== record.npm.integrity) {
    throw new PublicationError("FINALIZATION_NPM_CONFLICT", "finalization npm read-back differs from the verified package identity", { blocked: true, step: "github_finalize" });
  }
  await verifyReleaseDirectory({
    directory: context.releaseDirectory,
    repositoryRoot: context.root,
    requirePrepared: false,
  });
  assertFinalizationGates(context, manifest, record);
  let release = await observeRelease(context);
  validateObservedRelease(context, release, { required: true });
  const before = releaseIdentityProjection(release);
  const finalizedNow = release.isDraft;
  if (finalizedNow) {
    await runText("gh", [
      "release", "edit", context.tag,
      "--repo", REPOSITORY,
      "--draft=false",
    ], context);
    context.remoteMutated = true;
    release = await observeRelease(context);
    validateObservedRelease(context, release, { required: true, draft: false });
  } else {
    context.reusedRemoteState.add("github_release");
  }
  const after = releaseIdentityProjection(release);
  if (
    after.id !== before.id
    || after.tagName !== before.tagName
    || after.targetCommitish !== before.targetCommitish
    || stableJSON(after.assets) !== stableJSON(before.assets)
  ) {
    throw new PublicationError("GITHUB_FINALIZATION_IDENTITY_CONFLICT", "GitHub finalization changed immutable release identity or assets", { blocked: true, step: "github_finalize" });
  }
  for (const asset of record.github.assets) {
    const digest = await downloadAssetDigest(context, asset.name);
    if (digest !== asset.sha256) {
      throw new PublicationError("GITHUB_FINAL_ASSET_CONFLICT", `published GitHub asset ${asset.name} differs after finalization`, { blocked: true, step: "github_finalize" });
    }
  }
  record.github.release_id = release.id;
  record.github.draft = false;
  record.github.published = true;
  completeStep(step, {
    remoteID: String(release.id),
    summary: finalizedNow
      ? "Exact GitHub Release finalization read-back passed."
      : "Exact public GitHub Release read-back passed without repeating finalization.",
  });
  record.overall_status = "complete";
  record.safe_next_action = "No further publication action is required for this exact release identity.";
  record.last_observed_at = now();
  step.safe_next_action = record.safe_next_action;
  await checkpoint(context.recordPath, record, manifest, context);
}

function assertFinalizationGates(context, manifest, record) {
  const requiredCompleted = record.steps.slice(0, 8);
  if (requiredCompleted.some((step) => step.status !== "complete")) {
    throw new PublicationError("FINALIZATION_GATE_INCOMPLETE", "GitHub finalization requires every preceding step to be complete", { blocked: true, step: "github_finalize" });
  }
  if (
    record.github.tag_target !== context.sourceCommit
    || record.npm.published !== true
    || record.npm.verified !== true
    || record.npm.tarball_sha256 !== context.tarballSHA256
    || record.final_journey.status !== "passed"
  ) throw new PublicationError("FINALIZATION_IDENTITY_GATE", "GitHub finalization release/npm/journey identity gate is incomplete", { blocked: true, step: "github_finalize" });
  const support = manifest.support;
  if (
    !Array.isArray(support)
    || support.length !== 1
    || support[0].os !== "darwin"
    || support[0].arch !== "arm64"
    || support[0].journey_result !== "passed"
    || support[0].actual_codex_version !== record.final_journey.actual_codex_version
    || support[0].journey_observed_at !== record.final_journey.observed_at
    || support[0].package_sha256 !== context.tarballSHA256
  ) throw new PublicationError("FINALIZATION_SUPPORT_GATE", "GitHub finalization requires one exact passed support entry", { blocked: true, step: "github_finalize" });
  const expectedNames = [
    `dev-flow-${context.version}-darwin-arm64`,
    `dev-flow-codex-${context.version}.tgz`,
    "release-manifest.json",
    "SHA256SUMS",
  ].sort();
  if (
    record.github.assets.length !== 4
    || stableJSON(record.github.assets.map((asset) => asset.name)) !== stableJSON(expectedNames)
    || record.github.assets.some((asset) => asset.verified !== true)
  ) throw new PublicationError("FINALIZATION_ASSET_GATE", "GitHub finalization requires four exact verified assets", { blocked: true, step: "github_finalize" });
  const finalValidation = manifest.validations.find((validation) => validation.name === "final-journey");
  if (finalValidation?.status !== "passed") {
    throw new PublicationError("FINALIZATION_MANIFEST_GATE", "GitHub finalization requires the final journey manifest validation", { blocked: true, step: "github_finalize" });
  }
}

function releaseIdentityProjection(release) {
  return {
    id: release.id,
    tagName: release.tagName,
    targetCommitish: release.targetCommitish,
    assets: release.assets.map((asset) => ({ name: asset.name, id: asset.id })),
  };
}

async function downloadAssetDigest(context, name) {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-github-readback-"));
  try {
    await runText("gh", ["release", "download", context.tag, "--repo", REPOSITORY, "--pattern", name, "--dir", root], context);
    return sha256File(join(root, name));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function observeExactNPM(context, { delayed }) {
  const result = await runAllowFailure("npm", [
    "view", `dev-flow-codex@${context.version}`, "version", "dist", "--json", `--registry=${OFFICIAL_REGISTRY}`,
  ], context);
  if (result.code !== 0) {
    if (isNotFound(result)) return null;
    throw commandFailure(delayed ? "NPM_READBACK_FAILED" : "NPM_VERSION_OBSERVATION_FAILED", result, delayed ? "npm_readback" : "preflight");
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return { version: parsed.version, integrity: parsed?.dist?.integrity, tarball: parsed?.dist?.tarball };
  } catch {
    throw new PublicationError("NPM_METADATA_INVALID", "npm version metadata was not bounded JSON", { blocked: true, step: delayed ? "npm_readback" : "preflight" });
  }
}

async function observeTagTarget(context) {
  const output = await runText("git", ["ls-remote", "--tags", "origin", `refs/tags/${context.tag}`], context, { cwd: context.root });
  if (output === "") return null;
  const lines = output.split("\n").filter(Boolean);
  if (lines.length !== 1) throw new PublicationError("TAG_OBSERVATION_AMBIGUOUS", "remote tag observation returned multiple identities", { blocked: true, step: "tag" });
  const [sha, ref] = lines[0].split(/\s+/u);
  if (!/^[0-9a-f]{40}$/u.test(sha) || ref !== `refs/tags/${context.tag}`) throw new PublicationError("TAG_OBSERVATION_INVALID", "remote tag observation was malformed", { blocked: true, step: "tag" });
  return sha;
}

async function observeRelease(context) {
  const result = await runAllowFailure("gh", [
    "release", "view", context.tag,
    "--repo", REPOSITORY,
    "--json", "tagName,isDraft,isPrerelease,targetCommitish,databaseId,assets,url",
  ], context);
  if (result.code !== 0) {
    if (isNotFound(result)) return null;
    throw commandFailure("GITHUB_DRAFT_OBSERVATION_FAILED", result, "github_draft");
  }
  try {
    const release = JSON.parse(result.stdout);
    const assets = Array.isArray(release.assets)
      ? release.assets.map((asset) => ({ ...asset, id: numericReleaseAssetID(asset) }))
      : release.assets;
    return { ...release, id: release.databaseId, assets };
  } catch (error) {
    if (error instanceof PublicationError) throw error;
    throw new PublicationError("GITHUB_DRAFT_INVALID", "GitHub draft metadata was not bounded JSON", { blocked: true, step: "github_draft" });
  }
}

function numericReleaseAssetID(asset) {
  const match = typeof asset?.apiUrl === "string" ? asset.apiUrl.match(/\/releases\/assets\/([1-9][0-9]*)$/u) : null;
  const id = match === null ? NaN : Number(match[1]);
  if (!Number.isSafeInteger(id)) {
    throw new PublicationError("GITHUB_ASSET_ID_INVALID", "GitHub asset REST identity is missing or invalid", { blocked: true, step: "github_draft" });
  }
  return id;
}

function validateObservedRelease(context, release, { required = false, draft = null } = {}) {
  if (release === null) {
    if (required) throw new PublicationError("GITHUB_DRAFT_MISSING", "expected GitHub draft is absent", { step: "github_draft" });
    return;
  }
  if (
    release.tagName !== context.tag ||
    release.targetCommitish !== context.sourceCommit ||
    typeof release.isDraft !== "boolean" ||
    release.isPrerelease !== false ||
    !Number.isSafeInteger(release.id) || release.id < 1 ||
    !Array.isArray(release.assets)
  ) throw new PublicationError("GITHUB_DRAFT_CONFLICT", "GitHub Release conflicts with the exact draft/source identity", { blocked: true, step: "github_draft" });
  if (draft !== null && release.isDraft !== draft) {
    throw new PublicationError(
      draft ? "GITHUB_DRAFT_CONFLICT" : "GITHUB_FINALIZATION_CONFLICT",
      draft ? "GitHub Release is not the required exact draft" : "GitHub Release did not become public",
      { blocked: true, step: draft ? "github_draft" : "github_finalize" },
    );
  }
  const names = release.assets.map((asset) => asset.name);
  if (new Set(names).size !== names.length) throw new PublicationError("GITHUB_ASSET_AMBIGUOUS", "GitHub draft contains duplicate asset names", { blocked: true, step: "github_draft" });
}

async function checkpoint(path, record, manifest, context) {
  const manifestSHA256 = await sha256File(context.manifestPath);
  record.manifest_sha256 = manifestSHA256;
  validatePublicationRecord(record, {
    version: context.version,
    sourceCommit: context.sourceCommit,
    sourceTree: context.sourceTree,
    manifestSHA256,
    requirePrepared: false,
  });
  scanStructuredContent(record, { repositoryRoot: context.root });
  await writeJSONAtomic(path, record, 0o600);
}

function startStep(record, name) {
  const step = record.steps.find((candidate) => candidate.name === name);
  if (!step) throw new Error(`publication step ${name} is missing`);
  if (step.status !== "complete") step.status = "pending";
  step.started_at ??= now();
  step.completed_at = step.status === "complete" ? step.completed_at : null;
  step.error_code = null;
  return step;
}

function completeStep(step, { remoteID = null, observedSHA256 = null, summary }) {
  step.status = "complete";
  step.completed_at = now();
  step.remote_id = remoteID;
  step.observed_sha256 = observedSHA256;
  step.error_code = null;
  step.summary = summary;
  step.safe_next_action = "Continue only after rereading exact remote state.";
}

function publisherSummary(record, context, { mode }) {
  const remainingSteps = record.steps
    .filter((step) => step.status !== "complete")
    .map((step) => step.name);
  return {
    status: record.overall_status,
    mode,
    mutated: context.remoteMutated,
    version: record.release.version,
    completed_steps: record.steps.filter((step) => step.status === "complete").map((step) => step.name),
    reused_remote_state: [...context.reusedRemoteState].sort(),
    next_incomplete_step: remainingSteps[0] ?? null,
    remaining_steps: remainingSteps,
    final_journey: record.final_journey.status,
    github_release_draft: record.github.draft,
    safe_next_action: record.safe_next_action,
  };
}

async function runText(command, arguments_, context, options = {}) {
  const result = await runAllowFailure(command, arguments_, context, options);
  if (result.code !== 0) throw commandFailure("COMMAND_FAILED", result, currentStepFromArguments(command, arguments_));
  return result.stdout.trim();
}

async function runAllowFailure(command, arguments_, context, options = {}) {
  try {
    const { stdout, stderr } = await execFile(command, arguments_, {
      cwd: options.cwd ?? context.root,
      env: context.environment,
      encoding: "utf8",
      timeout: options.timeout ?? COMMAND_TIMEOUT,
      maxBuffer: COMMAND_BUFFER,
      windowsHide: true,
      shell: false,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: String(error.stdout ?? "").slice(0, COMMAND_BUFFER),
      stderr: String(error.stderr ?? error.message ?? "command failed").slice(0, COMMAND_BUFFER),
    };
  }
}

function commandFailure(code, result, step) {
  return new PublicationError(code, boundedMessage(result.stderr || result.stdout || "command failed"), { step });
}

function currentStepFromArguments(command, arguments_) {
  const joined = `${command} ${arguments_.join(" ")}`;
  if (joined.includes("release upload")) return "github_upload";
  if (joined.includes("release download")) return "github_readback";
  if (joined.includes("release edit")) return "github_finalize";
  if (joined.includes("release create") || joined.includes("release view")) return "github_draft";
  if (joined.includes("npm publish")) return "npm_publish";
  if (joined.includes("npm pack") || joined.includes("npm view")) return "npm_readback";
  if (joined.includes("git tag") || joined.includes("git push") || joined.includes("ls-remote")) return "tag";
  return "preflight";
}

function isNotFound(result) {
  return /E404|404 Not Found|not found|release not found/iu.test(`${result.stdout}\n${result.stderr}`);
}

async function readManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function canonicalRepositoryRoot(path) {
  if (!isAbsolute(path)) throw new Error("repository root must be absolute");
  return realpath(path);
}

async function canonicalReleaseDirectory(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("release directory must be absolute");
  const supplied = await lstat(path);
  if (!supplied.isDirectory() || supplied.isSymbolicLink()) throw new Error("release directory must be an existing non-symlink directory");
  const canonical = await realpath(path);
  const info = await stat(canonical);
  if (!info.isDirectory()) throw new Error("release directory must be an existing non-symlink directory");
  return canonical;
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function now() {
  return new Date().toISOString();
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function boundedMessage(error) {
  return String(error?.message ?? error ?? "publication failed")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\/(?:Users|home|private\/var|var\/folders)\/[^\s:]+/gu, "<machine-path>")
    .slice(0, 500);
}

function repositoryRootFromModule() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

function parseArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  let directory = null;
  let confirmation = null;
  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === "--directory" || argument === "--confirm") {
      if (index + 1 >= normalized.length) throw new Error(`missing value for ${argument}`);
      const value = normalized[index + 1];
      index += 1;
      if (argument === "--directory") {
        if (directory !== null) throw new Error("--directory may be supplied only once");
        directory = value;
      } else {
        if (confirmation !== null) throw new Error("--confirm may be supplied only once");
        confirmation = value;
      }
      continue;
    }
    throw new Error(`unknown argument ${argument}`);
  }
  if (directory === null) throw new Error("usage: publish-codex-release.mjs --directory ABSOLUTE_RELEASE_DIRECTORY [--confirm vVERSION]");
  return { directory, confirmation };
}

if (isMainModule()) {
  try {
    const arguments_ = parseArguments(process.argv.slice(2));
    const result = await runPublisher(arguments_);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`publish-codex-release: ${boundedMessage(error)}\n`);
    process.exitCode = 1;
  }
}
