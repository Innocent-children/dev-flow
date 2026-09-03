import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  admissionAnchorMatches,
  inspectAdmissionAnchor,
  validateSuitabilityAssessment,
} from "../lib/task-admission.mjs";

const execFile = promisify(execFileCallback);

test("assessment anchors are read-only and invalidate on request, HEAD, or status changes", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-admission-")));
  const repository = join(root, "repository with spaces");
  await mkdir(repository);
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(repository, "init", "--initial-branch=main");
  await git(repository, "config", "user.email", "codex@example.invalid");
  await git(repository, "config", "user.name", "Codex Test");
  await writeFile(join(repository, "feature.txt"), "base\n");
  await git(repository, "add", "feature.txt");
  await git(repository, "commit", "-m", "base");

  const first = await inspectAdmissionAnchor({
    request: "Update one internal helper.",
    repositories: [{ key: "primary", repository_path: repository }],
  });
  const same = await inspectAdmissionAnchor({
    request: "Update one internal helper.",
    repositories: [{ key: "primary", repository_path: repository }],
  });
  assert.equal(admissionAnchorMatches(first, same), true);
  assert.deepEqual(first.repositories[0].dirty_paths, []);

  await writeFile(join(repository, "untracked file.txt"), "local only\n");
  const dirty = await inspectAdmissionAnchor({
    request: "Update one internal helper.",
    repositories: [{ key: "primary", repository_path: repository }],
  });
  assert.equal(admissionAnchorMatches(first, dirty), false);
  assert.deepEqual(dirty.repositories[0].dirty_paths, ["untracked file.txt"]);

  const changedRequest = await inspectAdmissionAnchor({
    request: "Update two helpers.",
    repositories: [{ key: "primary", repository_path: repository }],
  });
  assert.notEqual(changedRequest.request_digest, dirty.request_digest);
});

test("assessment contract permits only genuinely small direct work", async () => {
  const anchor = {
    request_digest: "a".repeat(64),
    repositories: [{
      repository_key: "primary",
      canonical_root: "/workspace/repository",
      head: "b".repeat(40),
      status_digest: "c".repeat(64),
      dirty_paths: [],
      dirty_paths_truncated: false,
    }],
  };
  const small = {
    change_level: "small",
    observed_repositories: ["primary"],
    candidate_components: ["internal formatter"],
    candidate_paths: ["src/format.mjs"],
    public_contract_flags: [],
    persistence_or_state_flags: [],
    host_or_platform_flags: [],
    verification_shape: ["one targeted unit test"],
    unknowns: [],
    recommendation: "direct",
    reasons: ["The implementation and test are concentrated."],
    anchor,
  };
  assert.deepEqual(validateSuitabilityAssessment(small), small);
  assert.throws(
    () => validateSuitabilityAssessment({ ...small, public_contract_flags: ["CLI contract"] }),
    /small-change rules/u,
  );
  assert.throws(
    () => validateSuitabilityAssessment({ ...small, change_level: "uncertain", unknowns: ["entry point"], recommendation: "dev_flow" }),
    /must recommend clarification/u,
  );
});

test("assessment forces dirty submodule observation even when repository config hides it", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-codex-admission-submodule-")));
  const repository = join(root, "repository");
  const submoduleSource = join(root, "submodule-source");
  await Promise.all([mkdir(repository), mkdir(submoduleSource)]);
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of [repository, submoduleSource]) {
    await git(path, "init", "--initial-branch=main");
    await git(path, "config", "user.email", "codex@example.invalid");
    await git(path, "config", "user.name", "Codex Test");
  }
  await writeFile(join(submoduleSource, "tracked.txt"), "base\n");
  await git(submoduleSource, "add", "tracked.txt");
  await git(submoduleSource, "commit", "-m", "submodule base");
  await writeFile(join(repository, "README.md"), "base\n");
  await git(repository, "add", "README.md");
  await git(repository, "commit", "-m", "repository base");
  await execFile("git", ["-c", "protocol.file.allow=always", "submodule", "add", submoduleSource, "vendor/sub"], {
    cwd: repository,
    encoding: "utf8",
  });
  await git(repository, "commit", "-am", "add submodule");
  await git(repository, "config", "submodule.vendor/sub.ignore", "all");
  await writeFile(join(repository, "vendor", "sub", "tracked.txt"), "dirty\n");

  const anchor = await inspectAdmissionAnchor({
    request: "Inspect the configured submodule.",
    repositories: [{ key: "primary", repository_path: repository }],
  });
  assert.deepEqual(anchor.repositories[0].dirty_paths, ["vendor/sub"]);
});

async function git(cwd, ...arguments_) {
  return await execFile("git", arguments_, { cwd, encoding: "utf8" });
}
