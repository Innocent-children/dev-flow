import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { DeterministicCoreHost } from "../deepseek/fake-core.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const packageRoot = join(repositoryRoot, "packages", "codex");
const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");

test("shared simulated MCP client omits system-state revisions for a Codex-owned Task", async (t) => {
  const root = await temporaryRoot(t);
  const repository = join(root, "repository");
  const dataDirectory = join(root, "data");
  await mkdir(dataDirectory, { mode: 0o700 });
  const workspaceOrigin = await initializeGit(root, repository);

  const core = new DeterministicCoreHost({ runtimePath, dataDirectory, packageRoot, useSourceRuntime: true });
  t.after(() => core.stop());
  await core.start();

  const opened = await core.call(tool("dev_flow_open_task"), {
    host: "codex",
    repository_path: repository,
    workspace_origin: workspaceOrigin,
    new_task: {
      request: "Verify the shared node submission contract.",
      initial_scope: ["Submit Design, Tasks and Implementation results"],
      initial_out_of_scope: [],
      known_acceptance_criteria: ["Core fills each system-state revision"],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 4,
        allow_full_suite: false,
        allow_manual_handoff: true,
      },
      method_profile: "plain",
    },
  });
  let task = opened.result.task;
  assert.equal(task.origin_host, "codex");

  task = await submit(core, task, "requirements_ready", {
    baseline: {
      goal: "Verify the shared node submission contract.",
      scope: ["Submit Design, Tasks and Implementation results"],
      out_of_scope: [],
      acceptance_criteria: ["Core fills each system-state revision"],
      constraints: [],
      assumptions: [],
    },
    unresolved_questions: [],
  });

  const design = {
    baseline: {
      approach: "Use the direct submission tools.",
      components: ["shared MCP client", "Core"],
      decisions: ["Keep Task state in Core"],
      rejected_alternatives: [],
      complexity_justification: [],
      risks: [],
    },
    findings: [],
  };
  assert.equal(Object.hasOwn(design.baseline, "requirements_revision"), false);
  task = await submit(core, task, "design_ready", design);
  assert.equal(task.baselines.design.requirements_revision, task.baselines.requirements.revision);

  const tasks = {
    baseline: {
      work_items: [{
        work_item_id: "work",
        summary: "Submit the implementation result",
        expected_paths: [],
        acceptance_indexes: [0],
        verification_steps: ["Run the targeted submission journey"],
        dependencies: [],
      }],
    },
    findings: [],
  };
  assert.equal(Object.hasOwn(tasks.baseline, "design_revision"), false);
  task = await submit(core, task, "tasks_ready", tasks);
  assert.equal(task.baselines.task_plan.design_revision, task.baselines.design.revision);

  const implementation = {
    completed_work_item_ids: ["work"],
    deviations: [],
    findings: [],
  };
  assert.equal(Object.hasOwn(implementation, "task_plan_revision"), false);
  task = await submit(core, task, "implementation_ready_for_test", implementation);
  assert.equal(task.implementation.task_plan_revision, task.baselines.task_plan.revision);
  assert.equal(task.current_cursor, "TEST");
});

async function submit(core, task, transition, nodeResult) {
  const action = task.current_action;
  const envelope = await core.call(tool(action.submission_tool), {
    host: "codex",
    task_id: task.task_id,
    action_id: action.action_id,
    transition_id: transition,
    summary: "The shared simulated client recorded the current result.",
    reason: "",
    artifacts: {
      ...(action.current_node === "IMPLEMENT" ? {} : { current: [] }),
      other_process: [],
    },
    method_results: Object.fromEntries(action.method_steps.map((step) => [step.step_id, {
      capability: "",
      summary: "Completed the current semantic method step.",
    }])),
    node_result: { problem_class: "none", ...nodeResult },
  });
  assert.equal(envelope.result.revision, task.revision + 1);
  return envelope.result;
}

function tool(name) {
  return `mcp__dev_flow__${name}`;
}

async function initializeGit(root, repository) {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1" };
  const source = join(root, "source");
  const remote = join(root, "remote.git");
  await mkdir(source);
  await execFile("git", ["init", "--bare", "-q", "--initial-branch=main", remote], { cwd: root, env });
  await execFile("git", ["init", "-q", "--initial-branch=main"], { cwd: source, env });
  await execFile("git", ["config", "user.email", "journey@example.invalid"], { cwd: source, env });
  await execFile("git", ["config", "user.name", "Journey Test"], { cwd: source, env });
  await writeFile(join(source, "README.md"), "initial\n");
  await execFile("git", ["add", "README.md"], { cwd: source, env });
  await execFile("git", ["commit", "-q", "-m", "initial"], { cwd: source, env });
  await execFile("git", ["remote", "add", "origin", remote], { cwd: source, env });
  await execFile("git", ["push", "-q", "-u", "origin", "main"], { cwd: source, env });
  await execFile("git", ["worktree", "add", "-q", "-b", "task/shared-submission", repository, "refs/remotes/origin/main"], { cwd: source, env });
  const baseCommit = (await execFile("git", ["rev-parse", "refs/remotes/origin/main"], { cwd: repository, env, encoding: "utf8" })).stdout.trim();
  return {
    mode: "dedicated_worktree",
    remote_name: "origin",
    base_branch: "main",
    base_commit: baseCommit,
    task_branch: "task/shared-submission",
    provisioning_receipt_id: "receipt-shared-submission",
  };
}

async function temporaryRoot(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-shared-submission-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
