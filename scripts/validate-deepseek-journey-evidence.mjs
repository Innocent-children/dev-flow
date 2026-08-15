#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const STABLE_GATE_CASES = Object.freeze([
  'inline_success',
  'domain_error',
  'near_spill',
  'spilled',
  'pruned',
  'near_core_limit',
])

function invalid(message) {
  throw new Error(`invalid DeepSeek journey evidence: ${message}`)
}

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(`${label} must be an object`)
  return value
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) invalid(`${label} must be a non-empty string`)
  return value
}

function requireDigest(value, label, length = 64) {
  requireString(value, label)
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(value)) invalid(`${label} must be a lowercase hexadecimal digest`)
}

function requireEqual(left, right, label) {
  if (left !== right) invalid(`${label} must match`)
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(requireObject(value, label)).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    invalid(`${label} contains unsupported fields`)
  }
}

function validateStableGate(stableGate, harness) {
  requireEqual(
    stableGate.harness_package_version_build,
    harness.package_version_build,
    'stable Gate B Harness identity',
  )
  if (!Array.isArray(stableGate.observations) || stableGate.observations.length !== STABLE_GATE_CASES.length) {
    invalid('stable Gate B must contain six observations')
  }
  const seen = new Set()
  const expectedDigests = new Set()
  for (const observationValue of stableGate.observations) {
    const observation = requireObject(observationValue, 'stable Gate B observation')
    if (!STABLE_GATE_CASES.includes(observation.case) || seen.has(observation.case)) {
      invalid('stable Gate B cases must be exact and distinct')
    }
    seen.add(observation.case)
    if (observation.gate_kind !== 'stable') invalid('stable Gate B observation must use gate_kind=stable')
    if (observation.classification !== 'stable-native') {
      invalid('stable Gate B observation requires stable-native classification')
    }
    const selection = requireObject(observation.harness_selection, 'stable Gate B harness_selection')
    if (selection.channel !== 'stable') invalid('stable Gate B observation requires a stable Harness channel')
    requireEqual(
      selection.package_version_build,
      harness.package_version_build,
      'stable Gate B observation Harness version/build',
    )
    requireEqual(selection.integrity, harness.integrity, 'stable Gate B observation Harness integrity')
    if (!Number.isInteger(observation.core_bytes) || observation.core_bytes < 1
      || !Number.isInteger(observation.recovered_bytes) || observation.recovered_bytes < 1) {
      invalid('stable Gate B byte counts must be positive integers')
    }
    requireEqual(observation.core_bytes, observation.recovered_bytes, 'stable Gate B recovered byte count')
    requireDigest(observation.expected_sha256, 'stable Gate B expected_sha256')
    requireDigest(observation.recovered_sha256, 'stable Gate B recovered_sha256')
    requireEqual(observation.expected_sha256, observation.recovered_sha256, 'stable Gate B recovered digest')
    expectedDigests.add(observation.expected_sha256)
    requireString(observation.host_representation, 'stable Gate B host_representation')
    requireString(observation.retrieval_method, 'stable Gate B retrieval_method')
    if (!observation.retrieval_method.startsWith('official:')) {
      invalid('stable Gate B requires an exact official retrieval method')
    }
    if (observation.marker_detected !== null
      && !['spilled', 'pruned', 'truncated', 'malformed'].includes(observation.marker_detected)) {
      invalid('stable Gate B marker_detected is invalid')
    }
    if (observation.complete_parse !== true || observation.complete !== true) {
      invalid('stable Gate B observation is incomplete')
    }
    if (observation.case === 'domain_error') {
      if (observation.core_ok !== false) invalid('stable Gate B domain_error must contain a Core error')
    } else if (observation.core_ok !== true) {
      invalid(`stable Gate B ${observation.case} must contain a Core success`)
    }
    if (observation.case === 'spilled' || observation.case === 'pruned') {
      if (observation.marker_detected !== observation.case) {
        invalid(`stable Gate B ${observation.case} observation requires its exact marker`)
      }
      if (observation.host_representation.trimStart().startsWith('{')) {
        invalid(`stable Gate B ${observation.case} observation requires a non-inline host representation`)
      }
    }
  }
  if (expectedDigests.size !== STABLE_GATE_CASES.length) {
    invalid('stable Gate B cases must contain six distinct Core result identities')
  }
}

function validateCodex(codex) {
  if (codex.classification !== 'stable-native-real') {
    invalid('pass requires a real Codex non-interference comparison')
  }
  if (codex.native_comparison_performed !== true || codex.complete !== true) {
    invalid('Codex non-interference must be a complete native comparison')
  }
  requireString(codex.codex_product_version, 'Codex.codex_product_version')
  for (const surface of ['registration', 'runtime', 'package_selection', 'shared_data']) {
    const before = codex[`${surface}_before_sha256`]
    const after = codex[`${surface}_after_sha256`]
    requireDigest(before, `Codex.${surface}_before_sha256`)
    requireDigest(after, `Codex.${surface}_after_sha256`)
    requireEqual(before, after, `Codex ${surface} before/after identity`)
  }
}

function validateStopped(record) {
  requireExactKeys(record, [
    'schema_version', 'status', 'classification', 'support_claim', 'blocking_reasons',
  ], `${record.status} stopped record`)
  if (record.classification !== 'unverified') invalid(`${record.status} evidence must remain unverified`)
  if (record.support_claim !== false) invalid(`${record.status} evidence cannot claim support`)
  if (!Array.isArray(record.blocking_reasons) || record.blocking_reasons.length === 0) {
    invalid(`${record.status} evidence requires at least one blocking reason`)
  }
  for (const reason of record.blocking_reasons) requireString(reason, 'blocking reason')
  return record
}

function validatePass(record) {
  if (record.classification !== 'stable-native') invalid('pass requires stable-native classification')
  if (record.support_claim !== true) invalid('pass requires an explicit bounded support claim')
  if (record.proxy_presence !== 'none') invalid('pass requires proxy absence')

  const harness = requireObject(record.harness, 'harness')
  if (harness.channel !== 'stable') invalid('pass requires a stable Harness channel')
  requireString(harness.package_version_build, 'harness.package_version_build')
  if (harness.package_version_build.includes('-')) invalid('pass cannot use a pre-release Harness artifact')
  requireString(harness.integrity, 'harness.integrity')

  const stableGate = requireObject(record.stable_gate, 'stable_gate')
  validateStableGate(stableGate, harness)

  const source = requireObject(record.source, 'source')
  requireDigest(source.frozen_commit, 'source.frozen_commit', 40)
  requireDigest(source.validated_commit, 'source.validated_commit', 40)
  requireEqual(source.frozen_commit, source.validated_commit, 'frozen and validated source commits')

  const artifact = requireObject(record.artifact, 'artifact')
  requireDigest(artifact.sha256, 'artifact.sha256')
  requireEqual(artifact.source_commit, source.frozen_commit, 'artifact source commit')

  const task = requireObject(record.task, 'task')
  requireString(task.id, 'task.id')
  if (!Array.isArray(task.revisions) || task.revisions.length < 2) invalid('task revisions must contain lineage')
  for (let index = 0; index < task.revisions.length; index += 1) {
    const revision = task.revisions[index]
    if (!Number.isInteger(revision) || revision < 1) invalid('task revisions must be positive integers')
    if (index > 0 && revision <= task.revisions[index - 1]) invalid('task revisions must strictly increase')
  }
  if (!Number.isInteger(task.action_commits) || task.action_commits < 2) invalid('pass requires two action commits')
  if (task.outcome !== 'DONE') invalid('pass requires the Core-owned DONE outcome')

  const verification = requireObject(record.verification, 'verification')
  if (!Number.isInteger(verification.used) || !Number.isInteger(verification.limit)
    || verification.used < 0 || verification.limit < 0 || verification.used > verification.limit) {
    invalid('verification usage must stay within the Core budget')
  }
  if (verification.root_validation !== 'pass') invalid('root validation must pass before final evidence')

  for (const [label, comparison] of [
    ['data', requireObject(record.data, 'data')],
    ['repository', requireObject(record.repository, 'repository')],
  ]) {
    requireDigest(comparison.before_sha256, `${label}.before_sha256`)
    requireDigest(comparison.after_sha256, `${label}.after_sha256`)
    requireEqual(comparison.before_sha256, comparison.after_sha256, `${label} before/after identity`)
  }

  if (requireObject(record.reinstall, 'reinstall').resume_succeeded !== true) {
    invalid('compatible reinstall must resume the retained task')
  }

  const codex = requireObject(record.codex, 'codex')
  validateCodex(codex)

  if (!Array.isArray(record.failures) || record.failures.length !== 0) invalid('pass cannot contain failures')
  if (!Array.isArray(record.skips) || record.skips.length !== 0) invalid('pass cannot skip required evidence')
  return record
}

export async function validateEvidenceDocument(path) {
  const document = await readFile(path, 'utf8')
  const matches = [...document.matchAll(/```json\s*\n([\s\S]*?)\n```/g)]
  if (matches.length !== 1) invalid('document must contain exactly one fenced JSON record')
  let record
  try {
    record = JSON.parse(matches[0][1])
  } catch (error) {
    throw new Error('invalid DeepSeek journey evidence: fenced record is not JSON', { cause: error })
  }
  requireObject(record, 'record')
  if (record.schema_version !== 1) invalid('schema_version must equal 1')
  if (record.status === 'blocked' || record.status === 'failed') return validateStopped(record)
  if (record.status === 'pass') return validatePass(record)
  invalid('status must be pass, blocked, or failed')
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2]
  if (path === undefined) {
    process.stderr.write('usage: validate-deepseek-journey-evidence.mjs <evidence.md>\n')
    process.exitCode = 2
  } else {
    try {
      const record = await validateEvidenceDocument(path)
      process.stdout.write(`${record.status}\n`)
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = 1
    }
  }
}
