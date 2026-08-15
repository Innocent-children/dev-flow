#!/bin/sh

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fake_host=false
through_stage=""

usage() {
  printf '%s\n' 'usage: run-codex-real-journey.sh --fake-host --through setup|done|remove' >&2
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

directory_manifest() {
  node - "$1" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const files = [];
function visit(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else {
      files.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        sha256: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
      });
    }
  }
}
visit(root);
const manifest = files.map((entry) => `${entry.sha256}  ${entry.path}\n`).join("");
process.stdout.write(JSON.stringify({
  files,
  sha256: crypto.createHash("sha256").update(manifest).digest("hex"),
}));
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
case "$through_stage" in
  setup|done|remove) ;;
  *) fail "this deterministic slice supports only --through setup, done, or remove" ;;
esac
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || fail "fake setup integration requires darwin-arm64"
if [ "$through_stage" = setup ]; then
  node --test "$repository_root/packages/codex/tests/skill-contract.test.mjs" >/dev/null
fi

journey_root=$(mktemp -d -t dev-flow-codex-fake-journey.XXXXXX)
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

isolated_path="$fake_bin:$install_prefix/node_modules/.bin:$PATH"

setup_result=$(
  cd "$target_repository"
  HOME="$fake_home" \
  PATH="$isolated_path" \
  FAKE_CODEX_STATE="$fake_state" \
  FAKE_CODEX_TRACE="$fake_trace" \
  FAKE_CODEX_VERSION=0.147.0 \
  "$launcher" setup --json
)
marketplace_readback=$(
  cd "$target_repository"
  HOME="$fake_home" \
  FAKE_CODEX_STATE="$fake_state" \
  FAKE_CODEX_TRACE="$fake_trace" \
  FAKE_CODEX_VERSION=0.147.0 \
  "$fake_bin/codex" plugin marketplace list --json
)
plugin_readback=$(
  cd "$target_repository"
  HOME="$fake_home" \
  FAKE_CODEX_STATE="$fake_state" \
  FAKE_CODEX_TRACE="$fake_trace" \
  FAKE_CODEX_VERSION=0.147.0 \
  "$fake_bin/codex" plugin list --json
)
repository_after=$(directory_fingerprint "$target_repository")
[ "$repository_before" = "$repository_after" ] || fail "setup changed the target repository"

receipt_path="$fake_home/Library/Application Support/dev-flow/registrations/codex.json"
[ -f "$receipt_path" ] || fail "setup did not write the isolated registration receipt"

core_report='null'
if [ "$through_stage" != setup ]; then
  fake_core="$repository_root/packages/codex/tests/fixtures/fake-core.mjs"
  fake_core_state="$journey_root/fake-core/state.json"
  fake_core_trace="$journey_root/fake-core/trace.jsonl"

  session_one_output=$(
    TARGET_REPOSITORY="$target_repository" node <<'NODE' | env \
      FAKE_CORE_STATE="$fake_core_state" \
      FAKE_CORE_TRACE="$fake_core_trace" \
      FAKE_CORE_CASE=success \
      FAKE_CORE_SESSION=session-create \
      "$fake_core"
const repositoryPath = process.env.TARGET_REPOSITORY;
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-fake-journey", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "dev_flow_server_info", arguments: {} },
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dev_flow_open_task",
      arguments: {
        host: "codex",
        repository_path: repositoryPath,
        new_task: {
          goal: "Complete one bounded simulated Core journey",
          scope: ["one isolated repository"],
          out_of_scope: ["real Codex", "native evidence"],
          acceptance_criteria: ["Core returns DONE after two confirmed actions."],
          verification_budget: {
            level: "targeted",
            max_automatic_commands: 2,
            allow_full_suite: false,
            allow_manual_handoff: true,
          },
        },
      },
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "dev_flow_apply_action",
      arguments: {
        request_id: "request-harness-assess-0001",
        host: "codex",
        task_id: "task-00000001",
        revision: 1,
        action_id: "action-00000001",
        action_kind: "ASSESS_TASK",
        repository_binding_digest: "4".repeat(64),
        payload: {
          result: "succeeded",
          summary: "Assessed the bounded simulated task.",
          constraints: ["no real host"],
          risks: [],
          intended_changed_surface: ["isolated test repository"],
          verification_budget_acknowledged: true,
        },
      },
    },
  },
];
process.stdout.write(`${requests.map(JSON.stringify).join("\n")}\n`);
NODE
  )
  task_data_before_restart=$(sha256_file "$fake_core_state")

  node --test "$repository_root/packages/codex/tests/skill-contract.test.mjs" >/dev/null

  set +e
  session_two_output=$(
    TARGET_REPOSITORY="$target_repository" node <<'NODE' | env \
      FAKE_CORE_STATE="$fake_core_state" \
      FAKE_CORE_TRACE="$fake_core_trace" \
      FAKE_CORE_CASE=success \
      FAKE_CORE_SESSION=session-resume \
      FAKE_CORE_LOSS_ON_APPLY=2 \
      "$fake_core"
const repositoryPath = process.env.TARGET_REPOSITORY;
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-fake-journey", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "dev_flow_server_info", arguments: {} },
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dev_flow_open_task",
      arguments: { host: "codex", repository_path: repositoryPath },
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "dev_flow_apply_action",
      arguments: {
        request_id: "request-harness-verify-0002",
        host: "codex",
        task_id: "task-00000001",
        revision: 4,
        action_id: "action-verify-0004",
        action_kind: "VERIFY_CHANGE",
        repository_binding_digest: "7".repeat(64),
        payload: {
          result: "succeeded",
          summary: "The targeted Skill authority contract passed.",
          evidence: [{ source: "simulated", command: "node --test skill-contract.test.mjs", result: "pass" }],
          automatic_verification_commands: 1,
        },
      },
    },
  },
];
process.stdout.write(`${requests.map(JSON.stringify).join("\n")}\n`);
NODE
  )
  session_two_status=$?
  set -e
  [ "$session_two_status" -eq 75 ] || fail "fake Core did not inject the expected uncertain mutation response"
  task_data_after_done=$(sha256_file "$fake_core_state")

  session_three_output=$(
    node <<'NODE' | env \
      FAKE_CORE_STATE="$fake_core_state" \
      FAKE_CORE_TRACE="$fake_core_trace" \
      FAKE_CORE_CASE=success \
      FAKE_CORE_SESSION=session-recovery \
      "$fake_core"
const payload = {
  result: "succeeded",
  summary: "The targeted Skill authority contract passed.",
  evidence: [{ source: "simulated", command: "node --test skill-contract.test.mjs", result: "pass" }],
  automatic_verification_commands: 1,
};
const operationProbe = {
  operation_id: "request-harness-verify-0002",
  source_phase: "IMPLEMENT",
  expected_revision: 4,
  action_id: "action-verify-0004",
  action_kind: "VERIFY_CHANGE",
  repository_binding_digest: "7".repeat(64),
  payload,
};
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-fake-journey", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "dev_flow_server_info", arguments: {} },
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dev_flow_get_task",
      arguments: { host: "codex", task_id: "task-00000001", operation_probe: operationProbe },
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "dev_flow_get_next_action",
      arguments: { host: "codex", task_id: "task-00000001", operation_probe: operationProbe },
    },
  },
];
process.stdout.write(`${requests.map(JSON.stringify).join("\n")}\n`);
NODE
  )

  core_report=$(
    SESSION_ONE_OUTPUT="$session_one_output" \
    SESSION_TWO_OUTPUT="$session_two_output" \
    SESSION_THREE_OUTPUT="$session_three_output" \
    FAKE_CORE_STATE="$fake_core_state" \
    TASK_DATA_BEFORE_RESTART="$task_data_before_restart" \
    TASK_DATA_AFTER_DONE="$task_data_after_done" \
    node <<'NODE'
const fs = require("node:fs");

function responses(source) {
  return source.trim().split("\n").filter(Boolean).map(JSON.parse);
}

function toolResult(source, id) {
  const response = responses(source).find((candidate) => candidate.id === id);
  if (!response?.result?.structuredContent) {
    throw new Error(`missing complete structured result for request ${id}`);
  }
  const envelope = response.result.structuredContent;
  if (JSON.stringify(JSON.parse(response.result.content[0].text)) !== JSON.stringify(envelope)) {
    throw new Error(`structured/text result mismatch for request ${id}`);
  }
  return envelope;
}

const firstOpen = toolResult(process.env.SESSION_ONE_OUTPUT, 3);
const firstApplied = toolResult(process.env.SESSION_ONE_OUTPUT, 4);
const resumed = toolResult(process.env.SESSION_TWO_OUTPUT, 3);
const recoveredTask = toolResult(process.env.SESSION_THREE_OUTPUT, 3);
const recoveredNext = toolResult(process.env.SESSION_THREE_OUTPUT, 4);
const state = JSON.parse(fs.readFileSync(process.env.FAKE_CORE_STATE, "utf8"));

const firstTask = firstOpen.result.task;
const firstAction = firstTask.current_action;
const resumedTask = resumed.result.task;
const secondAction = resumedTask.current_action;
const terminalTask = recoveredTask.result.task;
const recovery = recoveredTask.result.recovery_assessment;
const calls = state.calls;
const expectedCalls = [
  ["session-create", "dev_flow_server_info"],
  ["session-create", "dev_flow_open_task"],
  ["session-create", "dev_flow_apply_action"],
  ["session-resume", "dev_flow_server_info"],
  ["session-resume", "dev_flow_open_task"],
  ["session-resume", "dev_flow_apply_action"],
  ["session-recovery", "dev_flow_server_info"],
  ["session-recovery", "dev_flow_get_task"],
  ["session-recovery", "dev_flow_get_next_action"],
];
if (JSON.stringify(calls.map(({ session, name }) => [session, name])) !== JSON.stringify(expectedCalls)) {
  throw new Error("fake Core call/session lineage is not exact");
}
if (!firstOpen.result.created || resumed.result.created) throw new Error("create/resume classification drifted");
if (firstTask.task_id !== resumedTask.task_id || resumedTask.task_id !== terminalTask.task_id) {
  throw new Error("fake Core task ID changed across restart");
}
if (firstTask.revision !== 1 || firstApplied.result.task.revision !== 4 || terminalTask.revision !== 8) {
  throw new Error("fake Core revision lineage drifted");
}
if (recoveredNext.result.revision !== 8 || recoveredNext.result.outcome?.status !== "completed") {
  throw new Error("recovery did not return the Core terminal outcome");
}
if (recovery?.classification !== "completed_and_recorded") {
  throw new Error("recovery did not classify the uncertain mutation as committed");
}
if (!state.journey.done || state.journey.apply_count !== 2 || !state.journey.last_response_lost) {
  throw new Error("fake Core persistent state does not prove the loss-after-commit boundary");
}

process.stdout.write(JSON.stringify({
  task_lineage: {
    task_id_before_restart: firstTask.task_id,
    task_id_after_restart: resumedTask.task_id,
    revisions: [firstTask.revision, firstApplied.result.task.revision, terminalTask.revision],
    committed_actions: [
      {
        action_id: firstAction.action_id,
        request_id: "request-harness-assess-0001",
        revision: firstApplied.result.task.revision,
        response: "complete",
      },
      {
        action_id: secondAction.action_id,
        request_id: "request-harness-verify-0002",
        revision: terminalTask.revision,
        response: "uncertain_then_read_back",
      },
    ],
    recovery_classification: recovery.classification,
    terminal_outcome: terminalTask.phase,
  },
  budget: {
    verification_commands_used: 1,
    max_automatic_commands: firstTask.contract.verification_budget.max_automatic_commands,
    core_call_count: calls.length,
    scenario_call_budget: 10,
    full_suite_run: false,
  },
  recovery: {
    apply_calls: calls.filter((call) => call.name === "dev_flow_apply_action").length,
    calls_after_uncertainty: calls
      .filter((call) => call.session === "session-recovery" && call.name !== "dev_flow_server_info")
      .map((call) => call.name),
  },
  task_data: {
    before_restart_sha256: process.env.TASK_DATA_BEFORE_RESTART,
    after_done_sha256: process.env.TASK_DATA_AFTER_DONE,
    persisted_across_sessions: new Set(calls.map((call) => call.session)).size === 3,
  },
}));
NODE
  )
fi

repository_after_completion=$(directory_fingerprint "$target_repository")
[ "$repository_before" = "$repository_after_completion" ] || fail "fake Core journey changed the target repository"

removal_report='null'
repository_after_removal=$repository_after_completion
if [ "$through_stage" = remove ]; then
  adjacent_file="$(dirname -- "$receipt_path")/user-owned-adjacent.txt"
  printf '%s\n' 'preserve adjacent registration data' >"$adjacent_file"
  task_data_before_removal=$(directory_manifest "$journey_root/fake-core")

  remove_result=$(
    cd "$target_repository"
    HOME="$fake_home" \
    PATH="$isolated_path" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$launcher" remove --json
  )
  [ ! -f "$receipt_path" ] || fail "remove left the registration receipt present"
  [ "$(cat "$adjacent_file")" = 'preserve adjacent registration data' ] || fail "remove changed adjacent data"

  removed_marketplaces=$(
    cd "$target_repository"
    HOME="$fake_home" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$fake_bin/codex" plugin marketplace list --json
  )
  removed_plugins=$(
    cd "$target_repository"
    HOME="$fake_home" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$fake_bin/codex" plugin list --json
  )

  repeat_remove_result=$(
    cd "$target_repository"
    HOME="$fake_home" \
    PATH="$isolated_path" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$launcher" remove --json
  )
  task_data_after_removal=$(directory_manifest "$journey_root/fake-core")
  [ "$task_data_before_removal" = "$task_data_after_removal" ] || fail "remove changed fake Core task data"

  direct_reopen_output=$(
    node <<'NODE' | env \
      FAKE_CORE_STATE="$fake_core_state" \
      FAKE_CORE_TRACE="$fake_core_trace" \
      FAKE_CORE_CASE=success \
      FAKE_CORE_SESSION=session-removal-reopen \
      "$fake_core"
const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dev-flow-fake-journey", version: "0.1.0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "dev_flow_server_info", arguments: {} },
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dev_flow_get_task",
      arguments: { host: "codex", task_id: "task-00000001" },
    },
  },
];
process.stdout.write(`${requests.map(JSON.stringify).join("\n")}\n`);
NODE
  )

  npm uninstall \
    --ignore-scripts \
    --no-audit \
    --no-fund \
    --prefix "$install_prefix" \
    dev-flow-codex >/dev/null
  [ ! -e "$installed_package" ] || fail "separate npm uninstall left the package installed"

  npm install \
    --ignore-scripts \
    --no-audit \
    --no-fund \
    --prefix "$install_prefix" \
    "$artifact_path" >/dev/null
  launcher="$install_prefix/node_modules/.bin/dev-flow-codex"
  installed_package="$install_prefix/node_modules/dev-flow-codex"
  [ -x "$launcher" ] || fail "compatible reinstall did not restore the launcher"
  reinstall_result=$(
    cd "$target_repository"
    HOME="$fake_home" \
    PATH="$isolated_path" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$launcher" setup --json
  )
  reinstall_marketplaces=$(
    cd "$target_repository"
    HOME="$fake_home" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$fake_bin/codex" plugin marketplace list --json
  )
  reinstall_plugins=$(
    cd "$target_repository"
    HOME="$fake_home" \
    FAKE_CODEX_STATE="$fake_state" \
    FAKE_CODEX_TRACE="$fake_trace" \
    FAKE_CODEX_VERSION=0.147.0 \
    "$fake_bin/codex" plugin list --json
  )

  removal_report=$(
    REMOVE_RESULT="$remove_result" \
    REPEAT_REMOVE_RESULT="$repeat_remove_result" \
    REMOVED_MARKETPLACES="$removed_marketplaces" \
    REMOVED_PLUGINS="$removed_plugins" \
    REINSTALL_RESULT="$reinstall_result" \
    REINSTALL_MARKETPLACES="$reinstall_marketplaces" \
    REINSTALL_PLUGINS="$reinstall_plugins" \
    DIRECT_REOPEN_OUTPUT="$direct_reopen_output" \
    TASK_DATA_BEFORE_REMOVAL="$task_data_before_removal" \
    TASK_DATA_AFTER_REMOVAL="$task_data_after_removal" \
    node <<'NODE'
function responses(source) {
  return source.trim().split("\n").filter(Boolean).map(JSON.parse);
}
const remove = JSON.parse(process.env.REMOVE_RESULT);
const repeated = JSON.parse(process.env.REPEAT_REMOVE_RESULT);
const removedMarketplaces = JSON.parse(process.env.REMOVED_MARKETPLACES);
const removedPlugins = JSON.parse(process.env.REMOVED_PLUGINS);
const reinstall = JSON.parse(process.env.REINSTALL_RESULT);
const reinstallMarketplaces = JSON.parse(process.env.REINSTALL_MARKETPLACES);
const reinstallPlugins = JSON.parse(process.env.REINSTALL_PLUGINS);
const reopenResponse = responses(process.env.DIRECT_REOPEN_OUTPUT).find((candidate) => candidate.id === 3);
const reopened = reopenResponse?.result?.structuredContent;
const before = JSON.parse(process.env.TASK_DATA_BEFORE_REMOVAL);
const after = JSON.parse(process.env.TASK_DATA_AFTER_REMOVAL);
if (remove.status !== "removed" || repeated.status !== "already-absent") {
  throw new Error("remove/repeated-remove status is not exact");
}
if (removedMarketplaces.length !== 0 || removedPlugins.length !== 0) {
  throw new Error("registration remains after fake removal");
}
if (reinstall.status !== "installed" || reinstallMarketplaces.length !== 1 || reinstallPlugins.length !== 1) {
  throw new Error("compatible fake reinstall readback is not exact");
}
if (!reopened?.ok || reopened.result.task.phase !== "DONE" || reopened.result.task.revision !== 8) {
  throw new Error("direct fake Core reopen did not retain DONE task data");
}
process.stdout.write(JSON.stringify({
  removal: {
    process_stopped_before_remove: true,
    remove_status: remove.status,
    repeat_status: repeated.status,
    plugin_absent: removedPlugins.length === 0,
    marketplace_absent: removedMarketplaces.length === 0,
    receipt_absent: true,
    adjacent_preserved: true,
    npm_uninstalled_separately: true,
    compatible_reinstall_status: reinstall.status,
    reinstall_plugin_count: reinstallPlugins.length,
    reinstall_marketplace_count: reinstallMarketplaces.length,
  },
  task_data_removal: {
    manifest_before_removal_sha256: before.sha256,
    manifest_after_removal_sha256: after.sha256,
    files_before_removal: before.files,
    files_after_removal: after.files,
    direct_reopen_task_id: reopened.result.task.task_id,
    direct_reopen_revision: reopened.result.task.revision,
  },
}));
NODE
  )

  repository_after_removal=$(directory_fingerprint "$target_repository")
  [ "$repository_after_completion" = "$repository_after_removal" ] || fail "removal changed the target repository"
fi

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
CORE_REPORT=$core_report \
REMOVAL_REPORT=$removal_report \
THROUGH_STAGE=$through_stage \
REPOSITORY_AFTER_COMPLETION=$repository_after_completion \
REPOSITORY_AFTER_REMOVAL=$repository_after_removal \
node <<'NODE'
const fs = require("node:fs");
const build = JSON.parse(process.env.BUILD_REPORT);
const setup = JSON.parse(process.env.SETUP_RESULT);
const marketplaces = JSON.parse(process.env.MARKETPLACE_READBACK);
const plugins = JSON.parse(process.env.PLUGIN_READBACK);
const core = JSON.parse(process.env.CORE_REPORT);
const removal = JSON.parse(process.env.REMOVAL_REPORT);
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
const checkpoint = {
  checkpoint_version: 1,
  classification: "simulated",
  through_stage: process.env.THROUGH_STAGE,
  real_codex_started: false,
  native_evidence_written: false,
  source_commit: process.env.SOURCE_COMMIT,
  artifact_sha256: process.env.ARTIFACT_DIGEST,
  artifact_final: build.final_artifact,
  repository: {
    before_sha256: process.env.REPOSITORY_BEFORE,
    after_setup_sha256: process.env.REPOSITORY_AFTER,
    after_completion_sha256: process.env.REPOSITORY_AFTER_COMPLETION,
    after_removal_sha256: process.env.REPOSITORY_AFTER_REMOVAL,
    unchanged: process.env.REPOSITORY_BEFORE === process.env.REPOSITORY_AFTER_REMOVAL,
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
};
if (["done", "remove"].includes(process.env.THROUGH_STAGE)) {
  if (!core || core.task_lineage.terminal_outcome !== "DONE") {
    throw new Error("fake Core report did not reach DONE");
  }
  Object.assign(checkpoint, {
    build_identity: {
      source_commit: process.env.SOURCE_COMMIT,
      artifact_sha256: process.env.ARTIFACT_DIGEST,
    },
    session_markers: [
      "create-session-open",
      "create-session-closed",
      "resume-session-open",
      "uncertain-response-observed",
      "resume-session-closed",
      "recovery-session-open",
      "recovery-session-closed",
    ],
    task_lineage: core.task_lineage,
    budget: core.budget,
    recovery: core.recovery,
    task_data: core.task_data,
  });
}
if (process.env.THROUGH_STAGE === "remove") {
  if (!removal || removal.removal.compatible_reinstall_status !== "installed") {
    throw new Error("fake removal report did not complete compatible reinstall");
  }
  checkpoint.session_markers.push("process-stop-before-remove", "direct-reopen-after-remove");
  checkpoint.removal = removal.removal;
  checkpoint.task_data_removal = removal.task_data_removal;
}
process.stdout.write(`${JSON.stringify(checkpoint)}\n`);
NODE
