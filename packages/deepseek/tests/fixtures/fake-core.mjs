#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'

import { CORE_TOOL_NAMES, validateCoreResultEnvelope } from '../helpers/core-contract.mjs'

export const CORE_RESULT_LIMIT = 1_048_576
export const RAW_CORE_TOOLS = CORE_TOOL_NAMES

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const fixtureRoot = join(repositoryRoot, 'protocol', 'fixtures')
const TOOL_FIXTURES = Object.freeze({
  dev_flow_server_info: 'server-info.json',
  dev_flow_open_task: 'open-task.json',
  dev_flow_get_task: 'task.json',
  dev_flow_get_next_action: 'next-action.json',
  dev_flow_apply_action: 'apply-success.json',
  dev_flow_cancel_task: 'cancelled-outcome.json',
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fixtureEnvelope(tool) {
  const path = join(fixtureRoot, TOOL_FIXTURES[tool])
  const parsed = JSON.parse(readFileSync(path, 'utf8').replace('${VERSION}', '0.1.0-fixture'))
  parsed.request_id = `request-fake-${tool.slice('dev_flow_'.length)}`
  validateCoreResultEnvelope(parsed)
  return parsed
}

function actionResult(caseName) {
  const recoveryFixture = JSON.parse(readFileSync(join(fixtureRoot, 'recovery-not-started.json'), 'utf8'))
  const task = recoveryFixture.result.task
  const envelope = {
    schema_version: 1,
    ok: true,
    request_id: `request-${caseName.replaceAll('_', '-')}`,
    tool: 'dev_flow_get_next_action',
    result: {
      task_id: task.task_id,
      phase: task.phase,
      revision: task.revision,
      action: task.current_action,
      blocker: null,
      outcome: null,
      recovery_assessment: null,
    },
  }
  if (caseName === 'near_spill') envelope.result.action.guidance = 'n'.repeat(48 * 1024)
  if (caseName === 'spilled') envelope.result.action.guidance = 's'.repeat(72 * 1024)
  if (caseName === 'pruned') envelope.result.action.guidance = 'p'.repeat(96 * 1024)
  if (caseName === 'near_core_limit') {
    envelope.result.action.guidance = ''
    const empty = JSON.stringify(envelope)
    envelope.result.action.guidance = 'l'.repeat(CORE_RESULT_LIMIT - Buffer.byteLength(empty) - 1024)
  }
  validateCoreResultEnvelope(envelope)
  return envelope
}

const PUBLIC_FAILURES = Object.freeze({
  INVALID_ARGUMENT: Object.freeze([
    'The request does not match the closed Core contract.', 'none',
    'Correct the request before submitting it again.',
  ]),
  NOT_GIT_REPOSITORY: Object.freeze([
    'The requested path is not a Git repository.', 'none', 'Choose a valid local Git repository.',
  ]),
  TASK_NOT_FOUND: Object.freeze([
    'The task was not found.', 'read_task', 'Confirm the retained task identity before continuing.',
  ]),
  ACTIVE_TASK_CONFLICT: Object.freeze([
    'The repository already has an incompatible active task.', 'cancel_or_finish_active_task',
    'Finish or cancel the active task before opening another contract.',
  ]),
  HOST_OWNERSHIP_CONFLICT: Object.freeze([
    'The task belongs to another host.', 'use_origin_host', 'Resume the task from its origin host.',
  ]),
  REVISION_CONFLICT: Object.freeze([
    'The submitted task revision is stale.', 'read_task',
    'Read the authoritative task before another mutation.',
  ]),
  ACTION_STALE: Object.freeze([
    'The submitted action identity is stale.', 'read_next_action',
    'Read and use the exact persisted next action.',
  ]),
  REPOSITORY_DRIFT: Object.freeze([
    'The repository binding is not permitted for this operation.', 'resolve_repository_drift',
    'Restore the required repository reality before continuing.',
  ]),
  VERIFICATION_BUDGET_EXCEEDED: Object.freeze([
    'The submitted evidence exceeds the verification budget.', 'read_next_action',
    'Read the current action and remain within its evidence budget.',
  ]),
  TASK_BLOCKED: Object.freeze([
    'The task is blocked.', 'read_next_action', 'Read the persisted blocker-resolution action.',
  ]),
  TASK_TERMINAL: Object.freeze([
    'The task is terminal.', 'read_task', 'Read the retained terminal outcome.',
  ]),
  SCHEMA_UNSUPPORTED: Object.freeze([
    'The storage schema is unsupported.', 'repair_storage',
    'Use compatible Core storage before continuing.',
  ]),
  STORAGE_UNAVAILABLE: Object.freeze([
    'Core storage is unavailable.', 'repair_storage', 'Restore storage availability before continuing.',
  ]),
  INTERNAL_ERROR: Object.freeze([
    'The Core could not complete the operation.', 'report_internal_error',
    'Report the bounded failure and stop this operation.',
  ]),
})

function errorEnvelope(requestID, tool, requestedCode = 'REVISION_CONFLICT') {
  const code = Object.hasOwn(PUBLIC_FAILURES, requestedCode) ? requestedCode : 'INTERNAL_ERROR'
  const [message, action, recoveryMessage] = PUBLIC_FAILURES[code]
  const envelope = {
    schema_version: 1,
    ok: false,
    request_id: requestID,
    tool,
    error: { code, message },
    recovery: {
      retry_safe: false,
      action,
      message: recoveryMessage,
    },
  }
  validateCoreResultEnvelope(envelope)
  return envelope
}

function canonicalResult(caseName) {
  const envelope = caseName === 'domain_error'
    ? errorEnvelope('request-domain-error', 'dev_flow_apply_action')
    : actionResult(caseName)
  return JSON.stringify(envelope)
}

function createTaskJourney() {
  const now = '2026-01-02T03:04:05Z'
  const bindingDigest = '4'.repeat(64)
  const task = {
    task_id: 'task-deepseek-fixture',
    origin_host: 'deepseek',
    contract: {
      goal: 'Exercise deterministic DeepSeek host behavior',
      scope: ['fixture behavior'],
      out_of_scope: ['native support evidence'],
      acceptance_criteria: ['The fake task reaches the Core-owned DONE phase.'],
      verification_budget: {
        level: 'targeted',
        max_automatic_commands: 3,
        allow_full_suite: false,
        allow_manual_handoff: false,
      },
    },
    repository: {
      canonical_root: '/repo',
      git_common_dir_digest: '1'.repeat(64),
      repository_identity: '2'.repeat(64),
      branch: 'main', detached: false, head: 'a'.repeat(40), unborn: false,
      worktree_fingerprint: '3'.repeat(64), observed_at: now, binding_digest: bindingDigest,
    },
    phase: 'INTAKE', resume_phase: null, current_action: null, blocker: null,
    last_operation: null, evidence: [], outcome: null, revision: 0,
    created_at: now, updated_at: now, completed_at: null,
  }
  const blueprints = [
    {
      phase: 'INTAKE', kind: 'ASSESS_TASK', effects: ['read_repository'],
      evidence: ['repository_observation', 'assessment_summary'],
      guidance: 'Assess the task contract and repository without modifying source files.',
    },
    {
      phase: 'ASSESS', kind: 'PLAN_CHANGE', effects: ['read_repository'],
      evidence: ['repository_observation', 'implementation_plan'],
      guidance: 'Produce the bounded implementation and verification plan.',
    },
    {
      phase: 'PLAN', kind: 'IMPLEMENT_CHANGE', effects: ['read_repository', 'edit_repository_files'],
      evidence: ['repository_observation', 'implementation_summary'],
      guidance: 'Implement only the current plan and report the changed surface.',
    },
    {
      phase: 'IMPLEMENT', kind: 'VERIFY_CHANGE', effects: ['read_repository', 'run_verification_commands'],
      evidence: ['repository_observation', 'verification_summary'],
      guidance: 'Verify the implementation within the task verification budget.',
    },
    {
      phase: 'VERIFY', kind: 'REVIEW_CHANGE', effects: ['read_repository'],
      evidence: ['repository_observation', 'review_summary'],
      guidance: 'Review the verified change against the contract and plan.',
    },
    {
      phase: 'REVIEW', kind: 'PREPARE_HANDOFF', effects: ['read_repository', 'prepare_delivery_summary'],
      evidence: ['repository_observation', 'review_summary'],
      guidance: 'Prepare the final acceptance mapping and handoff decision.',
    },
    {
      phase: 'HANDOFF', kind: 'PREPARE_HANDOFF', effects: ['read_repository', 'prepare_delivery_summary'],
      evidence: ['repository_observation', 'delivery_summary'],
      guidance: 'Complete the closed delivery summary for the task.',
    },
    {
      phase: 'BLOCKED', kind: 'RESOLVE_BLOCKER', effects: ['read_repository', 'resolve_blocker'],
      evidence: ['repository_observation', 'blocker_resolution'],
      guidance: 'Satisfy the stored blocker condition and return only to its resume phase.',
    },
  ]
  const blueprintByPhase = new Map(blueprints.map(blueprint => [blueprint.phase, blueprint]))
  const committedRequests = new Map()
  let blocker = null
  let actionSequence = 0

  function domainError(code, message) {
    return Object.assign(new Error(message), { code })
  }

  function taskSnapshot() {
    return structuredClone(task)
  }

  function issueAction(phase, revision) {
    const blueprint = blueprintByPhase.get(phase)
    if (blueprint === undefined) throw domainError('INTERNAL_ERROR', 'fixture phase has no action blueprint')
    actionSequence += 1
    return {
      action_id: `action-${actionSequence}`,
      kind: blueprint.kind,
      task_id: task.task_id,
      revision,
      repository_binding_digest: bindingDigest,
      allowed_effects: blueprint.effects,
      required_evidence: blueprint.evidence.map(kind => ({ kind, required: true })),
      payload_contract: blueprint.phase,
      guidance: blueprint.guidance,
      issued_at: now,
    }
  }

  function currentResult() {
    return {
      task_id: task.task_id,
      phase: task.phase,
      revision: task.revision,
      action: task.current_action === null ? null : structuredClone(task.current_action),
      blocker: blocker === null ? null : structuredClone(blocker),
      outcome: task.outcome === null ? null : structuredClone(task.outcome),
      recovery_assessment: null,
    }
  }

  function exactKeys(value, expected) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const actual = Object.keys(value).sort()
    const wanted = [...expected].sort()
    return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
  }

  function strings(value) {
    return Array.isArray(value) && value.every(item => typeof item === 'string')
  }

  function validateBudget(value) {
    return exactKeys(value, [
      'level', 'max_automatic_commands', 'allow_full_suite', 'allow_manual_handoff',
    ])
      && ['minimal', 'targeted', 'full'].includes(value.level)
      && Number.isInteger(value.max_automatic_commands)
      && value.max_automatic_commands >= 0
      && value.max_automatic_commands <= 20
      && typeof value.allow_full_suite === 'boolean'
      && typeof value.allow_manual_handoff === 'boolean'
  }

  function validateNewTask(value) {
    return exactKeys(value, [
      'goal', 'scope', 'out_of_scope', 'acceptance_criteria', 'verification_budget',
    ])
      && typeof value.goal === 'string' && value.goal.length > 0
      && strings(value.scope) && strings(value.out_of_scope)
      && strings(value.acceptance_criteria) && value.acceptance_criteria.length > 0
      && validateBudget(value.verification_budget)
  }

  function normalizeNewTask(value) {
    if (!validateNewTask(value)) return null
    const normalizeList = values => values.map(item => item.trim())
    const normalized = {
      goal: value.goal.trim(),
      scope: normalizeList(value.scope),
      out_of_scope: normalizeList(value.out_of_scope),
      acceptance_criteria: normalizeList(value.acceptance_criteria),
      verification_budget: structuredClone(value.verification_budget),
    }
    const unique = values => new Set(values).size === values.length && values.every(item => item.length > 0)
    return normalized.goal.length > 0
      && unique(normalized.scope)
      && unique(normalized.out_of_scope)
      && unique(normalized.acceptance_criteria)
      ? normalized : null
  }

  function applyOperationDigest(input, sourcePhase, payload = input.payload) {
    return sha256(JSON.stringify({
      host: input.host,
      task_id: input.task_id,
      expected_revision: input.revision,
      action_id: input.action_id,
      action_kind: input.action_kind,
      repository_binding_digest: input.repository_binding_digest,
      source_phase: sourcePhase,
      payload,
    }))
  }

  function validateEvidenceInput(value) {
    return exactKeys(value, [
      'source', 'name', 'status', 'summary', 'command_count', 'full_suite',
    ])
      && ['automated', 'user', 'static', 'host_observed'].includes(value.source)
      && typeof value.name === 'string' && value.name.length > 0
      && ['passed', 'failed', 'skipped', 'not_run', 'observed'].includes(value.status)
      && typeof value.summary === 'string' && value.summary.length > 0
      && Number.isInteger(value.command_count) && value.command_count >= 0 && value.command_count <= 20
      && typeof value.full_suite === 'boolean'
      && (value.source === 'automated' || (value.command_count === 0 && value.full_suite === false))
  }

  function validateDelivery(value) {
    return exactKeys(value, [
      'acceptance', 'automated_evidence_ids', 'manual_evidence_ids', 'unverified_items', 'risks',
    ])
      && Array.isArray(value.acceptance) && value.acceptance.length > 0
      && value.acceptance.every(item => exactKeys(item, ['criterion', 'status'])
        && typeof item.criterion === 'string' && item.criterion.length > 0
        && ['satisfied', 'unverified'].includes(item.status))
      && strings(value.automated_evidence_ids) && strings(value.manual_evidence_ids)
      && strings(value.unverified_items) && strings(value.risks)
  }

  function validatePayload(action, payload) {
    let valid = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      && typeof payload.result === 'string' && typeof payload.summary === 'string' && payload.summary.length > 0
    if (valid && action.kind === 'ASSESS_TASK') {
      valid = exactKeys(payload, [
        'result', 'summary', 'constraints', 'risks', 'intended_changed_surface',
        'verification_budget_acknowledged',
      ]) && payload.result === 'succeeded' && strings(payload.constraints) && strings(payload.risks)
        && strings(payload.intended_changed_surface) && payload.verification_budget_acknowledged === true
    } else if (valid && action.kind === 'PLAN_CHANGE') {
      valid = exactKeys(payload, [
        'result', 'summary', 'steps', 'expected_changed_paths', 'non_goals',
        'verification_steps', 'unresolved_questions',
      ]) && payload.result === 'succeeded' && strings(payload.steps) && payload.steps.length > 0
        && strings(payload.expected_changed_paths) && strings(payload.non_goals)
        && strings(payload.verification_steps) && payload.verification_steps.length > 0
        && strings(payload.unresolved_questions) && payload.unresolved_questions.length === 0
    } else if (valid && action.kind === 'IMPLEMENT_CHANGE') {
      valid = exactKeys(payload, [
        'result', 'summary', 'changed_paths', 'no_file_changes', 'deviations', 'scope_confirmed',
      ]) && payload.result === 'succeeded' && strings(payload.changed_paths)
        && typeof payload.no_file_changes === 'boolean' && strings(payload.deviations)
        && ((payload.changed_paths.length > 0) !== payload.no_file_changes)
        && payload.scope_confirmed === true
    } else if (valid && action.kind === 'VERIFY_CHANGE') {
      valid = exactKeys(payload, [
        'result', 'summary', 'checks', 'failed_items', 'unverified_items', 'manual_handoff_items', 'reason',
      ]) && ['ready', 'failed'].includes(payload.result)
        && Array.isArray(payload.checks) && payload.checks.every(validateEvidenceInput)
        && strings(payload.failed_items) && strings(payload.unverified_items)
        && strings(payload.manual_handoff_items) && typeof payload.reason === 'string'
    } else if (valid && action.kind === 'REVIEW_CHANGE') {
      valid = exactKeys(payload, ['result', 'summary', 'findings', 'residual_risks', 'reason'])
        && ['pass', 'rework_implementation', 'replan'].includes(payload.result)
        && strings(payload.findings) && strings(payload.residual_risks) && typeof payload.reason === 'string'
    } else if (valid && action.kind === 'PREPARE_HANDOFF') {
      const results = action.payload_contract === 'HANDOFF'
        ? ['complete', 'rework_implementation', 'replan']
        : ['ready', 'rework_implementation', 'replan']
      valid = exactKeys(payload, ['result', 'summary', 'delivery', 'reason'])
        && results.includes(payload.result) && (payload.delivery === null || validateDelivery(payload.delivery))
        && typeof payload.reason === 'string'
    } else if (valid && action.kind === 'RESOLVE_BLOCKER') {
      valid = exactKeys(payload, ['result', 'blocker_id', 'summary', 'resolution_evidence'])
        && payload.result === 'succeeded' && payload.blocker_id === task.blocker?.blocker_id
        && exactKeys(payload.resolution_evidence, ['condition', 'observed_binding_digest'])
        && exactKeys(payload.resolution_evidence.condition, ['kind', 'expected_binding_digest'])
        && payload.resolution_evidence.condition.kind === 'restore_issuance_binding'
        && payload.resolution_evidence.condition.expected_binding_digest === bindingDigest
        && payload.resolution_evidence.observed_binding_digest === bindingDigest
    } else {
      valid = false
    }
    if (!valid) throw domainError('INVALID_ARGUMENT', 'payload does not match the closed action schema')
  }

  function nextPhase(action, result) {
    if (action.payload_contract === 'INTAKE' && result === 'succeeded') return 'ASSESS'
    if (action.payload_contract === 'ASSESS' && result === 'succeeded') return 'PLAN'
    if (action.payload_contract === 'PLAN' && result === 'succeeded') return 'IMPLEMENT'
    if (action.payload_contract === 'IMPLEMENT' && result === 'ready') return 'VERIFY'
    if (action.payload_contract === 'IMPLEMENT' && result === 'failed') return 'IMPLEMENT'
    if (action.payload_contract === 'VERIFY' && result === 'pass') return 'REVIEW'
    if (action.payload_contract === 'VERIFY' && result === 'rework_implementation') return 'IMPLEMENT'
    if (action.payload_contract === 'VERIFY' && result === 'replan') return 'PLAN'
    if (action.payload_contract === 'REVIEW' && result === 'ready') return 'HANDOFF'
    if (action.payload_contract === 'REVIEW' && result === 'rework_implementation') return 'IMPLEMENT'
    if (action.payload_contract === 'REVIEW' && result === 'replan') return 'PLAN'
    if (action.payload_contract === 'HANDOFF' && result === 'complete') return 'DONE'
    if (action.payload_contract === 'HANDOFF' && result === 'rework_implementation') return 'IMPLEMENT'
    if (action.payload_contract === 'HANDOFF' && result === 'replan') return 'PLAN'
    if (action.payload_contract === 'BLOCKED' && result === 'succeeded' && task.resume_phase !== null) {
      return task.resume_phase
    }
    throw domainError('INVALID_ARGUMENT', 'payload result does not define a legal transition')
  }

  function validateProbe(probe) {
    const shapeValid = exactKeys(probe, [
      'operation_id', 'source_phase', 'expected_revision', 'action_id', 'action_kind',
      'repository_binding_digest', 'payload',
    ])
      && typeof probe.operation_id === 'string' && probe.operation_id.length > 0
      && probe.operation_id.length <= 128
      && typeof probe.source_phase === 'string' && Number.isInteger(probe.expected_revision)
      && probe.expected_revision >= 1
      && typeof probe.action_id === 'string' && probe.action_id.length > 0
      && typeof probe.action_kind === 'string'
      && /^[a-f0-9]{64}$/.test(probe.repository_binding_digest)
    const blueprint = blueprintByPhase.get(probe?.source_phase)
    if (!shapeValid || blueprint === undefined || blueprint.kind !== probe.action_kind) return false
    if (probe.payload === null) return true
    try {
      validatePayload({ kind: probe.action_kind, payload_contract: probe.source_phase }, probe.payload)
      return true
    } catch {
      return false
    }
  }

  function recoveryAssessment(probe) {
    if (!validateProbe(probe)) throw domainError('INVALID_ARGUMENT', 'operation probe is invalid')
    const committed = committedRequests.get(probe.operation_id)
    const payloadDigest = applyOperationDigest({
      host: 'deepseek', task_id: task.task_id, revision: probe.expected_revision,
      action_id: probe.action_id, action_kind: probe.action_kind,
      repository_binding_digest: probe.repository_binding_digest, payload: probe.payload,
    }, probe.source_phase)
    const exactCommitted = committed !== undefined
      && probe.source_phase === committed.source_phase
      && probe.expected_revision === committed.from_revision
      && probe.action_id === committed.action_id
      && probe.action_kind === committed.action_kind
      && probe.repository_binding_digest === committed.repository_binding_digest
      && payloadDigest === committed.payload_digest
    const current = task.current_action
    const exactCurrent = committed === undefined && current !== null
      && probe.source_phase === current.payload_contract
      && probe.expected_revision === current.revision
      && probe.action_id === current.action_id
      && probe.action_kind === current.kind
      && probe.repository_binding_digest === current.repository_binding_digest
    const classification = exactCommitted ? 'completed_and_recorded' : exactCurrent ? 'not_started' : 'conflicting'
    return {
      classification,
      operation: {
        operation_id: probe.operation_id,
        source_phase: probe.source_phase,
        expected_revision: probe.expected_revision,
        action_id: probe.action_id,
        action_kind: probe.action_kind,
      },
      task_revision: task.revision,
      current_action_id: task.current_action?.action_id ?? null,
      issuance_binding_digest: probe.repository_binding_digest,
      authoritative_binding_digest: bindingDigest,
      observed_binding_digest: bindingDigest,
      repository_relation: 'exact',
      last_operation_relation: exactCommitted ? 'exact' : classification === 'conflicting' ? 'contradictory' : 'unrelated',
      operation_evidence: exactCommitted ? 'complete' : classification === 'conflicting' ? 'contradictory' : 'none',
      operation_payload_digest: payloadDigest,
      committed_proof: exactCommitted ? {
        operation_id: committed.operation_id, kind: 'apply_action', action_id: committed.action_id,
        from_revision: committed.from_revision, to_revision: committed.to_revision,
        payload_digest: committed.payload_digest, committed_at: now,
      } : null,
      action_retry_safe: classification === 'not_started',
      next_advice: exactCommitted ? 'read_next_action'
        : classification === 'not_started' ? 'retry_current_action' : 'resolve_blocker',
      unblock_condition: null,
      observed_at: now,
    }
  }

  return {
    open(input, requestID = 'request-open') {
      if (!exactKeys(input, Object.hasOwn(input, 'new_task')
        ? ['host', 'repository_path', 'new_task'] : ['host', 'repository_path'])) {
        throw domainError('INVALID_ARGUMENT', 'open input does not match the closed schema')
      }
      const { host, repository_path: repositoryPath, new_task: newTask } = input
      if (host !== 'deepseek') throw domainError('HOST_OWNERSHIP_CONFLICT', 'fixture accepts only host=deepseek')
      if (typeof repositoryPath !== 'string' || repositoryPath.length === 0) {
        throw domainError('INVALID_ARGUMENT', 'repository_path is required')
      }
      if (task.revision === 0) {
        const normalized = normalizeNewTask(newTask)
        if (normalized === null) throw domainError('INVALID_ARGUMENT', 'new_task is invalid')
        task.contract = normalized
        task.repository.canonical_root = repositoryPath
        task.revision = 1
        task.current_action = issueAction('INTAKE', task.revision)
        task.last_operation = {
          operation_id: requestID, kind: 'open_task', action_id: null,
          from_revision: 0, to_revision: 1,
          payload_digest: sha256(JSON.stringify({
            host, repository_identity: task.repository.repository_identity, contract: task.contract,
          })),
          committed_at: now,
        }
        return { created: true, task: taskSnapshot() }
      }
      const suppliedContract = newTask === undefined || newTask === null ? null : normalizeNewTask(newTask)
      if (newTask !== undefined && newTask !== null && suppliedContract === null) {
        throw domainError('INVALID_ARGUMENT', 'new_task is invalid')
      }
      if (repositoryPath !== task.repository.canonical_root
        || (suppliedContract !== null && JSON.stringify(suppliedContract) !== JSON.stringify(task.contract))) {
        throw domainError('ACTIVE_TASK_CONFLICT', 'fixture task ownership conflicts with the requested open')
      }
      return { created: false, task: taskSnapshot() }
    },
    get(input) {
      if (!exactKeys(input, Object.hasOwn(input, 'operation_probe')
        ? ['host', 'task_id', 'operation_probe'] : ['host', 'task_id'])) {
        throw domainError('INVALID_ARGUMENT', 'read input does not match the closed schema')
      }
      if (input.host !== 'deepseek') throw domainError('HOST_OWNERSHIP_CONFLICT', 'fixture accepts only host=deepseek')
      if (input.task_id !== task.task_id) throw domainError('TASK_NOT_FOUND', 'unknown task')
      return {
        task: taskSnapshot(),
        recovery_assessment: input.operation_probe === undefined || input.operation_probe === null
          ? null : recoveryAssessment(input.operation_probe),
      }
    },
    next(input) {
      if (!exactKeys(input, Object.hasOwn(input, 'operation_probe')
        ? ['host', 'task_id', 'operation_probe'] : ['host', 'task_id'])) {
        throw domainError('INVALID_ARGUMENT', 'read input does not match the closed schema')
      }
      if (input.host !== 'deepseek') throw domainError('HOST_OWNERSHIP_CONFLICT', 'fixture accepts only host=deepseek')
      if (input.task_id !== task.task_id) throw domainError('TASK_NOT_FOUND', 'unknown task')
      const result = currentResult()
      result.recovery_assessment = input.operation_probe === undefined || input.operation_probe === null
        ? null : recoveryAssessment(input.operation_probe)
      return result
    },
    apply(input) {
      const baseKeys = [
        'request_id', 'host', 'task_id', 'revision', 'action_id', 'action_kind',
        'repository_binding_digest', 'payload',
      ]
      const hasRecoveryApply = Object.hasOwn(input, 'recovery_apply')
      if (!exactKeys(input, hasRecoveryApply ? [...baseKeys, 'recovery_apply'] : baseKeys)) {
        throw domainError('INVALID_ARGUMENT', 'apply input does not match the closed schema')
      }
      const {
        action_id: actionID, action_kind: actionKind, task_id: taskID, request_id: requestID,
        host, revision, repository_binding_digest: repositoryBindingDigest, payload,
        recovery_apply: recoveryApply,
      } = input
      if (host !== 'deepseek') throw domainError('HOST_OWNERSHIP_CONFLICT', 'fixture accepts only host=deepseek')
      if (taskID !== task.task_id) throw domainError('TASK_NOT_FOUND', 'unknown task')
      if (recoveryApply !== undefined && recoveryApply !== null) {
        if (!exactKeys(recoveryApply, ['operation_id', 'source_phase'])
          || typeof recoveryApply.operation_id !== 'string' || recoveryApply.operation_id.length === 0) {
          throw domainError('INVALID_ARGUMENT', 'recovery_apply does not match the closed schema')
        }
        const committed = committedRequests.get(recoveryApply.operation_id)
        if (committed === undefined || recoveryApply.source_phase !== committed.source_phase
          || actionKind !== committed.action_kind) {
          throw domainError('INVALID_ARGUMENT', 'recovery_apply source identity is invalid')
        }
        if (revision !== committed.from_revision) throw domainError('REVISION_CONFLICT', 'recovery revision is stale')
        if (actionID !== committed.action_id
          || repositoryBindingDigest !== committed.repository_binding_digest
          || applyOperationDigest(input, committed.source_phase) !== committed.payload_digest
          || task.last_operation?.operation_id !== committed.operation_id) {
          throw domainError('ACTION_STALE', 'recovery operation is not the exact last committed action')
        }
        return { task: taskSnapshot(), repository_claim_released: task.phase === 'DONE' }
      }
      const expected = task.current_action
      if (expected === null) throw domainError('TASK_TERMINAL', 'terminal task has no action')
      if (revision !== task.revision) throw domainError('REVISION_CONFLICT', 'stale task revision')
      if (actionID !== expected.action_id || actionKind !== expected.kind) throw domainError('ACTION_STALE', 'stale action identity')
      if (repositoryBindingDigest !== expected.repository_binding_digest) {
        throw domainError('REPOSITORY_DRIFT', 'repository binding differs from action issuance')
      }
      validatePayload(expected, payload)
      const newChecks = expected.kind === 'VERIFY_CHANGE' ? payload.checks : []
      const addedCommands = newChecks
        .filter(check => check.source === 'automated')
        .reduce((total, check) => total + check.command_count, 0)
      const usedCommands = task.evidence
        .filter(evidence => evidence.source === 'automated')
        .reduce((total, evidence) => total + evidence.command_count, 0)
      const violatesFullSuite = newChecks.some(check => check.full_suite)
        && !task.contract.verification_budget.allow_full_suite
      const violatesManualHandoff = (newChecks.some(check => check.source === 'user')
        || (expected.kind === 'VERIFY_CHANGE' && payload.manual_handoff_items.length > 0))
        && !task.contract.verification_budget.allow_manual_handoff
      if (violatesFullSuite || violatesManualHandoff
        || usedCommands + addedCommands > task.contract.verification_budget.max_automatic_commands) {
        throw domainError('VERIFICATION_BUDGET_EXCEEDED', 'verification budget exceeded')
      }
      const fromRevision = task.revision
      const toPhase = nextPhase(expected, payload.result)
      task.revision += 1
      for (const check of newChecks) {
        task.evidence.push({
          evidence_id: `evidence-${task.revision}-${task.evidence.length + 1}`,
          source: check.source,
          name: check.name,
          status: check.status,
          summary: check.summary,
          digest: sha256(JSON.stringify(check)),
          command_count: check.command_count,
          full_suite: check.full_suite,
          recorded_at: now,
        })
      }
      const payloadDigest = applyOperationDigest(input, expected.payload_contract)
      if (expected.kind === 'RESOLVE_BLOCKER') {
        task.evidence.push({
          evidence_id: `evidence-${task.revision}-blocker-resolution`,
          source: 'host_observed',
          name: 'blocker_resolution',
          status: 'observed',
          summary: payload.summary,
          digest: payloadDigest,
          command_count: 0,
          full_suite: false,
          recorded_at: now,
        })
      }
      task.last_operation = {
        operation_id: requestID, kind: 'apply_action', action_id: actionID,
        from_revision: fromRevision, to_revision: task.revision,
        payload_digest: payloadDigest, committed_at: now,
      }
      if (toPhase === 'DONE') {
        task.phase = 'DONE'
        task.current_action = null
        task.outcome = {
          status: 'completed',
          acceptance: [{ criterion: task.contract.acceptance_criteria[0], status: 'satisfied' }],
          automated_evidence_ids: [], manual_evidence_ids: [], unverified_items: [], risks: [],
          final_repository_binding_digest: bindingDigest,
          summary: 'The fake task completed under Core-owned authority.', completed_at: now,
        }
        task.completed_at = now
      } else {
        if (expected.kind === 'RESOLVE_BLOCKER') {
          blocker = null
          task.blocker = null
          task.resume_phase = null
        }
        task.phase = toPhase
        task.current_action = issueAction(toPhase, task.revision)
      }
      const result = { task: taskSnapshot(), repository_claim_released: task.phase === 'DONE' }
      committedRequests.set(requestID, {
        operation_id: requestID,
        action_id: expected.action_id,
        action_kind: expected.kind,
        repository_binding_digest: expected.repository_binding_digest,
        from_revision: fromRevision,
        to_revision: task.revision,
        source_phase: expected.payload_contract,
        payload_digest: payloadDigest,
        result,
      })
      return result
    },
    setBlocker(message = 'fixture blocker') {
      const resumePhase = task.phase
      const sourceAction = task.current_action
      const fromRevision = task.revision
      blocker = {
        blocker_id: 'blocker-fixture', code: 'TASK_BLOCKED', cause: 'conflicting', message,
        resume_phase: resumePhase, observed_binding_digest: '8'.repeat(64),
        condition: { kind: 'restore_issuance_binding', expected_binding_digest: bindingDigest },
        required_resolution: 'Restore the issuance binding before continuing.', created_at: now,
      }
      task.revision += 1
      task.resume_phase = resumePhase
      task.phase = 'BLOCKED'
      task.blocker = structuredClone(blocker)
      task.current_action = issueAction('BLOCKED', task.revision)
      task.last_operation = {
        operation_id: 'operation-fixture-blocker', kind: 'apply_action',
        action_id: sourceAction.action_id, from_revision: fromRevision, to_revision: task.revision,
        payload_digest: '7'.repeat(64), committed_at: now,
      }
      return { task: taskSnapshot() }
    },
    cancel(input, requestID = 'request-cancel') {
      if (!exactKeys(input, ['host', 'task_id', 'revision', 'reason'])) {
        throw domainError('INVALID_ARGUMENT', 'cancel input does not match the closed schema')
      }
      if (input.host !== 'deepseek') throw domainError('HOST_OWNERSHIP_CONFLICT', 'fixture accepts only host=deepseek')
      if (input.task_id !== task.task_id) throw domainError('TASK_NOT_FOUND', 'unknown task')
      if (input.revision !== task.revision) throw domainError('REVISION_CONFLICT', 'stale task revision')
      const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
      if (reason.length === 0) {
        throw domainError('INVALID_ARGUMENT', 'cancellation reason is required')
      }
      const fromRevision = task.revision
      task.revision += 1
      task.phase = 'CANCELLED'
      task.current_action = null
      task.blocker = null
      task.resume_phase = null
      task.outcome = {
        status: 'cancelled',
        acceptance: [{ criterion: task.contract.acceptance_criteria[0], status: 'unverified' }],
        automated_evidence_ids: [], manual_evidence_ids: [],
        unverified_items: [task.contract.acceptance_criteria[0]], risks: [reason],
        final_repository_binding_digest: bindingDigest,
        summary: reason, completed_at: now,
      }
      task.last_operation = {
        operation_id: requestID, kind: 'cancel_task', action_id: null,
        from_revision: fromRevision, to_revision: task.revision,
        payload_digest: sha256(JSON.stringify({
          host: input.host, task_id: input.task_id, expected_revision: input.revision, reason,
        })),
        committed_at: now,
      }
      task.completed_at = now
      return { task: taskSnapshot(), repository_claim_released: true }
    },
    verification() {
      return {
        used: task.evidence
          .filter(evidence => evidence.source === 'automated')
          .reduce((total, evidence) => total + evidence.command_count, 0),
        limit: task.contract.verification_budget.max_automatic_commands,
      }
    },
  }
}

export function createResultVector(caseName) {
  if (caseName === 'task_journey') return { state: createTaskJourney() }
  if (!['inline_success', 'domain_error', 'near_spill', 'spilled', 'pruned', 'near_core_limit'].includes(caseName)) {
    throw new Error(`unknown fixture vector: ${caseName}`)
  }
  const canonical = canonicalResult(caseName)
  if (Buffer.byteLength(canonical) > CORE_RESULT_LIMIT) throw new Error('fixture exceeded Core result limit')
  return Object.freeze({ case: caseName, canonical, sha256: sha256(canonical) })
}

const definitions = Object.freeze({
  identifier: { type: 'string', minLength: 1, maxLength: 128 },
  digest: { type: 'string', pattern: '^[0-9a-f]{64}$' },
  host: { type: 'string', enum: ['codex', 'deepseek'] },
  sourcePhase: { type: 'string', enum: ['INTAKE', 'ASSESS', 'PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'HANDOFF', 'BLOCKED'] },
  actionKind: { type: 'string', enum: ['ASSESS_TASK', 'PLAN_CHANGE', 'IMPLEMENT_CHANGE', 'VERIFY_CHANGE', 'REVIEW_CHANGE', 'PREPARE_HANDOFF', 'RESOLVE_BLOCKER'] },
  boundedList: { type: 'array', maxItems: 64, items: { type: 'string', maxLength: 4096 } },
  pathList: { type: 'array', maxItems: 64, items: { type: 'string', maxLength: 4096 } },
  verificationBudget: {
    type: 'object', additionalProperties: false,
    required: ['level', 'max_automatic_commands', 'allow_full_suite', 'allow_manual_handoff'],
    properties: {
      level: { type: 'string', enum: ['minimal', 'targeted', 'full'] },
      max_automatic_commands: { type: 'integer', minimum: 0, maximum: 20 },
      allow_full_suite: { type: 'boolean' },
      allow_manual_handoff: { type: 'boolean' },
    },
  },
  newTask: {
    type: 'object', additionalProperties: false,
    required: ['goal', 'scope', 'out_of_scope', 'acceptance_criteria', 'verification_budget'],
    properties: {
      goal: { type: 'string', minLength: 1, maxLength: 8192 },
      scope: { type: 'array', maxItems: 64, items: { type: 'string', maxLength: 1024 } },
      out_of_scope: { type: 'array', maxItems: 64, items: { type: 'string', maxLength: 1024 } },
      acceptance_criteria: {
        type: 'array', minItems: 1, maxItems: 64, items: { type: 'string', maxLength: 2048 },
      },
      verification_budget: { $ref: '#/$defs/verificationBudget' },
    },
  },
  blockerCondition: {
    type: 'object', additionalProperties: false,
    required: ['kind', 'expected_binding_digest'],
    properties: {
      kind: { type: 'string', const: 'restore_issuance_binding' },
      expected_binding_digest: { $ref: '#/$defs/digest' },
    },
  },
  evidenceInput: {
    type: 'object', additionalProperties: false,
    required: ['source', 'name', 'status', 'summary', 'command_count', 'full_suite'],
    properties: {
      source: { type: 'string', enum: ['automated', 'user', 'static', 'host_observed'] },
      name: { type: 'string', minLength: 1, maxLength: 256 },
      status: { type: 'string', enum: ['passed', 'failed', 'skipped', 'not_run', 'observed'] },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      command_count: { type: 'integer', minimum: 0, maximum: 20 },
      full_suite: { type: 'boolean' },
    },
  },
  outcomeCriterion: {
    type: 'object', additionalProperties: false, required: ['criterion', 'status'],
    properties: {
      criterion: { type: 'string', minLength: 1, maxLength: 2048 },
      status: { type: 'string', enum: ['satisfied', 'unverified'] },
    },
  },
  delivery: {
    type: 'object', additionalProperties: false,
    required: ['acceptance', 'automated_evidence_ids', 'manual_evidence_ids', 'unverified_items', 'risks'],
    properties: {
      acceptance: { type: 'array', minItems: 1, maxItems: 64, items: { $ref: '#/$defs/outcomeCriterion' } },
      automated_evidence_ids: { type: 'array', maxItems: 256, items: { $ref: '#/$defs/identifier' } },
      manual_evidence_ids: { type: 'array', maxItems: 256, items: { $ref: '#/$defs/identifier' } },
      unverified_items: { $ref: '#/$defs/boundedList' },
      risks: { $ref: '#/$defs/boundedList' },
    },
  },
  assessPayload: {
    type: 'object', additionalProperties: false,
    required: [
      'result', 'summary', 'constraints', 'risks', 'intended_changed_surface',
      'verification_budget_acknowledged',
    ],
    properties: {
      result: { type: 'string', const: 'succeeded' }, summary: { type: 'string', minLength: 1, maxLength: 2048 },
      constraints: { $ref: '#/$defs/boundedList' }, risks: { $ref: '#/$defs/boundedList' },
      intended_changed_surface: { $ref: '#/$defs/boundedList' },
      verification_budget_acknowledged: { type: 'boolean', const: true },
    },
  },
  planPayload: {
    type: 'object', additionalProperties: false,
    required: [
      'result', 'summary', 'steps', 'expected_changed_paths', 'non_goals',
      'verification_steps', 'unresolved_questions',
    ],
    properties: {
      result: { type: 'string', const: 'succeeded' }, summary: { type: 'string', minLength: 1, maxLength: 2048 },
      steps: { $ref: '#/$defs/boundedList' }, expected_changed_paths: { $ref: '#/$defs/pathList' },
      non_goals: { $ref: '#/$defs/boundedList' }, verification_steps: { $ref: '#/$defs/boundedList' },
      unresolved_questions: { $ref: '#/$defs/boundedList' },
    },
  },
  implementPayload: {
    type: 'object', additionalProperties: false,
    required: ['result', 'summary', 'changed_paths', 'no_file_changes', 'deviations', 'scope_confirmed'],
    properties: {
      result: { type: 'string', const: 'succeeded' }, summary: { type: 'string', minLength: 1, maxLength: 2048 },
      changed_paths: { $ref: '#/$defs/pathList' }, no_file_changes: { type: 'boolean' },
      deviations: { $ref: '#/$defs/boundedList' }, scope_confirmed: { type: 'boolean', const: true },
    },
  },
  verifyPayload: {
    type: 'object', additionalProperties: false,
    required: ['result', 'summary', 'checks', 'failed_items', 'unverified_items', 'manual_handoff_items', 'reason'],
    properties: {
      result: { type: 'string', enum: ['ready', 'failed'] },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      checks: { type: 'array', maxItems: 32, items: { $ref: '#/$defs/evidenceInput' } },
      failed_items: { $ref: '#/$defs/boundedList' }, unverified_items: { $ref: '#/$defs/boundedList' },
      manual_handoff_items: { $ref: '#/$defs/boundedList' }, reason: { type: 'string', maxLength: 4096 },
    },
  },
  reviewPayload: {
    type: 'object', additionalProperties: false,
    required: ['result', 'summary', 'findings', 'residual_risks', 'reason'],
    properties: {
      result: { type: 'string', enum: ['pass', 'rework_implementation', 'replan'] },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      findings: { $ref: '#/$defs/boundedList' }, residual_risks: { $ref: '#/$defs/boundedList' },
      reason: { type: 'string', maxLength: 4096 },
    },
  },
  reviewHandoffPayload: {
    type: 'object', additionalProperties: false, required: ['result', 'summary', 'delivery', 'reason'],
    properties: {
      result: { type: 'string', enum: ['ready', 'rework_implementation', 'replan'] },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      delivery: { anyOf: [{ $ref: '#/$defs/delivery' }, { type: 'null' }] },
      reason: { type: 'string', maxLength: 4096 },
    },
  },
  completeHandoffPayload: {
    type: 'object', additionalProperties: false, required: ['result', 'summary', 'delivery', 'reason'],
    properties: {
      result: { type: 'string', enum: ['complete', 'rework_implementation', 'replan'] },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      delivery: { anyOf: [{ $ref: '#/$defs/delivery' }, { type: 'null' }] },
      reason: { type: 'string', maxLength: 4096 },
    },
  },
  resolveBlockerPayload: {
    type: 'object', additionalProperties: false,
    required: ['result', 'blocker_id', 'summary', 'resolution_evidence'],
    properties: {
      result: { type: 'string', const: 'succeeded' }, blocker_id: { $ref: '#/$defs/identifier' },
      summary: { type: 'string', minLength: 1, maxLength: 2048 },
      resolution_evidence: {
        type: 'object', additionalProperties: false,
        required: ['condition', 'observed_binding_digest'],
        properties: {
          condition: { $ref: '#/$defs/blockerCondition' },
          observed_binding_digest: { $ref: '#/$defs/digest' },
        },
      },
    },
  },
  actionPayload: {
    anyOf: [
      { $ref: '#/$defs/assessPayload' }, { $ref: '#/$defs/planPayload' },
      { $ref: '#/$defs/implementPayload' }, { $ref: '#/$defs/verifyPayload' },
      { $ref: '#/$defs/reviewPayload' }, { $ref: '#/$defs/reviewHandoffPayload' },
      { $ref: '#/$defs/completeHandoffPayload' }, { $ref: '#/$defs/resolveBlockerPayload' },
    ],
  },
  operationProbe: {
    type: 'object', additionalProperties: false,
    required: [
      'operation_id', 'source_phase', 'expected_revision', 'action_id', 'action_kind',
      'repository_binding_digest', 'payload',
    ],
    properties: {
      operation_id: { $ref: '#/$defs/identifier' },
      source_phase: { $ref: '#/$defs/sourcePhase' },
      expected_revision: { type: 'integer', minimum: 1 }, action_id: { $ref: '#/$defs/identifier' },
      action_kind: { $ref: '#/$defs/actionKind' },
      repository_binding_digest: { $ref: '#/$defs/digest' },
      payload: { anyOf: [{ $ref: '#/$defs/actionPayload' }, { type: 'null' }] },
    },
  },
  recoveryApply: {
    type: 'object', additionalProperties: false,
    required: ['operation_id', 'source_phase'],
    properties: {
      operation_id: { $ref: '#/$defs/identifier' },
      source_phase: { $ref: '#/$defs/sourcePhase' },
    },
  },
})

function inputSchema(required, properties) {
  return { type: 'object', additionalProperties: false, required, properties, $defs: definitions }
}

const inputSchemas = Object.freeze({
  dev_flow_server_info: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  dev_flow_open_task: inputSchema(['host', 'repository_path'], {
    host: { $ref: '#/$defs/host' },
    repository_path: { type: 'string', minLength: 1, maxLength: 4096 },
    new_task: { anyOf: [{ $ref: '#/$defs/newTask' }, { type: 'null' }] },
  }),
  dev_flow_get_task: inputSchema(['host', 'task_id'], {
    host: { $ref: '#/$defs/host' }, task_id: { $ref: '#/$defs/identifier' },
    operation_probe: { anyOf: [{ $ref: '#/$defs/operationProbe' }, { type: 'null' }] },
  }),
  dev_flow_get_next_action: inputSchema(['host', 'task_id'], {
    host: { $ref: '#/$defs/host' }, task_id: { $ref: '#/$defs/identifier' },
    operation_probe: { anyOf: [{ $ref: '#/$defs/operationProbe' }, { type: 'null' }] },
  }),
  dev_flow_apply_action: inputSchema([
    'request_id', 'host', 'task_id', 'revision', 'action_id', 'action_kind',
    'repository_binding_digest', 'payload',
  ], {
    request_id: { $ref: '#/$defs/identifier' }, host: { $ref: '#/$defs/host' },
    task_id: { $ref: '#/$defs/identifier' }, revision: { type: 'integer', minimum: 1 },
    action_id: { $ref: '#/$defs/identifier' },
    action_kind: { $ref: '#/$defs/actionKind' },
    repository_binding_digest: { $ref: '#/$defs/digest' },
    payload: { anyOf: [{ $ref: '#/$defs/actionPayload' }, { type: 'null' }] },
    recovery_apply: { anyOf: [{ $ref: '#/$defs/recoveryApply' }, { type: 'null' }] },
  }),
  dev_flow_cancel_task: inputSchema(['host', 'task_id', 'revision', 'reason'], {
    host: { $ref: '#/$defs/host' }, task_id: { $ref: '#/$defs/identifier' },
    revision: { type: 'integer', minimum: 1 }, reason: { type: 'string', minLength: 1, maxLength: 4096 },
  }),
})

const annotations = Object.freeze({
  dev_flow_server_info: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  dev_flow_open_task: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  dev_flow_get_task: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  dev_flow_get_next_action: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  dev_flow_apply_action: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  dev_flow_cancel_task: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
})

const descriptions = Object.freeze({
  dev_flow_server_info: 'Report the ready local Core contract, version, supported host identities, and exact tool list.',
  dev_flow_open_task: 'Create one governed repository task or resume its compatible active task.',
  dev_flow_get_task: 'Read one authoritative task and optionally assess an uncertain operation without persistence.',
  dev_flow_get_next_action: 'Read the exact persisted next action or terminal outcome, with optional transient recovery assessment.',
  dev_flow_apply_action: 'Submit the closed payload for the exact current action or an explicit recovery apply.',
  dev_flow_cancel_task: 'Explicitly cancel a host-owned task at its exact revision while retaining task history.',
})

const tools = RAW_CORE_TOOLS.map(name => ({
  name,
  description: descriptions[name],
  inputSchema: inputSchemas[name],
  annotations: annotations[name],
}))
const mcpState = createTaskJourney()

function mcpResult(envelope) {
  validateCoreResultEnvelope(envelope)
  const canonical = JSON.stringify(envelope)
  return {
    isError: !envelope.ok,
    content: [{ type: 'text', text: canonical }],
    structuredContent: envelope,
  }
}

function response(message) {
  if (message.method === 'initialize') {
    return {
      jsonrpc: '2.0', id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'dev-flow-fake-core', version: '0.1.0-fixture' },
      },
    }
  }
  if (message.method === 'tools/list') {
    return { jsonrpc: '2.0', id: message.id, result: { tools } }
  }
  if (message.method === 'tools/call') {
    const name = message.params?.name
    if (!RAW_CORE_TOOLS.includes(name)) {
      return {
        jsonrpc: '2.0', id: message.id,
        result: mcpResult(errorEnvelope(
          'request-invalid-tool', 'dev_flow_server_info', 'INVALID_ARGUMENT',
        )),
      }
    }
    const args = message.params?.arguments ?? {}
    const requestID = name === 'dev_flow_apply_action' && typeof args.request_id === 'string'
      ? args.request_id : `request-fake-${message.id}`
    let envelope
    try {
      let result
      if (name === 'dev_flow_server_info') {
        if (Object.keys(args).length !== 0) throw Object.assign(new Error('server-info input must be empty'), { code: 'INVALID_ARGUMENT' })
        result = fixtureEnvelope(name).result
      } else if (name === 'dev_flow_open_task') {
        result = mcpState.open(args, requestID)
      } else if (name === 'dev_flow_get_task') {
        result = mcpState.get(args)
      } else if (name === 'dev_flow_get_next_action') {
        result = mcpState.next(args)
      } else if (name === 'dev_flow_apply_action') {
        result = mcpState.apply(args)
      } else {
        result = mcpState.cancel(args, requestID)
      }
      envelope = { schema_version: 1, ok: true, request_id: requestID, tool: name, result }
    } catch (error) {
      envelope = errorEnvelope(requestID, name, error?.code ?? 'INTERNAL_ERROR')
    }
    return { jsonrpc: '2.0', id: message.id, result: mcpResult(envelope) }
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }
}

async function serve() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const line of lines) {
    if (line.trim() === '') continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`)
      continue
    }
    if (message.id === undefined) continue
    process.stdout.write(`${JSON.stringify(response(message))}\n`)
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await serve()
}
