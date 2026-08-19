#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { validateFinalJourneyEvidence } from "./write-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);

export function releaseOutputNames(version) {
  if (!SEMVER_PATTERN.test(version)) throw new Error("release output version must be strict MAJOR.MINOR.PATCH");
  return ["SHA256SUMS", `dev-flow-${version}-darwin-arm64`, `dev-flow-codex-${version}.tgz`, "publication-record.json", "release-manifest.json"].sort();
}

export const PACKAGE_FILE_PATHS = Object.freeze([
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
  "plugin/skills/dev-flow/references/method-profiles.md",
  "runtime/darwin-arm64/dev-flow",
]);

export const PUBLICATION_STEPS = Object.freeze([
  "preflight",
  "tag",
  "github_draft",
  "npm_publish",
  "npm_readback",
  "final_journey",
  "github_upload",
  "github_readback",
  "github_finalize",
]);

const FEATURE_003_COMMIT = "a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7";
const FEATURE_005_COMMIT = "850dd4a4ee07bf50af5d9a36b24373c6b09fdd28";
const CORE_FIXTURE_DIGEST = "sha256:8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7";
const CODEX_RANGE = ">=0.147.0 <0.148.0";
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;

export async function prepareRelease({
  repositoryRoot,
  sourceCommit,
  sourceTree,
  firstTarball,
  secondTarball,
  outputDirectory,
  createdAt = new Date().toISOString(),
}) {
  const root = await canonicalDirectory(repositoryRoot, "repository root");
  const output = await validateReleaseDirectoryArgument(outputDirectory, {
    label: "output directory",
    requireEmpty: true,
  });
  assertOutsideRoot(root, output, "output directory");
  if (!GIT_SHA_PATTERN.test(sourceCommit) || !GIT_SHA_PATTERN.test(sourceTree)) {
    throw new Error("source commit and tree must be complete lowercase Git identities");
  }
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error("preparation time must be an RFC 3339 date-time");
  }

  const version = (await readBoundedFile(join(root, "VERSION"), 128)).toString("utf8").trim();
  if (!SEMVER_PATTERN.test(version)) throw new Error("root VERSION must be strict MAJOR.MINOR.PATCH");
  const expectedTarballName = `dev-flow-codex-${version}.tgz`;
  const expectedCoreName = `dev-flow-${version}-darwin-arm64`;

  const preparationRoot = await mkdtemp(join(dirname(output), ".dev-flow-release-stage-"));
  try {
    const first = await inspectPackageTarball(firstTarball, { repositoryRoot: root, version });
    const second = await inspectPackageTarball(secondTarball, { repositoryRoot: root, version });
    if (stableJSON(first.files) !== stableJSON(second.files)) {
      throw new Error("two clean builds produced different normalized package trees");
    }
    if (!first.coreBytes.equals(second.coreBytes)) {
      throw new Error("two clean builds produced different Core runtime bytes");
    }

    const rawTarballEqual = first.tarballSHA256 === second.tarballSHA256;
    const canonicalTarball = join(preparationRoot, expectedTarballName);
    const standaloneCore = join(preparationRoot, expectedCoreName);
    await copyFile(first.tarballPath, canonicalTarball);
    await writeFile(standaloneCore, first.coreBytes, { mode: 0o755, flag: "wx" });
    await chmod(standaloneCore, 0o755);

    const tarballInfo = await stat(canonicalTarball);
    const coreInfo = await stat(standaloneCore);
    const tarballSHA256 = await sha256File(canonicalTarball);
    const coreSHA256 = await sha256File(standaloneCore);
    const toolchains = await collectPreparationToolchains(root);
    const validations = [
      {
        name: "double-build",
        status: "passed",
        summary: `Runtime bytes and normalized package trees matched; raw tgz bytes ${rawTarballEqual ? "matched" : "differed"}.`,
      },
      {
        name: "forbidden-content",
        status: "passed",
        summary: "Bounded records and package text scan passed.",
      },
      {
        name: "normalized-package",
        status: "passed",
        summary: "Closed paths, bytes, modes, metadata, license, and one runtime passed.",
      },
    ];
    const manifest = {
      schema_version: 1,
      release: {
        version,
        tag: `v${version}`,
        source_commit: sourceCommit,
        source_tree: sourceTree,
        core_fixture_digest: CORE_FIXTURE_DIGEST,
        feature_003_commit: FEATURE_003_COMMIT,
        feature_005_commit: FEATURE_005_COMMIT,
        build_profile: "codex-darwin-arm64-v1",
        created_at: createdAt,
      },
      toolchains,
      artifacts: [
        {
          name: expectedCoreName,
          kind: "core_binary",
          relative_path: expectedCoreName,
          size_bytes: coreInfo.size,
          sha256: coreSHA256,
          mode: "0755",
          npm_integrity: null,
          source_commit: sourceCommit,
          core_version: version,
        },
        {
          name: expectedTarballName,
          kind: "npm_tarball",
          relative_path: expectedTarballName,
          size_bytes: tarballInfo.size,
          sha256: tarballSHA256,
          mode: "0644",
          npm_integrity: null,
          source_commit: sourceCommit,
          core_version: version,
        },
      ],
      package_files: first.files,
      support: [
        {
          os: "darwin",
          arch: "arm64",
          actual_codex_version: "0.147.0",
          compatible_codex_range: CODEX_RANGE,
          package_sha256: tarballSHA256,
          core_sha256: coreSHA256,
          journey_result: "pending",
          journey_observed_at: null,
          notes: "Deterministic local preparation only; final registry-package journey is pending.",
        },
      ],
      validations,
    };
    validateManifest(manifest, { version, sourceCommit, sourceTree });
    scanStructuredContent(manifest, { repositoryRoot: root });

    const manifestPath = join(preparationRoot, "release-manifest.json");
    await writeJSONAtomic(manifestPath, manifest, 0o644);
    const manifestSHA256 = await sha256File(manifestPath);
    const checksumEntries = [
      { name: expectedCoreName, sha256: coreSHA256 },
      { name: expectedTarballName, sha256: tarballSHA256 },
      { name: "release-manifest.json", sha256: manifestSHA256 },
    ].sort((left, right) => left.name.localeCompare(right.name));
    await writeFile(
      join(preparationRoot, "SHA256SUMS"),
      checksumEntries.map((entry) => `${entry.sha256}  ${entry.name}\n`).join(""),
      { encoding: "utf8", mode: 0o644, flag: "wx" },
    );

    const publication = initialPublicationRecord({
      version,
      sourceCommit,
      sourceTree,
      manifestSHA256,
      tarballSHA256,
      observedAt: createdAt,
    });
    validatePublicationRecord(publication, {
      version,
      sourceCommit,
      sourceTree,
      manifestSHA256,
      requirePrepared: true,
    });
    scanStructuredContent(publication, { repositoryRoot: root });
    await writeJSONAtomic(join(preparationRoot, "publication-record.json"), publication, 0o600);

    await verifyReleaseDirectory({
      directory: preparationRoot,
      repositoryRoot: root,
      requirePrepared: true,
    });
    const stagedNames = (await readdir(preparationRoot)).sort();
    if (!arraysEqual(stagedNames, releaseOutputNames(version))) {
      throw new Error("prepared staging directory does not contain the exact five-file output set");
    }
    for (const name of stagedNames) {
      await rename(join(preparationRoot, name), join(output, name));
    }
    await verifyReleaseDirectory({ directory: output, repositoryRoot: root, requirePrepared: true });
    return {
      status: "prepared",
      version,
      source_commit: sourceCommit,
      source_tree: sourceTree,
      runtime_sha256: coreSHA256,
      normalized_package_sha256: normalizedInventoryDigest(first.files),
      raw_tgz_equal: rawTarballEqual,
      build_count: 2,
      output_files: releaseOutputNames(version),
    };
  } finally {
    await rm(preparationRoot, { recursive: true, force: true });
  }
}

export async function verifyReleaseDirectory({
  directory,
  repositoryRoot = repositoryRootFromModule(),
  requirePrepared = true,
} = {}) {
  const root = await canonicalDirectory(repositoryRoot, "repository root");
  const releaseDirectory = await validateReleaseDirectoryArgument(directory, {
    label: "release directory",
    requireEmpty: false,
  });
  assertOutsideRoot(root, releaseDirectory, "release directory");

  const version = (await readBoundedFile(join(root, "VERSION"), 128)).toString("utf8").trim();
  const expectedNames = releaseOutputNames(version);
  const entries = await readdir(releaseDirectory, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  if (!arraysEqual(names, expectedNames)) {
    throw new Error(`release directory files do not match the approved five-file set`);
  }
  for (const entry of entries) {
    if (!entry.isFile() || !isSafeRelativePath(entry.name)) {
      throw new Error(`release output ${entry.name} must be a safe regular file`);
    }
    const info = await lstat(join(releaseDirectory, entry.name));
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) {
      throw new Error(`release output ${entry.name} must not be a link or special file`);
    }
  }

  const manifestPath = join(releaseDirectory, "release-manifest.json");
  const publicationPath = join(releaseDirectory, "publication-record.json");
  const manifest = await readJSONBounded(manifestPath);
  const publication = await readJSONBounded(publicationPath);
  const sourceCommit = await gitRead(root, ["rev-parse", "HEAD"]);
  const sourceTree = await gitRead(root, ["rev-parse", "HEAD^{tree}"]);
  validateManifest(manifest, { version, sourceCommit, sourceTree });
  const manifestSHA256 = await sha256File(manifestPath);
  validatePublicationRecord(publication, {
    version,
    sourceCommit,
    sourceTree,
    manifestSHA256,
    requirePrepared,
  });
  scanStructuredContent(manifest, { repositoryRoot: root });
  scanStructuredContent(publication, { repositoryRoot: root });

  const tarballName = `dev-flow-codex-${version}.tgz`;
  const coreName = `dev-flow-${version}-darwin-arm64`;
  const tarballPath = join(releaseDirectory, tarballName);
  const corePath = join(releaseDirectory, coreName);
  const inspected = await inspectPackageTarball(tarballPath, { repositoryRoot: root, version });
  if (stableJSON(inspected.files) !== stableJSON(manifest.package_files)) {
    throw new Error("manifest package_files do not match the normalized tarball tree");
  }
  const standaloneInfo = await lstat(corePath);
  if (!standaloneInfo.isFile() || standaloneInfo.isSymbolicLink() || standaloneInfo.nlink !== 1 || fileMode(standaloneInfo) !== "0755") {
    throw new Error("standalone Core must be one ordinary executable file with mode 0755");
  }
  const standaloneBytes = await readFile(corePath);
  if (!standaloneBytes.equals(inspected.coreBytes)) {
    throw new Error("standalone and bundled Core bytes differ");
  }
  const tarballSHA256 = await sha256File(tarballPath);
  const coreSHA256 = sha256Bytes(standaloneBytes);
  const artifactByKind = new Map(manifest.artifacts.map((artifact) => [artifact.kind, artifact]));
  const tarballArtifact = artifactByKind.get("npm_tarball");
  const coreArtifact = artifactByKind.get("core_binary");
  if (
    tarballArtifact.sha256 !== tarballSHA256 ||
    tarballArtifact.size_bytes !== (await stat(tarballPath)).size ||
    coreArtifact.sha256 !== coreSHA256 ||
    coreArtifact.size_bytes !== standaloneInfo.size
  ) {
    throw new Error("manifest artifact digest or size differs from local bytes");
  }
  if (manifest.support[0].package_sha256 !== tarballSHA256 || manifest.support[0].core_sha256 !== coreSHA256) {
    throw new Error("support digests differ from the verified package/Core bytes");
  }
  if (publication.npm.tarball_sha256 !== null && publication.npm.tarball_sha256 !== tarballSHA256) {
    throw new Error("publication npm tarball digest differs from the verified tarball");
  }

  await verifyChecksums(join(releaseDirectory, "SHA256SUMS"), {
    [coreName]: coreSHA256,
    [tarballName]: tarballSHA256,
    "release-manifest.json": manifestSHA256,
  });
  const coreVersion = await runText(corePath, ["version"], {
    cwd: releaseDirectory,
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  if (coreVersion !== `dev-flow ${version}`) throw new Error("standalone Core version differs from root VERSION");

  return {
    status: "verified",
    version,
    source_commit: sourceCommit,
    source_tree: sourceTree,
    tarball_sha256: tarballSHA256,
    core_sha256: coreSHA256,
    manifest_sha256: manifestSHA256,
    manifest,
    publication,
  };
}

export async function inspectPackageTarball(tarballPath, { repositoryRoot, version }) {
  const canonicalTarball = await canonicalRegularFile(tarballPath, "npm tarball");
  const tarballSHA256 = await sha256File(canonicalTarball);
  const listing = await runText("tar", ["-tzf", canonicalTarball], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  const archivePaths = listing.split("\n").filter(Boolean);
  if (new Set(archivePaths).size !== archivePaths.length) throw new Error("npm tarball contains duplicate paths");
  const packagePaths = archivePaths.filter((path) => !path.endsWith("/"));
  for (const archivePath of archivePaths) {
    if (!archivePath.startsWith("package/") || archivePath.startsWith("/") || archivePath.includes("\\")) {
      throw new Error("npm tarball contains an unsafe archive path");
    }
    const relativePath = archivePath.slice("package/".length).replace(/\/$/u, "");
    if (relativePath && !isSafeRelativePath(relativePath)) {
      throw new Error("npm tarball contains path traversal or an unsafe filename");
    }
  }
  const relativeFiles = packagePaths.map((path) => path.slice("package/".length)).sort();
  if (!arraysEqual(relativeFiles, [...PACKAGE_FILE_PATHS].sort())) {
    throw new Error("npm tarball does not contain the exact approved 12-file package layout");
  }

  const extractionRoot = await mkdtemp(join(tmpdir(), "dev-flow-release-verify-"));
  try {
    await execFile("tar", ["-xzf", canonicalTarball, "-C", extractionRoot], {
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const extractedPackage = join(extractionRoot, "package");
    const actualFiles = await walkRegularFiles(extractedPackage);
    if (!arraysEqual(actualFiles, [...PACKAGE_FILE_PATHS].sort())) {
      throw new Error("extracted npm package tree differs from the approved layout");
    }
    const files = [];
    for (const relativePath of actualFiles) {
      const absolutePath = join(extractedPackage, ...relativePath.split("/"));
      const info = await lstat(absolutePath);
      const expectedMode = relativePath === "bin/dev-flow-codex.mjs" || relativePath === "runtime/darwin-arm64/dev-flow" ? "0755" : "0644";
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || fileMode(info) !== expectedMode) {
        throw new Error(`package file ${relativePath} has an unsafe type/link/mode`);
      }
      const contents = await readBoundedFile(absolutePath, relativePath === "runtime/darwin-arm64/dev-flow" ? 128 * 1024 * 1024 : MAX_TEXT_FILE_BYTES);
      if (relativePath !== "runtime/darwin-arm64/dev-flow") {
        scanTextContent(contents.toString("utf8"), { repositoryRoot, record: false });
      }
      files.push({
        path: relativePath,
        size_bytes: info.size,
        sha256: sha256Bytes(contents),
        mode: expectedMode,
      });
    }
    files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const packageManifest = JSON.parse((await readFile(join(extractedPackage, "package.json"))).toString("utf8"));
    validatePublicPackageManifest(packageManifest, version);
    const rootLicense = await readFile(join(repositoryRoot, "LICENSE"));
    const packageLicense = await readFile(join(extractedPackage, "LICENSE"));
    if (!rootLicense.equals(packageLicense)) throw new Error("package LICENSE differs from the repository root LICENSE");
    const coreBytes = await readFile(join(extractedPackage, "runtime", "darwin-arm64", "dev-flow"));
    return {
      tarballPath: canonicalTarball,
      tarballSHA256,
      files,
      coreBytes,
      normalizedSHA256: normalizedInventoryDigest(files),
    };
  } finally {
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

export function validateManifest(manifest, { version, sourceCommit, sourceTree }) {
  assertExactKeys(manifest, ["schema_version", "release", "toolchains", "artifacts", "package_files", "support", "validations"], "release manifest");
  if (manifest.schema_version !== 1) throw new Error("release manifest schema_version must equal 1");
  assertExactKeys(manifest.release, ["version", "tag", "source_commit", "source_tree", "core_fixture_digest", "feature_003_commit", "feature_005_commit", "build_profile", "created_at"], "release identity");
  if (
    manifest.release.version !== version ||
    manifest.release.tag !== `v${version}` ||
    manifest.release.source_commit !== sourceCommit ||
    manifest.release.source_tree !== sourceTree ||
    manifest.release.core_fixture_digest !== CORE_FIXTURE_DIGEST ||
    manifest.release.feature_003_commit !== FEATURE_003_COMMIT ||
    manifest.release.feature_005_commit !== FEATURE_005_COMMIT ||
    manifest.release.build_profile !== "codex-darwin-arm64-v1" ||
    !Number.isFinite(Date.parse(manifest.release.created_at))
  ) {
    throw new Error("release manifest identity differs from the approved source/version baseline");
  }
  assertExactKeys(manifest.toolchains, ["go", "node", "pnpm", "npm", "git", "gh"], "release toolchains");
  for (const [name, value] of Object.entries(manifest.toolchains)) {
    if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new Error(`toolchain ${name} is not bounded`);
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 2) throw new Error("release manifest must contain exactly two artifacts");
  requireSortedUnique(manifest.artifacts, (artifact) => artifact.name, "artifacts");
  const kinds = new Set();
  for (const artifact of manifest.artifacts) {
    assertExactKeys(artifact, ["name", "kind", "relative_path", "size_bytes", "sha256", "mode", "npm_integrity", "source_commit", "core_version"], "artifact");
    if (!["npm_tarball", "core_binary"].includes(artifact.kind) || kinds.has(artifact.kind)) throw new Error("release artifact kinds must be unique npm_tarball/core_binary");
    kinds.add(artifact.kind);
    if (!isSafeRelativePath(artifact.relative_path) || !SHA256_PATTERN.test(artifact.sha256)) throw new Error("release artifact path or digest is invalid");
    if (!Number.isSafeInteger(artifact.size_bytes) || artifact.size_bytes < 0) throw new Error("release artifact size is invalid");
    if (!['0644', '0755'].includes(artifact.mode) || artifact.source_commit !== sourceCommit || artifact.core_version !== version) throw new Error("release artifact identity/mode differs from the release");
    if (artifact.npm_integrity !== null && (typeof artifact.npm_integrity !== "string" || artifact.npm_integrity.length > 256)) throw new Error("artifact npm integrity is invalid");
  }
  if (!Array.isArray(manifest.package_files) || manifest.package_files.length !== PACKAGE_FILE_PATHS.length) throw new Error("manifest package_files must contain the exact package inventory");
  requireSortedUnique(manifest.package_files, (file) => file.path, "package_files");
  if (!arraysEqual(manifest.package_files.map((file) => file.path), [...PACKAGE_FILE_PATHS].sort())) throw new Error("manifest package_files paths differ from the package contract");
  for (const file of manifest.package_files) {
    assertExactKeys(file, ["path", "size_bytes", "sha256", "mode"], "package file");
    if (!isSafeRelativePath(file.path) || !SHA256_PATTERN.test(file.sha256) || !Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0) throw new Error("manifest package file path/size/digest is invalid");
    const expectedMode = file.path === "bin/dev-flow-codex.mjs" || file.path === "runtime/darwin-arm64/dev-flow" ? "0755" : "0644";
    if (file.mode !== expectedMode) throw new Error(`manifest package file ${file.path} has the wrong mode`);
  }
  if (!Array.isArray(manifest.support) || manifest.support.length !== 1) throw new Error("release manifest must contain exactly one support entry");
  const support = manifest.support[0];
  assertExactKeys(support, ["os", "arch", "actual_codex_version", "compatible_codex_range", "package_sha256", "core_sha256", "journey_result", "journey_observed_at", "notes"], "support entry");
  if (support.os !== "darwin" || support.arch !== "arm64" || support.compatible_codex_range !== CODEX_RANGE || !["pending", "passed", "failed", "blocked"].includes(support.journey_result)) throw new Error("support entry differs from the darwin-arm64 contract");
  if (!SHA256_PATTERN.test(support.package_sha256) || !SHA256_PATTERN.test(support.core_sha256)) throw new Error("support digests are invalid");
  if (support.journey_result === "pending" && support.journey_observed_at !== null) throw new Error("pending support must not claim an observation time");
  if (support.journey_result === "passed") {
    if (!SEMVER_PATTERN.test(support.actual_codex_version) || !codexVersionSatisfiesRange(support.actual_codex_version)) {
      throw new Error("passed support must contain the actual compatible Codex version");
    }
    if (support.journey_observed_at === null || !Number.isFinite(Date.parse(support.journey_observed_at))) {
      throw new Error("passed support must contain the validated journey observation time");
    }
  }
  if (typeof support.notes !== "string" || support.notes.length > 1000) throw new Error("support notes are unbounded");
  if (!Array.isArray(manifest.validations) || manifest.validations.length < 1) throw new Error("release validations must be a nonempty array");
  requireSortedUnique(manifest.validations, (validation) => validation.name, "validations");
  for (const validation of manifest.validations) {
    assertExactKeys(validation, ["name", "status", "summary"], "validation summary");
    if (typeof validation.name !== "string" || validation.name.length < 1 || validation.name.length > 128 || !["passed", "failed", "blocked"].includes(validation.status) || typeof validation.summary !== "string" || validation.summary.length > 1000) throw new Error("validation summary is invalid or unbounded");
  }
  const artifactByKind = new Map(manifest.artifacts.map((artifact) => [artifact.kind, artifact]));
  const runtimeFile = manifest.package_files.find((file) => file.path === "runtime/darwin-arm64/dev-flow");
  if (runtimeFile.sha256 !== artifactByKind.get("core_binary").sha256 || support.core_sha256 !== runtimeFile.sha256 || support.package_sha256 !== artifactByKind.get("npm_tarball").sha256) throw new Error("release Core/package digests are not cross-consistent");
  return manifest;
}

export function buildSupportMatrixFromFinalJourney({ manifest, evidence }) {
  if (!manifest || !Array.isArray(manifest.artifacts) || !Array.isArray(manifest.package_files)) {
    throw new Error("support generation requires one verified release manifest");
  }
  const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.kind, artifact]));
  const packageArtifact = artifacts.get("npm_tarball");
  const coreArtifact = artifacts.get("core_binary");
  if (!packageArtifact || !coreArtifact) throw new Error("support generation requires exact package/Core artifacts");
  const validated = validateFinalJourneyEvidence(evidence, {
    expected: {
      packageName: "dev-flow-codex",
      version: manifest.release.version,
      registry: "https://registry.npmjs.org/",
      tarballSHA256: packageArtifact.sha256,
      coreSHA256: coreArtifact.sha256,
      sourceCommit: manifest.release.source_commit,
    },
  });
  const bundledCore = manifest.package_files.find((file) => file.path === "runtime/darwin-arm64/dev-flow");
  if (!bundledCore || bundledCore.sha256 !== validated.core_sha256) {
    throw new Error("final journey Core digest differs from the bundled runtime");
  }
  return [{
    os: "darwin",
    arch: "arm64",
    actual_codex_version: validated.codex_version,
    compatible_codex_range: CODEX_RANGE,
    package_sha256: validated.npm_tarball_sha256,
    core_sha256: validated.core_sha256,
    journey_result: "passed",
    journey_observed_at: validated.observed_at,
    notes: "Native registry-package Codex journey passed setup, zero-trigger, restart/resume, DONE, removal, uninstall, and retained reopen gates.",
  }];
}

export function validatePublicationRecord(record, {
  version,
  sourceCommit,
  sourceTree,
  manifestSHA256,
  requirePrepared = false,
}) {
  assertExactKeys(record, ["schema_version", "release", "overall_status", "manifest_sha256", "steps", "npm", "github", "final_journey", "last_observed_at", "safe_next_action"], "publication record");
  if (record.schema_version !== 1) throw new Error("publication record schema_version must equal 1");
  assertExactKeys(record.release, ["version", "tag", "source_commit", "source_tree"], "publication release identity");
  if (record.release.version !== version || record.release.tag !== `v${version}` || record.release.source_commit !== sourceCommit || record.release.source_tree !== sourceTree) throw new Error("publication record release identity differs from the manifest/source");
  const overallStatuses = ["prepared", "remote_initialized", "npm_published", "npm_verified", "journey_passed", "assets_uploaded", "assets_verified", "release_published", "complete", "failed", "blocked"];
  if (!overallStatuses.includes(record.overall_status) || record.manifest_sha256 !== manifestSHA256) throw new Error("publication record status or manifest digest is invalid");
  if (!Array.isArray(record.steps) || record.steps.length !== PUBLICATION_STEPS.length) throw new Error("publication record must contain exactly nine steps");
  for (let index = 0; index < record.steps.length; index += 1) {
    const step = record.steps[index];
    assertExactKeys(step, ["name", "status", "started_at", "completed_at", "remote_id", "expected_sha256", "observed_sha256", "error_code", "summary", "safe_next_action"], "publication step");
    if (step.name !== PUBLICATION_STEPS[index] || !["pending", "complete", "failed", "blocked"].includes(step.status)) throw new Error("publication steps are not in the fixed order/status vocabulary");
    for (const field of ["started_at", "completed_at"]) if (step[field] !== null && !Number.isFinite(Date.parse(step[field]))) throw new Error(`publication step ${step.name} has invalid ${field}`);
    for (const field of ["expected_sha256", "observed_sha256"]) if (step[field] !== null && !SHA256_PATTERN.test(step[field])) throw new Error(`publication step ${step.name} has invalid ${field}`);
    if (step.remote_id !== null && (typeof step.remote_id !== "string" || step.remote_id.length > 256)) throw new Error(`publication step ${step.name} has unbounded remote_id`);
    if (step.error_code !== null && (typeof step.error_code !== "string" || step.error_code.length > 128)) throw new Error(`publication step ${step.name} has unbounded error_code`);
    if (typeof step.summary !== "string" || step.summary.length > 1000 || typeof step.safe_next_action !== "string" || step.safe_next_action.length > 1000) throw new Error(`publication step ${step.name} summary/action is unbounded`);
  }
  assertExactKeys(record.npm, ["name", "version", "published", "integrity", "tarball_sha256", "verified"], "publication npm state");
  if (record.npm.name !== "dev-flow-codex" || record.npm.version !== version || typeof record.npm.published !== "boolean" || typeof record.npm.verified !== "boolean") throw new Error("publication npm identity/state is invalid");
  if (record.npm.integrity !== null && (typeof record.npm.integrity !== "string" || record.npm.integrity.length > 256)) throw new Error("publication npm integrity is invalid");
  if (record.npm.tarball_sha256 !== null && !SHA256_PATTERN.test(record.npm.tarball_sha256)) throw new Error("publication npm tarball digest is invalid");
  assertExactKeys(record.github, ["tag", "tag_target", "release_id", "draft", "published", "assets"], "publication GitHub state");
  if (record.github.tag !== `v${version}` || (record.github.tag_target !== null && !GIT_SHA_PATTERN.test(record.github.tag_target)) || (record.github.release_id !== null && (!Number.isSafeInteger(record.github.release_id) || record.github.release_id < 1)) || typeof record.github.draft !== "boolean" || typeof record.github.published !== "boolean" || !Array.isArray(record.github.assets)) throw new Error("publication GitHub state is invalid");
  requireSortedUnique(record.github.assets, (asset) => asset.name, "GitHub assets");
  for (const asset of record.github.assets) {
    assertExactKeys(asset, ["name", "asset_id", "sha256", "verified"], "GitHub asset");
    if (!isSafeRelativePath(asset.name) || (asset.asset_id !== null && (!Number.isSafeInteger(asset.asset_id) || asset.asset_id < 1)) || !SHA256_PATTERN.test(asset.sha256) || typeof asset.verified !== "boolean") throw new Error("publication GitHub asset is invalid");
  }
  assertExactKeys(record.final_journey, ["status", "actual_codex_version", "observed_at", "summary"], "final journey state");
  if (!["pending", "passed", "failed", "blocked"].includes(record.final_journey.status) || (record.final_journey.actual_codex_version !== null && (typeof record.final_journey.actual_codex_version !== "string" || record.final_journey.actual_codex_version.length > 64)) || (record.final_journey.observed_at !== null && !Number.isFinite(Date.parse(record.final_journey.observed_at))) || typeof record.final_journey.summary !== "string" || record.final_journey.summary.length > 1000) throw new Error("publication final journey state is invalid or unbounded");
  if (!Number.isFinite(Date.parse(record.last_observed_at)) || typeof record.safe_next_action !== "string" || record.safe_next_action.length > 1000) throw new Error("publication observation/action is invalid or unbounded");
  if (requirePrepared) validatePreparedPublicationState(record);
  return record;
}

export function validatePreparedPublicationState(record) {
  if (record.overall_status !== "prepared" || record.steps[0].status !== "complete" || record.steps.slice(1).some((step) => step.status !== "pending")) throw new Error("initial publication record must have only preflight complete");
  if (record.npm.published || record.npm.verified || record.npm.integrity !== null || record.npm.tarball_sha256 !== null) throw new Error("prepared publication record must not claim npm state");
  if (record.github.tag_target !== null || record.github.release_id !== null || record.github.draft || record.github.published || record.github.assets.length !== 0) throw new Error("prepared publication record must not claim GitHub state");
  if (record.final_journey.status !== "pending" || record.final_journey.actual_codex_version !== null || record.final_journey.observed_at !== null) throw new Error("prepared publication record must keep final journey pending");
}

export async function writeJSONAtomic(path, value, mode = 0o600) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  const parent = dirname(path);
  const temporary = join(parent, `.${basename(path)}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  let handle;
  try {
    handle = await open(temporary, "wx", mode);
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
    await chmod(path, mode);
    const directoryHandle = await open(parent, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function rewriteChecksums(directory, version) {
  const names = [`dev-flow-${version}-darwin-arm64`, `dev-flow-codex-${version}.tgz`, "release-manifest.json"].sort();
  const lines = [];
  for (const name of names) lines.push(`${await sha256File(join(directory, name))}  ${name}\n`);
  const target = join(directory, "SHA256SUMS");
  const temporary = join(directory, `.SHA256SUMS.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  await writeFile(temporary, lines.join(""), { encoding: "utf8", mode: 0o644, flag: "wx" });
  const handle = await open(temporary, "r+");
  try { await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, target);
  await chmod(target, 0o644);
}

export function scanStructuredContent(value, { repositoryRoot } = {}) {
  const visit = (current, field = "") => {
    if (Array.isArray(current)) {
      for (const item of current) visit(item, field);
      return;
    }
    if (current && typeof current === "object") {
      for (const key of Object.keys(current).sort()) {
        const lower = key.toLowerCase();
        if (["token", "npm_token", "secret", "credentials", "auth_header", "auth_file", "environment", "environment_values", "raw_prompt", "raw_output", "raw_stdout", "raw_stderr", "raw_command_output", "command_output"].includes(lower)) throw new Error(`forbidden release field ${key}`);
        visit(current[key], key);
      }
      return;
    }
    if (typeof current === "string") scanTextContent(current, { repositoryRoot, record: true, field });
  };
  visit(value);
}

export function scanTextContent(text, { repositoryRoot, record, field = "" } = {}) {
  const lower = text.toLowerCase();
  for (const marker of ["example-token-marker", "authorization: bearer", "//registry.npmjs.org/:_authtoken", ".npmrc", "dev-flow-deepseek", "raw prompt marker", "raw command output marker"]) {
    if (lower.includes(marker)) throw new Error(`forbidden release content marker ${marker}`);
  }
  if (repositoryRoot && text.includes(repositoryRoot)) throw new Error("release content contains the source repository path");
  if (record && (/\b(?:HOME|PATH|NODE_PATH|NPM_CONFIG_USERCONFIG)=/u.test(text) || /^\/(?:Users|home|private\/var|var\/folders)\//u.test(text))) throw new Error("release record contains a machine path or environment value");
  if (record && typeof text === "string" && text.length > 1000 && ["summary", "notes", "safe_next_action"].includes(field)) throw new Error(`release field ${field} is unbounded`);
}

export function initialPublicationRecord({ version, sourceCommit, sourceTree, manifestSHA256, tarballSHA256, observedAt }) {
  const steps = PUBLICATION_STEPS.map((name, index) => ({
    name,
    status: index === 0 ? "complete" : "pending",
    started_at: index === 0 ? observedAt : null,
    completed_at: index === 0 ? observedAt : null,
    remote_id: null,
    expected_sha256: ["npm_publish", "npm_readback"].includes(name) ? tarballSHA256 : null,
    observed_sha256: null,
    error_code: null,
    summary: index === 0 ? "Local preparation preflight passed; no remote state was read or changed." : "Not started.",
    safe_next_action: index === 0 ? "Review the prepared release and run publisher preflight without confirmation." : "Complete preceding release steps first.",
  }));
  return {
    schema_version: 1,
    release: { version, tag: `v${version}`, source_commit: sourceCommit, source_tree: sourceTree },
    overall_status: "prepared",
    manifest_sha256: manifestSHA256,
    steps,
    npm: { name: "dev-flow-codex", version, published: false, integrity: null, tarball_sha256: null, verified: false },
    github: { tag: `v${version}`, tag_target: null, release_id: null, draft: false, published: false, assets: [] },
    final_journey: { status: "pending", actual_codex_version: null, observed_at: null, summary: "Final registry-package journey has not run." },
    last_observed_at: observedAt,
    safe_next_action: "Await review and exact confirmation before any remote mutation.",
  };
}

function validatePublicPackageManifest(manifest, version) {
  const privateContract = !Object.hasOwn(manifest, "private") || manifest.private === false;
  if (
    manifest.name !== "dev-flow-codex" ||
    manifest.version !== version ||
    !privateContract ||
    manifest.license !== "Apache-2.0" ||
    stableJSON(manifest.os) !== stableJSON(["darwin"]) ||
    stableJSON(manifest.cpu) !== stableJSON(["arm64"]) ||
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig?.registry !== "https://registry.npmjs.org/" ||
    stableJSON(manifest.engines) !== stableJSON({ node: ">=24" }) ||
    stableJSON(manifest.files) !== stableJSON([
      ".agents/plugins/marketplace.json", "LICENSE", "bin/dev-flow-codex.mjs", "lib/lifecycle.mjs", "lib/paths.mjs", "plugin/.codex-plugin/plugin.json", "plugin/.mcp.json", "plugin/skills/dev-flow/SKILL.md", "plugin/skills/dev-flow/agents/openai.yaml", "plugin/skills/dev-flow/references/method-profiles.md", "runtime/darwin-arm64/dev-flow",
    ])
  ) throw new Error("packed package.json differs from the fixed public package contract");
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies", "bundledDependencies", "bundleDependencies"]) if (field in manifest) throw new Error(`packed package contains forbidden ${field}`);
  for (const hook of ["preinstall", "install", "postinstall", "prepare", "preuninstall", "uninstall"]) if (hook in (manifest.scripts ?? {})) throw new Error(`packed package contains forbidden lifecycle hook ${hook}`);
}

async function collectPreparationToolchains(repositoryRoot) {
  const research = (await readFile(join(repositoryRoot, "specs", "006-publish-codex-installable-product", "research.md"), "utf8"));
  const ghBaseline = /\| GitHub CLI \| `([^`]+)` \|/u.exec(research)?.[1];
  if (!ghBaseline) throw new Error("Feature 006 research does not contain the bounded GitHub CLI baseline");
  return {
    go: await runText("go", ["version"], { timeout: 5_000, maxBuffer: 64 * 1024 }),
    node: process.version,
    pnpm: await runText("pnpm", ["--version"], { timeout: 5_000, maxBuffer: 64 * 1024 }),
    npm: await runText("npm", ["--version"], { timeout: 5_000, maxBuffer: 64 * 1024 }),
    git: await runText("git", ["--version"], { timeout: 5_000, maxBuffer: 64 * 1024 }),
    gh: `${ghBaseline} (T001 read-only baseline; not invoked during preparation)`,
  };
}

async function verifyChecksums(path, expected) {
  const contents = (await readBoundedFile(path, 4096)).toString("utf8");
  scanTextContent(contents, { record: true });
  const lines = contents.split("\n").filter(Boolean);
  const names = [];
  const observed = {};
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._+,-]+)$/u.exec(line);
    if (!match || !isSafeRelativePath(match[2]) || Object.hasOwn(observed, match[2])) throw new Error("SHA256SUMS contains an invalid or duplicate entry");
    observed[match[2]] = match[1];
    names.push(match[2]);
  }
  const sorted = [...names].sort();
  if (!arraysEqual(names, sorted) || stableJSON(observed) !== stableJSON(expected)) throw new Error("SHA256SUMS coverage, order, or digest differs from the release contract");
  if (Object.hasOwn(observed, "SHA256SUMS") || Object.hasOwn(observed, "publication-record.json")) throw new Error("SHA256SUMS must not cover itself or the publication record");
}

async function walkRegularFiles(root) {
  const files = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error("extracted npm package contains a symbolic link");
      if (info.isDirectory()) await visit(absolute);
      else if (info.isFile()) files.push(relative(root, absolute).split(sep).join("/"));
      else throw new Error("extracted npm package contains a special file");
    }
  };
  await visit(root);
  return files.sort();
}

async function validateReleaseDirectoryArgument(path, { label, requireEmpty }) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`${label} must be absolute`);
  const info = await lstat(path).catch(() => null);
  if (!info || !info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be an existing non-symlink directory`);
  const canonical = await realpath(path);
  if (requireEmpty && (await readdir(canonical)).length !== 0) throw new Error(`${label} must be empty`);
  return canonical;
}

async function canonicalDirectory(path, label) {
  if (!isAbsolute(path)) throw new Error(`${label} must be absolute`);
  const canonical = await realpath(path);
  const info = await lstat(canonical);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${label} must be an ordinary directory`);
  return canonical;
}

async function canonicalRegularFile(path, label) {
  if (!isAbsolute(path)) throw new Error(`${label} must be absolute`);
  const suppliedInfo = await lstat(path);
  if (!suppliedInfo.isFile() || suppliedInfo.isSymbolicLink() || suppliedInfo.nlink !== 1) throw new Error(`${label} must be an ordinary single-link file`);
  const canonical = await realpath(path);
  const info = await lstat(canonical);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`${label} must be an ordinary single-link file`);
  return canonical;
}

function assertOutsideRoot(root, candidate, label) {
  const offset = relative(root, candidate);
  if (offset === "" || (offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))) throw new Error(`${label} must be outside the source repository`);
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!arraysEqual(actual, wanted)) throw new Error(`${label} fields do not match the closed contract`);
}

function requireSortedUnique(values, key, label) {
  const actual = values.map(key);
  const sorted = [...actual].sort();
  if (!arraysEqual(actual, sorted) || new Set(actual).size !== actual.length) throw new Error(`${label} must be sorted and unique`);
}

function isSafeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 300 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes("..") && /^[A-Za-z0-9._@+,-]+(?:\/[A-Za-z0-9._@+,-]+)*$/u.test(value);
}

function fileMode(info) {
  return (info.mode & 0o777).toString(8).padStart(4, "0");
}

function normalizedInventoryDigest(files) {
  return sha256Bytes(Buffer.from(files.map((file) => `${file.mode} ${file.sha256} ${file.size_bytes} ${file.path}\n`).join(""), "utf8"));
}

async function readJSONBounded(path) {
  const contents = await readBoundedFile(path, MAX_RECORD_BYTES);
  try { return JSON.parse(contents.toString("utf8")); } catch (error) { throw new Error(`${basename(path)} is not valid JSON`, { cause: error }); }
}

async function readBoundedFile(path, maxBytes) {
  const info = await stat(path);
  if (!info.isFile() || info.size > maxBytes) throw new Error(`${basename(path)} is missing, special, or exceeds its bounded size`);
  return readFile(path);
}

async function sha256File(path) {
  return sha256Bytes(await readFile(path));
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function codexVersionSatisfiesRange(version) {
  const match = SEMVER_PATTERN.exec(version);
  return match !== null && Number(match[1]) === 0 && Number(match[2]) === 147;
}

async function runText(command, arguments_, options = {}) {
  const { stdout } = await execFile(command, arguments_, {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeout ?? 10_000,
    maxBuffer: options.maxBuffer ?? 128 * 1024,
    windowsHide: true,
    shell: false,
  });
  return stdout.trim();
}

async function gitRead(root, arguments_) {
  const value = await runText("git", arguments_, { cwd: root, timeout: 5_000, maxBuffer: 64 * 1024 });
  if (!GIT_SHA_PATTERN.test(value)) throw new Error("Git returned an invalid source identity");
  return value;
}

function repositoryRootFromModule() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

function parseVerifyArguments(arguments_) {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (normalized.length !== 2 || normalized[0] !== "--directory" || !normalized[1]) throw new Error("usage: verify-codex-release.mjs --directory ABSOLUTE_RELEASE_DIRECTORY");
  return normalized[1];
}

function boundedError(error) {
  const message = String(error?.message ?? error ?? "release verification failed")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\/(?:Users|home|private\/var|var\/folders)\/[^\s:]+/gu, "<machine-path>");
  return message.slice(0, 500);
}

if (isMainModule()) {
  try {
    const directory = parseVerifyArguments(process.argv.slice(2));
    const result = await verifyReleaseDirectory({ directory, requirePrepared: true });
    process.stdout.write(`${JSON.stringify({ status: result.status, version: result.version, source_commit: result.source_commit, output_files: releaseOutputNames(result.version) })}\n`);
  } catch (error) {
    process.stderr.write(`verify-codex-release: ${boundedError(error)}\n`);
    process.exitCode = 1;
  }
}
