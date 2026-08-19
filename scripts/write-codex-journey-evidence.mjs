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
  return call?.core_result?.result?.task ?? null;
}

function lastTask(calls) {
  return calls.map(taskFromCall).filter(Boolean).at(-1) ?? null;
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
  const response = await request("tools/call", { name: "dev_flow_get_task", arguments: { host: "codex", task_id: taskID } });
  const result = response.result?.structuredContent;
  child.stdin.end();
  const stopped = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("packaged Core did not stop after EOF")); }, 10_000);
    child.once("exit", (code, signal) => { clearTimeout(timer); code === 0 && signal === null ? resolve() : reject(new Error("packaged Core exited unexpectedly")); });
  });
  void stopped;
  if (!result || JSON.parse(response.result.content?.[0]?.text ?? "null")?.result?.task?.task_id !== taskID) throw new Error("packaged Core retained-task result is incomplete");
  return result.result.task;
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
    throw new Error("mode must be smoke, acceptance, development-smoke, final-registry, or acceptance-report");
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
