#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
darwin_runtime_directory="$repository_root/packages/deepseek/runtime/darwin-arm64"
darwin_runtime_path="$darwin_runtime_directory/dev-flow"
windows_runtime_directory="$repository_root/packages/deepseek/runtime/win32-x64"
windows_runtime_path="$windows_runtime_directory/dev-flow.exe"
core_version=$(sed -n '1p' "$repository_root/CORE_VERSION")
deepseek_version=$(node -e 'const m=require(process.argv[1]); if(m.name!=="dev-flow-deepseek" || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-beta\.(0|[1-9][0-9]*))?$/.test(m.version??"")) throw new Error("DeepSeek package version is invalid"); process.stdout.write(m.version)' "$repository_root/packages/deepseek/package.json")

[ -n "$core_version" ] && [ -n "$deepseek_version" ] || {
  printf '%s\n' 'build-deepseek-runtime: Core or DeepSeek version is empty' >&2
  exit 1
}

"$repository_root/scripts/build-webui.sh" >/dev/null 2>&1
mkdir -p "$darwin_runtime_directory" "$windows_runtime_directory"
(
  cd "$repository_root"
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build \
    -mod=readonly \
    -trimpath \
    -buildvcs=false \
    -ldflags "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=$core_version" \
    -o "$darwin_runtime_path" \
    ./cmd/dev-flow
)
chmod 0755 "$darwin_runtime_path"
(
  cd "$repository_root"
  CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build \
    -mod=readonly \
    -trimpath \
    -buildvcs=false \
    -ldflags "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=$core_version" \
    -o "$windows_runtime_path" \
    ./cmd/dev-flow
)
chmod 0755 "$windows_runtime_path"

if [ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ]; then
  reported_version=$("$darwin_runtime_path" version)
  [ "$reported_version" = "dev-flow $core_version" ] || {
    printf '%s\n' 'build-deepseek-runtime: detached Core version does not match CORE_VERSION' >&2
    exit 1
  }
else
  go version -m "$darwin_runtime_path" >/dev/null
fi
darwin_build_metadata=$(go version -m "$darwin_runtime_path")
windows_build_metadata=$(go version -m "$windows_runtime_path")
printf '%s\n' "$darwin_build_metadata" | grep -Eq '[[:space:]]build[[:space:]]GOOS=darwin$' || {
  printf '%s\n' 'build-deepseek-runtime: darwin Core GOOS metadata is invalid' >&2
  exit 1
}
printf '%s\n' "$darwin_build_metadata" | grep -Eq '[[:space:]]build[[:space:]]GOARCH=arm64$' || {
  printf '%s\n' 'build-deepseek-runtime: darwin Core GOARCH metadata is invalid' >&2
  exit 1
}
printf '%s\n' "$windows_build_metadata" | grep -Eq '[[:space:]]build[[:space:]]GOOS=windows$' || {
  printf '%s\n' 'build-deepseek-runtime: Windows Core GOOS metadata is invalid' >&2
  exit 1
}
printf '%s\n' "$windows_build_metadata" | grep -Eq '[[:space:]]build[[:space:]]GOARCH=amd64$' || {
  printf '%s\n' 'build-deepseek-runtime: Windows Core GOARCH metadata is invalid' >&2
  exit 1
}

printf '%s\n' "$darwin_runtime_path" "$windows_runtime_path"
