import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import test from 'node:test'

import { CORE_RESULT_LIMIT, RAW_CORE_TOOLS, createResultVector } from './fixtures/fake-core.mjs'

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-core.mjs')
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

async function authoritativeInputSchemas() {
  const source = await readFile(join(repositoryRoot, 'internal', 'mcp', 'schemas.go'), 'utf8')
  const raw = name => {
    const match = source.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\``))
    assert.notEqual(match, null, `missing ${name}`)
    return match[1]
  }
  const definitions = raw('schemaDefinitions')
  const composed = name => {
    const match = source.match(new RegExp(
      `const ${name} = \`([\\s\\S]*?)\`\\s*\\+ schemaDefinitions \\+ \`([\\s\\S]*?)\``,
    ))
    assert.notEqual(match, null, `missing composed ${name}`)
    return JSON.parse(`${match[1]}${definitions}${match[2]}`)
  }
  const read = composed('readTaskInputSchema')
  return {
    dev_flow_server_info: JSON.parse(raw('serverInfoInputSchema')),
    dev_flow_open_task: composed('openTaskInputSchema'),
    dev_flow_get_task: read,
    dev_flow_get_next_action: read,
    dev_flow_apply_action: composed('applyActionInputSchema'),
    dev_flow_cancel_task: composed('cancelTaskInputSchema'),
  }
}

const newTask = Object.freeze({
  goal: 'Exercise the bounded fake journey',
  scope: ['fake journey'],
  out_of_scope: ['native support evidence'],
  acceptance_criteria: ['The fake task reaches DONE.'],
  verification_budget: {
    level: 'targeted',
    max_automatic_commands: 3,
    allow_full_suite: false,
    allow_manual_handoff: false,
  },
})

function payloadFor(action) {
  if (action.kind === 'ASSESS_TASK') {
    return {
      result: 'succeeded', summary: 'assessed', constraints: [], risks: [],
      intended_changed_surface: ['fixture.txt'], verification_budget_acknowledged: true,
    }
  }
  if (action.kind === 'PLAN_CHANGE') {
    return {
      result: 'succeeded', summary: 'planned', steps: ['implement the fixture'],
      expected_changed_paths: ['fixture.txt'], non_goals: [],
      verification_steps: ['run the targeted fixture test'], unresolved_questions: [],
    }
  }
  if (action.kind === 'IMPLEMENT_CHANGE') {
    return {
      result: 'succeeded', summary: 'implemented', changed_paths: ['fixture.txt'],
      no_file_changes: false, deviations: [], scope_confirmed: true,
    }
  }
  if (action.kind === 'VERIFY_CHANGE') {
    return {
      result: 'ready', summary: 'verified',
      checks: [{
        source: 'automated', name: 'targeted', status: 'passed', summary: 'passed',
        command_count: 1, full_suite: false,
      }],
      failed_items: [], unverified_items: [], manual_handoff_items: [], reason: '',
    }
  }
  if (action.kind === 'REVIEW_CHANGE') {
    return { result: 'pass', summary: 'reviewed', findings: [], residual_risks: [], reason: '' }
  }
  return {
    result: action.payload_contract === 'HANDOFF' ? 'complete' : 'ready',
    summary: 'handoff',
    delivery: {
      acceptance: [{ criterion: newTask.acceptance_criteria[0], status: 'satisfied' }],
      automated_evidence_ids: [], manual_evidence_ids: [], unverified_items: [], risks: [],
    },
    reason: '',
  }
}

function advanceUntil(state, taskID, kind) {
  let next = state.next({ host: 'deepseek', task_id: taskID })
  let sequence = 0
  while (next.action?.kind !== kind) {
    assert.notEqual(next.action, null, `journey ended before ${kind}`)
    sequence += 1
    state.apply(applyInput(next.action, `advance-${kind}-${sequence}`))
    next = state.next({ host: 'deepseek', task_id: taskID })
  }
  return next
}

function applyInput(action, requestID, payload = payloadFor(action)) {
  return {
    request_id: requestID,
    host: 'deepseek',
    task_id: action.task_id,
    revision: action.revision,
    action_id: action.action_id,
    action_kind: action.kind,
    repository_binding_digest: action.repository_binding_digest,
    payload,
  }
}

function readInput(action, requestID, payload) {
  return {
    host: 'deepseek',
    task_id: action.task_id,
    operation_probe: {
      operation_id: requestID,
      source_phase: action.payload_contract,
      expected_revision: action.revision,
      action_id: action.action_id,
      action_kind: action.kind,
      repository_binding_digest: action.repository_binding_digest,
      payload,
    },
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function applyDigest(input, sourcePhase) {
  return digest(JSON.stringify({
    host: input.host,
    task_id: input.task_id,
    expected_revision: input.revision,
    action_id: input.action_id,
    action_kind: input.action_kind,
    repository_binding_digest: input.repository_binding_digest,
    source_phase: sourcePhase,
    payload: input.payload,
  }))
}

async function withFakeCore(run, childArguments = [fixturePath]) {
  const child = spawn(process.execPath, childArguments, { stdio: ['pipe', 'pipe', 'pipe'] })
  const closed = new Promise(resolve => child.once('close', resolve))
  const lines = createInterface({ input: child.stdout })
  const pending = new Map()
  lines.on('line', line => {
    const message = JSON.parse(line)
    const settle = pending.get(message.id)
    if (settle) {
      pending.delete(message.id)
      settle.resolve(message)
    }
  })
  child.once('close', code => {
    for (const { reject } of pending.values()) reject(new Error(`fake Core exited before response (${code})`))
    pending.clear()
  })
  let sequence = 0
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, error => {
      if (error) reject(error)
    })
  })
  try {
    await run(request)
  } finally {
    child.stdin.end()
    await closed
  }
}

test('fake Core helper settles when the child exits before a response', { timeout: 2_000 }, async () => {
  await assert.rejects(withFakeCore(async request => {
    await request('tools/list')
  }, ['-e', 'process.exit(7)']), /exited before response/)
})

test('fake Core advertises exactly the six raw Contract 0.1 tools', async () => {
  const authoritative = await authoritativeInputSchemas()
  await withFakeCore(async request => {
    const initialized = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'dev-flow-test', version: '0.1.0' },
    })
    assert.equal(initialized.result.serverInfo.name, 'dev-flow-fake-core')
    const listed = await request('tools/list')
    assert.deepEqual(listed.result.tools.map(tool => tool.name), RAW_CORE_TOOLS)
    for (const tool of listed.result.tools) {
      assert.equal(tool.inputSchema.type, 'object')
      assert.equal(tool.inputSchema.additionalProperties, false)
      assert.equal(typeof tool.annotations.readOnlyHint, 'boolean')
      assert.equal(typeof tool.annotations.destructiveHint, 'boolean')
      assert.equal(typeof tool.annotations.idempotentHint, 'boolean')
      assert.equal(tool.annotations.openWorldHint, false)
      assert.equal(Object.hasOwn(tool.inputSchema.properties, 'vector'), false)
      assert.equal(typeof tool.description, 'string')
      assert.ok(tool.description.length > 0)
      assert.deepEqual(tool.inputSchema, authoritative[tool.name])
    }
    const byName = Object.fromEntries(listed.result.tools.map(tool => [tool.name, tool]))
    assert.deepEqual(byName.dev_flow_apply_action.inputSchema.required, [
      'request_id', 'host', 'task_id', 'revision', 'action_id', 'action_kind',
      'repository_binding_digest', 'payload',
    ])
    assert.deepEqual(byName.dev_flow_apply_action.inputSchema.$defs.actionPayload.anyOf, [
      { $ref: '#/$defs/assessPayload' }, { $ref: '#/$defs/planPayload' },
      { $ref: '#/$defs/implementPayload' }, { $ref: '#/$defs/verifyPayload' },
      { $ref: '#/$defs/reviewPayload' }, { $ref: '#/$defs/reviewHandoffPayload' },
      { $ref: '#/$defs/completeHandoffPayload' }, { $ref: '#/$defs/resolveBlockerPayload' },
    ])
    assert.deepEqual(byName.dev_flow_apply_action.inputSchema.properties.recovery_apply, {
      anyOf: [{ $ref: '#/$defs/recoveryApply' }, { type: 'null' }],
    })
    assert.deepEqual(byName.dev_flow_get_task.inputSchema.$defs.operationProbe.properties.action_kind, {
      $ref: '#/$defs/actionKind',
    })
  })
})

for (const caseName of ['inline_success', 'domain_error', 'near_spill', 'spilled', 'pruned', 'near_core_limit']) {
  test(`fake Core returns deterministic complete ${caseName} bytes`, async () => {
    const vector = createResultVector(caseName)
    assert.ok(Buffer.byteLength(vector.canonical) <= CORE_RESULT_LIMIT)
    assert.equal(digest(vector.canonical), vector.sha256)
    if (caseName === 'near_core_limit') assert.ok(Buffer.byteLength(vector.canonical) > CORE_RESULT_LIMIT - 4096)

  })
}

test('fake vectors use the committed Core success and error envelopes', () => {
  const success = JSON.parse(createResultVector('inline_success').canonical)
  assert.deepEqual(Object.keys(success), ['schema_version', 'ok', 'request_id', 'tool', 'result'])
  assert.equal(success.schema_version, 1)
  assert.equal(success.ok, true)
  assert.equal(success.tool, 'dev_flow_get_next_action')
  assert.equal(success.result.phase, 'PLAN')
  assert.deepEqual(Object.keys(success.result.action), [
    'action_id',
    'kind',
    'task_id',
    'revision',
    'repository_binding_digest',
    'allowed_effects',
    'required_evidence',
    'payload_contract',
    'guidance',
    'issued_at',
  ])
  assert.equal(success.result.action.kind, 'IMPLEMENT_CHANGE')
  assert.deepEqual(success.result.action.allowed_effects, ['read_repository', 'edit_repository_files'])
  assert.deepEqual(success.result.action.required_evidence, [
    { kind: 'repository_observation', required: true },
    { kind: 'implementation_summary', required: true },
  ])
  assert.equal(success.result.action.payload_contract, 'PLAN')

  const failure = JSON.parse(createResultVector('domain_error').canonical)
  assert.deepEqual(Object.keys(failure), ['schema_version', 'ok', 'request_id', 'tool', 'error', 'recovery'])
  assert.equal(failure.ok, false)
  assert.equal(failure.error.code, 'REVISION_CONFLICT')
  assert.deepEqual(Object.keys(failure.recovery), ['retry_safe', 'action', 'message'])
})

test('fake STDIO rejects private vector controls and unknown tools with formal envelopes', async () => {
  await withFakeCore(async request => {
    await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' },
    })
    const privateVector = await request('tools/call', {
      name: 'dev_flow_get_next_action', arguments: { vector: 'inline_success' },
    })
    assert.equal(privateVector.result.isError, true)
    assert.equal(privateVector.result.structuredContent.error.code, 'INVALID_ARGUMENT')

    const unknown = await request('tools/call', { name: 'dev_flow_unknown', arguments: {} })
    assert.equal(unknown.result.isError, true)
    assert.deepEqual(Object.keys(unknown.result.structuredContent), [
      'schema_version', 'ok', 'request_id', 'tool', 'error', 'recovery',
    ])
  })
})

test('fake STDIO mirrors public Core failures rather than fixture diagnostics', async () => {
  await withFakeCore(async request => {
    const invalid = await request('tools/call', {
      name: 'dev_flow_server_info', arguments: { unsupported: true },
    })
    assert.deepEqual(invalid.result.structuredContent.error, {
      code: 'INVALID_ARGUMENT', message: 'The request does not match the closed Core contract.',
    })
    assert.deepEqual(invalid.result.structuredContent.recovery, {
      retry_safe: false, action: 'none', message: 'Correct the request before submitting it again.',
    })

    const ownership = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'codex', repository_path: '/repo', new_task: newTask },
    })
    assert.equal(ownership.result.structuredContent.error.message, 'The task belongs to another host.')
    assert.equal(ownership.result.structuredContent.recovery.action, 'use_origin_host')

    const missing = await request('tools/call', {
      name: 'dev_flow_get_task', arguments: { host: 'deepseek', task_id: 'missing' },
    })
    assert.equal(missing.result.structuredContent.error.message, 'The task was not found.')
    assert.equal(missing.result.structuredContent.recovery.action, 'read_task')
  })
})

test('fake STDIO executes the six closed DeepSeek tool contracts against one task', async () => {
  await withFakeCore(async request => {
    const info = await request('tools/call', { name: 'dev_flow_server_info', arguments: {} })
    assert.equal(info.result.structuredContent.result.tools.length, 6)

    const opened = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/repo', new_task: newTask },
    })
    assert.equal(opened.result.isError, false)
    assert.equal(opened.result.structuredContent.result.task.origin_host, 'deepseek')
    assert.equal(opened.result.structuredContent.result.task.phase, 'INTAKE')
    assert.equal(opened.result.structuredContent.result.task.current_action.kind, 'ASSESS_TASK')
    const taskID = opened.result.structuredContent.result.task.task_id

    const read = await request('tools/call', {
      name: 'dev_flow_get_task', arguments: { host: 'deepseek', task_id: taskID },
    })
    assert.equal(read.result.structuredContent.result.task.task_id, taskID)

    let next = (await request('tools/call', {
      name: 'dev_flow_get_next_action', arguments: { host: 'deepseek', task_id: taskID },
    })).result.structuredContent.result
    while (next.action !== null) {
      const applied = await request('tools/call', {
        name: 'dev_flow_apply_action',
        arguments: applyInput(next.action, `request-stdio-${next.revision}`),
      })
      assert.equal(applied.result.isError, false)
      assert.equal(applied.result.structuredContent.result.task.origin_host, 'deepseek')
      next = (await request('tools/call', {
        name: 'dev_flow_get_next_action', arguments: { host: 'deepseek', task_id: taskID },
      })).result.structuredContent.result
    }
    assert.equal(next.phase, 'DONE')
    assert.equal(next.outcome.status, 'completed')
  })

  await withFakeCore(async request => {
    const opened = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/repo', new_task: newTask },
    })
    const task = opened.result.structuredContent.result.task
    const cancelled = await request('tools/call', {
      name: 'dev_flow_cancel_task',
      arguments: {
        host: 'deepseek', task_id: task.task_id, revision: task.revision, reason: 'explicit cancellation',
      },
    })
    assert.equal(cancelled.result.isError, false)
    assert.equal(cancelled.result.structuredContent.result.task.phase, 'CANCELLED')
  })
})

test('fake mutation lineage correlates envelope request IDs and canonical Core digests', async () => {
  await withFakeCore(async request => {
    const opened = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/lineage', new_task: newTask },
    })
    const openEnvelope = opened.result.structuredContent
    const openTask = openEnvelope.result.task
    assert.equal(openTask.last_operation.operation_id, openEnvelope.request_id)
    assert.equal(openTask.last_operation.payload_digest, digest(JSON.stringify({
      host: 'deepseek', repository_identity: openTask.repository.repository_identity,
      contract: openTask.contract,
    })))

    const next = (await request('tools/call', {
      name: 'dev_flow_get_next_action',
      arguments: { host: 'deepseek', task_id: openTask.task_id },
    })).result.structuredContent.result
    const appliedInput = applyInput(next.action, 'lineage-apply')
    const applied = await request('tools/call', {
      name: 'dev_flow_apply_action', arguments: appliedInput,
    })
    assert.equal(applied.result.structuredContent.result.task.last_operation.operation_id, 'lineage-apply')
    assert.equal(
      applied.result.structuredContent.result.task.last_operation.payload_digest,
      applyDigest(appliedInput, next.phase),
    )

    const cancelledInput = {
      host: 'deepseek', task_id: openTask.task_id,
      revision: applied.result.structuredContent.result.task.revision, reason: '  explicit cancellation  ',
    }
    const cancelled = await request('tools/call', {
      name: 'dev_flow_cancel_task', arguments: cancelledInput,
    })
    const cancelEnvelope = cancelled.result.structuredContent
    assert.equal(cancelEnvelope.result.task.last_operation.operation_id, cancelEnvelope.request_id)
    assert.equal(cancelEnvelope.result.task.last_operation.payload_digest, digest(JSON.stringify({
      host: 'deepseek', task_id: openTask.task_id,
      expected_revision: cancelledInput.revision, reason: 'explicit cancellation',
    })))
    assert.equal(cancelEnvelope.result.task.outcome.summary, 'explicit cancellation')
  })
})

test('fake task journey preserves identity through uncertain mutation readback and DONE', async () => {
  const state = createResultVector('task_journey').state
  const opened = state.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  assert.equal(opened.task.revision, 1)
  const first = state.next({ host: 'deepseek', task_id: opened.task.task_id })
  const firstPayload = payloadFor(first.action)
  state.apply(applyInput(first.action, 'request-one', firstPayload))
  const recovered = state.get(readInput(first.action, 'request-one', firstPayload))
  assert.equal(recovered.recovery_assessment.classification, 'completed_and_recorded')
  const recoveryApply = applyInput(first.action, 'request-recovery-readback', firstPayload)
  recoveryApply.recovery_apply = {
    operation_id: 'request-one', source_phase: first.action.payload_contract,
  }
  const recoveredApply = state.apply(recoveryApply)
  assert.equal(recoveredApply.task.revision, 2)
  assert.equal(recoveredApply.task.current_action.kind, 'PLAN_CHANGE')
  const forgedRecovery = structuredClone(recoveryApply)
  forgedRecovery.recovery_apply.source_phase = 'PLAN'
  assert.throws(
    () => state.apply(forgedRecovery),
    error => error?.code === 'INVALID_ARGUMENT',
  )
  let actionCommits = 1
  let next = state.next({ host: 'deepseek', task_id: opened.task.task_id })
  while (next.action !== null) {
    actionCommits += 1
    state.apply(applyInput(next.action, `request-${actionCommits}`))
    next = state.next({ host: 'deepseek', task_id: opened.task.task_id })
  }
  const terminal = next
  assert.ok(actionCommits >= 2)
  assert.equal(terminal.phase, 'DONE')
  assert.equal(terminal.outcome.status, 'completed')
})

test('fake task open/resume keeps Core identity and returns deterministic conflicts', () => {
  const state = createResultVector('task_journey').state
  assert.throws(
    () => state.open({ host: 'deepseek', repository_path: '/repo', new_task: { requirement: 'one' } }),
    error => error?.code === 'INVALID_ARGUMENT',
  )
  const opened = state.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  const resumed = state.open({ host: 'deepseek', repository_path: '/repo' })
  assert.equal(resumed.task.task_id, opened.task.task_id)
  assert.equal(state.open({ host: 'deepseek', repository_path: '/repo', new_task: null }).created, false)
  const normalized = structuredClone(newTask)
  normalized.goal = `  ${normalized.goal}  `
  normalized.scope = normalized.scope.map(value => ` ${value} `)
  assert.equal(state.open({ host: 'deepseek', repository_path: '/repo', new_task: normalized }).created, false)
  const incompatible = structuredClone(newTask)
  incompatible.goal = 'A different task contract'
  assert.throws(
    () => state.open({ host: 'deepseek', repository_path: '/repo', new_task: incompatible }),
    error => error?.code === 'ACTIVE_TASK_CONFLICT',
  )
  assert.equal(state.get({ host: 'deepseek', task_id: opened.task.task_id }).task.revision, 1)
  assert.throws(
    () => state.open({ host: 'deepseek', repository_path: '/other' }),
    error => error?.code === 'ACTIVE_TASK_CONFLICT',
  )
  assert.throws(
    () => state.open({ host: 'codex', repository_path: '/repo' }),
    error => error?.code === 'HOST_OWNERSHIP_CONFLICT',
  )
})

test('fake reads treat nullable operation probes as omitted in state and STDIO paths', async () => {
  const state = createResultVector('task_journey').state
  const task = state.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask }).task
  assert.equal(state.get({ host: 'deepseek', task_id: task.task_id, operation_probe: null })
    .recovery_assessment, null)
  assert.equal(state.next({ host: 'deepseek', task_id: task.task_id, operation_probe: null })
    .recovery_assessment, null)

  await withFakeCore(async request => {
    const opened = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/nullable-probe', new_task: newTask },
    })
    const taskID = opened.result.structuredContent.result.task.task_id
    const resumed = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/nullable-probe', new_task: null },
    })
    assert.equal(resumed.result.isError, false)
    const normalized = structuredClone(newTask)
    normalized.goal = `  ${normalized.goal}  `
    const sameContract = await request('tools/call', {
      name: 'dev_flow_open_task',
      arguments: { host: 'deepseek', repository_path: '/nullable-probe', new_task: normalized },
    })
    assert.equal(sameContract.result.isError, false)
    assert.equal(sameContract.result.structuredContent.result.created, false)
    for (const name of ['dev_flow_get_task', 'dev_flow_get_next_action']) {
      const result = await request('tools/call', {
        name, arguments: { host: 'deepseek', task_id: taskID, operation_probe: null },
      })
      assert.equal(result.result.isError, false)
      assert.equal(result.result.structuredContent.result.recovery_assessment, null)
    }
  })
})

test('fake action authority carries fresh identity, closed payload, and bounded verification', () => {
  const state = createResultVector('task_journey').state
  const opened = state.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  const first = advanceUntil(state, opened.task.task_id, 'IMPLEMENT_CHANGE')
  assert.equal(first.action.task_id, opened.task.task_id)
  assert.equal(first.action.repository_binding_digest, opened.task.repository.binding_digest)
  assert.deepEqual(first.action.allowed_effects, ['read_repository', 'edit_repository_files'])
  assert.deepEqual(first.action.required_evidence, [
    { kind: 'repository_observation', required: true },
    { kind: 'implementation_summary', required: true },
  ])
  assert.equal(first.action.payload_contract, 'PLAN')
  assert.deepEqual(opened.task.contract.verification_budget, {
    level: 'targeted',
    max_automatic_commands: 3,
    allow_full_suite: false,
    allow_manual_handoff: false,
  })
  assert.throws(() => state.apply(applyInput(first.action, 'bad-payload', {
    result: 'succeeded', summary: 'ok', extra: true,
  })), error => error?.code === 'INVALID_ARGUMENT')

  for (const [field, value, code] of [
    ['host', 'codex', 'HOST_OWNERSHIP_CONFLICT'],
    ['revision', first.action.revision + 1, 'REVISION_CONFLICT'],
    ['action_kind', 'VERIFY_CHANGE', 'ACTION_STALE'],
    ['repository_binding_digest', '9'.repeat(64), 'REPOSITORY_DRIFT'],
  ]) {
    const invalid = applyInput(first.action, `bad-${field}`)
    invalid[field] = value
    assert.throws(() => state.apply(invalid), error => error?.code === code)
  }
})

test('fake state rejects every non-closed phase payload and derives verification budget from evidence', () => {
  const state = createResultVector('task_journey').state
  const opened = state.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  let next = state.next({ host: 'deepseek', task_id: opened.task.task_id })
  let sequence = 0
  while (next.action !== null) {
    sequence += 1
    const invalid = payloadFor(next.action)
    invalid.extra = true
    assert.throws(
      () => state.apply(applyInput(next.action, `invalid-${sequence}`, invalid)),
      error => error?.code === 'INVALID_ARGUMENT',
    )
    state.apply(applyInput(next.action, `valid-${sequence}`))
    next = state.next({ host: 'deepseek', task_id: opened.task.task_id })
  }
  assert.deepEqual(state.verification(), { used: 1, limit: 3 })

  const overBudget = createResultVector('task_journey').state
  const overOpened = overBudget.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  const verify = advanceUntil(overBudget, overOpened.task.task_id, 'VERIFY_CHANGE')
  const payload = payloadFor(verify.action)
  payload.checks[0].command_count = 4
  assert.throws(
    () => overBudget.apply(applyInput(verify.action, 'over-budget', payload)),
    error => error?.code === 'VERIFICATION_BUDGET_EXCEEDED',
  )
})

test('fake state rejects contradictory implementation claims, forbidden full suites, and blind replay', () => {
  const implementationState = createResultVector('task_journey').state
  const implementationTask = implementationState.open({
    host: 'deepseek', repository_path: '/repo', new_task: newTask,
  }).task
  const implementation = advanceUntil(implementationState, implementationTask.task_id, 'IMPLEMENT_CHANGE')
  const contradictory = payloadFor(implementation.action)
  contradictory.no_file_changes = true
  assert.throws(
    () => implementationState.apply(applyInput(implementation.action, 'contradictory', contradictory)),
    error => error?.code === 'INVALID_ARGUMENT',
  )

  const verificationState = createResultVector('task_journey').state
  const verificationTask = verificationState.open({
    host: 'deepseek', repository_path: '/repo', new_task: newTask,
  }).task
  const verification = advanceUntil(verificationState, verificationTask.task_id, 'VERIFY_CHANGE')
  const fullSuite = payloadFor(verification.action)
  fullSuite.checks[0].full_suite = true
  assert.throws(
    () => verificationState.apply(applyInput(verification.action, 'forbidden-full-suite', fullSuite)),
    error => error?.code === 'VERIFICATION_BUDGET_EXCEEDED',
  )

  const replayState = createResultVector('task_journey').state
  const replayTask = replayState.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask }).task
  const first = replayState.next({ host: 'deepseek', task_id: replayTask.task_id })
  const original = applyInput(first.action, 'request-replay')
  replayState.apply(original)
  assert.throws(
    () => replayState.apply(original),
    error => error?.code === 'REVISION_CONFLICT',
  )
})

test('fake operation probe, blocker, and explicit cancellation remain Core-owned', () => {
  const uncertainState = createResultVector('task_journey').state
  const opened = uncertainState.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask })
  const first = uncertainState.next({ host: 'deepseek', task_id: opened.task.task_id })
  const firstPayload = payloadFor(first.action)
  uncertainState.apply(applyInput(first.action, 'uncertain', firstPayload))
  assert.equal(uncertainState.get(readInput(first.action, 'uncertain', firstPayload))
    .recovery_assessment.classification, 'completed_and_recorded')
  for (const mutate of [
    probe => { probe.action_id = 'wrong-action' },
    probe => { probe.expected_revision += 1 },
    probe => { probe.repository_binding_digest = '9'.repeat(64) },
    probe => { probe.payload.summary = 'different payload' },
  ]) {
    const input = readInput(first.action, 'uncertain', structuredClone(firstPayload))
    mutate(input.operation_probe)
    const assessment = uncertainState.get(input).recovery_assessment
    assert.equal(assessment.classification, 'conflicting')
    assert.equal(assessment.committed_proof, null)
  }
  for (const mutate of [
    probe => { probe.action_kind = 'VERIFY_CHANGE' },
    probe => { probe.payload.extra = true },
  ]) {
    const input = readInput(first.action, 'uncertain', structuredClone(firstPayload))
    mutate(input.operation_probe)
    assert.throws(
      () => uncertainState.get(input),
      error => error?.code === 'INVALID_ARGUMENT',
    )
  }
  const missingIdentity = readInput(first.action, 'uncertain', firstPayload)
  delete missingIdentity.operation_probe.action_id
  assert.throws(
    () => uncertainState.get(missingIdentity),
    error => error?.code === 'INVALID_ARGUMENT',
  )

  const blockedState = createResultVector('task_journey').state
  const blockedTask = blockedState.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask }).task
  blockedState.setBlocker('review required')
  const blocked = blockedState.next({ host: 'deepseek', task_id: blockedTask.task_id })
  assert.equal(blocked.blocker.message, 'review required')
  assert.equal(blocked.phase, 'BLOCKED')
  assert.equal(blocked.action.kind, 'RESOLVE_BLOCKER')
  assert.equal(blocked.action.payload_contract, 'BLOCKED')
  assert.equal(blockedState.get({ host: 'deepseek', task_id: blockedTask.task_id })
    .task.last_operation.to_revision, blocked.revision)
  const resolved = blockedState.apply(applyInput(blocked.action, 'resolve-blocker', {
    result: 'succeeded', blocker_id: blocked.blocker.blocker_id, summary: 'binding restored',
    resolution_evidence: {
      condition: blocked.blocker.condition,
      observed_binding_digest: blocked.blocker.condition.expected_binding_digest,
    },
  }))
  assert.equal(resolved.task.phase, 'INTAKE')
  assert.equal(resolved.task.blocker, null)
  assert.equal(resolved.task.evidence.at(-1).name, 'blocker_resolution')

  const cancelledState = createResultVector('task_journey').state
  const cancelledTask = cancelledState.open({ host: 'deepseek', repository_path: '/repo', new_task: newTask }).task
  assert.throws(
    () => cancelledState.cancel({
      host: 'deepseek', task_id: cancelledTask.task_id, revision: 2, reason: 'cancel',
    }),
    error => error?.code === 'REVISION_CONFLICT',
  )
  const cancelled = cancelledState.cancel({
    host: 'deepseek', task_id: cancelledTask.task_id,
    revision: cancelledTask.revision, reason: 'explicit user cancellation',
  })
  assert.equal(cancelled.task.phase, 'CANCELLED')
  assert.equal(cancelled.task.outcome.status, 'cancelled')
  assert.equal(cancelled.task.last_operation.kind, 'cancel_task')
  assert.equal(cancelled.task.last_operation.to_revision, cancelled.task.revision)
})
