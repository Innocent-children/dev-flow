import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { preparedWriteFromHook, runHook } from "../plugin/hooks/pre-tool-use.mjs";
test("Claude write input identity includes the entire original operation", async () => {
  const event = { hook_event_name: "PreToolUse", cwd: resolve("."), tool_name: "Edit", tool_input: { file_path: "a.txt", old_string: "a", new_string: "b" } };
  const first = preparedWriteFromHook(event);
  assert.deepEqual(first.paths, [resolve("a.txt")]);
  const second = preparedWriteFromHook({ ...event, tool_input: { ...event.tool_input, new_string: "c" } });
  assert.notEqual(first.intent_digest, second.intent_digest);
  assert.equal(await runHook(event, async () => ({ decision: "allow" })), null);
  const denied = await runHook(event, async () => ({ decision: "deny", reason: "Outside plan" }));
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
});
test("malformed matching tools cannot become allowed writes", async () => {
  const event = { hook_event_name: "PreToolUse", cwd: resolve("."), tool_name: "NotebookEdit", tool_input: {} };
  assert.equal(preparedWriteFromHook(event).path_parse_complete, false);
  await assert.rejects(runHook(event, async () => ({ ok: true })), /Invalid Core/);
});

