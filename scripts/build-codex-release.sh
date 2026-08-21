#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
output_directory=""

if [ "${1:-}" = "--" ]; then
  shift
fi

usage() {
  printf '%s\n' 'usage: build-codex-release.sh --output ABSOLUTE_EMPTY_DIRECTORY' >&2
}

fail() {
  printf 'build-codex-release: %s\n' "$1" >&2
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

[ "$(git -C "$repository_root" symbolic-ref --short HEAD 2>/dev/null || true)" = "main" ] || fail "release preparation requires branch main"
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
codex_version=$(node -p 'require(process.argv[1]).version' "$repository_root/packages/codex/package.json")
node - "$repository_root" "$codex_version" "$core_version" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [root, codexVersion, coreVersion] = process.argv.slice(2);
if (![codexVersion, coreVersion].every((value) => /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value))) {
  throw new Error("Codex and Core versions must be strict MAJOR.MINOR.PATCH");
}
const packageManifest = JSON.parse(fs.readFileSync(path.join(root, "packages/codex/package.json"), "utf8"));
const pluginManifest = JSON.parse(fs.readFileSync(path.join(root, "packages/codex/plugin/.codex-plugin/plugin.json"), "utf8"));
const privateContract = !Object.hasOwn(packageManifest, "private") || packageManifest.private === false;
if (
  packageManifest.name !== "dev-flow-codex" || packageManifest.version !== codexVersion ||
  pluginManifest.name !== "dev-flow-codex" || pluginManifest.version !== codexVersion ||
  !privateContract || packageManifest.license !== "Apache-2.0" ||
  JSON.stringify(packageManifest.os) !== JSON.stringify(["darwin"]) ||
  JSON.stringify(packageManifest.cpu) !== JSON.stringify(["arm64"]) ||
  packageManifest.publishConfig?.access !== "public" ||
  packageManifest.publishConfig?.registry !== "https://registry.npmjs.org/"
) {
  throw new Error("Codex package/plugin or fixed public contract does not match");
}
NODE

temporary_root=$(mktemp -d -t dev-flow-codex-release.XXXXXX)
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

build_report_a=$("$worktree_a/scripts/build-codex-local.sh" --output "$build_a")
build_report_b=$("$worktree_b/scripts/build-codex-local.sh" --output "$build_b")
artifact_a=$(BUILD_REPORT="$build_report_a" node -e 'const v=JSON.parse(process.env.BUILD_REPORT); if(v.source_dirty||v.source_commit!==process.argv[1]) throw new Error("first build source mismatch"); process.stdout.write(v.artifact_path);' "$source_commit")
artifact_b=$(BUILD_REPORT="$build_report_b" node -e 'const v=JSON.parse(process.env.BUILD_REPORT); if(v.source_dirty||v.source_commit!==process.argv[1]) throw new Error("second build source mismatch"); process.stdout.write(v.artifact_path);' "$source_commit")

node --input-type=module - \
  "$repository_root/scripts/verify-codex-release.mjs" \
  "$repository_root" \
  "$source_commit" \
  "$source_tree" \
  "$artifact_a" \
  "$artifact_b" \
  "$output_directory" <<'NODE'
import { pathToFileURL } from "node:url";
const [modulePath, repositoryRoot, sourceCommit, sourceTree, firstTarball, secondTarball, outputDirectory] = process.argv.slice(2);
const { prepareRelease } = await import(pathToFileURL(modulePath).href);
const verificationMode = process.env.DEV_FLOW_RELEASE_MODE || "normal";
const basedOnRelease = process.env.DEV_FLOW_BASED_ON_RELEASE || "v0.5.0";
const result = await prepareRelease({
  repositoryRoot,
  sourceCommit,
  sourceTree,
  firstTarball,
  secondTarball,
  outputDirectory,
  verificationMode,
  basedOnRelease,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
NODE
