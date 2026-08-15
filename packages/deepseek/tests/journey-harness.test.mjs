import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { validateEvidenceDocument } from '../../../scripts/validate-deepseek-journey-evidence.mjs'
import { createResultVector } from './fixtures/fake-core.mjs'
import { evaluateDirectResultObservation } from './helpers/result-evidence.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const journeyScript = join(repositoryRoot, 'scripts', 'run-deepseek-real-journey.sh')
const STABLE_CASES = [
  'inline_success', 'domain_error', 'near_spill', 'spilled', 'pruned', 'near_core_limit',
]

function stableObservation(caseName) {
  const vector = createResultVector(caseName)
  const incomplete = {
    spilled: '(Omitted 1 bytes. Full formatted result stored at: official-fixture.)',
    pruned: '[tool result pruned: retained head and tail]',
  }
  return evaluateDirectResultObservation({
    caseName,
    classification: 'stable-native',
    harness: {
      channel: 'stable', package_version_build: '0.1.0', integrity: 'sha512-stable',
    },
    expected: vector.canonical,
    observed: incomplete[caseName] ?? vector.canonical,
    recovered: vector.canonical,
    retrievalMethod: incomplete[caseName] === undefined
      ? 'official:inline-result-value'
      : 'official:complete-result-retrieval',
  })
}

function runFake(stage) {
  return spawnSync(journeyScript, ['--fake-host', '--through', stage], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, DEV_FLOW_TEST_DSH_TRIPWIRE: '1' },
  })
}

for (const stage of ['explicit-invocation', 'done', 'remove']) {
  test(`fake profile journey reaches ${stage} without native evidence`, () => {
    const result = runFake(stage)
    assert.equal(result.status, 0, result.stderr)
    const evidence = JSON.parse(result.stdout)
    assert.equal(evidence.through_stage, stage)
    assert.equal(evidence.classification, 'simulated')
    assert.equal(evidence.real_harness_started, false)
    assert.equal(evidence.native_evidence_written, false)
    assert.equal(evidence.support_claim, false)
    assert.equal(evidence.proxy_presence, 'none')
    assert.equal(evidence.profile.data_root_separate, true)
    assert.equal(evidence.profile.restart_readback, true)
    assert.equal(evidence.admission.ordinary_prompt_core_calls, 0)
    assert.equal(evidence.admission.invalid_invocation_core_calls, 0)
    assert.equal(evidence.startup_failure.fatal_to_host, false)
    assert.equal(evidence.repository.before_sha256, evidence.repository.after_sha256)
    if (stage === 'done' || stage === 'remove') {
      assert.equal(evidence.task.outcome, 'DONE')
      assert.ok(evidence.task.action_commits >= 2)
      assert.equal(evidence.task.read_before_retry, true)
      assert.equal(evidence.task.restart_resume, true)
    }
    if (stage === 'remove') {
      assert.equal(evidence.data.before_sha256, evidence.data.after_sha256)
      assert.equal(evidence.reinstall.resume_succeeded, true)
      assert.equal(evidence.codex.classification, 'comparison-logic-only')
      assert.equal(evidence.codex.native_comparison_performed, false)
      assert.equal(evidence.codex.before_sha256, evidence.codex.after_sha256)
      assert.equal(evidence.removal.dependency_absent, true)
      assert.equal(evidence.removal.bundle_absent, true)
      assert.equal(evidence.removal.repeated_remove_absent, true)
      assert.equal(evidence.removal.stale_metadata, false)
    }
  })
}

test('fake removal stops when supported restart leaves stale product metadata', () => {
  const result = spawnSync(journeyScript, ['--fake-host', '--through', 'remove'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      DEV_FLOW_TEST_DSH_TRIPWIRE: '1',
      DEV_FLOW_TEST_STALE_PROFILE: '1',
    },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /stale profile metadata/)
  assert.equal(result.stdout, '')
})

test('native journey remains closed before the 003 merge barrier', () => {
  const result = spawnSync(journeyScript, ['--stable-harness', '0.1.0'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /003 merge barrier/)
})

test('final evidence validator requires real Codex equality for pass', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-flow-evidence-'))
  const path = join(root, 'evidence.md')
  const record = {
    schema_version: 1,
    status: 'pass',
    classification: 'stable-native',
    support_claim: true,
    proxy_presence: 'none',
    harness: { channel: 'stable', package_version_build: '0.1.0', integrity: 'sha512-stable' },
    stable_gate: {
      harness_package_version_build: '0.1.0',
      observations: STABLE_CASES.map(stableObservation),
    },
    source: { frozen_commit: 'a'.repeat(40), validated_commit: 'a'.repeat(40) },
    artifact: { sha256: 'b'.repeat(64), source_commit: 'a'.repeat(40) },
    task: { id: 'task-1', revisions: [1, 2, 3], action_commits: 2, outcome: 'DONE' },
    verification: { used: 2, limit: 3, root_validation: 'pass' },
    data: { before_sha256: 'c'.repeat(64), after_sha256: 'c'.repeat(64) },
    repository: { before_sha256: 'd'.repeat(64), after_sha256: 'd'.repeat(64) },
    reinstall: { resume_succeeded: true },
    codex: {
      classification: 'simulated',
      native_comparison_performed: false,
      codex_product_version: '0.1.0',
      registration_before_sha256: 'e'.repeat(64),
      registration_after_sha256: 'e'.repeat(64),
      runtime_before_sha256: 'f'.repeat(64),
      runtime_after_sha256: 'f'.repeat(64),
      package_selection_before_sha256: '1'.repeat(64),
      package_selection_after_sha256: '1'.repeat(64),
      shared_data_before_sha256: '2'.repeat(64),
      shared_data_after_sha256: '2'.repeat(64),
      complete: false,
    },
    failures: [],
    skips: [],
  }
  await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`)
  await assert.rejects(validateEvidenceDocument(path), /real Codex/)

  record.codex.classification = 'stable-native-real'
  record.codex.native_comparison_performed = true
  record.codex.complete = true
  await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`)
  const validated = await validateEvidenceDocument(path)
  assert.equal(validated.status, 'pass')

  for (const mutation of [
    codex => { delete codex.codex_product_version },
    codex => { codex.registration_after_sha256 = '3'.repeat(64) },
    codex => { codex.runtime_after_sha256 = '3'.repeat(64) },
    codex => { codex.package_selection_after_sha256 = '3'.repeat(64) },
    codex => { codex.shared_data_after_sha256 = '3'.repeat(64) },
    codex => { codex.complete = false },
    codex => { codex.native_comparison_performed = false },
  ]) {
    const invalid = structuredClone(record)
    mutation(invalid.codex)
    await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(invalid, null, 2)}\n\`\`\`\n`)
    await assert.rejects(validateEvidenceDocument(path), /Codex/)
  }
})

test('final evidence validator requires six distinct complete same-artifact stable Gate observations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-flow-stable-gate-evidence-'))
  const path = join(root, 'evidence.md')
  const base = {
    schema_version: 1,
    status: 'pass',
    classification: 'stable-native',
    support_claim: true,
    proxy_presence: 'none',
    harness: { channel: 'stable', package_version_build: '0.1.0', integrity: 'sha512-stable' },
    stable_gate: {
      harness_package_version_build: '0.1.0',
      observations: STABLE_CASES.map(stableObservation),
    },
    source: { frozen_commit: 'a'.repeat(40), validated_commit: 'a'.repeat(40) },
    artifact: { sha256: 'b'.repeat(64), source_commit: 'a'.repeat(40) },
    task: { id: 'task-1', revisions: [1, 2, 3], action_commits: 2, outcome: 'DONE' },
    verification: { used: 2, limit: 3, root_validation: 'pass' },
    data: { before_sha256: 'c'.repeat(64), after_sha256: 'c'.repeat(64) },
    repository: { before_sha256: 'd'.repeat(64), after_sha256: 'd'.repeat(64) },
    reinstall: { resume_succeeded: true },
    codex: {
      classification: 'stable-native-real', native_comparison_performed: true,
      codex_product_version: '0.1.0', complete: true,
      registration_before_sha256: 'e'.repeat(64), registration_after_sha256: 'e'.repeat(64),
      runtime_before_sha256: 'f'.repeat(64), runtime_after_sha256: 'f'.repeat(64),
      package_selection_before_sha256: '1'.repeat(64), package_selection_after_sha256: '1'.repeat(64),
      shared_data_before_sha256: '2'.repeat(64), shared_data_after_sha256: '2'.repeat(64),
    },
    failures: [],
    skips: [],
  }
  for (const mutate of [
    record => { record.stable_gate.observations.pop() },
    record => { record.stable_gate.observations[0].case = 'spilled' },
    record => { record.stable_gate.observations[0].complete = false },
    record => { record.stable_gate.observations[0].harness_selection.package_version_build = '0.1.1' },
    record => { record.stable_gate.observations[0].harness_selection.integrity = 'sha512-other' },
    record => { record.stable_gate.observations[0].recovered_bytes = 1023 },
    record => { record.stable_gate.observations[0].recovered_sha256 = '8'.repeat(64) },
    record => { delete record.stable_gate.observations[0].retrieval_method },
    record => { record.stable_gate.observations[0].classification = 'simulated' },
    record => { record.stable_gate.observations[0].core_ok = false },
    record => {
      record.stable_gate.observations[3].marker_detected = null
      record.stable_gate.observations[3].host_representation = record.stable_gate.observations[3].harness_selection
        .package_version_build
    },
    record => { record.stable_gate.observations[4].retrieval_method = 'inline canonical text' },
    record => {
      const digest = record.stable_gate.observations[0].expected_sha256
      for (const observation of record.stable_gate.observations) {
        observation.expected_sha256 = digest
        observation.recovered_sha256 = digest
      }
    },
  ]) {
    const invalid = structuredClone(base)
    mutate(invalid)
    await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(invalid)}\n\`\`\`\n`)
    await assert.rejects(validateEvidenceDocument(path), /stable Gate B/)
  }
})

test('blocked and failed evidence remain honest without fabricated journey fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dev-flow-blocked-evidence-'))
  for (const status of ['blocked', 'failed']) {
    const path = join(root, `${status}.md`)
    const record = {
      schema_version: 1,
      status,
      classification: 'unverified',
      support_claim: false,
      blocking_reasons: ['No official stable Harness artifact exists.'],
    }
    await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`)
    assert.equal((await validateEvidenceDocument(path)).status, status)
    for (const fabricated of [
      { native_evidence_written: true },
      { task: { outcome: 'DONE' } },
      { proxy_presence: 'none' },
      { harness: { channel: 'stable', package_version_build: '0.1.0' } },
    ]) {
      const invalid = { ...record, ...fabricated }
      await writeFile(path, `# Evidence\n\n\`\`\`json\n${JSON.stringify(invalid)}\n\`\`\`\n`)
      await assert.rejects(validateEvidenceDocument(path), /blocked|failed|stopped|field/)
    }
  }
})
