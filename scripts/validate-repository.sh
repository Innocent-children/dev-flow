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
  pack_output=$(pnpm --dir "$package_dir" pack --dry-run --json)

  PACK_OUTPUT="$pack_output" EXPECTED_PACKAGE_NAME="$expected_package_name" node <<'NODE'
const report = JSON.parse(process.env.PACK_OUTPUT);
const packed = Array.isArray(report) ? report[0] : report;
if (!packed || packed.name !== process.env.EXPECTED_PACKAGE_NAME) {
  throw new Error(`unexpected dry-pack package: ${packed?.name ?? "missing"}`);
}

const files = (packed.files ?? [])
  .map((file) => typeof file === "string" ? file : file.path ?? file.name)
  .sort();
const expectedFiles = ["LICENSE", "README.md", "package.json"];
if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
  throw new Error(`${packed.name} dry-pack files ${JSON.stringify(files)}; expected ${JSON.stringify(expectedFiles)}`);
}
NODE
}

run_step "Toolchain versions" check_toolchains
run_step "Git whitespace" git diff --check
run_step "Go formatting" check_go_formatting
run_step "Go vet" go vet ./...
run_step "Go tests and repository contracts" go test ./...
run_step "Frozen pnpm workspace install" pnpm install --frozen-lockfile
run_step "pnpm workspace inventory" pnpm --recursive list --depth -1
run_step "Codex package dry-pack" validate_package_pack packages/codex dev-flow-codex
run_step "DeepSeek package dry-pack" validate_package_pack packages/deepseek dev-flow-deepseek

printf '\nRepository validation passed.\n'
