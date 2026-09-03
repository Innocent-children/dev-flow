import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const CHANGE_LEVELS = Object.freeze(["small", "standard", "large", "uncertain"]);
export const ADMISSION_RECOMMENDATIONS = Object.freeze(["direct", "dev_flow", "clarify"]);
const digestPattern = /^[0-9a-f]{64}$/u;

export function requestDigest(request) {
  if (typeof request !== "string" || request.trim() === "") {
    throw new Error("assessment request must be a non-empty string");
  }
  return createHash("sha256").update(request, "utf8").digest("hex");
}

export async function inspectAdmissionAnchor({
  request,
  repositories,
  runGit = defaultRunGit,
} = {}) {
  if (!Array.isArray(repositories) || repositories.length === 0 || repositories.length > 8) {
    throw new Error("assessment repositories must contain one to eight entries");
  }
  const seenKeys = new Set();
  const seenRoots = new Set();
  const observed = [];
  for (const repository of repositories) {
    assertExactKeys(repository, ["key", "repository_path"], "assessment repository");
    assertRepositoryKey(repository.key);
    if (seenKeys.has(repository.key)) throw new Error(`duplicate repository key ${repository.key}`);
    seenKeys.add(repository.key);
    assertAbsolutePath(repository.repository_path, "repository_path");
    const requestedPath = resolve(repository.repository_path);
    const topLevel = normalizeLine(await runGit(["-C", requestedPath, "rev-parse", "--show-toplevel"]));
    assertAbsolutePath(topLevel, "Git worktree root");
    const canonicalRoot = await realpath(topLevel);
    if (seenRoots.has(canonicalRoot)) throw new Error("assessment repositories must identify distinct worktrees");
    seenRoots.add(canonicalRoot);
    const head = normalizeLine(await runGit(["-C", canonicalRoot, "rev-parse", "--verify", "HEAD"]));
    assertCommit(head, "HEAD");
    const status = await runGit([
      "-C", canonicalRoot, "status", "--porcelain=v2", "-z", "--untracked-files=all", "--ignore-submodules=none",
    ], { encoding: "buffer" });
    const statusBuffer = Buffer.isBuffer(status) ? status : Buffer.from(status);
    observed.push(Object.freeze({
      repository_key: repository.key,
      canonical_root: canonicalRoot,
      head,
      status_digest: createHash("sha256").update(statusBuffer).digest("hex"),
      dirty_paths: Object.freeze(parsePorcelainV2Paths(statusBuffer).slice(0, 64)),
      dirty_paths_truncated: parsePorcelainV2Paths(statusBuffer).length > 64,
    }));
  }
  return Object.freeze({
    request_digest: requestDigest(request),
    repositories: Object.freeze(observed),
  });
}

export function validateSuitabilityAssessment(value) {
  assertExactKeys(value, [
    "change_level",
    "observed_repositories",
    "candidate_components",
    "candidate_paths",
    "public_contract_flags",
    "persistence_or_state_flags",
    "host_or_platform_flags",
    "verification_shape",
    "unknowns",
    "recommendation",
    "reasons",
    "anchor",
  ], "suitability assessment");
  if (!CHANGE_LEVELS.includes(value.change_level)) throw new Error("assessment change_level is invalid");
  if (!ADMISSION_RECOMMENDATIONS.includes(value.recommendation)) {
    throw new Error("assessment recommendation is invalid");
  }
  for (const field of [
    "observed_repositories", "candidate_components", "candidate_paths", "public_contract_flags",
    "persistence_or_state_flags", "host_or_platform_flags", "verification_shape", "unknowns", "reasons",
  ]) {
    assertStringArray(value[field], `assessment ${field}`);
  }
  if (value.observed_repositories.length === 0) {
    throw new Error("assessment observed_repositories must not be empty");
  }
  if (value.reasons.length === 0) throw new Error("assessment reasons must not be empty");
  validateAdmissionAnchor(value.anchor);
  if (value.change_level === "small") {
    const flags = [
      ...value.public_contract_flags,
      ...value.persistence_or_state_flags,
      ...value.host_or_platform_flags,
      ...value.unknowns,
    ];
    if (value.observed_repositories.length !== 1 || value.candidate_components.length !== 1 || flags.length !== 0) {
      throw new Error("small assessment violates the closed small-change rules");
    }
    if (value.recommendation !== "direct") {
      throw new Error("small assessment must recommend direct development");
    }
  }
  if (value.unknowns.length > 0 && value.change_level !== "uncertain") {
    throw new Error("an assessment with unknowns must be uncertain");
  }
  if (value.change_level === "uncertain" && value.recommendation !== "clarify") {
    throw new Error("an uncertain assessment must recommend clarification");
  }
  if (
    value.observed_repositories.length > 1 ||
    value.public_contract_flags.length > 0 ||
    value.persistence_or_state_flags.length > 0 ||
    value.host_or_platform_flags.length > 0
  ) {
    if (value.change_level === "small" || value.recommendation === "direct") {
      throw new Error("cross-cutting assessment cannot be small or recommend direct development");
    }
  }
  return structuredClone(value);
}

export function validateAdmissionAnchor(value) {
  assertExactKeys(value, ["request_digest", "repositories"], "assessment anchor");
  if (!digestPattern.test(value.request_digest)) throw new Error("assessment request_digest is invalid");
  if (!Array.isArray(value.repositories) || value.repositories.length === 0 || value.repositories.length > 8) {
    throw new Error("assessment anchor repositories must contain one to eight entries");
  }
  const keys = new Set();
  for (const repository of value.repositories) {
    assertExactKeys(repository, [
      "repository_key", "canonical_root", "head", "status_digest", "dirty_paths", "dirty_paths_truncated",
    ], "assessment anchor repository");
    assertRepositoryKey(repository.repository_key);
    if (keys.has(repository.repository_key)) throw new Error("assessment anchor repository keys must be unique");
    keys.add(repository.repository_key);
    assertAbsolutePath(repository.canonical_root, "assessment canonical_root");
    assertCommit(repository.head, "assessment HEAD");
    if (!digestPattern.test(repository.status_digest)) throw new Error("assessment status_digest is invalid");
    assertStringArray(repository.dirty_paths, "assessment dirty_paths");
    if (typeof repository.dirty_paths_truncated !== "boolean") {
      throw new Error("assessment dirty_paths_truncated must be a boolean");
    }
  }
  return structuredClone(value);
}

export function admissionAnchorMatches(left, right) {
  try {
    const first = validateAdmissionAnchor(left);
    const second = validateAdmissionAnchor(right);
    return stableJSON(first) === stableJSON(second);
  } catch {
    return false;
  }
}

function parsePorcelainV2Paths(value) {
  const records = value.toString("utf8").split("\0");
  const paths = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith("? ") || record.startsWith("! ")) {
      paths.push(record.slice(2));
      continue;
    }
    if (record.startsWith("1 ") || record.startsWith("u ")) {
      paths.push(record.split(" ").slice(record.startsWith("1 ") ? 8 : 10).join(" "));
      continue;
    }
    if (record.startsWith("2 ")) {
      paths.push(record.split(" ").slice(9).join(" "));
      if (records[index + 1]) paths.push(records[index + 1]);
      index += 1;
    }
  }
  return [...new Set(paths.filter(Boolean))].sort();
}

async function defaultRunGit(arguments_, { encoding = "utf8" } = {}) {
  const options = {
    encoding: encoding === "buffer" ? null : encoding,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  };
  try {
    const { stdout } = await execFile("git", arguments_, options);
    return stdout;
  } catch (cause) {
    throw new Error(`read-only Git assessment failed${cause?.killed ? " or timed out" : ""}`);
  }
}

function normalizeLine(value) {
  const line = String(value).replace(/\r?\n$/u, "");
  if (line === "" || line.includes("\n") || line.includes("\r") || line.includes("\0")) {
    throw new Error("Git returned an invalid single-line value");
  }
  return line;
}

function assertCommit(value, label) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value)) throw new Error(`${label} is not a complete Git commit`);
}

function assertRepositoryKey(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)) {
    throw new Error("repository key is invalid");
  }
}

function assertAbsolutePath(value, label) {
  if (typeof value !== "string" || value.includes("\0") || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a normalized absolute path`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

function assertExactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (stableJSON(actual) !== stableJSON(expected)) throw new Error(`${label} has an invalid closed shape`);
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
