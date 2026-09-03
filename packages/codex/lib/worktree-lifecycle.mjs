import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const commitPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const remoteNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export async function inspectSourceRepository(repositoryPath, { runGit = defaultRunGit } = {}) {
  assertAbsolutePath(repositoryPath, "repository_path");
  const requested = resolve(repositoryPath);
  const root = await canonicalGitPath(
    await runGit(["-C", requested, "rev-parse", "--show-toplevel"]),
    "repository root",
  );
  const commonDir = await canonicalGitPath(
    await runGit(["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"]),
    "Git common directory",
  );
  const gitDir = await canonicalGitPath(
    await runGit(["-C", root, "rev-parse", "--path-format=absolute", "--git-dir"]),
    "worktree Git directory",
  );
  const head = singleLine(await runGit(["-C", root, "rev-parse", "--verify", "HEAD"]));
  assertCommit(head, "HEAD");
  const branch = await currentBranch(root, runGit);
  const status = asBuffer(await runGit([
    "-C", root, "status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none",
  ], { encoding: "buffer" }));
  return Object.freeze({
    canonical_root: root,
    git_common_dir: commonDir,
    worktree_git_dir: gitDir,
    source_repository_identity: createHash("sha256").update(`dev-flow/source-repository\0${commonDir}`).digest("hex"),
    head,
    branch,
    clean: status.length === 0,
    status_digest: createHash("sha256").update(status).digest("hex"),
  });
}

export async function preflightWorktreeSelection({
  repositoryPath,
  remoteName,
  baseBranch,
  targetBranch,
  runGit = defaultRunGit,
} = {}) {
  const source = await inspectSourceRepository(repositoryPath, { runGit });
  assertRemoteName(remoteName);
  await validateBranchName(baseBranch, runGit, source.canonical_root, "base branch");
  await validateBranchName(targetBranch, runGit, source.canonical_root, "target branch");
  const remotes = lines(await runGit(["-C", source.canonical_root, "remote"]));
  if (!remotes.includes(remoteName)) throw new Error(`remote ${remoteName} does not exist`);
  if (await refExists(source.canonical_root, `refs/heads/${targetBranch}`, runGit)) {
    throw new Error(`target branch ${targetBranch} already exists locally`);
  }
  const worktrees = String(await runGit(["-C", source.canonical_root, "worktree", "list", "--porcelain", "-z"]));
  if (worktrees.split("\0").some((entry) => entry === `branch refs/heads/${targetBranch}`)) {
    throw new Error(`target branch ${targetBranch} is already used by a worktree`);
  }
  if (await remoteBranchExists(source.canonical_root, remoteName, targetBranch, runGit)) {
    throw new Error(`target branch ${targetBranch} already exists on remote ${remoteName}`);
  }
  return source;
}

export async function fetchFrozenBase({
  repositoryPath,
  remoteName,
  baseBranch,
  runGit = defaultRunGit,
} = {}) {
  const source = await inspectSourceRepository(repositoryPath, { runGit });
  assertRemoteName(remoteName);
  await validateBranchName(baseBranch, runGit, source.canonical_root, "base branch");
  const remoteRef = `refs/remotes/${remoteName}/${baseBranch}`;
  await runGit([
    "-C",
    source.canonical_root,
    "fetch",
    "--no-tags",
    remoteName,
    `refs/heads/${baseBranch}:${remoteRef}`,
  ]);
  const commit = singleLine(await runGit([
    "-C", source.canonical_root, "rev-parse", "--verify", `${remoteRef}^{commit}`,
  ]));
  assertCommit(commit, "fetched commit");
  return Object.freeze({ ...source, remote_ref: remoteRef, fetched_commit: commit });
}

export async function createCliWorktree({
  repositoryPath,
  worktreePath,
  fetchedCommit,
  targetBranch,
  sourceRepositoryIdentity,
  runGit = defaultRunGit,
} = {}) {
  const source = await inspectSourceRepository(repositoryPath, { runGit });
  if (source.source_repository_identity !== sourceRepositoryIdentity) {
    throw new Error("source repository identity changed before worktree creation");
  }
  assertCommit(fetchedCommit, "fetched commit");
  assertAbsolutePath(worktreePath, "worktree_path");
  const worktreeRoot = resolve(worktreePath);
  const offset = relative(source.canonical_root, worktreeRoot);
  if (offset === "" || (offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset))) {
    throw new Error("CLI task worktree must not be nested inside the source checkout");
  }
  await validateBranchName(targetBranch, runGit, source.canonical_root, "target branch");
  if (await pathExists(worktreeRoot)) throw new Error("worktree path already exists");
  if (await refExists(source.canonical_root, `refs/heads/${targetBranch}`, runGit)) {
    throw new Error(`target branch ${targetBranch} already exists locally`);
  }
  await runGit(["-C", source.canonical_root, "worktree", "add", "--detach", worktreeRoot, fetchedCommit]);
  return await initializeManagedWorktree({
    sourceRepositoryPath: source.canonical_root,
    worktreePath: worktreeRoot,
    fetchedCommit,
    targetBranch,
    sourceRepositoryIdentity,
    runGit,
  });
}

export async function initializeManagedWorktree({
  sourceRepositoryPath = null,
  worktreePath,
  fetchedCommit,
  targetBranch,
  sourceRepositoryIdentity,
  runGit = defaultRunGit,
} = {}) {
  const source = sourceRepositoryPath === null ? null : await inspectSourceRepository(sourceRepositoryPath, { runGit });
  if (source !== null && source.source_repository_identity !== sourceRepositoryIdentity) {
    throw new Error("managed worktree belongs to a different repository group");
  }
  assertCommit(fetchedCommit, "fetched commit");
  const validationRoot = source?.canonical_root ?? resolve(worktreePath);
  await validateBranchName(targetBranch, runGit, validationRoot, "target branch");
  const before = await verifyTaskWorktree({
    sourceRepositoryPath: source?.canonical_root ?? null,
    worktreePath,
    fetchedCommit,
    sourceRepositoryIdentity,
    expectedBranch: null,
    runGit,
  });
  if (await refExists(before.canonical_root, `refs/heads/${targetBranch}`, runGit)) {
    throw new Error(`target branch ${targetBranch} already exists locally`);
  }
  await runGit(["-C", before.canonical_root, "switch", "--no-track", "-c", targetBranch]);
  return await verifyTaskWorktree({
    sourceRepositoryPath: source?.canonical_root ?? null,
    worktreePath: before.canonical_root,
    fetchedCommit,
    sourceRepositoryIdentity,
    expectedBranch: targetBranch,
    runGit,
  });
}

export async function verifyTaskWorktree({
  sourceRepositoryPath = null,
  worktreePath,
  fetchedCommit,
  sourceRepositoryIdentity,
  expectedBranch,
  runGit = defaultRunGit,
} = {}) {
  const source = sourceRepositoryPath === null ? null : await inspectSourceRepository(sourceRepositoryPath, { runGit });
  const worktree = await inspectSourceRepository(worktreePath, { runGit });
  if ((source !== null && source.source_repository_identity !== sourceRepositoryIdentity) || worktree.source_repository_identity !== sourceRepositoryIdentity) {
    throw new Error("worktree repository group does not match the confirmed source");
  }
  if (source !== null && source.canonical_root === worktree.canonical_root) throw new Error("task worktree must differ from the source checkout");
  if ((source !== null && source.worktree_git_dir === worktree.worktree_git_dir) || worktree.worktree_git_dir === worktree.git_common_dir) {
    throw new Error("task worktree must have a distinct Git directory");
  }
  if (worktree.head !== fetchedCommit) throw new Error("task worktree HEAD does not equal the frozen base commit");
  if (!worktree.clean) throw new Error("task worktree must be clean before Core Task creation");
  if (expectedBranch !== null && worktree.branch !== expectedBranch) {
    throw new Error("task worktree is not on the confirmed target branch");
  }
  return worktree;
}

export async function removeCliWorktree({
  repositoryPath,
  worktreePath,
  sourceRepositoryIdentity,
  terminal,
  authorized,
  runGit = defaultRunGit,
} = {}) {
  if (terminal !== true || authorized !== true) throw new Error("worktree cleanup requires terminal state and explicit authorization");
  const source = await inspectSourceRepository(repositoryPath, { runGit });
  const worktree = await inspectSourceRepository(worktreePath, { runGit });
  if (source.source_repository_identity !== sourceRepositoryIdentity || worktree.source_repository_identity !== sourceRepositoryIdentity) {
    throw new Error("cleanup worktree does not belong to the receipt repository group");
  }
  if (source.canonical_root === worktree.canonical_root || !worktree.clean) {
    throw new Error("only a clean dedicated worktree can be removed");
  }
  await runGit(["-C", source.canonical_root, "worktree", "remove", worktree.canonical_root]);
}

export async function removeTaskBranch({
  repositoryPath,
  targetBranch,
  sourceRepositoryIdentity,
  terminal,
  authorized,
  runGit = defaultRunGit,
} = {}) {
  if (terminal !== true || authorized !== true) throw new Error("branch cleanup requires separate explicit authorization");
  const source = await inspectSourceRepository(repositoryPath, { runGit });
  if (source.source_repository_identity !== sourceRepositoryIdentity) {
    throw new Error("cleanup branch does not belong to the receipt repository group");
  }
  await validateBranchName(targetBranch, runGit, source.canonical_root, "target branch");
  await runGit(["-C", source.canonical_root, "branch", "-d", targetBranch]);
}

export function terminalCleanupDecision({
  lifecycle,
  surface,
  clean,
  pushed,
  stateCertain,
} = {}) {
  if (!["DONE", "CANCELLED"].includes(lifecycle)) {
    return Object.freeze({ automatic_cleanup: false, worktree_cleanup: "blocked_active", branch_cleanup: "blocked_active" });
  }
  if (stateCertain !== true) {
    return Object.freeze({ automatic_cleanup: false, worktree_cleanup: "blocked_uncertain", branch_cleanup: "blocked_uncertain" });
  }
  if (clean !== true) {
    return Object.freeze({ automatic_cleanup: false, worktree_cleanup: "requires_dirty_review", branch_cleanup: "requires_dirty_review" });
  }
  return Object.freeze({
    automatic_cleanup: false,
    worktree_cleanup: surface === "managed_worktree" ? "host_authorization_required" : "separate_authorization_required",
    branch_cleanup: pushed === true ? "separate_authorization_required" : "requires_unpushed_review",
  });
}

async function validateBranchName(value, runGit, root, label) {
  if (typeof value !== "string" || value === "" || value.includes("\0") || value.startsWith("-")) {
    throw new Error(`${label} is invalid`);
  }
  await runGit(["-C", root, "check-ref-format", "--branch", value]);
}

async function refExists(root, ref, runGit) {
  try {
    await runGit(["-C", root, "show-ref", "--verify", "--quiet", ref]);
    return true;
  } catch (error) {
    if (numericExitCode(error) === 1) return false;
    throw error;
  }
}

async function remoteBranchExists(root, remoteName, branch, runGit) {
  try {
    await runGit(["-C", root, "ls-remote", "--exit-code", "--heads", remoteName, `refs/heads/${branch}`]);
    return true;
  } catch (error) {
    if (numericExitCode(error) === 2) return false;
    throw error;
  }
}

async function currentBranch(root, runGit) {
  try {
    return singleLine(await runGit(["-C", root, "symbolic-ref", "--quiet", "--short", "HEAD"]));
  } catch (error) {
    if (numericExitCode(error) === 1) return null;
    throw error;
  }
}

async function canonicalGitPath(value, label) {
  const path = singleLine(value);
  if (!isAbsolute(path)) throw new Error(`${label} must be absolute`);
  const canonical = await realpath(path);
  if (canonical !== resolve(path)) throw new Error(`${label} must be canonical`);
  return canonical;
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function defaultRunGit(arguments_, { encoding = "utf8" } = {}) {
  if (!Array.isArray(arguments_) || arguments_.some((entry) => typeof entry !== "string" || entry.includes("\0"))) {
    throw new Error("Git arguments must be a closed string array");
  }
  try {
    const { stdout } = await execFile("git", arguments_, {
      encoding: encoding === "buffer" ? null : encoding,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 60_000,
      windowsHide: true,
    });
    return stdout;
  } catch (cause) {
    const error = new Error(`Git ${gitOperation(arguments_)} failed${cause?.killed ? " or timed out" : ""}`);
    error.code = cause?.code;
    throw error;
  }
}

function gitOperation(arguments_) {
  const offset = arguments_[0] === "-C" ? 2 : 0;
  const value = arguments_[offset] ?? "command";
  return /^[a-z-]+$/u.test(value) ? value : "command";
}

function assertRemoteName(value) {
  if (typeof value !== "string" || !remoteNamePattern.test(value)) throw new Error("remote name is invalid");
}

function assertCommit(value, label) {
  if (typeof value !== "string" || !commitPattern.test(value)) throw new Error(`${label} is not a complete Git commit`);
}

function assertAbsolutePath(value, label) {
  if (typeof value !== "string" || value.includes("\0") || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a normalized absolute path`);
  }
}

function singleLine(value) {
  const result = String(value).replace(/\r?\n$/u, "");
  if (result === "" || result.includes("\0") || result.includes("\n") || result.includes("\r")) {
    throw new Error("Git returned an invalid single-line value");
  }
  return result;
}

function lines(value) {
  return String(value).split(/\r?\n/u).filter(Boolean);
}

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function numericExitCode(error) {
  return typeof error?.code === "number" ? error.code : Number(error?.code);
}
