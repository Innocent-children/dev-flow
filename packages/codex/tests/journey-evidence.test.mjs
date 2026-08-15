import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import * as validator from "../../../scripts/validate-codex-journey-evidence.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = join(packageRoot, "..", "..");
const contractsRoot = join(repositoryRoot, "specs", "003-codex-explicit-dev-flow", "contracts");
const rootVersion = (await readFile(join(repositoryRoot, "VERSION"), "utf8")).trim();
const canonicalEvidencePath = join(
  repositoryRoot,
  "tests",
  "journeys",
  "evidence",
  "codex-macos-arm64.json",
);
const attemptLedgerPath = "/tmp/dev-flow-codex-native-attempts.json";
const schemas = Object.fromEntries(
  await Promise.all(
    ["validation-report", "artifact-report", "native-attempt-ledger", "journey-evidence"].map(
      async (name) => [
        name,
        JSON.parse(await readFile(join(contractsRoot, `${name}.schema.json`), "utf8")),
      ],
    ),
  ),
);
const diagnosticSchema = JSON.parse(
  await readFile(join(contractsRoot, "native-attempt-diagnostic.schema.json"), "utf8"),
);

const expectedTargetedCommands = [
  "go test ./internal/version ./tests/contract",
  "node --test packages/codex/tests/*.test.mjs",
];
const logicalProofName = "git hash-object native-proof.txt";
const renderedProofCommand = "/bin/zsh -lc 'git hash-object native-proof.txt'";
const renderedRootGateCommand = "/bin/zsh -lc 'pnpm run validate'";
const renderedDeniedCommands = [
  "/bin/zsh -lc 'go test ./...'",
  "/bin/zsh -lc 'go test ./internal/version ./tests/contract'",
  "/bin/zsh -lc 'pnpm test'",
  "/bin/zsh -lc 'pnpm run test'",
  renderedRootGateCommand,
  "/bin/zsh -lc 'node --test'",
  "/bin/zsh -lc 'node --test packages/codex/tests/*.test.mjs'",
];
const immutableNativeRoot = join(
  homedir(),
  ".codex",
  "dev-flow-feature-003-native",
  "attempt-ledger.json.recovery",
);
const immutableFailureAttempts = [
  {
    attemptNumber: 1,
    schemaVersion: 1,
    chainID: "3b273663d554d6d1d61f22735bf8d98faba42c2a7c44e63a13f0412aa1fb0536",
    diagnosticSha256: "acb8f447ebea55d4a3181e98f7e74810e85174bc32f3c506cda603c308d43663",
    observedFactsSha256: "b90a41d5f8f632561a28d4e0f0c482b4eb848634137553827248985c3fec0715",
    ledgerCandidateSha256: "1eca5a007d7f80c0f64b34214123332559b614907d3655b0f0e1aa4d7c3ceb00",
  },
  {
    attemptNumber: 2,
    schemaVersion: 2,
    chainID: "2d74b98b7a8be02d22d4290ee2a673b746ab99208b1665aeb7203615265b49b1",
    diagnosticSha256: "716db0273bea67a96ff2eb288936564b9766c7555c44884fbbcbf8f209cccd81",
    observedFactsSha256: "e53357a2f80eaa55ef7f66d5e59713f8b1d480edcaa9c548f726fe6aab1cea98",
    ledgerCandidateSha256: "a6309693587fc3ae2b4ffeb641cd2d1fc0a25f065536a8da25447eb86d61ad19",
  },
];

test("passing schema-v3 candidate satisfies all closed structures and semantics", () => {
  const candidate = passingCandidate();

  for (const [name, document] of Object.entries(candidate.documents)) {
    if (!schemas[name]) continue;
    assert.deepEqual(
      validator.validateDocumentStructure(document, schemas[name]),
      [],
      name,
    );
  }

  assert.deepEqual(validator.validateEvidenceStructure(candidate.documents["journey-evidence"], schemas["journey-evidence"]), []);
  assert.deepEqual(validator.validateEvidenceSemantics(candidate.documents["journey-evidence"], {
    rootVersion,
    validationReport: candidate.documents["validation-report"],
    validationReportText: candidate.validationReportText,
    artifactReport: candidate.documents["artifact-report"],
    artifactReportText: candidate.artifactReportText,
    attemptLedger: candidate.documents["native-attempt-ledger"],
    attemptLedgerText: candidate.attemptLedgerText,
    attemptLedgerPath,
    observedFacts: candidate.documents["observed-facts"],
    observedFactsText: candidate.observedFactsText,
    artifactSha256: candidate.artifactSha256,
    artifactPath: candidate.documents["artifact-report"].artifact_path,
  }), []);

  assert.deepEqual(candidateResult(candidate), {
    valid: true,
    structuralErrors: [],
    semanticErrors: [],
  });
});

test("every retained report is closed against missing and extra top-level fields", () => {
  const candidate = passingCandidate();
  const requiredByName = {
    "validation-report": "source_commit",
    "artifact-report": "artifact_path",
    "native-attempt-ledger": "ledger_id",
    "journey-evidence": "native_attempt",
  };

  for (const [name, field] of Object.entries(requiredByName)) {
    const missing = structuredClone(candidate.documents[name]);
    delete missing[field];
    assert.match(
      validator.validateDocumentStructure(missing, schemas[name]).join("\n"),
      new RegExp(`${field}.*required`, "i"),
      `${name} missing ${field}`,
    );

    const extra = structuredClone(candidate.documents[name]);
    extra.unreviewed = true;
    assert.match(
      validator.validateDocumentStructure(extra, schemas[name]).join("\n"),
      /unreviewed.*not allowed/i,
      `${name} extra field`,
    );
  }
});

test("failed and blocked attempts use the independent closed diagnostic schema", () => {
  const diagnostic = attemptDiagnostic("failed");
  assert.deepEqual(validator.validateDocumentStructure(diagnostic, diagnosticSchema), []);
  assert.deepEqual(
    validator.validateDocumentStructure({ ...diagnostic, status: "blocked" }, diagnosticSchema),
    [],
  );

  for (const [expected, mutate] of [
    ["schema_version", (document) => { document.schema_version = 4; }],
    ["report_type", (document) => { document.report_type = "journey-evidence"; }],
    ["failure.*required", (document) => { delete document.failure; }],
    ["journey.*not allowed", (document) => { document.journey = {}; }],
    ["evidence_type", (document) => { document.classification.evidence_type = "native-host"; }],
  ]) {
    const mutated = structuredClone(diagnostic);
    mutate(mutated);
    assert.match(
      validator.validateDocumentStructure(mutated, diagnosticSchema).join("\n"),
      new RegExp(expected, "i"),
      expected,
    );
  }
});

test("diagnostic schema preserves exact immutable attempt-1 v1 and attempt-2 v2 history", async (t) => {
  for (const immutable of immutableFailureAttempts) {
    const recoveryDirectory = join(immutableNativeRoot, immutable.chainID);
    const diagnosticPath = join(recoveryDirectory, "failed.json");
    const observedFactsPath = join(recoveryDirectory, "failure-observed-facts.json");
    const ledgerCandidatePath = join(recoveryDirectory, "failure-ledger-candidate.json");
    let diagnosticText;
    let observedFactsText;
    let ledgerCandidateText;
    try {
      [diagnosticText, observedFactsText, ledgerCandidateText] = await Promise.all([
        readFile(diagnosticPath, "utf8"),
        readFile(observedFactsPath, "utf8"),
        readFile(ledgerCandidatePath, "utf8"),
      ]);
    } catch (error) {
      if (error?.code === "ENOENT") {
        t.skip("immutable native failure history is not retained on this machine");
        return;
      }
      throw error;
    }

    const diagnostic = JSON.parse(diagnosticText);
    const ledgerCandidate = JSON.parse(ledgerCandidateText);
    const matchingEntry = ledgerCandidate.attempts[immutable.attemptNumber - 1];
    assert.equal(sha256(diagnosticText), immutable.diagnosticSha256);
    assert.equal(sha256(observedFactsText), immutable.observedFactsSha256);
    assert.equal(sha256(ledgerCandidateText), immutable.ledgerCandidateSha256);
    assert.equal(diagnostic.schema_version, immutable.schemaVersion);
    assert.equal(diagnostic.native_attempt.attempt_number, immutable.attemptNumber);
    assert.deepEqual(validator.validateDocumentStructure(diagnostic, diagnosticSchema), []);
    assert.deepEqual(
      validator.validateDocumentStructure(ledgerCandidate, schemas["native-attempt-ledger"]),
      [],
    );
    assert.equal(diagnostic.native_attempt.observed_facts_sha256, immutable.observedFactsSha256);
    assert.equal(matchingEntry.observed_facts_sha256, immutable.observedFactsSha256);
    assert.equal(matchingEntry.chain_id, immutable.chainID);
    assert.equal(matchingEntry.status, diagnostic.status);

    assert.deepEqual(
      await Promise.all([
        readFile(diagnosticPath, "utf8").then(sha256),
        readFile(observedFactsPath, "utf8").then(sha256),
        readFile(ledgerCandidatePath, "utf8").then(sha256),
      ]),
      [
        immutable.diagnosticSha256,
        immutable.observedFactsSha256,
        immutable.ledgerCandidateSha256,
      ],
    );
  }

  const commandEvent = attemptDiagnosticV2("failed", "command_event");
  const nonCommand = attemptDiagnosticV2("blocked", "non_command");
  assert.deepEqual(validator.validateDocumentStructure(commandEvent, diagnosticSchema), []);
  assert.deepEqual(validator.validateDocumentStructure(nonCommand, diagnosticSchema), []);

  for (const [label, mutate] of [
    ["v1 with v2 protocol", (document) => {
      document.native_attempt.commit_protocol = "external-failure-record-v2";
    }],
    ["v1 with v2 discriminator", (document) => {
      document.failure_kind = "non_command";
    }],
  ]) {
    const invalidV1 = attemptDiagnostic("failed");
    mutate(invalidV1);
    assert.notDeepEqual(
      validator.validateDocumentStructure(invalidV1, diagnosticSchema),
      [],
      label,
    );
  }

  const v2WithV1Protocol = structuredClone(nonCommand);
  v2WithV1Protocol.native_attempt.commit_protocol = "external-failure-record-v1";
  assert.notDeepEqual(
    validator.validateDocumentStructure(v2WithV1Protocol, diagnosticSchema),
    [],
  );
  const v2WithV1Observation = structuredClone(nonCommand);
  v2WithV1Observation.failure = observation("native-journey", "blocked", "raw detail");
  assert.notDeepEqual(
    validator.validateDocumentStructure(v2WithV1Observation, diagnosticSchema),
    [],
  );

  for (const field of [
    "session_role",
    "event_type",
    "command_sha256",
    "output_sha256",
    "status",
    "exit_code",
  ]) {
    const missing = structuredClone(commandEvent);
    delete missing.failure_context[field];
    assert.match(
      validator.validateDocumentStructure(missing, diagnosticSchema).join("\n"),
      new RegExp(`${field}.*required`, "i"),
      `missing command context ${field}`,
    );
  }

  const missingContext = structuredClone(commandEvent);
  delete missingContext.failure_context;
  assert.match(
    validator.validateDocumentStructure(missingContext, diagnosticSchema).join("\n"),
    /failure_context.*required/i,
  );

  const forbiddenContext = structuredClone(nonCommand);
  forbiddenContext.failure_context = structuredClone(commandEvent.failure_context);
  assert.match(
    validator.validateDocumentStructure(forbiddenContext, diagnosticSchema).join("\n"),
    /failure_context.*forbidden|must not satisfy/i,
  );

  for (const [label, mutate] of [
    ["raw command", (document) => { document.failure_context.command = renderedProofCommand; }],
    ["raw output", (document) => { document.failure_context.output = "secret output"; }],
    ["repository path", (document) => { document.failure_context.repository_path = "/tmp/private/repo"; }],
    ["raw failure detail", (document) => { document.failure.observed = "raw host failure"; }],
    ["raw skip path", (document) => {
      document.skips.push({
        phase_code: "cleanup",
        reason_code: "blocked",
        detail_sha256: "e".repeat(64),
        path: "/tmp/private/repo",
      });
    }],
  ]) {
    const leaked = structuredClone(commandEvent);
    mutate(leaked);
    assert.notDeepEqual(
      validator.validateDocumentStructure(leaked, diagnosticSchema),
      [],
      label,
    );
  }
});

test("v3 failure candidate binds the exact facts projection and final durable-ledger entry", () => {
  const baseline = failureCandidateV3();
  assert.deepEqual(validator.validateDocumentStructure(baseline.diagnostic, diagnosticSchema), []);
  assert.deepEqual(
    validator.validateDocumentStructure(baseline.ledger, schemas["native-attempt-ledger"]),
    [],
  );
  assert.deepEqual(validateFailureCandidate(baseline), []);

  const cases = [
    ["exact.*four session observations|four session observations.*exact", (candidate) => {
      candidate.observedFacts.session_observations[0].failure_stage = "process_exited";
    }],
    ["source_commit.*matching final ledger", (candidate) => {
      candidate.diagnostic.identity.source_commit = "f".repeat(40);
    }],
    ["total_attempts.*ledger", (candidate) => {
      candidate.diagnostic.native_attempt.total_attempts = 4;
    }],
    ["status.*matching final ledger", (candidate) => {
      candidate.ledger.attempts[2].status = "blocked";
    }],
    ["observed facts digest", (candidate) => {
      candidate.diagnostic.native_attempt.observed_facts_sha256 = "f".repeat(64);
    }],
    ["ledger candidate digest", (candidate) => {
      candidate.diagnostic.native_attempt.ledger_sha256 = "f".repeat(64);
    }],
    ["failure attempt ledger.*unreviewed.*not allowed", (candidate) => {
      candidate.ledger.unreviewed = true;
    }],
    ["ledger path identity", (candidate) => {
      candidate.attemptLedgerPath = "/tmp/switched-native-attempt-ledger.json";
    }],
  ];
  for (const [expected, mutate] of cases) {
    const candidate = structuredClone(baseline);
    mutate(candidate);
    assert.match(validateFailureCandidate(candidate).join("\n"), new RegExp(expected, "i"), expected);
  }
});

test("synthetic attempt 3 cannot downgrade to v1 or v2 even with exact ledger and facts binding", () => {
  for (const schemaVersion of [1, 2]) {
    const candidate = failureCandidateV3();
    candidate.diagnostic.schema_version = schemaVersion;
    candidate.diagnostic.native_attempt.commit_protocol = `external-failure-record-v${schemaVersion}`;
    delete candidate.diagnostic.session_observations;
    if (schemaVersion === 1) {
      candidate.diagnostic.failure = observation(
        "native-journey",
        "native attempt failed",
        "immutable legacy-shaped detail",
      );
      delete candidate.diagnostic.failure_kind;
      delete candidate.diagnostic.failure_context;
    }
    rebindFailureCandidate(candidate);

    assert.match(
      validator.validateDocumentStructure(candidate.diagnostic, diagnosticSchema).join("\n"),
      new RegExp(`attempt_number.*equal ${schemaVersion}|total_attempts.*equal ${schemaVersion}`, "i"),
    );
    assert.match(
      validateFailureCandidate(candidate).join("\n"),
      /later failure diagnostic.*schema version 3|v1\/v2 downgrade/i,
    );
  }
});

test("v3 session observations enforce unstarted, close, count, thread, malformed, and duplicate semantics", () => {
  const baseline = failureCandidateV3();
  assert.deepEqual(validateFailureCandidate(baseline), []);

  const cases = [
    ["not_started.*zero", (candidate) => {
      candidate.diagnostic.session_observations[3].stdout_bytes = 1;
    }],
    ["process close.*exit code or signal", (candidate) => {
      candidate.diagnostic.session_observations[2].exit_code = null;
    }],
    ["event count.*sum", (candidate) => {
      candidate.diagnostic.session_observations[0].event_counts.total += 1;
    }],
    ["item count.*sum", (candidate) => {
      candidate.diagnostic.session_observations[2].item_counts.total += 1;
    }],
    ["MCP status count.*sum", (candidate) => {
      candidate.diagnostic.session_observations[2].mcp_status_counts.completed = 1;
    }],
    ["thread presence", (candidate) => {
      candidate.diagnostic.session_observations[1].thread_present = false;
    }],
    ["malformed.*parse_failed|completed.*one valid thread", (candidate) => {
      candidate.diagnostic.session_observations[0].failure_stage = "completed";
    }],
    ["multiple valid thread.*parse_failed", (candidate) => {
      candidate.diagnostic.session_observations[1].failure_stage = "completed";
    }],
  ];
  for (const [expected, mutate] of cases) {
    const candidate = structuredClone(baseline);
    mutate(candidate);
    rebindFailureCandidate(candidate);
    assert.match(validateFailureCandidate(candidate).join("\n"), new RegExp(expected, "i"), expected);
  }
});

test("v3 command context is attributable, not inferred from an earlier unrelated command", () => {
  const unrelatedCommand = failureCandidateV3({ failureKind: "non_command" });
  assert.equal(
    unrelatedCommand.diagnostic.session_observations[2].item_counts.command_execution,
    1,
  );
  assert.equal(Object.hasOwn(unrelatedCommand.diagnostic, "failure_context"), false);
  assert.deepEqual(validateFailureCandidate(unrelatedCommand), []);

  const attributableCommand = failureCandidateV3({ failureKind: "command_event" });
  assert.deepEqual(validator.validateDocumentStructure(attributableCommand.diagnostic, diagnosticSchema), []);
  assert.deepEqual(validateFailureCandidate(attributableCommand), []);

  const missingContext = structuredClone(attributableCommand);
  delete missingContext.diagnostic.failure_context;
  rebindFailureCandidate(missingContext);
  assert.match(
    validator.validateDocumentStructure(missingContext.diagnostic, diagnosticSchema).join("\n"),
    /failure_context.*required/i,
  );
  assert.match(validateFailureCandidate(missingContext).join("\n"), /command_event.*failure_context/i);

  const unrelatedContext = structuredClone(unrelatedCommand);
  unrelatedContext.diagnostic.failure_context = structuredClone(
    attributableCommand.diagnostic.failure_context,
  );
  rebindFailureCandidate(unrelatedContext);
  assert.match(
    validator.validateDocumentStructure(unrelatedContext.diagnostic, diagnosticSchema).join("\n"),
    /failure_context.*forbidden|must not satisfy/i,
  );
  assert.match(validateFailureCandidate(unrelatedContext).join("\n"), /non_command.*prohibits.*failure_context/i);

  const unboundContext = structuredClone(attributableCommand);
  unboundContext.diagnostic.failure_context.session_role = "ordinary";
  rebindFailureCandidate(unboundContext);
  assert.match(
    validateFailureCandidate(unboundContext).join("\n"),
    /failure_context.*completed command event.*same session role/i,
  );
});

test("v3 diagnostic and facts reject raw payloads, paths, thread IDs, and extra fields", () => {
  const structuralLeaks = [
    ["raw failure", (document) => { document.failure.raw = "host stderr"; }],
    ["raw command", (document) => { document.failure_context.command = renderedProofCommand; }],
    ["repository path", (document) => { document.repository_path = "/tmp/private/repository"; }],
    ["thread ID", (document) => { document.session_observations[0].thread_id = "thread-secret"; }],
    ["raw stdout", (document) => { document.session_observations[0].stdout = "secret"; }],
    ["skip path", (document) => {
      document.skips.push({
        phase_code: "cleanup",
        reason_code: "blocked",
        detail_sha256: "e".repeat(64),
        path: "/tmp/private/repository",
      });
    }],
  ];
  for (const [label, mutate] of structuralLeaks) {
    const candidate = failureCandidateV3({ failureKind: "command_event" });
    mutate(candidate.diagnostic);
    assert.notDeepEqual(
      validator.validateDocumentStructure(candidate.diagnostic, diagnosticSchema),
      [],
      label,
    );
    assert.match(
      validateFailureCandidate(candidate).join("\n"),
      /failure diagnostic:.*not allowed/i,
      `${label} must fail the combined pre-write gate`,
    );
  }

  const factsLeak = failureCandidateV3();
  factsLeak.observedFacts.raw_jsonl = "{\"type\":\"thread.started\"}";
  assert.match(
    validateFailureCandidate(factsLeak).join("\n"),
    /failure observed facts.*closed exact diagnostic projection/i,
  );
});

test("schema walker enforces not for reserved ledger entries", () => {
  const candidate = passingCandidate();
  const ledger = structuredClone(candidate.documents["native-attempt-ledger"]);
  ledger.attempts[0].status = "reserved";
  delete ledger.attempts[0].completed_at;
  delete ledger.attempts[0].observed_facts_sha256;
  assert.deepEqual(validator.validateDocumentStructure(ledger, schemas["native-attempt-ledger"]), []);

  ledger.attempts[0].completed_at = "2026-08-16T02:00:00.000Z";
  assert.match(
    validator.validateDocumentStructure(ledger, schemas["native-attempt-ledger"]).join("\n"),
    /must not satisfy|forbidden/i,
  );
});

test("ledger semantics close numbering, identity, finalization, pass, and reservation placement", () => {
  const validHistories = [
    [],
    [ledgerAttempt(1, "reserved")],
    [ledgerAttempt(1, "failed"), ledgerAttempt(2, "reserved")],
    [ledgerAttempt(1, "failed"), ledgerAttempt(2, "blocked")],
    [ledgerAttempt(1, "failed"), ledgerAttempt(2, "pass")],
  ];
  for (const attempts of validHistories) {
    assert.deepEqual(
      validator.validateAttemptLedgerSemantics({ schema_version: 1, ledger_id: "a".repeat(64), attempts }),
      [],
    );
  }

  const cases = [
    ["sequential attempt numbers", [ledgerAttempt(2, "failed")]],
    ["unique chain IDs", [ledgerAttempt(1, "failed"), { ...ledgerAttempt(2, "blocked"), chain_id: "1".repeat(64) }]],
    ["unique source commits", [ledgerAttempt(1, "failed"), { ...ledgerAttempt(2, "blocked"), source_commit: "1".repeat(40) }]],
    ["at most one passing", [ledgerAttempt(1, "pass"), ledgerAttempt(2, "pass")]],
    ["passing attempt must be final", [ledgerAttempt(1, "pass"), ledgerAttempt(2, "failed")]],
    ["at most one reserved", [ledgerAttempt(1, "reserved"), ledgerAttempt(2, "reserved")]],
    ["reserved attempt must be final", [ledgerAttempt(1, "reserved"), ledgerAttempt(2, "failed")]],
    ["reserved attempt must not be finalized", [{ ...ledgerAttempt(1, "reserved"), completed_at: "2026-08-16T02:00:00.000Z" }]],
    ["reserved attempt must not have observed facts", [{ ...ledgerAttempt(1, "reserved"), observed_facts_sha256: "f".repeat(64) }]],
    ["finalized attempt requires completed_at", [without(ledgerAttempt(1, "failed"), "completed_at")]],
    ["finalized attempt requires observed facts", [without(ledgerAttempt(1, "failed"), "observed_facts_sha256")]],
  ];
  for (const [expected, attempts] of cases) {
    assert.match(
      validator.validateAttemptLedgerSemantics({ schema_version: 1, ledger_id: "a".repeat(64), attempts }).join("\n"),
      new RegExp(expected, "i"),
      expected,
    );
  }
});

test("candidate validation rejects exact-byte report, artifact, ledger, and facts substitution", () => {
  const cases = [
    ["validation report exact-byte digest", (candidate) => {
      candidate.validationReportText = `${candidate.validationReportText.trimEnd()}  \n`;
    }],
    ["validation report exact-byte digest", (candidate) => {
      const report = JSON.parse(candidate.validationReportText);
      report.completed_at = "2026-08-16T01:20:00.001Z";
      candidate.validationReportText = encode(report);
    }],
    ["artifact report exact-byte digest", (candidate) => {
      candidate.artifactReportText = `${candidate.artifactReportText.trimEnd()}  \n`;
    }],
    ["artifact SHA-256", (candidate) => {
      candidate.artifactSha256 = "f".repeat(64);
    }],
    ["attempt ledger exact-byte digest", (candidate) => {
      candidate.attemptLedgerText = `${candidate.attemptLedgerText.trimEnd()}  \n`;
    }],
    ["observed facts exact-byte digest", (candidate) => {
      candidate.observedFactsText = `${candidate.observedFactsText.trimEnd()}  \n`;
    }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation enforces writer-owned compatibility query and report time ordering", () => {
  const cases = [
    ["compatibility query.*targeted", (candidate) => {
      candidate.documents["validation-report"].codex_revalidation.queried_at = "2026-08-16T01:07:00.000Z";
    }],
    ["targeted.*report completion", (candidate) => {
      candidate.documents["validation-report"].targeted_checks[1].completed_at = "2026-08-16T01:21:00.000Z";
    }],
    ["root validation.*report completion", (candidate) => {
      candidate.documents["validation-report"].root_validation.completed_at = "2026-08-16T01:21:00.000Z";
    }],
    ["targeted command completion order", (candidate) => {
      candidate.documents["validation-report"].targeted_checks[0].completed_at = "2026-08-16T01:10:00.000Z";
    }],
    ["root validation.*after.*targeted", (candidate) => {
      candidate.documents["validation-report"].root_validation.completed_at = "2026-08-16T01:08:00.000Z";
    }],
    ["validation completion.*artifact build", (candidate) => {
      candidate.documents["artifact-report"].built_at = "2026-08-16T01:19:59.999Z";
      candidate.documents["journey-evidence"].identity.artifact_built_at = "2026-08-16T01:19:59.999Z";
    }],
    ["artifact build.*evidence recording", (candidate) => {
      candidate.documents["artifact-report"].built_at = candidate.documents["journey-evidence"].recorded_at;
      candidate.documents["journey-evidence"].identity.artifact_built_at = candidate.documents["journey-evidence"].recorded_at;
    }],
    ["resolved Codex version", (candidate) => {
      candidate.documents["validation-report"].codex_revalidation.resolved_version = "0.147.1";
    }],
    ["compatibility range", (candidate) => {
      candidate.documents["validation-report"].codex_revalidation.compatible_range = ">=0.146.0 <0.147.0";
    }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    refreshRawInputs(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation requires the exact ordered targeted set and exact root command", () => {
  const cases = [
    ["exact ordered targeted commands", (checks) => checks.splice(1, 1)],
    ["exact ordered targeted commands", (checks) => checks.push({ ...checks[1], command: "node --test extra.test.mjs" })],
    ["exact ordered targeted commands", (checks) => checks.push(structuredClone(checks[1]))],
    ["exact ordered targeted commands", (checks) => checks.reverse()],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate.documents["validation-report"].targeted_checks);
    candidate.documents["journey-evidence"].validation.targeted_checks = structuredClone(
      candidate.documents["validation-report"].targeted_checks,
    );
    refreshRawInputs(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }

  const wrongRoot = passingCandidate();
  wrongRoot.documents["validation-report"].root_validation.command = "pnpm validate";
  wrongRoot.documents["journey-evidence"].validation.root_validation.command = "pnpm validate";
  refreshRawInputs(wrongRoot);
  assert.match(allErrors(candidateResult(wrongRoot)), /root validation command|must equal "pnpm run validate"/i);
});

test("candidate validation requires an exact evidence projection of validation observations", () => {
  const cases = [
    ["validation completed_at projection", (candidate) => {
      candidate.documents["journey-evidence"].validation.completed_at = "2026-08-16T01:20:00.001Z";
    }],
    ["targeted-check projection", (candidate) => {
      candidate.documents["journey-evidence"].validation.targeted_checks[0].completed_at = "2026-08-16T01:04:00.001Z";
    }],
    ["root-validation projection", (candidate) => {
      candidate.documents["journey-evidence"].validation.root_validation.completed_at = "2026-08-16T01:14:00.001Z";
    }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    candidate.evidenceText = encode(candidate.documents["journey-evidence"]);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation binds source, versions, artifact identity, and report identities", () => {
  const cases = [
    ["package/Core", (candidate) => { candidate.documents["journey-evidence"].versions.core = "0.1.1"; }],
    ["repository VERSION", (candidate) => {
      candidate.documents["journey-evidence"].versions.package = "0.2.0";
      candidate.documents["journey-evidence"].versions.core = "0.2.0";
    }],
    ["source commit", (candidate) => { candidate.documents["artifact-report"].source_commit = "d".repeat(40); }],
    ["artifact built_at identity", (candidate) => {
      candidate.documents["journey-evidence"].identity.artifact_built_at = "2026-08-16T01:25:00.001Z";
    }],
    ["artifact path identity", (candidate) => { candidate.artifactPath = "/tmp/substituted.tgz"; }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    refreshRawInputs(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation enforces durable ledger identity, digest, count, uniqueness, and pass entry", () => {
  const cases = [
    ["ledger path identity", (candidate) => {
      candidate.attemptLedgerPath = "/tmp/switched-dev-flow-codex-native-attempts.json";
    }],
    ["attempt count", (candidate) => {
      candidate.documents["journey-evidence"].native_attempt.total_attempts = 2;
    }],
    ["sequential attempt numbers", (candidate) => {
      candidate.documents["native-attempt-ledger"].attempts[0].attempt_number = 2;
    }],
    ["unique chain IDs", (candidate) => {
      const duplicate = structuredClone(candidate.documents["native-attempt-ledger"].attempts[0]);
      duplicate.attempt_number = 2;
      duplicate.source_commit = "d".repeat(40);
      candidate.documents["native-attempt-ledger"].attempts.push(duplicate);
      candidate.documents["journey-evidence"].native_attempt.total_attempts = 2;
    }],
    ["unique source commits", (candidate) => {
      const duplicate = structuredClone(candidate.documents["native-attempt-ledger"].attempts[0]);
      duplicate.attempt_number = 2;
      duplicate.chain_id = "9".repeat(64);
      candidate.documents["native-attempt-ledger"].attempts.push(duplicate);
      candidate.documents["journey-evidence"].native_attempt.total_attempts = 2;
    }],
    ["exactly one passing attempt", (candidate) => {
      candidate.documents["native-attempt-ledger"].attempts[0].status = "failed";
    }],
    ["chain ID derivation", (candidate) => {
      candidate.documents["native-attempt-ledger"].attempts[0].chain_id = "9".repeat(64);
      candidate.documents["journey-evidence"].native_attempt.chain_id = "9".repeat(64);
    }],
    ["commit protocol", (candidate) => {
      candidate.documents["journey-evidence"].native_attempt.commit_protocol = "external-failure-record-v1";
    }],
    ["observed facts", (candidate) => {
      candidate.documents["native-attempt-ledger"].attempts[0].observed_facts_sha256 = "9".repeat(64);
    }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    refreshRawInputs(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation enforces passing lineage, call budget, lifecycle, and retained state", () => {
  const cases = [
    ["four.*thread IDs", (evidence) => { evidence.journey.task_lineage.thread_ids[3] = evidence.journey.task_lineage.thread_ids[2]; }],
    ["raw task revisions.*regress", (evidence) => { evidence.journey.task_lineage.raw_revisions = [1, 4, 3, 8]; }],
    ["adjacent-deduplicated", (evidence) => { evidence.journey.task_lineage.revisions = [1, 3, 8]; }],
    ["strictly increasing", (evidence) => { evidence.journey.task_lineage.revisions = [1, 4, 4]; }],
    ["committed-action revision", (evidence) => { evidence.journey.task_lineage.committed_actions[1].revision = 7; }],
    ["unique action IDs", (evidence) => { evidence.journey.task_lineage.committed_actions[1].action_id = "action-1"; }],
    ["same task ID", (evidence) => { evidence.journey.task_lineage.task_id_after_restart = "task-other"; }],
    ["at least two", (evidence) => { evidence.journey.task_lineage.committed_actions = evidence.journey.task_lineage.committed_actions.slice(0, 1); }],
    ["call budget", (evidence) => { evidence.journey.invocation.core_call_count = 11; }],
    ["DONE", (evidence) => { evidence.journey.task_lineage.terminal_outcome = "BLOCKED"; }],
    ["terminal phase", (evidence) => { evidence.journey.task_lineage.terminal_phase = "BLOCKED"; }],
    ["restart recovery reads", (evidence) => { evidence.journey.invocation.restart_recovery_reads.reverse(); }],
    ["verification command count", (evidence) => { evidence.journey.invocation.submitted_automated_command_count = 2; }],
    ["verification command count", (evidence) => { evidence.journey.invocation.retained_automated_command_count = 2; }],
    ["verification budget", (evidence) => { evidence.journey.invocation.verification_budget.max_automatic_commands = 0; }],
    ["full-suite", (evidence) => {
      evidence.journey.invocation.verification_commands[0].full_suite = true;
      evidence.journey.invocation.submitted_full_suite = true;
      evidence.journey.invocation.retained_full_suite = true;
    }],
    ["unique item IDs", (evidence) => {
      evidence.journey.invocation.verification_commands.push(structuredClone(
        evidence.journey.invocation.verification_commands[0],
      ));
      evidence.journey.invocation.submitted_automated_command_count = 2;
      evidence.journey.invocation.retained_automated_command_count = 2;
    }],
    ["task-data file lists", (evidence) => { evidence.journey.task_data.files_after_removal.push("lost.db"); }],
    ["task-data manifest", (evidence) => { evidence.journey.task_data.manifest_after_removal_sha256 = "9".repeat(64); }],
    ["repository digest", (evidence) => { evidence.journey.repository.digest_after_removal = "8".repeat(64); }],
    ["unexpected changed paths", (evidence) => { evidence.journey.repository.unexpected_changed_paths.push("secret.txt"); }],
    ["lifecycle", (evidence) => { evidence.journey.lifecycle.remove_readback_passed = false; }],
    ["setup registry", (evidence) => { evidence.journey.lifecycle.setup_registry.marketplaces_total = 2; }],
    ["reinstall registry", (evidence) => { evidence.journey.lifecycle.reinstall_registry.available_total = 1; }],
    ["retained-data descriptor", (evidence) => { evidence.journey.task_data.retained_data_location.workspace_relative_path = "/tmp/secret"; }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate.documents["journey-evidence"]);
    candidate.evidenceText = encode(candidate.documents["journey-evidence"]);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation binds Core-derived journey, verification, recovery, and terminal facts", () => {
  const cases = [
    ["durable observed journey", (candidate) => {
      candidate.documents["observed-facts"].journey.invocation.core_call_count -= 1;
    }],
    ["verification budget projection", (candidate) => {
      candidate.documents["observed-facts"].verification.budget.max_automatic_commands += 1;
    }],
    ["command execution projection", (candidate) => {
      candidate.documents["observed-facts"].verification.command_executions[0].command = "node --test substituted.test.mjs";
    }],
    ["submitted automated checks", (candidate) => {
      candidate.documents["observed-facts"].verification.submitted_automated_checks[0].name = "node --test substituted.test.mjs";
    }],
    ["retained automated checks", (candidate) => {
      candidate.documents["observed-facts"].verification.retained_automated_checks[0].command_count = 2;
    }],
    ["restart recovery.*before.*apply", (candidate) => {
      candidate.documents["observed-facts"].sessions.resume.calls = [
        { tool: "dev_flow_apply_action" },
        { tool: "dev_flow_get_task" },
        { tool: "dev_flow_get_next_action" },
      ];
    }],
    ["terminal task phase", (candidate) => {
      candidate.documents["observed-facts"].terminal_task.phase = "VERIFY";
    }],
    ["terminal task outcome", (candidate) => {
      candidate.documents["observed-facts"].terminal_task.outcome.status = "blocked";
    }],
    ["raw task revision projection", (candidate) => {
      candidate.documents["observed-facts"].sessions.resume.calls[0].revision = 3;
    }],
    ["four.*thread IDs", (candidate) => {
      candidate.documents["observed-facts"].sessions.invalid.thread_id = "thread-ordinary";
    }],
    ["retained-data descriptor", (candidate) => {
      candidate.documents["observed-facts"].task_data.retained_data_location.canonical_path_sha256 = "f".repeat(64);
    }],
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    refreshObservedFacts(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("candidate validation enforces session-aware safe command facts and one bound proof", () => {
  const baseline = passingCandidate();
  const invocation = baseline.documents["journey-evidence"].journey.invocation;
  assert.deepEqual(
    invocation.session_command_facts.map((fact) => fact.session_role),
    ["ordinary", "invalid", "substantive", "resume"],
  );
  assert.deepEqual(
    invocation.session_command_facts.map((fact) => fact.classification),
    ["nonverification", "nonverification", "nonverification", "verification"],
  );
  assert.equal(invocation.verification_commands.length, 1);
  assert.equal(invocation.verification_commands[0].logical_proof_name, logicalProofName);
  assert.equal(invocation.verification_commands[0].rendered_command_sha256, sha256(renderedProofCommand));
  assert.equal(baseline.evidenceText.includes(renderedProofCommand), false);
  assert.equal(baseline.evidenceText.includes(renderedRootGateCommand), false);
  const rawLeak = structuredClone(baseline.documents["journey-evidence"]);
  rawLeak.journey.invocation.session_command_facts[0].command = "/bin/zsh -lc 'git status --short'";
  assert.match(
    validator.validateEvidenceStructure(rawLeak, schemas["journey-evidence"]).join("\n"),
    /command.*not allowed/i,
  );

  const cases = [
    ["session command facts.*exact", (candidate) => {
      candidate.documents["observed-facts"].verification.session_command_facts[0].command_sha256 = "f".repeat(64);
    }],
    ["ordinary.*nonverification", (candidate) => {
      updateInvocationFact(candidate, 0, { classification: "verification" });
    }],
    ["invalid.*nonverification", (candidate) => {
      updateInvocationFact(candidate, 1, { classification: "verification" });
    }],
    ["ordinary.*zero Dev Flow calls", (candidate) => {
      candidate.documents["observed-facts"].sessions.ordinary.calls.push({
        tool: "dev_flow_server_info",
        revision: null,
      });
    }],
    ["invalid.*zero Dev Flow calls", (candidate) => {
      candidate.documents["observed-facts"].sessions.invalid.calls.push({
        tool: "dev_flow_server_info",
        revision: null,
      });
    }],
    ["bound.*role.*event.*item.*digest|proof subset.*bound", (candidate) => {
      const proof = candidate.documents["journey-evidence"].journey.invocation.verification_commands[0];
      proof.event_index = 7;
      synchronizeJourneyVerification(candidate);
    }],
    ["duplicate proof", (candidate) => {
      const facts = candidate.documents["journey-evidence"].journey.invocation.session_command_facts;
      facts.push(commandFact({
        sessionRole: "substantive",
        eventIndex: 1,
        itemID: "duplicate-proof-command",
        renderedCommand: renderedProofCommand,
        output: "0123456789abcdef0123456789abcdef01234567\n",
        status: "completed",
        exitCode: 0,
        classification: "verification",
      }));
      synchronizeJourneyVerification(candidate);
    }],
    ...renderedDeniedCommands.map((renderedCommand) => [
      "known test/full-suite.*pnpm run validate|known test/full-suite.*forbidden",
      (candidate) => {
        updateInvocationFact(candidate, 2, { command_sha256: sha256(renderedCommand) });
      },
    ]),
  ];

  for (const [expected, mutate] of cases) {
    const candidate = passingCandidate();
    mutate(candidate);
    refreshObservedFacts(candidate);
    assert.match(allErrors(candidateResult(candidate)), new RegExp(expected, "i"), expected);
  }
});

test("journey evidence is pass-only and failed attempts cannot masquerade as schema-v3 evidence", () => {
  const external = failedCandidate();
  assert.match(allErrors(candidateResult(external)), /status.*pass|commit_protocol|failures/i);
  assert.deepEqual(
    validator.validateDocumentStructure(attemptDiagnostic("failed"), diagnosticSchema),
    [],
  );
});

test("bound evidence-file validation loads every schema, artifact/root identity, facts, and full pass semantics", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dev-flow-bound-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const cases = [
    ["valid", null, null],
    ["journey-evidence.*not allowed", (candidate) => { candidate.documents["journey-evidence"].unexpected = true; }, null],
    ["validation-report.*not allowed", (candidate) => { candidate.documents["validation-report"].unexpected = true; }, null],
    ["artifact-report.*not allowed", (candidate) => { candidate.documents["artifact-report"].unexpected = true; }, null],
    ["native-attempt-ledger.*not allowed", (candidate) => { candidate.documents["native-attempt-ledger"].unexpected = true; }, null],
    ["terminal_phase|terminal phase", (candidate) => {
      candidate.documents["journey-evidence"].journey.task_lineage.terminal_phase = "BLOCKED";
      candidate.documents["observed-facts"].journey.task_lineage.terminal_phase = "BLOCKED";
    }, null],
    ["terminal_outcome|terminal outcome", (candidate) => {
      candidate.documents["journey-evidence"].journey.task_lineage.terminal_outcome = "BLOCKED";
      candidate.documents["observed-facts"].journey.task_lineage.terminal_outcome = "BLOCKED";
    }, null],
    ["repository VERSION", null, "9.9.9\n"],
    ["actual artifact SHA-256", null, null, Buffer.from("substituted artifact")],
  ];

  for (const [expected, mutate, versionOverride, artifactOverride] of cases) {
    const caseRoot = join(root, expected.replaceAll(/[^A-Za-z0-9]+/g, "-"));
    await mkdir(caseRoot, { recursive: true });
    const bound = await writeBoundCandidate(caseRoot, { mutate, versionOverride, artifactOverride });
    const result = await validator.validateEvidenceFile(bound.evidencePath, {
      validationReportPath: bound.validationReportPath,
      artifactReportPath: bound.artifactReportPath,
      attemptLedgerPath: bound.attemptLedgerPath,
      canonicalEvidencePath: bound.evidencePath,
      versionPath: bound.versionPath,
    });
    if (expected === "valid") {
      assert.deepEqual(result, { valid: true, structuralErrors: [], semanticErrors: [] });
    } else {
      assert.match(allErrors(result), new RegExp(expected, "i"), expected);
    }
  }
});

test("internal post-publication recovery checks exact bytes and identities without mutation", () => {
  const candidate = passingCandidate();
  const base = {
    evidenceText: candidate.evidenceText,
    expectedEvidenceText: candidate.evidenceText,
    attemptLedgerText: candidate.attemptLedgerText,
    expectedAttemptLedgerText: candidate.attemptLedgerText,
    attemptLedgerPath,
    expectedLedgerId: candidate.documents["native-attempt-ledger"].ledger_id,
  };
  assert.deepEqual(validator.validatePublishedEvidence(base), { valid: true, errors: [] });

  assert.match(
    validator.validatePublishedEvidence({ ...base, evidenceText: `${base.evidenceText} ` }).errors.join("\n"),
    /published evidence bytes/i,
  );
  assert.match(
    validator.validatePublishedEvidence({ ...base, attemptLedgerText: `${base.attemptLedgerText} ` }).errors.join("\n"),
    /published ledger bytes/i,
  );
  assert.match(
    validator.validatePublishedEvidence({ ...base, attemptLedgerPath: "/tmp/switched-ledger.json" }).errors.join("\n"),
    /ledger path identity/i,
  );
});

function candidateResult(candidate) {
  return validator.validateEvidenceCandidate({
    evidenceText: candidate.evidenceText,
    validationReportText: candidate.validationReportText,
    artifactReportText: candidate.artifactReportText,
    attemptLedgerText: candidate.attemptLedgerText,
    observedFactsText: candidate.observedFactsText,
    artifactSha256: candidate.artifactSha256,
    artifactPath: candidate.artifactPath,
    attemptLedgerPath: candidate.attemptLedgerPath,
    evidencePath: candidate.evidencePath,
    canonicalEvidencePath,
    rootVersion,
    schemas,
  });
}

function passingCandidate() {
  const sourceCommit = "c".repeat(40);
  const artifactPath = "/tmp/dev-flow codex final/dev-flow-codex-0.1.0.tgz";
  const artifactSha256 = "a".repeat(64);
  const journey = passingJourney();
  const observedFacts = {
    schema_version: 1,
    source_commit: sourceCommit,
    terminal_outcome: "DONE",
    task_id: "task-1",
    journey: structuredClone(journey),
    verification: verificationFacts(journey.invocation),
    sessions: {
      ordinary: { thread_id: journey.task_lineage.thread_ids[0], calls: [] },
      invalid: { thread_id: journey.task_lineage.thread_ids[1], calls: [] },
      substantive: {
        thread_id: journey.task_lineage.thread_ids[2],
        calls: [
          { tool: "dev_flow_open_task", revision: 1 },
          { tool: "dev_flow_get_next_action", revision: 1 },
          { tool: "dev_flow_apply_action", revision: 4 },
        ],
      },
      resume: {
        thread_id: journey.task_lineage.thread_ids[3],
        calls: [
          { tool: "dev_flow_get_task", revision: 4 },
          { tool: "dev_flow_get_next_action", revision: 4 },
          { tool: "dev_flow_apply_action", revision: 8 },
        ],
      },
    },
    terminal_task: {
      phase: "DONE",
      outcome: { status: "completed" },
    },
    task_data: structuredClone(journey.task_data),
  };
  const observedFactsText = encode(observedFacts);
  const observedFactsSha256 = sha256(observedFactsText);
  const ledgerId = ledgerIdentity(attemptLedgerPath);

  const validationReport = {
    schema_version: 1,
    report_type: "dev-flow-codex-validation",
    source_commit: sourceCommit,
    source_dirty: false,
    attempt_ledger_id: ledgerId,
    codex_revalidation: {
      package: "@openai/codex",
      dist_tag: "latest",
      resolved_version: "0.147.0",
      compatible_range: ">=0.147.0 <0.148.0",
      queried_at: "2026-08-16T01:00:00.000Z",
    },
    completed_at: "2026-08-16T01:20:00.000Z",
    targeted_checks: expectedTargetedCommands.map((command, index) => ({
      command,
      result: "pass",
      source_commit: sourceCommit,
      completed_at: `2026-08-16T01:0${index === 0 ? 5 : 9}:00.000Z`,
    })),
    root_validation: {
      command: "pnpm run validate",
      result: "pass",
      source_commit: sourceCommit,
      completed_at: "2026-08-16T01:15:00.000Z",
    },
  };
  const validationReportText = encode(validationReport);

  const artifactReport = {
    schema_version: 1,
    report_type: "dev-flow-codex-final-artifact",
    artifact_path: artifactPath,
    artifact_sha256: artifactSha256,
    package_version: rootVersion,
    core_version: rootVersion,
    codex_compatibility: ">=0.147.0 <0.148.0",
    source_commit: sourceCommit,
    source_dirty: false,
    final_artifact: true,
    platform: "darwin-arm64",
    package_allowlist_verified: true,
    runtime_executable_verified: true,
    built_at: "2026-08-16T01:25:00.000Z",
  };
  const artifactReportText = encode(artifactReport);
  const validationReportSha256 = sha256(validationReportText);
  const artifactReportSha256 = sha256(artifactReportText);
  const chainId = chainIdentity({
    source_commit: sourceCommit,
    validation_report_sha256: validationReportSha256,
    artifact_report_sha256: artifactReportSha256,
    artifact_sha256: artifactSha256,
  });

  const attemptLedger = {
    schema_version: 1,
    ledger_id: ledgerId,
    attempts: [
      {
        attempt_number: 1,
        chain_id: chainId,
        source_commit: sourceCommit,
        validation_report_sha256: validationReportSha256,
        artifact_report_sha256: artifactReportSha256,
        artifact_sha256: artifactSha256,
        reserved_at: "2026-08-16T01:30:00.000Z",
        completed_at: "2026-08-16T02:00:00.000Z",
        status: "pass",
        observed_facts_sha256: observedFactsSha256,
      },
    ],
  };
  const attemptLedgerText = encode(attemptLedger);

  const evidence = {
    schema_version: 3,
    status: "pass",
    recorded_at: "2026-08-16T02:05:00.000Z",
    classification: {
      evidence_type: "native-host",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: "0.147.0",
      codex_compatibility: ">=0.147.0 <0.148.0",
      package: rootVersion,
      core: rootVersion,
      core_contract: "0.1",
    },
    identity: {
      source_commit: sourceCommit,
      artifact_sha256: artifactSha256,
      artifact_report_sha256: artifactReportSha256,
      artifact_built_at: artifactReport.built_at,
      shared_fixtures_sha256: "b".repeat(64),
    },
    validation: {
      report_sha256: validationReportSha256,
      completed_at: validationReport.completed_at,
      targeted_checks: structuredClone(validationReport.targeted_checks),
      root_validation: structuredClone(validationReport.root_validation),
    },
    native_attempt: {
      chain_id: chainId,
      ledger_id: ledgerId,
      attempt_number: 1,
      total_attempts: 1,
      ledger_sha256: sha256(attemptLedgerText),
      commit_protocol: "evidence-create-before-ledger-finalize-v1",
      observed_facts_sha256: observedFactsSha256,
    },
    journey,
    failures: [],
    skips: [],
  };

  return {
    documents: {
      "validation-report": validationReport,
      "artifact-report": artifactReport,
      "native-attempt-ledger": attemptLedger,
      "journey-evidence": evidence,
      "observed-facts": observedFacts,
    },
    validationReportText,
    artifactReportText,
    attemptLedgerText,
    evidenceText: encode(evidence),
    observedFactsText,
    artifactSha256,
    artifactPath,
    attemptLedgerPath,
    evidencePath: canonicalEvidencePath,
  };
}

function failedCandidate() {
  const candidate = passingCandidate();
  const evidence = candidate.documents["journey-evidence"];
  const ledger = candidate.documents["native-attempt-ledger"];
  evidence.status = "failed";
  evidence.failures = [observation("journey", "host failed", "Codex exited 1")];
  evidence.native_attempt.commit_protocol = "external-failure-record-v1";
  ledger.attempts[0].status = "failed";
  candidate.attemptLedgerText = encode(ledger);
  evidence.native_attempt.ledger_sha256 = sha256(candidate.attemptLedgerText);
  candidate.evidenceText = encode(evidence);
  candidate.evidencePath = "/tmp/dev-flow-codex-chain/recovery/failure.json";
  return candidate;
}

function refreshRawInputs(candidate) {
  const validationReport = candidate.documents["validation-report"];
  const artifactReport = candidate.documents["artifact-report"];
  const ledger = candidate.documents["native-attempt-ledger"];
  const evidence = candidate.documents["journey-evidence"];

  candidate.validationReportText = encode(validationReport);
  candidate.artifactReportText = encode(artifactReport);
  evidence.validation.report_sha256 = sha256(candidate.validationReportText);
  evidence.identity.artifact_report_sha256 = sha256(candidate.artifactReportText);
  if (ledger.attempts[0]) {
    ledger.attempts[0].validation_report_sha256 = evidence.validation.report_sha256;
    ledger.attempts[0].artifact_report_sha256 = evidence.identity.artifact_report_sha256;
  }
  candidate.attemptLedgerText = encode(ledger);
  evidence.native_attempt.ledger_sha256 = sha256(candidate.attemptLedgerText);
  candidate.evidenceText = encode(evidence);
}

function refreshObservedFacts(candidate) {
  candidate.observedFactsText = encode(candidate.documents["observed-facts"]);
  const digest = sha256(candidate.observedFactsText);
  const evidence = candidate.documents["journey-evidence"];
  const ledger = candidate.documents["native-attempt-ledger"];
  evidence.native_attempt.observed_facts_sha256 = digest;
  const entry = ledger.attempts[evidence.native_attempt.attempt_number - 1];
  if (entry) entry.observed_facts_sha256 = digest;
  candidate.attemptLedgerText = encode(ledger);
  evidence.native_attempt.ledger_sha256 = sha256(candidate.attemptLedgerText);
  candidate.evidenceText = encode(evidence);
}

async function writeBoundCandidate(root, {
  mutate,
  versionOverride,
  artifactOverride,
} = {}) {
  const candidate = passingCandidate();
  const artifactPath = join(root, "dev-flow-codex.tgz");
  const attemptLedgerPath = join(root, "native-attempts.json");
  const evidencePath = join(root, "evidence.json");
  const validationReportPath = join(root, "validation-report.json");
  const artifactReportPath = join(root, "artifact-report.json");
  const versionPath = join(root, "VERSION");
  const artifactBytes = Buffer.from("bound final artifact");

  candidate.artifactPath = artifactPath;
  candidate.attemptLedgerPath = attemptLedgerPath;
  candidate.evidencePath = evidencePath;
  candidate.artifactSha256 = sha256(artifactBytes);
  candidate.documents["artifact-report"].artifact_path = artifactPath;
  candidate.documents["artifact-report"].artifact_sha256 = candidate.artifactSha256;
  candidate.documents["journey-evidence"].identity.artifact_sha256 = candidate.artifactSha256;

  const ledgerId = validator.deriveAttemptLedgerId(attemptLedgerPath);
  candidate.documents["validation-report"].attempt_ledger_id = ledgerId;
  candidate.documents["native-attempt-ledger"].ledger_id = ledgerId;
  candidate.documents["journey-evidence"].native_attempt.ledger_id = ledgerId;
  if (mutate) mutate(candidate);
  refreshBoundCandidate(candidate);

  const chainId = candidate.documents["journey-evidence"].native_attempt.chain_id;
  const observedFactsPath = join(`${attemptLedgerPath}.recovery`, chainId, "observed-facts.json");
  await mkdir(dirname(observedFactsPath), { recursive: true });
  await Promise.all([
    writeFile(evidencePath, candidate.evidenceText),
    writeFile(validationReportPath, candidate.validationReportText),
    writeFile(artifactReportPath, candidate.artifactReportText),
    writeFile(attemptLedgerPath, candidate.attemptLedgerText),
    writeFile(observedFactsPath, candidate.observedFactsText),
    writeFile(artifactPath, artifactOverride ?? artifactBytes),
    writeFile(versionPath, versionOverride ?? `${rootVersion}\n`),
  ]);
  return {
    evidencePath,
    validationReportPath,
    artifactReportPath,
    attemptLedgerPath,
    versionPath,
  };
}

function refreshBoundCandidate(candidate) {
  const evidence = candidate.documents["journey-evidence"];
  const validationReport = candidate.documents["validation-report"];
  const artifactReport = candidate.documents["artifact-report"];
  const ledger = candidate.documents["native-attempt-ledger"];
  const facts = candidate.documents["observed-facts"];

  candidate.validationReportText = encode(validationReport);
  candidate.artifactReportText = encode(artifactReport);
  candidate.observedFactsText = encode(facts);
  const validationDigest = sha256(candidate.validationReportText);
  const artifactReportDigest = sha256(candidate.artifactReportText);
  const observedFactsDigest = sha256(candidate.observedFactsText);
  evidence.validation.report_sha256 = validationDigest;
  evidence.identity.artifact_report_sha256 = artifactReportDigest;
  const chainId = chainIdentity({
    source_commit: evidence.identity.source_commit,
    validation_report_sha256: validationDigest,
    artifact_report_sha256: artifactReportDigest,
    artifact_sha256: evidence.identity.artifact_sha256,
  });
  evidence.native_attempt.chain_id = chainId;
  evidence.native_attempt.observed_facts_sha256 = observedFactsDigest;
  const entry = ledger.attempts[evidence.native_attempt.attempt_number - 1];
  if (entry) {
    entry.chain_id = chainId;
    entry.source_commit = evidence.identity.source_commit;
    entry.validation_report_sha256 = validationDigest;
    entry.artifact_report_sha256 = artifactReportDigest;
    entry.artifact_sha256 = evidence.identity.artifact_sha256;
    entry.observed_facts_sha256 = observedFactsDigest;
  }
  candidate.attemptLedgerText = encode(ledger);
  evidence.native_attempt.total_attempts = ledger.attempts.length;
  evidence.native_attempt.ledger_sha256 = sha256(candidate.attemptLedgerText);
  candidate.evidenceText = encode(evidence);
}

function passingJourney() {
  const ordinaryFact = commandFact({
    sessionRole: "ordinary",
    eventIndex: 0,
    itemID: "ordinary-ambient-command",
    renderedCommand: "/bin/zsh -lc 'git status --short'",
    output: "",
    status: "completed",
    exitCode: 0,
    classification: "nonverification",
  });
  const invalidFact = commandFact({
    sessionRole: "invalid",
    eventIndex: 0,
    itemID: "invalid-git-probe",
    renderedCommand: "/bin/zsh -lc 'git rev-parse --show-toplevel'",
    output: "fatal: not a git repository",
    status: "failed",
    exitCode: 128,
    classification: "nonverification",
  });
  const substantiveFact = commandFact({
    sessionRole: "substantive",
    eventIndex: 0,
    itemID: "substantive-repository-command",
    renderedCommand: "/bin/zsh -lc 'printf native-proof > native-proof.txt'",
    output: "",
    status: "completed",
    exitCode: 0,
    classification: "nonverification",
  });
  const proofFact = commandFact({
    sessionRole: "resume",
    eventIndex: 0,
    itemID: "resume-proof-command",
    renderedCommand: renderedProofCommand,
    output: "0123456789abcdef0123456789abcdef01234567\n",
    status: "completed",
    exitCode: 0,
    classification: "verification",
  });
  const sessionCommandFacts = [ordinaryFact, invalidFact, substantiveFact, proofFact];
  return {
    task_lineage: {
      thread_ids: ["thread-ordinary", "thread-invalid", "thread-substantive", "thread-resume"],
      task_id_before_restart: "task-1",
      task_id_after_restart: "task-1",
      raw_revisions: [1, 1, 4, 4, 4, 8],
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
      terminal_phase: "DONE",
      terminal_outcome: "DONE",
    },
    invocation: {
      explicit_selector: "$dev-flow-codex:dev-flow",
      core_call_count: 10,
      scenario_call_budget: 10,
      implicit_invocation_core_calls: 0,
      read_before_retry_observations: 2,
      restart_recovery_reads: ["dev_flow_get_task", "dev_flow_get_next_action"],
      verification_budget: {
        level: "targeted",
        max_automatic_commands: 2,
        allow_full_suite: false,
        allow_manual_handoff: false,
      },
      session_command_facts: sessionCommandFacts,
      verification_commands: [proofCommand(proofFact)],
      submitted_automated_command_count: 1,
      retained_automated_command_count: 1,
      submitted_full_suite: false,
      retained_full_suite: false,
    },
    lifecycle: {
      setup_readback_passed: true,
      setup_registry: registryReadback(),
      restart_resume_passed: true,
      remove_readback_passed: true,
      task_data_retained: true,
      task_reopened_after_removal: true,
      compatible_reinstall_passed: true,
      reinstall_registry: registryReadback(),
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
      retained_data_location: {
        kind: "isolated-explicit-data-directory",
        workspace_relative_path: "data",
        canonical_path_sha256: "8".repeat(64),
      },
    },
  };
}

function verificationFacts(invocation) {
  return {
    budget: structuredClone(invocation.verification_budget),
    session_command_facts: structuredClone(invocation.session_command_facts),
    command_executions: structuredClone(invocation.verification_commands),
    submitted_automated_checks: invocation.verification_commands.map((command) => ({
      name: command.logical_proof_name,
      command_count: 1,
      full_suite: command.full_suite,
    })),
    retained_automated_checks: invocation.verification_commands.map((command) => ({
      name: command.logical_proof_name,
      command_count: 1,
      full_suite: command.full_suite,
    })),
  };
}

function updateInvocationFact(candidate, index, patch) {
  Object.assign(
    candidate.documents["journey-evidence"].journey.invocation.session_command_facts[index],
    patch,
  );
  synchronizeJourneyVerification(candidate);
}

function synchronizeJourneyVerification(candidate) {
  const journey = candidate.documents["journey-evidence"].journey;
  const observedFacts = candidate.documents["observed-facts"];
  observedFacts.journey = structuredClone(journey);
  observedFacts.verification.session_command_facts = structuredClone(
    journey.invocation.session_command_facts,
  );
  observedFacts.verification.command_executions = structuredClone(
    journey.invocation.verification_commands,
  );
}

function commandFact({
  sessionRole,
  eventIndex,
  itemID,
  renderedCommand,
  output,
  status,
  exitCode,
  classification,
}) {
  return {
    session_role: sessionRole,
    event_index: eventIndex,
    event_type: "command_execution",
    item_id_sha256: sha256(itemID),
    command_sha256: sha256(renderedCommand),
    output_sha256: sha256(output),
    status,
    exit_code: exitCode,
    classification,
  };
}

function proofCommand(fact) {
  return {
    session_role: fact.session_role,
    event_index: fact.event_index,
    item_id_sha256: fact.item_id_sha256,
    logical_proof_name: logicalProofName,
    rendered_command_sha256: fact.command_sha256,
    exit_code: fact.exit_code,
    status: fact.status,
    output_sha256: fact.output_sha256,
    full_suite: false,
  };
}

function registryReadback() {
  return {
    marketplaces_total: 1,
    installed_total: 1,
    available_total: 0,
    marketplace_name: "dev-flow-local",
    plugin_id: "dev-flow-codex@dev-flow-local",
    plugin_version: rootVersion,
  };
}

function ledgerAttempt(attemptNumber, status) {
  const entry = {
    attempt_number: attemptNumber,
    chain_id: String(attemptNumber).repeat(64),
    source_commit: String(attemptNumber).repeat(40),
    validation_report_sha256: "3".repeat(64),
    artifact_report_sha256: "4".repeat(64),
    artifact_sha256: "5".repeat(64),
    reserved_at: "2026-08-16T01:30:00.000Z",
    status,
  };
  if (status !== "reserved") {
    entry.completed_at = "2026-08-16T02:00:00.000Z";
    entry.observed_facts_sha256 = "6".repeat(64);
  }
  return entry;
}

function without(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return copy;
}

function attemptDiagnostic(status) {
  const candidate = passingCandidate();
  const evidence = candidate.documents["journey-evidence"];
  return {
    schema_version: 1,
    report_type: "dev-flow-codex-native-attempt-diagnostic",
    status,
    recorded_at: evidence.recorded_at,
    classification: {
      evidence_type: "native-attempt-diagnostic",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: structuredClone(evidence.versions),
    identity: {
      source_commit: evidence.identity.source_commit,
      artifact_sha256: evidence.identity.artifact_sha256,
      artifact_report_sha256: evidence.identity.artifact_report_sha256,
      artifact_built_at: evidence.identity.artifact_built_at,
    },
    validation: structuredClone(evidence.validation),
    native_attempt: {
      ...structuredClone(evidence.native_attempt),
      commit_protocol: "external-failure-record-v1",
    },
    failure: observation("native-journey", "native attempt failed", "Codex exited 1"),
    skips: [],
  };
}

function attemptDiagnosticV2(status, failureKind) {
  const diagnostic = attemptDiagnostic(status);
  diagnostic.schema_version = 2;
  diagnostic.native_attempt.commit_protocol = "external-failure-record-v2";
  diagnostic.native_attempt.attempt_number = 2;
  diagnostic.native_attempt.total_attempts = 2;
  diagnostic.failure_kind = failureKind;
  diagnostic.failure = {
    phase_code: failureKind === "command_event" ? "codex-session" : "native-journey",
    reason_code: failureKind === "command_event" ? "command-event-rejected" : "blocked",
    detail_sha256: "d".repeat(64),
  };
  diagnostic.skips = [
    {
      phase_code: "cleanup",
      reason_code: "blocked",
      detail_sha256: "e".repeat(64),
    },
  ];
  if (failureKind === "command_event") {
    diagnostic.failure_context = {
      session_role: "ordinary",
      event_type: "command_execution",
      command_sha256: sha256("/bin/zsh -lc 'git status --short'"),
      output_sha256: sha256(""),
      status: "completed",
      exit_code: 0,
    };
  }
  return diagnostic;
}

function validateFailureCandidate(candidate) {
  return validator.validateFailureAttemptCandidate({
    diagnostic: candidate.diagnostic,
    observedFacts: candidate.observedFacts,
    ledger: candidate.ledger,
    attemptLedgerPath: candidate.attemptLedgerPath,
  });
}

function failureCandidateV3({ failureKind = "non_command" } = {}) {
  const failureLedgerPath = "/tmp/dev-flow-codex-v3-native-attempts.json";
  const ledgerID = ledgerIdentity(failureLedgerPath);
  const sessionObservations = [
    sessionObservation("ordinary", {
      failureStage: "parse_failed",
      exitCode: 1,
      eventCounts: { other: 1 },
    }),
    sessionObservation("invalid", {
      failureStage: "parse_failed",
      signal: "SIGTERM",
      threadPresent: true,
      eventCounts: { thread_started: 2 },
    }),
    sessionObservation("substantive", {
      failureStage: "completed",
      exitCode: 0,
      threadPresent: true,
      eventCounts: {
        thread_started: 1,
        item_started: 1,
        item_completed: 1,
        turn_completed: 1,
      },
      itemCounts: { command_execution: 1 },
    }),
    sessionObservation("resume"),
  ];
  const failure = {
    phase_code: failureKind === "command_event" ? "codex-session" : "native-journey",
    reason_code: failureKind === "command_event" ? "command-event-rejected" : "unexpected-failure",
    detail_sha256: "d".repeat(64),
  };
  const failureContext = failureKind === "command_event"
    ? {
      session_role: "substantive",
      event_type: "command_execution",
      command_sha256: sha256("/bin/zsh -lc 'git status --short'"),
      output_sha256: sha256(""),
      status: "completed",
      exit_code: 0,
    }
    : undefined;
  const matchingEntry = ledgerAttempt(3, "failed");
  matchingEntry.chain_id = chainIdentity({
    source_commit: matchingEntry.source_commit,
    validation_report_sha256: matchingEntry.validation_report_sha256,
    artifact_report_sha256: matchingEntry.artifact_report_sha256,
    artifact_sha256: matchingEntry.artifact_sha256,
  });
  const ledger = {
    schema_version: 1,
    ledger_id: ledgerID,
    attempts: [ledgerAttempt(1, "failed"), ledgerAttempt(2, "blocked"), matchingEntry],
  };
  const diagnostic = {
    schema_version: 3,
    report_type: "dev-flow-codex-native-attempt-diagnostic",
    status: "failed",
    recorded_at: matchingEntry.completed_at,
    classification: {
      evidence_type: "native-attempt-diagnostic",
      host_surface: "codex-cli",
      os: "darwin",
      arch: "arm64",
      final_artifact: true,
    },
    versions: {
      codex: "0.147.0",
      codex_compatibility: ">=0.147.0 <0.148.0",
      package: rootVersion,
      core: rootVersion,
      core_contract: "0.1",
    },
    identity: {
      source_commit: matchingEntry.source_commit,
      artifact_sha256: matchingEntry.artifact_sha256,
      artifact_report_sha256: matchingEntry.artifact_report_sha256,
      artifact_built_at: "2026-08-16T01:25:00.000Z",
    },
    validation: {
      report_sha256: matchingEntry.validation_report_sha256,
      completed_at: "2026-08-16T01:20:00.000Z",
      targeted_checks: expectedTargetedCommands.map((command, index) => ({
        command,
        result: "pass",
        source_commit: matchingEntry.source_commit,
        completed_at: `2026-08-16T01:0${index === 0 ? 5 : 9}:00.000Z`,
      })),
      root_validation: {
        command: "pnpm run validate",
        result: "pass",
        source_commit: matchingEntry.source_commit,
        completed_at: "2026-08-16T01:15:00.000Z",
      },
    },
    native_attempt: {
      chain_id: matchingEntry.chain_id,
      ledger_id: ledgerID,
      attempt_number: 3,
      total_attempts: 3,
      ledger_sha256: "0".repeat(64),
      commit_protocol: "external-failure-record-v3",
      observed_facts_sha256: "0".repeat(64),
    },
    failure_kind: failureKind,
    failure,
    ...(failureContext ? { failure_context: failureContext } : {}),
    session_observations: sessionObservations,
    skips: [],
  };
  const candidate = {
    diagnostic,
    observedFacts: failureFactsProjection(diagnostic),
    ledger,
    attemptLedgerPath: failureLedgerPath,
  };
  rebindFailureCandidate(candidate);
  return candidate;
}

function failureFactsProjection(diagnostic) {
  return {
    schema_version: diagnostic.schema_version,
    ...(Object.hasOwn(diagnostic, "failure_kind")
      ? { failure_kind: structuredClone(diagnostic.failure_kind) }
      : {}),
    failure: structuredClone(diagnostic.failure),
    ...(Object.hasOwn(diagnostic, "failure_context")
      ? { failure_context: structuredClone(diagnostic.failure_context) }
      : {}),
    ...(Object.hasOwn(diagnostic, "session_observations")
      ? { session_observations: structuredClone(diagnostic.session_observations) }
      : {}),
  };
}

function rebindFailureCandidate(candidate) {
  candidate.observedFacts = failureFactsProjection(candidate.diagnostic);
  const observedFactsSha256 = sha256(canonicalEncode(candidate.observedFacts));
  const nativeAttempt = candidate.diagnostic.native_attempt;
  const matchingEntry = candidate.ledger.attempts[nativeAttempt.attempt_number - 1];
  if (matchingEntry) matchingEntry.observed_facts_sha256 = observedFactsSha256;
  nativeAttempt.observed_facts_sha256 = observedFactsSha256;
  nativeAttempt.ledger_sha256 = sha256(canonicalEncode(candidate.ledger));
}

function sessionObservation(sessionRole, {
  failureStage = "not_started",
  exitCode = null,
  signal = null,
  threadPresent = false,
  stdout = "",
  stderr = "",
  eventCounts = {},
  itemCounts = {},
  mcpStatusCounts = {},
} = {}) {
  const events = {
    invalid_json: 0,
    thread_started: 0,
    item_started: 0,
    item_completed: 0,
    turn_completed: 0,
    error: 0,
    other: 0,
    ...eventCounts,
  };
  const items = {
    agent_message: 0,
    command_execution: 0,
    mcp_tool_call: 0,
    other: 0,
    ...itemCounts,
  };
  const mcpStatuses = {
    dev_flow: 0,
    completed: 0,
    failed: 0,
    other: 0,
    ...mcpStatusCounts,
  };
  return {
    session_role: sessionRole,
    failure_stage: failureStage,
    exit_code: exitCode,
    signal,
    thread_present: threadPresent,
    stdout_bytes: Buffer.byteLength(stdout),
    stderr_bytes: Buffer.byteLength(stderr),
    stdout_sha256: sha256(stdout),
    stderr_sha256: sha256(stderr),
    event_counts: {
      total: Object.values(events).reduce((total, count) => total + count, 0),
      ...events,
    },
    item_counts: {
      total: Object.values(items).reduce((total, count) => total + count, 0),
      ...items,
    },
    mcp_status_counts: {
      total: mcpStatuses.completed + mcpStatuses.failed + mcpStatuses.other,
      ...mcpStatuses,
    },
  };
}

function chainIdentity(fields) {
  const ordered = {
    artifact_report_sha256: fields.artifact_report_sha256,
    artifact_sha256: fields.artifact_sha256,
    source_commit: fields.source_commit,
    validation_report_sha256: fields.validation_report_sha256,
  };
  return sha256(JSON.stringify(ordered));
}

function ledgerIdentity(path) {
  return sha256(`dev-flow-codex-native-ledger-v1\n${path}\n`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encode(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function canonicalEncode(value) {
  return `${JSON.stringify(sortCanonicalValue(value))}\n`;
}

function sortCanonicalValue(value) {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
      .map((key) => [key, sortCanonicalValue(value[key])]),
  );
}

function observation(phase, reason, observed) {
  return { phase, reason, observed };
}

function allErrors(result) {
  return [...result.structuralErrors, ...result.semanticErrors].join("\n");
}
