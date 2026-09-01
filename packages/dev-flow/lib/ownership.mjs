import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const DATA_DIRECTORY_ENVIRONMENT = "DEV_FLOW_DATA_DIR";
export const SUPPORTED_RUNTIME_KEYS = Object.freeze(["darwin-arm64", "win32-x64"]);

export async function resolveManagerPaths({
  homeDirectory = homedir(),
  environment = process.env,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const runtimeKey = `${platform}-${arch}`;
  if (!SUPPORTED_RUNTIME_KEYS.includes(runtimeKey)) {
    throw new OwnershipError(`unsupported platform ${runtimeKey}; supported runtimes: ${SUPPORTED_RUNTIME_KEYS.join(", ")}`);
  }
  const canonicalHome = await canonicalExistingDirectory(homeDirectory, "home directory");
  const applicationDataRoot = platform === "win32"
    ? environment?.LOCALAPPDATA
      ? await canonicalExistingDirectory(environment.LOCALAPPDATA, "LOCALAPPDATA")
      : ownedPath(
        canonicalHome,
        join(canonicalHome, "AppData", "Local"),
        "local application data directory",
      )
    : ownedPath(
      canonicalHome,
      join(canonicalHome, "Library", "Application Support"),
      "application support directory",
    );
  const applicationDataInspectionRoot = platform === "win32" && !environment?.LOCALAPPDATA
    ? canonicalHome
    : applicationDataRoot;
  const productRoot = ownedPath(applicationDataRoot, join(applicationDataRoot, "dev-flow"), "product root");
  const managerRoot = ownedPath(applicationDataRoot, join(applicationDataRoot, "create-dev-flow"), "manager root");
  const configurationDirectory = ownedPath(canonicalHome, join(canonicalHome, ".dev-flow"), "configuration directory");
  const configurationPath = ownedPath(configurationDirectory, join(configurationDirectory, "config.json"), "configuration path");
  const defaultDataDirectory = ownedPath(productRoot, join(productRoot, "data"), "default data directory");
  const explicitValue = environment[DATA_DIRECTORY_ENVIRONMENT] ?? "";
  const explicitDataDirectory = explicitValue === "" ? null : await canonicalExplicitDirectory(explicitValue);
  return Object.freeze({
    homeDirectory: canonicalHome,
    platform,
    arch,
    runtimeKey,
    applicationDataRoot,
    applicationDataInspectionRoot,
    productRoot,
    managerRoot,
    runsDirectory: ownedPath(managerRoot, join(managerRoot, "runs"), "runs directory"),
    profilesDirectory: ownedPath(managerRoot, join(managerRoot, "profiles"), "profiles directory"),
    configurationDirectory,
    configurationPath,
    defaultDataDirectory,
    explicitDataDirectory,
    trashDirectory: platform === "win32"
      ? ownedPath(managerRoot, join(managerRoot, "trash"), "recoverable cleanup directory")
      : ownedPath(canonicalHome, join(canonicalHome, ".Trash"), "Trash directory"),
  });
}

export async function ensureManagerDirectories(paths) {
  await rejectSymlinkComponents(paths.applicationDataInspectionRoot, paths.managerRoot);
  await mkdir(paths.runsDirectory, { recursive: true, mode: 0o700 });
  await mkdir(paths.profilesDirectory, { recursive: true, mode: 0o700 });
  if (paths.platform !== "win32") {
    await Promise.all([chmod(paths.managerRoot, 0o700), chmod(paths.runsDirectory, 0o700), chmod(paths.profilesDirectory, 0o700)]);
  }
}

export async function ensureDefaultDataDirectory(paths) {
  if (paths.explicitDataDirectory !== null) throw new OwnershipError("refusing to create an explicit data directory");
  const expected = ownedPath(paths.productRoot, join(paths.productRoot, "data"), "default data directory");
  if (paths.defaultDataDirectory !== expected) throw new OwnershipError("default data directory differs from the product-owned path");
  await rejectSymlinkComponents(paths.applicationDataInspectionRoot, expected);
  await mkdir(expected, { recursive: true, mode: 0o700 });
  await rejectSymlinkComponents(paths.applicationDataInspectionRoot, expected);
  const canonical = await realpath(expected);
  const info = await stat(canonical);
  if (canonical !== expected || !info.isDirectory()) throw new OwnershipError("default data directory must be canonical");
  if (paths.platform !== "win32") await chmod(expected, 0o700);
  return expected;
}

export async function inspectResource(path, label) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ label, path: resolve(path), exists: false, identity: null });
    throw new Error(`inspect ${label}`, { cause: error });
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error(`${label} must be canonical`);
  return Object.freeze({
    label,
    path: canonical,
    exists: true,
    identity: `${info.dev}:${info.ino}:${info.mode}:${info.size}:${info.mtimeMs}`,
    kind: info.isDirectory() ? "directory" : info.isFile() ? "file" : "unsupported",
  });
}

export async function assertResourceUnchanged(expected) {
  const current = await inspectResource(expected.path, expected.label);
  if (current.exists !== expected.exists || current.identity !== expected.identity || current.kind !== expected.kind) {
    throw new OwnershipError(`${expected.label} changed after plan creation`);
  }
  return current;
}

export async function writeOwnedJSON(path, value, { root }) {
  const target = ownedPath(root, path, "JSON target");
  await rejectSymlinkComponents(root, dirname(target));
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
    if (process.platform !== "win32") await chmod(target, 0o600);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function readOwnedJSON(path, { root, validate }) {
  const target = ownedPath(root, path, "JSON target");
  let text;
  try {
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024) throw new OwnershipError("owned JSON must be a bounded regular file");
    text = await readFile(target, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new OwnershipError("owned JSON is invalid", { cause: error });
  }
  return validate(value);
}

export async function writeProfileReceipt(paths, receipt) {
  validateProfileReceipt(receipt);
  await ensureManagerDirectories(paths);
  await writeOwnedJSON(profileReceiptPath(paths, receipt.profile), receipt, { root: paths.managerRoot });
}

export async function removeProfileReceipt(paths, profile) {
  await unlink(profileReceiptPath(paths, profile)).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
}

export async function listProfileReceipts(paths) {
  let names;
  try {
    names = await readdir(paths.profilesDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const receipts = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) throw new OwnershipError("profiles directory contains an unknown file");
    const receipt = await readOwnedJSON(join(paths.profilesDirectory, name), {
      root: paths.managerRoot,
      validate: validateProfileReceipt,
    });
    receipts.push(receipt);
  }
  return receipts;
}

export async function moveTargetsToTrash(paths, targets, { now = () => new Date(), random = () => randomBytes(6).toString("hex") } = {}) {
  const trashAnchor = paths.platform === "win32" ? paths.applicationDataInspectionRoot : paths.homeDirectory;
  await rejectSymlinkComponents(trashAnchor, paths.trashDirectory);
  await mkdir(paths.trashDirectory, { recursive: true, mode: 0o700 });
  await rejectSymlinkComponents(trashAnchor, paths.trashDirectory);
  const stamp = now().toISOString().replace(/[:.]/gu, "-");
  const trashRoot = ownedPath(paths.trashDirectory, join(paths.trashDirectory, `create-dev-flow-${stamp}-${random()}`), "Trash root");
  await mkdir(trashRoot, { mode: 0o700 });
  const moved = [];
  try {
    for (const target of targets) {
      if (!target.exists) continue;
      await assertResourceUnchanged(target);
      const destination = ownedPath(trashRoot, join(trashRoot, safeLabel(target.label)), "Trash target");
      await rename(target.path, destination);
      moved.push({ label: target.label, source: target.path, destination });
    }
    return { trashRoot, moved };
  } catch (error) {
    throw new CleanupPartialError("recoverable cleanup stopped", { cause: error, trashRoot, moved });
  }
}

export async function permanentlyRemoveTargets(targets, { allowedPaths }) {
  const allowed = new Set(allowedPaths.map(resolve));
  const removed = [];
  for (const target of targets) {
    if (!target.exists) continue;
    if (!allowed.has(resolve(target.path))) throw new OwnershipError(`${target.label} is not in the confirmed cleanup set`);
    await assertResourceUnchanged(target);
    await rm(target.path, { recursive: target.kind === "directory", force: false });
    removed.push({ label: target.label, path: target.path });
  }
  return removed;
}

export function planDigest(value) {
  return createHash("sha256").update(stableJSON(value)).digest("hex");
}

export function validateProfileReceipt(value) {
  assertExactKeys(value, ["profile", "package_name", "installed_version", "origin", "dsh_version", "created_at", "updated_at"], "Profile receipt");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.profile) || value.package_name !== "dev-flow-deepseek") {
    throw new OwnershipError("Profile receipt identity is invalid");
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value.installed_version)) throw new OwnershipError("Profile receipt version is invalid");
  if (!["installed", "adopted_by_reinstall"].includes(value.origin) || typeof value.dsh_version !== "string" || value.dsh_version === "") {
    throw new OwnershipError("Profile receipt owner facts are invalid");
  }
  for (const field of ["created_at", "updated_at"]) if (!Number.isFinite(Date.parse(value[field]))) throw new OwnershipError(`Profile receipt ${field} is invalid`);
  return structuredClone(value);
}

export class OwnershipError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OwnershipError";
    this.exitCode = 4;
  }
}

export class CleanupPartialError extends Error {
  constructor(message, { cause, trashRoot, moved }) {
    super(message, { cause });
    this.name = "CleanupPartialError";
    this.exitCode = 5;
    this.trashRoot = trashRoot;
    this.moved = moved;
  }
}

function profileReceiptPath(paths, profile) {
  const filename = `${createHash("sha256").update(profile).digest("hex")}.json`;
  return ownedPath(paths.profilesDirectory, join(paths.profilesDirectory, filename), "Profile receipt");
}

function safeLabel(value) {
  return value.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "") || "resource";
}

function ownedPath(root, candidate, label) {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = resolve(candidate);
  const offset = relative(canonicalRoot, canonicalCandidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new OwnershipError(`${label} escapes its owned root`);
  return canonicalCandidate;
}

async function canonicalExistingDirectory(path, label) {
  if (!isAbsolute(path)) throw new OwnershipError(`${label} must be absolute`);
  try {
    const canonical = await realpath(path);
    if (!(await stat(canonical)).isDirectory()) throw new Error("not a directory");
    return canonical;
  } catch (error) {
    throw new OwnershipError(`${label} must name an existing directory`, { cause: error });
  }
}

async function canonicalExplicitDirectory(path) {
  if (!isAbsolute(path)) throw new OwnershipError(`${DATA_DIRECTORY_ENVIRONMENT} must be absolute`);
  const canonical = await canonicalExistingDirectory(path, DATA_DIRECTORY_ENVIRONMENT);
  if (canonical !== resolve(path)) throw new OwnershipError(`${DATA_DIRECTORY_ENVIRONMENT} must be canonical and non-symlink`);
  return canonical;
}

async function rejectSymlinkComponents(root, candidate) {
  const canonicalRoot = resolve(root);
  const target = ownedPath(canonicalRoot, candidate, "owned path");
  const parts = relative(canonicalRoot, target).split(sep).filter(Boolean);
  let current = canonicalRoot;
  for (const part of parts) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new OwnershipError(`owned path contains a symbolic link: ${current}`);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function assertExactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new OwnershipError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new OwnershipError(`${label} fields are invalid`);
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
