import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillRoot = join(packageRoot, "skills", "dev-flow");
const skillPath = join(skillRoot, "SKILL.md");
const rawTools = [
  "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task", "dev_flow_get_next_action",
  "dev_flow_submit_requirements", "dev_flow_submit_design", "dev_flow_submit_tasks",
  "dev_flow_submit_implementation", "dev_flow_submit_test", "dev_flow_submit_comprehension",
  "dev_flow_submit_refactor", "dev_flow_submit_delivery", "dev_flow_resolve_blocker",
  "dev_flow_recover_action", "dev_flow_cancel_task",
];

test("Skill declares explicit activation and the complete qualified tool catalog", async () => {
  const skill = (await readFile(skillPath, "utf8")).replace(/\r\n?/gu, "\n");
  assert.equal(skill.startsWith("# Dev Flow\n"), true);
  const handshake = section(skill, "Compatibility handshake");
  const catalog = [...handshake.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gmu)].map((match) => match[1]);
  assert.deepEqual(catalog, rawTools);
  assert.equal(handshake.match(/`(mcp__dev_flow__dev_flow_[a-z_]+)/u)?.[1], "mcp__dev_flow__dev_flow_server_info");
});

test("Skill contains the required operational sections", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const heading of ["Admission gate", "Compatibility handshake", "Task discovery", "Optional code discovery", "Governed action loop", "Method operation rendering", "Transition selection", "Closed forwarding contract", "Recovery-before-retry contract"]) {
    assert.equal(skill.includes(`## ${heading}`), true, heading);
  }
});

test("all explicit DeepSeek tool calls use qualified DSH names", async () => {
  const skill = await readFile(skillPath, "utf8");
  const withoutCatalog = skill.replace(/^\d+\. `dev_flow_[a-z_]+`$/gmu, "");
  assert.equal(/`dev_flow_[a-z_]+/.test(withoutCatalog), false);
  for (const name of [rawTools[0], rawTools[1], rawTools[2], rawTools[3], rawTools[12], rawTools[13]]) assert.equal(skill.includes(`mcp__dev_flow__${name}`), true, name);
});

test("packaged references cover method steps and every submission tool", async () => {
  const methodReference = await readFile(join(skillRoot, "references", "method-profiles.md"), "utf8");
  const payloadReference = await readFile(join(skillRoot, "references", "node-payloads.md"), "utf8");
  const steps = [...marked(methodReference, "semantic-step-table").matchAll(/^\| `([^`]+)` \|/gmu)].map((match) => match[1]);
  assert.equal(steps.length, 24);
  assert.equal(new Set(steps).size, steps.length);
  for (const tool of rawTools.filter((name) => name.startsWith("dev_flow_submit_"))) assert.equal(payloadReference.includes(`\`${tool}\``), true, tool);
});

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.ok(start >= 0, heading);
  const end = markdown.indexOf("\n## ", start + 4);
  return markdown.slice(start, end < 0 ? undefined : end);
}

function marked(markdown, name) {
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const match = normalized.match(new RegExp(`<!-- ${name}:start -->\\n([\\s\\S]*?)\\n<!-- ${name}:end -->`, "u"));
  assert.notEqual(match, null, name);
  return match[1];
}
