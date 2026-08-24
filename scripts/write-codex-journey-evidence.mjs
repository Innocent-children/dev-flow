#!/usr/bin/env node

import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rm,
  symlink,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

import { DEV_FLOW_TOOLS, parseCodexJSONL } from "./validate-codex-journey-evidence.mjs";

const execFile = promisify(execFileCallback);
const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const CODEX_COMPATIBILITY_RANGE = ">=0.147.0";
export const EXPLICIT_SELECTOR = "$dev-flow-codex:dev-flow";
export const FINAL_NATIVE_EVIDENCE_KIND = "registry-package-native-codex-journey";
export const QUICK_NATIVE_EVIDENCE_KIND = "registry-package-quick-smoke";
export const FINAL_FIXTURE_EVIDENCE_KIND = "fixture-simulated-registry-package-journey";
export const FINAL_LOCAL_NATIVE_EVIDENCE_KIND = "source-local-package-native-codex-journey";
export const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";
export const MULTI_REPOSITORY_EVIDENCE_KIND = "feature-001-multi-repository-codex-journey";
const MULTI_REPOSITORY_SUCCESS_FIELDS = Object.freeze([
  "evidence_kind",
  "status",
  "source_commit",
  "host",
  "runner_mode",
  "journey_budget",
  "setup_readback_passed",
  "codex_session_count",
  "task_id",
  "primary_repository_key",
  "additional_repository_keys",
  "repository_count",
  "revision_before_resume",
  "revision_after_resume",
  "action_id_before_resume",
  "action_id_after_resume",
  "repository_binding_digest_before_resume",
  "repository_binding_digest_after_resume",
  "resumed_from_additional_repository",
  "one_core_task",
  "scoped_paths",
  "successful_action_count",
  "tool_catalog_size",
  "codebase_memory_preference",
  "observed_at",
]);
const MULTI_REPOSITORY_FAILURE_FIELDS = Object.freeze([
  "evidence_kind",
  "status",
  "source_commit",
  "host",
  "runner_mode",
  "journey_budget",
  "failure_stage",
  "failure_classification",
  "session_role",
  "exit_code",
  "stdout_sha256",
  "stderr_sha256",
  "setup_readback_passed",
  "thread_started",
  "dev_flow_call_count",
  "first_dev_flow_tool",
  "first_dev_flow_classification",
  "first_dev_flow_error_code",
  "dev_flow_tool_sequence",
  "failed_dev_flow_tool",
  "failed_dev_flow_error_code",
  "failed_request_binding",
  "observed_at",
]);
const MULTI_REPOSITORY_CALL_SUMMARY_LIMIT = 64;
export const ordinaryPrompt =
  "Reply with one short sentence describing this repository. Do not invoke Dev Flow.";
export const invalidPrompt =
  "$dev-flow Reply exactly `BARE_SELECTOR_PROBE`. Do not call tools, inspect files, run commands, or modify the repository.";
export const smokePrompt =
  `${EXPLICIT_SELECTOR} Inspect the current repository and report the authoritative Dev Flow task status.`;
export const acceptancePrompt =
  `${EXPLICIT_SELECTOR} Begin the bounded acceptance task in this repository. Stop immediately after the first successful dev_flow_apply_action following the requested repository change while the Core task remains nonterminal. Do not continue to verification or a terminal outcome in this session; a fresh session will resume the task.`;
export const resumePrompt =
  `${EXPLICIT_SELECTOR} Resume the existing compatible Dev Flow task and continue to the Core outcome.`;
export const developmentInvalidPrompt =
  `${EXPLICIT_SELECTOR} Reject this bounded request because the current directory is not a Git repository. Make no Dev Flow tool call and create no task.`;
export const developmentSubstantivePrompt = `${EXPLICIT_SELECTOR} Work only in the current repository. Open one host=codex task to create native-proof.txt with the exact UTF-8 bytes "Dev Flow Codex development smoke passed.\\n". Complete the Core-required current-node work and select only returned transitions; read-only prerequisite commits do not satisfy the stop condition. Create the file only when the current Core action permits repository edits. The verification budget is one targeted command, full suites are forbidden, and verification is reserved for the restart session. Stop only after the file exists and the first successful dev_flow_apply_action after creating it commits, while the Core task is nonterminal.`;
export const developmentResumePrompt = `${EXPLICIT_SELECTOR} Resume the existing compatible host=codex task. After dev_flow_open_task, call dev_flow_get_task and then dev_flow_get_next_action before any new dev_flow_apply_action. Preserve the same task, run only "git hash-object native-proof.txt" as the single targeted verification command, and continue until Core reports current_cursor DONE with outcome completed.`;
const APPLY_REQUEST_BINDING_RULE = `For every dev_flow_apply_action, generate a new nonempty opaque caller request ID and include it exactly as the top-level request_id member of that tool call; never omit it, reuse a read request ID, or place it inside payload.`;
export function multiRepositorySubstantivePrompt(primaryRepository, additionalRepository) {
  requireAbsolute(primaryRepository, "primary repository");
  requireAbsolute(additionalRepository, "additional repository");
  return `${EXPLICIT_SELECTOR} ${APPLY_REQUEST_BINDING_RULE} ${APPLY_PAYLOAD_RULES} Create exactly one host=codex Task with repository_path=${JSON.stringify(primaryRepository)}, primary_repository_key=core, and additional_repositories=[{\"key\":\"docs\",\"repository_path\":${JSON.stringify(additionalRepository)}}]. These are the only user-declared repositories; do not discover or add any other repository. Use method_profile=plain and set a budget of one targeted verification command, but do not run that command in this substantive session because it stops at the successful IMPLEMENT apply before TEST. Advance only from complete Core Actions and returned transitions. When repository edits are allowed, create core-proof.txt in repository key core with exact UTF-8 bytes "core proof\\n" and docs-proof.txt in repository key docs with exact UTF-8 bytes "docs proof\\n". Use core::core-proof.txt and docs::docs-proof.txt in all multi-repository expected_paths, Artifact paths, Implementation changed_paths, and Refactor changed_paths. Stop after the first successful apply that records both changes while the Core Task remains nonterminal; do not resume or create another Task.`;
}

export function multiRepositoryResumePrompt(additionalRepository) {
  requireAbsolute(additionalRepository, "additional repository");
  return `${EXPLICIT_SELECTOR} Resume the existing host=codex Task by calling dev_flow_open_task with repository_path=${JSON.stringify(additionalRepository)}, new_task=null, and no Scope creation fields. Do not create or modify files. Do not call dev_flow_apply_action or create another Task. After open succeeds, stop; the runner will verify that this fresh Codex session returned the same post-mutation Task, revision, current Action, primary repository, and ordered Scope.`;
}
const APPLY_PAYLOAD_RULES = `Before every apply, bind the latest complete Action and read action_kind, payload_contract, method_steps, available_transitions, and the current dev_flow_apply_action inputSchema branch. The payload must have exactly transition_id, summary, reason, artifacts, method_evidence, and node_result. Use artifacts=[] because this journey creates no process artifact; required_evidence is not an ArtifactReference role and repository_observation must never appear in artifacts. Preserve the complete node_result wrapper, arrays as arrays, and exactly one plain_fallback/capability-empty MethodEvidence item for every current method step in Action order. problem_class and findings select a graph branch rather than carrying general notes: for a forward ready, passed, or completed transition use problem_class=none and findings=[]; put ordinary observations in summary or the node-specific semantic fields. Use a non-none problem_class and nonempty findings only when they establish the exact corrective transition selected from the current Action. Never submit destination, next_node, next_cursor, unknown fields, or a guessed transition. If any apply returns an error, stop immediately without retrying that or another payload. The success wrappers are: REQUIREMENTS={problem_class,baseline,unresolved_questions}; DESIGN/TASKS={problem_class,baseline,findings}; IMPLEMENT={problem_class,task_plan_revision,completed_work_item_ids,changed_paths,no_file_changes,deviations,findings}; TEST={problem_class,checks,failed_items,unverified_items,manual_handoff_items,findings}; COMPREHENSION_REVIEW={problem_class,explained_components,unresolved_questions,unnecessary_abstractions,maintenance_risks,user_confirmation,findings}; REFACTOR={problem_class,changed_paths,no_file_changes,simplifications,behavior_change_intended,findings}; DELIVERY={problem_class,acceptance,automated_evidence_ids,manual_evidence_ids,test_record_id,comprehension_record_id,unverified_items,risks,findings}, with all delivery IDs read dynamically from the current Core task.`;
const FINAL_REGISTRY_COMPREHENSION_VERDICT = `The maintainer explicitly confirmed the target release with --confirm-comprehension: I have read and understood the final-registry proof implementation and validation path, can explain and maintain it, and confirm it passes COMPREHENSION_REVIEW. At COMPREHENSION_REVIEW, submit comprehension_passed only from the current Action with problem_class=none, empty unresolved_questions and unnecessary_abstractions, and user_confirmation source=user status=passed reflecting this exact verdict.`;
export const finalRegistrySubstantivePrompt = `${EXPLICIT_SELECTOR} ${APPLY_REQUEST_BINDING_RULE} ${APPLY_PAYLOAD_RULES} Work only in the current repository. Open one host=codex task to create final-registry-proof.txt with the exact UTF-8 bytes "Dev Flow Codex final registry journey passed.\\n". Advance through the Core-required read-only prerequisites, create the file only when the current action permits repository edits, and stop after the first successful dev_flow_apply_action following file creation while the task remains nonterminal.`;
export const finalRegistryResumePrompt = `${EXPLICIT_SELECTOR} ${APPLY_REQUEST_BINDING_RULE} ${APPLY_PAYLOAD_RULES} ${FINAL_REGISTRY_COMPREHENSION_VERDICT} Resume the existing compatible host=codex task. After dev_flow_open_task, you MUST call dev_flow_get_task and then dev_flow_get_next_action before any dev_flow_apply_action. Do not use the action returned by dev_flow_open_task to skip either read. Run only "git hash-object final-registry-proof.txt" as the targeted verification command, and continue until Core reports current_cursor DONE with outcome completed.`;
const FINAL_LOCAL_PAYLOAD_RULES = APPLY_PAYLOAD_RULES;
export const finalLocalSessionOnePrompt = `${EXPLICIT_SELECTOR} ${FINAL_LOCAL_PAYLOAD_RULES} Work only in the current workspace. Create one new host=codex task with method_profile=plain to implement writeProof so it writes the exact UTF-8 bytes "Dev Flow Feature 008 native journey passed.\\n". Use verification_budget level=targeted, max_automatic_commands=2, allow_full_suite=false, allow_manual_handoff=false. For the first REQUIREMENTS mutation, use artifacts=[], problem_class=none, a complete baseline object containing goal/scope/out_of_scope/acceptance_criteria/constraints/assumptions, and unresolved_questions=[]; do not flatten baseline fields. Advance REQUIREMENTS, DESIGN, TASKS, and IMPLEMENT using only the complete current Core action and returned transition IDs. During the first implementation preserve the existing ProofWriterFactory and ProofWriter layering. Modify only src/proof-writer.mjs; do not modify package.json or test/proof-writer.test.mjs, create files, commit, or change Git HEAD/branch. Run exactly one verification command: node --test test/proof-writer.test.mjs. Do not run npm test, pnpm test, a wildcard node test, or any other verification command. After tests pass, enter COMPREHENSION_REVIEW, present all six legal transitions/destinations, and explain the current design and code path. Do not supply a user comprehension confirmation, do not enter REFACTOR, DELIVERY, or DONE, and stop while waiting for the developer verdict.`;
export const finalLocalSessionTwoPrompt = `${EXPLICIT_SELECTOR} ${FINAL_LOCAL_PAYLOAD_RULES} 我已经阅读了当前解释。Factory 与 Writer 的分层对这个单一写入行为来说是不必要的，我无法清晰解释和维护它。请将其作为明确的 code complexity verdict。 Resume the existing host=codex task by omitting or using null new_task. After dev_flow_server_info and dev_flow_open_task, call dev_flow_get_task and then dev_flow_get_next_action before any dev_flow_apply_action, and prove the task/revision/action/process/current-node identity is unchanged. Select only the returned code_too_complex transition with problem_class=code_complexity, user_confirmation=null, nonempty unnecessary_abstractions/findings, and an explicit reason. In REFACTOR remove ProofWriterFactory and ProofWriter, leaving one direct understandable writeProof implementation in src/proof-writer.mjs. Modify only src/proof-writer.mjs; do not modify package.json or test/proof-writer.test.mjs, create files, commit, or change Git HEAD/branch. Select refactor_ready_for_test with problem_class=none, behavior_change_intended=false, and nonempty simplifications; run exactly one verification command: node --test test/proof-writer.test.mjs, and run no other verification command. Submit tests_passed, return to COMPREHENSION_REVIEW, explain the simplified path, do not provide a passing user verdict, do not enter DELIVERY, and stop waiting for the final developer verdict.`;
export const finalLocalSessionThreePrompt = `${EXPLICIT_SELECTOR} ${FINAL_LOCAL_PAYLOAD_RULES} 我已经阅读并检查了简化后的实现。我现在能够解释它的主要路径、约束和维护方式，并明确确认它可以通过理解审查。 Resume the same host=codex task. After dev_flow_server_info and dev_flow_open_task, call dev_flow_get_task and then dev_flow_get_next_action before any dev_flow_apply_action. Submit comprehension_passed only from the current Core action with problem_class=none, empty unresolved_questions/unnecessary_abstractions, and user_confirmation source=user status=passed reflecting this prompt. Enter DELIVERY, read the latest TestRecord, ComprehensionAssessment, and exact ordered Core-derived automated/manual evidence IDs from the current task; do not hard-code those IDs. Then select delivery_complete and stop only when Core reports current_cursor DONE with outcome.status=completed and current_action=null. Do not modify files, run a verification command, commit, or change Git HEAD/branch.`;

const PROOF_CONTENT = "Dev Flow Codex development smoke passed.\n";
const ACCEPTANCE_PROOF_CONTENT = "Dev Flow Codex final acceptance passed.\n";
const PROOF_COMMAND = "git hash-object native-proof.txt";
const PROOF_RENDERED_COMMAND = "/bin/zsh -lc 'git hash-object native-proof.txt'";
const PROOF_GIT_HASH = createHash("sha1")
  .update(`blob ${Buffer.byteLength(PROOF_CONTENT)}\0${PROOF_CONTENT}`)
  .digest("hex");
const FINAL_PROOF_NAME = "final-registry-proof.txt";
const FINAL_PROOF_CONTENT = "Dev Flow Codex final registry journey passed.\n";
const FINAL_PROOF_COMMAND = `git hash-object ${FINAL_PROOF_NAME}`;
const FINAL_PROOF_RENDERED_COMMAND = `/bin/zsh -lc 'git hash-object ${FINAL_PROOF_NAME}'`;
const FINAL_PROOF_GIT_HASH = createHash("sha1")
  .update(`blob ${Buffer.byteLength(FINAL_PROOF_CONTENT)}\0${FINAL_PROOF_CONTENT}`)
  .digest("hex");
const FINAL_LOCAL_PROOF_CONTENT = "Dev Flow Feature 008 native journey passed.\n";
const FINAL_LOCAL_TEST_COMMAND = "node --test test/proof-writer.test.mjs";
const FINAL_LOCAL_RENDERED_TEST_COMMAND = "/bin/zsh -lc 'node --test test/proof-writer.test.mjs'";
const FINAL_LOCAL_DEFINITION_DIGEST = "c3500d879c1652cb4f3944317c41c1fd2536bfb262b2fa82cd44a2d7e49c0b57";
const FINAL_LOCAL_PACKAGE_FILES = Object.freeze([
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "runtime/darwin-arm64/dev-flow",
]);
const FINAL_LOCAL_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind", "status", "artifact_filename", "artifact_sha256", "artifact_size",
  "artifact_source_commit", "package_name", "package_version", "core_version", "core_sha256",
  "platform", "codex_version", "compatible_codex_range", "codex_compatible", "explicit_selector",
  "handshake_passed", "setup_readback_passed", "ordinary_prompt_core_call_count",
  "task_id_before_restart", "task_revision_before_restart", "task_action_id_before_restart",
  "task_id_after_restart", "task_revision_after_restart", "task_action_id_after_restart",
  "multiple_destinations_observed", "complexity_transition_observed", "refactor_retest_observed",
  "explicit_user_confirmation_observed", "committed_action_count", "targeted_command_count",
  "terminal_outcome", "remove_readback_passed", "npm_uninstall_passed", "task_data_retained",
  "task_reopened_after_uninstall", "unexpected_repository_paths", "native_journey_attempt_count",
  "total_native_attempts", "successful_attempt", "attempt_1_status", "attempt_1_stage",
  "attempt_1_failure", "attempt_1_evidence_preserved", "attempt_2_status", "attempt_2_stage",
  "attempt_2_failure", "attempt_2_authorization", "attempt_2_evidence_preserved",
  "attempt_3_status", "attempt_3_authorization", "attempt_3_final_allowed_attempt",
  "previous_attempt_preserved",
  "observed_at",
]);
const ATTEMPT_3_TRANSCRIPTS = Object.freeze([
  Object.freeze({ role: "ordinary", filename: "session-0-ordinary.jsonl", size: 3043, sha256: "f8c5461e256c3248b662bb2ab094c2aec982e622ed51687ba3f55b5de8988ad9" }),
  Object.freeze({ role: "initial-comprehension", filename: "session-1-initial-comprehension.jsonl", size: 122954, sha256: "55bd97084e453a869213f5752b4fa2124fdc06322e032e4f7c8a5622f8e553b3" }),
  Object.freeze({ role: "complexity-refactor-retest", filename: "session-2-complexity-refactor-retest.jsonl", size: 133284, sha256: "600e15e0a49b21c3039fd8d7d453f7a1886d498011ec5cbc9814d2ed93e9e78d" }),
  Object.freeze({ role: "confirmation-delivery", filename: "session-3-confirmation-delivery.jsonl", size: 122458, sha256: "b63ec4a42bd634694486bc2588113b077460fa9d1e2d2576ce742bf35b6adbb8" }),
]);
const ATTEMPT_3_ARTIFACT_MARKER = Object.freeze({
  filename: "native-attempt-3.json",
  size: 465,
  sha256: "0f35251490e2e51b4b23e2b425f22fe8f2e1ebd89fd31a0c566a932afeab5b41",
});
const ATTEMPT_3_FAILED_MARKER = Object.freeze({
  filename: "native-attempt-3-failed.json",
  size: 1293,
  sha256: "26defc139e75f75549d491a5c3254f58b9722852e4ed23b1d1be9b0704fb4044",
});
const ATTEMPT_3_NATIVE_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind", "native_flow_status", "runner_status", "lifecycle_status", "source_attempt",
  "artifact_filename", "artifact_sha256", "artifact_size", "artifact_source_commit",
  "package_name", "package_version", "core_version", "core_sha256", "platform",
  "source_transcripts", "source_artifact_marker", "original_failed_marker",
  "ordinary_zero_calls", "distinct_real_codex_threads", "handshake_passed", "process_identity", "definition_digest", "method_profiles", "tool_order",
  "transition_sequence", "successful_mutation_count", "request_binding_passed", "revision_start",
  "revision_end", "revision_increment_exact", "last_operation_binding_passed",
  "duplicate_mutation_identities", "duplicate_evidence_ids", "restart_identity_passed",
  "complexity_refactor_retest", "explicit_user_confirmation", "targeted_command_count",
  "targeted_command_identity", "targeted_exit_codes", "forbidden_suite_count",
  "terminal_cursor", "terminal_outcome_status", "current_action_null",
  "unexpected_repository_paths", "attempt_history", "observed_at",
]);
const EXACT_ARTIFACT_LIFECYCLE_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind", "status", "evidence_class", "artifact_filename", "artifact_sha256",
  "artifact_size", "artifact_source_commit", "same_artifact_identity", "package_name",
  "package_version", "core_version", "core_sha256", "platform", "codex_invocation_count",
  "codex_auth_read_count", "codex_thread_count", "closed_package_contents_passed",
  "handshake_passed", "live_apply_schema_passed", "packaged_payload_reference_passed",
  "setup_passed", "task_id", "final_revision", "event_count", "evidence_count",
  "current_cursor", "outcome_status", "current_action_null", "claim_absent",
  "targeted_command_count", "targeted_command_identity", "targeted_exit_codes",
  "comprehension_evidence_class", "remove_passed", "repeated_remove_noop",
  "npm_uninstall_passed", "data_retained", "adjacent_sentinel_retained",
  "repository_unchanged", "exact_artifact_reinstall_passed", "same_task_reopened",
  "read_zero_write", "database_manifest", "final_package_uninstalled", "observed_at",
]);
const COMPOSITE_ACCEPTANCE_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind", "status", "artifact_filename", "artifact_sha256", "artifact_size",
  "artifact_source_commit", "core_sha256", "package_version", "core_version",
  "native_component", "lifecycle_component", "attempt_history", "component_relationship",
  "publication_mutations_performed", "observed_at",
]);
const SMOKE_ROLES = Object.freeze(["ordinary", "invalid", "substantive", "resume"]);
const SMOKE_RESULT_FIELDS = Object.freeze([
  "status", "run_id", "codex_version", "package_version", "core_version",
  "ordinary_core_calls", "invalid_open_task_calls", "task_id_before_restart",
  "task_id_after_restart", "committed_action_count", "terminal_outcome",
  "setup_readback_passed", "remove_readback_passed", "task_data_retained",
  "unexpected_repository_paths", "failure_kind",
]);

const ACCEPTANCE_REPORT_FIELDS = Object.freeze([
  "status",
  "source_commit",
  "artifact_sha256",
  "codex_version",
  "package_version",
  "core_version",
  "setup_readback_passed",
  "ordinary_prompt_core_call_count",
  "explicit_selector",
  "task_id_before_restart",
  "task_id_after_restart",
  "committed_action_count",
  "terminal_outcome",
  "remove_readback_passed",
  "task_data_retained",
  "task_reopened_after_removal",
  "unexpected_repository_paths",
]);

const FINAL_JOURNEY_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind",
  "status",
  "package_name",
  "package_version",
  "registry",
  "npm_tarball_sha256",
  "npm_integrity",
  "package_root_location",
  "core_version",
  "core_sha256",
  "source_commit",
  "codex_version",
  "compatible_codex_range",
  "codex_compatible",
  "setup_readback_passed",
  "ordinary_prompt_core_call_count",
  "explicit_selector",
  "task_id_before_restart",
  "task_revision_before_restart",
  "task_action_id_before_restart",
  "task_id_after_restart",
  "task_revision_after_restart",
  "task_action_id_after_restart",
  "committed_action_count",
  "terminal_outcome",
  "remove_readback_passed",
  "npm_uninstall_passed",
  "task_data_retained",
  "task_reopened_after_uninstall",
  "unexpected_repository_paths",
  "observed_at",
]);

const QUICK_JOURNEY_EVIDENCE_FIELDS = Object.freeze([
  "evidence_kind",
  "status",
  "package_name",
  "package_version",
  "registry",
  "npm_tarball_sha256",
  "npm_integrity",
  "core_version",
  "core_sha256",
  "source_commit",
  "codex_version",
  "compatible_codex_range",
  "setup_readback_passed",
  "handshake_passed",
  "remove_readback_passed",
  "npm_uninstall_passed",
  "repository_unchanged",
  "observed_at",
]);

export function createFinalJourneyLayout(root, workspace, resultDirectory) {
  requireAbsolute(root, "final journey root");
  requireAbsolute(workspace, "workspace");
  requireAbsolute(resultDirectory, "final journey result directory");
  const under = (name) => join(root, name);
  const home = under("home");
  return {
    root,
    home,
    codexHome: under("codex-home"),
    hostBin: under("host-bin"),
    installPrefix: under("npm-prefix"),
    npmCache: under("npm-cache"),
    dataDirectory: join(home, "Library", "Application Support", "dev-flow", "data"),
    temporaryDirectory: under("tmp"),
    registryReadbackDirectory: under("registry-readback"),
    workspace,
    resultDirectory,
  };
}

export function buildFinalJourneyEnvironment({
  layout,
  codexExecutable,
  toolDirectories,
  baseEnvironment = process.env,
}) {
  requireAbsolute(codexExecutable, "Codex executable");
  if (!isPlainObject(layout) || !Array.isArray(toolDirectories) || toolDirectories.length === 0) {
    throw new Error("final journey environment requires one closed layout and tool directory list");
  }
  for (const directory of toolDirectories) requireAbsolute(directory, "final journey tool directory");
  const environment = {};
  for (const name of ["LANG", "LC_ALL", "TERM", "SSL_CERT_FILE"]) {
    if (typeof baseEnvironment?.[name] === "string" && baseEnvironment[name] !== "") {
      environment[name] = baseEnvironment[name];
    }
  }
  Object.assign(environment, {
    HOME: layout.home,
    CODEX_HOME: layout.codexHome,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    npm_config_registry: OFFICIAL_NPM_REGISTRY,
    XDG_CACHE_HOME: join(layout.root, "xdg-cache"),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: [
      join(layout.installPrefix, "bin"),
      layout.hostBin,
      dirname(codexExecutable),
      ...toolDirectories,
    ].filter((value, index, values) => values.indexOf(value) === index).join(delimiter),
  });
  return environment;
}

export function createFinalLocalJourneyLayout(workspace, resultDirectory) {
  requireAbsolute(workspace, "final local workspace");
  requireAbsolute(resultDirectory, "final local result directory");
  const root = dirname(workspace);
  if (basename(workspace) !== "workspace" || dirname(resultDirectory) !== root || basename(resultDirectory) !== "result") {
    throw new Error("final local workspace and result must be sibling workspace/result directories");
  }
  return {
    root,
    home: join(root, "home"),
    codexHome: join(root, "codex-home"),
    installPrefix: join(root, "npm-prefix"),
    npmCache: join(root, "npm-cache"),
    dataDirectory: join(root, "data"),
    temporaryDirectory: join(root, "tmp"),
    xdgCache: join(root, "xdg-cache"),
    workspace,
    resultDirectory,
  };
}

export function buildFinalLocalJourneyEnvironment({ layout, codexExecutable, toolDirectories, baseEnvironment = process.env }) {
  requireAbsolute(codexExecutable, "Codex executable");
  if (!isPlainObject(layout) || !Array.isArray(toolDirectories) || toolDirectories.length === 0) {
    throw new Error("final local environment requires one closed layout and tool directory list");
  }
  const environment = {};
  for (const name of ["LANG", "LC_ALL", "TERM", "SSL_CERT_FILE"]) {
    if (typeof baseEnvironment?.[name] === "string" && baseEnvironment[name] !== "") environment[name] = baseEnvironment[name];
  }
  Object.assign(environment, {
    HOME: layout.home,
    CODEX_HOME: layout.codexHome,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    XDG_CACHE_HOME: layout.xdgCache,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: [join(layout.installPrefix, "bin"), dirname(codexExecutable), ...toolDirectories]
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(delimiter),
  });
  return environment;
}

export function createFinalLocalLifecycleLayout(workspace, resultDirectory) {
  requireAbsolute(workspace, "final local lifecycle workspace");
  requireAbsolute(resultDirectory, "final local lifecycle result directory");
  const root = dirname(workspace);
  if (basename(workspace) !== "workspace" || dirname(resultDirectory) !== root || basename(resultDirectory) !== "result") {
    throw new Error("final local lifecycle workspace and result must be sibling workspace/result directories");
  }
  return {
    root,
    home: join(root, "home"),
    installPrefix: join(root, "npm-prefix"),
    npmCache: join(root, "npm-cache"),
    dataDirectory: join(root, "data"),
    temporaryDirectory: join(root, "tmp"),
    xdgCache: join(root, "xdg-cache"),
    workspace,
    resultDirectory,
  };
}

export function buildFinalLocalLifecycleEnvironment({ layout, toolDirectories, baseEnvironment = process.env }) {
  if (!isPlainObject(layout) || !Array.isArray(toolDirectories) || toolDirectories.length === 0) {
    throw new Error("final local lifecycle environment requires one closed layout and tool directory list");
  }
  const environment = {};
  for (const name of ["LANG", "LC_ALL", "TERM", "SSL_CERT_FILE"]) {
    if (typeof baseEnvironment?.[name] === "string" && baseEnvironment[name] !== "") environment[name] = baseEnvironment[name];
  }
  Object.assign(environment, {
    HOME: layout.home,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    XDG_CACHE_HOME: layout.xdgCache,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: [join(layout.installPrefix, "bin"), ...toolDirectories]
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(delimiter),
  });
  return environment;
}

export function buildFinalRegistryInstallArgs({ version, prefix, cache }) {
  requireReleaseVersion(version);
  requireAbsolute(prefix, "final npm prefix");
  requireAbsolute(cache, "final npm cache");
  return [
    "install", "--global", `dev-flow-codex@${version}`,
    `--registry=${OFFICIAL_NPM_REGISTRY}`,
    "--prefix", prefix,
    "--cache", cache,
    "--ignore-scripts", "--no-audit", "--no-fund",
  ];
}

export function buildFinalRegistryPackArgs({ version, destination }) {
  requireReleaseVersion(version);
  requireAbsolute(destination, "registry read-back directory");
  return [
    "pack", `dev-flow-codex@${version}`,
    "--pack-destination", destination,
    "--ignore-scripts", "--json",
    `--registry=${OFFICIAL_NPM_REGISTRY}`,
  ];
}

export function validateFinalJourneyEvidenceShape(evidence, { allowFixture = false, expected = null } = {}) {
  assertExactFields(evidence, FINAL_JOURNEY_EVIDENCE_FIELDS, "final journey evidence");
  const allowedKind = evidence.evidence_kind === FINAL_NATIVE_EVIDENCE_KIND
    || (allowFixture && evidence.evidence_kind === FINAL_FIXTURE_EVIDENCE_KIND);
  if (!allowedKind) throw new Error("final journey evidence must be native registry-package evidence");
  if (evidence.status !== "passed") throw new Error("final journey evidence status must be passed");
  if (evidence.package_name !== "dev-flow-codex") throw new Error("final journey package_name must equal dev-flow-codex");
  requireReleaseVersion(evidence.package_version);
  if (evidence.registry !== OFFICIAL_NPM_REGISTRY) throw new Error("final journey registry must be the official npm registry");
  requireDigest(evidence.npm_tarball_sha256, "npm_tarball_sha256");
  if (typeof evidence.npm_integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(evidence.npm_integrity)) {
    throw new Error("final journey npm_integrity must be a bounded sha512 integrity");
  }
  if (evidence.package_root_location !== "isolated-npm-prefix") {
    throw new Error("final journey package_root_location must identify the isolated npm prefix");
  }
  requireReleaseVersion(evidence.core_version);
  requireDigest(evidence.core_sha256, "core_sha256");
  if (!/^[0-9a-f]{40}$/u.test(evidence.source_commit)) throw new Error("final journey source_commit is invalid");
  requireReleaseVersion(evidence.codex_version);
  if (evidence.compatible_codex_range !== CODEX_COMPATIBILITY_RANGE || evidence.codex_compatible !== true) {
    throw new Error("final journey Codex compatibility identity is invalid");
  }
  for (const field of [
    "setup_readback_passed", "remove_readback_passed", "npm_uninstall_passed",
    "task_data_retained", "task_reopened_after_uninstall",
  ]) {
    if (evidence[field] !== true) throw new Error(`final journey ${field} must be true`);
  }
  if (evidence.ordinary_prompt_core_call_count !== 0) throw new Error("final journey ordinary prompt must make zero Core calls");
  if (evidence.explicit_selector !== EXPLICIT_SELECTOR) throw new Error("final journey explicit selector is invalid");
  for (const field of ["task_id_before_restart", "task_action_id_before_restart", "task_id_after_restart", "task_action_id_after_restart"]) {
    if (typeof evidence[field] !== "string" || evidence[field].length < 1 || evidence[field].length > 160) {
      throw new Error(`final journey ${field} is invalid`);
    }
  }
  for (const field of ["task_revision_before_restart", "task_revision_after_restart", "committed_action_count"]) {
    if (!Number.isSafeInteger(evidence[field]) || evidence[field] < 1) throw new Error(`final journey ${field} is invalid`);
  }
  if (
    evidence.task_id_after_restart !== evidence.task_id_before_restart
    || evidence.task_revision_after_restart !== evidence.task_revision_before_restart
    || evidence.task_action_id_after_restart !== evidence.task_action_id_before_restart
  ) throw new Error("final journey restart task identity is not exact");
  if (evidence.committed_action_count < 2) throw new Error("final journey requires at least two committed actions");
  if (evidence.terminal_outcome !== "DONE") throw new Error("final journey terminal outcome must be DONE");
  if (!Array.isArray(evidence.unexpected_repository_paths) || evidence.unexpected_repository_paths.length !== 0) {
    throw new Error("final journey unexpected_repository_paths must be empty");
  }
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("final journey observed_at must be an RFC 3339 date-time");
  }
  if (expected !== null) assertFinalEvidenceIdentity(evidence, expected);
  return structuredClone(evidence);
}

export function validateFinalJourneyEvidence(evidence, options = {}) {
  return validateFinalJourneyEvidenceShape(evidence, { ...options, allowFixture: false });
}

export function validateQuickJourneyEvidence(evidence, { expected = null } = {}) {
  assertExactFields(evidence, QUICK_JOURNEY_EVIDENCE_FIELDS, "quick journey evidence");
  if (evidence.evidence_kind !== QUICK_NATIVE_EVIDENCE_KIND || evidence.status !== "passed") {
    throw new Error("quick journey evidence must be passed registry-package smoke evidence");
  }
  if (evidence.package_name !== "dev-flow-codex" || evidence.registry !== OFFICIAL_NPM_REGISTRY) {
    throw new Error("quick journey package or registry identity is invalid");
  }
  requireReleaseVersion(evidence.package_version);
  requireDigest(evidence.npm_tarball_sha256, "npm_tarball_sha256");
  if (typeof evidence.npm_integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(evidence.npm_integrity)) {
    throw new Error("quick journey npm_integrity is invalid");
  }
  requireReleaseVersion(evidence.core_version);
  requireDigest(evidence.core_sha256, "core_sha256");
  if (!/^[0-9a-f]{40}$/u.test(evidence.source_commit)) throw new Error("quick journey source_commit is invalid");
  requireReleaseVersion(evidence.codex_version);
  if (evidence.compatible_codex_range !== CODEX_COMPATIBILITY_RANGE) throw new Error("quick journey Codex range is invalid");
  for (const field of ["setup_readback_passed", "handshake_passed", "remove_readback_passed", "npm_uninstall_passed", "repository_unchanged"]) {
    if (evidence[field] !== true) throw new Error(`quick journey ${field} must be true`);
  }
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("quick journey observed_at must be an RFC 3339 date-time");
  }
  if (expected !== null) assertFinalEvidenceIdentity(evidence, expected);
  return structuredClone(evidence);
}

export function validateFinalLocalJourneyEvidence(evidence, expected = null) {
  assertExactFields(evidence, FINAL_LOCAL_EVIDENCE_FIELDS, "final local journey evidence");
  if (evidence.evidence_kind !== FINAL_LOCAL_NATIVE_EVIDENCE_KIND || evidence.status !== "passed") {
    throw new Error("final local evidence must be passed source-local native evidence");
  }
  if (evidence.package_name !== "dev-flow-codex") {
	throw new Error("final local package identity is invalid");
  }
  requireReleaseVersion(evidence.package_version);
  requireReleaseVersion(evidence.core_version);
  if (evidence.artifact_filename !== `dev-flow-codex-${evidence.package_version}.tgz`) {
    throw new Error("final local artifact filename is invalid");
  }
  requireDigest(evidence.artifact_sha256, "artifact_sha256");
  requireDigest(evidence.core_sha256, "core_sha256");
  if (!Number.isSafeInteger(evidence.artifact_size) || evidence.artifact_size < 1) {
    throw new Error("final local artifact_size is invalid");
  }
  if (!/^[0-9a-f]{40}$/u.test(evidence.artifact_source_commit)) {
    throw new Error("final local artifact source commit is invalid");
  }
  if (evidence.platform !== "darwin-arm64" || !versionSatisfiesFixedRange(evidence.codex_version)) {
    throw new Error("final local native platform or Codex version is invalid");
  }
  if (evidence.compatible_codex_range !== CODEX_COMPATIBILITY_RANGE || evidence.codex_compatible !== true) {
    throw new Error("final local Codex compatibility identity is invalid");
  }
  for (const field of [
    "handshake_passed", "setup_readback_passed", "multiple_destinations_observed",
    "complexity_transition_observed", "refactor_retest_observed",
    "explicit_user_confirmation_observed", "remove_readback_passed", "npm_uninstall_passed",
    "task_data_retained", "task_reopened_after_uninstall",
  ]) {
    if (evidence[field] !== true) throw new Error(`final local ${field} must be true`);
  }
  if (evidence.ordinary_prompt_core_call_count !== 0 || evidence.explicit_selector !== EXPLICIT_SELECTOR) {
    throw new Error("final local ordinary admission or selector identity is invalid");
  }
  for (const field of ["task_id_before_restart", "task_action_id_before_restart", "task_id_after_restart", "task_action_id_after_restart"]) {
    if (typeof evidence[field] !== "string" || evidence[field].length < 1 || evidence[field].length > 160) {
      throw new Error(`final local ${field} is invalid`);
    }
  }
  for (const field of ["task_revision_before_restart", "task_revision_after_restart", "committed_action_count"]) {
    if (!Number.isSafeInteger(evidence[field]) || evidence[field] < 1) throw new Error(`final local ${field} is invalid`);
  }
  if (
    evidence.task_id_after_restart !== evidence.task_id_before_restart
    || evidence.task_revision_after_restart !== evidence.task_revision_before_restart
    || evidence.task_action_id_after_restart !== evidence.task_action_id_before_restart
  ) throw new Error("final local restart identity is not exact");
  if (evidence.committed_action_count < 10 || evidence.targeted_command_count !== 2) {
    throw new Error("final local committed-action or targeted-command count is invalid");
  }
  if (
    evidence.terminal_outcome !== "DONE"
    || evidence.native_journey_attempt_count !== 3
    || evidence.total_native_attempts !== 3
    || evidence.successful_attempt !== 3
    || evidence.attempt_1_status !== "failed"
    || evidence.attempt_1_stage !== "initial-comprehension-first-requirements-apply"
    || evidence.attempt_1_failure !== "invalid-contract-0.2-payload"
    || evidence.attempt_1_evidence_preserved !== true
    || evidence.attempt_2_status !== "failed"
    || evidence.attempt_2_stage !== "design-apply"
    || evidence.attempt_2_failure !== "invalid-contract-0.2-design-baseline"
    || evidence.attempt_2_authorization !== "explicit_user_authorization"
    || evidence.attempt_2_evidence_preserved !== true
    || evidence.attempt_3_status !== "passed"
    || evidence.attempt_3_authorization !== "explicit_user_authorization"
    || evidence.attempt_3_final_allowed_attempt !== true
    || evidence.previous_attempt_preserved !== true
  ) {
    throw new Error("final local terminal outcome or native-attempt count is invalid");
  }
  if (!Array.isArray(evidence.unexpected_repository_paths) || evidence.unexpected_repository_paths.length !== 0) {
    throw new Error("final local unexpected_repository_paths must be empty");
  }
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("final local observed_at must be an RFC 3339 date-time");
  }
  if (expected !== null) {
    for (const [field, value] of [
      ["artifact_filename", basename(expected.artifact)],
      ["artifact_sha256", expected.artifactSHA256],
      ["artifact_size", expected.artifactSize],
      ["artifact_source_commit", expected.sourceCommit],
    ]) {
      if (evidence[field] !== value) throw new Error(`final local evidence ${field} differs from the approved artifact`);
    }
  }
  const serialized = JSON.stringify(evidence);
  if (/(?:\/Users\/|\/home\/|[A-Za-z]:\\\\|auth\.json|CODEX_HOME|HOME=)/u.test(serialized)) {
    throw new Error("final local evidence contains private path or authentication material");
  }
  return structuredClone(evidence);
}

function validateClosedEvidenceFileIdentity(value, expected, label) {
  assertExactFields(value, ["filename", "size", "sha256"], label);
  if (
    value.filename !== expected.filename
    || value.size !== expected.size
    || value.sha256 !== expected.sha256
  ) throw new Error(`${label} identity is invalid`);
}

function assertCompositeEvidenceSanitized(value) {
  const serialized = JSON.stringify(value);
  if (
    /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\|auth\.json|CODEX_HOME|HOME=|"(?:prompt|raw_jsonl|database_path|environment|token|secret|auth)"\s*:)/u.test(serialized)
  ) throw new Error("composite acceptance evidence contains private or raw material");
}

export function validateAttempt3NativeFlowEvidence(evidence, expected = null) {
  assertExactFields(evidence, ATTEMPT_3_NATIVE_EVIDENCE_FIELDS, "Attempt 3 native-flow evidence");
  if (
    evidence.evidence_kind !== "attempt-3-native-codex-graph-flow"
    || evidence.native_flow_status !== "passed"
    || evidence.runner_status !== "failed_after_native_flow"
    || evidence.lifecycle_status !== "not_run"
    || evidence.source_attempt !== 3
  ) throw new Error("Attempt 3 native-flow status is invalid");
  if (
    evidence.artifact_filename !== "dev-flow-codex-0.3.0.tgz"
    || evidence.package_name !== "dev-flow-codex"
    || evidence.package_version !== "0.3.0"
    || evidence.core_version !== "0.3.0"
    || evidence.platform !== "darwin-arm64"
  ) throw new Error("Attempt 3 artifact or product identity is invalid");
  requireDigest(evidence.artifact_sha256, "artifact_sha256");
  requireDigest(evidence.core_sha256, "core_sha256");
  if (!Number.isSafeInteger(evidence.artifact_size) || evidence.artifact_size < 1) {
    throw new Error("Attempt 3 artifact size is invalid");
  }
  if (!/^[0-9a-f]{40}$/u.test(evidence.artifact_source_commit)) {
    throw new Error("Attempt 3 source commit is invalid");
  }
  if (!Array.isArray(evidence.source_transcripts) || evidence.source_transcripts.length !== ATTEMPT_3_TRANSCRIPTS.length) {
    throw new Error("Attempt 3 transcript manifest is incomplete");
  }
  for (let index = 0; index < ATTEMPT_3_TRANSCRIPTS.length; index += 1) {
    validateClosedEvidenceFileIdentity(evidence.source_transcripts[index], ATTEMPT_3_TRANSCRIPTS[index], "Attempt 3 transcript");
  }
  validateClosedEvidenceFileIdentity(evidence.source_artifact_marker, ATTEMPT_3_ARTIFACT_MARKER, "Attempt 3 artifact marker");
  validateClosedEvidenceFileIdentity(evidence.original_failed_marker, ATTEMPT_3_FAILED_MARKER, "Attempt 3 failed marker");
  for (const field of [
    "ordinary_zero_calls", "handshake_passed", "request_binding_passed",
    "revision_increment_exact", "last_operation_binding_passed", "restart_identity_passed",
    "complexity_refactor_retest", "explicit_user_confirmation", "current_action_null",
  ]) {
    if (evidence[field] !== true) throw new Error(`Attempt 3 ${field} must be true`);
  }
  const expectedTransitions = [
    "requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test",
    "tests_passed", "code_too_complex", "refactor_ready_for_test", "tests_passed",
    "comprehension_passed", "delivery_complete",
  ];
  if (
    evidence.distinct_real_codex_threads !== 4
    || evidence.process_identity !== "standard-development"
    || evidence.definition_digest !== FINAL_LOCAL_DEFINITION_DIGEST
    || !isDeepStrictEqual(evidence.method_profiles, ["plain", "spec-kit", "openspec"])
    || !isDeepStrictEqual(evidence.tool_order, DEV_FLOW_TOOLS)
    || !isDeepStrictEqual(evidence.transition_sequence, expectedTransitions)
    || evidence.successful_mutation_count !== 10
    || evidence.revision_start !== 1
    || evidence.revision_end !== 11
    || evidence.duplicate_mutation_identities !== 0
    || evidence.duplicate_evidence_ids !== 0
    || evidence.targeted_command_count !== 2
    || evidence.targeted_command_identity !== FINAL_LOCAL_TEST_COMMAND
    || !isDeepStrictEqual(evidence.targeted_exit_codes, [0, 0])
    || evidence.forbidden_suite_count !== 0
    || evidence.terminal_cursor !== "DONE"
    || evidence.terminal_outcome_status !== "completed"
    || !isDeepStrictEqual(evidence.unexpected_repository_paths, [])
  ) throw new Error("Attempt 3 native graph-flow facts are incomplete");
  assertExactFields(evidence.attempt_history, ["attempt_1", "attempt_2", "attempt_3", "attempt_4"], "Attempt history");
  if (!isDeepStrictEqual(evidence.attempt_history, {
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
  })) throw new Error("Attempt history is invalid");
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("Attempt 3 observed_at is invalid");
  }
  if (expected !== null) {
    for (const [field, value] of [
      ["artifact_filename", basename(expected.artifact)],
      ["artifact_sha256", expected.artifactSHA256],
      ["artifact_size", expected.artifactSize],
      ["artifact_source_commit", expected.sourceCommit],
      ["core_sha256", expected.coreSHA256],
    ]) {
      if (evidence[field] !== value) throw new Error(`Attempt 3 evidence ${field} differs from the approved artifact`);
    }
  }
  assertCompositeEvidenceSanitized(evidence);
  return structuredClone(evidence);
}

export function validateExactArtifactLifecycleEvidence(evidence, expected = null) {
  assertExactFields(evidence, EXACT_ARTIFACT_LIFECYCLE_EVIDENCE_FIELDS, "exact-artifact lifecycle evidence");
  if (
    evidence.evidence_kind !== "exact-artifact-packaged-core-lifecycle"
    || evidence.status !== "passed"
    || evidence.evidence_class !== "deterministic exact-artifact lifecycle evidence"
    || evidence.artifact_filename !== "dev-flow-codex-0.3.0.tgz"
    || evidence.package_name !== "dev-flow-codex"
    || evidence.package_version !== "0.3.0"
    || evidence.core_version !== "0.3.0"
    || evidence.platform !== "darwin-arm64"
    || evidence.same_artifact_identity !== true
  ) throw new Error("exact-artifact lifecycle identity is invalid");
  requireDigest(evidence.artifact_sha256, "artifact_sha256");
  requireDigest(evidence.core_sha256, "core_sha256");
  if (!Number.isSafeInteger(evidence.artifact_size) || evidence.artifact_size < 1 || !/^[0-9a-f]{40}$/u.test(evidence.artifact_source_commit)) {
    throw new Error("exact-artifact lifecycle artifact metadata is invalid");
  }
  if (evidence.codex_invocation_count !== 0 || evidence.codex_auth_read_count !== 0 || evidence.codex_thread_count !== 0) {
    throw new Error("exact-artifact lifecycle must not use Codex");
  }
  for (const field of [
    "closed_package_contents_passed", "handshake_passed", "live_apply_schema_passed",
    "packaged_payload_reference_passed", "setup_passed", "current_action_null", "claim_absent",
    "remove_passed", "repeated_remove_noop", "npm_uninstall_passed", "data_retained",
    "adjacent_sentinel_retained", "repository_unchanged", "exact_artifact_reinstall_passed",
    "same_task_reopened", "read_zero_write", "final_package_uninstalled",
  ]) {
    if (evidence[field] !== true) throw new Error(`exact-artifact lifecycle ${field} must be true`);
  }
  if (
    typeof evidence.task_id !== "string"
    || evidence.task_id.length === 0
    || evidence.task_id.length > 160
    || !Number.isSafeInteger(evidence.final_revision)
    || evidence.final_revision < 2
    || !Number.isSafeInteger(evidence.event_count)
    || evidence.event_count < 1
    || !Number.isSafeInteger(evidence.evidence_count)
    || evidence.evidence_count < 1
    || evidence.current_cursor !== "DONE"
    || evidence.outcome_status !== "completed"
    || evidence.targeted_command_count !== 1
    || evidence.targeted_command_identity !== FINAL_LOCAL_TEST_COMMAND
    || !isDeepStrictEqual(evidence.targeted_exit_codes, [0])
    || evidence.comprehension_evidence_class !== "deterministic_test_fixture"
  ) throw new Error("exact-artifact lifecycle task or verification facts are invalid");
  if (!Array.isArray(evidence.database_manifest) || evidence.database_manifest.length === 0) {
    throw new Error("exact-artifact lifecycle database manifest is empty");
  }
  for (const entry of evidence.database_manifest) {
    assertExactFields(entry, ["path", "size", "sha256"], "lifecycle database manifest entry");
    if (
      typeof entry.path !== "string"
      || entry.path === ""
      || isAbsolute(entry.path)
      || entry.path.split(/[\\/]/u).includes("..")
      || !Number.isSafeInteger(entry.size)
      || entry.size < 1
    ) throw new Error("lifecycle database manifest entry is invalid");
    requireDigest(entry.sha256, "database manifest sha256");
  }
  if (expected !== null) {
    for (const [field, value] of [
      ["artifact_filename", basename(expected.artifact)],
      ["artifact_sha256", expected.artifactSHA256],
      ["artifact_size", expected.artifactSize],
      ["artifact_source_commit", expected.sourceCommit],
      ["core_sha256", expected.coreSHA256],
    ]) {
      if (evidence[field] !== value) throw new Error(`lifecycle evidence ${field} differs from the approved artifact`);
    }
  }
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("lifecycle observed_at is invalid");
  }
  assertCompositeEvidenceSanitized(evidence);
  return structuredClone(evidence);
}

export function validateCompositeAcceptanceEvidence(evidence, nativeEvidence, lifecycleEvidence) {
  assertExactFields(evidence, COMPOSITE_ACCEPTANCE_EVIDENCE_FIELDS, "Feature 008 composite acceptance evidence");
  if (
    evidence.evidence_kind !== "feature-008-composite-source-local-acceptance"
    || evidence.status !== "passed"
    || evidence.publication_mutations_performed !== false
    || evidence.component_relationship !== "complementary_components_bound_to_one_exact_artifact_with_distinct_tasks"
  ) throw new Error("Feature 008 composite acceptance status is invalid");
  for (const field of [
    "artifact_filename", "artifact_sha256", "artifact_size", "artifact_source_commit",
    "core_sha256", "package_version", "core_version",
  ]) {
    if (evidence[field] !== nativeEvidence[field] || evidence[field] !== lifecycleEvidence[field]) {
      throw new Error(`Feature 008 composite ${field} differs between components`);
    }
  }
  assertExactFields(evidence.native_component, [
    "source_attempt", "runner_status", "native_flow_status", "ordinary_zero_calls",
    "four_distinct_threads", "transition_sequence", "task_revision", "terminal_outcome",
    "targeted_command_count", "complexity_refactor_retest", "explicit_user_confirmation",
    "unexpected_repository_paths",
  ], "native composite component");
  assertExactFields(evidence.lifecycle_component, [
    "evidence_class", "same_artifact_identity", "setup_passed", "remove_passed",
    "repeated_remove_noop", "npm_uninstall_passed", "data_retained",
    "exact_artifact_reinstall_passed", "same_task_reopened", "terminal_outcome",
    "read_zero_write", "same_task_as_native_component",
  ], "lifecycle composite component");
  if (!isDeepStrictEqual(evidence.native_component, {
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
  })) throw new Error("native composite component is invalid");
  if (!isDeepStrictEqual(evidence.lifecycle_component, {
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
  })) throw new Error("lifecycle composite component is invalid");
  if (!isDeepStrictEqual(evidence.attempt_history, nativeEvidence.attempt_history)) {
    throw new Error("Feature 008 composite attempt history differs from native evidence");
  }
  if (typeof evidence.observed_at !== "string" || !Number.isFinite(Date.parse(evidence.observed_at))) {
    throw new Error("Feature 008 composite observed_at is invalid");
  }
  assertCompositeEvidenceSanitized(evidence);
  return structuredClone(evidence);
}

export function buildCodexExecArgs(prompt, {
  ephemeral = false,
  ignoreRules = ephemeral,
  skipGitRepoCheck = false,
  workspace = null,
  workspaceWrite = false,
  additionalWritableRoots = [],
} = {}) {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new TypeError("Codex prompt must be nonempty");
  }
  const args = ["exec", "--json"];
  if (ephemeral) args.push("--ephemeral");
  if (ignoreRules) args.push("--ignore-rules");
  if (ephemeral) args.push("--color", "never");
  if (ephemeral || workspaceWrite) args.push("--sandbox", "workspace-write");
  if (skipGitRepoCheck) args.push("--skip-git-repo-check");
  if (workspace !== null) args.push("--cd", workspace);
  if (!Array.isArray(additionalWritableRoots)) throw new TypeError("additionalWritableRoots must be an array");
  for (const root of additionalWritableRoots) {
    requireAbsolute(root, "additional writable root");
    args.push("--add-dir", root);
  }
  args.push(prompt);
  return args;
}

export async function runCodexSession({
  codexExecutable,
  workspace,
  role,
  prompt,
  runProcess = defaultRunProcess,
  includeCallFacts = false,
  environment,
  ephemeral = false,
  ignoreRules = ephemeral,
  skipGitRepoCheck = false,
  workspaceWrite = false,
  stopAfterApplyPath = null,
  stopAfterApplyContent = null,
  retainCoreRejections = false,
  transcriptPath = null,
  additionalWritableRoots = [],
}) {
  requireAbsolute(codexExecutable, "Codex executable");
  requireAbsolute(workspace, "workspace");
  if (retainCoreRejections && (role !== "invalid" || prompt !== invalidPrompt)) {
    throw new Error("Core rejection retention is limited to the bare acceptance session");
  }
  const processOptions = { cwd: workspace };
  if (environment !== undefined) processOptions.env = environment;
  if (stopAfterApplyPath !== null) {
    processOptions.stopAfterApplyPath = stopAfterApplyPath;
    processOptions.stopAfterApplyContent = stopAfterApplyContent;
  }
  const result = await runProcess(codexExecutable, buildCodexExecArgs(prompt, {
    ephemeral,
    ignoreRules,
    skipGitRepoCheck,
    workspaceWrite,
    workspace: ephemeral ? workspace : null,
    additionalWritableRoots,
  }), processOptions);
  if (transcriptPath !== null) {
    requireAbsolute(transcriptPath, "Codex transcript path");
    await writeFile(transcriptPath, result.stdout, { mode: 0o600, flag: "wx" });
  }
  const classified = classifyCodexSessionResult(result);
  if (classified.classification !== "success") {
    if (retainCoreRejections && admissibleCoreRejection(classified, result)) {
      return includeCallFacts
        ? summarizeCodexSession(role, classified.parsed)
        : summarizeSession(role, classified.parsed);
    }
    const error = new Error(sessionFailureMessage(role, classified));
    error.classification = classified.classification;
    error.call = classified.call ?? null;
    error.requestBinding = classified.call?.requestBinding ?? null;
    error.transcriptIntegrity = classified.transcriptIntegrity;
    error.acceptance = classified.acceptance;
    error.role = role;
    error.exitCode = result.exitCode;
    error.eventCount = classified.parsed?.eventCount ?? 0;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return includeCallFacts
    ? summarizeCodexSession(role, classified.parsed)
    : summarizeSession(role, classified.parsed);
}

function admissibleCoreRejection(classified, result) {
  return classified.classification === "core-domain-error"
    && result.exitCode === 0
    && classified.transcriptIntegrity === null
    && classified.parsed !== null
    && classified.parsed.calls.every((call) => (
      call.shape === "success"
      || (
        call.shape === "core_domain_error"
        && call.structuredContent.error.code !== "INTERNAL_ERROR"
      )
    ));
}

export function classifyCodexSessionResult({ exitCode, stdout, stderr }) {
  let parsed = null;
  let parserError = null;
  try {
    parsed = parseCodexJSONL(stdout);
  } catch (error) {
    parserError = error;
  }

  const transcriptIntegrity = parsed?.transcriptIntegrity
    ?? (parserError === null ? null : "malformed");
  if (parsed !== null) {
    const domainError = parsed.calls.find((call) => call.shape === "core_domain_error");
    if (domainError) {
      return {
        classification: "core-domain-error",
        call: domainError,
        parsed,
        transcriptIntegrity,
        acceptance: "failed",
      };
    }
    const transportError = parsed.calls.find((call) => call.shape === "transport_error");
    if (transportError) {
      return {
        classification: "transport-error",
        call: transportError,
        parsed,
        transcriptIntegrity,
        acceptance: "failed",
      };
    }
  }
  if (exitCode !== 0) {
    return {
      classification: "session-error",
      exitCode,
      stderr: typeof stderr === "string" ? stderr : "",
      transcriptIntegrity,
      acceptance: "failed",
    };
  }
  if (parserError !== null || transcriptIntegrity !== null) {
    return {
      classification: "parser-error",
      error: parserError,
      parsed,
      transcriptIntegrity,
      acceptance: "failed",
    };
  }
  return {
    classification: "success",
    parsed,
    transcriptIntegrity: null,
    acceptance: "pass",
  };
}

function sessionFailureMessage(role, classified) {
  switch (classified.classification) {
    case "core-domain-error":
      return `${role} Codex session returned Core domain error ${classified.call.structuredContent.error.code}${
        ["missing", "mismatched"].includes(classified.call.requestBinding)
          ? `; caller request binding is ${classified.call.requestBinding}`
          : ""
      }`;
    case "transport-error":
      return `${role} Codex session returned an MCP transport failure`;
    case "session-error":
      return `${role} Codex session exited with ${classified.exitCode}: ${classified.stderr.trim()}`;
    case "parser-error":
      return `${role} Codex session returned invalid JSONL: transcript is malformed`;
    default:
      throw new TypeError("Codex session failure classification is unsupported");
  }
}

export async function runDevelopmentSmoke(options) {
  const ordinary = await runCodexSession({
    ...options,
    role: "ordinary",
    prompt: ordinaryPrompt,
  });
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary Codex smoke must make zero Dev Flow calls");
  }
  const explicit = await runCodexSession({
    ...options,
    role: "explicit",
    prompt: smokePrompt,
  });
  if (explicit.dev_flow_call_count === 0) {
    throw new Error("explicit Codex smoke must observe at least one Dev Flow call");
  }
  return {
    mode: "smoke",
    host: "codex-0.147",
    sessions: [ordinary, explicit],
    persistent_attempt_state: false,
    status: "pass",
  };
}

export function createDevelopmentSmokeLayout(root) {
  requireAbsolute(root, "development smoke root");
  const under = (name) => join(root, name);
  const home = under("home");
  return {
    root,
    home,
    codexHome: under("codex-home"),
    installPrefix: under("install"),
    dataDirectory: join(home, "Library", "Application Support", "dev-flow", "data"),
    repository: under("repository"),
    invalidWorkspace: under("not-a-repository"),
    artifactDirectory: under("artifacts"),
    diagnosticDirectory: under("diagnostics"),
    temporaryDirectory: under("tmp"),
    npmCache: under("npm-cache"),
  };
}

export function assertDevelopmentAdmissionIsolation(ordinary, invalid) {
  if (ordinary?.dev_flow_call_count !== 0) throw new Error("ordinary session must make zero Dev Flow calls");
  if (invalid?.dev_flow_call_count !== 0 || invalid.tools?.includes("dev_flow_open_task")) {
    throw new Error("invalid session must make zero Dev Flow calls and open zero tasks");
  }
}

export function buildDevelopmentSmokeResult(values) {
  const result = {
    status: values.status,
    run_id: values.runId,
    codex_version: "0.147.0",
    package_version: "0.1.0",
    core_version: "0.1.0",
    ordinary_core_calls: values.ordinaryCoreCalls,
    invalid_open_task_calls: values.invalidOpenTaskCalls,
    task_id_before_restart: values.taskIdBeforeRestart,
    task_id_after_restart: values.taskIdAfterRestart,
    committed_action_count: values.committedActionCount,
    terminal_outcome: values.terminalOutcome,
    setup_readback_passed: values.setupReadbackPassed,
    remove_readback_passed: values.removeReadbackPassed,
    task_data_retained: values.taskDataRetained,
    unexpected_repository_paths: values.unexpectedRepositoryPaths,
    failure_kind: values.failureKind,
  };
  if (!isDeepStrictEqual(Object.keys(result), SMOKE_RESULT_FIELDS)) throw new Error("development smoke result shape drifted");
  return result;
}

export function sanitizeSmokeFailure(value) {
  const digest = (text) => createHash("sha256").update(typeof text === "string" ? text : "").digest("hex");
  return {
    session_role: SMOKE_ROLES.includes(value.role) ? value.role : null,
    event_count: Number.isInteger(value.eventCount) ? value.eventCount : 0,
    mcp_tool: DEV_FLOW_TOOLS.includes(value.mcpTool) ? value.mcpTool : null,
    status: ["completed", "failed"].includes(value.status) ? value.status : null,
    classification: typeof value.classification === "string" ? value.classification : "smoke-error",
    exit_code: Number.isInteger(value.exitCode) ? value.exitCode : null,
    stdout_sha256: digest(value.stdout),
    stderr_sha256: digest(value.stderr),
  };
}

export async function runIsolatedDevelopmentSmoke(options) {
  const runId = randomUUID();
  const state = {
    status: "failed", runId, ordinaryCoreCalls: 0, invalidOpenTaskCalls: 0,
    taskIdBeforeRestart: null, taskIdAfterRestart: null, committedActionCount: 0,
    terminalOutcome: null, setupReadbackPassed: false, removeReadbackPassed: false,
    taskDataRetained: false, unexpectedRepositoryPaths: [], failureKind: null,
  };
  let root = null;
  let currentRole = null;
  try {
    await assertEmptyResultDirectory(options.resultDirectory);
    assertSupportedCodexHost();
    root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-development-smoke-")));
    const layout = createDevelopmentSmokeLayout(root);
    await Promise.all(Object.entries(layout)
      .filter(([name]) => name !== "root")
      .map(([, path]) => mkdir(path, { recursive: true, mode: 0o700 })));
    const environment = await isolatedEnvironment(layout, options.codexExecutable);
    await assertCodexExecutable(options.codexExecutable, environment);

    const build = await execJSON(join(REPOSITORY_ROOT, "scripts", "build-codex-local.sh"),
      ["--output", layout.artifactDirectory], { cwd: REPOSITORY_ROOT });
    assertTemporaryBuild(build, layout.artifactDirectory);
    await execFile("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", layout.installPrefix, build.artifact_path], {
      cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
    });
    const packageRoot = await realpath(join(layout.installPrefix, "node_modules", "dev-flow-codex"));
    const packageCLI = join(layout.installPrefix, "node_modules", ".bin", "dev-flow-codex");
    const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
    const receiptPath = join(layout.home, "Library", "Application Support", "dev-flow", "registrations", "codex.json");

    await initializeSmokeRepository(layout.repository, environment);
    const setup = await execJSON(packageCLI, ["setup", "--json"], { cwd: layout.repository, env: environment });
    if (setup.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
      throw new Error("development smoke setup/readback failed");
    }
    state.setupReadbackPassed = true;
    const adjacentPath = join(dirname(receiptPath), "user-owned-adjacent.txt");
    await writeFile(adjacentPath, "preserve development smoke data\n", { mode: 0o600 });

    currentRole = "ordinary";
    const ordinary = await runCodexSession({
      codexExecutable: options.codexExecutable, workspace: layout.repository, role: currentRole,
      prompt: ordinaryPrompt, includeCallFacts: true, environment, ephemeral: true,
    });
    currentRole = "invalid";
    const invalid = await runCodexSession({
      codexExecutable: options.codexExecutable, workspace: layout.invalidWorkspace, role: currentRole,
      prompt: developmentInvalidPrompt, includeCallFacts: true, environment, ephemeral: true,
      skipGitRepoCheck: true,
    });
    assertDevelopmentAdmissionIsolation(ordinary, invalid);
    state.ordinaryCoreCalls = ordinary.dev_flow_call_count;
    state.invalidOpenTaskCalls = invalid.tools.filter((tool) => tool === "dev_flow_open_task").length;

    currentRole = "substantive";
    const proofPath = join(layout.repository, "native-proof.txt");
    const substantive = await runCodexSession({
      codexExecutable: options.codexExecutable, workspace: layout.repository, role: currentRole,
      prompt: developmentSubstantivePrompt, includeCallFacts: true, environment, ephemeral: true,
      stopAfterApplyPath: proofPath, stopAfterApplyContent: PROOF_CONTENT,
    });
    currentRole = "resume";
    const resume = await runCodexSession({
      codexExecutable: options.codexExecutable, workspace: layout.repository, role: currentRole,
      prompt: developmentResumePrompt, includeCallFacts: true, environment, ephemeral: true,
    });
    validateDevelopmentSessions([ordinary, invalid, substantive, resume], state);
    if ((await readFile(proofPath, "utf8")) !== PROOF_CONTENT) throw new Error("development smoke proof bytes differ");
    state.unexpectedRepositoryPaths = await unexpectedRepositoryPaths(layout.repository, environment);
    if (state.unexpectedRepositoryPaths.length !== 0) throw new Error("development smoke repository contains unexpected paths");
    const statusBeforeRemove = await gitStatus(layout.repository, environment);

    const removed = await execJSON(packageCLI, ["remove", "--json"], { cwd: layout.repository, env: environment });
    if (removed.operation !== "remove" || removed.status !== "removed" || removed.changed !== true) {
      throw new Error("development smoke removal readback failed");
    }
    if (await pathExists(receiptPath)) throw new Error("development smoke receipt remains after removal");
    if ((await readFile(adjacentPath, "utf8")) !== "preserve development smoke data\n") throw new Error("removal changed adjacent user data");
    if (await gitStatus(layout.repository, environment) !== statusBeforeRemove) throw new Error("removal changed the target repository");
    state.removeReadbackPassed = true;

    const retained = await readRetainedTask(runtimePath, layout.dataDirectory, layout.repository, state.taskIdBeforeRestart, environment);
    if (retained.task_id !== state.taskIdBeforeRestart || retained.phase !== "DONE" || retained.outcome?.status !== "completed") {
      throw new Error("packaged Core did not retain the terminal task");
    }
    const database = await stat(join(layout.dataDirectory, "dev-flow.db"));
    if (!database.isFile()) throw new Error("packaged Core task data file is absent");
    state.taskDataRetained = true;
    const repeated = await execJSON(packageCLI, ["remove", "--json"], { cwd: layout.repository, env: environment });
    if (repeated.status !== "already-absent" || repeated.changed !== false) throw new Error("repeated removal is not a safe no-op");

    state.status = "pass";
    currentRole = null;
    const result = buildDevelopmentSmokeResult(state);
    await writeSmokeOutput(options.resultDirectory, "smoke-result.json", result);
    return result;
  } catch (error) {
    state.failureKind = error.classification ?? "smoke-error";
    const result = buildDevelopmentSmokeResult(state);
    const diagnostic = sanitizeSmokeFailure({
      role: error.role ?? currentRole,
      eventCount: error.eventCount,
      mcpTool: error.call?.tool,
      status: error.call?.status,
      classification: state.failureKind,
      exitCode: error.exitCode,
      stdout: error.stdout,
      stderr: error.stderr,
    });
    await writeSmokeOutput(options.resultDirectory, "smoke-result.json", result);
    await writeSmokeOutput(options.resultDirectory, "smoke-diagnostic.json", diagnostic);
    const safe = new Error("development smoke failed; inspect the sanitized external result");
    safe.classification = state.failureKind;
    throw safe;
  } finally {
    if (root !== null) await rm(root, { recursive: true, force: true });
  }
}

export async function runFinalRegistryJourney(options) {
  assertFinalJourneyOptions(options);
  assertSupportedCodexHost("final registry journey");
  const [codexExecutable, workspace, resultDirectory] = await Promise.all([
    realpath(options.codexExecutable),
    assertEmptyFinalDirectory(options.workspace, "final journey workspace"),
    assertEmptyFinalDirectory(options.resultDirectory, "final journey result directory"),
  ]);
  assertFinalJourneyLocations({ codexExecutable, workspace, resultDirectory });

  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-final-registry-")));
  try {
    const layout = createFinalJourneyLayout(root, workspace, resultDirectory);
    await Promise.all([
      layout.home,
      layout.codexHome,
      layout.hostBin,
      layout.installPrefix,
      layout.npmCache,
      layout.dataDirectory,
      layout.temporaryDirectory,
      layout.registryReadbackDirectory,
      join(layout.root, "xdg-cache"),
    ].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
    await symlink(codexExecutable, join(layout.hostBin, "codex"));

    const [npmExecutable, gitExecutable] = await Promise.all([
      findExecutableOnPath("npm"),
      findExecutableOnPath("git"),
    ]);
    const environment = buildFinalJourneyEnvironment({
      layout,
      codexExecutable,
      toolDirectories: [
        dirname(process.execPath),
        dirname(npmExecutable),
        dirname(gitExecutable),
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ],
    });
    await copyFinalCodexAuthentication(layout);
    const codexVersion = await inspectFinalCodexExecutable(codexExecutable, environment);

    const registry = await readFinalRegistryPackage({
      npmExecutable,
      version: options.version,
      layout,
      environment,
    });
    if (registry.tarballSHA256 !== options.tarballSHA256) {
      throw new Error("registry package tarball digest differs from the approved release");
    }

    await installFinalRegistryPackage(npmExecutable, options.version, layout, environment);
    let product = await inspectFinalInstalledProduct({
      npmExecutable,
      version: options.version,
      coreVersion: options.coreVersion,
      layout,
      environment,
      repositoryRoot: REPOSITORY_ROOT,
      resultDirectory,
    });
    if (product.coreSHA256 !== options.coreSHA256) {
      throw new Error("installed bundled Core digest differs from the approved release");
    }

    await initializeSmokeRepository(workspace, environment);
    const setup = await execJSON(product.packageCLI, ["setup", "--json"], { cwd: workspace, env: environment });
    if (setup.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
      throw new Error("final registry journey setup read-back failed");
    }
    const receiptPath = join(layout.home, "Library", "Application Support", "dev-flow", "registrations", "codex.json");
    const adjacentPath = join(dirname(receiptPath), "user-owned-adjacent.txt");
    await writeFile(adjacentPath, "preserve final registry journey data\n", { mode: 0o600 });

    const ordinary = await runCodexSession({
      codexExecutable,
      workspace,
      role: "ordinary",
      prompt: ordinaryPrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
    });
    const invalid = await runCodexSession({
      codexExecutable,
      workspace: layout.temporaryDirectory,
      role: "invalid",
      prompt: developmentInvalidPrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      skipGitRepoCheck: true,
    });
    assertDevelopmentAdmissionIsolation(ordinary, invalid);
    const proofPath = join(workspace, FINAL_PROOF_NAME);
    const substantive = await runCodexSession({
      codexExecutable,
      workspace,
      role: "substantive",
      prompt: finalRegistrySubstantivePrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      stopAfterApplyPath: proofPath,
      stopAfterApplyContent: FINAL_PROOF_CONTENT,
    });
    const resume = await runCodexSession({
      codexExecutable,
      workspace,
      role: "resume",
      prompt: finalRegistryResumePrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
    });
    const sessions = [ordinary, invalid, substantive, resume];
    const state = {
      taskIdBeforeRestart: null,
      taskIdAfterRestart: null,
      committedActionCount: 0,
      terminalOutcome: null,
    };
    validateDevelopmentSessions(sessions, state, {
      coreVersion: options.coreVersion,
      graphContract: true,
      proofCommand: FINAL_PROOF_COMMAND,
      proofRenderedCommand: FINAL_PROOF_RENDERED_COMMAND,
      proofHash: FINAL_PROOF_GIT_HASH,
    });
    if ((await readFile(proofPath, "utf8")) !== FINAL_PROOF_CONTENT) {
      throw new Error("final registry journey proof bytes differ");
    }
    const taskFacts = finalJourneyTaskFacts(sessions);
    const unexpectedPaths = await unexpectedRepositoryPaths(workspace, environment, FINAL_PROOF_NAME);
    if (unexpectedPaths.length !== 0) throw new Error("final registry journey repository contains unexpected paths");
    const statusBeforeRemove = await gitStatus(workspace, environment);

    const removed = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
    if (removed.operation !== "remove" || removed.status !== "removed" || removed.changed !== true) {
      throw new Error("final registry journey removal read-back failed");
    }
    if (await pathExists(receiptPath)) throw new Error("final registry journey receipt remains after removal");
    if ((await readFile(adjacentPath, "utf8")) !== "preserve final registry journey data\n") {
      throw new Error("final registry journey removal changed adjacent data");
    }
    if (await gitStatus(workspace, environment) !== statusBeforeRemove) {
      throw new Error("final registry journey removal changed the repository");
    }

    await uninstallFinalRegistryPackage(npmExecutable, layout, environment);
    if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) {
      throw new Error("final registry journey npm uninstall left product bytes");
    }
    if ((await readFile(adjacentPath, "utf8")) !== "preserve final registry journey data\n") {
      throw new Error("final registry journey npm uninstall changed retained data");
    }

    await installFinalRegistryPackage(npmExecutable, options.version, layout, environment);
    product = await inspectFinalInstalledProduct({
      npmExecutable,
      version: options.version,
      coreVersion: options.coreVersion,
      layout,
      environment,
      repositoryRoot: REPOSITORY_ROOT,
      resultDirectory,
    });
    if (product.coreSHA256 !== options.coreSHA256) {
      throw new Error("reinstalled bundled Core digest differs from the approved release");
    }
    const retained = await readRetainedTask(
      product.runtimePath,
      layout.dataDirectory,
      workspace,
      taskFacts.taskIDBeforeRestart,
      environment,
    );
    if (
      retained.task_id !== taskFacts.taskIDBeforeRestart
      || retained.current_cursor !== "DONE"
      || retained.outcome?.status !== "completed"
    ) throw new Error("final registry journey retained task reopen failed");
    const database = await stat(join(layout.dataDirectory, "dev-flow.db"));
    if (!database.isFile()) throw new Error("final registry journey retained task database is absent");
    await uninstallFinalRegistryPackage(npmExecutable, layout, environment);
    if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) {
      throw new Error("final registry journey cleanup uninstall left product bytes");
    }
    if ((await readFile(adjacentPath, "utf8")) !== "preserve final registry journey data\n") {
      throw new Error("final registry journey retained reopen changed adjacent data");
    }
    if (await gitStatus(workspace, environment) !== statusBeforeRemove) {
      throw new Error("final registry journey retained reopen changed the repository");
    }

    const evidence = validateFinalJourneyEvidence({
      evidence_kind: FINAL_NATIVE_EVIDENCE_KIND,
      status: "passed",
      package_name: options.packageName,
      package_version: options.version,
      registry: options.registry,
      npm_tarball_sha256: registry.tarballSHA256,
      npm_integrity: registry.integrity,
      package_root_location: "isolated-npm-prefix",
      core_version: product.coreVersion,
      core_sha256: product.coreSHA256,
      source_commit: options.sourceCommit,
      codex_version: codexVersion,
      compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
      codex_compatible: true,
      setup_readback_passed: true,
      ordinary_prompt_core_call_count: ordinary.dev_flow_call_count,
      explicit_selector: EXPLICIT_SELECTOR,
      task_id_before_restart: taskFacts.taskIDBeforeRestart,
      task_revision_before_restart: taskFacts.taskRevisionBeforeRestart,
      task_action_id_before_restart: taskFacts.taskActionIDBeforeRestart,
      task_id_after_restart: taskFacts.taskIDAfterRestart,
      task_revision_after_restart: taskFacts.taskRevisionAfterRestart,
      task_action_id_after_restart: taskFacts.taskActionIDAfterRestart,
      committed_action_count: state.committedActionCount,
      terminal_outcome: state.terminalOutcome,
      remove_readback_passed: true,
      npm_uninstall_passed: true,
      task_data_retained: true,
      task_reopened_after_uninstall: true,
      unexpected_repository_paths: unexpectedPaths,
      observed_at: new Date().toISOString(),
    }, { expected: options });
    await writeSmokeOutput(resultDirectory, "final-journey-evidence.json", evidence);
    return evidence;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function runQuickRegistryJourney(options) {
  assertQuickJourneyOptions(options);
  assertSupportedCodexHost("quick registry journey");
  const [codexExecutable, workspace, resultDirectory] = await Promise.all([
    realpath(options.codexExecutable),
    assertEmptyFinalDirectory(options.workspace, "quick journey workspace"),
    assertEmptyFinalDirectory(options.resultDirectory, "quick journey result directory"),
  ]);
  assertFinalJourneyLocations({ codexExecutable, workspace, resultDirectory });

  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-quick-registry-")));
  try {
    const layout = createFinalJourneyLayout(root, workspace, resultDirectory);
    await Promise.all([
      layout.home, layout.codexHome, layout.hostBin, layout.installPrefix, layout.npmCache,
      layout.dataDirectory, layout.temporaryDirectory, layout.registryReadbackDirectory,
      join(layout.root, "xdg-cache"),
    ].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
    await symlink(codexExecutable, join(layout.hostBin, "codex"));

    const [npmExecutable, gitExecutable] = await Promise.all([
      findExecutableOnPath("npm"),
      findExecutableOnPath("git"),
    ]);
    const environment = buildFinalJourneyEnvironment({
      layout,
      codexExecutable,
      toolDirectories: [dirname(process.execPath), dirname(npmExecutable), dirname(gitExecutable), "/usr/bin", "/bin", "/usr/sbin", "/sbin"],
    });
    await copyFinalCodexAuthentication(layout);
    const codexVersion = await inspectFinalCodexExecutable(codexExecutable, environment);
    const registry = await readFinalRegistryPackage({ npmExecutable, version: options.version, layout, environment });
    if (registry.tarballSHA256 !== options.tarballSHA256) throw new Error("quick registry tarball digest differs from the approved release");

    await installFinalRegistryPackage(npmExecutable, options.version, layout, environment);
    const product = await inspectFinalInstalledProduct({
      npmExecutable,
      version: options.version,
      coreVersion: options.coreVersion,
      layout,
      environment,
      repositoryRoot: REPOSITORY_ROOT,
      resultDirectory,
    });
    if (product.coreSHA256 !== options.coreSHA256) throw new Error("quick installed Core digest differs from the approved release");

    await initializeSmokeRepository(workspace, environment);
    const repositoryStatus = await gitStatus(workspace, environment);
    const setup = await execJSON(product.packageCLI, ["setup", "--json"], { cwd: workspace, env: environment });
    if (setup.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
      throw new Error("quick registry setup read-back failed");
    }
    assertFinalLocalServerInfo(await readPackagedServerInfo(product.runtimePath, layout.dataDirectory, workspace, environment), product.coreVersion);
    const removed = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
    if (removed.operation !== "remove" || removed.status !== "removed" || removed.changed !== true) {
      throw new Error("quick registry removal read-back failed");
    }
    if (await gitStatus(workspace, environment) !== repositoryStatus) throw new Error("quick registry lifecycle changed the repository");

    await uninstallFinalRegistryPackage(npmExecutable, layout, environment);
    if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) {
      throw new Error("quick registry uninstall left product bytes");
    }

    const evidence = validateQuickJourneyEvidence({
      evidence_kind: QUICK_NATIVE_EVIDENCE_KIND,
      status: "passed",
      package_name: options.packageName,
      package_version: options.version,
      registry: options.registry,
      npm_tarball_sha256: registry.tarballSHA256,
      npm_integrity: registry.integrity,
      core_version: product.coreVersion,
      core_sha256: product.coreSHA256,
      source_commit: options.sourceCommit,
      codex_version: codexVersion,
      compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
      setup_readback_passed: true,
      handshake_passed: true,
      remove_readback_passed: true,
      npm_uninstall_passed: true,
      repository_unchanged: true,
      observed_at: new Date().toISOString(),
    }, { expected: options });
    await writeSmokeOutput(resultDirectory, "quick-journey-evidence.json", evidence);
    return evidence;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readExactEvidenceFileIdentity(directory, expected) {
  const path = join(directory, expected.filename);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== expected.size) {
    throw new Error(`retained evidence file ${expected.filename} identity is invalid`);
  }
  const identity = { filename: expected.filename, size: info.size, sha256: await digestFile(path) };
  validateClosedEvidenceFileIdentity(identity, expected, "retained Attempt 3 evidence file");
  return identity;
}

async function assertFinalLocalFixtureRepository(workspace, environment) {
  const [status, branch, head, files, packageText, testText, sourceText] = await Promise.all([
    gitStatus(workspace, environment),
    execFile("git", ["branch", "--show-current"], { cwd: workspace, env: environment, encoding: "utf8" }),
    execFile("git", ["rev-parse", "HEAD"], { cwd: workspace, env: environment, encoding: "utf8" }),
    finalLocalRepositoryFiles(workspace),
    readFile(join(workspace, "package.json"), "utf8"),
    readFile(join(workspace, "test", "proof-writer.test.mjs"), "utf8"),
    readFile(join(workspace, "src", "proof-writer.mjs"), "utf8"),
  ]);
  const expectedPackage = `${JSON.stringify({ name: "feature-008-native-fixture", private: true, type: "module" }, null, 2)}\n`;
  const expectedTest = `import assert from "node:assert/strict";\nimport { mkdtemp, readFile, rm } from "node:fs/promises";\nimport { tmpdir } from "node:os";\nimport { join } from "node:path";\nimport test from "node:test";\n\nimport { writeProof } from "../src/proof-writer.mjs";\n\ntest("writeProof emits the exact Feature 008 native bytes", async (t) => {\n  const root = await mkdtemp(join(tmpdir(), "feature-008-proof-"));\n  t.after(() => rm(root, { recursive: true, force: true }));\n  const output = join(root, "proof.txt");\n  await writeProof(output);\n  assert.equal(await readFile(output, "utf8"), ${JSON.stringify(FINAL_LOCAL_PROOF_CONTENT)});\n});\n`;
  if (
    status !== " M src/proof-writer.mjs\n"
    || branch.stdout.trim() !== "main"
    || !/^[0-9a-f]{40}$/u.test(head.stdout.trim())
    || !isDeepStrictEqual(files, ["package.json", "src/proof-writer.mjs", "test/proof-writer.test.mjs"])
    || packageText !== expectedPackage
    || testText !== expectedTest
    || /ProofWriterFactory|class\s+ProofWriter/u.test(sourceText)
    || !/export async function writeProof/u.test(sourceText)
    || !sourceText.includes(FINAL_LOCAL_PROOF_CONTENT.trim())
  ) throw new Error("final local fixture repository state is invalid");
  return [];
}

export async function validateRetainedAttempt3NativeFlow(options) {
  assertExactFields(options, [
    "artifact", "artifactSHA256", "artifactSize", "sourceCommit", "coreSHA256",
    "nativeResultDirectory",
  ], "retained Attempt 3 validation options");
  requireAbsolute(options.artifact, "Attempt 3 artifact");
  requireDigest(options.artifactSHA256, "artifact-sha256");
  requireDigest(options.coreSHA256, "core-sha256");
  if (!Number.isSafeInteger(options.artifactSize) || options.artifactSize < 1) throw new Error("Attempt 3 artifact size is invalid");
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error("Attempt 3 source commit is invalid");
  requireAbsolute(options.nativeResultDirectory, "Attempt 3 result directory");

  const nativeResultDirectory = await realpath(options.nativeResultDirectory);
  const nativeWorkspace = await realpath(join(dirname(nativeResultDirectory), "workspace"));
  if (basename(nativeResultDirectory) !== "result" || pathWithin(REPOSITORY_ROOT, nativeResultDirectory) || pathWithin(REPOSITORY_ROOT, nativeWorkspace)) {
    throw new Error("Attempt 3 retained directories are invalid");
  }
  const transcriptIdentities = [];
  const sessions = [];
  for (const source of ATTEMPT_3_TRANSCRIPTS) {
    transcriptIdentities.push(await readExactEvidenceFileIdentity(nativeResultDirectory, source));
    const parsed = parseCodexJSONL(await readFile(join(nativeResultDirectory, source.filename), "utf8"));
    if (parsed.transcriptIntegrity !== null) throw new Error(`Attempt 3 ${source.filename} is incomplete`);
    sessions.push(summarizeCodexSession(source.role, parsed));
  }
  const sourceArtifactMarker = await readExactEvidenceFileIdentity(nativeResultDirectory, ATTEMPT_3_ARTIFACT_MARKER);
  const failedMarkerBefore = await readExactEvidenceFileIdentity(nativeResultDirectory, ATTEMPT_3_FAILED_MARKER);
  const started = JSON.parse(await readFile(join(nativeResultDirectory, ATTEMPT_3_ARTIFACT_MARKER.filename), "utf8"));
  const failed = JSON.parse(await readFile(join(nativeResultDirectory, ATTEMPT_3_FAILED_MARKER.filename), "utf8"));
  if (
    started.status !== "started"
    || started.native_journey_attempt_count !== 3
    || started.authorization !== "explicit_user_authorization"
    || started.final_allowed_attempt !== true
    || started.attempt_1_status !== "failed"
    || started.attempt_2_status !== "failed"
    || started.previous_attempt_preserved !== true
    || started.artifact_filename !== basename(options.artifact)
    || started.artifact_sha256 !== options.artifactSHA256
    || started.artifact_source_commit !== options.sourceCommit
  ) throw new Error("Attempt 3 start marker is invalid");
  if (
    failed.status !== "failed"
    || failed.attempt_3_stage !== "post-session-verification-classification"
    || failed.attempt_3_failure !== "verification-command-classifier-false-positive"
    || failed.broad_classifier_count !== 3
    || failed.exact_targeted_command_count !== 2
    || failed.successful_mutation_count !== 10
    || failed.final_revision !== 11
    || failed.final_cursor !== "DONE"
    || failed.final_outcome !== "completed"
    || failed.final_action_is_null !== true
    || failed.lifecycle_remove_started !== false
    || failed.npm_uninstall_started !== false
    || failed.retained_reopen_started !== false
    || failed.attempt_4_allowed !== false
    || failed.attempt_4_started !== false
  ) throw new Error("Attempt 3 failure marker does not preserve the real runner boundary");

  if (new Set(sessions.map((session) => session.thread_id)).size !== 4 || sessions[0].dev_flow_call_count !== 0) {
    throw new Error("Attempt 3 session identity or ordinary-call boundary is invalid");
  }
  for (const session of sessions.slice(1)) assertFinalLocalHandshake(session, "0.3.0");
  const taskBeforeRestart = lastGraphTask(sessions[1]);
  assertInitialComprehensionTask(taskBeforeRestart);
  assertFinalLocalResume(sessions[2], taskBeforeRestart);
  assertFinalLocalSessionTwo(sessions[2]);
  const taskAfterRefactor = lastGraphTask(sessions[2]);
  assertInitialComprehensionTask(taskAfterRefactor);
  assertFinalLocalResume(sessions[3], taskAfterRefactor);
  assertFinalLocalSessionThree(sessions[3]);
  const finalTask = lastGraphTask(sessions[3]);
  if (finalTask?.current_cursor !== "DONE" || finalTask.current_action !== null || finalTask.outcome?.status !== "completed") {
    throw new Error("Attempt 3 retained sessions do not reach Core DONE");
  }
  const transitionFacts = assertFinalLocalTransitions(sessions, finalTask);
  assertFinalLocalCommands(sessions);
  const requestIDs = [];
  const actionIDs = [];
  let requestBindingPassed = true;
  let lastOperationBindingPassed = true;
  for (let index = 0; index < transitionFacts.length; index += 1) {
    const fact = transitionFacts[index];
    const requestID = fact.call.arguments?.request_id;
    const actionID = fact.call.arguments?.action_id;
    requestIDs.push(requestID);
    actionIDs.push(actionID);
    if (fact.call.request_id !== requestID || fact.call.arguments?.revision !== index + 1 || fact.task?.revision !== index + 2) {
      requestBindingPassed = false;
    }
    const operation = fact.task?.last_operation;
    if (
      operation?.operation_id !== requestID
      || operation?.action_id !== actionID
      || operation?.from_revision !== index + 1
      || operation?.to_revision !== index + 2
    ) lastOperationBindingPassed = false;
  }
  const duplicateMutationIdentities = requestIDs.length - new Set(requestIDs).size
    + actionIDs.length - new Set(actionIDs).size;
  const evidenceIDs = (finalTask.evidence ?? []).map((item) => item.evidence_id);
  const duplicateEvidenceIDs = evidenceIDs.length - new Set(evidenceIDs).size;
  const commands = sessions.flatMap((session) => session.commands.map((command) => ({ role: session.role, ...command })));
  const targeted = commands.filter((command) => classifyFinalLocalVerificationCommand(command.command) === "authorized");
  const forbidden = commands.filter((command) => classifyFinalLocalVerificationCommand(command.command) === "forbidden");
  const unexpectedRepositoryPaths = await assertFinalLocalFixtureRepository(nativeWorkspace, process.env);
  const info = sessions[1].dev_flow_calls[0].core_result.result;

  const evidence = validateAttempt3NativeFlowEvidence({
    evidence_kind: "attempt-3-native-codex-graph-flow",
    native_flow_status: "passed",
    runner_status: "failed_after_native_flow",
    lifecycle_status: "not_run",
    source_attempt: 3,
    artifact_filename: basename(options.artifact),
    artifact_sha256: options.artifactSHA256,
    artifact_size: options.artifactSize,
    artifact_source_commit: options.sourceCommit,
    package_name: "dev-flow-codex",
    package_version: "0.3.0",
    core_version: info.version,
    core_sha256: options.coreSHA256,
    platform: "darwin-arm64",
    source_transcripts: transcriptIdentities,
    source_artifact_marker: sourceArtifactMarker,
    original_failed_marker: failedMarkerBefore,
    ordinary_zero_calls: true,
    distinct_real_codex_threads: 4,
    handshake_passed: true,
    process_identity: info.supported_processes[0].process_id,
    definition_digest: info.supported_processes[0].definition_digest,
    method_profiles: info.method_profiles,
    tool_order: info.tools,
    transition_sequence: transitionFacts.map((fact) => fact.transition_id),
    successful_mutation_count: transitionFacts.length,
    request_binding_passed: requestBindingPassed,
    revision_start: transitionFacts[0].call.arguments.revision,
    revision_end: finalTask.revision,
    revision_increment_exact: true,
    last_operation_binding_passed: lastOperationBindingPassed,
    duplicate_mutation_identities: duplicateMutationIdentities,
    duplicate_evidence_ids: duplicateEvidenceIDs,
    restart_identity_passed: true,
    complexity_refactor_retest: true,
    explicit_user_confirmation: true,
    targeted_command_count: targeted.length,
    targeted_command_identity: FINAL_LOCAL_TEST_COMMAND,
    targeted_exit_codes: targeted.map((command) => command.exitCode),
    forbidden_suite_count: forbidden.length,
    terminal_cursor: finalTask.current_cursor,
    terminal_outcome_status: finalTask.outcome.status,
    current_action_null: finalTask.current_action === null,
    unexpected_repository_paths: unexpectedRepositoryPaths,
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
    observed_at: new Date().toISOString(),
  }, options);
  const failedMarkerAfter = await readExactEvidenceFileIdentity(nativeResultDirectory, ATTEMPT_3_FAILED_MARKER);
  if (!isDeepStrictEqual(failedMarkerAfter, failedMarkerBefore)) throw new Error("Attempt 3 failed marker changed during offline validation");
  return evidence;
}

function assertFinalLocalLifecycleOptions(options) {
  assertExactFields(options, [
    "mode", "artifact", "artifactSHA256", "artifactSize", "sourceCommit", "coreSHA256",
    "nativeResultDirectory", "workspace", "resultDirectory",
  ], "final local lifecycle options");
  if (options.mode !== "final-local-lifecycle") throw new Error("final local lifecycle mode is invalid");
  requireAbsolute(options.artifact, "lifecycle artifact");
  requireDigest(options.artifactSHA256, "artifact-sha256");
  requireDigest(options.coreSHA256, "core-sha256");
  if (!Number.isSafeInteger(options.artifactSize) || options.artifactSize < 1) throw new Error("lifecycle artifact size is invalid");
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error("lifecycle source commit is invalid");
  requireAbsolute(options.nativeResultDirectory, "Attempt 3 result directory");
  requireAbsolute(options.workspace, "lifecycle workspace");
  requireAbsolute(options.resultDirectory, "lifecycle result directory");
}

function extractPackagedNodePayloadTemplates(text) {
  const names = [
    "requirements", "design", "tasks", "implement", "test", "comprehension-complexity",
    "comprehension-passed", "refactor", "delivery", "blocked",
  ];
  const templates = new Map();
  for (const name of names) {
    const startMarker = `<!-- node-payload-template:${name}:start -->`;
    const endMarker = `<!-- node-payload-template:${name}:end -->`;
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker);
    if (start < 0 || end <= start) throw new Error(`packaged node payload template ${name} is missing`);
    const section = text.slice(start + startMarker.length, end);
    const match = /```json\s*([\s\S]*?)\s*```/u.exec(section);
    if (match === null) throw new Error(`packaged node payload template ${name} has no JSON body`);
    const payload = JSON.parse(match[1]);
    assertExactFields(
      payload,
      name === "blocked"
        ? ["blocker_id", "condition", "observed_binding_digest"]
        : ["transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"],
      `packaged ${name} payload template`,
    );
    templates.set(name, payload);
  }
  return templates;
}

function completeLifecycleMethodEvidence(payload) {
  payload.method_evidence = payload.method_evidence.map((item) => ({
    step_id: item.step_id,
    status: "plain_fallback",
    capability: "",
    summary: `Completed ${item.step_id} for deterministic lifecycle acceptance.`,
  }));
  return payload;
}

function assertLifecyclePayloadClosed(payload, action) {
  assertExactFields(payload, ["transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result"], "lifecycle apply payload");
  if (JSON.stringify(payload).includes("placeholder-")) throw new Error("lifecycle payload retains a template placeholder");
  if (!action.available_transitions.some((transition) => transition.transition_id === payload.transition_id)) {
    throw new Error("lifecycle payload selects a transition outside the current Action");
  }
  if (!isDeepStrictEqual(payload.method_evidence.map((item) => item.step_id), action.method_steps.map((step) => step.step_id))) {
    throw new Error("lifecycle payload method evidence differs from the current Action");
  }
}

function buildLifecyclePayload(name, templates, task) {
  const payload = completeLifecycleMethodEvidence(structuredClone(templates.get(name)));
  payload.artifacts = [];
  if (name === "requirements") {
    payload.summary = "Defined the deterministic exact-artifact lifecycle requirement.";
    Object.assign(payload.node_result.baseline, {
      goal: "Prove exact-artifact packaged Core lifecycle retention.",
      scope: ["packaged Core task lifecycle"],
      out_of_scope: ["native Codex model behavior"],
      acceptance_criteria: ["The same terminal Task reopens unchanged after remove, uninstall, and exact-artifact reinstall."],
      constraints: ["Use one exact source-local artifact and no Codex execution."],
      assumptions: [],
    });
  } else if (name === "design") {
    payload.summary = "Selected one direct packaged-Core lifecycle fixture.";
    Object.assign(payload.node_result.baseline, {
      requirements_revision: task.baselines.requirements.revision,
      approach: "Drive the primary graph path directly through the packaged six-tool MCP contract.",
      components: ["packaged Core", "Schema 2 data", "isolated package lifecycle"],
      decisions: ["Use one real Task from creation through retained terminal reopen."],
      rejected_alternatives: ["Copied fixture database"],
      complexity_justification: [],
      risks: [],
    });
  } else if (name === "tasks") {
    payload.summary = "Decomposed the deterministic lifecycle into one bounded work item.";
    Object.assign(payload.node_result.baseline, {
      design_revision: task.baselines.design.revision,
      work_items: [{
        work_item_id: "implement-lifecycle-proof",
        summary: "Implement the direct lifecycle proof writer.",
        expected_paths: ["src/proof-writer.mjs"],
        acceptance_indexes: [0],
        verification_steps: ["Run node --test test/proof-writer.test.mjs."],
        dependencies: [],
      }],
    });
  } else if (name === "implement") {
    payload.summary = "Implemented the direct lifecycle proof writer.";
    Object.assign(payload.node_result, {
      task_plan_revision: task.baselines.task_plan.revision,
      completed_work_item_ids: ["implement-lifecycle-proof"],
      changed_paths: ["src/proof-writer.mjs"],
      no_file_changes: false,
      deviations: [],
      findings: [],
    });
  } else if (name === "test") {
    payload.summary = "The bounded lifecycle proof test passed.";
    Object.assign(payload.node_result, {
      checks: [{
        source: "automated",
        name: "deterministic_exact_artifact_targeted_test",
        status: "passed",
        summary: "The packaged lifecycle proof writer emitted the exact bytes.",
        command_count: 1,
        full_suite: false,
      }],
      failed_items: [],
      unverified_items: [],
      manual_handoff_items: [],
      findings: [],
    });
  } else if (name === "comprehension-passed") {
    payload.summary = "The deterministic fixture records an explicit comprehension pass.";
    Object.assign(payload.node_result, {
      explained_components: ["packaged MCP call", "Schema 2 Task", "package data retention"],
      unresolved_questions: [],
      unnecessary_abstractions: [],
      maintenance_risks: [],
      user_confirmation: {
        source: "user",
        status: "passed",
        summary: "evidence_class=deterministic_test_fixture; the lifecycle fixture confirms the direct path is understandable.",
      },
      findings: [],
    });
  } else if (name === "delivery") {
    const evidenceByID = new Map(task.evidence.map((item) => [item.evidence_id, item]));
    const automatedEvidence = task.test.evidence_ids.filter((id) => evidenceByID.get(id)?.source === "automated");
    const userTestEvidence = task.test.evidence_ids.filter((id) => evidenceByID.get(id)?.source === "user");
    payload.summary = "Reconciled deterministic lifecycle acceptance and current evidence.";
    Object.assign(payload.node_result, {
      acceptance: task.baselines.requirements.acceptance_criteria.map((criterion) => ({ criterion, status: "satisfied" })),
      automated_evidence_ids: automatedEvidence,
      manual_evidence_ids: [...userTestEvidence, task.comprehension.user_evidence_id],
      test_record_id: task.test.record_id,
      comprehension_record_id: task.comprehension.record_id,
      unverified_items: [],
      risks: [],
      findings: [],
    });
  } else {
    throw new Error(`unsupported deterministic lifecycle payload ${name}`);
  }
  return payload;
}

async function applyLifecyclePayload(product, layout, environment, task, payload, facts) {
  const action = task.current_action;
  if (!isPlainObject(action)) throw new Error("lifecycle Task has no current Action");
  assertLifecyclePayloadClosed(payload, action);
  const requestID = `lifecycle-${randomUUID()}`;
  const request = {
    request_id: requestID,
    host: "codex",
    task_id: task.task_id,
    revision: task.revision,
    action_id: action.action_id,
    action_kind: action.action_kind,
    process_id: task.process_id,
    process_definition_digest: task.process_definition_digest,
    source_cursor: task.current_cursor,
    repository_binding_digest: action.repository_binding_digest,
    payload,
  };
  const envelope = await callPackagedCoreTool(
    product.runtimePath,
    layout.dataDirectory,
    layout.workspace,
    "dev_flow_apply_action",
    request,
    environment,
  );
  const nextTask = isPlainObject(envelope?.result?.task) ? envelope.result.task : envelope?.result;
  if (envelope?.ok !== true) {
    throw new Error(`lifecycle packaged-Core mutation returned ${envelope?.error?.code ?? "an invalid result"}`);
  }
  const identityChecks = {
    envelope_request: envelope.request_id === requestID,
    task_projection: isPlainObject(nextTask),
    task_identity: nextTask?.task_id === task.task_id,
    revision: nextTask?.revision === task.revision + 1,
    operation_identity: nextTask?.last_operation?.operation_id === requestID,
    operation_action: nextTask?.last_operation?.action_id === action.action_id,
  };
  const failedChecks = Object.entries(identityChecks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedChecks.length !== 0) {
    throw new Error(`lifecycle packaged-Core mutation identity is invalid: ${failedChecks.join(",")}`);
  }
  facts.push({
    transition_id: payload.transition_id,
    from_revision: task.revision,
    to_revision: nextTask.revision,
  });
  return nextTask;
}

function validateLifecycleToolCatalog(tools) {
  const names = tools.map((tool) => tool.name);
  if (
    new Set(names).size !== DEV_FLOW_TOOLS.length
    || !isDeepStrictEqual([...names].sort(), [...DEV_FLOW_TOOLS].sort())
  ) {
    throw new Error("lifecycle packaged Core tool catalog is invalid");
  }
  const apply = tools.find((tool) => tool.name === "dev_flow_apply_action");
  const schemaText = JSON.stringify(apply?.inputSchema);
  if (
    apply?.inputSchema?.type !== "object"
    || apply.inputSchema.additionalProperties !== false
    || !schemaText.includes("COMPLETE_REQUIREMENTS")
    || !schemaText.includes("COMPLETE_DELIVERY")
    || !schemaText.includes("transition_id")
    || !schemaText.includes("node_result")
  ) throw new Error("lifecycle live apply input schema is incomplete");
}

function lifecycleCoreManifest(coreRows) {
  if (coreRows.tasks.length !== 1) throw new Error("lifecycle database must contain one Task");
  const task = coreRows.tasks[0];
  return {
    task_id: task.task_id,
    revision: task.revision,
    current_cursor: task.current_node,
    outcome_status: task.snapshot?.outcome?.status ?? null,
    current_action_null: task.snapshot?.current_action === null,
    event_count: coreRows.task_events.length,
    evidence_count: task.snapshot?.evidence?.length ?? 0,
    claim_count: coreRows.repository_claims.length,
  };
}

function buildCompositeAcceptanceEvidence(nativeEvidence, lifecycleEvidence) {
  return validateCompositeAcceptanceEvidence({
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
      runner_status: nativeEvidence.runner_status,
      native_flow_status: nativeEvidence.native_flow_status,
      ordinary_zero_calls: nativeEvidence.ordinary_zero_calls,
      four_distinct_threads: nativeEvidence.distinct_real_codex_threads === 4,
      transition_sequence: nativeEvidence.transition_sequence,
      task_revision: nativeEvidence.revision_end,
      terminal_outcome: nativeEvidence.terminal_cursor,
      targeted_command_count: nativeEvidence.targeted_command_count,
      complexity_refactor_retest: nativeEvidence.complexity_refactor_retest,
      explicit_user_confirmation: nativeEvidence.explicit_user_confirmation,
      unexpected_repository_paths: nativeEvidence.unexpected_repository_paths,
    },
    lifecycle_component: {
      evidence_class: "deterministic_exact_artifact",
      same_artifact_identity: lifecycleEvidence.same_artifact_identity,
      setup_passed: lifecycleEvidence.setup_passed,
      remove_passed: lifecycleEvidence.remove_passed,
      repeated_remove_noop: lifecycleEvidence.repeated_remove_noop,
      npm_uninstall_passed: lifecycleEvidence.npm_uninstall_passed,
      data_retained: lifecycleEvidence.data_retained,
      exact_artifact_reinstall_passed: lifecycleEvidence.exact_artifact_reinstall_passed,
      same_task_reopened: lifecycleEvidence.same_task_reopened,
      terminal_outcome: lifecycleEvidence.current_cursor,
      read_zero_write: lifecycleEvidence.read_zero_write,
      same_task_as_native_component: false,
    },
    attempt_history: nativeEvidence.attempt_history,
    component_relationship: "complementary_components_bound_to_one_exact_artifact_with_distinct_tasks",
    publication_mutations_performed: false,
    observed_at: new Date().toISOString(),
  }, nativeEvidence, lifecycleEvidence);
}

export async function runFinalLocalLifecycle(options) {
  assertFinalLocalLifecycleOptions(options);
  const artifact = await realpath(options.artifact);
  const workspace = await assertEmptyFinalDirectory(options.workspace, "final local lifecycle workspace");
  const resultDirectory = await assertEmptyFinalDirectory(options.resultDirectory, "final local lifecycle result directory");
  const layout = createFinalLocalLifecycleLayout(workspace, resultDirectory);
  if (
    pathWithin(REPOSITORY_ROOT, artifact)
    || pathWithin(REPOSITORY_ROOT, layout.root)
    || pathWithin(layout.root, artifact)
    || pathWithin(dirname(options.nativeResultDirectory), layout.root)
    || pathWithin(layout.root, dirname(options.nativeResultDirectory))
  ) throw new Error("final local lifecycle paths are not isolated");

  await execFile("git", [
    "diff", "--exit-code", `${options.sourceCommit}..HEAD`, "--",
    "internal", "cmd", "packages/codex/bin", "packages/codex/lib", "packages/codex/plugin",
    "packages/codex/package.json", "scripts/build-codex-local.sh",
  ], { cwd: REPOSITORY_ROOT, encoding: "utf8" });
  const nativeEvidence = await validateRetainedAttempt3NativeFlow({
    artifact,
    artifactSHA256: options.artifactSHA256,
    artifactSize: options.artifactSize,
    sourceCommit: options.sourceCommit,
    coreSHA256: options.coreSHA256,
    nativeResultDirectory: options.nativeResultDirectory,
  });

  await Promise.all([
    layout.home,
    layout.installPrefix,
    layout.npmCache,
    layout.dataDirectory,
    layout.temporaryDirectory,
    layout.xdgCache,
  ].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  for (const path of [layout.root, layout.home, layout.installPrefix, layout.npmCache, layout.dataDirectory, layout.temporaryDirectory, layout.xdgCache, workspace, resultDirectory]) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("lifecycle layout requires real directories");
  }

  const [npmExecutable, gitExecutable, nodeExecutable] = await Promise.all([
    findExecutableOnPath("npm"),
    findExecutableOnPath("git"),
    findExecutableOnPath("node"),
  ]);
  const environment = buildFinalLocalLifecycleEnvironment({
    layout,
    toolDirectories: [dirname(nodeExecutable), dirname(npmExecutable), dirname(gitExecutable), "/usr/bin", "/bin", "/usr/sbin", "/sbin"],
  });
  const artifactInfo = await inspectFinalLocalArtifact(artifact, options);
  await installFinalLocalPackage(npmExecutable, artifact, layout, environment);
  let product = await inspectFinalLocalInstalledProduct({ npmExecutable, layout, environment, repositoryRoot: REPOSITORY_ROOT, resultDirectory });
  artifactInfo.coreSHA256 = product.coreSHA256;
  if (product.coreSHA256 !== options.coreSHA256) throw new Error("lifecycle packaged Core digest differs from the approved artifact");
  const handshake = await readPackagedServerInfo(product.runtimePath, layout.dataDirectory, workspace, environment);
  assertFinalLocalServerInfo(handshake, product.coreVersion);
  const tools = await listPackagedCoreTools(product.runtimePath, layout.dataDirectory, workspace, environment);
  validateLifecycleToolCatalog(tools);
  const payloadReference = await readFile(join(product.packageRoot, "plugin", "skills", "dev-flow", "references", "node-payloads.md"), "utf8");
  const templates = extractPackagedNodePayloadTemplates(payloadReference);

  await initializeFinalLocalRepository(workspace, environment);
  const setup = await execJSON(product.packageCLI, ["setup", "--json"], { cwd: workspace, env: environment });
  if (setup.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
    throw new Error("lifecycle setup readback failed");
  }
  const receiptPath = join(layout.home, "Library", "Application Support", "dev-flow", "registrations", "codex.json");
  if (!(await pathExists(receiptPath))) throw new Error("lifecycle setup registration is absent");
  const adjacentPath = join(dirname(receiptPath), "user-owned-adjacent.txt");
  const adjacentContent = "preserve deterministic exact-artifact lifecycle data\n";
  await writeFile(adjacentPath, adjacentContent, { mode: 0o600, flag: "wx" });

  const opened = await callPackagedCoreTool(product.runtimePath, layout.dataDirectory, workspace, "dev_flow_open_task", {
    host: "codex",
    repository_path: workspace,
    new_task: {
      request: "Prove exact-artifact packaged Core lifecycle retention.",
      initial_scope: ["packaged Core task lifecycle"],
      initial_out_of_scope: ["native Codex model behavior"],
      known_acceptance_criteria: [],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 1,
        allow_full_suite: false,
        allow_manual_handoff: false,
      },
      method_profile: "plain",
    },
  }, environment);
  let task = opened?.result?.task;
  if (opened?.ok !== true || opened.result?.created !== true || task?.current_cursor !== "REQUIREMENTS" || task.revision !== 1) {
    throw new Error("lifecycle packaged Core did not create a fresh graph Task");
  }
  const facts = [];
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("requirements", templates, task), facts);
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("design", templates, task), facts);
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("tasks", templates, task), facts);
  await writeFile(join(workspace, "src", "proof-writer.mjs"), `import { writeFile } from "node:fs/promises";\n\nexport async function writeProof(path) {\n  await writeFile(path, ${JSON.stringify(FINAL_LOCAL_PROOF_CONTENT)});\n}\n`);
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("implement", templates, task), facts);
  await execFile(nodeExecutable, ["--test", "test/proof-writer.test.mjs"], { cwd: workspace, env: environment, encoding: "utf8" });
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("test", templates, task), facts);
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("comprehension-passed", templates, task), facts);
  task = await applyLifecyclePayload(product, layout, environment, task, buildLifecyclePayload("delivery", templates, task), facts);
  if (
    task.current_cursor !== "DONE"
    || task.outcome?.status !== "completed"
    || task.current_action !== null
    || facts.length !== 7
    || !isDeepStrictEqual(facts.map((fact) => fact.transition_id), [
      "requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test",
      "tests_passed", "comprehension_passed", "delivery_complete",
    ])
  ) throw new Error("lifecycle packaged Core primary path did not reach DONE");
  await assertFinalLocalFixtureRepository(workspace, environment);

  const databasePath = join(layout.dataDirectory, "dev-flow.db");
  const coreBeforeLifecycle = await readGraphCoreRows(databasePath);
  const retainedManifest = lifecycleCoreManifest(coreBeforeLifecycle);
  if (
    retainedManifest.task_id !== task.task_id
    || retainedManifest.revision !== task.revision
    || retainedManifest.current_cursor !== "DONE"
    || retainedManifest.outcome_status !== "completed"
    || retainedManifest.current_action_null !== true
    || retainedManifest.claim_count !== 0
  ) throw new Error("lifecycle terminal database manifest is invalid");
  const dataBeforeLifecycle = await directoryManifest(layout.dataDirectory);
  const repositoryBeforeLifecycle = {
    status: await gitStatus(workspace, environment),
    digest: await digestRepositoryContents(workspace),
  };
  const removed = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
  if (removed.operation !== "remove" || removed.status !== "removed" || removed.changed !== true || await pathExists(receiptPath)) {
    throw new Error("lifecycle remove readback failed");
  }
  if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle)) throw new Error("lifecycle remove changed Task data");
  if (!isDeepStrictEqual(lifecycleCoreManifest(await readGraphCoreRows(databasePath)), retainedManifest)) throw new Error("lifecycle remove changed Task/Event/Evidence rows");
  const repeatedRemove = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
  if (repeatedRemove.status !== "already-absent" || repeatedRemove.changed !== false) throw new Error("lifecycle repeated remove is not a no-op");
  if ((await readFile(adjacentPath, "utf8")) !== adjacentContent) throw new Error("lifecycle remove changed adjacent data");

  await uninstallFinalLocalPackage(npmExecutable, layout, environment);
  if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) throw new Error("lifecycle npm uninstall left package bytes");
  if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle)) throw new Error("lifecycle npm uninstall changed Task data");
  if (!isDeepStrictEqual(lifecycleCoreManifest(await readGraphCoreRows(databasePath)), retainedManifest)) throw new Error("lifecycle npm uninstall changed Task/Event/Evidence rows");
  if ((await readFile(adjacentPath, "utf8")) !== adjacentContent) throw new Error("lifecycle npm uninstall changed adjacent data");

  await installFinalLocalPackage(npmExecutable, artifact, layout, environment);
  product = await inspectFinalLocalInstalledProduct({ npmExecutable, layout, environment, repositoryRoot: REPOSITORY_ROOT, resultDirectory });
  if (product.coreSHA256 !== options.coreSHA256) throw new Error("lifecycle reinstall changed packaged Core identity");
  assertFinalLocalServerInfo(await readPackagedServerInfo(product.runtimePath, layout.dataDirectory, workspace, environment), product.coreVersion);
  const beforeRetainedRead = await directoryManifest(layout.dataDirectory);
  const retained = await readRetainedTask(product.runtimePath, layout.dataDirectory, workspace, task.task_id, environment);
  const afterRetainedRead = await directoryManifest(layout.dataDirectory);
  if (
    retained.task_id !== task.task_id
    || retained.revision !== task.revision
    || retained.current_cursor !== "DONE"
    || retained.outcome?.status !== "completed"
    || retained.current_action !== null
    || !isDeepStrictEqual(beforeRetainedRead, afterRetainedRead)
    || !isDeepStrictEqual(lifecycleCoreManifest(await readGraphCoreRows(databasePath)), retainedManifest)
  ) throw new Error("lifecycle retained terminal Task reopen is invalid");
  if (
    await gitStatus(workspace, environment) !== repositoryBeforeLifecycle.status
    || await digestRepositoryContents(workspace) !== repositoryBeforeLifecycle.digest
    || (await readFile(adjacentPath, "utf8")) !== adjacentContent
  ) throw new Error("lifecycle commands changed the repository or adjacent data");
  await uninstallFinalLocalPackage(npmExecutable, layout, environment);
  if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) throw new Error("lifecycle final uninstall left package bytes");
  if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle)) throw new Error("lifecycle final uninstall changed Task data");

  const lifecycleEvidence = validateExactArtifactLifecycleEvidence({
    evidence_kind: "exact-artifact-packaged-core-lifecycle",
    status: "passed",
    evidence_class: "deterministic exact-artifact lifecycle evidence",
    artifact_filename: basename(artifact),
    artifact_sha256: options.artifactSHA256,
    artifact_size: options.artifactSize,
    artifact_source_commit: options.sourceCommit,
    same_artifact_identity: true,
    package_name: "dev-flow-codex",
    package_version: product.packageVersion,
    core_version: product.coreVersion,
    core_sha256: product.coreSHA256,
    platform: "darwin-arm64",
    codex_invocation_count: 0,
    codex_auth_read_count: 0,
    codex_thread_count: 0,
    closed_package_contents_passed: true,
    handshake_passed: true,
    live_apply_schema_passed: true,
    packaged_payload_reference_passed: templates.size === 10,
    setup_passed: true,
    task_id: task.task_id,
    final_revision: retainedManifest.revision,
    event_count: retainedManifest.event_count,
    evidence_count: retainedManifest.evidence_count,
    current_cursor: retainedManifest.current_cursor,
    outcome_status: retainedManifest.outcome_status,
    current_action_null: retainedManifest.current_action_null,
    claim_absent: retainedManifest.claim_count === 0,
    targeted_command_count: 1,
    targeted_command_identity: FINAL_LOCAL_TEST_COMMAND,
    targeted_exit_codes: [0],
    comprehension_evidence_class: "deterministic_test_fixture",
    remove_passed: true,
    repeated_remove_noop: true,
    npm_uninstall_passed: true,
    data_retained: true,
    adjacent_sentinel_retained: true,
    repository_unchanged: true,
    exact_artifact_reinstall_passed: true,
    same_task_reopened: retained.task_id === task.task_id,
    read_zero_write: isDeepStrictEqual(beforeRetainedRead, afterRetainedRead),
    database_manifest: dataBeforeLifecycle,
    final_package_uninstalled: true,
    observed_at: new Date().toISOString(),
  }, options);
  const compositeEvidence = buildCompositeAcceptanceEvidence(nativeEvidence, lifecycleEvidence);
  await writeSmokeOutput(resultDirectory, "attempt-3-native-flow-evidence.json", nativeEvidence);
  await writeSmokeOutput(resultDirectory, "exact-artifact-lifecycle-evidence.json", lifecycleEvidence);
  await writeSmokeOutput(resultDirectory, "feature-008-composite-native-acceptance.json", compositeEvidence);
  return compositeEvidence;
}

export async function runFinalLocalJourney(options) {
  assertFinalLocalJourneyOptions(options);
  assertSupportedCodexHost("final local journey");
  const artifact = await realpath(options.artifact);
  const codexExecutable = await realpath(options.codexExecutable);
  const workspace = await assertEmptyFinalDirectory(options.workspace, "final local workspace");
  const resultDirectory = await assertEmptyFinalDirectory(options.resultDirectory, "final local result directory");
  const layout = createFinalLocalJourneyLayout(workspace, resultDirectory);
  assertFinalLocalJourneyLocations({ artifact, codexExecutable, layout });

  let nativeStarted = false;
  let currentRole = null;
  try {
    await Promise.all([
      layout.home,
      layout.codexHome,
      layout.installPrefix,
      layout.npmCache,
      layout.dataDirectory,
      layout.temporaryDirectory,
      layout.xdgCache,
    ].map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
    await assertRealFinalLocalDirectories(layout);

    const [npmExecutable, gitExecutable, nodeExecutable, codexCommand] = await Promise.all([
      findExecutableOnPath("npm"),
      findExecutableOnPath("git"),
      findExecutableOnPath("node"),
      findExecutableOnPath("codex"),
    ]);
    if (await realpath(codexCommand) !== codexExecutable) throw new Error("final local Codex PATH identity differs from the approved executable");
    const environment = buildFinalLocalJourneyEnvironment({
      layout,
      codexExecutable,
      toolDirectories: [dirname(codexCommand), dirname(nodeExecutable), dirname(npmExecutable), dirname(gitExecutable), "/usr/bin", "/bin", "/usr/sbin", "/sbin"],
    });
    await copyFinalCodexAuthentication(layout);
    const codexVersion = await inspectFinalCodexExecutable(codexExecutable, environment);
    if (!versionSatisfiesFixedRange(codexVersion)) throw new Error("final local Codex version is below the supported minimum");

    const artifactInfo = await inspectFinalLocalArtifact(artifact, options);
    await installFinalLocalPackage(npmExecutable, artifact, layout, environment);
    let product = await inspectFinalLocalInstalledProduct({ npmExecutable, layout, environment, repositoryRoot: REPOSITORY_ROOT, resultDirectory });
    artifactInfo.coreSHA256 = product.coreSHA256;
    if (product.coreVersion !== "0.3.0") throw new Error("final local package/Core version must remain 0.3.0");
    const handshake = await readPackagedServerInfo(product.runtimePath, layout.dataDirectory, workspace, environment);
    assertFinalLocalServerInfo(handshake, product.coreVersion);

    await initializeFinalLocalRepository(workspace, environment);
    const baselineHead = (await execFile(gitExecutable, ["rev-parse", "HEAD"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim();
    const baselineBranch = (await execFile(gitExecutable, ["branch", "--show-current"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim();
    const baselineFiles = await finalLocalRepositoryFiles(workspace);
    const baselinePackageDigest = await digestFile(join(workspace, "package.json"));
    const baselineTestDigest = await digestFile(join(workspace, "test", "proof-writer.test.mjs"));

    const setup = await execJSON(product.packageCLI, ["setup", "--json"], { cwd: workspace, env: environment });
    if (setup.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
      throw new Error("final local setup read-back failed");
    }
    const receiptPath = join(layout.home, "Library", "Application Support", "dev-flow", "registrations", "codex.json");
    if (!(await pathExists(receiptPath))) throw new Error("final local setup receipt is absent");
    const adjacentPath = join(dirname(receiptPath), "user-owned-adjacent.txt");
    await writeFile(adjacentPath, "preserve final local journey data\n", { mode: 0o600, flag: "wx" });

    const emptyState = await readGraphCoreRows(join(layout.dataDirectory, "dev-flow.db"));
    if (emptyState.tasks.length !== 0 || emptyState.task_events.length !== 0 || emptyState.repository_claims.length !== 0) {
      throw new Error("final local pre-session Core state is not empty");
    }
    await writeSmokeOutput(resultDirectory, "native-attempt-3.json", {
      evidence_kind: "source-local-native-attempt",
      status: "started",
      native_journey_attempt_count: 3,
      authorization: options.authorization,
      final_allowed_attempt: true,
      attempt_1_status: "failed",
      attempt_2_status: "failed",
      previous_attempt_preserved: true,
      artifact_filename: basename(artifact),
      artifact_sha256: options.artifactSHA256,
      artifact_source_commit: options.sourceCommit,
    });
    nativeStarted = true;

    currentRole = "ordinary";
    const beforeOrdinary = await snapshotFinalLocalState(workspace, layout.dataDirectory, environment);
    const ordinary = await runCodexSession({
      codexExecutable,
      workspace,
      role: currentRole,
      prompt: ordinaryPrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      workspaceWrite: true,
      transcriptPath: join(resultDirectory, "session-0-ordinary.jsonl"),
    });
    const afterOrdinary = await snapshotFinalLocalState(workspace, layout.dataDirectory, environment);
    if (ordinary.dev_flow_call_count !== 0 || !isDeepStrictEqual(beforeOrdinary, afterOrdinary)) {
      throw new Error("final local ordinary session changed Core or repository state");
    }

    currentRole = "initial-comprehension";
    const sessionOne = await runCodexSession({
      codexExecutable,
      workspace,
      role: currentRole,
      prompt: finalLocalSessionOnePrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      workspaceWrite: true,
      transcriptPath: join(resultDirectory, "session-1-initial-comprehension.jsonl"),
    });
    assertFinalLocalHandshake(sessionOne, product.coreVersion);
    const taskBeforeRestart = lastGraphTask(sessionOne);
    assertInitialComprehensionTask(taskBeforeRestart);
    const stateAfterSessionOne = await readGraphCoreRows(join(layout.dataDirectory, "dev-flow.db"));

    currentRole = "complexity-refactor-retest";
    const sessionTwo = await runCodexSession({
      codexExecutable,
      workspace,
      role: currentRole,
      prompt: finalLocalSessionTwoPrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      workspaceWrite: true,
      transcriptPath: join(resultDirectory, "session-2-complexity-refactor-retest.jsonl"),
    });
    assertFinalLocalHandshake(sessionTwo, product.coreVersion);
    const taskAfterRestart = assertFinalLocalResume(sessionTwo, taskBeforeRestart);
    assertFinalLocalSessionTwo(sessionTwo);
    const taskAfterRefactor = lastGraphTask(sessionTwo);
    assertInitialComprehensionTask(taskAfterRefactor);
    const stateAfterSessionTwo = await readGraphCoreRows(join(layout.dataDirectory, "dev-flow.db"));

    currentRole = "confirmation-delivery";
    const sessionThree = await runCodexSession({
      codexExecutable,
      workspace,
      role: currentRole,
      prompt: finalLocalSessionThreePrompt,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      workspaceWrite: true,
      transcriptPath: join(resultDirectory, "session-3-confirmation-delivery.jsonl"),
    });
    assertFinalLocalHandshake(sessionThree, product.coreVersion);
    assertFinalLocalResume(sessionThree, taskAfterRefactor);
    assertFinalLocalSessionThree(sessionThree);
    const finalTask = lastGraphTask(sessionThree);
    if (finalTask?.current_cursor !== "DONE" || finalTask.current_action !== null || finalTask.outcome?.status !== "completed") {
      throw new Error("final local Session 3 did not reach authoritative DONE");
    }

    const sessions = [ordinary, sessionOne, sessionTwo, sessionThree];
    if (new Set(sessions.map((session) => session.thread_id)).size !== 4) {
      throw new Error("final local sessions must use four distinct Codex thread IDs");
    }
    const transitionFacts = assertFinalLocalTransitions(sessions, finalTask);
    const targetedCommandCount = assertFinalLocalCommands(sessions);
    const unexpectedPaths = await assertFinalLocalRepository({
      workspace,
      environment,
      baselineHead,
      baselineBranch,
      baselineFiles,
      baselinePackageDigest,
      baselineTestDigest,
    });
    const finalCoreState = await readGraphCoreRows(join(layout.dataDirectory, "dev-flow.db"));
    assertFinalLocalAtMostOnce({ finalCoreState, finalTask, transitionFacts });
    if (stateAfterSessionOne.repository_claims.length !== 1 || stateAfterSessionTwo.repository_claims.length !== 1 || finalCoreState.repository_claims.length !== 0) {
      throw new Error("final local repository claim lifecycle is invalid");
    }

    const statusBeforeLifecycle = await gitStatus(workspace, environment);
    const dataBeforeLifecycle = await directoryManifest(layout.dataDirectory);
    const removed = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
    if (removed.operation !== "remove" || removed.status !== "removed" || removed.changed !== true || await pathExists(receiptPath)) {
      throw new Error("final local remove read-back failed");
    }
    if ((await readFile(adjacentPath, "utf8")) !== "preserve final local journey data\n") throw new Error("final local remove changed adjacent data");
    if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle) || await gitStatus(workspace, environment) !== statusBeforeLifecycle) {
      throw new Error("final local remove changed task data or repository");
    }
    const repeatedRemove = await execJSON(product.packageCLI, ["remove", "--json"], { cwd: workspace, env: environment });
    if (repeatedRemove.status !== "already-absent" || repeatedRemove.changed !== false) throw new Error("final local repeated remove is not a no-op");

    await uninstallFinalLocalPackage(npmExecutable, layout, environment);
    if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) throw new Error("final local npm uninstall left package bytes");
    if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle)) throw new Error("final local npm uninstall changed task data");
    if ((await readFile(adjacentPath, "utf8")) !== "preserve final local journey data\n") throw new Error("final local npm uninstall changed adjacent data");

    await installFinalLocalPackage(npmExecutable, artifact, layout, environment);
    product = await inspectFinalLocalInstalledProduct({ npmExecutable, layout, environment, repositoryRoot: REPOSITORY_ROOT, resultDirectory });
    if (product.coreSHA256 !== artifactInfo.coreSHA256) throw new Error("final local reinstall changed bundled Core identity");
    const retained = await readRetainedTask(product.runtimePath, layout.dataDirectory, workspace, finalTask.task_id, environment);
    if (retained.task_id !== finalTask.task_id || retained.current_cursor !== "DONE" || retained.current_action !== null || retained.outcome?.status !== "completed" || retained.revision !== finalTask.revision) {
      throw new Error("final local retained task reopen failed");
    }
    if (!isDeepStrictEqual(await directoryManifest(layout.dataDirectory), dataBeforeLifecycle)) throw new Error("final local retained read mutated task data");
    await uninstallFinalLocalPackage(npmExecutable, layout, environment);
    if (await pathExists(product.packageRoot) || await pathExists(product.packageCLI)) throw new Error("final local cleanup uninstall left package bytes");

    const evidence = validateFinalLocalJourneyEvidence({
      evidence_kind: FINAL_LOCAL_NATIVE_EVIDENCE_KIND,
      status: "passed",
      artifact_filename: basename(artifact),
      artifact_sha256: options.artifactSHA256,
      artifact_size: options.artifactSize,
      artifact_source_commit: options.sourceCommit,
      package_name: "dev-flow-codex",
      package_version: product.packageVersion,
      core_version: product.coreVersion,
      core_sha256: product.coreSHA256,
      platform: "darwin-arm64",
      codex_version: codexVersion,
      compatible_codex_range: CODEX_COMPATIBILITY_RANGE,
      codex_compatible: true,
      explicit_selector: EXPLICIT_SELECTOR,
      handshake_passed: true,
      setup_readback_passed: true,
      ordinary_prompt_core_call_count: ordinary.dev_flow_call_count,
      task_id_before_restart: taskBeforeRestart.task_id,
      task_revision_before_restart: taskBeforeRestart.revision,
      task_action_id_before_restart: taskBeforeRestart.current_action.action_id,
      task_id_after_restart: taskAfterRestart.task_id,
      task_revision_after_restart: taskAfterRestart.revision,
      task_action_id_after_restart: taskAfterRestart.current_action.action_id,
      multiple_destinations_observed: true,
      complexity_transition_observed: true,
      refactor_retest_observed: true,
      explicit_user_confirmation_observed: true,
      committed_action_count: transitionFacts.length,
      targeted_command_count: targetedCommandCount,
      terminal_outcome: "DONE",
      remove_readback_passed: true,
      npm_uninstall_passed: true,
      task_data_retained: true,
      task_reopened_after_uninstall: true,
      unexpected_repository_paths: unexpectedPaths,
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
      attempt_3_authorization: options.authorization,
      attempt_3_final_allowed_attempt: true,
      previous_attempt_preserved: true,
      observed_at: new Date().toISOString(),
    }, options);
    await writeSmokeOutput(resultDirectory, "task-data-manifest.json", finalLocalTaskManifest(finalCoreState, finalTask, dataBeforeLifecycle));
    await writeSmokeOutput(resultDirectory, "final-local-journey-evidence.json", evidence);
    await writeSmokeOutput(resultDirectory, "native-attempt-3-complete.json", {
      evidence_kind: "source-local-native-attempt",
      status: "passed",
      native_journey_attempt_count: 3,
      authorization: options.authorization,
      final_allowed_attempt: true,
      attempt_1_status: "failed",
      attempt_2_status: "failed",
      previous_attempt_preserved: true,
      artifact_filename: basename(artifact),
      artifact_sha256: options.artifactSHA256,
      task_id: finalTask.task_id,
    });
    currentRole = null;
    return evidence;
  } catch (error) {
    if (nativeStarted) {
      await writeSmokeOutput(resultDirectory, "final-local-journey-diagnostic.json", {
        evidence_kind: "source-local-package-native-codex-journey-diagnostic",
        status: "failed",
        native_journey_attempt_count: 3,
        authorization: options.authorization,
        final_allowed_attempt: true,
        attempt_1_status: "failed",
        attempt_2_status: "failed",
        previous_attempt_preserved: true,
        session_role: error.role ?? currentRole,
        classification: error.classification ?? "journey-error",
        event_count: Number.isInteger(error.eventCount) ? error.eventCount : 0,
      });
    }
    throw error;
  } finally {
    await cleanupFinalLocalSensitiveState(layout);
  }
}

export async function runAcceptanceJourney(options) {
  const snapshotState = options.snapshotState ?? snapshotAcceptanceState;
  const snapshotOptions = {
    workspace: options.workspace,
    environment: options.environment ?? process.env,
  };
  const beforeOrdinary = await snapshotState(snapshotOptions);
  const ordinary = await runCodexSession({
    ...options,
    workspaceWrite: true,
    role: "ordinary",
    prompt: ordinaryPrompt,
    includeCallFacts: true,
    retainCoreRejections: false,
  });
  const afterOrdinary = await snapshotState(snapshotOptions);
  if (ordinary.dev_flow_call_count !== 0) {
    throw new Error("ordinary acceptance session must make zero Dev Flow calls");
  }
  if (!isDeepStrictEqual(beforeOrdinary, afterOrdinary)) {
    throw new Error("ordinary acceptance session changed task, event, claim, or repository state");
  }
  const invalid = await runCodexSession({
    ...options,
    workspaceWrite: true,
    role: "invalid",
    prompt: invalidPrompt,
    includeCallFacts: true,
    retainCoreRejections: true,
  });
  const afterInvalid = await snapshotState(snapshotOptions);
  assertBareAcceptanceIsolation(invalid, afterOrdinary, afterInvalid);
  const substantive = await runCodexSession({
    ...options,
    workspaceWrite: true,
    role: "substantive",
    prompt: acceptancePrompt,
    includeCallFacts: true,
    stopAfterApplyPath: join(options.workspace, "acceptance-proof.txt"),
    stopAfterApplyContent: ACCEPTANCE_PROOF_CONTENT,
    retainCoreRejections: false,
  });
  const resume = await runCodexSession({
    ...options,
    workspaceWrite: true,
    role: "resume",
    prompt: resumePrompt,
    includeCallFacts: true,
    retainCoreRejections: false,
  });
  const tools = new Set([...substantive.tools, ...resume.tools]);
  if (!tools.has("dev_flow_server_info") || !tools.has("dev_flow_open_task")) {
    throw new Error("acceptance sessions must observe the handshake and task open/resume calls");
  }
  if (!resume.core_done) {
    throw new Error("acceptance resume session must end at authoritative Core DONE");
  }
  const sessions = [ordinary, invalid, substantive, resume];
  return {
    mode: "acceptance",
    host: "codex-0.147",
    sessions,
    mcp_summary: aggregateSessionFacts(sessions),
    persistent_attempt_state: false,
    lifecycle_check_required: true,
    acceptance_report_required: true,
    status: "observed",
  };
}

const TASK_BEARING_TOOLS = new Set([
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
]);

function assertBareAcceptanceIsolation(session, before, after) {
  const successfulTaskCall = session.dev_flow_calls.find((call) => (
    TASK_BEARING_TOOLS.has(call.tool) && call.classification === "success"
  ));
  if (successfulTaskCall) {
    throw new Error(`bare acceptance session allowed successful task-bearing call ${successfulTaskCall.tool}`);
  }
  if (!isDeepStrictEqual(before, after)) {
    throw new Error("bare acceptance session changed task, event, claim, or repository state");
  }
}

export function validateAcceptanceReport(report) {
  if (!isPlainObject(report)) {
    throw new TypeError("acceptance report must be a plain object");
  }
  for (const field of ACCEPTANCE_REPORT_FIELDS) {
    if (!Object.hasOwn(report, field)) {
      throw new Error(`acceptance report requires required field ${field}`);
    }
  }
  for (const field of Object.keys(report)) {
    if (!ACCEPTANCE_REPORT_FIELDS.includes(field)) {
      throw new Error(`acceptance report has unexpected field ${field}`);
    }
  }

  if (report.status !== "pass") {
    throw new Error("acceptance report status must be pass");
  }
  if (typeof report.source_commit !== "string" || !/^[0-9a-f]{40}$/u.test(report.source_commit)) {
    throw new Error("acceptance report source_commit must be a full lowercase Git commit");
  }
  if (typeof report.artifact_sha256 !== "string" || !/^[0-9a-f]{64}$/u.test(report.artifact_sha256)) {
    throw new Error("acceptance report artifact_sha256 must be a lowercase SHA-256 digest");
  }
  for (const field of ["codex_version", "package_version", "core_version"]) {
    if (typeof report[field] !== "string" || report[field].trim() === "") {
      throw new Error(`acceptance report ${field} must be a nonempty string`);
    }
  }
  requireReleaseVersion(report.package_version);
  requireReleaseVersion(report.core_version);
  requireTrue(report, "setup_readback_passed");
  if (!Number.isInteger(report.ordinary_prompt_core_call_count) || report.ordinary_prompt_core_call_count !== 0) {
    throw new Error("acceptance report ordinary_prompt_core_call_count must equal 0");
  }
  if (report.explicit_selector !== EXPLICIT_SELECTOR) {
    throw new Error(`acceptance report explicit_selector must equal ${EXPLICIT_SELECTOR}`);
  }
  for (const field of ["task_id_before_restart", "task_id_after_restart"]) {
    if (typeof report[field] !== "string" || report[field].trim() === "") {
      throw new Error(`acceptance report ${field} must be a nonempty string`);
    }
  }
  if (report.task_id_before_restart !== report.task_id_after_restart) {
    throw new Error("acceptance report task_id_before_restart must equal task_id_after_restart");
  }
  if (!Number.isInteger(report.committed_action_count) || report.committed_action_count < 2) {
    throw new Error("acceptance report committed_action_count must be at least 2");
  }
  if (report.terminal_outcome !== "DONE") {
    throw new Error("acceptance report terminal_outcome must equal DONE");
  }
  requireTrue(report, "remove_readback_passed");
  requireTrue(report, "task_data_retained");
  requireTrue(report, "task_reopened_after_removal");
  if (!Array.isArray(report.unexpected_repository_paths) || report.unexpected_repository_paths.length !== 0) {
    throw new Error("acceptance report unexpected_repository_paths must be an empty array");
  }

  return structuredClone(report);
}

function requireTrue(report, field) {
  if (report[field] !== true) {
    throw new Error(`acceptance report ${field} must equal true`);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactFields(value, fields, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) throw new Error(`${label} missing required field ${field}`);
  }
  const allowed = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} has unexpected field ${field}`);
  }
}

function requireReleaseVersion(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-beta\.(?:0|[1-9][0-9]*))?$/u.test(value)) {
    throw new Error("release version must be a stable or beta SemVer string");
  }
}

function requireDigest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`final journey ${label} must be a lowercase SHA-256 digest`);
  }
}

function versionSatisfiesFixedRange(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  return parts[0] > 0 || parts[1] > 147 || (parts[1] === 147 && parts[2] >= 0);
}

function assertFinalEvidenceIdentity(evidence, expected) {
  const identities = [
    ["package_name", expected.packageName],
    ["package_version", expected.version],
    ["core_version", expected.coreVersion],
    ["registry", expected.registry],
    ["npm_tarball_sha256", expected.tarballSHA256],
    ["npm_integrity", expected.npmIntegrity],
    ["core_sha256", expected.coreSHA256],
    ["source_commit", expected.sourceCommit],
  ];
  for (const [field, value] of identities) {
    if (value !== undefined && evidence[field] !== value) {
      throw new Error(`final journey evidence ${field} differs from the expected release identity`);
    }
  }
}

function summarizeSession(role, parsed) {
  const fact = summarizeCodexSession(role, parsed);
  return {
    role: fact.role,
    thread_started: fact.thread_started,
    dev_flow_call_count: fact.dev_flow_call_count,
    tools: fact.tools,
    terminal_shapes: fact.terminal_shapes,
    core_done: fact.core_done,
  };
}

export function summarizeCodexSession(role, parsed) {
  if (typeof role !== "string" || role.length === 0 || !Array.isArray(parsed?.calls) || !Array.isArray(parsed?.mcpCalls)) {
    throw new TypeError("session summary requires one role and parsed Codex JSONL");
  }
  return {
    role,
    thread_id: parsed.threadId,
    thread_started: true,
    dev_flow_call_count: parsed.calls.length,
    tools: parsed.calls.map((call) => call.tool),
    terminal_shapes: parsed.calls.map((call) => call.shape),
    core_done: parsed.calls.some((call) => containsDone(call.structuredContent)),
    commands: parsed.commands.map((command) => structuredClone(command)),
    mcp_calls: parsed.mcpCalls.map((call) => ({
      item_id: call.itemId,
      server: call.server,
      tool: call.tool,
      status: call.status,
      classification: call.shape === null ? "other-mcp" : displayShape(call.shape),
    })),
    dev_flow_calls: parsed.calls.map((call) => ({
      session_role: role,
      item_id: call.itemId,
      tool: call.tool,
      request_id: call.requestId,
      arguments: call.arguments === null ? null : structuredClone(call.arguments),
      status: call.status,
      classification: displayShape(call.shape),
      core_result: call.resultPresent ? structuredClone(call.structuredContent) : null,
      host_error: call.error === null ? null : structuredClone(call.error),
      error: call.shape === "core_domain_error" ? structuredClone(call.structuredContent.error) : null,
      recovery: call.shape === "core_domain_error" ? structuredClone(call.structuredContent.recovery) : null,
    })),
  };
}

const ACCEPTANCE_SESSION_ROLES = Object.freeze([
  "ordinary",
  "invalid",
  "substantive",
  "resume",
]);

export function aggregateSessionFacts(sessions) {
  if (!Array.isArray(sessions) || sessions.length !== ACCEPTANCE_SESSION_ROLES.length) {
    throw new Error("MCP aggregate requires ordinary, invalid, substantive, and resume sessions");
  }

  const aggregate = {
    total_mcp_calls: 0,
    dev_flow_mcp_calls: 0,
    completed_count: 0,
    failed_count: 0,
    per_tool_count: {},
    core_domain_error_count: 0,
    transport_error_count: 0,
    session_dev_flow_call_count: {},
  };

  for (let index = 0; index < ACCEPTANCE_SESSION_ROLES.length; index += 1) {
    const role = ACCEPTANCE_SESSION_ROLES[index];
    const session = sessions[index];
    if (!isPlainObject(session) || session.role !== role) {
      throw new Error(`MCP aggregate session ${index + 1} must be ${role}`);
    }
    if (!Array.isArray(session.mcp_calls) || !Array.isArray(session.dev_flow_calls)) {
      throw new Error(`${role} session must carry MCP and Dev Flow call facts`);
    }

    const itemIDs = new Set();
    for (const call of session.mcp_calls) {
      validateMCPCallFact(call, role);
      if (itemIDs.has(call.item_id)) {
        throw new Error(`${role} session contains duplicate MCP item ${call.item_id}`);
      }
      itemIDs.add(call.item_id);
      aggregate.total_mcp_calls += 1;
      if (call.status === "completed") aggregate.completed_count += 1;
      else aggregate.failed_count += 1;
    }

    const projected = session.mcp_calls
      .filter((call) => call.server === "dev-flow")
      .map(({ item_id, tool, status, classification }) => ({
        item_id,
        tool,
        status,
        classification,
      }));
    const claimed = session.dev_flow_calls.map((call) => ({
      item_id: call.item_id,
      tool: call.tool,
      status: call.status,
      classification: call.classification,
    }));
    if (!isDeepStrictEqual(claimed, projected)) {
      throw new Error(`${role} Dev Flow call facts do not equal its MCP projection`);
    }
    if (
      session.dev_flow_call_count !== projected.length
      || !isDeepStrictEqual(session.tools, projected.map((call) => call.tool))
      || !isDeepStrictEqual(
        session.terminal_shapes,
        projected.map((call) => call.classification.replaceAll("-", "_")),
      )
    ) {
      throw new Error(`${role} session summary does not equal its Dev Flow call facts`);
    }
    if (role === "ordinary" && projected.length !== 0) {
      throw new Error(`${role} session must make zero Dev Flow calls`);
    }

    aggregate.session_dev_flow_call_count[role] = projected.length;
    aggregate.dev_flow_mcp_calls += projected.length;
    for (const call of projected) {
      validateDevFlowClassification(call, role);
      aggregate.per_tool_count[call.tool] = (aggregate.per_tool_count[call.tool] ?? 0) + 1;
      if (call.classification === "core-domain-error") aggregate.core_domain_error_count += 1;
      if (call.classification === "transport-error") aggregate.transport_error_count += 1;
    }
  }

  aggregate.per_tool_count = Object.fromEntries(
    Object.entries(aggregate.per_tool_count).sort(([left], [right]) => left.localeCompare(right)),
  );
  const perToolTotal = Object.values(aggregate.per_tool_count)
    .reduce((total, count) => total + count, 0);
  if (perToolTotal !== aggregate.dev_flow_mcp_calls) {
    throw new Error("per-tool MCP counts do not equal the Dev Flow call total");
  }
  if (
    aggregate.session_dev_flow_call_count.invalid
      + aggregate.session_dev_flow_call_count.substantive
      + aggregate.session_dev_flow_call_count.resume
    !== aggregate.dev_flow_mcp_calls
  ) {
    throw new Error("non-ordinary Dev Flow calls do not equal the aggregate total");
  }
  return aggregate;
}

export function validateSessionAggregate(sessions, claimed, acceptanceReport) {
  const aggregate = aggregateSessionFacts(sessions);
  if (!isDeepStrictEqual(claimed, aggregate)) {
    throw new Error("top-level MCP aggregate does not equal the four session projections");
  }
  if (
    !isPlainObject(acceptanceReport)
    || acceptanceReport.ordinary_prompt_core_call_count
      !== aggregate.session_dev_flow_call_count.ordinary
  ) {
    throw new Error("acceptance report ordinary call count does not equal the session projection");
  }
  return structuredClone(aggregate);
}

function validateMCPCallFact(call, role) {
  if (
    !isPlainObject(call)
    || typeof call.item_id !== "string"
    || call.item_id.length === 0
    || typeof call.server !== "string"
    || call.server.length === 0
    || typeof call.tool !== "string"
    || call.tool.length === 0
    || !["completed", "failed"].includes(call.status)
    || typeof call.classification !== "string"
    || call.classification.length === 0
  ) {
    throw new Error(`${role} session contains an invalid MCP call fact`);
  }
}

function validateDevFlowClassification(call, role) {
  if (
    (call.classification === "success" && call.status === "completed")
    || (["core-domain-error", "transport-error"].includes(call.classification)
      && call.status === "failed")
  ) {
    return;
  }
  throw new Error(`${role} session contains a non-exclusive Dev Flow terminal classification`);
}

function displayShape(shape) {
  return shape.replaceAll("_", "-");
}

function containsDone(value) {
  if (Array.isArray(value)) return value.some(containsDone);
  if (value === null || typeof value !== "object") return false;
  if (value.phase === "DONE" || value.current_cursor === "DONE" || value.outcome?.status === "completed") return true;
  return Object.values(value).some(containsDone);
}

export function validateDevelopmentSessions(sessions, state, options = {}) {
  try {
    return validateDevelopmentSessionsUnchecked(sessions, state, options);
  } catch (error) {
    if (typeof error?.classification !== "string") error.classification = `post-session: ${error.message}`;
    throw error;
  }
}

function validateDevelopmentSessionsUnchecked(sessions, state, {
  coreVersion = "0.1.0",
  graphContract = false,
  proofCommand = PROOF_COMMAND,
  proofRenderedCommand = PROOF_RENDERED_COMMAND,
  proofHash = PROOF_GIT_HASH,
} = {}) {
  aggregateSessionFacts(sessions);
  const threadIDs = sessions.map((session) => session.thread_id);
  if (new Set(threadIDs).size !== 4 || threadIDs.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("development smoke requires four distinct Codex sessions");
  }
  for (const session of sessions.slice(2)) {
    if (graphContract) assertFinalLocalHandshake(session, coreVersion);
    else assertHandshake(session, coreVersion);
  }
  const substantive = sessions[2];
  const resume = sessions[3];
  const substantiveApplies = successfulCalls(substantive, "dev_flow_apply_action");
  const resumeApplies = successfulCalls(resume, "dev_flow_apply_action");
  const taskBefore = lastTask(substantiveApplies);
  const resumeOpen = successfulCalls(resume, "dev_flow_open_task")[0];
  const taskAfter = taskFromCall(resumeOpen);
  const finalTask = lastTask(resumeApplies);
  const taskBeforeCursor = graphContract ? taskBefore?.current_cursor : taskBefore?.phase;
  const finalCursor = graphContract ? finalTask?.current_cursor : finalTask?.phase;
  if (!taskBefore || taskBeforeCursor === "DONE" || taskBefore.outcome !== null) throw new Error("substantive session did not stop on a nonterminal Core task");
  if (!taskAfter || taskAfter.task_id !== taskBefore.task_id) throw new Error("restart did not resume the same Core task");
  if (!finalTask || finalTask.task_id !== taskBefore.task_id || finalCursor !== "DONE" || finalTask.outcome?.status !== "completed") {
    throw new Error("resume session did not reach authoritative Core DONE");
  }
  const tools = resume.dev_flow_calls.map((call) => call.tool);
  const readTask = tools.indexOf("dev_flow_get_task");
  const readAction = tools.indexOf("dev_flow_get_next_action");
  const firstApply = tools.indexOf("dev_flow_apply_action");
  if (!(readTask > tools.indexOf("dev_flow_open_task") && readAction > readTask && firstApply > readAction)) {
    throw new Error("resume must read task and next action before a new apply");
  }
  const commands = [...substantive.commands, ...resume.commands];
  const proof = commands.filter((command) => command.command === proofRenderedCommand || command.command === proofCommand);
  if (proof.length !== 1 || proof[0].status !== "completed" || proof[0].exitCode !== 0 || proof[0].output !== `${proofHash}\n`) {
    throw new Error("development smoke requires one successful targeted proof command");
  }
  if (commands.some((command) => /(?:go test \.\/\.\.\.|pnpm (?:run )?(?:test|validate)|node --test .*\*)/u.test(command.command))) {
    throw new Error("development smoke may not run a full suite");
  }
  state.taskIdBeforeRestart = taskBefore.task_id;
  state.taskIdAfterRestart = taskAfter.task_id;
  state.committedActionCount = substantiveApplies.length + resumeApplies.length;
  state.terminalOutcome = "DONE";
  if (state.committedActionCount < 2 || finalTask.revision <= taskBefore.revision) {
    throw new Error("development smoke requires two committed actions and growing revision");
  }
}

function assertHandshake(session, coreVersion = "0.1.0") {
  const call = session.dev_flow_calls[0];
  const info = call?.core_result?.result;
  const checks = {
    first_tool: call?.tool === "dev_flow_server_info",
    classification: call?.classification === "success",
    product: info?.product === "dev-flow",
    version: info?.version === coreVersion,
    transport: info?.transport === "stdio",
    health: info?.health === "ready",
    host: info?.supported_hosts?.includes("codex") === true,
    tools: isDeepStrictEqual(info?.tools, DEV_FLOW_TOOLS),
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length !== 0) throw new Error(`development smoke ${session.role} Core handshake failed: ${failed.join(",")}`);
}

function successfulCalls(session, tool) {
  return session.dev_flow_calls.filter((call) => call.tool === tool && call.classification === "success");
}

function taskFromCall(call) {
  const result = call?.core_result?.result;
  if (isPlainObject(result?.task)) return result.task;
  if (isPlainObject(result) && typeof result.task_id === "string" && typeof result.current_cursor === "string") return result;
  return null;
}

function lastTask(calls) {
  return calls.map(taskFromCall).filter(Boolean).at(-1) ?? null;
}

function assertFinalLocalJourneyOptions(options) {
  assertExactFields(options, [
    "mode", "artifact", "artifactSHA256", "artifactSize", "sourceCommit",
    "codexExecutable", "workspace", "resultDirectory", "nativeAttempt", "authorization",
  ], "final local journey options");
  if (options.mode !== "final-local") throw new Error("final local journey mode is invalid");
  requireAbsolute(options.artifact, "local artifact");
  requireDigest(options.artifactSHA256, "artifact-sha256");
  if (!Number.isSafeInteger(options.artifactSize) || options.artifactSize < 1) throw new Error("final local artifact size is invalid");
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error("final local source commit is invalid");
  if (options.nativeAttempt !== 3 || options.authorization !== "explicit_user_authorization") {
    throw new Error("final local third attempt requires explicit user authorization");
  }
  requireAbsolute(options.codexExecutable, "Codex executable");
  requireAbsolute(options.workspace, "final local workspace");
  requireAbsolute(options.resultDirectory, "final local result directory");
}

function assertFinalLocalJourneyLocations({ artifact, codexExecutable, layout }) {
  for (const candidate of [artifact, codexExecutable, layout.root, layout.workspace, layout.resultDirectory]) {
    if (pathWithin(REPOSITORY_ROOT, candidate)) throw new Error("final local inputs must remain outside the source repository");
  }
  if (pathWithin(layout.workspace, layout.resultDirectory) || pathWithin(layout.resultDirectory, layout.workspace)) {
    throw new Error("final local workspace and result directory must be separate");
  }
  if (pathWithin(layout.root, artifact)) throw new Error("final local artifact must remain outside the journey root");
}

async function assertRealFinalLocalDirectories(layout) {
  for (const path of [
    layout.root, layout.home, layout.codexHome, layout.installPrefix, layout.npmCache,
    layout.dataDirectory, layout.temporaryDirectory, layout.xdgCache, layout.workspace, layout.resultDirectory,
  ]) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("final local layout requires real directories");
  }
}

async function inspectFinalLocalArtifact(artifact, options) {
  const info = await lstat(artifact);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== options.artifactSize) {
    throw new Error("final local artifact file identity is invalid");
  }
  const artifactSHA256 = await digestFile(artifact);
  if (artifactSHA256 !== options.artifactSHA256 || basename(artifact) !== "dev-flow-codex-0.3.0.tgz") {
    throw new Error("final local artifact digest or filename differs from the approved identity");
  }
  return { artifactSHA256, coreSHA256: null };
}

export function buildFinalLocalInstallArgs({ artifact, prefix, cache }) {
  requireAbsolute(artifact, "local artifact");
  requireAbsolute(prefix, "final local npm prefix");
  requireAbsolute(cache, "final local npm cache");
  return [
    "install", "--global", artifact,
    "--prefix", prefix,
    "--cache", cache,
    "--ignore-scripts", "--no-audit", "--no-fund",
  ];
}

export function buildFinalLocalUninstallArgs({ prefix, cache }) {
  requireAbsolute(prefix, "final local npm prefix");
  requireAbsolute(cache, "final local npm cache");
  return [
    "uninstall", "--global", "dev-flow-codex",
    "--prefix", prefix,
    "--cache", cache,
    "--ignore-scripts", "--no-audit", "--no-fund",
  ];
}

async function installFinalLocalPackage(npmExecutable, artifact, layout, environment) {
  await execFile(npmExecutable, buildFinalLocalInstallArgs({
    artifact,
    prefix: layout.installPrefix,
    cache: layout.npmCache,
  }), {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function uninstallFinalLocalPackage(npmExecutable, layout, environment) {
  await execFile(npmExecutable, buildFinalLocalUninstallArgs({
    prefix: layout.installPrefix,
    cache: layout.npmCache,
  }), {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function inspectFinalLocalInstalledProduct({ npmExecutable, layout, environment, repositoryRoot, resultDirectory }) {
  const rootResult = await execFile(npmExecutable, ["root", "--global", "--prefix", layout.installPrefix], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  const packageRoot = await realpath(join(rootResult.stdout.trim(), "dev-flow-codex"));
  if (!pathWithin(layout.installPrefix, packageRoot) || pathWithin(repositoryRoot, packageRoot) || pathWithin(resultDirectory, packageRoot)) {
    throw new Error("final local package root is outside the isolated npm prefix");
  }
  const packageCLI = join(layout.installPrefix, "bin", "dev-flow-codex");
  if (await realpath(packageCLI) !== join(packageRoot, "bin", "dev-flow-codex.mjs")) {
    throw new Error("final local package CLI is not owned by the installed package");
  }
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (
    manifest.name !== "dev-flow-codex"
    || manifest.version !== "0.3.0"
    || manifest.private === true
    || !isDeepStrictEqual(manifest.os, ["darwin"])
    || !isDeepStrictEqual(manifest.cpu, ["arm64"])
  ) throw new Error("final local installed package metadata is invalid");
  const actualFiles = await recursiveFileList(packageRoot);
  if (!isDeepStrictEqual(actualFiles, [...FINAL_LOCAL_PACKAGE_FILES].sort())) {
    throw new Error("final local installed package contents are not closed");
  }
  const productVersion = await execFile(packageCLI, ["--version"], { cwd: layout.root, env: environment, encoding: "utf8" });
  if (productVersion.stdout !== "dev-flow-codex 0.3.0 (core 0.3.0)\n") throw new Error("final local package version read-back is invalid");
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const runtimeInfo = await stat(runtimePath);
  if (!runtimeInfo.isFile() || (runtimeInfo.mode & 0o111) === 0) throw new Error("final local runtime is not executable");
  const runtimeVersion = await execFile(runtimePath, ["version"], { cwd: layout.root, env: environment, encoding: "utf8" });
  if (runtimeVersion.stdout !== "dev-flow 0.3.0\n") throw new Error("final local Core version read-back is invalid");
  return {
    packageRoot,
    packageCLI,
    runtimePath,
    packageVersion: manifest.version,
    coreVersion: "0.3.0",
    coreSHA256: await digestFile(runtimePath),
  };
}

async function recursiveFileList(root) {
  const files = [];
  const visit = async (directory, prefix = "") => {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = join(directory, name);
      const relativePath = prefix === "" ? name : join(prefix, name);
      const info = await lstat(absolute);
      if (info.isDirectory()) await visit(absolute, relativePath);
      else if (info.isFile()) files.push(relativePath);
      else throw new Error("final local package contains a non-file entry");
    }
  };
  await visit(root);
  return files.sort();
}

async function readPackagedServerInfo(runtimePath, dataDirectory, repository, environment) {
  return callPackagedCoreTool(runtimePath, dataDirectory, repository, "dev_flow_server_info", {}, environment);
}

function assertFinalLocalServerInfo(envelope, coreVersion) {
  const info = envelope?.result;
  if (
    envelope?.ok !== true
    || info?.product !== "dev-flow"
    || info?.version !== coreVersion
    || info?.transport !== "stdio"
    || info?.health !== "ready"
    || !isDeepStrictEqual(info?.method_profiles, ["plain", "spec-kit", "openspec"])
    || !isDeepStrictEqual(info?.tools, DEV_FLOW_TOOLS)
    || info?.supported_processes?.length !== 1
    || info.supported_processes[0]?.process_id !== "standard-development"
    || info.supported_processes[0]?.definition_digest !== FINAL_LOCAL_DEFINITION_DIGEST
  ) throw new Error("final local packaged Core handshake is invalid");
}

async function initializeFinalLocalRepository(path, environment) {
  await execFile("git", ["init", "--initial-branch=main", "--object-format=sha1"], { cwd: path, env: environment });
  await mkdir(join(path, "src"), { mode: 0o755 });
  await mkdir(join(path, "test"), { mode: 0o755 });
  await writeFile(join(path, "package.json"), `${JSON.stringify({ name: "feature-008-native-fixture", private: true, type: "module" }, null, 2)}\n`);
  await writeFile(join(path, "src", "proof-writer.mjs"), `import { writeFile } from "node:fs/promises";\n\nexport class ProofWriterFactory {\n  create() {\n    return new ProofWriter();\n  }\n}\n\nexport class ProofWriter {\n  async write(path, bytes) {\n    throw new Error("ProofWriter is not implemented");\n  }\n}\n\nexport async function writeProof(path) {\n  const writer = new ProofWriterFactory().create();\n  await writer.write(path, ${JSON.stringify(FINAL_LOCAL_PROOF_CONTENT)});\n}\n`);
  await writeFile(join(path, "test", "proof-writer.test.mjs"), `import assert from "node:assert/strict";\nimport { mkdtemp, readFile, rm } from "node:fs/promises";\nimport { tmpdir } from "node:os";\nimport { join } from "node:path";\nimport test from "node:test";\n\nimport { writeProof } from "../src/proof-writer.mjs";\n\ntest("writeProof emits the exact Feature 008 native bytes", async (t) => {\n  const root = await mkdtemp(join(tmpdir(), "feature-008-proof-"));\n  t.after(() => rm(root, { recursive: true, force: true }));\n  const output = join(root, "proof.txt");\n  await writeProof(output);\n  assert.equal(await readFile(output, "utf8"), ${JSON.stringify(FINAL_LOCAL_PROOF_CONTENT)});\n});\n`);
  await execFile("git", ["add", "package.json", "src/proof-writer.mjs", "test/proof-writer.test.mjs"], { cwd: path, env: environment });
  await execFile("git", ["-c", "user.name=Dev Flow Native", "-c", "user.email=native@example.invalid", "commit", "-m", "native fixture baseline"], { cwd: path, env: environment });
  if (await gitStatus(path, environment) !== "") throw new Error("final local fixture baseline is dirty");
}

async function snapshotFinalLocalState(workspace, dataDirectory, environment) {
  return {
    core: await readGraphCoreRows(join(dataDirectory, "dev-flow.db")),
    repository: {
      head: (await execFile("git", ["rev-parse", "HEAD"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim(),
      branch: (await execFile("git", ["branch", "--show-current"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim(),
      status: await gitStatus(workspace, environment),
      content_sha256: await digestRepositoryContents(workspace),
    },
  };
}

async function readGraphCoreRows(databasePath) {
  if (!existsSync(databasePath)) return { tasks: [], task_events: [], repository_claims: [] };
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tasks = database.prepare("SELECT task_id, origin_host, process_id, process_definition_digest, current_node, revision, repository_identity, hex(snapshot) AS snapshot_hex FROM tasks ORDER BY task_id").all()
      .map((row) => ({ ...row, revision: Number(row.revision), snapshot: JSON.parse(Buffer.from(row.snapshot_hex, "hex").toString("utf8")), snapshot_hex: undefined }));
    const taskEvents = database.prepare("SELECT event_id, task_id, revision, event_type, source_node, destination_node, transition_id, transition_reason, action_id, request_id, payload_digest FROM task_events ORDER BY revision").all()
      .map((row) => ({ ...row, revision: Number(row.revision) }));
    const claims = database.prepare("SELECT repository_identity, task_id, origin_host FROM repository_claims ORDER BY repository_identity").all().map((row) => ({ ...row }));
    return { tasks, task_events: taskEvents, repository_claims: claims };
  } finally {
    database.close();
  }
}

function assertFinalLocalHandshake(session, coreVersion) {
  const first = session.dev_flow_calls[0];
  if (first?.tool !== "dev_flow_server_info" || first.classification !== "success") {
    throw new Error(`final local ${session.role} must call server_info first`);
  }
  assertFinalLocalServerInfo(first.core_result, coreVersion);
}

function lastGraphTask(session) {
  return session.dev_flow_calls.map(taskFromCall).filter(Boolean).at(-1) ?? null;
}

function assertInitialComprehensionTask(task) {
  const transitions = task?.current_action?.available_transitions?.map((edge) => edge.transition_id);
  if (
    task?.current_cursor !== "COMPREHENSION_REVIEW"
    || task.outcome !== null
    || task.current_action === null
    || !isDeepStrictEqual(transitions, [
      "comprehension_passed", "implementation_defect", "code_too_complex",
      "design_too_complex", "evidence_insufficient", "requirement_unclear",
    ])
  ) throw new Error("final local comprehension action is incomplete or missing six destinations");
}

function finalLocalRestartIdentity(task) {
  return structuredClone({
    task_id: task.task_id,
    revision: task.revision,
    current_action: task.current_action,
    process_id: task.process_id,
    process_definition_digest: task.process_definition_digest,
    current_cursor: task.current_cursor,
    repository: task.repository,
    method_profile: task.intent.method_profile,
    baselines: task.baselines,
    implementation: task.implementation,
    test: task.test,
    evidence: task.evidence,
    last_operation: task.last_operation,
  });
}

function assertFinalLocalResume(session, expectedTask) {
  const tools = session.dev_flow_calls.map((call) => call.tool);
  if (!isDeepStrictEqual(tools.slice(0, 4), [
    "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task", "dev_flow_get_next_action",
  ])) throw new Error(`final local ${session.role} resume reads are not in the required order`);
  const openCall = session.dev_flow_calls[1];
  const getCall = session.dev_flow_calls[2];
  const nextCall = session.dev_flow_calls[3];
  if (Object.hasOwn(openCall.arguments ?? {}, "new_task") && openCall.arguments.new_task !== null) {
    throw new Error("final local resume must omit or null new_task");
  }
  const opened = taskFromCall(openCall);
  const read = taskFromCall(getCall);
  if (!isDeepStrictEqual(finalLocalRestartIdentity(opened), finalLocalRestartIdentity(expectedTask))) {
    throw new Error("final local open_task did not restore exact restart identity");
  }
  if (!isDeepStrictEqual(finalLocalRestartIdentity(read), finalLocalRestartIdentity(expectedTask))) {
    throw new Error("final local get_task changed restart identity");
  }
  const next = nextCall.core_result?.result;
  if (next?.task_id !== expectedTask.task_id || next.revision !== expectedTask.revision || !isDeepStrictEqual(next.action, expectedTask.current_action)) {
    throw new Error("final local get_next_action changed restart identity");
  }
  return opened;
}

function successfulApplyFacts(session) {
  return successfulCalls(session, "dev_flow_apply_action").map((call) => ({
    call,
    transition_id: call.arguments?.payload?.transition_id,
    problem_class: call.arguments?.payload?.node_result?.problem_class,
    task: taskFromCall(call),
  }));
}

function assertFinalLocalSessionTwo(session) {
  const facts = successfulApplyFacts(session);
  if (!isDeepStrictEqual(facts.map((fact) => fact.transition_id), ["code_too_complex", "refactor_ready_for_test", "tests_passed"])) {
    throw new Error("final local Session 2 transition sequence is invalid");
  }
  if (facts[0].problem_class !== "code_complexity" || facts[0].task?.current_cursor !== "REFACTOR") {
    throw new Error("final local code complexity verdict did not enter REFACTOR");
  }
  if (facts[0].task.test !== null || facts[0].task.comprehension !== null) {
    throw new Error("final local REFACTOR entry retained stale test/comprehension authority");
  }
  if (facts[1].task?.current_cursor !== "TEST" || facts[2].task?.current_cursor !== "COMPREHENSION_REVIEW") {
    throw new Error("final local refactor did not return through TEST and comprehension");
  }
}

function assertFinalLocalSessionThree(session) {
  const facts = successfulApplyFacts(session);
  if (!isDeepStrictEqual(facts.map((fact) => fact.transition_id), ["comprehension_passed", "delivery_complete"])) {
    throw new Error("final local Session 3 transition sequence is invalid");
  }
  const confirmation = facts[0].call.arguments?.payload?.node_result?.user_confirmation;
  if (facts[0].problem_class !== "none" || confirmation?.source !== "user" || confirmation?.status !== "passed") {
    throw new Error("final local Session 3 lacks explicit user comprehension confirmation");
  }
  if (facts[0].task?.current_cursor !== "DELIVERY" || facts[1].task?.current_cursor !== "DONE") {
    throw new Error("final local Session 3 did not complete delivery");
  }
}

function assertFinalLocalTransitions(sessions, finalTask) {
  const facts = sessions.slice(1).flatMap(successfulApplyFacts);
  const expected = [
    "requirements_ready", "design_ready", "tasks_ready", "implementation_ready_for_test", "tests_passed",
    "code_too_complex", "refactor_ready_for_test", "tests_passed", "comprehension_passed", "delivery_complete",
  ];
  if (!isDeepStrictEqual(facts.map((fact) => fact.transition_id), expected)) {
    throw new Error("final local complete transition sequence is invalid");
  }
  const requestIDs = facts.map((fact) => fact.call.arguments?.request_id);
  if (requestIDs.some((id) => typeof id !== "string") || new Set(requestIDs).size !== requestIDs.length) {
    throw new Error("final local apply request IDs are not unique");
  }
  for (let index = 0; index < facts.length; index += 1) {
    const evidence = facts[index].call.arguments?.payload?.method_evidence;
    if (!Array.isArray(evidence) || evidence.length !== 3 || new Set(evidence.map((item) => item.step_id)).size !== 3) {
      throw new Error("final local apply does not carry one MethodEvidence item per required step");
    }
    if (evidence.some((item) => item.status !== "plain_fallback" || item.capability !== "")) {
      throw new Error("final local plain MethodEvidence is not an honest fallback");
    }
    if (index > 0 && facts[index].task?.revision !== facts[index - 1].task?.revision + 1) {
      throw new Error("final local successful applies do not increment revision exactly once");
    }
  }
  if (facts.at(-1)?.task?.revision !== finalTask.revision) throw new Error("final local transition facts do not reach final revision");
  return facts;
}

export function classifyFinalLocalVerificationCommand(command) {
  if (typeof command !== "string" || command.length === 0 || command.includes("\n")) {
    return "other";
  }
  if (command === FINAL_LOCAL_TEST_COMMAND || command === FINAL_LOCAL_RENDERED_TEST_COMMAND) {
    return "authorized";
  }
  const rendered = /^\/bin\/zsh -lc '([^'\n]*)'$/u.exec(command);
  const executableCommand = rendered?.[1] ?? command;
  const executable = String.raw`(?:[^\s/]*/)*`;
  const forbidden = new RegExp(
    String.raw`^(?:${executable}npm\s+(?:test|run\s+(?:test|validate))(?:\s|$)|${executable}pnpm\s+(?:test|validate|run\s+(?:test|validate))(?:\s|$)|${executable}go\s+test(?:\s|$)|${executable}node\s+--test(?:\s|$))`,
    "u",
  );
  return forbidden.test(executableCommand) ? "forbidden" : "other";
}

export function assertFinalLocalCommands(sessions) {
  const commands = sessions.flatMap((session) => session.commands.map((command) => ({ role: session.role, ...command })));
  const classified = commands.map((command) => ({
    ...command,
    verificationClassification: classifyFinalLocalVerificationCommand(command.command),
  }));
  const forbidden = classified.filter((command) => command.verificationClassification === "forbidden");
  if (forbidden.length !== 0) {
    throw new Error("final local journey ran a forbidden full or alternate suite");
  }
  const verification = classified.filter((command) => command.verificationClassification === "authorized");
  if (verification.length !== 2 || verification.some((command) => command.exitCode !== 0 || command.status !== "completed")) {
    throw new Error("final local verification command count or identity is invalid");
  }
  if (verification[0].role !== "initial-comprehension" || verification[1].role !== "complexity-refactor-retest") {
    throw new Error("final local targeted checks ran in the wrong sessions");
  }
  return verification.length;
}

async function finalLocalRepositoryFiles(root) {
  const files = await recursiveFileList(root);
  return files.filter((path) => path !== ".git" && !path.startsWith(".git/"));
}

async function assertFinalLocalRepository({ workspace, environment, baselineHead, baselineBranch, baselineFiles, baselinePackageDigest, baselineTestDigest }) {
  const head = (await execFile("git", ["rev-parse", "HEAD"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim();
  const branch = (await execFile("git", ["branch", "--show-current"], { cwd: workspace, env: environment, encoding: "utf8" })).stdout.trim();
  const status = await gitStatus(workspace, environment);
  if (head !== baselineHead || branch !== baselineBranch || status !== " M src/proof-writer.mjs\n") {
    throw new Error("final local repository HEAD, branch, or changed surface is invalid");
  }
  if (!isDeepStrictEqual(await finalLocalRepositoryFiles(workspace), baselineFiles)) {
    throw new Error("final local repository contains unexpected files");
  }
  if (await digestFile(join(workspace, "package.json")) !== baselinePackageDigest || await digestFile(join(workspace, "test", "proof-writer.test.mjs")) !== baselineTestDigest) {
    throw new Error("final local journey changed package or test files");
  }
  const source = await readFile(join(workspace, "src", "proof-writer.mjs"), "utf8");
  if (/ProofWriterFactory|class\s+ProofWriter/u.test(source) || !/export async function writeProof/u.test(source) || !/writeFile/u.test(source)) {
    throw new Error("final local refactor did not produce one direct writeProof path");
  }
  return [];
}

function assertFinalLocalAtMostOnce({ finalCoreState, finalTask, transitionFacts }) {
  if (finalCoreState.tasks.length !== 1 || finalCoreState.tasks[0].task_id !== finalTask.task_id) {
    throw new Error("final local final database task identity is invalid");
  }
  const transitionEvents = finalCoreState.task_events.filter((event) => event.transition_id !== null);
  if (transitionEvents.length !== transitionFacts.length) throw new Error("final local apply/event count differs");
  if (new Set(finalCoreState.task_events.map((event) => event.revision)).size !== finalCoreState.task_events.length) {
    throw new Error("final local database contains duplicate event revisions");
  }
  const requestIDs = transitionEvents.map((event) => event.request_id);
  if (new Set(requestIDs).size !== requestIDs.length) throw new Error("final local database contains duplicate request IDs");
  const evidence = finalTask.evidence ?? [];
  if (new Set(evidence.map((item) => item.evidence_id)).size !== evidence.length) throw new Error("final local task contains duplicate evidence");
  if (finalTask.last_operation?.operation_id !== transitionFacts.at(-1)?.call.arguments?.request_id || finalTask.last_operation?.to_revision !== finalTask.revision) {
    throw new Error("final local LastOperation does not match final delivery commit");
  }
}

async function directoryManifest(root) {
  const entries = [];
  const visit = async (directory, prefix = "") => {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = join(directory, name);
      const relativePath = prefix === "" ? name : join(prefix, name);
      const info = await lstat(absolute);
      if (info.isDirectory()) await visit(absolute, relativePath);
      else if (info.isFile()) entries.push({ path: relativePath, size: info.size, sha256: await digestFile(absolute) });
      else if (info.isSymbolicLink()) entries.push({ path: relativePath, symlink: await readlink(absolute) });
      else throw new Error("final local manifest found an unsupported entry");
    }
  };
  await visit(root);
  return entries;
}

function finalLocalTaskManifest(finalCoreState, finalTask, dataManifest) {
  return {
    task_id: finalTask.task_id,
    final_revision: finalTask.revision,
    current_cursor: finalTask.current_cursor,
    outcome_status: finalTask.outcome?.status,
    task_count: finalCoreState.tasks.length,
    event_count: finalCoreState.task_events.length,
    evidence_count: finalTask.evidence?.length ?? 0,
    claim_count: finalCoreState.repository_claims.length,
    data_files: dataManifest,
  };
}

async function cleanupFinalLocalSensitiveState(layout) {
  for (const path of [layout.home, layout.codexHome, layout.installPrefix, layout.npmCache, layout.dataDirectory, layout.temporaryDirectory, layout.xdgCache]) {
    if (pathWithin(layout.root, path) && path !== layout.workspace && path !== layout.resultDirectory) {
      await rm(path, { recursive: true, force: true });
    }
  }
}

async function assertEmptyResultDirectory(path) {
  requireAbsolute(path, "development smoke result directory");
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (await readdir(path)).length !== 0) {
    throw new Error("development smoke result directory must be an empty real directory");
  }
}

function assertFinalJourneyOptions(options) {
  assertRegistryJourneyOptions(options, "final-registry", "final registry journey");
}

function assertQuickJourneyOptions(options) {
  assertRegistryJourneyOptions(options, "quick-registry", "quick registry journey");
}

function assertRegistryJourneyOptions(options, expectedMode, label) {
  assertExactFields(options, [
    "mode", "packageName", "version", "registry", "tarballSHA256", "coreVersion", "coreSHA256",
    "sourceCommit", "codexExecutable", "workspace", "resultDirectory",
  ], `${label} options`);
  if (options.mode !== expectedMode) throw new Error(`${label} mode is invalid`);
  if (options.packageName !== "dev-flow-codex") throw new Error(`${label} package must equal dev-flow-codex`);
  if (options.registry !== OFFICIAL_NPM_REGISTRY) throw new Error(`${label} requires the official npm registry`);
  requireReleaseVersion(options.version);
  requireReleaseVersion(options.coreVersion);
  requireDigest(options.tarballSHA256, "tarball-sha256");
  requireDigest(options.coreSHA256, "core-sha256");
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error(`${label} source commit is invalid`);
  requireAbsolute(options.codexExecutable, "Codex executable");
  requireAbsolute(options.workspace, "workspace");
  requireAbsolute(options.resultDirectory, "final journey result directory");
}

async function assertEmptyFinalDirectory(path, label) {
  const supplied = await lstat(path);
  if (!supplied.isDirectory() || supplied.isSymbolicLink() || (await readdir(path)).length !== 0) {
    throw new Error(`${label} must be an empty real directory`);
  }
  return realpath(path);
}

function assertFinalJourneyLocations({ codexExecutable, workspace, resultDirectory }) {
  if (
    pathWithin(REPOSITORY_ROOT, codexExecutable)
    || pathWithin(REPOSITORY_ROOT, workspace)
    || pathWithin(REPOSITORY_ROOT, resultDirectory)
  ) throw new Error("final registry journey inputs must remain outside the source repository");
  if (
    pathWithin(workspace, resultDirectory)
    || pathWithin(resultDirectory, workspace)
  ) throw new Error("final registry journey workspace and result directory must be separate");
}

function pathWithin(root, candidate) {
  const offset = relative(root, candidate);
  return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
}

async function findExecutableOnPath(name) {
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = resolve(directory, name);
    if (pathWithin(REPOSITORY_ROOT, candidate)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile() && (info.mode & 0o111) !== 0) return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  throw new Error(`final registry journey requires executable ${name}`);
}

async function copyFinalCodexAuthentication(layout) {
  const authSource = join(homedir(), ".codex", "auth.json");
  const authInfo = await lstat(authSource);
  if (!authInfo.isFile() || authInfo.isSymbolicLink() || (authInfo.mode & 0o077) !== 0) {
    throw new Error("final registry journey Codex authentication source is unavailable");
  }
  const destination = join(layout.codexHome, "auth.json");
  await copyFile(authSource, destination);
  await chmod(destination, 0o600);
}

export async function inspectFinalCodexExecutable(executable, environment) {
  const metadata = await stat(executable);
  if (!metadata.isFile() || (metadata.mode & 0o111) === 0) {
    throw new Error("final registry journey Codex executable is not executable");
  }
  const { stdout } = await execFile(executable, ["--version"], { env: environment, encoding: "utf8" });
  const match = /^codex(?:-cli)? (\d+\.\d+\.\d+)\n?$/u.exec(stdout);
  if (!match) throw new Error("final registry journey Codex version must be semantic");
  return match[1];
}

async function readFinalRegistryPackage({ npmExecutable, version, layout, environment }) {
  const specification = `dev-flow-codex@${version}`;
  const metadata = await execFile(npmExecutable, [
    "view", specification, "dist.integrity", "--json", `--registry=${OFFICIAL_NPM_REGISTRY}`,
  ], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  let integrity;
  try {
    integrity = JSON.parse(metadata.stdout);
  } catch {
    throw new Error("final registry journey npm integrity read-back is invalid");
  }
  if (typeof integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(integrity)) {
    throw new Error("final registry journey npm integrity read-back is invalid");
  }
  const packed = await execFile(npmExecutable, buildFinalRegistryPackArgs({
    version,
    destination: layout.registryReadbackDirectory,
  }), {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  let filename;
  try {
    filename = JSON.parse(packed.stdout)?.[0]?.filename;
  } catch {
    throw new Error("final registry journey npm pack read-back is invalid");
  }
  if (typeof filename !== "string" || basename(filename) !== filename) {
    throw new Error("final registry journey npm pack filename is invalid");
  }
  return {
    integrity,
    tarballSHA256: await digestFile(join(layout.registryReadbackDirectory, filename)),
  };
}

async function installFinalRegistryPackage(npmExecutable, version, layout, environment) {
  await execFile(npmExecutable, buildFinalRegistryInstallArgs({
    version,
    prefix: layout.installPrefix,
    cache: layout.npmCache,
  }), {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function uninstallFinalRegistryPackage(npmExecutable, layout, environment) {
  await execFile(npmExecutable, [
    "uninstall", "--global", "dev-flow-codex",
    `--registry=${OFFICIAL_NPM_REGISTRY}`,
    "--prefix", layout.installPrefix,
    "--cache", layout.npmCache,
    "--ignore-scripts", "--no-audit", "--no-fund",
  ], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function inspectFinalInstalledProduct({
  npmExecutable,
  version,
  coreVersion,
  layout,
  environment,
  repositoryRoot,
  resultDirectory,
}) {
  const rootResult = await execFile(npmExecutable, ["root", "--global", "--prefix", layout.installPrefix], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  const packageRoot = await realpath(join(rootResult.stdout.trim(), "dev-flow-codex"));
  if (
    !pathWithin(layout.installPrefix, packageRoot)
    || pathWithin(repositoryRoot, packageRoot)
    || pathWithin(resultDirectory, packageRoot)
  ) throw new Error("final registry journey package root is outside the isolated npm prefix");
  const packageCLI = join(layout.installPrefix, "bin", "dev-flow-codex");
  if (await realpath(packageCLI) !== join(packageRoot, "bin", "dev-flow-codex.mjs")) {
    throw new Error("final registry journey executable is not owned by the isolated package");
  }
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  if (
    manifest.name !== "dev-flow-codex"
    || manifest.version !== version
    || manifest.private === true
    || !isDeepStrictEqual(manifest.os, ["darwin"])
    || !isDeepStrictEqual(manifest.cpu, ["arm64"])
    || manifest.publishConfig?.access !== "public"
    || manifest.publishConfig?.registry !== OFFICIAL_NPM_REGISTRY
  ) throw new Error("final registry journey installed package metadata is invalid");
  const productVersion = await execFile(packageCLI, ["--version"], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  if (productVersion.stdout !== `dev-flow-codex ${version} (core ${coreVersion})\n`) {
    throw new Error("final registry journey product version read-back is invalid");
  }
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const runtimeVersion = await execFile(runtimePath, ["version"], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  if (runtimeVersion.stdout !== `dev-flow ${coreVersion}\n`) {
    throw new Error("final registry journey bundled Core version is invalid");
  }
  return {
    packageRoot,
    packageCLI,
    runtimePath,
    coreVersion,
    coreSHA256: await digestFile(runtimePath),
  };
}

function finalJourneyTaskFacts(sessions) {
  const substantive = sessions[2];
  const resume = sessions[3];
  const before = lastTask(successfulCalls(substantive, "dev_flow_apply_action"));
  const after = taskFromCall(successfulCalls(resume, "dev_flow_open_task")[0]);
  if (!before || !after || !before.current_action || !after.current_action) {
    throw new Error("final registry journey restart task facts are incomplete");
  }
  return {
    taskIDBeforeRestart: before.task_id,
    taskRevisionBeforeRestart: before.revision,
    taskActionIDBeforeRestart: before.current_action.action_id,
    taskIDAfterRestart: after.task_id,
    taskRevisionAfterRestart: after.revision,
    taskActionIDAfterRestart: after.current_action.action_id,
  };
}

async function digestFile(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function assertSupportedCodexHost(label = "development smoke") {
  if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error(`${label} requires macOS arm64`);
}

async function isolatedEnvironment(layout, codexExecutable) {
  const marker = `${join("node_modules", "")}`;
  const canonicalExecutable = await realpath(codexExecutable);
  const markerIndex = canonicalExecutable.lastIndexOf(`/${marker}`);
  if (markerIndex < 0) throw new Error("Codex executable must come from the isolated 0.147 installation");
  const codexBin = join(canonicalExecutable.slice(0, markerIndex), "node_modules", ".bin");
  const authSource = join(homedir(), ".codex", "auth.json");
  const authInfo = await lstat(authSource);
  if (!authInfo.isFile() || authInfo.isSymbolicLink() || (authInfo.mode & 0o077) !== 0) throw new Error("isolated Codex auth source is unavailable");
  await copyFile(authSource, join(layout.codexHome, "auth.json"));
  await chmod(join(layout.codexHome, "auth.json"), 0o600);
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) if (/(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|AUTH)/iu.test(name)) delete environment[name];
  for (const name of ["CODEX_SESSION_ID", "CODEX_THREAD_ID", "CODEX_INTERNAL_ORIGINATOR_OVERRIDE", "CODEX_SHELL"]) delete environment[name];
  Object.assign(environment, {
    HOME: layout.home,
    CODEX_HOME: layout.codexHome,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    XDG_CACHE_HOME: join(layout.root, "xdg-cache"),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: `${join(layout.installPrefix, "node_modules", ".bin")}:${codexBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
  });
  await mkdir(environment.XDG_CACHE_HOME, { recursive: true, mode: 0o700 });
  return environment;
}

async function assertCodexExecutable(executable, environment) {
  const version = await execFile(executable, ["--version"], { env: environment, encoding: "utf8" });
  const match = /^codex(?:-cli)? (\d+\.\d+\.\d+)$/u.exec(version.stdout.trim());
  if (!match || !versionSatisfiesFixedRange(match[1])) throw new Error("development smoke requires Codex CLI >=0.147.0");
  const inspected = await execFile("file", [executable], { encoding: "utf8" });
  if (!/Mach-O 64-bit executable arm64/u.test(inspected.stdout)) throw new Error("development smoke Codex executable must be macOS arm64");
}

async function execJSON(executable, args, options) {
  const { stdout } = await execFile(executable, args, { ...options, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout);
}

function assertTemporaryBuild(build, artifactDirectory) {
  if (
    build?.final_artifact !== false
    || build.package_version !== "0.1.0"
    || build.core_version !== "0.1.0"
    || build.platform !== "darwin-arm64"
    || typeof build.artifact_path !== "string"
    || relative(artifactDirectory, build.artifact_path).startsWith("..")
  ) throw new Error("development smoke build is not a bounded temporary artifact");
}

async function initializeSmokeRepository(path, environment) {
  await execFile("git", ["init", "--initial-branch=main", "--object-format=sha1"], { cwd: path, env: environment });
  await writeFile(join(path, "README.md"), "Dev Flow Codex development smoke repository.\n");
  await execFile("git", ["add", "README.md"], { cwd: path, env: environment });
  await execFile("git", ["-c", "user.name=Dev Flow Smoke", "-c", "user.email=smoke@example.invalid", "commit", "-m", "smoke baseline"], { cwd: path, env: environment });
  if (await gitStatus(path, environment) !== "") throw new Error("development smoke repository baseline is dirty");
}

async function gitStatus(path, environment) {
  return (await execFile("git", ["status", "--porcelain=v1"], { cwd: path, env: environment, encoding: "utf8" })).stdout;
}

async function snapshotAcceptanceState({ workspace, environment }) {
  requireAbsolute(workspace, "acceptance workspace");
  const dataDirectory = environment.DEV_FLOW_DATA_DIR
    ?? join(environment.HOME ?? homedir(), "Library", "Application Support", "dev-flow", "data");
  const databasePath = join(dataDirectory, "dev-flow.db");
  const core = existsSync(databasePath) ? readCoreRows(databasePath) : emptyCoreRows();
  const [head, status, repositoryDigest] = await Promise.all([
    execFile("git", ["rev-parse", "HEAD"], { cwd: workspace, env: environment, encoding: "utf8" }),
    gitStatus(workspace, environment),
    digestRepositoryContents(workspace),
  ]);
  return {
    core,
    repository: {
      head: head.stdout.trim(),
      status,
      content_sha256: repositoryDigest,
    },
  };
}

function emptyCoreRows() {
  return { tasks: [], task_events: [], repository_claims: [] };
}

function readCoreRows(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = (statement) => database.prepare(statement).all().map((row) => ({ ...row }));
    return {
      tasks: rows(`SELECT task_id, origin_host, phase, revision, repository_identity,
                          hex(snapshot) AS snapshot_hex, created_at, updated_at
                     FROM tasks ORDER BY task_id`),
      task_events: rows(`SELECT event_id, task_id, revision, event_type, phase_before, phase_after,
                                action_id, request_id, payload_digest, created_at
                           FROM task_events ORDER BY event_id`),
      repository_claims: rows(`SELECT repository_identity, task_id, origin_host, claimed_at
                                 FROM repository_claims ORDER BY repository_identity`),
    };
  } finally {
    database.close();
  }
}

async function digestRepositoryContents(root) {
  const digest = createHash("sha256");
  const visit = async (directory, prefix = "") => {
    const names = (await readdir(directory)).sort();
    for (const name of names) {
      if (prefix === "" && name === ".git") continue;
      const path = join(directory, name);
      const relativePath = prefix === "" ? name : join(prefix, name);
      const metadata = await lstat(path);
      if (metadata.isDirectory()) {
        digest.update(`directory\0${relativePath}\0${metadata.mode & 0o777}\0`);
        await visit(path, relativePath);
      } else if (metadata.isFile()) {
        digest.update(`file\0${relativePath}\0${metadata.mode & 0o777}\0`);
        digest.update(await readFile(path));
        digest.update("\0");
      } else if (metadata.isSymbolicLink()) {
        digest.update(`symlink\0${relativePath}\0${await readlink(path)}\0`);
      } else {
        digest.update(`other\0${relativePath}\0${metadata.mode}\0`);
      }
    }
  };
  await visit(root);
  return digest.digest("hex");
}

async function unexpectedRepositoryPaths(path, environment, allowedPath = "native-proof.txt") {
  return (await gitStatus(path, environment)).split("\n").filter(Boolean)
    .map((line) => line.slice(3)).filter((name) => name !== allowedPath);
}

async function pathExists(path) {
  try { await lstat(path); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function writeSmokeOutput(directory, name, value) {
  await writeFile(join(directory, name), `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

async function readRetainedTask(runtimePath, dataDirectory, repository, taskID, environment) {
  const envelope = await callPackagedCoreTool(
    runtimePath,
    dataDirectory,
    repository,
    "dev_flow_get_task",
    { host: "codex", task_id: taskID },
    environment,
  );
  if (envelope?.ok !== true || envelope.result?.task?.task_id !== taskID) {
    throw new Error("packaged Core retained-task result is incomplete");
  }
  return envelope.result.task;
}

async function withPackagedCoreRPC(runtimePath, dataDirectory, repository, environment, operation) {
  const child = spawn(runtimePath, ["mcp", "--stdio"], {
    cwd: repository, env: { ...environment, DEV_FLOW_DATA_DIR: dataDirectory }, stdio: ["pipe", "pipe", "pipe"], shell: false,
  });
  const pending = new Map();
  let nextID = 1;
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    const waiter = pending.get(response.id);
    if (waiter) { clearTimeout(waiter.timer); pending.delete(response.id); waiter.resolve(response); }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextID++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`packaged Core request timed out: ${method}`)); }, 10_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
  const initialized = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "dev-flow-development-smoke", version: "0.1.0" } });
  if (initialized.result?.serverInfo?.name !== "dev-flow") throw new Error("packaged Core initialize failed");
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  try {
    return await operation(request);
  } finally {
    child.stdin.end();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("packaged Core did not stop after EOF")); }, 10_000);
      child.once("exit", (code, signal) => { clearTimeout(timer); code === 0 && signal === null ? resolve() : reject(new Error("packaged Core exited unexpectedly")); });
    });
  }
}

async function callPackagedCoreTool(runtimePath, dataDirectory, repository, tool, arguments_, environment) {
  return withPackagedCoreRPC(runtimePath, dataDirectory, repository, environment, async (request) => {
    const response = await request("tools/call", { name: tool, arguments: arguments_ });
    let result;
    try {
      result = JSON.parse(response.result?.content?.[0]?.text ?? "null");
    } catch {
      throw new Error("packaged Core returned malformed tool text");
    }
    if (response.result?.structuredContent !== undefined && response.result.structuredContent !== null && !isDeepStrictEqual(result, response.result.structuredContent)) {
      throw new Error("packaged Core text and structured results differ");
    }
    if (!isPlainObject(result)) throw new Error("packaged Core tool result is incomplete");
    return result;
  });
}

async function listPackagedCoreTools(runtimePath, dataDirectory, repository, environment) {
  return withPackagedCoreRPC(runtimePath, dataDirectory, repository, environment, async (request) => {
    const response = await request("tools/list", {});
    if (!Array.isArray(response.result?.tools)) throw new Error("packaged Core tool catalog is incomplete");
    return response.result.tools;
  });
}

export async function defaultRunProcess(executable, args, {
  cwd,
  env,
  stopAfterApplyPath = null,
  stopAfterApplyContent = null,
}) {
  return streamingCodexProcess(executable, args, { cwd, env, stopAfterApplyPath, stopAfterApplyContent });
}

async function streamingCodexProcess(executable, args, {
  cwd,
  env,
  stopAfterApplyPath,
  stopAfterApplyContent,
}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], shell: false });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let lineBuffer = "";
    let intentionalStop = false;
    let overflow = false;
    const append = (target, chunk, stream) => {
      const length = stream === "stdout" ? stdoutBytes : stderrBytes;
      if (length + chunk.length > 8 * 1024 * 1024) { overflow = true; child.kill("SIGTERM"); return; }
      target.push(chunk);
      if (stream === "stdout") stdoutBytes += chunk.length; else stderrBytes += chunk.length;
    };
    child.stdout.on("data", (chunk) => {
      append(stdout, chunk, "stdout");
      lineBuffer += chunk.toString("utf8");
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop();
      for (const line of lines) {
        if (
          !intentionalStop
          && successfulNonterminalApplyEvent(line)
          && exactProofExists(stopAfterApplyPath, stopAfterApplyContent)
        ) {
          intentionalStop = true;
          child.kill("SIGTERM");
        }
      }
    });
    child.stderr.on("data", (chunk) => append(stderr, chunk, "stderr"));
    const timer = setTimeout(() => child.kill("SIGTERM"), 300_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout: Buffer.concat(stdout).toString("utf8"), stderr: String(error.message) });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: intentionalStop && !overflow ? 0 : (Number.isInteger(code) ? code : 1),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        signal,
      });
    });
  });
}

export function successfulNonterminalApplyEvent(line) {
  try {
    const event = JSON.parse(line);
    const item = event?.type === "item.completed" ? event.item : null;
    if (
      item?.type !== "mcp_tool_call"
      || item.server !== "dev-flow"
      || item.tool !== "dev_flow_apply_action"
      || item.status !== "completed"
    ) return false;
    const structured = item.result?.structured_content ?? item.result?.structuredContent;
    const envelope = structured ?? JSON.parse(item.result?.content?.[0]?.text ?? "null");
    const result = envelope?.result;
    const task = isPlainObject(result?.task) ? result.task : result;
    return envelope?.ok === true
      && isPlainObject(task)
      && typeof task.current_cursor === "string"
      && task.current_cursor !== "DONE"
      && (task.outcome === null || task.outcome === undefined);
  } catch { return false; }
}

function exactProofExists(path, expectedContent) {
  if (typeof path !== "string" || typeof expectedContent !== "string") return false;
  try { return existsSync(path) && readFileSync(path).equals(Buffer.from(expectedContent)); } catch { return false; }
}

function requireAbsolute(value, label) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
}

function requireSourceCommit(value, label = "source commit") {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${label} must be a 40-character lowercase Git SHA`);
  }
}

export function createMultiRepositoryJourneyLayout(root) {
  requireAbsolute(root, "multi-repository journey root");
  return Object.freeze({
    root,
    home: join(root, "home"),
    codexHome: join(root, "codex-home"),
    temporaryDirectory: join(root, "tmp"),
    primaryRepository: join(root, "core"),
    additionalRepository: join(root, "docs"),
    dataDirectory: join(root, "data"),
    installPrefix: join(root, "npm-prefix"),
    npmCache: join(root, "npm-cache"),
    artifactDirectory: join(root, "artifact"),
  });
}

export async function prepareMultiRepositoryEnvironment(
  layout,
  codexExecutable,
  baseEnvironment = process.env,
) {
  requireAbsolute(codexExecutable, "Codex executable");
  const originalHome = resolve(baseEnvironment.HOME ?? homedir());
  const authenticationRoot = resolve(baseEnvironment.CODEX_HOME ?? join(originalHome, ".codex"));
  const authenticationSource = join(authenticationRoot, "auth.json");
  const authenticationInfo = await lstat(authenticationSource);
  if (
    !authenticationInfo.isFile()
    || authenticationInfo.isSymbolicLink()
    || (authenticationInfo.mode & 0o077) !== 0
  ) {
    throw new Error("multi-repository journey Codex authentication source is unavailable");
  }
  const authenticationDestination = join(layout.codexHome, "auth.json");
  await copyFile(authenticationSource, authenticationDestination);
  await chmod(authenticationDestination, 0o600);

  const environment = { ...baseEnvironment };
  for (const name of Object.keys(environment)) {
    if (/(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|AUTH)/iu.test(name)) {
      delete environment[name];
    }
  }
  for (const name of ["CODEX_SESSION_ID", "CODEX_THREAD_ID", "CODEX_INTERNAL_ORIGINATOR_OVERRIDE", "CODEX_SHELL"]) {
    delete environment[name];
  }
  Object.assign(environment, {
    HOME: layout.home,
    CODEX_HOME: layout.codexHome,
    TMPDIR: layout.temporaryDirectory,
    DEV_FLOW_DATA_DIR: layout.dataDirectory,
    npm_config_prefix: layout.installPrefix,
    npm_config_cache: layout.npmCache,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    NO_COLOR: "1",
    PATH: [
      join(layout.installPrefix, "node_modules", ".bin"),
      dirname(codexExecutable),
      baseEnvironment.PATH ?? "/usr/bin:/bin",
    ].join(delimiter),
  });
  return environment;
}

function assertMultiRepositoryBuildIdentity(build, layout, sourceCommit) {
  if (
    !isPlainObject(build)
    || build.source_commit !== sourceCommit
    || typeof build.artifact_path !== "string"
    || !isAbsolute(build.artifact_path)
    || !pathWithin(layout.artifactDirectory, build.artifact_path)
    || typeof build.package_version !== "string"
    || typeof build.core_version !== "string"
    || build.source_dirty !== false
    || build.platform !== "darwin-arm64"
  ) {
    throw new Error("multi-repository source package identity does not match the requested source commit");
  }
}

export async function buildMultiRepositorySourcePackage({ layout }) {
  return execJSON(
    join(REPOSITORY_ROOT, "scripts", "build-codex-local.sh"),
    ["--output", layout.artifactDirectory],
    { cwd: REPOSITORY_ROOT },
  );
}

export async function installMultiRepositorySourcePackage({ layout, build, environment }) {
  await execFile("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    "--prefix", layout.installPrefix, build.artifact_path,
  ], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const packageRoot = await realpath(join(layout.installPrefix, "node_modules", "dev-flow-codex"));
  const packageCLI = join(layout.installPrefix, "node_modules", ".bin", "dev-flow-codex");
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  if (!pathWithin(layout.installPrefix, packageRoot) || pathWithin(REPOSITORY_ROOT, packageRoot)) {
    throw new Error("multi-repository installed package is outside the isolated npm prefix");
  }
  return Object.freeze({ packageRoot, packageCLI, runtimePath, sourceCommit: build.source_commit });
}

export async function setupMultiRepositorySourcePackage({ layout, product, environment }) {
  return execJSON(product.packageCLI, ["setup", "--json"], {
    cwd: layout.primaryRepository,
    env: environment,
  });
}

async function executableOnEnvironmentPath(name, environment) {
  for (const directory of (environment.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = resolve(directory, name);
    try {
      const info = await stat(candidate);
      if (info.isFile() && (info.mode & 0o111) !== 0) return realpath(candidate);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }
  throw new Error(`multi-repository setup cannot resolve ${name} from the isolated environment`);
}

export async function verifyMultiRepositorySetupReadback({
  layout,
  build,
  product,
  setup,
  environment,
}) {
  if (setup?.operation !== "setup" || !["installed", "already-installed"].includes(setup.status)) {
    throw new Error("multi-repository local package setup failed");
  }
  if (
    environment.HOME !== layout.home
    || environment.CODEX_HOME !== layout.codexHome
    || environment.npm_config_prefix !== layout.installPrefix
    || environment.npm_config_cache !== layout.npmCache
  ) {
    throw new Error("multi-repository setup environment is not isolated");
  }

  const receiptPath = join(
    layout.home,
    "Library", "Application Support", "dev-flow", "registrations", "codex.json",
  );
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const configurationPath = join(layout.codexHome, "config.toml");
  const configurationInfo = await lstat(configurationPath);
  const mcp = JSON.parse(await readFile(join(product.packageRoot, "plugin", ".mcp.json"), "utf8"));
  const resolvedCLI = await executableOnEnvironmentPath("dev-flow-codex", environment);
  const packageCLI = await realpath(product.packageCLI);
  const runtimeInfo = await stat(product.runtimePath);
  if (
    setup.receipt_path !== receiptPath
    || receipt?.paths?.receipt_path !== receiptPath
    || receipt?.paths?.package_root !== product.packageRoot
    || receipt?.paths?.runtime_path !== product.runtimePath
    || receipt?.paths?.data_dir !== layout.dataDirectory
    || receipt?.registration?.marketplace_root !== product.packageRoot
    || receipt?.registration?.plugin_root !== join(product.packageRoot, "plugin")
    || !configurationInfo.isFile()
    || configurationInfo.isSymbolicLink()
    || !runtimeInfo.isFile()
    || (runtimeInfo.mode & 0o111) === 0
    || resolvedCLI !== packageCLI
    || mcp?.mcpServers?.["dev-flow"]?.command !== "dev-flow-codex"
    || !isDeepStrictEqual(mcp?.mcpServers?.["dev-flow"]?.args, ["mcp"])
    || product.sourceCommit !== build.source_commit
  ) {
    throw new Error("multi-repository setup readback does not bind the isolated source package");
  }
  const packageVersion = await execFile(product.packageCLI, ["--version"], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  const coreVersion = await execFile(product.runtimePath, ["version"], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  if (
    packageVersion.stdout !== `dev-flow-codex ${build.package_version} (core ${build.core_version})\n`
    || coreVersion.stdout !== `dev-flow ${build.core_version}\n`
  ) {
    throw new Error("multi-repository installed package or bundled Core identity differs from the build");
  }
  return Object.freeze({ setupReadbackPassed: true, sourceCommit: product.sourceCommit });
}

function digestText(value) {
  return createHash("sha256").update(typeof value === "string" ? value : "").digest("hex");
}

function assertMultiRepositoryEvidenceSanitized(evidence, fields, label) {
  assertExactFields(evidence, fields, label);
  const serialized = JSON.stringify(evidence);
  if (
    /(?:\/Users\/|\/home\/|[A-Za-z]:\\\\|auth\.json|CODEX_HOME|HOME=|"(?:prompt|stdout|stderr|environment|token|secret|auth)"\s*:)/u
      .test(serialized)
  ) {
    throw new Error(`${label} contains private path, raw session data, or authentication material`);
  }
}

function multiRepositoryFailureClassification(error, processResult) {
  const known = new Set(["core-domain-error", "transport-error", "session-error", "parser-error"]);
  if (known.has(error?.classification)) return error.classification;
  return processResult === null ? "process-error" : "post-session-validation";
}

function summarizeMultiRepositoryCalls(processResult) {
  const empty = {
    threadStarted: false,
    callCount: 0,
    firstTool: null,
    firstClassification: null,
    firstErrorCode: null,
    toolSequence: [],
  };
  if (typeof processResult?.stdout !== "string") return empty;
  let parsed;
  try {
    parsed = parseCodexJSONL(processResult.stdout);
  } catch {
    return empty;
  }
  const calls = parsed.calls.slice(0, MULTI_REPOSITORY_CALL_SUMMARY_LIMIT);
  const first = calls[0] ?? null;
  return {
    threadStarted: typeof parsed.threadId === "string" && parsed.threadId.length > 0,
    callCount: Math.min(parsed.calls.length, MULTI_REPOSITORY_CALL_SUMMARY_LIMIT),
    firstTool: first?.tool ?? null,
    firstClassification: first === null ? null : displayShape(first.shape),
    firstErrorCode: first?.shape === "core_domain_error"
      ? first.structuredContent?.error?.code ?? null
      : null,
    toolSequence: calls.map((call) => call.tool),
  };
}

function buildMultiRepositoryFailureEvidence({
  sourceCommit,
  error,
  processResult,
  setupReadbackPassed,
  sessionRole,
}) {
  const classification = multiRepositoryFailureClassification(error, processResult);
  const exitCode = Number.isInteger(processResult?.exitCode)
    ? processResult.exitCode
    : Number.isInteger(error?.exitCode) ? error.exitCode : null;
  const calls = summarizeMultiRepositoryCalls(processResult);
  const failedCall = error?.call ?? null;
  const failedTool = DEV_FLOW_TOOLS.includes(failedCall?.tool) ? failedCall.tool : null;
  const failedErrorCode = typeof failedCall?.structuredContent?.error?.code === "string"
    ? failedCall.structuredContent.error.code
    : null;
  const failedRequestBinding = ["missing", "mismatched"].includes(failedCall?.requestBinding)
    ? failedCall.requestBinding
    : null;
  const evidence = {
    evidence_kind: MULTI_REPOSITORY_EVIDENCE_KIND,
    status: "failed",
    source_commit: sourceCommit,
    host: "codex",
    runner_mode: "multi-repository",
    journey_budget: "1/1",
    failure_stage: classification === "post-session-validation" ? "evidence-validation" : "codex-session",
    failure_classification: classification,
    session_role: error?.role ?? sessionRole,
    exit_code: exitCode,
    stdout_sha256: digestText(processResult?.stdout ?? error?.stdout),
    stderr_sha256: digestText(processResult?.stderr ?? error?.stderr),
    setup_readback_passed: setupReadbackPassed === true,
    thread_started: calls.threadStarted,
    dev_flow_call_count: calls.callCount,
    first_dev_flow_tool: calls.firstTool,
    first_dev_flow_classification: calls.firstClassification,
    first_dev_flow_error_code: calls.firstErrorCode,
    dev_flow_tool_sequence: calls.toolSequence,
    failed_dev_flow_tool: failedTool,
    failed_dev_flow_error_code: failedErrorCode,
    failed_request_binding: failedRequestBinding,
    observed_at: new Date().toISOString(),
  };
  assertMultiRepositoryEvidenceSanitized(
    evidence,
    MULTI_REPOSITORY_FAILURE_FIELDS,
    "multi-repository failure evidence",
  );
  return Object.freeze(evidence);
}

export async function runMultiRepositoryJourney(options) {
  requireAbsolute(options.codexExecutable, "Codex executable");
  requireAbsolute(options.resultFile, "multi-repository evidence file");
  requireSourceCommit(options.sourceCommit, "multi-repository source commit");
  if (await pathExists(options.resultFile)) throw new Error("multi-repository evidence file already exists");
  await mkdir(dirname(options.resultFile), { recursive: true, mode: 0o700 });
  const transcriptPaths = Object.freeze({
    substantive: `${options.resultFile}.substantive.raw.jsonl`,
    resume: `${options.resultFile}.resume.raw.jsonl`,
  });
  for (const transcriptPath of Object.values(transcriptPaths)) {
    if (await pathExists(transcriptPath)) {
      throw new Error(`multi-repository raw transcript already exists: ${basename(transcriptPath)}`);
    }
  }

  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-multi-repository-")));
  let invocationStarted = false;
  let processResult = null;
  let setupReadbackPassed = false;
  let currentRole = null;
  try {
    const layout = createMultiRepositoryJourneyLayout(root);
    await Promise.all(Object.entries(layout)
      .filter(([name]) => name !== "root")
      .map(([, path]) => mkdir(path, { recursive: true, mode: 0o700 })));
    const prepareEnvironment = options.prepareEnvironment ?? prepareMultiRepositoryEnvironment;
    const environment = await prepareEnvironment(
      layout,
      options.codexExecutable,
      options.baseEnvironment ?? process.env,
    );
    await Promise.all([
      initializeSmokeRepository(layout.primaryRepository, environment),
      initializeSmokeRepository(layout.additionalRepository, environment),
    ]);

    const buildPackage = options.buildPackage ?? buildMultiRepositorySourcePackage;
    const installPackage = options.installPackage ?? installMultiRepositorySourcePackage;
    const setupPackage = options.setupPackage ?? setupMultiRepositorySourcePackage;
    const verifySetup = options.verifySetup ?? verifyMultiRepositorySetupReadback;
    const build = await buildPackage({ layout, sourceCommit: options.sourceCommit, environment });
    assertMultiRepositoryBuildIdentity(build, layout, options.sourceCommit);
    const product = await installPackage({ layout, build, environment });
    const setup = await setupPackage({ layout, build, product, environment });
    const readback = await verifySetup({ layout, build, product, setup, environment });
    if (readback?.setupReadbackPassed !== true || readback.sourceCommit !== options.sourceCommit) {
      throw new Error("multi-repository setup readback source identity differs from the requested commit");
    }
    setupReadbackPassed = true;

    const actualRunProcess = options.runProcess ?? defaultRunProcess;
    const budgetedRunProcess = async (...args) => {
      invocationStarted = true;
      processResult = await actualRunProcess(...args);
      return processResult;
    };

    currentRole = "multi-repository-substantive";
    const substantive = await runCodexSession({
      codexExecutable: options.codexExecutable,
      workspace: layout.primaryRepository,
      role: currentRole,
      prompt: multiRepositorySubstantivePrompt(layout.primaryRepository, layout.additionalRepository),
      runProcess: budgetedRunProcess,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      ignoreRules: false,
      workspaceWrite: true,
      transcriptPath: transcriptPaths.substantive,
      additionalWritableRoots: [layout.additionalRepository],
    });
    currentRole = "multi-repository-resume";
    const resume = await runCodexSession({
      codexExecutable: options.codexExecutable,
      workspace: layout.additionalRepository,
      role: currentRole,
      prompt: multiRepositoryResumePrompt(layout.additionalRepository),
      runProcess: budgetedRunProcess,
      includeCallFacts: true,
      environment,
      ephemeral: true,
      ignoreRules: false,
      workspaceWrite: true,
      transcriptPath: transcriptPaths.resume,
      additionalWritableRoots: [layout.primaryRepository],
    });
    if (await pathExists(join(layout.home, ".dev-flow", "config.json"))) {
      throw new Error("multi-repository journey created a Dev Flow user configuration file");
    }
    const evidence = await buildMultiRepositoryEvidence(
      [substantive, resume],
      layout,
      options.sourceCommit,
      setupReadbackPassed,
    );
    await writeFile(options.resultFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    currentRole = null;
    return evidence;
  } catch (error) {
    if (invocationStarted) {
      const evidence = buildMultiRepositoryFailureEvidence({
        sourceCommit: options.sourceCommit,
        error,
        processResult,
        setupReadbackPassed,
        sessionRole: currentRole,
      });
      await writeFile(options.resultFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    }
    throw error;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function multiRepositoryActionIdentity(task, label) {
  if (task?.current_action === null) return { actionID: null, digest: null };
  if (
    !isPlainObject(task?.current_action)
    || typeof task.current_action.action_id !== "string"
    || task.current_action.action_id.length === 0
    || typeof task.current_action.repository_binding_digest !== "string"
    || task.current_action.repository_binding_digest.length === 0
    || Object.hasOwn(task.current_action, "repository_scope_digest")
  ) {
    throw new Error(`${label} current Action identity is invalid`);
  }
  return {
    actionID: task.current_action.action_id,
    digest: task.current_action.repository_binding_digest,
  };
}

export async function buildMultiRepositoryEvidence(
  sessions,
  layout,
  sourceCommit,
  setupReadbackPassed,
) {
  requireSourceCommit(sourceCommit, "multi-repository source commit");
  if (setupReadbackPassed !== true) {
    throw new Error("multi-repository success evidence requires setup readback");
  }
  if (
    !Array.isArray(sessions)
    || sessions.length !== 2
    || sessions[0]?.role !== "multi-repository-substantive"
    || sessions[1]?.role !== "multi-repository-resume"
  ) {
    throw new Error("multi-repository journey requires substantive and resume Codex sessions");
  }
  const [substantive, resume] = sessions;
  if (
    typeof substantive.thread_id !== "string"
    || typeof resume.thread_id !== "string"
    || substantive.thread_id === resume.thread_id
  ) {
    throw new Error("multi-repository journey requires two distinct Codex sessions");
  }
  for (const session of sessions) {
    if (
      session.dev_flow_calls?.[0]?.tool !== "dev_flow_server_info"
      || session.dev_flow_calls[0].classification !== "success"
    ) {
      throw new Error("multi-repository journey requires server-info as the first Dev Flow call in each session");
    }
    const sessionInfo = session.dev_flow_calls[0].core_result?.result;
    if (
      !isDeepStrictEqual(sessionInfo?.tools, DEV_FLOW_TOOLS)
      || sessionInfo?.host_preferences?.codex?.codebase_memory !== false
      || sessionInfo?.host_preferences?.deepseek?.codebase_memory !== false
    ) {
      throw new Error("multi-repository journey server-info contract is incomplete");
    }
    if (!Array.isArray(session.mcp_calls) || session.mcp_calls.some((call) => call.server !== "dev-flow")) {
      throw new Error("multi-repository journey must not call non-Dev-Flow MCP servers");
    }
  }

  const substantiveCalls = substantive.dev_flow_calls;
  const resumeCalls = resume.dev_flow_calls;
  const substantiveOpens = substantiveCalls.filter((call) => (
    call.tool === "dev_flow_open_task" && call.classification === "success"
  ));
  const resumeOpens = resumeCalls.filter((call) => (
    call.tool === "dev_flow_open_task" && call.classification === "success"
  ));
  if (substantiveOpens.length !== 1 || resumeOpens.length !== 1) {
    throw new Error("multi-repository journey requires exactly one create and one resume");
  }
  const [created] = substantiveOpens;
  const [resumed] = resumeOpens;
  const createdTask = taskFromCall(created);
  const resumedTask = taskFromCall(resumed);
  if (
    created?.arguments?.repository_path !== layout.primaryRepository
    || created?.arguments?.primary_repository_key !== "core"
    || !isDeepStrictEqual(created?.arguments?.additional_repositories, [
      { key: "docs", repository_path: layout.additionalRepository },
    ])
    || resumed?.arguments?.primary_repository_key !== undefined
    || resumed?.arguments?.additional_repositories !== undefined
  ) throw new Error("multi-repository journey open-task Scope arguments are invalid");
  if (
    created?.arguments?.new_task === null
    || created?.arguments?.new_task === undefined
    || resumed?.arguments?.new_task !== null
    || resumed?.arguments?.repository_path !== layout.additionalRepository
  ) {
    throw new Error("multi-repository journey create/resume roles are invalid");
  }
  if (
    !createdTask
    || createdTask.primary_repository_key !== "core"
    || !isDeepStrictEqual(createdTask.additional_repositories?.map(({ key }) => key), ["docs"])
    || Object.hasOwn(createdTask, "repository_scope_digest")
  ) throw new Error("multi-repository journey Task projection is invalid");

  if (resumeCalls.some((call) => call.tool === "dev_flow_apply_action")) {
    throw new Error("multi-repository resume session must not mutate the Task");
  }
  const successfulApplies = substantiveCalls.filter((call) => (
    call.tool === "dev_flow_apply_action" && call.classification === "success"
  ));
  if (successfulApplies.length < 1) throw new Error("multi-repository journey recorded no Action mutation");
  const beforeResumeTask = lastTask(successfulApplies);
  const taskIDs = new Set(
    [...substantiveCalls, ...resumeCalls].map(taskFromCall).filter(Boolean).map((task) => task.task_id),
  );
  if (taskIDs.size !== 1) throw new Error("multi-repository journey created more than one Core Task");
  if (
    !createdTask
    || !beforeResumeTask
    || !resumedTask
    || createdTask.task_id !== beforeResumeTask.task_id
    || beforeResumeTask.task_id !== resumedTask.task_id
  ) {
    throw new Error("multi-repository journey did not resume the post-mutation Task from the additional repository");
  }
  if (!Number.isInteger(beforeResumeTask.revision) || !Number.isInteger(resumedTask.revision)) {
    throw new Error("multi-repository journey resume revision is invalid");
  }
  const beforeAction = multiRepositoryActionIdentity(beforeResumeTask, "post-mutation Task");
  const afterAction = multiRepositoryActionIdentity(resumedTask, "resumed Task");
  if (beforeResumeTask.task_id !== resumedTask.task_id) {
    throw new Error("multi-repository journey resume task identity differs from the last successful apply");
  }
  if (beforeResumeTask.revision !== resumedTask.revision) {
    throw new Error("multi-repository journey resume revision differs from the last successful apply");
  }
  if (beforeAction.actionID !== afterAction.actionID) {
    throw new Error("multi-repository journey resume Action identity differs from the last successful apply");
  }
  if (beforeAction.digest !== afterAction.digest) {
    throw new Error("multi-repository journey resume Action digest differs from the last successful apply");
  }
  if (
    createdTask.primary_repository_key !== beforeResumeTask.primary_repository_key
    || beforeResumeTask.primary_repository_key !== resumedTask.primary_repository_key
    || !isDeepStrictEqual(
      createdTask.additional_repositories?.map(({ key }) => key),
      beforeResumeTask.additional_repositories?.map(({ key }) => key),
    )
    || !isDeepStrictEqual(
      beforeResumeTask.additional_repositories?.map(({ key }) => key),
      resumedTask.additional_repositories?.map(({ key }) => key),
    )
  ) {
    throw new Error("multi-repository journey resume Repository Scope differs from the last successful apply");
  }
  if ((await readFile(join(layout.primaryRepository, "core-proof.txt"), "utf8")) !== "core proof\n"
    || (await readFile(join(layout.additionalRepository, "docs-proof.txt"), "utf8")) !== "docs proof\n") {
    throw new Error("multi-repository journey proof bytes differ");
  }

  const evidence = {
    evidence_kind: MULTI_REPOSITORY_EVIDENCE_KIND,
    status: "passed",
    source_commit: sourceCommit,
    host: "codex",
    runner_mode: "multi-repository",
    journey_budget: "1/1",
    setup_readback_passed: true,
    codex_session_count: 2,
    task_id: beforeResumeTask.task_id,
    primary_repository_key: "core",
    additional_repository_keys: ["docs"],
    repository_count: 2,
    revision_before_resume: beforeResumeTask.revision,
    revision_after_resume: resumedTask.revision,
    action_id_before_resume: beforeAction.actionID,
    action_id_after_resume: afterAction.actionID,
    repository_binding_digest_before_resume: beforeAction.digest,
    repository_binding_digest_after_resume: afterAction.digest,
    resumed_from_additional_repository: true,
    one_core_task: true,
    scoped_paths: ["core::core-proof.txt", "docs::docs-proof.txt"],
    successful_action_count: successfulApplies.length,
    tool_catalog_size: substantiveCalls[0].core_result.result.tools.length,
    codebase_memory_preference: false,
    observed_at: new Date().toISOString(),
  };
  assertMultiRepositoryEvidenceSanitized(
    evidence,
    MULTI_REPOSITORY_SUCCESS_FIELDS,
    "multi-repository success evidence",
  );
  return Object.freeze(evidence);
}

export function parseCLI(argv) {
  const mode = argv.shift();
  if (mode === "multi-repository") {
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (
        !["--codex-executable", "--result-file", "--source-commit"].includes(flag)
        || Object.hasOwn(values, flag)
        || argv.length === 0
      ) {
        throw new Error("multi-repository journey requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (!values["--codex-executable"] || !values["--result-file"] || !values["--source-commit"]) {
      throw new Error("multi-repository journey requires --codex-executable ABS --result-file ABS.json --source-commit COMMIT");
    }
    requireAbsolute(values["--codex-executable"], "Codex executable");
    requireAbsolute(values["--result-file"], "multi-repository evidence file");
    requireSourceCommit(values["--source-commit"], "multi-repository source commit");
    return {
      mode,
      codexExecutable: values["--codex-executable"],
      resultFile: values["--result-file"],
      sourceCommit: values["--source-commit"],
    };
  }
  if (mode === "acceptance-report") {
    if (argv.length !== 2 || argv[0] !== "--report") {
      throw new Error("acceptance-report requires --report ABS");
    }
    requireAbsolute(argv[1], "acceptance report");
    return { mode, reportPath: argv[1] };
  }
  if (mode === "final-registry" || mode === "quick-registry") {
    const flags = [
      "--package", "--version", "--registry", "--tarball-sha256", "--core-version", "--core-sha256",
      "--source-commit", "--codex-executable", "--workspace", "--result-directory",
    ];
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (!flags.includes(flag) || Object.hasOwn(values, flag) || argv.length === 0) {
        throw new Error("registry journey requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (flags.some((flag) => !Object.hasOwn(values, flag))) {
      throw new Error("registry journey requires each exact flag once");
    }
    if (values["--package"] !== "dev-flow-codex") {
      throw new Error("registry journey package must equal dev-flow-codex");
    }
    if (values["--registry"] !== OFFICIAL_NPM_REGISTRY) {
      throw new Error("registry journey requires the official npm registry");
    }
    requireReleaseVersion(values["--version"]);
    requireReleaseVersion(values["--core-version"]);
    requireDigest(values["--tarball-sha256"], "tarball-sha256");
    requireDigest(values["--core-sha256"], "core-sha256");
    if (!/^[0-9a-f]{40}$/u.test(values["--source-commit"])) {
      throw new Error("final registry journey source commit must be a lowercase 40-character digest");
    }
    requireAbsolute(values["--codex-executable"], "Codex executable");
    requireAbsolute(values["--workspace"], "workspace");
    requireAbsolute(values["--result-directory"], "final journey result directory");
    return {
      mode,
      packageName: values["--package"],
      version: values["--version"],
      registry: values["--registry"],
      tarballSHA256: values["--tarball-sha256"],
      coreVersion: values["--core-version"],
      coreSHA256: values["--core-sha256"],
      sourceCommit: values["--source-commit"],
      codexExecutable: values["--codex-executable"],
      workspace: values["--workspace"],
      resultDirectory: values["--result-directory"],
    };
  }
  if (mode === "final-local-lifecycle") {
    const flags = [
      "--artifact", "--artifact-sha256", "--artifact-size", "--core-sha256", "--source-commit",
      "--native-result-directory", "--workspace", "--result-directory",
    ];
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (!flags.includes(flag) || Object.hasOwn(values, flag) || argv.length === 0) {
        throw new Error("final local lifecycle requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (flags.some((flag) => !Object.hasOwn(values, flag))) {
      throw new Error("final local lifecycle requires each exact flag once");
    }
    requireAbsolute(values["--artifact"], "lifecycle artifact");
    requireDigest(values["--artifact-sha256"], "artifact-sha256");
    requireDigest(values["--core-sha256"], "core-sha256");
    if (!/^[1-9][0-9]*$/u.test(values["--artifact-size"])) throw new Error("lifecycle artifact size must be a positive integer");
    if (!/^[0-9a-f]{40}$/u.test(values["--source-commit"])) throw new Error("lifecycle source commit is invalid");
    requireAbsolute(values["--native-result-directory"], "Attempt 3 result directory");
    requireAbsolute(values["--workspace"], "lifecycle workspace");
    requireAbsolute(values["--result-directory"], "lifecycle result directory");
    return {
      mode,
      artifact: values["--artifact"],
      artifactSHA256: values["--artifact-sha256"],
      artifactSize: Number(values["--artifact-size"]),
      coreSHA256: values["--core-sha256"],
      sourceCommit: values["--source-commit"],
      nativeResultDirectory: values["--native-result-directory"],
      workspace: values["--workspace"],
      resultDirectory: values["--result-directory"],
    };
  }
  if (mode === "final-local") {
    const flags = [
      "--artifact", "--artifact-sha256", "--artifact-size", "--source-commit",
      "--codex-executable", "--workspace", "--result-directory", "--native-attempt", "--authorization",
    ];
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (!flags.includes(flag) || Object.hasOwn(values, flag) || argv.length === 0) {
        throw new Error("final local journey requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (flags.some((flag) => !Object.hasOwn(values, flag))) {
      throw new Error("final local journey requires each exact flag once");
    }
    requireAbsolute(values["--artifact"], "local artifact");
    requireDigest(values["--artifact-sha256"], "artifact-sha256");
    if (!/^[1-9][0-9]*$/u.test(values["--artifact-size"])) throw new Error("final local artifact size must be a positive integer");
    if (!/^[0-9a-f]{40}$/u.test(values["--source-commit"])) throw new Error("final local source commit is invalid");
    if (values["--native-attempt"] !== "3" || values["--authorization"] !== "explicit_user_authorization") {
      throw new Error("final local attempt 3 requires explicit user authorization");
    }
    requireAbsolute(values["--codex-executable"], "Codex executable");
    requireAbsolute(values["--workspace"], "final local workspace");
    requireAbsolute(values["--result-directory"], "final local result directory");
    return {
      mode,
      artifact: values["--artifact"],
      artifactSHA256: values["--artifact-sha256"],
      artifactSize: Number(values["--artifact-size"]),
      sourceCommit: values["--source-commit"],
      codexExecutable: values["--codex-executable"],
      workspace: values["--workspace"],
      resultDirectory: values["--result-directory"],
      nativeAttempt: 3,
      authorization: values["--authorization"],
    };
  }
  if (mode === "development-smoke") {
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (!['--run-label', '--codex-executable', '--result-directory'].includes(flag) || flag in values || argv.length === 0) {
        throw new Error("development smoke requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (!['A', 'B', 'C', 'D'].includes(values['--run-label'])) throw new Error("development smoke run label must be A, B, C, or D");
    requireAbsolute(values['--codex-executable'], "Codex executable");
    requireAbsolute(values['--result-directory'], "development smoke result directory");
    return {
      mode,
      runLabel: values['--run-label'],
      codexExecutable: values['--codex-executable'],
      resultDirectory: values['--result-directory'],
    };
  }
  if (!["smoke", "acceptance"].includes(mode)) {
    throw new Error("mode must be multi-repository, smoke, acceptance, development-smoke, final-local-lifecycle, final-local, final-registry, or acceptance-report");
  }
  const values = {};
  while (argv.length > 0) {
    const flag = argv.shift();
    if (!["--codex-executable", "--workspace"].includes(flag) || flag in values || argv.length === 0) {
      throw new Error("real smoke requires each exact path flag once");
    }
    values[flag] = argv.shift();
  }
  if (!values["--codex-executable"] || !values["--workspace"]) {
    throw new Error("real smoke requires --codex-executable ABS --workspace ABS");
  }
  return {
    mode,
    codexExecutable: values["--codex-executable"],
    workspace: values["--workspace"],
  };
}

async function main(argv) {
  const options = parseCLI([...argv]);
  if (options.mode === "acceptance-report") {
    const report = validateAcceptanceReport(JSON.parse(await readFile(options.reportPath, "utf8")));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  const summary = options.mode === "smoke"
    ? await runDevelopmentSmoke(options)
    : options.mode === "multi-repository"
      ? await runMultiRepositoryJourney(options)
      : options.mode === "development-smoke"
      ? await runIsolatedDevelopmentSmoke(options)
      : options.mode === "final-local-lifecycle"
        ? await runFinalLocalLifecycle(options)
        : options.mode === "final-local"
          ? await runFinalLocalJourney(options)
          : options.mode === "final-registry"
            ? await runFinalRegistryJourney(options)
            : options.mode === "quick-registry"
              ? await runQuickRegistryJourney(options)
              : await runAcceptanceJourney(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`codex-native-smoke: ${error.message}\n`);
    process.exitCode = 1;
  });
}
