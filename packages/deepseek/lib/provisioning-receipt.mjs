import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_RECEIPT_BYTES = 256 * 1024;
const receiptStatuses = new Set(["confirmed", "fetching", "fetched", "provisioning", "provisioned", "consumed", "cleaned", "failed", "uncertain"]);
const repositoryStatuses = new Set(["confirmed", "fetching", "fetched", "provisioning", "provisioned", "consumed", "worktree_removed", "branch_removed", "failed", "uncertain"]);

// One launch envelope groups the per-repository provisioning facts needed for
// all-or-nothing Core admission. It is an operation receipt, not a Task cursor.

export function provisioningReceiptPath(dataDirectory, launchID) {
  assertLaunchID(launchID);
  const root = provisioningReceiptDirectory(dataDirectory);
  return containedPath(root, join(root, `${launchID}.json`), "provisioning receipt");
}

export async function writeProvisioningReceipt(dataDirectory, receipt) {
  const validated = validateProvisioningReceipt(receipt);
  const root = provisioningReceiptDirectory(dataDirectory);
  await rejectSymlinkComponents(dataDirectory, root);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await rejectSymlinkComponents(dataDirectory, root);
  const target = provisioningReceiptPath(dataDirectory, validated.launch_id);
  const temporary = join(root, `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
    if (process.platform !== "win32") await chmod(target, 0o600);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return validated;
}

export async function readProvisioningReceipt(dataDirectory, launchID) {
  const target = provisioningReceiptPath(dataDirectory, launchID);
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_RECEIPT_BYTES) {
    throw new Error("provisioning receipt must be a bounded regular file");
  }
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error("provisioning receipt permissions are too broad");
  }
  const canonical = await realpath(target);
  if (canonical !== resolve(target)) throw new Error("provisioning receipt must be canonical");
  let value;
  try {
    value = JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    throw new Error("provisioning receipt is invalid", { cause: error });
  }
  return validateProvisioningReceipt(value);
}

export function validateProvisioningReceipt(value) {
  assertExactKeys(value, [
    "launch_id", "host", "request_digest", "profile", "workspace_root",
    "operation_status", "repositories", "created_at", "updated_at",
  ], "provisioning receipt");
  assertLaunchID(value.launch_id);
  if (value.host !== "deepseek") throw new Error("provisioning receipt host is invalid");
  assertDigest(value.request_digest, "request digest");
  if (typeof value.profile !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.profile)) {
    throw new Error("provisioning receipt profile is invalid");
  }
  if (typeof value.workspace_root !== "string" || !isAbsolute(value.workspace_root)) {
    throw new Error("provisioning receipt workspace root is invalid");
  }
  if (!receiptStatuses.has(value.operation_status)) throw new Error("provisioning receipt status is invalid");
  if (!Array.isArray(value.repositories) || value.repositories.length < 1 || value.repositories.length > 8) {
    throw new Error("provisioning receipt repository count is invalid");
  }
  const keys = new Set();
  const paths = new Set();
  for (const repository of value.repositories) {
    validateRepositoryReceipt(repository);
    if (keys.has(repository.repository_key) || paths.has(repository.worktree_path)) {
      throw new Error("provisioning receipt repositories must be unique");
    }
    keys.add(repository.repository_key);
    paths.add(repository.worktree_path);
  }
  if (!Number.isFinite(Date.parse(value.created_at)) || !Number.isFinite(Date.parse(value.updated_at))) {
    throw new Error("provisioning receipt timestamps are invalid");
  }
  return structuredClone(value);
}

function validateRepositoryReceipt(value) {
  assertExactKeys(value, [
    "source_repository_identity", "repository_key", "remote_name",
    "base_branch", "target_branch", "fetched_commit", "worktree_path", "operation_status", "created_at",
  ], "provisioning repository receipt");
  assertDigest(value.source_repository_identity, "source repository identity");
  if (typeof value.repository_key !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.repository_key)) {
    throw new Error("provisioning repository key is invalid");
  }
  for (const field of ["worktree_path"]) {
    if (typeof value[field] !== "string" || !isAbsolute(value[field])) throw new Error(`provisioning ${field} is invalid`);
  }
  for (const field of ["remote_name", "base_branch", "target_branch"]) {
    if (typeof value[field] !== "string" || value[field] === "" || value[field].length > 255 || /[\0\r\n;=]/u.test(value[field])) {
      throw new Error(`provisioning ${field} is invalid`);
    }
  }
  if (value.fetched_commit !== null && (typeof value.fetched_commit !== "string" || !/^[0-9a-f]{40,64}$/u.test(value.fetched_commit))) {
    throw new Error("provisioning fetched commit is invalid");
  }
  if (!repositoryStatuses.has(value.operation_status)) throw new Error("provisioning repository status is invalid");
  if (!Number.isFinite(Date.parse(value.created_at))) throw new Error("provisioning repository timestamp is invalid");
}

function provisioningReceiptDirectory(dataDirectory) {
  const root = resolve(dataDirectory);
  return containedPath(root, join(root, "host-operations", "deepseek", "provisioning"), "provisioning receipt directory");
}

function assertLaunchID(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/u.test(value)) throw new Error("provisioning launch identity is invalid");
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(`${label} is invalid`);
}

function assertExactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) throw new Error(`${label} fields are invalid`);
}

function containedPath(root, candidate, label) {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = resolve(candidate);
  const offset = relative(canonicalRoot, canonicalCandidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error(`${label} escapes its owned root`);
  }
  return canonicalCandidate;
}

async function rejectSymlinkComponents(root, candidate) {
  const canonicalRoot = resolve(root);
  const target = containedPath(canonicalRoot, candidate, "receipt path");
  const parts = relative(canonicalRoot, target).split(sep).filter(Boolean);
  let current = canonicalRoot;
  for (const part of parts) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`receipt path contains a symbolic link: ${current}`);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}
