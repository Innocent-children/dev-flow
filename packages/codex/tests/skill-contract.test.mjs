import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginRoot = join(packageRoot, "plugin");
const skillPath = join(pluginRoot, "skills", "dev-flow", "SKILL.md");

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
  assert.equal(frontmatter.allow_implicit_invocation, "false");
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
