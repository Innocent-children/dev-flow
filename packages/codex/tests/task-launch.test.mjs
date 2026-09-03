import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { inspectAdmissionAnchor } from "../lib/task-admission.mjs";
import {
  beginManagedTaskDispatch,
  beginTaskHandoff,
  bootstrapManagedTask,
  buildCliRelaunchDescriptor,
  buildOpenTaskRepositoryScope,
  cleanupCliTaskWorktree,
  cleanupTaskBranch,
  prepareTaskLaunch,
  provisionCliTask,
  recordManagedTaskDispatch,
  recordTaskHandoff,
  recordTaskHandoffStatus,
  validateWorkspaceOrigin,
} from "../lib/task-launch.mjs";
import { provisioningReceiptPath, readProvisioningReceipt } from "../lib/provisioning-receipt.mjs";
import { terminalCleanupDecision } from "../lib/worktree-lifecycle.mjs";

const execFile = promisify(execFileCallback);

test("available Codex CLI natively parses the relaunch -C and --add-dir options without starting a session", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-parser-")));
  const primary = join(root, "primary worktree");
  const additional = join(root, "additional worktree");
  await Promise.all([mkdir(primary), mkdir(additional)]);
  t.after(() => rm(root, { recursive: true, force: true }));
  const descriptor = buildCliRelaunchDescriptor({
    worktreePath: primary,
    additionalWorktreePaths: [additional],
    prompt: "$dev-flow-codex:dev-flow receipt-backed bootstrap",
  });
  const parserArguments = descriptor.arguments.slice(0, -2).concat("--help");
  try {
    const { stdout } = await execFile(process.env.DEV_FLOW_CODEX_EXECUTABLE ?? descriptor.executable, parserArguments, {
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.match(stdout, /Codex CLI|Usage: codex/u);
  } catch (error) {
    if (error?.code === "ENOENT") {
      t.skip("Codex CLI is not available on PATH");
      return;
    }
    throw error;
  }
});

test("managed launch freezes the confirmed remote ref, dispatches once, and bootstraps a named clean branch", async (t) => {
  const fixture = await makeRemoteFixture(t, "managed");
  await writeFile(join(fixture.source, "source-only.txt"), "do not copy\n");
  await writeFile(join(fixture.source, "staged-only.txt"), "do not copy staged content\n");
  await git(fixture.source, "add", "staged-only.txt");
  await writeFile(join(fixture.source, "base.txt"), "do not copy unstaged content\n");
  const request = "Implement the confirmed managed task.";
  const assessment_anchor = await assessmentAnchor(fixture, request);
  const launch = await prepareTaskLaunch({
    launch_id: "launch-managed-0001",
    request,
    assessment_anchor,
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "codex/managed-task",
    surface: "managed_worktree",
    worktree_path: null,
  }, fixture.options);
  assert.equal(launch.receipt.operation_status.phase, "fetched");
  assert.throws(() => buildOpenTaskRepositoryScope([launch.receipt]), /every repository must be provisioned/u);
  assert.equal(launch.source_dirty, true);
  assert.equal((await stat(launch.receipt_path)).mode & 0o077, 0);
  assert.deepEqual(Object.keys(launch.receipt).sort(), [
    "base_branch", "created_at", "fetched_commit", "host", "launch_id", "operation_status",
    "remote_name", "repository_key", "request_digest", "source_repository_identity", "target_branch",
    "worktree_path",
  ].sort());
  const retainedReceipt = await readFile(launch.receipt_path, "utf8");
  assert.equal(retainedReceipt.includes("Implement the confirmed managed task"), false);
  assert.equal(retainedReceipt.includes("do not copy staged content"), false);
  assert.equal(retainedReceipt.includes(fixture.remote), false);

  await assert.rejects(beginManagedTaskDispatch({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    project_id: "project-1",
    request: "A different request.",
  }, fixture.options), /does not match the receipt/u);

  const dispatched = await beginManagedTaskDispatch({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    project_id: "project-1",
    request,
  }, fixture.options);
  assert.equal(dispatched.should_dispatch, true);
  assert.equal(dispatched.host_request.title, "Dev Flow launch-managed-0001 primary");
  assert.deepEqual(dispatched.host_request.target.environment.startingState, {
    type: "branch",
    branchName: "refs/remotes/origin/main",
  });
  assert.equal(Object.hasOwn(dispatched.host_request.target.environment.startingState, "onMissing"), false);
  assert.equal((await beginManagedTaskDispatch({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    project_id: "project-1",
    request,
  }, fixture.options)).should_dispatch, false);

  await recordManagedTaskDispatch({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    host_result: { clientThreadId: "client-thread-1" },
  }, fixture.options);
  await recordManagedTaskDispatch({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    host_result: { threadId: "thread-1", hostId: "local" },
  }, fixture.options);

  const managedWorktree = join(fixture.root, "managed worktree");
  await git(fixture.source, "worktree", "add", "--detach", managedWorktree, launch.receipt.fetched_commit);
  const bootstrapped = await bootstrapManagedTask({
    launch_id: "launch-managed-0001",
    repository_key: "primary",
    worktree_path: managedWorktree,
  }, fixture.options);
  assert.deepEqual(validateWorkspaceOrigin(bootstrapped.workspace_origin), {
    mode: "dedicated_worktree",
    remote_name: "origin",
    base_branch: "main",
    base_commit: launch.receipt.fetched_commit,
    task_branch: "codex/managed-task",
    provisioning_receipt_id: bootstrapped.workspace_origin.provisioning_receipt_id,
  });
  assert.match(bootstrapped.workspace_origin.provisioning_receipt_id, /^codex-[0-9a-f]{64}$/u);
  assert.deepEqual(buildOpenTaskRepositoryScope([bootstrapped.receipt]), {
    repository_path: managedWorktree,
    workspace_origin: bootstrapped.workspace_origin,
  });
  assert.equal((await gitOutput(managedWorktree, "branch", "--show-current")), "codex/managed-task");
  await assert.rejects(readFile(join(managedWorktree, "source-only.txt")), { code: "ENOENT" });
  await assert.rejects(readFile(join(managedWorktree, "staged-only.txt")), { code: "ENOENT" });
  assert.equal(await readFile(join(managedWorktree, "base.txt"), "utf8"), "base\n");
});

test("CLI launch returns parser-ready argv and retains separate worktree and branch cleanup decisions", async (t) => {
  const fixture = await makeRemoteFixture(t, "cli");
  const worktree = join(fixture.root, "CLI worktree");
  const request = "Implement the CLI task.";
  await prepareTaskLaunch({
    launch_id: "launch-cli-0001",
    request,
    assessment_anchor: await assessmentAnchor(fixture, request),
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "codex/cli-task",
    surface: "cli_worktree",
    worktree_path: worktree,
  }, fixture.options);
  const provisioned = await provisionCliTask({
    launch_id: "launch-cli-0001",
    repository_key: "primary",
    request,
    additional_worktree_paths: [join(fixture.root, "additional worktree")],
  }, { ...fixture.options, sourceRepositoryPath: fixture.source });
  assert.deepEqual(provisioned.relaunch, {
    executable: "codex",
    arguments: [
      "-C", worktree,
      "--add-dir", join(fixture.root, "additional worktree"),
      "--", "$dev-flow-codex:dev-flow Resume the confirmed Dev Flow launch launch-cli-0001 for repository primary. Before any Core call, consume the provisioning receipt, verify the fetched commit and task worktree, create the confirmed target branch when needed, and prove the worktree is clean. Implement the CLI task.",
    ],
  });
  assert.deepEqual(terminalCleanupDecision({
    lifecycle: "DONE", surface: "cli_worktree", clean: true, pushed: false, stateCertain: true,
  }), {
    automatic_cleanup: false,
    worktree_cleanup: "separate_authorization_required",
    branch_cleanup: "requires_unpushed_review",
  });

  await cleanupCliTaskWorktree({
    launch_id: "launch-cli-0001", repository_key: "primary", terminal: true, authorized: true,
  }, { ...fixture.options, sourceRepositoryPath: fixture.source });
  await assert.rejects(stat(worktree), { code: "ENOENT" });
  await cleanupTaskBranch({
    launch_id: "launch-cli-0001", repository_key: "primary", terminal: true, authorized: true,
  }, { ...fixture.options, sourceRepositoryPath: fixture.source });
  await assert.rejects(
    execFile("git", ["-C", fixture.source, "show-ref", "--verify", "refs/heads/codex/cli-task"]),
  );
});

test("queued dispatch and Handoff persist one-shot state for read-before-retry", async (t) => {
  const fixture = await makeRemoteFixture(t, "handoff");
  const worktree = join(fixture.root, "handoff worktree");
  const request = "Implement then relocate the task.";
  await prepareTaskLaunch({
    launch_id: "launch-handoff-0001",
    request,
    assessment_anchor: await assessmentAnchor(fixture, request),
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "codex/handoff-task",
    surface: "cli_worktree",
    worktree_path: worktree,
  }, fixture.options);
  await provisionCliTask({
    launch_id: "launch-handoff-0001", repository_key: "primary", request, additional_worktree_paths: [],
  }, { ...fixture.options, sourceRepositoryPath: fixture.source });
  const handoff = await beginTaskHandoff({
    launch_id: "launch-handoff-0001",
    repository_key: "primary",
    relocation_id: "relocation-1",
    thread_id: "thread-1",
  }, fixture.options);
  assert.equal(handoff.should_dispatch, true);
  assert.equal((await beginTaskHandoff({
    launch_id: "launch-handoff-0001",
    repository_key: "primary",
    relocation_id: "relocation-1",
    thread_id: "thread-1",
  }, fixture.options)).should_dispatch, false);
  await recordTaskHandoff({
    launch_id: "launch-handoff-0001",
    repository_key: "primary",
    host_result: { operationId: "host-operation-1", revision: 3 },
  }, fixture.options);
  const completed = await recordTaskHandoffStatus({
    launch_id: "launch-handoff-0001",
    repository_key: "primary",
    status: "succeeded",
    revision: 4,
    worktree_path: worktree,
  }, fixture.options);
  assert.equal(completed.relocation_id, "relocation-1");
  assert.equal(completed.receipt.operation_status.host_operation_id, "host-operation-1");
});

test("a failed fetch leaves a failed receipt and no target branch or worktree", async (t) => {
  const fixture = await makeRemoteFixture(t, "fetch-failure");
  const worktree = join(fixture.root, "missing worktree");
  const request = "Use a missing base.";
  await assert.rejects(prepareTaskLaunch({
    launch_id: "launch-failed-0001",
    request,
    assessment_anchor: await assessmentAnchor(fixture, request),
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "missing-base",
    target_branch: "codex/not-created",
    surface: "cli_worktree",
    worktree_path: worktree,
  }, fixture.options));
  const receiptPath = provisioningReceiptPath(fixture.productSupportRoot, "launch-failed-0001", "primary");
  const receipt = await readProvisioningReceipt(receiptPath, { productSupportRoot: fixture.productSupportRoot });
  assert.equal(receipt.operation_status.phase, "failed");
  await assert.rejects(stat(worktree), { code: "ENOENT" });
  await assert.rejects(execFile("git", ["-C", fixture.source, "show-ref", "--verify", "refs/heads/codex/not-created"]));
});

test("provisioning refuses a request, HEAD, or status that changed after assessment", async (t) => {
  const fixture = await makeRemoteFixture(t, "stale-assessment");
  const request = "Implement only the assessed change.";
  const assessment_anchor = await assessmentAnchor(fixture, request);
  await writeFile(join(fixture.source, "late-change.txt"), "changed while waiting\n");
  await assert.rejects(prepareTaskLaunch({
    launch_id: "launch-stale-0001",
    request,
    assessment_anchor,
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "codex/stale-task",
    surface: "managed_worktree",
    worktree_path: null,
  }, fixture.options), /assessment is stale/u);
  const receiptPath = provisioningReceiptPath(fixture.productSupportRoot, "launch-stale-0001", "primary");
  assert.equal(await readProvisioningReceipt(receiptPath, { productSupportRoot: fixture.productSupportRoot }), null);
});

async function makeRemoteFixture(t, name) {
  const root = await realpath(await mkdtemp(join(tmpdir(), `dev-flow-codex-${name}-`)));
  const remote = join(root, "remote.git");
  const source = join(root, "source checkout");
  const productSupportRoot = join(root, "product support");
  await mkdir(productSupportRoot);
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote], { encoding: "utf8" });
  await execFile("git", ["clone", remote, source], { encoding: "utf8" });
  await git(source, "config", "user.email", "codex@example.invalid");
  await git(source, "config", "user.name", "Codex Test");
  await writeFile(join(source, "base.txt"), "base\n");
  await git(source, "add", "base.txt");
  await git(source, "commit", "-m", "base");
  await git(source, "push", "-u", "origin", "main");
  return {
    root,
    remote,
    source,
    productSupportRoot,
    options: { productSupportRoot, enforcePrivateModes: process.platform !== "win32" },
  };
}

async function assessmentAnchor(fixture, request) {
  return await inspectAdmissionAnchor({
    request,
    repositories: [{ key: "primary", repository_path: fixture.source }],
  });
}

async function git(cwd, ...arguments_) {
  return await execFile("git", arguments_, { cwd, encoding: "utf8" });
}

async function gitOutput(cwd, ...arguments_) {
  return (await git(cwd, ...arguments_)).stdout.trim();
}
