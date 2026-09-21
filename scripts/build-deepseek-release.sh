#!/bin/sh
set -eu
repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "${1:-}" = "--" ]; then shift; fi
exec node "$repository_root/scripts/build-host-release.mjs" --product deepseek "$@"
