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

validate_codex_source_tree() {
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = "packages/codex";
const expectedFiles = [
  ".agents/plugins/marketplace.json",
  "LICENSE",
  "README.md",
  "bin/dev-flow-codex.mjs",
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "tests/fake-core-contract.test.mjs",
  "tests/fixtures/fake-codex.mjs",
  "tests/fixtures/fake-core.mjs",
  "tests/fixtures/fake-native-tool.mjs",
  "tests/fixtures/fake-release-gh.mjs",
  "tests/fixtures/fake-release-npm.mjs",
  "tests/fixtures/graph-method-profiles.json",
  "tests/journey-evidence.test.mjs",
  "tests/journey-harness.test.mjs",
  "tests/launcher.test.mjs",
  "tests/lifecycle.test.mjs",
  "tests/package-contract.test.mjs",
  "tests/paths.test.mjs",
  "tests/removal-retention.test.mjs",
  "tests/release-command.test.mjs",
  "tests/release-package.test.mjs",
  "tests/release-publication.test.mjs",
  "tests/skill-contract.test.mjs",
].sort();

function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, relative));
    else files.push(relative);
  }
  return files;
}

const actualFiles = listFiles(packageRoot).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`Codex source files ${JSON.stringify(actualFiles)}; expected ${JSON.stringify(expectedFiles)}`);
}
NODE
}

validate_deepseek_source_tree() {
  node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = "packages/deepseek";
const expectedFiles = [
  "README.md",
  "cordis.patch.yml",
  "lib/authorization.mjs",
  "lib/index.mjs",
  "lib/paths.mjs",
  "lib/runtime.mjs",
  "lib/tool-names.mjs",
  "package.json",
  "runtime/darwin-arm64/dev-flow",
  "skills/dev-flow/SKILL.md",
  "skills/dev-flow/references/method-profiles.md",
  "skills/dev-flow/references/node-payloads.md",
  "tests/authorization.test.mjs",
  "tests/bundle-contract.test.mjs",
  "tests/integration-plugin.test.mjs",
  "tests/mcp-result-gate.test.mjs",
  "tests/package-contract.test.mjs",
  "tests/paths.test.mjs",
  "tests/skill-contract.test.mjs",
].sort();

function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, relative));
    else files.push(relative);
  }
  return files;
}

const actualFiles = listFiles(packageRoot).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`DeepSeek source files ${JSON.stringify(actualFiles)}; expected ${JSON.stringify(expectedFiles)}`);
}
NODE
}

validate_root_script_tree() {
  node <<'NODE'
const fs = require("node:fs");

const expectedFiles = [
  "README.md",
  "build-codex-local.sh",
  "build-codex-release.sh",
  "build-deepseek-runtime.sh",
  "publish-codex-release.mjs",
  "release-codex.mjs",
  "run-codex-real-journey.sh",
  "validate-codex-journey-evidence.mjs",
  "verify-codex-release.mjs",
  "validate-repository.sh",
  "write-codex-journey-evidence.mjs",
].sort();
const entries = fs.readdirSync("scripts", { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (directories.length !== 0) {
  throw new Error(`unexpected root script directories: ${JSON.stringify(directories)}`);
}
const actualFiles = entries.map((entry) => entry.name).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`root script files ${JSON.stringify(actualFiles)}; expected ${JSON.stringify(expectedFiles)}`);
}
NODE
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
  "lib/lifecycle.mjs",
  "lib/paths.mjs",
  "package.json",
  "plugin/.codex-plugin/plugin.json",
  "plugin/.mcp.json",
  "plugin/skills/dev-flow/SKILL.md",
  "plugin/skills/dev-flow/agents/openai.yaml",
  "plugin/skills/dev-flow/references/method-profiles.md",
  "plugin/skills/dev-flow/references/node-payloads.md",
  "runtime/darwin-arm64/dev-flow",
].sort();
const expectedByProfile = {
  "codex-source": codexFinalStagingFiles.filter((file) => file !== "runtime/darwin-arm64/dev-flow"),
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
run_step "Working tree whitespace" git diff --check
run_step "Go formatting" check_go_formatting
run_step "Codex source allowlist" validate_codex_source_tree
run_step "DeepSeek source allowlist" validate_deepseek_source_tree
run_step "Root script allowlist" validate_root_script_tree
run_step "Codex release prepare syntax" bash -n scripts/build-codex-release.sh
run_step "Codex release verifier syntax" node --check scripts/verify-codex-release.mjs
run_step "Codex release publisher syntax" node --check scripts/publish-codex-release.mjs
run_step "Codex one-command release syntax" node --check scripts/release-codex.mjs
run_step "Fake release npm syntax" node --check packages/codex/tests/fixtures/fake-release-npm.mjs
run_step "Fake release GitHub syntax" node --check packages/codex/tests/fixtures/fake-release-gh.mjs
run_step "Release contract tests" go test ./tests/contract
run_step "Codex public package contract" node --test packages/codex/tests/package-contract.test.mjs
run_step "DeepSeek public package contract" node --test packages/deepseek/tests/package-contract.test.mjs
run_step "DeepSeek bundle contract" node --test packages/deepseek/tests/bundle-contract.test.mjs
run_step "Codex one-command release contract" node --test packages/codex/tests/release-command.test.mjs
run_step "Go package inventory" go list ./...
run_step "Go vet" go vet ./...
run_step "Go tests and repository contracts" go test ./...
run_step "Frozen pnpm workspace install" pnpm install --frozen-lockfile --ignore-scripts
run_step "pnpm workspace inventory" pnpm --recursive list --depth -1
run_step "Codex package dry-pack" validate_package_pack packages/codex dev-flow-codex codex-source

printf '\nRepository validation passed.\n'
