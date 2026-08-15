import { execFile as execFileCallback } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { containedPath } from "./paths.mjs";

const execFile = promisify(execFileCallback);

export const CODEX_COMPATIBILITY_RANGE = ">=0.147.0 <0.148.0";

const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const digestPattern = /^[0-9a-f]{64}$/;

export async function runCodexJSON(
  arguments_,
  {
    codexExecutable = "codex",
    environment = process.env,
    currentDirectory = process.cwd(),
  } = {},
) {
  if (!Array.isArray(arguments_) || arguments_.some((argument) => typeof argument !== "string" || argument.includes("\0"))) {
    throw new Error("Codex arguments must be a closed string array");
  }
  let stdout;
  try {
    ({ stdout } = await execFile(codexExecutable, arguments_, {
      cwd: currentDirectory,
      env: environment,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }));
  } catch (error) {
    const detail = String(error?.stderr ?? "").trim();
    throw new Error(
      `Codex command failed (${arguments_.join(" ")})${detail ? `: ${detail}` : ""}`,
      { cause: error },
    );
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Codex command did not return valid JSON (${arguments_.join(" ")})`, {
      cause: error,
    });
  }
}

export function versionSatisfiesRange(version, range = CODEX_COMPATIBILITY_RANGE) {
  const match = /^>=(\S+)\s+<(\S+)$/.exec(range);
  if (!match) throw new Error(`unsupported compatibility range ${JSON.stringify(range)}`);
  const candidate = parseSemver(version, "Codex version");
  const minimum = parseSemver(match[1], "compatibility minimum");
  const maximum = parseSemver(match[2], "compatibility maximum");
  return compareSemver(candidate, minimum) >= 0 && compareSemver(candidate, maximum) < 0;
}

export function validateReceipt(receipt, { compatibilityRange = CODEX_COMPATIBILITY_RANGE } = {}) {
  assertObject(receipt, "registration receipt");
  assertExactKeys(
    receipt,
    ["schema_version", "product", "host", "registration", "paths", "resource_digests", "installed_at"],
    "registration receipt",
  );
  if (receipt.schema_version !== 2) throw new Error("registration receipt schema_version must equal 2");

  assertObject(receipt.product, "product");
  assertExactKeys(receipt.product, ["name", "version", "core_version", "codex_compatibility"], "product");
  assertEqual(receipt.product.name, "dev-flow-codex", "product.name");
  parseSemver(receipt.product.version, "product.version");
  parseSemver(receipt.product.core_version, "product.core_version");
  assertEqual(receipt.product.core_version, receipt.product.version, "product Core version");
  assertEqual(receipt.product.codex_compatibility, compatibilityRange, "product compatibility range");

  assertObject(receipt.host, "host");
  assertExactKeys(receipt.host, ["surface", "version", "os", "arch"], "host");
  assertEqual(receipt.host.surface, "codex-cli", "host.surface");
  assertEqual(receipt.host.os, "darwin", "host.os");
  assertEqual(receipt.host.arch, "arm64", "host.arch");
  if (!versionSatisfiesRange(receipt.host.version, compatibilityRange)) {
    throw new Error(`host.version ${receipt.host.version} does not satisfy ${compatibilityRange}`);
  }

  assertObject(receipt.registration, "registration");
  assertExactKeys(
    receipt.registration,
    ["marketplace_name", "marketplace_root", "plugin_name", "plugin_selector", "plugin_root"],
    "registration",
  );
  assertEqual(receipt.registration.marketplace_name, "dev-flow-local", "registration.marketplace_name");
  assertEqual(receipt.registration.plugin_name, "dev-flow-codex", "registration.plugin_name");
  assertEqual(
    receipt.registration.plugin_selector,
    "dev-flow-codex@dev-flow-local",
    "registration.plugin_selector",
  );
  assertCanonicalAbsolutePath(receipt.registration.marketplace_root, "registration.marketplace_root");
  assertCanonicalAbsolutePath(receipt.registration.plugin_root, "registration.plugin_root");

  assertObject(receipt.paths, "paths");
  assertExactKeys(receipt.paths, ["package_root", "runtime_path", "data_dir", "receipt_path"], "paths");
  for (const field of ["package_root", "runtime_path", "data_dir", "receipt_path"]) {
    assertCanonicalAbsolutePath(receipt.paths[field], `paths.${field}`);
  }

  assertObject(receipt.resource_digests, "resource_digests");
  assertExactKeys(
    receipt.resource_digests,
    ["plugin_manifest", "skill", "mcp_configuration"],
    "resource_digests",
  );
  for (const field of ["plugin_manifest", "skill", "mcp_configuration"]) {
    if (!digestPattern.test(receipt.resource_digests[field])) {
      throw new Error(`resource_digests.${field} must be a lowercase SHA-256 digest`);
    }
  }

  if (typeof receipt.installed_at !== "string" || !Number.isFinite(Date.parse(receipt.installed_at))) {
    throw new Error("installed_at must be an RFC 3339 date-time string");
  }
  return structuredClone(receipt);
}

export async function readReceipt(receiptPath, options) {
  let contents;
  try {
    contents = await readFile(receiptPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`read registration receipt ${receiptPath}: ${error.message}`, { cause: error });
  }

  let receipt;
  try {
    receipt = JSON.parse(contents);
  } catch (error) {
    throw new Error(`parse registration receipt ${receiptPath}: invalid JSON`, { cause: error });
  }
  try {
    return validateReceipt(receipt, options);
  } catch (error) {
    throw new Error(`registration receipt ${receiptPath} is invalid: ${error.message}`, { cause: error });
  }
}

export async function writeReceiptAtomic(receiptPath, receipt, { ownedRoot, compatibilityRange } = {}) {
  if (!ownedRoot) throw new Error("receipt owned root is required");
  assertCanonicalAbsolutePath(receiptPath, "receipt path");
  assertCanonicalAbsolutePath(ownedRoot, "receipt owned root");
  const expectedPath = join(ownedRoot, "registrations", "codex.json");
  if (receiptPath !== expectedPath) {
    throw new Error(`receipt path must equal the product-owned path ${expectedPath}`);
  }
  containedPath(ownedRoot, receiptPath, "receipt path");

  const validated = validateReceipt(receipt, { compatibilityRange });
  if (validated.paths.receipt_path !== receiptPath) {
    throw new Error("receipt payload path does not match the write target");
  }

  await mkdir(ownedRoot, { recursive: true, mode: 0o700 });
  const canonicalOwnedRoot = await realpath(ownedRoot);
  if (canonicalOwnedRoot !== ownedRoot) {
    throw new Error("receipt owned root must be canonical and may not use a symbolic link");
  }
  const parent = dirname(receiptPath);
  await assertNoSymbolicLinkComponents(ownedRoot, parent);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await assertNoSymbolicLinkComponents(ownedRoot, parent);
  await chmod(parent, 0o700);
  await rejectSymbolicLink(receiptPath);

  const temporaryPath = join(parent, `.${basename(receiptPath)}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, receiptPath);
    await chmod(receiptPath, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function digestResources({ pluginManifest, skill, mcpConfiguration }) {
  const entries = {
    plugin_manifest: pluginManifest,
    skill,
    mcp_configuration: mcpConfiguration,
  };
  const result = {};
  for (const [name, path] of Object.entries(entries)) {
    if (!path) throw new Error(`resource path ${name} is required`);
    result[name] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return result;
}

export function receiptOwnershipMatches(left, right) {
  try {
    const first = validateReceipt(left);
    const second = validateReceipt(right);
    return stableJSON(ownershipProjection(first)) === stableJSON(ownershipProjection(second));
  } catch {
    return false;
  }
}

function ownershipProjection(receipt) {
  return {
    schema_version: receipt.schema_version,
    product: receipt.product,
    host: receipt.host,
    registration: receipt.registration,
    paths: receipt.paths,
    resource_digests: receipt.resource_digests,
  };
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(value, requiredKeys, label) {
  for (const field of requiredKeys) {
    if (!Object.hasOwn(value, field)) throw new Error(`${label} missing field ${field}`);
  }
  const allowed = new Set(requiredKeys);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} has unexpected field ${field}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
  }
}

function assertCanonicalAbsolutePath(value, label) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
  if (resolve(value) !== value) throw new Error(`${label} must be canonical`);
}

function parseSemver(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a SemVer string`);
  const match = semverPattern.exec(value);
  if (!match) throw new Error(`${label} must be valid SemVer`);
  const prerelease = match[4] ? match[4].split(".") : [];
  for (const identifier of prerelease) {
    if (/^[0-9]+$/.test(identifier) && identifier.length > 1 && identifier.startsWith("0")) {
      throw new Error(`${label} has an invalid numeric prerelease identifier`);
    }
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

function compareSemver(left, right) {
  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) return left[field] < right[field] ? -1 : 1;
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }
  const count = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^[0-9]+$/.test(a);
    const bNumeric = /^[0-9]+$/.test(b);
    if (aNumeric && bNumeric) return Number(a) < Number(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

async function assertNoSymbolicLinkComponents(root, candidate) {
  const offset = relative(root, candidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error("receipt path escapes its owned root");
  }
  let current = root;
  for (const component of offset.split(sep).filter(Boolean)) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`receipt path contains a symbolic link: ${current}`);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

async function rejectSymbolicLink(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) {
      throw new Error(`receipt target is a symbolic link: ${path}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
