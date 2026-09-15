import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindTask, cleanup, inspect, prepare, provision, relocate, scope, session } from "../lib/workspace.mjs";
import { defaultRunGit as git } from "../lib/worktree-lifecycle.mjs";
async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), "claude-workspace-"));
  const root = join(parent, "repo"); await mkdir(root);
  t.after(() => rm(parent, { recursive: true, force: true }));
  await git(["init", "-b", "main", root]); await git(["-C", root, "config", "user.name", "Test"]); await git(["-C", root, "config", "user.email", "test@example.invalid"]);
  await writeFile(join(root, "base.txt"), "base"); await git(["-C", root, "add", "."]); await git(["-C", root, "commit", "-m", "base"]);
  const options = { environment: { ...process.env, HOME: parent, USERPROFILE: parent, LOCALAPPDATA: join(parent, "appdata"), DEV_FLOW_DATA_DIR: "" }, checkWorkspaceAvailable: async repository_path => ({ available: true, repository_path }) };
  return { root, options };
}
test("local branch prepares once and keeps one session identity", async t => {
  const { root, options } = await fixture(t), request = "Implement an endpoint";
  const anchor = await inspect({ request, repositories: [{ key: "primary", repository_path: root }] });
  const receipt = await prepare({ request, assessment: { change_level: "standard", candidate_components: ["endpoint"], candidate_paths: ["base.txt"], public_contract_flags: ["response"], persistence_or_state_flags: [], host_or_platform_flags: [], verification_shape: ["endpoint test"], reasons: ["public contract"], unknowns: [], anchor },
    user_choice: { source: "user", mode: "dev_flow", summary: "Confirmed" }, repositories: [{ key: "primary", repository_path: root, workspace_mode: "new_branch", source_type: "local", remote_name: "", base_branch: "main", target_branch: "task", carry_changes: false, worktree_path: root }], handoff: null }, options);
  const ready = await provision(receipt.launch_id, options);
  assert.equal(ready.repositories[0].phase, "provisioned");
  assert.equal((await scope(receipt.launch_id, options)).workspace_origin.task_branch, "task");
  await provision(receipt.launch_id, options);
  const launch = await session(receipt.launch_id, "launch", {}, options);
  assert.equal(launch.executable, "claude");
  await assert.rejects(session(receipt.launch_id, "launch", {}, options), /already recorded/);
  assert.equal((await session(receipt.launch_id, "resume", {}, options)).session_id, launch.session_id);
  await assert.rejects(session(receipt.launch_id, "retry-launch", { previous_caller_stopped: true, session_not_started: false, reason: "Unknown outcome" }, options), /proof/);
  const retry = await session(receipt.launch_id, "retry-launch", { previous_caller_stopped: true, session_not_started: true, reason: "Process invocation failed before starting Claude" }, options);
  assert.equal(retry.session_id, launch.session_id);
  assert.equal(retry.arguments[0], "--session-id");
  await bindTask(receipt.launch_id, { task_id: "task-from-successful-core-response" }, options);
  const resumed = await session(receipt.launch_id, "resume", {}, options);
  assert.match(resumed.arguments.at(-1), /task-from-successful-core-response/);
  await assert.rejects(bindTask(receipt.launch_id, { task_id: "task-other" }, options), /another Core Task/);
});
test("unresolved assessment cannot write Git", async t => {
  const { root, options } = await fixture(t);
  await assert.rejects(prepare({ request: "x", assessment: { unknowns: ["target"] }, user_choice: { source: "user", mode: "dev_flow", summary: "yes" }, repositories: [], handoff: null }, options), /resolved assessment/);
  assert.equal(String(await git(["-C", root, "branch", "--show-current"])).trim(), "main");
});

async function prepareSelections(repositories, options) {
  const request = "Complete a multi-repository change";
  const anchor = await inspect({ request, repositories: repositories.map(({ key, repository_path }) => ({ key, repository_path })) });
  return prepare({ request, assessment: { change_level: "standard", candidate_components: ["workspace"], candidate_paths: ["base.txt"], public_contract_flags: [], persistence_or_state_flags: [], host_or_platform_flags: ["Claude"], verification_shape: ["workspace checks"], reasons: ["multiple repositories"], unknowns: [], anchor },
    user_choice: { source: "user", mode: "dev_flow", summary: "Confirmed exact workspaces and carry choices" }, repositories,
    handoff: { discussion: [{ role: "user", text: request }] } }, options);
}
function dedicated(root, key = "primary", carry = false) {
  return { key, repository_path: root, workspace_mode: "dedicated_worktree", source_type: "local", remote_name: "", base_branch: "main", target_branch: "task", carry_changes: carry, worktree_path: join(root, "..", "worktree") };
}
test("dedicated worktree preserves staged, unstaged and untracked content with its source intact", async t => {
  const { root, options } = await fixture(t);
  await writeFile(join(root, "base.txt"), "staged"); await git(["-C", root, "add", "base.txt"]);
  await writeFile(join(root, "base.txt"), "working"); await writeFile(join(root, "new.txt"), "untracked");
  const before = await git(["-C", root, "status", "--porcelain=v2"]);
  const selection = dedicated(root, "primary", true);
  const receipt = await prepareSelections([selection], options); await provision(receipt.launch_id, options);
  assert.equal(await readFile(join(selection.worktree_path, "base.txt"), "utf8"), "working");
  assert.equal(String(await git(["-C", selection.worktree_path, "show", ":base.txt"])), "staged");
  assert.equal(await readFile(join(selection.worktree_path, "new.txt"), "utf8"), "untracked");
  assert.equal(await git(["-C", root, "status", "--porcelain=v2"]), before);
  assert.equal((await scope(receipt.launch_id, options)).workspace_origin.carry_changes, true);
});
test("all repositories are required and replacement worktree instances are rejected", async t => {
  const one = await fixture(t), two = await fixture(t);
  const selected = [dedicated(one.root), dedicated(two.root, "secondary")];
  const receipt = await prepareSelections(selected, one.options); await provision(receipt.launch_id, one.options);
  const bound = await scope(receipt.launch_id, one.options);
  assert.equal(bound.additional_repositories[0].key, "secondary");
  await git(["-C", one.root, "worktree", "remove", selected[0].worktree_path]);
  await git(["-C", one.root, "worktree", "add", selected[0].worktree_path, "task"]);
  await assert.rejects(scope(receipt.launch_id, one.options), /identity/);
});
test("a partial provisioning failure retains the first workspace and cannot expose a partial Core scope", async t => {
  const one = await fixture(t), two = await fixture(t);
  const selected = [dedicated(one.root), dedicated(two.root, "secondary")];
  const receipt = await prepareSelections(selected, one.options);
  const failSecond = { ...one.options, runGit: async (args, opts) => {
    if (args.includes(two.root) && args.includes("worktree") && args.includes("add")) throw new Error("Injected second-workspace failure");
    return git(args, opts);
  } };
  await assert.rejects(provision(receipt.launch_id, failSecond), /second-workspace/);
  assert.equal(await readFile(join(selected[0].worktree_path, "base.txt"), "utf8"), "base");
  await assert.rejects(scope(receipt.launch_id, one.options));
  await assert.rejects(provision(receipt.launch_id, one.options), /uncertain/);
});

test("current-branch and remote-base modes preserve their confirmed origins", async t => {
  const local = await fixture(t);
  const current = { ...dedicated(local.root), workspace_mode: "current_branch", target_branch: "main", worktree_path: local.root };
  const localReceipt = await prepareSelections([current], local.options);
  await provision(localReceipt.launch_id, local.options);
  assert.equal((await scope(localReceipt.launch_id, local.options)).workspace_origin.mode, "current_branch");
  const source = await fixture(t), remote = await fixture(t);
  await writeFile(join(remote.root, "remote.txt"), "remote-only");
  await git(["-C", remote.root, "add", "remote.txt"]); await git(["-C", remote.root, "commit", "-m", "remote content"]);
  await git(["-C", source.root, "remote", "add", "origin", remote.root]);
  const selection = { ...dedicated(source.root), source_type: "remote", remote_name: "origin" };
  const receipt = await prepareSelections([selection], source.options); await provision(receipt.launch_id, source.options);
  assert.equal(await readFile(join(selection.worktree_path, "remote.txt"), "utf8"), "remote-only");
  assert.equal((await scope(receipt.launch_id, source.options)).workspace_origin.source_type, "remote");
});

test("relocation and terminal cleanup retain Core authority and separate deletion decisions", async t => {
  const { root, options } = await fixture(t), selection = dedicated(root);
  const receipt = await prepareSelections([selection], options); await provision(receipt.launch_id, options);
  await assert.rejects(cleanup(receipt.launch_id, "cleanup-worktree", { repository_key: "primary", terminal: false, authorized: true }, options), /Terminal/);
  const destination = join(root, "..", "relocated");
  const moved = await relocate(receipt.launch_id, { relocation_id: "relocation-confirmed-by-core", destinations: [{ repository_key: "primary", repository_path: destination }], authorized: true }, options);
  assert.equal(moved.core_resolution_required, true);
  assert.equal((await scope(receipt.launch_id, options)).repository_path, destination);
  await cleanup(receipt.launch_id, "cleanup-worktree", { repository_key: "primary", terminal: true, authorized: true }, options);
  await cleanup(receipt.launch_id, "cleanup-worktree", { repository_key: "primary", terminal: true, authorized: true }, options);
  await assert.rejects(cleanup(receipt.launch_id, "cleanup-branch", { repository_key: "primary", terminal: true, authorized: false }, options), /authorization/);
  await cleanup(receipt.launch_id, "cleanup-branch", { repository_key: "primary", terminal: true, authorized: true }, options);
  await assert.rejects(git(["-C", root, "rev-parse", "--verify", "refs/heads/task"]));
});
