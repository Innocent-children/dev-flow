import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  validateEvidence,
  validateEvidenceSemantics,
  validateEvidenceStructure,
} from "../../../scripts/validate-codex-journey-evidence.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const schema = JSON.parse(
  await readFile(
    join(repositoryRoot, "specs", "003-codex-explicit-dev-flow", "contracts", "journey-evidence.schema.json"),
    "utf8",
  ),
);
const rootVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();

test("passing native evidence satisfies the structural schema and semantic contract", () => {
  const evidence = passingEvidence();
  assert.deepEqual(validateEvidenceStructure(evidence, schema), []);
  assert.deepEqual(validateEvidenceSemantics(evidence, { rootVersion }), []);
  assert.deepEqual(validateEvidence(evidence, { schema, rootVersion }), {
    valid: true,
    structuralErrors: [],
    semanticErrors: [],
  });
});

test("structural validation rejects identity drift and unknown fields", () => {
  const notFinal = passingEvidence();
  notFinal.classification.final_artifact = false;
  assert.match(validateEvidenceStructure(notFinal, schema).join("\n"), /final_artifact.*true/i);

  const invalidArtifact = passingEvidence();
  invalidArtifact.identity.artifact_sha256 = "not-a-digest";
  assert.match(validateEvidenceStructure(invalidArtifact, schema).join("\n"), /artifact_sha256.*pattern/i);

  const openObject = passingEvidence();
  openObject.identity.unreviewed = true;
  assert.match(validateEvidenceStructure(openObject, schema).join("\n"), /unreviewed.*not allowed/i);
});

test("failed and blocked records remain honest partial observations", () => {
  for (const status of ["failed", "blocked"]) {
    const evidence = partialEvidence(status);
    assert.deepEqual(validateEvidenceStructure(evidence, schema), [], status);
    assert.deepEqual(validateEvidenceSemantics(evidence, { rootVersion }), [], status);
  }

  const fabricatedSuccess = partialEvidence("failed");
  fabricatedSuccess.failures = [];
  fabricatedSuccess.skips = [];
  assert.match(validateEvidenceStructure(fabricatedSuccess, schema).join("\n"), /anyOf/i);
});

test("semantic validation enforces version, compatibility, and frozen-source identity", () => {
  const cases = [
    ["package/Core", (value) => { value.versions.core = "0.1.1"; }],
    ["repository VERSION", (value) => { value.versions.package = "0.2.0"; value.versions.core = "0.2.0"; }],
    ["Codex compatibility", (value) => { value.versions.codex = "0.148.0"; }],
    ["targeted validation source commit", (value) => { value.validation.targeted_checks.source_commit = "d".repeat(40); }],
    ["root validation source commit", (value) => { value.validation.root_validation.source_commit = "d".repeat(40); }],
  ];

  for (const [expected, mutate] of cases) {
    const evidence = passingEvidence();
    mutate(evidence);
    assert.match(validateEvidenceSemantics(evidence, { rootVersion }).join("\n"), new RegExp(expected, "i"));
  }
});

test("semantic validation enforces strict task lineage and the call budget", () => {
  const cases = [
    ["strictly increasing", (value) => { value.journey.task_lineage.revisions = [1, 4, 4]; }],
    ["committed-action revision", (value) => { value.journey.task_lineage.committed_actions[1].revision = 7; }],
    ["unique action IDs", (value) => { value.journey.task_lineage.committed_actions[1].action_id = "action-1"; }],
    ["same task ID", (value) => { value.journey.task_lineage.task_id_after_restart = "task-other"; }],
    ["at least two", (value) => { value.journey.task_lineage.committed_actions = value.journey.task_lineage.committed_actions.slice(0, 1); }],
    ["call budget", (value) => { value.journey.invocation.core_call_count = 11; }],
    ["DONE", (value) => { value.journey.task_lineage.terminal_outcome = "BLOCKED"; }],
  ];

  for (const [expected, mutate] of cases) {
    const evidence = passingEvidence();
    mutate(evidence);
    assert.match(validateEvidenceSemantics(evidence, { rootVersion }).join("\n"), new RegExp(expected, "i"));
  }
});

test("semantic validation enforces retained data, repository safety, lifecycle, and passing observations", () => {
  const cases = [
    ["task-data file lists", (value) => { value.journey.task_data.files_after_removal.push("lost.db"); }],
    ["task-data manifest", (value) => { value.journey.task_data.manifest_after_removal_sha256 = "9".repeat(64); }],
    ["repository digest", (value) => { value.journey.repository.digest_after_removal = "8".repeat(64); }],
    ["unexpected changed paths", (value) => { value.journey.repository.unexpected_changed_paths.push("secret.txt"); }],
    ["lifecycle", (value) => { value.journey.lifecycle.remove_readback_passed = false; }],
    ["targeted checks", (value) => { value.validation.targeted_checks.result = "failed"; }],
    ["root validation", (value) => { value.validation.root_validation.result = "blocked"; }],
    ["failures", (value) => { value.failures.push(observation("journey", "failed", "observed")); }],
    ["skips", (value) => { value.skips.push(observation("remove", "skipped", "not run")); }],
  ];

  for (const [expected, mutate] of cases) {
    const evidence = passingEvidence();
    mutate(evidence);
    assert.match(validateEvidenceSemantics(evidence, { rootVersion }).join("\n"), new RegExp(expected, "i"));
  }
});

function passingEvidence() {
  const sourceCommit = "c".repeat(40);
  return {
    schema_version: 2,
    status: "pass",
    recorded_at: "2026-08-15T12:30:00.000Z",
    classification: {
      evidence_type: "native-host",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: "0.147.5",
      codex_compatibility: ">=0.147.0 <0.148.0",
      package: "0.1.0",
      core: "0.1.0",
      core_contract: "0.1",
    },
    identity: {
      source_commit: sourceCommit,
      artifact_sha256: "a".repeat(64),
      shared_fixtures_sha256: "b".repeat(64),
    },
    validation: {
      targeted_checks: {
        command: "node --test targeted",
        result: "pass",
        source_commit: sourceCommit,
        completed_at: "2026-08-15T10:00:00.000Z",
      },
      root_validation: {
        command: "pnpm run validate",
        result: "pass",
        source_commit: sourceCommit,
        completed_at: "2026-08-15T10:15:00.000Z",
      },
    },
    journey: {
      task_lineage: {
        task_id_before_restart: "task-1",
        task_id_after_restart: "task-1",
        revisions: [1, 4, 8],
        committed_actions: [
          {
            action_id: "action-1",
            revision: 4,
            arguments_sha256: "1".repeat(64),
            result_sha256: "2".repeat(64),
          },
          {
            action_id: "action-2",
            revision: 8,
            arguments_sha256: "3".repeat(64),
            result_sha256: "4".repeat(64),
          },
        ],
        terminal_outcome: "DONE",
      },
      invocation: {
        explicit_selector: "$dev-flow",
        core_call_count: 10,
        scenario_call_budget: 10,
        implicit_invocation_core_calls: 0,
        read_before_retry_observations: 1,
      },
      lifecycle: {
        setup_readback_passed: true,
        restart_resume_passed: true,
        remove_readback_passed: true,
        task_data_retained: true,
        task_reopened_after_removal: true,
        compatible_reinstall_passed: true,
      },
      repository: {
        target_path: "/tmp/dev-flow journey/repository",
        digest_before: "5".repeat(64),
        digest_after_completion: "6".repeat(64),
        digest_after_removal: "6".repeat(64),
        intended_changed_paths: ["README.md"],
        unexpected_changed_paths: [],
      },
      task_data: {
        manifest_before_removal_sha256: "7".repeat(64),
        manifest_after_removal_sha256: "7".repeat(64),
        files_before_removal: ["dev-flow.db"],
        files_after_removal: ["dev-flow.db"],
      },
    },
    failures: [],
    skips: [],
  };
}

function partialEvidence(status) {
  const evidence = passingEvidence();
  evidence.status = status;
  delete evidence.journey;
  evidence.validation.targeted_checks.result = status;
  evidence.validation.root_validation.result = "blocked";
  evidence.failures = status === "failed" ? [observation("setup", "host failed", "exit 1")] : [];
  evidence.skips = status === "blocked" ? [observation("setup", "unsupported", "not started")] : [];
  return evidence;
}

function observation(phase, reason, observed) {
  return { phase, reason, observed };
}
