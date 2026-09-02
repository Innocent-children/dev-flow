#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec node "$repository_root/scripts/build-core-runtimes.mjs" \
  --output "$repository_root/packages/deepseek/runtime"
