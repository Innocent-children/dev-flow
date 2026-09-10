import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

import { sharedSkillReferences } from "../../../scripts/sync-skill-references.mjs";
import { releaseOutputNames } from "../../../release/prepare.mjs";
import { execPortableCommand, findCommandPath } from "../lib/command.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const pluginRoot = join(packageRoot, "plugin");
const execFile = promisify(execFileCallback);
const currentVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();
const packageIconUrl = "https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg";

const expectedPackageFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "bin/dev-flow-codex.mjs",
  "lib/command.mjs",
  "lib/artifacts-help.mjs",
  "lib/install-experience.mjs",
  "lib/json.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "lib/platform.mjs",
  "lib/platform/macos/policies.mjs",
  "lib/platform/windows/policies.mjs",
  "lib/platform/macos/command.mjs",
  "lib/platform/windows/command.mjs",
  "lib/platform/macos/pet-installer.mjs",
  "lib/provisioning-receipt.mjs",
  "lib/task-admission.mjs",
  "lib/task-handoff.mjs",
  "lib/task-launch.mjs",
  "lib/host-launch-contract.mjs",
  "lib/worktree-lifecycle.mjs",
  "lib/worktree-snapshot.mjs",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/hooks/hooks.json",
  "plugin/hooks/pre-tool-use.mjs",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/references/admission.md",
  "plugin/skills/dev-flow/references/artifact-contract.md",
  "plugin/skills/dev-flow/references/artifacts.md",
  "plugin/skills/dev-flow/references/host-lifecycle.md",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "plugin/skills/dev-flow/references/nodes/comprehension.md",
  "plugin/skills/dev-flow/references/nodes/delivery.md",
  "plugin/skills/dev-flow/references/nodes/design.md",
  "plugin/skills/dev-flow/references/nodes/implementation.md",
  "plugin/skills/dev-flow/references/nodes/refactor.md",
  "plugin/skills/dev-flow/references/nodes/requirements.md",
  "plugin/skills/dev-flow/references/nodes/tasks.md",
  "plugin/skills/dev-flow/references/nodes/test.md",
  "plugin/skills/dev-flow/references/task-handoff.md",
  "plugin/skills/dev-flow/references/tool-results.md",
  "plugin/skills/dev-flow/references/transport.md",
  "plugin/skills/dev-flow/references/verification.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_abandon_task-abandon.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_cancel_task-cancel.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_get_next_action-guarded-read.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_get_task-read.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-create.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-multiple.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-resume.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_prepare_task_relocation-prepare.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_recover_action-saved-operation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-allow_once.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-expand_scope.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-history.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-reject.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-relocation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-verification-or-recovery.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_server_info-handshake.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-code_too_complex.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-comprehension_passed.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-design_too_complex.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-evidence_insufficient.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-implementation_defect.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-requirement_unclear.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_complete.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_comprehension.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_implementation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_design-design_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_design-design_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_needs_refactor.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_ready_for_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_ready_for_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_requirements-requirements_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_plan_saved.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_accepted_with_known_failures.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_design_issue.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_requirement_issue.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_failed_implementation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_passed.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-verification_budget_increased.md",
  "plugin/skills/dev-flow/references/successes/host-bootstrap-managed.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-branch-remove-branch.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-decision-keep.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-worktree-remove-worktree.md",
  "plugin/skills/dev-flow/references/successes/host-cli-provision-single.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-call-managed.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-reconcile-lookup.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-recover-not-called.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-result-queued.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-result-ready.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-start-managed.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-result-record.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-start-start.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-status-pending.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-status-succeeded.md",
  "plugin/skills/dev-flow/references/successes/host-inspect-single.md",
  "plugin/skills/dev-flow/references/successes/host-local-provision-current-session.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-local-branch.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-local-managed.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-remote-cli.md",
  "plugin/skills/dev-flow/references/successes/host-scope-multiple.md",
  "plugin/skills/dev-flow/references/successes/host-scope-single.md",
  "plugin/skills/dev-flow/references/successes/host-status-launch.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
];

const expectedPackedFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/command.mjs",
  "lib/artifacts-help.mjs",
  "lib/install-experience.mjs",
  "lib/json.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "lib/platform.mjs",
  "lib/platform/macos/policies.mjs",
  "lib/platform/windows/policies.mjs",
  "lib/platform/macos/command.mjs",
  "lib/platform/windows/command.mjs",
  "lib/platform/macos/pet-installer.mjs",
  "lib/provisioning-receipt.mjs",
  "lib/task-admission.mjs",
  "lib/task-handoff.mjs",
  "lib/task-launch.mjs",
  "lib/host-launch-contract.mjs",
  "lib/worktree-lifecycle.mjs",
  "lib/worktree-snapshot.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/hooks/hooks.json",
  "plugin/hooks/pre-tool-use.mjs",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/references/admission.md",
  "plugin/skills/dev-flow/references/artifact-contract.md",
  "plugin/skills/dev-flow/references/artifacts.md",
  "plugin/skills/dev-flow/references/host-lifecycle.md",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "plugin/skills/dev-flow/references/nodes/comprehension.md",
  "plugin/skills/dev-flow/references/nodes/delivery.md",
  "plugin/skills/dev-flow/references/nodes/design.md",
  "plugin/skills/dev-flow/references/nodes/implementation.md",
  "plugin/skills/dev-flow/references/nodes/refactor.md",
  "plugin/skills/dev-flow/references/nodes/requirements.md",
  "plugin/skills/dev-flow/references/nodes/tasks.md",
  "plugin/skills/dev-flow/references/nodes/test.md",
  "plugin/skills/dev-flow/references/task-handoff.md",
  "plugin/skills/dev-flow/references/tool-results.md",
  "plugin/skills/dev-flow/references/transport.md",
  "plugin/skills/dev-flow/references/verification.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_abandon_task-abandon.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_cancel_task-cancel.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_get_next_action-guarded-read.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_get_task-read.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-create.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-multiple.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_open_task-resume.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_prepare_task_relocation-prepare.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_recover_action-saved-operation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-allow_once.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-expand_scope.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-history.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-reject.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-relocation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_resolve_blocker-verification-or-recovery.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_server_info-handshake.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-code_too_complex.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-comprehension_passed.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-design_too_complex.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-evidence_insufficient.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-implementation_defect.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_comprehension-requirement_unclear.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_complete.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_comprehension.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_implementation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_design-design_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_design-design_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_needs_refactor.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_ready_for_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_ready_for_test.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_requirements-requirements_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_plan_saved.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_ready.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_design.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_requirements.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_accepted_with_known_failures.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_design_issue.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_requirement_issue.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_failed_implementation.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-tests_passed.md",
  "plugin/skills/dev-flow/references/successes/dev_flow_submit_test-verification_budget_increased.md",
  "plugin/skills/dev-flow/references/successes/host-bootstrap-managed.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-branch-remove-branch.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-decision-keep.md",
  "plugin/skills/dev-flow/references/successes/host-cleanup-worktree-remove-worktree.md",
  "plugin/skills/dev-flow/references/successes/host-cli-provision-single.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-call-managed.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-reconcile-lookup.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-recover-not-called.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-result-queued.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-result-ready.md",
  "plugin/skills/dev-flow/references/successes/host-dispatch-start-managed.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-result-record.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-start-start.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-status-pending.md",
  "plugin/skills/dev-flow/references/successes/host-handoff-status-succeeded.md",
  "plugin/skills/dev-flow/references/successes/host-inspect-single.md",
  "plugin/skills/dev-flow/references/successes/host-local-provision-current-session.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-local-branch.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-local-managed.md",
  "plugin/skills/dev-flow/references/successes/host-prepare-remote-cli.md",
  "plugin/skills/dev-flow/references/successes/host-scope-multiple.md",
  "plugin/skills/dev-flow/references/successes/host-scope-single.md",
  "plugin/skills/dev-flow/references/successes/host-status-launch.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
].sort();

test("package README displays the public Dev Flow icon", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  assert.match(readme, new RegExp(`<img src="${packageIconUrl}" width="112" height="112" alt="Dev Flow" \\/>`));
});

test("source package declares one public macOS arm64 and Windows x64 Codex product", async () => {
  const [coreVersion, manifest, plugin, marketplace, mcp] = await Promise.all([
    readFile(join(repositoryRoot, "CORE_VERSION"), "utf8").then((value) => value.trim()),
    readJSON(join(packageRoot, "package.json")),
    readJSON(join(pluginRoot, ".codex-plugin", "plugin.json")),
    readJSON(join(packageRoot, ".agents", "plugins", "marketplace.json")),
    readJSON(join(pluginRoot, ".mcp.json")),
  ]);

  assert.equal(manifest.name, "dev-flow-codex");
  assert.match(coreVersion, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u);
  assert.equal(manifest.private, false);
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.os, ["darwin", "win32"]);
  assert.deepEqual(manifest.cpu, ["arm64", "x64"]);
  assert.deepEqual(manifest.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(manifest.repository, {
    type: "git",
    url: "git+https://github.com/Innocent-children/dev-flow.git",
    directory: "packages/codex",
  });
  assert.deepEqual(manifest.engines, { node: ">=24" });
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(field in manifest, false, field);
  }

  assert.equal(plugin.name, "dev-flow-codex");
  assert.equal(plugin.version, manifest.version);
  assert.equal(plugin.skills, "./skills/");
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.hooks, "./hooks/hooks.json");
  assert.equal("apps" in plugin, false);
  assert.deepEqual(marketplace.plugins.map((entry) => entry.name), ["dev-flow-codex"]);
  assert.deepEqual(mcp.mcpServers, {
    "dev-flow": {
      type: "stdio",
      command: "dev-flow-codex",
      args: ["mcp"],
      env_vars: ["DEV_FLOW_DATA_DIR"],
    },
  });
  assert.equal(
    normalizeNewlines(await readFile(join(pluginRoot, "skills", "dev-flow", "agents", "openai.yaml"), "utf8")),
    "policy:\n  allow_implicit_invocation: true\n",
  );
});

test("package metadata closes source, artifact, and development command surfaces", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  assert.deepEqual([...manifest.files].sort(), [...expectedPackageFiles].sort());
  assert.equal(manifest.files.includes("plugin/skills/dev-flow/references/method-profiles.md"), true);
  assert.equal(manifest.files.includes("plugin/skills/dev-flow/references/node-payloads.md"), true);
  assert.equal(manifest.files.some((path) => /[*?[\]{}]/u.test(path)), false);
  assert.deepEqual(manifest.bin, { "dev-flow-codex": "bin/dev-flow-codex.mjs" });
  assert.deepEqual(manifest.scripts, {
    test: "node --test tests/*.test.mjs",
    "test:package": "node --test tests/package-contract.test.mjs",
    "test:lifecycle": "node --test tests/lifecycle.test.mjs",
    "pack:dry": "pnpm pack --dry-run --json",
    "build:webui": "node ../../scripts/build-webui.mjs",
    "build:local": "../../scripts/build-codex-local.sh",
  });

  for (const name of [
    "preinstall",
    "install",
    "postinstall",
    "prepare",
    "prepack",
    "postpack",
    "prepublish",
    "prepublishOnly",
    "publish",
    "postpublish",
    "preuninstall",
    "uninstall",
  ]) {
    assert.equal(name in manifest.scripts, false, name);
  }

});

test("method-profile reference is one closed dependency-free packaged resource", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const referencePath = "plugin/skills/dev-flow/references/method-profiles.md";
  const reference = await readFile(join(packageRoot, referencePath), "utf8");

  assert.equal(manifest.files.filter((path) => path === referencePath).length, 1);
  assert.equal((await stat(join(packageRoot, referencePath))).isFile(), true);
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(field in manifest, false, field);
  }
  assert.doesNotMatch(reference, /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u);
  assert.doesNotMatch(reference, /(?:node_modules|tests?\/fixtures?|\.tmp|\.sqlite|\.db)(?:\/|\b)/iu);
  assert.doesNotMatch(reference, /(?:process\.env|environment variable|token log|command log)/iu);
});

test("node-payload reference is one explicit closed packaged resource", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const referencePath = "plugin/skills/dev-flow/references/node-payloads.md";
  const reference = await readFile(join(packageRoot, referencePath), "utf8");
  assert.equal(manifest.files.filter((path) => path === referencePath).length, 1);
  assert.equal((await stat(join(packageRoot, referencePath))).isFile(), true);
  const links = [...reference.matchAll(/\]\((nodes\/[^)]+\.md)\)/gu)].map((match) => match[1]);
  assert.equal(new Set(links).size, 8);
  for (const link of links) {
    assert.ok((await stat(join(packageRoot, "plugin/skills/dev-flow/references", link))).isFile());
    assert.ok(manifest.files.includes(`plugin/skills/dev-flow/references/${link}`));
  }
  assert.doesNotMatch(reference, /(?:^|\s)(?:\/Users\/|\/home\/|[A-Za-z]:\\\\)/u);
  assert.doesNotMatch(reference, /(?:node_modules|tests?\/fixtures?|\.tmp|\.sqlite|\.db)(?:\/|\b)/iu);
});

test("npm compatibility metadata rejects an unsupported OS and CPU", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const npmManifestPath = process.platform === "win32"
    ? join(dirname(await findCommandPath("npm")), "node_modules", "npm", "package.json")
    : join((await execPortableCommand("npm", ["root", "--global"], { encoding: "utf8" })).stdout.trim(), "npm", "package.json");
  const npmRequire = createRequire(npmManifestPath);
  const { checkPlatform } = npmRequire("npm-install-checks");

  assert.doesNotThrow(() => checkPlatform(manifest, false, { os: "darwin", cpu: "arm64" }));
  assert.doesNotThrow(() => checkPlatform(manifest, false, { os: "win32", cpu: "x64" }));
  assert.throws(
    () => checkPlatform(manifest, false, { os: "linux", cpu: "x64", libc: "glibc" }),
    (error) => {
      assert.equal(error.code, "EBADPLATFORM");
      assert.deepEqual(error.required.os, ["darwin", "win32"]);
      assert.deepEqual(error.required.cpu, ["arm64", "x64"]);
      return true;
    },
  );
});

test("packaged resources contain no copied fixtures or workflow engine", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));
  const sharedFixtureRoot = join(repositoryRoot, "protocol", "fixtures");
  const fixtureFiles = (await walkFiles(sharedFixtureRoot)).filter((path) => path.endsWith(".json"));
  const fixtureDigests = new Set(
    await Promise.all(fixtureFiles.map((path) => sha256(readFile(join(sharedFixtureRoot, path))))),
  );

  for (const declaredPath of manifest.files) {
    assert.equal(/(?:^|\/)(?:tests?|fixtures?)(?:\/|$)/iu.test(declaredPath), false, declaredPath);
    assert.equal(/(?:^|\/)(?:cmd\/dev-flow|internal|protocol)(?:\/|$)/u.test(declaredPath), false, declaredPath);
  }

  for (const path of (await walkFiles(packageRoot, {
    skipDirectories: new Set(["node_modules", "tests", "runtime"]),
  }))) {
    const contents = await readFile(join(packageRoot, path));
    assert.equal(fixtureDigests.has(await sha256(contents)), false, path);
    if (/^(?:bin|lib)\/.*\.mjs$/u.test(path)) {
      const source = contents.toString("utf8");
      assert.doesNotMatch(source, /transitionTable|taskStates?|nextState|persistTask|sqlite/iu, path);
      assert.doesNotMatch(source, /tests\/fixtures|fake-(?:codex|core)|protocol\/fixtures/iu, path);
    }
  }
});

test("release output names derive from Codex and Core versions", () => {
  assert.deepEqual(releaseOutputNames("codex", currentVersion, currentVersion), [
    "SHA256SUMS",
    `dev-flow-core-${currentVersion}-darwin-arm64`,
    `dev-flow-core-${currentVersion}-windows-amd64.exe`,
    `dev-flow-codex-${currentVersion}.tgz`,
    "release-manifest.json",
  ].sort());
});

test("local package builder stages one exact non-final artifact in a temporary directory", {
  skip: process.platform === "win32" ? "the Unix builder is covered on Unix; Windows uses scripts/dev-flow-local.mjs" : false,
}, async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-contract-"));
  const { stdout } = await execFile(
    join(repositoryRoot, "scripts", "build-codex-local.sh"),
    ["--output", outputDirectory],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.final_artifact, false);
  assert.equal((await stat(report.artifact_path)).isFile(), true);
  assert.equal(await sha256(readFile(report.artifact_path)), report.artifact_sha256);

  const { stdout: manifestContents } = await execFile(
    "tar",
    ["-xOzf", report.artifact_path, "package/package.json"],
    { encoding: "utf8" },
  );
  const packedManifest = JSON.parse(manifestContents);
  assert.equal(packedManifest.private, false);
  assert.deepEqual(packedManifest.os, ["darwin", "win32"]);
  assert.deepEqual(packedManifest.cpu, ["arm64", "x64"]);

  const { stdout: listing } = await execFile("tar", ["-tzf", report.artifact_path], {
    encoding: "utf8",
  });
  const packedFiles = listing
    .trim()
    .split("\n")
    .filter((path) => path && !path.endsWith("/"))
    .map((path) => path.replace(/^package\//u, ""))
    .sort();
  assert.deepEqual(packedFiles, expectedPackedFiles);

  const extractDirectory = await mkdtemp(join(tmpdir(), "dev-flow-codex-package-extract-"));
  await execFile("tar", ["-xzf", report.artifact_path, "-C", extractDirectory]);
  for (const [path, expected] of await sharedSkillReferences({ root: repositoryRoot, host: "codex" })) {
    assert.equal(await readFile(join(extractDirectory, "package", "plugin", "skills", "dev-flow", path), "utf8"), expected, path);
  }

  const handoff = await import(pathToFileURL(join(extractDirectory, "package", "lib", "task-handoff.mjs")));
  const reference = await readFile(join(extractDirectory, "package", "plugin", "skills", "dev-flow", "references", "task-handoff.md"), "utf8");
  const example = JSON.parse(reference.match(/<!-- task-handoff-example:start -->\n```json\n([\s\S]*?)\n```/u)[1]);
  assert.deepEqual(handoff.validateTaskHandoff(example), example);

  if (process.platform === "darwin" && process.arch === "arm64") {
    const runtime = join(extractDirectory, "package", "runtime", "darwin-arm64", "dev-flow");
    assert.notEqual((await stat(runtime)).mode & 0o111, 0);
    const { stdout: versionLine } = await execFile(runtime, ["version"], {
      cwd: extractDirectory,
      encoding: "utf8",
    });
    assert.equal(versionLine, `dev-flow ${currentVersion}\n`);
    const { stdout: help } = await execFile(runtime, ["help"], { cwd: extractDirectory, encoding: "utf8" });
    for (const command of ["webui start", "webui open", "webui status", "webui stop"]) {
      assert.match(help, new RegExp(command, "u"));
    }
  }
});

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeNewlines(value) {
  return value.replaceAll("\r\n", "\n");
}

async function sha256(value) {
  const contents = await value;
  return createHash("sha256").update(contents).digest("hex");
}

async function walkFiles(root, { skipDirectories = new Set() } = {}) {
  const files = [];
  await visit(root);
  return files.sort();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const absolute = join(directory, entry.name);
      const relativePath = relative(root, absolute).split("\\").join("/");
      if (entry.isDirectory()) {
        if (!skipDirectories.has(entry.name)) await visit(absolute);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
}
