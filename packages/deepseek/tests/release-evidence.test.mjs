import assert from "node:assert/strict";
import test from "node:test";

import {
  FINAL_NATIVE_EVIDENCE_KIND,
  QUICK_NATIVE_EVIDENCE_KIND,
  validateFinalJourneyEvidence,
  validateQuickJourneyEvidence,
} from "../../../scripts/write-deepseek-journey-evidence.mjs";
import { versionAtLeast } from "../../../scripts/semver.mjs";

const base = {
  package_name: "dev-flow-deepseek",
  version: "0.5.1",
  registry: "https://registry.npmjs.org/",
  npm_tarball_sha256: "a".repeat(64),
  npm_integrity: "sha512-fixture",
  core_sha256: "b".repeat(64),
  core_version: "0.5.1",
  source_commit: "c".repeat(40),
  dsh_version: "0.1.0-rc.6",
  compatible_dsh_range: ">=0.1.0-rc.6",
  observed_at: "2026-08-22T00:00:00.000Z",
  gates: ["registry-bytes", "core-identity", "dsh-version"],
};

test("normal and quick evidence retain exact product, Core, DSH and registry identities", () => {
  const expected = {
    packageName: base.package_name,
    version: base.version,
    registry: base.registry,
    tarballSHA256: base.npm_tarball_sha256,
    npmIntegrity: base.npm_integrity,
    coreSHA256: base.core_sha256,
    coreVersion: base.core_version,
    sourceCommit: base.source_commit,
  };
  assert.equal(validateFinalJourneyEvidence({ evidence_kind: FINAL_NATIVE_EVIDENCE_KIND, ...base }, { expected }).dsh_version, "0.1.0-rc.6");
  assert.equal(validateQuickJourneyEvidence({ evidence_kind: QUICK_NATIVE_EVIDENCE_KIND, ...base }, { expected }).evidence_kind, QUICK_NATIVE_EVIDENCE_KIND);
});

test("evidence rejects drift and unknown fields", () => {
  assert.throws(() => validateFinalJourneyEvidence({ evidence_kind: FINAL_NATIVE_EVIDENCE_KIND, ...base, version: "0.5.2" }, { expected: { version: "0.5.1" } }), /differs/u);
  assert.throws(() => validateFinalJourneyEvidence({ evidence_kind: FINAL_NATIVE_EVIDENCE_KIND, ...base, extra: true }), /not closed/u);
});

test("DSH compatibility has one minimum and no upper bound", () => {
  assert.equal(versionAtLeast("0.1.0-rc.5", "0.1.0-rc.6"), false);
  assert.equal(versionAtLeast("0.1.0-rc.6", "0.1.0-rc.6"), true);
  assert.equal(versionAtLeast("0.1.0-rc.8", "0.1.0-rc.6"), true);
  assert.equal(versionAtLeast("0.1.0", "0.1.0-rc.6"), true);
  assert.equal(versionAtLeast("1.0.0", "0.1.0-rc.6"), true);
});
