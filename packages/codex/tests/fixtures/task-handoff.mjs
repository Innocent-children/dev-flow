import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export function handoffFixture(request) {
  return {
    request,
    goal: request,
    confirmed_requirements: [{ text: request, source_ids: ["m1"] }],
    terminology: [],
    scope_and_constraints: [],
    investigation: [],
    work_requirements: [],
    unconfirmed_suggestions: [],
    assumptions: [],
    open_questions: [],
    discussion: [{ id: "m1", role: "user", text: request }],
  };
}

export async function writeHandoffFixture(directory, request, changes = {}) {
  const path = join(directory, `handoff-${randomUUID()}.json`);
  await writeFile(path, JSON.stringify({ ...handoffFixture(request), ...changes }), { mode: 0o600 });
  return path;
}

export function admissionFixture(anchor) {
  return {
    assessment: { change_level: "standard", observed_repositories: anchor.repositories.map((entry) => entry.canonical_root),
      candidate_components: ["launch"], candidate_paths: ["src/launch.mjs"], public_contract_flags: ["launch contract"],
      persistence_or_state_flags: [], host_or_platform_flags: [], verification_shape: ["targeted launch tests"], unknowns: [],
      recommendation: "dev_flow", reasons: ["The launch contract changes."], anchor },
    user_choice: {source: "user", mode: "dev_flow", summary: "Fixture user selected Dev Flow after reading the assessment."},
  };
}

export function receiptAdmissionFixture(input) {
  return admissionFixture({request_digest: input.requestDigest, repositories: [{repository_key: input.repositoryKey,
    canonical_root: input.worktreePath ?? join(process.cwd(), "fixture-source"), head:"a".repeat(40), status_digest:"b".repeat(64), dirty_paths:[], dirty_paths_truncated:false}]});
}
