#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
fixture_root="$repository_root/tests/contract/testdata/codex-0.147"

usage() {
  printf '%s\n' \
    'usage: run-codex-real-journey.sh --fixture success|core-domain-error|transport-error' \
    '   or: run-codex-real-journey.sh --smoke --codex-executable ABS --workspace ABS' \
    '   or: run-codex-real-journey.sh --development-smoke --run-label A|B|C|D --codex-executable ABS --result-directory ABS' \
    '   or: run-codex-real-journey.sh --acceptance --codex-executable ABS --workspace ABS' \
    '   or: run-codex-real-journey.sh --final-local-lifecycle --artifact ABS.tgz --artifact-sha256 SHA256 --artifact-size BYTES --core-sha256 SHA256 --source-commit COMMIT --native-result-directory ABS --workspace ABS --result-directory ABS' \
    '   or: run-codex-real-journey.sh --final-local --artifact ABS.tgz --artifact-sha256 SHA256 --artifact-size BYTES --source-commit COMMIT --codex-executable ABS --workspace ABS --result-directory ABS --native-attempt 3 --authorization explicit_user_authorization' \
    '   or: run-codex-real-journey.sh --final-registry --package dev-flow-codex --version CODEX_VERSION --registry https://registry.npmjs.org/ --tarball-sha256 SHA256 --core-sha256 SHA256 --source-commit COMMIT --codex-executable ABS --workspace ABS --result-directory ABS' \
    '   or: run-codex-real-journey.sh --quick-registry --package dev-flow-codex --version CODEX_VERSION --registry https://registry.npmjs.org/ --tarball-sha256 SHA256 --core-sha256 SHA256 --source-commit COMMIT --codex-executable ABS --workspace ABS --result-directory ABS' >&2
}

if [ "$#" -eq 2 ] && [ "$1" = "--fixture" ]; then
  case "$2" in
    success)
      fixture="$fixture_root/success.jsonl"
      ;;
    core-domain-error)
      fixture="$fixture_root/core-domain-error.jsonl"
      ;;
    transport-error)
      fixture="$fixture_root/transport-error.jsonl"
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  exec node "$script_dir/validate-codex-journey-evidence.mjs" "$fixture"
fi

if [ "$#" -eq 5 ] && { [ "$1" = "--smoke" ] || [ "$1" = "--acceptance" ]; }; then
  mode=${1#--}
  shift
  exec node "$script_dir/write-codex-journey-evidence.mjs" "$mode" "$@"
fi

if [ "$#" -eq 7 ] && [ "$1" = "--development-smoke" ]; then
  shift
  exec node "$script_dir/write-codex-journey-evidence.mjs" development-smoke "$@"
fi

if [ "$#" -eq 19 ] && { [ "$1" = "--final-registry" ] || [ "$1" = "--quick-registry" ]; }; then
  mode=${1#--}
  shift
  exec node "$script_dir/write-codex-journey-evidence.mjs" "$mode" "$@"
fi

if [ "$#" -eq 17 ] && [ "$1" = "--final-local-lifecycle" ]; then
  shift
  exec node "$script_dir/write-codex-journey-evidence.mjs" final-local-lifecycle "$@"
fi

if [ "$#" -eq 19 ] && [ "$1" = "--final-local" ]; then
  shift
  exec node "$script_dir/write-codex-journey-evidence.mjs" final-local "$@"
fi

usage
exit 2
