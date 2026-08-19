import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  CODEX_COMPATIBILITY_RANGE,
  EXPLICIT_SELECTOR,
  FINAL_FIXTURE_EVIDENCE_KIND,
  FINAL_NATIVE_EVIDENCE_KIND,
  buildFinalJourneyEnvironment,
  buildFinalRegistryInstallArgs,
  buildFinalRegistryPackArgs,
  buildCodexExecArgs,
  createFinalJourneyLayout,
  inspectFinalCodexExecutable,
  parseCLI,
  runDevelopmentSmoke,
  smokePrompt,
  validateAcceptanceReport,
  validateFinalJourneyEvidence,
  validateFinalJourneyEvidenceShape,
} from "../../../scripts/write-codex-journey-evidence.mjs";
import { buildSupportMatrixFromFinalJourney } from "../../../scripts/verify-codex-release.mjs";
import { productionJourneyRunnerPath } from "../../../scripts/publish-codex-release.mjs";
import * as smokeRuntime from "../../../scripts/write-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const runner = join(repositoryRoot, "scripts", "run-codex-real-journey.sh");
const writer = join(repositoryRoot, "scripts", "write-codex-journey-evidence.mjs");
const validator = join(repositoryRoot, "scripts", "validate-codex-journey-evidence.mjs");
const fakeNativeTool = join(
  repositoryRoot,
  "packages",
  "codex",
  "tests",
  "fixtures",
  "fake-native-tool.mjs",
);
const fixtureRoot = join(repositoryRoot, "tests", "contract", "testdata", "codex-0.147");
const methodProfileFixturePath = join(
  repositoryRoot,
  "packages",
  "codex",
  "tests",
  "fixtures",
  "graph-method-profiles.json",
);

const fixtures = [
  ["success", "success.jsonl", "success"],
  ["core-domain-error", "core-domain-error.jsonl", "core_domain_error"],
  ["transport-error", "transport-error.jsonl", "transport_error"],
];

function validAcceptanceReport() {
  return {
    status: "pass",
    source_commit: "0123456789abcdef0123456789abcdef01234567",
    artifact_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    codex_version: "0.147.0",
    package_version: "0.1.0",
    core_version: "0.1.0",
    setup_readback_passed: true,
    ordinary_prompt_core_call_count: 0,
    explicit_selector: "$dev-flow-codex:dev-flow",
    task_id_before_restart: "task-00000001",
    task_id_after_restart: "task-00000001",
    committed_action_count: 2,
    terminal_outcome: "DONE",
    remove_readback_passed: true,
    task_data_retained: true,
    task_reopened_after_removal: true,
    unexpected_repository_paths: [],
  };
}

function fixtureFinalJourneyEvidence() {
  return {
    evidence_kind: FINAL_FIXTURE_EVIDENCE_KIND,
    status: "passed",
    package_name: "dev-flow-codex",
    package_version: "0.1.0",
    registry: "https://registry.npmjs.org/",
    npm_tarball_sha256: "a".repeat(64),
    npm_integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}`,
    package_root_location: "isolated-npm-prefix",
    core_version: "0.1.0",
    core_sha256: "b".repeat(64),
    source_commit: "c".repeat(40),
    codex_version: "0.147.0",
    compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
    codex_compatible: true,
    setup_readback_passed: true,
    ordinary_prompt_core_call_count: 0,
    explicit_selector: EXPLICIT_SELECTOR,
    task_id_before_restart: "task-00000001",
    task_revision_before_restart: 4,
    task_action_id_before_restart: "action-00000004",
    task_id_after_restart: "task-00000001",
    task_revision_after_restart: 4,
    task_action_id_after_restart: "action-00000004",
    committed_action_count: 4,
    terminal_outcome: "DONE",
    remove_readback_passed: true,
    npm_uninstall_passed: true,
    task_data_retained: true,
    task_reopened_after_uninstall: true,
    unexpected_repository_paths: [],
    observed_at: "2026-08-17T08:00:00.000Z",
  };
}

function coreSuccessEvent(tool, suffix, result) {
  const requestID = `request-${suffix}`;
  const envelope = { schema_version: 1, ok: true, request_id: requestID, tool, result };
  return {
    type: "item.completed",
    item: {
      id: `item-${suffix}`,
      type: "mcp_tool_call",
      server: "dev-flow",
      tool,
      arguments: { request_id: requestID },
      result: {
        content: [{ type: "text", text: JSON.stringify(envelope) }],
        structured_content: envelope,
      },
      error: null,
      status: "completed",
    },
  };
}

function rejectedOpenTaskEvent(suffix) {
  const requestID = `request-${suffix}`;
  const envelope = {
    schema_version: 1,
    ok: false,
    request_id: requestID,
    tool: "dev_flow_open_task",
    error: { code: "INVALID_ARGUMENT", message: "The task request is invalid." },
    recovery: { retry_safe: false, action: "none", message: "Correct the request before retrying." },
  };
  return {
    type: "item.completed",
    item: {
      id: `item-${suffix}`,
      type: "mcp_tool_call",
      server: "dev-flow",
      tool: "dev_flow_open_task",
      arguments: { request_id: requestID },
      result: {
        content: [{ type: "text", text: JSON.stringify(envelope) }],
        structured_content: envelope,
      },
      error: null,
      status: "failed",
    },
  };
}

function acceptanceSession(role, events = []) {
  return `${[
    { type: "thread.started", thread_id: `thread-${role}` },
    ...events,
  ].map(JSON.stringify).join("\n")}\n`;
}

test("thin native fixture tool emits the checked-in Codex 0.147 bytes without prompt inference", async () => {
  for (const [name, filename] of fixtures) {
    const expected = await readFile(join(fixtureRoot, filename), "utf8");
    const { stdout, stderr } = await execFile(process.execPath, [fakeNativeTool, "emit", name], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(stderr, "");
    assert.equal(stdout, expected);
  }

  const source = await readFile(fakeNativeTool, "utf8");
  assert.doesNotMatch(source, /dev-flow-codex:dev-flow|\$dev-flow|create native-proof|Resume the existing/u);
  assert.match(source, /DEV_FLOW_CODEX_FIXTURE/u);
});

test("fixture smoke classifies the three host terminal shapes", async () => {
  for (const [name, filename, shape] of fixtures) {
    const { stdout, stderr } = await execFile(runner, ["--fixture", name], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(stdout), {
      mode: "fixture",
      host: "codex-0.147",
      fixture: filename,
      thread_started: true,
      dev_flow_call_count: 1,
      tool: name === "success" ? "dev_flow_server_info" : "dev_flow_apply_action",
      terminal_shape: shape,
      status: "pass",
    });
  }
});

test("development fixture smoke is repeatable and creates no persistent attempt or evidence state", async () => {
  const isolatedCwd = await mkdtemp(join(tmpdir(), "dev-flow-codex-repeatable-smoke-"));
  const before = await readdir(isolatedCwd);
  const first = await execFile(runner, ["--fixture", "success"], {
    cwd: isolatedCwd,
    encoding: "utf8",
  });
  const second = await execFile(runner, ["--fixture", "success"], {
    cwd: isolatedCwd,
    encoding: "utf8",
  });

  assert.equal(first.stderr, "");
  assert.equal(second.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.deepEqual(await readdir(isolatedCwd), before);
  assert.equal("attempt" in JSON.parse(first.stdout), false);
  assert.equal("evidence" in JSON.parse(first.stdout), false);
});

test("real smoke wiring uses exact selector and ephemeral in-memory sessions", async () => {
  const successJSONL = await readFile(join(fixtureRoot, "success.jsonl"), "utf8");
  const invocations = [];
  const runProcess = async (executable, args, options) => {
    invocations.push({ executable, args, options });
    const prompt = args.at(-1);
    if (prompt.includes(EXPLICIT_SELECTOR)) {
      return { exitCode: 0, stdout: successJSONL, stderr: "" };
    }
    return {
      exitCode: 0,
      stdout: '{"type":"thread.started","thread_id":"thread-redacted-ordinary"}\n',
      stderr: "",
    };
  };

  const summary = await runDevelopmentSmoke({
    codexExecutable: "/fixture/codex",
    workspace: "/fixture/worktree",
    runProcess,
  });

  assert.equal(smokePrompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.deepEqual(buildCodexExecArgs(smokePrompt), ["exec", "--json", smokePrompt]);
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].args.at(-1).includes(EXPLICIT_SELECTOR), false);
  assert.equal(invocations[1].args.at(-1).startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.deepEqual(summary, {
    mode: "smoke",
    host: "codex-0.147",
    sessions: [
      {
        role: "ordinary",
        thread_started: true,
        dev_flow_call_count: 0,
        tools: [],
        terminal_shapes: [],
        core_done: false,
      },
      {
        role: "explicit",
        thread_started: true,
        dev_flow_call_count: 1,
        tools: ["dev_flow_server_info"],
        terminal_shapes: ["success"],
        core_done: false,
      },
    ],
    persistent_attempt_state: false,
    status: "pass",
  });
});

test("acceptance sessions request workspace-write without disabling repository rules", async () => {
  const invocations = [];
  let sequence = 0;
  const runProcess = async (executable, args, options) => {
    sequence += 1;
    invocations.push({ executable, args, options });
    return {
      exitCode: 0,
      stdout: `{"type":"thread.started","thread_id":"thread-acceptance-${sequence}"}\n`,
      stderr: "",
    };
  };

  await assert.rejects(
    smokeRuntime.runAcceptanceJourney({
      codexExecutable: "/fixture/codex",
      workspace: "/fixture/worktree",
      runProcess,
      snapshotState: async () => ({ stable: true }),
    }),
    /handshake/u,
  );

  assert.equal(invocations.length, 4);
  assert.equal(
    invocations[1].args.at(-1),
    "$dev-flow Reply exactly `BARE_SELECTOR_PROBE`. Do not call tools, inspect files, run commands, or modify the repository.",
  );
  assert.doesNotMatch(invocations[1].args.at(-1), /complete the bounded acceptance task/i);
  assert.match(
    invocations[2].args.at(-1),
    /first successful dev_flow_apply_action following the requested repository change/u,
  );
  assert.match(invocations[2].args.at(-1), /Core task remains nonterminal/u);
  assert.doesNotMatch(invocations[2].args.at(-1), /stop only at the Core outcome/u);
  assert.equal(invocations[2].options.stopAfterApplyPath, "/fixture/worktree/acceptance-proof.txt");
  assert.equal(
    invocations[2].options.stopAfterApplyContent,
    "Dev Flow Codex final acceptance passed.\n",
  );
  assert.equal(invocations[3].options.stopAfterApplyPath, undefined);
  for (const invocation of invocations) {
    const sandbox = invocation.args.indexOf("--sandbox");
    assert.notEqual(sandbox, -1);
    assert.equal(invocation.args[sandbox + 1], "workspace-write");
    assert.equal(invocation.args.includes("--ephemeral"), false);
    assert.equal(invocation.args.includes("--ignore-rules"), false);
  }
});

test("bare acceptance retains Core rejection facts and continues when state is unchanged", async () => {
  const streams = [
    acceptanceSession("ordinary"),
    acceptanceSession("bare", [
      coreSuccessEvent("dev_flow_server_info", "bare-info", { product: "dev-flow" }),
      rejectedOpenTaskEvent("bare-open"),
    ]),
    acceptanceSession("substantive", [
      coreSuccessEvent("dev_flow_server_info", "substantive-info", { product: "dev-flow" }),
      coreSuccessEvent("dev_flow_open_task", "substantive-open", {
        task: { task_id: "task-fixture", phase: "INTAKE" },
      }),
    ]),
    acceptanceSession("resume", [
      coreSuccessEvent("dev_flow_apply_action", "resume-done", {
        task: { task_id: "task-fixture", phase: "DONE" },
        outcome: { status: "completed" },
      }),
    ]),
  ];
  let invocation = 0;
  const stable = { tasks: [], events: [], claims: [], repository: "unchanged" };
  const result = await smokeRuntime.runAcceptanceJourney({
    codexExecutable: "/fixture/codex",
    workspace: "/fixture/worktree",
    runProcess: async () => ({ exitCode: 0, stdout: streams[invocation++], stderr: "" }),
    snapshotState: async () => structuredClone(stable),
  });

  assert.equal(invocation, 4);
  assert.equal(result.sessions[1].dev_flow_call_count, 2);
  assert.deepEqual(
    result.sessions[1].dev_flow_calls.map(({ tool, status, classification, error }) => ({
      tool, status, classification, code: error?.code ?? null,
    })),
    [
      { tool: "dev_flow_server_info", status: "completed", classification: "success", code: null },
      { tool: "dev_flow_open_task", status: "failed", classification: "core-domain-error", code: "INVALID_ARGUMENT" },
    ],
  );
  assert.equal(result.sessions[3].core_done, true);
  assert.equal(result.mcp_summary.session_dev_flow_call_count.invalid, 2);

  let substantiveInvocation = 0;
  const substantiveFailureStreams = [
    streams[0],
    streams[1],
    acceptanceSession("substantive-rejected", [rejectedOpenTaskEvent("substantive-rejected-open")]),
  ];
  await assert.rejects(
    smokeRuntime.runAcceptanceJourney({
      codexExecutable: "/fixture/codex",
      workspace: "/fixture/worktree",
      runProcess: async () => ({
        exitCode: 0,
        stdout: substantiveFailureStreams[substantiveInvocation++],
        stderr: "",
      }),
      snapshotState: async () => structuredClone(stable),
    }),
    /substantive Codex session returned Core domain error INVALID_ARGUMENT/u,
  );
  assert.equal(substantiveInvocation, 3);

  let resumeInvocation = 0;
  const resumeFailureStreams = [
    streams[0],
    streams[1],
    streams[2],
    acceptanceSession("resume-rejected", [rejectedOpenTaskEvent("resume-rejected-open")]),
  ];
  await assert.rejects(
    smokeRuntime.runAcceptanceJourney({
      codexExecutable: "/fixture/codex",
      workspace: "/fixture/worktree",
      runProcess: async () => ({
        exitCode: 0,
        stdout: resumeFailureStreams[resumeInvocation++],
        stderr: "",
      }),
      snapshotState: async () => structuredClone(stable),
    }),
    /resume Codex session returned Core domain error INVALID_ARGUMENT/u,
  );
  assert.equal(resumeInvocation, 4);
});

test("bare acceptance rejects successful task-bearing calls and state changes", async () => {
  const ordinary = acceptanceSession("ordinary");
  const successfulBare = acceptanceSession("bare-success", [
    coreSuccessEvent("dev_flow_open_task", "bare-success-open", {
      task: { task_id: "task-unexpected", phase: "INTAKE" },
    }),
  ]);
  const rejectedBare = acceptanceSession("bare-rejected", [rejectedOpenTaskEvent("bare-rejected-open")]);
  const stable = { tasks: [], events: [], claims: [], repository: "unchanged" };

  for (const entry of [
    {
      name: "successful task-bearing call",
      streams: [ordinary, successfulBare],
      snapshots: [stable, stable, stable],
      error: /successful task-bearing call/u,
    },
    {
      name: "changed repository state",
      streams: [ordinary, rejectedBare],
      snapshots: [stable, stable, { ...stable, repository: "changed" }],
      error: /changed task, event, claim, or repository state/u,
    },
    {
      name: "changed Core state",
      streams: [ordinary, rejectedBare],
      snapshots: [stable, stable, { ...stable, tasks: ["task-unexpected"] }],
      error: /changed task, event, claim, or repository state/u,
    },
  ]) {
    let invocation = 0;
    let snapshot = 0;
    await assert.rejects(
      smokeRuntime.runAcceptanceJourney({
        codexExecutable: "/fixture/codex",
        workspace: "/fixture/worktree",
        runProcess: async () => ({ exitCode: 0, stdout: entry.streams[invocation++], stderr: "" }),
        snapshotState: async () => structuredClone(entry.snapshots[snapshot++]),
      }),
      entry.error,
      entry.name,
    );
    assert.equal(invocation, 2, entry.name);
    assert.equal(snapshot, 3, entry.name);
  }
});

test("development smoke allocates every run surface under one fresh root", () => {
  assert.equal(typeof smokeRuntime.createDevelopmentSmokeLayout, "function");
  const first = smokeRuntime.createDevelopmentSmokeLayout("/tmp/dev-flow-smoke-a");
  const second = smokeRuntime.createDevelopmentSmokeLayout("/tmp/dev-flow-smoke-b");
  const isolatedFields = ["home", "codexHome", "installPrefix", "dataDirectory", "repository", "invalidWorkspace", "artifactDirectory", "diagnosticDirectory"];

  assert.equal(first.root, "/tmp/dev-flow-smoke-a");
  assert.equal(second.root, "/tmp/dev-flow-smoke-b");
  assert.equal(first.dataDirectory, `${first.home}/Library/Application Support/dev-flow/data`);
  assert.equal(second.dataDirectory, `${second.home}/Library/Application Support/dev-flow/data`);
  for (const field of isolatedFields) {
    assert.notEqual(first[field], second[field], field);
    assert.equal(first[field].startsWith(`${first.root}/`), true, field);
    assert.equal(second[field].startsWith(`${second.root}/`), true, field);
  }
});

test("development smoke admits only four bounded run labels and exact selectors", () => {
  assert.equal(typeof smokeRuntime.parseCLI, "function");
  const argumentsFor = (runLabel) => [
    "development-smoke", "--run-label", runLabel,
    "--codex-executable", "/opt/codex-0.147/codex",
    "--result-directory", `/tmp/result-${runLabel}`,
  ];
  for (const runLabel of ["A", "B", "C", "D"]) {
    assert.equal(smokeRuntime.parseCLI(argumentsFor(runLabel)).runLabel, runLabel);
  }
  assert.throws(() => smokeRuntime.parseCLI(argumentsFor("E")), /run label/u);
  for (const prompt of [smokeRuntime.developmentInvalidPrompt, smokeRuntime.developmentSubstantivePrompt, smokeRuntime.developmentResumePrompt]) {
    assert.equal(prompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  }
  assert.equal(smokeRuntime.ordinaryPrompt.includes(EXPLICIT_SELECTOR), false);
  assert.equal(buildCodexExecArgs(smokeRuntime.developmentSubstantivePrompt, { ephemeral: true }).includes("--ignore-user-config"), false);
  assert.match(smokeRuntime.developmentSubstantivePrompt, /ASSESS_TASK[\s\S]*PLAN_CHANGE[\s\S]*prerequisite/i);
  assert.match(smokeRuntime.developmentSubstantivePrompt, /file exists[\s\S]*first successful[\s\S]*after (?:creating|creation)/i);
});

test("final registry resume prompt requires both authoritative reads before apply", () => {
  assert.equal(smokeRuntime.finalRegistryResumePrompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.match(
    smokeRuntime.finalRegistryResumePrompt,
    /dev_flow_open_task[\s\S]*MUST call dev_flow_get_task[\s\S]*then dev_flow_get_next_action[\s\S]*before any dev_flow_apply_action/u,
  );
  assert.match(smokeRuntime.finalRegistryResumePrompt, /Do not use the action returned by dev_flow_open_task to skip either read/u);
});

test("development smoke enforces ordinary and invalid zero-call admission", () => {
  assert.equal(typeof smokeRuntime.assertDevelopmentAdmissionIsolation, "function");
  const ordinary = { dev_flow_call_count: 0, tools: [] };
  const invalid = { dev_flow_call_count: 0, tools: [] };
  assert.doesNotThrow(() => smokeRuntime.assertDevelopmentAdmissionIsolation(ordinary, invalid));
  assert.throws(
    () => smokeRuntime.assertDevelopmentAdmissionIsolation(
      { dev_flow_call_count: 1, tools: ["dev_flow_server_info"] },
      invalid,
    ),
    /ordinary/u,
  );
  assert.throws(
    () => smokeRuntime.assertDevelopmentAdmissionIsolation(
      ordinary,
      { dev_flow_call_count: 1, tools: ["dev_flow_open_task"] },
    ),
    /invalid/u,
  );
});

test("development smoke result and failure diagnostic stay ephemeral and sanitized", () => {
  assert.equal(typeof smokeRuntime.buildDevelopmentSmokeResult, "function");
  assert.equal(typeof smokeRuntime.sanitizeSmokeFailure, "function");
  const result = smokeRuntime.buildDevelopmentSmokeResult({
    status: "pass",
    runId: "run-redacted",
    ordinaryCoreCalls: 0,
    invalidOpenTaskCalls: 0,
    taskIdBeforeRestart: "task-redacted",
    taskIdAfterRestart: "task-redacted",
    committedActionCount: 2,
    terminalOutcome: "DONE",
    setupReadbackPassed: true,
    removeReadbackPassed: true,
    taskDataRetained: true,
    unexpectedRepositoryPaths: [],
    failureKind: null,
  });
  assert.deepEqual(Object.keys(result), [
    "status",
    "run_id",
    "codex_version",
    "package_version",
    "core_version",
    "ordinary_core_calls",
    "invalid_open_task_calls",
    "task_id_before_restart",
    "task_id_after_restart",
    "committed_action_count",
    "terminal_outcome",
    "setup_readback_passed",
    "remove_readback_passed",
    "task_data_retained",
    "unexpected_repository_paths",
    "failure_kind",
  ]);
  assert.equal("acceptance" in result, false);
  assert.equal("artifact" in result, false);
  assert.equal("attempt" in result, false);
  assert.equal("evidence" in result, false);

  const diagnostic = smokeRuntime.sanitizeSmokeFailure({
    role: "substantive",
    eventCount: 7,
    mcpTool: "dev_flow_apply_action",
    status: "failed",
    classification: "transport-error",
    exitCode: 1,
    stdout: "raw model response with token-secret",
    stderr: "prompt failed at /Users/private/repository with ENV=value",
  });
  assert.deepEqual(Object.keys(diagnostic), [
    "session_role",
    "event_count",
    "mcp_tool",
    "status",
    "classification",
    "exit_code",
    "stdout_sha256",
    "stderr_sha256",
  ]);
  assert.doesNotMatch(JSON.stringify(diagnostic), /raw model|token-secret|\/Users\/private|ENV=value/u);
});

test("development smoke closes stdin before waiting for Codex JSONL", async () => {
  const childProgram = "let ended=false;process.stdin.resume();process.stdin.once('end',()=>{ended=true;process.stdout.write('closed')});setTimeout(()=>process.exit(ended?0:7),100)";
  const result = await smokeRuntime.defaultRunProcess(process.execPath, ["-e", childProgram], { cwd: repositoryRoot });
  assert.deepEqual({ exitCode: result.exitCode, stdout: result.stdout }, { exitCode: 0, stdout: "closed" });
});

test("simulated Contract 0.2 journey starts with handshake and presents the complete multi-edge node contract", async () => {
  const fixture = await readMethodProfileFixture();
  const scenario = fixture.scenarios.find(({ id }) => id === "comprehension-awaiting-user-verdict");
  const journey = simulateMethodAdapterJourney(fixture, scenario);

  assert.equal(fixture.evidence_class, "simulated_static_adapter_journey");
  assert.equal(journey.calls[0].tool, "dev_flow_server_info");
  assert.deepEqual(journey.calls.map(({ tool }) => tool), [
    "dev_flow_server_info",
    "dev_flow_get_next_action",
  ]);
  assert.deepEqual(journey.handshake, {
    schema_version: 2,
    core_limits_version: "0.2",
    process: "standard-development@1",
    definition_digest: "5265db6c44ce12ea55d9fdb072b4dcb2345f6e2a1e89b016644c2819e320f2c1",
    new_task_supported: true,
    method_profiles: ["plain", "spec-kit", "openspec"],
    tools: [
      "dev_flow_server_info",
      "dev_flow_open_task",
      "dev_flow_get_task",
      "dev_flow_get_next_action",
      "dev_flow_apply_action",
      "dev_flow_cancel_task",
    ],
  });
  assert.equal(journey.presentation.current_node, "COMPREHENSION_REVIEW");
  for (const field of [
    "node_purpose",
    "entry_conditions",
    "completion_conditions",
    "allowed_effects",
    "required_evidence",
    "method_profile",
    "method_steps",
    "available_transitions",
  ]) {
    assert.notEqual(journey.presentation[field], undefined, field);
  }
  assert.equal(journey.presentation.method_steps.length, 3);
  assert.equal(journey.presentation.available_transitions.length, 6);
  assert.deepEqual(
    journey.presentation.available_transitions.map(({ transition_id }) => transition_id),
    fixture.actions.comprehension_review.available_transitions.map(({ transition_id }) => transition_id),
  );
  for (const transition of journey.presentation.available_transitions) {
    assert.equal(typeof transition.destination, "string");
    assert.equal(typeof transition.when, "string");
    assert.equal(typeof transition.reason_required, "boolean");
  }
  assert.equal(journey.selected_transition, null);
  assert.equal(journey.apply_request, null);
});

test("simulated method journeys use only visible capabilities and wait for completed fallback work", async () => {
  const fixture = await readMethodProfileFixture();
  const byID = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));

  const available = simulateMethodAdapterJourney(fixture, byID.get("spec-kit-requirements-available"));
  assert.deepEqual(
    available.rendered_operations.map(({ capability_id, availability }) => ({ capability_id, availability })),
    [
      { capability_id: "speckit-specify", availability: "available" },
      { capability_id: "speckit-clarify", availability: "available" },
      { capability_id: "speckit-checklist", availability: "available" },
    ],
  );
  assert.equal(available.apply_request.payload.node_result.problem_class, "none");
  assert.equal("destination" in available.apply_request, false);
  assert.equal("destination" in available.apply_request.payload, false);
  assert.equal(available.core_destination, "DESIGN");

  const specKitPending = simulateMethodAdapterJourney(fixture, byID.get("spec-kit-clarify-unavailable-pending"));
  const missingClarify = specKitPending.rendered_operations.find(({ step_id }) => step_id === "requirements.clarify");
  assert.deepEqual({ capability_id: missingClarify.capability_id, availability: missingClarify.availability }, {
    capability_id: "speckit-clarify",
    availability: "unavailable",
  });
  assert.match(missingClarify.plain_equivalent, /material questions/i);
  assert.equal(specKitPending.apply_request, null);

  const specKitFallback = simulateMethodAdapterJourney(
    fixture,
    byID.get("spec-kit-clarify-unavailable-fallback-complete"),
  );
  assert.equal(specKitFallback.presentation.method_profile, "spec-kit");
  assert.equal(specKitFallback.apply_request.payload.method_evidence[1].status, "plain_fallback");
  assert.equal(specKitFallback.apply_request.payload.method_evidence[1].capability, "");
  assert.equal(specKitFallback.core_destination, "DESIGN");

  const openSpecPending = simulateMethodAdapterJourney(fixture, byID.get("openspec-verify-unavailable-pending"));
  const missingVerify = openSpecPending.rendered_operations.find(({ step_id }) => step_id === "test.run_budgeted_checks");
  assert.deepEqual({ capability_id: missingVerify.capability_id, availability: missingVerify.availability }, {
    capability_id: "openspec-verify",
    availability: "unavailable",
  });
  assert.match(missingVerify.plain_equivalent, /bounded verification|plan-defined checks/i);
  assert.equal(openSpecPending.apply_request, null);

  const openSpecFallback = simulateMethodAdapterJourney(
    fixture,
    byID.get("openspec-verify-unavailable-fallback-complete"),
  );
  assert.equal(openSpecFallback.presentation.method_profile, "openspec");
  assert.equal(openSpecFallback.apply_request.payload.method_evidence.every(({ status }) => status === "plain_fallback"), true);
  assert.equal(openSpecFallback.core_destination, "COMPREHENSION_REVIEW");
});

test("simulated comprehension journey waits for the developer and uses only the matching Core edge", async () => {
  const fixture = await readMethodProfileFixture();
  const byID = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));

  const awaiting = simulateMethodAdapterJourney(fixture, byID.get("comprehension-awaiting-user-verdict"));
  assert.deepEqual(awaiting.comprehension_prompt, {
    presents_requirements_design_and_code_paths: true,
    presents_unnecessary_abstractions: true,
    presents_maintenance_risks: true,
    asks_developer_to_explain_and_maintain: true,
    waits_for_explicit_verdict: true,
  });
  assert.equal(awaiting.apply_request, null);
  assert.equal(awaiting.selected_transition, null);

  const understood = simulateMethodAdapterJourney(fixture, byID.get("comprehension-user-understands"));
  assert.equal(understood.apply_request.payload.transition_id, "comprehension_passed");
  assert.deepEqual(understood.apply_request.payload.node_result.user_confirmation, {
    source: "user",
    status: "passed",
    summary: "The developer explicitly confirmed understanding.",
  });
  assert.equal(understood.apply_request.payload.node_result.problem_class, "none");
  assert.equal(understood.core_destination, "DELIVERY");

  const tooComplex = simulateMethodAdapterJourney(fixture, byID.get("comprehension-code-too-complex"));
  assert.equal(tooComplex.apply_request.payload.transition_id, "code_too_complex");
  assert.equal(tooComplex.apply_request.payload.node_result.problem_class, "code_complexity");
  assert.equal(tooComplex.apply_request.payload.node_result.user_confirmation, null);
  assert.equal(tooComplex.core_destination, "REFACTOR");
});

test("simulated tool-state and uncertain-result journeys cannot claim Core completion", async () => {
  const fixture = await readMethodProfileFixture();
  const byID = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const toolOnly = simulateMethodAdapterJourney(fixture, byID.get("method-tool-state-without-core-result"));
  assert.deepEqual(toolOnly.method_tool_state, [
    "command_success",
    "artifact_exists",
    "checkbox_checked",
    "archive_complete",
  ]);
  assert.equal(toolOnly.apply_request, null);
  assert.equal(toolOnly.current_node_after, "REQUIREMENTS");
  assert.equal(toolOnly.selected_transition, null);

  const completed = simulateMethodAdapterJourney(
    fixture,
    byID.get("openspec-verify-unavailable-fallback-complete"),
  );
  const recovery = handleUncertainFixtureResult(fixture, completed.apply_request);
  assert.equal(recovery.calls[0].tool, "dev_flow_get_task");
  assert.equal(recovery.operation_probe.source_cursor, "TEST");
  assert.deepEqual(recovery.core_response, {
    code: "RECOVERY_UNAVAILABLE",
    retry_safe: false,
    action: "none",
  });
  assert.equal(recovery.stopped, true);
  assert.equal(recovery.automatic_retry, false);
  assert.equal(recovery.recovery_apply_used, false);
  assert.equal(recovery.classification_inferred, false);
});

test("development smoke preserves the exact post-session invariant failure", () => {
  assert.throws(
    () => smokeRuntime.validateDevelopmentSessions([], {}),
    (error) => error.classification === "post-session: MCP aggregate requires ordinary, invalid, substantive, and resume sessions",
  );
});

test("final registry journey CLI is closed, registry-only, and rejects local substitution", () => {
  const exact = [
    "final-registry",
    "--package", "dev-flow-codex",
    "--version", "0.1.0",
    "--registry", "https://registry.npmjs.org/",
    "--tarball-sha256", "a".repeat(64),
    "--core-sha256", "b".repeat(64),
    "--source-commit", "c".repeat(40),
    "--codex-executable", "/opt/codex/bin/codex",
    "--workspace", "/tmp/final-workspace",
    "--result-directory", "/tmp/final-result",
  ];
  assert.deepEqual(parseCLI([...exact]), {
    mode: "final-registry",
    packageName: "dev-flow-codex",
    version: "0.1.0",
    registry: "https://registry.npmjs.org/",
    tarballSHA256: "a".repeat(64),
    coreSHA256: "b".repeat(64),
    sourceCommit: "c".repeat(40),
    codexExecutable: "/opt/codex/bin/codex",
    workspace: "/tmp/final-workspace",
    resultDirectory: "/tmp/final-result",
  });

  const replaceValue = (flag, value) => {
    const candidate = [...exact];
    candidate[candidate.indexOf(flag) + 1] = value;
    return candidate;
  };
  assert.throws(() => parseCLI(replaceValue("--package", "other-package")), /package must equal dev-flow-codex/u);
  assert.throws(() => parseCLI(replaceValue("--registry", "https://registry.example.invalid/")), /official npm registry/u);
  assert.throws(() => parseCLI(replaceValue("--workspace", "relative")), /workspace must be an absolute path/u);
  assert.throws(() => parseCLI([...exact, "--local-tgz", "/tmp/package.tgz"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--runtime-override", "/tmp/dev-flow"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--skip-journey", "true"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--registry", "https://registry.npmjs.org/"]), /exact flag/u);

  assert.deepEqual(buildFinalRegistryInstallArgs({
    version: "0.1.0",
    prefix: "/tmp/isolated-prefix",
    cache: "/tmp/isolated-cache",
  }), [
    "install", "--global", "dev-flow-codex@0.1.0",
    "--registry=https://registry.npmjs.org/",
    "--prefix", "/tmp/isolated-prefix",
    "--cache", "/tmp/isolated-cache",
    "--ignore-scripts", "--no-audit", "--no-fund",
  ]);
  assert.deepEqual(buildFinalRegistryPackArgs({
    version: "0.1.0",
    destination: "/tmp/registry-readback",
  }), [
    "pack", "dev-flow-codex@0.1.0",
    "--pack-destination", "/tmp/registry-readback",
    "--ignore-scripts", "--json",
    "--registry=https://registry.npmjs.org/",
  ]);
});

test("production publisher owns the final Journey runner independently of frozen source identity", () => {
  assert.equal(productionJourneyRunnerPath(), runner);
  assert.equal(productionJourneyRunnerPath().startsWith(`${repositoryRoot}/`), true);
});

test("final registry journey accepts an executable Codex script and records its semantic version", async () => {
  assert.equal(await inspectFinalCodexExecutable(fakeNativeTool, process.env), "0.147.0");
});

test("final registry journey layout and product environment stay inside isolated roots", () => {
  const layout = createFinalJourneyLayout(
    "/tmp/final-root",
    "/tmp/final-workspace",
    "/tmp/final-results",
  );
  assert.equal(layout.workspace, "/tmp/final-workspace");
  assert.equal(layout.resultDirectory, "/tmp/final-results");
  for (const field of [
    "home", "codexHome", "installPrefix", "npmCache", "dataDirectory",
    "temporaryDirectory", "registryReadbackDirectory",
  ]) {
    assert.equal(layout[field].startsWith("/tmp/final-root/"), true, field);
  }

  const environment = buildFinalJourneyEnvironment({
    layout,
    codexExecutable: "/opt/codex/bin/codex",
    toolDirectories: ["/opt/node/bin", "/usr/bin", "/bin"],
    baseEnvironment: {
      PATH: `/source/repository/packages/codex/bin:${process.env.PATH ?? ""}`,
      NODE_PATH: "/source/repository/node_modules",
      DEV_FLOW_CORE_PATH: "/source/repository/dev-flow",
      DEV_FLOW_PACKAGE_PATH: "/source/repository/packages/codex",
      NPM_TOKEN: "private-fixture-token",
      LANG: "en_US.UTF-8",
    },
  });
  assert.equal(environment.HOME, layout.home);
  assert.equal(environment.CODEX_HOME, layout.codexHome);
  assert.equal(environment.DEV_FLOW_DATA_DIR, layout.dataDirectory);
  assert.equal(environment.TMPDIR, layout.temporaryDirectory);
  assert.equal(environment.npm_config_prefix, layout.installPrefix);
  assert.equal(environment.npm_config_cache, layout.npmCache);
  assert.equal(environment.PATH.split(":" )[0], join(layout.installPrefix, "bin"));
  assert.equal(environment.PATH.includes("/source/repository"), false);
  for (const name of ["NODE_PATH", "DEV_FLOW_CORE_PATH", "DEV_FLOW_PACKAGE_PATH", "NPM_TOKEN"]) {
    assert.equal(name in environment, false, name);
  }
});

test("fixture journey evidence is closed and can never satisfy the native production gate", () => {
  const fixture = fixtureFinalJourneyEvidence();
  assert.deepEqual(validateFinalJourneyEvidenceShape(fixture, { allowFixture: true }), fixture);
  assert.throws(() => validateFinalJourneyEvidence(fixture), /native registry-package evidence/u);
  assert.throws(
    () => validateFinalJourneyEvidenceShape({ ...fixture, raw_stdout: "private raw output" }, { allowFixture: true }),
    /unexpected field raw_stdout/u,
  );
  assert.throws(
    () => validateFinalJourneyEvidenceShape({ ...fixture, package_root_location: "/private/tmp/package" }, { allowFixture: true }),
    /package_root_location/u,
  );
  assert.throws(
    () => validateFinalJourneyEvidenceShape({ ...fixture, task_revision_after_restart: 5 }, { allowFixture: true }),
    /restart task identity/u,
  );
});

test("passed support matrix is derived only from matching native registry journey identity", () => {
  const fixture = fixtureFinalJourneyEvidence();
  const manifest = {
    release: { version: "0.1.0", source_commit: "c".repeat(40) },
    artifacts: [
      { kind: "core_binary", sha256: "b".repeat(64) },
      { kind: "npm_tarball", sha256: "a".repeat(64) },
    ],
    package_files: [
      { path: "runtime/darwin-arm64/dev-flow", sha256: "b".repeat(64) },
    ],
  };
  assert.throws(
    () => buildSupportMatrixFromFinalJourney({ manifest, evidence: fixture }),
    /native registry-package evidence/u,
  );

  const nativeContract = { ...fixture, evidence_kind: FINAL_NATIVE_EVIDENCE_KIND };
  assert.deepEqual(buildSupportMatrixFromFinalJourney({ manifest, evidence: nativeContract }), [{
    os: "darwin",
    arch: "arm64",
    actual_codex_version: "0.147.0",
    compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
    package_sha256: "a".repeat(64),
    core_sha256: "b".repeat(64),
    journey_result: "passed",
    journey_observed_at: "2026-08-17T08:00:00.000Z",
    notes: "Native registry-package Codex journey passed setup, zero-trigger, restart/resume, DONE, removal, uninstall, and retained reopen gates.",
  }]);
  for (const [name, patch, pattern] of [
    ["package digest", { npm_tarball_sha256: "d".repeat(64) }, /npm_tarball_sha256/u],
    ["Core digest", { core_sha256: "d".repeat(64) }, /core_sha256/u],
    ["source commit", { source_commit: "d".repeat(40) }, /source_commit/u],
  ]) {
    assert.throws(
      () => buildSupportMatrixFromFinalJourney({
        manifest,
        evidence: { ...nativeContract, ...patch },
      }),
      pattern,
      name,
    );
  }
  const unboundedVersion = buildSupportMatrixFromFinalJourney({
    manifest,
    evidence: { ...nativeContract, codex_version: "9.9.9" },
  });
  assert.equal(unboundedVersion[0].actual_codex_version, "9.9.9");
  assert.equal(unboundedVersion[0].compatible_codex_range, CODEX_COMPATIBILITY_RANGE);
});

test("simplified acceptance validates one complete closed FR-028 report", () => {
  const report = validAcceptanceReport();
  assert.deepEqual(validateAcceptanceReport(report), report);
});

test("simplified acceptance rejects every missing required fact without defaults", () => {
  const report = validAcceptanceReport();
  for (const field of Object.keys(report)) {
    const candidate = structuredClone(report);
    delete candidate[field];
    assert.throws(
      () => validateAcceptanceReport(candidate),
      new RegExp(`required field ${field}`, "u"),
      field,
    );
  }
});

test("simplified acceptance rejects incomplete or internally inconsistent FR-028 facts", () => {
  const cases = [
    ["non-pass status", { status: "failed" }, /status/u],
    ["invalid source identity", { source_commit: "not-a-commit" }, /source_commit/u],
    ["invalid artifact identity", { artifact_sha256: "not-a-digest" }, /artifact_sha256/u],
    ["missing host version", { codex_version: "" }, /codex_version/u],
    ["package/Core mismatch", { core_version: "0.2.0" }, /package_version.*core_version/u],
    ["setup readback failed", { setup_readback_passed: false }, /setup_readback_passed/u],
    ["ordinary prompt called Core", { ordinary_prompt_core_call_count: 1 }, /ordinary_prompt_core_call_count/u],
    ["wrong selector", { explicit_selector: "$dev-flow" }, /explicit_selector/u],
    ["restart changed task", { task_id_after_restart: "task-00000002" }, /task_id_before_restart.*task_id_after_restart/u],
    ["too few commits", { committed_action_count: 1 }, /committed_action_count/u],
    ["non-DONE terminal", { terminal_outcome: "BLOCKED" }, /terminal_outcome/u],
    ["remove readback failed", { remove_readback_passed: false }, /remove_readback_passed/u],
    ["task data lost", { task_data_retained: false }, /task_data_retained/u],
    ["task did not reopen", { task_reopened_after_removal: false }, /task_reopened_after_removal/u],
    ["repository contains unexpected paths", { unexpected_repository_paths: ["unexpected.txt"] }, /unexpected_repository_paths/u],
    ["report is not closed", { extra_release_provenance: "deferred" }, /unexpected field extra_release_provenance/u],
  ];

  for (const [name, patch, expected] of cases) {
    assert.throws(
      () => validateAcceptanceReport({ ...validAcceptanceReport(), ...patch }),
      expected,
      name,
    );
  }
});

test("native runner rejects legacy ledger/report arguments before any host launch", async () => {
  await assert.rejects(
    execFile(runner, [
      "--validation-report", "/tmp/validation.json",
      "--artifact-report", "/tmp/artifact.json",
      "--attempt-ledger", "/tmp/ledger.json",
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /usage: run-codex-real-journey/u);
      return true;
    },
  );
});

test("native smoke scripts contain no active release ledger, report, or canonical evidence protocol", async () => {
  for (const path of [runner, writer, validator]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /attempt[_-]ledger|validation[_-]report|artifact[_-]report|pass-lock|create-no-replace|fsync|inode|TOCTOU|schema[_ -]?version [234]/iu,
      path,
    );
  }
});

async function readMethodProfileFixture() {
  return JSON.parse(await readFile(methodProfileFixturePath, "utf8"));
}

function simulateMethodAdapterJourney(fixture, scenario) {
  const calls = [{ tool: "dev_flow_server_info", arguments: {} }];
  const info = fixture.server_info;
  assert.equal(info.schema_version, 2);
  assert.equal(info.core_limits_version, "0.2");
  assert.deepEqual(info.method_profiles, ["plain", "spec-kit", "openspec"]);
  assert.equal(info.supported_processes.length, 1);
  assert.equal(info.supported_processes[0].process_id, "standard-development");
  assert.equal(info.supported_processes[0].process_version, 1);
  assert.equal(info.supported_processes[0].new_task_supported, true);
  assert.equal(info.tools.length, 6);

  const action = fixture.actions[scenario.action];
  calls.push({ tool: "dev_flow_get_next_action", arguments: { task_id: action.task_id } });
  const presentation = {
    current_node: action.current_node,
    node_purpose: action.node_purpose,
    entry_conditions: action.entry_conditions,
    completion_conditions: action.completion_conditions,
    allowed_effects: action.allowed_effects,
    required_evidence: action.required_evidence,
    method_profile: scenario.profile,
    method_steps: action.method_steps,
    available_transitions: action.available_transitions,
  };
  const renderedOperations = action.method_steps.map((step) => renderFixtureOperation(step, scenario));
  const applyRequest = buildFixtureApplyRequest(fixture, action, scenario);
  const transition = applyRequest
    ? action.available_transitions.find(({ transition_id }) => transition_id === applyRequest.payload.transition_id)
    : null;
  if (applyRequest) calls.push({ tool: "dev_flow_apply_action", arguments: applyRequest });

  return {
    calls,
    handshake: {
      schema_version: info.schema_version,
      core_limits_version: info.core_limits_version,
      process: `${info.supported_processes[0].process_id}@${info.supported_processes[0].process_version}`,
      definition_digest: info.supported_processes[0].definition_digest,
      new_task_supported: info.supported_processes[0].new_task_supported,
      method_profiles: info.method_profiles,
      tools: info.tools,
    },
    presentation,
    rendered_operations: renderedOperations,
    comprehension_prompt: action.current_node === "COMPREHENSION_REVIEW" ? {
      presents_requirements_design_and_code_paths: true,
      presents_unnecessary_abstractions: true,
      presents_maintenance_risks: true,
      asks_developer_to_explain_and_maintain: true,
      waits_for_explicit_verdict: true,
    } : null,
    method_tool_state: scenario.method_tool_state ?? [],
    selected_transition: applyRequest?.payload.transition_id ?? null,
    apply_request: applyRequest,
    core_destination: transition?.destination ?? null,
    current_node_after: transition?.destination ?? action.current_node,
  };
}

function renderFixtureOperation(step, scenario) {
  const preferred = preferredFixtureCapability(scenario.profile, step.step_id);
  const available = preferred !== "" && scenario.available_capabilities.includes(preferred);
  return {
    step_id: step.step_id,
    purpose: step.purpose,
    required: step.required,
    profile: scenario.profile,
    capability_id: preferred,
    availability: preferred === "" ? "not_applicable" : available ? "available" : "unavailable",
    plain_equivalent: plainFixtureWork(step.step_id),
  };
}

function preferredFixtureCapability(profile, stepID) {
  const capabilities = {
    "spec-kit": {
      "requirements.capture": "speckit-specify",
      "requirements.clarify": "speckit-clarify",
      "requirements.validate": "speckit-checklist",
    },
    openspec: {
      "requirements.capture": "openspec-propose",
      "requirements.validate": "openspec-validate",
      "test.run_budgeted_checks": "openspec-verify",
    },
  };
  return capabilities[profile]?.[stepID] ?? "";
}

function plainFixtureWork(stepID) {
  const work = {
    "requirements.capture": "Write or revise bounded requirements.",
    "requirements.clarify": "Ask only material questions and record the developer's answers.",
    "requirements.validate": "Review observable acceptance and resolve material ambiguity.",
    "test.run_budgeted_checks": "Run the bounded verification or plan-defined checks.",
    "test.record_evidence": "Record actual current evidence.",
    "test.classify_failure": "Classify the observed test result.",
    "comprehension.explain": "Explain the requirements, design, and major code paths.",
    "comprehension.identify_complexity": "List unnecessary abstractions and maintenance risks.",
    "comprehension.obtain_user_verdict": "Ask the developer and wait for an explicit verdict.",
  };
  return work[stepID];
}

function buildFixtureApplyRequest(fixture, action, scenario) {
  if (!scenario.should_apply || !scenario.transition_id || !scenario.node_result) return null;
  if (scenario.method_evidence.length !== action.method_steps.length) return null;
  for (const [index, step] of action.method_steps.entries()) {
    const evidence = scenario.method_evidence[index];
    if (evidence.step_id !== step.step_id) return null;
    if (step.required && !["completed", "plain_fallback"].includes(evidence.status)) return null;
    if (evidence.status === "completed" && !scenario.available_capabilities.includes(evidence.capability)) return null;
    if (evidence.status === "plain_fallback" && evidence.capability !== "") return null;
  }
  if (!action.available_transitions.some(({ transition_id }) => transition_id === scenario.transition_id)) return null;
  const nodeResult = typeof scenario.node_result === "string"
    ? fixture[scenario.node_result]
    : scenario.node_result;
  if (!nodeResult || typeof nodeResult.problem_class !== "string") return null;
  return {
    request_id: `request-${scenario.id}`,
    host: "codex",
    task_id: action.task_id,
    revision: action.revision,
    action_id: action.action_id,
    action_kind: action.action_kind,
    process_id: action.process_id,
    process_version: action.process_version,
    process_definition_digest: action.process_definition_digest,
    source_cursor: action.current_node,
    repository_binding_digest: action.repository_binding_digest,
    payload: {
      transition_id: scenario.transition_id,
      summary: `Completed simulated semantic work for ${scenario.id}.`,
      reason: scenario.reason ?? "",
      artifacts: [],
      method_evidence: scenario.method_evidence,
      node_result: nodeResult,
    },
  };
}

function handleUncertainFixtureResult(fixture, applyRequest) {
  const operationProbe = {
    operation_id: applyRequest.request_id,
    process_id: applyRequest.process_id,
    process_version: applyRequest.process_version,
    process_definition_digest: applyRequest.process_definition_digest,
    source_cursor: applyRequest.source_cursor,
    expected_revision: applyRequest.revision,
    action_id: applyRequest.action_id,
    action_kind: applyRequest.action_kind,
    repository_binding_digest: applyRequest.repository_binding_digest,
    payload: applyRequest.payload,
  };
  return {
    calls: [{ tool: "dev_flow_get_task", arguments: { task_id: applyRequest.task_id, operation_probe: operationProbe } }],
    operation_probe: operationProbe,
    core_response: fixture.uncertain_result.core_response,
    stopped: true,
    automatic_retry: false,
    recovery_apply_used: false,
    classification_inferred: false,
  };
}
