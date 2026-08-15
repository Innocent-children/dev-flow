#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

if [ "${1-}" = "--fake-host" ]; then
  exec "${NODE:-node}" "$REPOSITORY_ROOT/packages/deepseek/tests/fixtures/fake-profile-journey.mjs" "$@"
fi

printf '%s\n' 'dev-flow-deepseek: native Harness execution is closed at the 003 merge barrier' >&2
exit 2
