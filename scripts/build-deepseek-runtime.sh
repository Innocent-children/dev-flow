#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_directory="$repository_root/packages/deepseek/runtime/darwin-arm64"
runtime_path="$runtime_directory/dev-flow"
core_version=$(sed -n '1p' "$repository_root/CORE_VERSION")
deepseek_version=$(node -e 'const m=require(process.argv[1]); if(m.name!=="dev-flow-deepseek" || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-beta\.(0|[1-9][0-9]*))?$/.test(m.version??"")) throw new Error("DeepSeek package version is invalid"); process.stdout.write(m.version)' "$repository_root/packages/deepseek/package.json")

[ -n "$core_version" ] && [ -n "$deepseek_version" ] || {
  printf '%s\n' 'build-deepseek-runtime: Core or DeepSeek version is empty' >&2
  exit 1
}

"$repository_root/scripts/build-webui.sh" >/dev/null 2>&1
mkdir -p "$runtime_directory"
(
  cd "$repository_root"
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build \
    -mod=readonly \
    -trimpath \
    -buildvcs=false \
    -ldflags "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=$core_version" \
    -o "$runtime_path" \
    ./cmd/dev-flow
)
chmod 0755 "$runtime_path"

if [ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ]; then
  reported_version=$("$runtime_path" version)
  [ "$reported_version" = "dev-flow $core_version" ] || {
    printf '%s\n' 'build-deepseek-runtime: detached Core version does not match CORE_VERSION' >&2
    exit 1
  }
else
  go version "$runtime_path" >/dev/null
fi

printf '%s\n' "$runtime_path"
