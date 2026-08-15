#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fake_host=false
through_stage=""

usage() {
  printf '%s\n' 'usage: run-codex-real-journey.sh --fake-host --through setup' >&2
}

fail() {
  printf 'run-codex-real-journey: %s\n' "$1" >&2
  exit 1
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    fail "a SHA-256 utility is required"
  fi
}

directory_fingerprint() {
  node - "$1" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const hash = crypto.createHash("sha256");
function visit(directory, prefix = "") {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    const info = fs.lstatSync(absolute);
    hash.update(`${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l" : "f"}:${relative}:${info.mode & 0o777}\0`);
    if (entry.isDirectory()) visit(absolute, relative);
    else if (entry.isSymbolicLink()) hash.update(fs.readlinkSync(absolute));
    else hash.update(fs.readFileSync(absolute));
  }
}
visit(root);
process.stdout.write(hash.digest("hex"));
NODE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --fake-host)
      fake_host=true
      shift
      ;;
    --through)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      through_stage=$2
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

[ "$fake_host" = true ] || fail "real Codex is disabled before the frozen-artifact native journey"
[ "$through_stage" = setup ] || fail "this deterministic slice supports only --through setup"
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || fail "fake setup integration requires darwin-arm64"
node --test "$repository_root/packages/codex/tests/skill-contract.test.mjs" >/dev/null

journey_root=$(mktemp -d -t dev-flow-codex-fake-setup.XXXXXX)
trap 'rm -rf -- "$journey_root"' EXIT HUP INT TERM
artifact_directory="$journey_root/artifacts"
install_prefix="$journey_root/install prefix-安装"
fake_bin="$journey_root/fake host bin"
fake_state="$journey_root/fake-host/state.json"
fake_trace="$journey_root/fake-host/trace.jsonl"
fake_home="$journey_root/home"
target_repository="$journey_root/target repository-仓库"
native_evidence="$repository_root/tests/journeys/evidence/codex-macos-arm64.json"
mkdir -p "$artifact_directory" "$install_prefix" "$fake_bin" "$fake_home" "$target_repository"

evidence_before=absent
if [ -f "$native_evidence" ]; then
  evidence_before=$(sha256_file "$native_evidence")
fi

build_report=$(
  "$repository_root/scripts/build-codex-local.sh" --output "$artifact_directory"
)
artifact_path=$(BUILD_REPORT=$build_report node -e 'process.stdout.write(JSON.parse(process.env.BUILD_REPORT).artifact_path)')
artifact_digest=$(BUILD_REPORT=$build_report node -e 'process.stdout.write(JSON.parse(process.env.BUILD_REPORT).artifact_sha256)')
source_commit=$(BUILD_REPORT=$build_report node -e 'process.stdout.write(JSON.parse(process.env.BUILD_REPORT).source_commit)')

npm install \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  --prefix "$install_prefix" \
  "$artifact_path" >/dev/null

launcher="$install_prefix/node_modules/.bin/dev-flow-codex"
installed_package="$install_prefix/node_modules/dev-flow-codex"
[ -x "$launcher" ] || fail "artifact installation did not expose dev-flow-codex"
[ -x "$installed_package/runtime/darwin-arm64/dev-flow" ] || fail "installed packaged Core is not executable"

ln -s "$repository_root/packages/codex/tests/fixtures/fake-codex.mjs" "$fake_bin/codex"
(
  cd "$target_repository"
  git init -q
  printf '%s\n' 'fake-host repository boundary' >README.md
  git add README.md
  git -c user.name='Dev Flow Test' -c user.email='dev-flow@example.invalid' commit -qm 'fixture baseline'
)
repository_before=$(directory_fingerprint "$target_repository")

export HOME=$fake_home
export PATH="$fake_bin:$install_prefix/node_modules/.bin:$PATH"
export FAKE_CODEX_STATE=$fake_state
export FAKE_CODEX_TRACE=$fake_trace
export FAKE_CODEX_VERSION=0.147.0

setup_result=$(
  cd "$target_repository"
  "$launcher" setup --json
)
marketplace_readback=$(
  cd "$target_repository"
  "$fake_bin/codex" plugin marketplace list --json
)
plugin_readback=$(
  cd "$target_repository"
  "$fake_bin/codex" plugin list --json
)
repository_after=$(directory_fingerprint "$target_repository")
[ "$repository_before" = "$repository_after" ] || fail "setup changed the target repository"

receipt_path="$fake_home/Library/Application Support/dev-flow/registrations/codex.json"
[ -f "$receipt_path" ] || fail "setup did not write the isolated registration receipt"

evidence_after=absent
if [ -f "$native_evidence" ]; then
  evidence_after=$(sha256_file "$native_evidence")
fi
[ "$evidence_before" = "$evidence_after" ] || fail "fake checkpoint changed native evidence"

BUILD_REPORT=$build_report \
SETUP_RESULT=$setup_result \
MARKETPLACE_READBACK=$marketplace_readback \
PLUGIN_READBACK=$plugin_readback \
REPOSITORY_BEFORE=$repository_before \
REPOSITORY_AFTER=$repository_after \
FAKE_TRACE=$fake_trace \
RECEIPT_PATH=$receipt_path \
ARTIFACT_DIGEST=$artifact_digest \
SOURCE_COMMIT=$source_commit \
node <<'NODE'
const fs = require("node:fs");
const build = JSON.parse(process.env.BUILD_REPORT);
const setup = JSON.parse(process.env.SETUP_RESULT);
const marketplaces = JSON.parse(process.env.MARKETPLACE_READBACK);
const plugins = JSON.parse(process.env.PLUGIN_READBACK);
const trace = fs.readFileSync(process.env.FAKE_TRACE, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse);
if (setup.operation !== "setup" || setup.status !== "installed" || setup.changed !== true) {
  throw new Error("fake setup result is not a verified installation");
}
if (marketplaces.length !== 1 || marketplaces[0].name !== "dev-flow-local") {
  throw new Error("fake marketplace readback is not exact");
}
if (plugins.length !== 1 || plugins[0].selector !== "dev-flow-codex@dev-flow-local") {
  throw new Error("fake plugin readback is not exact");
}
process.stdout.write(`${JSON.stringify({
  checkpoint_version: 1,
  classification: "simulated",
  through_stage: "setup",
  real_codex_started: false,
  native_evidence_written: false,
  source_commit: process.env.SOURCE_COMMIT,
  artifact_sha256: process.env.ARTIFACT_DIGEST,
  artifact_final: build.final_artifact,
  repository: {
    before_sha256: process.env.REPOSITORY_BEFORE,
    after_setup_sha256: process.env.REPOSITORY_AFTER,
    unchanged: process.env.REPOSITORY_BEFORE === process.env.REPOSITORY_AFTER,
  },
  registration: {
    setup_status: setup.status,
    marketplace_count: marketplaces.length,
    plugin_count: plugins.length,
    receipt_path: process.env.RECEIPT_PATH,
  },
  fresh_session_markers: ["fresh-session-open", "fresh-session-closed"],
  invocation_checks: [
    { kind: "ordinary", classification: "static-skill-contract", dev_flow_calls: 0 },
    { kind: "empty-explicit", classification: "static-skill-contract", dev_flow_calls: 0 },
    { kind: "non-git-explicit", classification: "static-skill-contract", dev_flow_calls: 0 },
  ],
  fake_codex_calls: trace.map((entry) => ({ argv: entry.argv, cwd: entry.cwd })),
})}\n`);
NODE
