import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const digestPattern = /^[0-9a-f]{64}$/u;
const commitPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const launchIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const repositoryKeyPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const remoteNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export const PROVISIONING_PHASES = Object.freeze([
  "confirmed",
  "fetching",
  "fetched",
  "dispatching",
  "provisioning",
  "queued",
  "dispatched",
  "provisioned",
  "failed",
  "uncertain",
  "handoff_dispatching",
  "handoff_pending",
  "handoff_succeeded",
  "handoff_failed",
  "worktree_removed",
  "branch_removed",
]);

const cleanupStates = Object.freeze(["not_requested", "requested", "completed", "failed"]);
const phaseTransitions = Object.freeze({
  confirmed: Object.freeze(["confirmed", "fetching", "failed"]),
  fetching: Object.freeze(["fetching", "fetched", "failed", "uncertain"]),
  fetched: Object.freeze(["fetched", "dispatching", "provisioning", "failed", "uncertain"]),
  dispatching: Object.freeze(["dispatching", "queued", "dispatched", "provisioning", "failed", "uncertain"]),
  queued: Object.freeze(["queued", "dispatched", "provisioning", "failed", "uncertain"]),
  dispatched: Object.freeze(["dispatched", "provisioning", "failed", "uncertain"]),
  provisioning: Object.freeze(["provisioning", "provisioned", "failed", "uncertain"]),
  provisioned: Object.freeze(["provisioned", "handoff_dispatching", "worktree_removed"]),
  uncertain: Object.freeze(["uncertain", "dispatched", "provisioning", "provisioned", "handoff_pending", "failed"]),
  failed: Object.freeze(["failed"]),
  handoff_dispatching: Object.freeze(["handoff_dispatching", "handoff_pending", "handoff_failed", "uncertain"]),
  handoff_pending: Object.freeze(["handoff_pending", "handoff_succeeded", "handoff_failed", "uncertain"]),
  handoff_succeeded: Object.freeze(["handoff_succeeded", "handoff_dispatching", "worktree_removed"]),
  handoff_failed: Object.freeze(["handoff_failed", "handoff_dispatching", "worktree_removed"]),
  worktree_removed: Object.freeze(["worktree_removed", "branch_removed"]),
  branch_removed: Object.freeze(["branch_removed"]),
});

export function createProvisioningReceipt({
  launchId,
  requestDigest,
  sourceRepositoryIdentity,
  repositoryKey,
  remoteName,
  baseBranch,
  targetBranch,
  worktreePath = null,
  surface,
  createdAt = new Date().toISOString(),
} = {}) {
  return validateProvisioningReceipt({
    launch_id: launchId,
    host: "codex",
    request_digest: requestDigest,
    source_repository_identity: sourceRepositoryIdentity,
    repository_key: repositoryKey,
    remote_name: remoteName,
    base_branch: baseBranch,
    target_branch: targetBranch,
    fetched_commit: null,
    worktree_path: worktreePath,
    operation_status: {
      phase: "confirmed",
      surface,
      dispatch_attempt_id: null,
      host_thread_id: null,
      host_client_thread_id: null,
      host_operation_id: null,
      host_operation_revision: null,
      relocation_id: null,
      worktree_cleanup: "not_requested",
      branch_cleanup: "not_requested",
    },
    created_at: createdAt,
  });
}

export function validateProvisioningReceipt(value) {
  assertExactKeys(value, [
    "launch_id",
    "host",
    "request_digest",
    "source_repository_identity",
    "repository_key",
    "remote_name",
    "base_branch",
    "target_branch",
    "fetched_commit",
    "worktree_path",
    "operation_status",
    "created_at",
  ], "provisioning receipt");
  assertLaunchID(value.launch_id);
  if (value.host !== "codex") throw new Error("provisioning receipt host must equal codex");
  if (!digestPattern.test(value.request_digest)) throw new Error("provisioning receipt request_digest is invalid");
  if (!digestPattern.test(value.source_repository_identity)) {
    throw new Error("provisioning receipt source_repository_identity is invalid");
  }
  if (!repositoryKeyPattern.test(value.repository_key)) throw new Error("provisioning receipt repository_key is invalid");
  if (!remoteNamePattern.test(value.remote_name)) throw new Error("provisioning receipt remote_name is invalid");
  assertBranchText(value.base_branch, "base_branch");
  assertBranchText(value.target_branch, "target_branch");
  if (value.fetched_commit !== null && !commitPattern.test(value.fetched_commit)) {
    throw new Error("provisioning receipt fetched_commit is invalid");
  }
  if (value.worktree_path !== null) assertNormalizedAbsolutePath(value.worktree_path, "worktree_path");
  validateOperationStatus(value.operation_status);
  if (!Number.isFinite(Date.parse(value.created_at))) throw new Error("provisioning receipt created_at is invalid");
  if (!["confirmed", "fetching", "failed"].includes(value.operation_status.phase) && value.fetched_commit === null) {
    throw new Error("provisioning receipt phase requires fetched_commit");
  }
  if (["provisioning", "provisioned", "handoff_dispatching", "handoff_pending", "handoff_succeeded", "handoff_failed"].includes(value.operation_status.phase) && value.worktree_path === null) {
    throw new Error("provisioning receipt phase requires worktree_path");
  }
  return structuredClone(value);
}

export function provisioningReceiptPath(productSupportRoot, launchId, repositoryKey) {
  assertNormalizedAbsolutePath(productSupportRoot, "product support root");
  assertLaunchID(launchId);
  if (!repositoryKeyPattern.test(repositoryKey)) throw new Error("repository_key is invalid");
  const root = join(productSupportRoot, "provisioning", "codex");
  return containedPath(root, join(root, launchId, `${repositoryKey}.json`));
}

export async function readProvisioningReceipt(path, { productSupportRoot } = {}) {
  const expectedRoot = receiptRoot(productSupportRoot);
  containedPath(expectedRoot, path);
  await assertNoSymbolicLinkComponents(productSupportRoot, dirname(path));
  await rejectSymbolicLink(path);
  let contents;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("read provisioning receipt", { cause: error });
  }
  try {
    return validateProvisioningReceipt(JSON.parse(contents));
  } catch (error) {
    throw new Error(`invalid provisioning receipt: ${error.message}`, { cause: error });
  }
}

export async function writeProvisioningReceiptAtomic(path, receipt, {
  productSupportRoot,
  enforcePrivateModes = true,
  createOnly = false,
} = {}) {
  const expectedRoot = receiptRoot(productSupportRoot);
  containedPath(expectedRoot, path);
  const validated = validateProvisioningReceipt(receipt);
  const expectedPath = provisioningReceiptPath(
    productSupportRoot,
    validated.launch_id,
    validated.repository_key,
  );
  if (path !== expectedPath) throw new Error("provisioning receipt path does not match its identity");
  await ensureOwnedDirectory(productSupportRoot, enforcePrivateModes);
  await ensureOwnedDirectory(join(productSupportRoot, "provisioning"), enforcePrivateModes, productSupportRoot);
  await ensureOwnedDirectory(expectedRoot, enforcePrivateModes, productSupportRoot);
  const parent = dirname(path);
  await ensureOwnedDirectory(parent, enforcePrivateModes, productSupportRoot);
  await rejectSymbolicLink(path);
  if (createOnly) {
    try {
      await lstat(path);
      const conflict = new Error("provisioning receipt already exists");
      conflict.code = "EEXIST";
      throw conflict;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const temporaryPath = join(parent, `.${basename(path)}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, path);
    if (enforcePrivateModes) await chmod(path, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return validated;
}

export async function withProvisioningReceiptLock(
  path,
  { productSupportRoot, enforcePrivateModes = true } = {},
  operation,
) {
  if (typeof operation !== "function") throw new Error("provisioning receipt lock operation is required");
  const expectedRoot = receiptRoot(productSupportRoot);
  containedPath(expectedRoot, path);
  const parent = dirname(path);
  await ensureOwnedDirectory(productSupportRoot, enforcePrivateModes);
  await ensureOwnedDirectory(join(productSupportRoot, "provisioning"), enforcePrivateModes, productSupportRoot);
  await ensureOwnedDirectory(expectedRoot, enforcePrivateModes, productSupportRoot);
  await ensureOwnedDirectory(parent, enforcePrivateModes, productSupportRoot);
  const lockPath = `${path}.lock`;
  containedPath(expectedRoot, lockPath);
  const handle = await acquireReceiptLock(lockPath, enforcePrivateModes);
  try {
    return await operation();
  } finally {
    await handle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}

async function acquireReceiptLock(lockPath, enforcePrivateModes, reclaimAttempted = false) {
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })}\n`, "utf8");
    await handle.sync();
    if (enforcePrivateModes) await chmod(lockPath, 0o600);
    return handle;
  } catch (error) {
    await handle?.close().catch(() => {});
    if (handle !== undefined) await unlink(lockPath).catch(() => {});
    if (error?.code !== "EEXIST" || reclaimAttempted) {
      if (error?.code === "EEXIST") {
        throw lockedReceiptError();
      }
      throw error;
    }
  }

  let retained;
  try {
    const info = await lstat(lockPath);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("provisioning lock is not a regular file");
    retained = JSON.parse(await readFile(lockPath, "utf8"));
  } catch (error) {
    throw new Error("inspect existing provisioning lock", { cause: error });
  }
  if (!Number.isSafeInteger(retained?.pid) || retained.pid <= 0 || typeof retained.created_at !== "string") {
    throw new Error("existing provisioning lock is invalid; read the receipt instead");
  }
  if (processIsAlive(retained.pid)) {
    throw lockedReceiptError();
  }
  await unlink(lockPath);
  return await acquireReceiptLock(lockPath, enforcePrivateModes, true);
}

function lockedReceiptError() {
  const error = new Error("provisioning operation is already in progress; read the receipt instead");
  error.code = "ELOCKED";
  return error;
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

export function updateProvisioningReceipt(receipt, patch) {
  const current = validateProvisioningReceipt(receipt);
  assertExactKeys(patch, ["phase", "values"], "provisioning receipt update");
  if (!PROVISIONING_PHASES.includes(patch.phase)) throw new Error("provisioning receipt update phase is invalid");
  if (!phaseTransitions[current.operation_status.phase].includes(patch.phase)) {
    throw new Error(`invalid provisioning phase transition ${current.operation_status.phase} -> ${patch.phase}`);
  }
  if (patch.values === null || typeof patch.values !== "object" || Array.isArray(patch.values)) {
    throw new Error("provisioning receipt update values must be an object");
  }
  const allowed = new Set([
    "fetched_commit", "worktree_path", "dispatch_attempt_id", "host_thread_id",
    "host_client_thread_id", "host_operation_id", "host_operation_revision", "relocation_id",
    "worktree_cleanup", "branch_cleanup",
  ]);
  for (const key of Object.keys(patch.values)) {
    if (!allowed.has(key)) throw new Error(`provisioning receipt update cannot change ${key}`);
  }
  const next = structuredClone(current);
  for (const field of ["fetched_commit", "worktree_path"]) {
    if (Object.hasOwn(patch.values, field)) next[field] = patch.values[field];
  }
  next.operation_status.phase = patch.phase;
  for (const [field, value] of Object.entries(patch.values)) {
    if (field !== "fetched_commit" && field !== "worktree_path") next.operation_status[field] = value;
  }
  return validateProvisioningReceipt(next);
}

function validateOperationStatus(value) {
  assertExactKeys(value, [
    "phase", "surface", "dispatch_attempt_id", "host_thread_id", "host_client_thread_id",
    "host_operation_id", "host_operation_revision", "relocation_id", "worktree_cleanup", "branch_cleanup",
  ], "provisioning operation_status");
  if (!PROVISIONING_PHASES.includes(value.phase)) throw new Error("provisioning operation phase is invalid");
  if (!["managed_worktree", "cli_worktree"].includes(value.surface)) {
    throw new Error("provisioning surface is invalid");
  }
  for (const field of [
    "dispatch_attempt_id", "host_thread_id", "host_client_thread_id", "host_operation_id", "relocation_id",
  ]) {
    if (value[field] !== null) assertIdentifier(value[field], `operation_status.${field}`);
  }
  if (value.host_operation_revision !== null && (!Number.isSafeInteger(value.host_operation_revision) || value.host_operation_revision < 0)) {
    throw new Error("operation_status.host_operation_revision is invalid");
  }
  if (!cleanupStates.includes(value.worktree_cleanup) || !cleanupStates.includes(value.branch_cleanup)) {
    throw new Error("provisioning cleanup state is invalid");
  }
}

function receiptRoot(productSupportRoot) {
  assertNormalizedAbsolutePath(productSupportRoot, "product support root");
  return join(productSupportRoot, "provisioning", "codex");
}

async function ensureOwnedDirectory(path, enforcePrivateModes, boundary = path) {
  containedPath(boundary, path);
  await assertNoSymbolicLinkComponents(boundary, path);
  await mkdir(path, { recursive: true, mode: 0o700 });
  await assertNoSymbolicLinkComponents(boundary, path);
  const canonical = await realpath(path);
  if (canonical !== path) throw new Error("provisioning directory must be canonical");
  if (enforcePrivateModes) await chmod(path, 0o700);
}

async function assertNoSymbolicLinkComponents(root, candidate) {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = containedPath(canonicalRoot, candidate);
  const components = relative(canonicalRoot, canonicalCandidate).split(sep).filter(Boolean);
  let current = canonicalRoot;
  for (const component of components) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("provisioning path contains a symbolic link");
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

async function rejectSymbolicLink(path) {
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new Error("provisioning receipt must not be a symbolic link");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function containedPath(root, candidate) {
  const canonicalRoot = resolve(root);
  const canonicalCandidate = resolve(candidate);
  const offset = relative(canonicalRoot, canonicalCandidate);
  if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new Error("provisioning receipt escapes its owned root");
  }
  return canonicalCandidate;
}

function assertExactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has an invalid closed shape`);
}

function assertIdentifier(value, label) {
  if (typeof value !== "string" || !identifierPattern.test(value)) throw new Error(`${label} is invalid`);
}

function assertLaunchID(value) {
  if (typeof value !== "string" || !launchIdPattern.test(value)) throw new Error("launch_id is invalid");
}

function assertBranchText(value, label) {
  if (typeof value !== "string" || value === "" || value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`provisioning receipt ${label} is invalid`);
  }
}

function assertNormalizedAbsolutePath(value, label) {
  if (typeof value !== "string" || value.includes("\0") || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a normalized absolute path`);
  }
}
