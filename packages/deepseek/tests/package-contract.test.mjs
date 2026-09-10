import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { arch, platform, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gunzipSync } from "node:zlib";

import { execPortableCommand } from "../../dev-flow/lib/command.mjs";
import { sharedSkillReferences } from "../../../scripts/sync-skill-references.mjs";
import { ustarEntryModes } from "../../../scripts/dev-flow-local.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(packageRoot));
const execFile = promisify(execFileCallback);
const currentCoreVersion = (await readFile(join(repositoryRoot, "CORE_VERSION"), "utf8")).trim();
const packageIconUrl = "https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg";
const runtimePaths = [
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
];

const expectedPackageFiles = [
  "LICENSE",
  "README.md",
  "cordis.patch.yml",
  "lib/authorization.mjs",
  "lib/file-scope.mjs",
  "lib/index.mjs",
  "lib/paths.mjs",
  "lib/platform.mjs",
  "lib/platform/macos/policies.mjs",
  "lib/platform/windows/policies.mjs",
  "lib/provisioning-receipt.mjs",
  "lib/runtime.mjs",
  "lib/tool-names.mjs",
  "lib/workspace-coordinator.mjs",
  "lib/workspace-tool.mjs",
  "lib/worktree-snapshot.mjs",
  ...runtimePaths,
  "skills/dev-flow/SKILL.md",
  "skills/dev-flow/references/admission.md",
  "skills/dev-flow/references/artifact-contract.md",
  "skills/dev-flow/references/artifacts.md",
  "skills/dev-flow/references/host-lifecycle.md",
  "skills/dev-flow/references/method-profiles.md",
  "skills/dev-flow/references/node-payloads.md",
  "skills/dev-flow/references/nodes/comprehension.md",
  "skills/dev-flow/references/nodes/delivery.md",
  "skills/dev-flow/references/nodes/design.md",
  "skills/dev-flow/references/nodes/implementation.md",
  "skills/dev-flow/references/nodes/refactor.md",
  "skills/dev-flow/references/nodes/requirements.md",
  "skills/dev-flow/references/nodes/tasks.md",
  "skills/dev-flow/references/nodes/test.md",
  "skills/dev-flow/references/tool-results.md",
  "skills/dev-flow/references/transport.md",
  "skills/dev-flow/references/verification.md",
  "skills/dev-flow/references/successes/dev_flow_abandon_task-abandon.md",
  "skills/dev-flow/references/successes/dev_flow_cancel_task-cancel.md",
  "skills/dev-flow/references/successes/dev_flow_get_next_action-guarded-read.md",
  "skills/dev-flow/references/successes/dev_flow_get_task-read.md",
  "skills/dev-flow/references/successes/dev_flow_open_task-create.md",
  "skills/dev-flow/references/successes/dev_flow_open_task-multiple.md",
  "skills/dev-flow/references/successes/dev_flow_open_task-resume.md",
  "skills/dev-flow/references/successes/dev_flow_prepare_task_relocation-prepare.md",
  "skills/dev-flow/references/successes/dev_flow_recover_action-saved-operation.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-allow_once.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-expand_scope.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-history.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-reject.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-relocation.md",
  "skills/dev-flow/references/successes/dev_flow_resolve_blocker-verification-or-recovery.md",
  "skills/dev-flow/references/successes/dev_flow_server_info-handshake.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-code_too_complex.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-comprehension_passed.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-design_too_complex.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-evidence_insufficient.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-implementation_defect.md",
  "skills/dev-flow/references/successes/dev_flow_submit_comprehension-requirement_unclear.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_complete.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_comprehension.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_design.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_implementation.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_requirements.md",
  "skills/dev-flow/references/successes/dev_flow_submit_delivery-delivery_needs_test.md",
  "skills/dev-flow/references/successes/dev_flow_submit_design-design_ready.md",
  "skills/dev-flow/references/successes/dev_flow_submit_design-design_requires_requirements.md",
  "skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_needs_refactor.md",
  "skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_ready_for_test.md",
  "skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_design.md",
  "skills/dev-flow/references/successes/dev_flow_submit_implementation-implementation_requires_requirements.md",
  "skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_ready_for_test.md",
  "skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_design.md",
  "skills/dev-flow/references/successes/dev_flow_submit_refactor-refactor_requires_requirements.md",
  "skills/dev-flow/references/successes/dev_flow_submit_requirements-requirements_ready.md",
  "skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_plan_saved.md",
  "skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_ready.md",
  "skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_design.md",
  "skills/dev-flow/references/successes/dev_flow_submit_tasks-tasks_require_requirements.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-tests_accepted_with_known_failures.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_design_issue.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-tests_expose_requirement_issue.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-tests_failed_implementation.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-tests_passed.md",
  "skills/dev-flow/references/successes/dev_flow_submit_test-verification_budget_increased.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-cleanup_branch.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-cleanup_worktree.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-consume.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-prepare_cleanup.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-provision-local.md",
  "skills/dev-flow/references/successes/workspace-workspace_coordinator-provision-worktree.md",
  "skills/dev-flow/scripts/artifacts.mjs",
];
const expectedSourcePackedFiles = [
  "package.json",
  ...expectedPackageFiles.filter((path) => !runtimePaths.includes(path)),
].sort();
const expectedFinalPackedFiles = ["package.json", ...expectedPackageFiles].sort();

const lifecycleHooks = [
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
  "postuninstall",
];

test("package README displays the public Dev Flow icon", async () => {
  const readme = await readFile(join(packageRoot, "README.md"), "utf8");
  assert.match(readme, new RegExp(`<img src="${packageIconUrl}" width="112" height="112" alt="Dev Flow" \\/>`));
});

test("manifest declares one public macOS arm64 and Windows x64 ESM DeepSeek bundle", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));

  assert.equal(manifest.name, "dev-flow-deepseek");
  assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/u);
  assert.equal(manifest.private, false);
  assert.equal(manifest.type, "module");
  assert.equal(manifest.main, "lib/index.mjs");
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.repository, {
    type: "git",
    url: "git+https://github.com/Innocent-children/dev-flow.git",
    directory: "packages/deepseek",
  });
  assert.deepEqual(manifest.engines, { node: ">=24" });
  assert.deepEqual(manifest.os, ["darwin", "win32"]);
  assert.deepEqual(manifest.cpu, ["arm64", "x64"]);
  assert.deepEqual(manifest.publishConfig, { access: "public", registry: "https://registry.npmjs.org/" });
  assert.deepEqual(manifest.dsh, { bundle: { patch: "./cordis.patch.yml" } });
  assert.equal("bin" in manifest, false);
});

test("manifest closes final package, dependency, and lifecycle surfaces", async () => {
  const manifest = await readJSON(join(packageRoot, "package.json"));

  assert.deepEqual([...manifest.files].sort(), [...expectedPackageFiles].sort());
  assert.equal(manifest.files.some((path) => /[*?[\]{}]/u.test(path)), false);
  assert.deepEqual(manifest.dependencies, {
    "@deepseek-ai/dsh-mcp-client": ">=0.1.2-rc.1",
  });
  assert.deepEqual(manifest.peerDependencies, {
    "@deepseek-ai/cordis": ">=4.0.2 <5.0.0",
    "@deepseek-ai/dsh-skill": ">=0.1.2-rc.1",
    "@deepseek-ai/dsh-tools": ">=0.1.2-rc.1",
  });
  assert.equal(manifest.scripts["build:webui"], "node ../../scripts/build-webui.mjs");
  assert.equal(manifest.scripts["build:local"], "node ../../scripts/build-deepseek-local.mjs");

  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
    "bundledDependencies",
    "bundleDependencies",
  ]) {
    assert.equal(
      Object.hasOwn(manifest, field) && Object.hasOwn(manifest[field], "dev-flow-codex"),
      false,
      field,
    );
  }
  for (const hook of lifecycleHooks) assert.equal(Object.hasOwn(manifest.scripts, hook), false, hook);
});


test("source checkout omits precompiled Core while preserving the final manifest contract", async () => {
  for (const runtimePath of runtimePaths) {
    await assert.rejects(lstat(join(packageRoot, runtimePath)), { code: "ENOENT" });
  }
  const { stdout } = await execPortableCommand(
    "pnpm",
    ["--config.ignore-scripts=true", "--dir", packageRoot, "pack", "--dry-run", "--json"],
    { encoding: "utf8" },
  );
  const report = JSON.parse(stdout);
  const packed = Array.isArray(report) ? report[0] : report;
  const packedFiles = (packed.files ?? [])
    .map((file) => (typeof file === "string" ? file : file.path ?? file.name))
    .sort();
  assert.equal(packed.name, "dev-flow-deepseek");
  assert.deepEqual(packedFiles, expectedSourcePackedFiles);
  assert.equal(packedFiles.some((path) => path.startsWith("runtime/")), false);
  assert.equal(packedFiles.some((path) => /(?:^|\/)(?:tests?|evidence|profiles?|data)(?:\/|$)/iu.test(path)), false);
});

test("staged tarball contains and starts the current dual-platform Core", async (t) => {
  const outputDirectory = await realpath(await mkdtemp(join(tmpdir(), "dev-flow-deepseek-package-contract-")));
  const extractDirectory = join(outputDirectory, "extract");
  await mkdir(extractDirectory);
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));

  const { stdout } = await execFile(
    process.execPath,
    [join(repositoryRoot, "scripts", "build-deepseek-local.mjs"), "--output", outputDirectory],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.package_version, (await readJSON(join(packageRoot, "package.json"))).version);
  assert.equal(report.core_version, currentCoreVersion);
  assert.deepEqual(report.platforms, ["darwin-arm64", "win32-x64"]);
  assert.equal(await sha256(readFile(report.artifact_path)), report.artifact_sha256);

  const { stdout: listing } = await execFile("tar", ["-tzf", report.artifact_path], { encoding: "utf8" });
  const packedFiles = listing
    .trim()
    .split("\n")
    .filter((path) => path && !path.endsWith("/"))
    .map((path) => path.replace(/^package\//u, ""))
    .sort();
  assert.deepEqual(packedFiles, expectedFinalPackedFiles);

  const modes = ustarEntryModes(gunzipSync(await readFile(report.artifact_path)));
  assert.equal(modes.get("package/runtime/darwin-arm64/dev-flow"), 0o755);
  assert.equal(modes.get("package/runtime/win32-x64/dev-flow.exe"), 0o644);
  await execFile("tar", ["-xzf", report.artifact_path, "-C", extractDirectory]);
  const installedSkill = join(extractDirectory, "package", "skills", "dev-flow");
  for (const [path, expected] of await sharedSkillReferences({ root: repositoryRoot, host: "deepseek" })) {
    assert.equal(await readFile(join(installedSkill, path), "utf8"), expected, path);
  }
  const helper = join(installedSkill, "scripts", "artifacts.mjs");
  const helperHelp = await execFile(process.execPath, [helper, "--help"], { encoding: "utf8" });
  assert.match(helperHelp.stdout, /collect\|prepare/u);


  const runtimes = [
    { path: "runtime/darwin-arm64/dev-flow", goos: "darwin", goarch: "arm64" },
    { path: "runtime/win32-x64/dev-flow.exe", goos: "windows", goarch: "amd64" },
  ];
  for (const runtime of runtimes) {
    const runtimePath = join(extractDirectory, "package", runtime.path);
    assert.equal((await lstat(runtimePath)).isFile(), true);
    const { stdout: metadata } = await execFile("go", ["version", "-m", runtimePath], { encoding: "utf8" });
    for (const expected of [
      `\tbuild\tGOOS=${runtime.goos}`,
      `\tbuild\tGOARCH=${runtime.goarch}`,
      "\tbuild\tCGO_ENABLED=0",
    ]) {
      assert.equal(metadata.replaceAll("\r\n", "\n").split("\n").includes(expected), true, expected);
    }
  }

  const nativeRuntime = platform() === "darwin" && arch() === "arm64"
    ? "runtime/darwin-arm64/dev-flow"
    : platform() === "win32" && arch() === "x64"
      ? "runtime/win32-x64/dev-flow.exe"
      : null;
  assert.notEqual(nativeRuntime, null, "final artifact contract requires a supported native runner");
  const runtimePath = join(extractDirectory, "package", nativeRuntime);
  const dataDirectory = join(outputDirectory, "data");
  await mkdir(dataDirectory);
  assert.equal((await execFile(runtimePath, ["version"], { encoding: "utf8" })).stdout, `dev-flow ${currentCoreVersion}\n`);
  const environment = { ...process.env, DEV_FLOW_DATA_DIR: dataDirectory };
  if (platform() === "win32") {
    environment.USERPROFILE = outputDirectory;
    delete environment.HOME;
  } else {
    environment.HOME = outputDirectory;
  }
  const helperFailure = await runWithClosedInput(
    process.execPath, [helper, "collect"], { cwd: outputDirectory, env: environment },
    JSON.stringify({ host: "deepseek", task_id: "task-example", action_id: "action-example" }) + "\n", 1,
  );
  const envelope = JSON.parse(helperFailure.stdout);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "STORAGE_UNAVAILABLE");
  assert.equal(helperFailure.stderr, "");
  assert.deepEqual(await readdir(dataDirectory), []);
  const { stdout: mcpStdout, stderr: mcpStderr } = await runWithClosedInput(
    runtimePath,
    ["mcp", "--stdio"],
    { cwd: outputDirectory, env: environment },
  );
  assert.equal(mcpStdout, "");
  assert.equal(mcpStderr, "");
});

test("release preparation builds both frozen artifacts through the staging builder", async () => {
  const release = await readFile(join(repositoryRoot, "scripts", "build-deepseek-release.sh"), "utf8");
  assert.match(release, /build_report_a=.*build-deepseek-local\.mjs/u);
  assert.match(release, /build_report_b=.*build-deepseek-local\.mjs/u);
  assert.match(release, /report\.source_dirty[\s\S]*report\.source_commit/u);
  assert.doesNotMatch(release, /packages\/deepseek\/tests\/build-artifact\.mjs/u);
});

async function runWithClosedInput(command, args, options, input = "", expectedExit = 0) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === expectedExit) resolve({ stdout, stderr });
      else reject(new Error(`packaged Core exited with code ${code} and signal ${signal ?? "none"}: ${stderr}`));
    });
    child.stdin.end(input);
  });
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function sha256(value) {
  return createHash("sha256").update(await value).digest("hex");
}
