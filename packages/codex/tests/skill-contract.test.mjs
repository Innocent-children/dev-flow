import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginRoot = join(packageRoot, "plugin");
const skillRoot = join(pluginRoot, "skills", "dev-flow");
const skillPath = join(skillRoot, "SKILL.md");
const expectedTools = [
  "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task", "dev_flow_get_next_action",
  "dev_flow_submit_requirements", "dev_flow_submit_design", "dev_flow_submit_tasks",
  "dev_flow_submit_implementation", "dev_flow_submit_test", "dev_flow_submit_comprehension",
  "dev_flow_submit_refactor", "dev_flow_submit_delivery", "dev_flow_resolve_blocker",
  "dev_flow_recover_action", "dev_flow_cancel_task",
];

test("plugin exposes one implicitly enabled Skill", async () => {
  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const frontmatter = parseFrontmatter(await readFile(skillPath, "utf8"));
  assert.equal(frontmatter.name, "dev-flow");
  assert.equal(`${manifest.name}:${frontmatter.name}`, "dev-flow-codex:dev-flow");
  assert.equal("allow_implicit_invocation" in frontmatter, false);
  assert.equal(await readFile(join(skillRoot, "agents", "openai.yaml"), "utf8"), "policy:\n  allow_implicit_invocation: true\n");
});

test("plugin metadata and MCP registration use resolvable product identities", async () => {
  const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const mcp = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  assert.deepEqual(plugin.interface.defaultPrompt, ["$dev-flow-codex:dev-flow implement the requested change in this repository."]);
  assert.equal(JSON.stringify(plugin.interface).includes("$dev-flow "), false);
  assert.deepEqual(mcp.mcpServers, { "dev-flow": { type: "stdio", command: "dev-flow-codex", args: ["mcp"] } });
});

test("Skill contains required operational sections and the complete Core tool catalog", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const heading of ["Request routing", "Admission gate", "Compatibility handshake", "Task discovery", "Governed action loop", "Method operation rendering", "Transition selection", "Closed forwarding contract", "Recovery-before-retry contract", "Evidence and verification budget"]) {
    assert.equal(skill.includes(`## ${heading}`), true, heading);
  }
  const catalog = [...skill.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gmu)].map((match) => match[1]);
  assert.deepEqual([...catalog].sort(), [...expectedTools].sort());
  assert.equal(section(skill, "Compatibility handshake").match(/\b(dev_flow_[a-z_]+)\b/u)?.[1], "dev_flow_server_info");
});

test("parallel batches require one Host worktree-backed Task per bounded item", async () => {
  const routing = section(await readFile(skillPath, "utf8"), "Request routing");
  for (const required of [
    "distinct Git worktree",
    "not be used for this route",
    "one worktree-backed Codex task for each bounded item",
    "Do not call any Dev Flow MCP tool from the coordinator",
    "do not create a parent Core Task",
    "stop before dispatch",
  ]) {
    assert.equal(routing.includes(required), true, required);
  }
});

test("one new request relocates only after ACTIVE_TASK_CONFLICT", async () => {
  const skill = await readFile(skillPath, "utf8");
  const routing = section(skill, "Request routing");
  const discovery = section(skill, "Task discovery");
  for (const required of [
    "A single new request is not a parallel batch",
    "Only a complete `ACTIVE_TASK_CONFLICT`",
    "Do not pre-dispatch the request",
  ]) {
    assert.equal(routing.includes(required), true, required);
  }
  for (const required of [
    "non-null `new_task`",
    "exactly `ACTIVE_TASK_CONFLICT`",
    "explicit resume",
    "exactly one worktree-backed Codex task",
    "`target.environment.type=\"worktree\"`",
    "omit the `startingState` member entirely",
    "committed default-branch state",
    "Never select a `working-tree` starting state",
    "Do not inspect, read, copy or apply",
    "Do not call any Dev Flow Core tool again",
    "stop without retrying or creating another child",
    "`HOST_OWNERSHIP_CONFLICT`",
    "No other error authorizes Host dispatch",
  ]) {
    assert.equal(discovery.includes(required), true, required);
  }
});

test("packaged references cover method steps, submission tools, and the new-task shape", async () => {
  const methodReference = await readFile(join(skillRoot, "references", "method-profiles.md"), "utf8");
  const payloadReference = await readFile(join(skillRoot, "references", "node-payloads.md"), "utf8");
  const steps = [...marked(methodReference, "semantic-step-table").matchAll(/^\| `([^`]+)` \|/gmu)].map((match) => match[1]);
  assert.equal(steps.length, 24);
  assert.equal(new Set(steps).size, steps.length);
  for (const tool of expectedTools.filter((name) => name.startsWith("dev_flow_submit_"))) assert.equal(payloadReference.includes(`\`${tool}\``), true, tool);
  const block = marked(await readFile(skillPath, "utf8"), "new-task-example");
  const example = JSON.parse(block.match(/^```json\n([\s\S]*)\n```$/u)?.[1]);
  assert.deepEqual(Object.keys(example).sort(), ["initial_out_of_scope", "initial_scope", "known_acceptance_criteria", "method_profile", "request", "verification_budget"]);
});

test("ordinary and corrected submissions must pass the live-schema conformance gate", async () => {
  const skill = await readFile(skillPath, "utf8");
  const forwarding = section(skill, "Closed forwarding contract");
  for (const required of [
    "Compare the complete draft with the live schema member by member",
    "every scalar, array, object and null type",
    "every enum and const",
    "submission schema conformance gate",
    "Do not call the submission tool until the complete draft passes it",
    "stop before mutation instead of guessing",
  ]) {
    assert.equal(forwarding.includes(required), true, required);
  }

  const correction = section(skill, "Bounded correction of the current action").replace(/\s+/gu, " ");
  for (const required of [
    "reread the live schema of the same submission tool",
    "changes limited to `recovery.allowed_paths`",
    "repeat the submission schema conformance gate",
    "does not define the corrected member's type",
  ]) {
    assert.equal(correction.includes(required), true, required);
  }

  const payloadReference = await readFile(join(skillRoot, "references", "node-payloads.md"), "utf8");
  assert.equal(payloadReference.includes("`complexity_justification` is `string[]`"), true);
  const block = marked(payloadReference, "design-node-result-example");
  const example = JSON.parse(block.match(/^```json\n([\s\S]*)\n```$/u)?.[1]);
  assert.equal(Array.isArray(example.baseline.complexity_justification), true);
  assert.deepEqual(example.baseline.complexity_justification, ["No new abstraction is required."]);
});

test("production adapter does not embed workflow or fixture state", async () => {
  for (const path of ["bin/dev-flow-codex.mjs", "lib/lifecycle.mjs", "lib/paths.mjs"]) {
    const source = await readFile(join(packageRoot, path), "utf8");
    assert.doesNotMatch(source, /tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures/iu, path);
    assert.doesNotMatch(source, /\btransitionTable\b|\btaskStates?\b|\bpersistTask\b|\bsqlite\b/iu, path);
  }
});

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.notEqual(match, null);
  return Object.fromEntries(match[1].split("\n").flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return [];
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[line.slice(0, separator).trim(), value]];
  }));
}

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.ok(start >= 0, heading);
  const end = markdown.indexOf("\n## ", start + 4);
  return markdown.slice(start, end < 0 ? undefined : end);
}

function marked(markdown, name) {
  const match = markdown.match(new RegExp(`<!-- ${name}:start -->\\n([\\s\\S]*?)\\n<!-- ${name}:end -->`, "u"));
  assert.notEqual(match, null, name);
  return match[1];
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else files.push(relative(root, absolute));
    }
  }
  await walk(root);
  return files.sort();
}
