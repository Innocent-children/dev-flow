import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const pluginRoot = join(packageRoot, "plugin");
const skillPath = join(pluginRoot, "skills", "dev-flow", "SKILL.md");
const skillMetadataPath = join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml");

const exactTools = [
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
];

test("plugin exposes exactly one explicitly selected dev-flow Skill", async () => {
  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);

  const skill = await readFile(skillPath, "utf8");
  const frontmatter = parseFrontmatter(skill);
  assert.equal(frontmatter.name, "dev-flow");
  assert.match(frontmatter.description, /explicit/i);
  assert.match(frontmatter.description, /\$dev-flow/);
  assert.match(frontmatter.description, /never.*implicit/i);
  assert.equal("allow_implicit_invocation" in frontmatter, false);

  const metadata = await readFile(skillMetadataPath, "utf8");
  assert.equal(metadata, "policy:\n  allow_implicit_invocation: false\n");
});

test("Skill admits only an exact current-turn selector with substantive or resume intent", async () => {
  const skill = await readFile(skillPath, "utf8");
  const admissionIndex = skill.indexOf("## Admission gate");
  const handshakeIndex = skill.indexOf("## Compatibility handshake");
  assert.ok(admissionIndex >= 0, "Skill must define a local admission gate");
  assert.ok(handshakeIndex > admissionIndex, "local admission must precede the Core handshake");

  const admission = skill.slice(admissionIndex, handshakeIndex);
  assert.match(admission, /current user turn/i);
  assert.match(admission, /exact[^\n]*`\$dev-flow`/i);
  assert.match(admission, /substantive[^\n]*(?:requirement|request)/i);
  assert.match(admission, /explicit[^\n]*resume/i);
  assert.match(admission, /empty|conversational/i);
  assert.match(admission, /stop before[^\n]*(?:Core|Dev Flow tool)/i);
  assert.match(admission, /zero[^\n]*(?:Core|Dev Flow tool)[^\n]*calls/i);
  assert.match(admission, /implicit/i);

  assert.match(admission, /read-only Git/i);
  assert.match(admission, /one current Git worktree/i);
  assert.match(admission, /canonical/i);
  assert.match(admission, /another repository|multiple repositories|more than one repository/i);
  assert.match(admission, /repository instructions/i);
  assert.match(admission, /user authority/i);
});

test("Skill calls server-info first and admits only the exact six-tool Core contract", async () => {
  const skill = await readFile(skillPath, "utf8");
  const handshakeIndex = skill.indexOf("## Compatibility handshake");
  assert.ok(handshakeIndex >= 0);

  const firstToolCall = firstToolReference(skill.slice(handshakeIndex));
  assert.equal(firstToolCall, "dev_flow_server_info");
  assert.match(skill.slice(handshakeIndex), /dev_flow_server_info\(\{\}\)/);

  const catalog = [...skill.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gm)].map((match) => match[1]);
  assert.deepEqual(catalog, exactTools);

  const handshake = skill.slice(handshakeIndex);
  for (const expectation of [
    /product[^\n]*`dev-flow`/i,
    /Core Contract[^\n]*`0\.1`/i,
    /transport[^\n]*`stdio`/i,
    /health[^\n]*`ready`/i,
    /supported host[^\n]*`codex`/i,
    /exactly[^\n]*six/i,
    /incomplete|truncated|malformed/i,
    /stop/i,
  ]) {
    assert.match(handshake, expectation);
  }

  assert.doesNotMatch(skill, /tests\/fixtures|fake-(?:codex|core)/i);
  assert.doesNotMatch(skill, /generic shell MCP|seventh tool/i);
});

test("Skill follows fresh Core authority for create, resume, one mutation, and continuation", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const heading of ["## Task discovery", "## Governed action loop", "## Closed forwarding contract"]) {
    assert.equal(skill.includes(heading), true, `missing ${heading}`);
  }
  const discovery = section(skill, "Task discovery");
  assert.match(discovery, /host=codex|host=`codex`|`host=codex`/i);
  assert.match(discovery, /resume[\s\S]*omit[\s\S]*`new_task`/i);
  assert.match(discovery, /new[\s\S]*contract[\s\S]*user/i);
  assert.match(discovery, /ownership|contract conflict/i);
  assert.match(discovery, /stop/i);

  const loop = section(skill, "Governed action loop");
  for (const identity of [
    "task ID",
    "revision",
    "action ID",
    "action kind",
    "repository-binding digest",
    "allowed effects",
    "required evidence",
    "payload schema",
  ]) {
    assert.match(loop, new RegExp(escapeRegExp(identity), "i"));
  }
  assert.match(loop, /fresh|live Core/i);
  assert.match(loop, /one mutation|exactly one mutation/i);
  assert.match(loop, /request ID/i);
  assert.match(loop, /complete successful[\s\S]*(?:returned|fresh)[\s\S]*(?:next action|Core read)/i);

  const forwarding = section(skill, "Closed forwarding contract");
  assert.match(forwarding, /closed payload/i);
  assert.match(forwarding, /unknown fields|aliases/i);
  assert.match(forwarding, /recovery_apply[\s\S]*Core/i);
});

test("Skill reads before retry and preserves budgets, evidence labels, and terminal stops", async () => {
  const skill = await readFile(skillPath, "utf8");
  const recovery = section(skill, "Recovery-before-retry contract");
  for (const uncertainty of ["missing", "cancelled", "malformed", "truncated", "uncertain"]) {
    assert.match(recovery, new RegExp(uncertainty, "i"));
  }
  assert.match(recovery, /does not immediately repeat[\s\S]*dev_flow_apply_action/i);
  assert.match(recovery, /dev_flow_get_task[\s\S]*dev_flow_get_next_action/i);
  assert.match(recovery, /operation probe[\s\S]*(?:retained|original)/i);
  assert.match(recovery, /retry[\s\S]*(?:fresh|Core)[\s\S]*safe/i);
  assert.match(recovery, /fabricated/i);

  const evidence = section(skill, "Evidence and verification budget");
  assert.match(evidence, /counted exactly|count.*verification commands/i);
  assert.match(evidence, /full suite/i);
  assert.match(evidence, /manual handoff/i);
  assert.match(evidence, /static[\s\S]*(?:simulated Core|fake-Core)[\s\S]*user[\s\S]*native/i);
  assert.match(evidence, /repository instructions/i);

  const terminal = section(skill, "Blocked and terminal behavior");
  for (const outcome of ["BLOCKED", "DONE", "CANCELLED", "conflict"]) {
    assert.match(terminal, new RegExp(outcome, "i"));
  }
  assert.match(terminal, /Core(?:'s|-owned| returns)|authoritative/i);
  assert.match(terminal, /stop/i);
});

test("Skill and production adapter contain no workflow authority or test fixture dependency", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const forbiddenHeading of [
    "## State machine",
    "## Action catalog",
    "## Transition table",
    "## Error taxonomy",
    "## Completion predicate",
  ]) {
    assert.equal(skill.includes(forbiddenHeading), false, forbiddenHeading);
  }
  for (const forbidden of [
    /\btransitionTable\b/,
    /\btaskStates?\b/,
    /\bactionPayloadCatalog\b/,
    /\bnextState\b/,
    /\bpersistTask\b/,
    /\bisComplete\b/,
    /(?:tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures)/i,
  ]) {
    assert.doesNotMatch(skill, forbidden);
  }

  const mcp = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  assert.equal(mcp.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  assert.deepEqual(Object.keys(mcp.mcpServers), ["dev-flow"]);
  assert.deepEqual(mcp.mcpServers["dev-flow"], {
    type: "stdio",
    command: "dev-flow-codex",
    args: ["mcp"],
  });

  for (const relativePath of ["bin/dev-flow-codex.mjs", "lib/lifecycle.mjs", "lib/paths.mjs"]) {
    const source = await readFile(join(packageRoot, relativePath), "utf8");
    for (const forbidden of [
      /(?:tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures)/i,
      /\btransitionTable\b/,
      /\btaskStates?\b/,
      /\bactionPayloadCatalog\b/,
      /\bpersistTask\b/,
      /\bsqlite\b/i,
    ]) {
      assert.doesNotMatch(source, forbidden, `${relativePath} embeds authority or a test import`);
    }
  }

  for (const relativePath of [
    "scripts/write-codex-journey-evidence.mjs",
    "scripts/validate-codex-journey-evidence.mjs",
  ]) {
    const source = await readFile(join(repositoryRoot, relativePath), "utf8");
    for (const forbidden of [
      /(?:tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures)/i,
      /\btransitionTable\b/,
      /\btaskStates?\b/,
      /\bactionPayloadCatalog\b/,
      /\bpersistTask\b/,
      /\bsqlite\b/i,
    ]) {
      assert.doesNotMatch(source, forbidden, `${relativePath} embeds authority or a test import`);
    }
  }
});

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "Skill must start with YAML frontmatter");
  const result = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function firstToolReference(markdown) {
  const match = markdown.match(/\b(dev_flow_[a-z_]+)\b/);
  return match?.[1];
}

function section(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.ok(start >= 0, `missing ${marker}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next < 0 ? undefined : next);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(relative(root, path).split("\\").join("/"));
    }
  }
  await visit(root);
  return files.sort();
}
