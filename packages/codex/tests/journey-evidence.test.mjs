import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEV_FLOW_TOOLS,
  parseCodexFixtureFile,
  summarizeCodexFixture,
} from "../../../scripts/validate-codex-journey-evidence.mjs";

const repositoryRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const fixtureRoot = join(repositoryRoot, "tests", "contract", "testdata", "codex-0.147");

const fixtures = Object.freeze({
  success: {
    path: join(fixtureRoot, "success.jsonl"),
    shape: "success",
  },
  coreDomainError: {
    path: join(fixtureRoot, "core-domain-error.jsonl"),
    shape: "core_domain_error",
  },
  transportError: {
    path: join(fixtureRoot, "transport-error.jsonl"),
    shape: "transport_error",
  },
});

test("Codex 0.147 completed MCP item preserves complete structured/text parity", async () => {
  const parsed = await parseCodexFixtureFile(fixtures.success.path, fixtures.success.shape);
  const [call] = parsed.calls;

  assert.equal(parsed.eventCount, 2);
  assert.equal(call.status, "completed");
  assert.equal(call.tool, "dev_flow_server_info");
  assert.equal(call.resultPresent, true);
  assert.equal(call.structuredContent.ok, true);
  assert.deepEqual(call.structuredContent.result.tools, DEV_FLOW_TOOLS);
  assert.deepEqual(summarizeCodexFixture(parsed, "success.jsonl"), {
    mode: "fixture",
    host: "codex-0.147",
    fixture: "success.jsonl",
    thread_started: true,
    dev_flow_call_count: 1,
    tool: "dev_flow_server_info",
    terminal_shape: "success",
    status: "pass",
  });
});

test("Codex 0.147 failed MCP item with a complete Core result remains a domain error", async () => {
  const parsed = await parseCodexFixtureFile(
    fixtures.coreDomainError.path,
    fixtures.coreDomainError.shape,
  );
  const [call] = parsed.calls;

  assert.equal(call.status, "failed");
  assert.equal(call.tool, "dev_flow_apply_action");
  assert.equal(call.resultPresent, true);
  assert.equal(call.structuredContent.ok, false);
  assert.equal(call.structuredContent.error.code, "REVISION_CONFLICT");
  assert.deepEqual(call.structuredContent.recovery, {
    retry_safe: false,
    action: "read_task",
    message: "Read the authoritative task before another mutation.",
  });
});

test("Codex 0.147 failed MCP item without a complete result is a transport error", async () => {
  const parsed = await parseCodexFixtureFile(
    fixtures.transportError.path,
    fixtures.transportError.shape,
  );
  const [call] = parsed.calls;

  assert.equal(call.status, "failed");
  assert.equal(call.tool, "dev_flow_apply_action");
  assert.equal(call.resultPresent, false);
  assert.equal(call.structuredContent, null);
  assert.deepEqual(call.error, {
    message: "MCP transport disconnected before a result",
  });
  assert.equal(Object.hasOwn(call.error, "code"), false);
});

test("Codex host fixtures contain no prompt, source, user path, environment, token, or secret", async () => {
  for (const fixture of Object.values(fixtures)) {
    const text = await readFile(fixture.path, "utf8");
    assert.doesNotMatch(text, /(?:\/Users\/|\/home\/|[A-Za-z]:\\)/u);
    assert.doesNotMatch(text, /"(?:prompt|source|path|environment|env|token|secret)"\s*:/iu);
  }
});

test.todo("HIGH-1 diagnostic precedence: MCP failure remains primary when summary checks also fail");
test.todo("HIGH-2 Core envelope closure: reject missing, extra, or mismatched authority fields");
test.todo("HIGH-3 failed event/recovery binding: bind one failed item to same-lineage read/read/apply");
test.todo("HIGH-4 aggregate/session MCP fact parity: reject aggregate facts not projected from sessions");
