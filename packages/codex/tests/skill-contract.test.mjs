import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const skillRoot = join(pluginRoot, "skills", "dev-flow");
const skillPath = join(skillRoot, "SKILL.md");
const expectedTools = [
  "dev_flow_server_info", "dev_flow_open_task", "dev_flow_get_task", "dev_flow_get_next_action",
  "dev_flow_submit_requirements", "dev_flow_submit_design", "dev_flow_submit_tasks",
  "dev_flow_submit_implementation", "dev_flow_submit_test", "dev_flow_submit_comprehension",
  "dev_flow_submit_refactor", "dev_flow_submit_delivery", "dev_flow_prepare_task_relocation",
  "dev_flow_resolve_blocker", "dev_flow_recover_action", "dev_flow_cancel_task",
  "dev_flow_abandon_task",
];

test("plugin exposes one implicitly enabled Skill", async () => {
  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const frontmatter = parseFrontmatter(await readFile(skillPath, "utf8"));
  assert.equal(frontmatter.name, "dev-flow");
  assert.equal(`${manifest.name}:${frontmatter.name}`, "dev-flow-codex:dev-flow");
  assert.equal("allow_implicit_invocation" in frontmatter, false);
  assert.equal(
    (await readFile(join(skillRoot, "agents", "openai.yaml"), "utf8")).replace(/\r\n?/gu, "\n"),
    "policy:\n  allow_implicit_invocation: true\n",
  );
});

test("plugin metadata and MCP registration use resolvable product identities", async () => {
  const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const mcp = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  assert.deepEqual(plugin.interface.defaultPrompt, ["$dev-flow-codex:dev-flow assess the requested change in this repository before starting Dev Flow."]);
  assert.equal(JSON.stringify(plugin.interface).includes("$dev-flow "), false);
  assert.deepEqual(mcp.mcpServers, { "dev-flow": { type: "stdio", command: "dev-flow-codex", args: ["mcp"] } });
});

test("Skill contains required operational sections and the complete Core tool catalog", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const heading of ["Request routing", "Admission gate", "Provisioning confirmation", "Compatibility handshake", "Task discovery", "Governed action loop", "Method operation rendering", "Transition selection", "Closed forwarding contract", "Recovery-before-retry contract", "Evidence and verification budget", "Task relocation and Codex Handoff", "Terminal worktree presentation and cleanup"]) {
    assert.equal(skill.includes(`## ${heading}`), true, heading);
  }
  const catalog = [...skill.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gmu)].map((match) => match[1]);
  assert.deepEqual([...catalog].sort(), [...expectedTools].sort());
  assert.equal(section(skill, "Compatibility handshake").match(/\b(dev_flow_[a-z_]+)\b/u)?.[1], "dev_flow_server_info");
});

test("all new requests assess and wait before worktree dispatch", async () => {
  const routing = section(await readFile(skillPath, "utf8"), "Request routing").replace(/\s+/gu, " ");
  const admission = section(await readFile(skillPath, "utf8"), "Admission gate");
  for (const required of [
    "explicit resume",
    "receipt-backed bootstrap",
    "without repeating assessment or confirmation",
    "skips new-request suitability assessment",
    "Assess every item first",
    "No child dispatch occurs before that confirmation",
    "one Host task, one dedicated worktree, and one Core Task",
  ]) {
    assert.equal(routing.includes(required), true, required);
  }
  for (const required of [
    "change_level: small | standard | large | uncertain",
    "recommendation: direct | dev_flow | clarify",
    "anchor: request_digest",
    "Show the assessment and stop",
    "zero Dev Flow calls",
    "anchor change invalidates the assessment",
  ]) assert.equal(admission.includes(required), true, required);
});

test("confirmed launches use frozen refs and never relocate after active conflict", async () => {
  const skill = await readFile(skillPath, "utf8");
  const routing = section(skill, "Request routing");
  const provisioning = section(skill, "Provisioning confirmation").replace(/\s+/gu, " ");
  const discovery = section(skill, "Task discovery");
  for (const required of [
    "exact selector still follows",
    "`ACTIVE_TASK_CONFLICT`",
    "never authorizes post-conflict relocation",
  ]) {
    assert.equal(routing.includes(required), true, required);
  }
  for (const required of [
    "`repository_key`, `remote_name`, `base_branch`, and `target_branch`",
    "refs/remotes/<remote>/<base>",
    "`target.environment.type=\"worktree\"`",
    "omit `onMissing`",
    "clientThreadId",
    "never dispatch again",
    "child consumes the receipt before any Core call",
    "workspace origin",
  ]) {
    assert.equal(provisioning.includes(required), true, required);
  }
  assert.match(discovery, /`ACTIVE_TASK_CONFLICT`[\s\S]*never starts relocation/u);
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

test("method-profile fixture materializes the current ServerInfo and Action projection contract", async () => {
  const [coreVersion, currentServerInfo, fixture] = await Promise.all([
    readFile(join(repositoryRoot, "CORE_VERSION"), "utf8").then((value) => value.trim()),
    readFile(join(repositoryRoot, "protocol", "fixtures", "graph-server-info.json"), "utf8").then(JSON.parse),
    readFile(join(packageRoot, "tests", "fixtures", "graph-method-profiles.json"), "utf8").then(JSON.parse),
  ]);

  assert.equal(fixture.server_info.version, coreVersion);
  for (const field of ["product", "transport", "health", "supported_hosts", "supported_processes", "method_profiles", "tools"]) {
    assert.deepEqual(fixture.server_info[field], currentServerInfo[field], field);
  }
  assert.deepEqual(fixture.server_info.tools, expectedTools);

  const actionMembers = [
    "task_id", "revision", "action_id", "action_kind", "submission_tool", "process_id",
    "process_definition_digest", "current_node", "node_purpose", "entry_conditions",
    "completion_conditions", "allowed_effects", "required_evidence", "method_profile",
    "method_steps", "available_transitions", "payload_contract", "guidance",
    "repository_binding_digest", "issuance_identity_digest", "issuance_history_digest",
    "issuance_content_digest", "issued_at",
  ].sort();
  const digestPattern = /^[0-9a-f]{64}$/u;
  const payloadContracts = {
    requirements: "requirements-result",
    test: "test-result",
    comprehension_review: "comprehension-result",
  };
  for (const [name, template] of Object.entries(fixture.actions)) {
    assert.deepEqual(Object.keys(template).sort(), actionMembers, name);
    assert.equal(template.process_definition_digest, currentServerInfo.supported_processes[0].definition_digest, name);
    assert.equal(template.payload_contract, payloadContracts[name], name);
    for (const member of ["repository_binding_digest", "issuance_identity_digest", "issuance_history_digest", "issuance_content_digest"]) {
      assert.match(template[member], digestPattern, `${name}.${member}`);
    }
    for (const evidence of template.required_evidence) {
      assert.deepEqual(Object.keys(evidence).sort(), ["kind", "required"], `${name}.required_evidence`);
      assert.equal(evidence.required, true);
    }
    for (const step of template.method_steps) {
      assert.deepEqual(Object.keys(step).sort(), ["purpose", "required", "step_id"], `${name}.${step.step_id}`);
      assert.equal(step.required, true);
    }
    for (const transition of template.available_transitions) {
      assert.deepEqual(Object.keys(transition).sort(), [
        "description", "destination_node", "guard_id", "reason_required", "selection_condition", "transition_id",
      ], `${name}.${transition.transition_id}`);
    }
  }

  assert.deepEqual([...new Set(fixture.scenarios.map((scenario) => scenario.profile))].sort(), ["openspec", "plain", "spec-kit"]);
  for (const scenario of fixture.scenarios) {
    const template = fixture.actions[scenario.action];
    assert.notEqual(template, undefined, scenario.id);
    const action = { ...template, method_profile: scenario.profile };
    assert.deepEqual(Object.keys(action).sort(), actionMembers, scenario.id);
    assert.equal(currentServerInfo.method_profiles.includes(action.method_profile), true, scenario.id);
    const steps = new Set(action.method_steps.map((step) => step.step_id));
    for (const evidence of scenario.method_evidence) {
      assert.equal(steps.has(evidence.step_id), true, `${scenario.id}.${evidence.step_id}`);
      assert.equal(["completed", "plain_fallback", "unavailable", "not_run"].includes(evidence.status), true, scenario.id);
      if (evidence.status === "completed") assert.equal(scenario.available_capabilities.includes(evidence.capability), true, scenario.id);
      else assert.equal(evidence.capability, "", scenario.id);
    }
    const nodeResult = typeof scenario.node_result === "string" ? fixture[scenario.node_result] : scenario.node_result;
    const transition = action.available_transitions.find((candidate) => candidate.transition_id === scenario.transition_id);
    const methodWorkComplete = scenario.method_evidence.length === action.method_steps.length
      && scenario.method_evidence.every((evidence) => ["completed", "plain_fallback"].includes(evidence.status));
    assert.equal(methodWorkComplete && nodeResult !== null && transition !== undefined, scenario.should_apply, scenario.id);
    if (scenario.should_apply && transition.reason_required) assert.match(scenario.reason ?? "", /\S/u, scenario.id);
  }
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

test("relocation, abandonment, and cleanup keep Core and Host responsibilities separate", async () => {
  const skill = await readFile(skillPath, "utf8");
  const relocation = section(skill, "Task relocation and Codex Handoff").replace(/\s+/gu, " ");
  const terminal = section(skill, "Terminal worktree presentation and cleanup").replace(/\s+/gu, " ");
  for (const required of [
    "`dev_flow_prepare_task_relocation`", "coordinator other than the thread being moved",
    "one `handoff_thread` call", "never dispatched again", "atomically replacing bindings and claims",
  ]) assert.equal(relocation.includes(required), true, required);
  for (const required of [
    "`dev_flow_abandon_task`", "Automatic cleanup is always false",
    "two separate current user authorizations", "Managed worktree", "without force",
  ]) assert.equal(skill.includes(required) || terminal.includes(required), true, required);
});

test("production adapter does not embed workflow or fixture state", async () => {
  for (const path of [
    "bin/dev-flow-codex.mjs", "lib/lifecycle.mjs", "lib/paths.mjs", "lib/platform.mjs",
    "lib/provisioning-receipt.mjs", "lib/task-admission.mjs", "lib/task-launch.mjs",
    "lib/worktree-lifecycle.mjs",
  ]) {
    const source = await readFile(join(packageRoot, path), "utf8");
    assert.doesNotMatch(source, /tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures/iu, path);
    assert.doesNotMatch(source, /\btransitionTable\b|\btaskStates?\b|\bpersistTask\b|\bsqlite\b/iu, path);
  }
});

function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n/u);
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
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const match = normalized.match(new RegExp(`<!-- ${name}:start -->\\n([\\s\\S]*?)\\n<!-- ${name}:end -->`, "u"));
  assert.notEqual(match, null, name);
  return match[1];
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else files.push(relative(root, absolute).split(sep).join("/"));
    }
  }
  await walk(root);
  return files.sort();
}
