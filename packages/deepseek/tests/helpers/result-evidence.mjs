import { createHash } from 'node:crypto'

import { validateCoreResultEnvelope } from './core-contract.mjs'

export const DIRECT_RESULT_CASES = Object.freeze([
  'inline_success',
  'domain_error',
  'near_spill',
  'spilled',
  'pruned',
  'near_core_limit',
])

const CLASSIFICATIONS = new Set(['simulated', 'pre-release-native', 'stable-native'])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be a non-empty string`)
  return value
}

export function detectIncompleteRepresentation(value) {
  if (typeof value !== 'string') return 'malformed'
  if (/Full formatted result stored at:/i.test(value) || /\bOmitted \d+ bytes\b/i.test(value)) return 'spilled'
  if (/\b(?:tool result )?pruned\b/i.test(value) || /\bcompacted\b/i.test(value)) return 'pruned'
  if (/\btruncat(?:ed|ion)\b/i.test(value)) return 'truncated'
  try {
    JSON.parse(value)
  } catch {
    return 'malformed'
  }
  return null
}

export function evaluateDirectResultObservation({
  caseName,
  classification,
  harness,
  expected,
  observed,
  recovered,
  retrievalMethod,
}) {
  if (!DIRECT_RESULT_CASES.includes(caseName)) throw new Error(`unsupported direct-result case: ${caseName}`)
  if (!CLASSIFICATIONS.has(classification)) throw new Error(`unsupported evidence classification: ${classification}`)
  if (harness === null || typeof harness !== 'object') throw new TypeError('harness identity is required')
  requireString(harness.package_version_build, 'harness.package_version_build')
  requireString(harness.integrity, 'harness.integrity')
  requireString(expected, 'expected')
  requireString(observed, 'observed')
  requireString(recovered, 'recovered')
  requireString(retrievalMethod, 'retrievalMethod')

  if (classification === 'stable-native') {
    if (harness.channel !== 'stable' || harness.package_version_build.includes('-')
      || harness.integrity === 'fixture-only') {
      throw new Error('stable-native evidence requires an exact official stable artifact')
    }
  }

  if (!Buffer.from(expected).equals(Buffer.from(recovered))) {
    throw new Error('recovered canonical bytes differ from expected canonical bytes')
  }

  let parsed
  try {
    parsed = JSON.parse(recovered)
  } catch (error) {
    throw new Error('recovered canonical bytes do not contain complete JSON', { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('recovered canonical JSON must be an object')
  }
  validateCoreResultEnvelope(parsed)

  if (caseName === 'domain_error' && parsed.ok !== false) {
    throw new Error('domain_error evidence requires a complete Core error envelope')
  }
  if (caseName !== 'domain_error' && parsed.ok !== true) {
    throw new Error(`${caseName} evidence requires a complete Core success envelope`)
  }

  const expectedDigest = sha256(expected)
  const recoveredDigest = sha256(recovered)
  if (expectedDigest !== recoveredDigest) throw new Error('recovered digest differs from expected digest')

  const observedMatches = Buffer.from(expected).equals(Buffer.from(observed))
  const marker = detectIncompleteRepresentation(observed)
  if (caseName === 'spilled' && (!observedMatches && marker !== 'spilled')) {
    throw new Error('spilled evidence requires the official spill marker')
  }
  if (caseName === 'pruned' && (!observedMatches && marker !== 'pruned')) {
    throw new Error('pruned evidence requires the official prune/compaction marker')
  }
  if ((caseName === 'spilled' || caseName === 'pruned') && observedMatches) {
    throw new Error(`${caseName} evidence requires a non-inline host representation and marker`)
  }
  if (!['spilled', 'pruned'].includes(caseName) && !observedMatches) {
    throw new Error(`${caseName} evidence requires the complete inline host representation`)
  }
  if (!observedMatches) {
    if (marker === null) throw new Error('host representation differs without a recognized incomplete marker')
    if (marker === 'malformed') throw new Error('malformed host representation has no authoritative retrieval pointer')
    const recognizedRetrieval = classification === 'simulated'
      ? retrievalMethod === 'fixture read'
      : retrievalMethod.startsWith('official:')
    if (!recognizedRetrieval) throw new Error('incomplete host representation requires an exact retrieval method')
  }
  if (classification === 'stable-native' && !retrievalMethod.startsWith('official:')) {
    throw new Error('stable-native evidence requires an exact official retrieval method')
  }

  return Object.freeze({
    gate_kind: classification === 'stable-native' ? 'stable' : 'provisional',
    harness_selection: Object.freeze({ ...harness }),
    case: caseName,
    classification,
    harness: Object.freeze({ ...harness }),
    host_representation: observed,
    marker_detected: marker,
    retrieval_method: retrievalMethod,
    core_bytes: Buffer.byteLength(expected),
    expected_bytes: Buffer.byteLength(expected),
    recovered_bytes: Buffer.byteLength(recovered),
    expected_sha256: expectedDigest,
    recovered_sha256: recoveredDigest,
    complete_parse: true,
    complete: true,
    core_ok: parsed.ok,
    native_support: false,
    support_claim: false,
  })
}
