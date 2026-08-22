export const FINAL_NATIVE_EVIDENCE_KIND = "deepseek-registry-lifecycle-v1";
export const QUICK_NATIVE_EVIDENCE_KIND = "deepseek-registry-smoke-v1";
export const FINAL_FIXTURE_EVIDENCE_KIND = "deepseek-fixture-lifecycle-v1";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

export function validateFinalJourneyEvidence(value, options = {}) {
  return validateFinalJourneyEvidenceShape(value, { ...options, expectedKind: FINAL_NATIVE_EVIDENCE_KIND });
}

export function validateQuickJourneyEvidence(value, options = {}) {
  return validateFinalJourneyEvidenceShape(value, { ...options, expectedKind: QUICK_NATIVE_EVIDENCE_KIND });
}

export function validateFinalJourneyEvidenceShape(value, { allowFixture = false, expected = {}, expectedKind = null } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DeepSeek journey evidence must be an object");
  const keys = [
    "evidence_kind", "package_name", "version", "registry", "npm_tarball_sha256", "npm_integrity",
    "core_sha256", "core_version", "source_commit", "dsh_version", "compatible_dsh_range",
    "observed_at", "gates",
  ];
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error("DeepSeek journey evidence fields are not closed");
  const allowedKinds = allowFixture
    ? [FINAL_NATIVE_EVIDENCE_KIND, QUICK_NATIVE_EVIDENCE_KIND, FINAL_FIXTURE_EVIDENCE_KIND]
    : [expectedKind ?? FINAL_NATIVE_EVIDENCE_KIND];
  if (!allowedKinds.includes(value.evidence_kind)) throw new Error("DeepSeek journey evidence kind is invalid");
  if (value.package_name !== "dev-flow-deepseek" || !SEMVER_PATTERN.test(value.version)) throw new Error("DeepSeek journey package identity is invalid");
  if (value.registry !== "https://registry.npmjs.org/" || !SHA256_PATTERN.test(value.npm_tarball_sha256) || !SHA256_PATTERN.test(value.core_sha256)) throw new Error("DeepSeek journey artifact identity is invalid");
  if (!SEMVER_PATTERN.test(value.core_version) || value.dsh_version !== "0.1.0-rc.8" || value.compatible_dsh_range !== ">=0.1.0-rc.8 <0.2.0") throw new Error("DeepSeek journey runtime identity is invalid");
  if (!/^[0-9a-f]{40}$/u.test(value.source_commit) || !Number.isFinite(Date.parse(value.observed_at))) throw new Error("DeepSeek journey source/time identity is invalid");
  if (!Array.isArray(value.gates) || value.gates.length < 3 || value.gates.some((gate) => typeof gate !== "string" || gate.length < 1 || gate.length > 128)) throw new Error("DeepSeek journey gates are invalid");
  const comparisons = [
    ["packageName", "package_name"], ["version", "version"], ["registry", "registry"],
    ["tarballSHA256", "npm_tarball_sha256"], ["npmIntegrity", "npm_integrity"],
    ["coreSHA256", "core_sha256"], ["coreVersion", "core_version"], ["sourceCommit", "source_commit"],
  ];
  for (const [expectedKey, actualKey] of comparisons) {
    if (expected[expectedKey] !== undefined && value[actualKey] !== expected[expectedKey]) throw new Error(`DeepSeek journey ${actualKey} differs from the release`);
  }
  return Object.freeze({ ...value, gates: Object.freeze([...value.gates]) });
}
