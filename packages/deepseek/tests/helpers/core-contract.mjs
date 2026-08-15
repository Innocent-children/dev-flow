export const CORE_TOOL_NAMES = Object.freeze([
  'dev_flow_server_info',
  'dev_flow_open_task',
  'dev_flow_get_task',
  'dev_flow_get_next_action',
  'dev_flow_apply_action',
  'dev_flow_cancel_task',
])

const ERROR_CODES = new Set([
  'INVALID_ARGUMENT', 'NOT_GIT_REPOSITORY', 'TASK_NOT_FOUND', 'ACTIVE_TASK_CONFLICT',
  'HOST_OWNERSHIP_CONFLICT', 'REVISION_CONFLICT', 'ACTION_STALE', 'REPOSITORY_DRIFT',
  'VERIFICATION_BUDGET_EXCEEDED', 'TASK_BLOCKED', 'TASK_TERMINAL', 'SCHEMA_UNSUPPORTED',
  'STORAGE_UNAVAILABLE', 'INTERNAL_ERROR',
])
const RECOVERY_ACTIONS = new Set([
  'none', 'read_task', 'read_next_action', 'resolve_repository_drift', 'use_origin_host',
  'cancel_or_finish_active_task', 'repair_storage', 'report_internal_error',
])
const ACTION_KINDS = new Set([
  'ASSESS_TASK', 'PLAN_CHANGE', 'IMPLEMENT_CHANGE', 'VERIFY_CHANGE', 'REVIEW_CHANGE',
  'PREPARE_HANDOFF', 'RESOLVE_BLOCKER',
])
const PHASES = new Set([
  'INTAKE', 'ASSESS', 'PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'HANDOFF', 'BLOCKED', 'DONE', 'CANCELLED',
])
const NORMAL_PHASES = new Set(['INTAKE', 'ASSESS', 'PLAN', 'IMPLEMENT', 'VERIFY', 'REVIEW', 'HANDOFF'])
const ALLOWED_EFFECTS = new Set([
  'read_repository', 'edit_repository_files', 'run_verification_commands',
  'prepare_delivery_summary', 'resolve_blocker',
])
const EVIDENCE_KINDS = new Set([
  'repository_observation', 'assessment_summary', 'implementation_plan', 'implementation_summary',
  'verification_summary', 'review_summary', 'delivery_summary', 'blocker_resolution',
])
const RECOVERY_CLASSIFICATIONS = new Set([
  'not_started', 'completed_and_recorded', 'completed_but_unrecorded', 'partially_completed', 'conflicting',
])
const ACTION_BLUEPRINTS = Object.freeze({
  INTAKE: Object.freeze({
    kind: 'ASSESS_TASK', effects: ['read_repository'],
    evidence: ['repository_observation', 'assessment_summary'],
  }),
  ASSESS: Object.freeze({
    kind: 'PLAN_CHANGE', effects: ['read_repository'],
    evidence: ['repository_observation', 'implementation_plan'],
  }),
  PLAN: Object.freeze({
    kind: 'IMPLEMENT_CHANGE', effects: ['read_repository', 'edit_repository_files'],
    evidence: ['repository_observation', 'implementation_summary'],
  }),
  IMPLEMENT: Object.freeze({
    kind: 'VERIFY_CHANGE', effects: ['read_repository', 'run_verification_commands'],
    evidence: ['repository_observation', 'verification_summary'],
  }),
  VERIFY: Object.freeze({
    kind: 'REVIEW_CHANGE', effects: ['read_repository'],
    evidence: ['repository_observation', 'review_summary'],
  }),
  REVIEW: Object.freeze({
    kind: 'PREPARE_HANDOFF', effects: ['read_repository', 'prepare_delivery_summary'],
    evidence: ['repository_observation', 'review_summary'],
  }),
  HANDOFF: Object.freeze({
    kind: 'PREPARE_HANDOFF', effects: ['read_repository', 'prepare_delivery_summary'],
    evidence: ['repository_observation', 'delivery_summary'],
  }),
  BLOCKED: Object.freeze({
    kind: 'RESOLVE_BLOCKER', effects: ['read_repository', 'resolve_blocker'],
    evidence: ['repository_observation', 'blocker_resolution'],
  }),
})

function contractError(message) {
  throw new Error(`Core Contract 0.1 envelope: ${message}`)
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) contractError(`${label} must be an object`)
  return value
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    contractError(`${label} members differ from the committed contract`)
  }
}

function nonempty(value, label) {
  if (typeof value !== 'string' || value.length === 0) contractError(`${label} must be a non-empty string`)
}

function identifier(value, label) {
  nonempty(value, label)
  if (value.length > 128) contractError(`${label} exceeds the identifier limit`)
}

function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) contractError(`${label} must be a SHA-256 digest`)
}

function timestamp(value, label) {
  nonempty(value, label)
  if (Number.isNaN(Date.parse(value))) contractError(`${label} must be a timestamp`)
}

function integer(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) contractError(`${label} must be an integer >= ${minimum}`)
}

function array(value, label) {
  if (!Array.isArray(value)) contractError(`${label} must be an array`)
  return value
}

function stringArray(value, label) {
  for (const [index, item] of array(value, label).entries()) {
    if (typeof item !== 'string') contractError(`${label}[${index}] must be a string`)
  }
}

function nullable(value, label, validate) {
  if (value !== null) validate(value, label)
}

function validateVerificationBudget(value, label) {
  const budget = object(value, label)
  exactKeys(budget, ['level', 'max_automatic_commands', 'allow_full_suite', 'allow_manual_handoff'], label)
  if (!['minimal', 'targeted', 'full'].includes(budget.level)) contractError(`${label}.level is invalid`)
  integer(budget.max_automatic_commands, `${label}.max_automatic_commands`)
  if (typeof budget.allow_full_suite !== 'boolean' || typeof budget.allow_manual_handoff !== 'boolean') {
    contractError(`${label} permissions must be booleans`)
  }
}

function validateContract(value, label) {
  const contract = object(value, label)
  exactKeys(contract, [
    'goal', 'scope', 'out_of_scope', 'acceptance_criteria', 'verification_budget',
  ], label)
  nonempty(contract.goal, `${label}.goal`)
  stringArray(contract.scope, `${label}.scope`)
  stringArray(contract.out_of_scope, `${label}.out_of_scope`)
  stringArray(contract.acceptance_criteria, `${label}.acceptance_criteria`)
  if (contract.acceptance_criteria.length === 0) contractError(`${label}.acceptance_criteria must not be empty`)
  validateVerificationBudget(contract.verification_budget, `${label}.verification_budget`)
}

function validateRepository(value, label) {
  const repository = object(value, label)
  exactKeys(repository, [
    'canonical_root', 'git_common_dir_digest', 'repository_identity', 'branch', 'detached', 'head',
    'unborn', 'worktree_fingerprint', 'observed_at', 'binding_digest',
  ], label)
  nonempty(repository.canonical_root, `${label}.canonical_root`)
  for (const field of [
    'git_common_dir_digest', 'repository_identity', 'worktree_fingerprint', 'binding_digest',
  ]) digest(repository[field], `${label}.${field}`)
  if (typeof repository.detached !== 'boolean' || typeof repository.unborn !== 'boolean') {
    contractError(`${label} detached/unborn must be booleans`)
  }
  nullable(repository.branch, `${label}.branch`, nonempty)
  nullable(repository.head, `${label}.head`, nonempty)
  timestamp(repository.observed_at, `${label}.observed_at`)
}

function validateEvidenceRequirement(value, label) {
  const requirement = object(value, label)
  exactKeys(requirement, ['kind', 'required'], label)
  if (!EVIDENCE_KINDS.has(requirement.kind) || typeof requirement.required !== 'boolean') {
    contractError(`${label} is invalid`)
  }
}

function validateAction(value, label = 'result.action') {
  const action = object(value, label)
  exactKeys(action, [
    'action_id', 'kind', 'task_id', 'revision', 'repository_binding_digest', 'allowed_effects',
    'required_evidence', 'payload_contract', 'guidance', 'issued_at',
  ], label)
  identifier(action.action_id, `${label}.action_id`)
  identifier(action.task_id, `${label}.task_id`)
  if (!ACTION_KINDS.has(action.kind)) contractError(`${label}.kind is not a committed enum`)
  integer(action.revision, `${label}.revision`, 1)
  digest(action.repository_binding_digest, `${label}.repository_binding_digest`)
  const effects = array(action.allowed_effects, `${label}.allowed_effects`)
  if (effects.length === 0 || effects.some(effect => !ALLOWED_EFFECTS.has(effect))) {
    contractError(`${label}.allowed_effects is invalid`)
  }
  const requirements = array(action.required_evidence, `${label}.required_evidence`)
  if (requirements.length === 0) contractError(`${label}.required_evidence must not be empty`)
  requirements.forEach((requirement, index) => validateEvidenceRequirement(requirement, `${label}.required_evidence[${index}]`))
  if (!PHASES.has(action.payload_contract)) contractError(`${label}.payload_contract is invalid`)
  const blueprint = ACTION_BLUEPRINTS[action.payload_contract]
  if (blueprint === undefined || action.kind !== blueprint.kind
    || effects.length !== blueprint.effects.length
    || effects.some((effect, index) => effect !== blueprint.effects[index])
    || requirements.length !== blueprint.evidence.length
    || requirements.some((requirement, index) => (
      requirement.kind !== blueprint.evidence[index] || requirement.required !== true
    ))) {
    contractError(`${label} does not match the Core phase blueprint`)
  }
  nonempty(action.guidance, `${label}.guidance`)
  timestamp(action.issued_at, `${label}.issued_at`)
}

function validateLastOperation(value, label) {
  const operation = object(value, label)
  exactKeys(operation, [
    'operation_id', 'kind', 'action_id', 'from_revision', 'to_revision', 'payload_digest', 'committed_at',
  ], label)
  identifier(operation.operation_id, `${label}.operation_id`)
  if (!['open_task', 'apply_action', 'cancel_task'].includes(operation.kind)) contractError(`${label}.kind is invalid`)
  nullable(operation.action_id, `${label}.action_id`, identifier)
  integer(operation.from_revision, `${label}.from_revision`)
  integer(operation.to_revision, `${label}.to_revision`, 1)
  if (operation.to_revision !== operation.from_revision + 1) {
    contractError(`${label} revision transition is invalid`)
  }
  digest(operation.payload_digest, `${label}.payload_digest`)
  timestamp(operation.committed_at, `${label}.committed_at`)
}

function validateEvidence(value, label) {
  const evidence = object(value, label)
  exactKeys(evidence, [
    'evidence_id', 'source', 'name', 'status', 'summary', 'digest', 'command_count', 'full_suite', 'recorded_at',
  ], label)
  identifier(evidence.evidence_id, `${label}.evidence_id`)
  if (!['automated', 'user', 'static', 'host_observed'].includes(evidence.source)) contractError(`${label}.source is invalid`)
  nonempty(evidence.name, `${label}.name`)
  if (!['passed', 'failed', 'skipped', 'not_run', 'observed'].includes(evidence.status)) {
    contractError(`${label}.status is invalid`)
  }
  nonempty(evidence.summary, `${label}.summary`)
  digest(evidence.digest, `${label}.digest`)
  integer(evidence.command_count, `${label}.command_count`)
  if (typeof evidence.full_suite !== 'boolean') contractError(`${label}.full_suite must be a boolean`)
  timestamp(evidence.recorded_at, `${label}.recorded_at`)
}

function validateBlockerCondition(value, label) {
  const condition = object(value, label)
  exactKeys(condition, ['kind', 'expected_binding_digest'], label)
  if (condition.kind !== 'restore_issuance_binding') contractError(`${label}.kind is invalid`)
  digest(condition.expected_binding_digest, `${label}.expected_binding_digest`)
}

function validateBlocker(value, label) {
  const blocker = object(value, label)
  exactKeys(blocker, [
    'blocker_id', 'code', 'cause', 'message', 'resume_phase', 'observed_binding_digest',
    'condition', 'required_resolution', 'created_at',
  ], label)
  identifier(blocker.blocker_id, `${label}.blocker_id`)
  if (blocker.code !== 'TASK_BLOCKED') contractError(`${label}.code is invalid`)
  if (!['partially_completed', 'conflicting'].includes(blocker.cause)) contractError(`${label}.cause is invalid`)
  nonempty(blocker.message, `${label}.message`)
  if (!NORMAL_PHASES.has(blocker.resume_phase)) contractError(`${label}.resume_phase is invalid`)
  digest(blocker.observed_binding_digest, `${label}.observed_binding_digest`)
  validateBlockerCondition(blocker.condition, `${label}.condition`)
  nonempty(blocker.required_resolution, `${label}.required_resolution`)
  timestamp(blocker.created_at, `${label}.created_at`)
}

function validateOutcome(value, label) {
  const outcome = object(value, label)
  exactKeys(outcome, [
    'status', 'acceptance', 'automated_evidence_ids', 'manual_evidence_ids', 'unverified_items',
    'risks', 'final_repository_binding_digest', 'summary', 'completed_at',
  ], label)
  if (!['completed', 'cancelled'].includes(outcome.status)) contractError(`${label}.status is invalid`)
  const acceptance = array(outcome.acceptance, `${label}.acceptance`)
  if (acceptance.length === 0) contractError(`${label}.acceptance must not be empty`)
  for (const [index, itemValue] of acceptance.entries()) {
    const item = object(itemValue, `${label}.acceptance[${index}]`)
    exactKeys(item, ['criterion', 'status'], `${label}.acceptance[${index}]`)
    nonempty(item.criterion, `${label}.acceptance[${index}].criterion`)
    if (!['satisfied', 'unverified'].includes(item.status)) contractError(`${label}.acceptance[${index}].status is invalid`)
  }
  stringArray(outcome.automated_evidence_ids, `${label}.automated_evidence_ids`)
  stringArray(outcome.manual_evidence_ids, `${label}.manual_evidence_ids`)
  stringArray(outcome.unverified_items, `${label}.unverified_items`)
  stringArray(outcome.risks, `${label}.risks`)
  digest(outcome.final_repository_binding_digest, `${label}.final_repository_binding_digest`)
  nonempty(outcome.summary, `${label}.summary`)
  timestamp(outcome.completed_at, `${label}.completed_at`)
}

function validateTask(value, label = 'result.task') {
  const task = object(value, label)
  exactKeys(task, [
    'task_id', 'origin_host', 'contract', 'repository', 'phase', 'resume_phase', 'current_action',
    'blocker', 'last_operation', 'evidence', 'outcome', 'revision', 'created_at', 'updated_at', 'completed_at',
  ], label)
  identifier(task.task_id, `${label}.task_id`)
  if (!['codex', 'deepseek'].includes(task.origin_host)) contractError(`${label}.origin_host is invalid`)
  validateContract(task.contract, `${label}.contract`)
  validateRepository(task.repository, `${label}.repository`)
  if (!PHASES.has(task.phase)) contractError(`${label}.phase is invalid`)
  nullable(task.resume_phase, `${label}.resume_phase`, (phase, phaseLabel) => {
    if (!NORMAL_PHASES.has(phase)) contractError(`${phaseLabel} is invalid`)
  })
  nullable(task.current_action, `${label}.current_action`, validateAction)
  nullable(task.blocker, `${label}.blocker`, validateBlocker)
  nullable(task.last_operation, `${label}.last_operation`, validateLastOperation)
  array(task.evidence, `${label}.evidence`)
    .forEach((evidence, index) => validateEvidence(evidence, `${label}.evidence[${index}]`))
  nullable(task.outcome, `${label}.outcome`, validateOutcome)
  integer(task.revision, `${label}.revision`, 1)
  timestamp(task.created_at, `${label}.created_at`)
  timestamp(task.updated_at, `${label}.updated_at`)
  nullable(task.completed_at, `${label}.completed_at`, timestamp)

  if (task.last_operation !== null && task.last_operation.to_revision !== task.revision) {
    contractError(`${label}.last_operation does not reach the current revision`)
  }

  if (NORMAL_PHASES.has(task.phase)) {
    if (task.current_action === null || task.blocker !== null || task.resume_phase !== null
      || task.outcome !== null || task.completed_at !== null) contractError(`${label} normal-phase authority is incomplete`)
  } else if (task.phase === 'BLOCKED') {
    if (task.current_action === null || task.blocker === null || task.resume_phase === null
      || task.outcome !== null || task.completed_at !== null) contractError(`${label} blocked authority is incomplete`)
  } else if (task.current_action !== null || task.blocker !== null || task.resume_phase !== null
    || task.outcome === null || task.completed_at === null) {
    contractError(`${label} terminal authority is incomplete`)
  }
  if (task.current_action !== null
    && (task.current_action.task_id !== task.task_id
      || task.current_action.revision !== task.revision
      || task.current_action.payload_contract !== task.phase
      || task.current_action.repository_binding_digest !== task.repository.binding_digest)) {
    contractError(`${label}.current_action identity does not match the task`)
  }
  if (task.phase === 'DONE' && task.outcome?.status !== 'completed') contractError(`${label} DONE outcome is invalid`)
  if (task.phase === 'CANCELLED' && task.outcome?.status !== 'cancelled') contractError(`${label} CANCELLED outcome is invalid`)
}

function validateOperationReference(value, label) {
  const operation = object(value, label)
  exactKeys(operation, ['operation_id', 'source_phase', 'expected_revision', 'action_id', 'action_kind'], label)
  identifier(operation.operation_id, `${label}.operation_id`)
  if (!PHASES.has(operation.source_phase)) contractError(`${label}.source_phase is invalid`)
  integer(operation.expected_revision, `${label}.expected_revision`, 1)
  identifier(operation.action_id, `${label}.action_id`)
  if (!ACTION_KINDS.has(operation.action_kind)) contractError(`${label}.action_kind is invalid`)
}

function validateCommittedProof(value, label) {
  const proof = object(value, label)
  exactKeys(proof, [
    'operation_id', 'kind', 'action_id', 'from_revision', 'to_revision', 'payload_digest', 'committed_at',
  ], label)
  identifier(proof.operation_id, `${label}.operation_id`)
  if (proof.kind !== 'apply_action') contractError(`${label}.kind is invalid`)
  identifier(proof.action_id, `${label}.action_id`)
  integer(proof.from_revision, `${label}.from_revision`, 1)
  integer(proof.to_revision, `${label}.to_revision`, 2)
  digest(proof.payload_digest, `${label}.payload_digest`)
  timestamp(proof.committed_at, `${label}.committed_at`)
}

function validateRecoveryAssessment(value, label) {
  const assessment = object(value, label)
  exactKeys(assessment, [
    'classification', 'operation', 'task_revision', 'current_action_id', 'issuance_binding_digest',
    'authoritative_binding_digest', 'observed_binding_digest', 'repository_relation',
    'last_operation_relation', 'operation_evidence', 'operation_payload_digest', 'committed_proof',
    'action_retry_safe', 'next_advice', 'unblock_condition', 'observed_at',
  ], label)
  if (!RECOVERY_CLASSIFICATIONS.has(assessment.classification)) contractError(`${label}.classification is invalid`)
  validateOperationReference(assessment.operation, `${label}.operation`)
  integer(assessment.task_revision, `${label}.task_revision`, 1)
  nullable(assessment.current_action_id, `${label}.current_action_id`, identifier)
  for (const field of [
    'issuance_binding_digest', 'authoritative_binding_digest', 'observed_binding_digest', 'operation_payload_digest',
  ]) digest(assessment[field], `${label}.${field}`)
  if (!['exact', 'worktree_only_changed', 'forbidden_change'].includes(assessment.repository_relation)) {
    contractError(`${label}.repository_relation is invalid`)
  }
  if (!['exact', 'unrelated', 'contradictory'].includes(assessment.last_operation_relation)) {
    contractError(`${label}.last_operation_relation is invalid`)
  }
  if (!['none', 'complete', 'contradictory'].includes(assessment.operation_evidence)) {
    contractError(`${label}.operation_evidence is invalid`)
  }
  nullable(assessment.committed_proof, `${label}.committed_proof`, validateCommittedProof)
  if (typeof assessment.action_retry_safe !== 'boolean') contractError(`${label}.action_retry_safe must be a boolean`)
  if (!['retry_current_action', 'submit_recovery_apply', 'read_next_action', 'resolve_blocker', 'stop_for_repository_drift']
    .includes(assessment.next_advice)) contractError(`${label}.next_advice is invalid`)
  nullable(assessment.unblock_condition, `${label}.unblock_condition`, validateBlockerCondition)
  timestamp(assessment.observed_at, `${label}.observed_at`)
  if (assessment.classification === 'completed_and_recorded' && assessment.committed_proof === null) {
    contractError(`${label} completed_and_recorded requires committed_proof`)
  }
  if (assessment.classification !== 'completed_and_recorded' && assessment.committed_proof !== null) {
    contractError(`${label} committed_proof is only valid for completed_and_recorded`)
  }
}

function validateNextActionResult(value) {
  const result = object(value, 'result')
  exactKeys(result, ['task_id', 'phase', 'revision', 'action', 'blocker', 'outcome', 'recovery_assessment'], 'result')
  identifier(result.task_id, 'result.task_id')
  if (!PHASES.has(result.phase)) contractError('result.phase is invalid')
  integer(result.revision, 'result.revision', 1)
  nullable(result.action, 'result.action', validateAction)
  nullable(result.blocker, 'result.blocker', validateBlocker)
  nullable(result.outcome, 'result.outcome', validateOutcome)
  nullable(result.recovery_assessment, 'result.recovery_assessment', validateRecoveryAssessment)
  if (NORMAL_PHASES.has(result.phase)) {
    if (result.action === null || result.blocker !== null || result.outcome !== null) {
      contractError('result normal-phase authority is incomplete')
    }
  } else if (result.phase === 'BLOCKED') {
    if (result.action === null || result.blocker === null || result.outcome !== null) {
      contractError('result blocked authority is incomplete')
    }
  } else if (result.action !== null || result.blocker !== null || result.outcome === null) {
    contractError('result terminal authority is incomplete')
  }
  if (result.action !== null
    && (result.action.task_id !== result.task_id || result.action.revision !== result.revision
      || result.action.payload_contract !== result.phase)) {
    contractError('result.action identity does not match the next-action result')
  }
  if (result.phase === 'DONE' && result.outcome?.status !== 'completed') contractError('result DONE outcome is invalid')
  if (result.phase === 'CANCELLED' && result.outcome?.status !== 'cancelled') contractError('result CANCELLED outcome is invalid')
}

function validateResult(tool, value) {
  const result = object(value, 'result')
  if (tool === 'dev_flow_server_info') {
    exactKeys(result, ['product', 'version', 'schema_version', 'transport', 'health', 'supported_hosts', 'tools'], 'result')
    if (result.product !== 'dev-flow' || result.schema_version !== 1 || result.transport !== 'stdio'
      || result.health !== 'ready' || !Array.isArray(result.supported_hosts)
      || result.supported_hosts.length !== 2 || result.supported_hosts[0] !== 'codex'
      || result.supported_hosts[1] !== 'deepseek' || !Array.isArray(result.tools)
      || result.tools.length !== CORE_TOOL_NAMES.length
      || result.tools.some((name, index) => name !== CORE_TOOL_NAMES[index])) {
      contractError('server-info result is incompatible')
    }
    nonempty(result.version, 'result.version')
    return
  }
  if (tool === 'dev_flow_get_next_action') return validateNextActionResult(result)
  if (tool === 'dev_flow_open_task') {
    exactKeys(result, ['created', 'task'], 'result')
    if (typeof result.created !== 'boolean') contractError('result.created must be a boolean')
    validateTask(result.task)
    return
  }
  if (tool === 'dev_flow_get_task') {
    exactKeys(result, ['task', 'recovery_assessment'], 'result')
    validateTask(result.task)
    nullable(result.recovery_assessment, 'result.recovery_assessment', validateRecoveryAssessment)
    return
  }
  exactKeys(result, ['task', 'repository_claim_released'], 'result')
  validateTask(result.task)
  if (typeof result.repository_claim_released !== 'boolean') {
    contractError('result.repository_claim_released must be a boolean')
  }
}

export function validateCoreResultEnvelope(value) {
  const envelope = object(value, 'root')
  if (envelope.schema_version !== 1 || typeof envelope.ok !== 'boolean') {
    contractError('schema_version/ok is invalid')
  }
  identifier(envelope.request_id, 'request_id')
  if (!CORE_TOOL_NAMES.includes(envelope.tool)) contractError('tool is not one of the six committed names')
  if (envelope.ok) {
    exactKeys(envelope, ['schema_version', 'ok', 'request_id', 'tool', 'result'], 'success envelope')
    validateResult(envelope.tool, envelope.result)
  } else {
    exactKeys(envelope, ['schema_version', 'ok', 'request_id', 'tool', 'error', 'recovery'], 'error envelope')
    const error = object(envelope.error, 'error')
    const errorKeys = Object.hasOwn(error, 'details') ? ['code', 'message', 'details'] : ['code', 'message']
    exactKeys(error, errorKeys, 'error')
    if (!ERROR_CODES.has(error.code)) contractError('error.code is not a committed enum')
    nonempty(error.message, 'error.message')
    const recovery = object(envelope.recovery, 'recovery')
    exactKeys(recovery, ['retry_safe', 'action', 'message'], 'recovery')
    if (typeof recovery.retry_safe !== 'boolean' || !RECOVERY_ACTIONS.has(recovery.action)) {
      contractError('recovery guidance is invalid')
    }
    nonempty(recovery.message, 'recovery.message')
  }
  return envelope
}
