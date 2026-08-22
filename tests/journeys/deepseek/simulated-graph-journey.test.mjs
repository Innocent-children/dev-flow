import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { authorizeDevFlowExecution } from "../../../packages/deepseek/lib/authorization.mjs";
import { DEV_FLOW_QUALIFIED_TOOL_NAMES } from "../../../packages/deepseek/lib/tool-names.mjs";
import { DeterministicCoreHost } from "./fake-core.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const packageRoot = join(repositoryRoot, "packages", "deepseek");
const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
const [serverInfoTool, openTool, getTaskTool, getNextTool, applyTool] = DEV_FLOW_QUALIFIED_TOOL_NAMES;

test("deterministic DeepSeek Host follows the real Core graph through restart, recovery, refactor, and DONE", async (t) => {
  const root = await temporaryRoot(t);
  const repository = join(root, "repository");
  const dataDirectory = join(root, "data");
  await mkdir(repository);
  await mkdir(dataDirectory, { mode: 0o700 });
  await initializeGit(repository);

  const core = new DeterministicCoreHost({ runtimePath, dataDirectory, packageRoot });
  t.after(() => core.stop());
  await core.start();

  const deniedBefore = core.calls.length;
  const ordinary = authorizeExecution("ordinary request", "ordinary-call", serverInfoTool);
  assert.match(ordinary, /DEV_FLOW_SELECTOR_REQUIRED/u);
  assert.equal(core.calls.length, deniedBefore);
  const historical = authorizeExecution("ordinary current", "historical-call", serverInfoTool, true);
  assert.match(historical, /DEV_FLOW_SELECTOR_REQUIRED/u);
  assert.equal(core.calls.length, deniedBefore);
  assert.equal(authorizeExecution("/dev-flow run journey", "selected-call", serverInfoTool), undefined);

  const info = await core.call(serverInfoTool, {});
  assert.equal(core.sessions[0][0], serverInfoTool);
  assert.deepEqual(info.result.tools, [
    "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task",
    "dev_flow_get_next_action", "dev_flow_apply_action", "dev_flow_cancel_task",
  ]);
  assert.deepEqual(info.result.method_profiles, ["plain", "spec-kit", "openspec"]);

  const opened = await core.call(openTool, {
    host: "deepseek",
    repository_path: repository,
    new_task: {
      request: "Prove the deterministic DeepSeek graph loop.",
      initial_scope: ["Exercise the current graph"],
      initial_out_of_scope: ["Change Core semantics"],
      known_acceptance_criteria: ["The task reaches Core DONE", "Recovery reads precede any replay"],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 16,
        allow_full_suite: false,
        allow_manual_handoff: true,
      },
      method_profile: "plain",
    },
  });
  let task = opened.result.task;
  assert.equal(opened.result.created, true);
  assert.equal(task.origin_host, "deepseek");
  assert.equal(task.revision, 1);
  assertCompleteAction(task.current_action, "REQUIREMENTS");

  const uncertainArgs = applyArguments(task, "requirements_ready", requirementsResult(), "journey-requirements");
  await core.call(applyTool, uncertainArgs);
  const probe = operationProbe(uncertainArgs);
  const recoveredTask = await core.call(getTaskTool, {
    host: "deepseek",
    task_id: task.task_id,
    operation_probe: probe,
  });
  const recoveredAction = await core.call(getNextTool, {
    host: "deepseek",
    task_id: task.task_id,
    operation_probe: probe,
  });
  assert.deepEqual(core.calls.slice(-3), [applyTool, getTaskTool, getNextTool]);
  task = recoveredTask.result.task;
  assert.equal(task.revision, 2);
  assert.equal(task.current_cursor, "DESIGN");
  assert.equal(recoveredAction.result.revision, task.revision);
  assert.equal(recoveredAction.result.action.action_id, task.current_action.action_id);
  assert.equal(recoveredTask.result.recovery_assessment.next_advice, "read_next_action");

  task = await apply(core, task, "design_ready", designResult(task.baselines.requirements.revision));
  assert.equal(task.revision, 3);
  await core.restart();
  const restartedInfo = await core.call(serverInfoTool, {});
  assert.equal(restartedInfo.result.product, "dev-flow");
  assert.equal(core.sessions[1][0], serverInfoTool);
  const resumed = await core.call(getTaskTool, { host: "deepseek", task_id: task.task_id });
  const resumedAction = await core.call(getNextTool, { host: "deepseek", task_id: task.task_id });
  assert.equal(resumed.result.task.task_id, task.task_id);
  assert.equal(resumed.result.task.revision, task.revision);
  assert.equal(resumedAction.result.action.action_id, task.current_action.action_id);
  task = resumed.result.task;

  task = await apply(core, task, "tasks_ready", tasksResult(task.baselines.design.revision));
  await writeFile(join(repository, "feature.txt"), "implementation one\n");
  task = await apply(core, task, "implementation_ready_for_test", implementationResult(task.baselines.task_plan.revision));
  task = await apply(core, task, "tests_failed_implementation", failedTestResult(), "The first targeted check failed.");
  assert.equal(task.current_cursor, "IMPLEMENT");
  assert.equal(task.test, null);

  await writeFile(join(repository, "feature.txt"), "implementation fixed\n");
  task = await apply(core, task, "implementation_ready_for_test", implementationResult(task.baselines.task_plan.revision));
  task = await apply(core, task, "tests_passed", passedTestResult());
  const firstTestRecord = task.test.record_id;
  assert.equal(task.current_cursor, "COMPREHENSION_REVIEW");

  task = await apply(
    core,
    task,
    "code_too_complex",
    comprehensionResult({ abstractions: ["factory layer"], findings: ["Code complexity"] }),
    "The factory layer obscures the request path.",
  );
  assert.equal(task.current_cursor, "REFACTOR");
  assert.equal(task.test, null);
  assert.equal(task.comprehension, null);
  assert.equal(task.current_action.available_transitions.some((item) => item.transition_id === "delivery_complete"), false);

  await writeFile(join(repository, "feature.txt"), "implementation simplified\n");
  task = await apply(core, task, "refactor_ready_for_test", refactorResult());
  assert.equal(task.current_cursor, "TEST");
  task = await apply(core, task, "tests_passed", passedTestResult());
  assert.notEqual(task.test.record_id, firstTestRecord);
  task = await apply(core, task, "comprehension_passed", comprehensionResult({ userPassed: true }));
  assert.equal(task.current_cursor, "DELIVERY");
  const userEvidence = task.evidence.find((item) => item.evidence_id === task.comprehension.user_evidence_id);
  assert.equal(userEvidence.source, "user");
  task = await apply(core, task, "delivery_complete", deliveryResult(task));

  assert.equal(task.current_cursor, "DONE");
  assert.equal(task.current_action, null);
  assert.equal(task.outcome.status, "completed");
  assert.equal(task.revision, 13);
  assert.equal(core.calls.filter((name) => name === applyTool).length, 12);
});

async function apply(core, task, transition, nodeResult, reason = "") {
  const envelope = await core.call(
    applyTool,
    applyArguments(task, transition, nodeResult, `journey-${task.revision}-${transition}`, reason),
  );
  const next = envelope.result;
  assert.equal(next.revision, task.revision + 1);
  if (next.current_action !== null) {
    assert.notEqual(next.current_action.action_id, task.current_action.action_id);
    assert.equal(next.current_action.revision, next.revision);
  }
  return next;
}

function applyArguments(task, transition, nodeResult, requestId, reason = "") {
  const action = task.current_action;
  const payload = {
    transition_id: transition,
    summary: "The deterministic DeepSeek journey recorded the current result.",
    reason,
    artifacts: [],
    method_evidence: action.method_steps.map((step) => ({
      step_id: step.step_id,
      status: "plain_fallback",
      capability: "",
      summary: "Completed the current semantic method step.",
    })),
    node_result: { problem_class: problemClass(transition), ...nodeResult },
  };
  return {
    request_id: requestId,
    host: "deepseek",
    task_id: task.task_id,
    revision: task.revision,
    action_id: action.action_id,
    action_kind: action.action_kind,
    process_id: action.process_id,
    process_definition_digest: action.process_definition_digest,
    source_cursor: action.current_node,
    repository_binding_digest: action.repository_binding_digest,
    payload,
  };
}

function operationProbe(args) {
  return {
    operation_id: args.request_id,
    process_id: args.process_id,
    process_definition_digest: args.process_definition_digest,
    source_cursor: args.source_cursor,
    expected_revision: args.revision,
    action_id: args.action_id,
    action_kind: args.action_kind,
    repository_binding_digest: args.repository_binding_digest,
    payload: args.payload,
  };
}

function assertCompleteAction(action, node) {
  assert.equal(action.current_node, node);
  assert.equal(action.method_profile, "plain");
  for (const field of [
    "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "node_purpose", "entry_conditions", "completion_conditions",
    "allowed_effects", "required_evidence", "method_steps", "available_transitions",
    "payload_contract", "guidance", "repository_binding_digest", "issued_at",
  ]) assert.notEqual(action[field], undefined, field);
  assert.ok(action.method_steps.length > 0);
  assert.ok(action.available_transitions.length > 0);
}

function requirementsResult() {
  return {
    baseline: {
      goal: "Prove the deterministic DeepSeek graph loop.",
      scope: ["Exercise the current graph"],
      out_of_scope: ["Change Core semantics"],
      acceptance_criteria: ["The task reaches Core DONE", "Recovery reads precede any replay"],
      constraints: [], assumptions: [],
    },
    unresolved_questions: [],
  };
}

function designResult(requirementsRevision) {
  return {
    baseline: {
      requirements_revision: requirementsRevision,
      approach: "Use the direct graph flow.", components: ["DeepSeek Host"],
      decisions: ["Keep Core authoritative"], rejected_alternatives: [],
      complexity_justification: [], risks: [],
    }, findings: [],
  };
}

function tasksResult(designRevision) {
  return {
    baseline: {
      design_revision: designRevision,
      work_items: [{
        work_item_id: "work", summary: "Exercise the graph", expected_paths: ["feature.txt"],
        acceptance_indexes: [0, 1], verification_steps: ["Run targeted checks"], dependencies: [],
      }],
    }, findings: [],
  };
}

function implementationResult(taskPlanRevision) {
  return {
    task_plan_revision: taskPlanRevision,
    completed_work_item_ids: ["work"], changed_paths: ["feature.txt"], no_file_changes: false,
    deviations: [], findings: [],
  };
}

function failedTestResult() {
  return {
    checks: [{ source: "automated", name: "targeted-test", status: "failed", summary: "The targeted test failed.", command_count: 1, full_suite: false }],
    failed_items: ["targeted failure"], unverified_items: [], manual_handoff_items: [],
    findings: ["implementation defect"],
  };
}

function passedTestResult() {
  return {
    checks: [
      { source: "automated", name: "targeted-test", status: "passed", summary: "The targeted test passed.", command_count: 1, full_suite: false },
      { source: "static", name: "static-review", status: "passed", summary: "Static review completed.", command_count: 0, full_suite: false },
      { source: "host_observed", name: "host-observation", status: "passed", summary: "The Host observed the result.", command_count: 0, full_suite: false },
    ],
    failed_items: [], unverified_items: [], manual_handoff_items: [], findings: [],
  };
}

function comprehensionResult({ abstractions = [], findings = [], userPassed = false }) {
  return {
    explained_components: userPassed ? ["request entry", "guard", "Core bridge"] : [],
    unresolved_questions: [], unnecessary_abstractions: abstractions, maintenance_risks: [],
    user_confirmation: userPassed ? { source: "user", status: "passed", summary: "The developer confirmed understanding." } : null,
    findings,
  };
}

function refactorResult() {
  return {
    changed_paths: ["feature.txt"], no_file_changes: false,
    simplifications: ["Removed the factory layer"], behavior_change_intended: false, findings: [],
  };
}

function deliveryResult(task) {
  return {
    acceptance: task.baselines.requirements.acceptance_criteria.map((criterion) => ({ criterion, status: "satisfied" })),
    automated_evidence_ids: [task.test.evidence_ids[0]],
    manual_evidence_ids: [task.comprehension.user_evidence_id],
    test_record_id: task.test.record_id,
    comprehension_record_id: task.comprehension.record_id,
    unverified_items: [], risks: [], findings: [],
  };
}

function problemClass(transition) {
  return ({
    requirements_ready: "none", design_ready: "none", tasks_ready: "none",
    implementation_ready_for_test: "none", tests_failed_implementation: "implementation_failure",
    tests_passed: "none", code_too_complex: "code_complexity",
    refactor_ready_for_test: "none", comprehension_passed: "none", delivery_complete: "none",
  })[transition];
}

function authorizeExecution(text, callId, toolName, withHistoricalSelector = false) {
  const events = [];
  if (withHistoricalSelector) {
    events.push(
      event(0, "turn/start", { turn: 1 }),
      event(1, "user/message", userMessage("/dev-flow historical", "historical")),
      event(2, "turn/end", { turn: 1, reason: "completed" }),
    );
  }
  const offset = events.length;
  events.push(
    event(offset, "turn/start", { turn: 2 }),
    event(offset + 1, "user/message", userMessage(text, "current")),
    event(offset + 2, "tool/call", { turn: 2, step: 1, callId, name: toolName, arguments: "{}" }),
  );
  return authorizeDevFlowExecution({
    callId, rootCallId: callId, name: toolName, arguments: {}, signal: new AbortController().signal,
    token: Symbol(callId), agent: { status: "running", session: { events } },
  });
}

function event(seq, type, data) { return { seq, time: seq, type, data }; }
function userMessage(text, id) { return { id, role: "user", source: { kind: "user" }, content: [{ type: "text", text }] }; }

async function initializeGit(repository) {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1" };
  await execFile("git", ["init", "-q"], { cwd: repository, env });
  await execFile("git", ["config", "user.email", "journey@example.invalid"], { cwd: repository, env });
  await execFile("git", ["config", "user.name", "Journey Test"], { cwd: repository, env });
  await writeFile(join(repository, "README.md"), "initial\n");
  await execFile("git", ["add", "README.md"], { cwd: repository, env });
  await execFile("git", ["commit", "-q", "-m", "initial"], { cwd: repository, env });
}

async function temporaryRoot(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-graph-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
