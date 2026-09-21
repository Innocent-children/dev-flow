import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { execPortableCommand } from "../../packages/host-command/command.mjs";

const exec = promisify(execFile);
const [packageDirectory] = process.argv.slice(2);
if (!packageDirectory) throw new Error("Usage: node tests/zcode/verify-package.mjs ABSOLUTE_EXTRACTED_PACKAGE");
const source = await realpath(resolve(packageDirectory));
const isolated = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-zcode-acceptance-")));
const data = join(isolated, "data"), repository = join(isolated, "repository");
await mkdir(data); await mkdir(repository);
const environment = { ...process.env, HOME: isolated, USERPROFILE: isolated, LOCALAPPDATA: join(isolated, "appdata"), DEV_FLOW_DATA_DIR: data };
const prefix = join(isolated, "npm-prefix");
const commandOptions = { env: environment, windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 };
await execPortableCommand("npm", ["install", "--global", "--prefix", prefix, "--cache", join(isolated, "npm-cache"),
  "--install-links", "--ignore-scripts", "--offline", "--no-audit", "--no-fund", source], commandOptions);
const root = join(prefix, process.platform === "win32" ? "node_modules" : "lib/node_modules", "dev-flow-zcode");
const launcher = join(prefix, process.platform === "win32" ? "" : "bin", "dev-flow-zcode");
const cli = join(root, "bin/dev-flow-zcode.mjs");
const run = (executable, args, options = {}) => exec(executable, args, { env: environment, windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024, ...options });
async function command(args, input) {
  const { stdout } = await execPortableCommand(launcher, args, { ...commandOptions, input: input === undefined ? "" : JSON.stringify(input) });
  return stdout.trim() ? JSON.parse(stdout) : null;
}
const report = { package: root, source_package: source, platform: `${process.platform}-${process.arch}`, isolated_directory: isolated, checks: [],
  zcode_ui: "not exercised by this package harness", model_session: "not exercised", macos_native: process.platform === "darwin" ? "native package check only" : "not executed" };
await writeFile(join(data, "unrelated.txt"), "preserve\n");
const setup = await command(["setup", "--json"]);
assert.equal(setup.status, "action_required");
assert.equal(setup.registration.host, "unverified");
assert.equal((await command(["status", "--json"])).registration.phase, "prepared");
report.checks.push("npm-generated launcher returns valid setup and status JSON");
assert.equal((await command(["setup", "--json"])).changed, false);
report.checks.push("detached complete package, native Core and idempotent local preparation; UI state remains unverified");

await run("git", ["init", "-b", "main", repository]);
await run("git", ["-C", repository, "config", "user.name", "Dev Flow package verification"]);
await run("git", ["-C", repository, "config", "user.email", "package-verification@example.invalid"]);
await writeFile(join(repository, "README.md"), "package verification\n");
await run("git", ["-C", repository, "add", "README.md"]);
await run("git", ["-C", repository, "commit", "-m", "Initialize verification repository"]);
const request = "Verify a packaged ZCode Task can be created, resumed and cancelled.";
const anchor = await command(["host-launch", "inspect"], { request, repositories: [{ key: "primary", repository_path: repository }] });
const prepared = await command(["host-launch", "prepare"], { request,
  assessment: { change_level: "standard", candidate_components: ["verification repository"], candidate_paths: ["README.md"],
    public_contract_flags: [], persistence_or_state_flags: [], host_or_platform_flags: ["ZCode package verification"],
    verification_shape: ["native Core creation and recovery"], unknowns: [], reasons: ["Verify the final package"], anchor },
  user_choice: { source: "user", mode: "dev_flow", summary: "Automated isolated package acceptance fixture" },
  repositories: [{ key: "primary", repository_path: repository, workspace_mode: "new_branch", source_type: "local", remote_name: "", base_branch: "main", target_branch: "verify/zcode", carry_changes: false, worktree_path: repository }], handoff: null });
await command(["host-launch", "provision"], { launch_id: prepared.launch_id });
const scope = await command(["host-launch", "scope"], { launch_id: prepared.launch_id });

const child = spawn(process.execPath, [cli, "mcp"], { env: environment, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
let buffer = "", stderr = "", sequence = 0;
const pending = new Map();
child.stderr.on("data", chunk => { stderr += chunk; });
child.stdout.on("data", chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
    let response;
    try { response = JSON.parse(line); } catch { for (const call of pending.values()) call.reject(new Error("Invalid MCP output")); return; }
    const call = pending.get(response.id);
    if (!call) continue;
    clearTimeout(call.timer); pending.delete(response.id);
    response.error ? call.reject(new Error(JSON.stringify(response.error))) : call.resolve(response.result);
  }
});
const failed = error => { for (const call of pending.values()) { clearTimeout(call.timer); call.reject(error); } pending.clear(); };
child.on("error", failed);
child.on("close", code => failed(new Error(`MCP exited ${code}: ${stderr}`)));
function rpc(method, params) {
  const id = ++sequence;
  return new Promise((resolveCall, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP ${method} timed out: ${stderr}`)); }, 30000);
    pending.set(id, { resolve: resolveCall, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
async function tool(name, args) {
  const result = await rpc("tools/call", { name, arguments: args });
  return result.structuredContent ?? JSON.parse(result.content.find(block => block.type === "text").text);
}
try {
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "zcode-package-verification", version: "1.0" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const info = await tool("dev_flow_server_info", {});
  assert.equal(info.ok, true); assert.ok(info.result.supported_hosts.includes("zcode"));
  const opened = await tool("dev_flow_open_task", { host: "zcode", ...scope, new_task: {
    request, initial_scope: ["README.md"], initial_out_of_scope: ["other files"], known_acceptance_criteria: ["Same Task is resumed."], method_profile: "plain",
  } });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const task = opened.result.task;
  await command(["host-launch", "bind-task"], { launch_id: prepared.launch_id, task_id: task.task_id });
  const resumed = await tool("dev_flow_open_task", { host: "zcode", repository_path: repository });
  assert.equal(resumed.ok, true); assert.equal(resumed.result.task.task_id, task.task_id);
  const forbidden = await tool("dev_flow_get_task", { host: "codex", task_id: task.task_id });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error.code, "HOST_OWNERSHIP_CONFLICT");
  report.checks.push("packaged stdio MCP, zcode Task creation/original-directory resume and cross-Host ownership refusal");
  let current = resumed.result.task;
  async function submit(name, transition, nodeResult) {
    const result = await tool(name, { host: "zcode", task_id: current.task_id, action_id: current.current_action.action_id,
      transition_id: transition, summary: "Isolated native package acceptance fixture", reason: "",
      artifacts: { current: [], other_process: [] },
      method_results: Object.fromEntries(current.current_action.method_steps.map(step => [step.step_id, { capability: "", summary: "Completed fixture planning work" }])),
      node_result: nodeResult });
    assert.equal(result.ok, true, JSON.stringify(result));
    current = result.result;
  }
  await submit("dev_flow_submit_requirements", "requirements_ready", { problem_class: "none", unresolved_questions: [], baseline: {
    goal: request, scope: ["README.md"], out_of_scope: ["other files"], acceptance_criteria: ["README is updated."], constraints: [], assumptions: [],
  } });
  await submit("dev_flow_submit_design", "design_ready", { problem_class: "none", findings: [], baseline: {
    approach: "Update the verification README", components: ["README.md"], decisions: ["Only the README may change."],
    rejected_alternatives: ["No other file is needed."], complexity_justification: ["One documentation edit."], risks: [],
  } });
  await submit("dev_flow_submit_tasks", "tasks_plan_saved", { problem_class: "none", findings: [], user_confirmation: null, baseline: {
    work_items: [{ work_item_id: "readme", summary: "Update README", expected_paths: ["README.md"], acceptance_indexes: [0], verification_steps: ["Read the diff"], dependencies: [] }],
    verification_plan: { checks: [{ name: "readme", rationale: "Verify the only planned file" }],
      initial_budget: { level: "minimal", max_automatic_commands: 2, allow_full_suite: false, allow_manual_handoff: false }, full_suite_expected: false, test_code_changes_expected: false },
  } });
  await submit("dev_flow_submit_tasks", "tasks_ready", { problem_class: "none", findings: [], baseline: null, user_confirmation: {
    source: "user", status: "passed", summary: "Simulated user decision in this isolated automated acceptance fixture",
    requirements_digest: current.baselines.requirements.digest, design_digest: current.baselines.design.digest,
    task_plan_digest: current.baselines.task_plan.digest, task_plan_revision: current.baselines.task_plan.revision,
  } });
  assert.equal(await command(["hook", "pre-tool-use"], { hook_event_name: "PreToolUse", cwd: repository,
    tool_name: "Edit", tool_input: { file_path: join(repository, "README.md"), old_string: "verification", new_string: "verified" } }), null);
  const hook = await command(["hook", "pre-tool-use"], { hook_event_name: "PreToolUse", cwd: repository,
    tool_name: "Write", tool_input: { file_path: join(repository, "unexpected.txt"), content: "must not write" } });
  assert.equal(hook.hookSpecificOutput.permissionDecision, "deny");
  report.checks.push("native Core-backed Hook permits a planned Edit and denies an out-of-plan Write after fixture plan confirmation");
  const saved = await tool("dev_flow_get_task", { host: "zcode", task_id: task.task_id });
  const rejected = await tool("dev_flow_resolve_blocker", { host: "zcode", task_id: task.task_id,
    action_id: saved.result.task.current_action.action_id, choice: "reject", reason: "The fixture user rejects the out-of-plan file." });
  assert.equal(rejected.ok, true, JSON.stringify(rejected));
  const cancelled = await tool("dev_flow_cancel_task", { host: "zcode", task_id: task.task_id,
    revision: rejected.result.revision, request_id: "package-verification-cancel", reason: "The isolated package verification is complete." });
  assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
  assert.equal(cancelled.result.current_cursor, "CANCELLED");
  report.checks.push("cancel releases the isolated repository claim");
} finally {
  child.stdin.end(); child.kill();
}
const removed = await command(["remove", "--json"]);
assert.equal(removed.status, "action_required");
assert.equal(removed.registration.phase, "removal_required");
assert.equal((await command(["remove", "--json"])).changed, false);
assert.equal(await readFile(join(data, "unrelated.txt"), "utf8"), "preserve\n");
report.checks.push("idempotent removal preserves Task data and truthfully reports pending Host UI removal");
const reportPath = join(isolated, "report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify({ ...report, report_path: reportPath }, null, 2) + "\n");
