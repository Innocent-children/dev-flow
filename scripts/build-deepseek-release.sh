#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
webui_builder="$repository_root/scripts/build-webui.sh"
output_directory=""

[ -x "$webui_builder" ] || { printf '%s\n' 'build-deepseek-release: WebUI builder is unavailable' >&2; exit 1; }

if [ "${1:-}" = "--" ]; then
  shift
fi

usage() {
  printf '%s\n' 'usage: build-deepseek-release.sh --output ABSOLUTE_EMPTY_DIRECTORY' >&2
}

fail() {
  printf 'build-deepseek-release: %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      [ -z "$output_directory" ] || fail "--output may be supplied only once"
      output_directory=$2
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
[ ! -L "$output_directory" ] || fail "output directory must not be a symbolic link"
output_directory=$(CDPATH= cd -- "$output_directory" && pwd)
[ -z "$(find "$output_directory" -mindepth 1 -maxdepth 1 -print -quit)" ] || fail "output directory must be empty"
case "$output_directory/" in
  "$repository_root/"*) fail "output directory must be outside the source repository" ;;
esac

release_channel=${DEV_FLOW_RELEASE_CHANNEL:-stable}
source_branch=$(git -C "$repository_root" symbolic-ref --short HEAD 2>/dev/null || true)
[ -n "$source_branch" ] || fail "release preparation requires a named branch"
case "$release_channel" in
  stable) [ "$source_branch" = "main" ] || fail "stable release preparation requires branch main" ;;
  beta) ;;
  *) fail "release channel must equal stable or beta" ;;
esac
[ -z "$(git -C "$repository_root" status --porcelain)" ] || fail "release preparation requires a clean checkout"
[ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ] || fail "release preparation requires darwin-arm64"

source_commit=$(git -C "$repository_root" rev-parse HEAD)
source_tree=$(git -C "$repository_root" rev-parse 'HEAD^{tree}')
[ "${#source_commit}" -eq 40 ] || fail "source commit must be a complete Git identity"
[ "${#source_tree}" -eq 40 ] || fail "source tree must be a complete Git identity"
case "$source_commit$source_tree" in
  *[!0-9a-f]*) fail "source commit/tree must be lowercase Git identities" ;;
esac

core_version=$(sed -n '1p' "$repository_root/CORE_VERSION")
deepseek_version=$(node -p 'require(process.argv[1]).version' "$repository_root/packages/deepseek/package.json")
DEV_FLOW_RELEASE_CHANNEL="$release_channel" node - "$repository_root" "$deepseek_version" "$core_version" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [root, deepseekVersion, coreVersion] = process.argv.slice(2);
const stable = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const beta = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-beta\.(0|[1-9][0-9]*)$/;
const expected = process.env.DEV_FLOW_RELEASE_CHANNEL === "beta" ? beta : stable;
if (!expected.test(deepseekVersion) || !stable.test(coreVersion)) throw new Error("DeepSeek version must match the release channel and Core must be MAJOR.MINOR.PATCH");
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, "packages/deepseek/package.json"), "utf8"));
const privateContract = !Object.hasOwn(packageManifest, "private") || packageManifest.private === false;
if (
  packageManifest.name !== "dev-flow-deepseek" || packageManifest.version !== deepseekVersion ||
  !privateContract || packageManifest.license !== "Apache-2.0" ||
  JSON.stringify(packageManifest.os) !== JSON.stringify(["darwin"]) ||
  JSON.stringify(packageManifest.cpu) !== JSON.stringify(["arm64"]) ||
  packageManifest.publishConfig?.access !== "public" ||
  packageManifest.publishConfig?.registry !== "https://registry.npmjs.org/"
) {
  throw new Error("DeepSeek package/plugin or fixed public contract does not match");
}
NODE

temporary_root=$(mktemp -d -t dev-flow-deepseek-release.XXXXXX)
worktree_a="$temporary_root/worktree-a"
worktree_b="$temporary_root/worktree-b"
build_a="$temporary_root/build-a"
build_b="$temporary_root/build-b"

cleanup() {
  git -C "$repository_root" worktree remove --force "$worktree_a" >/dev/null 2>&1 || true
  git -C "$repository_root" worktree remove --force "$worktree_b" >/dev/null 2>&1 || true
  rm -rf -- "$temporary_root"
}
trap cleanup EXIT HUP INT TERM

git -C "$repository_root" worktree add --detach "$worktree_a" "$source_commit" >/dev/null 2>&1 || fail "create first clean worktree"
git -C "$repository_root" worktree add --detach "$worktree_b" "$source_commit" >/dev/null 2>&1 || fail "create second clean worktree"
mkdir "$build_a" "$build_b"

"$worktree_a/scripts/build-deepseek-runtime.sh" >/dev/null
"$worktree_b/scripts/build-deepseek-runtime.sh" >/dev/null
artifact_a="$build_a/dev-flow-deepseek-$deepseek_version.tgz"
artifact_b="$build_b/dev-flow-deepseek-$deepseek_version.tgz"
node "$worktree_a/packages/deepseek/tests/build-artifact.mjs" --output "$artifact_a" --source-commit "$source_commit" >/dev/null
node "$worktree_b/packages/deepseek/tests/build-artifact.mjs" --output "$artifact_b" --source-commit "$source_commit" >/dev/null

node --input-type=module - \
  "$repository_root/release/prepare.mjs" \
  "$repository_root" \
  "$source_commit" \
  "$source_tree" \
  "$artifact_a" \
  "$artifact_b" \
  "$output_directory" <<'NODE'
import { pathToFileURL } from "node:url";
const [modulePath, repositoryRoot, sourceCommit, sourceTree, firstTarball, secondTarball, outputDirectory] = process.argv.slice(2);
const { prepareRelease } = await import(pathToFileURL(modulePath).href);
const result = await prepareRelease({
  product: "deepseek",
  repositoryRoot,
  sourceCommit,
  sourceTree,
  firstTarball,
  secondTarball,
  outputDirectory,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
