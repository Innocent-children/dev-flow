#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_directory="$repository_root/packages/deepseek/runtime/darwin-arm64"
runtime_path="$runtime_directory/dev-flow"
version=$(sed -n '1p' "$repository_root/VERSION")

[ -n "$version" ] || {
  printf '%s\n' 'build-deepseek-runtime: repository VERSION is empty' >&2
  exit 1
}

mkdir -p "$runtime_directory"
(
  cd "$repository_root"
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build \
    -mod=readonly \
    -trimpath \
    -buildvcs=false \
    -ldflags "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=$version" \
    -o "$runtime_path" \
    ./cmd/dev-flow
)
chmod 0755 "$runtime_path"

if [ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ]; then
  reported_version=$("$runtime_path" version)
  [ "$reported_version" = "dev-flow $version" ] || {
    printf '%s\n' 'build-deepseek-runtime: detached Core version does not match VERSION' >&2
    exit 1
  }
else
  go version "$runtime_path" >/dev/null
fi

printf '%s\n' "$runtime_path"
