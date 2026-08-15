import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DIRECT_RESULT_CASES,
  detectIncompleteRepresentation,
  evaluateDirectResultObservation,
} from './helpers/result-evidence.mjs'
import { createResultVector } from './fixtures/fake-core.mjs'

test('direct-result evidence model covers the six required cases', () => {
  assert.deepEqual(DIRECT_RESULT_CASES, [
    'inline_success',
    'domain_error',
    'near_spill',
    'spilled',
    'pruned',
    'near_core_limit',
  ])
})

test('official spill and prune markers are detected before authority use', () => {
  assert.equal(detectIncompleteRepresentation('Full formatted result stored at: /tmp/result'), 'spilled')
  assert.equal(detectIncompleteRepresentation('(Omitted 42 bytes. Full formatted result stored at: /tmp/result.)'), 'spilled')
  assert.equal(detectIncompleteRepresentation('[tool result pruned: retained head and tail]'), 'pruned')
  assert.equal(detectIncompleteRepresentation('{"schema_version":1'), 'malformed')
  assert.equal(detectIncompleteRepresentation('not json at all'), 'malformed')
  assert.equal(detectIncompleteRepresentation('{"schema_version":1,"ok":true}'), null)
})

for (const caseName of DIRECT_RESULT_CASES) {
  test(`complete ${caseName} observation requires identical bytes, digest, and parse`, () => {
    const vector = createResultVector(caseName)
    const incomplete = {
      spilled: '(Omitted 1 bytes. Full formatted result stored at: fixture.)',
      pruned: '[tool result pruned: retained head and tail]',
    }
    const observation = evaluateDirectResultObservation({
      caseName,
      classification: 'simulated',
      harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
      expected: vector.canonical,
      observed: incomplete[caseName] ?? vector.canonical,
      recovered: vector.canonical,
      retrievalMethod: incomplete[caseName] === undefined ? 'inline canonical text' : 'fixture read',
    })
    assert.equal(observation.complete, true)
    assert.equal(observation.expected_sha256, observation.recovered_sha256)
    assert.equal(observation.complete_parse, true)
    assert.equal(observation.core_ok, caseName !== 'domain_error')
    assert.equal(observation.native_support, false)
    assert.equal(observation.support_claim, false)
  })
}

test('mismatch, malformed recovery, and native promotion fail closed', () => {
  const vector = createResultVector('inline_success')
  assert.throws(() => evaluateDirectResultObservation({
    caseName: 'inline_success',
    classification: 'simulated',
    harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
    expected: vector.canonical,
    observed: vector.canonical,
    recovered: `${vector.canonical}\n`,
    retrievalMethod: 'inline',
  }), /canonical bytes/)
  assert.throws(() => evaluateDirectResultObservation({
    caseName: 'inline_success',
    classification: 'stable-native',
    harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
    expected: vector.canonical,
    observed: vector.canonical,
    recovered: vector.canonical,
    retrievalMethod: 'inline',
  }), /stable artifact/)
})

test('case labels cannot promote a different envelope or host representation', () => {
  const success = createResultVector('inline_success').canonical
  const domainError = createResultVector('domain_error').canonical
  const common = {
    classification: 'simulated',
    harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
    recovered: success,
    retrievalMethod: 'inline canonical text',
  }
  assert.throws(() => evaluateDirectResultObservation({
    ...common, caseName: 'domain_error', expected: success, observed: success,
  }), /domain_error.*Core error/)
  assert.throws(() => evaluateDirectResultObservation({
    ...common, caseName: 'inline_success', expected: domainError, observed: domainError,
    recovered: domainError,
  }), /inline_success.*Core success/)
  for (const caseName of ['spilled', 'pruned']) {
    assert.throws(() => evaluateDirectResultObservation({
      ...common, caseName, expected: success, observed: success,
    }), new RegExp(`${caseName}.*marker`))
  }
})

test('complete parsing rejects non-contract JSON and records the authoritative observation fields', () => {
  const common = {
    caseName: 'inline_success',
    classification: 'simulated',
    harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
    observed: '{}',
    retrievalMethod: 'fixture direct value',
  }
  for (const recovered of [
    '{}',
    '{"schema_version":1,"ok":true}',
    '{"schema_version":1,"ok":true,"request_id":"request-1","tool":"dev_flow_get_next_action"}',
    '{"schema_version":1,"ok":false,"request_id":"request-1","tool":"dev_flow_apply_action","error":{"code":"REVISION_CONFLICT","message":"stale"}}',
  ]) {
    assert.throws(() => evaluateDirectResultObservation({
      ...common,
      expected: recovered,
      recovered,
    }), /Core Contract 0\.1 envelope/)
  }

  const vector = createResultVector('inline_success')
  const observation = evaluateDirectResultObservation({
    ...common,
    expected: vector.canonical,
    observed: vector.canonical,
    recovered: vector.canonical,
  })
  assert.equal(observation.gate_kind, 'provisional')
  assert.equal(observation.core_bytes, Buffer.byteLength(vector.canonical))
  assert.deepEqual(observation.harness_selection, common.harness)
})

test('complete parsing rejects truncated or forged task, action, blocker, outcome, and recovery authority', () => {
  const forged = [
    {
      schema_version: 1, ok: true, request_id: 'request-open', tool: 'dev_flow_open_task',
      result: { created: true, task: {} },
    },
    {
      schema_version: 1, ok: true, request_id: 'request-get', tool: 'dev_flow_get_task',
      result: { task: {}, recovery_assessment: 'forged' },
    },
    {
      schema_version: 1, ok: true, request_id: 'request-next', tool: 'dev_flow_get_next_action',
      result: {
        task_id: 'task-1', phase: 'PLAN', revision: 1, action: null,
        blocker: { forged: true }, outcome: { forged: true }, recovery_assessment: { forged: true },
      },
    },
    {
      schema_version: 1, ok: true, request_id: 'request-apply', tool: 'dev_flow_apply_action',
      result: { task: {}, repository_claim_released: false },
    },
    {
      schema_version: 1, ok: true, request_id: 'request-cancel', tool: 'dev_flow_cancel_task',
      result: { task: {}, repository_claim_released: true },
    },
  ]
  for (const envelope of forged) {
    const canonical = JSON.stringify(envelope)
    assert.throws(() => evaluateDirectResultObservation({
      caseName: 'inline_success',
      classification: 'simulated',
      harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
      expected: canonical,
      observed: canonical,
      recovered: canonical,
      retrievalMethod: 'fixture direct value',
    }), /Core Contract 0\.1 envelope/)
  }
})

test('complete parsing rejects internally inconsistent next-action authority', () => {
  const vector = JSON.parse(createResultVector('inline_success').canonical)
  for (const mutate of [
    envelope => { envelope.result.action.kind = 'VERIFY_CHANGE' },
    envelope => { envelope.result.action.allowed_effects = ['read_repository'] },
    envelope => { envelope.result.action.required_evidence = [{ kind: 'review_summary', required: true }] },
  ]) {
    const forged = structuredClone(vector)
    mutate(forged)
    const canonical = JSON.stringify(forged)
    assert.throws(() => evaluateDirectResultObservation({
      caseName: 'inline_success',
      classification: 'simulated',
      harness: {
        channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only',
      },
      expected: canonical,
      observed: canonical,
      recovered: canonical,
      retrievalMethod: 'fixture direct value',
    }), /Core Contract 0\.1 envelope/)
  }
})

test('incomplete host representation is never accepted as action, error, recovery, or outcome authority', () => {
  for (const caseName of ['spilled', 'pruned']) {
    const vector = createResultVector(caseName)
    const incomplete = caseName === 'spilled'
      ? '(Omitted 10 bytes. Full formatted result stored at: fixture.)'
      : '[tool result pruned: retained head and tail]'
    assert.throws(() => evaluateDirectResultObservation({
      caseName,
      classification: 'simulated',
      harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
      expected: vector.canonical,
      observed: incomplete,
      recovered: incomplete,
      retrievalMethod: 'incomplete display text',
    }), /canonical bytes/)
  }
})

test('silent or malformed representation differences and generic retrieval claims fail closed', () => {
  const vector = createResultVector('spilled')
  const common = {
    caseName: 'spilled',
    classification: 'simulated',
    harness: { channel: 'pre-release', package_version_build: '0.1.0-rc.6', integrity: 'fixture-only' },
    expected: vector.canonical,
    recovered: vector.canonical,
  }
  for (const observed of ['{}', '{"schema_version":1', 'not json at all']) {
    assert.throws(() => evaluateDirectResultObservation({
      ...common,
      observed,
      retrievalMethod: 'fixture read',
    }), /representation|marker/)
  }
  assert.throws(() => evaluateDirectResultObservation({
    ...common,
    observed: '(Omitted 1 bytes. Full formatted result stored at: fixture.)',
    retrievalMethod: 'anything',
  }), /retrieval method/)
})

test('pre-release-native completeness remains provisional and never becomes stable support', () => {
  const vector = createResultVector('inline_success')
  const observation = evaluateDirectResultObservation({
    caseName: 'inline_success',
    classification: 'pre-release-native',
    harness: {
      channel: 'pre-release',
      package_version_build: '0.1.0-rc.6',
      integrity: 'sha512-rc6',
    },
    expected: vector.canonical,
    observed: vector.canonical,
    recovered: vector.canonical,
    retrievalMethod: 'inline canonical text',
  })
  assert.equal(observation.complete, true)
  assert.equal(observation.native_support, false)
})
