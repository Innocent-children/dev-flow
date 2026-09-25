import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preparedWriteFromHook, runHook } from "../hooks/pre-tool-use.mjs";

test("native Write/Edit Hook preserves path and full operation identity", async () => {
  for (const tool of ["Write", "Edit"]) {
    const event = { hook_event_name: "PreToolUse", cwd: resolve("."), tool_name: tool,
      tool_input: { file_path: "目录 with space/a.txt", content: "first", old_string: "a", new_string: "b" } };
    const input = preparedWriteFromHook(event);
    assert.equal(input.host, "zcode");
    assert.deepEqual(input.paths, [resolve(event.cwd, event.tool_input.file_path)]);
    assert.equal(input.path_parse_complete, true);
    assert.notEqual(input.intent_digest, preparedWriteFromHook({ ...event, tool_input: { ...event.tool_input, new_string: "c" } }).intent_digest);
    assert.equal(await runHook(event, async () => ({ decision: "allow" })), null);
    assert.deepEqual(await runHook(event, async () => ({ decision: "deny", reason: "Outside current plan" })), {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Outside current plan" },
    });
  }
});

test("matching malformed paths remain incomplete and invalid Core checks cannot allow writes", async () => {
  const event = { hook_event_name: "PreToolUse", cwd: resolve("."), tool_name: "Write", tool_input: {} };
  assert.equal(preparedWriteFromHook(event).path_parse_complete, false);
  assert.deepEqual(preparedWriteFromHook(event).paths, []);
  assert.equal(preparedWriteFromHook({ ...event, tool_input: { file_path: "bad\0path" } }).path_parse_complete, false);
  assert.throws(() => preparedWriteFromHook({ ...event, cwd: "relative" }), /absolute/);
  await assert.rejects(runHook(event, async () => ({ ok: true })), /Invalid Core/);
  await assert.rejects(runHook(event, async () => { throw new Error("Core unavailable"); }), /Core unavailable/);
  assert.equal(preparedWriteFromHook({ ...event, tool_name: "Bash" }), null);
  assert.equal(preparedWriteFromHook({ ...event, tool_name: "NotebookEdit" }), null);
});

test("the actual hook CLI blocks malformed JSON, duplicate fields and invalid UTF-8 with exit 2", () => {
  const cli = fileURLToPath(new URL("../bin/taskbelay-zcode.mjs", import.meta.url));
  for (const input of ["not json\n", '{"hook_event_name":"PreToolUse","hook_event_name":"Stop"}', Buffer.from([0xff]),
    JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", cwd: "relative", tool_input: { file_path: "a" } })]) {
    const result = spawnSync(process.execPath, [cli, "hook", "pre-tool-use"], { input, encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /TaskBelay write check failed/);
  }
});
