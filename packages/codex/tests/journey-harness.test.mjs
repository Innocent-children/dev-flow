import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFile = promisify(execFileCallback);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const harnessPath = join(repositoryRoot, "scripts", "run-codex-real-journey.sh");
const nativeEvidencePath = join(repositoryRoot, "tests", "journeys", "evidence", "codex-macos-arm64.json");
const supportedMachine = process.platform === "darwin" && process.arch === "arm64";

test("fake journey rejects real-host and out-of-slice stage attempts before host launch", async () => {
  await assert.rejects(
    execHarness(["--through", "done"]),
    /real Codex is disabled before the frozen-artifact native journey/,
  );
  await assert.rejects(
    execHarness(["--fake-host", "--through", "unknown"]),
    /supports only|unsupported.*stage/i,
  );
});

test("operator guide documents governed create, resume, recovery, and terminal boundaries", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  for (const expectation of [
    /## Core-governed create and resume/,
    /omit(?:s)? `new_task`/i,
    /fresh Core action/i,
    /read\s+before retry/i,
    /verification.*budget/i,
    /manual handoff/i,
    /restart.*same task ID/is,
    /blocker.*conflict/is,
    /Core.*`DONE`/i,
  ]) {
    assert.match(readme, expectation);
  }
});

test("operator guide documents bounded removal, retention, and compatible reinstall", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  for (const expectation of [
    /## Explicit removal and retained task data/,
    /deregister[\s\S]*before[\s\S]*npm uninstall/i,
    /receipt-first|read.*receipt.*first/i,
    /interrupted[\s\S]*resume/i,
    /conflict[\s\S]*fail.*closed/i,
    /adjacent[\s\S]*preserv/i,
    /task data[\s\S]*reopen/i,
    /repeated removal[\s\S]*(?:no-op|idempotent)/i,
    /compatible reinstall/i,
  ]) {
    assert.match(readme, expectation);
  }
});

test("fake through-done journey preserves build identity and reaches one recovered Core lineage", {
  skip: supportedMachine ? false : "darwin-arm64 deterministic package execution only",
}, async () => {
  const evidenceBefore = await optionalContents(nativeEvidencePath);
  const { stdout, stderr } = await execHarness(["--fake-host", "--through", "done"]);
  assert.equal(stderr, "");
  const checkpoint = JSON.parse(stdout);

  assert.equal(checkpoint.checkpoint_version, 1);
  assert.equal(checkpoint.classification, "simulated");
  assert.equal(checkpoint.through_stage, "done");
  assert.equal(checkpoint.real_codex_started, false);
  assert.equal(checkpoint.native_evidence_written, false);
  assert.equal(checkpoint.artifact_final, false);
  assert.match(checkpoint.source_commit, /^[0-9a-f]{40}$/);
  assert.match(checkpoint.artifact_sha256, /^[0-9a-f]{64}$/);
  assert.equal(checkpoint.build_identity.source_commit, checkpoint.source_commit);
  assert.equal(checkpoint.build_identity.artifact_sha256, checkpoint.artifact_sha256);

  assert.equal(checkpoint.repository.before_sha256, checkpoint.repository.after_setup_sha256);
  assert.equal(checkpoint.repository.before_sha256, checkpoint.repository.after_completion_sha256);
  assert.equal(checkpoint.repository.unchanged, true);
  assert.match(checkpoint.task_data.before_restart_sha256, /^[0-9a-f]{64}$/);
  assert.match(checkpoint.task_data.after_done_sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(checkpoint.task_data.before_restart_sha256, checkpoint.task_data.after_done_sha256);
  assert.equal(checkpoint.task_data.persisted_across_sessions, true);

  assert.deepEqual(checkpoint.session_markers, [
    "create-session-open",
    "create-session-closed",
    "resume-session-open",
    "uncertain-response-observed",
    "resume-session-closed",
    "recovery-session-open",
    "recovery-session-closed",
  ]);
  assert.equal(checkpoint.task_lineage.task_id_before_restart, checkpoint.task_lineage.task_id_after_restart);
  assert.deepEqual(checkpoint.task_lineage.revisions, [1, 4, 8]);
  assert.equal(checkpoint.task_lineage.committed_actions.length, 2);
  assert.equal(new Set(checkpoint.task_lineage.committed_actions.map((action) => action.action_id)).size, 2);
  assert.equal(checkpoint.task_lineage.committed_actions[1].response, "uncertain_then_read_back");
  assert.equal(checkpoint.task_lineage.recovery_classification, "completed_and_recorded");
  assert.equal(checkpoint.task_lineage.terminal_outcome, "DONE");

  assert.ok(checkpoint.budget.verification_commands_used <= checkpoint.budget.max_automatic_commands);
  assert.ok(checkpoint.budget.core_call_count <= checkpoint.budget.scenario_call_budget);
  assert.equal(checkpoint.budget.full_suite_run, false);
  assert.equal(checkpoint.recovery.apply_calls, 2);
  assert.deepEqual(checkpoint.recovery.calls_after_uncertainty, [
    "dev_flow_get_task",
    "dev_flow_get_next_action",
  ]);
  assert.equal(await optionalContents(nativeEvidencePath), evidenceBefore);
});

test("fake through-remove journey preserves task data and separates uninstall from compatible reinstall", {
  skip: supportedMachine ? false : "darwin-arm64 deterministic package execution only",
}, async () => {
  const evidenceBefore = await optionalContents(nativeEvidencePath);
  const { stdout, stderr } = await execHarness(["--fake-host", "--through", "remove"]);
  assert.equal(stderr, "");
  const checkpoint = JSON.parse(stdout);

  assert.equal(checkpoint.classification, "simulated");
  assert.equal(checkpoint.through_stage, "remove");
  assert.equal(checkpoint.real_codex_started, false);
  assert.equal(checkpoint.native_evidence_written, false);
  assert.equal(checkpoint.task_lineage.terminal_outcome, "DONE");
  assert.equal(checkpoint.removal.process_stopped_before_remove, true);
  assert.equal(checkpoint.removal.remove_status, "removed");
  assert.equal(checkpoint.removal.repeat_status, "already-absent");
  assert.equal(checkpoint.removal.plugin_absent, true);
  assert.equal(checkpoint.removal.marketplace_absent, true);
  assert.equal(checkpoint.removal.receipt_absent, true);
  assert.equal(checkpoint.removal.adjacent_preserved, true);
  assert.equal(checkpoint.removal.npm_uninstalled_separately, true);
  assert.equal(checkpoint.removal.compatible_reinstall_status, "installed");
  assert.equal(checkpoint.removal.reinstall_plugin_count, 1);
  assert.equal(checkpoint.removal.reinstall_marketplace_count, 1);

  assert.deepEqual(
    checkpoint.task_data_removal.files_before_removal,
    checkpoint.task_data_removal.files_after_removal,
  );
  assert.equal(
    checkpoint.task_data_removal.manifest_before_removal_sha256,
    checkpoint.task_data_removal.manifest_after_removal_sha256,
  );
  assert.equal(checkpoint.task_data_removal.direct_reopen_task_id, checkpoint.task_lineage.task_id_after_restart);
  assert.equal(checkpoint.task_data_removal.direct_reopen_revision, 8);
  assert.equal(checkpoint.repository.after_completion_sha256, checkpoint.repository.after_removal_sha256);
  assert.equal(checkpoint.repository.unchanged, true);
  assert.equal(checkpoint.session_markers.includes("process-stop-before-remove"), true);
  assert.equal(checkpoint.session_markers.includes("direct-reopen-after-remove"), true);
  assert.equal(await optionalContents(nativeEvidencePath), evidenceBefore);
});

function execHarness(arguments_) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  return execFile(harnessPath, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
}

async function optionalContents(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
