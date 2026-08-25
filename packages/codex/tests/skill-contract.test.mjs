import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const pluginRoot = join(packageRoot, "plugin");
const readmePath = join(packageRoot, "README.md");
const skillPath = join(pluginRoot, "skills", "dev-flow", "SKILL.md");
const skillMetadataPath = join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml");
const methodProfileFixturePath = join(packageRoot, "tests", "fixtures", "graph-method-profiles.json");
const skillBaseName = "dev-flow";
const installedSkillName = "dev-flow-codex:dev-flow";
const explicitSelector = `$${installedSkillName}`;

const exactTools = [
  "dev_flow_server_info",
  "dev_flow_open_task",
  "dev_flow_get_task",
  "dev_flow_get_next_action",
  "dev_flow_apply_action",
  "dev_flow_cancel_task",
];

const semanticMethodSteps = [
  "requirements.capture",
  "requirements.clarify",
  "requirements.validate",
  "design.choose_approach",
  "design.review_complexity",
  "design.record_decisions",
  "tasks.decompose",
  "tasks.map_acceptance",
  "tasks.analyze_consistency",
  "implementation.execute_plan",
  "implementation.record_surface",
  "implementation.classify_deviations",
  "test.run_budgeted_checks",
  "test.record_evidence",
  "test.classify_failure",
  "comprehension.explain",
  "comprehension.identify_complexity",
  "comprehension.obtain_user_verdict",
  "refactor.simplify",
  "refactor.reconcile_artifacts",
  "refactor.record_surface",
  "delivery.reconcile_acceptance",
  "delivery.reconcile_method_artifacts",
  "delivery.prepare_summary",
];

const specKitCapabilities = [
  "speckit-specify",
  "speckit-clarify",
  "speckit-plan",
  "speckit-checklist",
  "speckit-tasks",
  "speckit-analyze",
  "speckit-implement",
];

const openSpecCapabilities = [
  "openspec-explore",
  "openspec-propose",
  "openspec-apply",
  "openspec-verify",
  "openspec-sync",
  "openspec-archive",
  "openspec-validate",
];

test("plugin exposes one implicitly enabled Skill with an exact explicit selector", async () => {
  const skillFiles = (await walkFiles(join(pluginRoot, "skills"))).filter((path) => path.endsWith("SKILL.md"));
  assert.deepEqual(skillFiles, ["dev-flow/SKILL.md"]);

  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const skill = await readFile(skillPath, "utf8");
  const frontmatter = parseFrontmatter(skill);
  assert.equal(frontmatter.name, skillBaseName);
  assert.equal(`${manifest.name}:${frontmatter.name}`, installedSkillName);
  for (const positive of ["implementation", "bug fixes", "refactoring", "targeted testing", "development delivery"]) {
    assert.match(frontmatter.description, new RegExp(escapeRegExp(positive), "i"));
  }
  for (const negative of ["explanation-only", "status-only", "design discussion", "ordinary questions", "ambiguous requests"]) {
    assert.match(frontmatter.description, new RegExp(escapeRegExp(negative), "i"));
  }
  assert.match(frontmatter.description, /selected implicitly/i);
  assert.match(frontmatter.description, new RegExp(escapeRegExp(explicitSelector)));
  assert.match(frontmatter.description, /Do not create a Dev Flow Task/i);
  assert.equal("allow_implicit_invocation" in frontmatter, false);

  const metadata = await readFile(skillMetadataPath, "utf8");
  assert.equal(metadata, "policy:\n  allow_implicit_invocation: true\n");
});

test("plugin user-facing metadata emits only the installed full Skill selector", async () => {
  const plugin = JSON.parse(await readFile(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  assert.match(plugin.description, /Smart and explicit/i);
  assert.match(plugin.interface.shortDescription, /Smart Dev Flow/i);
  assert.match(plugin.interface.longDescription, /Automatically select Dev Flow/i);
  assert.match(plugin.interface.longDescription, /non-task requests do not create Tasks/i);
  assert.match(plugin.interface.longDescription, new RegExp(escapeRegExp(explicitSelector)));
  assert.deepEqual(plugin.interface.defaultPrompt, [
    `${explicitSelector} implement the requested change in this repository.`,
  ]);
  assert.equal(
    JSON.stringify(plugin.interface).match(/\$dev-flow(?!-codex)/gu),
    null,
    "plugin metadata must not generate the unresolvable bare selector",
  );
});

test("Skill converges implicit and exact explicit selection on one substantive admission", async () => {
  const skill = await readFile(skillPath, "utf8");
  const admissionIndex = skill.indexOf("## Admission gate");
  const handshakeIndex = skill.indexOf("## Compatibility handshake");
  assert.ok(admissionIndex >= 0, "Skill must define a local admission gate");
  assert.ok(handshakeIndex > admissionIndex, "local admission must precede the Core handshake");

  const admission = skill.slice(admissionIndex, handshakeIndex);
  assert.match(admission, /current user turn/i);
  assert.match(admission, /Skill resource\/base name[^\n]*`dev-flow`/i);
  assert.match(admission, /installed Skill full name[^\n]*`dev-flow-codex:dev-flow`/i);
  assert.match(admission, /only exact explicit selector[^\n]*`\$dev-flow-codex:dev-flow`/i);
  assert.match(admission, /bare[^\n]*`\$dev-flow`[^\n]*(?:not an alias|does not select|not an explicit selector)/i);
  assert.match(admission, /wrong[^\n]*plugin namespace/i);
  assert.match(admission, /wrong[^\n]*Skill base name/i);
  assert.match(admission, /missing selector[^\n]*valid only[^\n]*implicitly/i);
  assert.match(admission, /Both activation paths use this same admission gate/i);
  for (const positive of ["implementation", "bug fix", "refactoring", "targeted testing", "development delivery"]) {
    assert.match(admission, new RegExp(escapeRegExp(positive), "i"));
  }
  for (const negative of ["Explanation-only", "status-only", "design discussion", "ordinary questions", "ambiguous requests"]) {
    assert.match(admission, new RegExp(escapeRegExp(negative), "i"));
  }
  assert.match(admission, /do not create or resume a Dev Flow Task/i);
  assert.match(admission, /substantive[^\n]*(?:requirement|request)/i);
  assert.match(admission, /explicit[^\n]*resume/i);
  assert.match(admission, /empty|conversational/i);
  assert.match(admission, /stop before Skill-owned task/i);
  assert.match(admission, /do\s+not complete a task-bearing call/i);
  assert.match(admission, /Core-rejected\s+calls[\s\S]*reported honestly/i);
  assert.match(admission, /Host implicit selection/i);

  assert.match(admission, /read-only Git/i);
  assert.match(admission, /current Git worktree/i);
  assert.match(admission, /canonical/i);
  assert.match(admission, /explicitly[\s\S]*repository key and path/i);
  assert.match(admission, /additional writable root/i);
  assert.match(admission, /Do not scan parent or sibling directories/i);
  assert.match(admission, /imports, remotes,\s+submodules, codebase-memory/i);
  assert.match(admission, /repository instructions/i);
  assert.match(admission, /user authority/i);
});

test("Chinese README documents smart implicit activation and the explicit force-entry selector", async () => {
  const readme = await readFile(readmePath, "utf8");
  const invocation = section(readme, "智能启用与显式入口");

  assert.match(invocation, /Skill resource\/base name[^\n]*`dev-flow`/i);
  assert.match(invocation, /安装后的 Skill full name[^\n]*`dev-flow-codex:dev-flow`/i);
  assert.match(invocation, /精确 selector[\s\S]{0,100}\$dev-flow-codex:dev-flow/i);
  assert.match(invocation, /`\$dev-flow`[^\n]*不是别名[^\n]*不会选择/i);
  assert.match(invocation, /plugin namespace 错误/i);
  assert.match(invocation, /Skill base name 错误/i);
  assert.match(invocation, /实现、缺陷修复、重构、定向测试和开发\s*交付/i);
  assert.match(invocation, /仅?解释、仅?状态查询、方案讨论、普通问答和含糊请求[^\n]*不自动创建/i);
  assert.match(invocation, /显式[^\n]*不会绕过/i);
  assert.match(invocation, /不声称 MCP[^\n]*selector 绑定/i);
  assert.match(invocation, /不限制 Codex\s*的普通仓库工具/i);
  assert.match(invocation, /allow_implicit_invocation[^\n]*true/i);
});

test("Skill silently calls server-info first and admits the exact unordered Core contract", async () => {
  const skill = await readFile(skillPath, "utf8");
  const handshakeIndex = skill.indexOf("## Compatibility handshake");
  assert.ok(handshakeIndex >= 0);

  const firstToolCall = firstToolReference(skill.slice(handshakeIndex));
  assert.equal(firstToolCall, "dev_flow_server_info");
  assert.match(skill.slice(handshakeIndex), /dev_flow_server_info\(\{\}\)/);

  const catalog = [...skill.matchAll(/^\d+\. `(dev_flow_[a-z_]+)`$/gm)].map((match) => match[1]);
  assert.deepEqual([...catalog].sort(), [...exactTools].sort());

  const handshake = skill.slice(handshakeIndex);
  for (const expectation of [
    /product[^\n]*`dev-flow`/i,
    /Core version[^\n]*present[^\n]*canonical/i,
    /independently versioned products/i,
    /transport[^\n]*`stdio`/i,
    /health[^\n]*`ready`/i,
    /supported host[\s\S]{0,80}`codex`/i,
    /standard-development/i,
    /definition_digest/i,
    /new_task_supported[^\n]*`true`/i,
    /plain[^\n]*spec-kit[^\n]*openspec/i,
    /regardless of order/i,
    /exactly[^\n]*six/i,
    /incomplete|truncated|malformed/i,
    /stop/i,
  ]) {
    assert.match(handshake, expectation);
  }
  assert.doesNotMatch(handshake, /Core version[^\n]*(?:equals|matches)[^\n]*(?:package|packaged product) version/i);
  assert.doesNotMatch(handshake, /reordered tool/i);
  assert.match(handshake, /setup-time checks[\s\S]*`dev-flow-codex setup`/i);
  assert.match(handshake, /On success[\s\S]*do not display[\s\S]*continue immediately/i);
  assert.match(handshake, /On failure[\s\S]*specific blocking condition[\s\S]*actionable next step/i);
  assert.doesNotMatch(handshake, /(?:schema|Core Contract)[^\n]*`?0\.1`?/i);
  assert.match(handshake, /(?:do\s+not|never)[\s\S]*local source[\s\S]*second MCP server/i);

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
  assert.match(discovery, /`repository_path`[\s\S]*canonical current worktree/i);
  assert.match(discovery, /`primary_repository_key`[\s\S]*`additional_repositories`/i);
  assert.match(discovery, /single-repository[\s\S]*omit both optional Scope\s+fields/i);
  assert.match(discovery, /resume from the primary or an additional repository[\s\S]*omit the Scope creation fields/i);
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
    "process ID",
    "process version",
    "process-definition digest",
    "current node",
    "node purpose",
    "entry conditions",
    "completion conditions",
    "repository-binding digest",
    "allowed effects",
    "required evidence",
    "method profile",
    "method steps",
    "available transitions",
    "payload schema",
  ]) {
    assert.match(loop, new RegExp(escapeRegExp(identity).replaceAll(" ", "\\s+"), "i"));
  }
  assert.match(loop, /fresh|live Core/i);
  assert.match(loop, /one mutation|exactly one[\s\S]{0,80}mutation/i);
  assert.match(loop, /request ID/i);
  assert.match(loop, /complete (?:successful|committed)[\s\S]*(?:authoritative|returned|fresh)[\s\S]*(?:next Action|Core read)/i);

  const forwarding = section(skill, "Closed forwarding contract");
  assert.match(forwarding, /closed payload/i);
  assert.match(forwarding, /unknown fields|aliases/i);
  assert.match(forwarding, /recovery_apply[\s\S]*(?:omit|null)/i);
});

test("Skill forwards the exact closed Core current Core contract new_task contract", async () => {
  const discovery = section(await readFile(skillPath, "utf8"), "Task discovery");
  for (const member of [
    "request",
    "initial_scope",
    "initial_out_of_scope",
    "known_acceptance_criteria",
    "verification_budget",
    "method_profile",
    "level",
    "max_automatic_commands",
    "allow_full_suite",
    "allow_manual_handoff",
  ]) {
    assert.equal(discovery.includes(`\`${member}\``), true, `missing closed Core member ${member}`);
  }
  for (const alias of ["goal", "scope", "out_of_scope", "acceptance_criteria", "exclusions", "verification", "automatic_command_budget"]) {
    assert.equal(discovery.includes(`\`${alias}\``), false, `forbidden Core member alias ${alias}`);
  }
  assert.match(discovery, /no additional members|exact members/i);
  assert.match(discovery, /acceptance[\s\S]{0,100}(?:may be|need not be|does not\s+need to be)[\s\S]{0,80}complete/i);
  assert.match(discovery, /resume[\s\S]*(?:omit `new_task`|`new_task=null`)/i);
  assert.match(discovery, /(?:immutable|must not|never)[^\n]*profile/i);
});

test("method-profile reference closes all 24 rendering steps without owning Core state", async () => {
  const referencePath = join(pluginRoot, "skills", "dev-flow", "references", "method-profiles.md");
  const reference = await readFile(referencePath, "utf8");
  const catalog = reference.match(/<!-- semantic-step-table:start -->\n([\s\S]*?)\n<!-- semantic-step-table:end -->/u);
  assert.notEqual(catalog, null);
  const catalogSteps = [...catalog[1].matchAll(/^\| `([^`]+)` \|/gmu)].map((match) => match[1]);
  assert.deepEqual(catalogSteps, semanticMethodSteps);

  for (const profile of ["plain", "spec-kit", "openspec"]) {
    assert.match(reference, new RegExp("`" + escapeRegExp(profile) + "`", "u"));
  }
  for (const capability of [...specKitCapabilities, ...openSpecCapabilities]) {
    assert.match(reference, new RegExp("`" + escapeRegExp(capability) + "`", "u"));
  }
  assert.match(reference, /`speckit-converge`[\s\S]*optional[\s\S]*(?:not|never)[\s\S]*Core required step/i);
  assert.match(reference, /available[\s\S]*unavailable[\s\S]*not_applicable[\s\S]*unknown/i);
  assert.match(reference, /`plain_fallback`[\s\S]*`capability`[\s\S]*empty/i);
  assert.match(reference, /exactly one `MethodEvidence`[\s\S]*Action order/i);
  assert.match(reference, /`unavailable`[\s\S]*`not_run`[\s\S]*(?:do not|cannot)[\s\S]*required/i);
  assert.match(reference, /`role`[\s\S]*contract `path`[\s\S]*`digest`[\s\S]*`summary`/i);
  assert.match(reference, /multi-repository Task[\s\S]*`<repository-key>::<repository-relative-path>`/i);
  assert.match(reference, /explicit[\s\S]*user[\s\S]*(?:verdict|confirmation)/i);
  assert.match(reference, /(?:does not|must not|never)[\s\S]*(?:derive|select)[\s\S]*(?:transition|destination)/i);
  assert.match(reference, /(?:checkbox|archive|capability)[\s\S]*(?:does not|cannot|must not)[\s\S]*(?:advance|mutate)[\s\S]*Core/i);

  const rendered = reference.match(/<!-- rendered-operation-example:start -->\n```json\n([\s\S]*?)\n```\n<!-- rendered-operation-example:end -->/u);
  assert.notEqual(rendered, null);
  assert.deepEqual(JSON.parse(rendered[1]), {
    step_id: "requirements.clarify",
    purpose: "Resolve material requirement ambiguity.",
    required: true,
    profile: "spec-kit",
    capability_id: "speckit-clarify",
    rendered_instruction: "Use the installed Spec Kit clarify capability for the active feature.",
    expected_artifacts: ["active feature specification clarification"],
    availability: "available",
  });
});

test("node-payload reference makes every closed branch operational without owning Core state", async () => {
  const referencePath = join(pluginRoot, "skills", "dev-flow", "references", "node-payloads.md");
  const reference = await readFile(referencePath, "utf8");
  for (const name of [
    "requirements", "design", "tasks", "implement", "test", "comprehension-complexity",
    "comprehension-passed", "refactor", "delivery", "blocked",
  ]) {
    const pattern = new RegExp(`<!-- node-payload-template:${name}:start -->\\n\`\`\`json\\n([\\s\\S]*?)\\n\`\`\`\\n<!-- node-payload-template:${name}:end -->`, "u");
    const template = pattern.exec(reference);
    assert.notEqual(template, null, name);
    const payload = JSON.parse(template[1]);
    if (name !== "blocked") {
      assert.deepEqual(Object.hasOwn(payload.node_result, "changed_paths"), true, name);
      assert.deepEqual(Object.hasOwn(payload.node_result, "no_file_changes"), true, name);
    }
  }
  assert.match(reference, /`repository_observation` is a Core evidence requirement, not an ArtifactReference role/u);
  assert.match(reference, /Allowed ArtifactReference roles are only/u);
  assert.match(reference, /work-item `expected_paths`[\s\S]*node-result `changed_paths`/u);
  assert.match(reference, /Artifact references remain evidence[\s\S]*do\s+not replace this mutation envelope/u);
  assert.match(reference, /`<repository-key>::<repository-relative-path>`[\s\S]*multi-repository Task/u);
  assert.match(reference, /exactly the six common/u);
  assert.match(reference, /Never submit `destination`, `next_node`/u);
  assert.match(reference, /INVALID_ARGUMENT[\s\S]*never\s+transport uncertainty/u);
  assert.match(reference, /`error\.details\[\]`[\s\S]*`recovery\.action="correct_current_action"`[\s\S]*`recovery\.retry_safe=true`/u);
  assert.match(reference, /exactly one\s+corrected payload for the same Action[\s\S]*only the members in `recovery\.allowed_paths`[\s\S]*new `request_id`/u);
  assert.match(reference, /Stop after a\s+second failure[\s\S]*never probe with a third candidate payload/u);
  assert.match(reference, /one closed object[\s\S]*does not narrow the payload by `action_kind`/u);

  const skill = await readFile(skillPath, "utf8");
  const forwarding = section(skill, "Closed forwarding contract");
  const correction = section(skill, "Bounded correction of the current action");
  assert.doesNotMatch(correction, /both attempted values|report[\s\S]*attempted values/iu);
  assert.match(correction, /report only the exact `path`, `rule`[\s\S]*Never report[\s\S]*submitted field value/u);
  assert.match(forwarding, /`references\/node-payloads\.md`/u);
  assert.match(forwarding, /fresh Action, live `dev_flow_apply_action` `inputSchema`, and Core remain authoritative/u);
  assert.match(forwarding, /all six common payload members/u);
  assert.match(forwarding, /branch-specific required `node_result` key/u);
  assert.match(forwarding, /Never convert a[\s\S]*`required_evidence`[\s\S]*`repository_observation`[\s\S]*artifact role/u);
  assert.match(forwarding, /MethodEvidence exactly matches current Action steps/u);
  assert.match(forwarding, /`destination`, `next_node`, `next_cursor`/u);
  assert.match(forwarding, /Core returns `INVALID_ARGUMENT`[\s\S]*bounded-correction section[\s\S]*explicitly authorizes[\s\S]*`correct_current_action`[\s\S]*otherwise stop/u);
});

test("Skill honors Codex writable roots and optional codebase-memory without changing authority", async () => {
  const skill = await readFile(skillPath, "utf8");
  const admission = section(skill, "Admission gate");
  const discovery = section(skill, "Optional code discovery");
  const loop = section(skill, "Governed action loop");

  assert.match(admission, /additional writable root authorized for the current Codex session/u);
  assert.match(admission, /do not read or parse global\s+Codex configuration/u);
  assert.match(discovery, /preference is `false`[\s\S]*do not call any codebase-memory tool/u);
  assert.match(discovery, /preference is `true`[\s\S]*already visible and usable[\s\S]*cross-repository/u);
  assert.match(discovery, /at most once in the current Dev Flow session[\s\S]*fall back/u);
  assert.match(discovery, /Never install, configure, upgrade, start, repair, or remove codebase-memory/u);
  assert.match(discovery, /never call plugin\s+management to install it/u);
  assert.match(discovery, /not authority for repository bindings, changed paths, Git facts, Recovery/u);
  assert.match(loop, /Before any actual repository modification[\s\S]*declared repository[\s\S]*permission failure/u);
  assert.match(loop, /Do not[\s\S]*change sandbox mode[\s\S]*danger-full-access[\s\S]*shrink the Scope/u);
});

test("Skill selects one immutable profile and renders complete honest method evidence", async () => {
  const skill = await readFile(skillPath, "utf8");
  const discovery = section(skill, "Task discovery");
  assert.match(discovery, /explicit[\s\S]{0,120}`plain`[\s\S]{0,80}`spec-kit`[\s\S]{0,80}`openspec`/i);
  assert.match(discovery, /Spec Kit[\s\S]{0,80}`spec-kit`/i);
  assert.match(discovery, /OpenSpec[\s\S]{0,80}`openspec`/i);
  assert.match(discovery, /otherwise[\s\S]{0,80}`plain`/i);
  assert.match(discovery, /conflicting[^\n]*profile[\s\S]*stop/i);
  assert.match(discovery, /(?:do not|never)[^\n]*installed[^\n]*switch|installed[^\n]*(?:does not|must not)[^\n]*select/i);

  const rendering = section(skill, "Method operation rendering");
  assert.match(rendering, /`references\/method-profiles\.md`/u);
  assert.match(rendering, /each[\s\S]*Core-returned[\s\S]*method\s+step/i);
  assert.match(rendering, /actual(?:ly)? (?:visible|available)[\s\S]{0,80}capability/i);
  assert.match(rendering, /plain-equivalent/i);
  assert.match(rendering, /exactly one[\s\S]*`MethodEvidence`[\s\S]*same order/i);
  assert.match(rendering, /(?:`completed`|status=completed)[\s\S]*actual capability/i);
  assert.match(rendering, /(?:`plain_fallback`|status=plain_fallback)[\s\S]*empty/i);
  assert.match(rendering, /(?:`unavailable`|status=unavailable)[\s\S]*required[\s\S]*(?:do not|must not)[\s\S]*`dev_flow_apply_action`/i);
  assert.match(rendering, /(?:does not|cannot|must not)[\s\S]*substitute[\s\S]*typed `node_result`/i);
  assert.match(rendering, /(?:do not|never)[\s\S]*(?:automatically install|auto-install)/i);
  assert.match(rendering, /existing[\s\S]*(?:spec|plan|tasks)[\s\S]*(?:review|revise|amend)[\s\S]*(?:not|instead of)[\s\S]*(?:regenerate|rerun)/i);
});

test("method-profile fixtures close the three profiles and every Phase 6C capability scenario", async () => {
  const fixture = await readJSON(methodProfileFixturePath);
  assert.equal(fixture.fixture_kind, "simulated_codex_adapter_contract");
  assert.equal(fixture.evidence_class, "simulated_static_adapter_journey");
  assert.deepEqual(fixture.server_info.host_preferences, {
    codex: { codebase_memory: false },
    deepseek: { codebase_memory: true },
  });
  assert.equal(fixture.scenarios.length, 11);

  const scenarios = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  assert.deepEqual(
    [...new Set(fixture.scenarios.map((scenario) => scenario.profile))].sort(),
    ["openspec", "plain", "spec-kit"],
  );
  for (const id of [
    "plain-requirements",
    "spec-kit-requirements-available",
    "spec-kit-clarify-unavailable-pending",
    "spec-kit-clarify-unavailable-fallback-complete",
    "openspec-requirements-available",
    "openspec-verify-unavailable-pending",
    "openspec-verify-unavailable-fallback-complete",
    "method-tool-state-without-core-result",
    "comprehension-awaiting-user-verdict",
    "comprehension-user-understands",
    "comprehension-code-too-complex",
  ]) {
    assert.equal(scenarios.has(id), true, id);
  }

  assert.deepEqual(scenarios.get("plain-requirements").available_capabilities, []);
  assert.equal(
    scenarios.get("spec-kit-clarify-unavailable-pending").available_capabilities.includes("speckit-clarify"),
    false,
  );
  assert.equal(
    scenarios.get("openspec-verify-unavailable-pending").available_capabilities.includes("openspec-verify"),
    false,
  );
  assert.equal(JSON.stringify(fixture).includes("native evidence"), false);
  assert.equal(JSON.stringify(fixture).includes("released package evidence"), false);
});

test("fixture admission requires one honest MethodEvidence per required step and a typed result", async () => {
  const fixture = await readJSON(methodProfileFixturePath);
  const scenarios = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));

  for (const id of [
    "plain-requirements",
    "spec-kit-requirements-available",
    "spec-kit-clarify-unavailable-fallback-complete",
    "openspec-requirements-available",
    "openspec-verify-unavailable-fallback-complete",
    "comprehension-user-understands",
    "comprehension-code-too-complex",
  ]) {
    const result = buildFixtureApply(fixture, scenarios.get(id));
    assert.notEqual(result, null, id);
    assert.equal("destination" in result.payload, false, id);
    assert.equal("next_node" in result.payload, false, id);
    assert.equal("next_cursor" in result.payload, false, id);
    assert.equal(result.payload.node_result.problem_class.length > 0, true, id);
  }

  for (const id of [
    "spec-kit-clarify-unavailable-pending",
    "openspec-verify-unavailable-pending",
    "method-tool-state-without-core-result",
    "comprehension-awaiting-user-verdict",
  ]) {
    assert.equal(buildFixtureApply(fixture, scenarios.get(id)), null, id);
  }

  const specKitFallback = scenarios.get("spec-kit-clarify-unavailable-fallback-complete");
  const clarify = specKitFallback.method_evidence.find((item) => item.step_id === "requirements.clarify");
  assert.deepEqual({ status: clarify.status, capability: clarify.capability }, {
    status: "plain_fallback",
    capability: "",
  });
  const openSpecFallback = scenarios.get("openspec-verify-unavailable-fallback-complete");
  assert.equal(openSpecFallback.method_evidence.every((item) => item.status === "plain_fallback"), true);
  assert.equal(openSpecFallback.method_evidence.every((item) => item.capability === ""), true);
});

test("equivalent profile fixtures select one Core transition and destination from identical facts", async () => {
  const fixture = await readJSON(methodProfileFixturePath);
  const scenarios = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario]));
  const applies = [
    "plain-requirements",
    "spec-kit-requirements-available",
    "openspec-requirements-available",
  ].map((id) => buildFixtureApply(fixture, scenarios.get(id)));

  for (const apply of applies) {
    assert.equal(apply.action.process_id, "standard-development");
    assert.equal(apply.action.current_node, "REQUIREMENTS");
    assert.equal(apply.payload.transition_id, "requirements_ready");
    assert.equal(apply.core_destination, "DESIGN");
    assert.deepEqual(apply.payload.node_result, fixture.requirements_node_result);
    assert.deepEqual(apply.action.available_transitions, applies[0].action.available_transitions);
  }
  assert.equal(new Set(applies.map((apply) => apply.action.process_definition_digest)).size, 1);
  assert.equal(new Set(applies.map((apply) => apply.profile)).size, 3);
  assert.notDeepEqual(applies[0].payload.method_evidence, applies[1].payload.method_evidence);
  assert.notDeepEqual(applies[1].payload.method_evidence, applies[2].payload.method_evidence);
});

test("Skill keeps normal Action internals quiet and reserves comprehension verdict for the user", async () => {
  const skill = await readFile(skillPath, "utf8");
  const loop = section(skill, "Governed action loop");
  assert.match(loop, /validate[\s\S]*complete Action[\s\S]*internally/i);
  assert.match(loop, /concise current-node\s+status/i);
  assert.match(loop, /do not dump[\s\S]*all `available_transitions`/i);
  assert.match(loop, /user decision[\s\S]*blocker/i);
  assert.match(loop, /complete Action[\s\S]*transition selection[\s\S]*forwarding/i);

  const transition = section(skill, "Transition selection");
  assert.match(transition, /only[\s\S]*`fresh_action\.available_transitions`/i);
  assert.match(transition, /`problem_class`/u);
  assert.match(transition, /(?:destination[\s\S]*Core[\s\S]*(?:derive|own)|Core[\s\S]*(?:derive|own)[\s\S]*destination)/i);
  assert.match(transition, /(?:checkbox|method tool|capability)[\s\S]*(?:does not|cannot|must not)[\s\S]*(?:advance|select|complete)/i);

  const comprehension = section(skill, "Comprehension user interaction");
  assert.match(comprehension, /bounded explanation/i);
  assert.match(comprehension, /unnecessary abstractions/i);
  assert.match(comprehension, /maintenance risks/i);
  assert.match(comprehension, /ask[\s\S]*developer[\s\S]*(?:explain|maintain)/i);
  assert.match(comprehension, /wait[\s\S]*explicit[\s\S]*(?:answer|verdict|confirmation)/i);
  assert.match(comprehension, /`comprehension_passed`[\s\S]*explicit[\s\S]*user/i);
  assert.match(comprehension, /AI[\s\S]*(?:must not|cannot|does not)[\s\S]*(?:answer|confirm|self-confirm)/i);
  assert.match(comprehension, /Spec Kit|OpenSpec/i);
});

test("Skill safe-stops on unsupported storage without exposing or mutating private data", async () => {
  const storage = section(await readFile(skillPath, "utf8"), "SCHEMA_UNSUPPORTED");
  assert.match(storage, /pre-graph|incompatible data/i);
  assert.match(storage, /Core[\s\S]*(?:did not|has not)[\s\S]*(?:modify|delete)/i);
  assert.match(storage, /fresh[\s\S]*`DEV_FLOW_DATA_DIR`/i);
  for (const operation of ["archive", "rename", "delete"]) {
    assert.match(storage, new RegExp(`manual(?:ly)?|user-controlled[\\s\\S]*${operation}|${operation}[\\s\\S]*outside Core`, "i"));
  }
  assert.match(storage, /stop[\s\S]*(?:task discovery|open|create)/i);
  assert.match(storage, /(?:do not|never)[\s\S]*(?:retry|reset|convert|migrate)/i);
  assert.match(storage, /(?:do not|never)[\s\S]*(?:search|discover)[\s\S]*(?:data directory|database path)/i);
  assert.match(storage, /(?:do not|never)[\s\S]*(?:display|reveal|expose)[\s\S]*private[\s\S]*(?:path|location)/i);
  assert.match(storage, /stable error code[\s\S]*bounded[\s\S]*guidance/i);
  assert.match(storage, /(?:do not|never)[\s\S]*(?:HOME|username)[\s\S]*(?:raw SQLite|raw Git)/i);
  assert.match(storage, /result-envelope[\s\S]*data path/i);
  assert.doesNotMatch(storage, /(?:\/Users\/|\/home\/|\/private\/var\/|[A-Za-z]:\\\\)/u);
});

test("Skill uses payload_contract as the apply schema discriminator", async () => {
  const forwarding = section(await readFile(skillPath, "utf8"), "Closed forwarding contract");
  assert.match(forwarding, /`(?:fresh_action\.)?payload_contract`[\s\S]*payload branch/i);
  assert.match(forwarding, /`inputSchema`[\s\S]*one closed object[\s\S]*`action_kind` is a[\s\S]*`enum`[\s\S]*union of every node result member/i);
  assert.match(forwarding, /does not narrow `payload` by\s+`action_kind`[\s\S]*`fresh_action\.payload_contract`/i);
  assert.doesNotMatch(forwarding, /under `allOf`, choose the `oneOf` payload/i);
  assert.match(forwarding, /`references\/node-payloads\.md`[\s\S]*complete common envelope[\s\S]*branch-specific required `node_result`/i);
  assert.match(forwarding, /do not search[\s\S]*(?:repository|installed package)[\s\S]*(?:binary|log)[\s\S]*another MCP server/i);
  assert.match(forwarding, /(?:do not|never)[\s\S]{0,80}(?:derive|treat)[\s\S]{0,80}payload (?:field|key|member)s?[\s\S]{0,80}`required_evidence`|`required_evidence`[\s\S]{0,80}(?:not|never)[\s\S]{0,80}payload (?:field|key|member)/i);
  assert.match(forwarding, /top-level[\s\S]*`request_id`[\s\S]*`process_id`[\s\S]*`source_cursor`[\s\S]*`repository_binding_digest`/i);
  assert.match(forwarding, /selected\s+payload[\s\S]*contains exactly/i);
  assert.match(forwarding, /do\s+not wrap[\s\S]*(?:whole|full|that) request[\s\S]*outer `payload`/i);
  assert.match(forwarding, /`fresh_action`[\s\S]*`result\.task\.current_action`[\s\S]*`result\.action`/i);
  assert.match(forwarding, /`fresh_action\.(?:action_kind|kind)`[\s\S]*top-level `action_kind`/i);
  assert.match(forwarding, /`fresh_action\.revision`[\s\S]*top-level `revision`/i);
  assert.match(forwarding, /`fresh_action\.process_id`[\s\S]*top-level `process_id`/i);
  assert.match(forwarding, /`fresh_action\.process_definition_digest`[\s\S]*top-level `process_definition_digest`/i);
  assert.match(forwarding, /`fresh_action\.current_node`[\s\S]*top-level `source_cursor`/i);
  assert.match(forwarding, /caller-generated[\s\S]*top-level `request_id`/i);
  assert.match(forwarding, /`revision`[\s\S]*integer[\s\S]*not (?:a )?string/i);
  assert.match(forwarding, /`payload`[\s\S]*object[\s\S]*not (?:a )?string/i);
  assert.match(forwarding, /do not wrap[\s\S]*request[\s\S]*outer `payload`/i);
  assert.match(forwarding, /live schema[\s\S]*packaged reference disagree[\s\S]*stop before mutation/i);
  for (const member of ["transition_id", "summary", "reason", "artifacts", "method_evidence", "node_result", "problem_class"]) {
    assert.match(forwarding, new RegExp("`" + escapeRegExp(member) + "`", "u"));
  }
  assert.doesNotMatch(forwarding, /`source_phase`/u);
  assert.match(forwarding, /(?:do not|never)[\s\S]*`destination`[\s\S]*`next_node`[\s\S]*`next_cursor`/i);
  assert.match(forwarding, /(?:omit[\s\S]{0,40}`recovery_apply`|`recovery_apply`[\s\S]{0,40}(?:null|`null`))/i);
});

test("Skill reads before retry and preserves budgets, evidence labels, and terminal stops", async () => {
  const skill = await readFile(skillPath, "utf8");
  const recovery = section(skill, "Recovery-before-retry contract");
  for (const uncertainty of ["missing", "cancelled", "malformed", "truncated", "uncertain"]) {
    assert.match(recovery, new RegExp(uncertainty, "i"));
  }
  assert.match(recovery, /(?:do|does) not immediately repeat[\s\S]*dev_flow_apply_action/i);
  assert.match(recovery, /dev_flow_get_task[\s\S]*recovery_assessment[\s\S]*next_advice/i);
  assert.match(recovery, /operation[_ -]probe[\s\S]*(?:retained|original)/i);
  assert.match(recovery, /retry_current_action[\s\S]*action_retry_safe=true/i);
  assert.match(recovery, /submit_recovery_apply[\s\S]*recovery_apply/i);
  assert.match(recovery, /`ok=false`[\s\S]*`retry_safe=false`[\s\S]*`action=none`[\s\S]*stop[\s\S]*do not call[\s\S]*dev_flow_get_next_action[\s\S]*dev_flow_apply_action/i);
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

test("Skill retains one exact apply probe across every uncertain result shape", async () => {
  const recovery = section(await readFile(skillPath, "utf8"), "Recovery-before-retry contract");

  for (const uncertainty of ["missing", "malformed", "cancelled", "truncated", "transport-failed"]) {
    assert.match(recovery, new RegExp(escapeRegExp(uncertainty), "i"));
  }

  const retainedApply = recovery.match(/Before calling `dev_flow_apply_action`,[\s\S]*?(?=\n\n)/i)?.[0];
  assert.ok(retainedApply, "recovery contract must retain one exact pre-dispatch apply identity");
  for (const retained of [
    "request_id",
    "task_id",
    "process_id",
    "process_definition_digest",
    "source_cursor",
    "revision",
    "action_id",
    "action_kind",
    "repository_binding_digest",
  ]) {
    assert.equal(retainedApply.includes(`\`${retained}\``), true, `missing retained apply value ${retained}`);
  }
  assert.match(retainedApply, /exact closed `payload`|`payload`[^\n]*exact closed/i);
  assert.match(retainedApply, /same fresh action[\s\S]*same apply dispatch/i);
  assert.match(retainedApply, /(?:do not|never)[\s\S]{0,120}(?:derive|reconstruct)[\s\S]{0,120}(?:incomplete|partial)[\s\S]{0,80}(?:response|result|output)/i);

  const probeBlock = recovery.match(/`operation_probe`[^\n]*\n\s*```json\n([\s\S]*?)\n```/i);
  assert.ok(probeBlock, "recovery contract must show the exact operation_probe JSON object");
  const probe = JSON.parse(probeBlock[1]);
  assert.deepEqual(probe, {
    operation_id: "<original apply request_id>",
    process_id: "standard-development",
    process_definition_digest: "<original process definition digest>",
    source_cursor: "<original source cursor>",
    expected_revision: 3,
    action_id: "<original action id>",
    action_kind: "<original action kind>",
    repository_binding_digest: "<original issuance binding digest>",
    payload: {},
  });
  assert.match(recovery, /`operation_id`[\s\S]{0,100}original[\s\S]{0,80}`request_id`/i);
  assert.match(recovery, /`operation_id`[\s\S]{0,160}(?:not|never)[\s\S]{0,80}read request ID/i);
  assert.match(recovery, /`expected_revision`[\s\S]{0,100}original[\s\S]{0,80}(?:action )?`revision`/i);
  assert.match(recovery, /`repository_binding_digest`[\s\S]{0,100}original[\s\S]{0,80}issuance binding/i);
  assert.match(recovery, /`payload`[\s\S]{0,100}exact original[\s\S]{0,80}closed payload/i);
  assert.match(recovery, /(?:(?:JSON )?`null`[\s\S]{0,100}(?:payload|retained)|payload[\s\S]{0,100}(?:JSON )?`null`)/i);
  assert.match(recovery, /(?:do not|never)[\s\S]{0,120}(?:partial output|repository text|model memory)/i);

  assert.match(recovery, /(?:(?:do|does) not immediately repeat|before any retry)[\s\S]*`dev_flow_apply_action`/i);
  assert.match(recovery, /original `task_id`[\s\S]*`dev_flow_get_task`/i);
  assert.match(recovery, /all[\s\S]{0,100}(?:required|original)[\s\S]{0,100}(?:retained|available)[\s\S]{0,100}`operation_probe`/i);
  assert.match(recovery, /stale pre-dispatch[\s\S]{0,120}(?:not|never)[\s\S]{0,100}(?:read-back|authoritative)/i);
  assert.match(recovery, /complete `recovery_assessment`[\s\S]*obey only Core's complete[\s\S]*`next_advice`/i);

  assert.match(recovery, /(?:required|identity)[\s\S]{0,120}(?:missing|incomplete)[\s\S]{0,160}(?:do not|never)[\s\S]{0,100}(?:construct|fabricate|send)[\s\S]{0,100}`operation_probe`/i);
  assert.match(recovery, /(?:half|partial) probe/i);
  assert.match(recovery, /(?:do not|never)[\s\S]{0,100}(?:complete|fill)[\s\S]{0,100}partial (?:response|result|output)/i);
  assert.match(recovery, /(?:do not|never)[\s\S]{0,100}assume[\s\S]{0,80}`not_started`/i);
  assert.match(recovery, /stop[\s\S]{0,100}report[\s\S]{0,100}(?:cannot|unable)[\s\S]{0,100}(?:prove|determine)[\s\S]{0,80}mutation/i);
  assert.match(recovery, /(?:(?:do not|never)[\s\S]{0,100}automatically retry|no automatic retry)/i);

  assert.match(recovery, /complete structured `ok=false`[\s\S]{0,120}(?:domain|transport uncertainty)/i);
  assert.match(recovery, /(?:do not|never)[\s\S]{0,100}(?:convert|treat)[\s\S]{0,100}(?:domain error|`ok=false`)[\s\S]{0,100}(?:missing|transport)/i);
  assert.match(recovery, /`retry_safe=false`[\s\S]*`action=none`[\s\S]*stop[\s\S]*(?:do not|never)[\s\S]*`dev_flow_get_next_action`[\s\S]*`dev_flow_apply_action`/i);
  assert.match(recovery, /`submit_recovery_apply`[\s\S]*`recovery_apply=[\s\S]*(?:do not|never)[\s\S]*(?:destination|classification)/i);
  assert.match(recovery, /recovery read itself cannot create a blocker[\s\S]*Only a Core-requested explicit recovery apply/i);
  assert.match(recovery, /(?:do not|never)[\s\S]{0,120}(?:(?:guess|infer)[\s\S]{0,120}(?:repository state|worktree)|(?:repository state|worktree)[\s\S]{0,120}(?:guess|infer))/i);
  assert.doesNotMatch(recovery, /`source_phase`/u);

  const adapterOwnedBranch = /\b(?:if|when|case|switch)\b[^\n]{0,160}\b(?:completed_and_recorded|completed_but_unrecorded|partially_completed|not_started|conflicting)\b/i;
  assert.doesNotMatch(recovery, adapterOwnedBranch, "Skill must not branch on Core recovery classifications");
  assert.match(recovery, /(?:do not|never)[\s\S]{0,100}(?:branch|decide|interpret)[\s\S]{0,100}recovery classification/i);
  assert.match(recovery, /obey[\s\S]{0,100}Core(?:'s)?[\s\S]{0,100}`code`[\s\S]{0,100}`recovery\.message`/i);
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
  assert.doesNotMatch(skill, /`source_phase`/u);
  assert.doesNotMatch(skill, /\b(?:INTAKE|ASSESS|VERIFY|HANDOFF)\b/u);
  assert.doesNotMatch(skill, /Core Contract[^\n]*0\.1/iu);
  assert.doesNotMatch(skill, /(?:REQUIREMENTS\s*(?:→|->)\s*DESIGN|DESIGN\s*(?:→|->)\s*TASKS)/u);
  assert.doesNotMatch(skill, /(?:transition|destination)\s+(?:table|matrix)/iu);
  assert.match(skill, /current node[\s\S]*Core/i);
  assert.match(skill, /`available_transitions`[\s\S]*(?:Core-returned|returned by Core|fresh_action)/i);

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
    ]) {
      assert.doesNotMatch(source, forbidden, `${relativePath} embeds authority or a test import`);
    }
    assert.doesNotMatch(
      source,
      /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REPLACE)\s+(?:INTO|TABLE|FROM)\b/i,
      `${relativePath} must not mutate Core storage`,
    );
  }
  const writer = await readFile(join(repositoryRoot, "scripts/write-codex-journey-evidence.mjs"), "utf8");
  assert.match(writer, /new DatabaseSync\([^\n]+\{ readOnly: true \}\)/u);
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

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function buildFixtureApply(fixture, scenario) {
  const action = fixture.actions[scenario.action];
  if (!scenario.should_apply || !action || !scenario.node_result || !scenario.transition_id) return null;
  if (scenario.method_evidence.length !== action.method_steps.length) return null;
  for (const [index, step] of action.method_steps.entries()) {
    const evidence = scenario.method_evidence[index];
    if (evidence.step_id !== step.step_id) return null;
    if (step.required && !["completed", "plain_fallback"].includes(evidence.status)) return null;
    if (evidence.status === "completed" && (
      evidence.capability === "" || !scenario.available_capabilities.includes(evidence.capability)
    )) return null;
    if (evidence.status === "plain_fallback" && evidence.capability !== "") return null;
  }
  const transition = action.available_transitions.find((candidate) => candidate.transition_id === scenario.transition_id);
  if (!transition) return null;
  const nodeResult = typeof scenario.node_result === "string"
    ? fixture[scenario.node_result]
    : scenario.node_result;
  if (!nodeResult || typeof nodeResult.problem_class !== "string") return null;
  return {
    profile: scenario.profile,
    action,
    core_destination: transition.destination,
    payload: {
      transition_id: scenario.transition_id,
      summary: `Fixture ${scenario.id} completed the semantic node work.`,
      reason: scenario.reason ?? "",
      artifacts: [],
      method_evidence: scenario.method_evidence,
      node_result: nodeResult,
    },
  };
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
