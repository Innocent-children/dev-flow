import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { assertSkillResources } from "../../../tests/skills/resources.mjs";
import { validateTaskHandoff } from "../lib/task-handoff.mjs";
import { validateSuitabilityAssessment } from "../lib/task-admission.mjs";
import { preparedWriteFromHook, hookDecision } from "../plugin/hooks/pre-tool-use.mjs";
import { terminalCleanupDecision } from "../lib/worktree-lifecycle.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const skillRoot = join(pluginRoot, "skills", "dev-flow");
const skillPath = join(skillRoot, "SKILL.md");

async function filesBelow(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else files.push(path);
  }
  return files.sort();
}

function examples(markdown, kind) {
  return [...markdown.matchAll(/<!-- example:([a-z-]+) ([a-z_-]+) ([a-z_-]+) -->\n```json\n([\s\S]*?)\n```/gu)]
    .filter((match) => match[1] === kind)
    .map((match) => ({ operation: match[2], name: match[3], value: JSON.parse(match[4]) }));
}

function marked(markdown, name) {
  const expression = new RegExp(`<!-- ${name}:start -->\\n([\\s\\S]*?)\\n<!-- ${name}:end -->`, "u");
  const value = markdown.replace(/\r\n?/gu, "\n").match(expression)?.[1];
  assert.ok(value, name);
  return value;
}


test("plugin exposes one implicitly enabled Skill with the installed identity", async () => {
  const skillFiles = (await filesBelow(join(pluginRoot, "skills"))).filter((path) => path.endsWith("SKILL.md"));
  assert.deepEqual(skillFiles, [skillPath]);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const skill = await readFile(skillPath, "utf8");
  assert.match(skill, /^---\nname: dev-flow\ndescription: "[^\n]+"\n---/u);
  assert.equal(`${manifest.name}:dev-flow`, "dev-flow-codex:dev-flow");
  assert.equal(await readFile(join(skillRoot, "agents", "openai.yaml"), "utf8"), "policy:\n  allow_implicit_invocation: true\n");
  const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  assert.deepEqual(plugin.interface.defaultPrompt, ["$dev-flow-codex:dev-flow assess the requested change in this repository before starting Dev Flow."]);
  const mcp = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  assert.deepEqual(mcp.mcpServers, { "dev-flow": { type: "stdio", command: "dev-flow-codex", args: ["mcp"], env_vars: ["DEV_FLOW_DATA_DIR"] } });
});

test("all Skill references are reachable, packaged and cite existing implementation symbols", async () => {
  await assertSkillResources({ skillRoot, packageRoot, repositoryRoot });
});

test("assessment and handoff examples pass the actual Host validators", async () => {
  const admission = await readFile(join(skillRoot, "references", "admission.md"), "utf8");
  for (const example of examples(admission, "assessment")) {
    assert.deepEqual(validateSuitabilityAssessment(example.value), example.value);
  }
  const handoff = await readFile(join(skillRoot, "references", "task-handoff.md"), "utf8");
  const example = JSON.parse(marked(handoff, "task-handoff-example").match(/^```json\n([\s\S]*)\n```$/u)[1]);
  assert.deepEqual(validateTaskHandoff(example), example);
});

test("Hook examples match the actual event translation and denial format", async () => {
  const markdown = await readFile(join(skillRoot, "references", "artifacts.md"), "utf8");
  const event = examples(markdown, "hook")[0].value;
  const prepared = examples(markdown, "host-check")[0].value;
  assert.deepEqual(preparedWriteFromHook(event), prepared);
  const denial = examples(markdown, "hook-output")[0].value;
  assert.deepEqual(hookDecision({ decision: "deny", reason: denial.systemMessage }), denial);
  assert.equal(hookDecision({ decision: "allow" }), null);
  const lifecycle = await readFile(join(skillRoot, "references", "host-lifecycle.md"), "utf8");
  const decision = examples(lifecycle, "host").find((example) => example.operation === "cleanup-decision");
  assert.deepEqual(terminalCleanupDecision(decision.value), {
    automatic_cleanup: false, worktree_cleanup: "requires_dirty_review", branch_cleanup: "requires_dirty_review",
  });
});

test("response example retains complete results and displays bounded success data", async () => {
  const reference = await readFile(join(skillRoot, "references", "transport.md"), "utf8");
  const coreReference = await readFile(join(skillRoot, "references", "tool-results.md"), "utf8");
  const code = marked(reference, "submission-response-example").match(/^```js\n([\s\S]*)\n```$/u)[1];
  const previousTask = { task_id: "task-example", revision: 5, current_cursor: "TEST" };
  const rejection = examples(coreReference, "mcp-output")[0].value;
  const success = { ok: true, result: { ...previousTask, revision: 6, current_cursor: "IMPLEMENT", current_action: { action_id: "next-action" }, blocker: null, outcome: null, history: "retained history ".repeat(20000) } };
  const terminal = { ok: true, result: { ...previousTask, revision: 6, current_cursor: "DONE", current_action: null, blocker: null, outcome: { status: "completed" } } };
  for (const envelope of [rejection, success, terminal]) {
    for (const structured of [true, false]) {
      const response = { content: [{ type: "text", text: JSON.stringify(envelope) }], isError: !envelope.ok };
      if (structured) response.structuredContent = envelope;
      const cache = new Map([["task", previousTask]]);
      const output = [];
      const stopped = new Error("exec exit");
      try {
        runInNewContext(code, {
          submission_response: response,
          store(key, value) { cache.set(key, JSON.parse(JSON.stringify(value))); },
          text(value) { output.push(JSON.parse(JSON.stringify(value))); },
          exit() { throw stopped; },
        });
      } catch (error) {
        assert.equal(error, stopped);
        assert.equal(envelope.ok, false);
      }
      assert.deepEqual(cache.get("submission_response"), response);
      assert.deepEqual(cache.get("task"), envelope.ok ? envelope.result : previousTask);
      if (!envelope.ok) assert.deepEqual(output, [envelope]);
      else {
        assert.equal(output[0].ok, true);
        assert.equal(output[0].current_cursor, envelope.result.current_cursor);
        assert.equal("history" in output[0], false);
        assert.equal(JSON.stringify(output).length < 1000, true);
      }
    }
  }
  for (const envelope of [{ ok: true }, { ok: true, result: null }, {}]) {
    const cache = new Map([["task", previousTask]]);
    assert.throws(() => runInNewContext(code, {
      submission_response: { structuredContent: envelope },
      store(key, value) { cache.set(key, JSON.parse(JSON.stringify(value))); },
      text() {}, exit() { assert.fail("Incomplete success cannot take the rejection path"); },
    }), /Incomplete submission response/u);
    assert.deepEqual(cache.get("task"), previousTask);
    assert.deepEqual(cache.get("submission_response"), { structuredContent: envelope });
  }
});
