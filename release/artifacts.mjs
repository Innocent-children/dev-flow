import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { releaseProducts } from "./products.mjs";

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const hostVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/u;
const gitIdentity = /^[0-9a-f]{40}$/u;
const artifactDigest = /^[0-9a-f]{64}$/u;

export async function validateReleaseArtifacts({ product, version, directory, sourceCommit }) {
  if (!Object.hasOwn(releaseProducts, product)) throw new Error("invalid release product");
  const { packageName, bundlesCore } = releaseProducts[product];
  if (!(bundlesCore ? hostVersion : stableVersion).test(version ?? "")) throw new Error("invalid release version");
  if (!gitIdentity.test(sourceCommit ?? "")) throw new Error("invalid source commit");
  const requested = resolve(directory);
  const info = await lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("release directory must be a non-symbolic-link directory");
  const root = await realpath(requested);
  const manifestBytes = await readRegularFile(join(root, "release-manifest.json"));
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
  exactKeys(manifest, bundlesCore ? ["release", "artifacts"] : ["release", "artifacts", "desktop_applications"], "release manifest");
  exactKeys(manifest.release, bundlesCore
    ? ["product", "version", "source_commit", "source_tree", "core_version"]
    : ["product", "version", "source_commit"], "release identity");
  if (manifest.release.product !== product || manifest.release.version !== version || manifest.release.source_commit !== sourceCommit) {
    throw new Error("release manifest identity mismatch");
  }
  if (bundlesCore && (!stableVersion.test(manifest.release.core_version) || !gitIdentity.test(manifest.release.source_tree))) {
    throw new Error("release manifest Core version or source tree is invalid");
  }
  if (!bundlesCore) exactKeys(manifest.desktop_applications, ["darwin-arm64", "win32-x64"], "desktop applications");

  const tarballName = `${packageName.replace(/^@/u, "").replaceAll("/", "-")}-${version}.tgz`;
  const expected = new Map([[tarballName, "npm_tarball"]]);
  if (bundlesCore) {
    expected.set(`dev-flow-core-${manifest.release.core_version}-darwin-arm64`, "core_binary");
    expected.set(`dev-flow-core-${manifest.release.core_version}-windows-amd64.exe`, "core_binary");
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== expected.size) {
    throw new Error("release artifact inventory is incomplete");
  }
  const records = new Map();
  for (const artifact of manifest.artifacts) {
    exactKeys(artifact, ["kind", "relative_path", "sha256"], "release artifact");
    const name = artifact.relative_path;
    if (!expected.has(name) || expected.get(name) !== artifact.kind || records.has(name)) {
      throw new Error("release artifact path/kind is unexpected or duplicated");
    }
    if (!artifactDigest.test(artifact.sha256)) throw new Error(`release artifact digest is invalid: ${name}`);
    records.set(name, artifact.sha256);
  }
  const names = [...expected.keys(), "release-manifest.json", "SHA256SUMS"];
  if (!sameNames(await readdir(root), names)) throw new Error("release directory does not contain the exact prepared artifact set");
  const checksumBytes = await readRegularFile(join(root, "SHA256SUMS"));
  const checksums = parseChecksums(checksumBytes);
  const checksumNames = [...expected.keys(), ...(bundlesCore ? ["release-manifest.json"] : [])];
  if (!sameNames([...checksums.keys()], checksumNames)) throw new Error("SHA256SUMS does not contain the exact prepared artifact set");

  const assets = [];
  for (const [name, expectedSHA] of records) {
    if (checksums.get(name) !== expectedSHA) throw new Error(`SHA256SUMS differs from release manifest: ${name}`);
    const path = join(root, name);
    if (digest(await readRegularFile(path)) !== expectedSHA) throw new Error(`release artifact differs from recorded digest: ${name}`);
    assets.push(Object.freeze({ name, path, sha256: expectedSHA }));
  }
  const manifestSHA = digest(manifestBytes);
  if (bundlesCore && checksums.get("release-manifest.json") !== manifestSHA) {
    throw new Error("release manifest differs from SHA256SUMS");
  }
  assets.push(Object.freeze({ name: "release-manifest.json", path: join(root, "release-manifest.json"), sha256: manifestSHA }));
  assets.push(Object.freeze({ name: "SHA256SUMS", path: join(root, "SHA256SUMS"), sha256: digest(checksumBytes) }));
  return Object.freeze({ directory: root, manifest, tarball: assets.find(asset => asset.name === tarballName), assets: Object.freeze(assets) });
}

async function readRegularFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`release artifact must be a regular non-symbolic-link file: ${path}`);
  return readFile(path);
}

function parseChecksums(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const lines = (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
  const values = new Map();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([^\r\n]+)$/u.exec(line);
    if (!match || values.has(match[2])) throw new Error("SHA256SUMS contains an invalid or duplicate entry");
    values.set(match[2], match[1]);
  }
  return values;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !sameNames(Object.keys(value), expected)) {
    throw new Error(`${label} does not match the prepared format`);
  }
}

function sameNames(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
