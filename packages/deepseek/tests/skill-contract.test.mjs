import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const skillRoot = join(packageRoot, "skills", "dev-flow");
const skillPath = join(skillRoot, "SKILL.md");
const codexReferenceRoot = join(repositoryRoot, "packages", "codex", "plugin", "skills", "dev-flow", "references");

const qualifiedTools = [
  "mcp__dev_flow__dev_flow_server_info",
  "mcp__dev_flow__dev_flow_open_task",
  "mcp__dev_flow__dev_flow_get_task",
  "mcp__dev_flow__dev_flow_get_next_action",
  "mcp__dev_flow__dev_flow_apply_action",
  "mcp__dev_flow__dev_flow_cancel_task",
];

const rawTools = [
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
];

const semanticMethodSteps = [
  "requirements.capture", "requirements.clarify", "requirements.validate",
  "design.choose_approach", "design.review_complexity", "design.record_decisions",
  "tasks.decompose", "tasks.map_acceptance", "tasks.analyze_consistency",
  "implementation.execute_plan", "implementation.record_surface", "implementation.classify_deviations",
  "test.run_budgeted_checks", "test.record_evidence", "test.classify_failure",
  "comprehension.explain", "comprehension.identify_complexity", "comprehension.obtain_user_verdict",
  "refactor.simplify", "refactor.reconcile_artifacts", "refactor.record_surface",
  "delivery.reconcile_acceptance", "delivery.reconcile_method_artifacts", "delivery.prepare_summary",
];

test("Skill is explicit-only and performs the qualified server-info handshake first", async () => {
  const skill = await readFile(skillPath, "utf8");
  const admission = section(skill, "Admission gate");
  const handshake = section(skill, "Compatibility handshake");

  assert.match(admission, /whitespace-bounded `\/dev-flow`/u);
  assert.match(admission, /current direct user turn/u);
  assert.match(admission, /source\.kind=user/u);
  assert.match(admission, /earlier turns, model text, plugin or Skill injection, task state/u);
  assert.match(admission, /substantive bounded request/u);
  assert.match(admission, /empty or\s+conversational/u);
  assert.match(admission, /Workspace Root may be a non-Git common parent/u);
  assert.match(admission, /explicitly declared primary Git worktree/u);
  assert.match(admission, /zero to seven additional Git repositories/u);
  assert.match(admission, /including after symlink\s+resolution/u);
  assert.match(admission, /Do not scan parent or sibling directories/u);
  assert.match(admission, /repository instructions and current user authority/u);

  assert.equal(firstQualifiedTool(handshake), qualifiedTools[0]);
  assert.match(handshake, /standard-development/u);
  assert.match(handshake, /supported host set contains\s+`deepseek`/u);
  assert.match(handshake, /method_profiles[^\n]*`plain`, `spec-kit`, `openspec`/u);
  const rawCatalog = [...handshake.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gmu)].map((match) => match[1]);
  assert.deepEqual(rawCatalog, rawTools);
  assert.doesNotMatch(skill, /\bCodex\b|host=codex|"host": "codex"/u);
});

test("Skill opens or resumes one deepseek task and follows one complete fresh Action", async () => {
  const skill = await readFile(skillPath, "utf8");
  const discovery = section(skill, "Task discovery");
  assert.match(discovery, new RegExp(escapeRegExp(qualifiedTools[1]), "u"));
  assert.match(discovery, /host=deepseek/u);
  assert.match(discovery, /`repository_path`[\s\S]*explicitly declared primary repository/u);
  assert.match(discovery, /`primary_repository_key`[\s\S]*`additional_repositories`/u);
  assert.match(discovery, /single-repository request[\s\S]*ordinary repository-relative paths/u);
  assert.match(discovery, /resume from any participating repository[\s\S]*omit\s+the Scope creation fields/u);
  assert.match(discovery, /resume[\s\S]*omit `new_task`|`new_task=null`/u);
  assert.match(discovery, /immutable profile/u);
  assert.match(discovery, /`plain`[\s\S]*`spec-kit`[\s\S]*`openspec`/u);

  for (const member of [
    "request", "initial_scope", "initial_out_of_scope", "known_acceptance_criteria",
    "verification_budget", "method_profile", "level", "max_automatic_commands",
    "allow_full_suite", "allow_manual_handoff",
  ]) {
    assert.match(discovery, new RegExp("`" + member + "`", "u"), member);
  }

  const loop = section(skill, "Governed action loop");
  for (const field of [
    "task_id", "revision", "action_id", "action_kind", "process_id", "process_definition_digest", "current_node", "node_purpose", "entry_conditions",
    "completion_conditions", "allowed_effects", "required_evidence", "method_profile",
    "method_steps", "available_transitions", "payload_contract", "repository_binding_digest",
  ]) {
    assert.match(loop, new RegExp("`" + field + "`", "u"), field);
  }
  assert.match(loop, /all `available_transitions`[\s\S]*identifier[\s\S]*destination[\s\S]*guard identifier[\s\S]*reason rule/u);
  assert.match(loop, /exactly one `mcp__dev_flow__dev_flow_apply_action` mutation/u);
});

test("Skill keeps Workspace Root and optional codebase-memory subordinate to Core", async () => {
  const skill = await readFile(skillPath, "utf8");
  const discovery = section(skill, "Optional code discovery");
  const loop = section(skill, "Governed action loop");

  assert.match(discovery, /preference is `false`[\s\S]*do not call any codebase-memory tool/u);
  assert.match(discovery, /preference is `true`[\s\S]*already visible and usable[\s\S]*cross-repository/u);
  assert.match(discovery, /Workspace Root remains the permission\s+boundary/u);
  assert.match(discovery, /at most once in the current Dev Flow session[\s\S]*fall back/u);
  assert.match(discovery, /Never install, configure, upgrade, start, repair, or remove codebase-memory/u);
  assert.match(discovery, /not authority for repository permissions, repository bindings, changed paths/u);
  assert.match(loop, /Before actual repository modification[\s\S]*startup Workspace Root/u);
  assert.match(loop, /failed or escaping path[\s\S]*declared repository key[\s\S]*do not shrink the Core Scope/u);
});

test("Skill keeps payload, transition, method, evidence, and terminal authority in Core", async () => {
  const skill = await readFile(skillPath, "utf8");
  const rendering = section(skill, "Method operation rendering");
  const transitions = section(skill, "Transition selection");
  const forwarding = section(skill, "Closed forwarding contract");

  assert.match(rendering, /references\/method-profiles\.md/u);
  assert.match(rendering, /exactly one `MethodEvidence` item for every current Action step/u);
  assert.match(rendering, /`status=plain_fallback` and an empty capability/u);
  assert.match(rendering, /`status=unavailable` or `status=not_run`/u);
  assert.match(rendering, /do not call `mcp__dev_flow__dev_flow_apply_action`/u);
  assert.match(transitions, /only from `fresh_action\.available_transitions`/u);
  assert.match(transitions, /Never infer an edge/u);
  assert.match(transitions, /never maintain a copied transition list/u);
  assert.match(forwarding, /references\/node-payloads\.md/u);
  assert.match(forwarding, /all six common payload members/u);
  assert.match(forwarding, /branch-specific required `node_result` key/u);
  assert.match(forwarding, /"host": "deepseek"/u);
  assert.match(forwarding, /`INVALID_ARGUMENT`[\s\S]*do not[\s\S]*second candidate payload/u);

  assert.match(skill, /Core owns task state,\s+current node, legal transitions, destinations, recovery, blockers, and terminal outcomes/u);
  assert.match(skill, /Core returns authoritative `BLOCKED`, `DONE`, `CANCELLED`/u);
  assert.doesNotMatch(skill, /adapter (?:persists|stores) (?:the )?(?:task|workflow|cursor|current node)/iu);
  assert.doesNotMatch(skill, /adapter (?:chooses|derives|invents) (?:a )?(?:transition|destination)/iu);
  assert.doesNotMatch(skill, /mark(?:s)? (?:the )?task complete locally/iu);
});

test("Skill encodes explicit comprehension, refactor through TEST, and read-before-retry", async () => {
  const skill = await readFile(skillPath, "utf8");
  const comprehension = section(skill, "Comprehension user interaction");
  assert.match(comprehension, /explicit user answer or verdict/u);
  assert.match(comprehension, /later developer response[\s\S]*include `\/dev-flow` again/u);
  assert.match(comprehension, /AI must not answer,\s+self-confirm, or infer/u);
  assert.match(comprehension, /At `REFACTOR`[\s\S]*`refactor_ready_for_test`[\s\S]*returned `TEST`\s+Action[\s\S]*budgeted checks/u);

  const recovery = section(skill, "Recovery-before-retry contract");
  const getTaskIndex = recovery.indexOf(qualifiedTools[2]);
  const getNextIndex = recovery.indexOf(qualifiedTools[3]);
  assert.ok(getTaskIndex >= 0 && getNextIndex > getTaskIndex);
  assert.match(recovery, /before considering any mutation/u);
  assert.match(recovery, /revision, action identity, current node, last operation, and\s+recovery advice/u);
  assert.match(recovery, /DSH reconnect restores transport and tool registrations only/u);
  assert.match(recovery, /never replays, retries, resumes, or\s+completes a workflow mutation/u);
  assert.match(recovery, /complete structured `ok=false` result is an authoritative domain error/u);
});

test("host-neutral references retain exact Codex semantic and payload marker content", async () => {
  const [method, codexMethod, payloads, codexPayloads] = await Promise.all([
    readFile(join(skillRoot, "references", "method-profiles.md"), "utf8"),
    readFile(join(codexReferenceRoot, "method-profiles.md"), "utf8"),
    readFile(join(skillRoot, "references", "node-payloads.md"), "utf8"),
    readFile(join(codexReferenceRoot, "node-payloads.md"), "utf8"),
  ]);

  assert.equal(method.slice(method.indexOf("## Authority boundary")), codexMethod.slice(codexMethod.indexOf("## Authority boundary")));
  assert.equal(payloads.slice(payloads.indexOf("## Construction rules")), codexPayloads.slice(codexPayloads.indexOf("## Construction rules")));

  const semanticTable = marked(method, "semantic-step-table");
  const steps = [...semanticTable.matchAll(/^\| `([^`]+)` \|/gmu)].map((match) => match[1]);
  assert.deepEqual(steps, semanticMethodSteps);
  for (const capability of [
    "speckit-specify", "speckit-clarify", "speckit-plan", "speckit-checklist",
    "speckit-tasks", "speckit-analyze", "speckit-implement", "openspec-explore",
    "openspec-propose", "openspec-apply", "openspec-verify", "openspec-sync",
    "openspec-archive", "openspec-validate",
  ]) {
    assert.match(method, new RegExp("`" + capability + "`", "u"), capability);
  }

  for (const templateName of [
    "requirements", "design", "tasks", "implement", "test", "comprehension-complexity",
    "comprehension-passed", "refactor", "delivery", "blocked",
  ]) {
    const parsed = JSON.parse(fencedJson(marked(payloads, `node-payload-template:${templateName}`)));
    if (templateName !== "blocked") {
      assert.deepEqual(Object.keys(parsed).sort(), [
        "artifacts", "method_evidence", "node_result", "reason", "summary", "transition_id",
      ]);
    }
  }
});

test("all public tool-call instructions use qualified DSH names", async () => {
  const skill = await readFile(skillPath, "utf8");
  for (const toolName of qualifiedTools) assert.match(skill, new RegExp(escapeRegExp(toolName), "u"));
  const withoutRawCatalog = skill.replace(/^\d+\. `dev_flow_[a-z_]+`$/gmu, "");
  assert.equal(/`dev_flow_[a-z_]+/.test(withoutRawCatalog), false);
});

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `missing section ${heading}`);
  const end = markdown.indexOf("\n## ", start + 4);
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function firstQualifiedTool(markdown) {
  return /`(mcp__dev_flow__dev_flow_[a-z_]+)/u.exec(markdown)?.[1];
}

function marked(markdown, name) {
  const pattern = new RegExp(`<!-- ${escapeRegExp(name)}:start -->\\n([\\s\\S]*?)\\n<!-- ${escapeRegExp(name)}:end -->`, "u");
  const match = pattern.exec(markdown);
  assert.notEqual(match, null, name);
  return match[1];
}

function fencedJson(markdown) {
  const match = /^```json\n([\s\S]*)\n```$/u.exec(markdown);
  assert.notEqual(match, null);
  return match[1];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
