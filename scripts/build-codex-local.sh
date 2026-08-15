#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_directory=""
final_artifact=false
expected_source_commit=""

usage() {
  printf '%s\n' 'usage: build-codex-local.sh --output ABSOLUTE_DIRECTORY [--final --source-commit GIT_SHA]' >&2
}

fail() {
  printf 'build-codex-local: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      output_directory=$2
      shift 2
      ;;
    --final)
      final_artifact=true
      shift
      ;;
    --source-commit)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      expected_source_commit=$2
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

[ -n "$output_directory" ] || { usage; exit 2; }
case "$output_directory" in
  /*) ;;
  *) fail "output directory must be absolute" ;;
esac
[ -d "$output_directory" ] || fail "output directory must already exist"
output_directory=$(CDPATH= cd -- "$output_directory" && pwd)

existing_artifact=""
for candidate in "$output_directory"/*.tgz; do
  if [ -e "$candidate" ]; then
    existing_artifact=$candidate
    break
  fi
done
[ -z "$existing_artifact" ] || fail "output directory already contains a .tgz artifact"

source_commit=$(git -C "$repository_root" rev-parse HEAD)
case "$source_commit" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;;
  *) fail "could not resolve the source commit" ;;
esac

source_dirty=false
if [ -n "$(git -C "$repository_root" status --porcelain)" ]; then
  source_dirty=true
fi
if [ "$final_artifact" = true ]; then
  [ "$source_dirty" = false ] || fail "final artifact requires a clean frozen source tree"
  [ -n "$expected_source_commit" ] || fail "final artifact requires --source-commit"
  [ "$expected_source_commit" = "$source_commit" ] || fail "requested source commit does not equal HEAD"
elif [ -n "$expected_source_commit" ]; then
  fail "--source-commit is valid only with --final"
fi

version=$(sed -n '1p' "$repository_root/VERSION")
[ -n "$version" ] || fail "repository VERSION is empty"

node - "$repository_root" "$version" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [root, version] = process.argv.slice(2);
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, "packages/codex/package.json"), "utf8"));
const pluginManifest = JSON.parse(fs.readFileSync(path.join(root, "packages/codex/plugin/.codex-plugin/plugin.json"), "utf8"));
if (packageManifest.name !== "dev-flow-codex" || packageManifest.private !== true) {
  throw new Error("Codex package identity must be private dev-flow-codex");
}
if (packageManifest.version !== version || pluginManifest.version !== version) {
  throw new Error("repository, package, and plugin versions must match");
}
NODE

build_root=$(mktemp -d -t dev-flow-codex-build.XXXXXX)
trap 'rm -rf -- "$build_root"' EXIT HUP INT TERM
stage_root="$build_root/package"
mkdir -p "$stage_root/runtime/darwin-arm64"

production_files='package.json
README.md
.agents/plugins/marketplace.json
bin/dev-flow-codex.mjs
lib/lifecycle.mjs
lib/paths.mjs
plugin/.codex-plugin/plugin.json
plugin/.mcp.json
plugin/skills/dev-flow/SKILL.md'

printf '%s\n' "$production_files" | while IFS= read -r relative_path; do
  [ -n "$relative_path" ] || continue
  source_path="$repository_root/packages/codex/$relative_path"
  [ -f "$source_path" ] || fail "required production file is missing: $relative_path"
  mkdir -p "$stage_root/$(dirname -- "$relative_path")"
  cp "$source_path" "$stage_root/$relative_path"
done
cp "$repository_root/LICENSE" "$stage_root/LICENSE"
chmod 0755 "$stage_root/bin/dev-flow-codex.mjs"

(
  cd "$repository_root"
  CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build \
    -mod=readonly \
    -trimpath \
    -buildvcs=false \
    -ldflags "-s -w -X github.com/Innocent-children/dev-flow/internal/version.buildVersion=$version" \
    -o "$stage_root/runtime/darwin-arm64/dev-flow" \
    ./cmd/dev-flow
)
chmod 0755 "$stage_root/runtime/darwin-arm64/dev-flow"

if [ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ]; then
  core_version=$(
    cd "$build_root"
    "$stage_root/runtime/darwin-arm64/dev-flow" version
  )
  [ "$core_version" = "dev-flow $version" ] || fail "detached Core version does not match repository VERSION"
else
  go version "$stage_root/runtime/darwin-arm64/dev-flow" >/dev/null
fi

pack_report=$(pnpm --config.ignore-scripts=true --dir "$stage_root" pack --dry-run --json)
PACK_REPORT=$pack_report node <<'NODE'
const packed = JSON.parse(process.env.PACK_REPORT);
const report = Array.isArray(packed) ? packed[0] : packed;
const actual = (report.files ?? [])
  .map((entry) => typeof entry === "string" ? entry : entry.path ?? entry.name)
  .sort();
const expected = [
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
  "runtime/darwin-arm64/dev-flow",
].sort();
if (report.name !== "dev-flow-codex" || JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`unexpected staged pack contents: ${JSON.stringify(actual)}`);
}
NODE

artifact_path="$output_directory/dev-flow-codex-$version.tgz"
find "$stage_root" -exec touch -t 198510260815.00 {} +
(
  cd "$build_root"
  find package -type f -print | LC_ALL=C sort | COPYFILE_DISABLE=1 tar \
    -cf "$build_root/dev-flow-codex.tar" \
    --format ustar \
    --uid 0 \
    --gid 0 \
    --uname root \
    --gname root \
    -T -
)
gzip -n -c "$build_root/dev-flow-codex.tar" >"$artifact_path"
[ -f "$artifact_path" ] || fail "archive creation did not produce the expected artifact"

if command -v shasum >/dev/null 2>&1; then
  artifact_sha256=$(shasum -a 256 "$artifact_path" | awk '{print $1}')
elif command -v sha256sum >/dev/null 2>&1; then
  artifact_sha256=$(sha256sum "$artifact_path" | awk '{print $1}')
else
  fail "a SHA-256 utility is required"
fi

ARTIFACT_PATH=$artifact_path \
ARTIFACT_SHA256=$artifact_sha256 \
PACKAGE_VERSION=$version \
SOURCE_COMMIT=$source_commit \
SOURCE_DIRTY=$source_dirty \
FINAL_ARTIFACT=$final_artifact \
node <<'NODE'
process.stdout.write(`${JSON.stringify({
  artifact_path: process.env.ARTIFACT_PATH,
  artifact_sha256: process.env.ARTIFACT_SHA256,
  package_version: process.env.PACKAGE_VERSION,
  core_version: process.env.PACKAGE_VERSION,
  source_commit: process.env.SOURCE_COMMIT,
  source_dirty: process.env.SOURCE_DIRTY === "true",
  final_artifact: process.env.FINAL_ARTIFACT === "true",
  platform: "darwin-arm64",
})}\n`);
NODE
