#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const confirmation = process.env.DEV_FLOW_CODEX_NATIVE_CONFIRM ?? "";
const evidencePath = process.env.DEV_FLOW_CODEX_NATIVE_EVIDENCE ?? "";

if (confirmation !== "worktree-first-native") {
  process.stdout.write(`${JSON.stringify({
    status: "skipped",
    evidence_type: "native_codex_app",
    reason: "set DEV_FLOW_CODEX_NATIVE_CONFIRM=worktree-first-native and DEV_FLOW_CODEX_NATIVE_EVIDENCE to validate an explicitly run Codex App journey",
  })}\n`);
  process.exit(0);
}
if (!isAbsolute(evidencePath) || resolve(evidencePath) !== evidencePath) {
  throw new Error("DEV_FLOW_CODEX_NATIVE_EVIDENCE must be a normalized absolute path");
}
const canonicalEvidence = await realpath(evidencePath);
if (!(await stat(canonicalEvidence)).isFile()) throw new Error("native evidence path must be a file");
const evidence = JSON.parse(await readFile(canonicalEvidence, "utf8"));
assert.deepEqual(Object.keys(evidence).sort(), [
  "artifact_digest",
  "cleanup",
  "events",
  "host",
  "platform",
  "result",
  "source_commit",
]);
assert.equal(evidence.host, "codex-app");
assert.equal(evidence.platform, "darwin-arm64");
assert.match(evidence.artifact_digest, /^[0-9a-f]{64}$/u);
assert.match(evidence.source_commit, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
assert.equal(evidence.result, "passed");
assert.deepEqual(evidence.cleanup, { worktree_authorized: true, branch_authorized: true, completed: true });
assert.ok(Array.isArray(evidence.events));
const required = [
  "assessment",
  "confirmation",
  "fetch",
  "managed_dispatch",
  "target_branch",
  "core_open",
  "edit",
  "commit",
  "prepare_relocation",
  "handoff",
  "resolve_relocation",
  "test",
  "done",
  "cleanup_worktree",
  "cleanup_branch",
];
assert.deepEqual(evidence.events.map((event) => event.name), required);
for (const event of evidence.events) {
  assert.deepEqual(Object.keys(event).sort(), ["at", "name", "status"]);
  assert.equal(event.status, "passed");
  assert.ok(Number.isFinite(Date.parse(event.at)));
}
process.stdout.write(`${JSON.stringify({
  status: "passed",
  evidence_type: "native_codex_app",
  artifact_digest: evidence.artifact_digest,
  source_commit: evidence.source_commit,
})}\n`);
