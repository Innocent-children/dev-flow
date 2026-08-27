import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import {
  CODEX_COMPATIBILITY_RANGE,
  EXPLICIT_SELECTOR,
  FINAL_FIXTURE_EVIDENCE_KIND,
  FINAL_LOCAL_NATIVE_EVIDENCE_KIND,
  FINAL_NATIVE_EVIDENCE_KIND,
  QUICK_NATIVE_EVIDENCE_KIND,
  assertFinalLocalCommands,
  buildFinalLocalInstallArgs,
  buildFinalLocalJourneyEnvironment,
  buildFinalLocalLifecycleEnvironment,
  buildFinalLocalUninstallArgs,
  buildFinalJourneyEnvironment,
  buildFinalRegistryInstallArgs,
  buildFinalRegistryPackArgs,
  buildCodexExecArgs,
  classifyFinalLocalVerificationCommand,
  createFinalJourneyLayout,
  createFinalLocalJourneyLayout,
  createFinalLocalLifecycleLayout,
  finalLocalSessionOnePrompt,
  finalLocalSessionTwoPrompt,
  finalLocalSessionThreePrompt,
  inspectFinalCodexExecutable,
  parseCLI,
  runDevelopmentSmoke,
  smokePrompt,
  successfulNonterminalApplyEvent,
  validateAcceptanceReport,
  validateAttempt3NativeFlowEvidence,
  validateCompositeAcceptanceEvidence,
  validateExactArtifactLifecycleEvidence,
  validateFinalJourneyEvidence,
  validateFinalJourneyEvidenceShape,
  validateFinalLocalJourneyEvidence,
  validateQuickJourneyEvidence,
} from "../../../scripts/write-codex-journey-evidence.mjs";
import { buildSupportMatrixFromFinalJourney } from "../../../scripts/verify-codex-release.mjs";
import { productionJourneyRunnerPath } from "../../../scripts/publish-codex-release.mjs";
import { DEV_FLOW_TOOLS, parseCodexJSONL } from "../../../scripts/validate-codex-journey-evidence.mjs";
import * as smokeRuntime from "../../../scripts/write-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const currentVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();
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
const finalLocalPayloadFixturePath = join(
  repositoryRoot,
  "tests",
  "contract",
  "testdata",
  "final-local-payloads.json",
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

function fixtureFinalJourneyEvidence(packageVersion = "0.1.0") {
  return {
    evidence_kind: FINAL_FIXTURE_EVIDENCE_KIND,
    status: "passed",
    package_name: "dev-flow-codex",
    package_version: packageVersion,
    registry: "https://registry.npmjs.org/",
    npm_tarball_sha256: "a".repeat(64),
    npm_integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}`,
    package_root_location: "isolated-npm-prefix",
    core_version: packageVersion,
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

function fixtureFinalLocalJourneyEvidence() {
  return {
    evidence_kind: FINAL_LOCAL_NATIVE_EVIDENCE_KIND,
    status: "passed",
    artifact_filename: "dev-flow-codex-0.3.0.tgz",
    artifact_sha256: "a".repeat(64),
    artifact_size: 4381869,
    artifact_source_commit: "b".repeat(40),
    package_name: "dev-flow-codex",
    package_version: "0.3.0",
    core_version: "0.3.0",
    core_sha256: "c".repeat(64),
    platform: "darwin-arm64",
    codex_version: "0.147.0",
    compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
    codex_compatible: true,
    explicit_selector: EXPLICIT_SELECTOR,
    handshake_passed: true,
    setup_readback_passed: true,
    ordinary_prompt_core_call_count: 0,
    task_id_before_restart: "task-local-0001",
    task_revision_before_restart: 6,
    task_action_id_before_restart: "action-local-0006",
    task_id_after_restart: "task-local-0001",
    task_revision_after_restart: 6,
    task_action_id_after_restart: "action-local-0006",
    multiple_destinations_observed: true,
    complexity_transition_observed: true,
    refactor_retest_observed: true,
    explicit_user_confirmation_observed: true,
    committed_action_count: 10,
    targeted_command_count: 2,
    terminal_outcome: "DONE",
    remove_readback_passed: true,
    npm_uninstall_passed: true,
    task_data_retained: true,
    task_reopened_after_uninstall: true,
    unexpected_repository_paths: [],
    native_journey_attempt_count: 3,
    total_native_attempts: 3,
    successful_attempt: 3,
    attempt_1_status: "failed",
    attempt_1_stage: "initial-comprehension-first-requirements-apply",
    attempt_1_failure: "invalid-contract-0.2-payload",
    attempt_1_evidence_preserved: true,
    attempt_2_status: "failed",
    attempt_2_stage: "design-apply",
    attempt_2_failure: "invalid-contract-0.2-design-baseline",
    attempt_2_authorization: "explicit_user_authorization",
    attempt_2_evidence_preserved: true,
    attempt_3_status: "passed",
    attempt_3_authorization: "explicit_user_authorization",
    attempt_3_final_allowed_attempt: true,
    previous_attempt_preserved: true,
    observed_at: "2026-08-20T08:00:00.000Z",
  };
}

function fixtureAttempt3NativeFlowEvidence() {
  return {
    evidence_kind: "attempt-3-native-codex-graph-flow",
    native_flow_status: "passed",
    runner_status: "failed_after_native_flow",
    lifecycle_status: "not_run",
    source_attempt: 3,
    artifact_filename: "dev-flow-codex-0.3.0.tgz",
    artifact_sha256: "aa8fb5269f03d9cebbceb604d15e66d8b26690b8b5ab19c46bd7b09c1294f92b",
    artifact_size: 4381869,
    artifact_source_commit: "a032f7080fc40f303a32162960dc44345ad8dd2d",
    package_name: "dev-flow-codex",
    package_version: "0.3.0",
    core_version: "0.3.0",
    core_sha256: "c3cccb91f25394b16765f025b4e901d41cbb9792fd9428eabdae1b764e197faf",
    platform: "darwin-arm64",
    source_transcripts: [
      { filename: "session-0-ordinary.jsonl", size: 3043, sha256: "f8c5461e256c3248b662bb2ab094c2aec982e622ed51687ba3f55b5de8988ad9" },
      { filename: "session-1-initial-comprehension.jsonl", size: 122954, sha256: "55bd97084e453a869213f5752b4fa2124fdc06322e032e4f7c8a5622f8e553b3" },
      { filename: "session-2-complexity-refactor-retest.jsonl", size: 133284, sha256: "600e15e0a49b21c3039fd8d7d453f7a1886d498011ec5cbc9814d2ed93e9e78d" },
      { filename: "session-3-confirmation-delivery.jsonl", size: 122458, sha256: "b63ec4a42bd634694486bc2588113b077460fa9d1e2d2576ce742bf35b6adbb8" },
    ],
    source_artifact_marker: { filename: "native-attempt-3.json", size: 465, sha256: "0f35251490e2e51b4b23e2b425f22fe8f2e1ebd89fd31a0c566a932afeab5b41" },
    original_failed_marker: { filename: "native-attempt-3-failed.json", size: 1293, sha256: "26defc139e75f75549d491a5c3254f58b9722852e4ed23b1d1be9b0704fb4044" },
    ordinary_zero_calls: true,
    distinct_real_codex_threads: 4,
    handshake_passed: true,
    process_identity: "standard-development",
    definition_digest: "c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57",
    method_profiles: ["plain", "spec-kit", "openspec"],
    tool_order: [
      "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task",
      "dev_flow_get_next_action", "dev_flow_apply_action", "dev_flow_cancel_task",
    ],
    transition_sequence: [
      "requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test",
      "tests_passed", "code_too_complex", "refactor_ready_for_test", "tests_passed",
      "comprehension_passed", "delivery_complete",
    ],
    successful_mutation_count: 10,
    request_binding_passed: true,
    revision_start: 1,
    revision_end: 11,
    revision_increment_exact: true,
    last_operation_binding_passed: true,
    duplicate_mutation_identities: 0,
    duplicate_evidence_ids: 0,
    restart_identity_passed: true,
    complexity_refactor_retest: true,
    explicit_user_confirmation: true,
    targeted_command_count: 2,
    targeted_command_identity: "node --test test/proof-writer.test.mjs",
    targeted_exit_codes: [0, 0],
    forbidden_suite_count: 0,
    terminal_cursor: "DONE",
    terminal_outcome_status: "completed",
    current_action_null: true,
    unexpected_repository_paths: [],
    attempt_history: {
      attempt_1: { status: "failed", stage: "first_requirements_apply", cause: "invalid_closed_requirements_payload" },
      attempt_2: { status: "failed", stage: "design_apply", cause: "invalid_closed_design_baseline" },
      attempt_3: {
        status: "runner_failed_after_native_sessions",
        native_sessions_status: "passed",
        core_terminal_status: "DONE",
        lifecycle_status: "not_run",
        cause: "verification_command_classifier_false_positive",
      },
      attempt_4: { status: "forbidden" },
    },
    observed_at: "2026-08-20T08:00:00.000Z",
  };
}

function fixtureExactArtifactLifecycleEvidence() {
  return {
    evidence_kind: "exact-artifact-packaged-core-lifecycle",
    status: "passed",
    evidence_class: "deterministic exact-artifact lifecycle evidence",
    artifact_filename: "dev-flow-codex-0.3.0.tgz",
    artifact_sha256: "aa8fb5269f03d9cebbceb604d15e66d8b26690b8b5ab19c46bd7b09c1294f92b",
    artifact_size: 4381869,
    artifact_source_commit: "a032f7080fc40f303a32162960dc44345ad8dd2d",
    same_artifact_identity: true,
    package_name: "dev-flow-codex",
    package_version: "0.3.0",
    core_version: "0.3.0",
    core_sha256: "c3cccb91f25394b16765f025b4e901d41cbb9792fd9428eabdae1b764e197faf",
    platform: "darwin-arm64",
    codex_invocation_count: 0,
    codex_auth_read_count: 0,
    codex_thread_count: 0,
    closed_package_contents_passed: true,
    handshake_passed: true,
    live_apply_schema_passed: true,
    packaged_payload_reference_passed: true,
    setup_passed: true,
    task_id: "task-lifecycle-fixture",
    final_revision: 8,
    event_count: 8,
    evidence_count: 8,
    current_cursor: "DONE",
    outcome_status: "completed",
    current_action_null: true,
    claim_absent: true,
    targeted_command_count: 1,
    targeted_command_identity: "node --test test/proof-writer.test.mjs",
    targeted_exit_codes: [0],
    comprehension_evidence_class: "deterministic_test_fixture",
    remove_passed: true,
    repeated_remove_noop: true,
    npm_uninstall_passed: true,
    data_retained: true,
    adjacent_sentinel_retained: true,
    repository_unchanged: true,
    exact_artifact_reinstall_passed: true,
    same_task_reopened: true,
    read_zero_write: true,
    database_manifest: [{ path: "dev-flow.db", size: 4096, sha256: "d".repeat(64) }],
    final_package_uninstalled: true,
    observed_at: "2026-08-20T08:10:00.000Z",
  };
}

function coreSuccessEvent(tool, suffix, result, arguments_ = {}) {
  const requestID = `request-${suffix}`;
  const envelope = { ok: true, request_id: requestID, tool, result };
  return {
    type: "item.completed",
    item: {
      id: `item-${suffix}`,
      type: "mcp_tool_call",
      server: "dev-flow",
      tool,
      arguments: { ...arguments_, request_id: requestID },
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

function graphSuccessCall(tool, suffix, result) {
  const requestID = `request-${suffix}`;
  return {
    session_role: null,
    item_id: `item-${suffix}`,
    server: "dev-flow",
    tool,
    request_id: requestID,
    arguments: { request_id: requestID },
    status: "completed",
    classification: "success",
    core_result: { ok: true, request_id: requestID, tool, result },
    host_error: null,
    error: null,
    recovery: null,
  };
}

function graphSession(role, calls, commands = []) {
  const devFlowCalls = calls.map((call) => ({ ...call, session_role: role }));
  return {
    role,
    thread_id: `thread-graph-${role}`,
    thread_started: true,
    dev_flow_call_count: devFlowCalls.length,
    tools: devFlowCalls.map((call) => call.tool),
    terminal_shapes: devFlowCalls.map(() => "success"),
    core_done: devFlowCalls.some((call) => call.core_result?.result?.task?.current_cursor === "DONE"),
    commands,
    mcp_calls: devFlowCalls.map((call) => ({
      item_id: call.item_id,
      server: "dev-flow",
      tool: call.tool,
      status: call.status,
      classification: call.classification,
    })),
    dev_flow_calls: devFlowCalls,
  };
}

const MULTI_REPOSITORY_SOURCE_COMMIT = "a".repeat(40);

function isolatedMultiRepositoryTestEnvironment(layout, _codexExecutable, baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    HOME: layout.home,
    CODEX_HOME: layout.codexHome,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: `${join(layout.installPrefix, "node_modules", ".bin")}:${baseEnvironment.PATH ?? "/usr/bin:/bin"}`,
  };
}

function multiRepositorySourceBoundDependencies(callOrder = [], overrides = {}) {
  return {
    buildPackage: async ({ layout, sourceCommit }) => {
      callOrder.push("build");
      if (overrides.buildError) throw overrides.buildError;
      return {
        artifact_path: join(layout.artifactDirectory, "dev-flow-codex-fixture.tgz"),
        package_version: "0.1.0",
        core_version: "0.1.0",
        source_commit: overrides.buildSourceCommit ?? sourceCommit,
        source_dirty: overrides.buildSourceDirty ?? false,
        final_artifact: false,
        platform: "darwin-arm64",
      };
    },
    installPackage: async ({ layout, build }) => {
      callOrder.push("install");
      if (overrides.installError) throw overrides.installError;
      const packageRoot = join(layout.installPrefix, "node_modules", "dev-flow-codex");
      return {
        packageRoot,
        packageCLI: join(layout.installPrefix, "node_modules", ".bin", "dev-flow-codex"),
        runtimePath: join(packageRoot, "runtime", "darwin-arm64", "dev-flow"),
        sourceCommit: build.source_commit,
      };
    },
    setupPackage: async () => {
      callOrder.push("setup");
      if (overrides.setupError) throw overrides.setupError;
      return { operation: "setup", status: "installed", changed: true };
    },
    verifySetup: async ({ build, product }) => {
      callOrder.push("verify");
      if (overrides.verifyError) throw overrides.verifyError;
      return { setupReadbackPassed: true, sourceCommit: product.sourceCommit ?? build.source_commit };
    },
  };
}

function multiRepositoryTask({ revision = 2, actionID = "action-multi-0002", digest = "b".repeat(64) } = {}) {
  return {
    task_id: "task-multi-0001",
    revision,
    current_cursor: "IMPLEMENT",
    primary_repository_key: "core",
    repository: { repository_identity: "repository-core" },
    additional_repositories: [
      { key: "docs", repository: { repository_identity: "repository-docs" } },
    ],
    current_action: actionID === null ? null : {
      action_id: actionID,
      repository_binding_digest: digest,
    },
    outcome: null,
  };
}

function multiRepositoryServerInfoEvent(itemID) {
  return coreSuccessEvent("dev_flow_server_info", itemID, {
    product: "dev-flow",
    version: "0.1.0",
    transport: "stdio",
    health: "ready",
    supported_hosts: ["codex", "deepseek"],
    supported_processes: [],
    method_profiles: ["plain", "spec-kit", "openspec"],
    tools: DEV_FLOW_TOOLS,
    host_preferences: {
      codex: { codebase_memory: false },
      deepseek: { codebase_memory: false },
    },
  });
}

function multiRepositorySubstantiveJSONL(layout) {
  const createdTask = multiRepositoryTask({
    revision: 1,
    actionID: "action-multi-0001",
    digest: "c".repeat(64),
  });
  const appliedTask = multiRepositoryTask();
  const events = [
    { type: "thread.started", thread_id: "thread-multi-repository-substantive" },
    multiRepositoryServerInfoEvent("multi-info-substantive"),
    coreSuccessEvent("dev_flow_open_task", "multi-create", { task: createdTask }, {
      host: "codex",
      repository_path: layout.primaryRepository,
      primary_repository_key: "core",
      additional_repositories: [
        { key: "docs", repository_path: layout.additionalRepository },
      ],
      new_task: { request: "bounded two-repository proof" },
    }),
    coreSuccessEvent("dev_flow_apply_action", "multi-apply", { task: appliedTask }, {
      host: "codex",
      task_id: appliedTask.task_id,
    }),
  ];
  return `${events.map(JSON.stringify).join("\n")}\n`;
}

function multiRepositoryResumeJSONL(layout, resumeOverrides = {}, threadID = "thread-multi-repository-resume") {
  const resumedTask = multiRepositoryTask(resumeOverrides);
  const events = [
    { type: "thread.started", thread_id: threadID },
    multiRepositoryServerInfoEvent("multi-info-resume"),
    coreSuccessEvent("dev_flow_open_task", "multi-resume", { task: resumedTask }, {
      host: "codex",
      repository_path: layout.additionalRepository,
      new_task: null,
    }),
  ];
  return `${events.map(JSON.stringify).join("\n")}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

test("frozen numbered fixtures are rejected by the current-only parser", async () => {
  for (const [name] of fixtures.slice(0, 2)) {
    await assert.rejects(execFile(runner, ["--fixture", name], { cwd: repositoryRoot, encoding: "utf8" }), /unexpected field schema_version/u);
  }
});

test("frozen fixture rejection creates no persistent attempt or evidence state", async () => {
  const isolatedCwd = await mkdtemp(join(tmpdir(), "dev-flow-codex-repeatable-smoke-"));
  const before = await readdir(isolatedCwd);
  await assert.rejects(execFile(runner, ["--fixture", "success"], { cwd: isolatedCwd, encoding: "utf8" }), /unexpected field schema_version/u);
  assert.deepEqual(await readdir(isolatedCwd), before);
});

test("real smoke wiring uses exact selector and ephemeral in-memory sessions", async () => {
  const successJSONL = currentSuccessJSONL();
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

test("Feature-only multi-repository CLI and layout are closed over source identity", async () => {
  assert.deepEqual(parseCLI([
    "multi-repository",
    "--codex-executable", "/opt/codex/bin/codex",
    "--result-file", "/tmp/feature-001-evidence.json",
    "--source-commit", MULTI_REPOSITORY_SOURCE_COMMIT,
  ]), {
    mode: "multi-repository",
    codexExecutable: "/opt/codex/bin/codex",
    resultFile: "/tmp/feature-001-evidence.json",
    sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
  });
  assert.throws(() => parseCLI([
    "multi-repository", "--codex-executable", "/opt/codex/bin/codex",
    "--result-file", "/tmp/feature-001-evidence.json",
  ]), /requires --codex-executable ABS --result-file ABS\.json --source-commit COMMIT/u);
  assert.throws(() => parseCLI([
    "multi-repository",
    "--codex-executable", "/opt/codex/bin/codex",
    "--result-file", "/tmp/feature-001-evidence.json",
    "--source-commit", "A".repeat(40),
  ]), /40-character lowercase Git SHA/u);

  const layout = smokeRuntime.createMultiRepositoryJourneyLayout("/tmp/feature-001-run");
  assert.deepEqual(layout, {
    root: "/tmp/feature-001-run",
    home: "/tmp/feature-001-run/home",
    codexHome: "/tmp/feature-001-run/codex-home",
    temporaryDirectory: "/tmp/feature-001-run/tmp",
    primaryRepository: "/tmp/feature-001-run/core",
    additionalRepository: "/tmp/feature-001-run/docs",
    dataDirectory: "/tmp/feature-001-run/data",
    installPrefix: "/tmp/feature-001-run/npm-prefix",
    npmCache: "/tmp/feature-001-run/npm-cache",
    artifactDirectory: "/tmp/feature-001-run/artifact",
  });
  const substantivePrompt = smokeRuntime.multiRepositorySubstantivePrompt(
    layout.primaryRepository,
    layout.additionalRepository,
  );
  assert.equal(substantivePrompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.match(substantivePrompt, /Create one host=codex Task/u);
  assert.match(substantivePrompt, /primary_repository_key=core/u);
  assert.match(substantivePrompt, /additional_repositories/u);
  assert.match(substantivePrompt, /core::core-proof\.txt[\s\S]*docs::docs-proof\.txt/u);
  assert.match(substantivePrompt, /Never send request_id[\s\S]*Core fills and retains/u);
  assert.match(substantivePrompt, /artifacts\.current[\s\S]*method_results/u);
  assert.match(substantivePrompt, /problem_class=none and findings=\[\]/u);
  assert.match(substantivePrompt, /Node results are REQUIREMENTS=/u);
  assert.doesNotMatch(substantivePrompt, /new_task=null/u);
  assert.match(substantivePrompt, /stop after the first successful IMPLEMENT submission records both changes/u);

  const resumePrompt = smokeRuntime.multiRepositoryResumePrompt(layout.additionalRepository);
  assert.equal(resumePrompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.match(resumePrompt, /existing host=codex Task/u);
  assert.match(resumePrompt, /repository_path=.*docs[\s\S]*new_task=null[\s\S]*no Scope creation fields/u);
  assert.match(resumePrompt, /Do not modify files, call an Action submission tool/u);

  const runnerSource = await readFile(runner, "utf8");
  assert.match(runnerSource, /--multi-repository --codex-executable ABS --result-file ABS\.json --source-commit COMMIT/u);
  assert.match(runnerSource, /write-codex-journey-evidence\.mjs" multi-repository/u);
});

test("Feature-only multi-repository runner binds build, install, setup, readback, and Codex in order", async (t) => {
  const resultRoot = await mkdtemp(join(tmpdir(), "feature-001-runner-result-"));
  t.after(() => rm(resultRoot, { recursive: true, force: true }));
  const resultFile = join(resultRoot, "evidence.json");
  const userCodexHome = join(resultRoot, "user-codex-home");
  await mkdir(userCodexHome);
  await writeFile(join(userCodexHome, "auth.json"), "fixture-auth-secret\n");
  await chmod(join(userCodexHome, "auth.json"), 0o600);
  const userCodexEntriesBefore = await readdir(userCodexHome);
  const invocations = [];
  const callOrder = [];
  let copiedAuthentication = null;
  const runProcess = async (executable, args, options) => {
    callOrder.push("run");
    invocations.push({ executable, args, options });
    copiedAuthentication = await readFile(join(options.env.CODEX_HOME, "auth.json"), "utf8");
    const additionalFlag = args.indexOf("--add-dir");
    const otherRepository = args[additionalFlag + 1];
    const layout = invocations.length === 1
      ? { primaryRepository: options.cwd, additionalRepository: otherRepository }
      : { primaryRepository: otherRepository, additionalRepository: options.cwd };
    if (invocations.length === 1) {
      await writeFile(join(layout.primaryRepository, "core-proof.txt"), "core proof\n");
      await writeFile(join(layout.additionalRepository, "docs-proof.txt"), "docs proof\n");
    }
    return {
      exitCode: 0,
      stdout: invocations.length === 1
        ? multiRepositorySubstantiveJSONL(layout)
        : multiRepositoryResumeJSONL(layout),
      stderr: "",
    };
  };

  const evidence = await smokeRuntime.runMultiRepositoryJourney({
    codexExecutable: "/fixture/codex",
    resultFile,
    sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
    runProcess,
    ...multiRepositorySourceBoundDependencies(callOrder),
    baseEnvironment: {
      ...process.env,
      HOME: "/fixture/real-home",
      CODEX_HOME: userCodexHome,
    },
  });

  assert.deepEqual(callOrder, ["build", "install", "setup", "verify", "run", "run"]);
  assert.equal(invocations.length, 2);
  const [substantive, resume] = invocations;
  assert.equal(substantive.executable, "/fixture/codex");
  assert.equal(resume.executable, "/fixture/codex");
  assert.notEqual(substantive.options.env.HOME, "/fixture/real-home");
  assert.equal(dirname(substantive.options.env.HOME), dirname(substantive.options.env.TMPDIR));
  assert.equal(dirname(substantive.options.env.HOME), dirname(substantive.options.env.DEV_FLOW_DATA_DIR));
  assert.equal(substantive.options.env.HOME, join(dirname(substantive.options.env.HOME), "home"));
  assert.equal(substantive.options.env.TMPDIR, join(dirname(substantive.options.env.HOME), "tmp"));
  assert.equal(substantive.options.env.DEV_FLOW_DATA_DIR, join(dirname(substantive.options.env.HOME), "data"));
  assert.equal(substantive.options.env.CODEX_HOME, join(dirname(substantive.options.env.HOME), "codex-home"));
  assert.equal(substantive.options.env.npm_config_prefix, join(dirname(substantive.options.env.HOME), "npm-prefix"));
  assert.equal(substantive.options.env.npm_config_cache, join(dirname(substantive.options.env.HOME), "npm-cache"));
  assert.equal(copiedAuthentication, "fixture-auth-secret\n");
  assert.deepEqual(await readdir(userCodexHome), userCodexEntriesBefore);
  assert.equal(await readFile(join(userCodexHome, "auth.json"), "utf8"), "fixture-auth-secret\n");
  for (const invocation of invocations) {
    const { args, options } = invocation;
    assert.equal(options.env.GIT_CONFIG_GLOBAL, "/dev/null");
    assert.equal(options.env.GIT_CONFIG_NOSYSTEM, "1");
    assert.equal(options.env.NO_COLOR, "1");
    assert.equal(args.includes("--ephemeral"), true);
    assert.deepEqual(args.slice(args.indexOf("--sandbox"), args.indexOf("--sandbox") + 2), [
      "--sandbox", "workspace-write",
    ]);
    assert.deepEqual(args.slice(args.indexOf("--cd"), args.indexOf("--cd") + 2), ["--cd", options.cwd]);
    assert.equal(args.includes("--add-dir"), true);
    assert.equal(args.includes("--ignore-rules"), false);
    assert.equal(args.includes("--skip-git-repo-check"), false);
    assert.equal(args.includes("danger-full-access"), false);
    assert.equal(args.at(-1).startsWith(`${EXPLICIT_SELECTOR} `), true);
    assert.equal(args.filter((value) => value === args.at(-1)).length, 1);
  }
  assert.equal(substantive.options.cwd.endsWith("/core"), true);
  assert.equal(resume.options.cwd.endsWith("/docs"), true);
  assert.deepEqual(substantive.args.slice(substantive.args.indexOf("--add-dir") + 1, substantive.args.indexOf("--add-dir") + 2), [resume.options.cwd]);
  assert.deepEqual(resume.args.slice(resume.args.indexOf("--add-dir") + 1, resume.args.indexOf("--add-dir") + 2), [substantive.options.cwd]);
  assert.equal(evidence.codex_session_count, 2);
  assert.equal(evidence.setup_readback_passed, true);
  assert.equal(JSON.stringify(evidence).includes(userCodexHome), false);
  assert.equal(JSON.stringify(evidence).includes("fixture-auth-secret"), false);
  assert.deepEqual(JSON.parse(await readFile(resultFile, "utf8")), evidence);
  assert.equal(
    await readFile(`${resultFile}.substantive.raw.jsonl`, "utf8"),
    multiRepositorySubstantiveJSONL({
      primaryRepository: substantive.options.cwd,
      additionalRepository: resume.options.cwd,
    }),
  );
  assert.equal(
    await readFile(`${resultFile}.resume.raw.jsonl`, "utf8"),
    multiRepositoryResumeJSONL({
      primaryRepository: substantive.options.cwd,
      additionalRepository: resume.options.cwd,
    }),
  );
});

test("multi-repository setup readback binds the isolated registration, CLI, and bundled Core", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "feature-001-setup-readback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const layout = smokeRuntime.createMultiRepositoryJourneyLayout(root);
  await Promise.all(Object.entries(layout)
    .filter(([name]) => name !== "root")
    .map(([, path]) => mkdir(path, { recursive: true })));
  const packageRoot = join(layout.installPrefix, "node_modules", "dev-flow-codex");
  const packageBin = join(packageRoot, "bin");
  const localBin = join(layout.installPrefix, "node_modules", ".bin");
  const pluginRoot = join(packageRoot, "plugin");
  const runtimeRoot = join(packageRoot, "runtime", "darwin-arm64");
  await Promise.all([
    mkdir(packageBin, { recursive: true }),
    mkdir(localBin, { recursive: true }),
    mkdir(pluginRoot, { recursive: true }),
    mkdir(runtimeRoot, { recursive: true }),
    mkdir(layout.codexHome, { recursive: true }),
  ]);
  const packageScript = join(packageBin, "dev-flow-codex.mjs");
  const runtimePath = join(runtimeRoot, "dev-flow");
  await writeFile(packageScript, "#!/bin/sh\nprintf 'dev-flow-codex 0.1.0 (core 0.1.0)\\n'\n");
  await writeFile(runtimePath, "#!/bin/sh\nprintf 'dev-flow 0.1.0\\n'\n");
  await Promise.all([chmod(packageScript, 0o755), chmod(runtimePath, 0o755)]);
  await symlink(packageScript, join(localBin, "dev-flow-codex"));
  await writeFile(join(pluginRoot, ".mcp.json"), JSON.stringify({
    mcpServers: { "dev-flow": { type: "stdio", command: "dev-flow-codex", args: ["mcp"] } },
  }));
  await writeFile(join(layout.codexHome, "config.toml"), "[plugins]\n");

  const receiptPath = join(
    layout.home,
    "Library", "Application Support", "dev-flow", "registrations", "codex.json",
  );
  await mkdir(dirname(receiptPath), { recursive: true });
  const receipt = {
    registration: { marketplace_root: packageRoot, plugin_root: pluginRoot },
    paths: {
      receipt_path: receiptPath,
      package_root: packageRoot,
      runtime_path: runtimePath,
      data_dir: layout.dataDirectory,
    },
  };
  await writeFile(receiptPath, JSON.stringify(receipt));
  const build = {
    source_commit: MULTI_REPOSITORY_SOURCE_COMMIT,
    package_version: "0.1.0",
    core_version: "0.1.0",
  };
  const product = {
    packageRoot,
    packageCLI: join(localBin, "dev-flow-codex"),
    runtimePath,
    sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
  };
  const environment = isolatedMultiRepositoryTestEnvironment(layout);
  const setup = { operation: "setup", status: "installed", receipt_path: receiptPath };

  assert.deepEqual(await smokeRuntime.verifyMultiRepositorySetupReadback({
    layout, build, product, setup, environment,
  }), { setupReadbackPassed: true, sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT });

  await writeFile(receiptPath, JSON.stringify({
    ...receipt,
    paths: { ...receipt.paths, package_root: "/fixture/user-installed/dev-flow-codex" },
  }));
  await assert.rejects(smokeRuntime.verifyMultiRepositorySetupReadback({
    layout, build, product, setup, environment,
  }), /does not bind the isolated source package/u);
});

test("multi-repository success evidence binds post-mutation identity across fresh Codex sessions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "feature-001-evidence-fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const layout = smokeRuntime.createMultiRepositoryJourneyLayout(root);
  await Promise.all([
    mkdir(layout.primaryRepository),
    mkdir(layout.additionalRepository),
  ]);
  await Promise.all([
    writeFile(join(layout.primaryRepository, "core-proof.txt"), "core proof\n"),
    writeFile(join(layout.additionalRepository, "docs-proof.txt"), "docs proof\n"),
  ]);
  const sessions = [
    smokeRuntime.summarizeCodexSession(
      "multi-repository-substantive",
      parseCodexJSONL(multiRepositorySubstantiveJSONL(layout)),
    ),
    smokeRuntime.summarizeCodexSession(
      "multi-repository-resume",
      parseCodexJSONL(multiRepositoryResumeJSONL(layout)),
    ),
  ];
  const evidence = await smokeRuntime.buildMultiRepositoryEvidence(
    sessions,
    layout,
    MULTI_REPOSITORY_SOURCE_COMMIT,
    true,
  );

  assert.deepEqual(Object.keys(evidence), [
    "evidence_kind", "status", "source_commit", "host", "runner_mode", "journey_budget",
    "setup_readback_passed", "codex_session_count",
    "task_id", "primary_repository_key", "additional_repository_keys", "repository_count",
    "revision_before_resume", "revision_after_resume", "action_id_before_resume",
    "action_id_after_resume", "repository_binding_digest_before_resume",
    "repository_binding_digest_after_resume", "resumed_from_additional_repository", "one_core_task",
    "scoped_paths", "successful_action_count", "tool_catalog_size", "codebase_memory_preference",
    "observed_at",
  ]);
  assert.equal(evidence.source_commit, MULTI_REPOSITORY_SOURCE_COMMIT);
  assert.equal(evidence.host, "codex");
  assert.equal(evidence.runner_mode, "multi-repository");
  assert.equal(evidence.journey_budget, "1/1");
  assert.equal(evidence.codex_session_count, 2);
  assert.equal(evidence.revision_before_resume, evidence.revision_after_resume);
  assert.equal(evidence.action_id_before_resume, evidence.action_id_after_resume);
  assert.equal(
    evidence.repository_binding_digest_before_resume,
    evidence.repository_binding_digest_after_resume,
  );
  assert.equal(evidence.codebase_memory_preference, false);
  assert.doesNotMatch(JSON.stringify(evidence), /feature-001-evidence-fixture|\/Users\/|\/home\//u);

  for (const [name, overrides, pattern] of [
    ["revision", { revision: 3 }, /resume revision differs/u],
    ["Action", { actionID: "action-multi-other" }, /resume Action identity differs/u],
    ["digest", { digest: "d".repeat(64) }, /resume Action digest differs/u],
  ]) {
    const mismatched = [
      sessions[0],
      smokeRuntime.summarizeCodexSession(
        "multi-repository-resume",
        parseCodexJSONL(multiRepositoryResumeJSONL(layout, overrides)),
      ),
    ];
    await assert.rejects(
      smokeRuntime.buildMultiRepositoryEvidence(mismatched, layout, MULTI_REPOSITORY_SOURCE_COMMIT, true),
      pattern,
      name,
    );
  }
});

test("multi-repository evidence rejects reuse of the substantive Codex thread", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "feature-001-same-thread-fixture-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const layout = smokeRuntime.createMultiRepositoryJourneyLayout(root);
  await Promise.all([
    mkdir(layout.primaryRepository),
    mkdir(layout.additionalRepository),
  ]);
  await Promise.all([
    writeFile(join(layout.primaryRepository, "core-proof.txt"), "core proof\n"),
    writeFile(join(layout.additionalRepository, "docs-proof.txt"), "docs proof\n"),
  ]);
  const substantive = smokeRuntime.summarizeCodexSession(
    "multi-repository-substantive",
    parseCodexJSONL(multiRepositorySubstantiveJSONL(layout)),
  );
  const resume = smokeRuntime.summarizeCodexSession(
    "multi-repository-resume",
    parseCodexJSONL(multiRepositoryResumeJSONL(
      layout,
      {},
      substantive.thread_id,
    )),
  );
  await assert.rejects(
    smokeRuntime.buildMultiRepositoryEvidence([substantive, resume], layout, MULTI_REPOSITORY_SOURCE_COMMIT, true),
    /requires two distinct Codex sessions/u,
  );
});

test("multi-repository post-launch failure writes one sanitized consumed-budget evidence", async (t) => {
  const resultRoot = await mkdtemp(join(tmpdir(), "feature-001-failure-result-"));
  t.after(() => rm(resultRoot, { recursive: true, force: true }));
  const resultFile = join(resultRoot, "failure.json");
  let invocationCount = 0;
  const callOrder = [];
  await assert.rejects(smokeRuntime.runMultiRepositoryJourney({
    codexExecutable: "/fixture/codex",
    resultFile,
    sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
    runProcess: async (_executable, args, options) => {
      invocationCount += 1;
      if (invocationCount === 1) {
        const additionalFlag = args.indexOf("--add-dir");
        return {
          exitCode: 0,
          stdout: multiRepositorySubstantiveJSONL({
            primaryRepository: options.cwd,
            additionalRepository: args[additionalFlag + 1],
          }),
          stderr: "",
        };
      }
      return {
        exitCode: 9,
        stdout: "private stdout /Users/example/.codex/auth.json token",
        stderr: "HOME=/Users/example secret",
      };
    },
    prepareEnvironment: isolatedMultiRepositoryTestEnvironment,
    ...multiRepositorySourceBoundDependencies(callOrder),
    baseEnvironment: { ...process.env, HOME: "/fixture/real-home", CODEX_HOME: "/fixture/codex-home" },
  }), /session exited with 9/u);

  assert.equal(invocationCount, 2);
  const evidence = JSON.parse(await readFile(resultFile, "utf8"));
  assert.deepEqual(Object.keys(evidence), [
    "evidence_kind", "status", "source_commit", "host", "runner_mode", "journey_budget",
    "failure_stage", "failure_classification", "session_role", "exit_code", "stdout_sha256",
    "stderr_sha256", "setup_readback_passed", "thread_started", "dev_flow_call_count",
    "first_dev_flow_tool", "first_dev_flow_classification", "first_dev_flow_error_code",
    "dev_flow_tool_sequence", "failed_dev_flow_tool", "failed_dev_flow_error_code",
    "failed_request_binding", "observed_at",
  ]);
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.journey_budget, "1/1");
  assert.equal(evidence.session_role, "multi-repository-resume");
  assert.equal(evidence.exit_code, 9);
  assert.equal(evidence.stdout_sha256, sha256("private stdout /Users/example/.codex/auth.json token"));
  assert.equal(evidence.stderr_sha256, sha256("HOME=/Users/example secret"));
  assert.equal(evidence.setup_readback_passed, true);
  assert.equal(evidence.thread_started, false);
  assert.equal(evidence.dev_flow_call_count, 0);
  assert.equal(evidence.first_dev_flow_tool, null);
  assert.deepEqual(evidence.dev_flow_tool_sequence, []);
  assert.equal(evidence.failed_dev_flow_tool, null);
  assert.equal(evidence.failed_dev_flow_error_code, null);
  assert.equal(evidence.failed_request_binding, null);
  assert.doesNotMatch(JSON.stringify(evidence), /private stdout|HOME=|\/Users\/|auth\.json|secret/u);
});

test("multi-repository failure evidence distinguishes zero calls, wrong order, and server-info failure", async (t) => {
  const resultRoot = await mkdtemp(join(tmpdir(), "feature-001-diagnostic-result-"));
  t.after(() => rm(resultRoot, { recursive: true, force: true }));
  const thread = { type: "thread.started", thread_id: "thread-diagnostic" };
  const serverErrorRequest = "request-server-error";
  const serverErrorEnvelope = {
    ok: false,
    request_id: serverErrorRequest,
    tool: "dev_flow_server_info",
    error: { code: "INTERNAL_ERROR", message: "The server-info call failed." },
    recovery: { retry_safe: false, action: "report_internal_error", message: "Report the internal error." },
  };
  const serverError = {
    type: "item.completed",
    item: {
      id: "item-server-error",
      type: "mcp_tool_call",
      server: "dev-flow",
      tool: "dev_flow_server_info",
      arguments: { request_id: serverErrorRequest, private_argument: "/Users/private/secret" },
      result: {
        content: [{ type: "text", text: JSON.stringify(serverErrorEnvelope) }],
        structured_content: serverErrorEnvelope,
      },
      error: null,
      status: "failed",
    },
  };
  const cases = [
    {
      name: "zero",
      stdout: `${JSON.stringify(thread)}\n`,
      expected: { count: 0, tool: null, classification: null, code: null, sequence: [] },
    },
    {
      name: "wrong-order",
      stdout: `${[thread, coreSuccessEvent("dev_flow_open_task", "wrong-order", { task: {} }, {
        private_argument: "/Users/private/secret",
      })].map(JSON.stringify).join("\n")}\n`,
      expected: {
        count: 1, tool: "dev_flow_open_task", classification: "success", code: null,
        sequence: ["dev_flow_open_task"],
      },
    },
    {
      name: "server-info-error",
      stdout: `${[thread, serverError].map(JSON.stringify).join("\n")}\n`,
      expected: {
        count: 1, tool: "dev_flow_server_info", classification: "core-domain-error",
        code: "INTERNAL_ERROR", sequence: ["dev_flow_server_info"],
      },
    },
  ];

  for (const diagnostic of cases) {
    const resultFile = join(resultRoot, `${diagnostic.name}.json`);
    await assert.rejects(smokeRuntime.runMultiRepositoryJourney({
      codexExecutable: "/fixture/codex",
      resultFile,
      sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
      runProcess: async () => ({ exitCode: 0, stdout: diagnostic.stdout, stderr: "private stderr secret" }),
      prepareEnvironment: isolatedMultiRepositoryTestEnvironment,
      ...multiRepositorySourceBoundDependencies(),
    }));
    const evidence = JSON.parse(await readFile(resultFile, "utf8"));
    assert.equal(evidence.setup_readback_passed, true, diagnostic.name);
    assert.equal(evidence.thread_started, true, diagnostic.name);
    assert.equal(evidence.dev_flow_call_count, diagnostic.expected.count, diagnostic.name);
    assert.equal(evidence.first_dev_flow_tool, diagnostic.expected.tool, diagnostic.name);
    assert.equal(evidence.first_dev_flow_classification, diagnostic.expected.classification, diagnostic.name);
    assert.equal(evidence.first_dev_flow_error_code, diagnostic.expected.code, diagnostic.name);
    assert.deepEqual(evidence.dev_flow_tool_sequence, diagnostic.expected.sequence, diagnostic.name);
    assert.equal(
      evidence.failed_dev_flow_tool,
      diagnostic.name === "server-info-error" ? "dev_flow_server_info" : null,
      diagnostic.name,
    );
    assert.equal(
      evidence.failed_dev_flow_error_code,
      diagnostic.name === "server-info-error" ? "INTERNAL_ERROR" : null,
      diagnostic.name,
    );
    assert.equal(
      evidence.failed_request_binding,
      null,
      diagnostic.name,
    );
    assert.doesNotMatch(JSON.stringify(evidence), /private_argument|private stderr|\/Users\/|secret/u);
    const rawTranscript = await readFile(`${resultFile}.substantive.raw.jsonl`, "utf8");
    if (diagnostic.name === "server-info-error") {
      assert.match(rawTranscript, /private_argument|\/Users\/private\/secret/u);
    }
  }
});

test("multi-repository source and setup preflight failures never invoke Codex or write evidence", async (t) => {
  const resultRoot = await mkdtemp(join(tmpdir(), "feature-001-source-preflight-result-"));
  t.after(() => rm(resultRoot, { recursive: true, force: true }));
  for (const [name, overrides, expectedOrder, pattern] of [
    ["source-mismatch", { buildSourceCommit: "b".repeat(40) }, ["build"], /source package identity/u],
    ["dirty-source", { buildSourceDirty: true }, ["build"], /source package identity/u],
    ["setup-failure", { setupError: new Error("setup fixture failed") }, ["build", "install", "setup"], /setup fixture failed/u],
  ]) {
    const callOrder = [];
    let invocationCount = 0;
    const resultFile = join(resultRoot, `${name}.json`);
    await assert.rejects(smokeRuntime.runMultiRepositoryJourney({
      codexExecutable: "/fixture/codex",
      resultFile,
      sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
      runProcess: async () => {
        invocationCount += 1;
        throw new Error("Codex must not run");
      },
      prepareEnvironment: isolatedMultiRepositoryTestEnvironment,
      ...multiRepositorySourceBoundDependencies(callOrder, overrides),
    }), pattern);
    assert.deepEqual(callOrder, expectedOrder, name);
    assert.equal(invocationCount, 0, name);
    await assert.rejects(readFile(resultFile), /ENOENT/u, name);
  }
});

test("multi-repository pre-launch rejection creates no evidence and invokes no Codex process", async (t) => {
  const resultRoot = await mkdtemp(join(tmpdir(), "feature-001-preflight-result-"));
  t.after(() => rm(resultRoot, { recursive: true, force: true }));
  let invocationCount = 0;
  const runProcess = async () => {
    invocationCount += 1;
    throw new Error("must not run");
  };
  const invalidResult = join(resultRoot, "invalid.json");
  await assert.rejects(smokeRuntime.runMultiRepositoryJourney({
    codexExecutable: "/fixture/codex",
    resultFile: invalidResult,
    sourceCommit: "invalid",
    runProcess,
  }), /40-character lowercase Git SHA/u);
  await assert.rejects(readFile(invalidResult), /ENOENT/u);

  const existingResult = join(resultRoot, "existing.json");
  await writeFile(existingResult, "preserve\n");
  await assert.rejects(smokeRuntime.runMultiRepositoryJourney({
    codexExecutable: "/fixture/codex",
    resultFile: existingResult,
    sourceCommit: MULTI_REPOSITORY_SOURCE_COMMIT,
    runProcess,
  }), /evidence file already exists/u);
  assert.equal(await readFile(existingResult, "utf8"), "preserve\n");
  assert.equal(invocationCount, 0);
});

function currentSuccessJSONL() {
  const envelope = {
    ok: true,
    request_id: "request-redacted-success",
    tool: "dev_flow_server_info",
    result: {
      product: "dev-flow",
      version: "0.1.0",
      transport: "stdio",
      health: "ready",
      supported_hosts: ["codex", "deepseek"],
      supported_processes: [{ process_id: "standard-development", definition_digest: "c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57", new_task_supported: true }],
      method_profiles: ["plain", "spec-kit", "openspec"],
      tools: DEV_FLOW_TOOLS,
    },
  };
  const item = {
    id: "item-redacted-success",
    type: "mcp_tool_call",
    server: "dev-flow",
    tool: "dev_flow_server_info",
    arguments: { request_id: envelope.request_id },
    result: { content: [{ type: "text", text: JSON.stringify(envelope) }], structured_content: envelope },
    error: null,
    status: "completed",
  };
  return `${JSON.stringify({ type: "thread.started", thread_id: "thread-redacted-success" })}\n${JSON.stringify({ type: "item.completed", item })}\n`;
}

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
    /first successful Action submission following the requested repository change/u,
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
  assert.match(smokeRuntime.developmentSubstantivePrompt, /first successful Action submission[\s\S]*Task remains nonterminal/i);
  assert.match(smokeRuntime.developmentSubstantivePrompt, /first successful Action submission following file creation/i);
});

test("final registry task-bearing prompts require request binding and resume reads", () => {
  for (const prompt of [smokeRuntime.finalRegistrySubstantivePrompt, smokeRuntime.finalRegistryResumePrompt]) {
    assert.match(
      prompt,
      /fresh_action\.submission_tool[\s\S]*Never send request_id[\s\S]*Core fills and retains/u,
    );
    assert.match(
      prompt,
      /artifacts\.current[\s\S]*method_results[\s\S]*REQUIREMENTS=\{problem_class,baseline,unresolved_questions,changed_paths,no_file_changes\}[\s\S]*DELIVERY=\{problem_class,acceptance/u,
    );
  }
  assert.equal(smokeRuntime.finalRegistryResumePrompt.startsWith(`${EXPLICIT_SELECTOR} `), true);
  assert.match(
    smokeRuntime.finalRegistryResumePrompt,
    /dev_flow_get_task[\s\S]*dev_flow_get_next_action[\s\S]*before any Action submission/u,
  );
  assert.match(
    smokeRuntime.finalRegistryResumePrompt,
    /maintainer explicitly confirmed[\s\S]*explained and maintained[\s\S]*comprehension_passed/u,
  );
});

test("final registry session validation accepts current Core contract graph cursors and handshake", () => {
  const process = {
    process_id: "standard-development",
    definition_digest: "c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57",
    new_task_supported: true,
  };
  const serverInfo = {
    product: "dev-flow",
    version: currentVersion,
    transport: "stdio",
    health: "ready",
    supported_hosts: ["codex", "deepseek"],
    supported_processes: [process],
    method_profiles: ["plain", "spec-kit", "openspec"],
    tools: DEV_FLOW_TOOLS,
  };
  const before = {
    task_id: "task-final-registry-graph",
    revision: 3,
    current_cursor: "TEST",
    current_action: { action_id: "action-before-restart" },
    outcome: null,
  };
  const after = structuredClone(before);
  const done = {
    ...structuredClone(before),
    revision: 4,
    current_cursor: "DONE",
    current_action: null,
    outcome: { status: "completed" },
  };
  const infoCall = (suffix) => graphSuccessCall("dev_flow_server_info", `${suffix}-info`, serverInfo);
  const sessions = [
    graphSession("ordinary", []),
    graphSession("invalid", []),
    graphSession("substantive", [
      infoCall("substantive"),
      graphSuccessCall("dev_flow_apply_action", "substantive-apply", { task: before }),
    ], [{ command: "git hash-object final-registry-proof.txt", status: "completed", exitCode: 0, output: "fixture-proof-hash\n" }]),
    graphSession("resume", [
      infoCall("resume"),
      graphSuccessCall("dev_flow_open_task", "resume-open", { created: false, task: after }),
      graphSuccessCall("dev_flow_get_task", "resume-read", { task: after }),
      graphSuccessCall("dev_flow_get_next_action", "resume-next", { task_id: after.task_id, action: after.current_action }),
      graphSuccessCall("dev_flow_apply_action", "resume-apply", { task: done }),
    ]),
  ];
  const state = {};

  assert.doesNotThrow(() => smokeRuntime.validateDevelopmentSessions(sessions, state, {
    coreVersion: currentVersion,
    graphContract: true,
    proofCommand: "git hash-object final-registry-proof.txt",
    proofRenderedCommand: "/bin/zsh -lc 'git hash-object final-registry-proof.txt'",
    proofHash: "fixture-proof-hash",
  }));
  assert.deepEqual(state, {
    taskIdBeforeRestart: before.task_id,
    taskIdAfterRestart: after.task_id,
    committedActionCount: 2,
    terminalOutcome: "DONE",
  });
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

test("registry journey stop signal requires an authoritative nonterminal Core task", () => {
  const task = { task_id: "task-stop", current_cursor: "TEST", outcome: null };
  const event = coreSuccessEvent("dev_flow_apply_action", "stop", { task });
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(event)), true);

  const camelCase = structuredClone(event);
  camelCase.item.result.structuredContent = camelCase.item.result.structured_content;
  delete camelCase.item.result.structured_content;
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(camelCase)), true);

  const textOnly = structuredClone(event);
  delete textOnly.item.result.structured_content;
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(textOnly)), true);

  const omittedPendingOutcome = coreSuccessEvent("dev_flow_apply_action", "omitted-outcome", {
    task: { task_id: "task-stop", current_cursor: "TEST" },
  });
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(omittedPendingOutcome)), true);

  const done = coreSuccessEvent("dev_flow_apply_action", "done", {
    task: { ...task, current_cursor: "DONE", outcome: { status: "completed" } },
  });
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(done)), false);
  assert.equal(successfulNonterminalApplyEvent(JSON.stringify(coreSuccessEvent("dev_flow_get_task", "read", { task }))), false);
  assert.equal(successfulNonterminalApplyEvent("not-json"), false);
});

test("simulated current Core contract journey starts with handshake and presents the complete multi-edge node contract", async () => {
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
    process: "standard-development",
    definition_digest: "c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57",
    new_task_supported: true,
    method_profiles: ["plain", "spec-kit", "openspec"],
    tools: fixture.server_info.tools,
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
  assert.equal(available.apply_request.node_result.problem_class, "none");
  assert.equal("destination" in available.apply_request, false);
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
  assert.equal(specKitFallback.apply_request.method_results["requirements.clarify"].capability, "");
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
  assert.equal(Object.values(openSpecFallback.apply_request.method_results).every(({ capability }) => capability === ""), true);
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
  assert.equal(understood.apply_request.transition_id, "comprehension_passed");
  assert.deepEqual(understood.apply_request.node_result.user_confirmation, {
    source: "user",
    status: "passed",
    summary: "The developer explicitly confirmed understanding.",
  });
  assert.equal(understood.apply_request.node_result.problem_class, "none");
  assert.equal(understood.core_destination, "DELIVERY");

  const tooComplex = simulateMethodAdapterJourney(fixture, byID.get("comprehension-code-too-complex"));
  assert.equal(tooComplex.apply_request.transition_id, "code_too_complex");
  assert.equal(tooComplex.apply_request.node_result.problem_class, "code_complexity");
  assert.equal(tooComplex.apply_request.node_result.user_confirmation, null);
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
  assert.deepEqual(recovery.calls[0].arguments, { host: "codex", task_id: completed.apply_request.task_id });
  assert.equal(recovery.retained_action_id, completed.apply_request.action_id);
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

test("final local journey CLI is artifact-bound and has no registry substitution", () => {
  const exact = [
    "final-local",
    "--artifact", "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    "--artifact-sha256", "a".repeat(64),
    "--artifact-size", "4381869",
    "--source-commit", "b".repeat(40),
    "--codex-executable", "/opt/codex/bin/codex",
    "--workspace", "/tmp/final-local/workspace",
    "--result-directory", "/tmp/final-local/result",
    "--native-attempt", "3",
    "--authorization", "explicit_user_authorization",
  ];
  assert.deepEqual(parseCLI([...exact]), {
    mode: "final-local",
    artifact: "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    artifactSHA256: "a".repeat(64),
    artifactSize: 4381869,
    sourceCommit: "b".repeat(40),
    codexExecutable: "/opt/codex/bin/codex",
    workspace: "/tmp/final-local/workspace",
    resultDirectory: "/tmp/final-local/result",
    nativeAttempt: 3,
    authorization: "explicit_user_authorization",
  });
  assert.throws(() => parseCLI([...exact, "--package", "dev-flow-codex"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--registry", "https://registry.npmjs.org/"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--version", "0.3.0"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--artifact", exact[2]]), /exact flag/u);
  const relative = [...exact];
  relative[relative.indexOf("--artifact") + 1] = "package.tgz";
  assert.throws(() => parseCLI(relative), /local artifact must be an absolute path/u);
  for (const attempt of ["2", "4"]) {
    const wrongAttempt = [...exact];
    wrongAttempt[wrongAttempt.indexOf("--native-attempt") + 1] = attempt;
    assert.throws(() => parseCLI(wrongAttempt), /attempt 3 requires explicit user authorization/u);
  }

  assert.deepEqual(buildFinalLocalInstallArgs({
    artifact: "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    prefix: "/tmp/final-local/npm-prefix",
    cache: "/tmp/final-local/npm-cache",
  }), [
    "install", "--global", "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    "--prefix", "/tmp/final-local/npm-prefix",
    "--cache", "/tmp/final-local/npm-cache",
    "--ignore-scripts", "--no-audit", "--no-fund",
  ]);
  assert.deepEqual(buildFinalLocalUninstallArgs({
    prefix: "/tmp/final-local/npm-prefix",
    cache: "/tmp/final-local/npm-cache",
  }), [
    "uninstall", "--global", "dev-flow-codex",
    "--prefix", "/tmp/final-local/npm-prefix",
    "--cache", "/tmp/final-local/npm-cache",
    "--ignore-scripts", "--no-audit", "--no-fund",
  ]);
});

test("final local verification classifier uses exact executable command identity", () => {
  const direct = "node --test test/proof-writer.test.mjs";
  const rendered = "/bin/zsh -lc 'node --test test/proof-writer.test.mjs'";
  const readOnlyCommands = [
    "sed -n '/node-payload-template:test:start/,/node-payload-template:test:end/p' plugin/skills/dev-flow/references/node-payloads.md",
    "grep -n 'TEST' plugin/skills/dev-flow/references/node-payloads.md",
    "cat plugin/skills/dev-flow/references/node-payloads.md",
    "/bin/zsh -lc 'python3 -c \"print(\\\"node TEST validate\\\")\"'",
    "/bin/zsh -lc 'sed -n \"/node-payload-template:test:start/,/node-payload-template:test:end/p\" plugin/skills/dev-flow/references/node-payloads.md'",
  ];
  assert.equal(classifyFinalLocalVerificationCommand(direct), "authorized");
  assert.equal(classifyFinalLocalVerificationCommand(rendered), "authorized");
  for (const command of readOnlyCommands) {
    assert.equal(classifyFinalLocalVerificationCommand(command), "other", command);
  }
  for (const command of [
    "npm test",
    "pnpm test",
    "pnpm run validate",
    "go test ./...",
    "node --test *",
    "node --test .",
    "node --test test/different.test.mjs",
    "/bin/zsh -lc 'node --test test/different.test.mjs'",
  ]) {
    assert.equal(classifyFinalLocalVerificationCommand(command), "forbidden", command);
  }

  const completed = (command, itemId) => ({
    itemId,
    command,
    output: "bounded output\n",
    exitCode: 0,
    status: "completed",
  });
  const sessions = [
    { role: "ordinary", commands: [completed(readOnlyCommands[1], "ordinary-read")] },
    { role: "initial-comprehension", commands: [
      completed(readOnlyCommands[0], "initial-template-read"),
      completed(rendered, "initial-targeted-test"),
    ] },
    { role: "complexity-refactor-retest", commands: [
      completed(rendered, "refactor-targeted-test"),
      completed(readOnlyCommands[4], "attempt-3-false-positive-equivalent"),
    ] },
    { role: "confirmation-delivery", commands: [completed(readOnlyCommands[2], "delivery-read")] },
  ];
  assert.equal(assertFinalLocalCommands(sessions), 2);
  sessions[3].commands.push(completed("npm test", "forbidden-suite"));
  assert.throws(() => assertFinalLocalCommands(sessions), /forbidden full or alternate suite/u);
});

test("final local lifecycle CLI and environment expose no Codex execution surface", async () => {
  const exact = [
    "final-local-lifecycle",
    "--artifact", "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    "--artifact-sha256", "a".repeat(64),
    "--artifact-size", "4381869",
    "--core-sha256", "b".repeat(64),
    "--source-commit", "c".repeat(40),
    "--native-result-directory", "/tmp/attempt-3/result",
    "--workspace", "/tmp/final-lifecycle/workspace",
    "--result-directory", "/tmp/final-lifecycle/result",
  ];
  assert.deepEqual(parseCLI([...exact]), {
    mode: "final-local-lifecycle",
    artifact: "/tmp/artifacts/dev-flow-codex-0.3.0.tgz",
    artifactSHA256: "a".repeat(64),
    artifactSize: 4381869,
    coreSHA256: "b".repeat(64),
    sourceCommit: "c".repeat(40),
    nativeResultDirectory: "/tmp/attempt-3/result",
    workspace: "/tmp/final-lifecycle/workspace",
    resultDirectory: "/tmp/final-lifecycle/result",
  });
  assert.throws(() => parseCLI([...exact, "--codex-executable", "/opt/codex"]), /exact flag/u);
  assert.throws(() => parseCLI([...exact, "--authorization", "explicit_user_authorization"]), /exact flag/u);

  const layout = createFinalLocalLifecycleLayout(
    "/tmp/final-lifecycle/workspace",
    "/tmp/final-lifecycle/result",
  );
  const environment = buildFinalLocalLifecycleEnvironment({
    layout,
    toolDirectories: ["/usr/bin", "/bin"],
    baseEnvironment: { LANG: "C.UTF-8", AUTH_TOKEN: "forbidden", CODEX_HOME: "/private" },
  });
  assert.equal(environment.HOME, layout.home);
  assert.equal(environment.DEV_FLOW_DATA_DIR, layout.dataDirectory);
  assert.equal("CODEX_HOME" in environment, false);
  assert.equal("AUTH_TOKEN" in environment, false);
  assert.equal("npm_config_registry" in environment, false);

  const source = await readFile(writer, "utf8");
  const start = source.indexOf("export async function runFinalLocalLifecycle(options)");
  const end = source.indexOf("export async function runFinalLocalJourney(options)", start);
  assert.equal(start >= 0 && end > start, true);
  const lifecycleBody = source.slice(start, end);
  assert.doesNotMatch(lifecycleBody, /runCodexSession\s*\(/u);
  assert.doesNotMatch(lifecycleBody, /copyFinalCodexAuthentication\s*\(/u);
  assert.doesNotMatch(lifecycleBody, /findExecutableOnPath\("codex"\)/u);
  assert.doesNotMatch(lifecycleBody, /inspectFinalCodexExecutable\s*\(/u);
  const runnerText = await readFile(runner, "utf8");
  const lifecycleDispatch = runnerText.split("\n").filter((line) => line.includes("final-local-lifecycle"));
  assert.equal(lifecycleDispatch.length >= 3, true);
  assert.equal(lifecycleDispatch.some((line) => line.includes("codex-executable")), false);
});

test("composite acceptance evidence keeps Attempt 3 and deterministic lifecycle labels exact", () => {
  const nativeEvidence = fixtureAttempt3NativeFlowEvidence();
  const lifecycleEvidence = fixtureExactArtifactLifecycleEvidence();
  assert.deepEqual(validateAttempt3NativeFlowEvidence(nativeEvidence), nativeEvidence);
  assert.deepEqual(validateExactArtifactLifecycleEvidence(lifecycleEvidence), lifecycleEvidence);
  const composite = {
    evidence_kind: "feature-008-composite-source-local-acceptance",
    status: "passed",
    artifact_filename: nativeEvidence.artifact_filename,
    artifact_sha256: nativeEvidence.artifact_sha256,
    artifact_size: nativeEvidence.artifact_size,
    artifact_source_commit: nativeEvidence.artifact_source_commit,
    core_sha256: nativeEvidence.core_sha256,
    package_version: nativeEvidence.package_version,
    core_version: nativeEvidence.core_version,
    native_component: {
      source_attempt: 3,
      runner_status: "failed_after_native_flow",
      native_flow_status: "passed",
      ordinary_zero_calls: true,
      four_distinct_threads: true,
      transition_sequence: nativeEvidence.transition_sequence,
      task_revision: 11,
      terminal_outcome: "DONE",
      targeted_command_count: 2,
      complexity_refactor_retest: true,
      explicit_user_confirmation: true,
      unexpected_repository_paths: [],
    },
    lifecycle_component: {
      evidence_class: "deterministic_exact_artifact",
      same_artifact_identity: true,
      setup_passed: true,
      remove_passed: true,
      repeated_remove_noop: true,
      npm_uninstall_passed: true,
      data_retained: true,
      exact_artifact_reinstall_passed: true,
      same_task_reopened: true,
      terminal_outcome: "DONE",
      read_zero_write: true,
      same_task_as_native_component: false,
    },
    attempt_history: nativeEvidence.attempt_history,
    component_relationship: "complementary_components_bound_to_one_exact_artifact_with_distinct_tasks",
    publication_mutations_performed: false,
    observed_at: "2026-08-20T08:20:00.000Z",
  };
  assert.deepEqual(validateCompositeAcceptanceEvidence(composite, nativeEvidence, lifecycleEvidence), composite);
  assert.throws(
    () => validateAttempt3NativeFlowEvidence({ ...nativeEvidence, lifecycle_status: "passed" }),
    /status is invalid/u,
  );
  assert.throws(
    () => validateExactArtifactLifecycleEvidence({ ...lifecycleEvidence, codex_invocation_count: 1 }),
    /must not use Codex/u,
  );
  assert.throws(
    () => validateExactArtifactLifecycleEvidence({ ...lifecycleEvidence, task_id: "/Users/private/task" }),
    /private or raw material/u,
  );
  assert.throws(
    () => validateCompositeAcceptanceEvidence({ ...composite, artifact_sha256: "e".repeat(64) }, nativeEvidence, lifecycleEvidence),
    /differs between components/u,
  );
});

test("final local payload fixtures and prompts preserve every closed graph branch", async () => {
  const fixture = JSON.parse(await readFile(finalLocalPayloadFixturePath, "utf8"));
  assert.equal(fixture.fixture_kind, "feature_008_final_local_payload_matrix");
  assert.deepEqual(fixture.entries.map((entry) => entry.name), [
    "requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test",
    "tests_passed_initial", "code_too_complex", "refactor_ready_for_test",
    "tests_passed_after_refactor", "comprehension_passed", "delivery_complete",
  ]);
  for (const entry of fixture.entries) {
    assert.deepEqual(Object.keys(entry.payload).sort(), [
      "artifacts", "method_evidence", "node_result", "reason", "summary", "transition_id",
    ]);
    assert.deepEqual(entry.payload.artifacts, []);
    assert.equal(entry.payload.method_evidence.length, 3);
    assert.equal(new Set(entry.payload.method_evidence.map((item) => item.step_id)).size, 3);
    assert.equal(entry.payload.method_evidence.every((item) => item.status === "plain_fallback" && item.capability === ""), true);
    assert.equal("destination" in entry.payload, false);
  }
  const requirements = fixture.entries[0].payload.node_result;
  assert.deepEqual(Object.keys(requirements).sort(), ["baseline", "changed_paths", "no_file_changes", "problem_class", "unresolved_questions"]);
  assert.equal(requirements.problem_class, "none");
  assert.deepEqual(requirements.unresolved_questions, []);
  assert.deepEqual(requirements.changed_paths, []);
  assert.equal(requirements.no_file_changes, true);
  assert.equal(JSON.stringify(fixture).includes("repository_observation"), false);
  for (const prompt of [finalLocalSessionOnePrompt, finalLocalSessionTwoPrompt, finalLocalSessionThreePrompt]) {
    assert.match(prompt, /artifacts\.current[\s\S]*artifacts\.other_process/u);
    assert.match(prompt, /method_results[\s\S]*method step ID/u);
    assert.match(prompt, /exact node_result/u);
    assert.match(prompt, /Stop after any submission error/u);
    assert.match(prompt, /problem_class=none and findings=\[\]/u);
    assert.match(prompt, /select only a returned transition/u);
  }
});

test("final local layout isolates every mutable surface and evidence remains closed", () => {
  const layout = createFinalLocalJourneyLayout(
    "/tmp/final-local/workspace",
    "/tmp/final-local/result",
  );
  assert.equal(layout.root, "/tmp/final-local");
  for (const field of ["home", "codexHome", "installPrefix", "npmCache", "dataDirectory", "temporaryDirectory", "xdgCache"]) {
    assert.equal(layout[field].startsWith("/tmp/final-local/"), true, field);
  }
  const environment = buildFinalLocalJourneyEnvironment({
    layout,
    codexExecutable: "/opt/codex/bin/codex",
    toolDirectories: ["/usr/bin", "/bin"],
    baseEnvironment: { LANG: "C.UTF-8", AUTH_TOKEN: "forbidden" },
  });
  assert.equal(environment.HOME, layout.home);
  assert.equal(environment.CODEX_HOME, layout.codexHome);
  assert.equal(environment.DEV_FLOW_DATA_DIR, layout.dataDirectory);
  assert.equal(environment.GIT_CONFIG_GLOBAL, "/dev/null");
  assert.equal(environment.GIT_CONFIG_NOSYSTEM, "1");
  assert.equal("AUTH_TOKEN" in environment, false);
  assert.equal("npm_config_registry" in environment, false);

  const evidence = fixtureFinalLocalJourneyEvidence();
  assert.deepEqual(validateFinalLocalJourneyEvidence(evidence), evidence);
  assert.throws(() => validateFinalLocalJourneyEvidence({ ...evidence, native_journey_attempt_count: 4 }), /attempt count/u);
  assert.throws(() => validateFinalLocalJourneyEvidence({ ...evidence, unexpected_repository_paths: ["extra.txt"] }), /unexpected_repository_paths/u);
  assert.throws(() => validateFinalLocalJourneyEvidence({ ...evidence, artifact_filename: "/Users/private/package.tgz" }), /filename|private path/u);
});

test("final registry journey CLI is closed, registry-only, and rejects local substitution", () => {
  const exact = [
    "final-registry",
    "--package", "dev-flow-codex",
    "--version", currentVersion,
    "--registry", "https://registry.npmjs.org/",
    "--tarball-sha256", "a".repeat(64),
    "--core-version", "0.5.0",
    "--core-sha256", "b".repeat(64),
    "--source-commit", "c".repeat(40),
    "--codex-executable", "/opt/codex/bin/codex",
    "--workspace", "/tmp/final-workspace",
    "--result-directory", "/tmp/final-result",
  ];
  assert.deepEqual(parseCLI([...exact]), {
    mode: "final-registry",
    packageName: "dev-flow-codex",
    version: currentVersion,
    registry: "https://registry.npmjs.org/",
    tarballSHA256: "a".repeat(64),
    coreVersion: "0.5.0",
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
    version: currentVersion,
    prefix: "/tmp/isolated-prefix",
    cache: "/tmp/isolated-cache",
  }), [
    "install", "--global", `dev-flow-codex@${currentVersion}`,
    "--registry=https://registry.npmjs.org/",
    "--prefix", "/tmp/isolated-prefix",
    "--cache", "/tmp/isolated-cache",
    "--ignore-scripts", "--no-audit", "--no-fund",
  ]);
  assert.deepEqual(buildFinalRegistryPackArgs({
    version: currentVersion,
    destination: "/tmp/registry-readback",
  }), [
    "pack", `dev-flow-codex@${currentVersion}`,
    "--pack-destination", "/tmp/registry-readback",
    "--ignore-scripts", "--json",
    "--registry=https://registry.npmjs.org/",
  ]);
});

test("quick registry journey has one closed CLI and bounded lifecycle evidence", () => {
  const parsed = parseCLI([
    "quick-registry",
    "--package", "dev-flow-codex",
    "--version", currentVersion,
    "--registry", "https://registry.npmjs.org/",
    "--tarball-sha256", "a".repeat(64),
    "--core-version", "0.5.0",
    "--core-sha256", "b".repeat(64),
    "--source-commit", "c".repeat(40),
    "--codex-executable", "/opt/codex/bin/codex",
    "--workspace", "/tmp/quick-workspace",
    "--result-directory", "/tmp/quick-result",
  ]);
  assert.equal(parsed.mode, "quick-registry");
  const evidence = {
    evidence_kind: QUICK_NATIVE_EVIDENCE_KIND,
    status: "passed",
    package_name: "dev-flow-codex",
    package_version: currentVersion,
    registry: "https://registry.npmjs.org/",
    npm_tarball_sha256: "a".repeat(64),
    npm_integrity: `sha512-${Buffer.alloc(64, 7).toString("base64")}`,
    core_version: currentVersion,
    core_sha256: "b".repeat(64),
    source_commit: "c".repeat(40),
    codex_version: "0.147.0",
    compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
    setup_readback_passed: true,
    handshake_passed: true,
    remove_readback_passed: true,
    npm_uninstall_passed: true,
    repository_unchanged: true,
    observed_at: "2026-08-20T08:00:00.000Z",
  };
  assert.deepEqual(validateQuickJourneyEvidence(evidence, {
    expected: {
      packageName: "dev-flow-codex",
      version: currentVersion,
      registry: "https://registry.npmjs.org/",
      tarballSHA256: "a".repeat(64),
      coreSHA256: "b".repeat(64),
      sourceCommit: "c".repeat(40),
    },
  }), evidence);
  assert.throws(() => validateQuickJourneyEvidence({ ...evidence, handshake_passed: false }), /handshake_passed/u);
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
  const fixture = fixtureFinalJourneyEvidence(currentVersion);
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
  const fixture = fixtureFinalJourneyEvidence(currentVersion);
  const manifest = {
    release: { version: currentVersion, source_commit: "c".repeat(40), verification_mode: "normal", based_on_release: null },
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
    verification_mode: "normal",
    based_on_release: null,
    notes: "Native registry-package Codex lifecycle smoke passed install, version/Core handshake, setup, removal, uninstall, and repository-unchanged gates.",
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
    ["invalid Core version", { core_version: "invalid" }, /release version/u],
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
  assert.deepEqual(info.method_profiles, ["plain", "spec-kit", "openspec"]);
  assert.equal(info.supported_processes.length, 1);
  assert.equal(info.supported_processes[0].process_id, "standard-development");
  assert.equal(info.supported_processes[0].new_task_supported, true);
  assert.equal(info.tools.length, 15);

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
    ? action.available_transitions.find(({ transition_id }) => transition_id === applyRequest.transition_id)
    : null;
  if (applyRequest) calls.push({ tool: action.submission_tool, arguments: applyRequest });

  return {
    calls,
    handshake: {
      process: info.supported_processes[0].process_id,
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
    selected_transition: applyRequest?.transition_id ?? null,
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
  const methodResults = Object.fromEntries(scenario.method_evidence.map((item) => [item.step_id, {
    capability: item.capability,
    summary: item.summary,
  }]));
  return {
    host: "codex",
    task_id: action.task_id,
    action_id: action.action_id,
    transition_id: scenario.transition_id,
    summary: `Completed simulated semantic work for ${scenario.id}.`,
    reason: scenario.reason ?? "",
    artifacts: { current: [], other_process: [] },
    method_results: methodResults,
    node_result: nodeResult,
  };
}

function handleUncertainFixtureResult(fixture, applyRequest) {
  return {
    calls: [{ tool: "dev_flow_get_task", arguments: { host: "codex", task_id: applyRequest.task_id } }],
    retained_action_id: applyRequest.action_id,
    core_response: fixture.uncertain_result.core_response,
    stopped: true,
    automatic_retry: false,
    recovery_apply_used: false,
    classification_inferred: false,
  };
}
