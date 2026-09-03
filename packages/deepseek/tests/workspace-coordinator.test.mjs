import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { readProvisioningReceipt } from "../lib/provisioning-receipt.mjs";
import {
  WORKSPACE_COORDINATOR_TOOL,
  authorizeWorkspaceExecution,
  createWorkspaceCoordinator,
  workspaceConfirmationText,
  workspaceCleanupText,
  workspaceResumeText,
} from "../lib/workspace-coordinator.mjs";

const execFile = promisify(execFileCallback);
const fixedLaunchID = "11111111-1111-4111-8111-111111111111";

test("workspace confirmation is bound to the current direct user turn", () => {
  const repositories = [{
    repository_key: "primary",
    source_repository_path: "/workspace/source",
    remote_name: "origin",
    base_branch: "main",
    target_branch: "feature/proof",
  }];
  const expected = workspaceConfirmationText(repositories);
  assert.equal(expected, "/dev-flow confirm-worktree\nrepository=primary;remote=origin;base=main;target=feature/proof");
  assert.doesNotThrow(() => authorizeWorkspaceExecution(execution(expected, { operation: "provision", repositories })));
  assert.throws(
    () => authorizeWorkspaceExecution(execution("/dev-flow use it", { operation: "provision", repositories })),
    /WORKTREE_CONFIRMATION_REQUIRED/u,
  );
  assert.doesNotThrow(() => authorizeWorkspaceExecution(execution(workspaceResumeText(fixedLaunchID), {
    operation: "consume", launch_id: fixedLaunchID,
  })));
  const cleanup = { launchID: fixedLaunchID, repositoryKey: "primary", taskID: "task-cleanup", revision: 9 };
  assert.doesNotThrow(() => authorizeWorkspaceExecution(execution(workspaceCleanupText("prepare_cleanup", cleanup), {
    operation: "prepare_cleanup", launch_id: fixedLaunchID, repository_key: "primary", task_id: "task-cleanup", revision: 9,
  })));
  assert.doesNotThrow(() => authorizeWorkspaceExecution(execution(workspaceCleanupText("cleanup_worktree", cleanup), {
    operation: "cleanup_worktree", launch_id: fixedLaunchID, repository_key: "primary", task_id: "task-cleanup", revision: 9,
  })));
});

test("coordinator fetches a frozen base, excludes dirty source state, and emits a consumable relaunch", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-workspace-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const remote = join(root, "remote.git");
  const source = join(root, "source");
  const data = join(root, "data");
  await mkdir(data, { mode: 0o700 });
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote]);
  await execFile("git", ["clone", remote, source]);
  await git(source, ["config", "user.email", "workspace@example.invalid"]);
  await git(source, ["config", "user.name", "Workspace Test"]);
  await writeFile(join(source, "README.md"), "remote base\n");
  await git(source, ["add", "README.md"]);
  await git(source, ["commit", "-m", "base"]);
  await git(source, ["push", "-u", "origin", "main"]);
  const baseCommit = (await git(source, ["rev-parse", "HEAD"])).stdout.trim();

  await writeFile(join(source, "README.md"), "dirty source\n");
  await writeFile(join(source, "staged.txt"), "staged\n");
  await git(source, ["add", "staged.txt"]);
  await writeFile(join(source, "untracked.txt"), "untracked\n");

  const repositories = [{
    repository_key: "primary",
    source_repository_path: source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "feature/proof",
  }];
  const coordinator = createWorkspaceCoordinator({
    dataDirectory: data,
    workspaceRoot: source,
    launchID: () => fixedLaunchID,
  });
  const result = await coordinator.provision({
    request: "Create an isolated proof.",
    profile: "headless",
    repositories,
  });
  assert.equal(result.status, "relaunch_required");
  assert.deepEqual(result.relaunch, {
    command: "dsh",
    arguments: ["--profile", "headless", `${workspaceResumeText(fixedLaunchID)}\nContinue the confirmed request exactly as assessed:\nCreate an isolated proof.`],
    cwd: result.workspace_root,
  });
  assert.deepEqual(result.source_dirty_paths.primary, ["README.md", "staged.txt", "untracked.txt"]);
  assert.equal(result.source_dirty_paths_truncated.primary, false);
  assert.equal((await git(result.workspace_root, ["rev-parse", "HEAD"])).stdout.trim(), baseCommit);
  assert.equal((await git(result.workspace_root, ["branch", "--show-current"])).stdout.trim(), "feature/proof");
  assert.equal((await git(result.workspace_root, ["status", "--porcelain=v1", "--untracked-files=all"])).stdout, "");
  assert.equal(await readFile(join(result.workspace_root, "README.md"), "utf8"), "remote base\n");
  await assert.rejects(readFile(join(result.workspace_root, "staged.txt")), { code: "ENOENT" });
  await assert.rejects(readFile(join(result.workspace_root, "untracked.txt")), { code: "ENOENT" });

  const receipt = await readProvisioningReceipt(data, fixedLaunchID);
  assert.equal(receipt.operation_status, "provisioned");
  assert.equal(receipt.repositories[0].fetched_commit, baseCommit);
  assert.equal(JSON.stringify(receipt).includes(source), false);
  assert.equal(Object.hasOwn(receipt.repositories[0], "source_repository_path"), false);
  if (process.platform !== "win32") assert.equal((await stat(join(data, "host-operations", "deepseek", "provisioning", `${fixedLaunchID}.json`))).mode & 0o077, 0);

  const relaunched = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: result.workspace_root });
  const consumed = await relaunched.consume({ launchID: fixedLaunchID });
  assert.equal(consumed.status, "consumed");
  assert.deepEqual(Object.keys(consumed.open_task).sort(), [
    "additional_repositories", "primary_repository_key", "repository_path", "workspace_origin",
  ]);
  assert.deepEqual(consumed.open_task.workspace_origin, {
    mode: "dedicated_worktree",
    remote_name: "origin",
    base_branch: "main",
    base_commit: baseCommit,
    task_branch: "feature/proof",
    provisioning_receipt_id: fixedLaunchID,
  });
  assert.equal((await readProvisioningReceipt(data, fixedLaunchID)).operation_status, "consumed");

  const baseTerminalTask = {
    task_id: "task-cleanup", revision: 9, current_cursor: "DONE", primary_repository_key: "primary",
    workspace_origin: { ...consumed.open_task.workspace_origin, canonical_worktree_root: result.workspace_root },
    repository: { current_head: baseCommit }, additional_repositories: [],
  };
  const activeCleanup = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: result.workspace_root, readTask: async () => ({ ...baseTerminalTask, current_cursor: "IMPLEMENT" }) });
  await assert.rejects(activeCleanup.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: baseTerminalTask.task_id, revision: baseTerminalTask.revision }), /not terminal/u);
  const foreignCleanup = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: result.workspace_root, readTask: async () => ({ ...baseTerminalTask, workspace_origin: { ...baseTerminalTask.workspace_origin, provisioning_receipt_id: "another-receipt" } }) });
  await assert.rejects(foreignCleanup.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: baseTerminalTask.task_id, revision: baseTerminalTask.revision }), /does not match the receipt workspace/u);
  const staleHeadCleanup = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: result.workspace_root, readTask: async () => ({ ...baseTerminalTask, repository: { current_head: "f".repeat(40) } }) });
  await assert.rejects(staleHeadCleanup.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: baseTerminalTask.task_id, revision: baseTerminalTask.revision }), /differs from the terminal Core observation/u);
  const guardedCleanup = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: result.workspace_root, readTask: async () => baseTerminalTask });
  await assert.rejects(guardedCleanup.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: baseTerminalTask.task_id, revision: baseTerminalTask.revision }), /unpushed task branch/u);
  await writeFile(join(result.workspace_root, "dirty.txt"), "dirty\n");
  await assert.rejects(guardedCleanup.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: baseTerminalTask.task_id, revision: baseTerminalTask.revision }), /dirty terminal worktree/u);
  await rm(join(result.workspace_root, "dirty.txt"));

  await writeFile(join(result.workspace_root, "proof.txt"), "proof\n");
  await git(result.workspace_root, ["add", "proof.txt"]);
  await git(result.workspace_root, ["commit", "-m", "proof"]);
  await git(result.workspace_root, ["push", "-u", "origin", "HEAD"]);
  const terminalHead = (await git(result.workspace_root, ["rev-parse", "HEAD"])).stdout.trim();
  const terminalTask = {
    task_id: "task-cleanup", revision: 9, current_cursor: "DONE", primary_repository_key: "primary",
    workspace_origin: { ...consumed.open_task.workspace_origin, canonical_worktree_root: result.workspace_root },
    repository: { current_head: terminalHead }, additional_repositories: [],
  };
  const cleanupFromTask = createWorkspaceCoordinator({
    dataDirectory: data, workspaceRoot: result.workspace_root, readTask: async () => terminalTask,
  });
  const cleanupRelaunch = await cleanupFromTask.prepareCleanup({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: terminalTask.task_id, revision: terminalTask.revision, sourceRepositoryPath: source });
  assert.equal(cleanupRelaunch.status, "cleanup_relaunch_required");
  assert.equal(cleanupRelaunch.relaunch.cwd, source);
  assert.match(cleanupRelaunch.relaunch.arguments[2], /\/dev-flow resume-cleanup/u);
  assert.equal(JSON.stringify(await readProvisioningReceipt(data, fixedLaunchID)).includes(source), false);
  const cleanupFromSource = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: source, readTask: async () => terminalTask });
  assert.equal(relative(source, result.workspace_root).startsWith(".."), true, "Task worktree must remain outside the relaunched fixed Workspace Root");
  const removedWorktree = await cleanupFromSource.cleanupWorktree({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: terminalTask.task_id, revision: terminalTask.revision });
  assert.deepEqual(removedWorktree, { status: "worktree_removed", changed: true, launch_id: fixedLaunchID, repository_key: "primary", branch_retained: true });
  await assert.rejects(stat(result.workspace_root), { code: "ENOENT" });
  assert.equal((await readProvisioningReceipt(data, fixedLaunchID)).repositories[0].operation_status, "worktree_removed");
  await git(source, ["merge", "--ff-only", "feature/proof"]);
  const removedBranch = await cleanupFromSource.cleanupBranch({ launchID: fixedLaunchID, repositoryKey: "primary", taskID: terminalTask.task_id, revision: terminalTask.revision, sourceRepositoryPath: source });
  assert.deepEqual(removedBranch, { status: "branch_removed", changed: true, launch_id: fixedLaunchID, repository_key: "primary" });
  assert.equal((await readProvisioningReceipt(data, fixedLaunchID)).operation_status, "cleaned");
});

test("invalid or occupied target branches stop before a receipt or worktree is created", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-workspace-conflict-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const remote = join(root, "remote.git");
  const data = join(root, "data");
  await mkdir(data);
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote]);
  await execFile("git", ["clone", remote, source]);
  await git(source, ["config", "user.email", "workspace@example.invalid"]);
  await git(source, ["config", "user.name", "Workspace Test"]);
  await writeFile(join(source, "README.md"), "base\n");
  await git(source, ["add", "README.md"]);
  await git(source, ["commit", "-m", "base"]);
  await git(source, ["push", "-u", "origin", "main"]);
  await git(source, ["branch", "feature/existing"]);
  const coordinator = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: source, launchID: () => fixedLaunchID });
  await assert.rejects(coordinator.provision({
    request: "Do not collide.", profile: "headless", repositories: [{
      repository_key: "primary", source_repository_path: source, remote_name: "origin",
      base_branch: "main", target_branch: "feature/existing",
    }],
  }), /already exists locally/u);
  assert.equal(await readProvisioningReceipt(data, fixedLaunchID), null);
});

test("a multi-repository fetch failure creates no target branch or worktree", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-workspace-multi-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "workspace");
  const data = join(root, "data");
  await mkdir(workspace);
  await mkdir(data);
  const repositories = [];
  for (const key of ["core", "docs"]) {
    const source = join(workspace, key);
    const remote = join(root, `${key}.git`);
    await execFile("git", ["init", "--bare", "--initial-branch=main", remote]);
    await execFile("git", ["clone", remote, source]);
    await git(source, ["config", "user.email", "workspace@example.invalid"]);
    await git(source, ["config", "user.name", "Workspace Test"]);
    await writeFile(join(source, "README.md"), `${key}\n`);
    await git(source, ["add", "README.md"]);
    await git(source, ["commit", "-m", "base"]);
    await git(source, ["push", "-u", "origin", "main"]);
    repositories.push({ repository_key: key, source_repository_path: source, remote_name: "origin", base_branch: key === "docs" ? "missing" : "main", target_branch: `feature/${key}` });
  }
  const coordinator = createWorkspaceCoordinator({ dataDirectory: data, workspaceRoot: workspace, launchID: () => fixedLaunchID });
  await assert.rejects(coordinator.provision({ request: "Change both repositories.", profile: "headless", repositories }), /no Core Task was created/u);
  const receipt = await readProvisioningReceipt(data, fixedLaunchID);
  assert.equal(receipt.operation_status, "failed");
  for (const repository of receipt.repositories) {
    await assert.rejects(stat(repository.worktree_path), { code: "ENOENT" });
    const local = await git(join(workspace, repository.repository_key), ["show-ref", "--verify", `refs/heads/feature/${repository.repository_key}`]).then(() => true, () => false);
    assert.equal(local, false);
  }
});

function execution(text, arguments_) {
  const callID = "workspace-call";
  return {
    name: WORKSPACE_COORDINATOR_TOOL,
    callId: callID,
    arguments: arguments_,
    agent: {
      status: "running",
      session: { events: [
        { seq: 0, type: "turn/start", data: { turn: 1 } },
        { seq: 1, type: "user/message", data: { id: "user", source: { kind: "user" }, content: [{ type: "text", text }] } },
        { seq: 2, type: "tool/call", data: { turn: 1, callId: callID, name: WORKSPACE_COORDINATOR_TOOL } },
      ] },
    },
  };
}

async function git(cwd, args) {
  return await execFile("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
}
