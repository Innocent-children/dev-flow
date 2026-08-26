#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export LC_ALL=C
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-0}"
export TZ=UTC

if [ ! -d "$repository_root/packages/webui/node_modules" ]; then
  pnpm --dir "$repository_root" install --frozen-lockfile --ignore-scripts
fi
pnpm --dir "$repository_root" --filter @dev-flow/webui run build
