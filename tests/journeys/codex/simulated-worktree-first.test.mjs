import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { inspectAdmissionAnchor, validateSuitabilityAssessment } from "../../../packages/codex/lib/task-admission.mjs";
import {
  beginManagedTaskDispatch,
  beginTaskHandoff,
  bootstrapManagedTask,
  prepareTaskLaunch,
  recordManagedTaskDispatch,
  recordTaskHandoff,
  recordTaskHandoffStatus,
  validateWorkspaceOrigin,
} from "../../../packages/codex/lib/task-launch.mjs";
import { terminalCleanupDecision } from "../../../packages/codex/lib/worktree-lifecycle.mjs";

const execFile = promisify(execFileCallback);

test("simulated Codex Host covers the worktree-first Task lifecycle without claiming native evidence", async (t) => {
  const fixture = await makeFixture(t);
  const core = new SimulatedCore();
  const host = new SimulatedCodexHost(fixture);
  const request = "Implement the worktree-first journey proof and verify it.";

  const anchor = await inspectAdmissionAnchor({
    request,
    repositories: [{ key: "primary", repository_path: fixture.source }],
  });
  validateSuitabilityAssessment({
    change_level: "large",
    observed_repositories: ["primary"],
    candidate_components: ["Codex Host lifecycle", "Core protocol"],
    candidate_paths: ["src/proof.txt", "test/proof.test.mjs"],
    public_contract_flags: ["Host lifecycle"],
    persistence_or_state_flags: ["provisioning receipt"],
    host_or_platform_flags: ["managed worktree", "Handoff"],
    verification_shape: ["targeted check", "simulated Host journey"],
    unknowns: [],
    recommendation: "dev_flow",
    reasons: ["The request changes Host lifecycle and persistent operation handling."],
    anchor,
  });
  assert.deepEqual(core.calls, [], "assessment and user choice make no Core call");
  const userConfirmed = true;
  assert.equal(userConfirmed, true);

  const launch = await prepareTaskLaunch({
    launch_id: "codex-simulated-journey",
    request,
    assessment_anchor: anchor,
    repository_key: "primary",
    repository_path: fixture.source,
    remote_name: "origin",
    base_branch: "main",
    target_branch: "codex/simulated-journey",
    surface: "managed_worktree",
    worktree_path: null,
  }, fixture.options);
  const dispatch = await beginManagedTaskDispatch({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    project_id: "simulated-project",
    request,
  }, fixture.options);
  const hostCreation = await host.createManagedTask(dispatch.host_request, launch.receipt.fetched_commit);
  await recordManagedTaskDispatch({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    host_result: hostCreation,
  }, fixture.options);
  const bootstrap = await bootstrapManagedTask({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    worktree_path: host.worktree,
  }, fixture.options);
  validateWorkspaceOrigin(bootstrap.workspace_origin);

  core.openTask({
    host: "codex",
    repository_path: host.worktree,
    workspace_origin: bootstrap.workspace_origin,
    new_task: { request },
  });
  core.submit("REQUIREMENTS", { problem_class: "none", baseline: {}, unresolved_questions: [] });
  core.submit("DESIGN", { problem_class: "none", baseline: {}, findings: [] });
  core.submit("TASKS", { problem_class: "none", baseline: {}, findings: [] });
  await writeFile(join(host.worktree, "proof.txt"), "worktree-first journey\n");
  core.submit("IMPLEMENT", { problem_class: "none", completed_work_item_ids: ["proof"], deviations: [], findings: [] });
  await git(host.worktree, "add", "proof.txt");
  await git(host.worktree, "commit", "-m", "test: add simulated journey proof");
  assert.equal(await readFile(join(host.worktree, "proof.txt"), "utf8"), "worktree-first journey\n");

  const relocation = core.prepareRelocation({ host: "codex", task_id: core.taskId, revision: core.revision });
  const handoff = await beginTaskHandoff({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    relocation_id: relocation.relocation_id,
    thread_id: hostCreation.threadId,
  }, fixture.options);
  const handoffResult = await host.handoff(handoff.host_request);
  await recordTaskHandoff({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    host_result: handoffResult,
  }, fixture.options);
  await recordTaskHandoffStatus({
    launch_id: launch.receipt.launch_id,
    repository_key: "primary",
    status: "succeeded",
    revision: handoffResult.revision + 1,
    worktree_path: host.worktree,
  }, fixture.options);
  core.resolveRelocation({
    host: "codex",
    task_id: core.taskId,
    relocation_id: relocation.relocation_id,
    relocation_destinations: [{ key: "primary", repository_path: host.worktree }],
  });

  core.submit("TEST", {
    problem_class: "none",
    checks: [{ source: "automated", status: "passed", name: "proof", summary: "Proof exists.", command_count: 1, full_suite: false }],
    failed_items: [],
    unverified_items: [],
    manual_handoff_items: [],
    findings: [],
  });
  core.submit("COMPREHENSION_REVIEW", {
    problem_class: "none",
    explained_components: ["Host lifecycle"],
    unresolved_questions: [],
    unnecessary_abstractions: [],
    maintenance_risks: [],
    user_confirmation: { source: "user", status: "passed", summary: "Understood." },
    findings: [],
  });
  core.submit("DELIVERY", { problem_class: "none", unverified_items: [], risks: [], findings: [] });
  assert.equal(core.node, "DONE");

  await git(host.worktree, "push", "-u", "origin", "codex/simulated-journey");
  assert.equal(
    (await git(host.worktree, "rev-parse", "codex/simulated-journey")).stdout.trim(),
    (await git(host.worktree, "rev-parse", "origin/codex/simulated-journey")).stdout.trim(),
  );
  assert.deepEqual(terminalCleanupDecision({
    lifecycle: "DONE", surface: "managed_worktree", clean: true, pushed: true, stateCertain: true,
  }), {
    automatic_cleanup: false,
    worktree_cleanup: "host_authorization_required",
    branch_cleanup: "separate_authorization_required",
  });
  await host.cleanupWorktree({ authorized: true });
  await assert.rejects(stat(host.worktree), { code: "ENOENT" });
  await host.cleanupBranch({ authorized: true });
  assert.deepEqual(host.cleanupCalls, ["worktree", "branch"]);
  assert.deepEqual(core.calls.map((entry) => entry.operation), [
    "open", "REQUIREMENTS", "DESIGN", "TASKS", "IMPLEMENT", "prepare_relocation",
    "resolve_relocation", "TEST", "COMPREHENSION_REVIEW", "DELIVERY",
  ]);
});

class SimulatedCore {
  constructor() {
    this.calls = [];
    this.node = null;
    this.revision = 0;
    this.taskId = "simulated-core-task";
  }

  openTask(input) {
    assert.deepEqual(Object.keys(input.workspace_origin).sort(), [
      "base_branch", "base_commit", "mode", "provisioning_receipt_id", "remote_name", "task_branch",
    ]);
    this.calls.push({ operation: "open", input });
    this.node = "REQUIREMENTS";
    this.revision = 1;
  }

  submit(expected, nodeResult) {
    assert.equal(this.node, expected);
    assert.equal(Object.keys(nodeResult).some((field) => field.includes("changed") || field.includes("file_changes")), false);
    this.calls.push({ operation: expected, nodeResult });
    this.node = ({
      REQUIREMENTS: "DESIGN",
      DESIGN: "TASKS",
      TASKS: "IMPLEMENT",
      IMPLEMENT: "TEST",
      TEST: "COMPREHENSION_REVIEW",
      COMPREHENSION_REVIEW: "DELIVERY",
      DELIVERY: "DONE",
    })[expected];
    this.revision += 1;
  }

  prepareRelocation(input) {
    assert.deepEqual(input, { host: "codex", task_id: this.taskId, revision: this.revision });
    assert.notEqual(this.node, "DONE");
    this.resumeNode = this.node;
    this.node = "BLOCKED";
    this.calls.push({ operation: "prepare_relocation", input });
    return { relocation_id: "simulated-relocation" };
  }

  resolveRelocation(input) {
    assert.deepEqual(Object.keys(input).sort(), ["host", "relocation_destinations", "relocation_id", "task_id"]);
    this.calls.push({ operation: "resolve_relocation", input });
    this.node = this.resumeNode;
    this.resumeNode = null;
  }
}

class SimulatedCodexHost {
  constructor(fixture) {
    this.fixture = fixture;
    this.worktree = join(fixture.root, "managed Codex worktree");
    this.cleanupCalls = [];
  }

  async createManagedTask(request, commit) {
    assert.equal(request.target.environment.type, "worktree");
    assert.equal(request.target.environment.startingState.branchName, "refs/remotes/origin/main");
    assert.equal(Object.hasOwn(request.target.environment.startingState, "onMissing"), false);
    await git(this.fixture.source, "worktree", "add", "--detach", this.worktree, commit);
    return { threadId: "simulated-codex-thread", hostId: "local" };
  }

  async handoff(request) {
    assert.equal(request.threadId, "simulated-codex-thread");
    return { operationId: "simulated-host-handoff", revision: 1 };
  }

  async cleanupWorktree({ authorized }) {
    assert.equal(authorized, true);
    this.cleanupCalls.push("worktree");
    await git(this.fixture.source, "worktree", "remove", this.worktree);
  }

  async cleanupBranch({ authorized }) {
    assert.equal(authorized, true);
    this.cleanupCalls.push("branch");
    await git(this.fixture.source, "branch", "-d", "codex/simulated-journey");
  }
}

async function makeFixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-simulated-journey-")));
  const remote = join(root, "remote.git");
  const source = join(root, "source");
  const productSupportRoot = join(root, "support");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(productSupportRoot);
  await execFile("git", ["init", "--bare", "--initial-branch=main", remote], { encoding: "utf8" });
  await execFile("git", ["clone", remote, source], { encoding: "utf8" });
  await git(source, "config", "user.email", "codex@example.invalid");
  await git(source, "config", "user.name", "Codex Journey");
  await writeFile(join(source, "README.md"), "# simulated fixture\n");
  await git(source, "add", "README.md");
  await git(source, "commit", "-m", "initial fixture");
  await git(source, "push", "-u", "origin", "main");
  return { root, source, options: { productSupportRoot, enforcePrivateModes: process.platform !== "win32" } };
}

async function git(cwd, ...arguments_) {
  return await execFile("git", arguments_, { cwd, encoding: "utf8" });
}
