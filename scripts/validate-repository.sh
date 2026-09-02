#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repository_root"

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
  "bin/dev-flow-codex.mjs",
  "lib/command.mjs",
  "lib/install-experience.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "lib/platform.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/hooks/hooks.json",
  "plugin/hooks/pre-tool-use.mjs",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
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
  "lib/runtime.mjs",
  "lib/tool-names.mjs",
  "package.json",
  "runtime/darwin-arm64/dev-flow",
  "runtime/win32-x64/dev-flow.exe",
  "skills/dev-flow/SKILL.md",
  "skills/dev-flow/references/method-profiles.md",
  "skills/dev-flow/references/node-payloads.md",
].sort();
const expectedByProfile = {
  "codex-source": codexFinalStagingFiles.filter((file) => !file.startsWith("runtime/")),
  "deepseek-source": deepseekFinalStagingFiles.filter((file) => !file.startsWith("runtime/")),
  "dev-flow-source": [
    "LICENSE",
    "README.md",
    "bin/dev-flow.mjs",
    "lib/cli.mjs",
    "lib/command.mjs",
    "lib/hosts/codex.mjs",
    "lib/hosts/deepseek.mjs",
    "lib/journal.mjs",
    "lib/lifecycle.mjs",
    "lib/ownership.mjs",
    "lib/platform.mjs",
    "lib/plan.mjs",
    "lib/presentation.mjs",
    "lib/runtime.mjs",
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
run_step "Cross-platform local package syntax" node --check scripts/dev-flow-local.mjs
run_step "Cross-platform build contracts" node --test scripts/build-core-runtimes.test.mjs scripts/dev-flow-local.test.mjs
run_step "npm release publisher syntax" node --check release/publish.mjs
run_step "npm release publisher behavior" node --test release/publish.test.mjs
run_step "Codex one-command release syntax" node --check scripts/release-codex.mjs
run_step "DeepSeek one-command release syntax" node --check scripts/release-deepseek.mjs
run_step "Dev Flow one-command release syntax" node --check scripts/release-dev-flow.mjs
run_step "GitHub npm release workflow contract" node --test tests/release_workflow.test.mjs
run_step "Fake release npm syntax" node --check packages/codex/tests/fixtures/fake-release-npm.mjs
run_step "Fake release GitHub syntax" node --check packages/codex/tests/fixtures/fake-release-gh.mjs
run_step "Codex public package contract" node --test packages/codex/tests/package-contract.test.mjs
run_step "Codex launcher command contract" node --test packages/codex/tests/launcher.test.mjs
run_step "DeepSeek package and adapter contracts" \
  node --test \
    packages/deepseek/tests/package-contract.test.mjs \
    packages/deepseek/tests/bundle-contract.test.mjs \
    packages/deepseek/tests/paths.test.mjs \
    packages/deepseek/tests/authorization.test.mjs \
    packages/deepseek/tests/integration-plugin.test.mjs \
    packages/deepseek/tests/mcp-result-gate.test.mjs \
    packages/deepseek/tests/skill-contract.test.mjs
run_step "DeepSeek simulated graph journey" \
  node --test tests/journeys/deepseek/simulated-graph-journey.test.mjs
run_step "Go package inventory" go list ./...
run_step "Go vet" go vet ./...
run_step "Go tests and repository contracts" go test -p 1 ./...
run_step "pnpm workspace inventory" pnpm --recursive list --depth -1
run_step "Codex package dry-pack" validate_package_pack packages/codex dev-flow-codex codex-source
run_step "DeepSeek package dry-pack" validate_package_pack packages/deepseek dev-flow-deepseek deepseek-source
run_step "Dev Flow manager and public launcher tests" node --test packages/dev-flow/tests/*.test.mjs
run_step "Dev Flow manager dry-pack" validate_package_pack packages/dev-flow @imotong/dev-flow dev-flow-source

printf '\nRepository validation passed.\n'
