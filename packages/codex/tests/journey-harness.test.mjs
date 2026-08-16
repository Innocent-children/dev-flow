import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  EXPLICIT_SELECTOR,
  buildCodexExecArgs,
  runDevelopmentSmoke,
  smokePrompt,
  validateAcceptanceReport,
} from "../../../scripts/write-codex-journey-evidence.mjs";
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
      name: "changed state",
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

test("development smoke preserves the exact post-session invariant failure", () => {
  assert.throws(
    () => smokeRuntime.validateDevelopmentSessions([], {}),
    (error) => error.classification === "post-session: MCP aggregate requires ordinary, invalid, substantive, and resume sessions",
  );
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
