#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repository_root"
node scripts/sync-skill-references.mjs --check
node scripts/sync-host-commands.mjs --check

run_step() {
  step_name=$1
  shift
  printf '\n==> %s\n' "$step_name"
  "$@"
}

check_toolchains() {
  go version
  node --version
  pnpm --version

  node -e '
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    if (nodeMajor < 24) {
      throw new Error(`Node.js >=24 is required; found ${process.versions.node}`);
    }
  '

  pnpm_version=$(pnpm --version)
  pnpm_major=${pnpm_version%%.*}
  if [ "$pnpm_major" -ne 11 ]; then
    printf 'pnpm >=11 <12 is required; found %s\n' "$pnpm_version" >&2
    return 1
  fi
}

check_go_formatting() {
  unformatted_files=""
  for source_dir in cmd internal tests; do
    if [ -d "$source_dir" ]; then
      current_files=$(gofmt -l "$source_dir")
      if [ -n "$current_files" ]; then
        unformatted_files="${unformatted_files}${current_files}
"
      fi
    fi
  done

  if [ -n "$unformatted_files" ]; then
    printf 'gofmt is required for:\n%s' "$unformatted_files" >&2
    return 1
  fi
}

validate_package_pack() {
  package_dir=$1
  expected_package_name=$2
  package_profile=$3
  pack_output=$(pnpm --config.ignore-scripts=true --dir "$package_dir" pack --dry-run --json)

  PACK_OUTPUT="$pack_output" EXPECTED_PACKAGE_NAME="$expected_package_name" PACKAGE_PROFILE="$package_profile" node <<'NODE'
const report = JSON.parse(process.env.PACK_OUTPUT);
const packed = Array.isArray(report) ? report[0] : report;
if (!packed || packed.name !== process.env.EXPECTED_PACKAGE_NAME) {
  throw new Error(`unexpected dry-pack package: ${packed?.name ?? "missing"}`);
}

const files = (packed.files ?? [])
  .map((file) => typeof file === "string" ? file : file.path ?? file.name)
  .sort();
const codexFinalStagingFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/taskbelay-codex.mjs",
  "lib/artifacts-help.mjs",
  "lib/command.mjs",
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
  "plugin/skills/taskbelay/SKILL.md",
  "plugin/skills/taskbelay/references/admission.md",
  "plugin/skills/taskbelay/references/artifact-contract.md",
  "plugin/skills/taskbelay/references/connection-examples.md",
  "plugin/skills/taskbelay/references/connection.md",
  "plugin/skills/taskbelay/references/core-lifecycle-examples.md",
  "plugin/skills/taskbelay/references/core-lifecycle.md",
  "plugin/skills/taskbelay/references/launch-examples.md",
  "plugin/skills/taskbelay/references/lifecycle-examples.md",
  "plugin/skills/taskbelay/references/nodes/comprehension-examples.md",
  "plugin/skills/taskbelay/references/nodes/delivery-examples.md",
  "plugin/skills/taskbelay/references/nodes/design-examples.md",
  "plugin/skills/taskbelay/references/nodes/implementation-examples.md",
  "plugin/skills/taskbelay/references/nodes/refactor-examples.md",
  "plugin/skills/taskbelay/references/nodes/requirements-examples.md",
  "plugin/skills/taskbelay/references/nodes/tasks-examples.md",
  "plugin/skills/taskbelay/references/nodes/test-examples.md",
  "plugin/skills/taskbelay/references/recovery-examples.md",
  "plugin/skills/taskbelay/references/recovery.md",
  "plugin/skills/taskbelay/references/response-examples.md",
  "plugin/skills/taskbelay/references/worktree-launch.md",
  "plugin/skills/taskbelay/references/artifacts.md",
  "plugin/skills/taskbelay/references/host-lifecycle.md",
  "plugin/skills/taskbelay/references/method-profiles.md",
  "plugin/skills/taskbelay/references/node-payloads.md",
  "plugin/skills/taskbelay/references/nodes/comprehension.md",
  "plugin/skills/taskbelay/references/nodes/delivery.md",
  "plugin/skills/taskbelay/references/nodes/design.md",
  "plugin/skills/taskbelay/references/nodes/implementation.md",
  "plugin/skills/taskbelay/references/nodes/refactor.md",
  "plugin/skills/taskbelay/references/nodes/requirements.md",
  "plugin/skills/taskbelay/references/nodes/tasks.md",
  "plugin/skills/taskbelay/references/nodes/test.md",
  "plugin/skills/taskbelay/references/task-handoff.md",
  "plugin/skills/taskbelay/references/tool-results.md",
  "plugin/skills/taskbelay/references/transport.md",
  "plugin/skills/taskbelay/references/verification.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_abandon_task-abandon.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_cancel_task-cancel.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_get_next_action-guarded-read.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_get_task-read.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_open_task-create.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_open_task-multiple.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_open_task-resume.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_prepare_task_relocation-prepare.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_recover_action-saved-operation.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-allow_once.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-expand_scope.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-history.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-reject.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-relocation.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_resolve_blocker-verification-or-recovery.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_server_info-handshake.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-code_too_complex.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-comprehension_passed.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-design_too_complex.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-evidence_insufficient.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-implementation_defect.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_comprehension-requirement_unclear.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_complete.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_comprehension.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_design.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_implementation.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_requirements.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_test.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_design-design_ready.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_design-design_requires_requirements.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_needs_refactor.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_ready_for_test.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_requires_design.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_requires_requirements.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_ready_for_test.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_requires_design.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_requires_requirements.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_requirements-requirements_ready.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_plan_saved.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_ready.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_require_design.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_require_requirements.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-tests_accepted_with_known_failures.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-tests_expose_design_issue.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-tests_expose_requirement_issue.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-tests_failed_implementation.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-tests_passed.md",
  "plugin/skills/taskbelay/references/successes/taskbelay_submit_test-verification_budget_increased.md",
  "plugin/skills/taskbelay/references/successes/host-bootstrap-managed.md",
  "plugin/skills/taskbelay/references/successes/host-cleanup-branch-remove-branch.md",
  "plugin/skills/taskbelay/references/successes/host-cleanup-decision-keep.md",
  "plugin/skills/taskbelay/references/successes/host-cleanup-worktree-remove-worktree.md",
  "plugin/skills/taskbelay/references/successes/host-cli-provision-single.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-call-managed.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-reconcile-lookup.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-recover-not-called.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-result-queued.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-result-ready.md",
  "plugin/skills/taskbelay/references/successes/host-dispatch-start-managed.md",
  "plugin/skills/taskbelay/references/successes/host-handoff-result-record.md",
  "plugin/skills/taskbelay/references/successes/host-handoff-start-start.md",
  "plugin/skills/taskbelay/references/successes/host-handoff-status-pending.md",
  "plugin/skills/taskbelay/references/successes/host-handoff-status-succeeded.md",
  "plugin/skills/taskbelay/references/successes/host-inspect-single.md",
  "plugin/skills/taskbelay/references/successes/host-local-provision-current-session.md",
  "plugin/skills/taskbelay/references/successes/host-prepare-local-branch.md",
  "plugin/skills/taskbelay/references/successes/host-prepare-local-managed.md",
  "plugin/skills/taskbelay/references/successes/host-prepare-remote-cli.md",
  "plugin/skills/taskbelay/references/successes/host-scope-multiple.md",
  "plugin/skills/taskbelay/references/successes/host-scope-single.md",
  "plugin/skills/taskbelay/references/successes/host-status-launch.md",
  "plugin/skills/taskbelay/agents/openai.yaml",
  "runtime/darwin-arm64/taskbelay",
  "runtime/win32-x64/taskbelay.exe",
].sort();
const deepseekFinalStagingFiles = [
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
  "package.json",
  "runtime/darwin-arm64/taskbelay",
  "runtime/win32-x64/taskbelay.exe",
  "skills/taskbelay/SKILL.md",
  "skills/taskbelay/references/admission.md",
  "skills/taskbelay/references/artifact-contract.md",
  "skills/taskbelay/references/connection-examples.md",
  "skills/taskbelay/references/connection.md",
  "skills/taskbelay/references/core-lifecycle-examples.md",
  "skills/taskbelay/references/core-lifecycle.md",
  "skills/taskbelay/references/nodes/comprehension-examples.md",
  "skills/taskbelay/references/nodes/delivery-examples.md",
  "skills/taskbelay/references/nodes/design-examples.md",
  "skills/taskbelay/references/nodes/implementation-examples.md",
  "skills/taskbelay/references/nodes/refactor-examples.md",
  "skills/taskbelay/references/nodes/requirements-examples.md",
  "skills/taskbelay/references/nodes/tasks-examples.md",
  "skills/taskbelay/references/nodes/test-examples.md",
  "skills/taskbelay/references/recovery-examples.md",
  "skills/taskbelay/references/recovery.md",
  "skills/taskbelay/references/response-examples.md",
  "skills/taskbelay/references/artifacts.md",
  "skills/taskbelay/references/host-lifecycle.md",
  "skills/taskbelay/references/method-profiles.md",
  "skills/taskbelay/references/node-payloads.md",
  "skills/taskbelay/references/nodes/comprehension.md",
  "skills/taskbelay/references/nodes/delivery.md",
  "skills/taskbelay/references/nodes/design.md",
  "skills/taskbelay/references/nodes/implementation.md",
  "skills/taskbelay/references/nodes/refactor.md",
  "skills/taskbelay/references/nodes/requirements.md",
  "skills/taskbelay/references/nodes/tasks.md",
  "skills/taskbelay/references/nodes/test.md",
  "skills/taskbelay/references/tool-results.md",
  "skills/taskbelay/references/transport.md",
  "skills/taskbelay/references/verification.md",
  "skills/taskbelay/references/successes/taskbelay_abandon_task-abandon.md",
  "skills/taskbelay/references/successes/taskbelay_cancel_task-cancel.md",
  "skills/taskbelay/references/successes/taskbelay_get_next_action-guarded-read.md",
  "skills/taskbelay/references/successes/taskbelay_get_task-read.md",
  "skills/taskbelay/references/successes/taskbelay_open_task-create.md",
  "skills/taskbelay/references/successes/taskbelay_open_task-multiple.md",
  "skills/taskbelay/references/successes/taskbelay_open_task-resume.md",
  "skills/taskbelay/references/successes/taskbelay_prepare_task_relocation-prepare.md",
  "skills/taskbelay/references/successes/taskbelay_recover_action-saved-operation.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-allow_once.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-expand_scope.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-history.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-reject.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-relocation.md",
  "skills/taskbelay/references/successes/taskbelay_resolve_blocker-verification-or-recovery.md",
  "skills/taskbelay/references/successes/taskbelay_server_info-handshake.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-code_too_complex.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-comprehension_passed.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-design_too_complex.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-evidence_insufficient.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-implementation_defect.md",
  "skills/taskbelay/references/successes/taskbelay_submit_comprehension-requirement_unclear.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_complete.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_comprehension.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_design.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_implementation.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_requirements.md",
  "skills/taskbelay/references/successes/taskbelay_submit_delivery-delivery_needs_test.md",
  "skills/taskbelay/references/successes/taskbelay_submit_design-design_ready.md",
  "skills/taskbelay/references/successes/taskbelay_submit_design-design_requires_requirements.md",
  "skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_needs_refactor.md",
  "skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_ready_for_test.md",
  "skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_requires_design.md",
  "skills/taskbelay/references/successes/taskbelay_submit_implementation-implementation_requires_requirements.md",
  "skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_ready_for_test.md",
  "skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_requires_design.md",
  "skills/taskbelay/references/successes/taskbelay_submit_refactor-refactor_requires_requirements.md",
  "skills/taskbelay/references/successes/taskbelay_submit_requirements-requirements_ready.md",
  "skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_plan_saved.md",
  "skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_ready.md",
  "skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_require_design.md",
  "skills/taskbelay/references/successes/taskbelay_submit_tasks-tasks_require_requirements.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-tests_accepted_with_known_failures.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-tests_expose_design_issue.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-tests_expose_requirement_issue.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-tests_failed_implementation.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-tests_passed.md",
  "skills/taskbelay/references/successes/taskbelay_submit_test-verification_budget_increased.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-cleanup_branch.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-cleanup_worktree.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-consume.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-prepare_cleanup.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-provision-local.md",
  "skills/taskbelay/references/successes/workspace-workspace_coordinator-provision-worktree.md",
  "skills/taskbelay/scripts/artifacts.mjs",
].sort();
const expectedByProfile = {
  "codex-source": codexFinalStagingFiles.filter((file) => !file.startsWith("runtime/")),
  "deepseek-source": deepseekFinalStagingFiles.filter((file) => !file.startsWith("runtime/")),
  "taskbelay-source": [
    "LICENSE",
    "README.md",
    "bin/taskbelay.mjs",
    "lib/cli.mjs",
    "lib/command.mjs",
    "lib/configuration.mjs",
    "lib/core-maintenance.mjs",
    "lib/core-runtime.mjs",
    "lib/diagnostics.mjs",
    "lib/hosts/claude.mjs",
    "lib/hosts/codex-orphan.mjs",
    "lib/hosts/codex.mjs",
    "lib/hosts/deepseek-receipts.mjs",
    "lib/hosts/deepseek.mjs",
    "lib/hosts/index.mjs",
    "lib/hosts/zcode.mjs",
    "lib/journal.mjs",
    "lib/lifecycle.mjs",
    "lib/local-packages.mjs",
    "lib/platform/windows/maintenance.mjs",
    "lib/platform/macos/maintenance.mjs",
    "lib/ownership.mjs",
    "lib/pet.mjs",
    "lib/platform.mjs",
    "lib/platform/macos/policies.mjs",
    "lib/platform/windows/policies.mjs",
    "lib/platform/macos/command.mjs",
    "lib/platform/macos/core-processes.mjs",
    "lib/platform/windows/command.mjs",
    "lib/platform/windows/core-processes.mjs",
    "lib/platform/macos/pet-installer.mjs",
    "lib/platform/macos/pet.mjs",
    "lib/platform/windows/pet.mjs",
    "lib/platform/windows/pet-installer.mjs",
    "lib/plan.mjs",
    "lib/presentation.mjs",
    "lib/runtime.mjs",
    "lib/terminal.mjs",
    "package.json",
  ].sort(),
};
const expectedFiles = expectedByProfile[process.env.PACKAGE_PROFILE];
if (!expectedFiles) {
  throw new Error(`unknown package validation profile ${process.env.PACKAGE_PROFILE}`);
}
if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
  throw new Error(`${packed.name} dry-pack files ${JSON.stringify(files)}; expected ${JSON.stringify(expectedFiles)}`);
}
NODE
}

run_step "Toolchain versions" check_toolchains
run_step "Frozen pnpm workspace install" pnpm install --frozen-lockfile --ignore-scripts
run_step "Product version authorities" pnpm run versions:check
run_step "Working tree whitespace" git diff --check
run_step "Go formatting" check_go_formatting
run_step "Codex release prepare syntax" bash -n scripts/build-codex-release.sh
run_step "DeepSeek source-local package syntax" node --check scripts/build-deepseek-local.mjs
run_step "DeepSeek release prepare syntax" bash -n scripts/build-deepseek-release.sh
run_step "Cross-platform WebUI build syntax" node --check scripts/build-webui.mjs
run_step "Cross-platform Core runtime build syntax" node --check scripts/build-core-runtimes.mjs
run_step "Cross-platform local package syntax" node --check scripts/taskbelay-local.mjs
run_step "Shared Skill reference generation" node --test scripts/sync-skill-references.test.mjs
run_step "Shared Host command generation" node --test scripts/sync-host-commands.test.mjs packages/codex/tests/windows-command.test.mjs
run_step "Cross-platform build contracts" node --test scripts/build-core-runtimes.test.mjs scripts/taskbelay-local.test.mjs
run_step "Desktop pet artwork staging syntax" node --check scripts/desktop-pet-artwork.mjs
run_step "Desktop pet artwork package contracts" node --test scripts/desktop-pet-artwork.test.mjs
run_step "Desktop pet build toolchain and diagnostics" node --test scripts/build-desktop-pet.test.mjs
run_step "Windows pet renderer simulation (no native desktop)" node --test packages/desktop-pet/windows/tests/renderer.test.cjs
run_step "npm release publisher syntax" node --check release/publish.mjs
run_step "npm release publisher behavior" node --test release/publish.test.mjs
run_step "Codex one-command release syntax" node --check scripts/release-codex.mjs
run_step "DeepSeek one-command release syntax" node --check scripts/release-deepseek.mjs
run_step "Claude one-command release syntax" node --check scripts/release-claude.mjs
run_step "ZCode one-command release syntax" node --check scripts/release-zcode.mjs
run_step "Host release preparation syntax" node --check scripts/build-host-release.mjs
run_step "Host release command and preparation contracts" node --test tests/host-release-command.test.mjs tests/host-release-prepare.test.mjs
run_step "TaskBelay one-command release syntax" node --check scripts/release-taskbelay.mjs
run_step "GitHub npm release workflow contract" node --test tests/release_workflow.test.mjs
run_step "Windows package CI failure propagation contract" node --test tests/ci_workflow.test.mjs
run_step "Fake release npm syntax" node --check packages/codex/tests/fixtures/fake-release-npm.mjs
run_step "Fake release GitHub syntax" node --check packages/codex/tests/fixtures/fake-release-gh.mjs
run_step "Codex worktree-first package and Host contracts" \
  node --test \
    packages/codex/tests/package-contract.test.mjs \
    packages/codex/tests/launcher.test.mjs \
    packages/codex/tests/skill-contract.test.mjs \
    packages/codex/tests/task-admission.test.mjs \
    packages/codex/tests/provisioning-receipt.test.mjs \
    packages/codex/tests/task-launch.test.mjs \
    packages/codex/tests/task-handoff.test.mjs
run_step "DeepSeek package and adapter contracts" \
  node --test \
    packages/deepseek/tests/package-contract.test.mjs \
    packages/deepseek/tests/bundle-contract.test.mjs \
    packages/deepseek/tests/paths.test.mjs \
    packages/deepseek/tests/macos-paths.test.mjs \
    packages/deepseek/tests/authorization.test.mjs \
    packages/deepseek/tests/integration-plugin.test.mjs \
    packages/deepseek/tests/file-scope.test.mjs \
    packages/deepseek/tests/mcp-result-gate.test.mjs \
    packages/deepseek/tests/skill-contract.test.mjs \
    packages/deepseek/tests/workspace-coordinator.test.mjs \
    packages/deepseek/tests/workspace-command.test.mjs
run_step "DeepSeek simulated graph journey" \
  node --test tests/journeys/deepseek/simulated-graph-journey.test.mjs
run_step "Shared and Codex worktree-first simulated journeys" \
  node --test \
    tests/journeys/shared/simulated-submission-contract.test.mjs \
    tests/journeys/codex/simulated-worktree-first.test.mjs
run_step "WebUI source build" pnpm run build:webui
run_step "WebUI submission and recovery simulation" pnpm --dir packages/webui test
run_step "Go package inventory" go list ./...
run_step "Go vet" go vet ./...
run_step "Go tests and repository contracts" go test -p 1 ./...
run_step "pnpm workspace inventory" pnpm --recursive list --depth -1
run_step "Codex package dry-pack" validate_package_pack packages/codex taskbelay-codex codex-source
run_step "DeepSeek package dry-pack" validate_package_pack packages/deepseek taskbelay-deepseek deepseek-source
run_step "Claude Adapter tests" node --test packages/claude/tests/*.test.mjs
run_step "ZCode Adapter tests" node --test packages/zcode/tests/*.test.mjs
run_step "TaskBelay manager and public launcher tests" node --test packages/taskbelay/tests/*.test.mjs
run_step "TaskBelay manager dry-pack" validate_package_pack packages/taskbelay @imotong/taskbelay taskbelay-source

printf '\nRepository validation passed.\n'
