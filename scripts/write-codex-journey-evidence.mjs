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

export const CODEX_COMPATIBILITY_RANGE = ">=0.147.0 <0.148.0";
export const EXPLICIT_SELECTOR = "$dev-flow-codex:dev-flow";
export const FINAL_NATIVE_EVIDENCE_KIND = "registry-package-native-codex-journey";
export const FINAL_FIXTURE_EVIDENCE_KIND = "fixture-simulated-registry-package-journey";
export const FINAL_LOCAL_NATIVE_EVIDENCE_KIND = "source-local-package-native-codex-journey";
export const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";
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
export const finalRegistrySubstantivePrompt = `${EXPLICIT_SELECTOR} Work only in the current repository. Open one host=codex task to create final-registry-proof.txt with the exact UTF-8 bytes "Dev Flow Codex final registry journey passed.\\n". Advance through the Core-required read-only prerequisites, create the file only when the current action permits repository edits, and stop after the first successful dev_flow_apply_action following file creation while the task remains nonterminal.`;
export const finalRegistryResumePrompt = `${EXPLICIT_SELECTOR} Resume the existing compatible host=codex task. After dev_flow_open_task, you MUST call dev_flow_get_task and then dev_flow_get_next_action before any dev_flow_apply_action. Do not use the action returned by dev_flow_open_task to skip either read. Run only "git hash-object final-registry-proof.txt" as the targeted verification command, and continue until Core reports current_cursor DONE with outcome completed.`;
const FINAL_LOCAL_PAYLOAD_RULES = `Before every apply, bind the latest complete Action and read action_kind, payload_contract, method_steps, available_transitions, and the current dev_flow_apply_action inputSchema branch. The payload must have exactly transition_id, summary, reason, artifacts, method_evidence, and node_result. Use artifacts=[] because this journey creates no process artifact; required_evidence is not an ArtifactReference role and repository_observation must never appear in artifacts. Preserve the complete node_result wrapper, arrays as arrays, and exactly one plain_fallback/capability-empty MethodEvidence item for every current method step in Action order. Never submit destination, next_node, next_cursor, unknown fields, or a guessed transition. If any call returns INVALID_ARGUMENT, stop immediately without trying another payload. The success wrappers are: REQUIREMENTS={problem_class,baseline,unresolved_questions}; DESIGN/TASKS={problem_class,baseline,findings}; IMPLEMENT={problem_class,task_plan_revision,completed_work_item_ids,changed_paths,no_file_changes,deviations,findings}; TEST={problem_class,checks,failed_items,unverified_items,manual_handoff_items,findings}; COMPREHENSION_REVIEW={problem_class,explained_components,unresolved_questions,unnecessary_abstractions,maintenance_risks,user_confirmation,findings}; REFACTOR={problem_class,changed_paths,no_file_changes,simplifications,behavior_change_intended,findings}; DELIVERY={problem_class,acceptance,automated_evidence_ids,manual_evidence_ids,test_record_id,comprehension_record_id,unverified_items,risks,findings}, with all delivery IDs read dynamically from the current Core task.`;
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
const FINAL_LOCAL_DEFINITION_DIGEST = "5265db6c44ce12ea55d9fdb072b4dcb2345f6e2a1e89b016644c2819e320f2c1";
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
  "attempt_1_failure", "attempt_2_status", "attempt_2_authorization", "previous_attempt_preserved",
  "observed_at",
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
  if (evidence.core_version !== evidence.package_version) throw new Error("final journey package/Core versions differ");
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

export function validateFinalLocalJourneyEvidence(evidence, expected = null) {
  assertExactFields(evidence, FINAL_LOCAL_EVIDENCE_FIELDS, "final local journey evidence");
  if (evidence.evidence_kind !== FINAL_LOCAL_NATIVE_EVIDENCE_KIND || evidence.status !== "passed") {
    throw new Error("final local evidence must be passed source-local native evidence");
  }
  if (evidence.package_name !== "dev-flow-codex" || evidence.package_version !== evidence.core_version) {
    throw new Error("final local package/Core identity is invalid");
  }
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
    || evidence.native_journey_attempt_count !== 2
    || evidence.total_native_attempts !== 2
    || evidence.successful_attempt !== 2
    || evidence.attempt_1_status !== "failed"
    || evidence.attempt_1_stage !== "initial-comprehension-first-requirements-apply"
    || evidence.attempt_1_failure !== "invalid-contract-0.2-payload"
    || evidence.attempt_2_status !== "passed"
    || evidence.attempt_2_authorization !== "explicit_user_authorization"
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

export function buildCodexExecArgs(prompt, {
  ephemeral = false,
  skipGitRepoCheck = false,
  workspace = null,
  workspaceWrite = false,
} = {}) {
  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new TypeError("Codex prompt must be nonempty");
  }
  const args = ["exec", "--json"];
  if (ephemeral) args.push("--ephemeral", "--ignore-rules", "--color", "never");
  if (ephemeral || workspaceWrite) args.push("--sandbox", "workspace-write");
  if (skipGitRepoCheck) args.push("--skip-git-repo-check");
  if (workspace !== null) args.push("--cd", workspace);
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
  skipGitRepoCheck = false,
  workspaceWrite = false,
  stopAfterApplyPath = null,
  stopAfterApplyContent = null,
  retainCoreRejections = false,
  transcriptPath = null,
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
    skipGitRepoCheck,
    workspaceWrite,
    workspace: ephemeral ? workspace : null,
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
      coreVersion: options.version,
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
      || retained.phase !== "DONE"
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
    if (!versionSatisfiesFixedRange(codexVersion)) throw new Error("final local Codex version is outside the frozen compatibility range");

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
    await writeSmokeOutput(resultDirectory, "native-attempt-2.json", {
      evidence_kind: "source-local-native-attempt",
      status: "started",
      native_journey_attempt_count: 2,
      authorization: options.authorization,
      previous_attempt_status: "failed",
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
      native_journey_attempt_count: 2,
      total_native_attempts: 2,
      successful_attempt: 2,
      attempt_1_status: "failed",
      attempt_1_stage: "initial-comprehension-first-requirements-apply",
      attempt_1_failure: "invalid-contract-0.2-payload",
      attempt_2_status: "passed",
      attempt_2_authorization: options.authorization,
      previous_attempt_preserved: true,
      observed_at: new Date().toISOString(),
    }, options);
    await writeSmokeOutput(resultDirectory, "task-data-manifest.json", finalLocalTaskManifest(finalCoreState, finalTask, dataBeforeLifecycle));
    await writeSmokeOutput(resultDirectory, "final-local-journey-evidence.json", evidence);
    await writeSmokeOutput(resultDirectory, "native-attempt-2-complete.json", {
      evidence_kind: "source-local-native-attempt",
      status: "passed",
      native_journey_attempt_count: 2,
      authorization: options.authorization,
      previous_attempt_status: "failed",
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
        native_journey_attempt_count: 2,
        authorization: options.authorization,
        previous_attempt_status: "failed",
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
  if (report.package_version !== report.core_version) {
    throw new Error("acceptance report package_version must equal core_version");
  }
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
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new Error("release version must be a stable SemVer string");
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
  return parts[0] === 0 && parts[1] === 147;
}

function assertFinalEvidenceIdentity(evidence, expected) {
  const identities = [
    ["package_name", expected.packageName],
    ["package_version", expected.version],
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
  if (value.phase === "DONE" || value.outcome?.status === "completed") return true;
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
  proofCommand = PROOF_COMMAND,
  proofRenderedCommand = PROOF_RENDERED_COMMAND,
  proofHash = PROOF_GIT_HASH,
} = {}) {
  aggregateSessionFacts(sessions);
  const threadIDs = sessions.map((session) => session.thread_id);
  if (new Set(threadIDs).size !== 4 || threadIDs.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("development smoke requires four distinct Codex sessions");
  }
  for (const session of sessions.slice(2)) assertHandshake(session, coreVersion);
  const substantive = sessions[2];
  const resume = sessions[3];
  const substantiveApplies = successfulCalls(substantive, "dev_flow_apply_action");
  const resumeApplies = successfulCalls(resume, "dev_flow_apply_action");
  const taskBefore = lastTask(substantiveApplies);
  const resumeOpen = successfulCalls(resume, "dev_flow_open_task")[0];
  const taskAfter = taskFromCall(resumeOpen);
  const finalTask = lastTask(resumeApplies);
  if (!taskBefore || taskBefore.phase === "DONE" || taskBefore.outcome !== null) throw new Error("substantive session did not stop on a nonterminal Core task");
  if (!taskAfter || taskAfter.task_id !== taskBefore.task_id) throw new Error("restart did not resume the same Core task");
  if (!finalTask || finalTask.task_id !== taskBefore.task_id || finalTask.phase !== "DONE" || finalTask.outcome?.status !== "completed") {
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
    schema: info?.schema_version === 1,
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
  if (options.nativeAttempt !== 2 || options.authorization !== "explicit_user_authorization") {
    throw new Error("final local second attempt requires explicit user authorization");
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
    envelope?.schema_version !== 2
    || envelope?.ok !== true
    || info?.product !== "dev-flow"
    || info?.version !== coreVersion
    || info?.schema_version !== 2
    || info?.core_limits_version !== "0.2"
    || info?.transport !== "stdio"
    || info?.health !== "ready"
    || !isDeepStrictEqual(info?.method_profiles, ["plain", "spec-kit", "openspec"])
    || !isDeepStrictEqual(info?.tools, DEV_FLOW_TOOLS)
    || info?.supported_processes?.length !== 1
    || info.supported_processes[0]?.process_id !== "standard-development"
    || info.supported_processes[0]?.process_version !== 1
    || info.supported_processes[0]?.definition_digest !== FINAL_LOCAL_DEFINITION_DIGEST
  ) throw new Error("final local packaged Core Contract 0.2 handshake is invalid");
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
    const tasks = database.prepare("SELECT task_id, origin_host, process_id, process_version, process_definition_digest, snapshot_version, current_node, revision, repository_identity, hex(snapshot) AS snapshot_hex FROM tasks ORDER BY task_id").all()
      .map((row) => ({ ...row, process_version: Number(row.process_version), snapshot_version: Number(row.snapshot_version), revision: Number(row.revision), snapshot: JSON.parse(Buffer.from(row.snapshot_hex, "hex").toString("utf8")), snapshot_hex: undefined }));
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
    process_version: task.process_version,
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

function assertFinalLocalCommands(sessions) {
  const commands = sessions.flatMap((session) => session.commands.map((command) => ({ role: session.role, ...command })));
  const verification = commands.filter((command) => /(?:node|npm|pnpm|go)[^\n]*(?:test|validate)/u.test(command.command));
  if (verification.length !== 2 || verification.some((command) => !command.command.includes(FINAL_LOCAL_TEST_COMMAND) || command.exitCode !== 0)) {
    throw new Error("final local verification command count or identity is invalid");
  }
  if (verification[0].role !== "initial-comprehension" || verification[1].role !== "complexity-refactor-retest") {
    throw new Error("final local targeted checks ran in the wrong sessions");
  }
  if (commands.some((command) => /pnpm run validate|pnpm test|npm test|go test|node --test\s+(?:\*|\.)/u.test(command.command))) {
    throw new Error("final local journey ran a forbidden full or alternate suite");
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
    schema_version: 2,
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
  assertExactFields(options, [
    "mode", "packageName", "version", "registry", "tarballSHA256", "coreSHA256",
    "sourceCommit", "codexExecutable", "workspace", "resultDirectory",
  ], "final registry journey options");
  if (options.mode !== "final-registry") throw new Error("final registry journey mode is invalid");
  if (options.packageName !== "dev-flow-codex") throw new Error("final registry journey package must equal dev-flow-codex");
  if (options.registry !== OFFICIAL_NPM_REGISTRY) throw new Error("final registry journey requires the official npm registry");
  requireReleaseVersion(options.version);
  requireDigest(options.tarballSHA256, "tarball-sha256");
  requireDigest(options.coreSHA256, "core-sha256");
  if (!/^[0-9a-f]{40}$/u.test(options.sourceCommit)) throw new Error("final registry journey source commit is invalid");
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
  if (productVersion.stdout !== `dev-flow-codex ${version} (core ${version})\n`) {
    throw new Error("final registry journey product version read-back is invalid");
  }
  const runtimePath = join(packageRoot, "runtime", "darwin-arm64", "dev-flow");
  const runtimeVersion = await execFile(runtimePath, ["version"], {
    cwd: layout.root,
    env: environment,
    encoding: "utf8",
  });
  if (runtimeVersion.stdout !== `dev-flow ${version}\n`) {
    throw new Error("final registry journey bundled Core version is invalid");
  }
  return {
    packageRoot,
    packageCLI,
    runtimePath,
    coreVersion: version,
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
  if (version.stdout.trim() !== "codex-cli 0.147.0") throw new Error("development smoke requires Codex CLI 0.147.0");
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

async function callPackagedCoreTool(runtimePath, dataDirectory, repository, tool, arguments_, environment) {
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
  child.stdin.end();
  const stopped = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("packaged Core did not stop after EOF")); }, 10_000);
    child.once("exit", (code, signal) => { clearTimeout(timer); code === 0 && signal === null ? resolve() : reject(new Error("packaged Core exited unexpectedly")); });
  });
  void stopped;
  if (!isPlainObject(result)) throw new Error("packaged Core tool result is incomplete");
  return result;
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
          && successfulApplyEvent(line)
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

function successfulApplyEvent(line) {
  try {
    const event = JSON.parse(line);
    const item = event?.type === "item.completed" ? event.item : null;
    return item?.type === "mcp_tool_call"
      && item.server === "dev-flow"
      && item.tool === "dev_flow_apply_action"
      && item.status === "completed"
      && item.result?.structured_content?.ok === true;
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

export function parseCLI(argv) {
  const mode = argv.shift();
  if (mode === "acceptance-report") {
    if (argv.length !== 2 || argv[0] !== "--report") {
      throw new Error("acceptance-report requires --report ABS");
    }
    requireAbsolute(argv[1], "acceptance report");
    return { mode, reportPath: argv[1] };
  }
  if (mode === "final-registry") {
    const flags = [
      "--package", "--version", "--registry", "--tarball-sha256", "--core-sha256",
      "--source-commit", "--codex-executable", "--workspace", "--result-directory",
    ];
    const values = {};
    while (argv.length > 0) {
      const flag = argv.shift();
      if (!flags.includes(flag) || Object.hasOwn(values, flag) || argv.length === 0) {
        throw new Error("final registry journey requires each exact flag once");
      }
      values[flag] = argv.shift();
    }
    if (flags.some((flag) => !Object.hasOwn(values, flag))) {
      throw new Error("final registry journey requires each exact flag once");
    }
    if (values["--package"] !== "dev-flow-codex") {
      throw new Error("final registry journey package must equal dev-flow-codex");
    }
    if (values["--registry"] !== OFFICIAL_NPM_REGISTRY) {
      throw new Error("final registry journey requires the official npm registry");
    }
    requireReleaseVersion(values["--version"]);
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
      coreSHA256: values["--core-sha256"],
      sourceCommit: values["--source-commit"],
      codexExecutable: values["--codex-executable"],
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
    if (values["--native-attempt"] !== "2" || values["--authorization"] !== "explicit_user_authorization") {
      throw new Error("final local attempt 2 requires explicit user authorization");
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
      nativeAttempt: 2,
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
    throw new Error("mode must be smoke, acceptance, development-smoke, final-local, final-registry, or acceptance-report");
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
    : options.mode === "development-smoke"
      ? await runIsolatedDevelopmentSmoke(options)
      : options.mode === "final-local"
        ? await runFinalLocalJourney(options)
      : options.mode === "final-registry"
        ? await runFinalRegistryJourney(options)
      : await runAcceptanceJourney(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`codex-native-smoke: ${error.message}\n`);
    process.exitCode = 1;
  });
}
